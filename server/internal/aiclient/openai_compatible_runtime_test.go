package aiclient

import (
	"context"
	"io"
	"net/http"
	"strings"
	"testing"
	"time"
)

type roundTripFunc func(*http.Request) (*http.Response, error)

func (fn roundTripFunc) RoundTrip(request *http.Request) (*http.Response, error) { return fn(request) }

func testCompatibleClient(t *testing.T, body string) *CompatibleClient {
	t.Helper()
	return &CompatibleClient{BaseURL: "https://provider.test/v1", APIKey: "test-key", Client: &http.Client{Timeout: time.Second, Transport: roundTripFunc(func(request *http.Request) (*http.Response, error) {
		if got := request.Header.Get("Authorization"); got != "Bearer test-key" {
			t.Fatalf("authorization = %q", got)
		}
		return &http.Response{StatusCode: http.StatusOK, Header: make(http.Header), Body: io.NopCloser(strings.NewReader(body)), Request: request}, nil
	})}}
}

func TestCompatibleClientChatNormalizesUsage(t *testing.T) {
	client := testCompatibleClient(t, `{"model":"text-model","choices":[{"message":{"role":"assistant","content":"你好"}}],"usage":{"prompt_tokens":3,"completion_tokens":2,"total_tokens":5}}`)
	response, err := client.Chat(context.Background(), CompatibleChatRequest{Model: "text-model", Messages: []CompatibleMessage{{Role: "user", Content: "hello"}}})
	if err != nil {
		t.Fatal(err)
	}
	if response.Usage.TotalTokens != 5 {
		t.Fatalf("usage = %+v", response.Usage)
	}
	if content, _ := response.Choices[0].Message.Content.(string); content != "你好" {
		t.Fatalf("content = %q", content)
	}
}

func TestCompatibleClientEmbeddingsRejectsIncompleteResponse(t *testing.T) {
	client := testCompatibleClient(t, `{"data":[{"index":0,"embedding":[0.1]}]}`)
	if _, err := client.Embeddings(context.Background(), "embedding", []string{"one", "two"}); err == nil {
		t.Fatal("expected incomplete response error")
	}
}

func TestCompatibleClientGenerateImageUsesImageEndpoint(t *testing.T) {
	client := &CompatibleClient{BaseURL: "https://provider.test/v1", APIKey: "test-key", Client: &http.Client{Timeout: time.Second, Transport: roundTripFunc(func(request *http.Request) (*http.Response, error) {
		if request.URL.Path != "/v1/images/generations" {
			t.Fatalf("path = %q", request.URL.Path)
		}
		return &http.Response{StatusCode: http.StatusOK, Header: make(http.Header), Body: io.NopCloser(strings.NewReader(`{"images":[{"url":"https://provider.test/image.png"}]}`)), Request: request}, nil
	})}}

	url, err := client.GenerateImage(context.Background(), "Kwai-Kolors/Kolors", "blue circle", "1024x1024")
	if err != nil {
		t.Fatal(err)
	}
	if url != "https://provider.test/image.png" {
		t.Fatalf("url = %q", url)
	}
}

func TestCompatibleClientChatStreamEmitsContent(t *testing.T) {
	client := testCompatibleClient(t, "data: {\"model\":\"text\",\"choices\":[{\"delta\":{\"role\":\"assistant\",\"content\":\"你好\"}}]}\n\ndata: [DONE]\n")
	var content string
	err := client.ChatStream(context.Background(), CompatibleChatRequest{Model: "text", Messages: []CompatibleMessage{{Role: "user", Content: "hello"}}}, func(chunk CompatibleChatStreamChunk) error {
		if len(chunk.Choices) > 0 {
			if value, ok := chunk.Choices[0].Delta.Content.(string); ok {
				content += value
			}
		}
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
	if content != "你好" {
		t.Fatalf("content = %q", content)
	}
}
