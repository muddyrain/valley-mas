package workflow

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/url"
	"regexp"
	"sort"
	"strings"
)

var templatePattern = regexp.MustCompile(`\{\{\s*([^{}]+?)\s*\}\}`)

type startNodeConfig struct {
	Inputs map[string]inputDefinition `json:"inputs"`
}

type inputDefinition struct {
	Type     ValueType `json:"type"`
	Required bool      `json:"required"`
}

type llmTextConfig struct {
	ModelProfile    string  `json:"modelProfile"`
	SystemPrompt    string  `json:"systemPrompt"`
	Prompt          string  `json:"prompt"`
	Temperature     float64 `json:"temperature"`
	MaxOutputTokens int     `json:"maxOutputTokens"`
}

type parseMarkdownConfig struct {
	FileInput string `json:"fileInput"`
}

type knowledgeRetrieveConfig struct {
	Query string `json:"query"`
}

type createDraftConfig struct {
	Title         string `json:"title"`
	Content       string `json:"content"`
	Excerpt       string `json:"excerpt,omitempty"`
	Cover         string `json:"cover,omitempty"`
	Tags          string `json:"tags"`
	SuggestedTags string `json:"suggestedTags,omitempty"`
	TagMode       string `json:"tagMode"`
	Visibility    string `json:"visibility"`
}

type endConfig struct {
	Outputs map[string]string `json:"outputs"`
}

type variableConfig struct {
	VariableName    string `json:"variableName"`
	ValueExpression string `json:"valueExpression"`
}

type httpHeaderConfig struct {
	Key   string `json:"key"`
	Value string `json:"value"`
}

type httpNodeConfig struct {
	Method  string             `json:"method"`
	URL     string             `json:"url"`
	Headers []httpHeaderConfig `json:"headers"`
	Body    any                `json:"body"`
}

type codeNodeConfig struct {
	Language   string   `json:"language"`
	Code       string   `json:"code"`
	InputVars  []string `json:"inputVars"`
	OutputVars []string `json:"outputVars"`
}

// ValidateGraph returns every detected graph contract violation so callers can
// provide actionable feedback before a run is created.
func ValidateGraph(graph Graph, registry *Registry) []string {
	errs := make([]string, 0)
	if graph.SchemaVersion != 2 {
		errs = append(errs, "schemaVersion 必须为 2")
	}

	nodesByID := make(map[string]Node, len(graph.Nodes))
	startCount, endCount := 0, 0
	for _, node := range graph.Nodes {
		if strings.TrimSpace(node.ID) == "" {
			errs = append(errs, "节点 ID 不能为空")
			continue
		}
		if _, exists := nodesByID[node.ID]; exists {
			errs = append(errs, fmt.Sprintf("节点 ID %s 重复", node.ID))
			continue
		}
		nodesByID[node.ID] = node
		if node.Type == NodeTypeStart {
			startCount++
		}
		if node.Type == NodeTypeEnd {
			endCount++
		}
		if isUnavailableNodeType(node.Type) {
			errs = append(errs, fmt.Sprintf("节点 %s 的类型 %s 当前未开放", node.ID, node.Type))
			continue
		}
		if !registry.Supports(node.Type) {
			errs = append(errs, fmt.Sprintf("节点 %s 的类型 %s 未注册", node.ID, node.Type))
		}
	}
	if startCount != 1 {
		errs = append(errs, "必须且只能有一个开始节点")
	}
	if endCount != 1 {
		errs = append(errs, "必须且只能有一个结束节点")
	}
	errs = append(errs, validatePhaseOnePolicy(graph.Nodes)...)

	startInputs := make(map[string]inputDefinition)
	for _, node := range graph.Nodes {
		if node.Type != NodeTypeStart || !registry.Supports(node.Type) {
			continue
		}
		inputs, configErrs := validateStartConfig(node)
		errs = append(errs, configErrs...)
		if len(startInputs) == 0 {
			startInputs = inputs
		}
	}
	for _, node := range graph.Nodes {
		if node.Type == NodeTypeStart || !registry.Supports(node.Type) {
			continue
		}
		errs = append(errs, validateNodeConfig(node, startInputs, nodesByID, registry)...)
	}

	adjacency, incoming, outgoing := graphAdjacency(graph, nodesByID, registry, &errs)
	if graph.SchemaVersion == 2 {
		validateLinearV2(graph.Nodes, nodesByID, incoming, outgoing, &errs)
	}
	reachability := allReachability(nodesByID, adjacency)
	if hasCycle(nodesByID, adjacency, incoming) {
		errs = append(errs, "工作流不能包含循环")
	}
	for _, node := range graph.Nodes {
		if node.Type == NodeTypeStart && incoming[node.ID] > 0 {
			errs = append(errs, "开始节点不能有入边")
		}
		if node.Type == NodeTypeEnd && outgoing[node.ID] > 0 {
			errs = append(errs, "结束节点不能有出边")
		}
	}
	validateReachability(graph.Nodes, nodesByID, adjacency, graph.Edges, &errs)

	for _, node := range graph.Nodes {
		if _, exists := nodesByID[node.ID]; !exists {
			continue
		}
		for _, reference := range templateReferences(node.Config) {
			source, field, valid := splitReference(reference)
			if !valid {
				errs = append(errs, fmt.Sprintf("变量 %s 格式无效", reference))
				continue
			}
			sourceNode, exists := nodesByID[source]
			if !exists || !hasDeclaredOutputField(registry, sourceNode, field, startInputs) || !reachability[source][node.ID] {
				errs = append(errs, fmt.Sprintf("变量 %s 不存在或不在上游", reference))
			}
		}
	}

	return errs
}

