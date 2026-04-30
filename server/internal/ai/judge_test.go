package ai

import (
	"encoding/json"
	"strings"
	"testing"
	"valley-server/internal/mindarena"
)

func TestBuildJudgePromptInput(t *testing.T) {
	t.Parallel()

	personas := defaultMindArenaPersonas()[:2]
	messages := []mindarena.DebateMessage{
		{Round: 1, PersonaID: "p1", PersonaName: "理性派", Content: "先把现金流算清。"},
		{Round: 3, PersonaID: "p2", PersonaName: "毒舌派", Content: "别把逃避包装成理想。"},
	}
	raw := buildJudgePromptInput("要不要裸辞创业", personas, messages)

	var payload struct {
		Topic       string                    `json:"topic"`
		JudgeGoal   string                    `json:"judgeGoal"`
		Constraints []string                  `json:"constraints"`
		ScoreRules  []string                  `json:"scoreRules"`
		Personas    []mindarena.Persona       `json:"personas"`
		Messages    []mindarena.DebateMessage `json:"messages"`
	}
	if err := json.Unmarshal([]byte(raw), &payload); err != nil {
		t.Fatalf("unmarshal judge prompt payload failed: %v", err)
	}
	if payload.Topic != "要不要裸辞创业" {
		t.Fatalf("unexpected topic %q", payload.Topic)
	}
	if !strings.Contains(payload.JudgeGoal, "最终胜者") {
		t.Fatalf("expected judge goal to describe winner selection, got %q", payload.JudgeGoal)
	}
	if !strings.Contains(strings.Join(payload.Constraints, "\n"), "winner 必须是 personas 中的 name") {
		t.Fatalf("expected winner constraint, got %+v", payload.Constraints)
	}
	if !strings.Contains(strings.Join(payload.ScoreRules, "\n"), "最高分人格应与 winner 一致") {
		t.Fatalf("expected score rule, got %+v", payload.ScoreRules)
	}
	if len(payload.Personas) != len(personas) || len(payload.Messages) != len(messages) {
		t.Fatalf("expected personas and messages in payload, got %+v", payload)
	}
}

func TestNormalizeGeneratedDebateResult(t *testing.T) {
	t.Parallel()

	personas := defaultMindArenaPersonas()[:3]
	messages := []mindarena.DebateMessage{
		{Round: 3, PersonaID: "p1", PersonaName: "理性派", Content: "先按最小成本验证，再决定是否加码。"},
	}
	result := normalizeGeneratedDebateResult(mindarena.DebateResult{
		Winner:      "不存在的人格",
		FinalAdvice: "  先验证，再加码。  ",
		Quote:       strings.Repeat("金句", 40),
		Scores: []mindarena.DebateScore{
			{Persona: "理性派", Score: 101},
			{Persona: "毒舌派", Score: -5},
		},
	}, personas, messages)

	if result.Winner != "理性派" {
		t.Fatalf("expected invalid winner to fall back to highest score persona, got %q", result.Winner)
	}
	if result.FinalAdvice != "先验证，再加码。" {
		t.Fatalf("expected trimmed final advice, got %q", result.FinalAdvice)
	}
	if len([]rune(result.Quote)) > maxJudgeQuoteRunes {
		t.Fatalf("expected quote to be truncated, got %q", result.Quote)
	}
	if len(result.Scores) != len(personas) {
		t.Fatalf("expected scores for every persona, got %+v", result.Scores)
	}
	if result.Scores[0].Persona != "理性派" || result.Scores[0].Score != 100 {
		t.Fatalf("expected first score to be clamped and aligned, got %+v", result.Scores[0])
	}
	if result.Scores[1].Persona != "毒舌派" || result.Scores[1].Score != 0 {
		t.Fatalf("expected second score to be clamped and aligned, got %+v", result.Scores[1])
	}
	if result.Scores[2].Persona != "赌徒派" || result.Scores[2].Score == 0 {
		t.Fatalf("expected missing score to use fallback, got %+v", result.Scores[2])
	}
}
