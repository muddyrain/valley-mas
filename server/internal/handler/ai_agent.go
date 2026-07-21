package handler

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"
	"valley-server/internal/aiclient"
	"valley-server/internal/aimodel"
	"valley-server/internal/aiusage"
	"valley-server/internal/database"
	appmodel "valley-server/internal/model"

	"github.com/gin-gonic/gin"
	"github.com/volcengine/volcengine-go-sdk/service/arkruntime"
	arkmodel "github.com/volcengine/volcengine-go-sdk/service/arkruntime/model"
	"gorm.io/gorm"
)

const (
	aiAgentStatusActive   = "active"
	aiAgentStatusArchived = "archived"
)

type aiAgentPayload struct {
	Name             *string  `json:"name"`
	Description      *string  `json:"description"`
	AvatarColor      *string  `json:"avatarColor"`
	AvatarIcon       *string  `json:"avatarIcon"`
	SystemPrompt     *string  `json:"systemPrompt"`
	OpeningMessage   *string  `json:"openingMessage"`
	ExampleQuestions []string `json:"exampleQuestions"`
	Status           *string  `json:"status"`
}

type aiConversationPayload struct {
	Title string `json:"title"`
}

type aiAgentChatPayload struct {
	Message string `json:"message" binding:"required"`
	ModelID string `json:"modelId" binding:"required"`
	Stream  bool   `json:"stream"`
}

type aiAgentDTO struct {
	ID               appmodel.Int64String `json:"id"`
	Name             string               `json:"name"`
	Description      string               `json:"description"`
	AvatarColor      string               `json:"avatarColor"`
	AvatarIcon       string               `json:"avatarIcon"`
	SystemPrompt     string               `json:"systemPrompt"`
	OpeningMessage   string               `json:"openingMessage"`
	ExampleQuestions []string             `json:"exampleQuestions"`
	Status           string               `json:"status"`
	CreatedAt        time.Time            `json:"createdAt"`
	UpdatedAt        time.Time            `json:"updatedAt"`
}

func aiAgentError(c *gin.Context, status int, message string) {
	c.JSON(status, Response{
		Code:    status,
		Message: message,
		LogID:   "",
	})
}

func aiAgentCurrentUserID(c *gin.Context) (appmodel.Int64String, bool) {
	userID := GetCurrentUserID(c)
	if userID <= 0 {
		aiAgentError(c, http.StatusUnauthorized, "未登录")
		return 0, false
	}
	return appmodel.Int64String(userID), true
}

func parseAIPathID(c *gin.Context, key string) (appmodel.Int64String, bool) {
	raw := strings.TrimSpace(c.Param(key))
	value, err := strconv.ParseInt(raw, 10, 64)
	if err != nil || value <= 0 {
		aiAgentError(c, http.StatusNotFound, "资源不存在")
		return 0, false
	}
	return appmodel.Int64String(value), true
}

func defaultAIAgentSystemPrompt() string {
	return strings.Join([]string{
		"你是 Valley Desktop OS 的默认 AI 助手。",
		"请始终使用简体中文回答，语气清晰、直接、可执行。",
		"当用户目标不明确时，先帮用户拆解问题，再给出下一步建议。",
	}, " ")
}

func defaultAIAgentForUser(userID appmodel.Int64String) appmodel.AIAgent {
	examples, _ := json.Marshal([]string{"帮我总结这段内容", "把这段话改得更自然", "给我列一个执行清单"})
	return appmodel.AIAgent{
		UserID:           userID,
		Name:             "默认助手",
		Description:      "日常问答、总结、改写和任务拆解",
		AvatarColor:      "#8fb4ff",
		AvatarIcon:       "sparkles",
		SystemPrompt:     defaultAIAgentSystemPrompt(),
		OpeningMessage:   "把问题发给我，我会先帮你拆清楚。",
		ExampleQuestions: string(examples),
		Status:           aiAgentStatusActive,
	}
}

