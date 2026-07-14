package aiclient

import (
	"context"
	"fmt"
	"os"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/volcengine/volcengine-go-sdk/service/arkruntime"
	arkmodel "github.com/volcengine/volcengine-go-sdk/service/arkruntime/model"
)

const defaultARKBaseURLValue = "https://ark.cn-beijing.volces.com/api/v3"

// ARKConfig 描述一次 ARK 调用所需的最小配置；Model 在不同调用中分别表示
// 文本接入点 / 视觉接入点 / 图像接入点。
type ARKConfig struct {
	APIKey  string
	BaseURL string
	Model   string
}

// defaultARKBaseURL 返回 ARK 的默认 Base URL（北京区域）。
func defaultARKBaseURL() string {
	return defaultARKBaseURLValue
}

var (
	arkClientMu   sync.Mutex
	arkClientPool = map[time.Duration]*arkruntime.Client{}
)

// ARKClient 返回按 timeout 共享的 ARK client 单例。
// 同一个 timeout 多次调用返回同一个指针；不同 timeout 各自独立。
// 若 ARK_API_KEY 缺失则返回 nil（错误延迟到 ReadARKTextConfig 等环节暴露）。
func ARKClient(timeout time.Duration) *arkruntime.Client {
	apiKey := strings.TrimSpace(os.Getenv("ARK_API_KEY"))
	if apiKey == "" {
		return nil
	}
	baseURL := strings.TrimSpace(os.Getenv("ARK_BASE_URL"))
	if baseURL == "" {
		baseURL = defaultARKBaseURL()
	}

	arkClientMu.Lock()
	defer arkClientMu.Unlock()
	if c, ok := arkClientPool[timeout]; ok && c != nil {
		return c
	}
	c := arkruntime.NewClientWithApiKey(
		apiKey,
		arkruntime.WithBaseUrl(baseURL),
		arkruntime.WithTimeout(timeout),
	)
	arkClientPool[timeout] = c
	return c
}

// ResetForTest 清空 ARK client 池，仅供测试和上层 lifetrace.ResetARKClientForTest 转调使用。
func ResetForTest() {
	arkClientMu.Lock()
	defer arkClientMu.Unlock()
	arkClientPool = map[time.Duration]*arkruntime.Client{}
}

// ReadARKTextConfig 读取 ARK 文本接入点配置。
// 错误文案与现有实现保持一致：
//   - "AI 未配置：缺少 ARK_API_KEY"
//   - "AI 未配置：ARK_TEXT_MODEL 必须以 ep- 开头"
func ReadARKTextConfig() (ARKConfig, string) {
	apiKey := strings.TrimSpace(os.Getenv("ARK_API_KEY"))
	textModel := strings.TrimSpace(os.Getenv("ARK_TEXT_MODEL"))
	baseURL := strings.TrimSpace(os.Getenv("ARK_BASE_URL"))
	if baseURL == "" {
		baseURL = defaultARKBaseURL()
	}
	if apiKey == "" {
		return ARKConfig{}, "AI 未配置：缺少 ARK_API_KEY"
	}
	if !strings.HasPrefix(textModel, "ep-") {
		return ARKConfig{}, "AI 未配置：ARK_TEXT_MODEL 必须以 ep- 开头"
	}
	return ARKConfig{APIKey: apiKey, BaseURL: baseURL, Model: textModel}, ""
}

// ReadARKEmbeddingConfig reads the dedicated endpoint used by private
// knowledge-base indexing. Embeddings must not silently fall back to a chat
// model because that would make retrieval quality and vector dimensions
// unpredictable.
func ReadARKEmbeddingConfig() (ARKConfig, string) {
	apiKey := strings.TrimSpace(os.Getenv("ARK_API_KEY"))
	embeddingModel := strings.TrimSpace(os.Getenv("ARK_EMBEDDING_MODEL"))
	baseURL := strings.TrimSpace(os.Getenv("ARK_BASE_URL"))
	if baseURL == "" {
		baseURL = defaultARKBaseURL()
	}
	if apiKey == "" {
		return ARKConfig{}, "AI 未配置：缺少 ARK_API_KEY"
	}
	if !strings.HasPrefix(embeddingModel, "ep-") {
		return ARKConfig{}, "AI 未配置：ARK_EMBEDDING_MODEL 必须以 ep- 开头"
	}
	return ARKConfig{APIKey: apiKey, BaseURL: baseURL, Model: embeddingModel}, ""
}

