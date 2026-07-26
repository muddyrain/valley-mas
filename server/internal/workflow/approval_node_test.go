package workflow

import (
	"context"
	"errors"
	"testing"
)

func TestApprovalExecutorReturnsPendingAndDecision(t *testing.T) {
	pending := ApprovalExecutor{}
	_, err := pending.Execute(context.Background(), RunContext{
		ID: "run-1",
		ApprovalGate: ApprovalGateFunc(func(
			context.Context, string, string, string, string,
		) (ApprovalDecision, error) {
			return ApprovalDecision{ApprovalID: "approval-1", Status: "pending"}, nil
		}),
	}, NodeExecution{NodeID: "approval", Input: map[string]any{"title": "确认继续"}})
	if !errors.Is(err, ErrApprovalRequired) {
		t.Fatalf("expected approval required, got %v", err)
	}

	result, err := (ApprovalExecutor{}).Execute(context.Background(), RunContext{
		ID: "run-1",
		ApprovalGate: ApprovalGateFunc(func(
			context.Context, string, string, string, string,
		) (ApprovalDecision, error) {
			return ApprovalDecision{
				ApprovalID: "approval-1", Status: "approved", Note: "同意",
			}, nil
		}),
	}, NodeExecution{NodeID: "approval", Input: map[string]any{"title": "确认继续"}})
	if err != nil || result.Output["approved"] != true || result.Output["note"] != "同意" {
		t.Fatalf("unexpected decision output: %#v err=%v", result.Output, err)
	}
}

func TestApprovalTopologyRequiresFirstStepAndNoInputs(t *testing.T) {
	registry := DefaultRegistry()
	valid := Graph{SchemaVersion: 4, Nodes: []Node{
		node("start", NodeTypeStart, `{"inputs":{}}`),
		node("approval", NodeTypeApproval, `{"title":"确认继续"}`),
		node("end", NodeTypeEnd, `{"outputs":{}}`),
	}, Edges: []Edge{{Source: "start", Target: "approval"}, {Source: "approval", Target: "end"}}}
	if errs := ValidateGraph(valid, registry); len(errs) > 0 {
		t.Fatalf("valid approval graph: %v", errs)
	}
	invalid := valid
	invalid.Nodes[0] = node("start", NodeTypeStart, `{"inputs":{"topic":{"type":"string"}}}`)
	if errs := ValidateGraph(invalid, registry); !containsError(errs, "不能声明开始输入") {
		t.Fatalf("unexpected validation errors: %v", errs)
	}
}
