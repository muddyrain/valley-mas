package handler

import (
	"errors"
	"io"
	"net/http"
	"strings"
	"time"
	"unicode/utf8"
	"valley-server/internal/database"
	"valley-server/internal/model"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

const (
	maxAIImageConversationTitleRunes   = 160
	maxAIImageConversationMessageRunes = 20000
	maxAIImageConversationHistory      = 100
)

type createAIImageConversationRequest struct {
	Title string `json:"title"`
}

type createAIImageConversationMessageRequest struct {
	Role         string `json:"role"`
	Content      string `json:"content"`
	GenerationID string `json:"generationId"`
}

func ListAIImageConversations(c *gin.Context) {
	userID, ok := currentAIAppUser(c)
	if !ok {
		return
	}
	var conversations []model.AIImageConversation
	if err := database.GetDB().Where("user_id = ?", userID).
		Order("updated_at DESC, id DESC").
		Limit(maxAIImageConversationHistory).
		Find(&conversations).Error; err != nil {
		ErrorWithDetail(c, http.StatusInternalServerError, "加载图片对话历史失败", err)
		return
	}
	Success(c, gin.H{"list": conversations})
}

func GetCurrentAIImageConversation(c *gin.Context) {
	userID, ok := currentAIAppUser(c)
	if !ok {
		return
	}
	conversation, found, err := findCurrentAIImageConversation(userID)
	if err != nil {
		ErrorWithDetail(c, http.StatusInternalServerError, "加载图片对话失败", err)
		return
	}
	if !found {
		Success(c, gin.H{"conversation": nil, "messages": []model.AIImageConversationMessage{}})
		return
	}
	messages, err := listAIImageConversationMessages(userID, conversation.ID)
	if err != nil {
		ErrorWithDetail(c, http.StatusInternalServerError, "加载图片对话失败", err)
		return
	}
	Success(c, gin.H{"conversation": conversation, "messages": messages})
}

func GetAIImageConversation(c *gin.Context) {
	userID, ok := currentAIAppUser(c)
	if !ok {
		return
	}
	conversationID, ok := parsePositiveInt64(c.Param("conversationId"))
	if !ok {
		Error(c, http.StatusBadRequest, "图片对话 ID 无效")
		return
	}
	conversation, found, err := findAIImageConversation(userID, model.Int64String(conversationID))
	if err != nil {
		ErrorWithDetail(c, http.StatusInternalServerError, "加载图片对话失败", err)
		return
	}
	if !found {
		Error(c, http.StatusNotFound, "图片对话不存在")
		return
	}
	messages, err := listAIImageConversationMessages(userID, conversation.ID)
	if err != nil {
		ErrorWithDetail(c, http.StatusInternalServerError, "加载图片对话失败", err)
		return
	}
	Success(c, gin.H{"conversation": conversation, "messages": messages})
}

func CreateAIImageConversation(c *gin.Context) {
	userID, ok := currentAIAppUser(c)
	if !ok {
		return
	}
	var payload createAIImageConversationRequest
	if err := c.ShouldBindJSON(&payload); err != nil && !errors.Is(err, io.EOF) {
		Error(c, http.StatusBadRequest, "图片对话参数错误")
		return
	}
	title := strings.TrimSpace(payload.Title)
	if title == "" {
		title = "AI 图片对话"
	}
	if utf8.RuneCountInString(title) > maxAIImageConversationTitleRunes {
		Error(c, http.StatusBadRequest, "图片对话标题过长")
		return
	}
	conversation := model.AIImageConversation{UserID: userID, Title: title}
	if err := database.GetDB().Create(&conversation).Error; err != nil {
		ErrorWithDetail(c, http.StatusInternalServerError, "创建图片对话失败", err)
		return
	}
	Success(c, gin.H{"conversation": conversation, "messages": []model.AIImageConversationMessage{}})
}

func AddAIImageConversationMessage(c *gin.Context) {
	userID, ok := currentAIAppUser(c)
	if !ok {
		return
	}
	conversationID, ok := parsePositiveInt64(c.Param("conversationId"))
	if !ok {
		Error(c, http.StatusBadRequest, "图片对话 ID 无效")
		return
	}
	var payload createAIImageConversationMessageRequest
	if err := c.ShouldBindJSON(&payload); err != nil {
		Error(c, http.StatusBadRequest, "图片对话消息参数错误")
		return
	}
	role, content, err := validateAIImageConversationMessage(payload)
	if err != nil {
		Error(c, http.StatusBadRequest, err.Error())
		return
	}
	var conversation model.AIImageConversation
	if err := database.GetDB().Where("id = ? AND user_id = ?", conversationID, userID).First(&conversation).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			Error(c, http.StatusNotFound, "图片对话不存在")
		} else {
			ErrorWithDetail(c, http.StatusInternalServerError, "读取图片对话失败", err)
		}
		return
	}

	var generationID *model.Int64String
	if strings.TrimSpace(payload.GenerationID) != "" {
		if role != "assistant" {
			Error(c, http.StatusBadRequest, "用户消息不能关联图片生成记录")
			return
		}
		parsedGenerationID, valid := parsePositiveInt64(payload.GenerationID)
		if !valid {
			Error(c, http.StatusBadRequest, "图片生成记录 ID 无效")
			return
		}
		var generation model.AIImageGeneration
		if err := database.GetDB().Where("id = ? AND user_id = ?", parsedGenerationID, userID).First(&generation).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				Error(c, http.StatusNotFound, "图片生成记录不存在")
			} else {
				ErrorWithDetail(c, http.StatusInternalServerError, "读取图片生成记录失败", err)
			}
			return
		}
		value := model.Int64String(parsedGenerationID)
		generationID = &value
	}

	message := model.AIImageConversationMessage{
		UserID:         userID,
		ConversationID: model.Int64String(conversationID),
		Role:           role,
		Content:        content,
		GenerationID:   generationID,
	}
	db := database.GetDB()
	if err := db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&message).Error; err != nil {
			return err
		}
		now := time.Now()
		updates := map[string]any{"updated_at": now}
		if role == "user" &&
			(conversation.Title == "新图片对话" || conversation.Title == "AI 图片对话") {
			titleRunes := []rune(content)
			if len(titleRunes) > maxAIImageConversationTitleRunes {
				titleRunes = titleRunes[:maxAIImageConversationTitleRunes]
			}
			conversation.Title = string(titleRunes)
			updates["title"] = conversation.Title
		}
		if err := tx.Model(&conversation).Updates(updates).Error; err != nil {
			return err
		}
		conversation.UpdatedAt = now
		return nil
	}); err != nil {
		ErrorWithDetail(c, http.StatusInternalServerError, "保存图片对话消息失败", err)
		return
	}
	Success(c, gin.H{"conversation": conversation, "message": message})
}

