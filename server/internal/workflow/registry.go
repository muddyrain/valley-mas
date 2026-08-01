package workflow

import (
	"fmt"
	"sort"
)

const (
	CapabilityParseMarkdown       = "content.parseMarkdown"
	CapabilityExtractDocument     = "content.extractDocument"
	CapabilityExtractStructured   = "content.extractStructured"
	CapabilityKnowledge           = "knowledge.retrieve"
	CapabilityWriteKnowledge      = "knowledge.write"
	CapabilityCreateFile          = "file.create"
	CapabilityFormatReferences    = "knowledge.formatReferences"
	CapabilityParseJSON           = "data.parseJSON"
	CapabilityChunkList           = "data.chunkList"
	CapabilityProcessList         = "data.processList"
	CapabilityContentSearch       = "content.search"
	CapabilityNotionSearch        = "notion.search"
	CapabilityGenerateCover       = "image.generateCover"
	CapabilityGenerateAIImage     = "image.generate"
	CapabilityUnderstandAIImage   = "image.understand"
	CapabilitySaveAIImageResource = "image.saveGeneratedResource"
	CapabilityCreateBlogDraft     = "blog.createDraft"
	CapabilitySendNotification    = "notification.send"
)

type NodeDefinition struct {
	Type          NodeType       `json:"type"`
	Label         string         `json:"label"`
	Description   string         `json:"description"`
	Category      string         `json:"category"`
	InputPorts    []string       `json:"inputPorts"`
	OutputPorts   []string       `json:"outputPorts"`
	WhenAllowed   bool           `json:"whenAllowed"`
	ConfigSchema  map[string]any `json:"configSchema"`
	DefaultConfig map[string]any `json:"defaultConfig"`
}

type ToolCapability struct {
	ID           string               `json:"id"`
	Name         string               `json:"name"`
	Description  string               `json:"description"`
	Category     string               `json:"category"`
	SideEffect   string               `json:"sideEffect"`
	ModelCost    int                  `json:"modelCost"`
	WriteCost    int                  `json:"writeCost"`
	Available    bool                 `json:"available"`
	InputSchema  map[string]any       `json:"inputSchema"`
	OutputSchema map[string]ValueType `json:"outputSchema"`
	AIUsage      string               `json:"aiUsage"`
	UI           map[string]any       `json:"ui,omitempty"`
}

type Limits struct {
	MaxNodes             int `json:"maxNodes"`
	MaxModelCapabilities int `json:"maxModelCapabilities"`
	MaxWriteCapabilities int `json:"maxWriteCapabilities"`
}

var DefaultLimits = Limits{MaxNodes: 30, MaxModelCapabilities: 5, MaxWriteCapabilities: 3}

type capabilityRegistration struct {
	definition ToolCapability
	executor   CapabilityExecutor
}

type Registry struct {
	nodes              map[NodeType]NodeDefinition
	executors          map[NodeType]NodeExecutor
	capabilities       map[string]capabilityRegistration
	httpOutboundPolicy HTTPOutboundPolicy
}

func DefaultRegistry() *Registry {
	return DefaultRegistryWithHTTPOutboundPolicy(HTTPOutboundPolicy{})
}

