package ai

import (
	"encoding/json"
	"strings"
	"testing"
	"valley-server/internal/mindarena"
)

func TestNormalizeGeneratedDebateMessagesRoundOne(t *testing.T) {
	t.Parallel()

	personas := defaultMindArenaPersonas()
	generated := []mindarena.DebateMessage{
		{PersonaID: "p2", PersonaName: "毒舌派", Content: "  别把一时上头误认成天命召唤。  "},
		{PersonaID: "p1", PersonaName: "理性派", Content: "先把风险和回报算清，再决定要不要上桌。"},
	}

	messages := normalizeGeneratedDebateMessages(generated, personas, 1)
	if len(messages) != 5 {
		t.Fatalf("expected 5 messages, got %d", len(messages))
	}
	if messages[0].PersonaName != "理性派" || messages[0].PersonaID != "p1" {
		t.Fatalf("expected persona order to follow canonical list, got %+v", messages[0])
	}
	if messages[1].Content != "别把一时上头误认成天命召唤。" {
		t.Fatalf("expected trimmed content, got %q", messages[1].Content)
	}
	if messages[4].PersonaName != "摆烂派" || messages[4].Content == "" {
		t.Fatalf("expected missing round one persona to use fallback line, got %+v", messages[4])
	}
}

func TestNormalizeGeneratedDebateMessagesTruncatesLongContent(t *testing.T) {
	t.Parallel()

	personas := defaultMindArenaPersonas()[:1]
	longContent := strings.Repeat("很长", 40)
	messages := normalizeGeneratedDebateMessages([]mindarena.DebateMessage{
		{PersonaID: "p1", PersonaName: "理性派", Content: longContent},
	}, personas, 1)

	if got := len([]rune(messages[0].Content)); got > maxDebateMessageRunes {
		t.Fatalf("expected content to be truncated to %d runes, got %d", maxDebateMessageRunes, got)
	}
}

func TestBuildDebateRoundPromptInput(t *testing.T) {
	t.Parallel()

	personas := defaultMindArenaPersonas()
	raw := buildDebateRoundPromptInput("要不要辞职", "serious", personas, 1, nil)

	var payload struct {
		Round       int                 `json:"round"`
		RoundGoal   string              `json:"roundGoal"`
		Constraints []string            `json:"constraints"`
		Personas    []mindarena.Persona `json:"personas"`
	}
	if err := json.Unmarshal([]byte(raw), &payload); err != nil {
		t.Fatalf("unmarshal prompt payload failed: %v", err)
	}
	if payload.Round != 1 {
		t.Fatalf("expected round 1, got %d", payload.Round)
	}
	if !strings.Contains(payload.RoundGoal, "开场亮立场") {
		t.Fatalf("expected round goal to describe stance opening, got %q", payload.RoundGoal)
	}
	if len(payload.Constraints) == 0 || !strings.Contains(strings.Join(payload.Constraints, "\n"), "Round 1 只做立场表达") {
		t.Fatalf("expected round one constraints, got %+v", payload.Constraints)
	}
	if len(payload.Personas) != 5 {
		t.Fatalf("expected 5 personas in prompt payload, got %d", len(payload.Personas))
	}
}
