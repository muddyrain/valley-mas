package lifetrace

import (
	"context"
	"errors"
	"net/http"
	"os"
	"strings"
	"time"
	"valley-server/internal/aiclient"
	"valley-server/internal/aimodel"
	"valley-server/internal/aiusage"
	"valley-server/internal/database"
	lifeai "valley-server/internal/lifetrace/ai"

	"github.com/gin-gonic/gin"
	"github.com/volcengine/volcengine-go-sdk/service/arkruntime"
	arkmodel "github.com/volcengine/volcengine-go-sdk/service/arkruntime/model"
)

// 本文件是 Life Trace AI 调用层的薄兼容层：
// - 完整能力实现已下沉到 internal/lifetrace/ai（lifeai）+ internal/aiclient。
// - 保留 shim 与 type alias 供 handler / 测试文件继续沿用旧名。

func readLifeTraceAIConfig() (lifeTraceAIConfig, string) {
	return lifeai.ReadTextConfig(lifeTraceTodayAdviceDefaultTimeout)
}

// resolveLifeTraceCatalogTextModel validates a user-selected text model from
// the directory before passing its provider credentials to Life Trace prompts.
func resolveLifeTraceCatalogTextModel(c *gin.Context, rawModelID string, timeout time.Duration) (lifeTraceAIConfig, bool) {
	invocation, err := aimodel.ResolveInvocation(database.GetDB(), rawModelID, "text", timeout)
	if err != nil {
		respondLifeTraceCatalogModelError(c, err)
		return lifeTraceAIConfig{}, false
	}
	return lifeai.TextConfig{
		Source:  invocation.Provider.Provider,
		APIKey:  invocation.Provider.APIKey,
		BaseURL: invocation.Provider.BaseURL,
		Model:   invocation.Model.ModelID,
		Timeout: timeout,
	}, true
}

func respondLifeTraceCatalogModelError(c *gin.Context, err error) {
	if errors.Is(err, aimodel.ErrModelNotAvailable) {
		fail(c, http.StatusBadRequest, "所选模型不可用或不支持当前能力")
		return
	}
	if strings.Contains(err.Error(), "AI 服务未配置") || strings.Contains(err.Error(), "不支持的 AI Provider") {
		fail(c, http.StatusServiceUnavailable, err.Error())
		return
	}
	fail(c, http.StatusInternalServerError, "加载 AI 模型失败："+err.Error())
}

func readLifeTraceArkTextConfig() (apiKey, arkBaseURL, textModel string, errMsg string) {
	apiKey = strings.TrimSpace(os.Getenv("ARK_API_KEY"))
	textModel = strings.TrimSpace(os.Getenv("ARK_TEXT_MODEL"))
	arkBaseURL = strings.TrimSpace(os.Getenv("ARK_BASE_URL"))
	if arkBaseURL == "" {
		arkBaseURL = "https://ark.cn-beijing.volces.com/api/v3"
	}
	if apiKey == "" {
		return "", "", "", "AI 未配置：缺少 ARK_API_KEY"
	}
	if !strings.HasPrefix(textModel, "ep-") {
		return "", "", "", "AI 未配置：ARK_TEXT_MODEL 必须以 ep- 开头"
	}
	return apiKey, arkBaseURL, textModel, ""
}

func ensureLifeTraceArkClient(apiKey, arkBaseURL string) *arkruntime.Client {
	return lifeai.EnsureARKClient(apiKey, arkBaseURL)
}

// callLifeTraceAssistantStructuredResponse 走 lifeai 双轨（tool → JSON 降级），
// 并把 raw JSON 解析成 lifetrace 域的结构化响应。
func callLifeTraceAssistantStructuredResponse(
	ctx context.Context,
	cfg lifeTraceAIConfig,
	systemPrompt string,
	structuredPrompt string,
) (lifeTraceAssistantStructuredResponse, string, error) {
	result, err := lifeai.NewClient().CallAssistantStructured(ctx, cfg, systemPrompt, structuredPrompt, lifeai.AssistantCallOptions{
		ToolName:    lifeTraceAssistantToolName,
		ToolSchema:  buildLifeTraceAssistantToolSchema(),
		MaxTokens:   420,
		Temperature: 0.2,
	})
	if err != nil {
		return lifeTraceAssistantStructuredResponse{}, result.Model, err
	}
	parsed, parseErr := parseLifeTraceAssistantStructuredResponse(result.Content)
	if parseErr != nil {
		return lifeTraceAssistantStructuredResponse{}, result.Model, parseErr
	}
	return parsed, result.Model, nil
}

