package handler

import (
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"valley-server/internal/ai/agent"
	"valley-server/internal/ai/tools/content"
	"valley-server/internal/aiclient"
	"valley-server/internal/database"
	"valley-server/internal/model"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

const aiAppConversationHistoryLimit = 24

func findAIAppConversation(db *gorm.DB, userID, appID, conversationID model.Int64String) (model.AIAppConversation, bool) {
	var conversation model.AIAppConversation
	if db.Where("id = ? AND user_id = ? AND app_id = ? AND status = ?", conversationID, userID, appID, "active").First(&conversation).Error != nil {
		return conversation, false
	}
	return conversation, true
}

func aiAppConversationContext(c *gin.Context) (model.Int64String, model.AIApp, bool) {
	userID, ok := currentAIAppUser(c)
	if !ok {
		return 0, model.AIApp{}, false
	}
	app, found := findAIApp(c, userID)
	if !found {
		return 0, model.AIApp{}, false
	}
	if app.Type != aiAppTypeAgent {
		Error(c, http.StatusBadRequest, "当前仅支持智能体私有会话")
		return 0, model.AIApp{}, false
	}
	return userID, app, true
}

func ListAIAppConversations(c *gin.Context) {
	userID, app, ok := aiAppConversationContext(c)
	if !ok {
		return
	}
	var conversations []model.AIAppConversation
	if err := database.GetDB().Where("user_id = ? AND app_id = ? AND status = ?", userID, app.ID, "active").Order("updated_at DESC").Find(&conversations).Error; err != nil {
		Error(c, 500, "加载私有会话失败")
		return
	}
	Success(c, gin.H{"list": conversations})
}

func CreateAIAppConversation(c *gin.Context) {
	userID, app, ok := aiAppConversationContext(c)
	if !ok {
		return
	}
	var payload struct {
		Title string `json:"title"`
	}
	_ = c.ShouldBindJSON(&payload)
	if app.DraftVersionID == 0 {
		Error(c, http.StatusBadRequest, "草稿版本不存在")
		return
	}
	var version model.AIAppVersion
	if database.GetDB().Where("id = ? AND app_id = ?", app.DraftVersionID, app.ID).First(&version).Error != nil {
		Error(c, http.StatusBadRequest, "草稿版本不存在")
		return
	}
	conversation := model.AIAppConversation{UserID: userID, AppID: app.ID, VersionID: version.ID, Title: truncateAIAgentRunes(payload.Title, 120)}
	if database.GetDB().Create(&conversation).Error != nil {
		Error(c, 500, "创建私有会话失败")
		return
	}
	Success(c, gin.H{"conversation": conversation})
}

func GetAIAppConversation(c *gin.Context) {
	userID, app, ok := aiAppConversationContext(c)
	if !ok {
		return
	}
	conversationID, err := parsePathInt64(c, "conversationId")
	if err != nil {
		Error(c, 400, "无效的会话 ID")
		return
	}
	conversation, found := findAIAppConversation(database.GetDB(), userID, app.ID, model.Int64String(conversationID))
	if !found {
		Error(c, 404, "私有会话不存在")
		return
	}
	var messages []model.AIAppConversationMessage
	var traces []model.AIAppConversationToolTrace
	if err := database.GetDB().Where("user_id = ? AND app_id = ? AND conversation_id = ?", userID, app.ID, conversation.ID).Order("created_at ASC").Find(&messages).Error; err != nil {
		Error(c, 500, "加载会话消息失败")
		return
	}
	if err := database.GetDB().Where("user_id = ? AND app_id = ? AND conversation_id = ?", userID, app.ID, conversation.ID).Order("created_at ASC").Find(&traces).Error; err != nil {
		Error(c, 500, "加载工具轨迹失败")
		return
	}
	Success(c, gin.H{"conversation": conversation, "messages": messages, "toolTraces": traces})
}

func DeleteAIAppConversation(c *gin.Context) {
	userID, app, ok := aiAppConversationContext(c)
	if !ok {
		return
	}
	conversationID, err := parsePathInt64(c, "conversationId")
	if err != nil {
		Error(c, 400, "无效的会话 ID")
		return
	}
	conversation, found := findAIAppConversation(database.GetDB(), userID, app.ID, model.Int64String(conversationID))
	if !found {
		Error(c, 404, "私有会话不存在")
		return
	}
	if err := database.GetDB().Transaction(func(tx *gorm.DB) error {
		query := "user_id = ? AND app_id = ? AND conversation_id = ?"
		if err := tx.Where(query, userID, app.ID, conversation.ID).Delete(&model.AIAppConversationMessage{}).Error; err != nil {
			return err
		}
		if err := tx.Where(query, userID, app.ID, conversation.ID).Delete(&model.AIAppConversationToolTrace{}).Error; err != nil {
			return err
		}
		if err := tx.Where("user_id = ? AND app_id = ? AND conversation_id = ?", userID, app.ID, conversation.ID).Delete(&model.AIAppRun{}).Error; err != nil {
			return err
		}
		return tx.Delete(&conversation).Error
	}); err != nil {
		Error(c, 500, "删除私有会话失败")
		return
	}
	Success(c, gin.H{"deletedId": conversation.ID})
}

func ChatWithAIAppConversation(c *gin.Context) {
	started := time.Now()
	userID, app, ok := aiAppConversationContext(c)
	if !ok {
		return
	}
	conversationID, err := parsePathInt64(c, "conversationId")
	if err != nil {
		Error(c, 400, "无效的会话 ID")
		return
	}
	conversation, found := findAIAppConversation(database.GetDB(), userID, app.ID, model.Int64String(conversationID))
	if !found {
		Error(c, 404, "私有会话不存在")
		return
	}
	var payload struct {
		Message string `json:"message"`
		Stream  bool   `json:"stream"`
	}
	if c.ShouldBindJSON(&payload) != nil || strings.TrimSpace(payload.Message) == "" {
		Error(c, 400, "消息不能为空")
		return
	}
	message := truncateAIAgentRunes(payload.Message, 12000)
	userMessage := model.AIAppConversationMessage{UserID: userID, AppID: app.ID, ConversationID: conversation.ID, Role: "user", Content: message}
	if database.GetDB().Create(&userMessage).Error != nil {
		Error(c, 500, "保存会话消息失败")
		return
	}
	if conversation.Title == "新对话" {
		conversation.Title = truncateAIAgentRunes(message, 32)
		_ = database.GetDB().Model(&conversation).Updates(map[string]any{"title": conversation.Title, "updated_at": time.Now()}).Error
	}

	var version model.AIAppVersion
	if database.GetDB().Where("id = ? AND app_id = ?", conversation.VersionID, app.ID).First(&version).Error != nil {
		Error(c, http.StatusBadRequest, "会话版本不存在")
		return
	}
	run := model.AIAppRun{AppID: app.ID, VersionID: version.ID, ConversationID: &conversation.ID, UserID: userID, Status: "running", Input: aiclient.TrimRunes(message, 1000)}
	if database.GetDB().Create(&run).Error != nil {
		Error(c, 500, "创建会话运行记录失败")
		return
	}
	fail := func(status int, code, message string) {
		_ = database.GetDB().Model(&run).Updates(map[string]any{"status": "failed", "error_code": code, "duration_ms": time.Since(started).Milliseconds()}).Error
		Error(c, status, message)
	}

	var config struct {
		SystemPrompt string `json:"systemPrompt"`
	}
	if json.Unmarshal([]byte(version.Config), &config) != nil {
		fail(400, "APP_CONFIG_INVALID", "智能体版本配置无效")
		return
	}
	arkConfig, configErr := aiclient.ReadARKTextConfig()
	if configErr != "" {
		fail(http.StatusServiceUnavailable, "ARK_NOT_CONFIGURED", configErr)
		return
	}
	knowledgeContext, references, retrievalErr := retrieveAIKnowledgeContext(c.Request.Context(), userID, version, message)
	if retrievalErr != nil {
		fail(http.StatusServiceUnavailable, "KNOWLEDGE_RETRIEVAL_FAILED", "知识库检索暂不可用")
		return
	}
	system := strings.TrimSpace(config.SystemPrompt)
	if knowledgeContext != "" {
		system = strings.TrimSpace(system + "\n\n以下是与当前问题相关的私有参考资料。请优先依据这些资料回答；资料不足时明确说明。\n" + knowledgeContext)
	}
	registry, toolNames, toolErr := resolveAIAppTools(database.GetDB(), app.ID, version)
	if toolErr != nil {
		fail(500, "AI_TOOL_REGISTRY_UNAVAILABLE", "加载智能体工具失败")
		return
	}
	client := aiclient.ARKClient(60 * time.Second)
	if client == nil {
		fail(http.StatusServiceUnavailable, "ARK_NOT_CONFIGURED", "AI 服务未配置")
		return
	}

	var history []model.AIAppConversationMessage
	if err := database.GetDB().Where("user_id = ? AND app_id = ? AND conversation_id = ?", userID, app.ID, conversation.ID).Order("created_at DESC").Limit(aiAppConversationHistoryLimit).Find(&history).Error; err != nil {
		fail(500, "CONVERSATION_HISTORY_UNAVAILABLE", "加载会话历史失败")
		return
	}
	messages := make([]agent.Message, 0, len(history))
	for index := len(history) - 1; index >= 0; index-- {
		item := history[index]
		role := agent.RoleUser
		if item.Role == "assistant" {
			role = agent.RoleAssistant
		}
		messages = append(messages, agent.Message{Role: role, Content: item.Content})
	}
	loop := agent.NewLocalLoop(&aiAppAgentBackend{client: client}, registry)
	events, loopErr := loop.RunStream(content.WithOwner(c.Request.Context(), userID), agent.Spec{Provider: "ark", Model: arkConfig.Model, System: system, Tools: toolNames, MaxSteps: 6, MaxTokens: 1200, Feature: "ai-workbench-conversation"}, messages)
	if loopErr != nil {
		fail(http.StatusBadGateway, "AI_AGENT_RUN_FAILED", "智能体工具调用失败")
		return
	}

	var writer *aiclient.SSEWriter
	if payload.Stream {
		writer, err = aiclient.NewSSEWriter(c)
		if err != nil {
			return
		}
		_ = writer.Send(gin.H{"type": "meta", "conversation": conversation, "versionId": version.ID, "model": arkConfig.Model})
	}
	var reply strings.Builder
	var result agent.Result
	var runErr error
	for event := range events {
		switch event.Type {
		case agent.EventDelta:
			reply.WriteString(event.Delta)
			if writer != nil {
				_ = writer.Send(gin.H{"type": "delta", "chunk": event.Delta})
			}
		case agent.EventToolCall:
			if writer != nil {
				_ = writer.Send(gin.H{"type": "tool_call", "toolName": event.ToolName})
			}
		case agent.EventToolResult:
			ok := !strings.Contains(string(event.ToolResult), `"ok":false`)
			status := "succeeded"
			if !ok {
				status = "failed"
			}
			trace := model.AIAppConversationToolTrace{UserID: userID, AppID: app.ID, ConversationID: conversation.ID, RunID: run.ID, ToolName: event.ToolName, Status: status, DurationMs: event.ToolDurationMs}
			_ = database.GetDB().Create(&trace).Error
			if writer != nil {
				_ = writer.Send(gin.H{"type": "tool_result", "toolName": event.ToolName, "ok": ok, "durationMs": event.ToolDurationMs})
			}
		case agent.EventDone:
			if event.Result != nil {
				result = *event.Result
			}
		case agent.EventError:
			runErr = event.Err
		}
	}
	if result.Reply == "" {
		result.Reply = reply.String()
	}
	if runErr != nil || strings.TrimSpace(result.Reply) == "" {
		code := "AI_AGENT_RUN_FAILED"
		message := "智能体工具调用失败"
		status := "failed"
		if c.Request.Context().Err() != nil {
			code = "RUN_CANCELLED"
			message = "会话生成已停止"
			status = "cancelled"
		}
		if runErr == nil && c.Request.Context().Err() == nil {
			code = "ARK_EMPTY_RESPONSE"
			message = "AI 未返回有效内容"
		}
		run.Status = status
		run.Model = result.Model
		run.Output = aiclient.TrimRunes(result.Reply, 2000)
		run.ErrorCode = code
		run.DurationMs = time.Since(started).Milliseconds()
		_ = database.GetDB().Model(&run).Updates(map[string]any{"status": run.Status, "model": run.Model, "output": run.Output, "error_code": run.ErrorCode, "duration_ms": run.DurationMs}).Error
		if writer != nil {
			_ = writer.Send(gin.H{"type": "error", "message": message, "run": run})
			return
		}
		Error(c, http.StatusBadGateway, message)
		return
	}
	modelName := result.Model
	if modelName == "" {
		modelName = arkConfig.Model
	}
	referenceSummary, _ := json.Marshal(references)
	run.Status = "succeeded"
	run.Model = modelName
	run.Output = aiclient.TrimRunes(result.Reply, 2000)
	run.References = string(referenceSummary)
	run.DurationMs = time.Since(started).Milliseconds()
	_ = database.GetDB().Model(&run).Updates(map[string]any{"status": run.Status, "model": run.Model, "output": run.Output, "references": run.References, "duration_ms": run.DurationMs}).Error
	assistantMessage := model.AIAppConversationMessage{UserID: userID, AppID: app.ID, ConversationID: conversation.ID, RunID: &run.ID, Role: "assistant", Content: strings.TrimSpace(result.Reply)}
	if database.GetDB().Create(&assistantMessage).Error != nil {
		run.Status = "failed"
		run.ErrorCode = "ASSISTANT_MESSAGE_PERSISTENCE_FAILED"
		_ = database.GetDB().Model(&run).Updates(map[string]any{"status": run.Status, "error_code": run.ErrorCode}).Error
		if writer != nil {
			_ = writer.Send(gin.H{"type": "error", "message": "保存助手回复失败", "run": run})
			return
		}
		Error(c, 500, "保存助手回复失败")
		return
	}
	_ = database.GetDB().Model(&conversation).Update("updated_at", time.Now()).Error
	if writer != nil {
		_ = writer.Send(gin.H{"type": "done", "run": run, "conversation": conversation, "userMessage": userMessage, "assistantMessage": assistantMessage, "reply": assistantMessage.Content, "references": references})
		return
	}
	Success(c, gin.H{"run": run, "conversation": conversation, "userMessage": userMessage, "assistantMessage": assistantMessage, "reply": assistantMessage.Content, "references": references})
}
