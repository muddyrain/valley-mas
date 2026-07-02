package handler

import (
	"fmt"
	"strings"
	"time"
	"unicode"

	"valley-server/internal/aiclient"

	"github.com/gin-gonic/gin"
)

// SuggestResourceTags 根据图片 base64 + 类型 + 标题在线生成候选标签
// POST /creator/ai/suggest-tags
// Body: { "imageBase64": "data:image/jpeg;base64,...", "type": "wallpaper", "title": "童年小悟空", "description": "" }
// Response: { "tags": ["国风", "水墨"], "model": "ep-xxx" }
//
// 不再依赖 resource_tags 表：AI 直接生成 5-8 个候选标签名交给前端，由用户勾选后写入 resources.tags。
func SuggestResourceTags(c *gin.Context) {
	var req struct {
		ImageBase64 string `json:"imageBase64"` // 可选：有图时用视觉模型
		Type        string `json:"type"`        // wallpaper / avatar
		Title       string `json:"title"`
		Description string `json:"description"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		Error(c, 400, "参数错误："+err.Error())
		return
	}

	visionCfg, errMsg := aiclient.ReadARKVisionConfig()
	if errMsg != "" {
		Error(c, 503, errMsg)
		return
	}
	hasImage := strings.HasPrefix(req.ImageBase64, "data:") || strings.TrimSpace(req.ImageBase64) != ""
	useVision := hasImage && visionCfg.UseVision

	resourceType := map[string]string{
		"wallpaper": "壁纸",
		"avatar":    "头像",
	}[req.Type]
	if resourceType == "" {
		resourceType = strings.TrimSpace(req.Type)
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

	prompt := fmt.Sprintf(
		"你是图片标签专家。%s%s类型：%s。\n"+
			"请为该资源生成 5-8 个最合适的中文标签，覆盖题材/风格/情绪/画面元素。\n"+
			"每个标签不超过 6 个字，禁止英文、禁止标点符号、禁止重复。\n"+
			"只输出标签名，每行一个，不要编号，不要解释。",
		titleHint, descHint, resourceType,
	)

	imageURL := ""
	if useVision {
		imageURL = req.ImageBase64
		if !strings.HasPrefix(imageURL, "data:") {
			imageURL = "data:image/jpeg;base64," + imageURL
		}
	}

	client := aiclient.ARKClient(60 * time.Second)
	if client == nil {
		Error(c, 503, "AI 未配置：缺少 ARK_API_KEY")
		return
	}

	rawText, aiErr := callChatStream(client, visionCfg.Config.Model, imageURL, prompt, useVision)
	if aiErr != nil {
		Error(c, 502, "AI 服务请求失败："+aiErr.Error())
		return
	}

	tags := parseAIGeneratedTagNames(rawText, 8)
	if len(tags) == 0 {
		Error(c, 200, "AI 未能生成合适的标签，请手动输入")
		return
	}

	Success(c, gin.H{
		"tags":  tags,
		"model": visionCfg.Config.Model,
	})
}

// parseAIGeneratedTagNames 解析 AI 输出的每行标签名并做基础清洗，最多返回 max 个。
// 清洗规则：
//   - 去掉行首序号/项目符号
//   - 去掉括号内注释
//   - 去掉两端引号
//   - 长度超过 10 字（大概率是废话）直接丢弃
//   - 大小写去重（保留首次出现的原始大小写）
func parseAIGeneratedTagNames(rawText string, max int) []string {
	if max <= 0 {
		max = 8
	}
	lines := strings.Split(rawText, "\n")
	seen := make(map[string]bool, len(lines))
	tags := make([]string, 0, max)

	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		runes := []rune(line)
		start := 0
		for start < len(runes) {
			r := runes[start]
			if unicode.IsDigit(r) || r == '.' || r == '、' || r == '·' || r == '•' || r == '-' || r == '*' || r == ' ' || r == '\t' {
				start++
				continue
			}
			break
		}
		line = strings.TrimSpace(string(runes[start:]))
		for _, sep := range []string{"（", "(", "【", " -", " —"} {
			if idx := strings.Index(line, sep); idx > 0 {
				line = strings.TrimSpace(line[:idx])
			}
		}
		line = strings.Trim(line, "\"'“”'")
		if line == "" {
			continue
		}
		if len([]rune(line)) > 10 {
			continue
		}
		key := strings.ToLower(line)
		if seen[key] {
			continue
		}
		seen[key] = true
		tags = append(tags, line)
		if len(tags) >= max {
			break
		}
	}
	return tags
}
