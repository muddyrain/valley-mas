package workflow

import (
	"encoding/json"
	"fmt"
	"strings"
)

type OperationType string

const (
	OperationStartInputUpsert OperationType = "startInput.upsert"
	OperationStartInputRemove OperationType = "startInput.remove"
	OperationNodeInsert       OperationType = "node.insert"
	OperationNodeUpdate       OperationType = "node.update"
	OperationNodeRemove       OperationType = "node.remove"
	OperationEdgeConnect      OperationType = "edge.connect"
	OperationEdgeDisconnect   OperationType = "edge.disconnect"
)

type WorkflowOperation struct {
	Type         OperationType    `json:"type"`
	InputName    string           `json:"inputName,omitempty"`
	Input        *InputDefinition `json:"input,omitempty"`
	Node         *Node            `json:"node,omitempty"`
	NodeID       string           `json:"nodeId,omitempty"`
	AfterNodeID  string           `json:"afterNodeId,omitempty"`
	BeforeNodeID string           `json:"beforeNodeId,omitempty"`
	Patch        map[string]any   `json:"patch,omitempty"`
	Edge         *Edge            `json:"edge,omitempty"`
}

func ApplyOperations(base Graph, operations []WorkflowOperation, registry *Registry) (Graph, error) {
	if base.SchemaVersion != SchemaVersion {
		return Graph{}, fmt.Errorf("GRAPH_VERSION_UNSUPPORTED")
	}
	encoded, _ := json.Marshal(base)
	var graph Graph
	_ = json.Unmarshal(encoded, &graph)
	for index, operation := range operations {
		if err := applyOperation(&graph, operation); err != nil {
			return Graph{}, fmt.Errorf("操作 %d 无效: %w", index+1, err)
		}
	}
	if errs := ValidateGraph(graph, registry); len(errs) > 0 {
		return Graph{}, fmt.Errorf("候选工作流校验失败: %s", strings.Join(errs, "；"))
	}
	return graph, nil
}

func applyOperation(graph *Graph, operation WorkflowOperation) error {
	switch operation.Type {
	case OperationStartInputUpsert:
		if strings.TrimSpace(operation.InputName) == "" || operation.Input == nil {
			return fmt.Errorf("开始输入信息不完整")
		}
		index := findNodeIndex(graph.Nodes, "", NodeTypeStart)
		if index < 0 {
			return fmt.Errorf("开始节点不存在")
		}
		config, err := decodeConfig(graph.Nodes[index].Config)
		if err != nil {
			return err
		}
		inputs, _ := config["inputs"].(map[string]any)
		if inputs == nil {
			inputs = map[string]any{}
		}
		inputs[operation.InputName] = map[string]any{"type": operation.Input.Type, "required": operation.Input.Required}
		config["inputs"] = inputs
		graph.Nodes[index].Config, _ = json.Marshal(config)
	case OperationStartInputRemove:
		index := findNodeIndex(graph.Nodes, "", NodeTypeStart)
		if index < 0 {
			return fmt.Errorf("开始节点不存在")
		}
		config, err := decodeConfig(graph.Nodes[index].Config)
		if err != nil {
			return err
		}
		inputs, _ := config["inputs"].(map[string]any)
		delete(inputs, operation.InputName)
		config["inputs"] = inputs
		graph.Nodes[index].Config, _ = json.Marshal(config)
	case OperationNodeInsert:
		if operation.Node == nil || operation.Node.ID == "" {
			return fmt.Errorf("待插入节点不能为空")
		}
		if findNodeIndex(graph.Nodes, operation.Node.ID, "") >= 0 {
			return fmt.Errorf("节点 %s 已存在", operation.Node.ID)
		}
		if operation.AfterNodeID != "" && operation.BeforeNodeID != "" {
			return fmt.Errorf("不能同时指定 afterNodeId 和 beforeNodeId")
		}
		graph.Nodes = append(graph.Nodes, *operation.Node)
		if operation.AfterNodeID != "" {
			return insertAfter(graph, operation.AfterNodeID, operation.Node.ID)
		}
		if operation.BeforeNodeID != "" {
			return insertBefore(graph, operation.BeforeNodeID, operation.Node.ID)
		}
	case OperationNodeUpdate:
		index := findNodeIndex(graph.Nodes, operation.NodeID, "")
		if index < 0 {
			return fmt.Errorf("节点 %s 不存在", operation.NodeID)
		}
		if label, ok := operation.Patch["label"].(string); ok {
			graph.Nodes[index].Label = label
		}
		if when, exists := operation.Patch["when"]; exists {
			encoded, _ := json.Marshal(when)
			if string(encoded) == "null" {
				graph.Nodes[index].When = nil
			} else {
				var rule Rule
				if err := json.Unmarshal(encoded, &rule); err != nil {
					return err
				}
				graph.Nodes[index].When = &rule
			}
		}
		if configPatch, ok := operation.Patch["config"].(map[string]any); ok {
			config, err := decodeConfig(graph.Nodes[index].Config)
			if err != nil {
				return err
			}
			mergeMap(config, configPatch)
			graph.Nodes[index].Config, _ = json.Marshal(config)
		}
	case OperationNodeRemove:
		index := findNodeIndex(graph.Nodes, operation.NodeID, "")
		if index < 0 {
			return fmt.Errorf("节点 %s 不存在", operation.NodeID)
		}
		if graph.Nodes[index].Type == NodeTypeStart || graph.Nodes[index].Type == NodeTypeEnd {
			return fmt.Errorf("不能删除开始或结束节点")
		}
		incoming, outgoing := []Edge{}, []Edge{}
		remaining := graph.Edges[:0]
		for _, edge := range graph.Edges {
			if edge.Target == operation.NodeID {
				incoming = append(incoming, edge)
				continue
			}
			if edge.Source == operation.NodeID {
				outgoing = append(outgoing, edge)
				continue
			}
			remaining = append(remaining, edge)
		}
		graph.Edges = remaining
		graph.Nodes = append(graph.Nodes[:index], graph.Nodes[index+1:]...)
		if len(incoming) == 1 && len(outgoing) == 1 {
			graph.Edges = append(graph.Edges, Edge{Source: incoming[0].Source, SourceHandle: incoming[0].SourceHandle, Target: outgoing[0].Target, TargetHandle: outgoing[0].TargetHandle})
		}
	case OperationEdgeConnect:
		if operation.Edge == nil {
			return fmt.Errorf("连线不能为空")
		}
		graph.Edges = append(graph.Edges, *operation.Edge)
	case OperationEdgeDisconnect:
		if operation.Edge == nil {
			return fmt.Errorf("连线不能为空")
		}
		found := false
		remaining := graph.Edges[:0]
		for _, edge := range graph.Edges {
			if sameEdge(edge, *operation.Edge) {
				found = true
				continue
			}
			remaining = append(remaining, edge)
		}
		if !found {
			return fmt.Errorf("连线不存在")
		}
		graph.Edges = remaining
	default:
		return fmt.Errorf("不支持的操作类型 %s", operation.Type)
	}
	return nil
}

