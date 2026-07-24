package workflow

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"
)

const (
	maxLoopIterations = 1000
	maxLoopBodyNodes  = 30
	maxLoopDepth      = 3
)

type loopMode string

const (
	loopModeArray    loopMode = "array"
	loopModeCount    loopMode = "count"
	loopModeInfinite loopMode = "infinite"
)

type loopVariable struct {
	Name         string    `json:"name"`
	Type         ValueType `json:"type"`
	InitialValue any       `json:"initialValue"`
}

type loopOutput struct {
	Name   string    `json:"name"`
	Type   ValueType `json:"type"`
	Source string    `json:"source"`
}

type loopBody struct {
	Nodes []Node `json:"nodes"`
	Edges []Edge `json:"edges"`
}

type loopNodeConfig struct {
	Mode            loopMode       `json:"mode"`
	Input           any            `json:"input"`
	Count           any            `json:"count"`
	MaxIterations   int            `json:"maxIterations"`
	MiddleVariables []loopVariable `json:"middleVariables"`
	Outputs         []loopOutput   `json:"outputs"`
	Body            loopBody       `json:"body"`
}

type loopControl string

type loopBodyExecutionError struct {
	node Node
	err  error
}

func (err *loopBodyExecutionError) Error() string {
	return fmt.Sprintf("循环体节点 %s 执行失败: %v", err.node.ID, err.err)
}

func (err *loopBodyExecutionError) Unwrap() error { return err.err }

const (
	loopControlNone      loopControl = ""
	loopControlContinue  loopControl = "continue"
	loopControlTerminate loopControl = "terminate"
)

// LoopExecutor keeps the public graph acyclic and evaluates the loop body's
// nested DAG once per iteration.
type LoopExecutor struct{ Registry *Registry }

func (LoopExecutor) Type() NodeType { return NodeTypeLoop }

func (executor LoopExecutor) Execute(ctx context.Context, run RunContext, execution NodeExecution) (NodeResult, error) {
	config, err := loopConfigFromMap(execution.Input)
	if err != nil {
		return NodeResult{}, err
	}
	iterations, items, err := loopIterations(config, run.Outputs)
	if err != nil {
		return NodeResult{}, err
	}
	middle := make(map[string]any, len(config.MiddleVariables))
	for _, variable := range config.MiddleVariables {
		value, resolveErr := resolveAny(variable.InitialValue, run.Outputs)
		if resolveErr != nil {
			return NodeResult{}, resolveErr
		}
		middle[variable.Name] = value
	}
	aggregated := make(map[string][]any, len(config.Outputs))
	for _, output := range config.Outputs {
		aggregated[output.Name] = []any{}
	}
	loopCtx, cancel := loopExecutionContext(ctx, iterations, config.Body)
	defer cancel()
	for iteration := 0; iteration < iterations; iteration++ {
		if err := loopCtx.Err(); err != nil {
			return NodeResult{}, err
		}
		locals := cloneAnyMap(middle)
		locals["index"] = iteration
		if config.Mode == loopModeArray {
			locals["item"] = items[iteration]
		}
		bodyRun := run
		bodyRun.Outputs = cloneOutputs(run.Outputs)
		control, nextMiddle, err := executor.executeBody(loopCtx, config.Body, bodyRun, execution, locals, iteration, 1)
		if err != nil {
			return NodeResult{}, fmt.Errorf("循环第 %d 轮失败: %w", iteration+1, err)
		}
		middle = nextMiddle
		outputLocals := cloneAnyMap(nextMiddle)
		outputLocals["index"] = iteration
		if config.Mode == loopModeArray {
			outputLocals["item"] = items[iteration]
		}
		for _, output := range config.Outputs {
			value, resolveErr := resolveTemplate(output.Source, bodyRun.Outputs, outputLocals)
			if resolveErr != nil {
				return NodeResult{}, fmt.Errorf("循环输出 %s 无法解析: %w", output.Name, resolveErr)
			}
			aggregated[output.Name] = append(aggregated[output.Name], value)
		}
		if control == loopControlTerminate {
			break
		}
	}
	output := make(map[string]any, len(aggregated))
	for name, values := range aggregated {
		output[name] = values
	}
	return NodeResult{Output: output}, nil
}

