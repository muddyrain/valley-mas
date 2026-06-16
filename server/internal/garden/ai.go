// server/internal/garden/ai.go
package garden

import (
	"context"
	"encoding/json"
	"errors"
	"regexp"
	"strings"
)

// SeedJSON 是 PromptSeedBirth 期望的结构化输出
type SeedJSON struct {
	NameZH      string   `json:"name_zh"`
	ConceptEN   string   `json:"concept_en"`
	Tags        []string `json:"tags"`
	Rarity      string   `json:"rarity"`
	Mood        string   `json:"mood"`
	Description string   `json:"description"`
	FirstLog    string   `json:"first_log"`
}

type HarvestJSON struct {
	FinalStory       string `json:"final_story"`
	FruitName        string `json:"fruit_name"`
	FruitDescription string `json:"fruit_description"`
	FarewellLetter   string `json:"farewell_letter"`
}

var fencedRe = regexp.MustCompile("(?s)```(?:json)?\\s*(\\{.*\\})\\s*```")

func extractJSON(raw string) string {
	s := strings.TrimSpace(raw)
	if m := fencedRe.FindStringSubmatch(s); len(m) == 2 {
		return strings.TrimSpace(m[1])
	}
	if i := strings.Index(s, "{"); i >= 0 {
		if j := strings.LastIndex(s, "}"); j > i {
			return s[i : j+1]
		}
	}
	return s
}

func ParseSeedJSON(raw string) (*SeedJSON, error) {
	var out SeedJSON
	if err := json.Unmarshal([]byte(extractJSON(raw)), &out); err != nil {
		return nil, err
	}
	if out.NameZH == "" || out.Rarity == "" {
		return nil, errors.New("seed json missing required fields")
	}
	return &out, nil
}

func ParseHarvestJSON(raw string) (*HarvestJSON, error) {
	var out HarvestJSON
	if err := json.Unmarshal([]byte(extractJSON(raw)), &out); err != nil {
		return nil, err
	}
	if out.FinalStory == "" {
		return nil, errors.New("harvest json missing final_story")
	}
	return &out, nil
}

// TextAI 是 service 依赖的 AI 文本生成接口（便于 mock）
type TextAI interface {
	GenerateText(ctx context.Context, prompt string) (string, error)
}

// MockTextAI 是 MVP 阶段的 mock 文本 AI 实现，按 prompt 关键词返回伪造的种子精灵 JSON。
// 真正接入 ARK / Gemini 推迟到 M3.5。
type MockTextAI struct{}

func NewMockTextAI() *MockTextAI { return &MockTextAI{} }

func (m *MockTextAI) GenerateText(ctx context.Context, prompt string) (string, error) {
	select {
	case <-ctx.Done():
		return "", ctx.Err()
	default:
	}
	// PromptSeedBirth 模板含 "种子精灵"，识别后返回伪造 JSON
	if strings.Contains(prompt, "种子精灵") {
		return `{"name_zh":"未读消息","concept_en":"unread message","tags":["anxious","phone","pink","bell","social"],"rarity":"R","mood":"焦虑","description":"那个一直没回的人，让你刷新了八十次。","first_log":"我刚刚发芽，铃铛上还沾着昨晚的提示音。"}`, nil
	}
	// PromptHarvest 含 "fruit_name"，返回 harvest JSON
	if strings.Contains(prompt, "fruit_name") {
		return `{"final_story":"它从一颗未读消息长成了一段坦然的释怀。","fruit_name":"已读未回果","fruit_description":"果皮上印着一行未读小字，咬一口能吃到平静。","farewell_letter":"谢谢你陪我等到现在。"}`, nil
	}
	// 默认是 stage / chat / water 类的纯文本回应
	return "我又长大了一点，谢谢你今天还记得我。", nil
}
