package handler

import (
	"context"
	"errors"
	"testing"

	"valley-server/internal/aiclient"
)

type fakeAIModelProbeClient struct {
	request aiclient.CompatibleChatRequest
	err     error
}

func (client *fakeAIModelProbeClient) Chat(_ context.Context, request aiclient.CompatibleChatRequest) (aiclient.CompatibleChatResponse, error) {
	client.request = request
	if client.err != nil {
		return aiclient.CompatibleChatResponse{}, client.err
	}
	return aiclient.CompatibleChatResponse{Choices: []struct {
		Message aiclient.CompatibleMessage `json:"message"`
	}{{Message: aiclient.CompatibleMessage{Role: "assistant", Content: "ok"}}}}, nil
}

func TestProbeAIModelUsesMinimalInferenceRequest(t *testing.T) {
	client := &fakeAIModelProbeClient{}
	latency, err := probeAIModel(context.Background(), client, "deepseek-ai/DeepSeek-V3")
	if err != nil {
		t.Fatal(err)
	}
	if latency < 0 {
		t.Fatalf("latency = %v", latency)
	}
	if client.request.Model != "deepseek-ai/DeepSeek-V3" {
		t.Fatalf("model = %q", client.request.Model)
	}
	if client.request.MaxTokens == nil || *client.request.MaxTokens != 1 {
		t.Fatalf("maxTokens = %v", client.request.MaxTokens)
	}
	if client.request.Temperature == nil || *client.request.Temperature != 0 {
		t.Fatalf("temperature = %v", client.request.Temperature)
	}
	if len(client.request.Messages) != 1 || client.request.Messages[0].Content != "ping" {
		t.Fatalf("messages = %+v", client.request.Messages)
	}
}

func TestProbeAIModelReturnsUpstreamError(t *testing.T) {
	upstreamErr := errors.New("upstream unavailable")
	client := &fakeAIModelProbeClient{err: upstreamErr}
	_, err := probeAIModel(context.Background(), client, "text-model")
	if !errors.Is(err, upstreamErr) {
		t.Fatalf("error = %v", err)
	}
}
