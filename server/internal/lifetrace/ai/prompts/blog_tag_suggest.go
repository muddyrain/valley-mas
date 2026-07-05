package prompts

import (
	"encoding/json"
	"errors"
	"regexp"
	"strings"

	"valley-server/internal/lifetrace/ai"
)

const BlogTagSuggestMaxTokens = 200

type BlogTagSuggestInput struct {
	Title   string
	Excerpt string
	Content string
}

type BlogTagSuggestOutput struct {
	Tags []string `json:"tags"`
}

var BlogTagSuggestContract = ai.PromptContract[BlogTagSuggestInput, BlogTagSuggestOutput]{
	Name:       "blog-tag-suggest",
	Version:    "v1",
	AuditScene: "blog-tag-suggest",
	MaxTokens:  BlogTagSuggestMaxTokens,
	BuildPrompt: func(input BlogTagSuggestInput) string {
		var b strings.Builder
		b.WriteString("你是博客标签推荐助手。任务是根据博客标题、摘要和正文，推荐 3-5 个合适的文章标签。\n")
		b.WriteString("要求：\n")
		b.WriteString("1) 标签应准确概括文章主题，优先使用已有的常见标签（如：技术、旅行、设计、生活、编程、摄影、读书、思考、随笔、教程）。\n")
		b.WriteString("2) 每个标签 1-6 个字，中文优先。\n")
		b.WriteString("3) 严格输出 JSON：{\"tags\": [\"...\", \"...\"]}\n")
		b.WriteString("4) 不要 markdown、不要解释、不要重复词。\n\n")
		if v := strings.TrimSpace(input.Title); v != "" {
			b.WriteString("标题：")
			b.WriteString(v)
			b.WriteString("\n")
		}
		if v := strings.TrimSpace(input.Excerpt); v != "" {
			b.WriteString("摘要：")
			b.WriteString(v)
			b.WriteString("\n")
		}
		if v := strings.TrimSpace(input.Content); v != "" {
			b.WriteString("正文（可能被截断）：")
			b.WriteString(v)
			b.WriteString("\n")
		}
		b.WriteString("\n只输出 JSON。")
		return b.String()
	},
	Normalize: normalizeBlogTagSuggestOutput,
}

func ParseBlogTagSuggestOutput(raw string) (BlogTagSuggestOutput, error) {
	start := strings.Index(raw, "{")
	end := strings.LastIndex(raw, "}")
	if start < 0 || end <= start {
		return BlogTagSuggestOutput{}, errors.New("missing JSON object")
	}
	var parsed BlogTagSuggestOutput
	if err := json.Unmarshal([]byte(raw[start:end+1]), &parsed); err != nil {
		return BlogTagSuggestOutput{}, err
	}
	return normalizeBlogTagSuggestOutput(parsed)
}

var blogTagStopWords = map[string]struct{}{
	"文章": {}, "博客": {}, "内容": {}, "文字": {}, "发布": {},
}

var blogTagSanitizer = regexp.MustCompile(`^[\s\p{P}\p{S}]+|[\s\p{P}\p{S}]+$`)

func normalizeBlogTagSuggestOutput(out BlogTagSuggestOutput) (BlogTagSuggestOutput, error) {
	seen := make(map[string]struct{}, len(out.Tags))
	result := make([]string, 0, len(out.Tags))
	for _, t := range out.Tags {
		t = blogTagSanitizer.ReplaceAllString(strings.TrimSpace(t), "")
		if t == "" {
			continue
		}
		runes := []rune(t)
		if len(runes) > 20 {
			runes = runes[:20]
			t = string(runes)
		}
		lower := strings.ToLower(t)
		if _, dup := seen[lower]; dup {
			continue
		}
		if _, stop := blogTagStopWords[t]; stop {
			continue
		}
		seen[lower] = struct{}{}
		result = append(result, t)
		if len(result) >= 5 {
			break
		}
	}
	return BlogTagSuggestOutput{Tags: result}, nil
}
