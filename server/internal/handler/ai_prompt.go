package handler

import (
	"errors"
	"net/http"
	"strings"
	"time"

	"valley-server/internal/database"
	"valley-server/internal/model"

	"github.com/gin-gonic/gin"
)

type aiPromptPayload struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Content     string `json:"content"`
}

type aiPromptView struct {
	ID          model.Int64String `json:"id"`
	Name        string            `json:"name"`
	Description string            `json:"description"`
	Content     string            `json:"content"`
	ArchivedAt  *time.Time        `json:"archivedAt,omitempty"`
	CreatedAt   time.Time         `json:"createdAt"`
	UpdatedAt   time.Time         `json:"updatedAt"`
}

func normalizeAIPromptPayload(payload aiPromptPayload) (aiPromptPayload, error) {
	payload.Name = strings.TrimSpace(payload.Name)
	payload.Description = strings.TrimSpace(payload.Description)
	payload.Content = strings.TrimSpace(payload.Content)
	if payload.Name == "" || len([]rune(payload.Name)) > 20 {
		return aiPromptPayload{}, errors.New("提示词名称不能为空且不能超过 20 个字符")
	}
	if len([]rune(payload.Description)) > 50 {
		return aiPromptPayload{}, errors.New("提示词说明不能超过 50 个字符")
	}
	if payload.Content == "" {
		return aiPromptPayload{}, errors.New("提示词不能为空")
	}
	return payload, nil
}

func viewAIPrompt(prompt model.AIPrompt) aiPromptView {
	return aiPromptView{ID: prompt.ID, Name: prompt.Name, Description: prompt.Description, Content: prompt.Content, ArchivedAt: prompt.ArchivedAt, CreatedAt: prompt.CreatedAt, UpdatedAt: prompt.UpdatedAt}
}

func loadOwnedAIPrompt(c *gin.Context, userID model.Int64String) (model.AIPrompt, bool) {
	id, err := parsePathInt64(c, "promptId")
	if err != nil || id <= 0 {
		Error(c, http.StatusBadRequest, "无效的提示词 ID")
		return model.AIPrompt{}, false
	}
	var prompt model.AIPrompt
	if err := database.GetDB().Where("id = ? AND user_id = ?", id, userID).First(&prompt).Error; err != nil {
		Error(c, http.StatusNotFound, "提示词不存在")
		return model.AIPrompt{}, false
	}
	return prompt, true
}

func ListAIPrompts(c *gin.Context) {
	userID, ok := currentAIAppUser(c)
	if !ok {
		return
	}
	query := database.GetDB().Where("user_id = ?", userID)
	if c.Query("archived") != "true" {
		query = query.Where("archived_at IS NULL")
	}
	var prompts []model.AIPrompt
	if err := query.Order("updated_at DESC").Find(&prompts).Error; err != nil {
		Error(c, http.StatusInternalServerError, "加载提示词失败")
		return
	}
	list := make([]aiPromptView, 0, len(prompts))
	for _, prompt := range prompts {
		list = append(list, viewAIPrompt(prompt))
	}
	Success(c, gin.H{"list": list})
}

func CreateAIPrompt(c *gin.Context) {
	userID, ok := currentAIAppUser(c)
	if !ok {
		return
	}
	var payload aiPromptPayload
	if c.ShouldBindJSON(&payload) != nil {
		Error(c, http.StatusBadRequest, "提示词参数无效")
		return
	}
	payload, err := normalizeAIPromptPayload(payload)
	if err != nil {
		Error(c, http.StatusBadRequest, err.Error())
		return
	}
	prompt := model.AIPrompt{UserID: userID, Name: payload.Name, Description: payload.Description, Content: payload.Content}
	if err := database.GetDB().Create(&prompt).Error; err != nil {
		Error(c, http.StatusInternalServerError, "创建提示词失败")
		return
	}
	Success(c, viewAIPrompt(prompt))
}

func GetAIPrompt(c *gin.Context) {
	userID, ok := currentAIAppUser(c)
	if !ok {
		return
	}
	prompt, found := loadOwnedAIPrompt(c, userID)
	if !found {
		return
	}
	Success(c, viewAIPrompt(prompt))
}

func UpdateAIPrompt(c *gin.Context) {
	userID, ok := currentAIAppUser(c)
	if !ok {
		return
	}
	prompt, found := loadOwnedAIPrompt(c, userID)
	if !found {
		return
	}
	if prompt.ArchivedAt != nil {
		Error(c, http.StatusBadRequest, "已归档提示词不能修改")
		return
	}
	var payload aiPromptPayload
	if c.ShouldBindJSON(&payload) != nil {
		Error(c, http.StatusBadRequest, "提示词参数无效")
		return
	}
	payload, err := normalizeAIPromptPayload(payload)
	if err != nil {
		Error(c, http.StatusBadRequest, err.Error())
		return
	}
	if err := database.GetDB().Model(&prompt).Updates(map[string]any{"name": payload.Name, "description": payload.Description, "content": payload.Content}).Error; err != nil {
		Error(c, http.StatusInternalServerError, "保存提示词失败")
		return
	}
	if err := database.GetDB().Where("id = ?", prompt.ID).First(&prompt).Error; err != nil {
		Error(c, http.StatusInternalServerError, "读取保存后的提示词失败")
		return
	}
	Success(c, viewAIPrompt(prompt))
}

func ArchiveAIPrompt(c *gin.Context) {
	userID, ok := currentAIAppUser(c)
	if !ok {
		return
	}
	prompt, found := loadOwnedAIPrompt(c, userID)
	if !found {
		return
	}
	if prompt.ArchivedAt == nil {
		now := time.Now()
		if err := database.GetDB().Model(&prompt).Update("archived_at", now).Error; err != nil {
			Error(c, http.StatusInternalServerError, "归档提示词失败")
			return
		}
	}
	Success(c, nil)
}
