package ai

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"valley-server/internal/aiclient"
)

func TestClient_CallAssistantStructured_OpenAIToolSuccess(t *testing.T) {
	var capturedPath string
	var capturedBody aiclient.OpenAIRequest
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		capturedPath = r.URL.Path
		raw, _ := io.ReadAll(r.Body)
		if err := json.Unmarshal(raw, &capturedBody); err != nil {
			t.Fatalf("decode request: %v", err)
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{
			"model": "test-model",
			"choices": [{
				"message": {
					"role": "assistant",
					"tool_calls": [{
						"type": "function",
						"function": {"name": "assistant_submit", "arguments": "{\"reply\":\"你好\",\"action\":{\"type\":\"none\"}}"}
					}]
				}
			}]
		}`))
	}))
	defer server.Close()

	cfg := TextConfig{
		Source:  "openai",
		APIKey:  "sk-test",
		BaseURL: server.URL,
		Model:   "test-model",
		Timeout: 5 * time.Second,
	}
	result, err := NewClient().CallAssistantStructured(
		context.Background(),
		cfg,
		"你是生活助理",
		"用户问：明天几点提醒我?",
		AssistantCallOptions{
			ToolName:   "assistant_submit",
			ToolSchema: map[string]any{"type": "object"},
			MaxTokens:  420,
		},
	)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if capturedPath != "/chat/completions" {
		t.Fatalf("unexpected path: %s", capturedPath)
	}
	if len(capturedBody.Tools) != 1 || capturedBody.Tools[0].Function.Name != "assistant_submit" {
		t.Fatalf("tool schema not injected: %+v", capturedBody.Tools)
	}
	if capturedBody.MaxTokens != 420 {
		t.Fatalf("MaxTokens=%d want 420", capturedBody.MaxTokens)
	}
	if !strings.Contains(result.Content, "\"reply\":\"你好\"") {
		t.Fatalf("unexpected content: %s", result.Content)
	}
	if result.Model != "test-model" {
		t.Fatalf("model=%s want test-model", result.Model)
	}
	if result.Source != "openai" {
		t.Fatalf("source=%s want openai", result.Source)
	}
}

func TestClient_CallAssistantStructured_OpenAIToolUnsupportedFallbackToJSON(t *testing.T) {
	var (
		toolAttempted bool
		jsonAttempted bool
	)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		raw, _ := io.ReadAll(r.Body)
		var payload aiclient.OpenAIRequest
		if err := json.Unmarshal(raw, &payload); err != nil {
			t.Fatalf("decode request: %v", err)
		}
		if len(payload.Tools) > 0 {
			toolAttempted = true
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusBadRequest)
			_, _ = w.Write([]byte(`{"error":{"message":"tools not supported by this model","type":"invalid_request_error"}}`))
			return
		}
		jsonAttempted = true
		if payload.ResponseFormat == nil || payload.ResponseFormat.Type != "json_object" {
			t.Fatalf("expected JSON mode fallback, got %+v", payload.ResponseFormat)
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{
			"model": "test-json-model",
			"choices": [{"message": {"role":"assistant","content":"{\"reply\":\"降级成功\",\"action\":{\"type\":\"none\"}}"}}]
		}`))
	}))
	defer server.Close()

	cfg := TextConfig{
		Source:  "openai",
		APIKey:  "sk-test",
		BaseURL: server.URL,
		Model:   "test-model",
		Timeout: 5 * time.Second,
	}
	result, err := NewClient().CallAssistantStructured(
		context.Background(),
		cfg,
		"你是生活助理",
		"用户问：明天几点提醒我?",
		AssistantCallOptions{
			ToolName:   "assistant_submit",
			ToolSchema: map[string]any{"type": "object"},
		},
	)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !toolAttempted {
		t.Fatalf("tool 请求未尝试")
	}
	if !jsonAttempted {
		t.Fatalf("JSON 降级未触发")
	}
	if !strings.Contains(result.Content, "\"reply\":\"降级成功\"") {
		t.Fatalf("unexpected content: %s", result.Content)
	}
	if result.Model != "test-json-model" {
		t.Fatalf("model=%s want test-json-model", result.Model)
	}
	if result.Source != "openai" {
		t.Fatalf("source=%s want openai", result.Source)
	}
}

func TestClient_CallAssistantStructured_OpenAIUnrelated400NotFallback(t *testing.T) {
	requests := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requests++
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		_, _ = w.Write([]byte(`{"error":{"message":"context length exceeded"}}`))
	}))
	defer server.Close()

	cfg := TextConfig{
		Source:  "openai",
		APIKey:  "sk-test",
		BaseURL: server.URL,
		Model:   "test-model",
		Timeout: 5 * time.Second,
	}
	_, err := NewClient().CallAssistantStructured(
		context.Background(),
		cfg,
		"sys",
		"user",
		AssistantCallOptions{
			ToolName:   "assistant_submit",
			ToolSchema: map[string]any{"type": "object"},
		},
	)
	if err == nil {
		t.Fatalf("expected error for unrelated 400")
	}
	if requests != 1 {
		t.Fatalf("expected 1 request, got %d (should not fall back to JSON)", requests)
	}
	if !strings.Contains(err.Error(), "OpenAI upstream returned 400") {
		t.Fatalf("unexpected error: %v", err)
	}
}
