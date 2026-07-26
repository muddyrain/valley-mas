package agent

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"valley-server/internal/aiclient"
)

func TestCompatibleBackendParsesToolCalls(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.URL.Path != "/chat/completions" {
			t.Fatalf("path = %s", request.URL.Path)
		}
		writer.Header().Set("Content-Type", "application/json")
		_, _ = writer.Write([]byte(`{"model":"catalog-text","choices":[{"message":{"role":"assistant","content":"","tool_calls":[{"id":"call-1","type":"function","function":{"name":"lookup","arguments":"{\"query\":\"hello\"}"}}]}}]}`))
	}))
	defer server.Close()

	backend := NewCompatibleBackend(aiclient.NewCompatibleClient(server.URL, "test-key", 0))
	response, err := backend.Chat(context.Background(), Spec{Model: "catalog-text"}, []Message{{Role: RoleUser, Content: "hello"}}, []ToolDescriptor{{Name: "lookup", Schema: map[string]any{"type": "object"}}})
	if err != nil {
		t.Fatalf("Chat() error = %v", err)
	}
	if len(response.Message.ToolCalls) != 1 || response.Message.ToolCalls[0].Name != "lookup" || !strings.Contains(string(response.Message.ToolCalls[0].Args), "hello") {
		t.Fatalf("tool calls = %#v", response.Message.ToolCalls)
	}
}

func writeCompatibleSSEFrame(t *testing.T, writer http.ResponseWriter, payload any) {
	t.Helper()
	encoded, err := json.Marshal(payload)
	if err != nil {
		t.Fatalf("marshal SSE frame: %v", err)
	}
	_, _ = writer.Write(append(append([]byte("data: "), encoded...), []byte("\n\n")...))
}

func TestCompatibleBackendStreamsTextDeltas(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		var payload struct {
			Stream bool `json:"stream"`
		}
		if err := json.NewDecoder(request.Body).Decode(&payload); err != nil {
			t.Fatalf("decode request: %v", err)
		}
		if !payload.Stream {
			t.Fatal("expected upstream streaming request")
		}
		writer.Header().Set("Content-Type", "text/event-stream")
		writeCompatibleSSEFrame(t, writer, map[string]any{"model": "catalog-text", "choices": []any{map[string]any{"delta": map[string]any{"content": "first"}}}})
		writeCompatibleSSEFrame(t, writer, map[string]any{"model": "catalog-text", "choices": []any{map[string]any{"delta": map[string]any{"content": " "}}}})
		writeCompatibleSSEFrame(t, writer, map[string]any{"model": "catalog-text", "choices": []any{map[string]any{"delta": map[string]any{"content": "second"}}}})
		_, _ = writer.Write([]byte("data: [DONE]\n\n"))
	}))
	defer server.Close()

	backend := NewCompatibleBackend(aiclient.NewCompatibleClient(server.URL, "test-key", 0))
	var deltas []string
	response, err := backend.ChatStream(
		context.Background(),
		Spec{Model: "catalog-text"},
		[]Message{{Role: RoleUser, Content: "hello"}},
		nil,
		func(delta string) { deltas = append(deltas, delta) },
	)
	if err != nil {
		t.Fatalf("ChatStream() error = %v", err)
	}
	if got := strings.Join(deltas, ""); got != "first second" {
		t.Fatalf("streamed content = %q", got)
	}
	if response.Message.Content != "first second" || response.Model != "catalog-text" {
		t.Fatalf("response = %#v", response)
	}
}

func TestCompatibleBackendAssemblesStreamedToolCalls(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) {
		writer.Header().Set("Content-Type", "text/event-stream")
		writeCompatibleSSEFrame(t, writer, map[string]any{
			"model": "catalog-text",
			"choices": []any{map[string]any{"delta": map[string]any{"tool_calls": []any{
				map[string]any{"index": 0, "id": "call-", "type": "function", "function": map[string]any{"name": "look", "arguments": "{\"query\":"}},
			}}}},
		})
		writeCompatibleSSEFrame(t, writer, map[string]any{
			"model": "catalog-text",
			"choices": []any{map[string]any{"delta": map[string]any{"tool_calls": []any{
				map[string]any{"index": 0, "id": "1", "function": map[string]any{"name": "up", "arguments": "\"hello\"}"}},
			}}}},
		})
		_, _ = writer.Write([]byte("data: [DONE]\n\n"))
	}))
	defer server.Close()

	backend := NewCompatibleBackend(aiclient.NewCompatibleClient(server.URL, "test-key", 0))
	response, err := backend.ChatStream(
		context.Background(),
		Spec{Model: "catalog-text"},
		[]Message{{Role: RoleUser, Content: "hello"}},
		[]ToolDescriptor{{Name: "lookup", Schema: map[string]any{"type": "object"}}},
		nil,
	)
	if err != nil {
		t.Fatalf("ChatStream() error = %v", err)
	}
	if len(response.Message.ToolCalls) != 1 {
		t.Fatalf("tool calls = %#v", response.Message.ToolCalls)
	}
	call := response.Message.ToolCalls[0]
	if call.ID != "call-1" || call.Name != "lookup" || string(call.Args) != `{"query":"hello"}` {
		t.Fatalf("assembled tool call = %#v", call)
	}
}