func ensureDefaultAIAgent(db *gorm.DB, userID appmodel.Int64String) (appmodel.AIAgent, error) {
	var agent appmodel.AIAgent
	err := db.Where("user_id = ? AND status = ?", userID, aiAgentStatusActive).
		Order("updated_at DESC").
		First(&agent).Error
	if err == nil {
		return agent, nil
	}
	if err != nil && err != gorm.ErrRecordNotFound {
		return agent, err
	}
	agent = defaultAIAgentForUser(userID)
	return agent, db.Create(&agent).Error
}

func parseExampleQuestions(raw string) []string {
	var questions []string
	if err := json.Unmarshal([]byte(raw), &questions); err != nil {
		return []string{}
	}
	cleaned := make([]string, 0, len(questions))
	for _, item := range questions {
		text := truncateAIAgentRunes(strings.TrimSpace(item), 120)
		if text != "" {
			cleaned = append(cleaned, text)
		}
	}
	return cleaned
}

func encodeExampleQuestions(questions []string) string {
	cleaned := make([]string, 0, len(questions))
	for _, item := range questions {
		text := truncateAIAgentRunes(strings.TrimSpace(item), 120)
		if text != "" {
			cleaned = append(cleaned, text)
		}
		if len(cleaned) >= 8 {
			break
		}
	}
	data, _ := json.Marshal(cleaned)
	return string(data)
}

func aiAgentResponse(agent appmodel.AIAgent) aiAgentDTO {
	return aiAgentDTO{
		ID:               agent.ID,
		Name:             agent.Name,
		Description:      agent.Description,
		AvatarColor:      agent.AvatarColor,
		AvatarIcon:       agent.AvatarIcon,
		SystemPrompt:     agent.SystemPrompt,
		OpeningMessage:   agent.OpeningMessage,
		ExampleQuestions: parseExampleQuestions(agent.ExampleQuestions),
		Status:           agent.Status,
		CreatedAt:        agent.CreatedAt,
		UpdatedAt:        agent.UpdatedAt,
	}
}

func aiAgentResponses(agents []appmodel.AIAgent) []aiAgentDTO {
	items := make([]aiAgentDTO, 0, len(agents))
	for _, agent := range agents {
		items = append(items, aiAgentResponse(agent))
	}
	return items
}

func truncateAIAgentRunes(value string, limit int) string {
	value = strings.TrimSpace(value)
	if limit <= 0 {
		return value
	}
	runes := []rune(value)
	if len(runes) <= limit {
		return value
	}
	return string(runes[:limit])
}

func findAIAgentForUser(db *gorm.DB, userID appmodel.Int64String, agentID appmodel.Int64String) (appmodel.AIAgent, bool) {
	var agent appmodel.AIAgent
	err := db.Where("id = ? AND user_id = ?", agentID, userID).First(&agent).Error
	if err != nil {
		return agent, false
	}
	return agent, true
}

func findAIConversationForUser(db *gorm.DB, userID appmodel.Int64String, agentID appmodel.Int64String, conversationID appmodel.Int64String) (appmodel.AIConversation, bool) {
	var conversation appmodel.AIConversation
	err := db.Where("id = ? AND user_id = ? AND agent_id = ?", conversationID, userID, agentID).First(&conversation).Error
	if err != nil {
		return conversation, false
	}
	return conversation, true
}

func ListAIAgents(c *gin.Context) {
	userID, ok := aiAgentCurrentUserID(c)
	if !ok {
		return
	}
	db := database.GetDB()
	if _, err := ensureDefaultAIAgent(db, userID); err != nil {
		aiAgentError(c, http.StatusInternalServerError, "加载智能体失败")
		return
	}

	var agents []appmodel.AIAgent
	if err := db.Where("user_id = ? AND status = ?", userID, aiAgentStatusActive).
		Order("updated_at DESC").
		Find(&agents).Error; err != nil {
		aiAgentError(c, http.StatusInternalServerError, "加载智能体失败")
		return
	}
	activeID := appmodel.Int64String(0)
	if len(agents) > 0 {
		activeID = agents[0].ID
	}
	Success(c, gin.H{
		"agents":        aiAgentResponses(agents),
		"activeAgentId": activeID,
	})
}

