package aiclient

import (
	"os"
	"strings"
	"time"
)

const (
	defaultGeminiBaseURL = "https://generativelanguage.googleapis.com/v1beta"
	defaultGeminiModel   = "gemini-2.5-flash"
)

// GeminiVisionConfig 描述 Gemini Vision (多模态) 调用所需的最小配置。
type GeminiVisionConfig struct {
	APIKey  string
	BaseURL string
	Model   string
	Timeout time.Duration
}

// ReadGeminiVisionConfig 读取 Gemini Vision 配置：
//   - GEMINI_API_KEY 必须存在，否则返回 (zero, false)，由调用方决定是否回退到 ARK；
//   - GEMINI_API_BASE_URL 缺省 https://generativelanguage.googleapis.com/v1beta；
//   - GEMINI_VISION_MODEL 缺省 gemini-2.5-flash；
//   - timeout 优先按 timeoutEnvs 顺序读，命中后按"秒"解析；缺失或非正数回退 defaultTimeout。
func ReadGeminiVisionConfig(defaultTimeout time.Duration, timeoutEnvs []string) (GeminiVisionConfig, bool) {
	apiKey := strings.TrimSpace(os.Getenv("GEMINI_API_KEY"))
	if apiKey == "" {
		return GeminiVisionConfig{}, false
	}

	baseURL := strings.TrimRight(strings.TrimSpace(os.Getenv("GEMINI_API_BASE_URL")), "/")
	if baseURL == "" {
		baseURL = defaultGeminiBaseURL
	}

	model := strings.TrimSpace(os.Getenv("GEMINI_VISION_MODEL"))
	if model == "" {
		model = defaultGeminiModel
	}

	return GeminiVisionConfig{
		APIKey:  apiKey,
		BaseURL: baseURL,
		Model:   model,
		Timeout: parseTimeoutSeconds(firstEnv(timeoutEnvs...), defaultTimeout),
	}, true
}
