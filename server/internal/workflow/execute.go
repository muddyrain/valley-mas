package workflow

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"strings"
	"time"
)

func ResolveTemplate(value string, outputs map[string]map[string]any) (any, error) {
	return resolveTemplate(value, outputs, nil)
}

func resolveTemplate(value string, outputs map[string]map[string]any, locals map[string]any) (any, error) {
	matches := templatePattern.FindAllStringIndex(value, -1)
	if len(matches) == 1 && matches[0][0] == 0 && matches[0][1] == len(value) {
		return resolveTemplateToken(value, outputs, locals)
	}
	var resolveErr error
	resolved := templatePattern.ReplaceAllStringFunc(value, func(token string) string {
		result, err := resolveTemplateToken(token, outputs, locals)
		if err != nil {
			resolveErr = err
			return token
		}
		return fmt.Sprint(result)
	})
	if resolveErr != nil {
		return nil, resolveErr
	}
	return resolved, nil
}

func resolveTemplateToken(token string, outputs map[string]map[string]any, locals map[string]any) (any, error) {
	reference := strings.TrimSpace(token[2 : len(token)-2])
	if !strings.Contains(reference, ".") {
		if value, exists := locals[reference]; exists {
			return value, nil
		}
		return nil, fmt.Errorf("变量 %s 不存在或不在上游", reference)
	}
	nodeID, field, valid := splitReference(reference)
	if !valid {
		return nil, fmt.Errorf("无效变量 %s", token)
	}
	output, exists := outputs[nodeID]
	if !exists {
		return nil, fmt.Errorf("变量 %s 不存在或不在上游", reference)
	}
	result, exists := output[field]
	if !exists {
		return nil, fmt.Errorf("变量 %s 不存在或不在上游", reference)
	}
	return result, nil
}

func Execute(ctx context.Context, graph Graph, registry *Registry, run RunContext, emit func(Event)) error {
	if errs := ValidateGraph(graph, registry); len(errs) > 0 {
		return fmt.Errorf("工作流校验失败：%s", strings.Join(errs, "；"))
	}
	ordered, err := topologicalNodes(graph)
	if err != nil {
		return err
	}
	if run.Inputs == nil {
		run.Inputs = map[string]any{}
	}
	if run.Outputs == nil {
		run.Outputs = map[string]map[string]any{}
	}
	run.Emitter = emit
	if err := normalizeRunInputs(graph, run.Inputs); err != nil {
		return err
	}

	outgoing := make(map[string][]int, len(graph.Nodes))
	incoming := make(map[string][]int, len(graph.Nodes))
	for index, edge := range graph.Edges {
		outgoing[edge.Source] = append(outgoing[edge.Source], index)
		incoming[edge.Target] = append(incoming[edge.Target], index)
	}
	activeEdges := make(map[int]bool, len(graph.Edges))
	outputFields := buildOutputFieldsByGraph(graph, registry)

	for _, node := range ordered {
		capabilityID := capabilityIDForNode(node)
		if node.Type != NodeTypeStart && !hasActiveIncoming(incoming[node.ID], activeEdges) {
			output := nullOutput(outputFields[node.ID])
			run.Outputs[node.ID] = output
			emitEvent(emit, Event{RunID: run.ID, NodeID: node.ID, NodeType: node.Type, CapabilityID: capabilityID, Status: StatusSkipped, Message: "未命中当前执行分支", Output: output})
			continue
		}
		startedAt := time.Now()
		input, inputErr := resolveNodeInput(node, run)
		if inputErr != nil {
			return emitFailure(emit, run.ID, node, capabilityID, input, inputErr, startedAt)
		}
		if err := ctx.Err(); err != nil {
			return emitFailure(emit, run.ID, node, capabilityID, input, err, startedAt)
		}
		matched, whenErr := evaluateWhen(node.When, run.Outputs)
		if whenErr != nil {
			return emitFailure(emit, run.ID, node, capabilityID, input, whenErr, startedAt)
		}
		if !matched {
			output := nullOutput(outputFields[node.ID])
			run.Outputs[node.ID] = output
			emitEvent(emit, Event{RunID: run.ID, NodeID: node.ID, NodeType: node.Type, CapabilityID: capabilityID, Status: StatusSkipped, Message: "执行条件未满足", Output: output})
			activateOutgoingEdges(node, output, graph.Edges, outgoing[node.ID], activeEdges)
			continue
		}
		emitEvent(emit, Event{RunID: run.ID, NodeID: node.ID, NodeType: node.Type, CapabilityID: capabilityID, Status: StatusRunning, Input: input})
		executor := registry.Executor(node.Type)
		if executor == nil {
			return emitFailure(emit, run.ID, node, capabilityID, input, fmt.Errorf("节点类型 %s 没有执行器", node.Type), startedAt)
		}
		result, executeErr := executor.Execute(ctx, run, NodeExecution{NodeID: node.ID, NodeType: node.Type, CapabilityID: capabilityID, Input: input})
		if executeErr != nil {
			return emitFailure(emit, run.ID, node, capabilityID, input, executeErr, startedAt)
		}
		if result.Output == nil {
			result.Output = map[string]any{}
		}
		run.Outputs[node.ID] = result.Output
		emitEvent(emit, Event{RunID: run.ID, NodeID: node.ID, NodeType: node.Type, CapabilityID: capabilityID, Status: StatusSucceeded, Input: input, Output: result.Output, DurationMs: time.Since(startedAt).Milliseconds()})
		activateOutgoingEdges(node, result.Output, graph.Edges, outgoing[node.ID], activeEdges)
	}
	return nil
}

