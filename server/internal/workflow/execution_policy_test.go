package workflow

import (
	"context"
	"errors"
	"testing"
)

type flakyTemplateExecutor struct {
	failures int
	calls    int
}

type blockingTemplateExecutor struct {
	started chan struct{}
}

func (executor blockingTemplateExecutor) Type() NodeType { return NodeTypeTemplate }

func (executor blockingTemplateExecutor) Execute(ctx context.Context, _ RunContext, _ NodeExecution) (NodeResult, error) {
	close(executor.started)
	<-ctx.Done()
	return NodeResult{}, ctx.Err()
}

func (executor *flakyTemplateExecutor) Type() NodeType { return NodeTypeTemplate }

func (executor *flakyTemplateExecutor) Execute(context.Context, RunContext, NodeExecution) (NodeResult, error) {
	executor.calls++
	if executor.calls <= executor.failures {
		return NodeResult{}, errors.New("temporary failure")
	}
	return NodeResult{Output: map[string]any{"text": "ok"}}, nil
}

func policyTestRegistry(t *testing.T, executor NodeExecutor) *Registry {
	t.Helper()
	registry := NewRegistry(
		NodeDefinition{Type: NodeTypeStart},
		NodeDefinition{Type: NodeTypeTemplate},
		NodeDefinition{Type: NodeTypeEnd},
	)
	for _, item := range []NodeExecutor{startExecutor{}, executor, endExecutor{}} {
		if err := registry.RegisterExecutor(item); err != nil {
			t.Fatal(err)
		}
	}
	return registry
}

func TestExecutionPolicyRetriesSafeNode(t *testing.T) {
	executor := &flakyTemplateExecutor{failures: 2}
	registry := policyTestRegistry(t, executor)
	graph := Graph{SchemaVersion: 4, Nodes: []Node{
		node("start", NodeTypeStart, `{"inputs":{}}`),
		node("task", NodeTypeTemplate, `{"template":"ignored","errorHandling":{"retryCount":2,"retryDelayMs":0,"strategy":"fail"}}`),
		node("end", NodeTypeEnd, `{"outputs":{"attempts":"{{task.output._attempts}}"},"outputTypes":{"attempts":"number"}}`),
	}, Edges: []Edge{{Source: "start", Target: "task"}, {Source: "task", Target: "end"}}}
	var final map[string]any
	err := Execute(context.Background(), graph, registry, RunContext{}, func(event Event) {
		if event.NodeID == "end" && event.Status == StatusSucceeded {
			final = event.Output
		}
	})
	if err != nil {
		t.Fatal(err)
	}
	if executor.calls != 3 || final["attempts"] != 3 {
		t.Fatalf("calls=%d final=%#v", executor.calls, final)
	}
}

func TestExecutionPolicyCanContinueWithStableErrorOutput(t *testing.T) {
	executor := &flakyTemplateExecutor{failures: 1}
	registry := policyTestRegistry(t, executor)
	graph := Graph{SchemaVersion: 4, Nodes: []Node{
		node("start", NodeTypeStart, `{"inputs":{}}`),
		node("task", NodeTypeTemplate, `{"template":"ignored","errorHandling":{"retryCount":0,"retryDelayMs":0,"strategy":"continue"}}`),
		node("end", NodeTypeEnd, `{"outputs":{"failed":"{{task.output._failed}}","code":"{{task.output._errorCode}}"},"outputTypes":{"failed":"boolean","code":"string"}}`),
	}, Edges: []Edge{{Source: "start", Target: "task"}, {Source: "task", Target: "end"}}}
	var final map[string]any
	err := Execute(context.Background(), graph, registry, RunContext{}, func(event Event) {
		if event.NodeID == "end" && event.Status == StatusSucceeded {
			final = event.Output
		}
	})
	if err != nil {
		t.Fatal(err)
	}
	if final["failed"] != true || final["code"] != "WORKFLOW_NODE_FAILED" {
		t.Fatalf("unexpected final output: %#v", final)
	}
}

