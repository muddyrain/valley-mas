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

func TestBuildDebateRoundPromptInputRoundTwoIncludesRebuttalTargets(t *testing.T) {
	t.Parallel()

	personas := defaultMindArenaPersonas()
	history := []mindarena.DebateMessage{
		{Round: 1, PersonaID: "p1", PersonaName: "理性派", Content: "先把风险和现金流算清。"},
		{Round: 1, PersonaID: "p2", PersonaName: "毒舌派", Content: "别把逃避包装成理想。"},
		{Round: 1, PersonaID: "p3", PersonaName: "赌徒派", Content: "机会来了就要先上车。"},
		{Round: 1, PersonaID: "p4", PersonaName: "父母派", Content: "房租和保险先安排好。"},
		{Round: 1, PersonaID: "p5", PersonaName: "摆烂派", Content: "崩溃时别替人生拍板。"},
	}
	raw := buildDebateRoundPromptInput("要不要裸辞创业", "sharp", personas, 2, history)

	var payload struct {
		Round     int                       `json:"round"`
		RoundGoal string                    `json:"roundGoal"`
		Rebuttals []roundTwoRebuttalTarget  `json:"rebuttalTargets"`
		History   []mindarena.DebateMessage `json:"history"`
	}
	if err := json.Unmarshal([]byte(raw), &payload); err != nil {
		t.Fatalf("unmarshal prompt payload failed: %v", err)
	}
	if payload.Round != 2 {
		t.Fatalf("expected round 2, got %d", payload.Round)
	}
	if !strings.Contains(payload.RoundGoal, "rebuttalTargets") {
		t.Fatalf("expected round two goal to mention rebuttalTargets, got %q", payload.RoundGoal)
	}
	if len(payload.History) != len(history) {
		t.Fatalf("expected history to be included, got %d entries", len(payload.History))
	}
	if len(payload.Rebuttals) != len(personas) {
		t.Fatalf("expected one rebuttal target per persona, got %+v", payload.Rebuttals)
	}
	for _, target := range payload.Rebuttals {
		if target.PersonaID == target.TargetPersonaID {
			t.Fatalf("expected %s to target another persona, got self target %+v", target.PersonaName, target)
		}
		if strings.TrimSpace(target.TargetContent) == "" {
			t.Fatalf("expected target content for %+v", target)
		}
	}
}

func TestBuildDebateRoundPromptInputRoundThreeIncludesSummaryBriefs(t *testing.T) {
	t.Parallel()

	personas := defaultMindArenaPersonas()
	history := []mindarena.DebateMessage{
		{Round: 1, PersonaID: "p1", PersonaName: "理性派", Content: "先把风险和现金流算清。"},
		{Round: 1, PersonaID: "p2", PersonaName: "毒舌派", Content: "别把逃避包装成理想。"},
		{Round: 2, PersonaID: "p1", PersonaName: "理性派", Content: "赌徒派别只喊冲，风险不是背景音乐。"},
		{Round: 2, PersonaID: "p2", PersonaName: "毒舌派", Content: "理性派也别把人生算成表格。"},
	}
	raw := buildDebateRoundPromptInput("要不要裸辞创业", "serious", personas[:2], 3, history)

	var payload struct {
		Round       int                      `json:"round"`
		RoundGoal   string                   `json:"roundGoal"`
		Constraints []string                 `json:"constraints"`
		Summaries   []roundThreeSummaryBrief `json:"summaryBriefs"`
	}
	if err := json.Unmarshal([]byte(raw), &payload); err != nil {
		t.Fatalf("unmarshal prompt payload failed: %v", err)
	}
	if payload.Round != 3 {
		t.Fatalf("expected round 3, got %d", payload.Round)
	}
	if !strings.Contains(payload.RoundGoal, "summaryBriefs") {
		t.Fatalf("expected round three goal to mention summaryBriefs, got %q", payload.RoundGoal)
	}
	if !strings.Contains(strings.Join(payload.Constraints, "\n"), "不要宣布最终胜者") {
		t.Fatalf("expected round three constraints to defer judge result, got %+v", payload.Constraints)
	}
	if len(payload.Summaries) != 2 {
		t.Fatalf("expected one summary brief per persona, got %+v", payload.Summaries)
	}
	first := payload.Summaries[0]
	if first.PersonaName != "理性派" {
		t.Fatalf("expected first summary to follow persona order, got %+v", first)
	}
	if first.OpeningContent != "先把风险和现金流算清。" {
		t.Fatalf("expected round one content in opening summary, got %q", first.OpeningContent)
	}
	if first.RebuttalContent != "赌徒派别只喊冲，风险不是背景音乐。" {
		t.Fatalf("expected round two content in rebuttal summary, got %q", first.RebuttalContent)
	}
	if strings.TrimSpace(first.AdviceFocus) == "" {
		t.Fatalf("expected advice focus, got %+v", first)
	}
}
