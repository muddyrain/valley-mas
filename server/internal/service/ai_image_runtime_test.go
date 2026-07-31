package service

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"image"
	"image/png"
	"strings"
	"testing"
	"time"
	"valley-server/internal/aiclient"
	"valley-server/internal/aimodel"
	"valley-server/internal/aiusage"
	"valley-server/internal/model"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

const onePixelPNGBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="

func newAIImageRuntimeTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(&model.AIImageGeneration{}, &model.AISkill{}); err != nil {
		t.Fatal(err)
	}
	return db
}

func testImageInvocation() aimodel.Invocation {
	return aimodel.Invocation{
		Model: model.AIModel{
			ID:           7,
			ModelID:      "test-image-model",
			Capabilities: `["image_generation"]`,
		},
		Provider: aimodel.ProviderConfig{Provider: "test"},
	}
}

func TestAIImageGenerationSourceForAgentFeature(t *testing.T) {
	if got := AIImageGenerationSourceForFeature("ai-agent-image-generation"); got != AIImageGenerationSourceAgent {
		t.Fatalf("agent image generation source = %q", got)
	}
	if !IsAIImageGenerationSource(AIImageGenerationSourceAgent) {
		t.Fatal("agent image source should be valid")
	}
}

func TestAIImageGenerationServiceGeneratePersistsStoredResult(t *testing.T) {
	db := newAIImageRuntimeTestDB(t)
	prompt := strings.Repeat("complete imported skill content\n", 500)
	imageBytes, err := base64.StdEncoding.DecodeString(onePixelPNGBase64)
	if err != nil {
		t.Fatal(err)
	}
	var usages []aiusage.Entry
	var generatedPrompt string
	service := NewAIImageGenerationService(db)
	service.resolve = func(*gorm.DB, string, string, time.Duration) (aimodel.Invocation, error) {
		return testImageInvocation(), nil
	}
	service.generate = func(_ context.Context, _ aimodel.Invocation, request aiclient.ImageGenerationRequest) (string, error) {
		generatedPrompt = request.Prompt
		return AIImageDataURL(imageBytes, "image/png"), nil
	}
	service.upload = func(_ context.Context, _ model.Int64String, _, filename string, content []byte) (*UploadResult, error) {
		return &UploadResult{
			URL: "https://cdn.example.com/" + filename, Key: "stored/" + filename, Size: int64(len(content)),
		}, nil
	}
	service.storageAvailable = func() bool { return true }
	service.recordUsage = func(entry aiusage.Entry) { usages = append(usages, entry) }

	skillID := model.Int64String(11)
	if err := db.Create(&model.AISkill{
		ID: skillID, UserID: 1, Name: "极简海报", Content: "优先留白与旧纸张质感",
		SourceURL: "https://example.com/skill",
	}).Error; err != nil {
		t.Fatal(err)
	}
	result, err := service.Generate(context.Background(), AIImageGenerationInput{
		UserID: 1, ModelID: "7", RecipeID: "free", StyleProfileID: "skill:11",
		Brief: prompt, AspectRatio: "1:1", Quality: "1K",
		Feature: "workflow-image-generation",
	})
	if err != nil {
		t.Fatal(err)
	}
	if result.Status != "succeeded" || result.ResultURL != "https://cdn.example.com/generated.png" {
		t.Fatalf("unexpected generation result: %+v", result)
	}
	if result.Source != AIImageGenerationSourceWorkflow {
		t.Fatalf("workflow generation source was not persisted: %+v", result)
	}
	if result.ResultWidth != 1 || result.ResultHeight != 1 || result.ModelCatalogID != 7 {
		t.Fatalf("generation metadata was not persisted: %+v", result)
	}
	if result.Prompt != strings.TrimSpace(prompt) {
		t.Fatalf("complete imported prompt was not preserved: got %d chars", len(result.Prompt))
	}
	if result.SkillID == nil || *result.SkillID != skillID || result.SkillName != "极简海报" {
		t.Fatalf("selected skill was not persisted: %+v", result)
	}
	if result.StyleProfileID != "skill:11" || result.StyleProfileSource != "skill" ||
		!strings.Contains(result.StyleProfilePrompt, "优先留白与旧纸张质感") {
		t.Fatalf("style profile snapshot was not persisted: %+v", result)
	}
	if !strings.Contains(generatedPrompt, "优先留白与旧纸张质感") || !strings.Contains(generatedPrompt, strings.TrimSpace(prompt)) {
		t.Fatalf("skill and user prompt must both reach image model: %s", generatedPrompt)
	}
	if len(usages) != 1 || usages[0].Feature != "workflow-image-generation" || usages[0].Status != aiusage.StatusSuccess {
		t.Fatalf("unexpected usage audit: %+v", usages)
	}
}