func validateLinearV2(nodes []Node, nodesByID map[string]Node, incoming, outgoing map[string]int, errs *[]string) {
	for _, node := range nodes {
		if _, exists := nodesByID[node.ID]; !exists {
			continue
		}
		if incoming[node.ID] > 1 {
			*errs = append(*errs, fmt.Sprintf("Graph v2 仅支持线性 DAG，节点 %s 不能有多条入边", node.ID))
		}
		if outgoing[node.ID] > 1 {
			*errs = append(*errs, fmt.Sprintf("Graph v2 仅支持线性 DAG，节点 %s 不能有多条出边", node.ID))
		}
	}
}

func isUnavailableNodeType(nodeType NodeType) bool {
	switch nodeType {
	case NodeTypeCode, NodeTypeHTTP, NodeTypeCondition, NodeTypeLoop, NodeTypeKnowledge, NodeTypeInput, NodeTypeFileUpload:
		return true
	default:
		return false
	}
}

func validatePhaseOnePolicy(nodes []Node) []string {
	errs := make([]string, 0)
	if len(nodes) > 8 {
		errs = append(errs, "第一阶段工作流节点不能超过 8 个")
	}
	llmCount, draftCount, totalLLMTokens := 0, 0, 0
	for _, node := range nodes {
		switch node.Type {
		case NodeTypeLLMText:
			llmCount++
			var config llmTextConfig
			if json.Unmarshal(node.Config, &config) == nil {
				totalLLMTokens += config.MaxOutputTokens
			}
		case NodeTypeBlogCreateDraft:
			draftCount++
		}
	}
	if llmCount > 1 {
		errs = append(errs, "第一阶段 LLM 节点不能超过 1 个")
	}
	if draftCount > 1 {
		errs = append(errs, "第一阶段草稿节点不能超过 1 个")
	}
	if totalLLMTokens > 4096 {
		errs = append(errs, "第一阶段 LLM maxOutputTokens 总和不能超过 4096")
	}
	return errs
}

func validateStartConfig(node Node) (map[string]inputDefinition, []string) {
	var config startNodeConfig
	if err := json.Unmarshal(node.Config, &config); err != nil {
		return nil, []string{fmt.Sprintf("节点 %s 配置无效", node.ID)}
	}
	errs := strictConfigErrors(node, &config)
	if len(config.Inputs) == 0 {
		errs = append(errs, "开始节点至少需要一个输入声明")
	}
	inputNames := make([]string, 0, len(config.Inputs))
	for name := range config.Inputs {
		inputNames = append(inputNames, name)
	}
	sort.Strings(inputNames)
	for _, name := range inputNames {
		input := config.Inputs[name]
		if strings.TrimSpace(name) == "" || strings.TrimSpace(string(input.Type)) == "" {
			errs = append(errs, "开始节点输入必须声明名称和类型")
		} else if !isSupportedInputType(input.Type) {
			errs = append(errs, fmt.Sprintf("开始节点输入 %s 的类型 %s 不支持", name, input.Type))
		}
	}
	return config.Inputs, errs
}