func CreateAIAgent(c *gin.Context) {
	userID, ok := aiAgentCurrentUserID(c)
	if !ok {
		return
	}
	var payload aiAgentPayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		aiAgentError(c, http.StatusBadRequest, "参数错误")
		return
	}
	agent := defaultAIAgentForUser(userID)
	if payload.Name != nil {
		agent.Name = truncateAIAgentRunes(*payload.Name, 80)
	}
	if payload.Description != nil {
		agent.Description = truncateAIAgentRunes(*payload.Description, 240)
	}
	if payload.AvatarColor != nil {
		agent.AvatarColor = truncateAIAgentRunes(*payload.AvatarColor, 32)
	}
	if payload.AvatarIcon != nil {
		agent.AvatarIcon = truncateAIAgentRunes(*payload.AvatarIcon, 40)
	}
	if payload.SystemPrompt != nil {
		agent.SystemPrompt = truncateAIAgentRunes(*payload.SystemPrompt, 8000)
	}
	if payload.OpeningMessage != nil {
		agent.OpeningMessage = truncateAIAgentRunes(*payload.OpeningMessage, 1000)
	}
	if payload.ExampleQuestions != nil {
		agent.ExampleQuestions = encodeExampleQuestions(payload.ExampleQuestions)
	}
	if payload.Status != nil && strings.TrimSpace(*payload.Status) == aiAgentStatusArchived {
		agent.Status = aiAgentStatusArchived
	}
	if strings.TrimSpace(agent.Name) == "" || strings.TrimSpace(agent.SystemPrompt) == "" {
		aiAgentError(c, http.StatusBadRequest, "名称和系统提示词不能为空")
		return
	}
	if err := database.GetDB().Create(&agent).Error; err != nil {
		aiAgentError(c, http.StatusInternalServerError, "创建智能体失败")
		return
	}
	Success(c, gin.H{"agent": aiAgentResponse(agent)})
}

func GetAIAgent(c *gin.Context) {
	userID, ok := aiAgentCurrentUserID(c)
	if !ok {
		return
	}
	agentID, ok := parseAIPathID(c, "agentId")
	if !ok {
		return
	}
	agent, found := findAIAgentForUser(database.GetDB(), userID, agentID)
	if !found {
		aiAgentError(c, http.StatusNotFound, "智能体不存在")
		return
	}
	Success(c, gin.H{"agent": aiAgentResponse(agent)})
}

func UpdateAIAgent(c *gin.Context) {
	userID, ok := aiAgentCurrentUserID(c)
	if !ok {
		return
	}
	agentID, ok := parseAIPathID(c, "agentId")
	if !ok {
		return
	}
	db := database.GetDB()
	agent, found := findAIAgentForUser(db, userID, agentID)
	if !found {
		aiAgentError(c, http.StatusNotFound, "智能体不存在")
		return
	}
	var payload aiAgentPayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		aiAgentError(c, http.StatusBadRequest, "参数错误")
		return
	}
	if payload.Name != nil {
		agent.Name = truncateAIAgentRunes(*payload.Name, 80)
	}
	if payload.Description != nil {
		agent.Description = truncateAIAgentRunes(*payload.Description, 240)
	}
	if payload.AvatarColor != nil {
		agent.AvatarColor = truncateAIAgentRunes(*payload.AvatarColor, 32)
	}
	if payload.AvatarIcon != nil {
		agent.AvatarIcon = truncateAIAgentRunes(*payload.AvatarIcon, 40)
	}
	if payload.SystemPrompt != nil {
		agent.SystemPrompt = truncateAIAgentRunes(*payload.SystemPrompt, 8000)
	}
	if payload.OpeningMessage != nil {
		agent.OpeningMessage = truncateAIAgentRunes(*payload.OpeningMessage, 1000)
	}
	if payload.ExampleQuestions != nil {
		agent.ExampleQuestions = encodeExampleQuestions(payload.ExampleQuestions)
	}
	if payload.Status != nil {
		status := strings.TrimSpace(*payload.Status)
		if status != aiAgentStatusActive && status != aiAgentStatusArchived {
			aiAgentError(c, http.StatusBadRequest, "状态不合法")
			return
		}
		agent.Status = status
	}
	if strings.TrimSpace(agent.Name) == "" || strings.TrimSpace(agent.SystemPrompt) == "" {
		aiAgentError(c, http.StatusBadRequest, "名称和系统提示词不能为空")
		return
	}
	if err := db.Save(&agent).Error; err != nil {
		aiAgentError(c, http.StatusInternalServerError, "更新智能体失败")
		return
	}
	Success(c, gin.H{"agent": aiAgentResponse(agent)})
}

