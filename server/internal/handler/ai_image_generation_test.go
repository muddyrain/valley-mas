package handler

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"strings"
	"testing"
)

const onePixelPNGBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="

func TestValidateAIImageGenerationRequestAcceptsControlledInputs(t *testing.T) {
	preset, size, references, err := validateAIImageGenerationRequest(createAIImageGenerationRequest{
		ModelID: "1", PresetID: "sketch", Prompt: "把线稿画成森林小屋",
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
		ModelID: "1", PresetID: "sketch", Prompt: "森林小屋", AspectRatio: "4:3", Quality: "1K",
	}, []string{"1K", "2K"})
	if err == nil || !strings.Contains(err.Error(), "需要先绘制草图") {
		t.Fatalf("expected reference validation, got %v", err)
	}
}

func TestValidateAIImageGenerationRequestRejectsUnsupportedModelQuality(t *testing.T) {
	_, _, _, err := validateAIImageGenerationRequest(createAIImageGenerationRequest{
		ModelID: "1", PresetID: "free", Prompt: "山谷", AspectRatio: "1:1", Quality: "4K",
	}, []string{"1K", "2K"})
	if err == nil || !strings.Contains(err.Error(), "不支持该目标分辨率") {
		t.Fatalf("expected unsupported quality validation, got %v", err)
	}
}

func TestValidateAIImageGenerationRequestAccepts4KForSupportedModel(t *testing.T) {
	_, size, _, err := validateAIImageGenerationRequest(createAIImageGenerationRequest{
		ModelID: "1", PresetID: "free", Prompt: "山谷", AspectRatio: "16:9", Quality: "4K",
	}, []string{"1K", "2K", "3K", "4K"})
	if err != nil || size != "4096x2304" {
		t.Fatalf("expected 4K target size, got %q err=%v", size, err)
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
	for _, expected := range []string{"主题封面", "漂浮在云海里的图书馆", "Do not add a watermark"} {
		if !strings.Contains(prompt, expected) {
			t.Fatalf("prompt must contain %q: %s", expected, prompt)
		}
	}
}

func TestAIImagePresetsExposePromptContent(t *testing.T) {
	encoded, err := json.Marshal(aiImagePresets)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(encoded), `"promptContent":"根据用户的画面描述`) {
		t.Fatalf("preset response must expose its prompt content: %s", encoded)
	}
}

func TestBuildAIImagePromptPrioritizesReferenceStructure(t *testing.T) {
	preset, _ := findAIImagePreset("avatar")
	prompt := buildAIImagePrompt(preset, "一只小粉猪", true)
	for _, expected := range []string{
		"primary structural source of truth",
		"Preserve its subject count, silhouette, pose, framing, spatial layout and relative proportions",
		"the canvas must win",
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
