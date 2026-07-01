package lifetrace

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"time"
	"valley-server/internal/aiusage"
	"valley-server/internal/database"
	prompts "valley-server/internal/lifetrace/ai/prompts"
	"valley-server/internal/model"

	"github.com/gin-gonic/gin"
)

const lifeTraceRecipeMaxTokens = prompts.RecipeSuggestionMaxTokens

type recipeSuggestionRequest struct {
	Meal       string `json:"meal"`
	Servings   int    `json:"servings"`
	MaxMinutes int    `json:"maxMinutes"`
}

type recipeSuggestionResponse struct {
	Summary       string                 `json:"summary"`
	Recipes       []recipeSuggestionItem `json:"recipes"`
	Warnings      []string               `json:"warnings"`
	HouseholdID   model.Int64String      `json:"householdId,omitempty"`
	HouseholdName string                 `json:"householdName,omitempty"`
	Source        string                 `json:"source"`
	Model         string                 `json:"model,omitempty"`
}

type recipeSuggestionItem = prompts.RecipeSuggestionItem

type recipeSuggestionAIResponse = prompts.RecipeSuggestionOutput

type recipePantryContext struct {
	UsableItems  []model.LifeTracePantryItem
	ExpiredItems []model.LifeTracePantryItem
}

func (h *Handler) GenerateRecipeSuggestions(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, apiResponse{Code: http.StatusUnauthorized, Message: "未登录"})
		return
	}

	var req recipeSuggestionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, apiResponse{Code: http.StatusBadRequest, Message: "请求内容不正确"})
		return
	}

	householdCtx, ok := readHouseholdContext(c, userID)
	if !ok {
		return
	}

	pantryCtx, err := loadRecipePantryContext(householdCtx.Household.ID, time.Now())
	if err != nil {
		c.JSON(http.StatusOK, apiResponse{Code: http.StatusInternalServerError, Message: "获取库存失败"})
		return
	}

	if len(pantryCtx.UsableItems) == 0 {
		success(c, recipeSuggestionResponse{
			Summary:       "当前没有可用于菜谱的食品库存，可以先去 Pantry 补充食材。",
			Recipes:       []recipeSuggestionItem{},
			Warnings:      buildRecipePantryWarnings(pantryCtx),
			HouseholdID:   householdCtx.Household.ID,
			HouseholdName: householdCtx.Household.Name,
			Source:        "local",
		})
		return
	}

	aiCfg, errMsg := readLifeTraceAIConfig()
	if errMsg != "" {
		c.JSON(http.StatusServiceUnavailable, apiResponse{Code: http.StatusServiceUnavailable, Message: errMsg})
		return
	}

	prompt := buildRecipeSuggestionPrompt(req, pantryCtx, time.Now())
	aiCtx, cancel := context.WithTimeout(c.Request.Context(), aiCfg.Timeout)
	aiCtx = aiusage.WithAudit(aiCtx, "life-trace-recipe", userID.String())
	defer cancel()

	raw, modelName, err := callLifeTraceAIWithMaxTokens(aiCtx, aiCfg, prompt, lifeTraceRecipeMaxTokens)
	if err != nil {
		c.JSON(http.StatusBadGateway, apiResponse{Code: http.StatusBadGateway, Message: "AI 菜谱生成失败：" + err.Error()})
		return
	}

	parsed, err := parseRecipeSuggestionAIResponse(raw, req)
	if err != nil {
		c.JSON(http.StatusBadGateway, apiResponse{Code: http.StatusBadGateway, Message: "AI 菜谱解析失败：" + err.Error()})
		return
	}

	modelName = strings.TrimSpace(modelName)
	if modelName == "" {
		modelName = aiCfg.Model
	}
	warnings := append(buildRecipePantryWarnings(pantryCtx), parsed.Warnings...)
	success(c, recipeSuggestionResponse{
		Summary:       parsed.Summary,
		Recipes:       parsed.Recipes,
		Warnings:      normalizeRecipeTextList(warnings, 4, 36),
		HouseholdID:   householdCtx.Household.ID,
		HouseholdName: householdCtx.Household.Name,
		Source:        aiCfg.Source,
		Model:         modelName,
	})
}