func evaluateWhen(rule *Rule, outputs map[string]map[string]any) (bool, error) {
	if rule == nil {
		return true, nil
	}
	left, err := resolveAny(rule.Left, outputs)
	if err != nil {
		return false, err
	}
	right, err := resolveAny(rule.Right, outputs)
	if err != nil {
		return false, err
	}
	return evaluateCondition(left, rule.Operator, right)
}

func resolveNodeInput(node Node, run RunContext) (map[string]any, error) {
	if node.Type == NodeTypeStart {
		return run.Inputs, nil
	}
	config, err := decodeConfig(node.Config)
	if err != nil {
		return nil, err
	}
	if node.Type == NodeTypeMerge {
		return config, nil
	}
	if node.Type == NodeTypeLoop {
		return config, nil
	}
	if node.Type == NodeTypeLLM {
		return resolveLLMNodeInput(config, run.Outputs)
	}
	resolved, err := resolveAny(config, run.Outputs)
	if err != nil {
		return nil, err
	}
	result, ok := resolved.(map[string]any)
	if !ok {
		return nil, fmt.Errorf("节点配置必须为对象")
	}
	return result, nil
}

func resolveLLMNodeInput(config map[string]any, outputs map[string]map[string]any) (map[string]any, error) {
	base := make(map[string]any, len(config))
	for key, value := range config {
		if key == "inputs" || key == "prompt" || key == "systemPrompt" {
			continue
		}
		base[key] = value
	}
	resolvedBase, err := resolveAny(base, outputs)
	if err != nil {
		return nil, err
	}
	result, ok := resolvedBase.(map[string]any)
	if !ok {
		return nil, fmt.Errorf("节点配置必须为对象")
	}

	inputs := map[string]any{}
	if rawInputs, exists := config["inputs"]; exists {
		resolvedInputs, err := resolveAny(rawInputs, outputs)
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
		resolved, err := resolveTemplate(raw, outputs, inputs)
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

func resolveAny(value any, outputs map[string]map[string]any) (any, error) {
	switch typed := value.(type) {
	case string:
		return ResolveTemplate(typed, outputs)
	case map[string]any:
		result := make(map[string]any, len(typed))
		for key, item := range typed {
			resolved, err := resolveAny(item, outputs)
			if err != nil {
				return nil, err
			}
			result[key] = resolved
		}
		return result, nil
	case []any:
		result := make([]any, len(typed))
		for index, item := range typed {
			resolved, err := resolveAny(item, outputs)
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

func activateOutgoingEdges(node Node, output map[string]any, edges []Edge, indexes []int, active map[int]bool) {
	selected := ""
	if node.Type == NodeTypeCondition {
		if matched, _ := output["matched"].(bool); matched {
			selected = "true"
		} else {
			selected = "false"
		}
	}
	if node.Type == NodeTypeIntent {
		intentID := stringFromValue(output["intentId"])
		if intentID == "" {
			intentID = otherIntentID
		}
		selected = "intent:" + intentID
	}
	if node.Type == NodeTypeSwitch {
		matchedCaseID := stringFromValue(output["matchedCaseId"])
		if matchedCaseID == "" {
			matchedCaseID = "default"
		}
		if matchedCaseID == "default" {
			selected = "default"
		} else {
			selected = "case:" + matchedCaseID
		}
	}
	for _, index := range indexes {
		active[index] = selected == "" || edges[index].SourceHandle == selected
	}
}

func hasActiveIncoming(indexes []int, active map[int]bool) bool {
	for _, index := range indexes {
		if active[index] {
			return true
		}
	}
	return false
}

func nullOutput(fields map[string]ValueType) map[string]any {
	result := map[string]any{}
	for name := range fields {
		result[name] = nil
	}
	return result
}

func capabilityIDForNode(node Node) string {
	if node.Type != NodeTypeTool {
		return ""
	}
	config, _ := decodeConfig(node.Config)
	return stringFromValue(config["capabilityId"])
}

func emitFailure(emit func(Event), runID string, node Node, capabilityID string, input map[string]any, err error, startedAt time.Time) error {
	message, code := publicExecutionError(node, err)
	status := StatusFailed
	if errors.Is(err, context.Canceled) {
		status = StatusCancelled
	}
	emitEvent(emit, Event{RunID: runID, NodeID: node.ID, NodeType: node.Type, CapabilityID: capabilityID, Status: status, Input: input, Message: message, Error: code, DurationMs: time.Since(startedAt).Milliseconds()})
	return err
}

func publicExecutionError(node Node, err error) (string, string) {
	if errors.Is(err, context.Canceled) {
		return "运行已取消", "WORKFLOW_CANCELLED"
	}
	if errors.Is(err, context.DeadlineExceeded) {
		if node.Type == NodeTypeLLM {
			return "大模型响应超时，请稍后重试", "AI_UPSTREAM_TIMEOUT"
		}
		return "节点执行超时，请稍后重试", "WORKFLOW_NODE_TIMEOUT"
	}
	message := err.Error()
	switch {
	case errors.Is(err, ErrLLMStructuredOutputInvalid):
		return "模型返回格式不符合输出字段，请调整提示词后重试", "LLM_STRUCTURED_OUTPUT_INVALID"
	case errors.Is(err, ErrIntentClassificationInvalid):
		return "意图识别结果无效，请稍后重试", "INTENT_CLASSIFICATION_INVALID"
	case strings.Contains(message, "AI 服务未配置") || strings.Contains(message, "ARK_"):
		return "AI 服务未配置，请检查 Provider 密钥和 Base URL", "AI_CONFIGURATION_UNAVAILABLE"
	case strings.Contains(message, "AI 上游调用失败"):
		return "模型上游调用失败，请稍后重试或检查 Provider 配置", "AI_UPSTREAM_FAILED"
	case strings.Contains(message, "AI 响应解析失败") || strings.Contains(message, "AI 返回为空"):
		return "模型没有返回可用内容，请调整提示词后重试", "AI_RESPONSE_INVALID"
	case strings.Contains(message, "Notion OAuth 尚未配置"):
		return "Notion 服务尚未配置，请联系管理员", "NOTION_CONFIGURATION_UNAVAILABLE"
	case strings.Contains(message, "Notion 连接不存在"):
		return "请先在工具页连接 Notion 工作区", "NOTION_NOT_CONNECTED"
	case strings.Contains(message, "Notion 凭据无法解密"):
		return "Notion 授权已失效，请重新连接工作区", "NOTION_CONNECTION_INVALID"
	case strings.Contains(message, "Notion 搜索请求失败") || strings.Contains(message, "Notion 搜索响应无效"):
		return "Notion 搜索暂时不可用，请稍后重试", "NOTION_SEARCH_FAILED"
	case strings.Contains(message, "变量"):
		return message, "WORKFLOW_VARIABLE_RESOLUTION_FAILED"
	case node.Type == NodeTypeLLM:
		return "大模型节点执行失败，请检查提示词和模型配置", "AI_NODE_FAILED"
	case node.Type == NodeTypeIntent:
		return "意图识别节点执行失败，请检查输入或模型配置", "INTENT_NODE_FAILED"
	default:
		return "节点执行失败，请检查节点配置或服务状态", "WORKFLOW_NODE_FAILED"
	}
}

func emitEvent(emit func(Event), event Event) {
	if emit == nil {
		return
	}
	event.Input = SafePreviewMap(event.Input)
	event.Output = SafePreviewMap(event.Output)
	emit(event)
}

func SafePreviewMap(values map[string]any) map[string]any {
	if values == nil {
		return nil
	}
	result := make(map[string]any, len(values))
	for key, value := range values {
		switch typed := value.(type) {
		case FileInput:
			result[key] = map[string]any{"filename": typed.Filename, "contentType": typed.ContentType, "size": typed.Size}
		case *FileInput:
			if typed != nil {
				result[key] = map[string]any{"filename": typed.Filename, "contentType": typed.ContentType, "size": typed.Size}
			}
		case string:
			if len([]rune(typed)) > 300 {
				result[key] = string([]rune(typed)[:300]) + "…"
			} else {
				result[key] = typed
			}
		case map[string]any:
			result[key] = SafePreviewMap(typed)
		default:
			result[key] = value
		}
	}
	return result
}

func topologicalNodes(graph Graph) ([]Node, error) {
	nodes := make(map[string]Node, len(graph.Nodes))
	incoming := make(map[string]int, len(graph.Nodes))
	adjacency := make(map[string][]string, len(graph.Nodes))
	for _, node := range graph.Nodes {
		nodes[node.ID] = node
	}
	for _, edge := range graph.Edges {
		incoming[edge.Target]++
		adjacency[edge.Source] = append(adjacency[edge.Source], edge.Target)
	}
	queue := []string{}
	for id := range nodes {
		if incoming[id] == 0 {
			queue = append(queue, id)
		}
	}
	sort.Strings(queue)
	ordered := make([]Node, 0, len(nodes))
	for len(queue) > 0 {
		current := queue[0]
		queue = queue[1:]
		ordered = append(ordered, nodes[current])
		for _, next := range adjacency[current] {
			incoming[next]--
			if incoming[next] == 0 {
				queue = append(queue, next)
				sort.Strings(queue)
			}
		}
	}
	if len(ordered) != len(nodes) {
		return nil, fmt.Errorf("工作流不能包含循环")
	}
	return ordered, nil
}

func normalizeRunInputs(graph Graph, inputs map[string]any) error {
	var definitions map[string]InputDefinition
	for _, node := range graph.Nodes {
		if node.Type == NodeTypeStart {
			config, _ := decodeConfig(node.Config)
			encoded, _ := json.Marshal(config["inputs"])
			_ = json.Unmarshal(encoded, &definitions)
			break
		}
	}
	for name, definition := range definitions {
		value, exists := inputs[name]
		if definition.Required && (!exists || value == nil || value == "") {
			return fmt.Errorf("缺少必填输入 %s", name)
		}
		if !exists || value == nil {
			continue
		}
		switch definition.Type {
		case ValueTypeString:
			if _, ok := value.(string); !ok {
				return fmt.Errorf("输入 %s 必须为 string", name)
			}
		case ValueTypeBoolean:
			if _, ok := value.(bool); !ok {
				return fmt.Errorf("输入 %s 必须为 boolean", name)
			}
		case ValueTypeNumber:
			if numberFromValue(value) == 0 && fmt.Sprint(value) != "0" {
				return fmt.Errorf("输入 %s 必须为 number", name)
			}
		case ValueTypeStringList:
			if _, err := stringListFromValue(value); err != nil {
				return fmt.Errorf("输入 %s 必须为 string[]", name)
			}
		case ValueTypeArray:
			switch value.(type) {
			case []any, []string, []float64, []int, []bool:
			default:
				return fmt.Errorf("输入 %s 必须为 array", name)
			}
		case ValueTypeFile:
			if _, err := fileFromValue(value); err != nil {
				return fmt.Errorf("输入 %s 必须为 file", name)
			}
		}
	}
	return nil
}

func buildOutputFieldsByGraph(graph Graph, registry *Registry) map[string]map[string]ValueType {
	nodes := make(map[string]Node, len(graph.Nodes))
	startInputs := map[string]InputDefinition{}
	for _, node := range graph.Nodes {
		nodes[node.ID] = node
		if node.Type == NodeTypeStart {
			config, _ := decodeConfig(node.Config)
			encoded, _ := json.Marshal(config["inputs"])
			_ = json.Unmarshal(encoded, &startInputs)
		}
	}
	return buildOutputFields(nodes, startInputs, registry)
}
