package workflow

import (
	"encoding/json"
	"fmt"
	"reflect"
	"sort"
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
	Index        *int             `json:"index,omitempty"`
	InputName    string           `json:"inputName,omitempty"`
	Input        *InputDefinition `json:"input,omitempty"`
	Node         *Node            `json:"node,omitempty"`
	NodeID       string           `json:"nodeId,omitempty"`
	AfterNodeID  string           `json:"afterNodeId,omitempty"`
	BeforeNodeID string           `json:"beforeNodeId,omitempty"`
	Patch        map[string]any   `json:"patch,omitempty"`
	Edge         *Edge            `json:"edge,omitempty"`
}

type OperationConflict struct {
	Path   string `json:"path"`
	Reason string `json:"reason"`
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

// MergeOperations applies operations generated from base onto latest when none
// of the fields or structural anchors touched by those operations changed in
// the meantime. It never falls back to replacing latest with a full candidate.
func MergeOperations(base, latest Graph, operations []WorkflowOperation, registry *Registry) (Graph, []OperationConflict, error) {
	if _, err := ApplyOperations(base, operations, registry); err != nil {
		return Graph{}, nil, err
	}
	paths := operationTouchedPaths(base, operations)
	conflicts := make([]OperationConflict, 0)
	for _, path := range paths {
		baseValue := operationPathValue(base, path)
		latestValue := operationPathValue(latest, path)
		if !reflect.DeepEqual(baseValue, latestValue) {
			conflicts = append(conflicts, OperationConflict{Path: path, Reason: "changed_since_task_started"})
		}
	}
	if len(conflicts) > 0 {
		return latest, conflicts, nil
	}
	merged, err := ApplyOperations(latest, operations, registry)
	if err != nil {
		return Graph{}, nil, err
	}
	return merged, nil, nil
}

// BuildInverseOperations returns one atomic inverse operation sequence. The
// caller must still perform a conflict-aware merge against the graph revision
// produced by the forward operations before persisting a revert.
func BuildInverseOperations(base Graph, operations []WorkflowOperation, registry *Registry) ([]WorkflowOperation, error) {
	if _, err := ApplyOperations(base, operations, registry); err != nil {
		return nil, err
	}
	current := cloneGraph(base)
	groups := make([][]WorkflowOperation, 0, len(operations))
	for index, operation := range operations {
		inverse, err := inverseOperation(current, operation)
		if err != nil {
			return nil, fmt.Errorf("操作 %d 无法生成撤销: %w", index+1, err)
		}
		if err := applyOperation(&current, operation); err != nil {
			return nil, fmt.Errorf("操作 %d 无效: %w", index+1, err)
		}
		groups = append(groups, inverse)
	}
	inverse := make([]WorkflowOperation, 0, len(operations))
	for index := len(groups) - 1; index >= 0; index-- {
		inverse = append(inverse, groups[index]...)
	}
	return inverse, nil
}

func cloneGraph(base Graph) Graph {
	encoded, _ := json.Marshal(base)
	var cloned Graph
	_ = json.Unmarshal(encoded, &cloned)
	return cloned
}

func inverseOperation(graph Graph, operation WorkflowOperation) ([]WorkflowOperation, error) {
	switch operation.Type {
	case OperationStartInputUpsert:
		index := findNodeIndex(graph.Nodes, "", NodeTypeStart)
		if index < 0 {
			return nil, fmt.Errorf("开始节点不存在")
		}
		config, err := decodeConfig(graph.Nodes[index].Config)
		if err != nil {
			return nil, err
		}
		inputs, _ := config["inputs"].(map[string]any)
		if previous, exists := inputs[operation.InputName]; exists {
			encoded, _ := json.Marshal(previous)
			var definition InputDefinition
			if err := json.Unmarshal(encoded, &definition); err != nil {
				return nil, err
			}
			return []WorkflowOperation{{Type: OperationStartInputUpsert, InputName: operation.InputName, Input: &definition}}, nil
		}
		return []WorkflowOperation{{Type: OperationStartInputRemove, InputName: operation.InputName}}, nil
	case OperationStartInputRemove:
		index := findNodeIndex(graph.Nodes, "", NodeTypeStart)
		if index < 0 {
			return nil, fmt.Errorf("开始节点不存在")
		}
		config, err := decodeConfig(graph.Nodes[index].Config)
		if err != nil {
			return nil, err
		}
		inputs, _ := config["inputs"].(map[string]any)
		previous, exists := inputs[operation.InputName]
		if !exists {
			return nil, fmt.Errorf("开始输入 %s 不存在", operation.InputName)
		}
		encoded, _ := json.Marshal(previous)
		var definition InputDefinition
		if err := json.Unmarshal(encoded, &definition); err != nil {
			return nil, err
		}
		return []WorkflowOperation{{Type: OperationStartInputUpsert, InputName: operation.InputName, Input: &definition}}, nil
	case OperationNodeInsert:
		if operation.Node == nil {
			return nil, fmt.Errorf("待插入节点不能为空")
		}
		return []WorkflowOperation{{Type: OperationNodeRemove, NodeID: operation.Node.ID}}, nil
	case OperationNodeUpdate:
		index := findNodeIndex(graph.Nodes, operation.NodeID, "")
		if index < 0 {
			return nil, fmt.Errorf("节点 %s 不存在", operation.NodeID)
		}
		node := graph.Nodes[index]
		patch := map[string]any{}
		if _, exists := operation.Patch["label"]; exists {
			patch["label"] = node.Label
		}
		if _, exists := operation.Patch["position"]; exists {
			patch["position"] = map[string]any{"x": node.Position.X, "y": node.Position.Y}
		}
		if _, exists := operation.Patch["when"]; exists {
			patch["when"] = node.When
		}
		if configPatch, ok := operation.Patch["config"].(map[string]any); ok {
			config, err := decodeConfig(node.Config)
			if err != nil {
				return nil, err
			}
			patch["config"] = inverseMap(config, configPatch)
		}
		return []WorkflowOperation{{Type: OperationNodeUpdate, NodeID: operation.NodeID, Patch: patch}}, nil
	case OperationNodeRemove:
		index := findNodeIndex(graph.Nodes, operation.NodeID, "")
		if index < 0 {
			return nil, fmt.Errorf("节点 %s 不存在", operation.NodeID)
		}
		node := graph.Nodes[index]
		incoming, outgoing := incidentEdges(graph, operation.NodeID)
		inverse := []WorkflowOperation{{Type: OperationNodeInsert, Index: &index, Node: &node}}
		if len(incoming) == 1 && len(outgoing) == 1 {
			bridge := Edge{Source: incoming[0].Source, SourceHandle: incoming[0].SourceHandle, Target: outgoing[0].Target, TargetHandle: outgoing[0].TargetHandle}
			inverse = append(inverse, WorkflowOperation{Type: OperationEdgeDisconnect, Edge: &bridge})
		}
		for edgeIndex := range incoming {
			edge := incoming[edgeIndex]
			inverse = append(inverse, WorkflowOperation{Type: OperationEdgeConnect, Edge: &edge})
		}
		for edgeIndex := range outgoing {
			edge := outgoing[edgeIndex]
			inverse = append(inverse, WorkflowOperation{Type: OperationEdgeConnect, Edge: &edge})
		}
		return inverse, nil
	case OperationEdgeConnect:
		if operation.Edge == nil {
			return nil, fmt.Errorf("连线不能为空")
		}
		edge := *operation.Edge
		return []WorkflowOperation{{Type: OperationEdgeDisconnect, Edge: &edge}}, nil
	case OperationEdgeDisconnect:
		if operation.Edge == nil {
			return nil, fmt.Errorf("连线不能为空")
		}
		edge := *operation.Edge
		return []WorkflowOperation{{Type: OperationEdgeConnect, Edge: &edge}}, nil
	default:
		return nil, fmt.Errorf("不支持的操作类型 %s", operation.Type)
	}
}

func inverseMap(current, patch map[string]any) map[string]any {
	inverse := make(map[string]any, len(patch))
	for key, value := range patch {
		if nestedPatch, ok := value.(map[string]any); ok {
			nestedCurrent, _ := current[key].(map[string]any)
			if nestedCurrent == nil {
				nestedCurrent = map[string]any{}
			}
			inverse[key] = inverseMap(nestedCurrent, nestedPatch)
			continue
		}
		if previous, exists := current[key]; exists {
			inverse[key] = previous
		} else {
			inverse[key] = nil
		}
	}
	return inverse
}

func incidentEdges(graph Graph, nodeID string) ([]Edge, []Edge) {
	incoming := []Edge{}
	outgoing := []Edge{}
	for _, edge := range graph.Edges {
		if edge.Target == nodeID {
			incoming = append(incoming, edge)
		}
		if edge.Source == nodeID {
			outgoing = append(outgoing, edge)
		}
	}
	return incoming, outgoing
}

func operationTouchedPaths(base Graph, operations []WorkflowOperation) []string {
	paths := map[string]struct{}{}
	for _, operation := range operations {
		switch operation.Type {
		case OperationStartInputUpsert, OperationStartInputRemove:
			paths["node:start/config/inputs/"+escapeOperationPath(operation.InputName)] = struct{}{}
		case OperationNodeInsert:
			if operation.Node != nil {
				paths["node:"+operation.Node.ID] = struct{}{}
			}
			if operation.AfterNodeID != "" {
				paths["outgoing:"+operation.AfterNodeID] = struct{}{}
			}
			if operation.BeforeNodeID != "" {
				paths["incoming:"+operation.BeforeNodeID] = struct{}{}
			}
		case OperationNodeUpdate:
			prefix := "node:" + operation.NodeID
			if _, exists := operation.Patch["label"]; exists {
				paths[prefix+"/label"] = struct{}{}
			}
			if _, exists := operation.Patch["position"]; exists {
				paths[prefix+"/position"] = struct{}{}
			}
			if _, exists := operation.Patch["when"]; exists {
				paths[prefix+"/when"] = struct{}{}
			}
			if configPatch, ok := operation.Patch["config"].(map[string]any); ok {
				collectMapPaths(paths, prefix+"/config", configPatch)
			}
		case OperationNodeRemove:
			paths["node:"+operation.NodeID] = struct{}{}
			paths["incoming:"+operation.NodeID] = struct{}{}
			paths["outgoing:"+operation.NodeID] = struct{}{}
		case OperationEdgeConnect, OperationEdgeDisconnect:
			if operation.Edge != nil {
				paths[canonicalEdgePath(*operation.Edge)] = struct{}{}
			}
		}
	}
	result := make([]string, 0, len(paths))
	for path := range paths {
		result = append(result, path)
	}
	sort.Strings(result)
	return result
}

func collectMapPaths(paths map[string]struct{}, prefix string, value map[string]any) {
	for key, item := range value {
		path := prefix + "/" + escapeOperationPath(key)
		if nested, ok := item.(map[string]any); ok {
			collectMapPaths(paths, path, nested)
		} else {
			paths[path] = struct{}{}
		}
	}
}

func escapeOperationPath(value string) string {
	return strings.ReplaceAll(strings.ReplaceAll(value, "~", "~0"), "/", "~1")
}

func unescapeOperationPath(value string) string {
	return strings.ReplaceAll(strings.ReplaceAll(value, "~1", "/"), "~0", "~")
}

func canonicalEdgePath(edge Edge) string {
	return fmt.Sprintf("edge:%s|%s->%s|%s", edge.Source, edge.SourceHandle, edge.Target, edge.TargetHandle)
}

func operationPathValue(graph Graph, path string) any {
	if strings.HasPrefix(path, "incoming:") || strings.HasPrefix(path, "outgoing:") {
		parts := strings.SplitN(path, ":", 2)
		edges := []string{}
		for _, edge := range graph.Edges {
			if (parts[0] == "incoming" && edge.Target == parts[1]) || (parts[0] == "outgoing" && edge.Source == parts[1]) {
				edges = append(edges, canonicalEdgePath(edge))
			}
		}
		sort.Strings(edges)
		return edges
	}
	if strings.HasPrefix(path, "edge:") {
		for _, edge := range graph.Edges {
			if canonicalEdgePath(edge) == path {
				return path
			}
		}
		return nil
	}
	if !strings.HasPrefix(path, "node:") {
		return nil
	}
	parts := strings.Split(path, "/")
	nodeID := strings.TrimPrefix(parts[0], "node:")
	index := findNodeIndex(graph.Nodes, nodeID, "")
	if index < 0 {
		return nil
	}
	node := graph.Nodes[index]
	if len(parts) == 1 {
		config, _ := decodeConfig(node.Config)
		return map[string]any{"id": node.ID, "type": node.Type, "label": node.Label, "position": node.Position, "config": config, "when": node.When}
	}
	switch parts[1] {
	case "label":
		return node.Label
	case "position":
		return node.Position
	case "when":
		return node.When
	case "config":
		config, _ := decodeConfig(node.Config)
		var current any = config
		for _, part := range parts[2:] {
			object, ok := current.(map[string]any)
			if !ok {
				return nil
			}
			current, ok = object[unescapeOperationPath(part)]
			if !ok {
				return nil
			}
		}
		return current
	default:
		return nil
	}
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
		if operation.Index != nil && *operation.Index >= 0 && *operation.Index <= len(graph.Nodes) {
			graph.Nodes = append(graph.Nodes, Node{})
			copy(graph.Nodes[*operation.Index+1:], graph.Nodes[*operation.Index:])
			graph.Nodes[*operation.Index] = *operation.Node
		} else {
			graph.Nodes = append(graph.Nodes, *operation.Node)
		}
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
		if position, exists := operation.Patch["position"]; exists {
			encoded, _ := json.Marshal(position)
			var next Position
			if err := json.Unmarshal(encoded, &next); err != nil {
				return err
			}
			graph.Nodes[index].Position = next
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
		if value == nil {
			delete(target, key)
			continue
		}
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
