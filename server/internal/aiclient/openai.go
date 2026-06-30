package aiclient

import (
	"os"
	"strconv"
	"strings"
	"time"
)

// OpenAIConfig 是 OpenAI 兼容接口的最小配置；
// 同样适用于自部署 OpenAI 兼容服务（仅 Base URL 和 Model 不同）。
type OpenAIConfig struct {
	APIKey  string
	BaseURL string
	Model   string
	Timeout time.Duration
}

// OpenAIConfigOpts 描述如何按多个 env 链路读取 OpenAI 兼容配置。
//
// 典型用法（lifetrace）：
//
//	ReadOpenAIConfig(OpenAIConfigOpts{
//	    APIKeyEnvs:  []string{"LIFE_TRACE_AI_API_KEY", "OPENAI_API_KEY"},
//	    BaseURLEnvs: []string{"LIFE_TRACE_AI_BASE_URL", "OPENAI_API_BASE_URL"},
//	    ModelEnvs:   []string{"LIFE_TRACE_AI_MODEL", "OPENAI_API_MODEL"},
//	    TimeoutEnvs: []string{"LIFE_TRACE_AI_TIMEOUT_SECONDS", "OPENAI_API_TIMEOUT"},
//	    DefaultBaseURL: "https://api.openai.com/v1",
//	    DefaultModel:   "gpt-5.4",
//	    DefaultTimeout: 30 * time.Second,
//	})
type OpenAIConfigOpts struct {
	APIKeyEnvs     []string
	BaseURLEnvs    []string
	ModelEnvs      []string
	TimeoutEnvs    []string
	DefaultBaseURL string
	DefaultModel   string
	DefaultTimeout time.Duration
}

// ReadOpenAIConfig 按 OpenAIConfigOpts 描述的优先级链路读取配置。
// API Key 缺失时返回 (zero, false)，由调用方决定是否回退到其他 provider。
func ReadOpenAIConfig(opts OpenAIConfigOpts) (OpenAIConfig, bool) {
	apiKey := firstEnv(opts.APIKeyEnvs...)
	if apiKey == "" {
		return OpenAIConfig{}, false
	}

	baseURL := strings.TrimRight(firstEnv(opts.BaseURLEnvs...), "/")
	if baseURL == "" {
		baseURL = opts.DefaultBaseURL
	}

	model := firstEnv(opts.ModelEnvs...)
	if model == "" {
		model = opts.DefaultModel
	}

	timeoutRaw := firstEnv(opts.TimeoutEnvs...)
	return OpenAIConfig{
		APIKey:  apiKey,
		BaseURL: baseURL,
		Model:   model,
		Timeout: parseTimeoutSeconds(timeoutRaw, opts.DefaultTimeout),
	}, true
}

// firstEnv 按顺序读取多个 env，返回第一个非空（trim 后）的值。
func firstEnv(keys ...string) string {
	for _, key := range keys {
		value := strings.TrimSpace(os.Getenv(key))
		if value != "" {
			return value
		}
	}
	return ""
}

// parseTimeoutSeconds 把 "30" 这样的秒数字符串解析成 time.Duration；
// 解析失败或非正数时回退 fallback。
func parseTimeoutSeconds(raw string, fallback time.Duration) time.Duration {
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