func DefaultRegistryWithHTTPOutboundPolicy(policy HTTPOutboundPolicy) *Registry {
	required := func(names ...string) map[string]any {
		return map[string]any{"type": "object", "required": names}
	}
	registry := NewRegistry(
		NodeDefinition{Type: NodeTypeStart, Label: "开始", Description: "声明工作流输入", Category: "flow", OutputPorts: []string{"output"}, ConfigSchema: required("inputs"), DefaultConfig: map[string]any{"inputs": map[string]any{}}},
		NodeDefinition{Type: NodeTypeEnd, Label: "结束", Description: "返回工作流输出", Category: "flow", InputPorts: []string{"input"}, ConfigSchema: required("outputs"), DefaultConfig: map[string]any{"outputs": map[string]any{}, "outputTypes": map[string]any{}}},
		NodeDefinition{Type: NodeTypeLLM, Label: "大模型", Description: "使用已选文本模型生成内容", Category: "model", InputPorts: []string{"input"}, OutputPorts: []string{"output"}, WhenAllowed: true, ConfigSchema: required("prompt"), DefaultConfig: map[string]any{"systemPrompt": "你是一个可靠的内容助手。", "prompt": "请完成当前任务。", "inputs": map[string]any{}, "inputTypes": map[string]any{}, "outputMode": "text", "temperature": 0.4, "maxOutputTokens": 512}},
		NodeDefinition{Type: NodeTypeTemplate, Label: "文本模板", Description: "使用上游变量确定性地拼装文本", Category: "content", InputPorts: []string{"input"}, OutputPorts: []string{"output"}, WhenAllowed: true, ConfigSchema: required("template"), DefaultConfig: map[string]any{"template": ""}},
		NodeDefinition{Type: NodeTypeHTTP, Label: "HTTP 请求", Description: "向受控的 HTTP(S) API 发送请求", Category: "tool", InputPorts: []string{"input"}, OutputPorts: []string{"output"}, WhenAllowed: true, ConfigSchema: required("method", "url"), DefaultConfig: map[string]any{"method": "GET", "url": "", "params": []any{}, "headers": []any{}, "bodyType": "none", "body": "", "timeoutSeconds": 30, "retryCount": 0, "ignoreError": false}},
		NodeDefinition{Type: NodeTypeTool, Label: "工具", Description: "调用白名单业务能力", Category: "tool", InputPorts: []string{"input"}, OutputPorts: []string{"output"}, WhenAllowed: true, ConfigSchema: required("capabilityId", "inputs"), DefaultConfig: map[string]any{"inputs": map[string]any{}}},
		NodeDefinition{Type: NodeTypeCondition, Label: "条件", Description: "按受控规则选择分支", Category: "flow", InputPorts: []string{"input"}, OutputPorts: []string{"true", "false"}, ConfigSchema: required("left", "operator"), DefaultConfig: map[string]any{"left": "", "operator": "equals", "right": true}},
		NodeDefinition{Type: NodeTypeSwitch, Label: "选择器", Description: "根据结构化字段选择一条路径", Category: "flow", InputPorts: []string{"input"}, OutputPorts: []string{"case:*", "default"}, ConfigSchema: required("value", "valueType", "cases"), DefaultConfig: map[string]any{"value": "", "valueType": "string", "cases": []any{map[string]any{"id": "case_1", "label": "选项 1", "value": "option_1"}, map[string]any{"id": "case_2", "label": "选项 2", "value": "option_2"}}}},
		NodeDefinition{Type: NodeTypeMerge, Label: "合并", Description: "从已执行分支选择首个可用值", Category: "flow", InputPorts: []string{"input"}, OutputPorts: []string{"output"}, ConfigSchema: required("fields"), DefaultConfig: map[string]any{"fields": []any{}}},
		NodeDefinition{Type: NodeTypeVariable, Label: "变量", Description: "设置可复用变量", Category: "flow", InputPorts: []string{"input"}, OutputPorts: []string{"output"}, WhenAllowed: true, ConfigSchema: required("assignments"), DefaultConfig: map[string]any{"assignments": []any{map[string]any{"name": "value", "type": "string", "value": ""}}}},
		NodeDefinition{Type: NodeTypeSubworkflow, Label: "子工作流", Description: "调用已发布的不可变工作流版本", Category: "subworkflow", InputPorts: []string{"input"}, OutputPorts: []string{"output"}, WhenAllowed: true, ConfigSchema: required("workflowId", "versionId", "inputs"), DefaultConfig: map[string]any{"inputs": map[string]any{}}},
		NodeDefinition{Type: NodeTypeIntent, Label: "意图识别", Description: "按已配置意图将文本分流", Category: "logic", InputPorts: []string{"input"}, OutputPorts: []string{"intent:*", "intent:other"}, ConfigSchema: required("query", "intents"), DefaultConfig: map[string]any{"query": "", "intents": []any{map[string]any{"id": "intent_1", "name": "意图 1", "description": "", "examples": []any{}}}}},
		NodeDefinition{Type: NodeTypeLoop, Label: "循环", Description: "重复执行循环体子流程", Category: "flow", InputPorts: []string{"input"}, OutputPorts: []string{"output"}, ConfigSchema: required("mode", "body", "outputs"), DefaultConfig: map[string]any{"mode": "array", "input": "", "middleVariables": []any{}, "outputs": []any{}, "body": map[string]any{"nodes": []any{}, "edges": []any{}}}},
		NodeDefinition{Type: NodeTypeSetLoopVar, Label: "设置循环变量", Description: "更新下一轮循环使用的中间变量", Category: "flow", InputPorts: []string{"input"}, OutputPorts: []string{"output"}, ConfigSchema: required("name", "value"), DefaultConfig: map[string]any{"name": "", "value": ""}},
		NodeDefinition{Type: NodeTypeContinueLoop, Label: "继续循环", Description: "结束当前轮循环", Category: "flow", InputPorts: []string{"input"}, ConfigSchema: required(), DefaultConfig: map[string]any{}},
		NodeDefinition{Type: NodeTypeTerminateLoop, Label: "终止循环", Description: "结束整个循环", Category: "flow", InputPorts: []string{"input"}, ConfigSchema: required(), DefaultConfig: map[string]any{}},
		NodeDefinition{Type: NodeTypeApproval, Label: "人工审批", Description: "暂停运行，等待所有者批准或拒绝", Category: "flow", InputPorts: []string{"input"}, OutputPorts: []string{"output"}, ConfigSchema: required("title"), DefaultConfig: map[string]any{"title": "确认继续执行", "description": ""}},
		NodeDefinition{Type: NodeTypeDelay, Label: "延时", Description: "等待一段时间后继续执行", Category: "flow", InputPorts: []string{"input"}, OutputPorts: []string{"output"}, ConfigSchema: required("delayMs"), DefaultConfig: map[string]any{"delayMs": 1000}},
	)
	registry.httpOutboundPolicy = policy
	for _, executor := range []NodeExecutor{startExecutor{}, endExecutor{}, TemplateExecutor{}, ConditionExecutor{}, SwitchExecutor{}, MergeExecutor{}, VariableExecutor{}, SubworkflowExecutor{}, IntentClassifierExecutor{}, LLMTextExecutor{}, HTTPRequestExecutor{OutboundPolicy: policy}, ToolNodeExecutor{Registry: registry}, LoopExecutor{Registry: registry}, ApprovalExecutor{}, DelayExecutor{}} {
		_ = registry.RegisterExecutor(executor)
	}
	return registry
}

