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
	if !strings.Contains(messages[1].Content, "逃跑") {
		t.Fatalf("expected weak short output to fall back to richer persona line, got %q", messages[1].Content)
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
	raw := buildDebateRoundPromptInput("要不要辞职", "serious", personas, 1, nil, nil)

	var payload struct {
		Round       int                 `json:"round"`
		ModeGuide   string              `json:"modeGuide"`
		RoundGoal   string              `json:"roundGoal"`
		Constraints []string            `json:"constraints"`
		VoiceHints  []personaVoiceHint  `json:"personaVoiceHints"`
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
	joinedConstraints := strings.Join(payload.Constraints, "\n")
	if len(payload.Constraints) == 0 || !strings.Contains(joinedConstraints, "Round 1 只做立场表达") {
		t.Fatalf("expected round one constraints, got %+v", payload.Constraints)
	}
	if !strings.Contains(joinedConstraints, "35 到 70 个中文字符") || !strings.Contains(joinedConstraints, "catchphrase 只是出场口号") {
		t.Fatalf("expected stronger length and voice constraints, got %+v", payload.Constraints)
	}
	if !strings.Contains(payload.ModeGuide, "严肃理性风") {
		t.Fatalf("expected mode guide in prompt payload, got %q", payload.ModeGuide)
	}
	if len(payload.Personas) != 5 {
		t.Fatalf("expected 5 personas in prompt payload, got %d", len(payload.Personas))
	}
	if len(payload.VoiceHints) != len(payload.Personas) || !strings.Contains(payload.VoiceHints[0].Voice, "出场口号") {
		t.Fatalf("expected persona voice hints in payload, got %+v", payload.VoiceHints)
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
	raw := buildDebateRoundPromptInput("要不要裸辞创业", "sharp", personas, 2, history, nil)

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
	raw := buildDebateRoundPromptInput("要不要裸辞创业", "serious", personas[:2], 3, history, nil)

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

func TestBuildDebateMessagePromptInputRoundTwoIncludesCurrentPersonaAndRebuttalTarget(t *testing.T) {
	t.Parallel()

	personas := defaultMindArenaPersonas()
	history := []mindarena.DebateMessage{
		{Round: 1, PersonaID: "p1", PersonaName: "理性派", Content: "先把风险和现金流算清。"},
		{Round: 1, PersonaID: "p2", PersonaName: "毒舌派", Content: "别把逃避包装成理想。"},
		{Round: 1, PersonaID: "p3", PersonaName: "赌徒派", Content: "机会来了就要先上车。"},
	}

	raw := buildDebateMessagePromptInput("要不要裸辞创业", "sharp", personas[:3], personas[0], 2, history, nil)

	var payload struct {
		Round          int                       `json:"round"`
		ModeGuide      string                    `json:"modeGuide"`
		Constraints    []string                  `json:"constraints"`
		CurrentPersona mindarena.Persona         `json:"currentPersona"`
		CurrentVoice   string                    `json:"currentPersonaVoice"`
		RebuttalTarget *roundTwoRebuttalTarget   `json:"rebuttalTarget"`
		History        []mindarena.DebateMessage `json:"history"`
	}
	if err := json.Unmarshal([]byte(raw), &payload); err != nil {
		t.Fatalf("unmarshal prompt payload failed: %v", err)
	}
	if payload.Round != 2 {
		t.Fatalf("expected round 2, got %d", payload.Round)
	}
	if payload.CurrentPersona.Name != "理性派" {
		t.Fatalf("expected current persona to be 理性派, got %+v", payload.CurrentPersona)
	}
	if !strings.Contains(strings.Join(payload.Constraints, "\n"), "只输出 currentPersona 的一条 messages JSON") {
		t.Fatalf("expected single-message constraint, got %+v", payload.Constraints)
	}
	if !strings.Contains(payload.ModeGuide, "锋利对线风") {
		t.Fatalf("expected sharp mode guide, got %q", payload.ModeGuide)
	}
	if !strings.Contains(payload.CurrentVoice, payload.CurrentPersona.Catchphrase) {
		t.Fatalf("expected current persona voice guide to include catchphrase, got %q", payload.CurrentVoice)
	}
	if payload.RebuttalTarget == nil || payload.RebuttalTarget.PersonaName != "理性派" {
		t.Fatalf("expected rebuttal target for current persona, got %+v", payload.RebuttalTarget)
	}
	if payload.RebuttalTarget.TargetPersonaName == payload.CurrentPersona.Name {
		t.Fatalf("expected rebuttal target to point to another persona, got %+v", payload.RebuttalTarget)
	}
	if len(payload.History) != len(history) {
		t.Fatalf("expected history to be included, got %+v", payload.History)
	}
}

func TestBuildDebateMessagePromptInputRoundThreeIncludesSummaryBrief(t *testing.T) {
	t.Parallel()

	personas := defaultMindArenaPersonas()[:2]
	history := []mindarena.DebateMessage{
		{Round: 1, PersonaID: "p1", PersonaName: "理性派", Content: "先把风险和现金流算清。"},
		{Round: 1, PersonaID: "p2", PersonaName: "毒舌派", Content: "别把逃避包装成理想。"},
		{Round: 2, PersonaID: "p1", PersonaName: "理性派", Content: "赌徒派别只喊冲，风险不是背景音乐。"},
		{Round: 2, PersonaID: "p2", PersonaName: "毒舌派", Content: "理性派也别把人生算成表格。"},
	}

	raw := buildDebateMessagePromptInput("要不要裸辞创业", "serious", personas, personas[1], 3, history, nil)

	var payload struct {
		Round          int                     `json:"round"`
		CurrentPersona mindarena.Persona       `json:"currentPersona"`
		CurrentVoice   string                  `json:"currentPersonaVoice"`
		SummaryBrief   *roundThreeSummaryBrief `json:"summaryBrief"`
	}
	if err := json.Unmarshal([]byte(raw), &payload); err != nil {
		t.Fatalf("unmarshal prompt payload failed: %v", err)
	}
	if payload.Round != 3 {
		t.Fatalf("expected round 3, got %d", payload.Round)
	}
	if payload.CurrentPersona.Name != "毒舌派" {
		t.Fatalf("expected current persona to be 毒舌派, got %+v", payload.CurrentPersona)
	}
	if !strings.Contains(payload.CurrentVoice, payload.CurrentPersona.Style) {
		t.Fatalf("expected current voice to include persona style, got %q", payload.CurrentVoice)
	}
	if payload.SummaryBrief == nil {
		t.Fatal("expected summary brief for current persona")
	}
	if payload.SummaryBrief.PersonaName != "毒舌派" {
		t.Fatalf("expected summary brief to follow current persona, got %+v", payload.SummaryBrief)
	}
	if payload.SummaryBrief.OpeningContent != "别把逃避包装成理想。" {
		t.Fatalf("expected opening content to be included, got %q", payload.SummaryBrief.OpeningContent)
	}
	if payload.SummaryBrief.RebuttalContent != "理性派也别把人生算成表格。" {
		t.Fatalf("expected rebuttal content to be included, got %q", payload.SummaryBrief.RebuttalContent)
	}
	if strings.TrimSpace(payload.SummaryBrief.AdviceFocus) == "" {
		t.Fatalf("expected advice focus, got %+v", payload.SummaryBrief)
	}
}

func TestBuildDebateMessagePromptInputIncludesAudienceSupportContext(t *testing.T) {
	t.Parallel()

	personas := defaultMindArenaPersonas()[:2]
	history := []mindarena.DebateMessage{
		{Round: 1, PersonaID: "p1", PersonaName: "理性派", Content: "先把风险和现金流算清。"},
		{Round: 1, PersonaID: "p2", PersonaName: "毒舌派", Content: "别把逃避包装成理想。"},
	}
	supportHistory := []mindarena.RoundSupportChoice{
		{Round: 1, PersonaID: "p2", PersonaName: "毒舌派", CreatedAt: "2026-04-30T20:20:20Z"},
	}

	raw := buildDebateMessagePromptInput("要不要裸辞创业", "sharp", personas, personas[0], 2, history, supportHistory)

	var payload struct {
		LatestAudienceSupport *audienceSupportContext        `json:"latestAudienceSupport"`
		SupportHistory        []mindarena.RoundSupportChoice `json:"supportHistory"`
	}
	if err := json.Unmarshal([]byte(raw), &payload); err != nil {
		t.Fatalf("unmarshal prompt payload failed: %v", err)
	}
	if payload.LatestAudienceSupport == nil {
		t.Fatal("expected latestAudienceSupport in payload")
	}
	if payload.LatestAudienceSupport.SupportedPersonaName != "毒舌派" {
		t.Fatalf("expected supported persona name, got %+v", payload.LatestAudienceSupport)
	}
	if payload.LatestAudienceSupport.CurrentPersonaSupported {
		t.Fatalf("expected 理性派 to know it was not supported, got %+v", payload.LatestAudienceSupport)
	}
	if !strings.Contains(payload.LatestAudienceSupport.ResponseGoal, "争宠") && !strings.Contains(payload.LatestAudienceSupport.ResponseGoal, "拉票") {
		t.Fatalf("expected support context to mention争宠/拉票, got %+v", payload.LatestAudienceSupport)
	}
	if len(payload.SupportHistory) != 1 {
		t.Fatalf("expected support history to be preserved, got %+v", payload.SupportHistory)
	}
}

func TestBuildDebateMessagePromptInputIncludesSkippedAudienceSupportContext(t *testing.T) {
	t.Parallel()

	personas := defaultMindArenaPersonas()[:1]
	supportHistory := []mindarena.RoundSupportChoice{
		{Round: 2, Skipped: true, CreatedAt: "2026-04-30T20:21:20Z"},
	}

	raw := buildDebateMessagePromptInput("要不要裸辞创业", "serious", personas, personas[0], 3, nil, supportHistory)

	var payload struct {
		LatestAudienceSupport *audienceSupportContext `json:"latestAudienceSupport"`
	}
	if err := json.Unmarshal([]byte(raw), &payload); err != nil {
		t.Fatalf("unmarshal prompt payload failed: %v", err)
	}
	if payload.LatestAudienceSupport == nil || !payload.LatestAudienceSupport.Skipped {
		t.Fatalf("expected skipped audience support context, got %+v", payload.LatestAudienceSupport)
	}
	if !strings.Contains(payload.LatestAudienceSupport.ResponseGoal, "没有明确站队") {
		t.Fatalf("expected skipped response goal, got %+v", payload.LatestAudienceSupport)
	}
}