func TestFetchAIImageSourceSupportsGIFDataURL(t *testing.T) {
	content, err := base64.StdEncoding.DecodeString("R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==")
	if err != nil {
		t.Fatal(err)
	}
	fetched, mimeType, err := FetchAIImageSource(
		context.Background(),
		AIImageDataURL(content, "image/gif"),
	)
	if err != nil {
		t.Fatal(err)
	}
	if string(fetched) != string(content) || mimeType != "image/gif" {
		t.Fatalf("fetched = %q, mime = %q", fetched, mimeType)
	}
	if AIImageExtension(mimeType) != ".gif" {
		t.Fatalf("gif extension = %q", AIImageExtension(mimeType))
	}
}

func TestAIImageGenerationServiceUsesConfiguredTimeout(t *testing.T) {
	db := newAIImageRuntimeTestDB(t)
	var resolvedTimeout time.Duration
	service := NewAIImageGenerationService(db)
	service.resolve = func(_ *gorm.DB, _ string, _ string, timeout time.Duration) (aimodel.Invocation, error) {
		resolvedTimeout = timeout
		return testImageInvocation(), nil
	}
	service.generate = func(ctx context.Context, _ aimodel.Invocation, _ aiclient.ImageGenerationRequest) (string, error) {
		deadline, ok := ctx.Deadline()
		if !ok || time.Until(deadline) > 2*time.Minute || time.Until(deadline) < time.Minute+55*time.Second {
			t.Fatalf("unexpected generation deadline: %v (configured timeout: %v)", deadline, resolvedTimeout)
		}
		return "", context.DeadlineExceeded
	}
	service.storageAvailable = func() bool { return true }

	_, err := service.Generate(context.Background(), AIImageGenerationInput{
		UserID: 1, ModelID: "7", Brief: "超时测试", AspectRatio: "1:1", Quality: "1K", TimeoutSeconds: 120,
	})
	if err == nil || resolvedTimeout != 120*time.Second {
		t.Fatalf("err=%v timeout=%v", err, resolvedTimeout)
	}
}