func validateNodeConfig(node Node, startInputs map[string]inputDefinition, nodesByID map[string]Node, registry *Registry) []string {
	switch node.Type {
	case NodeTypeLLMText:
		var config llmTextConfig
		if err := json.Unmarshal(node.Config, &config); err != nil {
			return []string{fmt.Sprintf("节点 %s 配置无效", node.ID)}
		}
		errs := strictConfigErrors(node, &config)
		if config.ModelProfile != "ark-text-default" {
			errs = append(errs, "modelProfile 必须为 ark-text-default")
		}
		if strings.TrimSpace(config.SystemPrompt) == "" {
			errs = append(errs, "systemPrompt 不能为空")
		}
		if strings.TrimSpace(config.Prompt) == "" {
			errs = append(errs, "prompt 不能为空")
		}
		if config.Temperature < 0 || config.Temperature > 2 {
			errs = append(errs, "temperature 必须在 0 到 2 之间")
		}
		if config.MaxOutputTokens < 1 || config.MaxOutputTokens > 4096 {
			errs = append(errs, "maxOutputTokens 必须在 1 到 4096 之间")
		}
		return errs
	case NodeTypeBlogParse:
		var config parseMarkdownConfig
		if err := json.Unmarshal(node.Config, &config); err != nil {
			return []string{fmt.Sprintf("节点 %s 配置无效", node.ID)}
		}
		errs := strictConfigErrors(node, &config)
		inputName, valid := startInputName(config.FileInput)
		if !valid {
			errs = append(errs, "fileInput 必须引用开始节点输入")
			return errs
		}
		input, exists := startInputs[inputName]
		if !exists {
			errs = append(errs, fmt.Sprintf("fileInput %s 未在开始节点中声明", inputName))
		} else if input.Type != ValueTypeFile {
			errs = append(errs, fmt.Sprintf("fileInput %s 必须引用 file 类型输入", inputName))
		}
		return errs
	case NodeTypeKnowledgeRetrieve:
		var config knowledgeRetrieveConfig
		if err := json.Unmarshal(node.Config, &config); err != nil {
			return []string{fmt.Sprintf("节点 %s 配置无效", node.ID)}
		}
		errs := strictConfigErrors(node, &config)
		if !isTemplateReference(config.Query) {
			errs = append(errs, "知识检索节点 query 必须是上游变量映射")
		}
		return errs
	case NodeTypeBlogCreateDraft:
		var config createDraftConfig
		if err := json.Unmarshal(node.Config, &config); err != nil {
			return []string{fmt.Sprintf("节点 %s 配置无效", node.ID)}
		}
		errs := strictConfigErrors(node, &config)
		errs = append(errs, validateTypedTemplateMapping("title", config.Title, ValueTypeString, nodesByID, registry, startInputs)...)
		errs = append(errs, validateTypedTemplateMapping("content", config.Content, ValueTypeString, nodesByID, registry, startInputs)...)
		if strings.TrimSpace(config.Excerpt) != "" {
			errs = append(errs, validateTypedTemplateMapping("excerpt", config.Excerpt, ValueTypeString, nodesByID, registry, startInputs)...)
		}
		if strings.TrimSpace(config.Cover) != "" {
			errs = append(errs, validateTypedTemplateMapping("cover", config.Cover, ValueTypeObject, nodesByID, registry, startInputs)...)
		}
		if strings.TrimSpace(config.Tags) == "" {
			errs = append(errs, "tags 映射不能为空")
		} else if inputName, valid := startTemplateInputName(config.Tags); !valid || inputName != "tagIds" {
			errs = append(errs, "tags 必须引用开始节点中 string[] 类型的 tagIds 输入")
		} else if input, exists := startInputs[inputName]; !exists || input.Type != ValueTypeStringList {
			errs = append(errs, "tags 必须引用开始节点中 string[] 类型的 tagIds 输入")
		}
		if config.TagMode != "merge" && config.TagMode != "manual_only" {
			errs = append(errs, "tagMode 必须为 merge 或 manual_only")
		}
		if strings.TrimSpace(config.SuggestedTags) != "" {
			errs = append(errs, validateTypedTemplateMapping("suggestedTags", config.SuggestedTags, ValueTypeStringList, nodesByID, registry, startInputs)...)
		}
		if strings.TrimSpace(config.Visibility) == "" {
			errs = append(errs, "visibility 映射不能为空")
		} else if inputName, valid := startTemplateInputName(config.Visibility); !valid {
			errs = append(errs, "visibility 必须引用开始节点输入")
		} else if input, exists := startInputs[inputName]; !exists || input.Type != ValueTypeString {
			errs = append(errs, fmt.Sprintf("visibility %s 必须引用 string 类型开始节点输入", inputName))
		}
		return errs
	case NodeTypeEnd:
		var config endConfig
		if err := json.Unmarshal(node.Config, &config); err != nil {
			return []string{fmt.Sprintf("节点 %s 配置无效", node.ID)}
		}
		errs := strictConfigErrors(node, &config)
		if len(config.Outputs) == 0 {
			errs = append(errs, "结束节点至少需要一个输出映射")
		}
		for name, value := range config.Outputs {
			if strings.TrimSpace(name) == "" || !isTemplateReference(value) {
				errs = append(errs, "结束节点输出必须是变量映射")
			}
		}
		return errs
	case NodeTypeVariable:
		var config variableConfig
		if err := json.Unmarshal(node.Config, &config); err != nil {
			return []string{fmt.Sprintf("节点 %s 配置无效", node.ID)}
		}
		errs := strictConfigErrors(node, &config)
		config.VariableName = strings.TrimSpace(config.VariableName)
		if config.VariableName == "" {
			errs = append(errs, "variable 节点变量名不能为空")
		} else if !variableOutputNamePattern.MatchString(config.VariableName) {
			errs = append(errs, "variable 节点变量名仅支持字母数字下划线，并且不能以数字开头")
		}
		if strings.TrimSpace(config.ValueExpression) == "" {
			errs = append(errs, "variable 节点值表达式不能为空")
		}
		return errs
	case NodeTypeHTTP:
		var config httpNodeConfig
		if err := json.Unmarshal(node.Config, &config); err != nil {
			return []string{fmt.Sprintf("节点 %s 配置无效", node.ID)}
		}
		errs := strictConfigErrors(node, &config)
		method := strings.ToUpper(strings.TrimSpace(config.Method))
		if method == "" {
			method = "GET"
		}
		if !isSupportedHTTPMethod(method) {
			errs = append(errs, "http 节点仅支持 GET/POST/PUT/PATCH/DELETE/HEAD")
		}
		config.URL = strings.TrimSpace(config.URL)
		if config.URL == "" {
			errs = append(errs, "http 节点 URL 不能为空")
		} else {
			parsedURL, parseErr := url.Parse(config.URL)
			if parseErr != nil || parsedURL.Host == "" {
				errs = append(errs, "http 节点 URL 格式无效")
			} else {
				if parsedURL.Scheme != "http" && parsedURL.Scheme != "https" {
					errs = append(errs, "http 节点仅支持 http/https")
				}
				if !isPublicHTTPHost(parsedURL.Hostname()) {
					errs = append(errs, "http 节点不允许访问本机或内网地址")
				}
			}
		}
		if method == "GET" || method == "HEAD" {
			if hasNonEmptyHTTPBody(config.Body) {
				errs = append(errs, "GET/HEAD 请求不能携带请求体")
			}
		}
		for index, header := range config.Headers {
			headerKey := strings.TrimSpace(header.Key)
			if headerKey == "" {
				continue
			}
			if strings.ContainsAny(headerKey, "\r\n") {
				errs = append(errs, fmt.Sprintf("http headers 第 %d 项非法", index+1))
			}
			if strings.TrimSpace(header.Value) == "" {
				errs = append(errs, fmt.Sprintf("http headers 第 %d 项 value 不能为空", index+1))
			}
		}
		return errs
	case NodeTypeCode:
		var config codeNodeConfig
		if err := json.Unmarshal(node.Config, &config); err != nil {
			return []string{fmt.Sprintf("节点 %s 配置无效", node.ID)}
		}
		errs := strictConfigErrors(node, &config)
		config.Language = strings.TrimSpace(config.Language)
		if config.Language == "" {
			config.Language = "javascript"
		}
		if config.Code = strings.TrimSpace(config.Code); config.Code == "" {
			errs = append(errs, "代码节点代码不能为空")
		}
		if config.Language != "javascript" && config.Language != "python" {
			errs = append(errs, "代码节点仅支持 javascript 或 python")
		}
		inputVarSet := make(map[string]struct{})
		for index, name := range config.InputVars {
			name = strings.TrimSpace(name)
			if name == "" {
				errs = append(errs, fmt.Sprintf("code.inputVars 第 %d 项不能为空", index+1))
				continue
			}
			if !variableOutputNamePattern.MatchString(name) {
				errs = append(errs, fmt.Sprintf("code.inputVars 第 %d 项不是合法变量名", index+1))
				continue
			}
			if _, exists := inputVarSet[name]; exists {
				errs = append(errs, fmt.Sprintf("code.inputVars 第 %d 项重复", index+1))
				continue
			}
			inputVarSet[name] = struct{}{}
		}
		outputVarSet := make(map[string]struct{})
		for index, name := range config.OutputVars {
			name = strings.TrimSpace(name)
			if name == "" {
				errs = append(errs, fmt.Sprintf("code.outputVars 第 %d 项不能为空", index+1))
				continue
			}
			if !variableOutputNamePattern.MatchString(name) {
				errs = append(errs, fmt.Sprintf("code.outputVars 第 %d 项不是合法变量名", index+1))
				continue
			}
			if _, exists := outputVarSet[name]; exists {
				errs = append(errs, fmt.Sprintf("code.outputVars 第 %d 项重复", index+1))
				continue
			}
			outputVarSet[name] = struct{}{}
		}
		return errs
	}
	return nil
}

