package aiclient

import (
	"testing"
	"time"
)

func TestReadARKTextConfigMissingAPIKey(t *testing.T) {
	t.Setenv("ARK_API_KEY", "")
	t.Setenv("ARK_TEXT_MODEL", "ep-text")
	cfg, errMsg := ReadARKTextConfig()
	if errMsg != "AI 未配置：缺少 ARK_API_KEY" {
		t.Fatalf("unexpected error: %q", errMsg)
	}
	if cfg.APIKey != "" {
		t.Fatalf("expected empty cfg, got %+v", cfg)
	}
}

func TestReadARKTextConfigInvalidModel(t *testing.T) {
	t.Setenv("ARK_API_KEY", "key")
	t.Setenv("ARK_TEXT_MODEL", "doubao")
	_, errMsg := ReadARKTextConfig()
	if errMsg != "AI 未配置：ARK_TEXT_MODEL 必须以 ep- 开头" {
		t.Fatalf("unexpected error: %q", errMsg)
	}
}

func TestReadARKTextConfigDefaultsBaseURL(t *testing.T) {
	t.Setenv("ARK_API_KEY", "key")
	t.Setenv("ARK_BASE_URL", "")
	t.Setenv("ARK_TEXT_MODEL", "ep-text")
	cfg, errMsg := ReadARKTextConfig()
	if errMsg != "" {
		t.Fatalf("unexpected error: %q", errMsg)
	}
	if cfg.BaseURL != defaultARKBaseURLValue {
		t.Fatalf("expected default base url, got %q", cfg.BaseURL)
	}
}

func TestReadARKEmbeddingConfigRequiresDedicatedEndpoint(t *testing.T) {
	t.Setenv("ARK_API_KEY", "key")
	t.Setenv("ARK_EMBEDDING_MODEL", "")
	_, errMsg := ReadARKEmbeddingConfig()
	if errMsg != "AI 未配置：ARK_EMBEDDING_MODEL 必须以 ep- 开头" {
		t.Fatalf("unexpected error: %q", errMsg)
	}
}

func TestReadARKEmbeddingConfigUsesEndpoint(t *testing.T) {
	t.Setenv("ARK_API_KEY", "key")
	t.Setenv("ARK_BASE_URL", "")
	t.Setenv("ARK_EMBEDDING_MODEL", "ep-embedding")
	cfg, errMsg := ReadARKEmbeddingConfig()
	if errMsg != "" || cfg.Model != "ep-embedding" || cfg.BaseURL != defaultARKBaseURLValue {
		t.Fatalf("unexpected config=%+v error=%q", cfg, errMsg)
	}
}

func TestReadARKVisionConfigPrefersVisionModel(t *testing.T) {
	t.Setenv("ARK_API_KEY", "key")
	t.Setenv("ARK_BASE_URL", "")
	t.Setenv("ARK_VISION_MODEL", "ep-vision")
	t.Setenv("ARK_TEXT_MODEL", "ep-text")
	res, errMsg := ReadARKVisionConfig()
	if errMsg != "" {
		t.Fatalf("unexpected error: %q", errMsg)
	}
	if !res.UseVision || res.Config.Model != "ep-vision" {
		t.Fatalf("expected vision selected, got %+v", res)
	}
}

func TestReadARKVisionConfigFallsBackToText(t *testing.T) {
	t.Setenv("ARK_API_KEY", "key")
	t.Setenv("ARK_VISION_MODEL", "")
	t.Setenv("ARK_TEXT_MODEL", "ep-text")
	res, errMsg := ReadARKVisionConfig()
	if errMsg != "" {
		t.Fatalf("unexpected error: %q", errMsg)
	}
	if res.UseVision || res.Config.Model != "ep-text" {
		t.Fatalf("expected text fallback, got %+v", res)
	}
}

func TestReadARKVisionConfigNoModel(t *testing.T) {
	t.Setenv("ARK_API_KEY", "key")
	t.Setenv("ARK_VISION_MODEL", "")
	t.Setenv("ARK_TEXT_MODEL", "")
	_, errMsg := ReadARKVisionConfig()
	if errMsg != "AI 未配置：ARK_VISION_MODEL 或 ARK_TEXT_MODEL 必须以 ep- 开头" {
		t.Fatalf("unexpected error: %q", errMsg)
	}
}

