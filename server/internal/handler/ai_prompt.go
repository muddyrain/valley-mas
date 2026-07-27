package handler

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"
	"unicode/utf8"

	"valley-server/internal/database"
	"valley-server/internal/model"

	"github.com/gin-gonic/gin"
)

type aiPromptPayload struct {
	Name        string   `json:"name"`
	Description string   `json:"description"`
	Content     string   `json:"content"`
	Tags        []string `json:"tags"`
}

type aiPromptView struct {
	ID            model.Int64String `json:"id"`
	Name          string            `json:"name"`
	Description   string            `json:"description"`
	Content       string            `json:"content"`
	Tags          []string          `json:"tags"`
	SourceURL     string            `json:"sourceUrl,omitempty"`
	SourceAuthor  string            `json:"sourceAuthor,omitempty"`
	SourceLicense string            `json:"sourceLicense,omitempty"`
	ImportedAt    *time.Time        `json:"importedAt,omitempty"`
	ArchivedAt    *time.Time        `json:"archivedAt,omitempty"`
	CreatedAt     time.Time         `json:"createdAt"`
	UpdatedAt     time.Time         `json:"updatedAt"`
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
	tags, err := normalizeAIPromptTags(payload.Tags)
	if err != nil {
		return aiPromptPayload{}, err
	}
	payload.Tags = tags
	return payload, nil
}

func normalizeAIPromptTags(values []string) ([]string, error) {
	result := make([]string, 0, min(len(values), 8))
	seen := make(map[string]struct{}, len(values))
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value == "" {
			continue
		}
		if utf8.RuneCountInString(value) > 20 {
			return nil, errors.New("单个标签不能超过 20 个字符")
		}
		key := strings.ToLower(value)
		if _, exists := seen[key]; exists {
			continue
		}
		seen[key] = struct{}{}
		result = append(result, value)
		if len(result) > 8 {
			return nil, errors.New("最多添加 8 个标签")
		}
	}
	return result, nil
}

func encodeAIPromptTags(tags []string) string {
	if len(tags) == 0 {
		return ""
	}
	encoded, _ := json.Marshal(tags)
	return string(encoded)
}

func decodeAIPromptTags(value string) []string {
	var tags []string
	if json.Unmarshal([]byte(value), &tags) != nil {
		return []string{}
	}
	return tags
}

func viewAIPrompt(prompt model.AIPrompt) aiPromptView {
	return aiPromptView{
		ID: prompt.ID, Name: prompt.Name, Description: prompt.Description, Content: prompt.Content,
		Tags: decodeAIPromptTags(prompt.Tags), SourceURL: prompt.SourceURL, SourceAuthor: prompt.SourceAuthor,
		SourceLicense: prompt.SourceLicense, ImportedAt: prompt.ImportedAt, ArchivedAt: prompt.ArchivedAt,
		CreatedAt: prompt.CreatedAt, UpdatedAt: prompt.UpdatedAt,
	}
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
	prompt := model.AIPrompt{
		UserID: userID, Name: payload.Name, Description: payload.Description,
		Content: payload.Content, Tags: encodeAIPromptTags(payload.Tags),
	}
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
	if err := database.GetDB().Model(&prompt).Updates(map[string]any{
		"name": payload.Name, "description": payload.Description,
		"content": payload.Content, "tags": encodeAIPromptTags(payload.Tags),
	}).Error; err != nil {
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
