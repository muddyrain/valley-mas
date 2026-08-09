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
	imageMask       string
	chatResponse    string
	embedding       []float32
	err             error
}

func (client *fakeAIModelProbeClient) Chat(_ context.Context, request aiclient.CompatibleChatRequest) (aiclient.CompatibleChatResponse, error) {
	client.request = request
	if client.err != nil {
		return aiclient.CompatibleChatResponse{}, client.err
	}
	response := client.chatResponse
	if response == "" {
		response = "ok"
	}
	return aiclient.CompatibleChatResponse{Choices: []struct {
		Message aiclient.CompatibleMessage `json:"message"`
	}{{Message: aiclient.CompatibleMessage{Role: "assistant", Content: response}}}}, nil
}

func (client *fakeAIModelProbeClient) Embeddings(_ context.Context, modelID string, inputs []string) (aiclient.CompatibleEmbeddingResponse, error) {
	client.embeddingModel = modelID
	client.embeddingInput = inputs
	if client.err != nil {
		return aiclient.CompatibleEmbeddingResponse{}, client.err
	}
	embedding := client.embedding
	if len(embedding) == 0 {
		embedding = []float32{0.1}
	}
	return aiclient.CompatibleEmbeddingResponse{Data: []struct {
		Embedding []float32 `json:"embedding"`
		Index     int       `json:"index"`
	}{{Embedding: embedding, Index: 0}}}, nil
}

