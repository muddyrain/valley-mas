package prompts

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"valley-server/internal/lifetrace/ai"
)

const PantryDescriptionMaxTokens = 480

type PantryDescriptionInput struct {
	Name      string
	Category  string
	Location  string
	Tags      []string
	ExpiresAt string
	OpenedAt  string
	Note      string
}

type PantryDescriptionOutput struct {
	Note string   `json:"note"`
	Tips []string `json:"tips"`
}

var PantryDescriptionContract = ai.PromptContract[PantryDescriptionInput, PantryDescriptionOutput]{
	Name:        "life-trace-pantry-description",
	Version:     "v1",
	AuditScene:  "life-trace-pantry-description",
	MaxTokens:   PantryDescriptionMaxTokens,
	BuildPrompt: BuildPantryDescriptionPrompt,
}

func BuildPantryDescriptionPrompt(input PantryDescriptionInput) string {
	var b strings.Builder
	b.WriteString("你是 Life Trace 的家庭库存助手，任务是为一件库存写一段简短实用的中文备注。\n")
	b.WriteString("输出严格 JSON，字段：note(string, 30-80 字，以储存方式/最佳食用期/常见注意事项为主，语气克制不夸张)，tips(string[], 2-3 条短建议，每条不超过 14 字)。\n\n")
	b.WriteString(fmt.Sprintf("商品名称：%s\n", strings.TrimSpace(input.Name)))
	if v := strings.TrimSpace(input.Category); v != "" {
		b.WriteString(fmt.Sprintf("分类：%s\n", v))
	}
	if v := strings.TrimSpace(input.Location); v != "" {
		b.WriteString(fmt.Sprintf("存放位置：%s\n", v))
	}
	if v := strings.TrimSpace(input.ExpiresAt); v != "" {
		b.WriteString(fmt.Sprintf("过期日：%s\n", v))
	}
	if v := strings.TrimSpace(input.OpenedAt); v != "" {
		b.WriteString(fmt.Sprintf("开封日：%s\n", v))
	}
	if len(input.Tags) > 0 {
		b.WriteString(fmt.Sprintf("标签：%s\n", strings.Join(input.Tags, "、")))
	}
	if v := strings.TrimSpace(input.Note); v != "" {
		b.WriteString(fmt.Sprintf("现有备注（可改写）：%s\n", v))
	}
	b.WriteString("\n只输出 JSON，不要 markdown，不要多余文本。")
	return b.String()
}

func ParsePantryDescriptionOutput(raw string) (PantryDescriptionOutput, error) {
	start := strings.Index(raw, "{")
	end := strings.LastIndex(raw, "}")
	if start < 0 || end <= start {
		return PantryDescriptionOutput{}, errors.New("missing JSON object")
	}
	var parsed PantryDescriptionOutput
	if err := json.Unmarshal([]byte(raw[start:end+1]), &parsed); err != nil {
		return PantryDescriptionOutput{}, err
	}
	if strings.TrimSpace(parsed.Note) == "" && len(parsed.Tips) == 0 {
		return PantryDescriptionOutput{}, errors.New("empty AI output")
	}
	return parsed, nil
}

func NormalizePantryDescriptionTips(tips []string) []string {
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
