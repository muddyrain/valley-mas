package workflowtrigger

import (
	"encoding/json"
	"testing"

	"valley-server/internal/workflow"
)

func triggerTestNode(id string, nodeType workflow.NodeType, config string) workflow.Node {
	return workflow.Node{ID: id, Type: nodeType, Config: json.RawMessage(config)}
}

func TestValidateScheduledGraphRejectsFileAndWriteTool(t *testing.T) {
	registry := workflow.DefaultRegistry()
	if err := workflow.RegisterWorkflowCapabilities(registry); err != nil {
		t.Fatal(err)
	}
	fileGraph := workflow.Graph{Nodes: []workflow.Node{
		triggerTestNode("start", workflow.NodeTypeStart, `{"inputs":{"upload":{"type":"file"}}}`),
	}}
	if err := ValidateScheduledGraph(fileGraph, registry); err == nil {
		t.Fatal("expected file input to be rejected")
	}
	writeGraph := workflow.Graph{Nodes: []workflow.Node{
		triggerTestNode("draft", workflow.NodeTypeTool, `{"capabilityId":"blog.createDraft"}`),
	}}
	if err := ValidateScheduledGraph(writeGraph, registry); err == nil {
		t.Fatal("expected write tool to be rejected")
	}
}

func TestValidateScheduledGraphAllowsReadOnlyGraph(t *testing.T) {
	registry := workflow.DefaultRegistry()
	if err := workflow.RegisterWorkflowCapabilities(registry); err != nil {
		t.Fatal(err)
	}
	graph := workflow.Graph{Nodes: []workflow.Node{
		triggerTestNode("start", workflow.NodeTypeStart, `{"inputs":{"topic":{"type":"string"}}}`),
		triggerTestNode("search", workflow.NodeTypeTool, `{"capabilityId":"content.search"}`),
	}}
	if err := ValidateScheduledGraph(graph, registry); err != nil {
		t.Fatal(err)
	}
}
