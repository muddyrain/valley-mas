package handler

import (
	"context"
	"sync"
	"time"
)

type workflowRunController struct {
	runs sync.Map
}

type workflowRunControl struct {
	cancel      context.CancelFunc
	nodeCancels sync.Map
}

type workflowNodeCancel struct {
	cancel func()
}

func (controller *workflowRunController) Start(runID string, timeout time.Duration) (context.Context, func()) {
	var ctx context.Context
	var cancel context.CancelFunc
	if timeout > 0 {
		ctx, cancel = context.WithTimeout(context.Background(), timeout)
	} else {
		ctx, cancel = context.WithCancel(context.Background())
	}
	control := &workflowRunControl{cancel: cancel}
	controller.runs.Store(runID, control)
	return ctx, func() {
		controller.runs.Delete(runID)
		control.nodeCancels.Range(func(_, value any) bool {
			value.(*workflowNodeCancel).cancel()
			return true
		})
		cancel()
	}
}

func (controller *workflowRunController) Cancel(runID string) bool {
	value, ok := controller.runs.Load(runID)
	if !ok {
		return false
	}
	value.(*workflowRunControl).cancel()
	return true
}

func (controller *workflowRunController) RegisterNodeCancel(runID, nodeID string, cancel func()) func() {
	value, ok := controller.runs.Load(runID)
	if !ok {
		return func() {}
	}
	control := value.(*workflowRunControl)
	nodeCancel := &workflowNodeCancel{cancel: cancel}
	control.nodeCancels.Store(nodeID, nodeCancel)
	return func() {
		control.nodeCancels.CompareAndDelete(nodeID, nodeCancel)
	}
}

func (controller *workflowRunController) CancelNode(runID, nodeID string) bool {
	value, ok := controller.runs.Load(runID)
	if !ok {
		return false
	}
	nodeCancel, ok := value.(*workflowRunControl).nodeCancels.Load(nodeID)
	if !ok {
		return false
	}
	nodeCancel.(*workflowNodeCancel).cancel()
	return true
}

var activeWorkflowRuns workflowRunController
var activeCopilotRuns workflowRunController
