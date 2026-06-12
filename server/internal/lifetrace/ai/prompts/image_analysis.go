package prompts

import (
	"errors"
	"strings"
	"valley-server/internal/lifetrace/ai"
)

const ImageAnalysisMaxTokens = 900

type ImageAnalysisInput struct {
	Kind      string
	UseVision bool
}

type ImageAnalysisSchedule struct {
	DateOption string `json:"dateOption"`
	Time       string `json:"time"`
}

type ImageAnalysisOutput struct {
	Title    string                `json:"title"`
	Summary  string                `json:"summary"`
	PlanType string                `json:"planType"`
	Mood     string                `json:"mood"`
	Tags     []string              `json:"tags"`
	Schedule ImageAnalysisSchedule `json:"schedule"`
}

var ImageAnalysisContract = ai.PromptContract[ImageAnalysisInput, ImageAnalysisOutput]{
	Name:       "life-trace-image-analysis",
	Version:    "v1",
	AuditScene: "life-trace-image",
	MaxTokens:  ImageAnalysisMaxTokens,
	BuildPrompt: func(input ImageAnalysisInput) string {
		return BuildImageAnalysisPrompt(input)
	},
}

var imageAnalysisDefaults = map[string]ImageAnalysisOutput{
	"电影海报": {
		Title:    "周末看一部电影",
		Summary:  "这张图适合作为电影计划封面，建议安排在周末晚上，并在观影后生成一条观影踪迹。",
		PlanType: "电影",
		Mood:     "期待",
		Tags:     []string{"电影", "周末", "放松"},
		Schedule: ImageAnalysisSchedule{DateOption: "周六", Time: "20:00"},
	},
	"美食照片": {
		Title:    "安排一次放松晚餐",
		Summary:  "这张图更像一顿值得期待的晚餐，可以记录为吃饭计划，完成后沉淀成美食踪迹。",
		PlanType: "吃饭",
		Mood:     "满足",
		Tags:     []string{"美食", "晚餐", "生活奖励"},
		Schedule: ImageAnalysisSchedule{DateOption: "周五", Time: "19:30"},
	},
	"生活照片": {
		Title:    "记录一个生活瞬间",
		Summary:  "这张图适合作为日常生活踪迹，建议补充地点、心情和一句回忆。",
		PlanType: "普通事项",
		Mood:     "平静",
		Tags:     []string{"日常", "生活", "记录"},
		Schedule: ImageAnalysisSchedule{DateOption: "今天", Time: "21:00"},
	},
}

var validImageAnalysisPlanTypes = map[string]bool{
	"电影":   true,
	"吃饭":   true,
	"运动":   true,
	"阅读":   true,
	"聚会":   true,
	"普通事项": true,
}

var validImageAnalysisDateOptions = map[string]bool{
	"今天": true,
	"明天": true,
	"周五": true,
	"周六": true,
	"周日": true,
}

func BuildImageAnalysisPrompt(input ImageAnalysisInput) string {
	kind := NormalizeImageAnalysisKind(input.Kind)
	visionInstruction := "请直接观察图片内容，结合画面主体、场景和生活用途给出建议。"
	if !input.UseVision {
		visionInstruction = "视觉模型未配置时，请只基于用户选择的图片类型给出保守建议，不要声称看到了具体画面。"
	}

	return strings.Join([]string{
		"你是 Life Trace 的图片生活分析 AI，只输出一个 JSON 对象，不要 Markdown，不要解释。",
		"JSON 格式：{\"title\":\"计划标题，16字以内\",\"summary\":\"分析和建议，60字以内\",\"planType\":\"电影|吃饭|运动|阅读|聚会|普通事项\",\"mood\":\"心情，6字以内\",\"tags\":[\"标签\"],\"schedule\":{\"dateOption\":\"今天|明天|周五|周六|周日\",\"time\":\"HH:MM\"}}",
		"tags 输出 2-4 个简体中文短标签。",
		visionInstruction,
		"图片类型提示：" + kind,
	}, "\n")
}

func ParseImageAnalysisOutput(raw string, kind string) (ImageAnalysisOutput, error) {
	parsed, err := ImageAnalysisContract.Parse(raw)
	if err != nil {
		return ImageAnalysisOutput{}, err
	}
	return NormalizeImageAnalysisOutput(parsed, kind)
}

func NormalizeImageAnalysisOutput(parsed ImageAnalysisOutput, kind string) (ImageAnalysisOutput, error) {
	fallback := ImageAnalysisDefaultForKind(kind)
	parsed.Title = TrimRunes(parsed.Title, 20)
	if parsed.Title == "" {
		parsed.Title = fallback.Title
	}
	parsed.Summary = TrimRunes(parsed.Summary, 72)
	if parsed.Summary == "" {
		parsed.Summary = fallback.Summary
	}
	parsed.PlanType = strings.TrimSpace(parsed.PlanType)
	if !validImageAnalysisPlanTypes[parsed.PlanType] {
		parsed.PlanType = fallback.PlanType
	}
	parsed.Mood = TrimRunes(parsed.Mood, 6)
	if parsed.Mood == "" {
		parsed.Mood = fallback.Mood
	}
	parsed.Tags = normalizeImageAnalysisTags(parsed.Tags, fallback.Tags)
	if !isValidImageAnalysisSchedule(parsed.Schedule) {
		parsed.Schedule = fallback.Schedule
	}
	if parsed.Title == "" {
		return ImageAnalysisOutput{}, errors.New("empty image analysis")
	}
	return parsed, nil
}

func NormalizeImageAnalysisKind(kind string) string {
	kind = strings.TrimSpace(kind)
	if _, ok := imageAnalysisDefaults[kind]; ok {
		return kind
	}
	return "生活照片"
}

func ImageAnalysisDefaultForKind(kind string) ImageAnalysisOutput {
	kind = NormalizeImageAnalysisKind(kind)
	return imageAnalysisDefaults[kind]
}

func normalizeImageAnalysisTags(tags []string, fallback []string) []string {
	result := NormalizeTextList(tags, 4, 12)
	if len(result) == 0 {
		return fallback
	}
	return result
}

func isValidImageAnalysisSchedule(schedule ImageAnalysisSchedule) bool {
	return validImageAnalysisDateOptions[strings.TrimSpace(schedule.DateOption)] &&
		isClockText(schedule.Time)
}

func isClockText(value string) bool {
	value = strings.TrimSpace(value)
	if len(value) != 5 || value[2] != ':' {
		return false
	}
	hour := int(value[0]-'0')*10 + int(value[1]-'0')
	minute := int(value[3]-'0')*10 + int(value[4]-'0')
	return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59
}