// loopExecutionContext gives the entire loop enough time for each model call
// while retaining the normal timeout for every individual upstream request.
// For example, a loop that executes two model nodes for five rounds receives a
// 20-minute total budget, but every model call still times out after 120s.
func loopExecutionContext(ctx context.Context, iterations int, body loopBody) (context.Context, context.CancelFunc) {
	requestCount := iterations * loopModelRequestCount(body)
	if requestCount <= 0 {
		return context.WithCancel(ctx)
	}
	return context.WithTimeout(ctx, time.Duration(requestCount)*workflowModelRequestTimeout)
}

func loopModelRequestCount(body loopBody) int {
	count := 0
	for _, node := range body.Nodes {
		if node.Type == NodeTypeLLM {
			count++
		}
	}
	return count
}

func (executor LoopExecutor) executeBody(
	ctx context.Context,
	body loopBody,
	run RunContext,
	execution NodeExecution,
	locals map[string]any,
	iteration int,
	depth int,
) (loopControl, map[string]any, error) {
	graph := Graph{SchemaVersion: SchemaVersion, Nodes: body.Nodes, Edges: body.Edges}
	ordered, err := topologicalNodes(graph)
	if err != nil {
		return loopControlNone, locals, err
	}
	outgoing := make(map[string][]int, len(body.Nodes))
	incoming := make(map[string][]int, len(body.Nodes))
	for index, edge := range body.Edges {
		outgoing[edge.Source] = append(outgoing[edge.Source], index)
		incoming[edge.Target] = append(incoming[edge.Target], index)
	}
	activeEdges := make(map[int]bool, len(body.Edges))
	outputFields := buildLoopBodyOutputFields(body, executor.Registry)
	nextMiddle := cloneAnyMap(locals)
	for _, node := range ordered {
		isRoot := len(incoming[node.ID]) == 0
		if !isRoot && !hasActiveIncoming(incoming[node.ID], activeEdges) {
			run.Outputs[node.ID] = nullOutput(outputFields[node.ID])
			executor.emitBodyEvent(run, execution, node, iteration, depth, StatusSkipped, "未命中当前执行分支", nil, run.Outputs[node.ID], "", 0)
			continue
		}
		input, resolveErr := resolveLoopBodyInput(node, run, nextMiddle)
		if resolveErr != nil {
			message, code := publicExecutionError(node, resolveErr)
			executor.emitBodyEvent(run, execution, node, iteration, depth, StatusFailed, message, nil, nil, code, 0)
			return loopControlNone, nextMiddle, &loopBodyExecutionError{node: node, err: resolveErr}
		}
		matched, whenErr := evaluateWhenWithLocals(node.When, run.Outputs, nextMiddle)
		if whenErr != nil {
			message, code := publicExecutionError(node, whenErr)
			executor.emitBodyEvent(run, execution, node, iteration, depth, StatusFailed, message, input, nil, code, 0)
			return loopControlNone, nextMiddle, &loopBodyExecutionError{node: node, err: whenErr}
		}
		if !matched {
			run.Outputs[node.ID] = nullOutput(outputFields[node.ID])
			executor.emitBodyEvent(run, execution, node, iteration, depth, StatusSkipped, "执行条件未满足", input, run.Outputs[node.ID], "", 0)
			activateOutgoingEdges(node, run.Outputs[node.ID], body.Edges, outgoing[node.ID], activeEdges)
			continue
		}
		startedAt := time.Now()
		executor.emitBodyEvent(run, execution, node, iteration, depth, StatusRunning, "", input, nil, "", 0)
		switch node.Type {
		case NodeTypeSetLoopVar:
			name := strings.TrimSpace(stringFromValue(input["name"]))
			if name == "" {
				return loopControlNone, nextMiddle, fmt.Errorf("设置循环变量名称不能为空")
			}
			nextMiddle[name] = input["value"]
			run.Outputs[node.ID] = map[string]any{name: input["value"]}
		case NodeTypeContinueLoop:
			run.Outputs[node.ID] = map[string]any{"continued": true}
			executor.emitBodyEvent(run, execution, node, iteration, depth, StatusSucceeded, "", input, run.Outputs[node.ID], "", time.Since(startedAt).Milliseconds())
			return loopControlContinue, nextMiddle, nil
		case NodeTypeTerminateLoop:
			run.Outputs[node.ID] = map[string]any{"terminated": true}
			executor.emitBodyEvent(run, execution, node, iteration, depth, StatusSucceeded, "", input, run.Outputs[node.ID], "", time.Since(startedAt).Milliseconds())
			return loopControlTerminate, nextMiddle, nil
		default:
			registered := executor.Registry.Executor(node.Type)
			if registered == nil {
				return loopControlNone, nextMiddle, fmt.Errorf("循环体节点类型 %s 没有执行器", node.Type)
			}
			result, executeErr := registered.Execute(ctx, run, NodeExecution{NodeID: node.ID, NodeType: node.Type, CapabilityID: capabilityIDForNode(node), Input: input, Locals: nextMiddle})
			if executeErr != nil {
				message, code := publicExecutionError(node, executeErr)
				executor.emitBodyEvent(run, execution, node, iteration, depth, StatusFailed, message, input, nil, code, time.Since(startedAt).Milliseconds())
				return loopControlNone, nextMiddle, &loopBodyExecutionError{node: node, err: executeErr}
			}
			if result.Output == nil {
				result.Output = map[string]any{}
			}
			run.Outputs[node.ID] = result.Output
		}
		executor.emitBodyEvent(run, execution, node, iteration, depth, StatusSucceeded, "", input, run.Outputs[node.ID], "", time.Since(startedAt).Milliseconds())
		activateOutgoingEdges(node, run.Outputs[node.ID], body.Edges, outgoing[node.ID], activeEdges)
	}
	return loopControlNone, nextMiddle, nil
}