func DeleteAIAgent(c *gin.Context) {
	userID, ok := aiAgentCurrentUserID(c)
	if !ok {
		return
	}
	agentID, ok := parseAIPathID(c, "agentId")
	if !ok {
		return
	}
	db := database.GetDB()
	agent, found := findAIAgentForUser(db, userID, agentID)
	if !found {
		aiAgentError(c, http.StatusNotFound, "智能体不存在")
		return
	}

	if err := db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("user_id = ? AND agent_id = ?", userID, agentID).Delete(&appmodel.AIMessage{}).Error; err != nil {
			return err
		}
		if err := tx.Where("user_id = ? AND agent_id = ?", userID, agentID).Delete(&appmodel.AIConversation{}).Error; err != nil {
			return err
		}
		return tx.Delete(&agent).Error
	}); err != nil {
		aiAgentError(c, http.StatusInternalServerError, "删除智能体失败")
		return
	}

	next, err := ensureDefaultAIAgent(db, userID)
	if err != nil {
		aiAgentError(c, http.StatusInternalServerError, "加载默认智能体失败")
		return
	}
	Success(c, gin.H{
		"deletedId":   agentID,
		"nextAgentId": next.ID,
	})
}

func ListAIConversations(c *gin.Context) {
	userID, agentID, ok := aiAgentAndIDFromRequest(c)
	if !ok {
		return
	}
	var conversations []appmodel.AIConversation
	if err := database.GetDB().Where("user_id = ? AND agent_id = ? AND status = ?", userID, agentID, aiAgentStatusActive).
		Order("updated_at DESC").
		Find(&conversations).Error; err != nil {
		aiAgentError(c, http.StatusInternalServerError, "加载会话失败")
		return
	}
	Success(c, gin.H{"conversations": conversations})
}

func CreateAIConversation(c *gin.Context) {
	userID, agentID, ok := aiAgentAndIDFromRequest(c)
	if !ok {
		return
	}
	var payload aiConversationPayload
	_ = c.ShouldBindJSON(&payload)
	title := truncateAIAgentRunes(payload.Title, 120)
	if title == "" {
		title = "新对话"
	}
	conversation := appmodel.AIConversation{
		UserID:  userID,
		AgentID: agentID,
		Title:   title,
		Status:  aiAgentStatusActive,
	}
	if err := database.GetDB().Create(&conversation).Error; err != nil {
		aiAgentError(c, http.StatusInternalServerError, "创建会话失败")
		return
	}
	Success(c, gin.H{"conversation": conversation})
}

