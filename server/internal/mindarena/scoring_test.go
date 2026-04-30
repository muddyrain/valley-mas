package mindarena

import "testing"

func TestEvaluateLiveScoreStateIncludesAudienceSupport(t *testing.T) {
	session := testSession("deb_scoring_state", testPersonas())
	session.Messages = []DebateMessage{
		{Round: 1, PersonaID: "p1", PersonaName: "理性派", Content: "我支持先算成本、时间和风险，再决定要不要冲。"},
		{Round: 1, PersonaID: "p2", PersonaName: "毒舌派", Content: "别把一时上头当理想，先证明你不是想逃。"},
	}
	session.SupportHistory = []RoundSupportChoice{
		{Round: 1, PersonaID: "p2", PersonaName: "毒舌派", SupportScore: supportScoreForRound(1)},
	}

	scores, judge := evaluateLiveScoreState(session)
	if len(scores) != 2 {
		t.Fatalf("expected 2 live scores, got %+v", scores)
	}

	var rationalScore DebateScore
	var sharpScore DebateScore
	for _, score := range scores {
		switch score.PersonaID {
		case "p1":
			rationalScore = score
		case "p2":
			sharpScore = score
		}
	}

	if sharpScore.AudienceScore != supportScoreForRound(1) {
		t.Fatalf("expected毒舌派 audience score %d, got %+v", supportScoreForRound(1), sharpScore)
	}
	if sharpScore.Score <= sharpScore.JudgeScore {
		t.Fatalf("expected total score to include audience bonus, got %+v", sharpScore)
	}
	if rationalScore.AudienceScore != 0 {
		t.Fatalf("expected理性派 audience score 0, got %+v", rationalScore)
	}
	if judge == nil || judge.Name != "中立裁判" || judge.Summary == "" {
		t.Fatalf("expected neutral judge summary, got %+v", judge)
	}
}

func TestMemoryStoreRebuildsLiveScoresOnSupport(t *testing.T) {
	store := NewMemoryStore()
	session := testSession("deb_scoring_store", testPersonas())
	if err := store.Create(session); err != nil {
		t.Fatalf("create session failed: %v", err)
	}

	updated, err := store.AppendMessages("deb_scoring_store", []DebateMessage{
		{Round: 1, PersonaID: "p1", PersonaName: "理性派", Content: "我支持先把风险和退路讲明白。"},
		{Round: 1, PersonaID: "p2", PersonaName: "毒舌派", Content: "别拿热爱包装冲动，先证明你不是逃。"},
	})
	if err != nil {
		t.Fatalf("append messages failed: %v", err)
	}
	if len(updated.LiveScores) != 2 || updated.NeutralJudge == nil {
		t.Fatalf("expected live scores after append, got %+v", updated)
	}

	updated, err = store.SubmitRoundSupport("deb_scoring_store", RoundSupportChoice{
		Round:        1,
		PersonaID:    "p2",
		PersonaName:  "毒舌派",
		SupportScore: supportScoreForRound(1),
	})
	if err != nil {
		t.Fatalf("submit support failed: %v", err)
	}

	for _, score := range updated.LiveScores {
		if score.PersonaID == "p2" && score.AudienceScore != supportScoreForRound(1) {
			t.Fatalf("expected毒舌派 audience score to be rebuilt, got %+v", score)
		}
	}
}

func TestEvaluateLiveScoreStateUsesModeAwareJudgeBonus(t *testing.T) {
	session := testSession("deb_scoring_mode", testPersonas())
	session.Mode = DebateModeEmotion
	session.Messages = []DebateMessage{
		{Round: 1, PersonaID: "p1", PersonaName: "理性派", Content: "先把风险和成本算清，再看值不值得继续。"},
		{Round: 1, PersonaID: "p2", PersonaName: "毒舌派", Content: "你现在是又累又怕失望，别把情绪高峰当成真正答案。"},
	}

	scores, judge := evaluateLiveScoreState(session)
	if len(scores) != 2 {
		t.Fatalf("expected 2 scores, got %+v", scores)
	}
	if judge == nil || judge.Focus == "" || judge.Summary == "" {
		t.Fatalf("expected neutral judge state, got %+v", judge)
	}

	var sharpScore DebateScore
	for _, score := range scores {
		if score.PersonaID == "p2" {
			sharpScore = score
		}
	}
	if sharpScore.JudgeScore == 0 {
		t.Fatalf("expected emotion-focused line to receive judge score, got %+v", sharpScore)
	}
}

func TestRoundTwoAllianceMessageGetsJudgeNote(t *testing.T) {
	session := testSession("deb_scoring_alliance", testPersonas())
	session.Mode = DebateModeSharp
	session.Messages = []DebateMessage{
		{Round: 2, PersonaID: "p1", PersonaName: "理性派", Content: "父母派这点我认，先稳住没错，但稳到不敢动就是把机会白送出去。"},
		{Round: 2, PersonaID: "p2", PersonaName: "毒舌派", Content: "你别把害怕包装成成熟，这点我可不陪你演。"},
	}

	scores, _ := evaluateLiveScoreState(session)
	for _, score := range scores {
		if score.PersonaID == "p1" && score.JudgeNote == "" {
			t.Fatalf("expected alliance-style round two message to produce judge note, got %+v", score)
		}
	}
}
