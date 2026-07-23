package workflow

import (
	"context"
	"encoding/json"
	"strings"
	"testing"
)

func TestLoopNodeAggregatesArrayBodyOutput(t *testing.T) {
	registry := testRegistry(t)
	graph := Graph{SchemaVersion: SchemaVersion, Nodes: []Node{
		node("start", NodeTypeStart, `{"inputs":{"items":{"type":"array","required":true}}}`),
		node("loop", NodeTypeLoop, `{"mode":"array","input":"{{start.output.items}}","middleVariables":[],"outputs":[{"name":"results","type":"string","source":"{{copy.output.value}}"}],"body":{"nodes":[{"id":"copy","type":"variable","label":"复制当前项","position":{"x":0,"y":0},"config":{"assignments":[{"name":"value","type":"string","value":"{{item}}"}]}}],"edges":[]}}`),
		node("end", NodeTypeEnd, `{"outputs":{"results":"{{loop.output.results}}"},"outputTypes":{"results":"array"}}`),
	}, Edges: []Edge{{Source: "start", Target: "loop"}, {Source: "loop", Target: "end"}}}
	if errs := ValidateGraph(graph, registry); len(errs) > 0 {
		t.Fatalf("validation errors: %v", errs)
	}
	var result map[string]any
	bodyEvents := 0
	err := Execute(context.Background(), graph, registry, RunContext{ID: "run", Inputs: map[string]any{"items": []any{"a", "b"}}}, func(event Event) {
		if event.BodyNodeID == "copy" && event.Status == StatusSucceeded {
			bodyEvents++
		}
		if event.NodeID == "end" && event.Status == StatusSucceeded {
			result = event.Output
		}
	})
	if err != nil {
		t.Fatal(err)
	}
	values, ok := result["results"].([]any)
	if !ok || len(values) != 2 || values[0] != "a" || values[1] != "b" || bodyEvents != 2 {
		t.Fatalf("result=%#v bodyEvents=%d", result, bodyEvents)
	}
}

func TestLoopNodeSupportsCountAndTerminateControl(t *testing.T) {
	registry := testRegistry(t)
	graph := Graph{SchemaVersion: SchemaVersion, Nodes: []Node{
		node("start", NodeTypeStart, `{"inputs":{}}`),
		node("loop", NodeTypeLoop, `{"mode":"infinite","maxIterations":5,"middleVariables":[],"outputs":[{"name":"results","type":"boolean","source":"{{stop.output.terminated}}"}],"body":{"nodes":[{"id":"stop","type":"terminate_loop","label":"终止","position":{"x":0,"y":0},"config":{}}],"edges":[]}}`),
		node("end", NodeTypeEnd, `{"outputs":{"results":"{{loop.output.results}}"},"outputTypes":{"results":"array"}}`),
	}, Edges: []Edge{{Source: "start", Target: "loop"}, {Source: "loop", Target: "end"}}}
	if errs := ValidateGraph(graph, registry); len(errs) > 0 {
		t.Fatalf("validation errors: %v", errs)
	}
	var output map[string]any
	if err := Execute(context.Background(), graph, registry, RunContext{}, func(event Event) {
		if event.NodeID == "end" && event.Status == StatusSucceeded {
			output = event.Output
		}
	}); err != nil {
		t.Fatal(err)
	}
	values, ok := output["results"].([]any)
	if !ok || len(values) != 1 || values[0] != true {
		t.Fatalf("output=%#v", output)
	}
}

func TestLoopNodeRejectsInvalidLoopBody(t *testing.T) {
	registry := testRegistry(t)
	invalid := map[string]any{
		"mode": "array", "input": "{{start.output.items}}", "outputs": []any{map[string]any{"name": "results", "type": "string", "source": "{{missing.output.value}}"}},
		"body": map[string]any{"nodes": []any{map[string]any{"id": "start", "type": "start", "label": "开始", "position": map[string]any{}, "config": map[string]any{}}}, "edges": []any{}},
	}
	encoded, _ := json.Marshal(invalid)
	graph := Graph{SchemaVersion: SchemaVersion, Nodes: []Node{
		node("start", NodeTypeStart, `{"inputs":{"items":{"type":"array","required":true}}}`),
		{ID: "loop", Type: NodeTypeLoop, Label: "loop", Config: encoded},
		node("end", NodeTypeEnd, `{"outputs":{}}`),
	}, Edges: []Edge{{Source: "start", Target: "loop"}, {Source: "loop", Target: "end"}}}
	if errs := ValidateGraph(graph, registry); !containsError(errs, "循环体节点 start 类型未开放") || !containsError(errs, "未引用已声明的循环体字段") {
		t.Fatalf("errors=%v", errs)
	}
}

func TestLoopNodeStopsOnBodyFailure(t *testing.T) {
	registry := testRegistry(t)
	graph := Graph{SchemaVersion: SchemaVersion, Nodes: []Node{
		node("start", NodeTypeStart, `{"inputs":{"items":{"type":"array","required":true}}}`),
		node("loop", NodeTypeLoop, `{"mode":"array","input":"{{start.output.items}}","outputs":[{"name":"results","type":"string","source":"{{copy.output.value}}"}],"body":{"nodes":[{"id":"copy","type":"variable","label":"复制","position":{"x":0,"y":0},"config":{"assignments":[{"name":"value","type":"string","value":"{{missing}}"}]}}],"edges":[]}}`),
		node("end", NodeTypeEnd, `{"outputs":{}}`),
	}, Edges: []Edge{{Source: "start", Target: "loop"}, {Source: "loop", Target: "end"}}}
	if errs := ValidateGraph(graph, registry); len(errs) > 0 {
		t.Fatalf("validation should defer unknown loop local resolution to execution, got %v", errs)
	}
	err := Execute(context.Background(), graph, registry, RunContext{Inputs: map[string]any{"items": []any{"a"}}}, nil)
	if err == nil || !strings.Contains(err.Error(), "循环第 1 轮失败") {
		t.Fatalf("error=%v", err)
	}
}
