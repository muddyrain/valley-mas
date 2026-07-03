package agent

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"testing"
	"valley-server/internal/ai/tools"
)

// scriptedBackend 按预设脚本回放响应，用于测试 loop 分支。
type scriptedBackend struct {
	responses []BackendResponse
	err       error
	calls     int
}

func (b *scriptedBackend) Chat(_ context.Context, _ Spec, _ []Message, _ []ToolDescriptor) (BackendResponse, error) {
	if b.err != nil {
		return BackendResponse{}, b.err
	}
	if b.calls >= len(b.responses) {
		// 循环用最后一条响应，方便超步数场景。
		if len(b.responses) == 0 {
			return BackendResponse{}, errors.New("no scripted response")
		}
		b.calls++
		return b.responses[len(b.responses)-1], nil
	}
	resp := b.responses[b.calls]
	b.calls++
	return resp, nil
}

// countingTool 记录被调用次数与最后一次参数。
type countingTool struct {
	name    string
	scope   string
	invoked int
	lastArg json.RawMessage
	result  json.RawMessage
}

func (t *countingTool) Name() string           { return t.name }
func (t *countingTool) Description() string    { return "counting-" + t.name }
func (t *countingTool) Schema() map[string]any { return map[string]any{"type": "object"} }
func (t *countingTool) Scope() string          { return t.scope }
func (t *countingTool) Run(_ context.Context, args json.RawMessage) (json.RawMessage, error) {
	t.invoked++
	t.lastArg = args
	if len(t.result) > 0 {
		return t.result, nil
	}
	return json.RawMessage(`{"ok":true}`), nil
}

func newTestRegistry(ts ...tools.Tool) *tools.Registry {
	r := tools.NewRegistry()
	for _, t := range ts {
		r.MustRegister(t)
	}
	return r
}

func TestLocalLoopReturnsWhenNoToolCalls(t *testing.T) {
	backend := &scriptedBackend{
		responses: []BackendResponse{
			{
				Message: Message{Role: RoleAssistant, Content: "hello"},
				Model:   "test-model",
			},
		},
	}
	loop := NewLocalLoop(backend, newTestRegistry())

	result, err := loop.Run(context.Background(), Spec{Feature: "unit-test"}, []Message{
		{Role: RoleUser, Content: "hi"},
	})
	if err != nil {
		t.Fatalf("Run error: %v", err)
	}
	if result.Reply != "hello" {
		t.Fatalf("reply = %q, want %q", result.Reply, "hello")
	}
	if result.Steps != 1 {
		t.Fatalf("steps = %d, want 1", result.Steps)
	}
	if result.Model != "test-model" {
		t.Fatalf("model = %q, want test-model", result.Model)
	}
	if backend.calls != 1 {
		t.Fatalf("backend calls = %d, want 1", backend.calls)
	}
}

func TestLocalLoopExecutesToolThenFinal(t *testing.T) {
	tool := &countingTool{name: "query_traces", scope: "life-trace"}
	backend := &scriptedBackend{
		responses: []BackendResponse{
			{
				Message: Message{
					Role: RoleAssistant,
					ToolCalls: []ToolCall{{
						ID:   "call-1",
						Name: "query_traces",
						Args: json.RawMessage(`{"days":7}`),
					}},
				},
				Model: "m1",
			},
			{
				Message: Message{Role: RoleAssistant, Content: "done"},
				Model:   "m1",
			},
		},
	}
	loop := NewLocalLoop(backend, newTestRegistry(tool))

	result, err := loop.Run(context.Background(), Spec{
		Feature: "unit-test",
		Tools:   []string{"query_traces"},
	}, []Message{{Role: RoleUser, Content: "hi"}})
	if err != nil {
		t.Fatalf("Run error: %v", err)
	}
	if result.Reply != "done" {
		t.Fatalf("reply = %q, want done", result.Reply)
	}
	if result.Steps != 2 {
		t.Fatalf("steps = %d, want 2", result.Steps)
	}
	if tool.invoked != 1 {
		t.Fatalf("tool invoked = %d, want 1", tool.invoked)
	}
	if !strings.Contains(string(tool.lastArg), `"days":7`) {
		t.Fatalf("last args = %s, want contain days:7", string(tool.lastArg))
	}
	if backend.calls != 2 {
		t.Fatalf("backend calls = %d, want 2", backend.calls)
	}
}