func NewRegistry(definitions ...NodeDefinition) *Registry {
	nodes := make(map[NodeType]NodeDefinition, len(definitions))
	for _, definition := range definitions {
		nodes[definition.Type] = definition
	}
	return &Registry{nodes: nodes, executors: make(map[NodeType]NodeExecutor), capabilities: make(map[string]capabilityRegistration)}
}

func (r *Registry) RegisterExecutor(executor NodeExecutor) error {
	if r == nil || executor == nil {
		return fmt.Errorf("工作流执行器不能为空")
	}
	if !r.Supports(executor.Type()) {
		return fmt.Errorf("节点类型 %s 未声明", executor.Type())
	}
	if _, exists := r.executors[executor.Type()]; exists {
		return fmt.Errorf("节点类型 %s 的执行器已注册", executor.Type())
	}
	r.executors[executor.Type()] = executor
	return nil
}

func (r *Registry) RegisterCapability(definition ToolCapability, executor CapabilityExecutor) error {
	if r == nil || executor == nil || definition.ID == "" {
		return fmt.Errorf("工具能力注册信息不完整")
	}
	if _, exists := r.capabilities[definition.ID]; exists {
		return fmt.Errorf("工具能力 %s 已注册", definition.ID)
	}
	definition.Available = true
	r.capabilities[definition.ID] = capabilityRegistration{definition: definition, executor: executor}
	return nil
}