// CreateARKEmbeddings creates one embedding for every input string through the
// multimodal endpoint. The configured model accepts text input as a subset of
// its multimodal contract, while each request intentionally contains a single
// segment so document chunks never get merged into one vector.
func CreateARKEmbeddings(ctx context.Context, inputs []string) ([][]float32, error) {
	return CreateARKEmbeddingsWithProgress(ctx, inputs, nil)
}

// CreateARKEmbeddingsWithProgress reports each successfully completed segment.
// The callback is optional and callers must keep it safe for concurrent calls.
func CreateARKEmbeddingsWithProgress(ctx context.Context, inputs []string, onProgress func(completed, total int)) ([][]float32, error) {
	if len(inputs) == 0 {
		return nil, fmt.Errorf("embedding 输入不能为空")
	}
	config, errMsg := ReadARKEmbeddingConfig()
	if errMsg != "" {
		return nil, fmt.Errorf("%s", errMsg)
	}
	client := ARKClient(60 * time.Second)
	if client == nil {
		return nil, fmt.Errorf("AI 未配置：缺少 ARK_API_KEY")
	}
	vectors := make([][]float32, len(inputs))
	embeddingCtx, cancel := context.WithCancel(ctx)
	defer cancel()
	jobs := make(chan int)
	errCh := make(chan error, 1)
	workerCount := len(inputs)
	if workerCount > 4 {
		workerCount = 4
	}
	var workers sync.WaitGroup
	var completed atomic.Int64
	for range workerCount {
		workers.Add(1)
		go func() {
			defer workers.Done()
			for index := range jobs {
				text := inputs[index]
				response, err := client.CreateMultiModalEmbeddings(embeddingCtx, arkmodel.MultiModalEmbeddingRequest{
					Model: config.Model,
					Input: []arkmodel.MultimodalEmbeddingInput{{
						Type: arkmodel.MultiModalEmbeddingInputTypeText,
						Text: &text,
					}},
				})
				if err != nil || len(response.Data.Embedding) == 0 {
					failure := err
					if failure == nil {
						failure = fmt.Errorf("ARK embedding 返回空向量")
					}
					select {
					case errCh <- fmt.Errorf("ARK embedding 调用失败: %w", failure):
					default:
					}
					cancel()
					return
				}
				vectors[index] = response.Data.Embedding
				if onProgress != nil {
					onProgress(int(completed.Add(1)), len(inputs))
				}
			}
		}()
	}
dispatch:
	for index := range inputs {
		select {
		case jobs <- index:
		case <-embeddingCtx.Done():
			break dispatch
		}
	}
	close(jobs)
	workers.Wait()
	select {
	case err := <-errCh:
		return nil, err
	default:
	}
	if err := embeddingCtx.Err(); err != nil && ctx.Err() != nil {
		return nil, fmt.Errorf("ARK embedding 调用失败: %w", err)
	}
	for _, vector := range vectors {
		if len(vector) == 0 {
			return nil, fmt.Errorf("ARK embedding 返回缺失向量")
		}
	}
	return vectors, nil
}

// ARKVisionConfigResult 携带视觉模型选择结果以及是否走视觉端点的标志位。
type ARKVisionConfigResult struct {
	Config    ARKConfig
	UseVision bool
}