func loadRecipePantryContext(householdID model.Int64String, now time.Time) (recipePantryContext, error) {
	var items []model.LifeTracePantryItem
	if err := database.GetDB().
		Where("household_id = ? AND category = ? AND status NOT IN ?", householdID, "食品", []string{"used-up", "discarded"}).
		Order("CASE WHEN expires_at = '' OR expires_at IS NULL THEN 1 ELSE 0 END").
		Order("expires_at ASC").
		Order("updated_at DESC").
		Limit(24).
		Find(&items).Error; err != nil {
		return recipePantryContext{}, err
	}

	today := now.Format("2006-01-02")
	result := recipePantryContext{
		UsableItems:  make([]model.LifeTracePantryItem, 0, len(items)),
		ExpiredItems: []model.LifeTracePantryItem{},
	}
	for _, item := range items {
		expiresAt := normalizePantryDate(item.ExpiresAt)
		if expiresAt != "" && expiresAt < today {
			result.ExpiredItems = append(result.ExpiredItems, item)
			continue
		}
		result.UsableItems = append(result.UsableItems, item)
	}
	return result, nil
}

func buildRecipePantryWarnings(ctx recipePantryContext) []string {
	warnings := []string{"不会自动扣减库存，做完后请手动确认消耗。"}
	if len(ctx.ExpiredItems) > 0 {
		names := make([]string, 0, len(ctx.ExpiredItems))
		for _, item := range ctx.ExpiredItems {
			names = append(names, item.Name)
			if len(names) >= 3 {
				break
			}
		}
		warnings = append(warnings, fmt.Sprintf("已排除过期食材：%s。", strings.Join(names, "、")))
	}
	return warnings
}

func buildRecipeSuggestionPrompt(req recipeSuggestionRequest, pantryCtx recipePantryContext, now time.Time) string {
	servings := normalizeRecipeServings(req.Servings)
	maxMinutes := normalizeRecipeMaxMinutes(req.MaxMinutes)
	meal := normalizeRecipeMeal(req.Meal)
	itemLines := make([]string, 0, len(pantryCtx.UsableItems))
	today := now.Format("2006-01-02")
	for _, item := range pantryCtx.UsableItems {
		expiry := normalizePantryDate(item.ExpiresAt)
		expiryText := "无保质期"
		if expiry != "" {
			expiryText = "到期 " + expiry
			if expiry <= now.AddDate(0, 0, 3).Format("2006-01-02") {
				expiryText += "（优先消耗）"
			}
		}
		itemLines = append(itemLines, fmt.Sprintf("- %s｜%d%s｜%s｜%s｜备注：%s", item.Name, normalizePantryQuantity(item.Quantity), normalizePantryUnit(item.Unit), normalizePantryLocation(item.Location), expiryText, trimRunes(item.Note, 24)))
	}

	return prompts.BuildRecipeSuggestionPrompt(prompts.RecipeSuggestionInput{
		Meal:        meal,
		Servings:    servings,
		MaxMinutes:  maxMinutes,
		Today:       today,
		PantryLines: itemLines,
	})
}

func parseRecipeSuggestionAIResponse(raw string, req recipeSuggestionRequest) (recipeSuggestionAIResponse, error) {
	return prompts.ParseRecipeSuggestionOutput(raw, prompts.RecipeSuggestionNormalizeContext{
		MaxMinutes: normalizeRecipeMaxMinutes(req.MaxMinutes),
		Servings:   normalizeRecipeServings(req.Servings),
	})
}

func normalizeRecipeTextList(items []string, maxItems int, maxRunes int) []string {
	return prompts.NormalizeRecipeTextList(items, maxItems, maxRunes)
}

func normalizeRecipeMeal(meal string) string {
	meal = strings.TrimSpace(meal)
	switch meal {
	case "早餐", "午餐", "晚餐", "加餐":
		return meal
	default:
		return "晚餐"
	}
}

func normalizeRecipeServings(servings int) int {
	if servings <= 0 {
		return 2
	}
	if servings > 12 {
		return 12
	}
	return servings
}

func normalizeRecipeMaxMinutes(maxMinutes int) int {
	if maxMinutes <= 0 {
		return 30
	}
	if maxMinutes < 10 {
		return 10
	}
	if maxMinutes > 180 {
		return 180
	}
	return maxMinutes
}
