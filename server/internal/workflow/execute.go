package workflow

import (
	"context"
	"encoding/json"
	"fmt"
	"sort"
	"strings"
	"time"
)

// ResolveTemplate replaces only {{node.output.field}} references using output
// that is already present in this run. It deliberately has no expression
// language, template functions, URL fetching, or code execution surface.
func ResolveTemplate(value string, outputs map[string]map[string]any) (any, error) {
	matches := templatePattern.FindAllStringIndex(value, -1)
	if len(matches) == 1 && matches[0][0] == 0 && matches[0][1] == len(value) {
		return resolveTemplateToken(value, outputs)
	}

	var resolveErr error
	resolved := templatePattern.ReplaceAllStringFunc(value, func(token string) string {
		result, err := resolveTemplateToken(token, outputs)
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

func resolveTemplateToken(token string, outputs map[string]map[string]any) (any, error) {
	reference := strings.TrimSpace(token[2 : len(token)-2])
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

// Execute runs a graph in deterministic topological order. Handler code is
// responsible for persisting the events; this package never performs I/O.
func Execute(ctx context.Context, graph Graph, registry *Registry, run RunContext, emit func(Event)) error {
	if registry == nil {
		return fmt.Errorf("工作流注册表不能为空")
	}
	if errs := ValidateGraph(graph, registry); len(errs) > 0 {
		return fmt.Errorf("工作流校验失败：%s", strings.Join(errs, "；"))
	}
	nodes, err := topologicalNodes(graph)
	if err != nil {
		return err
	}
	if run.Inputs == nil {
		run.Inputs = make(map[string]any)
	}
	if run.Outputs == nil {
		run.Outputs = make(map[string]map[string]any)
	}
	if err := normalizeRunInputs(graph, run.Inputs); err != nil {
		return err
	}

	for _, node := range nodes {
		input, inputErr := resolveNodeInput(node, run)
		startedAt := time.Now()
		emitEvent(emit, node.Type, Event{RunID: run.ID, NodeID: node.ID, Status: StatusRunning, Input: input})
		if inputErr != nil {
			err := inputErr
			emitEvent(emit, node.Type, failedEvent(run.ID, node.ID, input, err, startedAt))
			return err
		}
		if err := ctx.Err(); err != nil {
			emitEvent(emit, node.Type, failedEvent(run.ID, node.ID, input, err, startedAt))
			return err
		}
		executor := registry.Executor(node.Type)
		if executor == nil {
			err := fmt.Errorf("节点类型 %s 没有已启用的执行器", node.Type)
			emitEvent(emit, node.Type, failedEvent(run.ID, node.ID, input, err, startedAt))
			return err
		}
		result, err := executor.Execute(ctx, run, NodeExecution{NodeID: node.ID, NodeType: node.Type, Input: input})
		if err != nil {
			emitEvent(emit, node.Type, failedEvent(run.ID, node.ID, input, err, startedAt))
			return err
		}
		if result.Output == nil {
			result.Output = make(map[string]any)
		}
		run.Outputs[node.ID] = result.Output
		emitEvent(emit, node.Type, Event{
			RunID:      run.ID,
			NodeID:     node.ID,
			Status:     StatusSucceeded,
			Input:      input,
			Output:     result.Output,
			DurationMs: time.Since(startedAt).Milliseconds(),
		})
	}
	return nil
}

func failedEvent(runID, nodeID string, input map[string]any, err error, startedAt time.Time) Event {
	_ = err
	return Event{
		RunID:      runID,
		NodeID:     nodeID,
		Status:     StatusFailed,
		Input:      input,
		Message:    "节点执行失败，请检查节点配置或服务状态",
		Error:      "WORKFLOW_NODE_FAILED",
		DurationMs: time.Since(startedAt).Milliseconds(),
	}
}

func emitEvent(emit func(Event), nodeType NodeType, event Event) {
	if emit != nil {
		event.Input = safeEventInput(nodeType, event.Input)
		event.Output = safeEventOutput(nodeType, event.Output)
		emit(event)
	}
}

func safeEventInput(nodeType NodeType, values map[string]any) map[string]any {
	switch nodeType {
	case NodeTypeBlogParse:
		return safePreviewFields(values, "fileInput")
	case NodeTypeVariable:
		return safePreviewFields(values, "variableName", "valueExpression")
	case NodeTypeHTTP:
		return safePreviewFields(values, "method", "url", "body")
	case NodeTypeCode:
		return safePreviewFields(values, "language", "inputVars", "outputVars")
	case NodeTypeLLMText:
		return safePreviewFields(values, "modelProfile", "temperature", "maxOutputTokens")
	case NodeTypeKnowledgeRetrieve:
		return map[string]any{}
	case NodeTypeBlogCreateDraft:
		preview := safePreviewFields(values, "title", "tagMode", "visibility")
		if tags, err := stringListFromValue(values["tags"]); err == nil {
			preview["tagCount"] = len(tags)
		}
		if tags, err := optionalStringListFromValue(values["suggestedTags"]); err == nil && tags != nil {
			preview["suggestedTagCount"] = len(tags)
		}
		return preview
	case NodeTypeEnd:
		return safePreviewFields(values, "postId", "title", "editPath", "tagIds")
	default:
		return nil
	}
}

func safeEventOutput(nodeType NodeType, values map[string]any) map[string]any {
	switch nodeType {
	case NodeTypeStart:
		preview := safePreviewFields(values, "markdownFile", "groupId", "visibility")
		if tags, err := stringListFromValue(values["tagIds"]); err == nil {
			preview["tagCount"] = len(tags)
		}
		return preview
	case NodeTypeBlogParse:
		preview := safePreviewFields(values, "title", "excerpt", "tagNames")
		if content, ok := values["content"].(string); ok {
			preview["contentPreview"] = truncatePreviewText(content)
			preview["contentLength"] = len([]rune(content))
		}
		return preview
	case NodeTypeLLMText:
		preview := safePreviewFields(values, "model", "tokenUsage")
		if text, ok := values["text"].(string); ok {
			preview["text"] = truncatePreviewText(text)
			preview["textLength"] = len([]rune(text))
		}
		return preview
	case NodeTypeKnowledgeRetrieve:
		preview := map[string]any{}
		if references, ok := values["references"].([]KnowledgeReference); ok {
			preview["referenceCount"] = len(references)
		}
		return preview
	case NodeTypeHTTP:
		preview := safePreviewFields(values, "status", "statusCode", "url", "contentType")
		if body, ok := values["body"].(string); ok {
			preview["body"] = truncatePreviewText(body)
			preview["bodyLength"] = len([]rune(body))
		}
		return preview
	case NodeTypeVariable, NodeTypeCode:
		return safePreviewFields(values)
	case NodeTypeBlogCreateDraft:
		return safePreviewFields(values, "postId", "title", "editPath", "tagIds")
	case NodeTypeEnd:
		return safeEndOutput(values)
	default:
		return nil
	}
}

func safeEndOutput(values map[string]any) map[string]any {
	preview := make(map[string]any, len(values))
	for key, value := range values {
		if isSensitiveKey(key) {
			continue
		}
		preview[key] = safePreviewValue(value)
	}
	return preview
}

func safePreviewFields(values map[string]any, keys ...string) map[string]any {
	if values == nil {
		return nil
	}
	preview := make(map[string]any, len(keys))
	for _, key := range keys {
		if value, exists := values[key]; exists {
			preview[key] = safePreviewValue(value)
		}
	}
	return preview
}

const previewTextLimit = 2048

func safePreviewMap(values map[string]any) map[string]any {
	if values == nil {
		return nil
	}
	preview := make(map[string]any, len(values))
	for key, value := range values {
		if isSensitiveKey(key) {
			preview[key] = "[REDACTED]"
			continue
		}
		preview[key] = safePreviewValue(value)
	}
	return preview
}

func safePreviewValue(value any) any {
	switch typed := value.(type) {
	case nil, bool, float64, float32, int, int8, int16, int32, int64, uint, uint8, uint16, uint32, uint64:
		return typed
	case string:
		return truncatePreviewText(typed)
	case []byte:
		return fmt.Sprintf("[binary %d bytes]", len(typed))
	case FileInput:
		return map[string]any{
			"filename":    typed.Filename,
			"contentType": typed.ContentType,
			"size":        typed.Size,
		}
	case *FileInput:
		if typed == nil {
			return nil
		}
		return safePreviewValue(*typed)
	case []string:
		preview := make([]string, len(typed))
		for index, item := range typed {
			preview[index] = truncatePreviewText(item)
		}
		return preview
	case []any:
		preview := make([]any, len(typed))
		for index, item := range typed {
			preview[index] = safePreviewValue(item)
		}
		return preview
	case map[string]any:
		if isFileValue(typed) {
			return safeFileMetadata(typed)
		}
		return safePreviewMap(typed)
	case map[string]string:
		if isStringFileValue(typed) {
			return safeStringFileMetadata(typed)
		}
		preview := make(map[string]any, len(typed))
		for key, item := range typed {
			if isSensitiveKey(key) {
				preview[key] = "[REDACTED]"
				continue
			}
			preview[key] = truncatePreviewText(item)
		}
		return preview
	default:
		return fmt.Sprintf("[%T]", value)
	}
}

func isSensitiveKey(key string) bool {
	normalized := strings.ToLower(key)
	return strings.Contains(normalized, "secret") || strings.Contains(normalized, "key") || strings.Contains(normalized, "token") || strings.Contains(normalized, "password")
}

func isFileValue(value map[string]any) bool {
	for key := range value {
		if isFileNameKey(key) {
			return true
		}
	}
	return false
}

func safeFileMetadata(value map[string]any) map[string]any {
	preview := make(map[string]any)
	for key, item := range value {
		if !isFileMetadataKey(key) {
			continue
		}
		preview[key] = safePreviewValue(item)
	}
	return preview
}

func isStringFileValue(value map[string]string) bool {
	for key := range value {
		if isFileNameKey(key) {
			return true
		}
	}
	return false
}

func safeStringFileMetadata(value map[string]string) map[string]any {
	preview := make(map[string]any)
	for key, item := range value {
		if isFileMetadataKey(key) {
			preview[key] = truncatePreviewText(item)
		}
	}
	return preview
}

func isFileNameKey(key string) bool {
	normalized := strings.ReplaceAll(strings.ToLower(key), "_", "")
	return normalized == "filename" || normalized == "name"
}

func isFileMetadataKey(key string) bool {
	normalized := strings.ReplaceAll(strings.ToLower(key), "_", "")
	switch normalized {
	case "filename", "name", "size", "contenttype", "mimetype":
		return true
	default:
		return false
	}
}

func truncatePreviewText(value string) string {
	runes := []rune(value)
	if len(runes) <= previewTextLimit {
		return value
	}
	return string(runes[:previewTextLimit])
}

func topologicalNodes(graph Graph) ([]Node, error) {
	nodesByID := make(map[string]Node, len(graph.Nodes))
	order := make(map[string]int, len(graph.Nodes))
	incoming := make(map[string]int, len(graph.Nodes))
	adjacency := make(map[string][]string, len(graph.Nodes))
	for index, node := range graph.Nodes {
		nodesByID[node.ID] = node
		order[node.ID] = index
		adjacency[node.ID] = nil
	}
	for _, edge := range graph.Edges {
		adjacency[edge.Source] = append(adjacency[edge.Source], edge.Target)
		incoming[edge.Target]++
	}
	queue := make([]string, 0, len(graph.Nodes))
	for _, node := range graph.Nodes {
		if incoming[node.ID] == 0 {
			queue = append(queue, node.ID)
		}
	}
	result := make([]Node, 0, len(graph.Nodes))
	for len(queue) > 0 {
		current := queue[0]
		queue = queue[1:]
		result = append(result, nodesByID[current])
		for _, target := range adjacency[current] {
			incoming[target]--
			if incoming[target] == 0 {
				queue = append(queue, target)
			}
		}
		sort.SliceStable(queue, func(left, right int) bool { return order[queue[left]] < order[queue[right]] })
	}
	if len(result) != len(graph.Nodes) {
		return nil, fmt.Errorf("工作流不能包含循环")
	}
	return result, nil
}

func resolveNodeInput(node Node, run RunContext) (map[string]any, error) {
	if len(node.Config) == 0 {
		return map[string]any{}, nil
	}
	var input map[string]any
	if err := json.Unmarshal(node.Config, &input); err != nil {
		return nil, err
	}
	resolved, err := resolveInputValue(input, run.Outputs)
	if err != nil {
		return nil, err
	}
	result := resolved.(map[string]any)
	if node.Type != NodeTypeBlogParse {
		return result, nil
	}
	inputName, ok := result["fileInput"].(string)
	if !ok {
		return result, nil
	}
	file, exists := run.Inputs[inputName]
	if !exists {
		return nil, fmt.Errorf("开始节点文件输入 %s 不存在", inputName)
	}
	result["fileInput"] = file
	return result, nil
}

func normalizeRunInputs(graph Graph, inputs map[string]any) error {
	for _, node := range graph.Nodes {
		if node.Type != NodeTypeStart {
			continue
		}
		var config startNodeConfig
		if err := strictDecode(node.Config, &config); err != nil {
			return fmt.Errorf("开始节点输入配置无效: %w", err)
		}
		names := make([]string, 0, len(config.Inputs))
		for name := range config.Inputs {
			names = append(names, name)
		}
		sort.Strings(names)
		for _, name := range names {
			definition := config.Inputs[name]
			value, exists := inputs[name]
			if !exists || value == nil {
				if definition.Required {
					return fmt.Errorf("开始节点输入 %s 为必填项", name)
				}
				inputs[name] = emptyStartInputValue(definition.Type)
				continue
			}
			normalized, err := normalizeStartInput(name, definition, value)
			if err != nil {
				return err
			}
			inputs[name] = normalized
		}
		return nil
	}
	return nil
}

func emptyStartInputValue(valueType ValueType) any {
	switch valueType {
	case ValueTypeString:
		return ""
	case ValueTypeStringList:
		return []string{}
	case ValueTypeObject:
		return map[string]any{}
	case ValueTypeNumber:
		return float64(0)
	case ValueTypeBoolean:
		return false
	case ValueTypeFile:
		return nil
	default:
		return nil
	}
}

const maxMarkdownFileBytes = 5 * 1024 * 1024

func normalizeStartInput(name string, definition inputDefinition, value any) (any, error) {
	switch definition.Type {
	case ValueTypeString:
		text, ok := value.(string)
		if !ok || (definition.Required && strings.TrimSpace(text) == "") {
			return nil, fmt.Errorf("开始节点输入 %s 必须是非空 string", name)
		}
		return text, nil
	case ValueTypeStringList:
		list, err := normalizeStringList(value)
		if err != nil || (definition.Required && len(list) == 0) {
			return nil, fmt.Errorf("开始节点输入 %s 必须是 string[]", name)
		}
		return list, nil
	case ValueTypeObject:
		switch typed := value.(type) {
		case map[string]any:
			return typed, nil
		case map[string]string:
			return typed, nil
		default:
			return nil, fmt.Errorf("开始节点输入 %s 必须是 object", name)
		}
	case ValueTypeNumber:
		switch value.(type) {
		case float64, float32, int, int8, int16, int32, int64, uint, uint8, uint16, uint32, uint64:
			return value, nil
		default:
			return nil, fmt.Errorf("开始节点输入 %s 必须是 number", name)
		}
	case ValueTypeBoolean:
		if _, ok := value.(bool); !ok {
			return nil, fmt.Errorf("开始节点输入 %s 必须是 boolean", name)
		}
		return value, nil
	case ValueTypeFile:
		file, err := validateMarkdownFile(value)
		if err != nil {
			return nil, fmt.Errorf("开始节点输入 %s 无效: %w", name, err)
		}
		return file, nil
	default:
		return nil, fmt.Errorf("开始节点输入 %s 类型不支持", name)
	}
}

func validateMarkdownFile(value any) (FileInput, error) {
	file, err := fileFromValue(value)
	if err != nil {
		return FileInput{}, err
	}
	name := strings.ToLower(strings.TrimSpace(file.Filename))
	if !strings.HasSuffix(name, ".md") && !strings.HasSuffix(name, ".markdown") {
		return FileInput{}, fmt.Errorf("只支持 .md 或 .markdown 文件")
	}
	if len(file.Content) == 0 {
		return FileInput{}, fmt.Errorf("文件内容不能为空")
	}
	if file.Size == 0 {
		file.Size = int64(len(file.Content))
	}
	if file.Size > maxMarkdownFileBytes || len(file.Content) > maxMarkdownFileBytes {
		return FileInput{}, fmt.Errorf("文件不能超过 5MB")
	}
	return file, nil
}

func normalizeStringList(value any) ([]string, error) {
	switch typed := value.(type) {
	case []string:
		return typed, nil
	case []any:
		result := make([]string, len(typed))
		for index, item := range typed {
			text, ok := item.(string)
			if !ok {
				return nil, fmt.Errorf("列表第 %d 项不是字符串", index)
			}
			result[index] = text
		}
		return result, nil
	default:
		return nil, fmt.Errorf("不是字符串列表")
	}
}

func resolveInputValue(value any, outputs map[string]map[string]any) (any, error) {
	switch typed := value.(type) {
	case string:
		return ResolveTemplate(typed, outputs)
	case map[string]any:
		resolved := make(map[string]any, len(typed))
		for key, nested := range typed {
			value, err := resolveInputValue(nested, outputs)
			if err != nil {
				return nil, err
			}
			resolved[key] = value
		}
		return resolved, nil
	case []any:
		resolved := make([]any, len(typed))
		for index, nested := range typed {
			value, err := resolveInputValue(nested, outputs)
			if err != nil {
				return nil, err
			}
			resolved[index] = value
		}
		return resolved, nil
	default:
		return value, nil
	}
}

type startExecutor struct{}

func (startExecutor) Type() NodeType { return NodeTypeStart }

func (startExecutor) Execute(_ context.Context, run RunContext, _ NodeExecution) (NodeResult, error) {
	output := make(map[string]any, len(run.Inputs))
	for key, value := range run.Inputs {
		output[key] = value
	}
	return NodeResult{Output: output}, nil
}

type endExecutor struct{}

func (endExecutor) Type() NodeType { return NodeTypeEnd }

func (endExecutor) Execute(_ context.Context, _ RunContext, execution NodeExecution) (NodeResult, error) {
	outputs, ok := execution.Input["outputs"].(map[string]any)
	if !ok {
		return NodeResult{}, fmt.Errorf("结束节点输出配置无效")
	}
	return NodeResult{Output: outputs}, nil
}
