package ai

import (
	"os"
	"strings"
	"time"

	"valley-server/internal/aiclient"
)

const (
	DefaultARKBaseURL    = "https://ark.cn-beijing.volces.com/api/v3"
	DefaultGeminiBaseURL = "https://generativelanguage.googleapis.com/v1beta"
	DefaultGeminiModel   = "gemini-2.5-flash"
)

type TextConfig struct {
	Source  string
	APIKey  string
	BaseURL string
	Model   string
	Timeout time.Duration
}

type ImageConfig struct {
	Source    string
	APIKey    string
	BaseURL   string
	Model     string
	Timeout   time.Duration
	UseVision bool
}

type ThumbnailConfig struct {
	APIKey   string
	BaseURL  string
	ModelIDs []string
}

func ReadTextConfig(defaultTimeout time.Duration) (TextConfig, string) {
	if cfg, ok := readOpenAIConfig(defaultTimeout); ok {
		return cfg, ""
	}

	apiKey, baseURL, model, errMsg := ReadARKTextConfig()
	if errMsg != "" {
		return TextConfig{}, errMsg
	}
	return TextConfig{
		Source:  "ark",
		APIKey:  apiKey,
		BaseURL: baseURL,
		Model:   model,
		Timeout: defaultTimeout,
	}, ""
}

func ReadImageConfig(defaultTimeout time.Duration) (ImageConfig, string) {
	result, msg := aiclient.ReadARKVisionConfig()
	if msg != "" {
		return ImageConfig{}, msg
	}
	return ImageConfig{
		Source:    "ark",
		APIKey:    result.Config.APIKey,
		BaseURL:   result.Config.BaseURL,
		Model:     result.Config.Model,
		Timeout:   defaultTimeout,
		UseVision: result.UseVision,
	}, ""
}

func ReadPantryPhotoConfig(defaultTimeout time.Duration) (ImageConfig, string) {
	provider := strings.ToLower(strings.TrimSpace(os.Getenv("LIFE_TRACE_PANTRY_PHOTO_AI_PROVIDER")))
	switch provider {
	case "", "auto":
	case "ark":
		return ReadImageConfig(defaultTimeout)
	case "gemini":
		cfg, ok := readGeminiVisionConfig(defaultTimeout)
		if !ok {
			return ImageConfig{}, "AI 未配置：缺少 GEMINI_API_KEY"
		}
		return cfg, ""
	default:
		return ImageConfig{}, "AI 未配置：LIFE_TRACE_PANTRY_PHOTO_AI_PROVIDER 仅支持 auto、gemini、ark"
	}

	if cfg, ok := readGeminiVisionConfig(defaultTimeout); ok {
		return cfg, ""
	}
	return ReadImageConfig(defaultTimeout)
}

func ReadThumbnailConfig() (ThumbnailConfig, string) {
	cfg, modelIDs, msg := aiclient.ReadARKImageConfig()
	if msg != "" {
		return ThumbnailConfig{}, msg
	}
	return ThumbnailConfig{
		APIKey:   cfg.APIKey,
		BaseURL:  cfg.BaseURL,
		ModelIDs: modelIDs,
	}, ""
}

func ReadARKTextConfig() (apiKey, baseURL, textModel string, errMsg string) {
	cfg, msg := aiclient.ReadARKTextConfig()
	return cfg.APIKey, cfg.BaseURL, cfg.Model, msg
}

func readOpenAIConfig(defaultTimeout time.Duration) (TextConfig, bool) {
	cfg, ok := aiclient.ReadOpenAIConfig(aiclient.OpenAIConfigOpts{
		APIKeyEnvs:     []string{"LIFE_TRACE_AI_API_KEY", "OPENAI_API_KEY"},
		BaseURLEnvs:    []string{"LIFE_TRACE_AI_BASE_URL", "OPENAI_API_BASE_URL"},
		ModelEnvs:      []string{"LIFE_TRACE_AI_MODEL", "OPENAI_API_MODEL"},
		TimeoutEnvs:    []string{"LIFE_TRACE_AI_TIMEOUT_SECONDS", "OPENAI_API_TIMEOUT"},
		DefaultBaseURL: "https://api.openai.com/v1",
		DefaultModel:   "gpt-5.4",
		DefaultTimeout: defaultTimeout,
	})
	if !ok {
		return TextConfig{}, false
	}
	return TextConfig{
		Source:  "openai",
		APIKey:  cfg.APIKey,
		BaseURL: cfg.BaseURL,
		Model:   cfg.Model,
		Timeout: cfg.Timeout,
	}, true
}

func readGeminiVisionConfig(defaultTimeout time.Duration) (ImageConfig, bool) {
	cfg, ok := aiclient.ReadGeminiVisionConfig(
		defaultTimeout,
		[]string{"LIFE_TRACE_PANTRY_PHOTO_AI_TIMEOUT_SECONDS", "GEMINI_VISION_TIMEOUT_SECONDS"},
	)
	if !ok {
		return ImageConfig{}, false
	}
	return ImageConfig{
		Source:    "gemini",
		APIKey:    cfg.APIKey,
		BaseURL:   cfg.BaseURL,
		Model:     cfg.Model,
		Timeout:   cfg.Timeout,
		UseVision: true,
	}, true
}
