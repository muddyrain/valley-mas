package ai

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"valley-server/internal/aiclient"

	"github.com/gin-gonic/gin"
)

func newSSERecorder(t *testing.T) (*aiclient.SSEWriter, *httptest.ResponseRecorder) {
	t.Helper()
	rec := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(rec)
	w, err := aiclient.NewSSEWriter(c)
	if err != nil {
		t.Fatalf("NewSSEWriter: %v", err)
	}
	return w, rec
}

func TestClient_StreamAssistantOpenAI_Success(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		w.WriteHeader(http.StatusOK)
		flusher, ok := w.(http.Flusher)
		if !ok {
			t.Fatalf("test server writer not flusher")
		}
		frames := []string{
			`data: {"model":"m1","choices":[{"delta":{"content":"你好"}}]}` + "\n\n",
			`data: {"model":"m1","choices":[{"delta":{"content":"世界"}}]}` + "\n\n",
			`data: {"model":"m1","choices":[{"delta":{},"finish_reason":"stop"}]}` + "\n\n",
			"data: [DONE]\n\n",
		}
		for _, f := range frames {
			_, _ = w.Write([]byte(f))
			flusher.Flush()
		}
	}))
	defer server.Close()

	sseW, rec := newSSERecorder(t)
	beforeDoneCalled := false
	err := NewClient().StreamAssistantOpenAI(
		context.Background(),
		sseW,
		TextConfig{
			Source:  "openai",
			APIKey:  "sk-test",
			BaseURL: server.URL,
			Model:   "m1",
			Timeout: 5 * time.Second,
		},
		AssistantStreamOptions{
			System: "sys",
			User:   "user",
			BeforeDone: func(w *aiclient.SSEWriter) {
				beforeDoneCalled = true
				_ = w.Send(map[string]any{"tag": "action"})
			},
		},
	)
	if err != nil {
		t.Fatalf("unexpected err: %v", err)
	}
	body := rec.Body.String()
	if !strings.Contains(body, `"chunk":"你好"`) {
		t.Fatalf("missing chunk 你好: %s", body)
	}
	if !strings.Contains(body, `"chunk":"世界"`) {
		t.Fatalf("missing chunk 世界: %s", body)
	}
	if !strings.Contains(body, `"tag":"action"`) {
		t.Fatalf("beforeDone action frame missing: %s", body)
	}
	if !strings.Contains(body, `"done":true`) {
		t.Fatalf("done frame missing: %s", body)
	}
	if !beforeDoneCalled {
		t.Fatalf("beforeDone not called")
	}
	// beforeDone 必须在 done chunk 之前
	actionIdx := strings.Index(body, `"tag":"action"`)
	doneIdx := strings.Index(body, `"done":true`)
	if actionIdx < 0 || doneIdx < 0 || actionIdx > doneIdx {
		t.Fatalf("beforeDone should fire before done frame; body: %s", body)
	}
}

func TestClient_StreamAssistantOpenAI_UpstreamErrorEmitsErrorFrame(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		_, _ = w.Write([]byte(`{"error":"context length exceeded"}`))
	}))
	defer server.Close()

	sseW, rec := newSSERecorder(t)
	beforeDoneCalled := false
	err := NewClient().StreamAssistantOpenAI(
		context.Background(),
		sseW,
		TextConfig{
			Source:  "openai",
			APIKey:  "sk-test",
			BaseURL: server.URL,
			Model:   "m1",
			Timeout: 5 * time.Second,
		},
		AssistantStreamOptions{
			System:     "sys",
			User:       "user",
			BeforeDone: func(w *aiclient.SSEWriter) { beforeDoneCalled = true },
		},
	)
	if err != nil {
		t.Fatalf("unexpected err: %v", err)
	}
	body := rec.Body.String()
	if !strings.Contains(body, `"error":"AI 服务请求失败：OpenAI upstream returned 400`) {
		t.Fatalf("missing upstream error frame: %s", body)
	}
	if !strings.Contains(body, `"done":true`) {
		t.Fatalf("missing done=true in error frame: %s", body)
	}
	if beforeDoneCalled {
		t.Fatalf("beforeDone should not fire on upstream error")
	}
}
