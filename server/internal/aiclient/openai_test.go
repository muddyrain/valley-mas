package aiclient

import (
	"testing"
	"time"
)

func TestReadOpenAIConfigPrefersFirstEnv(t *testing.T) {
	t.Setenv("LIFE_TRACE_AI_API_KEY", "first-key")
	t.Setenv("LIFE_TRACE_AI_BASE_URL", "https://first.example.com/v1/")
	t.Setenv("LIFE_TRACE_AI_MODEL", "first-model")
	t.Setenv("LIFE_TRACE_AI_TIMEOUT_SECONDS", "7")
	t.Setenv("OPENAI_API_KEY", "legacy-key")
	t.Setenv("OPENAI_API_BASE_URL", "https://legacy.example.com/v1")
	t.Setenv("OPENAI_API_MODEL", "legacy-model")
	t.Setenv("OPENAI_API_TIMEOUT", "5")

	cfg, ok := ReadOpenAIConfig(OpenAIConfigOpts{
		APIKeyEnvs:     []string{"LIFE_TRACE_AI_API_KEY", "OPENAI_API_KEY"},
		BaseURLEnvs:    []string{"LIFE_TRACE_AI_BASE_URL", "OPENAI_API_BASE_URL"},
		ModelEnvs:      []string{"LIFE_TRACE_AI_MODEL", "OPENAI_API_MODEL"},
		TimeoutEnvs:    []string{"LIFE_TRACE_AI_TIMEOUT_SECONDS", "OPENAI_API_TIMEOUT"},
		DefaultBaseURL: "https://api.openai.com/v1",
		DefaultModel:   "gpt-5.4",
		DefaultTimeout: 30 * time.Second,
	})
	if !ok {
		t.Fatal("expected ok")
	}
	if cfg.APIKey != "first-key" {
		t.Fatalf("APIKey = %q", cfg.APIKey)
	}
	if cfg.BaseURL != "https://first.example.com/v1" {
		t.Fatalf("BaseURL = %q", cfg.BaseURL)
	}
	if cfg.Model != "first-model" {
		t.Fatalf("Model = %q", cfg.Model)
	}
	if cfg.Timeout != 7*time.Second {
		t.Fatalf("Timeout = %v", cfg.Timeout)
	}
}

func TestReadOpenAIConfigFallsBackToLegacyEnv(t *testing.T) {
	t.Setenv("LIFE_TRACE_AI_API_KEY", "")
	t.Setenv("LIFE_TRACE_AI_BASE_URL", "")
	t.Setenv("LIFE_TRACE_AI_MODEL", "")
	t.Setenv("LIFE_TRACE_AI_TIMEOUT_SECONDS", "")
	t.Setenv("OPENAI_API_KEY", "legacy-key")
	t.Setenv("OPENAI_API_BASE_URL", "https://legacy.example.com/v1/")
	t.Setenv("OPENAI_API_MODEL", "legacy-model")
	t.Setenv("OPENAI_API_TIMEOUT", "5")

	cfg, ok := ReadOpenAIConfig(OpenAIConfigOpts{
		APIKeyEnvs:     []string{"LIFE_TRACE_AI_API_KEY", "OPENAI_API_KEY"},
		BaseURLEnvs:    []string{"LIFE_TRACE_AI_BASE_URL", "OPENAI_API_BASE_URL"},
		ModelEnvs:      []string{"LIFE_TRACE_AI_MODEL", "OPENAI_API_MODEL"},
		TimeoutEnvs:    []string{"LIFE_TRACE_AI_TIMEOUT_SECONDS", "OPENAI_API_TIMEOUT"},
		DefaultBaseURL: "https://api.openai.com/v1",
		DefaultModel:   "gpt-5.4",
		DefaultTimeout: 30 * time.Second,
	})
	if !ok {
		t.Fatal("expected ok")
	}
	if cfg.APIKey != "legacy-key" {
		t.Fatalf("APIKey = %q", cfg.APIKey)
	}
	if cfg.BaseURL != "https://legacy.example.com/v1" {
		t.Fatalf("BaseURL = %q", cfg.BaseURL)
	}
	if cfg.Model != "legacy-model" {
		t.Fatalf("Model = %q", cfg.Model)
	}
	if cfg.Timeout != 5*time.Second {
		t.Fatalf("Timeout = %v", cfg.Timeout)
	}
}

