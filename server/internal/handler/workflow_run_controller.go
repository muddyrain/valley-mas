package handler

import (
	"context"
	"sync"
	"time"

	"valley-server/internal/database"
	"valley-server/internal/model"
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

const workflowRunCancellationPollInterval = 500 * time.Millisecond

// watchWorkflowRunCancellation turns a persisted cancellation request into a
// local context cancellation. This lets the request be accepted by any server
// instance while the instance actually executing the run stops the provider call.
func watchWorkflowRunCancellation(runID string) func() {
	stop := make(chan struct{})
	var once sync.Once
	go func() {
		ticker := time.NewTicker(workflowRunCancellationPollInterval)
		defer ticker.Stop()
		for {
			select {
			case <-stop:
				return
			case <-ticker.C:
				var run model.WorkflowRun
				if err := database.GetDB().Select("status").Where("id = ?", runID).First(&run).Error; err != nil {
					continue
				}
				if run.Status == "cancelling" {
					activeWorkflowRuns.Cancel(runID)
					return
				}
			}
		}
	}()
	return func() {
		once.Do(func() { close(stop) })
	}
}
