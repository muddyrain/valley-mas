package handler

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"
	"time"

	"valley-server/internal/ai/agent"
	"valley-server/internal/ai/tools"
	"valley-server/internal/ai/tools/content"
	"valley-server/internal/aiclient"
	"valley-server/internal/database"
	"valley-server/internal/model"

	"github.com/gin-gonic/gin"
	"github.com/volcengine/volcengine-go-sdk/service/arkruntime"
	arkmodel "github.com/volcengine/volcengine-go-sdk/service/arkruntime/model"
)

type publicAIAppChatPayload struct {
	Message string `json:"message"`
	Stream  bool   `json:"stream"`
}

// PublicAIAppChat invokes a published agent application through an explicitly
// bound API key. It never writes external request or response content to disk.
func PublicAIAppChat(c *gin.Context) {
	started := time.Now()
	key, ok := publicAIAPIKeyFromRequest(c)
	if !ok {
		writePublicAIAppError(c, http.StatusUnauthorized, "API_KEY_INVALID", "API Key 无效")
		return
	}
	appID, err := parsePathInt64(c, "appId")
	if err != nil {
		writePublicAIAppError(c, http.StatusBadRequest, "APP_ID_INVALID", "应用 ID 无效")
		return
	}
	var app model.AIApp
	if err := database.GetDB().Where("id = ? AND user_id = ?", appID, key.UserID).First(&app).Error; err != nil {
		writePublicAIAppError(c, http.StatusNotFound, "APP_NOT_FOUND", "应用不存在")
		return
	}

	var bindingCount int64
	if err := database.GetDB().Model(&model.AIAPIKeyAppBinding{}).Where("api_key_id = ? AND app_id = ?", key.ID, app.ID).Count(&bindingCount).Error; err != nil {
		writePublicAIAppError(c, http.StatusInternalServerError, "BINDING_LOOKUP_FAILED", "API Key 权限校验失败")
		return
	}
	if bindingCount == 0 {
		persistAIAppPublicInvocation(app, 0, *key, "rejected", false, "API_KEY_APP_NOT_BOUND", 0, started)
		writePublicAIAppError(c, http.StatusForbidden, "API_KEY_APP_NOT_BOUND", "API Key 未授权调用此应用")
		return
	}

	var payload publicAIAppChatPayload
	if c.ShouldBindJSON(&payload) != nil || strings.TrimSpace(payload.Message) == "" {
		persistAIAppPublicInvocation(app, 0, *key, "rejected", false, "MESSAGE_REQUIRED", 0, started)
		writePublicAIAppError(c, http.StatusBadRequest, "MESSAGE_REQUIRED", "message 不能为空")
		return
	}
	remaining, err := consumeAIAPIKeyDailyUsage(database.GetDB(), key.ID, time.Now().Format("2006-01-02"))
	if err == ErrAIAPIKeyDailyQuotaExceeded {
		persistAIAppPublicInvocation(app, 0, *key, "rejected", payload.Stream, "DAILY_QUOTA_EXCEEDED", aiAPIKeyDailyCallLimit, started)
		writePublicAIAppError(c, http.StatusTooManyRequests, "DAILY_QUOTA_EXCEEDED", "API Key 今日调用次数已达上限")
		return
	}
	if err != nil {
		writePublicAIAppError(c, http.StatusInternalServerError, "QUOTA_UPDATE_FAILED", "调用配额更新失败")
		return
	}
	dailyCallNumber := aiAPIKeyDailyCallLimit - remaining

	if app.Type != aiAppTypeAgent || app.PublishedVersionID == 0 {
		persistAIAppPublicInvocation(app, 0, *key, "rejected", payload.Stream, "APP_NOT_PUBLISHED", dailyCallNumber, started)
		writePublicAIAppError(c, http.StatusBadRequest, "APP_NOT_PUBLISHED", "应用尚未发布可调用的智能体版本")
		return
	}
	var version model.AIAppVersion
	if err := database.GetDB().Where("id = ? AND app_id = ?", app.PublishedVersionID, app.ID).First(&version).Error; err != nil {
		persistAIAppPublicInvocation(app, 0, *key, "failed", payload.Stream, "PUBLISHED_VERSION_NOT_FOUND", dailyCallNumber, started)
		writePublicAIAppError(c, http.StatusBadGateway, "PUBLISHED_VERSION_NOT_FOUND", "已发布版本不可用")
		return
	}
	var config struct {
		SystemPrompt string `json:"systemPrompt"`
	}
	if json.Unmarshal([]byte(version.Config), &config) != nil {
		persistAIAppPublicInvocation(app, version.ID, *key, "failed", payload.Stream, "APP_CONFIG_INVALID", dailyCallNumber, started)
		writePublicAIAppError(c, http.StatusBadGateway, "APP_CONFIG_INVALID", "应用配置无效")
		return
	}
	arkConfig, configErr := aiclient.ReadARKTextConfig()
	if configErr != "" {
		persistAIAppPublicInvocation(app, version.ID, *key, "failed", payload.Stream, "ARK_NOT_CONFIGURED", dailyCallNumber, started)
		writePublicAIAppError(c, http.StatusBadGateway, "ARK_NOT_CONFIGURED", "AI 服务暂不可用")
		return
	}

	message := truncateAIAgentRunes(payload.Message, 12000)
	knowledgeContext, _, retrievalErr := retrieveAIKnowledgeContext(c.Request.Context(), key.UserID, version, message)
	if retrievalErr != nil {
		persistAIAppPublicInvocation(app, version.ID, *key, "failed", payload.Stream, "KNOWLEDGE_RETRIEVAL_FAILED", dailyCallNumber, started)
		writePublicAIAppError(c, http.StatusBadGateway, "KNOWLEDGE_RETRIEVAL_FAILED", "知识库检索暂不可用")
		return
	}
	system := strings.TrimSpace(config.SystemPrompt)
	if knowledgeContext != "" {
		system = strings.TrimSpace(system + "\n\n以下是与当前问题相关的私有参考资料。请优先依据这些资料回答；资料不足时明确说明。\n" + knowledgeContext)
	}
	registry, toolNames, toolErr := resolveAIAppTools(database.GetDB(), app.ID)
	if toolErr != nil {
		persistAIAppPublicInvocation(app, version.ID, *key, "failed", payload.Stream, "AI_TOOL_REGISTRY_UNAVAILABLE", dailyCallNumber, started)
		writePublicAIAppError(c, http.StatusInternalServerError, "AI_TOOL_REGISTRY_UNAVAILABLE", "应用工具不可用")
		return
	}
	if len(toolNames) > 0 {
		publicAIAppChatWithTools(c, payload.Stream, arkConfig.Model, system, message, app, version, *key, registry, toolNames, dailyCallNumber, started)
		return
	}
	publicAIAppChatWithoutTools(c, payload.Stream, arkConfig.Model, system, message, app, version, *key, dailyCallNumber, started)
}

