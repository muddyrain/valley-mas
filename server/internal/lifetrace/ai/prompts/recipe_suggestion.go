package prompts

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"valley-server/internal/lifetrace/ai"
)

const RecipeSuggestionMaxTokens = 720

type RecipeSuggestionInput struct {
	Meal        string
	Servings    int
	MaxMinutes  int
	Today       string
	PantryLines []string
}

type RecipeSuggestionItem struct {
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

type RecipeSuggestionOutput struct {
	Summary  string                 `json:"summary"`
	Recipes  []RecipeSuggestionItem `json:"recipes"`
	Warnings []string               `json:"warnings"`
}

type RecipeSuggestionNormalizeContext struct {
	MaxMinutes int
	Servings   int
}

var RecipeSuggestionContract = ai.PromptContract[RecipeSuggestionInput, RecipeSuggestionOutput]{
	Name:        "life-trace-recipe-suggestion",
	Version:     "v1",
	AuditScene:  "life-trace-recipe",
	MaxTokens:   RecipeSuggestionMaxTokens,
	BuildPrompt: BuildRecipeSuggestionPrompt,
}

func BuildRecipeSuggestionPrompt(input RecipeSuggestionInput) string {
	return strings.Join([]string{
		"你是 Life Trace 的库存优先菜谱 AI，只输出一个 JSON 对象，不要 Markdown，不要解释。",
		"目标：优先消耗 Pantry 中临期或已有食品，给出 2 到 3 个家常菜谱；不要使用过期食材，不给医疗或营养治疗建议。",
		"JSON 格式：{\"summary\":\"一句总结，40字以内\",\"recipes\":[{\"title\":\"菜名\",\"reason\":\"推荐原因，48字以内\",\"usedItems\":[\"库存食材\"],\"missingItems\":[\"缺少食材，可为空\"],\"timeMinutes\":20,\"difficulty\":\"简单|中等\",\"servings\":2,\"steps\":[\"步骤1\"],\"tags\":[\"临期优先\"],\"planTitle\":\"晚餐计划标题\",\"planNote\":\"加入计划时的备注，80字以内\"}],\"warnings\":[\"需要用户确认的风险\"]}",
		"recipes 最多 3 个；每个 steps 3 到 5 步；usedItems 必须来自库存清单；missingItems 只能放常见辅料或可省略材料。",
		"如果库存不足，以“少买/可省略”为原则，不要凭空假设用户有昂贵或复杂食材。",
		"",
		fmt.Sprintf("今天日期：%s；餐次：%s；人数：%d；期望烹饪时间：%d 分钟以内。", input.Today, input.Meal, input.Servings, input.MaxMinutes),
		"",
		"可用食品库存：",
		strings.Join(input.PantryLines, "\n"),
	}, "\n")
}

func ParseRecipeSuggestionOutput(raw string, ctx RecipeSuggestionNormalizeContext) (RecipeSuggestionOutput, error) {
	raw = strings.TrimSpace(raw)
	start := strings.Index(raw, "{")
	end := strings.LastIndex(raw, "}")
	if start < 0 || end <= start {
		return RecipeSuggestionOutput{}, errors.New("missing JSON object")
	}

	var parsed RecipeSuggestionOutput
	if err := json.Unmarshal([]byte(raw[start:end+1]), &parsed); err != nil {
		return RecipeSuggestionOutput{}, err
	}

	parsed.Summary = TrimRunes(parsed.Summary, 48)
	if parsed.Summary == "" {
		parsed.Summary = "已按临期库存优先生成菜谱建议。"
	}
	parsed.Warnings = NormalizeRecipeTextList(parsed.Warnings, 3, 36)
	parsed.Recipes = NormalizeRecipeSuggestions(parsed.Recipes, ctx)
	if len(parsed.Recipes) == 0 {
		return RecipeSuggestionOutput{}, errors.New("empty recipes")
	}
	return parsed, nil
}

func NormalizeRecipeSuggestions(items []RecipeSuggestionItem, ctx RecipeSuggestionNormalizeContext) []RecipeSuggestionItem {
	maxMinutes := ctx.MaxMinutes
	servings := ctx.Servings
	result := make([]RecipeSuggestionItem, 0, 3)
	seen := map[string]bool{}
	for _, item := range items {
		title := TrimRunes(item.Title, 24)
		if title == "" || seen[title] {
			continue
		}
		seen[title] = true

		item.ID = fmt.Sprintf("recipe-%d", len(result)+1)
		item.Title = title
		item.Reason = TrimRunes(item.Reason, 56)
		if item.Reason == "" {
			item.Reason = "优先使用现有库存，减少临期浪费。"
		}
		item.UsedItems = NormalizeRecipeTextList(item.UsedItems, 5, 16)
		item.MissingItems = NormalizeRecipeTextList(item.MissingItems, 4, 16)
		if item.TimeMinutes <= 0 || item.TimeMinutes > 180 {
			item.TimeMinutes = maxMinutes
		}
		item.Difficulty = NormalizeRecipeDifficulty(item.Difficulty)
		if item.Servings <= 0 || item.Servings > 12 {
			item.Servings = servings
		}
		item.Steps = NormalizeRecipeTextList(item.Steps, 5, 42)
		if len(item.Steps) == 0 {
			item.Steps = []string{"处理库存食材。", "按常规家常做法烹调。", "出锅前确认味道和食材状态。"}
		}
		item.Tags = NormalizeRecipeTextList(item.Tags, 4, 12)
		if len(item.Tags) == 0 {
			item.Tags = []string{"库存优先"}
		}
		item.PlanTitle = TrimRunes(item.PlanTitle, 30)
		if item.PlanTitle == "" {
			item.PlanTitle = item.Title
		}
		item.PlanNote = TrimRunes(item.PlanNote, 96)
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

func NormalizeRecipeTextList(items []string, maxItems int, maxRunes int) []string {
	result := make([]string, 0, maxItems)
	seen := map[string]bool{}
	for _, item := range items {
		item = TrimRunes(item, maxRunes)
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

func NormalizeRecipeDifficulty(value string) string {
	value = strings.TrimSpace(value)
	if value == "中等" {
		return value
	}
	return "简单"
}
