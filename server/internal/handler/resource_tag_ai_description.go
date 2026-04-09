package handler

import (
	"fmt"
	"os"
	"strings"
	"time"
	"unicode"

	"github.com/gin-gonic/gin"
	"github.com/volcengine/volcengine-go-sdk/service/arkruntime"
)

// SuggestResourceTagDescription AI 生成标签描述（创作者/管理员）
// POST /creator/ai/suggest-tag-description
// Body: { "name": "二次元" }
func SuggestResourceTagDescription(c *gin.Context) {
	var req struct {
		Name string `json:"name" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		Error(c, 400, "参数错误："+err.Error())
		return
	}

	name := strings.TrimSpace(req.Name)
	if name == "" {
		Error(c, 400, "标签名称不能为空")
		return
	}
	if len([]rune(name)) > 30 {
		Error(c, 400, "标签名称不能超过 30 个字符")
		return
	}

	apiKey := strings.TrimSpace(os.Getenv("ARK_API_KEY"))
	if apiKey == "" {
		Error(c, 503, "AI 功能未配置（缺少 ARK_API_KEY）")
		return
	}

	textModel := strings.TrimSpace(os.Getenv("ARK_TEXT_MODEL"))
	if !strings.HasPrefix(textModel, "ep-") {
		Error(c, 503, "AI 功能未配置（ARK_TEXT_MODEL 需以 ep- 开头）")
		return
	}

	prompt := fmt.Sprintf(
		"你是中文产品标签助手。请为标签「%s」生成一句简短、自然、实用的描述，长度 12-28 字。"+
			"不要浮夸，不要营销口号，不要使用引号，不要分点。只输出描述文本本身。",
		name,
	)

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

	rawText, aiErr := callChatStream(arkClient, textModel, "", prompt, false)
	if aiErr != nil {
		Error(c, 502, "AI 服务请求失败："+aiErr.Error())
		return
	}

	description := normalizeTagDescription(rawText)
	if description == "" {
		description = truncateRunes(name+"相关风格标签", 100)
	}

	Success(c, gin.H{
		"description": description,
		"model":       textModel,
	})
}

func normalizeTagDescription(raw string) string {
	clean := strings.ReplaceAll(raw, "\r", "\n")
	lines := strings.Split(clean, "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		line = strings.TrimLeftFunc(line, func(r rune) bool {
			return unicode.IsDigit(r) || unicode.IsSpace(r) || r == '.' || r == '、' || r == '-' || r == '*'
		})
		line = strings.TrimSpace(line)
		for _, prefix := range []string{"描述：", "描述:", "标签描述：", "标签描述:"} {
			if strings.HasPrefix(line, prefix) {
				line = strings.TrimSpace(strings.TrimPrefix(line, prefix))
			}
		}
		line = strings.Trim(line, "“”\"'。；;")
		line = strings.Join(strings.Fields(line), " ")
		if line == "" {
			continue
		}
		return truncateRunes(line, 100)
	}
	return ""
}
