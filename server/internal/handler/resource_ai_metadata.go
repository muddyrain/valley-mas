package handler

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"
	"valley-server/internal/aiclient"
	"valley-server/internal/aimodel"
	"valley-server/internal/database"
	"valley-server/internal/model"

	"github.com/gin-gonic/gin"
)

type suggestedResourceMetadata struct {
	Title string           `json:"title"`
	Tags  model.StringList `json:"tags"`
}

// SuggestResourceMetadata generates a title and tags in one vision request.
// POST /api/v1/content/ai/resource-metadata/suggest
func SuggestResourceMetadata(c *gin.Context) {
	var req struct {
		ImageBase64 string `json:"imageBase64" binding:"required"`
		Type        string `json:"type"`
		ModelID     string `json:"modelId" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		Error(c, 400, "参数错误：需要图片和视觉模型")
		return
	}

	resourceType := "壁纸"
	if req.Type == "avatar" {
		resourceType = "头像"
	}
	prompt := fmt.Sprintf("分析这张%s，只输出严格 JSON：{\"title\":\"一个不超过20字的中文标题\",\"tags\":[\"5至8个中文标签\"]}。标签覆盖题材、风格、情绪与画面元素，每项不超过6字；不要编号、Markdown或解释。", resourceType)
	imageURL := strings.TrimSpace(req.ImageBase64)
	if !strings.HasPrefix(imageURL, "data:") {
		imageURL = "data:image/jpeg;base64," + imageURL
	}

	start := time.Now()
	invocation, err := aimodel.ResolveInvocation(database.GetDB(), req.ModelID, "vision", 35*time.Second)
	if err != nil {
		recordResourceAIUsage(c, aiclient.FeatureResourceMetadata, "", req.ModelID, prompt, "", aiclient.CompatibleUsage{}, start, err)
		respondCatalogModelError(c, err)
		return
	}
	response, err := invocation.Client.Chat(c.Request.Context(), aiclient.CompatibleChatRequest{
		Model: invocation.Model.ModelID,
		Messages: []aiclient.CompatibleMessage{{
			Role: "user",
			Content: []map[string]any{
				{"type": "image_url", "image_url": map[string]string{"url": imageURL}},
				{"type": "text", "text": prompt},
			},
		}},
	})
	actualModel := invocation.Model.ModelID
	rawText := ""
	if err == nil && len(response.Choices) == 0 {
		err = errors.New("AI 未返回候选结果")
	}
	if err == nil {
		actualModel = modelNameOrFallback(response.Model, invocation.Model.ModelID)
		rawText = compatibleMessageText(response.Choices[0].Message.Content)
	}
	if err != nil {
		recordResourceAIUsage(c, aiclient.FeatureResourceMetadata, invocation.Provider.Provider, actualModel, prompt, rawText, response.Usage, start, err)
		Error(c, 502, "AI 服务请求失败："+err.Error())
		return
	}

	metadata, err := parseSuggestedResourceMetadata(rawText)
	if err != nil {
		recordResourceAIUsage(c, aiclient.FeatureResourceMetadata, invocation.Provider.Provider, actualModel, prompt, rawText, response.Usage, start, err)
		Error(c, 502, "AI 未返回有效的标题和标签")
		return
	}
	recordResourceAIUsage(c, aiclient.FeatureResourceMetadata, invocation.Provider.Provider, actualModel, prompt, rawText, response.Usage, start, nil)
	Success(c, gin.H{
		"title": metadata.Title, "tags": metadata.Tags,
		"model": actualModel, "provider": invocation.Provider.Provider,
	})
}

func parseSuggestedResourceMetadata(rawText string) (suggestedResourceMetadata, error) {
	var raw struct {
		Title string   `json:"title"`
		Tags  []string `json:"tags"`
	}
	object := strings.TrimSpace(aiclient.ExtractJSONObject(rawText))
	if object == "" || json.Unmarshal([]byte(object), &raw) != nil {
		return suggestedResourceMetadata{}, errors.New("AI metadata JSON is invalid")
	}
	title := truncateRunes(raw.Title, 20)
	filteredTags := make([]string, 0, 8)
	for _, tag := range normalizeResourceTagNames(raw.Tags) {
		if len([]rune(tag)) <= 10 {
			filteredTags = append(filteredTags, tag)
		}
		if len(filteredTags) == 8 {
			break
		}
	}
	if title == "" || len(filteredTags) == 0 {
		return suggestedResourceMetadata{}, errors.New("AI metadata is incomplete")
	}
	return suggestedResourceMetadata{Title: title, Tags: model.StringList(filteredTags)}, nil
}
