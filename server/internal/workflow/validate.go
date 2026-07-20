package workflow

import (
	"encoding/json"
	"fmt"
	"regexp"
	"sort"
	"strings"
)

var templatePattern = regexp.MustCompile(`\{\{\s*([^{}]+?)\s*\}\}`)

type InputDefinition struct {
	Type     ValueType `json:"type"`
	Required bool      `json:"required"`
}

type startNodeConfig struct {
	Inputs map[string]InputDefinition `json:"inputs"`
}

func ValidateGraph(graph Graph, registry *Registry) []string {
	errs := make([]string, 0)
	if graph.SchemaVersion != SchemaVersion {
		return []string{"GRAPH_VERSION_UNSUPPORTED: schemaVersion 必须为 4"}
	}
	if registry == nil {
		return []string{"工作流注册表不能为空"}
	}
	if len(graph.Nodes) > DefaultLimits.MaxNodes {
		errs = append(errs, fmt.Sprintf("节点数不能超过 %d", DefaultLimits.MaxNodes))
	}

	nodes := make(map[string]Node, len(graph.Nodes))
	startCount, endCount, modelCost, writeCost := 0, 0, 0, 0
	startInputs := map[string]InputDefinition{}
	for _, node := range graph.Nodes {
		if strings.TrimSpace(node.ID) == "" {
			errs = append(errs, "节点 ID 不能为空")
			continue
		}
		if _, exists := nodes[node.ID]; exists {
			errs = append(errs, fmt.Sprintf("节点 ID %s 重复", node.ID))
			continue
		}
		nodes[node.ID] = node
		if !registry.Supports(node.Type) {
			errs = append(errs, fmt.Sprintf("节点 %s 的类型 %s 未开放", node.ID, node.Type))
			continue
		}
		if node.Type == NodeTypeStart {
			startCount++
		}
		if node.Type == NodeTypeEnd {
			endCount++
		}
		if node.When != nil {
			definition := registry.nodes[node.Type]
			if !definition.WhenAllowed {
				errs = append(errs, fmt.Sprintf("节点 %s 不支持 when", node.ID))
			}
			errs = append(errs, validateRule(*node.When, node.ID)...)
		}
		config, err := decodeConfig(node.Config)
		if err != nil {
			errs = append(errs, fmt.Sprintf("节点 %s 配置无效: %v", node.ID, err))
			continue
		}
		switch node.Type {
		case NodeTypeStart:
			raw, ok := config["inputs"]
			if !ok {
				errs = append(errs, "开始节点必须声明 inputs")
				break
			}
			encoded, _ := json.Marshal(raw)
			if err := json.Unmarshal(encoded, &startInputs); err != nil {
				errs = append(errs, "开始节点 inputs 格式无效")
			}
			for name, definition := range startInputs {
				if strings.TrimSpace(name) == "" || !validValueType(definition.Type) {
					errs = append(errs, fmt.Sprintf("开始节点输入 %s 类型无效", name))
				}
			}
		case NodeTypeEnd:
			outputs, ok := config["outputs"].(map[string]any)
			if !ok {
				errs = append(errs, fmt.Sprintf("结束节点 %s outputs 必须为对象", node.ID))
				break
			}
			if rawTypes, exists := config["outputTypes"]; exists {
				outputTypes, valid := rawTypes.(map[string]any)
				if !valid {
					errs = append(errs, fmt.Sprintf("结束节点 %s outputTypes 必须为对象", node.ID))
					break
				}
				for name, rawType := range outputTypes {
					if _, exists := outputs[name]; !exists || !validValueType(ValueType(stringFromValue(rawType))) {
						errs = append(errs, fmt.Sprintf("结束节点 %s 的输出 %s 类型无效", node.ID, name))
					}
				}
			}
		case NodeTypeLLM:
			for _, name := range []string{"prompt"} {
				if stringFromValue(config[name]) == "" {
					errs = append(errs, fmt.Sprintf("大模型节点 %s 的 %s 不能为空", node.ID, name))
				}
			}
			if rawInputs, exists := config["inputs"]; exists {
				inputs, valid := rawInputs.(map[string]any)
				if !valid {
					errs = append(errs, fmt.Sprintf("大模型节点 %s inputs 必须为对象", node.ID))
					break
				}
				inputTypes, _ := config["inputTypes"].(map[string]any)
				for name := range inputs {
					if strings.TrimSpace(name) == "" || !validValueType(ValueType(stringFromValue(inputTypes[name]))) {
						errs = append(errs, fmt.Sprintf("大模型节点 %s 的输入 %s 类型无效", node.ID, name))
					}
				}
			}
			if _, err := llmOutputFields(config); err != nil {
				errs = append(errs, err.Error())
			}
			modelCost++
		case NodeTypeTool:
			capabilityID := stringFromValue(config["capabilityId"])
			capability, _, ok := registry.Capability(capabilityID)
			if !ok {
				errs = append(errs, fmt.Sprintf("工具节点 %s 的 capabilityId %s 未开放", node.ID, capabilityID))
				break
			}
			inputs, ok := config["inputs"].(map[string]any)
			if !ok {
				errs = append(errs, fmt.Sprintf("工具节点 %s inputs 必须为对象", node.ID))
				break
			}
			errs = append(errs, validateCapabilityInputs(node.ID, inputs, capability.InputSchema)...)
			modelCost += capability.ModelCost
			writeCost += capability.WriteCost
		case NodeTypeCondition:
			rule := Rule{Left: config["left"], Operator: stringFromValue(config["operator"]), Right: config["right"]}
			errs = append(errs, validateRule(rule, node.ID)...)
		case NodeTypeSwitch:
			errs = append(errs, validateSwitchConfig(node.ID, config)...)
		case NodeTypeMerge:
			errs = append(errs, validateMergeConfig(node.ID, config)...)
		case NodeTypeVariable:
			errs = append(errs, validateAssignments(node.ID, config)...)
		case NodeTypeSubworkflow:
			for _, name := range []string{"workflowId", "versionId"} {
				if stringFromValue(config[name]) == "" {
					errs = append(errs, fmt.Sprintf("子工作流节点 %s 的 %s 不能为空", node.ID, name))
				}
			}
			if _, ok := config["inputs"].(map[string]any); !ok {
				errs = append(errs, fmt.Sprintf("子工作流节点 %s inputs 必须为对象", node.ID))
			}
			if _, _, _, err := subworkflowDeclaredSchemas(config); err != nil {
				errs = append(errs, err.Error())
			}
		case NodeTypeIntent:
			errs = append(errs, validateIntentConfig(node.ID, config)...)
			modelCost++
		}
	}
	if startCount != 1 {
		errs = append(errs, "必须且只能有一个开始节点")
	}
	if endCount != 1 {
		errs = append(errs, "必须且只能有一个结束节点")
	}
	if modelCost > DefaultLimits.MaxModelCapabilities {
		errs = append(errs, fmt.Sprintf("模型能力预算超过 %d", DefaultLimits.MaxModelCapabilities))
	}
	if writeCost > DefaultLimits.MaxWriteCapabilities {
		errs = append(errs, fmt.Sprintf("写入能力预算超过 %d", DefaultLimits.MaxWriteCapabilities))
	}

	adjacency := make(map[string][]string, len(nodes))
	incoming := make(map[string]int, len(nodes))
	outgoing := make(map[string]int, len(nodes))
	branchHandles := make(map[string]map[string]int)
	branchOutputHandles := make(map[string]map[string]bool)
	for id, node := range nodes {
		if node.Type != NodeTypeIntent && node.Type != NodeTypeSwitch {
			continue
		}
		config, err := decodeConfig(node.Config)
		if err != nil {
			continue
		}
		branchOutputHandles[id] = make(map[string]bool)
		handles := intentBranchHandles(config)
		if node.Type == NodeTypeSwitch {
			handles = switchBranchHandles(config)
		}
		for _, handle := range handles {
			branchOutputHandles[id][handle] = true
		}
	}
	edgeKeys := make(map[string]struct{}, len(graph.Edges))
	for _, edge := range graph.Edges {
		source, sourceOK := nodes[edge.Source]
		target, targetOK := nodes[edge.Target]
		if !sourceOK || !targetOK {
			errs = append(errs, fmt.Sprintf("连线 %s → %s 引用了不存在的节点", edge.Source, edge.Target))
			continue
		}
		key := edge.Source + "|" + edge.SourceHandle + "|" + edge.Target + "|" + edge.TargetHandle
		if _, exists := edgeKeys[key]; exists {
			errs = append(errs, fmt.Sprintf("连线 %s → %s 重复", edge.Source, edge.Target))
			continue
		}
		edgeKeys[key] = struct{}{}
		if source.Type == NodeTypeEnd {
			errs = append(errs, "结束节点不能有出边")
		}
		if target.Type == NodeTypeStart {
			errs = append(errs, "开始节点不能有入边")
		}
		if source.Type == NodeTypeCondition {
			if edge.SourceHandle != "true" && edge.SourceHandle != "false" {
				errs = append(errs, fmt.Sprintf("条件节点 %s 只能使用 true/false 输出", source.ID))
			} else {
				if branchHandles[source.ID] == nil {
					branchHandles[source.ID] = map[string]int{}
				}
				branchHandles[source.ID][edge.SourceHandle]++
			}
		} else if source.Type == NodeTypeIntent || source.Type == NodeTypeSwitch {
			if !branchOutputHandles[source.ID][edge.SourceHandle] {
				errs = append(errs, fmt.Sprintf("分流节点 %s 的出口无效", source.ID))
			} else {
				if branchHandles[source.ID] == nil {
					branchHandles[source.ID] = map[string]int{}
				}
				branchHandles[source.ID][edge.SourceHandle]++
			}
		} else if edge.SourceHandle != "" && edge.SourceHandle != "output" {
			errs = append(errs, fmt.Sprintf("节点 %s 的输出端口无效", source.ID))
		}
		adjacency[edge.Source] = append(adjacency[edge.Source], edge.Target)
		incoming[edge.Target]++
		outgoing[edge.Source]++
	}
	for id, node := range nodes {
		if node.Type == NodeTypeCondition {
			if branchHandles[id]["true"] != 1 || branchHandles[id]["false"] != 1 {
				errs = append(errs, fmt.Sprintf("条件节点 %s 必须各有一条 true/false 连线", id))
			}
		}
		if node.Type == NodeTypeIntent {
			for handle := range branchOutputHandles[id] {
				if branchHandles[id][handle] != 1 {
					errs = append(errs, fmt.Sprintf("意图识别节点 %s 的 %s 出口必须各有一条连线", id, handle))
				}
			}
		}
		if node.Type == NodeTypeSwitch {
			for handle := range branchOutputHandles[id] {
				if branchHandles[id][handle] != 1 {
					errs = append(errs, fmt.Sprintf("选择器节点 %s 的 %s 出口必须各有一条连线", id, handle))
				}
			}
		}
		if node.Type != NodeTypeStart && incoming[id] == 0 {
			errs = append(errs, fmt.Sprintf("节点 %s 无法从开始节点到达", id))
		}
		if node.Type != NodeTypeEnd && outgoing[id] == 0 {
			errs = append(errs, fmt.Sprintf("节点 %s 无法到达结束节点", id))
		}
	}
	if hasCycle(nodes, adjacency, incoming) {
		errs = append(errs, "工作流只能是 DAG，不能包含循环")
	}

	outputFields := buildOutputFields(nodes, startInputs, registry)
	reachability := allReachability(nodes, adjacency)
	for _, node := range graph.Nodes {
		for _, reference := range referencesIn(node.Config, node.When) {
			if llmLocalInputReference(node, reference) {
				continue
			}
			source, field, ok := splitReference(reference)
			if !ok || source == node.ID || !reachability[source][node.ID] {
				errs = append(errs, fmt.Sprintf("变量 %s 不存在或不在上游", reference))
				continue
			}
			if fields, exists := outputFields[source]; !exists || (fields != nil && fields[field] == "") {
				errs = append(errs, fmt.Sprintf("变量 %s 未声明", reference))
				continue
			}
			if referenceMayBeSkipped(source, node.ID, nodes, graph.Edges, reachability) &&
				node.Type != NodeTypeMerge &&
				!referenceBindsOptionalToolInput(node, reference, registry) &&
				!referenceBindsOptionalEndStringOutput(node, reference) {
				errs = append(errs, fmt.Sprintf("变量 %s 可能被跳过，必须经过 Merge", reference))
			}
		}
	}
	errs = append(errs, validateLLMLocalInputReferences(graph.Nodes)...)
	errs = append(errs, validateBindingTypes(graph.Nodes, outputFields, registry)...)
	sort.Strings(errs)
	return errs
}

