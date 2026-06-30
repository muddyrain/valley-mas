package aiclient

import (
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestNewSSEWriterSetsHeaders(t *testing.T) {
	gin.SetMode(gin.TestMode)
	rec := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(rec)

	w, err := NewSSEWriter(c)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if w == nil {
		t.Fatal("expected writer")
	}

	checks := map[string]string{
		"Content-Type":      "text/event-stream",
		"Cache-Control":     "no-cache",
		"Connection":        "keep-alive",
		"X-Accel-Buffering": "no",
	}
	for k, v := range checks {
		if got := c.Writer.Header().Get(k); got != v {
			t.Fatalf("header %s = %q want %q", k, got, v)
		}
	}
}

func TestSSEWriterSendWritesDataFrames(t *testing.T) {
	gin.SetMode(gin.TestMode)
	rec := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(rec)

	w, err := NewSSEWriter(c)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if err := w.Send(map[string]any{"chunk": "hello", "done": false}); err != nil {
		t.Fatalf("Send err: %v", err)
	}
	if err := w.Send(map[string]any{"done": true}); err != nil {
		t.Fatalf("Send err: %v", err)
	}

	body := rec.Body.String()
	if !strings.Contains(body, `data: {`) {
		t.Fatalf("expected data prefix, body=%q", body)
	}
	if strings.Count(body, "\n\n") < 2 {
		t.Fatalf("expected 2 frames separated by blank line, body=%q", body)
	}
	if !strings.Contains(body, `"chunk":"hello"`) {
		t.Fatalf("expected first payload, body=%q", body)
	}
	if !strings.Contains(body, `"done":true`) {
		t.Fatalf("expected second payload, body=%q", body)
	}
}

func TestSSEWriterSendMarshalError(t *testing.T) {
	gin.SetMode(gin.TestMode)
	rec := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(rec)

	w, err := NewSSEWriter(c)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	// chan 类型 json.Marshal 会失败
	if err := w.Send(map[string]any{"bad": make(chan int)}); err == nil {
		t.Fatal("expected marshal error")
	}
	if rec.Body.Len() != 0 {
		t.Fatalf("expected no body written on marshal error, got %q", rec.Body.String())
	}
}