func TestLocalLoopHitsMaxSteps(t *testing.T) {
	tool := &countingTool{name: "loop_tool", scope: "life-trace"}
	backend := &scriptedBackend{
		responses: []BackendResponse{{
			Message: Message{
				Role:    RoleAssistant,
				Content: "still thinking",
				ToolCalls: []ToolCall{{
					ID:   "call-x",
					Name: "loop_tool",
					Args: json.RawMessage(`{}`),
				}},
			},
			Model: "m1",
		}},
	}
	loop := NewLocalLoop(backend, newTestRegistry(tool))

	events, err := loop.RunStream(context.Background(), Spec{
		Feature:  "unit-test",
		Tools:    []string{"loop_tool"},
		MaxSteps: 3,
	}, []Message{{Role: RoleUser, Content: "hi"}})
	if err != nil {
		t.Fatalf("RunStream: %v", err)
	}

	var (
		toolCalls   int
		toolResults int
		gotDone     bool
		gotErr      error
	)
	for ev := range events {
		switch ev.Type {
		case EventToolCall:
			toolCalls++
		case EventToolResult:
			toolResults++
		case EventDone:
			gotDone = true
		case EventError:
			gotErr = ev.Err
		}
	}
	if !gotDone {
		t.Fatalf("expected Done event before Error")
	}
	if gotErr == nil || !errors.Is(gotErr, ErrMaxStepsExceeded) {
		t.Fatalf("expected ErrMaxStepsExceeded, got %v", gotErr)
	}
	if toolCalls != 3 || toolResults != 3 {
		t.Fatalf("toolCalls=%d toolResults=%d, want 3/3", toolCalls, toolResults)
	}
	if tool.invoked != 3 {
		t.Fatalf("tool invoked=%d, want 3", tool.invoked)
	}
}

func TestLocalLoopUnknownToolName(t *testing.T) {
	backend := &scriptedBackend{
		responses: []BackendResponse{
			{
				Message: Message{
					Role: RoleAssistant,
					ToolCalls: []ToolCall{{
						ID:   "call-1",
						Name: "not_registered",
						Args: json.RawMessage(`{}`),
					}},
				},
				Model: "m1",
			},
			{
				Message: Message{Role: RoleAssistant, Content: "abort"},
				Model:   "m1",
			},
		},
	}
	loop := NewLocalLoop(backend, newTestRegistry())

	events, err := loop.RunStream(context.Background(), Spec{
		Feature: "unit-test",
		Tools:   []string{"not_registered"},
	}, []Message{{Role: RoleUser, Content: "hi"}})
	if err != nil {
		t.Fatalf("RunStream: %v", err)
	}

	var toolResult json.RawMessage
	for ev := range events {
		if ev.Type == EventToolResult {
			toolResult = ev.ToolResult
		}
	}
	if !strings.Contains(string(toolResult), `"ok":false`) {
		t.Fatalf("expected error payload, got %s", string(toolResult))
	}
	if !strings.Contains(string(toolResult), "not_registered") {
		t.Fatalf("expected tool name in error, got %s", string(toolResult))
	}
}

func TestLocalLoopBackendError(t *testing.T) {
	backend := &scriptedBackend{err: errors.New("boom")}
	loop := NewLocalLoop(backend, newTestRegistry())

	_, err := loop.Run(context.Background(), Spec{Feature: "unit-test"}, []Message{
		{Role: RoleUser, Content: "hi"},
	})
	if err == nil || !strings.Contains(err.Error(), "boom") {
		t.Fatalf("expected backend error, got %v", err)
	}
}