func llmLocalInputReference(node Node, reference string) bool {
	if node.Type != NodeTypeLLM || strings.Contains(reference, ".") {
		return false
	}
	config, err := decodeConfig(node.Config)
	if err != nil {
		return false
	}
	inputs, _ := config["inputs"].(map[string]any)
	_, exists := inputs[strings.TrimSpace(reference)]
	return exists
}

func validateLLMLocalInputReferences(nodes []Node) []string {
	errs := []string{}
	for _, node := range nodes {
		if node.Type != NodeTypeLLM {
			continue
		}
		config, err := decodeConfig(node.Config)
		if err != nil {
			continue
		}
		inputs, _ := config["inputs"].(map[string]any)
		for _, reference := range referencesInValue(inputs) {
			if _, exists := inputs[reference]; exists && !strings.Contains(reference, ".") {
				errs = append(errs, fmt.Sprintf("大模型节点 %s 的输入不能引用本节点输入 %s", node.ID, reference))
			}
		}
	}
	return errs
}

func decodeConfig(raw json.RawMessage) (map[string]any, error) {
	if len(raw) == 0 {
		return map[string]any{}, nil
	}
	var config map[string]any
	if err := json.Unmarshal(raw, &config); err != nil {
		return nil, err
	}
	if config == nil {
		return nil, fmt.Errorf("必须为对象")
	}
	return config, nil
}

