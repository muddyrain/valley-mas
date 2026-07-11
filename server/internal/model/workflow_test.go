package model

import "testing"

func TestWorkflowRunBeforeCreateNormalizesEmptyJSONFields(t *testing.T) {
	run := WorkflowRun{ID: 1}
	if err := run.BeforeCreate(nil); err != nil {
		t.Fatalf("BeforeCreate() error = %v", err)
	}
	if run.Inputs != "{}" || run.GraphSnapshot != "{}" || run.Result != "{}" {
		t.Fatalf("empty JSON fields = %#v", run)
	}
}

func TestWorkflowNodeRunBeforeCreateNormalizesEmptyJSONFields(t *testing.T) {
	nodeRun := WorkflowNodeRun{ID: 1}
	if err := nodeRun.BeforeCreate(nil); err != nil {
		t.Fatalf("BeforeCreate() error = %v", err)
	}
	if nodeRun.Input != "{}" || nodeRun.Output != "{}" {
		t.Fatalf("empty JSON fields = %#v", nodeRun)
	}
}
