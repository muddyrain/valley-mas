package handler

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"valley-server/internal/service"

	"github.com/gin-gonic/gin"
)

const onePixelPNGBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="

func TestValidateAIImageGenerationRequestAcceptsControlledInputs(t *testing.T) {
	preset, size, references, err := validateAIImageGenerationRequest(createAIImageGenerationRequest{
		ModelID: "1", RecipeID: "sketch", Brief: "把线稿画成森林小屋",
		AspectRatio: "4:3", Quality: "1K",
		ReferenceRaw: []string{"data:image/png;base64," + onePixelPNGBase64},
	}, []string{"1K", "2K"})
	if err != nil {
		t.Fatal(err)
	}
	if preset.ID != "sketch" || size != "1024x768" || len(references) != 1 {
		t.Fatalf("unexpected normalized request: preset=%+v size=%s refs=%d", preset, size, len(references))
	}
}

func TestValidateAIImageGenerationRequestRequiresSketchReference(t *testing.T) {
	_, _, _, err := validateAIImageGenerationRequest(createAIImageGenerationRequest{
		ModelID: "1", RecipeID: "sketch", Brief: "森林小屋", AspectRatio: "4:3", Quality: "1K",
	}, []string{"1K", "2K"})
	if err == nil || !strings.Contains(err.Error(), "需要先绘制草图") {
		t.Fatalf("expected reference validation, got %v", err)
	}
}

func TestValidateAIImageGenerationRequestAcceptsConversationReference(t *testing.T) {
	_, _, references, err := validateAIImageGenerationRequest(createAIImageGenerationRequest{
		ModelID: "1", RecipeID: "sketch", Brief: "把上一张图改成夜景", AspectRatio: "4:3", Quality: "1K",
		ReferenceGenerationID: "123",
	}, []string{"1K", "2K"})
	if err != nil {
		t.Fatal(err)
	}
	if len(references) != 0 {
		t.Fatalf("generation reference should be resolved after validation, got %d raw references", len(references))
	}
}

func TestValidateAIImageGenerationRequestRejectsUnsupportedModelQuality(t *testing.T) {
	_, _, _, err := validateAIImageGenerationRequest(createAIImageGenerationRequest{
		ModelID: "1", RecipeID: "free", Brief: "山谷", AspectRatio: "1:1", Quality: "4K",
	}, []string{"1K", "2K"})
	if err == nil || !strings.Contains(err.Error(), "不支持该目标分辨率") {
		t.Fatalf("expected unsupported quality validation, got %v", err)
	}
}

func TestValidateAIImageGenerationRequestAccepts4KForSupportedModel(t *testing.T) {
	_, size, _, err := validateAIImageGenerationRequest(createAIImageGenerationRequest{
		ModelID: "1", RecipeID: "free", Brief: "山谷", AspectRatio: "16:9", Quality: "4K",
	}, []string{"1K", "2K", "3K", "4K"})
	if err != nil || size != "3840x2160" {
		t.Fatalf("expected 4K target size, got %q err=%v", size, err)
	}
}

func TestAIImageGenerationRequestMapsLegacyPresetAndSkill(t *testing.T) {
	payload := createAIImageGenerationRequest{
		PresetID: "anime", SkillID: "42", Prompt: "云海城市",
	}
	if payload.effectiveRecipeID() != "wallpaper" ||
		payload.effectiveStyleProfileID() != "skill:42" ||
		payload.effectiveBrief() != "云海城市" {
		t.Fatalf("legacy request was not mapped: %+v", payload)
	}
}

func TestAIImageGenerationDeletableStatuses(t *testing.T) {
	for _, status := range []string{"queued", "running"} {
		if isAIImageGenerationDeletable(status) {
			t.Fatalf("status %q should not be deletable", status)
		}
	}
	for _, status := range []string{"succeeded", "failed", "paused"} {
		if !isAIImageGenerationDeletable(status) {
			t.Fatalf("status %q should be deletable", status)
		}
	}
}