func GetAIConversation(c *gin.Context) {
	userID, agentID, ok := aiAgentAndIDFromRequest(c)
	if !ok {
		return
	}
	conversationID, ok := parseAIPathID(c, "conversationId")
	if !ok {
		return
	}
	conversation, found := findAIConversationForUser(database.GetDB(), userID, agentID, conversationID)
	if !found {
		aiAgentError(c, http.StatusNotFound, "会话不存在")
		return
	}
	var messages []appmodel.AIMessage
	if err := database.GetDB().Where("user_id = ? AND agent_id = ? AND conversation_id = ?", userID, agentID, conversationID).
		Order("created_at ASC").
		Find(&messages).Error; err != nil {
		aiAgentError(c, http.StatusInternalServerError, "加载消息失败")
		return
	}
	Success(c, gin.H{
		"conversation": conversation,
		"messages":     messages,
	})
}

func DeleteAIConversation(c *gin.Context) {
	userID, agentID, ok := aiAgentAndIDFromRequest(c)
	if !ok {
		return
	}
	conversationID, ok := parseAIPathID(c, "conversationId")
	if !ok {
		return
	}
	conversation, found := findAIConversationForUser(database.GetDB(), userID, agentID, conversationID)
	if !found {
		aiAgentError(c, http.StatusNotFound, "会话不存在")
		return
	}
	if err := database.GetDB().Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("user_id = ? AND agent_id = ? AND conversation_id = ?", userID, agentID, conversationID).
			Delete(&appmodel.AIMessage{}).Error; err != nil {
			return err
		}
		return tx.Delete(&conversation).Error
	}); err != nil {
		aiAgentError(c, http.StatusInternalServerError, "删除会话失败")
		return
	}
	Success(c, gin.H{"deletedId": conversationID})
}

func aiAgentAndIDFromRequest(c *gin.Context) (appmodel.Int64String, appmodel.Int64String, bool) {
	userID, ok := aiAgentCurrentUserID(c)
	if !ok {
		return 0, 0, false
	}
	agentID, ok := parseAIPathID(c, "agentId")
	if !ok {
		return 0, 0, false
	}
	if _, found := findAIAgentForUser(database.GetDB(), userID, agentID); !found {
		aiAgentError(c, http.StatusNotFound, "智能体不存在")
		return 0, 0, false
	}
	return userID, agentID, true
}

