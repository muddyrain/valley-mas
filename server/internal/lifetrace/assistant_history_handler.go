package lifetrace

import (
	"errors"
	"net/http"
	"strconv"
	"strings"
	"valley-server/internal/database"
	"valley-server/internal/model"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

const assistantConversationMessageLimit = 120

var validAssistantMessageRoles = map[string]bool{
	"user":      true,
	"assistant": true,
}

type createAssistantMessageRequest struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type createAssistantConversationRequest struct {
	Title string `json:"title"`
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

	conversation, err := findOrCreateAssistantConversation(userID)
	if err != nil {
		fail(c, http.StatusInternalServerError, "读取对话失败")
		return
	}

	message, err := createAssistantMessage(userID, conversation.ID, req)
	if err != nil {
		fail(c, http.StatusBadRequest, err.Error())
		return
	}

	success(c, message)
}

func (h *Handler) ListAssistantConversations(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		fail(c, http.StatusUnauthorized, "未登录")
		return
	}

	activeConversation, err := findOrCreateAssistantConversation(userID)
	if err != nil {
		fail(c, http.StatusInternalServerError, "读取对话失败")
		return
	}

	var conversations []model.LifeTraceAIConversation
	if err := database.GetDB().
		Where("user_id = ? AND status = ?", userID, "active").
		Order("updated_at DESC").
		Limit(50).
		Find(&conversations).Error; err != nil {
		fail(c, http.StatusInternalServerError, "读取话题列表失败")
		return
	}

	success(c, gin.H{
		"activeConversationId": activeConversation.ID,
		"list":                 conversations,
	})
}

func (h *Handler) CreateAssistantConversation(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		fail(c, http.StatusUnauthorized, "未登录")
		return
	}

	var req createAssistantConversationRequest
	if err := c.ShouldBindJSON(&req); err != nil && err.Error() != "EOF" {
		fail(c, http.StatusBadRequest, "参数错误")
		return
	}

	title := strings.TrimSpace(req.Title)
	if title == "" {
		title = "新话题"
	}

	conversation := model.LifeTraceAIConversation{
		UserID: userID,
		Title:  trimRunes(title, 60),
		Status: "active",
	}
	if err := database.GetDB().Create(&conversation).Error; err != nil {
		fail(c, http.StatusInternalServerError, "创建话题失败")
		return
	}

	success(c, conversation)
}

func (h *Handler) GetAssistantConversationByID(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		fail(c, http.StatusUnauthorized, "未登录")
		return
	}

	conversation, found := findAssistantConversation(c.Param("conversationId"), userID)
	if !found {
		fail(c, http.StatusNotFound, "话题不存在")
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

func (h *Handler) CreateAssistantMessageInConversation(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		fail(c, http.StatusUnauthorized, "未登录")
		return
	}

	conversation, found := findAssistantConversation(c.Param("conversationId"), userID)
	if !found {
		fail(c, http.StatusNotFound, "话题不存在")
		return
	}

	var req createAssistantMessageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		fail(c, http.StatusBadRequest, "参数错误")
		return
	}

	message, err := createAssistantMessage(userID, conversation.ID, req)
	if err != nil {
		fail(c, http.StatusBadRequest, err.Error())
		return
	}

	success(c, message)
}

func (h *Handler) DeleteAssistantConversation(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		fail(c, http.StatusUnauthorized, "未登录")
		return
	}

	conversation, found := findAssistantConversation(c.Param("conversationId"), userID)
	if !found {
		fail(c, http.StatusNotFound, "话题不存在")
		return
	}

	err := database.GetDB().Transaction(func(tx *gorm.DB) error {
		if err := tx.
			Where("user_id = ? AND conversation_id = ?", userID, conversation.ID).
			Delete(&model.LifeTraceAIMessage{}).Error; err != nil {
			return err
		}
		return tx.Delete(&conversation).Error
	})
	if err != nil {
		fail(c, http.StatusInternalServerError, "删除话题失败")
		return
	}

	nextConversation, err := findOrCreateAssistantConversation(userID)
	if err != nil {
		fail(c, http.StatusInternalServerError, "读取对话失败")
		return
	}

	success(c, gin.H{
		"deletedId":          conversation.ID,
		"nextConversationId": nextConversation.ID,
	})
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
		Order("updated_at DESC").
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

func findAssistantConversation(id string, userID model.Int64String) (model.LifeTraceAIConversation, bool) {
	conversationID, ok := parseAssistantConversationID(id)
	if !ok {
		return model.LifeTraceAIConversation{}, false
	}

	var conversation model.LifeTraceAIConversation
	if err := database.GetDB().
		Where("id = ? AND user_id = ? AND status = ?", conversationID, userID, "active").
		First(&conversation).Error; err != nil {
		return model.LifeTraceAIConversation{}, false
	}
	return conversation, true
}

func parseAssistantConversationID(raw string) (model.Int64String, bool) {
	value, err := strconv.ParseInt(strings.TrimSpace(raw), 10, 64)
	if err != nil || value == 0 {
		return 0, false
	}
	return model.Int64String(value), true
}

func createAssistantMessage(
	userID model.Int64String,
	conversationID model.Int64String,
	req createAssistantMessageRequest,
) (model.LifeTraceAIMessage, error) {
	role := strings.TrimSpace(req.Role)
	content := strings.TrimSpace(req.Content)
	if !validAssistantMessageRoles[role] || content == "" {
		return model.LifeTraceAIMessage{}, errors.New("消息角色或内容不正确")
	}

	message := model.LifeTraceAIMessage{
		UserID:         userID,
		ConversationID: conversationID,
		Role:           role,
		Content:        trimRunes(content, 2000),
	}
	if err := database.GetDB().Create(&message).Error; err != nil {
		return model.LifeTraceAIMessage{}, errors.New("保存对话消息失败")
	}

	updates := map[string]interface{}{"updated_at": gorm.Expr("CURRENT_TIMESTAMP")}
	if role == "user" {
		var conversation model.LifeTraceAIConversation
		if err := database.GetDB().
			Where("id = ? AND user_id = ?", conversationID, userID).
			First(&conversation).Error; err == nil &&
			(conversation.Title == "新话题" || conversation.Title == "生活助理对话") {
			updates["title"] = trimRunes(content, 32)
		}
	}

	_ = database.GetDB().Model(&model.LifeTraceAIConversation{}).
		Where("id = ? AND user_id = ?", conversationID, userID).
		Updates(updates).Error

	evaluateAchievementsQuietly(userID)
	return message, nil
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