func TestAIImageGenerationFavoriteRequestRequiresExplicitValue(t *testing.T) {
	var missing updateAIImageGenerationFavoriteRequest
	if missing.Favorited != nil {
		t.Fatal("expected absent favorite flag to remain nil")
	}

	favorited := false
	present := updateAIImageGenerationFavoriteRequest{Favorited: &favorited}
	if present.Favorited == nil || *present.Favorited {
		t.Fatal("expected explicit false favorite flag to be accepted")
	}
}

func TestNormalizeAIImageResourceVisibility(t *testing.T) {
	if got := normalizeAIImageResourceVisibility(" public "); got != "public" {
		t.Fatalf("expected public visibility, got %q", got)
	}
	for _, value := range []string{"", "private", "shared", "unexpected"} {
		if got := normalizeAIImageResourceVisibility(value); got != "private" {
			t.Fatalf("expected private visibility for %q, got %q", value, got)
		}
	}
}

func TestAIImageReferenceDataURL(t *testing.T) {
	dataURL := aiImageReferenceDataURL([]byte("image"), "image/png")
	if dataURL != "data:image/png;base64,aW1hZ2U=" {
		t.Fatalf("unexpected data URL: %s", dataURL)
	}
}

func TestNormalizeAIImageReferenceRejectsMismatchedContent(t *testing.T) {
	content := base64.StdEncoding.EncodeToString([]byte("not an image"))
	if _, err := normalizeAIImageReference("data:image/png;base64," + content); err == nil {
		t.Fatal("expected mismatched image content rejection")
	}
}

func TestGeneratedAIImageDimensionsReadsReturnedPixels(t *testing.T) {
	content, err := base64.StdEncoding.DecodeString(onePixelPNGBase64)
	if err != nil {
		t.Fatal(err)
	}
	width, height, err := generatedAIImageDimensions(content, "image/png")
	if err != nil || width != 1 || height != 1 {
		t.Fatalf("expected returned one-pixel image, got %dx%d err=%v", width, height, err)
	}
}

func TestWebPImageDimensionsReadsVP8XCanvas(t *testing.T) {
	content := make([]byte, 30)
	copy(content, "RIFF")
	copy(content[8:], "WEBP")
	copy(content[12:], "VP8X")
	content[16] = 10
	content[24] = 255
	content[25] = 7
	content[27] = 255
	content[28] = 3
	width, height, err := generatedAIImageDimensions(content, "image/webp")
	if err != nil || width != 2048 || height != 1024 {
		t.Fatalf("expected 2048x1024 WebP canvas, got %dx%d err=%v", width, height, err)
	}
}

func TestBuildAIImagePromptKeepsPresetAndSafetyConstraints(t *testing.T) {
	preset, _ := findAIImagePreset("cover")
	prompt := buildAIImagePrompt(preset, "一座漂浮在云海里的图书馆", false)
	for _, expected := range []string{"editorial cover", "漂浮在云海里的图书馆", "Do not add a watermark"} {
		if !strings.Contains(prompt, expected) {
			t.Fatalf("prompt must contain %q: %s", expected, prompt)
		}
	}
}

func TestBuildAIImagePromptAppliesSkillWithoutReplacingUserDescription(t *testing.T) {
	preset, _ := findAIImagePreset("free")
	prompt := service.CompileAIImagePrompt(service.AIImageGenerationPlan{
		Recipe: preset,
		StyleProfile: &service.AIImageStyleProfile{
			ID: "skill:1", Name: "极简海报", Source: "skill",
			Instructions: "优先留白与旧纸张质感",
		},
		Brief: "雨天的极简海报",
	}, false)
	for _, expected := range []string{"优先留白与旧纸张质感", "雨天的极简海报", "[VISUAL STYLE]"} {
		if !strings.Contains(prompt, expected) {
			t.Fatalf("skill prompt must contain %q: %s", expected, prompt)
		}
	}
}

func TestAIImageRecipesDoNotExposeInternalInstructions(t *testing.T) {
	encoded, err := json.Marshal(aiImagePresets)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(encoded), "Instructions") ||
		strings.Contains(string(encoded), "promptContent") ||
		strings.Contains(string(encoded), "QuickSamplePrompts") {
		t.Fatalf("recipe response leaked internal instructions: %s", encoded)
	}
	preset, _ := findAIImagePreset("free")
	if preset.Instructions != "" {
		t.Fatalf("free creation must be neutral, got %q", preset.Instructions)
	}
}