func ChatWithAIAgent(c *gin.Context) {
	start := time.Now()
	userID, agentID, ok := aiAgentAndIDFromRequest(c)
	if !ok {
		return
	}
	conversationID, ok := parseAIPathID(c, "conversationId")
	if !ok {
		return
	}
	db := database.GetDB()
	agent, _ := findAIAgentForUser(db, userID, agentID)
	conversation, found := findAIConversationForUser(db, userID, agentID, conversationID)
	if !found {
		aiAgentError(c, http.StatusNotFound, "会话不存在")
		return
	}
	var payload aiAgentChatPayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		aiAgentError(c, http.StatusBadRequest, "参数错误")
		return
	}
	payload.Message = truncateAIAgentRunes(payload.Message, 12000)
	if payload.Message == "" {
		aiAgentError(c, http.StatusBadRequest, "消息不能为空")
		return
	}

	var history []appmodel.AIMessage
	if err := db.Where("user_id = ? AND agent_id = ? AND conversation_id = ?", userID, agentID, conversationID).
		Order("created_at ASC").
		Limit(40).
		Find(&history).Error; err != nil {
		aiAgentError(c, http.StatusInternalServerError, "加载历史消息失败")
		return
	}

	userMessage := appmodel.AIMessage{
		UserID:         userID,
		AgentID:        agentID,
		ConversationID: conversationID,
		Role:           "user",
		Content:        payload.Message,
	}
	if err := db.Create(&userMessage).Error; err != nil {
		aiAgentError(c, http.StatusInternalServerError, "保存消息失败")
		return
	}
	if conversation.Title == "新对话" {
		conversation.Title = truncateAIAgentRunes(payload.Message, 32)
		_ = db.Save(&conversation).Error
	}

	invocation, invocationErr := aimodel.ResolveInvocation(db, payload.ModelID, "text", 90*time.Second)
	if invocationErr != nil {
		recordAIAgentChatUsageWithProvider(userID, payload.Message, history, "", "unknown", payload.ModelID, aiusage.Since(start), invocationErr.Error())
		aiAgentError(c, http.StatusServiceUnavailable, "所选模型暂不可用")
		return
	}
	messages := buildAIAgentCompatibleMessages(agent, history, payload.Message)

	if payload.Stream {
		streamAIAgentChatWithCompatible(c, invocation.Client, invocation.Provider.Provider, invocation.Model.ModelID, messages, userID, history, payload.Message, conversation, userMessage, start)
		return
	}

	response, err := invocation.Client.Chat(c.Request.Context(), aiclient.CompatibleChatRequest{Model: invocation.Model.ModelID, Messages: messages})
	if err != nil {
		recordAIAgentChatUsageWithProvider(userID, payload.Message, history, "", invocation.Provider.Provider, invocation.Model.ModelID, aiusage.Since(start), err.Error())
		aiAgentError(c, http.StatusBadGateway, "AI upstream error: "+err.Error())
		return
	}
	reply := compatibleMessageText(response.Choices[0].Message.Content)
	modelName := modelNameOrFallback(response.Model, invocation.Model.ModelID)
	reply = strings.TrimSpace(reply)
	if reply == "" {
		recordAIAgentChatUsageWithProvider(userID, payload.Message, history, "", invocation.Provider.Provider, modelName, aiusage.Since(start), "AI upstream returned empty content")
		aiAgentError(c, http.StatusBadGateway, "AI upstream returned empty content")
		return
	}

	assistantMessage := appmodel.AIMessage{
		UserID:         userID,
		AgentID:        agentID,
		ConversationID: conversationID,
		Role:           "assistant",
		Content:        reply,
	}
	if err := db.Create(&assistantMessage).Error; err != nil {
		aiAgentError(c, http.StatusInternalServerError, "保存回复失败")
		return
	}
	recordAIAgentChatUsageWithProvider(userID, payload.Message, history, reply, invocation.Provider.Provider, modelName, aiusage.Since(start), "")

	Success(c, gin.H{
		"conversation":     conversation,
		"userMessage":      userMessage,
		"assistantMessage": assistantMessage,
		"reply":            reply,
		"model":            modelName,
		"provider":         invocation.Provider.Provider,
	})
}

func buildAIAgentCompatibleMessages(agent appmodel.AIAgent, history []appmodel.AIMessage, message string) []aiclient.CompatibleMessage {
	items := make([]aiclient.CompatibleMessage, 0, len(history)+2)
	system := strings.TrimSpace(agent.SystemPrompt)
	if system == "" {
		system = defaultAIAgentSystemPrompt()
	}
	items = append(items, aiclient.CompatibleMessage{Role: "system", Content: system})
	for _, item := range history {
		role, content := strings.TrimSpace(item.Role), strings.TrimSpace(item.Content)
		if content != "" && (role == "user" || role == "assistant") {
			items = append(items, aiclient.CompatibleMessage{Role: role, Content: content})
		}
	}
	return append(items, aiclient.CompatibleMessage{Role: "user", Content: message})
}

