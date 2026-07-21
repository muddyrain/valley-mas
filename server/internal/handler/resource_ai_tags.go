package handler

import (
	"errors"
	"fmt"
	"strings"
	"time"
	"unicode"
	"valley-server/internal/aiclient"
	"valley-server/internal/aimodel"
	"valley-server/internal/database"

	"github.com/gin-gonic/gin"
)

// SuggestResourceTags generates resource tag candidates with a selected catalog model.
// Images require a vision model; title/description-only requests require a text model.
func SuggestResourceTags(c *gin.Context) {
	var req struct {
		ImageBase64 string `json:"imageBase64"`
		Type        string `json:"type"`
		Title       string `json:"title"`
		Description string `json:"description"`
		ModelID     string `json:"modelId" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		Error(c, 400, "参数错误：需要模型")
		return
	}

	hasImage := strings.TrimSpace(req.ImageBase64) != ""
	capability := "text"
	if hasImage {
		capability = "vision"
	}
	resourceType := map[string]string{"wallpaper": "壁纸", "avatar": "头像"}[req.Type]
	if resourceType == "" {
		resourceType = strings.TrimSpace(req.Type)
		if resourceType == "" {
			resourceType = "图片"
		}
	}
	prompt := fmt.Sprintf("你是图片标签专家。标题：%s。描述：%s。类型：%s。请生成 5-8 个最合适的中文标签，覆盖题材、风格、情绪和画面元素。每个标签不超过 6 个字，禁止英文、标点、重复。只输出标签名，每行一个，不要编号或解释。", strings.TrimSpace(req.Title), strings.TrimSpace(req.Description), resourceType)

	start := time.Now()
	invocation, err := aimodel.ResolveInvocation(database.GetDB(), req.ModelID, capability, 60*time.Second)
	if err != nil {
		recordResourceAIUsage(c, aiclient.FeatureResourceTags, "", req.ModelID, prompt, "", aiclient.CompatibleUsage{}, start, err)
		respondCatalogModelError(c, err)
		return
	}
	content := any(prompt)
	if hasImage {
		imageURL := strings.TrimSpace(req.ImageBase64)
		if !strings.HasPrefix(imageURL, "data:") {
			imageURL = "data:image/jpeg;base64," + imageURL
		}
		content = []map[string]any{
			{"type": "image_url", "image_url": map[string]string{"url": imageURL}},
			{"type": "text", "text": prompt},
		}
	}
	response, err := invocation.Client.Chat(c.Request.Context(), aiclient.CompatibleChatRequest{Model: invocation.Model.ModelID, Messages: []aiclient.CompatibleMessage{{Role: "user", Content: content}}})
	actualModel := invocation.Model.ModelID
	rawText := ""
	if err == nil {
		actualModel = modelNameOrFallback(response.Model, invocation.Model.ModelID)
		rawText = compatibleMessageText(response.Choices[0].Message.Content)
	}
	if err != nil {
		recordResourceAIUsage(c, aiclient.FeatureResourceTags, invocation.Provider.Provider, actualModel, prompt, rawText, response.Usage, start, err)
		Error(c, 502, "AI 服务请求失败："+err.Error())
		return
	}

	tags := parseAIGeneratedTagNames(rawText, 8)
	if len(tags) == 0 {
		recordResourceAIUsage(c, aiclient.FeatureResourceTags, invocation.Provider.Provider, actualModel, prompt, rawText, response.Usage, start, errors.New("AI 未能生成合适的标签"))
		Error(c, 502, "AI 未能生成合适的标签，请手动输入")
		return
	}
	recordResourceAIUsage(c, aiclient.FeatureResourceTags, invocation.Provider.Provider, actualModel, prompt, rawText, response.Usage, start, nil)
	Success(c, gin.H{"tags": tags, "model": actualModel, "provider": invocation.Provider.Provider})
}

// parseAIGeneratedTagNames parses generated tag lines and returns up to max values.
func parseAIGeneratedTagNames(rawText string, max int) []string {
	if max <= 0 {
		max = 8
	}
	seen := make(map[string]bool)
	tags := make([]string, 0, max)
	for _, line := range strings.Split(rawText, "\n") {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		runes := []rune(line)
		start := 0
		for start < len(runes) && (unicode.IsDigit(runes[start]) || strings.ContainsRune(".、·•-* \t", runes[start])) {
			start++
		}
		line = strings.TrimSpace(string(runes[start:]))
		for _, sep := range []string{"（", "(", "【", " -", " —"} {
			if index := strings.Index(line, sep); index > 0 {
				line = strings.TrimSpace(line[:index])
			}
		}
		line = strings.Trim(line, "\"'“”'")
		if line == "" || len([]rune(line)) > 10 {
			continue
		}
		key := strings.ToLower(line)
		if seen[key] {
			continue
		}
		seen[key] = true
		tags = append(tags, line)
		if len(tags) == max {
			break
		}
	}
	return tags
}
