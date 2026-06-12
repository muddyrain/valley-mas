package prompts

import (
	"strings"
	"time"
	"valley-server/internal/lifetrace/ai"
)

const MediaDiarySuggestMaxTokens = 420

type MediaDiarySuggestInput struct {
	MediaType string
	Title     string
}

type MediaDiarySuggestion struct {
	OriginalTitle string   `json:"originalTitle"`
	Creator       string   `json:"creator"`
	ReleaseYear   int      `json:"releaseYear"`
	Tags          []string `json:"tags"`
	Note          string   `json:"note"`
}

var MediaDiarySuggestContract = ai.PromptContract[MediaDiarySuggestInput, MediaDiarySuggestion]{
	Name:       "life-trace-media-diary-suggest",
	Version:    "v1",
	AuditScene: "life-trace-media-diary",
	MaxTokens:  MediaDiarySuggestMaxTokens,
	BuildPrompt: func(input MediaDiarySuggestInput) string {
		return BuildMediaDiarySuggestPrompt(input)
	},
	Normalize: func(output MediaDiarySuggestion) (MediaDiarySuggestion, error) {
		return NormalizeMediaDiarySuggestion(output), nil
	},
}

func BuildMediaDiarySuggestPrompt(input MediaDiarySuggestInput) string {
	return strings.Join([]string{
		"你是 Life Trace 的书影音日记助手。只输出 JSON 对象，不要 Markdown，不要解释。",
		"用户会自行确认信息，不能编造冷门事实；不确定的字段留空。",
		"JSON 字段：originalTitle, creator, releaseYear, tags, note。",
		"tags 最多 5 个，每个不超过 12 个字；note 不超过 80 个中文字符。",
		"类型：" + input.MediaType,
		"标题：" + input.Title,
	}, "\n")
}

func ParseMediaDiarySuggestion(raw string) (MediaDiarySuggestion, error) {
	return MediaDiarySuggestContract.Parse(raw)
}

func NormalizeMediaDiarySuggestion(suggestion MediaDiarySuggestion) MediaDiarySuggestion {
	suggestion.OriginalTitle = TrimRunes(suggestion.OriginalTitle, 160)
	suggestion.Creator = TrimRunes(suggestion.Creator, 160)
	suggestion.ReleaseYear = NormalizeMediaDiaryYear(suggestion.ReleaseYear)
	suggestion.Note = TrimRunes(suggestion.Note, 80)
	suggestion.Tags = NormalizeTextList(suggestion.Tags, 5, 12)
	return suggestion
}

func NormalizeMediaDiaryYear(year int) int {
	currentYear := time.Now().Year() + 1
	if year < 0 || year > currentYear {
		return 0
	}
	return year
}
