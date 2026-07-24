package handler

import (
	"context"
	"testing"
)

func TestWorkflowRunControllerAllowsCancelOnlyContext(t *testing.T) {
	controller := workflowRunController{}
	ctx, release := controller.Start("run-without-deadline", 0)
	defer release()
	if _, hasDeadline := ctx.Deadline(); hasDeadline {
		t.Fatal("cancel-only workflow run should not add a global deadline")
	}
	if !controller.Cancel("run-without-deadline") {
		t.Fatal("expected active run to be cancellable")
	}
	if err := ctx.Err(); err != context.Canceled {
		t.Fatalf("context error = %v, want %v", err, context.Canceled)
	}
}
