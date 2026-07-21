package handler

import (
	"context"
	"errors"
	"io"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"
	"valley-server/internal/aiclient"
	"valley-server/internal/aimodel"
	"valley-server/internal/aiusage"
	"valley-server/internal/database"

	"github.com/gin-gonic/gin"
	"github.com/volcengine/volcengine-go-sdk/service/arkruntime"
	arkmodel "github.com/volcengine/volcengine-go-sdk/service/arkruntime/model"
)

type aiChatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type aiChatRequest struct {
	Message string          `json:"message" binding:"required"`
	History []aiChatMessage `json:"history"`
	ModelID string          `json:"modelId" binding:"required"`
	Stream  bool            `json:"stream"`
}

func normalizedAIChatSystemPrompt() string {
	basePrompt := strings.Join([]string{
		"你是 Valley 网站内的产品导航助手，不是泛泛而谈的通用平台客服。",
		"请始终使用简体中文回答，并给出简洁、准确、可执行的建议。",
		"已知 Valley 当前公开浏览主链路包括：首页、内容页、资源页、创作者页；首页首屏常见入口包括“立即浏览内容”“查看资源精选”“查看创作者/创作者口令”“进入创作空间”。",
		"当用户问“首页最近有什么值得先点开”“先看什么”“帮我规划入口”这类问题时，优先基于这些已知入口给出 2-4 个具体点击建议，并说明各自适合什么场景。",
		"如果你缺少实时数据，不要说自己无法访问平台或给出空泛的平台通用建议；应改为明确说明“我先按当前首页结构给你建议”，然后继续回答。",
		"不要编造并未提供的实时标题、热度或数量；但可以根据当前已知页面结构、内容类型和用户目标来组织路线。",
	}, " ")

	systemPrompt := strings.TrimSpace(os.Getenv("AI_CHAT_SYSTEM_PROMPT"))
	if systemPrompt == "" {
		return basePrompt
	}
	if !strings.Contains(systemPrompt, "中文") {
		systemPrompt += " 请始终使用简体中文回答。"
	}
	return basePrompt + " " + systemPrompt
}

func buildARKChatMessages(req aiChatRequest) []*arkmodel.ChatCompletionMessage {
	messages := make([]*arkmodel.ChatCompletionMessage, 0, len(req.History)+2)
	appendMessage := func(role, content string) {
		text := strings.TrimSpace(content)
		if text == "" {
			return
		}
		textCopy := text
		messages = append(messages, &arkmodel.ChatCompletionMessage{
			Role:    role,
			Content: &arkmodel.ChatCompletionMessageContent{StringValue: &textCopy},
		})
	}

	appendMessage(arkmodel.ChatMessageRoleSystem, normalizedAIChatSystemPrompt())

	for _, item := range req.History {
		role := strings.TrimSpace(item.Role)
		if role != arkmodel.ChatMessageRoleUser && role != arkmodel.ChatMessageRoleAssistant {
			continue
		}
		appendMessage(role, item.Content)
	}

	appendMessage(arkmodel.ChatMessageRoleUser, req.Message)
	return messages
}

// arkChatRequest 是 handler 内部 shim，转调 aiclient.NewARKChatRequest，
// 保留同名函数让 ai_agent.go 等旧调用点不变。
func arkChatRequest(modelID string, messages []*arkmodel.ChatCompletionMessage) arkmodel.CreateChatCompletionRequest {
	return aiclient.NewARKChatRequest(modelID, messages)
}

