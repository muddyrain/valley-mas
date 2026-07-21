package aiclient

import (
	"context"
	"valley-server/internal/aiusage"
)

// 常用 Feature 常量。新接入 AI 能力时优先复用这些常量名，
// 而不是在每个 handler 各自硬编码字符串。
const (
	FeatureValleyAIChat     = "valley-ai-chat"
	FeatureDesktopAgentChat = "desktop-ai-agent-chat"
	FeatureBlogReaderAsk    = "blog-reader-ask"
	FeatureBlogExcerpt      = "blog-ai-excerpt"
	FeatureBlogCover        = "blog-ai-cover"
	FeatureBlogReaderGuide  = "blog-reader-guide"
	FeatureBlogRecommend    = "blog-recommend"
	FeatureResourceTitle    = "resource-ai-title"
	FeatureResourceTags     = "resource-ai-tags"
)

// RecordCall 记录一次 AI 调用结果。audit 通常通过 aiusage.FromContext(ctx) 获取。
// callErr != nil 时会写 status=failed + ErrorMessage；prompt/response 用 char count 计量。
func RecordCall(
	provider string,
	modelName string,
	prompt string,
	response string,
	latencyMs int64,
	callErr error,
	audit aiusage.AuditContext,
) {
	status := aiusage.StatusSuccess
	errMessage := ""
	if callErr != nil {
		status = aiusage.StatusFailed
		errMessage = callErr.Error()
	}
	aiusage.Record(aiusage.Entry{
		Feature:       audit.Feature,
		Provider:      provider,
		Model:         modelName,
		UserID:        audit.UserID,
		Status:        status,
		PromptChars:   aiusage.CharCount(prompt),
		ResponseChars: aiusage.CharCount(response),
		LatencyMs:     latencyMs,
		ErrorMessage:  errMessage,
	})
}

// RecordCallFromContext 与 RecordCall 一致，但直接从 ctx 取 audit 上下文。
func RecordCallFromContext(
	ctx context.Context,
	provider string,
	modelName string,
	prompt string,
	response string,
	latencyMs int64,
	callErr error,
) {
	RecordCall(provider, modelName, prompt, response, latencyMs, callErr, aiusage.FromContext(ctx))
}

// RecordExplicit 用于调用方需要自定义 PromptChars / Stream / 多段 prompt 累计等场景。
func RecordExplicit(entry aiusage.Entry) {
	aiusage.Record(entry)
}
