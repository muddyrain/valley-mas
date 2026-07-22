package handler

import (
	"context"
	"errors"
	"testing"

	"valley-server/internal/aiclient"
)

type fakeAIModelProbeClient struct {
	request        aiclient.CompatibleChatRequest
	embeddingModel string
	embeddingInput []string
	imageModel     string
	imagePrompt    string
	imageSize      string
	err            error
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

func (client *fakeAIModelProbeClient) Embeddings(_ context.Context, modelID string, inputs []string) (aiclient.CompatibleEmbeddingResponse, error) {
	client.embeddingModel = modelID
	client.embeddingInput = inputs
	if client.err != nil {
		return aiclient.CompatibleEmbeddingResponse{}, client.err
	}
	return aiclient.CompatibleEmbeddingResponse{Data: []struct {
		Embedding []float32 `json:"embedding"`
		Index     int       `json:"index"`
	}{{Embedding: []float32{0.1}, Index: 0}}}, nil
}

func (client *fakeAIModelProbeClient) GenerateImage(_ context.Context, modelID, prompt, imageSize string) (string, error) {
	client.imageModel = modelID
	client.imagePrompt = prompt
	client.imageSize = imageSize
	if client.err != nil {
		return "", client.err
	}
	return "https://provider.test/image.png", nil
}

func TestProbeAIModelUsesMinimalInferenceRequest(t *testing.T) {
	client := &fakeAIModelProbeClient{}
	latency, err := probeAIModel(context.Background(), client, "deepseek-ai/DeepSeek-V3", []string{"text"})
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

func TestProbeAIModelUsesImageGenerationEndpoint(t *testing.T) {
	client := &fakeAIModelProbeClient{}
	_, err := probeAIModel(context.Background(), client, "Kwai-Kolors/Kolors", []string{"image_generation"})
	if err != nil {
		t.Fatal(err)
	}
	if client.imageModel != "Kwai-Kolors/Kolors" || client.imageSize != "1024x1024" {
		t.Fatalf("image probe = model %q, size %q", client.imageModel, client.imageSize)
	}
	if client.imagePrompt == "" {
		t.Fatal("image probe prompt is empty")
	}
	if client.request.Model != "" {
		t.Fatalf("chat request should not be sent: %+v", client.request)
	}
}

func TestProbeAIModelUsesEmbeddingEndpoint(t *testing.T) {
	client := &fakeAIModelProbeClient{}
	_, err := probeAIModel(context.Background(), client, "BAAI/bge-m3", []string{"embedding"})
	if err != nil {
		t.Fatal(err)
	}
	if client.embeddingModel != "BAAI/bge-m3" || len(client.embeddingInput) != 1 || client.embeddingInput[0] != "ping" {
		t.Fatalf("embedding probe = model %q, input %+v", client.embeddingModel, client.embeddingInput)
	}
}

func TestProbeAIModelReturnsUpstreamError(t *testing.T) {
	upstreamErr := errors.New("upstream unavailable")
	client := &fakeAIModelProbeClient{err: upstreamErr}
	_, err := probeAIModel(context.Background(), client, "text-model", []string{"text"})
	if !errors.Is(err, upstreamErr) {
		t.Fatalf("error = %v", err)
	}
}