// ChatWithAI uses the database-backed valley-chat policy. The selected model is
// an approved SiliconFlow/Amux model, optionally overridden by the signed-in
// user's text preference; it never takes a model ID from the browser.
func ChatWithAI(c *gin.Context) {
	start := time.Now()
	var req aiChatRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		Error(c, 400, "invalid request body")
		return
	}

	req.Message = strings.TrimSpace(req.Message)
	if req.Message == "" {
		Error(c, 400, "message cannot be empty")
		return
	}

	selected, err := aimodel.FindEnabledModel(database.GetDB(), req.ModelID, "text")
	if err != nil {
		recordValleyAIChatUsageWithProvider(c, req, "", "", "", aiclient.CompatibleUsage{}, aiusage.Since(start), err.Error())
		Error(c, http.StatusBadRequest, "请选择一个可用的文本模型")
		return
	}
	providerConfig, err := aimodel.ProviderFromEnv(selected.Provider)
	if err != nil {
		recordValleyAIChatUsageWithProvider(c, req, "", selected.Provider, selected.ModelID, aiclient.CompatibleUsage{}, aiusage.Since(start), err.Error())
		Error(c, 503, err.Error())
		return
	}
	client := aiclient.NewCompatibleClient(providerConfig.BaseURL, providerConfig.APIKey, 90*time.Second)
	messages := buildCompatibleChatMessages(req)

	if req.Stream {
		streamChatWithCompatibleProvider(c, client, selected.Provider, selected.ModelID, messages, req, start)
		return
	}

	response, err := client.Chat(c.Request.Context(), aiclient.CompatibleChatRequest{Model: selected.ModelID, Messages: messages})
	if err != nil {
		recordValleyAIChatUsageWithProvider(c, req, "", selected.Provider, selected.ModelID, response.Usage, aiusage.Since(start), err.Error())
		Error(c, 502, "AI upstream error: "+err.Error())
		return
	}
	reply := compatibleMessageText(response.Choices[0].Message.Content)
	if strings.TrimSpace(reply) == "" {
		recordValleyAIChatUsageWithProvider(c, req, "", selected.Provider, selected.ModelID, response.Usage, aiusage.Since(start), "AI upstream returned empty content")
		Error(c, 502, "AI upstream returned empty content")
		return
	}
	modelName := modelNameOrFallback(response.Model, selected.ModelID)
	recordValleyAIChatUsageWithProvider(c, req, reply, selected.Provider, modelName, response.Usage, aiusage.Since(start), "")

	Success(c, gin.H{
		"reply":    strings.TrimSpace(reply),
		"model":    modelName,
		"provider": selected.Provider,
	})
}

func buildCompatibleChatMessages(req aiChatRequest) []aiclient.CompatibleMessage {
	messages := []aiclient.CompatibleMessage{{Role: "system", Content: normalizedAIChatSystemPrompt()}}
	for _, item := range req.History {
		role, content := strings.TrimSpace(item.Role), strings.TrimSpace(item.Content)
		if content == "" || (role != "user" && role != "assistant") {
			continue
		}
		messages = append(messages, aiclient.CompatibleMessage{Role: role, Content: content})
	}
	return append(messages, aiclient.CompatibleMessage{Role: "user", Content: req.Message})
}

func compatibleMessageText(content any) string {
	if value, ok := content.(string); ok {
		return strings.TrimSpace(value)
	}
	parts, ok := content.([]any)
	if !ok {
		return ""
	}
	var text strings.Builder
	for _, part := range parts {
		if object, ok := part.(map[string]any); ok {
			if value, ok := object["text"].(string); ok {
				text.WriteString(value)
			}
		}
	}
	return strings.TrimSpace(text.String())
}

func modelNameOrFallback(modelName string, fallback string) string {
	if strings.TrimSpace(modelName) != "" {
		return strings.TrimSpace(modelName)
	}
	return strings.TrimSpace(fallback)
}

func recordValleyAIChatUsage(c *gin.Context, req aiChatRequest, reply string, modelName string, latencyMs int64, errMessage string) {
	recordValleyAIChatUsageWithProvider(c, req, reply, "ark", modelName, aiclient.CompatibleUsage{}, latencyMs, errMessage)
}

func recordValleyAIChatUsageWithProvider(c *gin.Context, req aiChatRequest, reply, provider, modelName string, usage aiclient.CompatibleUsage, latencyMs int64, errMessage string) {
	userID := ""
	if value := GetCurrentUserID(c); value > 0 {
		userID = strconv.FormatInt(value, 10)
	}
	status := aiusage.StatusSuccess
	if strings.TrimSpace(errMessage) != "" {
		status = aiusage.StatusFailed
	}
	promptChars := aiusage.CharCount(req.Message)
	for _, item := range req.History {
		promptChars += aiusage.CharCount(item.Content)
	}
	aiusage.Record(aiusage.Entry{
		Feature:          aiclient.FeatureValleyAIChat,
		Provider:         provider,
		Model:            modelName,
		UserID:           userID,
		Status:           status,
		Stream:           req.Stream,
		PromptChars:      promptChars,
		ResponseChars:    aiusage.CharCount(reply),
		PromptTokens:     usage.PromptTokens,
		CompletionTokens: usage.CompletionTokens,
		TotalTokens:      usage.TotalTokens,
		LatencyMs:        latencyMs,
		ErrorMessage:     errMessage,
	})
}