func publicAIAPIKeyFromRequest(c *gin.Context) (*model.AIAPIKey, bool) {
	authorization := strings.TrimSpace(c.GetHeader("Authorization"))
	if !strings.HasPrefix(authorization, "Bearer ") {
		return nil, false
	}
	return VerifyAIAPIKey(strings.TrimSpace(strings.TrimPrefix(authorization, "Bearer ")))
}

func publicAIAppChatWithoutTools(c *gin.Context, stream bool, modelID, system, message string, app model.AIApp, version model.AIAppVersion, key model.AIAPIKey, dailyCallNumber int, started time.Time) {
	client := aiclient.ARKClient(60 * time.Second)
	if client == nil {
		persistAIAppPublicInvocation(app, version.ID, key, "failed", stream, "ARK_NOT_CONFIGURED", dailyCallNumber, started)
		writePublicAIAppError(c, http.StatusBadGateway, "ARK_NOT_CONFIGURED", "AI 服务暂不可用")
		return
	}
	messages := make([]*arkmodel.ChatCompletionMessage, 0, 2)
	if system != "" {
		messages = append(messages, &arkmodel.ChatCompletionMessage{Role: arkmodel.ChatMessageRoleSystem, Content: &arkmodel.ChatCompletionMessageContent{StringValue: &system}})
	}
	messages = append(messages, &arkmodel.ChatCompletionMessage{Role: arkmodel.ChatMessageRoleUser, Content: &arkmodel.ChatCompletionMessageContent{StringValue: &message}})
	if stream {
		streamPublicAIAppResponse(c, client, modelID, messages, app, version, key, dailyCallNumber, started)
		return
	}
	response, err := client.CreateChatCompletion(c.Request.Context(), aiclient.NewARKChatRequest(modelID, messages))
	if err != nil {
		persistAIAppPublicInvocation(app, version.ID, key, "failed", false, "ARK_UPSTREAM_FAILED", dailyCallNumber, started)
		writePublicAIAppError(c, http.StatusBadGateway, "ARK_UPSTREAM_FAILED", "AI 上游调用失败")
		return
	}
	reply, err := aiclient.ExtractARKContent(response)
	if err != nil || strings.TrimSpace(reply) == "" {
		persistAIAppPublicInvocation(app, version.ID, key, "failed", false, "ARK_EMPTY_RESPONSE", dailyCallNumber, started)
		writePublicAIAppError(c, http.StatusBadGateway, "ARK_EMPTY_RESPONSE", "AI 未返回有效内容")
		return
	}
	responseModel := strings.TrimSpace(response.Model)
	if responseModel == "" {
		responseModel = modelID
	}
	persistAIAppPublicInvocation(app, version.ID, key, "succeeded", false, "", dailyCallNumber, started)
	c.JSON(http.StatusOK, gin.H{"reply": reply, "model": responseModel, "versionId": version.ID})
}

