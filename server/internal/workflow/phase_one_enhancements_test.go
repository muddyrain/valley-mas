package workflow

import (
	"context"
	"encoding/json"
	"strings"
	"testing"
)

func TestSafeVariableExecutorSupportsDynamicOutput(t *testing.T) {
	registry := DefaultRegistry()
	if err := RegisterSafeVariableExecutor(registry); err != nil {
		t.Fatalf("RegisterSafeVariableExecutor() error = %v", err)
	}
	graph := Graph{
		SchemaVersion: 2,
		Nodes: []Node{
			{ID: "start", Type: NodeTypeStart, Config: json.RawMessage(`{"inputs":{"topic":{"type":"string","required":true}}}`)},
			{ID: "label", Type: NodeTypeVariable, Config: json.RawMessage(`{"variableName":"summary","valueExpression":"主题：{{start.output.topic}}"}`)},
			{ID: "end", Type: NodeTypeEnd, Config: json.RawMessage(`{"outputs":{"text":"{{label.output.summary}}"}}`)},
		},
		Edges: []Edge{
			{Source: "start", SourceHandle: "output", Target: "label", TargetHandle: "input"},
			{Source: "label", SourceHandle: "output", Target: "end", TargetHandle: "input"},
		},
	}
	if errs := ValidateGraph(graph, registry); len(errs) != 0 {
		t.Fatalf("ValidateGraph() errors = %v", errs)
	}
	outputs := map[string]map[string]any{}
	err := Execute(context.Background(), graph, registry, RunContext{ID: "run", Inputs: map[string]any{"topic": "AI"}, Outputs: outputs}, nil)
	if err != nil {
		t.Fatalf("Execute() error = %v", err)
	}
	if outputs["end"]["text"] != "主题：AI" {
		t.Fatalf("end output = %#v, want dynamic variable value", outputs["end"])
	}
}

func TestPhaseOneAllowsEightNodesAndRejectsNine(t *testing.T) {
	registry := DefaultRegistry()
	_ = RegisterSafeVariableExecutor(registry)
	nodes := []Node{{ID: "start", Type: NodeTypeStart, Config: json.RawMessage(`{"inputs":{"seed":{"type":"string"}}}`)}}
	edges := make([]Edge, 0, 7)
	previous := "start"
	for index := 1; index <= 6; index++ {
		id := "value" + string(rune('0'+index))
		nodes = append(nodes, Node{ID: id, Type: NodeTypeVariable, Config: json.RawMessage(`{"variableName":"value","valueExpression":"ok"}`)})
		edges = append(edges, Edge{Source: previous, SourceHandle: "output", Target: id, TargetHandle: "input"})
		previous = id
	}
	nodes = append(nodes, Node{ID: "end", Type: NodeTypeEnd, Config: json.RawMessage(`{"outputs":{"text":"{{value6.output.value}}"}}`)})
	edges = append(edges, Edge{Source: previous, SourceHandle: "output", Target: "end", TargetHandle: "input"})
	graph := Graph{SchemaVersion: 2, Nodes: nodes, Edges: edges}
	if errs := ValidateGraph(graph, registry); len(errs) != 0 {
		t.Fatalf("8-node graph errors = %v", errs)
	}
	graph.Nodes = append(graph.Nodes, Node{ID: "ninth", Type: NodeTypeVariable, Config: json.RawMessage(`{"variableName":"value","valueExpression":"ok"}`)})
	if errs := ValidateGraph(graph, registry); !containsWorkflowError(errs, "不能超过 8 个") {
		t.Fatalf("9-node graph errors = %v, want node limit", errs)
	}
}

func TestUnsafeWorkflowNodesRemainUnavailable(t *testing.T) {
	for _, nodeType := range []NodeType{NodeTypeHTTP, NodeTypeCode, NodeTypeCondition, NodeTypeLoop} {
		graph := Graph{SchemaVersion: 2, Nodes: []Node{
			{ID: "start", Type: NodeTypeStart, Config: json.RawMessage(`{"inputs":{}}`)},
			{ID: "unsafe", Type: nodeType, Config: json.RawMessage(`{}`)},
			{ID: "end", Type: NodeTypeEnd, Config: json.RawMessage(`{"outputs":{}}`)},
		}, Edges: []Edge{{Source: "start", SourceHandle: "output", Target: "unsafe", TargetHandle: "input"}, {Source: "unsafe", SourceHandle: "output", Target: "end", TargetHandle: "input"}}}
		if errs := ValidateGraph(graph, DefaultRegistry()); !containsWorkflowError(errs, "当前未开放") {
			t.Fatalf("node %s errors = %v, want unavailable", nodeType, errs)
		}
	}
}

func containsWorkflowError(errs []string, part string) bool {
	for _, item := range errs {
		if strings.Contains(item, part) {
			return true
		}
	}
	return false
}