func RegisterWorkflowCapabilities(registry *Registry) error {
	imageGenerationModel := inputField("string", "图片模型", "选择具备图片生成能力的模型。", "选择图片模型")
	imageGenerationModel["modelCapability"] = "image_generation"
	visionModel := inputField("string", "视觉模型", "选择具备图片理解能力的模型。", "选择视觉模型")
	visionModel["modelCapability"] = "vision"
	textModel := inputField("string", "文本模型", "选择用于结构化信息提取的文本模型。", "选择文本模型")
	textModel["modelCapability"] = "text"
	aspectRatio := inputField("string", "画面比例", "设置生成图片的宽高比。", "1:1")
	aspectRatio["enum"] = []string{"1:1", "4:3", "3:4", "16:9", "9:16"}
	aspectRatio["default"] = "1:1"
	quality := inputField("string", "目标分辨率", "最终可用档位由所选模型决定。", "1K")
	quality["enum"] = []string{"1K", "2K", "3K", "4K"}
	quality["default"] = "1K"
	imagePrompt := inputField("string", "提示词描述", "描述主体、场景、风格和构图，可引用上游文本，也可以直接填写固定内容。", "例如：云海中的未来图书馆")
	imagePrompt["allowFixedValue"] = true
	citationStyle := inputField("string", "引用样式", "选择 Markdown 引用或普通编号列表。", "markdown")
	citationStyle["enum"] = []string{"markdown", "numbered"}
	citationStyle["default"] = "markdown"
	knowledgeBase := inputField("string", "目标知识库", "选择当前账户已有的私有知识库。", "选择知识库")
	knowledgeBase["resource"] = "knowledge_base"
	knowledgeDocumentName := inputField("string", "文档名称", "保存到知识库后的文档名称；也可以直接填写固定名称。", "例如：2026-08 工作流总结")
	knowledgeDocumentName["allowFixedValue"] = true
	knowledgeDocumentContent := inputField("string", "文档内容", "绑定上游生成或提取出的纯文本；也可以直接填写固定内容，最多 2MB。", "输入内容或选择上游文本变量")
	knowledgeDocumentContent["allowFixedValue"] = true
	fileName := inputField("string", "文件名", "文件将保存到当前所有者的私有资源中；扩展名会按所选格式自动补齐。", "例如：8月内容总结")
	fileName["allowFixedValue"] = true
	fileContent := inputField("string", "文件内容", "绑定上游文本；JSON 格式需要是有效 JSON，CSV 格式需要是有效 CSV。", "选择上游文本变量或填写固定内容")
	fileContent["allowFixedValue"] = true
	fileFormat := inputField("string", "文件格式", "首期支持 Markdown、JSON 和 CSV。", "markdown")
	fileFormat["enum"] = []string{"markdown", "json", "csv"}
	fileFormat["default"] = "markdown"
	batchSize := inputField("number", "每批数量", "把输入数组切成每批 1 到 100 项。", "10")
	batchSize["default"] = 10
	listOperation := inputField("string", "处理方式", "选择筛选、字段映射、稳定排序或去重。", "filter")
	listOperation["enum"] = []string{"filter", "map", "sort", "dedupe"}
	listOperation["default"] = "filter"
	listOperator := inputField("string", "筛选条件", "对列表项或指定字段执行受控比较。", "equals")
	listOperator["enum"] = []string{"equals", "notEquals", "contains", "greaterThan", "greaterOrEqual", "lessThan", "lessOrEqual", "isEmpty", "notEmpty"}
	listOperator["default"] = "equals"
	listDirection := inputField("string", "排序方向", "升序或降序；缺失字段始终排在末尾。", "asc")
	listDirection["enum"] = []string{"asc", "desc"}
	listDirection["default"] = "asc"
	notificationStatus := inputField("string", "通知状态", "用于区分普通、成功、失败和等待审批通知。", "info")
	notificationStatus["enum"] = []string{"info", "success", "error", "waiting_approval"}
	notificationStatus["default"] = "info"
	definitions := []struct {
		definition ToolCapability
		executor   CapabilityExecutor
	}{
		{ToolCapability{ID: CapabilityParseMarkdown, Name: "解析 Markdown", Description: "解析 Markdown 标题、正文和 Front Matter", Category: "content", SideEffect: "none", InputSchema: schemaWithFields([]string{"fileInput"}, map[string]map[string]any{"fileInput": inputField("file", "Markdown 文件", "选择开始节点上传的 Markdown 文件。", "选择 Markdown 文件变量")}), OutputSchema: fields(field("title", ValueTypeString), field("content", ValueTypeString), field("excerpt", ValueTypeString), field("frontMatter", ValueTypeObject), field("cover", ValueTypeString), field("tagNames", ValueTypeStringList)), AIUsage: "需要解析上传的 Markdown 文件时使用"}, ParseMarkdownCapabilityAdapter{}},
		{ToolCapability{ID: CapabilityExtractDocument, Name: "文档提取", Description: "从 PDF、文本与常见文档格式中确定性提取正文", Category: "content", SideEffect: "none", InputSchema: schemaWithFields([]string{"fileInput"}, map[string]map[string]any{"fileInput": inputField("file", "文档文件", "支持 PDF、TXT、Markdown、HTML、JSON、CSV、YAML 和 XML。", "选择开始节点上传的文档")}), OutputSchema: fields(field("text", ValueTypeString), field("pages", ValueTypeArray), field("format", ValueTypeString), field("pageCount", ValueTypeNumber), field("characterCount", ValueTypeNumber)), AIUsage: "需要先把上传文档转换为可检索或可提取的纯文本时使用；扫描 PDF 请改用图片理解或知识库 OCR"}, DocumentExtractCapabilityAdapter{}},
		{ToolCapability{ID: CapabilityExtractStructured, Name: "结构化提取", Description: "按声明字段从文本中提取并校验 JSON 对象", Category: "content", SideEffect: "model", ModelCost: 1, InputSchema: schemaWithFields([]string{"modelId", "text", "schema"}, map[string]map[string]any{"modelId": textModel, "text": inputField("string", "待提取文本", "绑定文档正文、图片理解结果或其他上游文本。", "选择上游文本变量"), "schema": inputField("object", "字段结构", "使用字段名到类型的 JSON 对象，最多 20 个字段。", `例如：{"title":"string","tags":"string[]"}`), "instruction": inputField("string", "提取要求", "可选，补充字段含义和缺失值处理规则。", "例如：只提取原文明确出现的信息")}), OutputSchema: fields(field("data", ValueTypeObject), field("model", ValueTypeString), field("tokenUsage", ValueTypeNumber)), AIUsage: "需要把非结构化文本转换为严格 JSON 对象时使用"}, StructuredExtractCapabilityAdapter{}},
		{ToolCapability{ID: CapabilityKnowledge, Name: "知识库检索", Description: "检索当前工作流绑定的私有资料库", Category: "knowledge", SideEffect: "read", InputSchema: schemaWithFields([]string{"query"}, map[string]map[string]any{"query": inputField("string", "检索问题", "描述希望从知识库中找到的信息。", "例如：介绍 AI 工作流的最佳实践")}), OutputSchema: fields(field("context", ValueTypeString), field("references", ValueTypeObject)), AIUsage: "需要引用用户私有知识时使用"}, KnowledgeRetrieveCapabilityAdapter{}},
		{ToolCapability{ID: CapabilityWriteKnowledge, Name: "知识库写入", Description: "把工作流文本写入当前账户的私有知识库并开始索引", Category: "knowledge", SideEffect: "write", WriteCost: 1, InputSchema: schemaWithFields([]string{"knowledgeBaseId", "name", "content"}, map[string]map[string]any{"knowledgeBaseId": knowledgeBase, "name": knowledgeDocumentName, "content": knowledgeDocumentContent}), OutputSchema: fields(field("documentId", ValueTypeString), field("status", ValueTypeString), field("chunkCount", ValueTypeNumber)), AIUsage: "将生成结果沉淀到 owner 私有知识库时使用；索引在后台继续，完成后状态会变为 ready", UI: map[string]any{"fields": map[string]any{"content": map[string]any{"editor": "multiline", "label": "文档内容"}}, "connection": map[string]any{"description": "只能写入当前账户已有的私有知识库。", "actionLabel": "管理知识库", "path": "/workbench/resources?tab=knowledge"}}}, KnowledgeWriteCapabilityAdapter{}},
		{ToolCapability{ID: CapabilityCreateFile, Name: "文件产出", Description: "将工作流文本保存为可下载的 Markdown、JSON 或 CSV 私有文件", Category: "content", SideEffect: "write", WriteCost: 1, InputSchema: schemaWithFields([]string{"fileName", "format", "content"}, map[string]map[string]any{"fileName": fileName, "format": fileFormat, "content": fileContent}), OutputSchema: fields(field("resourceId", ValueTypeString), field("fileName", ValueTypeString), field("url", ValueTypeString), field("contentType", ValueTypeString), field("size", ValueTypeNumber)), AIUsage: "需要把工作流最终文本交付为下载文件时使用；文件只保存到当前 owner 的私有资源中", UI: map[string]any{"fields": map[string]any{"content": map[string]any{"editor": "multiline", "label": "文件内容"}}}}, FileCreateCapabilityAdapter{}},
		{ToolCapability{ID: CapabilityFormatReferences, Name: "知识引用整理", Description: "去重并整理知识检索来源为可引用文本和结构化列表", Category: "knowledge", SideEffect: "none", InputSchema: schemaWithFields([]string{"references"}, map[string]map[string]any{"references": inputField("object", "来源引用", "绑定知识库检索节点的 references 输出。", "选择知识库检索 · references"), "style": citationStyle}), OutputSchema: fields(field("citationText", ValueTypeString), field("referenceList", ValueTypeArray), field("count", ValueTypeNumber)), AIUsage: "需要把知识检索来源附加到文章、报告或模型上下文时使用"}, KnowledgeFormatReferencesCapabilityAdapter{}},
		{ToolCapability{ID: CapabilityParseJSON, Name: "解析 JSON", Description: "校验 JSON 文本并输出根对象", Category: "logic", SideEffect: "none", InputSchema: schemaWithFields([]string{"text"}, map[string]map[string]any{"text": inputField("string", "JSON 文本", "绑定 HTTP 或模型返回的 JSON 文本。", "选择上游文本变量")}), OutputSchema: fields(field("value", ValueTypeObject)), AIUsage: "需要把 JSON 文本转换为可绑定对象时使用"}, JSONParseCapabilityAdapter{}},
		{ToolCapability{ID: CapabilityChunkList, Name: "列表切批", Description: "把数组切成多个批次，交给循环节点逐批处理", Category: "logic", SideEffect: "none", InputSchema: schemaWithFields([]string{"items", "batchSize"}, map[string]map[string]any{"items": inputField("array", "项目数组", "绑定需要批量处理的数组。", "选择上游数组变量"), "batchSize": batchSize}), OutputSchema: fields(field("batches", ValueTypeArray), field("batchCount", ValueTypeNumber), field("itemCount", ValueTypeNumber)), AIUsage: "大量项目需要按固定批次交给循环节点处理时使用"}, ChunkListCapabilityAdapter{}},
		{ToolCapability{ID: CapabilityProcessList, Name: "列表处理", Description: "安全地筛选、映射、排序或去重数组", Category: "logic", SideEffect: "none", InputSchema: schemaWithFields([]string{"items", "operation"}, map[string]map[string]any{"items": inputField("array", "项目数组", "绑定需要处理的数组。", "选择上游数组变量"), "operation": listOperation, "field": inputField("string", "字段路径", "使用点路径读取对象字段；留空表示列表项本身。", "例如：author.name"), "operator": listOperator, "value": inputField("string", "比较值", "筛选时使用；数值比较会自动解析数字。", "输入比较值"), "direction": listDirection}), OutputSchema: fields(field("items", ValueTypeArray), field("count", ValueTypeNumber), field("originalCount", ValueTypeNumber)), AIUsage: "需要在不执行代码的前提下筛选数组、提取字段、稳定排序或按字段去重时使用"}, ListProcessingCapabilityAdapter{}},
		{ToolCapability{ID: CapabilityContentSearch, Name: "搜索内容", Description: "搜索当前用户的博客和资源", Category: "content", SideEffect: "read", InputSchema: schemaWithFields(nil, map[string]map[string]any{"query": inputField("string", "关键词", "按标题、正文或资源内容搜索。", "例如：AI 工作流"), "createdFrom": inputField("string", "开始日期", "可选，限定创建日期下限。", "例如：2026-07-01"), "createdTo": inputField("string", "结束日期", "可选，限定创建日期上限。", "例如：2026-07-31")}), OutputSchema: fields(field("count", ValueTypeNumber), field("items", ValueTypeObject)), AIUsage: "需要搜索用户已有内容时使用"}, ContentSearchCapabilityAdapter{}},
		{ToolCapability{ID: CapabilityNotionSearch, Name: "搜索 Notion", Description: "搜索已连接工作区中的页面和数据源", Category: "tool", SideEffect: "read", InputSchema: schemaWithFields([]string{"query"}, map[string]map[string]any{"query": inputField("string", "搜索关键词", "仅搜索当前已连接 Notion 工作区。", "例如：项目计划"), "limit": inputField("number", "结果数量", "可选，返回 1 到 10 条结果，默认 5 条。", "5")}), OutputSchema: fields(field("count", ValueTypeNumber), field("results", ValueTypeObject)), AIUsage: "需要查找当前用户已授权的 Notion 页面或数据源时使用；只读，不创建或修改 Notion 内容", UI: map[string]any{"connection": map[string]any{"description": "仅搜索已连接工作区中的页面和数据源。", "actionLabel": "管理 Notion 连接", "path": "/workbench/resources?tab=tools"}}}, NotionSearchCapabilityAdapter{}},
		{ToolCapability{ID: CapabilityGenerateCover, Name: "生成封面", Description: "根据标题和摘要生成博客封面", Category: "image", SideEffect: "model_and_storage", ModelCost: 1, InputSchema: schemaWithFields([]string{"title"}, map[string]map[string]any{"title": inputField("string", "封面标题", "概括封面要表达的主题。", "例如：AI 工作流封面测试"), "summary": inputField("string", "画面摘要", "补充画面应传达的主体和场景。", "例如：展示一条从开始到结束的自动化内容创作流程"), "style": inputField("string", "视觉风格", "描述构图、风格和限制。", "例如：简洁蓝紫科技插画，抽象工作流节点与连线，无文字")}), OutputSchema: fields(field("imageUrl", ValueTypeString), field("cover", ValueTypeString), field("url", ValueTypeString), field("model", ValueTypeString), field("size", ValueTypeString)), AIUsage: "生成封面时使用；默认直接执行，需要时可在节点生成条件中绑定上游布尔变量", UI: map[string]any{"when": map[string]any{"title": "生成条件", "description": "未设置时，每次运行都会生成封面。", "enabledLabel": "根据上游变量决定是否生成", "variablePlaceholder": "选择上游布尔变量"}}}, CoverGenerateCapabilityAdapter{}},
		{ToolCapability{ID: CapabilityGenerateAIImage, Name: "图片生成", Description: "使用模型目录中的图片模型生成并保存图片", Category: "image", SideEffect: "model_and_storage", ModelCost: 1, InputSchema: schemaWithFields([]string{"modelId", "prompt", "aspectRatio", "quality"}, map[string]map[string]any{"modelId": imageGenerationModel, "prompt": imagePrompt, "aspectRatio": aspectRatio, "quality": quality, "referenceImage": inputField("string", "参考图片", "可选，绑定上游图片地址；所选模型必须支持参考图。", "选择图片地址变量")}), OutputSchema: fields(field("generationId", ValueTypeString), field("imageUrl", ValueTypeString), field("url", ValueTypeString), field("width", ValueTypeNumber), field("height", ValueTypeNumber), field("model", ValueTypeString), field("size", ValueTypeString)), AIUsage: "需要生成通用图片并在下游继续理解、保存或写入内容时使用", UI: map[string]any{"fields": map[string]any{"prompt": map[string]any{"editor": "multiline", "action": "prompt_library", "label": "提示词描述"}}, "numberConfig": map[string]any{"key": "timeoutSeconds", "label": "超时设置（秒）", "description": "60 到 600 秒，默认 240 秒。", "min": 60, "max": 600, "default": 240}}}, GenerateAIImageCapabilityAdapter{}},
		{ToolCapability{ID: CapabilityUnderstandAIImage, Name: "图片理解", Description: "使用视觉模型理解图片并输出文本", Category: "image", SideEffect: "model", ModelCost: 1, InputSchema: schemaWithFields([]string{"modelId", "imageUrl", "prompt"}, map[string]map[string]any{"modelId": visionModel, "imageUrl": inputField("string", "图片地址", "绑定图片生成结果或可访问的 HTTPS 图片。", "选择图片地址变量"), "prompt": inputField("string", "理解任务", "说明需要识别、描述或分析的内容。", "例如：提取画面主体、场景和风格")}), OutputSchema: fields(field("text", ValueTypeString), field("model", ValueTypeString), field("tokenUsage", ValueTypeNumber)), AIUsage: "需要描述图片、提取视觉信息或为后续内容节点提供文本时使用"}, UnderstandAIImageCapabilityAdapter{}},
		{ToolCapability{ID: CapabilitySaveAIImageResource, Name: "保存 AI 生图资源", Description: "识别已完成的 AI 生图，自动生成资源标题和标签后保存到资源库", Category: "image", SideEffect: "model_and_storage", ModelCost: 1, WriteCost: 1, InputSchema: schemaWithFields([]string{"generationId"}, map[string]map[string]any{"generationId": inputField("string", "AI 生图记录 ID", "绑定 AI 生图完成后输出的 generationId。", "选择 AI 生图记录 ID"), "visibility": inputField("string", "可见范围", "private 为仅自己可见；public 为公开资源。默认 private。", "例如：private")}), OutputSchema: fields(field("resourceId", ValueTypeString), field("title", ValueTypeString), field("tags", ValueTypeStringList), field("url", ValueTypeString), field("visibility", ValueTypeString), field("model", ValueTypeString)), AIUsage: "只保存当前用户已完成的 AI 生图；自动使用管理员排序最优且已验证的视觉模型识别标题和标签"}, SaveAIImageResourceCapabilityAdapter{}},
		{ToolCapability{ID: CapabilityCreateBlogDraft, Name: "创建博客草稿", Description: "为当前用户创建博客草稿", Category: "content", SideEffect: "write", WriteCost: 1, InputSchema: schemaWithFields([]string{"title", "content", "tags", "visibility"}, map[string]map[string]any{"title": inputField("string", "草稿标题", "文章展示的主标题。", "例如：用 AI 工作流自动生成内容"), "content": inputField("string", "文章正文", "要保存到草稿的 Markdown 正文。", "例如：## 开始\n\n这是正文内容。"), "excerpt": inputField("string", "摘要", "可选，用于列表页的简短介绍。", "例如：用一条工作流完成内容创作。"), "cover": inputField("string", "封面", "可选，绑定封面图片地址。", "选择生成封面 · imageUrl"), "tags": inputField("string[]", "标签", "文章标签名称列表。", "例如：AI, 工作流"), "suggestedTags": inputField("string[]", "推荐标签", "可选，使用上游给出的标签建议。", "选择解析 Markdown · tagNames"), "visibility": inputField("string", "可见范围", "保存后的默认访问范围。", "例如：private")}), OutputSchema: fields(field("postId", ValueTypeString), field("title", ValueTypeString), field("editPath", ValueTypeString), field("tagIds", ValueTypeStringList)), AIUsage: "只创建博客草稿，手动标签与推荐标签默认合并"}, BlogCreateDraftCapabilityAdapter{}},
		{ToolCapability{ID: CapabilitySendNotification, Name: "站内通知", Description: "向当前工作流所有者发送站内通知", Category: "flow", SideEffect: "write", WriteCost: 1, InputSchema: schemaWithFields([]string{"status", "title", "content"}, map[string]map[string]any{"status": notificationStatus, "title": inputField("string", "通知标题", "说明任务状态或需要用户处理的事项。", "例如：内容草稿已生成"), "content": inputField("string", "通知内容", "可引用上游输出；失败通知需配合失败后继续分支。", "例如：工作流已完成，请检查生成结果。"), "path": inputField("string", "站内跳转", "可选，只允许以 / 开头的 Valley 站内路径。", "例如：/notifications")}), OutputSchema: fields(field("notificationId", ValueTypeString), field("delivered", ValueTypeBoolean), field("status", ValueTypeString), field("path", ValueTypeString)), AIUsage: "需要在完成、失败后继续或进入审批前提醒当前用户时使用；失败即终止的节点不会继续执行通知"}, NotificationCapabilityAdapter{}},
	}
	for _, item := range definitions {
		if err := registry.RegisterCapability(item.definition, item.executor); err != nil {
			return err
		}
	}
	return nil
}

