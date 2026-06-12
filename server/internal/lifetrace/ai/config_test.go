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

func TestReadPantryPhotoConfigPrefersGemini(t *testing.T) {
	t.Setenv("GEMINI_API_KEY", "gemini-key")
	t.Setenv("GEMINI_API_BASE_URL", "https://gemini.example.com/v1beta/")
	t.Setenv("GEMINI_VISION_MODEL", "gemini-test")
	t.Setenv("ARK_API_KEY", "ark-key")
	t.Setenv("ARK_VISION_MODEL", "ep-vision")
	t.Setenv("ARK_TEXT_MODEL", "ep-text")

	cfg, errMsg := ReadPantryPhotoConfig(30 * time.Second)
	if errMsg != "" {
		t.Fatalf("unexpected error: %s", errMsg)
	}
	if cfg.Source != "gemini" || cfg.APIKey != "gemini-key" {
		t.Fatalf("expected Gemini config, got %+v", cfg)
	}
	if cfg.BaseURL != "https://gemini.example.com/v1beta" || cfg.Model != "gemini-test" || !cfg.UseVision {
		t.Fatalf("expected Gemini vision defaults, got %+v", cfg)
	}
}

func TestReadPantryPhotoConfigFallsBackToARKImageConfig(t *testing.T) {
	t.Setenv("GEMINI_API_KEY", "")
	t.Setenv("ARK_API_KEY", "ark-key")
	t.Setenv("ARK_VISION_MODEL", "ep-vision")
	t.Setenv("ARK_TEXT_MODEL", "ep-text")

	cfg, errMsg := ReadPantryPhotoConfig(30 * time.Second)
	if errMsg != "" {
		t.Fatalf("unexpected error: %s", errMsg)
	}
	if cfg.Source != "ark" || cfg.Model != "ep-vision" || !cfg.UseVision {
		t.Fatalf("expected ARK vision fallback, got %+v", cfg)
	}
}

func TestReadTextConfigPrefersLifeTraceAIEnv(t *testing.T) {
	t.Setenv("LIFE_TRACE_AI_API_KEY", "life-trace-key")
	t.Setenv("LIFE_TRACE_AI_BASE_URL", "https://life-trace.example.com/v1/")
	t.Setenv("LIFE_TRACE_AI_MODEL", "life-trace-model")
	t.Setenv("LIFE_TRACE_AI_TIMEOUT_SECONDS", "7")
	t.Setenv("OPENAI_API_KEY", "legacy-key")
	t.Setenv("OPENAI_API_BASE_URL", "https://legacy.example.com/v1")
	t.Setenv("OPENAI_API_MODEL", "legacy-model")
	t.Setenv("OPENAI_API_TIMEOUT", "5")

	cfg, errMsg := ReadTextConfig(30 * time.Second)
	if errMsg != "" {
		t.Fatalf("unexpected error: %s", errMsg)
	}
	if cfg.APIKey != "life-trace-key" || cfg.BaseURL != "https://life-trace.example.com/v1" {
		t.Fatalf("expected namespaced Life Trace config, got %+v", cfg)
	}
	if cfg.Model != "life-trace-model" || cfg.Timeout != 7*time.Second {
		t.Fatalf("expected namespaced Life Trace model and timeout, got %+v", cfg)
	}
}

func TestReadTextConfigKeepsLegacyOpenAIEnvFallback(t *testing.T) {
	t.Setenv("OPENAI_API_KEY", "legacy-key")
	t.Setenv("OPENAI_API_BASE_URL", "https://legacy.example.com/v1/")
	t.Setenv("OPENAI_API_MODEL", "legacy-model")
	t.Setenv("OPENAI_API_TIMEOUT", "5")

	cfg, errMsg := ReadTextConfig(30 * time.Second)
	if errMsg != "" {
		t.Fatalf("unexpected error: %s", errMsg)
	}
	if cfg.APIKey != "legacy-key" || cfg.BaseURL != "https://legacy.example.com/v1" {
		t.Fatalf("expected legacy OpenAI config fallback, got %+v", cfg)
	}
	if cfg.Model != "legacy-model" || cfg.Timeout != 5*time.Second {
		t.Fatalf("expected legacy OpenAI model and timeout, got %+v", cfg)
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