func (client *fakeAIModelProbeClient) GenerateImageWithRequest(
	_ context.Context,
	request aiclient.ImageGenerationRequest,
) (string, error) {
	client.imageModel = request.ModelID
	client.imagePrompt = request.Prompt
	client.imageSize = request.Size
	client.imageReferences = request.Images
	client.imageMask = request.Mask
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

func TestProbeAIModelUsesSeedream5MinimumSize(t *testing.T) {
	client := &fakeAIModelProbeClient{}
	_, err := probeAIModel(context.Background(), client, "doubao-seedream-5-0-260128", []string{"image_generation"})
	if err != nil {
		t.Fatal(err)
	}
	if client.imageSize != "2K" {
		t.Fatalf("Seedream 5 probe size = %q", client.imageSize)
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

func TestProbeAIModelUsesMaskForDeclaredMaskedEdit(t *testing.T) {
	client := &fakeAIModelProbeClient{}
	result, err := probeAIModel(
		context.Background(),
		client,
		"gpt-image-2",
		[]string{"image_generation", "reference_image", "masked_edit", "outpainting"},
	)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(client.imageMask, "data:image/png;base64,") {
		t.Fatalf("mask probe missing: %q", client.imageMask)
	}
	if !slices.Equal(result.VerifiedCapabilities, []string{"image_generation", "reference_image", "masked_edit", "outpainting"}) {
		t.Fatalf("verified capabilities = %+v", result.VerifiedCapabilities)
	}
}

func TestProbeAIModelUsesEmbeddingEndpoint(t *testing.T) {
	client := &fakeAIModelProbeClient{embedding: make([]float32, 1024)}
	result, err := probeAIModel(context.Background(), client, "BAAI/bge-m3", []string{"embedding"})
	if err != nil {
		t.Fatal(err)
	}
	if client.embeddingModel != "BAAI/bge-m3" || len(client.embeddingInput) != 1 || client.embeddingInput[0] != "ping" {
		t.Fatalf("embedding probe = model %q, input %+v", client.embeddingModel, client.embeddingInput)
	}
	if result.EmbeddingDimension != 1024 {
		t.Fatalf("embedding dimension = %d", result.EmbeddingDimension)
	}
}

func TestProbeAIModelVerifiesVisionWithImageContent(t *testing.T) {
	client := &fakeAIModelProbeClient{chatResponse: "RED, BLUE, GREEN, YELLOW"}
	result, err := probeAIModel(context.Background(), client, "vision-model", []string{"text", "vision"})
	if err != nil {
		t.Fatal(err)
	}
	if client.request.MaxTokens == nil || *client.request.MaxTokens != 16 {
		t.Fatalf("maxTokens = %v", client.request.MaxTokens)
	}
	if len(client.request.Messages) != 1 {
		t.Fatalf("messages = %+v", client.request.Messages)
	}
	parts, ok := client.request.Messages[0].Content.([]map[string]any)
	if !ok || len(parts) != 2 {
		t.Fatalf("vision content = %#v", client.request.Messages[0].Content)
	}
	imageURL, _ := parts[0]["image_url"].(map[string]string)
	if !strings.HasPrefix(imageURL["url"], "data:image/png;base64,") {
		t.Fatalf("vision image = %#v", parts[0])
	}
	if !slices.Equal(result.VerifiedCapabilities, []string{"vision", "text"}) {
		t.Fatalf("verified capabilities = %+v", result.VerifiedCapabilities)
	}
}

func TestProbeAIModelRejectsInvalidVisionAnswer(t *testing.T) {
	client := &fakeAIModelProbeClient{chatResponse: "BLUE"}
	_, err := probeAIModel(context.Background(), client, "vision-model", []string{"vision"})
	if err == nil || !strings.Contains(err.Error(), "未正确识别") {
		t.Fatalf("error = %v", err)
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

func TestNewAIModelAcceptsReferenceVideoGeneration(t *testing.T) {
	item, err := newAIModel(adminAIModelRequest{
		Provider: "amux", ModelID: "doubao-seedance-2.0-fast",
		Capabilities: []string{"video_generation", "reference_image"}, VideoProtocol: "amux_video", Enabled: true,
	})
	if err != nil {
		t.Fatal(err)
	}
	if item.VideoProtocol != "amux_video" {
		t.Fatalf("unexpected video protocol: %s", item.VideoProtocol)
	}
}

func TestNewAIModelAcceptsVolcengineProvider(t *testing.T) {
	item, err := newAIModel(adminAIModelRequest{
		Provider: "volcengine", ModelID: "doubao-seed-2-0-lite-260215",
		Capabilities: []string{"text"}, Enabled: true,
	})
	if err != nil {
		t.Fatal(err)
	}
	if item.Provider != "volcengine" {
		t.Fatalf("unexpected provider: %s", item.Provider)
	}
}

func TestNewAIModelRejectsLegacyARKProvider(t *testing.T) {
	_, err := newAIModel(adminAIModelRequest{
		Provider: "ark", ModelID: "ep-legacy", Capabilities: []string{"text"}, Enabled: true,
	})
	if err == nil {
		t.Fatal("expected legacy ark provider to be rejected for new catalog entries")
	}
}

func TestNewAIModelKeepsOptionalTokenLimits(t *testing.T) {
	item, err := newAIModel(adminAIModelRequest{
		Provider: "siliconflow", ModelID: "text-model", Capabilities: []string{"text"}, Enabled: true,
		ContextWindowTokens: 128000, MaxOutputTokens: 8192,
	})
	if err != nil {
		t.Fatalf("create model: %v", err)
	}
	if item.ContextWindowTokens != 128000 || item.MaxOutputTokens != 8192 {
		t.Fatalf("unexpected token limits: context=%d output=%d", item.ContextWindowTokens, item.MaxOutputTokens)
	}
	if _, err := newAIModel(adminAIModelRequest{
		Provider: "siliconflow", ModelID: "invalid-model", Capabilities: []string{"text"}, Enabled: true,
		ContextWindowTokens: -1,
	}); err == nil {
		t.Fatal("expected negative token limit validation")
	}
}

func TestNewAIModelRequiresEmbeddingDimension(t *testing.T) {
	if _, err := newAIModel(adminAIModelRequest{
		Provider: "siliconflow", ModelID: "BAAI/bge-m3", Capabilities: []string{"embedding"}, Enabled: true,
	}); err == nil {
		t.Fatal("expected embedding dimension validation")
	}

	item, err := newAIModel(adminAIModelRequest{
		Provider: "siliconflow", ModelID: "BAAI/bge-m3", Capabilities: []string{"embedding"},
		EmbeddingDimension: 1024, Enabled: true,
	})
	if err != nil {
		t.Fatalf("valid embedding model rejected: %v", err)
	}
	if item.EmbeddingDimension != 1024 {
		t.Fatalf("embedding dimension = %d", item.EmbeddingDimension)
	}

	textModel, err := newAIModel(adminAIModelRequest{
		Provider: "siliconflow", ModelID: "text-model", Capabilities: []string{"text"},
		EmbeddingDimension: 384, Enabled: true,
	})
	if err != nil {
		t.Fatalf("text model rejected: %v", err)
	}
	if textModel.EmbeddingDimension != 0 {
		t.Fatalf("non-embedding model retained dimension = %d", textModel.EmbeddingDimension)
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
