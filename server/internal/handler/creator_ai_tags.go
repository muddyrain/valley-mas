package handler

import (
	"fmt"
	"os"
	"strings"
	"time"

	"valley-server/internal/database"
	"valley-server/internal/model"
	"valley-server/internal/utils"

	"github.com/gin-gonic/gin"
	"github.com/volcengine/volcengine-go-sdk/service/arkruntime"
)

// SuggestResourceTags 根据图片 base64 + 类型 + 标题，使用 AI 推荐标签并自动创建不存在的标签
// POST /creator/ai/suggest-tags
// Body: { "imageBase64": "data:image/jpeg;base64,...", "type": "wallpaper", "title": "童年小悟空" }
func SuggestResourceTags(c *gin.Context) {
	var req struct {
		ImageBase64 string `json:"imageBase64"` // 可选：有图时用视觉模型
		Type        string `json:"type"`        // wallpaper / avatar
		Title       string `json:"title"`       // 资源标题，辅助 AI 判断
		Description string `json:"description"` // 可选描述
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		Error(c, 400, "参数错误："+err.Error())
		return
	}

	apiKey := strings.TrimSpace(os.Getenv("ARK_API_KEY"))
	if apiKey == "" {
		Error(c, 503, "AI 功能未配置（缺少 ARK_API_KEY）")
		return
	}
	visionModel := strings.TrimSpace(os.Getenv("ARK_VISION_MODEL"))
	textModel := strings.TrimSpace(os.Getenv("ARK_TEXT_MODEL"))
	hasImage := strings.HasPrefix(req.ImageBase64, "data:") || req.ImageBase64 != ""
	useVision := hasImage && strings.HasPrefix(visionModel, "ep-")
	useText := !useVision && strings.HasPrefix(textModel, "ep-")
	if !useVision && !useText {
		Error(c, 503, "AI 功能未配置（ARK_VISION_MODEL 或 ARK_TEXT_MODEL 须以 ep- 开头）")
		return
	}
	activeModel := visionModel
	if !useVision {
		activeModel = textModel
	}

	db := database.GetDB()

	// 读取系统全量标签
	var allTags []model.ResourceTag
	if err := db.Where("deleted_at IS NULL").Order("resource_count DESC").Find(&allTags).Error; err != nil {
		Error(c, 500, "获取标签列表失败")
		return
	}

	tagNames := make([]string, 0, len(allTags))
	for _, t := range allTags {
		tagNames = append(tagNames, t.Name)
	}

	resourceType := map[string]string{
		"wallpaper": "壁纸",
		"avatar":    "头像",
	}[req.Type]
	if resourceType == "" {
		resourceType = req.Type
		if resourceType == "" {
			resourceType = "图片"
		}
	}

	titleHint := ""
	if t := strings.TrimSpace(req.Title); t != "" {
		titleHint = fmt.Sprintf("标题：%s。", t)
	}
	descHint := ""
	if d := strings.TrimSpace(req.Description); d != "" {
		descHint = fmt.Sprintf("描述：%s。", d)
	}

	var prompt string
	if len(tagNames) > 0 {
		candidateStr := strings.Join(tagNames, "\n")
		prompt = fmt.Sprintf(
			"你是图片标签专家。%s%s类型：%s。\n"+
				"优先从以下候选标签中选 1-5 个最匹配的；若候选标签不够准确，可额外补充 1-2 个新标签（每个不超过 6 字）。\n"+
				"只输出标签名，每行一个，不要编号，不要解释，不要输出候选列表以外的多余文字。\n"+
				"候选标签（每行一个）：\n%s",
			titleHint, descHint, resourceType, candidateStr,
		)
	} else {
		prompt = fmt.Sprintf(
			"你是图片标签专家。%s%s类型：%s。\n"+
				"为该资源生成 1-5 个最合适的标签（每个不超过 6 字）。\n"+
				"只输出标签名，每行一个，不要编号，不要解释。",
			titleHint, descHint, resourceType,
		)
	}

	// 准备图片 URL（base64 或空）
	imageURL := ""
	if hasImage {
		imageURL = req.ImageBase64
		if !strings.HasPrefix(imageURL, "data:") {
			imageURL = "data:image/jpeg;base64," + imageURL
		}
	}

	// 初始化 ARK 客户端（复用单例）
	arkBaseURL := strings.TrimSpace(os.Getenv("ARK_BASE_URL"))
	if arkBaseURL == "" {
		arkBaseURL = "https://ark.cn-beijing.volces.com/api/v3"
	}
	arkClientOnce.Do(func() {
		arkClient = arkruntime.NewClientWithApiKey(
			apiKey,
			arkruntime.WithBaseUrl(arkBaseURL),
			arkruntime.WithTimeout(60*time.Second),
		)
	})

	rawText, aiErr := callChatStream(arkClient, activeModel, imageURL, prompt, useVision)
	if aiErr != nil {
		Error(c, 502, "AI 服务请求失败："+aiErr.Error())
		return
	}

	// 解析 AI 返回：匹配已有 + 自动创建不存在的
	matchedTags, newTagNames := parseAndMatchTagsWithNew(rawText, allTags)

	for _, name := range newTagNames {
		newTag := model.ResourceTag{
			ID:   model.Int64String(utils.GenerateID()),
			Name: name,
		}
		if err := db.Create(&newTag).Error; err != nil {
			// 并发重名时回退查已有记录
			var existing model.ResourceTag
			if db.Where("name = ? AND deleted_at IS NULL", name).First(&existing).Error == nil {
				matchedTags = append(matchedTags, existing)
			}
		} else {
			matchedTags = append(matchedTags, newTag)
		}
	}

	if len(matchedTags) == 0 {
		Error(c, 200, "AI 未能匹配或生成合适的标签，请手动选择")
		return
	}

	Success(c, gin.H{
		"tags":  matchedTags,
		"model": activeModel,
	})
}
