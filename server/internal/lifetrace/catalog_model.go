package lifetrace

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"time"

	"valley-server/internal/aiclient"
	"valley-server/internal/aimodel"
	"valley-server/internal/aiusage"
	"valley-server/internal/database"

	"github.com/gin-gonic/gin"
)

const lifeTraceCatalogSystemPrompt = "你是 Life Trace 的生活计划 AI。只输出 JSON 对象，不要 Markdown，不要解释。"

func resolveLifeTraceCatalogInvocation(
	c *gin.Context,
	modelID string,
	capability string,
	timeout time.Duration,
) (aimodel.Invocation, bool) {
	invocation, err := aimodel.ResolveInvocation(database.GetDB(), modelID, capability, timeout)
	if err == nil {
		return invocation, true
	}
	if errors.Is(err, aimodel.ErrModelNotAvailable) {
		fail(c, http.StatusBadRequest, "请选择已启用且适合当前任务的模型")
		return aimodel.Invocation{}, false
	}
	fail(c, http.StatusServiceUnavailable, err.Error())
	return aimodel.Invocation{}, false
}

func callLifeTraceCatalogJSON(
	ctx context.Context,
	invocation aimodel.Invocation,
	prompt string,
	maxTokens int,
) (string, string, error) {
	if maxTokens <= 0 {
		maxTokens = 260
	}
	start := time.Now()
	response, err := invocation.Client.Chat(ctx, aiclient.CompatibleChatRequest{
		Model: invocation.Model.ModelID,
		Messages: []aiclient.CompatibleMessage{
			{Role: "system", Content: lifeTraceCatalogSystemPrompt},
			{Role: "user", Content: prompt},
		},
		MaxTokens:      &maxTokens,
		ResponseFormat: map[string]string{"type": "json_object"},
	})
	if err != nil {
		aiclient.RecordCallFromContext(ctx, invocation.Provider.Provider, invocation.Model.ModelID, prompt, "", aiusage.Since(start), err)
		return "", invocation.Model.ModelID, err
	}
	modelName := strings.TrimSpace(response.Model)
	if modelName == "" {
		modelName = invocation.Model.ModelID
	}
	raw := lifeTraceCatalogMessageText(response.Choices[0].Message.Content)
	if raw == "" {
		err = errors.New("AI 上游返回空内容")
		aiclient.RecordCallFromContext(ctx, invocation.Provider.Provider, modelName, prompt, "", aiusage.Since(start), err)
		return "", modelName, err
	}
	aiclient.RecordCallFromContext(ctx, invocation.Provider.Provider, modelName, prompt, raw, aiusage.Since(start), nil)
	return raw, modelName, nil
}

func lifeTraceCatalogMessageText(content any) string {
	switch value := content.(type) {
	case string:
		return strings.TrimSpace(value)
	case []any:
		parts := make([]string, 0, len(value))
		for _, item := range value {
			part, ok := item.(map[string]any)
			if !ok {
				continue
			}
			if text, ok := part["text"].(string); ok && strings.TrimSpace(text) != "" {
				parts = append(parts, strings.TrimSpace(text))
			}
		}
		return strings.TrimSpace(strings.Join(parts, "\n"))
	default:
		return ""
	}
}
