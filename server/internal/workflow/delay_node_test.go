package workflow

import (
	"context"
	"testing"
	"time"
)

func TestDelayExecutorWaitsAndCanBeCancelled(t *testing.T) {
	started := time.Now()
	result, err := (DelayExecutor{}).Execute(
		context.Background(),
		RunContext{},
		NodeExecution{Input: map[string]any{"delayMs": 5}},
	)
	if err != nil || result.Output["delayedMs"] != 5 || time.Since(started) < 5*time.Millisecond {
		t.Fatalf("result=%#v err=%v elapsed=%v", result, err, time.Since(started))
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if _, err := (DelayExecutor{}).Execute(
		ctx, RunContext{}, NodeExecution{Input: map[string]any{"delayMs": 1000}},
	); err == nil {
		t.Fatal("cancelled delay must fail")
	}
}