func (LoopExecutor) emitBodyEvent(run RunContext, parent NodeExecution, node Node, iteration, depth int, status RunStatus, message string, input, output map[string]any, errorCode string, duration int64) {
	if run.Emitter == nil {
		return
	}
	emitEvent(run.Emitter, Event{RunID: run.ID, NodeID: parent.NodeID, NodeType: NodeTypeLoop, Status: status, Message: message, Input: input, Output: output, Error: errorCode, DurationMs: duration, LoopIteration: &iteration, LoopDepth: depth, BodyNodeID: node.ID})
}

func loopConfigFromMap(config map[string]any) (loopNodeConfig, error) {
	encoded, err := json.Marshal(config)
	if err != nil {
		return loopNodeConfig{}, err
	}
	var parsed loopNodeConfig
	if err := json.Unmarshal(encoded, &parsed); err != nil {
		return loopNodeConfig{}, err
	}
	if parsed.Mode != loopModeArray && parsed.Mode != loopModeCount && parsed.Mode != loopModeInfinite {
		return loopNodeConfig{}, fmt.Errorf("循环 mode 必须为 array、count 或 infinite")
	}
	if len(parsed.Body.Nodes) == 0 || len(parsed.Body.Nodes) > maxLoopBodyNodes {
		return loopNodeConfig{}, fmt.Errorf("循环体节点数必须为 1 到 %d", maxLoopBodyNodes)
	}
	if parsed.Mode == loopModeInfinite && (parsed.MaxIterations < 1 || parsed.MaxIterations > maxLoopIterations) {
		return loopNodeConfig{}, fmt.Errorf("无限循环必须声明 1 到 %d 的 maxIterations", maxLoopIterations)
	}
	return parsed, nil
}

func validateLoopConfig(nodeID string, config map[string]any, registry *Registry, depth int) []string {
	parsed, err := loopConfigFromMap(config)
	if err != nil {
		return []string{fmt.Sprintf("循环节点 %s 配置无效：%v", nodeID, err)}
	}
	if depth > maxLoopDepth {
		return []string{fmt.Sprintf("循环节点 %s 的嵌套深度不能超过 %d", nodeID, maxLoopDepth)}
	}
	errs := []string{}
	if parsed.Mode == loopModeArray && parsed.Input == nil {
		errs = append(errs, fmt.Sprintf("循环节点 %s 必须配置数组输入", nodeID))
	}
	if parsed.Mode == loopModeCount && parsed.Count == nil {
		errs = append(errs, fmt.Sprintf("循环节点 %s 必须配置循环次数", nodeID))
	}
	middle := map[string]ValueType{}
	for _, variable := range parsed.MiddleVariables {
		name := strings.TrimSpace(variable.Name)
		if !validLoopVariableName(name) || middle[name] != "" || !validValueType(variable.Type) {
			errs = append(errs, fmt.Sprintf("循环节点 %s 的中间变量 %s 无效或重复", nodeID, variable.Name))
			continue
		}
		middle[name] = variable.Type
	}
	outputNames := map[string]bool{}
	for _, output := range parsed.Outputs {
		if !validLoopVariableName(strings.TrimSpace(output.Name)) || outputNames[output.Name] || !validValueType(output.Type) {
			errs = append(errs, fmt.Sprintf("循环节点 %s 的输出 %s 无效或重复", nodeID, output.Name))
			continue
		}
		if _, ok := exactReference(output.Source); !ok {
			errs = append(errs, fmt.Sprintf("循环节点 %s 的输出 %s 必须引用循环体节点输出或循环变量", nodeID, output.Name))
		}
		outputNames[output.Name] = true
	}
	errs = append(errs, validateLoopBody(nodeID, parsed, registry, depth, middle)...)
	return errs
}