func TestReadARKImageConfigCandidates(t *testing.T) {
	t.Setenv("ARK_API_KEY", "key")
	t.Setenv("ARK_IMAGE_MODEL", "ep-img-1")
	t.Setenv("ARK_IMAGE_MODEL_FALLBACK", "ep-img-2,ep-img-1, ep-img-3")
	cfg, models, errMsg := ReadARKImageConfig()
	if errMsg != "" {
		t.Fatalf("unexpected error: %q", errMsg)
	}
	if cfg.Model != "ep-img-1" {
		t.Fatalf("expected primary model, got %q", cfg.Model)
	}
	want := []string{"ep-img-1", "ep-img-2", "ep-img-3"}
	if len(models) != len(want) {
		t.Fatalf("expected %v, got %v", want, models)
	}
	for i, m := range want {
		if models[i] != m {
			t.Fatalf("expected %v at %d, got %q", m, i, models[i])
		}
	}
}

func TestReadARKImageConfigMissingPrimary(t *testing.T) {
	t.Setenv("ARK_API_KEY", "key")
	t.Setenv("ARK_IMAGE_MODEL", "")
	t.Setenv("ARK_IMAGE_MODEL_FALLBACK", "")
	_, _, errMsg := ReadARKImageConfig()
	if errMsg != "AI 未配置：缺少 ARK_IMAGE_MODEL" {
		t.Fatalf("unexpected error: %q", errMsg)
	}
}

func TestARKClientPoolReturnsSamePtrPerTimeout(t *testing.T) {
	ResetForTest()
	t.Setenv("ARK_API_KEY", "key")
	t.Setenv("ARK_BASE_URL", "")

	a1 := ARKClient(35 * time.Second)
	a2 := ARKClient(35 * time.Second)
	b := ARKClient(90 * time.Second)
	if a1 == nil || a2 == nil || b == nil {
		t.Fatal("unexpected nil clients")
	}
	if a1 != a2 {
		t.Fatal("expected same pointer for same timeout")
	}
	if a1 == b {
		t.Fatal("expected different pointers for different timeouts")
	}
}

func TestARKClientReturnsNilWithoutAPIKey(t *testing.T) {
	ResetForTest()
	t.Setenv("ARK_API_KEY", "")
	if c := ARKClient(35 * time.Second); c != nil {
		t.Fatal("expected nil when ARK_API_KEY is empty")
	}
}

func TestResetForTestRebuildsClients(t *testing.T) {
	ResetForTest()
	t.Setenv("ARK_API_KEY", "key")

	a := ARKClient(35 * time.Second)
	if a == nil {
		t.Fatal("expected client")
	}
	ResetForTest()
	b := ARKClient(35 * time.Second)
	if b == nil {
		t.Fatal("expected re-created client")
	}
	if a == b {
		t.Fatal("expected new pointer after ResetForTest")
	}
}

func TestNewARKChatRequestDefaults(t *testing.T) {
	req := NewARKChatRequest("ep-text", nil)
	if req.Model != "ep-text" {
		t.Fatalf("model mismatch: %q", req.Model)
	}
	if req.MaxTokens == nil || *req.MaxTokens != 900 {
		t.Fatalf("expected default max tokens 900, got %v", req.MaxTokens)
	}
	if req.Temperature == nil || *req.Temperature != 0.7 {
		t.Fatalf("expected default temperature 0.7, got %v", req.Temperature)
	}
}

func TestNewARKChatRequestOptionsOverride(t *testing.T) {
	req := NewARKChatRequest("ep-text", nil,
		WithARKChatTokens(123),
		WithARKChatTemperature(0.42),
	)
	if *req.MaxTokens != 123 {
		t.Fatalf("expected 123, got %d", *req.MaxTokens)
	}
	if *req.Temperature != 0.42 {
		t.Fatalf("expected 0.42, got %v", *req.Temperature)
	}
}