func validateCapabilityInputs(nodeID string, inputs map[string]any, schema map[string]any) []string {
	errs := []string{}
	required, _ := schema["required"].([]string)
	if required == nil {
		if raw, ok := schema["required"].([]any); ok {
			for _, item := range raw {
				required = append(required, fmt.Sprint(item))
			}
		}
	}
	for _, name := range required {
		if _, ok := inputs[name]; !ok {
			errs = append(errs, fmt.Sprintf("工具节点 %s 缺少输入 %s", nodeID, name))
		}
	}
	return errs
}

func validateRule(rule Rule, nodeID string) []string {
	allowed := map[string]bool{"equals": true, "notEquals": true, "contains": true, "isEmpty": true, "greaterThan": true, "lessThan": true}
	if !allowed[strings.TrimSpace(rule.Operator)] {
		return []string{fmt.Sprintf("节点 %s 的条件操作符无效", nodeID)}
	}
	if rule.Left == nil || strings.TrimSpace(fmt.Sprint(rule.Left)) == "" {
		return []string{fmt.Sprintf("节点 %s 的条件左值不能为空", nodeID)}
	}
	return nil
}

func validateAssignments(nodeID string, config map[string]any) []string {
	assignments, ok := config["assignments"].([]any)
	if !ok || len(assignments) == 0 {
		return []string{fmt.Sprintf("变量节点 %s assignments 不能为空", nodeID)}
	}
	seen := map[string]bool{}
	errs := []string{}
	for _, raw := range assignments {
		assignment, ok := raw.(map[string]any)
		if !ok {
			errs = append(errs, fmt.Sprintf("变量节点 %s 赋值格式无效", nodeID))
			continue
		}
		name := stringFromValue(assignment["name"])
		if name == "" || seen[name] {
			errs = append(errs, fmt.Sprintf("变量节点 %s 的变量名为空或重复", nodeID))
		}
		seen[name] = true
	}
	return errs
}

