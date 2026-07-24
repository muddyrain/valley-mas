package handler

import (
	"context"
	"sync"
	"time"
)

type workflowRunController struct {
	cancels sync.Map
}

func (controller *workflowRunController) Start(runID string, timeout time.Duration) (context.Context, func()) {
	var ctx context.Context
	var cancel context.CancelFunc
	if timeout > 0 {
		ctx, cancel = context.WithTimeout(context.Background(), timeout)
	} else {
		ctx, cancel = context.WithCancel(context.Background())
	}
	controller.cancels.Store(runID, cancel)
	return ctx, func() {
		controller.cancels.Delete(runID)
		cancel()
	}
}

func (controller *workflowRunController) Cancel(runID string) bool {
	value, ok := controller.cancels.Load(runID)
	if !ok {
		return false
	}
	value.(context.CancelFunc)()
	return true
}

var activeWorkflowRuns workflowRunController
var activeCopilotRuns workflowRunController