func TestAIImageGenerationServiceRejectsOutOfRangeTimeout(t *testing.T) {
	service := NewAIImageGenerationService(newAIImageRuntimeTestDB(t))
	_, err := service.Generate(context.Background(), AIImageGenerationInput{
		UserID: 1, ModelID: "7", Brief: "超时测试", AspectRatio: "1:1", Quality: "1K", TimeoutSeconds: 30,
	})
	if err == nil || err.Error() != "图片生成超时必须在 60 到 600 秒之间" {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestAIImageGenerationServicePauseCancelsActiveRequest(t *testing.T) {
	db := newAIImageRuntimeTestDB(t)
	started := make(chan struct{})
	finished := make(chan struct{})
	service := NewAIImageGenerationService(db)
	service.resolve = func(*gorm.DB, string, string, time.Duration) (aimodel.Invocation, error) {
		return testImageInvocation(), nil
	}
	service.generate = func(ctx context.Context, _ aimodel.Invocation, _ aiclient.ImageGenerationRequest) (string, error) {
		close(started)
		<-ctx.Done()
		return "", ctx.Err()
	}
	service.storageAvailable = func() bool { return true }
	service.enqueue = func(run func()) {
		go func() {
			defer close(finished)
			run()
		}()
	}

	generation, err := service.Queue(context.Background(), AIImageGenerationInput{
		UserID: 1, ModelID: "7", Brief: "暂停中的图片", AspectRatio: "1:1", Quality: "1K",
	})
	if err != nil {
		t.Fatal(err)
	}
	select {
	case <-started:
	case <-time.After(time.Second):
		t.Fatal("image generation did not start")
	}
	if err := db.Model(&model.AIImageGeneration{}).Where("id = ?", generation.ID).Updates(map[string]any{
		"status": "paused", "stage": "completed", "error_code": "GENERATION_PAUSED",
	}).Error; err != nil {
		t.Fatal(err)
	}
	if !CancelAIImageGeneration(generation.ID) {
		t.Fatal("expected active image generation to receive cancel signal")
	}
	select {
	case <-finished:
	case <-time.After(time.Second):
		t.Fatal("paused image generation did not stop")
	}
	var paused model.AIImageGeneration
	if err := db.First(&paused, generation.ID).Error; err != nil {
		t.Fatal(err)
	}
	if paused.Status != "paused" || paused.ErrorCode != "GENERATION_PAUSED" {
		t.Fatalf("pause state was overwritten: %+v", paused)
	}
}

func TestAIImageGenerationServiceRejectsUnsupportedReferenceModel(t *testing.T) {
	db := newAIImageRuntimeTestDB(t)
	service := NewAIImageGenerationService(db)
	service.resolve = func(*gorm.DB, string, string, time.Duration) (aimodel.Invocation, error) {
		return testImageInvocation(), nil
	}
	service.storageAvailable = func() bool { return true }

	_, err := service.Generate(context.Background(), AIImageGenerationInput{
		UserID: 1, ModelID: "7", Brief: "沿用构图", AspectRatio: "1:1", Quality: "1K",
		References: []string{"data:image/png;base64," + onePixelPNGBase64},
	})
	if err == nil || err.Error() != "所选图片模型不支持参考图" {
		t.Fatalf("expected reference capability error, got %v", err)
	}
}

func TestAIImageGenerationServicePersistsReferenceParent(t *testing.T) {
	db := newAIImageRuntimeTestDB(t)
	imageBytes, err := base64.StdEncoding.DecodeString(onePixelPNGBase64)
	if err != nil {
		t.Fatal(err)
	}
	parent := model.AIImageGeneration{
		ID: 99, UserID: 1, ModelCatalogID: 7, Provider: "test", Model: "test-image-model",
		PresetID: "free", Prompt: "parent", AspectRatio: "1:1", Quality: "1K", RequestedSize: "1024x1024",
		Status: "succeeded", Stage: "completed", ResultURL: "https://cdn.example.com/parent.png",
	}
	if err := db.Create(&parent).Error; err != nil {
		t.Fatal(err)
	}
	service := NewAIImageGenerationService(db)
	service.resolve = func(*gorm.DB, string, string, time.Duration) (aimodel.Invocation, error) {
		invocation := testImageInvocation()
		invocation.Model.Capabilities = `["image_generation","reference_image"]`
		return invocation, nil
	}
	service.fetch = func(context.Context, string) ([]byte, string, error) {
		return imageBytes, "image/png", nil
	}
	service.generate = func(context.Context, aimodel.Invocation, aiclient.ImageGenerationRequest) (string, error) {
		return AIImageDataURL(imageBytes, "image/png"), nil
	}
	service.upload = func(_ context.Context, _ model.Int64String, _, filename string, content []byte) (*UploadResult, error) {
		return &UploadResult{URL: "https://cdn.example.com/" + filename, Key: "stored/" + filename, Size: int64(len(content))}, nil
	}
	service.storageAvailable = func() bool { return true }

	result, err := service.Generate(context.Background(), AIImageGenerationInput{
		UserID: 1, ModelID: "7", RecipeID: "free", Brief: "derive from parent", AspectRatio: "1:1", Quality: "1K",
		ReferenceGenerationID: parent.ID.String(),
	})
	if err != nil {
		t.Fatal(err)
	}
	if result.ParentGenerationID == nil || *result.ParentGenerationID != parent.ID {
		t.Fatalf("parent generation was not persisted: %+v", result)
	}
}

func TestAIImageGenerationServiceAllowsLargeStoredGenerationReference(t *testing.T) {
	db := newAIImageRuntimeTestDB(t)
	parent := model.AIImageGeneration{
		ID: 100, UserID: 1, ModelCatalogID: 7, Provider: "test", Model: "test-image-model",
		PresetID: "free", Prompt: "parent", AspectRatio: "16:9", Quality: "4K", RequestedSize: "3840x2160",
		Status: "succeeded", Stage: "completed", ResultURL: "https://cdn.example.com/large-parent.png",
	}
	if err := db.Create(&parent).Error; err != nil {
		t.Fatal(err)
	}
	service := NewAIImageGenerationService(db)
	service.fetch = func(context.Context, string) ([]byte, string, error) {
		return make([]byte, MaxAIImageReferenceBytes+1), "image/png", nil
	}

	references, err := service.resolveReferences(context.Background(), AIImageGenerationInput{
		UserID: 1, ReferenceGenerationID: parent.ID.String(),
	})
	if err != nil || len(references) != 1 {
		t.Fatalf("stored generation reference should allow more than 5MB: count=%d err=%v", len(references), err)
	}
}

func TestAIImageGenerationServiceKeepsUploadReferenceLimit(t *testing.T) {
	service := NewAIImageGenerationService(newAIImageRuntimeTestDB(t))
	service.fetch = func(context.Context, string) ([]byte, string, error) {
		return make([]byte, MaxAIImageReferenceBytes+1), "image/png", nil
	}

	_, err := service.resolveReferences(context.Background(), AIImageGenerationInput{
		UserID: 1, References: []string{"data:image/png;base64,oversized"},
	})
	if err == nil || err.Error() != "单张上传参考图不能超过 5MB" {
		t.Fatalf("expected upload reference limit, got %v", err)
	}
}

func TestAIImageGenerationServiceAcceptsUsableNonExact4KOutput(t *testing.T) {
	db := newAIImageRuntimeTestDB(t)
	var imageBuffer bytes.Buffer
	if err := png.Encode(&imageBuffer, image.NewRGBA(image.Rect(0, 0, 1672, 941))); err != nil {
		t.Fatal(err)
	}
	imageBytes := imageBuffer.Bytes()
	uploads := 0
	requestedSize := ""
	service := NewAIImageGenerationService(db)
	service.resolve = func(*gorm.DB, string, string, time.Duration) (aimodel.Invocation, error) {
		invocation := testImageInvocation()
		invocation.Model.ModelID = "gpt-image-2"
		return invocation, nil
	}
	service.generate = func(_ context.Context, _ aimodel.Invocation, request aiclient.ImageGenerationRequest) (string, error) {
		requestedSize = request.Size
		return AIImageDataURL(imageBytes, "image/png"), nil
	}
	service.upload = func(context.Context, model.Int64String, string, string, []byte) (*UploadResult, error) {
		uploads++
		return &UploadResult{
			URL:  "https://cdn.example.com/generated.png",
			Key:  "stored/generated.png",
			Size: int64(len(imageBytes)),
		}, nil
	}
	service.storageAvailable = func() bool { return true }

	result, err := service.Generate(context.Background(), AIImageGenerationInput{
		UserID: 1, ModelID: "7", Brief: "山谷", AspectRatio: "16:9", Quality: "4K",
	})
	if err != nil {
		t.Fatal(err)
	}
	if result.Status != "succeeded" || result.ResultWidth != 1672 || result.ResultHeight != 941 {
		t.Fatalf("unexpected generation result: %+v", result)
	}
	if uploads != 1 {
		t.Fatalf("usable non-exact 4K output should be uploaded once, got %d upload(s)", uploads)
	}
	if requestedSize != "3840x2160" {
		t.Fatalf("16:9 4K request size = %q, want 3840x2160", requestedSize)
	}
}

func TestValidateAIImageOutputDimensionsUsesOneKAsMinimumForFourKRequest(t *testing.T) {
	if err := validateAIImageOutputDimensions("3840x2160", "4K", 3840, 2160, nil); err != nil {
		t.Fatalf("expected exact 4K output to pass: %v", err)
	}
	if err := validateAIImageOutputDimensions("3840x2160", "4K", 1672, 941, nil); err != nil {
		t.Fatalf("expected a usable non-exact result to pass: %v", err)
	}
	if err := validateAIImageOutputDimensions("3840x2160", "4K", 1279, 720, nil); err == nil {
		t.Fatal("expected a result below the 16:9 1K baseline to fail")
	}
	if err := validateAIImageOutputDimensions("3840x2160", "4K", 0, 0, errors.New("unknown dimensions")); err != nil {
		t.Fatalf("dimension inspection failure must preserve an otherwise valid image: %v", err)
	}
	if err := validateAIImageOutputDimensions("3840x2160", "2K", 1672, 941, nil); err != nil {
		t.Fatalf("2K output must retain existing permissive behavior: %v", err)
	}
}

func TestAIImageUnderstandingServiceReturnsAuditedText(t *testing.T) {
	db := newAIImageRuntimeTestDB(t)
	var usages []aiusage.Entry
	service := NewAIImageUnderstandingService(db)
	service.resolve = func(*gorm.DB, string, string, time.Duration) (aimodel.Invocation, error) {
		return aimodel.Invocation{
			Model:    model.AIModel{ID: 8, ModelID: "test-vision"},
			Provider: aimodel.ProviderConfig{Provider: "test"},
		}, nil
	}
	service.fetch = func(context.Context, string) ([]byte, string, error) {
		return []byte("small-image"), "image/png", nil
	}
	service.chat = func(context.Context, aimodel.Invocation, aiclient.CompatibleChatRequest) (aiclient.CompatibleChatResponse, error) {
		var response aiclient.CompatibleChatResponse
		if err := json.Unmarshal([]byte(`{"model":"test-vision","choices":[{"message":{"role":"assistant","content":"画面主体是一座山谷图书馆。"}}],"usage":{"total_tokens":12}}`), &response); err != nil {
			t.Fatal(err)
		}
		return response, nil
	}
	service.recordUsage = func(entry aiusage.Entry) { usages = append(usages, entry) }

	result, err := service.Understand(context.Background(), AIImageUnderstandingInput{
		UserID: 1, ModelID: "8", ImageSource: "https://cdn.example.com/image.png",
		Prompt: "描述画面主体", Feature: "workflow-image-understanding",
	})
	if err != nil {
		t.Fatal(err)
	}
	if result.Text != "画面主体是一座山谷图书馆。" || result.Model != "test-vision" || result.TokenUsage != 12 {
		t.Fatalf("unexpected understanding result: %+v", result)
	}
	if len(usages) != 1 || usages[0].Status != aiusage.StatusSuccess {
		t.Fatalf("unexpected usage audit: %+v", usages)
	}
}

func TestAIImageStyleAnalysisServiceAnalyzesMultipleImagesAndAuditsResult(t *testing.T) {
	db := newAIImageRuntimeTestDB(t)
	var usages []aiusage.Entry
	service := NewAIImageStyleAnalysisService(db)
	service.resolve = func(*gorm.DB, string, string, time.Duration) (aimodel.Invocation, error) {
		return aimodel.Invocation{Model: model.AIModel{ID: 9, ModelID: "test-vision"}, Provider: aimodel.ProviderConfig{Provider: "test"}}, nil
	}
	service.chat = func(_ context.Context, _ aimodel.Invocation, request aiclient.CompatibleChatRequest) (aiclient.CompatibleChatResponse, error) {
		if len(request.Messages) != 2 {
			t.Fatalf("message count=%d", len(request.Messages))
		}
		parts, ok := request.Messages[1].Content.([]map[string]any)
		if !ok || len(parts) != 3 || parts[0]["type"] != "image_url" || parts[1]["type"] != "image_url" || parts[2]["type"] != "text" {
			t.Fatalf("unexpected multimodal request: %#v", request.Messages[1].Content)
		}
		var response aiclient.CompatibleChatResponse
		if err := json.Unmarshal([]byte(`{"model":"test-vision","choices":[{"message":{"role":"assistant","content":"{\"name\":\"低饱和电影感\",\"description\":\"冷暖对比与安静叙事氛围\",\"tags\":[\"电影感\",\"电影感\",\"低饱和\"],\"stylePrompt\":\"低饱和蓝灰与暖橙点光，电影感环境光和稳定纵深构图\",\"observations\":{\"palette\":\"蓝灰与暖橙\",\"lighting\":\"柔和侧逆光\",\"composition\":\"前中后景纵深\",\"material\":\"细腻颗粒\",\"rendering\":\"电影化插画\"},\"commonalityNote\":\"两张图片的光线和色彩语言一致。\"}"}}],"usage":{"total_tokens":18}}`), &response); err != nil {
			t.Fatal(err)
		}
		return response, nil
	}
	service.recordUsage = func(entry aiusage.Entry) { usages = append(usages, entry) }

	result, err := service.Analyze(context.Background(), AIImageStyleAnalysisInput{
		UserID: 1, ModelID: "9", Hint: "用于文章封面",
		Images: []AIImageStyleAnalysisImage{{Content: []byte("first"), MIMEType: "image/png"}, {Content: []byte("second"), MIMEType: "image/jpeg"}},
	})
	if err != nil {
		t.Fatal(err)
	}
	if result.Model != "test-vision" || result.SourceCount != 2 || result.Result.Name != "低饱和电影感" || len(result.Result.Tags) != 2 {
		t.Fatalf("unexpected analysis result: %+v", result)
	}
	if len(usages) != 1 || usages[0].Feature != aiImageStyleAnalysisFeature || usages[0].Status != aiusage.StatusSuccess {
		t.Fatalf("unexpected usage audit: %+v", usages)
	}
}
