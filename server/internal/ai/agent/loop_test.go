package agent

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"testing"
	"valley-server/internal/ai/clarification"
	"valley-server/internal/ai/tools"
)

// scriptedBackend 按预设脚本回放响应，用于测试 loop 分支。
type scriptedBackend struct {
	responses []BackendResponse
	err       error
	calls     int
	toolsSeen [][]ToolDescriptor
}

func (b *scriptedBackend) Chat(_ context.Context, _ Spec, _ []Message, descriptors []ToolDescriptor) (BackendResponse, error) {
	b.toolsSeen = append(b.toolsSeen, append([]ToolDescriptor(nil), descriptors...))
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

func TestLocalLoopEmptyToolWhitelistDisablesTools(t *testing.T) {
	tool := &countingTool{name: "query_traces", scope: "life-trace"}
	backend := &scriptedBackend{responses: []BackendResponse{{
		Message: Message{Role: RoleAssistant, Content: "done"},
	}}}
	loop := NewLocalLoop(backend, newTestRegistry(tool))

	_, err := loop.Run(context.Background(), Spec{
		Feature: "unit-test",
		Tools:   []string{},
	}, []Message{{Role: RoleUser, Content: "hi"}})
	if err != nil {
		t.Fatalf("Run error: %v", err)
	}
	if len(backend.toolsSeen) != 1 {
		t.Fatalf("backend tool descriptor calls = %d, want 1", len(backend.toolsSeen))
	}
	if got := len(backend.toolsSeen[0]); got != 0 {
		t.Fatalf("tool descriptors = %d, want 0 when Spec.Tools is empty", got)
	}
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

func TestLocalLoopAttachesNarrationToToolCall(t *testing.T) {
	tool := &countingTool{name: "query_traces", scope: "life-trace"}
	backend := &scriptedBackend{responses: []BackendResponse{
		{
			Message: Message{
				Role:    RoleAssistant,
				Content: "第一次失败，我再查询一次。",
				ToolCalls: []ToolCall{{
					ID:   "call-1",
					Name: "query_traces",
					Args: json.RawMessage(`{"days":1}`),
				}, {
					ID:   "call-2",
					Name: "query_traces",
					Args: json.RawMessage(`{"days":7}`),
				}},
			},
		},
		{Message: Message{Role: RoleAssistant, Content: "done"}},
	}}
	loop := NewLocalLoop(backend, newTestRegistry(tool))

	events, err := loop.RunStream(context.Background(), Spec{
		Feature: "unit-test",
		Tools:   []string{"query_traces"},
	}, []Message{{Role: RoleUser, Content: "hi"}})
	if err != nil {
		t.Fatalf("RunStream: %v", err)
	}

	var narrations []string
	for event := range events {
		if event.Type == EventToolCall {
			narrations = append(narrations, event.Narration)
		}
	}
	if len(narrations) != 2 || narrations[0] != "第一次失败，我再查询一次。" || narrations[1] != "" {
		t.Fatalf("tool call narrations = %#v", narrations)
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

type rejectingToolGate struct{ calls int }

func (gate *rejectingToolGate) Authorize(_ context.Context, _ ToolCall) error {
	gate.calls++
	return ErrToolApprovalRejected
}

func TestLocalLoopToolGateBlocksExecution(t *testing.T) {
	tool := &countingTool{name: "protected_tool", scope: "unit-test"}
	backend := &scriptedBackend{responses: []BackendResponse{{
		Message: Message{Role: RoleAssistant, ToolCalls: []ToolCall{{
			ID: "call-protected", Name: tool.name, Args: json.RawMessage(`{}`),
		}}},
		Model: "m1",
	}}}
	gate := &rejectingToolGate{}
	loop := NewLocalLoop(backend, newTestRegistry(tool))

	events, err := loop.RunStream(context.Background(), Spec{
		Feature: "unit-test", Tools: []string{tool.name}, ToolGate: gate,
	}, []Message{{Role: RoleUser, Content: "run it"}})
	if err != nil {
		t.Fatalf("RunStream: %v", err)
	}
	var gotErr error
	for event := range events {
		if event.Type == EventError {
			gotErr = event.Err
		}
	}
	if !errors.Is(gotErr, ErrToolApprovalRejected) {
		t.Fatalf("error = %v, want ErrToolApprovalRejected", gotErr)
	}
	if gate.calls != 1 {
		t.Fatalf("gate calls = %d, want 1", gate.calls)
	}
	if tool.invoked != 0 {
		t.Fatalf("tool invoked = %d, want 0", tool.invoked)
	}
}

type clarificationTool struct{}

func (clarificationTool) Name() string           { return "clarification.ask" }
func (clarificationTool) Description() string    { return "ask" }
func (clarificationTool) Schema() map[string]any { return map[string]any{"type": "object"} }
func (clarificationTool) Scope() string          { return "unit-test" }
func (clarificationTool) Run(context.Context, json.RawMessage) (json.RawMessage, error) {
	request, err := clarification.NewRequest(clarification.Input{
		ID: "request-1", Question: "请选择格式", Reason: "缺少目标格式",
		AnswerType:        clarification.AnswerSingleSelect,
		Suggestions:       []clarification.Suggestion{{Label: "PNG", Value: "png"}},
		AllowCustomAnswer: true, Blocking: true, Complexity: clarification.ComplexitySimple, Round: 1,
	})
	if err != nil {
		return nil, err
	}
	return nil, clarification.Require(request)
}

func TestLocalLoopEmitsClarificationAndStopsBeforeAnotherModelStep(t *testing.T) {
	tool := clarificationTool{}
	backend := &scriptedBackend{responses: []BackendResponse{
		{Message: Message{Role: RoleAssistant, ToolCalls: []ToolCall{{ID: "call-1", Name: tool.Name(), Args: json.RawMessage(`{}`)}}}, Model: "m1"},
		{Message: Message{Role: RoleAssistant, Content: "must not continue"}, Model: "m1"},
	}}
	loop := NewLocalLoop(backend, newTestRegistry(tool))
	events, err := loop.RunStream(context.Background(), Spec{Feature: "unit-test", Tools: []string{tool.Name()}}, []Message{{Role: RoleUser, Content: "convert"}})
	if err != nil {
		t.Fatalf("RunStream: %v", err)
	}
	var request *clarification.Request
	var gotErr error
	for event := range events {
		if event.Type == EventClarification {
			request = event.Clarification
		}
		if event.Type == EventError {
			gotErr = event.Err
		}
	}
	if request == nil || request.ID != "request-1" {
		t.Fatalf("clarification = %#v", request)
	}
	if !errors.Is(gotErr, ErrClarificationRequired) {
		t.Fatalf("error = %v, want ErrClarificationRequired", gotErr)
	}
	if backend.calls != 1 {
		t.Fatalf("backend calls = %d, want 1", backend.calls)
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

type streamingBackend struct{}

func (streamingBackend) Chat(context.Context, Spec, []Message, []ToolDescriptor) (BackendResponse, error) {
	return BackendResponse{}, errors.New("synchronous chat must not be called")
}

func (streamingBackend) ChatStream(_ context.Context, _ Spec, _ []Message, _ []ToolDescriptor, emit func(string)) (BackendResponse, error) {
	emit("first")
	emit(" ")
	emit("second")
	return BackendResponse{Message: Message{Role: RoleAssistant, Content: "first second"}, Model: "stream-model"}, nil
}

func TestLocalLoopStreamsDeltasWhenBackendSupportsIt(t *testing.T) {
	loop := NewLocalLoop(streamingBackend{}, newTestRegistry())

	events, err := loop.RunStream(context.Background(), Spec{Feature: "unit-test"}, []Message{{Role: RoleUser, Content: "hi"}})
	if err != nil {
		t.Fatalf("RunStream: %v", err)
	}

	var reply strings.Builder
	var gotErr error
	for event := range events {
		switch event.Type {
		case EventDelta:
			reply.WriteString(event.Delta)
		case EventError:
			gotErr = event.Err
		}
	}
	if gotErr != nil {
		t.Fatalf("unexpected stream error: %v", gotErr)
	}
	if reply.String() != "first second" {
		t.Fatalf("streamed reply=%q, want %q", reply.String(), "first second")
	}
}