func (r *Registry) Executor(nodeType NodeType) NodeExecutor {
	if r == nil {
		return nil
	}
	return r.executors[nodeType]
}

func (r *Registry) Capability(id string) (ToolCapability, CapabilityExecutor, bool) {
	if r == nil {
		return ToolCapability{}, nil, false
	}
	registered, ok := r.capabilities[id]
	return registered.definition, registered.executor, ok
}

func (r *Registry) Supports(nodeType NodeType) bool {
	if r == nil {
		return false
	}
	_, ok := r.nodes[nodeType]
	return ok
}

func (r *Registry) NodeDefinitions() []NodeDefinition {
	result := make([]NodeDefinition, 0, len(r.nodes))
	for _, definition := range r.nodes {
		result = append(result, definition)
	}
	sort.Slice(result, func(i, j int) bool { return result[i].Type < result[j].Type })
	return result
}

func (r *Registry) ToolCapabilities() []ToolCapability {
	result := make([]ToolCapability, 0, len(r.capabilities))
	for _, capability := range r.capabilities {
		result = append(result, capability.definition)
	}
	sort.Slice(result, func(i, j int) bool { return result[i].ID < result[j].ID })
	return result
}

type outputField struct {
	name      string
	valueType ValueType
}

func field(name string, valueType ValueType) outputField {
	return outputField{name: name, valueType: valueType}
}
func fields(values ...outputField) map[string]ValueType {
	result := make(map[string]ValueType, len(values))
	for _, value := range values {
		result[value.name] = value.valueType
	}
	return result
}
func schema(required []string, properties map[string]string) map[string]any {
	props := make(map[string]any, len(properties))
	for name, valueType := range properties {
		props[name] = map[string]any{"type": valueType}
	}
	return map[string]any{"type": "object", "required": required, "properties": props}
}

func inputField(valueType, title, description, placeholder string) map[string]any {
	return map[string]any{
		"type":        valueType,
		"title":       title,
		"description": description,
		"placeholder": placeholder,
	}
}

func schemaWithFields(required []string, properties map[string]map[string]any) map[string]any {
	props := make(map[string]any, len(properties))
	for name, property := range properties {
		props[name] = property
	}
	return map[string]any{"type": "object", "required": required, "properties": props}
}