func validateMergeConfig(nodeID string, config map[string]any) []string {
	fields, ok := config["fields"].([]any)
	if !ok || len(fields) == 0 {
		return []string{fmt.Sprintf("合并节点 %s fields 不能为空", nodeID)}
	}
	for _, raw := range fields {
		field, ok := raw.(map[string]any)
		if !ok || stringFromValue(field["name"]) == "" {
			return []string{fmt.Sprintf("合并节点 %s 字段配置无效", nodeID)}
		}
		sources, ok := field["sources"].([]any)
		if !ok || len(sources) < 2 {
			return []string{fmt.Sprintf("合并节点 %s 每个字段至少需要两个候选引用", nodeID)}
		}
		if !validValueType(ValueType(stringFromValue(field["type"]))) {
			return []string{fmt.Sprintf("合并节点 %s 字段类型无效", nodeID)}
		}
	}
	return nil
}

func referenceMayBeSkipped(sourceID, targetID string, nodes map[string]Node, edges []Edge, reachability map[string]map[string]bool) bool {
	if nodes[sourceID].When != nil {
		return true
	}
	for branchID, branch := range nodes {
		if branch.Type != NodeTypeCondition && branch.Type != NodeTypeIntent && branch.Type != NodeTypeSwitch {
			continue
		}
		branchTargets := map[string]string{}
		for _, edge := range edges {
			if edge.Source != branchID {
				continue
			}
			branchTargets[edge.SourceHandle] = edge.Target
		}
		sourceOnBranch := false
		for _, branchTarget := range branchTargets {
			if reachableFrom(branchTarget, sourceID, reachability) {
				sourceOnBranch = true
				break
			}
		}
		if !sourceOnBranch {
			continue
		}
		for _, branchTarget := range branchTargets {
			if reachableFrom(branchTarget, targetID, reachability) && !reachableFrom(branchTarget, sourceID, reachability) {
				return true
			}
		}
	}
	return false
}

