package prompts

import (
	"strings"
	"valley-server/internal/lifetrace/ai"
)

const InboxOrganizeMaxTokens = 420

type InboxOrganizeInput struct {
	Title                 string
	Content               string
	ItemType              string
	LinkURL               string
	ImageURL              string
	Tags                  []string
	FallbackSuggestedType string
}

type InboxOrganizeOutput struct {
	Title         string   `json:"title"`
	Summary       string   `json:"summary"`
	Tags          []string `json:"tags"`
	SuggestedType string   `json:"suggestedType"`
	Reason        string   `json:"reason"`
}

var InboxOrganizeContract = ai.PromptContract[InboxOrganizeInput, InboxOrganizeOutput]{
	Name:       "life-trace-inbox-organize",
	Version:    "v1",
	AuditScene: "life-trace-inbox-organize",
	MaxTokens:  InboxOrganizeMaxTokens,
	BuildPrompt: func(input InboxOrganizeInput) string {
		return BuildInboxOrganizePrompt(input)
	},
}

func BuildInboxOrganizePrompt(input InboxOrganizeInput) string {
	linkText := strings.TrimSpace(input.LinkURL)
	if linkText == "" {
		linkText = "无"
	}
	imageText := strings.TrimSpace(input.ImageURL)
	if imageText == "" {
		imageText = "无"
	}
	tags := strings.Join(input.Tags, "、")
	if tags == "" {
		tags = "无"
	}
	return strings.Join([]string{
		"你是 Life Trace 的 Inbox 整理 AI，只输出一个 JSON 对象，不要 Markdown，不要解释。",
		"JSON 格式：{\"title\":\"整理后的标题，24字以内\",\"summary\":\"整理摘要，80字以内\",\"tags\":[\"标签\"],\"suggestedType\":\"plan|trace\",\"reason\":\"建议去向原因，40字以内\"}",
		"只根据用户已经收下的内容整理，不要编造没有出现的人名、地点、金额、日期或结论。",
		"如果像未来要做的事，suggestedType 返回 plan；如果像已经发生的记录，返回 trace。",
		"tags 输出 1-4 个简体中文短标签。",
		"",
		"原始标题：" + input.Title,
		"内容：" + emptyPromptText(input.Content),
		"类型：" + input.ItemType,
		"链接：" + linkText,
		"图片：" + imageText,
		"原标签：" + tags,
	}, "\n")
}

func ParseInboxOrganizeOutput(raw string, input InboxOrganizeInput) (InboxOrganizeOutput, error) {
	parsed, err := InboxOrganizeContract.Parse(raw)
	if err != nil {
		return InboxOrganizeOutput{}, err
	}
	return NormalizeInboxOrganizeOutput(parsed, input)
}

func NormalizeInboxOrganizeOutput(parsed InboxOrganizeOutput, input InboxOrganizeInput) (InboxOrganizeOutput, error) {
	parsed.Title = TrimRunes(parsed.Title, 24)
	if parsed.Title == "" {
		parsed.Title = TrimRunes(input.Title, 24)
	}
	parsed.Summary = TrimRunes(parsed.Summary, 80)
	if parsed.Summary == "" {
		parsed.Summary = TrimRunes(strings.Join([]string{input.Content, input.LinkURL, input.ImageURL}, " "), 80)
	}
	parsed.Tags = NormalizeInboxTags(parsed.Tags, input.Tags)
	parsed.SuggestedType = strings.TrimSpace(parsed.SuggestedType)
	if parsed.SuggestedType != "plan" && parsed.SuggestedType != "trace" {
		parsed.SuggestedType = strings.TrimSpace(input.FallbackSuggestedType)
	}
	if parsed.SuggestedType != "plan" && parsed.SuggestedType != "trace" {
		parsed.SuggestedType = "trace"
	}
	parsed.Reason = TrimRunes(parsed.Reason, 40)
	if parsed.Reason == "" {
		parsed.Reason = "已根据 Inbox 内容整理去向。"
	}
	return parsed, nil
}

func NormalizeInboxTags(tags []string, fallback []string) []string {
	result := NormalizeTextList(tags, 4, 10)
	if len(result) > 0 {
		return result
	}
	return NormalizeTextList(fallback, 4, 10)
}

func emptyPromptText(text string) string {
	text = strings.TrimSpace(text)
	if text == "" {
		return "无"
	}
	return text
}
