package workflow

import (
	"context"
	"fmt"
	"time"
)

const maxDelayMilliseconds = 300_000

type DelayExecutor struct{}

func (DelayExecutor) Type() NodeType { return NodeTypeDelay }

func (DelayExecutor) Execute(ctx context.Context, _ RunContext, execution NodeExecution) (NodeResult, error) {
	milliseconds := numberFromValue(execution.Input["delayMs"])
	if milliseconds < 0 || milliseconds > maxDelayMilliseconds {
		return NodeResult{}, fmt.Errorf("延时必须为 0 到 %d 毫秒", maxDelayMilliseconds)
	}
	timer := time.NewTimer(time.Duration(milliseconds) * time.Millisecond)
	defer timer.Stop()
	select {
	case <-ctx.Done():
		return NodeResult{}, ctx.Err()
	case <-timer.C:
		return NodeResult{Output: map[string]any{"delayedMs": int(milliseconds)}}, nil
	}
}