func reachableFrom(branchStart, target string, reachability map[string]map[string]bool) bool {
	return branchStart != "" && (branchStart == target || reachability[branchStart][target])
}

func referenceBindsOptionalToolInput(node Node, reference string, registry *Registry) bool {
	if node.Type != NodeTypeTool {
		return false
	}
	config, err := decodeConfig(node.Config)
	if err != nil {
		return false
	}
	capability, _, ok := registry.Capability(stringFromValue(config["capabilityId"]))
	if !ok {
		return false
	}
	required := stringSet(capability.InputSchema["required"])
	inputs, _ := config["inputs"].(map[string]any)
	found := false
	for name, value := range inputs {
		if !containsReference(value, reference) {
			continue
		}
		found = true
		if required[name] {
			return false
		}
	}
	return found
}

func referenceBindsOptionalEndStringOutput(node Node, reference string) bool {
	if node.Type != NodeTypeEnd {
		return false
	}
	config, err := decodeConfig(node.Config)
	if err != nil {
		return false
	}
	outputs, _ := config["outputs"].(map[string]any)
	outputTypes, _ := config["outputTypes"].(map[string]any)
	for name, value := range outputs {
		exact, ok := exactReference(value)
		if !ok || exact != reference {
			continue
		}
		return ValueType(stringFromValue(outputTypes[name])) == ValueTypeString
	}
	return false
}

