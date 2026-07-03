package lifetrace

import (
	"encoding/json"
	"testing"

	"valley-server/internal/ai/agent"
)

func TestBuildLifeTraceAssistantAgentMessages(t *testing.T) {
	req := lifeTraceAssistantRequest{
		Message: "帮我记一下今天买了 30 元的咖啡",
		History: []lifeTraceAssistantMessage{
			{Role: "user", Content: "上一条问句"},
			{Role: "assistant", Content: "上一条回复"},
			{Role: "system", Content: "系统提示"},
			{Role: "AI", Content: "混合大小写 + 别名"},
			{Role: "user", Content: "   "},
		},
	}
	msgs := buildLifeTraceAssistantAgentMessages(req)
	if len(msgs) != 5 {
		t.Fatalf("expected 5 messages (skip empty), got %d", len(msgs))
	}
	if msgs[0].Role != agent.RoleUser || msgs[0].Content != "上一条问句" {
		t.Fatalf("msgs[0] wrong: %+v", msgs[0])
	}
	if msgs[1].Role != agent.RoleAssistant {
		t.Fatalf("msgs[1] role expected assistant, got %s", msgs[1].Role)
	}
	if msgs[2].Role != agent.RoleSystem {
		t.Fatalf("msgs[2] role expected system, got %s", msgs[2].Role)
	}
	if msgs[3].Role != agent.RoleAssistant {
		t.Fatalf("msgs[3] should be assistant (AI alias), got %s", msgs[3].Role)
	}
	if msgs[4].Role != agent.RoleUser || msgs[4].Content != "帮我记一下今天买了 30 元的咖啡" {
		t.Fatalf("last message should be current user input, got %+v", msgs[4])
	}
}

func TestBuildLifeTraceAssistantAgentMessagesTrimsEmpty(t *testing.T) {
	req := lifeTraceAssistantRequest{Message: "  ", History: []lifeTraceAssistantMessage{{Role: "user", Content: ""}}}
	msgs := buildLifeTraceAssistantAgentMessages(req)
	if len(msgs) != 0 {
		t.Fatalf("expected empty messages, got %d", len(msgs))
	}
}

func TestExtractAssistantActionPayload(t *testing.T) {
	payload := &lifeTraceAssistantActionPayload{
		Type:    "create_ledger_entry",
		Status:  "created",
		Message: "已经帮你记账。",
	}
	envelope := map[string]any{
		"ok":      true,
		"status":  "created",
		"message": "已经帮你记账。",
		"payload": payload,
	}
	raw, _ := json.Marshal(envelope)

	got := extractAssistantActionPayload("create_ledger_entry", raw)
	if got == nil {
		t.Fatalf("expected non-nil payload")
	}
	if got.Type != "create_ledger_entry" || got.Status != "created" {
		t.Fatalf("unexpected payload: %+v", got)
	}

	if extractAssistantActionPayload("query_recent_traces", raw) != nil {
		t.Fatalf("query tool should not surface action payload")
	}

	badEnvelope := json.RawMessage(`{"ok":false,"error":"boom"}`)
	if got := extractAssistantActionPayload("create_plan", badEnvelope); got != nil {
		t.Fatalf("no-payload envelope should return nil, got %+v", got)
	}

	if extractAssistantActionPayload("create_plan", nil) != nil {
		t.Fatalf("nil raw should return nil")
	}

	if extractAssistantActionPayload("create_plan", json.RawMessage(`invalid json`)) != nil {
		t.Fatalf("invalid json should return nil, not panic")
	}
}

func TestBuildAssistantThinkingCall(t *testing.T) {
	step := buildAssistantThinkingCall(2, "query_recent_traces")
	if step == nil || step.Phase != "call" || step.Step != 2 {
		t.Fatalf("unexpected step: %+v", step)
	}
	if step.Tool != "query_recent_traces" || step.Label != "查询最近踪迹" {
		t.Fatalf("label mapping wrong: %+v", step)
	}
	if step.OK != nil {
		t.Fatalf("call phase should not carry ok flag, got %+v", step.OK)
	}

	fallback := buildAssistantThinkingCall(1, "unknown_tool")
	if fallback.Label != "unknown_tool" {
		t.Fatalf("fallback label should equal tool name, got %q", fallback.Label)
	}
}

func TestBuildAssistantThinkingResultSuccess(t *testing.T) {
	raw := json.RawMessage(`{"ok":true,"message":"已经帮你记账。"}`)
	step := buildAssistantThinkingResult(3, "create_ledger_entry", raw)
	if step == nil || step.Phase != "result" || step.Step != 3 {
		t.Fatalf("unexpected step: %+v", step)
	}
	if step.OK == nil || !*step.OK {
		t.Fatalf("ok flag should be true, got %+v", step.OK)
	}
	if step.Summary != "已经帮你记账。" {
		t.Fatalf("summary mismatch: %q", step.Summary)
	}
	if step.Label != "记一笔账" {
		t.Fatalf("label mismatch: %q", step.Label)
	}
}

func TestBuildAssistantThinkingResultFailureFallsBackToError(t *testing.T) {
	raw := json.RawMessage(`{"ok":false,"error":"boom"}`)
	step := buildAssistantThinkingResult(1, "create_plan", raw)
	if step.OK == nil || *step.OK {
		t.Fatalf("ok flag should be false, got %+v", step.OK)
	}
	if step.Summary != "boom" {
		t.Fatalf("failure summary should fallback to error, got %q", step.Summary)
	}
}

func TestBuildAssistantThinkingResultMissingOKDefaultsTrue(t *testing.T) {
	step := buildAssistantThinkingResult(1, "query_recent_traces", json.RawMessage(`{"payload":{}}`))
	if step.OK == nil || !*step.OK {
		t.Fatalf("missing ok should default to true, got %+v", step.OK)
	}
	if step.Summary != "" {
		t.Fatalf("summary should be empty when message missing, got %q", step.Summary)
	}
}