func TestSelectAIImageQuickSamplesRotatesLocalPool(t *testing.T) {
	preset, _ := findAIImagePreset("wallpaper")
	values := selectAIImageQuickSamples(preset, preset.SamplePrompts, aiImageQuickSampleCount)
	if len(values) != aiImageQuickSampleCount {
		t.Fatalf("quick samples = %#v", values)
	}
	excluded := make(map[string]struct{}, len(preset.SamplePrompts))
	for _, value := range preset.SamplePrompts {
		excluded[normalizeAIImageQuickSamplePrompt(value)] = struct{}{}
	}
	for _, value := range values {
		if _, ok := excluded[normalizeAIImageQuickSamplePrompt(value)]; ok {
			t.Fatalf("displayed sample returned: %#v", values)
		}
	}

	allSeen := append(append(append([]string(nil), values...), preset.SamplePrompts...), preset.QuickSamplePrompts...)
	rotated := selectAIImageQuickSamples(preset, allSeen, aiImageQuickSampleCount)
	if len(rotated) != aiImageQuickSampleCount {
		t.Fatalf("exhausted pool did not rotate: %#v", rotated)
	}
	for _, value := range rotated {
		for _, current := range values {
			if value == current {
				t.Fatalf("rotation immediately repeated current sample: %#v", rotated)
			}
		}
	}
}

func TestGenerateAIImageRecipeSamplesUsesLocalCatalog(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.POST("/ai/image-recipes/:recipeId/sample-prompts", func(c *gin.Context) {
		c.Set("userId", int64(1))
		GenerateAIImageRecipeSamples(c)
	})
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(
		http.MethodPost,
		"/ai/image-recipes/wallpaper/sample-prompts",
		strings.NewReader(`{"excludedPrompts":[]}`),
	)
	request.Header.Set("Content-Type", "application/json")

	router.ServeHTTP(recorder, request)
	if recorder.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s", recorder.Code, recorder.Body.String())
	}
	var response struct {
		Data struct {
			List  []string `json:"list"`
			Model string   `json:"model"`
		} `json:"data"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatal(err)
	}
	if len(response.Data.List) != aiImageQuickSampleCount || response.Data.Model != "local-curated" {
		t.Fatalf("unexpected local samples response: %+v", response.Data)
	}
}

func TestNormalizeAIImageQuickSamplePromptsLimitsAndDeduplicates(t *testing.T) {
	values := normalizeAIImageQuickSamplePrompts([]string{"  夜景  ", "夜景", "森林", "海岸"}, 2)
	if len(values) != 2 || values[0] != "夜景" || values[1] != "森林" {
		t.Fatalf("normalized prompts = %#v", values)
	}
}

func TestBuildAIImagePromptPrioritizesReferenceStructure(t *testing.T) {
	preset, _ := findAIImagePreset("avatar")
	prompt := buildAIImagePrompt(preset, "一只小粉猪", true)
	for _, expected := range []string{
		"structural source of truth",
		"Preserve subject count, silhouette, pose, framing, spatial layout, and relative proportions",
		"the reference structure wins",
		"一只小粉猪",
	} {
		if !strings.Contains(prompt, expected) {
			t.Fatalf("reference prompt must contain %q: %s", expected, prompt)
		}
	}
	if strings.Contains(prompt, "head-and-shoulders") {
		t.Fatalf("avatar preset must not override a full-body canvas: %s", prompt)
	}
}

func TestSummarizeAIImageErrorOmitsReferenceData(t *testing.T) {
	summary := summarizeAIImageError(errors.New(
		`provider rejected {"image":"data:image/png;base64,secret-reference"}`,
	))
	if strings.Contains(summary, "secret-reference") {
		t.Fatalf("reference data leaked into error summary: %s", summary)
	}
	if !strings.Contains(summary, "reference omitted") {
		t.Fatalf("expected redaction marker, got %s", summary)
	}
}