func containsReference(value any, reference string) bool {
	encoded, _ := json.Marshal(value)
	for _, item := range referencesIn(encoded, nil) {
		if item == reference {
			return true
		}
	}
	return false
}

func stringSet(value any) map[string]bool {
	result := map[string]bool{}
	switch items := value.(type) {
	case []string:
		for _, item := range items {
			result[item] = true
		}
	case []any:
		for _, item := range items {
			result[fmt.Sprint(item)] = true
		}
	}
	return result
}

func validateBindingTypes(nodes []Node, outputFields map[string]map[string]ValueType, registry *Registry) []string {
	errs := []string{}
	for _, node := range nodes {
		config, err := decodeConfig(node.Config)
		if err != nil {
			continue
		}
		switch node.Type {
		case NodeTypeLLM:
			inputs, _ := config["inputs"].(map[string]any)
			inputTypes, _ := config["inputTypes"].(map[string]any)
			for name, value := range inputs {
				expected := ValueType(stringFromValue(inputTypes[name]))
				errs = append(errs, validateBoundValueType(node.ID, name, value, expected, outputFields)...)
			}
		case NodeTypeEnd:
			outputs, _ := config["outputs"].(map[string]any)
			outputTypes, _ := config["outputTypes"].(map[string]any)
			for name, value := range outputs {
				expected := ValueType(stringFromValue(outputTypes[name]))
				errs = append(errs, validateBoundValueType(node.ID, name, value, expected, outputFields)...)
			}
		case NodeTypeTool:
			capability, _, ok := registry.Capability(stringFromValue(config["capabilityId"]))
			if !ok {
				continue
			}
			inputs, _ := config["inputs"].(map[string]any)
			properties, _ := capability.InputSchema["properties"].(map[string]any)
			for name, value := range inputs {
				property, _ := properties[name].(map[string]any)
				expected := ValueType(stringFromValue(property["type"]))
				errs = append(errs, validateBoundValueType(node.ID, name, value, expected, outputFields)...)
			}
		case NodeTypeSubworkflow:
			inputs, _ := config["inputs"].(map[string]any)
			inputSchema, _, declared, err := subworkflowDeclaredSchemas(config)
			if err != nil || !declared {
				continue
			}
			for name, value := range inputs {
				errs = append(errs, validateBoundValueType(node.ID, name, value, inputSchema[name], outputFields)...)
			}
		case NodeTypeIntent:
			errs = append(errs, validateBoundValueType(node.ID, "query", config["query"], ValueTypeString, outputFields)...)
		case NodeTypeSwitch:
			errs = append(errs, validateBoundValueType(node.ID, "value", config["value"], ValueType(stringFromValue(config["valueType"])), outputFields)...)
		case NodeTypeMerge:
			fields, _ := config["fields"].([]any)
			for _, raw := range fields {
				field, _ := raw.(map[string]any)
				expected := ValueType(stringFromValue(field["type"]))
				sources, _ := field["sources"].([]any)
				for _, source := range sources {
					errs = append(errs, validateBoundValueType(node.ID, stringFromValue(field["name"]), source, expected, outputFields)...)
				}
			}
		case NodeTypeVariable:
			assignments, _ := config["assignments"].([]any)
			for _, raw := range assignments {
				assignment, _ := raw.(map[string]any)
				expected := ValueType(stringFromValue(assignment["type"]))
				if !validValueType(expected) {
					errs = append(errs, fmt.Sprintf("变量节点 %s 的 %s 类型无效", node.ID, stringFromValue(assignment["name"])))
					continue
				}
				errs = append(errs, validateBoundValueType(node.ID, stringFromValue(assignment["name"]), assignment["value"], expected, outputFields)...)
			}
		}
		errs = append(errs, validateRuleTypes(node.ID, node.When, outputFields)...)
		if node.Type == NodeTypeCondition {
			rule := &Rule{Left: config["left"], Operator: stringFromValue(config["operator"]), Right: config["right"]}
			errs = append(errs, validateRuleTypes(node.ID, rule, outputFields)...)
		}
	}
	return errs
}