func validateLoopBody(parentID string, config loopNodeConfig, registry *Registry, depth int, middle map[string]ValueType) []string {
	errs := []string{}
	nodes := make(map[string]Node, len(config.Body.Nodes))
	incoming := make(map[string]int, len(config.Body.Nodes))
	outgoing := make(map[string]int, len(config.Body.Nodes))
	adjacency := make(map[string][]string, len(config.Body.Nodes))
	for _, node := range config.Body.Nodes {
		if strings.TrimSpace(node.ID) == "" || nodes[node.ID].ID != "" {
			errs = append(errs, fmt.Sprintf("循环节点 %s 的循环体节点 ID 为空或重复", parentID))
			continue
		}
		if node.Type == NodeTypeStart || node.Type == NodeTypeEnd || !registry.Supports(node.Type) {
			errs = append(errs, fmt.Sprintf("循环节点 %s 的循环体节点 %s 类型未开放", parentID, node.ID))
			continue
		}
		nodes[node.ID] = node
		bodyConfig, err := decodeConfig(node.Config)
		if err != nil {
			errs = append(errs, fmt.Sprintf("循环体节点 %s 配置无效: %v", node.ID, err))
			continue
		}
		switch node.Type {
		case NodeTypeLLM:
			if stringFromValue(bodyConfig["prompt"]) == "" {
				errs = append(errs, fmt.Sprintf("循环体大模型节点 %s 的 prompt 不能为空", node.ID))
			}
		case NodeTypeTool:
			capability, _, ok := registry.Capability(stringFromValue(bodyConfig["capabilityId"]))
			if !ok {
				errs = append(errs, fmt.Sprintf("循环体工具节点 %s 的 capabilityId 未开放", node.ID))
			} else if inputs, ok := bodyConfig["inputs"].(map[string]any); ok {
				errs = append(errs, validateCapabilityInputs(node.ID, inputs, capability.InputSchema)...)
			} else {
				errs = append(errs, fmt.Sprintf("循环体工具节点 %s inputs 必须为对象", node.ID))
			}
		case NodeTypeCondition:
			errs = append(errs, validateRule(Rule{Left: bodyConfig["left"], Operator: stringFromValue(bodyConfig["operator"]), Right: bodyConfig["right"]}, node.ID)...)
		case NodeTypeSwitch:
			errs = append(errs, validateSwitchConfig(node.ID, bodyConfig)...)
		case NodeTypeMerge:
			errs = append(errs, validateMergeConfig(node.ID, bodyConfig)...)
		case NodeTypeVariable:
			errs = append(errs, validateAssignments(node.ID, bodyConfig)...)
		case NodeTypeSubworkflow:
			for _, name := range []string{"workflowId", "versionId"} {
				if stringFromValue(bodyConfig[name]) == "" {
					errs = append(errs, fmt.Sprintf("循环体子工作流节点 %s 的 %s 不能为空", node.ID, name))
				}
			}
		case NodeTypeIntent:
			errs = append(errs, validateIntentConfig(node.ID, bodyConfig)...)
		case NodeTypeSetLoopVar:
			name := strings.TrimSpace(stringFromValue(bodyConfig["name"]))
			if middle[name] == "" || bodyConfig["value"] == nil {
				errs = append(errs, fmt.Sprintf("循环体设置变量节点 %s 必须更新已声明的中间变量", node.ID))
			}
		case NodeTypeLoop:
			errs = append(errs, validateLoopConfig(node.ID, bodyConfig, registry, depth+1)...)
		}
	}
	for _, edge := range config.Body.Edges {
		if _, sourceOK := nodes[edge.Source]; !sourceOK {
			errs = append(errs, fmt.Sprintf("循环节点 %s 的循环体连线引用了不存在的源节点", parentID))
			continue
		}
		if _, targetOK := nodes[edge.Target]; !targetOK {
			errs = append(errs, fmt.Sprintf("循环节点 %s 的循环体连线引用了不存在的目标节点", parentID))
			continue
		}
		adjacency[edge.Source] = append(adjacency[edge.Source], edge.Target)
		incoming[edge.Target]++
		outgoing[edge.Source]++
	}
	rootCount := 0
	for id, node := range nodes {
		if incoming[id] == 0 {
			rootCount++
		}
		if (node.Type == NodeTypeContinueLoop || node.Type == NodeTypeTerminateLoop) && outgoing[id] != 0 {
			errs = append(errs, fmt.Sprintf("循环体控制节点 %s 不能有出边", id))
		}
	}
	if rootCount != 1 {
		errs = append(errs, fmt.Sprintf("循环节点 %s 的循环体必须且只能有一个入口节点", parentID))
	}
	if hasCycle(nodes, adjacency, incoming) {
		errs = append(errs, fmt.Sprintf("循环节点 %s 的循环体必须是 DAG", parentID))
	}
	fields := buildLoopBodyOutputFields(config.Body, registry)
	for _, output := range config.Outputs {
		reference, ok := exactReference(output.Source)
		if !ok {
			continue
		}
		if isLoopOutputLocalReference(reference, middle, config.Mode) {
			continue
		}
		source, fieldName, parsed := splitReference(reference)
		if !parsed || fields[source] == nil || fields[source][fieldName] == "" {
			errs = append(errs, fmt.Sprintf("循环节点 %s 的输出 %s 未引用已声明的循环体字段", parentID, output.Name))
		}
	}
	return errs
}

