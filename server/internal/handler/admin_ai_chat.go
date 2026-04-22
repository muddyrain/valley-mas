package handler

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/volcengine/volcengine-go-sdk/service/arkruntime"
	"github.com/volcengine/volcengine-go-sdk/service/arkruntime/model"
)

type aiChatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type aiChatRequest struct {
	Message string          `json:"message" binding:"required"`
	History []aiChatMessage `json:"history"`
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

func buildARKChatMessages(req aiChatRequest) []*model.ChatCompletionMessage {
	messages := make([]*model.ChatCompletionMessage, 0, len(req.History)+2)
	appendMessage := func(role, content string) {
		text := strings.TrimSpace(content)
		if text == "" {
			return
		}
		textCopy := text
		messages = append(messages, &model.ChatCompletionMessage{
			Role:    role,
			Content: &model.ChatCompletionMessageContent{StringValue: &textCopy},
		})
	}

	appendMessage(model.ChatMessageRoleSystem, normalizedAIChatSystemPrompt())

	for _, item := range req.History {
		role := strings.TrimSpace(item.Role)
		if role != model.ChatMessageRoleUser && role != model.ChatMessageRoleAssistant {
			continue
		}
		appendMessage(role, item.Content)
	}

	appendMessage(model.ChatMessageRoleUser, req.Message)
	return messages
}

func extractARKMessageText(message *model.ChatCompletionMessage) string {
	if message == nil || message.Content == nil {
		return ""
	}
	if message.Content.StringValue != nil {
		return strings.TrimSpace(*message.Content.StringValue)
	}
	if len(message.Content.ListValue) == 0 {
		return ""
	}

	parts := make([]string, 0, len(message.Content.ListValue))
	for _, item := range message.Content.ListValue {
		if item == nil || strings.TrimSpace(item.Text) == "" {
			continue
		}
		parts = append(parts, strings.TrimSpace(item.Text))
	}
	return strings.TrimSpace(strings.Join(parts, "\n"))
}

func arkChatRequest(modelID string, messages []*model.ChatCompletionMessage) model.CreateChatCompletionRequest {
	maxTokens := 900
	temperature := float32(0.7)
	return model.CreateChatCompletionRequest{
		Model:       modelID,
		Messages:    messages,
		MaxTokens:   &maxTokens,
		Temperature: &temperature,
	}
}

// ChatWithAI AI 对话（使用 ARK_TEXT_MODEL）
func ChatWithAI(c *gin.Context) {
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

	apiKey, arkBaseURL, textModel, errMsg := readArkTextModelConfig()
	if errMsg != "" {
		Error(c, 503, errMsg)
		return
	}

	client := ensureSharedArkClient(apiKey, arkBaseURL)
	messages := buildARKChatMessages(req)

	if req.Stream {
		streamChatWithARK(c, client, textModel, messages)
		return
	}

	reply, modelName, err := chatWithARK(c.Request.Context(), client, textModel, messages)
	if err != nil {
		Error(c, 502, "AI upstream error: "+err.Error())
		return
	}
	if strings.TrimSpace(reply) == "" {
		Error(c, 502, "AI upstream returned empty content")
		return
	}

	Success(c, gin.H{
		"reply":    strings.TrimSpace(reply),
		"model":    modelName,
		"provider": "ark",
	})
}

func chatWithARK(
	ctx context.Context,
	client *arkruntime.Client,
	modelID string,
	messages []*model.ChatCompletionMessage,
) (string, string, error) {
	req := arkChatRequest(modelID, messages)
	resp, err := client.CreateChatCompletion(ctx, req)
	if err != nil {
		return "", "", err
	}
	if len(resp.Choices) == 0 {
		return "", resp.Model, errors.New("empty AI response")
	}

	reply := extractARKMessageText(&resp.Choices[0].Message)
	return reply, resp.Model, nil
}

func streamChatWithARK(
	c *gin.Context,
	client *arkruntime.Client,
	modelID string,
	messages []*model.ChatCompletionMessage,
) {
	stream, err := client.CreateChatCompletionStream(c.Request.Context(), arkChatRequest(modelID, messages))
	if err != nil {
		Error(c, 502, "AI upstream error: "+err.Error())
		return
	}
	defer stream.Close()

	c.Writer.Header().Set("Content-Type", "text/event-stream")
	c.Writer.Header().Set("Cache-Control", "no-cache")
	c.Writer.Header().Set("Connection", "keep-alive")
	c.Writer.Header().Set("X-Accel-Buffering", "no")

	flusher, ok := c.Writer.(http.Flusher)
	if !ok {
		Error(c, 500, "streaming not supported")
		return
	}

	send := func(payload gin.H) {
		b, _ := json.Marshal(payload)
		_, _ = c.Writer.Write([]byte("data: "))
		_, _ = c.Writer.Write(b)
		_, _ = c.Writer.Write([]byte("\n\n"))
		flusher.Flush()
	}

	send(gin.H{"model": modelID, "chunk": "", "done": false})

	for {
		resp, err := stream.Recv()
		if errors.Is(err, io.EOF) {
			send(gin.H{"model": modelID, "done": true})
			return
		}
		if err != nil {
			send(gin.H{"error": "AI upstream error: " + err.Error(), "done": true})
			return
		}

		currentModel := resp.Model
		if strings.TrimSpace(currentModel) == "" {
			currentModel = modelID
		}

		done := false
		for _, choice := range resp.Choices {
			if choice == nil {
				continue
			}
			if strings.TrimSpace(choice.Delta.Content) != "" {
				send(gin.H{
					"model": currentModel,
					"chunk": choice.Delta.Content,
					"done":  false,
				})
			}
			if choice.FinishReason != model.FinishReasonNull && choice.FinishReason != "" {
				done = true
			}
		}

		if done {
			send(gin.H{"model": currentModel, "done": true})
			return
		}
	}
}