func buildLifeTraceAssistantToolSchema() map[string]any {
	actionTypes := append([]string{"none"}, lifeTraceAssistantActionRegistry.Types()...)
	return map[string]any{
		"type": "object",
		"properties": map[string]any{
			"reply": map[string]any{
				"type":        "string",
				"description": "给用户看的简短中文回复",
			},
			"action": map[string]any{
				"type":        "object",
				"description": "要执行的生活迹动作，没有动作时 type=none",
				"properties": map[string]any{
					"type": map[string]any{
						"type": "string",
						"enum": actionTypes,
					},
					"message": map[string]any{
						"type": "string",
					},
					"needMoreInfoFields": map[string]any{
						"type": "array",
						"items": map[string]any{
							"type": "string",
							"enum": []string{"expiresAt", "scheduledDate", "scheduledTime", "amount"},
						},
					},
					"plan": map[string]any{
						"type": "object",
						"properties": map[string]any{
							"title":         map[string]any{"type": "string"},
							"type":          map[string]any{"type": "string", "enum": []string{"电影", "吃饭", "运动", "阅读", "聚会", "普通事项"}},
							"scheduledDate": map[string]any{"type": "string"},
							"scheduledTime": map[string]any{"type": "string"},
							"timezone":      map[string]any{"type": "string"},
							"notePrefix":    map[string]any{"type": "string"},
						},
					},
					"pantry": map[string]any{
						"type": "object",
						"properties": map[string]any{
							"name":      map[string]any{"type": "string"},
							"category":  map[string]any{"type": "string", "enum": []string{"食品", "日用品", "药品", "宠物", "其他"}},
							"quantity":  map[string]any{"type": "integer"},
							"unit":      map[string]any{"type": "string"},
							"location":  map[string]any{"type": "string", "enum": []string{"冷藏", "冷冻", "厨房", "储物柜", "卫生间", "玄关", "其他"}},
							"expiresAt": map[string]any{"type": "string"},
							"openedAt":  map[string]any{"type": "string"},
							"note":      map[string]any{"type": "string"},
						},
					},
					"ledger": map[string]any{
						"type": "object",
						"properties": map[string]any{
							"amount":     map[string]any{"type": "number"},
							"currency":   map[string]any{"type": "string"},
							"direction":  map[string]any{"type": "string", "enum": []string{"支出", "收入", "退款", "转账备注"}},
							"category":   map[string]any{"type": "string", "enum": []string{"吃饭", "交通", "购物", "书影音", "订阅", "家用", "礼物", "医疗", "其他"}},
							"occurredAt": map[string]any{"type": "string"},
							"merchant":   map[string]any{"type": "string"},
							"location":   map[string]any{"type": "string"},
							"note":       map[string]any{"type": "string"},
						},
					},
				},
				"required": []string{"type"},
			},
		},
		"required": []string{"reply", "action"},
	}
}

func streamLifeTraceAssistantARK(
	c *gin.Context,
	ctx context.Context,
	_ *arkruntime.Client,
	modelID string,
	systemPrompt string,
	userPrompt string,
	beforeDone func(func(lifeTraceAssistantStreamChunk)),
) error {
	w, err := aiclient.NewSSEWriter(c)
	if err != nil {
		return err
	}
	return lifeai.NewClient().StreamAssistantARK(ctx, w, lifeai.AssistantStreamOptions{
		ModelID:    modelID,
		System:     systemPrompt,
		User:       userPrompt,
		BeforeDone: adaptAssistantBeforeDone(beforeDone),
	})
}

func streamLifeTraceAssistantOpenAI(
	c *gin.Context,
	ctx context.Context,
	cfg lifeTraceAIConfig,
	systemPrompt string,
	userPrompt string,
	beforeDone func(func(lifeTraceAssistantStreamChunk)),
) error {
	w, err := aiclient.NewSSEWriter(c)
	if err != nil {
		return err
	}
	return lifeai.NewClient().StreamAssistantOpenAI(ctx, w, cfg, lifeai.AssistantStreamOptions{
		System:     systemPrompt,
		User:       userPrompt,
		BeforeDone: adaptAssistantBeforeDone(beforeDone),
	})
}

