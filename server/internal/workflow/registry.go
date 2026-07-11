package workflow

import (
	"fmt"
)

type NodeDefinition struct {
	Type         NodeType
	InputPorts   map[string]struct{}
	OutputPorts  map[string]struct{}
	OutputFields map[string]ValueType
}

// Registry contains only server-defined node contracts. It does not accept
// user-provided functions, URLs, expressions, or executors.
type Registry struct {
	nodes     map[NodeType]NodeDefinition
	executors map[NodeType]NodeExecutor
}

func DefaultRegistry() *Registry {
	registry := NewRegistry(
		NodeDefinition{Type: NodeTypeStart, OutputPorts: ports("output"), OutputFields: outputFields(field("markdownFile", ValueTypeFile), field("tagIds", ValueTypeStringList), field("groupId", ValueTypeString), field("visibility", ValueTypeString))},
		NodeDefinition{Type: NodeTypeBlogParse, InputPorts: ports("input"), OutputPorts: ports("output"), OutputFields: outputFields(field("title", ValueTypeString), field("content", ValueTypeString), field("frontMatter", ValueTypeObject), field("excerpt", ValueTypeString), field("cover", ValueTypeObject), field("tagNames", ValueTypeStringList))},
		NodeDefinition{Type: NodeTypeLLMText, InputPorts: ports("input"), OutputPorts: ports("output"), OutputFields: outputFields(field("text", ValueTypeString), field("model", ValueTypeString), field("tokenUsage", ValueTypeNumber))},
		NodeDefinition{Type: NodeTypeBlogCreateDraft, InputPorts: ports("input"), OutputPorts: ports("output"), OutputFields: outputFields(field("postId", ValueTypeString), field("title", ValueTypeString), field("editPath", ValueTypeString), field("tagIds", ValueTypeStringList))},
		NodeDefinition{Type: NodeTypeEnd, InputPorts: ports("input"), OutputFields: outputFields()},
	)
	// Start and end are runtime primitives. All business executors are added by
	// the composition root after their dependencies have been assembled.
	_ = registry.RegisterExecutor(startExecutor{})
	_ = registry.RegisterExecutor(endExecutor{})
	return registry
}

// RegisterBlogWorkflowExecutors enables the server-reviewed blog nodes on a
// registry assembled by the composition root. Passing nil uses real ARK.
func RegisterBlogWorkflowExecutors(registry *Registry, generator TextGenerator) error {
	for _, executor := range []NodeExecutor{
		BlogParseExecutor{},
		LLMTextExecutor{Generator: generator},
		BlogCreateDraftExecutor{},
	} {
		if err := registry.RegisterExecutor(executor); err != nil {
			return err
		}
	}
	return nil
}

func NewRegistry(definitions ...NodeDefinition) *Registry {
	nodes := make(map[NodeType]NodeDefinition, len(definitions))
	for _, definition := range definitions {
		nodes[definition.Type] = definition
	}
	return &Registry{nodes: nodes, executors: make(map[NodeType]NodeExecutor)}
}

// RegisterExecutor binds an implementation to a node type already declared by
// this registry. An executor can never introduce an unreviewed node capability.
func (r *Registry) RegisterExecutor(executor NodeExecutor) error {
	if r == nil {
		return fmt.Errorf("工作流执行器注册表不能为空")
	}
	if executor == nil {
		return fmt.Errorf("工作流执行器不能为空")
	}
	nodeType := executor.Type()
	if !r.Supports(nodeType) {
		return fmt.Errorf("节点类型 %s 未在注册表中声明", nodeType)
	}
	if _, exists := r.executors[nodeType]; exists {
		return fmt.Errorf("节点类型 %s 的执行器已注册", nodeType)
	}
	r.executors[nodeType] = executor
	return nil
}

// Executor returns the implementation for a server-declared node type, or nil
// when that capability has not been enabled by the composition root.
func (r *Registry) Executor(nodeType NodeType) NodeExecutor {
	if r == nil {
		return nil
	}
	return r.executors[nodeType]
}

func (r *Registry) Supports(nodeType NodeType) bool {
	if r == nil {
		return false
	}
	_, ok := r.nodes[nodeType]
	return ok
}

func (r *Registry) HasOutputField(nodeType NodeType, field string) bool {
	if r == nil {
		return false
	}
	definition, ok := r.nodes[nodeType]
	if !ok {
		return false
	}
	_, ok = definition.OutputFields[field]
	return ok
}

func (r *Registry) OutputFieldType(nodeType NodeType, field string) (ValueType, bool) {
	if r == nil {
		return "", false
	}
	definition, ok := r.nodes[nodeType]
	if !ok {
		return "", false
	}
	fieldType, ok := definition.OutputFields[field]
	return fieldType, ok
}

func (r *Registry) HasInputPort(nodeType NodeType, port string) bool {
	if r == nil {
		return false
	}
	definition, ok := r.nodes[nodeType]
	if !ok {
		return false
	}
	_, ok = definition.InputPorts[port]
	return ok
}

func (r *Registry) HasOutputPort(nodeType NodeType, port string) bool {
	if r == nil {
		return false
	}
	definition, ok := r.nodes[nodeType]
	if !ok {
		return false
	}
	_, ok = definition.OutputPorts[port]
	return ok
}

func ports(names ...string) map[string]struct{} {
	result := make(map[string]struct{}, len(names))
	for _, name := range names {
		result[name] = struct{}{}
	}
	return result
}

type outputField struct {
	name      string
	valueType ValueType
}

func field(name string, valueType ValueType) outputField {
	return outputField{name: name, valueType: valueType}
}

func outputFields(values ...outputField) map[string]ValueType {
	result := make(map[string]ValueType, len(values))
	for _, value := range values {
		result[value.name] = value.valueType
	}
	return result
}