func publicAIAppChatWithTools(c *gin.Context, stream bool, modelID, system, message string, app model.AIApp, version model.AIAppVersion, key model.AIAPIKey, registry *tools.Registry, toolNames []string, dailyCallNumber int, started time.Time) {
	client := aiclient.ARKClient(60 * time.Second)
	if client == nil {
		persistAIAppPublicInvocation(app, version.ID, key, "failed", stream, "ARK_NOT_CONFIGURED", dailyCallNumber, started)
		writePublicAIAppError(c, http.StatusBadGateway, "ARK_NOT_CONFIGURED", "AI 服务暂不可用")
		return
	}
	loop := agent.NewLocalLoop(&aiAppAgentBackend{client: client}, registry)
	spec := agent.Spec{Provider: "ark", Model: modelID, System: system, Tools: toolNames, MaxSteps: 6, MaxTokens: 1200, Feature: "ai-workbench-public"}
	ctx := content.WithOwner(c.Request.Context(), key.UserID)
	if !stream {
		result, err := loop.Run(ctx, spec, []agent.Message{{Role: agent.RoleUser, Content: message}})
		if err != nil || strings.TrimSpace(result.Reply) == "" {
			persistAIAppPublicInvocation(app, version.ID, key, "failed", false, "AI_AGENT_RUN_FAILED", dailyCallNumber, started)
			writePublicAIAppError(c, http.StatusBadGateway, "AI_AGENT_RUN_FAILED", "智能体调用失败")
			return
		}
		if result.Model == "" {
			result.Model = modelID
		}
		persistAIAppPublicInvocation(app, version.ID, key, "succeeded", false, "", dailyCallNumber, started)
		c.JSON(http.StatusOK, gin.H{"reply": result.Reply, "model": result.Model, "versionId": version.ID})
		return
	}
	events, err := loop.RunStream(ctx, spec, []agent.Message{{Role: agent.RoleUser, Content: message}})
	if err != nil {
		persistAIAppPublicInvocation(app, version.ID, key, "failed", true, "AI_AGENT_RUN_FAILED", dailyCallNumber, started)
		writePublicAIAppError(c, http.StatusBadGateway, "AI_AGENT_RUN_FAILED", "智能体调用失败")
		return
	}
	writer, err := aiclient.NewSSEWriter(c)
	if err != nil {
		persistAIAppPublicInvocation(app, version.ID, key, "failed", true, "SSE_NOT_SUPPORTED", dailyCallNumber, started)
		return
	}
	var result *agent.Result
	var loopErr error
	for event := range events {
		switch event.Type {
		case agent.EventDelta:
			_ = writer.Send(gin.H{"type": "delta", "chunk": event.Delta})
		case agent.EventDone:
			result = event.Result
		case agent.EventError:
			loopErr = event.Err
		}
	}
	if loopErr != nil || result == nil || strings.TrimSpace(result.Reply) == "" {
		persistAIAppPublicInvocation(app, version.ID, key, "failed", true, "AI_AGENT_RUN_FAILED", dailyCallNumber, started)
		_ = writer.Send(gin.H{"type": "error", "code": "AI_AGENT_RUN_FAILED", "message": "智能体调用失败"})
		return
	}
	if result.Model == "" {
		result.Model = modelID
	}
	persistAIAppPublicInvocation(app, version.ID, key, "succeeded", true, "", dailyCallNumber, started)
	_ = writer.Send(gin.H{"type": "done", "model": result.Model, "versionId": version.ID})
}

