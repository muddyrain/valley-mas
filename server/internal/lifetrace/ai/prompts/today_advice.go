package prompts

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"valley-server/internal/lifetrace/ai"
)

type TodayAdviceItem struct {
	ID     string `json:"id"`
	Title  string `json:"title"`
	Detail string `json:"detail"`
	Tone   string `json:"tone"`
}

type TodayAdviceOutput struct {
	Summary string            `json:"summary"`
	Items   []TodayAdviceItem `json:"items"`
}

type TodayAdvicePlanLine struct {
	Title     string
	Type      string
	TimeLabel string
}

type TodayAdviceWeather struct {
	Text       string
	High       string
	Low        string
	FeelsLike  string
	Humidity   string
	WindScale  string
	Precip     string
	UVIndex    string
	AirQuality string
}

type TodayAdviceInput struct {
	City          string
	WorkStart     string
	WorkEnd       string
	CommuteMethod string
	Weather       TodayAdviceWeather
	Plans         []TodayAdvicePlanLine
}

var TodayAdviceDefaults = map[string]TodayAdviceItem{
	"wear":    {ID: "wear", Title: "穿衣", Detail: "根据温度和天气调整穿搭", Tone: "plan"},
	"skin":    {ID: "skin", Title: "护肤", Detail: "根据紫外线和湿度调整护肤", Tone: "health"},
	"out":     {ID: "out", Title: "出门", Detail: "出门前检查天气和随身物品", Tone: "weather"},
	"commute": {ID: "commute", Title: "通勤", Detail: "按通勤方式预留缓冲时间", Tone: "ai"},
	"health":  {ID: "health", Title: "健康", Detail: "结合天气安排轻运动和休息", Tone: "trace"},
	"plan":    {ID: "plan", Title: "今日计划", Detail: "优先完成一个轻量计划", Tone: "alert"},
}

var TodayAdviceOrder = []string{"wear", "skin", "out", "commute", "health", "plan"}

var TodayAdviceValidTones = map[string]bool{
	"weather": true,
	"ai":      true,
	"plan":    true,
	"trace":   true,
	"health":  true,
	"alert":   true,
}

var TodayAdviceContract = ai.PromptContract[TodayAdviceInput, TodayAdviceOutput]{
	Name:        "life-trace-today-advice",
	Version:     "v1",
	AuditScene:  "life-trace-today-advice",
	BuildPrompt: BuildTodayAdvicePrompt,
}

func BuildTodayAdvicePrompt(input TodayAdviceInput) string {
	planLines := make([]string, 0, len(input.Plans))
	for _, plan := range input.Plans {
		planLines = append(planLines, fmt.Sprintf("- %s｜%s｜%s", plan.Title, plan.Type, plan.TimeLabel))
	}
	if len(planLines) == 0 {
		planLines = append(planLines, "- 暂无待完成计划")
	}

	return strings.Join([]string{
		"你是 Life Trace 的生活计划 AI，只输出一个 JSON 对象，不要 Markdown，不要解释。",
		"JSON 格式：{\"summary\":\"一句今日总建议，32字以内\",\"items\":[{\"id\":\"wear\",\"detail\":\"16字以内建议\"}]}",
		"items 必须严格包含 6 项，id 顺序固定为 wear, skin, out, commute, health, plan。",
		"不要输出 title 和 tone，服务端会自动补齐。",
		"建议要结合天气、通勤、工作时间和未完成计划，使用简体中文，短促可执行。",
		"",
		"用户偏好：",
		fmt.Sprintf("城市：%s；工作时间：%s-%s；通勤：%s。", input.City, input.WorkStart, input.WorkEnd, input.CommuteMethod),
		"",
		"今日天气：",
		fmt.Sprintf("天气：%s；气温：%s/%s；体感：%s；湿度：%s；风力：%s；降水：%s；紫外线：%s；空气：%s。", input.Weather.Text, input.Weather.High, input.Weather.Low, input.Weather.FeelsLike, input.Weather.Humidity, input.Weather.WindScale, input.Weather.Precip, input.Weather.UVIndex, input.Weather.AirQuality),
		"",
		"未完成计划：",
		strings.Join(planLines, "\n"),
	}, "\n")
}

func ParseTodayAdviceOutput(raw string) (TodayAdviceOutput, error) {
	raw = strings.TrimSpace(raw)
	start := strings.Index(raw, "{")
	end := strings.LastIndex(raw, "}")
	if start < 0 || end <= start {
		return TodayAdviceOutput{}, errors.New("missing JSON object")
	}

	var parsed TodayAdviceOutput
	if err := json.Unmarshal([]byte(raw[start:end+1]), &parsed); err != nil {
		return TodayAdviceOutput{}, err
	}

	parsed.Summary = TrimRunes(parsed.Summary, 40)
	if parsed.Summary == "" {
		parsed.Summary = "今天优先完成一件轻量计划。"
	}

	normalized, err := NormalizeTodayAdviceItems(parsed.Items)
	if err != nil {
		return TodayAdviceOutput{}, err
	}
	parsed.Items = normalized
	return parsed, nil
}

func NormalizeTodayAdviceItems(items []TodayAdviceItem) ([]TodayAdviceItem, error) {
	byID := make(map[string]TodayAdviceItem, len(items))
	for _, item := range items {
		id := strings.TrimSpace(item.ID)
		if _, ok := TodayAdviceDefaults[id]; !ok {
			continue
		}

		def := TodayAdviceDefaults[id]
		item.ID = id
		item.Title = def.Title
		item.Detail = TrimRunes(item.Detail, 24)
		if item.Detail == "" {
			item.Detail = def.Detail
		}
		item.Tone = strings.TrimSpace(item.Tone)
		if !TodayAdviceValidTones[item.Tone] {
			item.Tone = def.Tone
		}
		byID[id] = item
	}

	if len(byID) == 0 {
		return nil, errors.New("empty advice items")
	}

	result := make([]TodayAdviceItem, 0, len(TodayAdviceOrder))
	for _, id := range TodayAdviceOrder {
		item, ok := byID[id]
		if !ok {
			item = TodayAdviceDefaults[id]
		}
		result = append(result, item)
	}
	return result, nil
}