// adaptAssistantBeforeDone 把 lifetrace 域的 chunk 回调适配成 lifeai 的 SSEWriter 回调，
// 让 handler 保持沿用 lifeTraceAssistantStreamChunk（含 Action 字段）。
func adaptAssistantBeforeDone(beforeDone func(func(lifeTraceAssistantStreamChunk))) func(*aiclient.SSEWriter) {
	if beforeDone == nil {
		return nil
	}
	return func(w *aiclient.SSEWriter) {
		beforeDone(func(chunk lifeTraceAssistantStreamChunk) {
			_ = w.Send(chunk)
		})
	}
}

// callLifeTraceTextAIWithMaxTokens 走裸 ARK SDK 单轮文本调用，供 achievement_handler 使用。
// 保留 timeout 相关外部 client 依赖（不改调用姿势）。
func callLifeTraceTextAIWithMaxTokens(
	ctx context.Context,
	client *arkruntime.Client,
	modelID string,
	prompt string,
	maxTokens int,
) (string, string, error) {
	start := time.Now()
	temperature := float32(0.35)
	content := strings.TrimSpace(prompt)
	resp, err := client.CreateChatCompletion(ctx, arkmodel.CreateChatCompletionRequest{
		Model: modelID,
		Messages: []*arkmodel.ChatCompletionMessage{
			{
				Role: arkmodel.ChatMessageRoleUser,
				Content: &arkmodel.ChatCompletionMessageContent{
					StringValue: &content,
				},
			},
		},
		MaxTokens:   &maxTokens,
		Temperature: &temperature,
	})
	if err != nil {
		aiclient.RecordCallFromContext(ctx, "ark", modelID, prompt, "", aiusage.Since(start), err)
		return "", "", err
	}
	if len(resp.Choices) == 0 || resp.Choices[0].Message.Content == nil {
		emptyErr := errors.New("empty AI response")
		aiclient.RecordCallFromContext(ctx, "ark", resp.Model, prompt, "", aiusage.Since(start), emptyErr)
		return "", resp.Model, emptyErr
	}

	raw := ""
	contentValue := resp.Choices[0].Message.Content
	if contentValue.StringValue != nil {
		raw = *contentValue.StringValue
	} else {
		parts := make([]string, 0, len(contentValue.ListValue))
		for _, part := range contentValue.ListValue {
			if part != nil && strings.TrimSpace(part.Text) != "" {
				parts = append(parts, strings.TrimSpace(part.Text))
			}
		}
		raw = strings.Join(parts, "\n")
	}

	raw = strings.TrimSpace(raw)
	if raw == "" {
		emptyErr := errors.New("empty AI content")
		aiclient.RecordCallFromContext(ctx, "ark", resp.Model, prompt, "", aiusage.Since(start), emptyErr)
		return "", resp.Model, emptyErr
	}
	aiclient.RecordCallFromContext(ctx, "ark", resp.Model, prompt, raw, aiusage.Since(start), nil)
	return raw, resp.Model, nil
}

func callLifeTraceAI(ctx context.Context, cfg lifeTraceAIConfig, prompt string) (string, string, error) {
	return callLifeTraceAIWithMaxTokens(ctx, cfg, prompt, 260)
}

func callLifeTraceAIWithMaxTokens(ctx context.Context, cfg lifeTraceAIConfig, prompt string, maxTokens int) (string, string, error) {
	result, err := lifeai.NewClient().GenerateJSON(ctx, cfg, lifeai.TextRequest{
		Prompt:    prompt,
		MaxTokens: maxTokens,
		JSONMode:  true,
	})
	return result.Content, result.Model, err
}

// Type alias 保护：ai_handler_test.go / inbox_handler_test.go 直接断言这些私有类型。
type lifeTraceOpenAIRequest = aiclient.OpenAIRequest

type lifeTraceOpenAIMessage = aiclient.OpenAIMessage

type lifeTraceOpenAITool = aiclient.OpenAITool

type lifeTraceOpenAIFunctionDefinition = aiclient.OpenAIFunctionDefinition

type lifeTraceOpenAIToolChoice = aiclient.OpenAIToolChoice

type lifeTraceOpenAIToolChoiceFunction = aiclient.OpenAIToolChoiceFunction

type lifeTraceOpenAIToolCall = aiclient.OpenAIToolCall

type lifeTraceOpenAIFunctionCall = aiclient.OpenAIFunctionCall

type lifeTraceResponseFormat = aiclient.OpenAIResponseFormat

type lifeTraceOpenAIResponse = aiclient.OpenAIResponse

type lifeTraceOpenAIStreamResponse = aiclient.OpenAIStreamResponse