func ClearCurrentAIImageConversation(c *gin.Context) {
	userID, ok := currentAIAppUser(c)
	if !ok {
		return
	}
	conversation, found, err := findCurrentAIImageConversation(userID)
	if err != nil {
		ErrorWithDetail(c, http.StatusInternalServerError, "加载图片对话失败", err)
		return
	}
	if !found {
		Success(c, gin.H{"conversation": nil, "messages": []model.AIImageConversationMessage{}})
		return
	}
	if err := clearAIImageConversationMessages(userID, &conversation); err != nil {
		ErrorWithDetail(c, http.StatusInternalServerError, "清空图片对话失败", err)
		return
	}
	Success(c, gin.H{"conversation": conversation, "messages": []model.AIImageConversationMessage{}})
}

func ClearAIImageConversation(c *gin.Context) {
	userID, ok := currentAIAppUser(c)
	if !ok {
		return
	}
	conversationID, ok := parsePositiveInt64(c.Param("conversationId"))
	if !ok {
		Error(c, http.StatusBadRequest, "图片对话 ID 无效")
		return
	}
	conversation, found, err := findAIImageConversation(userID, model.Int64String(conversationID))
	if err != nil {
		ErrorWithDetail(c, http.StatusInternalServerError, "加载图片对话失败", err)
		return
	}
	if !found {
		Error(c, http.StatusNotFound, "图片对话不存在")
		return
	}
	if err := clearAIImageConversationMessages(userID, &conversation); err != nil {
		ErrorWithDetail(c, http.StatusInternalServerError, "清空图片对话失败", err)
		return
	}
	Success(c, gin.H{"conversation": conversation, "messages": []model.AIImageConversationMessage{}})
}

func validateAIImageConversationMessage(payload createAIImageConversationMessageRequest) (string, string, error) {
	role := strings.TrimSpace(payload.Role)
	content := strings.TrimSpace(payload.Content)
	if role != "user" && role != "assistant" {
		return "", "", errors.New("图片对话消息角色无效")
	}
	if content == "" || utf8.RuneCountInString(content) > maxAIImageConversationMessageRunes {
		return "", "", errors.New("图片对话消息不能为空且不能超过 20000 个字符")
	}
	return role, content, nil
}

func findCurrentAIImageConversation(userID model.Int64String) (model.AIImageConversation, bool, error) {
	var conversation model.AIImageConversation
	if err := database.GetDB().Where("user_id = ?", userID).Order("updated_at DESC, id DESC").First(&conversation).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return model.AIImageConversation{}, false, nil
		}
		return model.AIImageConversation{}, false, err
	}
	return conversation, true, nil
}

func findAIImageConversation(
	userID, conversationID model.Int64String,
) (model.AIImageConversation, bool, error) {
	var conversation model.AIImageConversation
	if err := database.GetDB().Where("id = ? AND user_id = ?", conversationID, userID).
		First(&conversation).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return model.AIImageConversation{}, false, nil
		}
		return model.AIImageConversation{}, false, err
	}
	return conversation, true, nil
}

func listAIImageConversationMessages(userID, conversationID model.Int64String) ([]model.AIImageConversationMessage, error) {
	var messages []model.AIImageConversationMessage
	err := database.GetDB().Where("user_id = ? AND conversation_id = ?", userID, conversationID).
		Order("created_at ASC, id ASC").Find(&messages).Error
	return messages, err
}

func clearAIImageConversationMessages(
	userID model.Int64String,
	conversation *model.AIImageConversation,
) error {
	return database.GetDB().Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("user_id = ? AND conversation_id = ?", userID, conversation.ID).
			Delete(&model.AIImageConversationMessage{}).Error; err != nil {
			return err
		}
		now := time.Now()
		if err := tx.Model(conversation).Update("updated_at", now).Error; err != nil {
			return err
		}
		conversation.UpdatedAt = now
		return nil
	})
}