func isLoopOutputLocalReference(reference string, middle map[string]ValueType, mode loopMode) bool {
	name := strings.TrimSpace(reference)
	if name == "index" || (name == "item" && mode == loopModeArray) {
		return true
	}
	_, exists := middle[name]
	return exists
}

func validLoopVariableName(value string) bool {
	if value == "" || value == "item" || value == "index" || len(value) > 40 {
		return false
	}
	for index, char := range value {
		if !(char == '_' || char >= 'a' && char <= 'z' || char >= 'A' && char <= 'Z' || (index > 0 && char >= '0' && char <= '9')) {
			return false
		}
	}
	return true
}

func loopIterations(config loopNodeConfig, outputs map[string]map[string]any) (int, []any, error) {
	switch config.Mode {
	case loopModeArray:
		value, err := resolveAny(config.Input, outputs)
		if err != nil {
			return 0, nil, err
		}
		items, ok := value.([]any)
		if !ok {
			if stringsValue, valid := value.([]string); valid {
				items = make([]any, len(stringsValue))
				for index, item := range stringsValue {
					items[index] = item
				}
			} else {
				return 0, nil, fmt.Errorf("循环输入必须为数组")
			}
		}
		if len(items) > maxLoopIterations {
			return 0, nil, fmt.Errorf("循环数组不能超过 %d 项", maxLoopIterations)
		}
		return len(items), items, nil
	case loopModeCount:
		value, err := resolveAny(config.Count, outputs)
		if err != nil {
			return 0, nil, err
		}
		count := int(numberFromValue(value))
		if count < 1 || count > maxLoopIterations {
			return 0, nil, fmt.Errorf("循环次数必须为 1 到 %d", maxLoopIterations)
		}
		return count, nil, nil
	case loopModeInfinite:
		return config.MaxIterations, nil, nil
	default:
		return 0, nil, fmt.Errorf("不支持的循环模式")
	}
}

func resolveLoopBodyInput(node Node, run RunContext, locals map[string]any) (map[string]any, error) {
	config, err := decodeConfig(node.Config)
	if err != nil {
		return nil, err
	}
	if node.Type == NodeTypeMerge {
		return config, nil
	}
	if node.Type == NodeTypeLLM {
		return resolveLLMNodeInputWithLocals(config, run.Outputs, locals)
	}
	resolved, err := resolveAnyWithLocals(config, run.Outputs, locals)
	if err != nil {
		return nil, err
	}
	result, ok := resolved.(map[string]any)
	if !ok {
		return nil, fmt.Errorf("循环体节点配置必须为对象")
	}
	return result, nil
}

