package workflow

import (
	"fmt"
	"sort"
)

const (
	CapabilityParseMarkdown   = "content.parseMarkdown"
	CapabilityKnowledge       = "knowledge.retrieve"
	CapabilityContentSearch   = "content.search"
	CapabilityNotionSearch    = "notion.search"
	CapabilityGenerateCover   = "image.generateCover"
	CapabilityCreateBlogDraft = "blog.createDraft"
)

type NodeDefinition struct {
	Type         NodeType       `json:"type"`
	Label        string         `json:"label"`
	Description  string         `json:"description"`
	Category     string         `json:"category"`
	InputPorts   []string       `json:"inputPorts"`
	OutputPorts  []string       `json:"outputPorts"`
	WhenAllowed  bool           `json:"whenAllowed"`
	ConfigSchema map[string]any `json:"configSchema"`
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
	nodes        map[NodeType]NodeDefinition
	executors    map[NodeType]NodeExecutor
	capabilities map[string]capabilityRegistration
}

func DefaultRegistry() *Registry {
	required := func(names ...string) map[string]any {
		return map[string]any{"type": "object", "required": names}
	}
	registry := NewRegistry(
		NodeDefinition{Type: NodeTypeStart, Label: "开始", Description: "声明工作流输入", Category: "flow", OutputPorts: []string{"output"}, ConfigSchema: required("inputs")},
		NodeDefinition{Type: NodeTypeEnd, Label: "结束", Description: "返回工作流输出", Category: "flow", InputPorts: []string{"input"}, ConfigSchema: required("outputs")},
		NodeDefinition{Type: NodeTypeLLM, Label: "大模型", Description: "使用已选文本模型生成内容", Category: "model", InputPorts: []string{"input"}, OutputPorts: []string{"output"}, WhenAllowed: true, ConfigSchema: required("prompt")},
		NodeDefinition{Type: NodeTypeTool, Label: "工具", Description: "调用白名单业务能力", Category: "tool", InputPorts: []string{"input"}, OutputPorts: []string{"output"}, WhenAllowed: true, ConfigSchema: required("capabilityId", "inputs")},
		NodeDefinition{Type: NodeTypeCondition, Label: "条件", Description: "按受控规则选择分支", Category: "flow", InputPorts: []string{"input"}, OutputPorts: []string{"true", "false"}, ConfigSchema: required("left", "operator")},
		NodeDefinition{Type: NodeTypeSwitch, Label: "选择器", Description: "根据结构化字段选择一条路径", Category: "flow", InputPorts: []string{"input"}, OutputPorts: []string{"case:*", "default"}, ConfigSchema: required("value", "valueType", "cases")},
		NodeDefinition{Type: NodeTypeMerge, Label: "合并", Description: "从已执行分支选择首个可用值", Category: "flow", InputPorts: []string{"input"}, OutputPorts: []string{"output"}, ConfigSchema: required("fields")},
		NodeDefinition{Type: NodeTypeVariable, Label: "变量", Description: "设置可复用变量", Category: "flow", InputPorts: []string{"input"}, OutputPorts: []string{"output"}, WhenAllowed: true, ConfigSchema: required("assignments")},
		NodeDefinition{Type: NodeTypeSubworkflow, Label: "子工作流", Description: "调用已发布的不可变工作流版本", Category: "subworkflow", InputPorts: []string{"input"}, OutputPorts: []string{"output"}, WhenAllowed: true, ConfigSchema: required("workflowId", "versionId", "inputs")},
		NodeDefinition{Type: NodeTypeIntent, Label: "意图识别", Description: "按已配置意图将文本分流", Category: "logic", InputPorts: []string{"input"}, OutputPorts: []string{"intent:*", "intent:other"}, ConfigSchema: required("query", "intents")},
		NodeDefinition{Type: NodeTypeLoop, Label: "循环", Description: "重复执行循环体子流程", Category: "flow", InputPorts: []string{"input"}, OutputPorts: []string{"output"}, ConfigSchema: required("mode", "body", "outputs")},
		NodeDefinition{Type: NodeTypeSetLoopVar, Label: "设置循环变量", Description: "更新下一轮循环使用的中间变量", Category: "flow", ConfigSchema: required("name", "value")},
		NodeDefinition{Type: NodeTypeContinueLoop, Label: "继续循环", Description: "结束当前轮循环", Category: "flow", ConfigSchema: required()},
		NodeDefinition{Type: NodeTypeTerminateLoop, Label: "终止循环", Description: "结束整个循环", Category: "flow", ConfigSchema: required()},
	)
	for _, executor := range []NodeExecutor{startExecutor{}, endExecutor{}, ConditionExecutor{}, SwitchExecutor{}, MergeExecutor{}, VariableExecutor{}, SubworkflowExecutor{}, IntentClassifierExecutor{}, LLMTextExecutor{}, ToolNodeExecutor{Registry: registry}, LoopExecutor{Registry: registry}} {
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
	definitions := []struct {
		definition ToolCapability
		executor   CapabilityExecutor
	}{
		{ToolCapability{ID: CapabilityParseMarkdown, Name: "解析 Markdown", Description: "解析 Markdown 标题、正文和 Front Matter", Category: "content", SideEffect: "none", InputSchema: schemaWithFields([]string{"fileInput"}, map[string]map[string]any{"fileInput": inputField("file", "Markdown 文件", "选择开始节点上传的 Markdown 文件。", "选择 Markdown 文件变量")}), OutputSchema: fields(field("title", ValueTypeString), field("content", ValueTypeString), field("excerpt", ValueTypeString), field("frontMatter", ValueTypeObject), field("cover", ValueTypeObject), field("tagNames", ValueTypeStringList)), AIUsage: "需要解析上传的 Markdown 文件时使用"}, ParseMarkdownCapabilityAdapter{}},
		{ToolCapability{ID: CapabilityKnowledge, Name: "知识库检索", Description: "检索当前工作流绑定的私有资料库", Category: "knowledge", SideEffect: "read", InputSchema: schemaWithFields([]string{"query"}, map[string]map[string]any{"query": inputField("string", "检索问题", "描述希望从知识库中找到的信息。", "例如：介绍 AI 工作流的最佳实践")}), OutputSchema: fields(field("context", ValueTypeString), field("references", ValueTypeObject)), AIUsage: "需要引用用户私有知识时使用"}, KnowledgeRetrieveCapabilityAdapter{}},
		{ToolCapability{ID: CapabilityContentSearch, Name: "搜索内容", Description: "搜索当前用户的博客和资源", Category: "content", SideEffect: "read", InputSchema: schemaWithFields(nil, map[string]map[string]any{"query": inputField("string", "关键词", "按标题、正文或资源内容搜索。", "例如：AI 工作流"), "createdFrom": inputField("string", "开始日期", "可选，限定创建日期下限。", "例如：2026-07-01"), "createdTo": inputField("string", "结束日期", "可选，限定创建日期上限。", "例如：2026-07-31")}), OutputSchema: fields(field("count", ValueTypeNumber), field("items", ValueTypeObject)), AIUsage: "需要搜索用户已有内容时使用"}, ContentSearchCapabilityAdapter{}},
		{ToolCapability{ID: CapabilityNotionSearch, Name: "搜索 Notion", Description: "搜索已连接工作区中的页面和数据源", Category: "tool", SideEffect: "read", InputSchema: schemaWithFields([]string{"query"}, map[string]map[string]any{"query": inputField("string", "搜索关键词", "仅搜索当前已连接 Notion 工作区。", "例如：项目计划"), "limit": inputField("number", "结果数量", "可选，返回 1 到 10 条结果，默认 5 条。", "5")}), OutputSchema: fields(field("count", ValueTypeNumber), field("results", ValueTypeObject)), AIUsage: "需要查找当前用户已授权的 Notion 页面或数据源时使用；只读，不创建或修改 Notion 内容"}, NotionSearchCapabilityAdapter{}},
		{ToolCapability{ID: CapabilityGenerateCover, Name: "生成封面", Description: "根据标题和摘要生成博客封面", Category: "image", SideEffect: "model_and_storage", ModelCost: 1, InputSchema: schemaWithFields([]string{"title"}, map[string]map[string]any{"title": inputField("string", "封面标题", "概括封面要表达的主题。", "例如：AI 工作流封面测试"), "summary": inputField("string", "画面摘要", "补充画面应传达的主体和场景。", "例如：展示一条从开始到结束的自动化内容创作流程"), "style": inputField("string", "视觉风格", "描述构图、风格和限制。", "例如：简洁蓝紫科技插画，抽象工作流节点与连线，无文字")}), OutputSchema: fields(field("imageUrl", ValueTypeString), field("cover", ValueTypeObject), field("url", ValueTypeString), field("model", ValueTypeString), field("size", ValueTypeString)), AIUsage: "生成封面时使用；默认直接执行，需要时可在节点生成条件中绑定上游布尔变量"}, CoverGenerateCapabilityAdapter{}},
		{ToolCapability{ID: CapabilityCreateBlogDraft, Name: "创建博客草稿", Description: "为当前用户创建博客草稿", Category: "content", SideEffect: "write", WriteCost: 1, InputSchema: schemaWithFields([]string{"title", "content", "tags", "tagMode", "visibility"}, map[string]map[string]any{"title": inputField("string", "草稿标题", "文章展示的主标题。", "例如：用 AI 工作流自动生成内容"), "content": inputField("string", "文章正文", "要保存到草稿的 Markdown 正文。", "例如：## 开始\n\n这是正文内容。"), "excerpt": inputField("string", "摘要", "可选，用于列表页的简短介绍。", "例如：用一条工作流完成内容创作。"), "cover": inputField("object", "封面", "可选，绑定生成封面的 cover 输出。", "选择生成封面 · cover"), "tags": inputField("string[]", "标签", "文章标签名称列表。", "例如：AI, 工作流"), "suggestedTags": inputField("string[]", "推荐标签", "可选，使用上游给出的标签建议。", "选择解析 Markdown · tagNames"), "tagMode": inputField("string", "标签模式", "选择手动标签或使用推荐标签。", "例如：manual"), "visibility": inputField("string", "可见范围", "保存后的默认访问范围。", "例如：private")}), OutputSchema: fields(field("postId", ValueTypeString), field("title", ValueTypeString), field("editPath", ValueTypeString), field("tagIds", ValueTypeStringList)), AIUsage: "只创建草稿，永不自动发布"}, BlogCreateDraftCapabilityAdapter{}},
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
