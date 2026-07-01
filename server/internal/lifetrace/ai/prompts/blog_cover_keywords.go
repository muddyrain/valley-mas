package prompts

import (
	"encoding/json"
	"errors"
	"regexp"
	"strings"

	"valley-server/internal/lifetrace/ai"
)

const BlogCoverKeywordsMaxTokens = 200

type BlogCoverKeywordsInput struct {
	Title   string
	Excerpt string
	Content string
}

type BlogCoverKeywordsOutput struct {
	Keywords []string `json:"keywords"`
}

var BlogCoverKeywordsContract = ai.PromptContract[BlogCoverKeywordsInput, BlogCoverKeywordsOutput]{
	Name:        "blog-cover-keywords",
	Version:     "v1",
	AuditScene:  "blog-cover-keywords",
	MaxTokens:   BlogCoverKeywordsMaxTokens,
	BuildPrompt: BuildBlogCoverKeywordsPrompt,
	Normalize:   normalizeBlogCoverKeywordsOutput,
}

func BuildBlogCoverKeywordsPrompt(input BlogCoverKeywordsInput) string {
	var b strings.Builder
	b.WriteString("你是博客配图助手。任务是从下面的博客标题、摘要和正文中，提炼 3-5 个可用于图片检索的视觉主体关键词，用于匹配一张现有的封面图。\n")
	b.WriteString("要求：\n")
	b.WriteString("1) 关键词优先描述具体视觉主体，例如：山川、日落、咖啡、雨天窗前、代码、书桌、雪山；不要抽象概念（如：思考、成长、总结）。\n")
	b.WriteString("2) 每个关键词 1-6 个字，中文优先。\n")
	b.WriteString("3) 严格输出 JSON：{\"keywords\": [\"...\", \"...\"]}\n")
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
}

func ParseBlogCoverKeywordsOutput(raw string) (BlogCoverKeywordsOutput, error) {
	start := strings.Index(raw, "{")
	end := strings.LastIndex(raw, "}")
	if start < 0 || end <= start {
		return BlogCoverKeywordsOutput{}, errors.New("missing JSON object")
	}
	var parsed BlogCoverKeywordsOutput
	if err := json.Unmarshal([]byte(raw[start:end+1]), &parsed); err != nil {
		return BlogCoverKeywordsOutput{}, err
	}
	return normalizeBlogCoverKeywordsOutput(parsed)
}

var blogCoverKeywordStopWords = map[string]struct{}{
	"文章": {}, "博客": {}, "思考": {}, "总结": {}, "感悟": {}, "记录": {}, "生活": {}, "工作": {}, "笔记": {},
}

var blogCoverKeywordSanitizer = regexp.MustCompile(`^[\s\p{P}\p{S}]+|[\s\p{P}\p{S}]+$`)

func normalizeBlogCoverKeywordsOutput(out BlogCoverKeywordsOutput) (BlogCoverKeywordsOutput, error) {
	seen := make(map[string]struct{}, len(out.Keywords))
	result := make([]string, 0, len(out.Keywords))
	for _, k := range out.Keywords {
		k = blogCoverKeywordSanitizer.ReplaceAllString(strings.TrimSpace(k), "")
		if k == "" {
			continue
		}
		runes := []rune(k)
		if len(runes) > 20 {
			runes = runes[:20]
			k = string(runes)
		}
		lower := strings.ToLower(k)
		if _, dup := seen[lower]; dup {
			continue
		}
		if _, stop := blogCoverKeywordStopWords[k]; stop {
			continue
		}
		seen[lower] = struct{}{}
		result = append(result, k)
		if len(result) >= 5 {
			break
		}
	}
	return BlogCoverKeywordsOutput{Keywords: result}, nil
}
