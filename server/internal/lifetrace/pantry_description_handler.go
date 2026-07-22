package lifetrace

import (
	"net/http"
	"strings"
	"time"
	"valley-server/internal/aiusage"
	prompts "valley-server/internal/lifetrace/ai/prompts"
	"valley-server/internal/logger"

	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"
)

const lifeTracePantryDescriptionMaxTokens = prompts.PantryDescriptionMaxTokens

type pantryDescriptionRequest struct {
	ModelID   string   `json:"modelId" binding:"required"`
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

	invocation, ok := resolveLifeTraceCatalogInvocation(c, req.ModelID, "text", 45*time.Second)
	if !ok {
		return
	}

	prompt := buildPantryDescriptionPrompt(req)
	aiCtx := aiusage.WithAudit(c.Request.Context(), "life-trace-pantry-description", userID.String())
	raw, modelName, err := callLifeTraceCatalogJSON(aiCtx, invocation, prompt, lifeTracePantryDescriptionMaxTokens)
	if err != nil {
		logger.Error(c, "LifeTrace pantry description AI call failed", err, logrus.Fields{
			"source": invocation.Provider.Provider,
			"model":  invocation.Model.ModelID,
		})
		fail(c, http.StatusBadGateway, "AI 备注生成失败:"+err.Error())
		return
	}

	parsed, err := parsePantryDescriptionAIResponse(raw)
	if err != nil {
		logger.Error(c, "LifeTrace pantry description AI parse failed", err, logrus.Fields{
			"source": invocation.Provider.Provider,
			"model":  modelName,
		})
		fail(c, http.StatusBadGateway, "AI 备注生成解析失败")
		return
	}

	modelName = strings.TrimSpace(modelName)
	if modelName == "" {
		modelName = invocation.Model.ModelID
	}
	success(c, gin.H{
		"note":     strings.TrimSpace(parsed.Note),
		"tips":     normalizeDescriptionTips(parsed.Tips),
		"source":   invocation.Provider.Provider,
		"model":    modelName,
		"modelTag": buildAIModelTag(invocation.Provider.Provider, modelName),
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
