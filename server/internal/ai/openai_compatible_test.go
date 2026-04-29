package ai

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
)

func TestDefaultAIBaseURL(t *testing.T) {
	t.Parallel()

	if got := defaultAIBaseURL(AIProviderDoubao, ""); got != "https://ark.cn-beijing.volces.com/api/v3" {
		t.Fatalf("doubao default base url = %q", got)
	}

	if got := defaultAIBaseURL(AIProviderOpenAICompatible, ""); got != "https://api.openai.com/v1" {
		t.Fatalf("openai-compatible default base url = %q", got)
	}

	if got := defaultAIBaseURL(AIProviderDoubao, "https://example.com/v1/"); got != "https://example.com/v1" {
		t.Fatalf("custom base url should trim trailing slash, got %q", got)
	}
}

func TestNewOpenAICompatibleServiceDefaults(t *testing.T) {
	t.Parallel()

	doubaoService := NewOpenAICompatibleService(OpenAICompatibleConfig{
		Provider: AIProviderDoubao,
		APIKey:   "test-key",
	})
	if doubaoService.baseURL != "https://ark.cn-beijing.volces.com/api/v3" {
		t.Fatalf("unexpected doubao base url: %q", doubaoService.baseURL)
	}
	if doubaoService.model != "" {
		t.Fatalf("doubao service should require explicit model, got %q", doubaoService.model)
	}

	openAIService := NewOpenAICompatibleService(OpenAICompatibleConfig{
		Provider: AIProviderOpenAICompatible,
		APIKey:   "test-key",
	})
	if openAIService.baseURL != "https://api.openai.com/v1" {
		t.Fatalf("unexpected openai base url: %q", openAIService.baseURL)
	}
	if openAIService.model != "gpt-4o-mini" {
		t.Fatalf("unexpected openai default model: %q", openAIService.model)
	}
}

func TestChatJSONRejectsEmptyDoubaoModel(t *testing.T) {
	t.Parallel()

	service := NewOpenAICompatibleService(OpenAICompatibleConfig{
		Provider: AIProviderDoubao,
		APIKey:   "test-key",
	})

	var out map[string]any
	err := service.chatJSON(context.Background(), "system", "user", &out)
	if err == nil || err.Error() != "AI_MODEL is empty for doubao provider" {
		t.Fatalf("expected doubao empty model error, got %v", err)
	}
}

func TestChatJSONRetriesWithoutResponseFormatWhenUnsupported(t *testing.T) {
	t.Parallel()

	var attempts int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		attempt := atomic.AddInt32(&attempts, 1)
		var payload map[string]any
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			t.Fatalf("decode request body failed: %v", err)
		}

		if attempt == 1 {
			if _, ok := payload["response_format"]; !ok {
				t.Fatalf("expected first request to carry response_format")
			}
			w.WriteHeader(http.StatusBadRequest)
			fmt.Fprint(w, `{"error":{"code":"InvalidParameter","message":"response_format.type is not supported by this model","param":"response_format.type"}}`)
			return
		}

		if _, ok := payload["response_format"]; ok {
			t.Fatalf("expected retry request without response_format")
		}
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprint(w, `{"choices":[{"message":{"role":"assistant","content":"{\"ok\":true}"}}]}`)
	}))
	defer server.Close()

	service := NewOpenAICompatibleService(OpenAICompatibleConfig{
		Provider: AIProviderDoubao,
		BaseURL:  server.URL,
		APIKey:   "test-key",
		Model:    "ep-test",
	})

	var out map[string]any
	if err := service.chatJSON(context.Background(), "system", "user", &out); err != nil {
		t.Fatalf("expected retry success, got error: %v", err)
	}
	if got := int(attempts); got != 2 {
		t.Fatalf("expected 2 attempts, got %d", got)
	}
	if out["ok"] != true {
		t.Fatalf("expected parsed JSON body, got %#v", out)
	}
}

func TestShouldRetryWithoutResponseFormat(t *testing.T) {
	t.Parallel()

	if !shouldRetryWithoutResponseFormat(http.StatusBadRequest, []byte(`{"error":{"message":"response_format.type is not supported by this model"}}`)) {
		t.Fatal("expected unsupported response_format to trigger retry")
	}
	if shouldRetryWithoutResponseFormat(http.StatusBadRequest, []byte(`{"error":{"message":"invalid api key"}}`)) {
		t.Fatal("unexpected retry for unrelated bad request")
	}
}
