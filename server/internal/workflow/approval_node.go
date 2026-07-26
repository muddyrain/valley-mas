package workflow

import (
	"context"
	"errors"
	"fmt"
	"strings"
)

var ErrApprovalRequired = errors.New("WORKFLOW_APPROVAL_REQUIRED")

type ApprovalDecision struct {
	ApprovalID string
	Status     string
	Note       string
}

type ApprovalGate interface {
	Decide(context.Context, string, string, string, string) (ApprovalDecision, error)
}

type ApprovalGateFunc func(context.Context, string, string, string, string) (ApprovalDecision, error)

func (fn ApprovalGateFunc) Decide(ctx context.Context, runID, nodeID, title, description string) (ApprovalDecision, error) {
	return fn(ctx, runID, nodeID, title, description)
}

type ApprovalRequiredError struct {
	ApprovalID string
}

func (err *ApprovalRequiredError) Error() string {
	return fmt.Sprintf("%s: %s", ErrApprovalRequired, err.ApprovalID)
}

func (err *ApprovalRequiredError) Unwrap() error { return ErrApprovalRequired }

type ApprovalExecutor struct{}

func (ApprovalExecutor) Type() NodeType { return NodeTypeApproval }

func (ApprovalExecutor) Execute(ctx context.Context, run RunContext, execution NodeExecution) (NodeResult, error) {
	if run.ApprovalGate == nil {
		return NodeResult{}, errors.New("人工审批服务未配置")
	}
	title := strings.TrimSpace(stringFromValue(execution.Input["title"]))
	if title == "" {
		return NodeResult{}, errors.New("人工审批标题不能为空")
	}
	decision, err := run.ApprovalGate.Decide(
		ctx, run.ID, execution.NodeID, title, stringFromValue(execution.Input["description"]),
	)
	if err != nil {
		return NodeResult{}, err
	}
	switch decision.Status {
	case "approved":
		return NodeResult{Output: map[string]any{
			"approved": true, "decision": decision.Status, "note": decision.Note,
			"approvalId": decision.ApprovalID,
		}}, nil
	case "rejected":
		return NodeResult{Output: map[string]any{
			"approved": false, "decision": decision.Status, "note": decision.Note,
			"approvalId": decision.ApprovalID,
		}}, nil
	default:
		return NodeResult{}, &ApprovalRequiredError{ApprovalID: decision.ApprovalID}
	}
}