func validateBoundValueType(nodeID, fieldName string, value any, expected ValueType, outputFields map[string]map[string]ValueType) []string {
	if !validValueType(expected) {
		return nil
	}
	actual, ok := boundValueType(value, outputFields)
	if !ok || actual == expected {
		return nil
	}
	return []string{fmt.Sprintf("节点 %s 的 %s 需要 %s，实际为 %s", nodeID, fieldName, expected, actual)}
}

func boundValueType(value any, outputFields map[string]map[string]ValueType) (ValueType, bool) {
	if reference, ok := exactReference(value); ok {
		source, field, parsed := splitReference(reference)
		if !parsed || outputFields[source] == nil {
			return "", false
		}
		valueType, exists := outputFields[source][field]
		return valueType, exists
	}
	switch typed := value.(type) {
	case string:
		return ValueTypeString, true
	case bool:
		return ValueTypeBoolean, true
	case float64, float32, int, int32, int64, uint, uint32, uint64:
		return ValueTypeNumber, true
	case []string:
		return ValueTypeStringList, true
	case []any:
		for _, item := range typed {
			if _, ok := item.(string); !ok {
				return ValueTypeObject, true
			}
		}
		return ValueTypeStringList, true
	case map[string]any:
		return ValueTypeObject, true
	default:
		return "", false
	}
}

func exactReference(value any) (string, bool) {
	text, ok := value.(string)
	if !ok {
		return "", false
	}
	trimmed := strings.TrimSpace(text)
	match := templatePattern.FindStringSubmatch(trimmed)
	if len(match) != 2 || match[0] != trimmed {
		return "", false
	}
	return strings.TrimSpace(match[1]), true
}

func validateRuleTypes(nodeID string, rule *Rule, outputFields map[string]map[string]ValueType) []string {
	if rule == nil {
		return nil
	}
	leftType, ok := boundValueType(rule.Left, outputFields)
	if !ok {
		return nil
	}
	if rule.Operator == "greaterThan" || rule.Operator == "lessThan" {
		if leftType != ValueTypeNumber {
			return []string{fmt.Sprintf("节点 %s 的数值条件左值必须为 number", nodeID)}
		}
	}
	if rule.Operator == "isEmpty" || rule.Right == nil {
		return nil
	}
	rightType, ok := boundValueType(rule.Right, outputFields)
	if ok && leftType != rightType {
		return []string{fmt.Sprintf("节点 %s 的条件左右值类型不一致", nodeID)}
	}
	return nil
}

func validValueType(valueType ValueType) bool {
	switch valueType {
	case ValueTypeString, ValueTypeStringList, ValueTypeObject, ValueTypeNumber, ValueTypeBoolean, ValueTypeFile:
		return true
	}
	return false
}