func streamAIAgentChatWithCompatible(c *gin.Context, client *aiclient.CompatibleClient, provider, modelID string, messages []aiclient.CompatibleMessage, userID appmodel.Int64String, history []appmodel.AIMessage, userText string, conversation appmodel.AIConversation, userMessage appmodel.AIMessage, start time.Time) {
	writer, err := aiclient.NewSSEWriter(c)
	if err != nil {
		aiAgentError(c, http.StatusInternalServerError, "streaming not supported")
		return
	}
	_ = writer.Send(gin.H{"type": "meta", "conversation": conversation, "userMessage": userMessage, "model": modelID, "provider": provider})
	var chunks strings.Builder
	currentModel := modelID
	err = client.ChatStream(c.Request.Context(), aiclient.CompatibleChatRequest{Model: modelID, Messages: messages}, func(chunk aiclient.CompatibleChatStreamChunk) error {
		if strings.TrimSpace(chunk.Model) != "" {
			currentModel = chunk.Model
		}
		for _, choice := range chunk.Choices {
			text := compatibleMessageText(choice.Delta.Content)
			if text == "" {
				continue
			}
			chunks.WriteString(text)
			if sendErr := writer.Send(gin.H{"type": "delta", "chunk": text, "model": currentModel}); sendErr != nil {
				return sendErr
			}
		}
		return nil
	})
	if err != nil {
		recordAIAgentChatUsageWithProvider(userID, userText, history, chunks.String(), provider, currentModel, aiusage.Since(start), err.Error())
		_ = writer.Send(gin.H{"type": "error", "message": "AI upstream error: " + err.Error()})
		return
	}
	reply := strings.TrimSpace(chunks.String())
	if reply == "" {
		recordAIAgentChatUsageWithProvider(userID, userText, history, "", provider, currentModel, aiusage.Since(start), "AI upstream returned empty content")
		_ = writer.Send(gin.H{"type": "error", "message": "AI upstream returned empty content"})
		return
	}
	assistantMessage := appmodel.AIMessage{UserID: userID, AgentID: conversation.AgentID, ConversationID: conversation.ID, Role: "assistant", Content: reply}
	if err := database.GetDB().Create(&assistantMessage).Error; err != nil {
		recordAIAgentChatUsageWithProvider(userID, userText, history, reply, provider, currentModel, aiusage.Since(start), err.Error())
		_ = writer.Send(gin.H{"type": "error", "message": "保存回复失败"})
		return
	}
	recordAIAgentChatUsageWithProvider(userID, userText, history, reply, provider, currentModel, aiusage.Since(start), "")
	_ = writer.Send(gin.H{"type": "done", "conversation": conversation, "assistantMessage": assistantMessage, "reply": reply, "model": currentModel, "provider": provider})
}

func streamAIAgentChatWithARK(
	c *gin.Context,
	client *arkruntime.Client,
	modelID string,
	messages []*arkmodel.ChatCompletionMessage,
	userID appmodel.Int64String,
	history []appmodel.AIMessage,
	userText string,
	conversation appmodel.AIConversation,
	userMessage appmodel.AIMessage,
	start time.Time,
) {
	stream, err := client.CreateChatCompletionStream(c.Request.Context(), arkChatRequest(modelID, messages))
	if err != nil {
		recordAIAgentChatUsage(userID, userText, history, "", modelID, aiusage.Since(start), err.Error())
		aiAgentError(c, http.StatusBadGateway, "AI upstream error: "+err.Error())
		return
	}
	defer stream.Close()

	c.Writer.Header().Set("Content-Type", "text/event-stream")
	c.Writer.Header().Set("Cache-Control", "no-cache")
	c.Writer.Header().Set("Connection", "keep-alive")
	c.Writer.Header().Set("X-Accel-Buffering", "no")

	flusher, ok := c.Writer.(http.Flusher)
	if !ok {
		aiAgentError(c, http.StatusInternalServerError, "streaming not supported")
		return
	}

	send := func(payload gin.H) {
		data, _ := json.Marshal(payload)
		_, _ = c.Writer.Write([]byte("data: "))
		_, _ = c.Writer.Write(data)
		_, _ = c.Writer.Write([]byte("\n\n"))
		flusher.Flush()
	}

	send(gin.H{
		"type":         "meta",
		"conversation": conversation,
		"userMessage":  userMessage,
		"model":        modelID,
		"provider":     "ark",
	})

	chunks := strings.Builder{}
	currentModel := modelID

	for {
		resp, err := stream.Recv()
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			recordAIAgentChatUsage(userID, userText, history, chunks.String(), currentModel, aiusage.Since(start), err.Error())
			send(gin.H{"type": "error", "message": "AI upstream error: " + err.Error()})
			return
		}

		if strings.TrimSpace(resp.Model) != "" {
			currentModel = resp.Model
		}
		for _, choice := range resp.Choices {
			if choice == nil {
				continue
			}
			if strings.TrimSpace(choice.Delta.Content) != "" {
				chunks.WriteString(choice.Delta.Content)
				send(gin.H{
					"type":  "delta",
					"chunk": choice.Delta.Content,
					"model": currentModel,
				})
			}
		}
	}

	reply := strings.TrimSpace(chunks.String())
	if reply == "" {
		recordAIAgentChatUsage(userID, userText, history, "", currentModel, aiusage.Since(start), "AI upstream returned empty content")
		send(gin.H{"type": "error", "message": "AI upstream returned empty content"})
		return
	}

	assistantMessage := appmodel.AIMessage{
		UserID:         userID,
		AgentID:        conversation.AgentID,
		ConversationID: conversation.ID,
		Role:           arkmodel.ChatMessageRoleAssistant,
		Content:        reply,
	}
	if err := database.GetDB().Create(&assistantMessage).Error; err != nil {
		recordAIAgentChatUsage(userID, userText, history, reply, currentModel, aiusage.Since(start), err.Error())
		send(gin.H{"type": "error", "message": "保存回复失败"})
		return
	}

	recordAIAgentChatUsage(userID, userText, history, reply, currentModel, aiusage.Since(start), "")
	send(gin.H{
		"type":             "done",
		"conversation":     conversation,
		"assistantMessage": assistantMessage,
		"reply":            reply,
		"model":            currentModel,
		"provider":         "ark",
	})
}