func TestReadOpenAIConfigUsesDefaults(t *testing.T) {
	t.Setenv("OPENAI_API_KEY", "k")
	t.Setenv("OPENAI_API_BASE_URL", "")
	t.Setenv("OPENAI_API_MODEL", "")
	t.Setenv("OPENAI_API_TIMEOUT", "")
	cfg, ok := ReadOpenAIConfig(OpenAIConfigOpts{
		APIKeyEnvs:     []string{"OPENAI_API_KEY"},
		BaseURLEnvs:    []string{"OPENAI_API_BASE_URL"},
		ModelEnvs:      []string{"OPENAI_API_MODEL"},
		TimeoutEnvs:    []string{"OPENAI_API_TIMEOUT"},
		DefaultBaseURL: "https://api.openai.com/v1",
		DefaultModel:   "gpt-5.4",
		DefaultTimeout: 30 * time.Second,
	})
	if !ok {
		t.Fatal("expected ok")
	}
	if cfg.BaseURL != "https://api.openai.com/v1" || cfg.Model != "gpt-5.4" || cfg.Timeout != 30*time.Second {
		t.Fatalf("unexpected defaults: %+v", cfg)
	}
}

func TestReadOpenAIConfigMissingKey(t *testing.T) {
	t.Setenv("OPENAI_API_KEY", "")
	if _, ok := ReadOpenAIConfig(OpenAIConfigOpts{APIKeyEnvs: []string{"OPENAI_API_KEY"}}); ok {
		t.Fatal("expected !ok when API key missing")
	}
}

func TestReadGeminiVisionConfigDefaults(t *testing.T) {
	t.Setenv("GEMINI_API_KEY", "k")
	t.Setenv("GEMINI_API_BASE_URL", "")
	t.Setenv("GEMINI_VISION_MODEL", "")
	cfg, ok := ReadGeminiVisionConfig(30*time.Second, nil)
	if !ok {
		t.Fatal("expected ok")
	}
	if cfg.BaseURL != defaultGeminiBaseURL {
		t.Fatalf("BaseURL = %q", cfg.BaseURL)
	}
	if cfg.Model != defaultGeminiModel {
		t.Fatalf("Model = %q", cfg.Model)
	}
	if cfg.Timeout != 30*time.Second {
		t.Fatalf("Timeout = %v", cfg.Timeout)
	}
}

func TestReadGeminiVisionConfigOverridesAndTimeoutPrecedence(t *testing.T) {
	t.Setenv("GEMINI_API_KEY", "k")
	t.Setenv("GEMINI_API_BASE_URL", "https://gemini.example.com/v1beta/")
	t.Setenv("GEMINI_VISION_MODEL", "gemini-test")
	t.Setenv("LIFE_TRACE_PANTRY_PHOTO_AI_TIMEOUT_SECONDS", "45")
	t.Setenv("GEMINI_VISION_TIMEOUT_SECONDS", "10")
	cfg, ok := ReadGeminiVisionConfig(30*time.Second, []string{
		"LIFE_TRACE_PANTRY_PHOTO_AI_TIMEOUT_SECONDS",
		"GEMINI_VISION_TIMEOUT_SECONDS",
	})
	if !ok {
		t.Fatal("expected ok")
	}
	if cfg.BaseURL != "https://gemini.example.com/v1beta" {
		t.Fatalf("BaseURL = %q", cfg.BaseURL)
	}
	if cfg.Model != "gemini-test" {
		t.Fatalf("Model = %q", cfg.Model)
	}
	if cfg.Timeout != 45*time.Second {
		t.Fatalf("Timeout = %v want 45s", cfg.Timeout)
	}
}

func TestReadGeminiVisionConfigMissingKey(t *testing.T) {
	t.Setenv("GEMINI_API_KEY", "")
	if _, ok := ReadGeminiVisionConfig(30*time.Second, nil); ok {
		t.Fatal("expected !ok when key missing")
	}
}
