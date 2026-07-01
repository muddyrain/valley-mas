package lifetrace

import (
	"context"
	"net/http"
	"strings"
	"valley-server/internal/aiusage"
	prompts "valley-server/internal/lifetrace/ai/prompts"
	"valley-server/internal/logger"

	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"
)

const lifeTracePantryDescriptionMaxTokens = prompts.PantryDescriptionMaxTokens

type pantryDescriptionRequest struct {
	Name      string   `json:"name"`
	Category  string   `json:"category"`
	Location  string   `json:"location"`
	Tags      []string `json:"tags"`
	ExpiresAt string   `json:"expiresAt"`
	OpenedAt  string   `json:"openedAt"`
	Note      string   `json:"note"`
}

type pantryDescriptionAIResponse = prompts.PantryDescriptionOutput

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
	return prompts.BuildPantryDescriptionPrompt(prompts.PantryDescriptionInput{
		Name:      req.Name,
		Category:  req.Category,
		Location:  req.Location,
		Tags:      req.Tags,
		ExpiresAt: req.ExpiresAt,
		OpenedAt:  req.OpenedAt,
		Note:      req.Note,
	})
}

func parsePantryDescriptionAIResponse(raw string) (pantryDescriptionAIResponse, error) {
	return prompts.ParsePantryDescriptionOutput(raw)
}

func normalizeDescriptionTips(tips []string) []string {
	return prompts.NormalizePantryDescriptionTips(tips)
}
