package handler

import (
	"context"
	"errors"
	"slices"
	"strings"
	"testing"

	"valley-server/internal/aiclient"
)

type fakeAIModelProbeClient struct {
	request         aiclient.CompatibleChatRequest
	embeddingModel  string
	embeddingInput  []string
	imageModel      string
	imagePrompt     string
	imageSize       string
	imageReferences []string
	err             error
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

func (client *fakeAIModelProbeClient) GenerateImageWithRequest(
	_ context.Context,
	request aiclient.ImageGenerationRequest,
) (string, error) {
	client.imageModel = request.ModelID
	client.imagePrompt = request.Prompt
	client.imageSize = request.Size
	client.imageReferences = request.Images
	if client.err != nil {
		return "", client.err
	}
	return "https://provider.test/image.png", nil
}

func TestProbeAIModelUsesMinimalInferenceRequest(t *testing.T) {
	client := &fakeAIModelProbeClient{}
	result, err := probeAIModel(context.Background(), client, "deepseek-ai/DeepSeek-V3", []string{"text"})
	if err != nil {
		t.Fatal(err)
	}
	if result.Latency < 0 {
		t.Fatalf("latency = %v", result.Latency)
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

func TestProbeAIModelUsesReferenceImageWhenDeclared(t *testing.T) {
	client := &fakeAIModelProbeClient{}
	result, err := probeAIModel(
		context.Background(),
		client,
		"gpt-image-2",
		[]string{"image_generation", "reference_image"},
	)
	if err != nil {
		t.Fatal(err)
	}
	if len(client.imageReferences) != 1 ||
		!strings.HasPrefix(client.imageReferences[0], "data:image/png;base64,") {
		t.Fatalf("reference probe missing: %+v", client.imageReferences)
	}
	if !slices.Equal(result.VerifiedCapabilities, []string{"image_generation", "reference_image"}) {
		t.Fatalf("verified capabilities = %+v", result.VerifiedCapabilities)
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

func TestNewAIModelRequiresImageGenerationForReferenceImage(t *testing.T) {
	_, err := newAIModel(adminAIModelRequest{
		Provider: "amux", ModelID: "gpt-image-2", Capabilities: []string{"reference_image"}, Enabled: true,
	})
	if err == nil {
		t.Fatal("expected reference_image dependency validation")
	}
	if _, err := newAIModel(adminAIModelRequest{
		Provider: "amux", ModelID: "gpt-image-2",
		Capabilities: []string{"image_generation", "reference_image"}, Enabled: true,
	}); err != nil {
		t.Fatalf("valid image model rejected: %v", err)
	}
}

func TestAIModelVerificationStatusTracksPartialCapabilities(t *testing.T) {
	if status := aiModelVerificationStatus(
		[]string{"text", "vision"},
		[]string{"text"},
	); status != "partial" {
		t.Fatalf("status = %q", status)
	}
	if status := aiModelVerificationStatus(
		[]string{"image_generation", "reference_image"},
		[]string{"image_generation", "reference_image"},
	); status != "verified" {
		t.Fatalf("status = %q", status)
	}
}