func buildOutputFields(nodes map[string]Node, startInputs map[string]InputDefinition, registry *Registry) map[string]map[string]ValueType {
	result := make(map[string]map[string]ValueType, len(nodes))
	for id, node := range nodes {
		switch node.Type {
		case NodeTypeStart:
			result[id] = map[string]ValueType{}
			for name, definition := range startInputs {
				result[id][name] = definition.Type
			}
		case NodeTypeLLM:
			config, _ := decodeConfig(node.Config)
			result[id], _ = llmOutputFields(config)
		case NodeTypeCondition:
			result[id] = fields(field("matched", ValueTypeBoolean))
		case NodeTypeSwitch:
			config, _ := decodeConfig(node.Config)
			result[id] = fields(
				field("matchedCaseId", ValueTypeString),
				field("matchedLabel", ValueTypeString),
				field("matchedValue", ValueType(stringFromValue(config["valueType"]))),
			)
		case NodeTypeTool:
			config, _ := decodeConfig(node.Config)
			capability, _, ok := registry.Capability(stringFromValue(config["capabilityId"]))
			if ok {
				result[id] = capability.OutputSchema
			}
		case NodeTypeVariable:
			result[id] = map[string]ValueType{}
			config, _ := decodeConfig(node.Config)
			if assignments, ok := config["assignments"].([]any); ok {
				for _, raw := range assignments {
					if assignment, ok := raw.(map[string]any); ok {
						result[id][stringFromValue(assignment["name"])] = ValueType(stringFromValue(assignment["type"]))
					}
				}
			}
		case NodeTypeMerge:
			result[id] = map[string]ValueType{}
			config, _ := decodeConfig(node.Config)
			if mergeFields, ok := config["fields"].([]any); ok {
				for _, raw := range mergeFields {
					if mergeField, ok := raw.(map[string]any); ok {
						result[id][stringFromValue(mergeField["name"])] = ValueType(stringFromValue(mergeField["type"]))
					}
				}
			}
		case NodeTypeSubworkflow:
			config, _ := decodeConfig(node.Config)
			_, outputSchema, declared, err := subworkflowDeclaredSchemas(config)
			if err == nil && declared {
				result[id] = outputSchema
			} else {
				result[id] = nil
			}
		case NodeTypeIntent:
			result[id] = fields(
				field("intentId", ValueTypeString),
				field("intentName", ValueTypeString),
				field("confidence", ValueTypeNumber),
			)
		default:
			result[id] = map[string]ValueType{}
		}
	}
	return result
}

func referencesIn(raw json.RawMessage, when *Rule) []string {
	values := []string{string(raw)}
	if when != nil {
		encoded, _ := json.Marshal(when)
		values = append(values, string(encoded))
	}
	result := []string{}
	for _, value := range values {
		for _, match := range templatePattern.FindAllStringSubmatch(value, -1) {
			if len(match) > 1 {
				result = append(result, strings.TrimSpace(match[1]))
			}
		}
	}
	return result
}

func referencesInValue(value any) []string {
	encoded, err := json.Marshal(value)
	if err != nil {
		return nil
	}
	return referencesIn(encoded, nil)
}

func splitReference(reference string) (string, string, bool) {
	parts := strings.Split(strings.TrimSpace(reference), ".")
	if len(parts) != 3 || parts[1] != "output" || parts[0] == "" || parts[2] == "" {
		return "", "", false
	}
	return parts[0], parts[2], true
}

func hasCycle(nodes map[string]Node, adjacency map[string][]string, incoming map[string]int) bool {
	degrees := make(map[string]int, len(nodes))
	for id := range nodes {
		degrees[id] = incoming[id]
	}
	queue := []string{}
	for id, degree := range degrees {
		if degree == 0 {
			queue = append(queue, id)
		}
	}
	visited := 0
	for len(queue) > 0 {
		current := queue[0]
		queue = queue[1:]
		visited++
		for _, next := range adjacency[current] {
			degrees[next]--
			if degrees[next] == 0 {
				queue = append(queue, next)
			}
		}
	}
	return visited != len(nodes)
}

func allReachability(nodes map[string]Node, adjacency map[string][]string) map[string]map[string]bool {
	result := make(map[string]map[string]bool, len(nodes))
	for source := range nodes {
		result[source] = map[string]bool{}
		queue := append([]string(nil), adjacency[source]...)
		for len(queue) > 0 {
			current := queue[0]
			queue = queue[1:]
			if result[source][current] {
				continue
			}
			result[source][current] = true
			queue = append(queue, adjacency[current]...)
		}
	}
	return result
}