func streamChatWithCompatibleProvider(c *gin.Context, client *aiclient.CompatibleClient, provider, modelID string, messages []aiclient.CompatibleMessage, req aiChatRequest, start time.Time) {
	writer, err := aiclient.NewSSEWriter(c)
	if err != nil {
		Error(c, http.StatusInternalServerError, "streaming not supported")
		return
	}
	_ = writer.Send(gin.H{"provider": provider, "model": modelID, "chunk": "", "done": false})
	var chunks strings.Builder
	currentModel := modelID
	var usage aiclient.CompatibleUsage
	err = client.ChatStream(c.Request.Context(), aiclient.CompatibleChatRequest{Model: modelID, Messages: messages}, func(chunk aiclient.CompatibleChatStreamChunk) error {
		if strings.TrimSpace(chunk.Model) != "" {
			currentModel = chunk.Model
		}
		if chunk.Usage.TotalTokens > 0 || chunk.Usage.PromptTokens > 0 || chunk.Usage.CompletionTokens > 0 {
			usage = chunk.Usage
		}
		for _, choice := range chunk.Choices {
			text := compatibleMessageText(choice.Delta.Content)
			if text == "" {
				continue
			}
			chunks.WriteString(text)
			if err := writer.Send(gin.H{"provider": provider, "model": currentModel, "chunk": text, "done": false}); err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		recordValleyAIChatUsageWithProvider(c, req, chunks.String(), provider, currentModel, usage, aiusage.Since(start), err.Error())
		_ = writer.Send(gin.H{"error": "AI upstream error: " + err.Error(), "done": true})
		return
	}
	recordValleyAIChatUsageWithProvider(c, req, chunks.String(), provider, currentModel, usage, aiusage.Since(start), "")
	_ = writer.Send(gin.H{"provider": provider, "model": currentModel, "done": true})
}

func chatWithARK(
	ctx context.Context,
	client *arkruntime.Client,
	modelID string,
	messages []*arkmodel.ChatCompletionMessage,
) (string, string, error) {
	req := aiclient.NewARKChatRequest(modelID, messages)
	resp, err := client.CreateChatCompletion(ctx, req)
	if err != nil {
		return "", "", err
	}
	if len(resp.Choices) == 0 {
		return "", resp.Model, errors.New("empty AI response")
	}
	reply := aiclient.ExtractARKMessageText(&resp.Choices[0].Message)
	return reply, resp.Model, nil
}

func streamChatWithARK(
	c *gin.Context,
	client *arkruntime.Client,
	modelID string,
	messages []*arkmodel.ChatCompletionMessage,
	req aiChatRequest,
	start time.Time,
) {
	stream, err := client.CreateChatCompletionStream(c.Request.Context(), aiclient.NewARKChatRequest(modelID, messages))
	if err != nil {
		recordValleyAIChatUsage(c, req, "", modelID, aiusage.Since(start), err.Error())
		Error(c, 502, "AI upstream error: "+err.Error())
		return
	}
	defer stream.Close()

	writer, err := aiclient.NewSSEWriter(c)
	if err != nil {
		Error(c, 500, "streaming not supported")
		return
	}

	send := func(payload gin.H) {
		_ = writer.Send(payload)
	}

	send(gin.H{"model": modelID, "chunk": "", "done": false})
	chunks := strings.Builder{}
	currentModel := modelID

	for {
		resp, err := stream.Recv()
		if errors.Is(err, io.EOF) {
			recordValleyAIChatUsage(c, req, chunks.String(), currentModel, aiusage.Since(start), "")
			send(gin.H{"model": modelID, "done": true})
			return
		}
		if err != nil {
			recordValleyAIChatUsage(c, req, chunks.String(), currentModel, aiusage.Since(start), err.Error())
			send(gin.H{"error": "AI upstream error: " + err.Error(), "done": true})
			return
		}

		if strings.TrimSpace(resp.Model) != "" {
			currentModel = resp.Model
		}

		done := false
		for _, choice := range resp.Choices {
			if choice == nil {
				continue
			}
			if strings.TrimSpace(choice.Delta.Content) != "" {
				chunks.WriteString(choice.Delta.Content)
				send(gin.H{
					"model": currentModel,
					"chunk": choice.Delta.Content,
					"done":  false,
				})
			}
			if choice.FinishReason != arkmodel.FinishReasonNull && choice.FinishReason != "" {
				done = true
			}
		}

		if done {
			send(gin.H{"model": currentModel, "done": true})
			return
		}
	}
}
