// server/internal/garden/ai_test.go
package garden

import "testing"

func TestParseSeedJSONStrict(t *testing.T) {
	raw := `{
      "name_zh": "未读消息",
      "concept_en": "unread message",
      "tags": ["anxious", "phone"],
      "rarity": "R",
      "mood": "焦虑",
      "description": "那个一直没回的人...",
      "first_log": "我刚刚发芽，铃铛上还沾着昨晚的提示音。"
    }`
	got, err := ParseSeedJSON(raw)
	if err != nil {
		t.Fatalf("unexpected err: %v", err)
	}
	if got.NameZH != "未读消息" || got.Rarity != "R" || len(got.Tags) != 2 {
		t.Fatalf("parse mismatch: %+v", got)
	}
}

func TestParseSeedJSONExtractsFromFenced(t *testing.T) {
	raw := "```json\n{\"name_zh\":\"周一早上\",\"concept_en\":\"monday\",\"tags\":[\"sleepy\"],\"rarity\":\"N\",\"mood\":\"困\",\"description\":\"咖啡因不够\",\"first_log\":\"我打哈欠\"}\n```"
	if _, err := ParseSeedJSON(raw); err != nil {
		t.Fatalf("should tolerate fenced json: %v", err)
	}
}