func insertAfter(graph *Graph, sourceID, newID string) error {
	if findNodeIndex(graph.Nodes, sourceID, "") < 0 {
		return fmt.Errorf("节点 %s 不存在", sourceID)
	}
	matches := []int{}
	for index, edge := range graph.Edges {
		if edge.Source == sourceID {
			matches = append(matches, index)
		}
	}
	if len(matches) != 1 {
		return fmt.Errorf("节点 %s 的后继不唯一，请先澄清插入位置", sourceID)
	}
	edge := graph.Edges[matches[0]]
	graph.Edges[matches[0]] = Edge{Source: sourceID, SourceHandle: edge.SourceHandle, Target: newID, TargetHandle: "input"}
	graph.Edges = append(graph.Edges, Edge{Source: newID, SourceHandle: "output", Target: edge.Target, TargetHandle: edge.TargetHandle})
	return nil
}

func insertBefore(graph *Graph, targetID, newID string) error {
	if findNodeIndex(graph.Nodes, targetID, "") < 0 {
		return fmt.Errorf("节点 %s 不存在", targetID)
	}
	matches := []int{}
	for index, edge := range graph.Edges {
		if edge.Target == targetID {
			matches = append(matches, index)
		}
	}
	if len(matches) != 1 {
		return fmt.Errorf("节点 %s 的前驱不唯一，请先澄清插入位置", targetID)
	}
	edge := graph.Edges[matches[0]]
	graph.Edges[matches[0]] = Edge{Source: edge.Source, SourceHandle: edge.SourceHandle, Target: newID, TargetHandle: "input"}
	graph.Edges = append(graph.Edges, Edge{Source: newID, SourceHandle: "output", Target: targetID, TargetHandle: edge.TargetHandle})
	return nil
}

func findNodeIndex(nodes []Node, id string, nodeType NodeType) int {
	for index, node := range nodes {
		if (id != "" && node.ID == id) || (nodeType != "" && node.Type == nodeType) {
			return index
		}
	}
	return -1
}
func sameEdge(left, right Edge) bool {
	return left.Source == right.Source && left.Target == right.Target && left.SourceHandle == right.SourceHandle && left.TargetHandle == right.TargetHandle
}
func mergeMap(target, patch map[string]any) {
	for key, value := range patch {
		if nested, ok := value.(map[string]any); ok {
			current, _ := target[key].(map[string]any)
			if current == nil {
				current = map[string]any{}
			}
			mergeMap(current, nested)
			target[key] = current
		} else {
			target[key] = value
		}
	}
}
