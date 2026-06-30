package lifetrace

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"valley-server/internal/aiusage"
	"valley-server/internal/logger"

	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"
)

const lifeTracePantryDescriptionMaxTokens = 480

type pantryDescriptionRequest struct {
	Name      string   `json:"name"`
	Category  string   `json:"category"`
	Location  string   `json:"location"`
	Tags      []string `json:"tags"`
	ExpiresAt string   `json:"expiresAt"`
	OpenedAt  string   `json:"openedAt"`
	Note      string   `json:"note"`
}

type pantryDescriptionAIResponse struct {
	Note string   `json:"note"`
	Tips []string `json:"tips"`
}

func (h *Handler) GeneratePantryDescription(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok || userID == 0 {
		fail(c, http.StatusUnauthorized, "未登录")
		return
	}

	var req pantryDescriptionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		fail(c, http.StatusBadRequest, "请求内容不正确")
		return
	}
	if strings.TrimSpace(req.Name) == "" {
		fail(c, http.StatusBadRequest, "请先填写商品名称再让 AI 帮你润色")
		return
	}

	aiCfg, errMsg := readLifeTraceAIConfig()
	if errMsg != "" {
		fail(c, http.StatusServiceUnavailable, errMsg)
		return
	}

	prompt := buildPantryDescriptionPrompt(req)
	aiCtx, cancel := context.WithTimeout(c.Request.Context(), aiCfg.Timeout)
	aiCtx = aiusage.WithAudit(aiCtx, "life-trace-pantry-description", userID.String())
	defer cancel()

	raw, modelName, err := callLifeTraceAIWithMaxTokens(aiCtx, aiCfg, prompt, lifeTracePantryDescriptionMaxTokens)
	if err != nil {
		logger.Error(c, "LifeTrace pantry description AI call failed", err, logrus.Fields{
			"source": aiCfg.Source,
			"model":  aiCfg.Model,
		})
		fail(c, http.StatusBadGateway, "AI 备注生成失败:"+err.Error())
		return
	}

	parsed, err := parsePantryDescriptionAIResponse(raw)
	if err != nil {
		logger.Error(c, "LifeTrace pantry description AI parse failed", err, logrus.Fields{
			"source": aiCfg.Source,
			"model":  modelName,
		})
		fail(c, http.StatusBadGateway, "AI 备注生成解析失败")
		return
	}

	modelName = strings.TrimSpace(modelName)
	if modelName == "" {
		modelName = aiCfg.Model
	}
	success(c, gin.H{
		"note":     strings.TrimSpace(parsed.Note),
		"tips":     normalizeDescriptionTips(parsed.Tips),
		"source":   aiCfg.Source,
		"model":    modelName,
		"modelTag": buildAIModelTag(aiCfg.Source, modelName),
	})
}

func buildPantryDescriptionPrompt(req pantryDescriptionRequest) string {
	var b strings.Builder
	b.WriteString("你是 Life Trace 的家庭库存助手，任务是为一件库存写一段简短实用的中文备注。\n")
	b.WriteString("输出严格 JSON，字段：note(string, 30-80 字，以储存方式/最佳食用期/常见注意事项为主，语气克制不夸张)，tips(string[], 2-3 条短建议，每条不超过 14 字)。\n\n")
	b.WriteString(fmt.Sprintf("商品名称：%s\n", strings.TrimSpace(req.Name)))
	if v := strings.TrimSpace(req.Category); v != "" {
		b.WriteString(fmt.Sprintf("分类：%s\n", v))
	}
	if v := strings.TrimSpace(req.Location); v != "" {
		b.WriteString(fmt.Sprintf("存放位置：%s\n", v))
	}
	if v := strings.TrimSpace(req.ExpiresAt); v != "" {
		b.WriteString(fmt.Sprintf("过期日：%s\n", v))
	}
	if v := strings.TrimSpace(req.OpenedAt); v != "" {
		b.WriteString(fmt.Sprintf("开封日：%s\n", v))
	}
	if len(req.Tags) > 0 {
		b.WriteString(fmt.Sprintf("标签：%s\n", strings.Join(req.Tags, "、")))
	}
	if v := strings.TrimSpace(req.Note); v != "" {
		b.WriteString(fmt.Sprintf("现有备注（可改写）：%s\n", v))
	}
	b.WriteString("\n只输出 JSON，不要 markdown，不要多余文本。")
	return b.String()
}

func parsePantryDescriptionAIResponse(raw string) (pantryDescriptionAIResponse, error) {
	start := strings.Index(raw, "{")
	end := strings.LastIndex(raw, "}")
	if start < 0 || end <= start {
		return pantryDescriptionAIResponse{}, errors.New("missing JSON object")
	}
	var parsed pantryDescriptionAIResponse
	if err := json.Unmarshal([]byte(raw[start:end+1]), &parsed); err != nil {
		return pantryDescriptionAIResponse{}, err
	}
	if strings.TrimSpace(parsed.Note) == "" && len(parsed.Tips) == 0 {
		return pantryDescriptionAIResponse{}, errors.New("empty AI output")
	}
	return parsed, nil
}

func normalizeDescriptionTips(tips []string) []string {
	result := make([]string, 0, len(tips))
	for _, t := range tips {
		t = strings.TrimSpace(t)
		if t == "" {
			continue
		}
		if len([]rune(t)) > 24 {
			t = string([]rune(t)[:24])
		}
		result = append(result, t)
		if len(result) >= 4 {
			break
		}
	}
	return result
}
