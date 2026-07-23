package handler

import (
	"encoding/base64"
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
	})
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
	})
	if err == nil || !strings.Contains(err.Error(), "需要先绘制草图") {
		t.Fatalf("expected reference validation, got %v", err)
	}
}

func TestNormalizeAIImageReferenceRejectsMismatchedContent(t *testing.T) {
	content := base64.StdEncoding.EncodeToString([]byte("not an image"))
	if _, err := normalizeAIImageReference("data:image/png;base64," + content); err == nil {
		t.Fatal("expected mismatched image content rejection")
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
