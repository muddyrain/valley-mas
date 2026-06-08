package lifetrace

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"
	"valley-server/internal/aiusage"
	"valley-server/internal/database"
	"valley-server/internal/model"

	"github.com/gin-gonic/gin"
)

const lifeTraceRecipeMaxTokens = 720

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

type recipeSuggestionItem struct {
	ID           string   `json:"id"`
	Title        string   `json:"title"`
	Reason       string   `json:"reason"`
	UsedItems    []string `json:"usedItems"`
	MissingItems []string `json:"missingItems"`
	TimeMinutes  int      `json:"timeMinutes"`
	Difficulty   string   `json:"difficulty"`
	Servings     int      `json:"servings"`
	Steps        []string `json:"steps"`
	Tags         []string `json:"tags"`
	PlanTitle    string   `json:"planTitle"`
	PlanNote     string   `json:"planNote"`
}

type recipeSuggestionAIResponse struct {
	Summary  string                 `json:"summary"`
	Recipes  []recipeSuggestionItem `json:"recipes"`
	Warnings []string               `json:"warnings"`
}

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

	return strings.Join([]string{
		"你是 Life Trace 的库存优先菜谱 AI，只输出一个 JSON 对象，不要 Markdown，不要解释。",
		"目标：优先消耗 Pantry 中临期或已有食品，给出 2 到 3 个家常菜谱；不要使用过期食材，不给医疗或营养治疗建议。",
		"JSON 格式：{\"summary\":\"一句总结，40字以内\",\"recipes\":[{\"title\":\"菜名\",\"reason\":\"推荐原因，48字以内\",\"usedItems\":[\"库存食材\"],\"missingItems\":[\"缺少食材，可为空\"],\"timeMinutes\":20,\"difficulty\":\"简单|中等\",\"servings\":2,\"steps\":[\"步骤1\"],\"tags\":[\"临期优先\"],\"planTitle\":\"晚餐计划标题\",\"planNote\":\"加入计划时的备注，80字以内\"}],\"warnings\":[\"需要用户确认的风险\"]}",
		"recipes 最多 3 个；每个 steps 3 到 5 步；usedItems 必须来自库存清单；missingItems 只能放常见辅料或可省略材料。",
		"如果库存不足，以“少买/可省略”为原则，不要凭空假设用户有昂贵或复杂食材。",
		"",
		fmt.Sprintf("今天日期：%s；餐次：%s；人数：%d；期望烹饪时间：%d 分钟以内。", today, meal, servings, maxMinutes),
		"",
		"可用食品库存：",
		strings.Join(itemLines, "\n"),
	}, "\n")
}

func parseRecipeSuggestionAIResponse(raw string, req recipeSuggestionRequest) (recipeSuggestionAIResponse, error) {
	raw = strings.TrimSpace(raw)
	start := strings.Index(raw, "{")
	end := strings.LastIndex(raw, "}")
	if start < 0 || end <= start {
		return recipeSuggestionAIResponse{}, errors.New("missing JSON object")
	}

	var parsed recipeSuggestionAIResponse
	if err := json.Unmarshal([]byte(raw[start:end+1]), &parsed); err != nil {
		return recipeSuggestionAIResponse{}, err
	}

	parsed.Summary = trimRunes(parsed.Summary, 48)
	if parsed.Summary == "" {
		parsed.Summary = "已按临期库存优先生成菜谱建议。"
	}
	parsed.Warnings = normalizeRecipeTextList(parsed.Warnings, 3, 36)
	parsed.Recipes = normalizeRecipeSuggestions(parsed.Recipes, req)
	if len(parsed.Recipes) == 0 {
		return recipeSuggestionAIResponse{}, errors.New("empty recipes")
	}
	return parsed, nil
}

func normalizeRecipeSuggestions(items []recipeSuggestionItem, req recipeSuggestionRequest) []recipeSuggestionItem {
	maxMinutes := normalizeRecipeMaxMinutes(req.MaxMinutes)
	servings := normalizeRecipeServings(req.Servings)
	result := make([]recipeSuggestionItem, 0, 3)
	seen := map[string]bool{}
	for _, item := range items {
		title := trimRunes(item.Title, 24)
		if title == "" || seen[title] {
			continue
		}
		seen[title] = true

		item.ID = fmt.Sprintf("recipe-%d", len(result)+1)
		item.Title = title
		item.Reason = trimRunes(item.Reason, 56)
		if item.Reason == "" {
			item.Reason = "优先使用现有库存，减少临期浪费。"
		}
		item.UsedItems = normalizeRecipeTextList(item.UsedItems, 5, 16)
		item.MissingItems = normalizeRecipeTextList(item.MissingItems, 4, 16)
		item.TimeMinutes = item.TimeMinutes
		if item.TimeMinutes <= 0 || item.TimeMinutes > 180 {
			item.TimeMinutes = maxMinutes
		}
		item.Difficulty = normalizeRecipeDifficulty(item.Difficulty)
		item.Servings = item.Servings
		if item.Servings <= 0 || item.Servings > 12 {
			item.Servings = servings
		}
		item.Steps = normalizeRecipeTextList(item.Steps, 5, 42)
		if len(item.Steps) == 0 {
			item.Steps = []string{"处理库存食材。", "按常规家常做法烹调。", "出锅前确认味道和食材状态。"}
		}
		item.Tags = normalizeRecipeTextList(item.Tags, 4, 12)
		if len(item.Tags) == 0 {
			item.Tags = []string{"库存优先"}
		}
		item.PlanTitle = trimRunes(item.PlanTitle, 30)
		if item.PlanTitle == "" {
			item.PlanTitle = item.Title
		}
		item.PlanNote = trimRunes(item.PlanNote, 96)
		if item.PlanNote == "" {
			item.PlanNote = "来自 AI 智能菜谱，做完后请手动确认库存消耗。"
		}
		result = append(result, item)
		if len(result) >= 3 {
			break
		}
	}
	return result
}

func normalizeRecipeTextList(items []string, maxItems int, maxRunes int) []string {
	result := make([]string, 0, maxItems)
	seen := map[string]bool{}
	for _, item := range items {
		item = trimRunes(item, maxRunes)
		if item == "" || seen[item] {
			continue
		}
		seen[item] = true
		result = append(result, item)
		if len(result) >= maxItems {
			break
		}
	}
	return result
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

func normalizeRecipeDifficulty(value string) string {
	value = strings.TrimSpace(value)
	if value == "中等" {
		return value
	}
	return "简单"
}
