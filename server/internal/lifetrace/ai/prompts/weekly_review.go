package prompts

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"valley-server/internal/lifetrace/ai"
)

const WeeklyReviewMaxTokens = 520

type WeeklyReviewPlanLine struct {
	Title     string
	Type      string
	TimeLabel string
	Completed bool
}

type WeeklyReviewTraceLine struct {
	Title     string
	Mood      string
	TimeLabel string
	Source    string
	Tags      []string
}

type WeeklyReviewInput struct {
	City           string
	WorkStart      string
	WorkEnd        string
	CommuteMethod  string
	WeekStart      time.Time
	WeekEnd        time.Time
	CompletedPlans []WeeklyReviewPlanLine
	OpenPlans      []WeeklyReviewPlanLine
	Traces         []WeeklyReviewTraceLine
}

type WeeklyReviewOutput struct {
	Summary     string   `json:"summary"`
	Wins        []string `json:"wins"`
	Delays      []string `json:"delays"`
	Insights    []string `json:"insights"`
	NextActions []string `json:"nextActions"`
}

var WeeklyReviewContract = ai.PromptContract[WeeklyReviewInput, WeeklyReviewOutput]{
	Name:        "life-trace-weekly-review",
	Version:     "v1",
	AuditScene:  "life-trace-weekly-review",
	MaxTokens:   WeeklyReviewMaxTokens,
	BuildPrompt: BuildWeeklyReviewPrompt,
}

func BuildWeeklyReviewPrompt(input WeeklyReviewInput) string {
	completedPlanLines := buildWeeklyReviewPlanLines(input.CompletedPlans, "暂无已完成计划")
	openPlanLines := buildWeeklyReviewPlanLines(input.OpenPlans, "暂无未完成计划")
	traceLines := make([]string, 0, len(input.Traces))
	for _, trace := range input.Traces {
		tags := strings.Join(trace.Tags, "、")
		traceLines = append(traceLines, fmt.Sprintf("- %s｜%s｜%s｜%s｜%s", trace.Title, trace.Mood, trace.TimeLabel, trace.Source, tags))
	}
	if len(traceLines) == 0 {
		traceLines = append(traceLines, "- 暂无生活踪迹")
	}

	return strings.Join([]string{
		"你是 Life Trace 的复盘 Agent，只输出一个 JSON 对象，不要 Markdown，不要解释。",
		"JSON 格式：{\"summary\":\"一句本周复盘，48字以内\",\"wins\":[\"完成事项，24字以内\"],\"delays\":[\"延迟事项，24字以内\"],\"insights\":[\"生活洞察，28字以内\"],\"nextActions\":[\"下周行动，24字以内\"]}",
		"wins、delays、insights、nextActions 各输出 1-3 条；没有延迟事项时 delays 输出 [\"暂无明显延迟事项\"]。",
		"复盘要基于计划和踪迹，不要编造资产、订阅或没有出现过的生活事件。",
		"语气温暖、克制、可执行，使用简体中文。",
		"",
		"用户偏好：",
		fmt.Sprintf("城市：%s；工作时间：%s-%s；通勤：%s。", input.City, input.WorkStart, input.WorkEnd, input.CommuteMethod),
		"",
		"周报范围：",
		fmt.Sprintf("%s 至 %s", input.WeekStart.Format("2006-01-02"), input.WeekEnd.Format("2006-01-02")),
		"",
		"本周已完成计划：",
		strings.Join(completedPlanLines, "\n"),
		"",
		"当前未完成计划：",
		strings.Join(openPlanLines, "\n"),
		"",
		"本周生活踪迹：",
		strings.Join(traceLines, "\n"),
	}, "\n")
}

func buildWeeklyReviewPlanLines(plans []WeeklyReviewPlanLine, emptyText string) []string {
	lines := make([]string, 0, len(plans))
	for _, plan := range plans {
		status := "未完成"
		if plan.Completed {
			status = "已完成"
		}
		lines = append(lines, fmt.Sprintf("- %s｜%s｜%s｜%s", plan.Title, plan.Type, plan.TimeLabel, status))
	}
	if len(lines) == 0 {
		lines = append(lines, "- "+emptyText)
	}
	return lines
}

func ParseWeeklyReviewOutput(raw string) (WeeklyReviewOutput, error) {
	raw = strings.TrimSpace(raw)
	start := strings.Index(raw, "{")
	end := strings.LastIndex(raw, "}")
	if start < 0 || end <= start {
		return WeeklyReviewOutput{}, errors.New("missing JSON object")
	}

	var parsed WeeklyReviewOutput
	if err := json.Unmarshal([]byte(raw[start:end+1]), &parsed); err != nil {
		return WeeklyReviewOutput{}, err
	}

	parsed.Summary = TrimRunes(parsed.Summary, 56)
	if parsed.Summary == "" {
		parsed.Summary = "本周生活节奏已整理，适合下周继续轻量推进。"
	}
	parsed.Wins = normalizeWeeklyReviewList(parsed.Wins, "本周已有可回看的生活记录", 3, 28)
	parsed.Delays = normalizeWeeklyReviewList(parsed.Delays, "暂无明显延迟事项", 3, 28)
	parsed.Insights = normalizeWeeklyReviewList(parsed.Insights, "稳定记录能让下周安排更清晰", 3, 32)
	parsed.NextActions = normalizeWeeklyReviewList(parsed.NextActions, "下周先安排一件轻量计划", 3, 28)
	return parsed, nil
}

func normalizeWeeklyReviewList(items []string, fallback string, maxItems int, maxRunes int) []string {
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
	if len(result) == 0 {
		result = append(result, fallback)
	}
	return result
}
