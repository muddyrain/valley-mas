package ai

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestGenerateVisionJSONUsesGeminiInlineImage(t *testing.T) {
	var capturedPath string
	var capturedKey string
	var capturedBody map[string]any
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		capturedPath = r.URL.Path
		capturedKey = r.Header.Get("x-goog-api-key")
		if err := json.NewDecoder(r.Body).Decode(&capturedBody); err != nil {
			t.Fatalf("decode request body: %v", err)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"candidates":[{"content":{"parts":[{"text":"{\"name\":\"牛奶\"}"}]}}]}`))
	}))
	defer server.Close()

	result, err := NewClient().GenerateVisionJSON(context.Background(), ImageConfig{
		Source:    "gemini",
		APIKey:    "gemini-key",
		BaseURL:   server.URL,
		Model:     "gemini-test",
		Timeout:   time.Second,
		UseVision: true,
	}, VisionRequest{
		ImageInput:  "data:image/png;base64,aW1hZ2U=",
		Prompt:      "只输出 JSON",
		MaxTokens:   128,
		Temperature: 0.2,
	})
	if err != nil {
		t.Fatalf("GenerateVisionJSON: %v", err)
	}

	if result.Source != "gemini" || result.Model != "gemini-test" || result.Content != `{"name":"牛奶"}` {
		t.Fatalf("unexpected result: %+v", result)
	}
	if capturedPath != "/models/gemini-test:generateContent" || capturedKey != "gemini-key" {
		t.Fatalf("unexpected Gemini endpoint: path=%q key=%q", capturedPath, capturedKey)
	}
	body, err := json.Marshal(capturedBody)
	if err != nil {
		t.Fatalf("marshal captured body: %v", err)
	}
	text := string(body)
	for _, want := range []string{
		`"mime_type":"image/png"`,
		`"data":"aW1hZ2U="`,
		`"responseMimeType":"application/json"`,
		`"text":"只输出 JSON"`,
	} {
		if !strings.Contains(text, want) {
			t.Fatalf("expected request body to contain %s, got %s", want, text)
		}
	}
}
