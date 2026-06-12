package ai

import (
	"testing"
	"time"
)

func TestReadTextConfigRequiresARKTextModel(t *testing.T) {
	t.Setenv("OPENAI_API_KEY", "")
	t.Setenv("ARK_API_KEY", "test-key")
	t.Setenv("ARK_TEXT_MODEL", "doubao")

	_, errMsg := ReadTextConfig(30 * time.Second)
	if errMsg != "AI 未配置：ARK_TEXT_MODEL 必须以 ep- 开头" {
		t.Fatalf("unexpected error message: %q", errMsg)
	}
}

func TestReadImageConfigFallsBackToTextModel(t *testing.T) {
	t.Setenv("ARK_API_KEY", "test-key")
	t.Setenv("ARK_VISION_MODEL", "")
	t.Setenv("ARK_TEXT_MODEL", "ep-text")

	cfg, errMsg := ReadImageConfig(30 * time.Second)
	if errMsg != "" {
		t.Fatalf("unexpected error: %s", errMsg)
	}
	if cfg.Model != "ep-text" || cfg.UseVision {
		t.Fatalf("expected text fallback, got %+v", cfg)
	}
}

func TestPromptContractParseNormalizesOutput(t *testing.T) {
	contract := PromptContract[string, struct {
		Title string `json:"title"`
	}]{
		Normalize: func(output struct {
			Title string `json:"title"`
		}) (struct {
			Title string `json:"title"`
		}, error) {
			output.Title = "normalized-" + output.Title
			return output, nil
		},
	}

	parsed, err := contract.Parse("```json\n{\"title\":\"ok\"}\n```")
	if err != nil {
		t.Fatalf("parse contract: %v", err)
	}
	if parsed.Title != "normalized-ok" {
		t.Fatalf("expected normalizer to run, got %+v", parsed)
	}
}