func strictConfigErrors(node Node, config any) []string {
	if err := strictDecode(node.Config, config); err != nil {
		return []string{fmt.Sprintf("节点 %s 配置无效", node.ID)}
	}
	return nil
}

func isSupportedInputType(valueType ValueType) bool {
	switch valueType {
	case ValueTypeString, ValueTypeStringList, ValueTypeObject, ValueTypeNumber, ValueTypeBoolean, ValueTypeFile:
		return true
	default:
		return false
	}
}

func hasDeclaredOutputField(registry *Registry, node Node, field string, startInputs map[string]inputDefinition) bool {
	_, exists := outputFieldType(registry, node, field, startInputs)
	return exists
}

func outputFieldType(registry *Registry, node Node, field string, startInputs map[string]inputDefinition) (ValueType, bool) {
	if node.Type == NodeTypeStart {
		input, exists := startInputs[field]
		return input.Type, exists
	}
	if node.Type == NodeTypeVariable {
		var config variableConfig
		if err := json.Unmarshal(node.Config, &config); err != nil {
			return "", false
		}
		if strings.TrimSpace(config.VariableName) == "" {
			return "", false
		}
		return ValueTypeString, strings.TrimSpace(config.VariableName) == strings.TrimSpace(field)
	}
	if node.Type == NodeTypeCode {
		var config codeNodeConfig
		if err := json.Unmarshal(node.Config, &config); err != nil {
			return "", false
		}
		for _, name := range config.OutputVars {
			if strings.TrimSpace(name) == field {
				return ValueTypeString, true
			}
		}
		return "", false
	}
	return registry.OutputFieldType(node.Type, field)
}

