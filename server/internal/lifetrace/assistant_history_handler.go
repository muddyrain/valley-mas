package lifetrace

import (
	"errors"
	"net/http"
	"strings"
	"valley-server/internal/database"
	"valley-server/internal/model"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

const assistantConversationMessageLimit = 40

var validAssistantMessageRoles = map[string]bool{
	"user":      true,
	"assistant": true,
}

type createAssistantMessageRequest struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

func (h *Handler) GetAssistantConversation(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		fail(c, http.StatusUnauthorized, "未登录")
		return
	}

	conversation, err := findOrCreateAssistantConversation(userID)
	if err != nil {
		fail(c, http.StatusInternalServerError, "读取对话失败")
		return
	}

	messages, err := listAssistantMessages(userID, conversation.ID, assistantConversationMessageLimit)
	if err != nil {
		fail(c, http.StatusInternalServerError, "读取对话消息失败")
		return
	}

	success(c, gin.H{
		"conversation": conversation,
		"messages":     messages,
	})
}

func (h *Handler) CreateAssistantMessage(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		fail(c, http.StatusUnauthorized, "未登录")
		return
	}

	var req createAssistantMessageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		fail(c, http.StatusBadRequest, "参数错误")
		return
	}

	role := strings.TrimSpace(req.Role)
	content := strings.TrimSpace(req.Content)
	if !validAssistantMessageRoles[role] || content == "" {
		fail(c, http.StatusBadRequest, "消息角色或内容不正确")
		return
	}

	conversation, err := findOrCreateAssistantConversation(userID)
	if err != nil {
		fail(c, http.StatusInternalServerError, "读取对话失败")
		return
	}

	message := model.LifeTraceAIMessage{
		UserID:         userID,
		ConversationID: conversation.ID,
		Role:           role,
		Content:        trimRunes(content, 2000),
	}
	if err := database.GetDB().Create(&message).Error; err != nil {
		fail(c, http.StatusInternalServerError, "保存对话消息失败")
		return
	}

	success(c, message)
}

func (h *Handler) ClearAssistantConversation(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		fail(c, http.StatusUnauthorized, "未登录")
		return
	}

	conversation, err := findOrCreateAssistantConversation(userID)
	if err != nil {
		fail(c, http.StatusInternalServerError, "读取对话失败")
		return
	}

	if err := database.GetDB().
		Where("user_id = ? AND conversation_id = ?", userID, conversation.ID).
		Delete(&model.LifeTraceAIMessage{}).Error; err != nil {
		fail(c, http.StatusInternalServerError, "清空对话失败")
		return
	}

	success(c, gin.H{"conversationId": conversation.ID})
}

func findOrCreateAssistantConversation(userID model.Int64String) (model.LifeTraceAIConversation, error) {
	var conversation model.LifeTraceAIConversation
	err := database.GetDB().
		Where("user_id = ? AND status = ?", userID, "active").
		Order("created_at ASC").
		First(&conversation).Error
	if err == nil {
		return conversation, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return model.LifeTraceAIConversation{}, err
	}

	conversation = model.LifeTraceAIConversation{
		UserID: userID,
		Title:  "生活助理对话",
		Status: "active",
	}
	if err := database.GetDB().Create(&conversation).Error; err != nil {
		return model.LifeTraceAIConversation{}, err
	}
	return conversation, nil
}

func listAssistantMessages(
	userID model.Int64String,
	conversationID model.Int64String,
	limit int,
) ([]model.LifeTraceAIMessage, error) {
	var newest []model.LifeTraceAIMessage
	if err := database.GetDB().
		Where("user_id = ? AND conversation_id = ?", userID, conversationID).
		Order("created_at DESC").
		Limit(limit).
		Find(&newest).Error; err != nil {
		return nil, err
	}

	messages := make([]model.LifeTraceAIMessage, 0, len(newest))
	for index := len(newest) - 1; index >= 0; index-- {
		messages = append(messages, newest[index])
	}
	return messages, nil
}