func streamPublicAIAppResponse(c *gin.Context, client *arkruntime.Client, modelID string, messages []*arkmodel.ChatCompletionMessage, app model.AIApp, version model.AIAppVersion, key model.AIAPIKey, dailyCallNumber int, started time.Time) {
	stream, err := client.CreateChatCompletionStream(c.Request.Context(), aiclient.NewARKChatRequest(modelID, messages))
	if err != nil {
		persistAIAppPublicInvocation(app, version.ID, key, "failed", true, "ARK_UPSTREAM_FAILED", dailyCallNumber, started)
		writePublicAIAppError(c, http.StatusBadGateway, "ARK_UPSTREAM_FAILED", "AI 上游调用失败")
		return
	}
	defer stream.Close()
	writer, err := aiclient.NewSSEWriter(c)
	if err != nil {
		persistAIAppPublicInvocation(app, version.ID, key, "failed", true, "SSE_NOT_SUPPORTED", dailyCallNumber, started)
		return
	}
	var reply strings.Builder
	currentModel := modelID
	for {
		response, recvErr := stream.Recv()
		if errors.Is(recvErr, io.EOF) {
			break
		}
		if recvErr != nil {
			if c.Request.Context().Err() != nil {
				persistAIAppPublicInvocation(app, version.ID, key, "cancelled", true, "RUN_CANCELLED", dailyCallNumber, started)
				return
			}
			persistAIAppPublicInvocation(app, version.ID, key, "failed", true, "ARK_UPSTREAM_FAILED", dailyCallNumber, started)
			_ = writer.Send(gin.H{"type": "error", "code": "ARK_UPSTREAM_FAILED", "message": "AI 上游调用失败"})
			return
		}
		if strings.TrimSpace(response.Model) != "" {
			currentModel = response.Model
		}
		for _, choice := range response.Choices {
			if choice == nil || strings.TrimSpace(choice.Delta.Content) == "" {
				continue
			}
			reply.WriteString(choice.Delta.Content)
			_ = writer.Send(gin.H{"type": "delta", "chunk": choice.Delta.Content})
		}
	}
	if strings.TrimSpace(reply.String()) == "" {
		persistAIAppPublicInvocation(app, version.ID, key, "failed", true, "ARK_EMPTY_RESPONSE", dailyCallNumber, started)
		_ = writer.Send(gin.H{"type": "error", "code": "ARK_EMPTY_RESPONSE", "message": "AI 未返回有效内容"})
		return
	}
	persistAIAppPublicInvocation(app, version.ID, key, "succeeded", true, "", dailyCallNumber, started)
	_ = writer.Send(gin.H{"type": "done", "model": currentModel, "versionId": version.ID})
}

func persistAIAppPublicInvocation(app model.AIApp, versionID model.Int64String, key model.AIAPIKey, status string, stream bool, errorCode string, dailyCallNumber int, started time.Time) {
	invocation := model.AIAppPublicInvocation{
		UserID:          app.UserID,
		AppID:           app.ID,
		VersionID:       versionID,
		APIKeyID:        key.ID,
		Status:          status,
		DurationMs:      time.Since(started).Milliseconds(),
		Stream:          stream,
		ErrorCode:       errorCode,
		DailyCallNumber: dailyCallNumber,
	}
	_ = database.GetDB().Create(&invocation).Error
}

func writePublicAIAppError(c *gin.Context, status int, code, message string) {
	c.JSON(status, gin.H{"error": gin.H{"code": code, "message": message}})
}