func validateTypedTemplateMapping(name, value string, expectedType ValueType, nodesByID map[string]Node, registry *Registry, startInputs map[string]inputDefinition) []string {
	if strings.TrimSpace(value) == "" {
		return []string{fmt.Sprintf("%s 映射不能为空", name)}
	}
	if !isTemplateReference(value) {
		return []string{fmt.Sprintf("%s 必须是模板变量", name)}
	}
	matches := templatePattern.FindStringSubmatch(strings.TrimSpace(value))
	source, field, valid := splitReference(strings.TrimSpace(matches[1]))
	if !valid {
		return nil
	}
	sourceNode, exists := nodesByID[source]
	if !exists {
		return nil
	}
	actualType, exists := outputFieldType(registry, sourceNode, field, startInputs)
	if exists && actualType != expectedType {
		return []string{fmt.Sprintf("%s 映射类型必须为 %s，实际为 %s", name, expectedType, actualType)}
	}
	return nil
}

func strictDecode(raw json.RawMessage, config any) error {
	decoder := json.NewDecoder(bytes.NewReader(raw))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(config); err != nil {
		return err
	}
	var trailing any
	if err := decoder.Decode(&trailing); err != io.EOF {
		if err == nil {
			return fmt.Errorf("配置包含多个 JSON 值")
		}
		return err
	}
	return nil
}