// ReadARKVisionConfig 读取 ARK 视觉/文本接入点配置；
// 优先 ARK_VISION_MODEL（UseVision=true），缺失或不以 ep- 开头时回退 ARK_TEXT_MODEL（UseVision=false）。
// 都不可用时返回错误文案 "AI 未配置：ARK_VISION_MODEL 或 ARK_TEXT_MODEL 必须以 ep- 开头"。
func ReadARKVisionConfig() (ARKVisionConfigResult, string) {
	apiKey := strings.TrimSpace(os.Getenv("ARK_API_KEY"))
	baseURL := strings.TrimSpace(os.Getenv("ARK_BASE_URL"))
	visionModel := strings.TrimSpace(os.Getenv("ARK_VISION_MODEL"))
	textModel := strings.TrimSpace(os.Getenv("ARK_TEXT_MODEL"))
	if baseURL == "" {
		baseURL = defaultARKBaseURL()
	}
	if apiKey == "" {
		return ARKVisionConfigResult{}, "AI 未配置：缺少 ARK_API_KEY"
	}
	if strings.HasPrefix(visionModel, "ep-") {
		return ARKVisionConfigResult{
			Config:    ARKConfig{APIKey: apiKey, BaseURL: baseURL, Model: visionModel},
			UseVision: true,
		}, ""
	}
	if strings.HasPrefix(textModel, "ep-") {
		return ARKVisionConfigResult{
			Config:    ARKConfig{APIKey: apiKey, BaseURL: baseURL, Model: textModel},
			UseVision: false,
		}, ""
	}
	return ARKVisionConfigResult{}, "AI 未配置：ARK_VISION_MODEL 或 ARK_TEXT_MODEL 必须以 ep- 开头"
}

// ReadARKImageConfig 读取 ARK 图像生成接入点配置，并返回候选模型列表。
// 候选包含 ARK_IMAGE_MODEL 主模型 + 逗号分隔的 ARK_IMAGE_MODEL_FALLBACK 备选；去重保序。
// 错误文案：
//   - "AI 未配置：缺少 ARK_API_KEY"
//   - "AI 未配置：缺少 ARK_IMAGE_MODEL"
func ReadARKImageConfig() (ARKConfig, []string, string) {
	apiKey := strings.TrimSpace(os.Getenv("ARK_API_KEY"))
	baseURL := strings.TrimSpace(os.Getenv("ARK_BASE_URL"))
	primary := strings.TrimSpace(os.Getenv("ARK_IMAGE_MODEL"))
	if baseURL == "" {
		baseURL = defaultARKBaseURL()
	}
	if apiKey == "" {
		return ARKConfig{}, nil, "AI 未配置：缺少 ARK_API_KEY"
	}
	models := arkImageModelCandidates(primary)
	if len(models) == 0 {
		return ARKConfig{}, nil, "AI 未配置：缺少 ARK_IMAGE_MODEL"
	}
	return ARKConfig{APIKey: apiKey, BaseURL: baseURL, Model: models[0]}, models, ""
}

func arkImageModelCandidates(primary string) []string {
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

// ARKChatOption 用于 NewARKChatRequest 的可选参数。
type ARKChatOption func(*arkChatRequestOpts)

type arkChatRequestOpts struct {
	maxTokens   int
	temperature float32
}

// WithARKChatTokens 覆盖默认 MaxTokens（默认 900）。
func WithARKChatTokens(n int) ARKChatOption {
	return func(o *arkChatRequestOpts) { o.maxTokens = n }
}

// WithARKChatTemperature 覆盖默认 Temperature（默认 0.7）。
func WithARKChatTemperature(t float32) ARKChatOption {
	return func(o *arkChatRequestOpts) { o.temperature = t }
}

// NewARKChatRequest 构造 ARK 文本对话请求；默认 MaxTokens=900, Temperature=0.7。
func NewARKChatRequest(
	modelID string,
	messages []*arkmodel.ChatCompletionMessage,
	opts ...ARKChatOption,
) arkmodel.CreateChatCompletionRequest {
	o := arkChatRequestOpts{maxTokens: 900, temperature: 0.7}
	for _, fn := range opts {
		fn(&o)
	}
	maxTokens := o.maxTokens
	temperature := o.temperature
	return arkmodel.CreateChatCompletionRequest{
		Model:       modelID,
		Messages:    messages,
		MaxTokens:   &maxTokens,
		Temperature: &temperature,
	}
}
