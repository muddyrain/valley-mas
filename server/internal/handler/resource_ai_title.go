package handler

import (
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"
	"valley-server/internal/aiclient"
	"valley-server/internal/aimodel"
	"valley-server/internal/aiusage"
	"valley-server/internal/database"

	"github.com/gin-gonic/gin"
)

// SuggestResourceTitle uses a selected catalog vision model to suggest resource titles.
// POST /api/v1/content/ai/suggest-title
// Body: { "imageBase64": "data:image/jpeg;base64,...", "type": "wallpaper", "modelId": "12" }
func SuggestResourceTitle(c *gin.Context) {
	var req struct {
		ImageBase64 string `json:"imageBase64" binding:"required"`
		Type        string `json:"type"`
		ModelID     string `json:"modelId" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		Error(c, 400, "参数错误：需要图片和视觉模型")
		return
	}

	typeHint := "壁纸"
	if req.Type == "avatar" {
		typeHint = "头像"
	}
	prompt := fmt.Sprintf("看图，给这张%s起 2-5 个中文名。只输出名字，每行一个；不要编号、解释或标点。若能识别 IP 角色，请体现在名称内。", typeHint)
	imageURL := strings.TrimSpace(req.ImageBase64)
	if !strings.HasPrefix(imageURL, "data:") {
		imageURL = "data:image/jpeg;base64," + imageURL
	}

	start := time.Now()
	invocation, err := aimodel.ResolveInvocation(database.GetDB(), req.ModelID, "vision", 25*time.Second)
	if err != nil {
		recordResourceAIUsage(c, aiclient.FeatureResourceTitle, "", req.ModelID, prompt, "", aiclient.CompatibleUsage{}, start, err)
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
	if err == nil {
		actualModel = modelNameOrFallback(response.Model, invocation.Model.ModelID)
		rawText = compatibleMessageText(response.Choices[0].Message.Content)
	}
	if err != nil {
		recordResourceAIUsage(c, aiclient.FeatureResourceTitle, invocation.Provider.Provider, actualModel, prompt, rawText, response.Usage, start, err)
		Error(c, 502, "AI 服务请求失败："+err.Error())
		return
	}

	titles := parseAIGeneratedTitles(rawText)
	if len(titles) == 0 {
		recordResourceAIUsage(c, aiclient.FeatureResourceTitle, invocation.Provider.Provider, actualModel, prompt, rawText, response.Usage, start, errors.New("AI 未返回有效结果"))
		Error(c, 502, "AI 未返回有效结果")
		return
	}
	recordResourceAIUsage(c, aiclient.FeatureResourceTitle, invocation.Provider.Provider, actualModel, prompt, rawText, response.Usage, start, nil)

	Success(c, gin.H{"titles": titles, "model": actualModel, "provider": invocation.Provider.Provider})
}

func parseAIGeneratedTitles(rawText string) []string {
	cleanChars := []string{"「", "」", "『", "』", "《", "》", "\"", "'", "、", "，", "。", "·", "- ", "* "}
	seen := make(map[string]struct{})
	titles := make([]string, 0, 5)
	for _, line := range strings.Split(rawText, "\n") {
		line = strings.TrimSpace(line)
		line = strings.TrimLeft(line, "0123456789.、-• \t")
		for _, ch := range cleanChars {
			line = strings.ReplaceAll(line, ch, "")
		}
		line = strings.TrimSpace(line)
		if line == "" || len([]rune(line)) > 20 {
			continue
		}
		if _, ok := seen[line]; ok {
			continue
		}
		seen[line] = struct{}{}
		titles = append(titles, line)
		if len(titles) == 5 {
			break
		}
	}
	return titles
}

func respondCatalogModelError(c *gin.Context, err error) {
	if errors.Is(err, aimodel.ErrModelNotAvailable) {
		Error(c, 400, "所选模型不可用或不支持当前能力")
		return
	}
	if strings.Contains(err.Error(), "AI 服务未配置") || strings.Contains(err.Error(), "不支持的 AI Provider") {
		Error(c, 503, err.Error())
		return
	}
	Error(c, 500, "加载 AI 模型失败："+err.Error())
}

func recordResourceAIUsage(c *gin.Context, feature, provider, modelName, prompt, response string, usage aiclient.CompatibleUsage, start time.Time, callErr error) {
	userID := ""
	if id := GetCurrentUserID(c); id > 0 {
		userID = strconv.FormatInt(id, 10)
	}
	status := aiusage.StatusSuccess
	errMessage := ""
	if callErr != nil {
		status = aiusage.StatusFailed
		errMessage = callErr.Error()
	}
	aiusage.Record(aiusage.Entry{
		Feature: feature, Provider: provider, Model: modelName, UserID: userID,
		Status: status, PromptChars: aiusage.CharCount(prompt), ResponseChars: aiusage.CharCount(response),
		PromptTokens: usage.PromptTokens, CompletionTokens: usage.CompletionTokens, TotalTokens: usage.TotalTokens,
		LatencyMs: aiusage.Since(start), ErrorMessage: errMessage,
	})
}
