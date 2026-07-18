package workflow

import (
	"fmt"
	"sort"
)

const (
	CapabilityParseMarkdown   = "content.parseMarkdown"
	CapabilityKnowledge       = "knowledge.retrieve"
	CapabilityContentSearch   = "content.search"
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
		NodeDefinition{Type: NodeTypeLLM, Label: "大模型", Description: "使用受控模型生成文本", Category: "model", InputPorts: []string{"input"}, OutputPorts: []string{"output"}, WhenAllowed: true, ConfigSchema: required("prompt")},
		NodeDefinition{Type: NodeTypeTool, Label: "工具", Description: "调用白名单业务能力", Category: "tool", InputPorts: []string{"input"}, OutputPorts: []string{"output"}, WhenAllowed: true, ConfigSchema: required("capabilityId", "inputs")},
		NodeDefinition{Type: NodeTypeCondition, Label: "条件", Description: "按受控规则选择分支", Category: "flow", InputPorts: []string{"input"}, OutputPorts: []string{"true", "false"}, ConfigSchema: required("left", "operator")},
		NodeDefinition{Type: NodeTypeMerge, Label: "合并", Description: "从已执行分支选择首个可用值", Category: "flow", InputPorts: []string{"input"}, OutputPorts: []string{"output"}, ConfigSchema: required("fields")},
		NodeDefinition{Type: NodeTypeVariable, Label: "变量", Description: "设置可复用变量", Category: "flow", InputPorts: []string{"input"}, OutputPorts: []string{"output"}, WhenAllowed: true, ConfigSchema: required("assignments")},
		NodeDefinition{Type: NodeTypeSubworkflow, Label: "子工作流", Description: "调用已发布的不可变工作流版本", Category: "subworkflow", InputPorts: []string{"input"}, OutputPorts: []string{"output"}, WhenAllowed: true, ConfigSchema: required("workflowId", "versionId", "inputs")},
	)
	for _, executor := range []NodeExecutor{startExecutor{}, endExecutor{}, ConditionExecutor{}, MergeExecutor{}, VariableExecutor{}, SubworkflowExecutor{}, LLMTextExecutor{}, ToolNodeExecutor{Registry: registry}} {
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
		{ToolCapability{ID: CapabilityParseMarkdown, Name: "解析 Markdown", Description: "解析 Markdown 标题、正文和 Front Matter", Category: "content", SideEffect: "none", InputSchema: schema([]string{"fileInput"}, map[string]string{"fileInput": "file"}), OutputSchema: fields(field("title", ValueTypeString), field("content", ValueTypeString), field("excerpt", ValueTypeString), field("frontMatter", ValueTypeObject), field("cover", ValueTypeObject), field("tagNames", ValueTypeStringList)), AIUsage: "需要解析上传的 Markdown 文件时使用"}, ParseMarkdownCapabilityAdapter{}},
		{ToolCapability{ID: CapabilityKnowledge, Name: "知识库检索", Description: "检索当前工作流绑定的私有资料库", Category: "knowledge", SideEffect: "read", InputSchema: schema([]string{"query"}, map[string]string{"query": "string"}), OutputSchema: fields(field("context", ValueTypeString), field("references", ValueTypeObject)), AIUsage: "需要引用用户私有知识时使用"}, KnowledgeRetrieveCapabilityAdapter{}},
		{ToolCapability{ID: CapabilityContentSearch, Name: "搜索内容", Description: "搜索当前用户的博客和资源", Category: "content", SideEffect: "read", InputSchema: schema(nil, map[string]string{"query": "string", "createdFrom": "string", "createdTo": "string"}), OutputSchema: fields(field("count", ValueTypeNumber), field("items", ValueTypeObject)), AIUsage: "需要搜索用户已有内容时使用"}, ContentSearchCapabilityAdapter{}},
		{ToolCapability{ID: CapabilityGenerateCover, Name: "生成封面", Description: "根据标题和摘要生成博客封面", Category: "image", SideEffect: "model_and_storage", ModelCost: 1, InputSchema: schema([]string{"title"}, map[string]string{"title": "string", "summary": "string", "style": "string"}), OutputSchema: fields(field("cover", ValueTypeObject), field("url", ValueTypeString), field("model", ValueTypeString), field("size", ValueTypeString)), AIUsage: "生成封面时使用；可通过节点 when 受 Start boolean 控制，不要额外创建 Condition"}, CoverGenerateCapabilityAdapter{}},
		{ToolCapability{ID: CapabilityCreateBlogDraft, Name: "创建博客草稿", Description: "为当前用户创建博客草稿", Category: "content", SideEffect: "write", WriteCost: 1, InputSchema: schema([]string{"title", "content", "tags", "tagMode", "visibility"}, map[string]string{"title": "string", "content": "string", "excerpt": "string", "cover": "object", "tags": "string[]", "suggestedTags": "string[]", "tagMode": "string", "visibility": "string"}), OutputSchema: fields(field("postId", ValueTypeString), field("title", ValueTypeString), field("editPath", ValueTypeString), field("tagIds", ValueTypeStringList)), AIUsage: "只创建草稿，永不自动发布"}, BlogCreateDraftCapabilityAdapter{}},
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
