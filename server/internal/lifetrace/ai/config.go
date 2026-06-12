package ai

import (
	"os"
	"strconv"
	"strings"
	"time"
)

const DefaultARKBaseURL = "https://ark.cn-beijing.volces.com/api/v3"

type TextConfig struct {
	Source  string
	APIKey  string
	BaseURL string
	Model   string
	Timeout time.Duration
}

type ImageConfig struct {
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
	apiKey := strings.TrimSpace(os.Getenv("ARK_API_KEY"))
	baseURL := strings.TrimSpace(os.Getenv("ARK_BASE_URL"))
	visionModel := strings.TrimSpace(os.Getenv("ARK_VISION_MODEL"))
	textModel := strings.TrimSpace(os.Getenv("ARK_TEXT_MODEL"))
	if baseURL == "" {
		baseURL = DefaultARKBaseURL
	}
	if apiKey == "" {
		return ImageConfig{}, "AI 未配置：缺少 ARK_API_KEY"
	}
	if strings.HasPrefix(visionModel, "ep-") {
		return ImageConfig{
			APIKey:    apiKey,
			BaseURL:   baseURL,
			Model:     visionModel,
			Timeout:   defaultTimeout,
			UseVision: true,
		}, ""
	}
	if strings.HasPrefix(textModel, "ep-") {
		return ImageConfig{
			APIKey:    apiKey,
			BaseURL:   baseURL,
			Model:     textModel,
			Timeout:   defaultTimeout,
			UseVision: false,
		}, ""
	}
	return ImageConfig{}, "AI 未配置：ARK_VISION_MODEL 或 ARK_TEXT_MODEL 必须以 ep- 开头"
}

func ReadThumbnailConfig() (ThumbnailConfig, string) {
	apiKey := strings.TrimSpace(os.Getenv("ARK_API_KEY"))
	baseURL := strings.TrimSpace(os.Getenv("ARK_BASE_URL"))
	primary := strings.TrimSpace(os.Getenv("ARK_IMAGE_MODEL"))
	if baseURL == "" {
		baseURL = DefaultARKBaseURL
	}
	if apiKey == "" {
		return ThumbnailConfig{}, "AI 未配置：缺少 ARK_API_KEY"
	}

	modelIDs := imageModelCandidates(primary)
	if len(modelIDs) == 0 {
		return ThumbnailConfig{}, "AI 未配置：缺少 ARK_IMAGE_MODEL"
	}

	return ThumbnailConfig{
		APIKey:   apiKey,
		BaseURL:  baseURL,
		ModelIDs: modelIDs,
	}, ""
}

func ReadARKTextConfig() (apiKey, baseURL, textModel string, errMsg string) {
	apiKey = strings.TrimSpace(os.Getenv("ARK_API_KEY"))
	textModel = strings.TrimSpace(os.Getenv("ARK_TEXT_MODEL"))
	baseURL = strings.TrimSpace(os.Getenv("ARK_BASE_URL"))
	if baseURL == "" {
		baseURL = DefaultARKBaseURL
	}
	if apiKey == "" {
		return "", "", "", "AI 未配置：缺少 ARK_API_KEY"
	}
	if !strings.HasPrefix(textModel, "ep-") {
		return "", "", "", "AI 未配置：ARK_TEXT_MODEL 必须以 ep- 开头"
	}
	return apiKey, baseURL, textModel, ""
}

func readOpenAIConfig(defaultTimeout time.Duration) (TextConfig, bool) {
	apiKey := strings.TrimSpace(os.Getenv("OPENAI_API_KEY"))
	if apiKey == "" {
		return TextConfig{}, false
	}

	baseURL := strings.TrimRight(strings.TrimSpace(os.Getenv("OPENAI_API_BASE_URL")), "/")
	if baseURL == "" {
		baseURL = "https://api.openai.com/v1"
	}

	model := strings.TrimSpace(os.Getenv("OPENAI_API_MODEL"))
	if model == "" {
		model = "gpt-5.4"
	}

	return TextConfig{
		Source:  "openai",
		APIKey:  apiKey,
		BaseURL: baseURL,
		Model:   model,
		Timeout: parseOpenAITimeout(os.Getenv("OPENAI_API_TIMEOUT"), defaultTimeout),
	}, true
}

func parseOpenAITimeout(raw string, fallback time.Duration) time.Duration {
	value := strings.TrimSpace(raw)
	if value == "" {
		return fallback
	}

	seconds, err := strconv.Atoi(value)
	if err != nil || seconds <= 0 {
		return fallback
	}
	return time.Duration(seconds) * time.Second
}

func imageModelCandidates(primary string) []string {
	seen := make(map[string]struct{}, 4)
	models := make([]string, 0, 4)
	add := func(raw string) {
		value := strings.TrimSpace(raw)
		if value == "" {
			return
		}
		if _, exists := seen[value]; exists {
			return
		}
		seen[value] = struct{}{}
		models = append(models, value)
	}

	add(primary)
	for _, item := range strings.Split(os.Getenv("ARK_IMAGE_MODEL_FALLBACK"), ",") {
		add(item)
	}
	return models
}