func buildAIAgentARKMessages(agent appmodel.AIAgent, history []appmodel.AIMessage, message string) []*arkmodel.ChatCompletionMessage {
	items := make([]*arkmodel.ChatCompletionMessage, 0, len(history)+2)
	appendMessage := func(role, content string) {
		text := strings.TrimSpace(content)
		if text == "" {
			return
		}
		textCopy := text
		items = append(items, &arkmodel.ChatCompletionMessage{
			Role:    role,
			Content: &arkmodel.ChatCompletionMessageContent{StringValue: &textCopy},
		})
	}
	systemPrompt := strings.TrimSpace(agent.SystemPrompt)
	if systemPrompt == "" {
		systemPrompt = defaultAIAgentSystemPrompt()
	}
	appendMessage(arkmodel.ChatMessageRoleSystem, systemPrompt)
	for _, item := range history {
		role := strings.TrimSpace(item.Role)
		if role != arkmodel.ChatMessageRoleUser && role != arkmodel.ChatMessageRoleAssistant {
			continue
		}
		appendMessage(role, item.Content)
	}
	appendMessage(arkmodel.ChatMessageRoleUser, message)
	return items
}

func recordAIAgentChatUsage(userID appmodel.Int64String, message string, history []appmodel.AIMessage, reply string, modelName string, latencyMs int64, errMessage string) {
	recordAIAgentChatUsageWithProvider(userID, message, history, reply, "ark", modelName, latencyMs, errMessage)
}

func recordAIAgentChatUsageWithProvider(userID appmodel.Int64String, message string, history []appmodel.AIMessage, reply, provider, modelName string, latencyMs int64, errMessage string) {
	status := aiusage.StatusSuccess
	if strings.TrimSpace(errMessage) != "" {
		status = aiusage.StatusFailed
	}
	promptChars := aiusage.CharCount(message)
	for _, item := range history {
		promptChars += aiusage.CharCount(item.Content)
	}
	aiusage.Record(aiusage.Entry{
		Feature:       "desktop-ai-agent-chat",
		Provider:      provider,
		Model:         modelName,
		UserID:        strconv.FormatInt(int64(userID), 10),
		Status:        status,
		Stream:        false,
		PromptChars:   promptChars,
		ResponseChars: aiusage.CharCount(reply),
		LatencyMs:     latencyMs,
		ErrorMessage:  errMessage,
	})
}