func hasNonEmptyHTTPBody(value any) bool {
	switch typed := value.(type) {
	case nil:
		return false
	case string:
		return strings.TrimSpace(typed) != ""
	default:
		return true
	}
}

var variableOutputNamePattern = regexp.MustCompile(`^[A-Za-z_][A-Za-z0-9_]*$`)

func startInputName(value string) (string, bool) {
	value = strings.TrimSpace(value)
	if value == "" {
		return "", false
	}
	if strings.HasPrefix(value, "{{") || strings.HasSuffix(value, "}}") {
		matches := templatePattern.FindStringSubmatch(value)
		if len(matches) != 2 || matches[0] != value {
			return "", false
		}
		nodeID, field, valid := splitReference(strings.TrimSpace(matches[1]))
		if !valid || nodeID != "start" {
			return "", false
		}
		return field, true
	}
	return value, true
}

func startTemplateInputName(value string) (string, bool) {
	value = strings.TrimSpace(value)
	matches := templatePattern.FindStringSubmatch(value)
	if len(matches) != 2 || matches[0] != value {
		return "", false
	}
	nodeID, field, valid := splitReference(strings.TrimSpace(matches[1]))
	if !valid || nodeID != "start" {
		return "", false
	}
	return field, true
}

func isTemplateReference(value string) bool {
	matches := templatePattern.FindStringSubmatch(strings.TrimSpace(value))
	if len(matches) != 2 || matches[0] != strings.TrimSpace(value) {
		return false
	}
	_, _, valid := splitReference(strings.TrimSpace(matches[1]))
	return valid
}

func graphAdjacency(graph Graph, nodesByID map[string]Node, registry *Registry, errs *[]string) (map[string][]string, map[string]int, map[string]int) {
	adjacency := make(map[string][]string, len(nodesByID))
	incoming := make(map[string]int, len(nodesByID))
	outgoing := make(map[string]int, len(nodesByID))
	for id := range nodesByID {
		adjacency[id] = nil
	}
	seenEdges := make(map[string]struct{}, len(graph.Edges))
	for _, edge := range graph.Edges {
		sourceNode, sourceExists := nodesByID[edge.Source]
		targetNode, targetExists := nodesByID[edge.Target]
		if !sourceExists || !targetExists {
			*errs = append(*errs, fmt.Sprintf("连线 %s -> %s 的端点不存在", edge.Source, edge.Target))
			continue
		}
		sourcePort := defaultPort(edge.SourceHandle, "output")
		targetPort := defaultPort(edge.TargetHandle, "input")
		edgeKey := edge.Source + "\x00" + sourcePort + "\x00" + edge.Target + "\x00" + targetPort
		if _, exists := seenEdges[edgeKey]; exists {
			*errs = append(*errs, fmt.Sprintf("连线 %s -> %s 重复", edge.Source, edge.Target))
			continue
		}
		seenEdges[edgeKey] = struct{}{}
		if registry.Supports(sourceNode.Type) && !registry.HasOutputPort(sourceNode.Type, sourcePort) {
			*errs = append(*errs, fmt.Sprintf("连线 %s -> %s 的输出端口 %s 未声明", edge.Source, edge.Target, sourcePort))
		}
		if registry.Supports(targetNode.Type) && !registry.HasInputPort(targetNode.Type, targetPort) {
			*errs = append(*errs, fmt.Sprintf("连线 %s -> %s 的输入端口 %s 未声明", edge.Source, edge.Target, targetPort))
		}
		adjacency[edge.Source] = append(adjacency[edge.Source], edge.Target)
		incoming[edge.Target]++
		outgoing[edge.Source]++
	}
	return adjacency, incoming, outgoing
}