func TestExecuteResumeSkipsCompletedNodesAndContinuesFromFailure(t *testing.T) {
	executor := &flakyTemplateExecutor{}
	registry := policyTestRegistry(t, executor)
	graph := Graph{SchemaVersion: 4, Nodes: []Node{
		node("start", NodeTypeStart, `{"inputs":{}}`),
		node("task", NodeTypeTemplate, `{"template":"ignored"}`),
		node("end", NodeTypeEnd, `{"outputs":{"text":"{{task.output.text}}"}}`),
	}, Edges: []Edge{{Source: "start", Target: "task"}, {Source: "task", Target: "end"}}}
	var startEvents int
	var final map[string]any
	err := Execute(context.Background(), graph, registry, RunContext{
		Outputs:          map[string]map[string]any{"start": {}},
		CompletedNodes:   map[string]CompletedNode{"start": {ActivateOutgoing: true}},
		ResumeFromNodeID: "task",
	}, func(event Event) {
		if event.NodeID == "start" {
			startEvents++
		}
		if event.NodeID == "end" && event.Status == StatusSucceeded {
			final = event.Output
		}
	})
	if err != nil {
		t.Fatal(err)
	}
	if startEvents != 0 || executor.calls != 1 || final["text"] != "ok" {
		t.Fatalf("startEvents=%d calls=%d final=%#v", startEvents, executor.calls, final)
	}
}

func TestExecuteMarksExplicitNodeCancellationAsResumableFailure(t *testing.T) {
	started := make(chan struct{})
	registry := policyTestRegistry(t, blockingTemplateExecutor{started: started})
	graph := Graph{SchemaVersion: 4, Nodes: []Node{
		node("start", NodeTypeStart, `{"inputs":{}}`),
		node("task", NodeTypeTemplate, `{"template":"ignored"}`),
		node("end", NodeTypeEnd, `{"outputs":{"text":"{{task.output.text}}"}}`),
	}, Edges: []Edge{{Source: "start", Target: "task"}, {Source: "task", Target: "end"}}}
	var cancel func()
	events := make(chan Event, 4)
	done := make(chan error, 1)
	go func() {
		done <- Execute(context.Background(), graph, registry, RunContext{
			RegisterNodeCancellation: func(nodeID string, next func()) func() {
				if nodeID == "task" {
					cancel = next
				}
				return func() {}
			},
		}, func(event Event) { events <- event })
	}()
	<-started
	if cancel == nil {
		t.Fatal("expected task cancellation callback")
	}
	cancel()
	if err := <-done; !errors.Is(err, ErrNodeCancelled) {
		t.Fatalf("err=%v", err)
	}
	close(events)
	var cancelled Event
	for event := range events {
		if event.NodeID == "task" && event.Status == StatusFailed {
			cancelled = event
		}
	}
	if cancelled.Error != "WORKFLOW_NODE_CANCELLED" || cancelled.Message != "节点已取消" {
		t.Fatalf("unexpected cancellation event: %#v", cancelled)
	}
}

func TestExecutionPolicyRejectsRetryForWriteCapability(t *testing.T) {
	registry := NewRegistry(NodeDefinition{Type: NodeTypeTool})
	if err := registry.RegisterCapability(
		ToolCapability{ID: "write.test", SideEffect: "write"},
		capabilityExecutorFunc(func(context.Context, RunContext, NodeExecution) (NodeResult, error) {
			return NodeResult{}, nil
		}),
	); err != nil {
		t.Fatal(err)
	}
	_, err := executionPolicyFromConfig(
		node("write", NodeTypeTool, `{}`),
		map[string]any{
			"capabilityId": "write.test",
			"errorHandling": map[string]any{
				"retryCount": 1,
				"strategy":   "fail",
			},
		},
		registry,
	)
	if err == nil {
		t.Fatal("write capability retry must be rejected")
	}
}

type capabilityExecutorFunc func(context.Context, RunContext, NodeExecution) (NodeResult, error)

func (fn capabilityExecutorFunc) Execute(ctx context.Context, run RunContext, execution NodeExecution) (NodeResult, error) {
	return fn(ctx, run, execution)
}
