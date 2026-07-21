package agent

import (
	"context"
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