func resolveAnyWithLocals(value any, outputs map[string]map[string]any, locals map[string]any) (any, error) {
	switch typed := value.(type) {
	case string:
		return resolveTemplate(typed, outputs, locals)
	case map[string]any:
		result := make(map[string]any, len(typed))
		for key, item := range typed {
			resolved, err := resolveAnyWithLocals(item, outputs, locals)
			if err != nil {
				return nil, err
			}
			result[key] = resolved
		}
		return result, nil
	case []any:
		result := make([]any, len(typed))
		for index, item := range typed {
			resolved, err := resolveAnyWithLocals(item, outputs, locals)
			if err != nil {
				return nil, err
			}
			result[index] = resolved
		}
		return result, nil
	default:
		return value, nil
	}
}

func resolveLLMNodeInputWithLocals(config map[string]any, outputs map[string]map[string]any, locals map[string]any) (map[string]any, error) {
	base := make(map[string]any, len(config))
	for key, value := range config {
		if key != "inputs" && key != "prompt" && key != "systemPrompt" {
			base[key] = value
		}
	}
	resolvedBase, err := resolveAnyWithLocals(base, outputs, locals)
	if err != nil {
		return nil, err
	}
	result, ok := resolvedBase.(map[string]any)
	if !ok {
		return nil, fmt.Errorf("大模型节点配置必须为对象")
	}
	inputs := map[string]any{}
	if rawInputs, exists := config["inputs"]; exists {
		resolvedInputs, err := resolveAnyWithLocals(rawInputs, outputs, locals)
		if err != nil {
			return nil, err
		}
		var valid bool
		inputs, valid = resolvedInputs.(map[string]any)
		if !valid {
			return nil, fmt.Errorf("大模型节点 inputs 必须为对象")
		}
	}
	result["inputs"] = inputs
	for _, key := range []string{"systemPrompt", "prompt"} {
		raw, _ := config[key].(string)
		resolved, err := resolveTemplate(raw, outputs, mergeAnyMaps(locals, inputs))
		if err != nil {
			return nil, err
		}
		text, ok := resolved.(string)
		if !ok {
			return nil, fmt.Errorf("大模型节点 %s 必须解析为文本", key)
		}
		result[key] = text
	}
	return result, nil
}

func evaluateWhenWithLocals(rule *Rule, outputs map[string]map[string]any, locals map[string]any) (bool, error) {
	if rule == nil {
		return true, nil
	}
	left, err := resolveAnyWithLocals(rule.Left, outputs, locals)
	if err != nil {
		return false, err
	}
	right, err := resolveAnyWithLocals(rule.Right, outputs, locals)
	if err != nil {
		return false, err
	}
	return evaluateCondition(left, rule.Operator, right)
}

func buildLoopBodyOutputFields(body loopBody, registry *Registry) map[string]map[string]ValueType {
	nodes := make(map[string]Node, len(body.Nodes))
	for _, node := range body.Nodes {
		nodes[node.ID] = node
	}
	return buildOutputFields(nodes, map[string]InputDefinition{}, registry)
}

func cloneOutputs(source map[string]map[string]any) map[string]map[string]any {
	result := make(map[string]map[string]any, len(source))
	for key, value := range source {
		result[key] = cloneAnyMap(value)
	}
	return result
}

func cloneAnyMap(source map[string]any) map[string]any {
	result := make(map[string]any, len(source))
	for key, value := range source {
		result[key] = value
	}
	return result
}

func mergeAnyMaps(left, right map[string]any) map[string]any {
	result := cloneAnyMap(left)
	for key, value := range right {
		result[key] = value
	}
	return result
}

func loopOutputFields(config map[string]any) map[string]ValueType {
	parsed, err := loopConfigFromMap(config)
	if err != nil {
		return map[string]ValueType{}
	}
	result := make(map[string]ValueType, len(parsed.Outputs))
	for _, output := range parsed.Outputs {
		result[output.Name] = ValueTypeArray
	}
	return result
}
