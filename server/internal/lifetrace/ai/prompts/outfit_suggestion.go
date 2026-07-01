package prompts

import (
	"fmt"
	"strings"

	"valley-server/internal/lifetrace/ai"
)

type OutfitSuggestionInput struct {
	ItemLines   []string
	WeatherText string
	Temperature int
	LowTemp     int
	HighTemp    int
	Precip      string
	PlanType    string
	Scene       string
	PlanTitle   string
}

type OutfitSuggestionRawOutput struct {
	Suggestions []struct {
		Title   string   `json:"title"`
		Summary string   `json:"summary"`
		ItemIDs []string `json:"itemIds"`
	} `json:"suggestions"`
}

var OutfitSuggestionContract = ai.PromptContract[OutfitSuggestionInput, OutfitSuggestionRawOutput]{
	Name:        "life-trace-outfit-suggestion",
	Version:     "v1",
	AuditScene:  "life-trace-outfit-suggestion",
	BuildPrompt: BuildOutfitSuggestionPrompt,
}

func BuildOutfitSuggestionPrompt(input OutfitSuggestionInput) string {
	return strings.Join([]string{
		"你是 Life Trace 的穿搭建议 AI，只输出一个 JSON 对象，不要 Markdown，不要解释。",
		"JSON 格式：{\"suggestions\":[{\"title\":\"标题，18字以内\",\"summary\":\"建议，60字以内\",\"itemIds\":[\"衣物id\"]}]}",
		"只从给定衣物 id 中选择；输出 1-3 套；每套 1-5 件。",
		"优先结合天气、温度、降水、计划类型和场景；不要编造新衣物。",
		"",
		fmt.Sprintf("天气：%s；温度：%d；低温：%d；高温：%d；降水：%s。", input.WeatherText, input.Temperature, input.LowTemp, input.HighTemp, input.Precip),
		fmt.Sprintf("计划：%s；场景：%s；标题：%s。", input.PlanType, input.Scene, input.PlanTitle),
		"",
		"衣物：",
		strings.Join(input.ItemLines, "\n"),
	}, "\n")
}
