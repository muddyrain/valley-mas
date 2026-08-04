package workflow

import (
	"encoding/json"
	"reflect"
	"testing"
)

func operationTestGraph() Graph {
	return Graph{
		SchemaVersion: SchemaVersion,
		Nodes: []Node{
			node("start", NodeTypeStart, `{"inputs":{"topic":{"type":"string","required":true}}}`),
			node("writer", NodeTypeLLM, `{"systemPrompt":"write","prompt":"{{start.output.topic}}","temperature":0.2}`),
			node("end", NodeTypeEnd, `{"outputs":{}}`),
		},
		Edges: []Edge{
			{ID: "start-writer", Source: "start", Target: "writer"},
			{ID: "writer-end", Source: "writer", Target: "end"},
		},
	}
}

func TestMergeOperationsPreservesNonConflictingLatestChanges(t *testing.T) {
	base := operationTestGraph()
	latest := cloneGraphForTest(t, base)
	latest.Nodes[2].Label = "Result"

	merged, conflicts, err := MergeOperations(base, latest, []WorkflowOperation{{
		Type:   OperationNodeUpdate,
		NodeID: "writer",
		Patch: map[string]any{
			"config": map[string]any{"temperature": 0.6},
		},
	}}, testRegistry(t))
	if err != nil {
		t.Fatal(err)
	}
	if len(conflicts) != 0 {
		t.Fatalf("conflicts=%+v", conflicts)
	}
	if merged.Nodes[2].Label != "Result" {
		t.Fatalf("latest label was lost: %+v", merged.Nodes[2])
	}
	config := decodeNodeConfigForTest(t, merged.Nodes[1])
	if config["temperature"] != 0.6 {
		t.Fatalf("config=%+v", config)
	}
}

func TestMergeOperationsReportsSameFieldConflict(t *testing.T) {
	base := operationTestGraph()
	latest := cloneGraphForTest(t, base)
	latest.Nodes[1].Config = json.RawMessage(`{"systemPrompt":"write","prompt":"manual","temperature":0.2}`)

	_, conflicts, err := MergeOperations(base, latest, []WorkflowOperation{{
		Type:   OperationNodeUpdate,
		NodeID: "writer",
		Patch: map[string]any{
			"config": map[string]any{"prompt": "ai"},
		},
	}}, testRegistry(t))
	if err != nil {
		t.Fatal(err)
	}
	if len(conflicts) != 1 || conflicts[0].Path != "node:writer/config/prompt" {
		t.Fatalf("conflicts=%+v", conflicts)
	}
}

func TestBuildInverseOperationsRestoresGraph(t *testing.T) {
	registry := testRegistry(t)
	base := operationTestGraph()
	operations := []WorkflowOperation{
		{
			Type:   OperationNodeUpdate,
			NodeID: "writer",
			Patch: map[string]any{
				"label":    "Draft article",
				"position": map[string]any{"x": 480.0, "y": 120.0},
				"config":   map[string]any{"temperature": 0.7, "prompt": nil},
			},
		},
		{
			Type:   OperationNodeRemove,
			NodeID: "writer",
		},
	}

	inverse, err := BuildInverseOperations(base, operations, registry)
	if err != nil {
		t.Fatal(err)
	}
	applied, err := ApplyOperations(base, operations, registry)
	if err != nil {
		t.Fatal(err)
	}
	restored, err := ApplyOperations(applied, inverse, registry)
	if err != nil {
		t.Fatal(err)
	}
	if !graphsEqual(base, restored) {
		t.Fatalf("restored graph differs\nbase=%+v\nrestored=%+v\ninverse=%+v", base, restored, inverse)
	}
}

func TestMergeInverseOperationsRejectsChangedAppliedPath(t *testing.T) {
	registry := testRegistry(t)
	base := operationTestGraph()
	operations := []WorkflowOperation{{
		Type:   OperationNodeUpdate,
		NodeID: "writer",
		Patch:  map[string]any{"label": "AI label"},
	}}
	inverse, err := BuildInverseOperations(base, operations, registry)
	if err != nil {
		t.Fatal(err)
	}
	applied, err := ApplyOperations(base, operations, registry)
	if err != nil {
		t.Fatal(err)
	}
	latest := cloneGraphForTest(t, applied)
	latest.Nodes[1].Label = "Manual label"

	_, conflicts, err := MergeOperations(applied, latest, inverse, registry)
	if err != nil {
		t.Fatal(err)
	}
	if len(conflicts) != 1 || conflicts[0].Path != "node:writer/label" {
		t.Fatalf("conflicts=%+v", conflicts)
	}
}

func cloneGraphForTest(t *testing.T, graph Graph) Graph {
	t.Helper()
	encoded, err := json.Marshal(graph)
	if err != nil {
		t.Fatal(err)
	}
	var cloned Graph
	if err := json.Unmarshal(encoded, &cloned); err != nil {
		t.Fatal(err)
	}
	return cloned
}

func decodeNodeConfigForTest(t *testing.T, node Node) map[string]any {
	t.Helper()
	var value map[string]any
	if err := json.Unmarshal(node.Config, &value); err != nil {
		t.Fatal(err)
	}
	return value
}

func graphsEqual(left, right Graph) bool {
	leftJSON, _ := json.Marshal(left)
	rightJSON, _ := json.Marshal(right)
	var leftValue any
	var rightValue any
	_ = json.Unmarshal(leftJSON, &leftValue)
	_ = json.Unmarshal(rightJSON, &rightValue)
	return reflect.DeepEqual(leftValue, rightValue)
}