func defaultPort(value, fallback string) string {
	if strings.TrimSpace(value) == "" {
		return fallback
	}
	return value
}

func validateReachability(nodes []Node, nodesByID map[string]Node, adjacency map[string][]string, edges []Edge, errs *[]string) {
	startID, endID := "", ""
	for _, node := range nodes {
		if _, exists := nodesByID[node.ID]; !exists {
			continue
		}
		if node.Type == NodeTypeStart {
			startID = node.ID
		}
		if node.Type == NodeTypeEnd {
			endID = node.ID
		}
	}
	if startID == "" || endID == "" {
		return
	}
	fromStart := reachable(startID, adjacency)
	reversed := make(map[string][]string, len(adjacency))
	for id := range adjacency {
		reversed[id] = nil
	}
	for _, edge := range edges {
		if _, sourceExists := nodesByID[edge.Source]; !sourceExists {
			continue
		}
		if _, targetExists := nodesByID[edge.Target]; !targetExists {
			continue
		}
		reversed[edge.Target] = append(reversed[edge.Target], edge.Source)
	}
	toEnd := reachable(endID, reversed)
	for _, node := range nodes {
		if _, exists := nodesByID[node.ID]; !exists {
			continue
		}
		if node.ID != startID && !fromStart[node.ID] {
			*errs = append(*errs, fmt.Sprintf("节点 %s 无法从开始节点到达", node.ID))
		}
		if node.ID != endID && !toEnd[node.ID] {
			*errs = append(*errs, fmt.Sprintf("节点 %s 无法到达结束节点", node.ID))
		}
	}
}

func reachable(source string, adjacency map[string][]string) map[string]bool {
	visited := map[string]bool{source: true}
	queue := []string{source}
	for len(queue) > 0 {
		current := queue[0]
		queue = queue[1:]
		for _, next := range adjacency[current] {
			if !visited[next] {
				visited[next] = true
				queue = append(queue, next)
			}
		}
	}
	return visited
}

func allReachability(nodesByID map[string]Node, adjacency map[string][]string) map[string]map[string]bool {
	result := make(map[string]map[string]bool, len(nodesByID))
	for id := range nodesByID {
		result[id] = reachable(id, adjacency)
	}
	return result
}

func hasCycle(nodesByID map[string]Node, adjacency map[string][]string, incoming map[string]int) bool {
	degrees := make(map[string]int, len(incoming))
	for id := range nodesByID {
		degrees[id] = incoming[id]
	}
	queue := make([]string, 0, len(nodesByID))
	for id, degree := range degrees {
		if degree == 0 {
			queue = append(queue, id)
		}
	}
	visited := 0
	for len(queue) > 0 {
		id := queue[0]
		queue = queue[1:]
		visited++
		for _, target := range adjacency[id] {
			degrees[target]--
			if degrees[target] == 0 {
				queue = append(queue, target)
			}
		}
	}
	return visited != len(nodesByID)
}

func templateReferences(config json.RawMessage) []string {
	matches := templatePattern.FindAllSubmatch(config, -1)
	references := make([]string, 0, len(matches))
	for _, match := range matches {
		references = append(references, strings.TrimSpace(string(match[1])))
	}
	return references
}

func splitReference(reference string) (string, string, bool) {
	parts := strings.Split(reference, ".")
	if len(parts) != 3 || parts[1] != "output" || strings.TrimSpace(parts[0]) == "" || strings.TrimSpace(parts[2]) == "" {
		return "", "", false
	}
	return parts[0], parts[2], true
}
