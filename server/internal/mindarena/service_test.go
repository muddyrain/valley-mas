package mindarena

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"testing"
	"time"
)

type streamStubAI struct {
	generatePersonas func(ctx context.Context, topic string, mode string, count int) ([]Persona, error)
	generatePersona  func(ctx context.Context, topic string, mode string, persona Persona, index int, count int) (*Persona, error)
	generateRound    func(ctx context.Context, topic string, mode string, personas []Persona, round int, history []DebateMessage, supportHistory []RoundSupportChoice) ([]DebateMessage, error)
	generateMessage  func(ctx context.Context, topic string, mode string, personas []Persona, persona Persona, round int, history []DebateMessage, supportHistory []RoundSupportChoice) (*DebateMessage, error)
	judgeDebate      func(ctx context.Context, topic string, personas []Persona, messages []DebateMessage) (*DebateResult, error)
}

func (s streamStubAI) GeneratePersonas(ctx context.Context, topic string, mode string, count int) ([]Persona, error) {
	return s.generatePersonas(ctx, topic, mode, count)
}

func (s streamStubAI) GeneratePersona(ctx context.Context, topic string, mode string, persona Persona, index int, count int) (*Persona, error) {
	if s.generatePersona != nil {
		return s.generatePersona(ctx, topic, mode, persona, index, count)
	}
	return &persona, nil
}

func (s streamStubAI) GenerateDebateRound(ctx context.Context, topic string, mode string, personas []Persona, round int, history []DebateMessage, supportHistory []RoundSupportChoice) ([]DebateMessage, error) {
	return s.generateRound(ctx, topic, mode, personas, round, history, supportHistory)
}

func (s streamStubAI) GenerateDebateMessage(ctx context.Context, topic string, mode string, personas []Persona, persona Persona, round int, history []DebateMessage, supportHistory []RoundSupportChoice) (*DebateMessage, error) {
	if s.generateMessage != nil {
		return s.generateMessage(ctx, topic, mode, personas, persona, round, history, supportHistory)
	}
	messages, err := s.GenerateDebateRound(ctx, topic, mode, personas, round, history, supportHistory)
	if err != nil || len(messages) == 0 {
		return nil, err
	}
	for i := range messages {
		if messages[i].PersonaID == persona.ID || messages[i].PersonaName == persona.Name {
			return &messages[i], nil
		}
	}
	return &messages[0], nil
}

func (s streamStubAI) JudgeDebate(ctx context.Context, topic string, personas []Persona, messages []DebateMessage) (*DebateResult, error) {
	return s.judgeDebate(ctx, topic, personas, messages)
}

func TestCreateDebateStartsWithEmptyPersonas(t *testing.T) {
	service := NewService(NewMemoryStore(), streamStubAI{
		generatePersonas: func(ctx context.Context, topic string, mode string, count int) ([]Persona, error) {
			t.Fatal("CreateDebate should not wait for AI persona generation")
			return nil, nil
		},
		generatePersona: func(ctx context.Context, topic string, mode string, persona Persona, index int, count int) (*Persona, error) {
			t.Fatal("CreateDebate should not wait for AI persona generation")
			return nil, nil
		},
		generateRound: func(ctx context.Context, topic string, mode string, personas []Persona, round int, history []DebateMessage, supportHistory []RoundSupportChoice) ([]DebateMessage, error) {
			return nil, nil
		},
		judgeDebate: func(ctx context.Context, topic string, personas []Persona, messages []DebateMessage) (*DebateResult, error) {
			return nil, nil
		},
	})

	resp, err := service.CreateDebate(context.Background(), CreateDebateRequest{
		Topic:        "要不要裸辞创业",
		Mode:         "funny",
		PersonaCount: 5,
	})
	if err != nil {
		t.Fatalf("CreateDebate returned error: %v", err)
	}
	if resp.SessionID == "" || resp.PersonaCount != 5 || len(resp.Personas) != 0 {
		t.Fatalf("expected created session with empty personas, got %+v", resp)
	}

	session, err := service.GetDebate(resp.SessionID)
	if err != nil {
		t.Fatalf("GetDebate returned error: %v", err)
	}
	if session.PersonaCount != 5 || len(session.Personas) != 0 || session.CurrentRound != 1 {
		t.Fatalf("expected persisted session with empty personas, got %+v", session)
	}
}

func TestStreamDebateEmitsMessageJudgeAndDoneEvents(t *testing.T) {
	restore := disableStreamDelays(t)
	defer restore()

	personas := testPersonas()
	store := NewMemoryStore()
	session := testSession("deb_stream_ok", nil)
	session.PersonaCount = len(personas)
	if err := store.Create(session); err != nil {
		t.Fatalf("create session failed: %v", err)
	}

	service := NewService(store, streamStubAI{
		generatePersonas: func(ctx context.Context, topic string, mode string, count int) ([]Persona, error) {
			t.Fatal("StreamDebate should reveal personas one by one")
			return nil, nil
		},
		generatePersona: func(ctx context.Context, topic string, mode string, persona Persona, index int, count int) (*Persona, error) {
			if index == 0 {
				time.Sleep(20 * time.Millisecond)
			}
			generated := persona
			if index == 0 {
				generated.Catchphrase = "先试小步"
			}
			return &generated, nil
		},
		generateRound: func(ctx context.Context, topic string, mode string, personas []Persona, round int, history []DebateMessage, supportHistory []RoundSupportChoice) ([]DebateMessage, error) {
			t.Fatal("StreamDebate should generate debate messages one by one")
			return nil, nil
		},
		generateMessage: func(ctx context.Context, topic string, mode string, personas []Persona, persona Persona, round int, history []DebateMessage, supportHistory []RoundSupportChoice) (*DebateMessage, error) {
			return &DebateMessage{
				PersonaID:   persona.ID,
				PersonaName: persona.Name,
				Content:     fmt.Sprintf("%s 第 %d 轮发言", persona.Name, round),
			}, nil
		},
		judgeDebate: func(ctx context.Context, topic string, personas []Persona, messages []DebateMessage) (*DebateResult, error) {
			if len(messages) != 6 {
				t.Fatalf("expected judge to receive 6 streamed messages, got %d", len(messages))
			}
			return &DebateResult{
				Winner:      "理性派",
				FinalAdvice: "先验证，再行动。",
				Quote:       "先算账，再谈梦想。",
				Scores: []DebateScore{
					{Persona: "理性派", Score: 88},
					{Persona: "毒舌派", Score: 76},
				},
			}, nil
		},
	})

	roundOneEvents := collectStreamEvents(t, service.StreamDebate(context.Background(), "deb_stream_ok"))
	if got := roundOneEvents[len(roundOneEvents)-1].Type; got != "support_prompt" {
		t.Fatalf("expected round 2 to pause for support (round 1 should not pause), got %+v", roundOneEvents)
	}
	// Round 1 和 Round 2 连续执行，support_prompt 在 Round 2 结束后触发，共 4 条 message
	if err := assertMessageCount(roundOneEvents, len(personas)*2); err != nil {
		t.Fatal(err)
	}
	if _, err := service.SubmitRoundSupport(context.Background(), "deb_stream_ok", SubmitRoundSupportRequest{
		Round:              2,
		SupportedPersonaID: "p1",
	}); err != nil {
		t.Fatalf("submit round 2 support failed: %v", err)
	}

	roundThreeEvents := collectStreamEvents(t, service.StreamDebate(context.Background(), "deb_stream_ok"))
	if err := assertMessageRounds(roundThreeEvents, 3, len(personas)); err != nil {
		t.Fatal(err)
	}
	if roundThreeEvents[len(roundThreeEvents)-2].Type != "judge" || roundThreeEvents[len(roundThreeEvents)-2].Result == nil {
		t.Fatalf("expected judge event with result, got %+v", roundThreeEvents[len(roundThreeEvents)-2])
	}
	judgeResult := roundThreeEvents[len(roundThreeEvents)-2].Result
	if judgeResult.Winner == "" {
		t.Fatalf("expected winner in judge result, got %+v", judgeResult)
	}
	bestScore := judgeResult.Scores[0]
	for _, score := range judgeResult.Scores[1:] {
		if score.Score > bestScore.Score {
			bestScore = score
		}
	}
	if judgeResult.Winner != bestScore.Persona {
		t.Fatalf("expected winner to align with highest score, got winner=%s scores=%+v", judgeResult.Winner, judgeResult.Scores)
	}
	if roundThreeEvents[len(roundThreeEvents)-1].Type != "done" || roundThreeEvents[len(roundThreeEvents)-1].SessionID != "deb_stream_ok" {
		t.Fatalf("expected done event with session id, got %+v", roundThreeEvents[len(roundThreeEvents)-1])
	}

	session, err := store.Get("deb_stream_ok")
	if err != nil {
		t.Fatalf("get session failed: %v", err)
	}
	if session.Status != DebateStatusDone || len(session.Messages) != 6 || session.Result == nil || len(session.SupportHistory) != 1 {
		t.Fatalf("expected completed persisted session with 1 support entry, got status=%s messages=%d result=%v support=%d", session.Status, len(session.Messages), session.Result, len(session.SupportHistory))
	}
	firstPersona, ok := findPersonaByID(session.Personas, "p1")
	if !ok || firstPersona.Catchphrase != "先试小步" {
		t.Fatalf("expected updated first persona to be persisted, got %+v", session.Personas)
	}
}

func TestStreamDebateEmitsPersonasAsSoonAsTheyAreReady(t *testing.T) {
	restore := disableStreamDelays(t)
	defer restore()

	personas := testPersonas()
	store := NewMemoryStore()
	session := testSession("deb_first_persona_fast", nil)
	session.PersonaCount = len(personas)
	if err := store.Create(session); err != nil {
		t.Fatalf("create session failed: %v", err)
	}

	service := NewService(store, streamStubAI{
		generatePersonas: func(ctx context.Context, topic string, mode string, count int) ([]Persona, error) {
			t.Fatal("StreamDebate should not use batch persona generation")
			return nil, nil
		},
		generatePersona: func(ctx context.Context, topic string, mode string, persona Persona, index int, count int) (*Persona, error) {
			if index == 0 {
				time.Sleep(30 * time.Millisecond)
			}
			return &persona, nil
		},
		generateRound: func(ctx context.Context, topic string, mode string, personas []Persona, round int, history []DebateMessage, supportHistory []RoundSupportChoice) ([]DebateMessage, error) {
			t.Fatal("StreamDebate should not use batch round generation")
			return nil, nil
		},
		generateMessage: func(ctx context.Context, topic string, mode string, personas []Persona, persona Persona, round int, history []DebateMessage, supportHistory []RoundSupportChoice) (*DebateMessage, error) {
			return &DebateMessage{PersonaID: persona.ID, PersonaName: persona.Name, Content: "发言"}, nil
		},
		judgeDebate: func(ctx context.Context, topic string, personas []Persona, messages []DebateMessage) (*DebateResult, error) {
			return &DebateResult{Winner: personas[0].Name, FinalAdvice: "先看第一位。", Quote: "先有人入场。"}, nil
		},
	})

	stream := service.StreamDebate(context.Background(), "deb_first_persona_fast")
	firstEvent := waitForStreamEvent(t, stream)
	if firstEvent.Type != "personas" || len(firstEvent.Personas) != 1 || firstEvent.PersonaCount != len(personas) {
		t.Fatalf("expected first personas event to reveal one persona, got %+v", firstEvent)
	}
	if firstEvent.Personas[0].ID != "p2" {
		t.Fatalf("expected the faster persona to be pushed first, got %+v", firstEvent)
	}
	secondEvent := waitForStreamEvent(t, stream)
	if secondEvent.Type != "personas" || len(secondEvent.Personas) != len(personas) {
		t.Fatalf("expected second personas event to reveal all personas, got %+v", secondEvent)
	}
	thirdEvent := waitForStreamEvent(t, stream)
	if thirdEvent.Type != "message" {
		t.Fatalf("expected debate messages after persona reveal, got %+v", thirdEvent)
	}
	_ = collectRemainingStreamEvents(t, stream)
}

func TestStreamDebateStartsPersonaGenerationConcurrently(t *testing.T) {
	restore := disableStreamDelays(t)
	defer restore()

	personas := testPersonas()
	store := NewMemoryStore()
	session := testSession("deb_persona_concurrent", nil)
	session.PersonaCount = len(personas)
	if err := store.Create(session); err != nil {
		t.Fatalf("create session failed: %v", err)
	}

	releaseFirst := make(chan struct{})
	secondStarted := make(chan struct{}, 1)
	var mu sync.Mutex
	startedIndexes := make([]int, 0, len(personas))

	service := NewService(store, streamStubAI{
		generatePersonas: func(ctx context.Context, topic string, mode string, count int) ([]Persona, error) {
			t.Fatal("StreamDebate should not use batch persona generation")
			return nil, nil
		},
		generatePersona: func(ctx context.Context, topic string, mode string, persona Persona, index int, count int) (*Persona, error) {
			mu.Lock()
			startedIndexes = append(startedIndexes, index)
			startedCount := len(startedIndexes)
			mu.Unlock()

			if startedCount == len(personas) {
				select {
				case secondStarted <- struct{}{}:
				default:
				}
			}

			if index == 0 {
				select {
				case <-releaseFirst:
				case <-ctx.Done():
					return nil, ctx.Err()
				}
			}
			return &persona, nil
		},
		generateRound: func(ctx context.Context, topic string, mode string, personas []Persona, round int, history []DebateMessage, supportHistory []RoundSupportChoice) ([]DebateMessage, error) {
			t.Fatal("StreamDebate should not use batch round generation")
			return nil, nil
		},
		generateMessage: func(ctx context.Context, topic string, mode string, personas []Persona, persona Persona, round int, history []DebateMessage, supportHistory []RoundSupportChoice) (*DebateMessage, error) {
			return &DebateMessage{PersonaID: persona.ID, PersonaName: persona.Name, Content: "发言"}, nil
		},
		judgeDebate: func(ctx context.Context, topic string, personas []Persona, messages []DebateMessage) (*DebateResult, error) {
			return &DebateResult{Winner: personas[0].Name, FinalAdvice: "先并发。", Quote: "一起开跑。"}, nil
		},
	})

	stream := service.StreamDebate(context.Background(), "deb_persona_concurrent")

	select {
	case <-secondStarted:
	case <-time.After(500 * time.Millisecond):
		t.Fatal("expected all persona generation requests to start before first one finishes")
	}

	close(releaseFirst)
	_ = collectStreamEvents(t, stream)
}

func TestStreamDebateEmitsErrorWhenDebateIsMissing(t *testing.T) {
	restore := disableStreamDelays(t)
	defer restore()

	service := NewService(NewMemoryStore(), streamStubAI{})
	events := collectStreamEvents(t, service.StreamDebate(context.Background(), "missing"))
	if len(events) != 1 {
		t.Fatalf("expected one error event, got %+v", events)
	}
	if events[0].Type != "error" || events[0].Message != "没有找到这场脑内会议" {
		t.Fatalf("unexpected missing debate event: %+v", events[0])
	}
}

func TestStreamDebateGeneratesMessagesOneByOneAndUpdatesHistory(t *testing.T) {
	restore := disableStreamDelays(t)
	defer restore()

	personas := testPersonas()
	store := NewMemoryStore()
	session := testSession("deb_history_incremental", personas)
	session.PersonaCount = len(personas)
	if err := store.Create(session); err != nil {
		t.Fatalf("create session failed: %v", err)
	}

	type historySnapshot struct {
		round              int
		personaName        string
		historyLen         int
		lastContent        string
		latestSupportRound int
		latestSupportName  string
		latestSupportSkip  bool
	}

	var snapshots []historySnapshot
	service := NewService(store, streamStubAI{
		generatePersonas: func(ctx context.Context, topic string, mode string, count int) ([]Persona, error) {
			t.Fatal("StreamDebate should not regenerate personas when session already has personas")
			return nil, nil
		},
		generatePersona: func(ctx context.Context, topic string, mode string, persona Persona, index int, count int) (*Persona, error) {
			t.Fatal("StreamDebate should not regenerate personas when session already has personas")
			return nil, nil
		},
		generateRound: func(ctx context.Context, topic string, mode string, personas []Persona, round int, history []DebateMessage, supportHistory []RoundSupportChoice) ([]DebateMessage, error) {
			t.Fatal("StreamDebate should not use batch round generation")
			return nil, nil
		},
		generateMessage: func(ctx context.Context, topic string, mode string, personas []Persona, persona Persona, round int, history []DebateMessage, supportHistory []RoundSupportChoice) (*DebateMessage, error) {
			snapshot := historySnapshot{
				round:       round,
				personaName: persona.Name,
				historyLen:  len(history),
			}
			if len(history) > 0 {
				snapshot.lastContent = history[len(history)-1].Content
			}
			if len(supportHistory) > 0 {
				latestSupport := supportHistory[len(supportHistory)-1]
				snapshot.latestSupportRound = latestSupport.Round
				snapshot.latestSupportName = latestSupport.PersonaName
				snapshot.latestSupportSkip = latestSupport.Skipped
			}
			snapshots = append(snapshots, snapshot)
			// p1 使用较长内容，保证评分高于 p2，避免 Round 3 出现平局触发加时
			content := fmt.Sprintf("%s 第 %d 轮发言", persona.Name, round)
			if persona.ID == "p1" {
				content = fmt.Sprintf("%s 第 %d 轮发言，观点明确论据充分", persona.Name, round)
			}
			return &DebateMessage{
				PersonaID:   persona.ID,
				PersonaName: persona.Name,
				Content:     content,
			}, nil
		},
		judgeDebate: func(ctx context.Context, topic string, personas []Persona, messages []DebateMessage) (*DebateResult, error) {
			return &DebateResult{Winner: personas[0].Name, FinalAdvice: "继续推进。", Quote: "先说，再接。"}, nil
		},
	})

	events := collectStreamEvents(t, service.StreamDebate(context.Background(), "deb_history_incremental"))
	if events[len(events)-1].Type != "support_prompt" {
		t.Fatalf("expected round 2 support prompt (rounds 1+2 run together), got %+v", events)
	}
	// Round 1 和 Round 2 连续执行，在 Round 2 结束后暂停
	if _, err := service.SubmitRoundSupport(context.Background(), "deb_history_incremental", SubmitRoundSupportRequest{
		Round: 2,
		Skip:  true,
	}); err != nil {
		t.Fatalf("submit round 2 support failed: %v", err)
	}
	events = collectStreamEvents(t, service.StreamDebate(context.Background(), "deb_history_incremental"))
	if events[len(events)-1].Type != "done" {
		t.Fatalf("expected final done event, got %+v", events)
	}

	expected := []historySnapshot{
		{round: 1, personaName: "理性派", historyLen: 0, lastContent: ""},
		{round: 1, personaName: "毒舌派", historyLen: 1, lastContent: "理性派 第 1 轮发言，观点明确论据充分"},
		{round: 2, personaName: "理性派", historyLen: 2, lastContent: "毒舌派 第 1 轮发言"},
		{round: 2, personaName: "毒舌派", historyLen: 3, lastContent: "理性派 第 2 轮发言，观点明确论据充分"},
		{round: 3, personaName: "理性派", historyLen: 4, lastContent: "毒舌派 第 2 轮发言", latestSupportRound: 2, latestSupportSkip: true},
		{round: 3, personaName: "毒舌派", historyLen: 5, lastContent: "理性派 第 3 轮发言，观点明确论据充分", latestSupportRound: 2, latestSupportSkip: true},
	}
	if len(snapshots) != len(expected) {
		t.Fatalf("expected %d message generations, got %+v", len(expected), snapshots)
	}
	for i := range expected {
		if snapshots[i] != expected[i] {
			t.Fatalf("snapshot %d = %+v, want %+v", i, snapshots[i], expected[i])
		}
	}
}

func TestStreamDebateEmitsErrorAndMarksFailedWhenPersonaGenerationFails(t *testing.T) {
	restore := disableStreamDelays(t)
	defer restore()

	personas := testPersonas()
	store := NewMemoryStore()
	session := testSession("deb_persona_failed", nil)
	session.PersonaCount = len(personas)
	if err := store.Create(session); err != nil {
		t.Fatalf("create session failed: %v", err)
	}

	service := NewService(store, streamStubAI{
		generatePersonas: func(ctx context.Context, topic string, mode string, count int) ([]Persona, error) {
			t.Fatal("StreamDebate should not batch persona generation")
			return nil, nil
		},
		generatePersona: func(ctx context.Context, topic string, mode string, persona Persona, index int, count int) (*Persona, error) {
			if index == 1 {
				time.Sleep(10 * time.Millisecond)
			}
			if index == 1 {
				return nil, errors.New("persona model offline")
			}
			generated := persona
			generated.Catchphrase = "先试小步"
			return &generated, nil
		},
		generateRound: func(ctx context.Context, topic string, mode string, personas []Persona, round int, history []DebateMessage, supportHistory []RoundSupportChoice) ([]DebateMessage, error) {
			t.Fatal("round generation should not run when persona generation fails")
			return nil, nil
		},
		generateMessage: func(ctx context.Context, topic string, mode string, personas []Persona, persona Persona, round int, history []DebateMessage, supportHistory []RoundSupportChoice) (*DebateMessage, error) {
			t.Fatal("message generation should not run when persona generation fails")
			return nil, nil
		},
		judgeDebate: func(ctx context.Context, topic string, personas []Persona, messages []DebateMessage) (*DebateResult, error) {
			t.Fatal("judge should not run when persona generation fails")
			return nil, nil
		},
	})

	events := collectStreamEvents(t, service.StreamDebate(context.Background(), "deb_persona_failed"))
	if len(events) != 2 {
		t.Fatalf("expected first personas event and one error, got %+v", events)
	}
	if events[0].Type != "personas" || len(events[0].Personas) != 1 || events[0].PersonaCount != len(personas) {
		t.Fatalf("expected first personas event to persist one generated persona, got %+v", events[0])
	}
	if events[1].Type != "error" || events[1].Message == "" {
		t.Fatalf("expected error event after persona generation failure, got %+v", events[1])
	}

	sessionAfter, err := store.Get("deb_persona_failed")
	if err != nil {
		t.Fatalf("get session failed: %v", err)
	}
	if sessionAfter.Status != DebateStatusFailed || sessionAfter.Error == "" {
		t.Fatalf("expected failed session with error, got %+v", sessionAfter)
	}
	if len(sessionAfter.Personas) != 1 || sessionAfter.Personas[0].Catchphrase != "先试小步" {
		t.Fatalf("expected first generated persona to remain persisted, got %+v", sessionAfter.Personas)
	}
}

func TestStreamDebateEmitsErrorAndMarksFailedWhenMessageGenerationFails(t *testing.T) {
	restore := disableStreamDelays(t)
	defer restore()

	personas := testPersonas()
	store := NewMemoryStore()
	if err := store.Create(testSession("deb_stream_failed", personas)); err != nil {
		t.Fatalf("create session failed: %v", err)
	}

	service := NewService(store, streamStubAI{
		generatePersonas: func(ctx context.Context, topic string, mode string, count int) ([]Persona, error) {
			return personas, nil
		},
		generatePersona: func(ctx context.Context, topic string, mode string, persona Persona, index int, count int) (*Persona, error) {
			t.Fatal("StreamDebate should not regenerate personas when session already has personas")
			return nil, nil
		},
		generateRound: func(ctx context.Context, topic string, mode string, personas []Persona, round int, history []DebateMessage, supportHistory []RoundSupportChoice) ([]DebateMessage, error) {
			t.Fatal("StreamDebate should not use batch round generation")
			return nil, nil
		},
		generateMessage: func(ctx context.Context, topic string, mode string, personas []Persona, persona Persona, round int, history []DebateMessage, supportHistory []RoundSupportChoice) (*DebateMessage, error) {
			if round == 1 && persona.ID == "p2" {
				return nil, errors.New("model offline")
			}
			return &DebateMessage{PersonaID: persona.ID, PersonaName: persona.Name, Content: fmt.Sprintf("第 %d 轮先开场。", round)}, nil
		},
		judgeDebate: func(ctx context.Context, topic string, personas []Persona, messages []DebateMessage) (*DebateResult, error) {
			t.Fatal("judge should not run when message generation fails")
			return nil, nil
		},
	})

	events := collectStreamEvents(t, service.StreamDebate(context.Background(), "deb_stream_failed"))
	if len(events) < 2 {
		t.Fatalf("expected first-round messages and one error, got %+v", events)
	}
	hasPersonas := false
	messageCount := 0
	errorCount := 0
	for _, event := range events {
		switch event.Type {
		case "personas":
			hasPersonas = true
		case "message":
			messageCount++
		case "error":
			errorCount++
		}
	}
	if hasPersonas && len(events) < 3 {
		t.Fatalf("expected personas event to be accompanied by message and error, got %+v", events)
	}
	if messageCount != 1 {
		t.Fatalf("expected one message event before failure, got %+v", events)
	}
	if errorCount != 1 || events[len(events)-1].Type != "error" || events[len(events)-1].Message == "" {
		t.Fatalf("expected final error event, got %+v", events)
	}

	session, err := store.Get("deb_stream_failed")
	if err != nil {
		t.Fatalf("get session failed: %v", err)
	}
	if session.Status != DebateStatusFailed || session.Error == "" {
		t.Fatalf("expected failed session with error, got %+v", session)
	}
}

func TestMergeFinalResultWithLiveScoresKeepsWinnerConsistent(t *testing.T) {
	result := mergeFinalResultWithLiveScores(&DebateResult{
		Winner:      "理性派",
		FinalAdvice: "先别上头。",
		Quote:       "先稳住。",
		Scores: []DebateScore{
			{Persona: "理性派", Score: 82},
			{Persona: "父母派", Score: 83},
		},
	}, []DebateScore{
		{Persona: "理性派", Score: 82, JudgeScore: 82},
		{Persona: "父母派", Score: 83, JudgeScore: 67, AudienceScore: 16},
	})

	if result.Winner != "父母派" {
		t.Fatalf("expected winner to align with highest live score, got %+v", result)
	}
	if len(result.Scores) != 2 || result.Scores[1].AudienceScore != 16 {
		t.Fatalf("expected live scores to replace final scores, got %+v", result.Scores)
	}
}

func TestStreamDebateStartsOvertimeWhenRoundThreeIsTied(t *testing.T) {
	restore := disableStreamDelays(t)
	defer restore()

	personas := testPersonas()
	store := NewMemoryStore()
	session := testSession("deb_overtime", personas)
	session.PersonaCount = len(personas)
	if err := store.Create(session); err != nil {
		t.Fatalf("create session failed: %v", err)
	}

	service := NewService(store, streamStubAI{
		generatePersonas: func(ctx context.Context, topic string, mode string, count int) ([]Persona, error) {
			return personas, nil
		},
		generatePersona: func(ctx context.Context, topic string, mode string, persona Persona, index int, count int) (*Persona, error) {
			t.Fatal("overtime test should use existing personas")
			return nil, nil
		},
		generateRound: func(ctx context.Context, topic string, mode string, personas []Persona, round int, history []DebateMessage, supportHistory []RoundSupportChoice) ([]DebateMessage, error) {
			t.Fatal("overtime test should generate messages one by one")
			return nil, nil
		},
		generateMessage: func(ctx context.Context, topic string, mode string, personas []Persona, persona Persona, round int, history []DebateMessage, supportHistory []RoundSupportChoice) (*DebateMessage, error) {
			content := "两边都先把话说明白，再看谁更能说服人。"
			if round == 4 {
				if persona.ID == "p1" {
					content = "加时我只补一句：把风险、成本和执行顺序讲清的人，才配拿最后这一票。"
				} else {
					content = "加时我也补一句：别让自己因为怕输就一直算到不敢动。"
				}
			}
			return &DebateMessage{
				PersonaID:   persona.ID,
				PersonaName: persona.Name,
				Content:     content,
			}, nil
		},
		judgeDebate: func(ctx context.Context, topic string, personas []Persona, messages []DebateMessage) (*DebateResult, error) {
			return &DebateResult{
				Winner:      "毒舌派",
				FinalAdvice: "先打平，再加时。",
				Quote:       "最后一票看加时。",
			}, nil
		},
	})

	roundOneEvents := collectStreamEvents(t, service.StreamDebate(context.Background(), "deb_overtime"))
	if roundOneEvents[len(roundOneEvents)-1].Type != "support_prompt" {
		t.Fatalf("expected round 2 support prompt (rounds 1+2 run together), got %+v", roundOneEvents)
	}
	// Round 1+2 连续执行，在 Round 2 结束后暂停
	if _, err := service.SubmitRoundSupport(context.Background(), "deb_overtime", SubmitRoundSupportRequest{
		Round: 2,
		Skip:  true,
	}); err != nil {
		t.Fatalf("submit round 2 support failed: %v", err)
	}

	finalEvents := collectStreamEvents(t, service.StreamDebate(context.Background(), "deb_overtime"))
	// Round 3 平局触发加时，Round 4 p1 以更高分获胜（非平局），直接进入 judge+done
	if finalEvents[len(finalEvents)-1].Type != "done" {
		t.Fatalf("expected final done after overtime round 4 resolves, got %+v", finalEvents)
	}
	roundFourMessages := 0
	for i := range finalEvents {
		if finalEvents[i].Type == "message" && finalEvents[i].Round == 4 {
			roundFourMessages++
		}
	}
	if roundFourMessages != 2 {
		t.Fatalf("expected overtime round 4 messages for both tied personas, got %+v", finalEvents)
	}
	var judgeEvent *SSEEvent
	for i := range finalEvents {
		if finalEvents[i].Type == "judge" {
			judgeEvent = &finalEvents[i]
		}
	}
	if judgeEvent == nil || judgeEvent.Result == nil {
		t.Fatalf("expected judge event in final stream, got %+v", judgeEvent)
	}

	updated, err := store.Get("deb_overtime")
	if err != nil {
		t.Fatalf("get session failed: %v", err)
	}
	if updated.Result == nil || updated.LastCompletedRound != 4 || len(updated.OvertimePersonaIDs) != 0 {
		t.Fatalf("expected overtime session to complete and clear overtime ids, got %+v", updated)
	}
}

func disableStreamDelays(t *testing.T) func() {
	t.Helper()
	oldMessageDelay := streamMessageDelay
	oldDoneDelay := streamDoneDelay
	streamMessageDelay = 0
	streamDoneDelay = 0
	return func() {
		streamMessageDelay = oldMessageDelay
		streamDoneDelay = oldDoneDelay
	}
}

func collectStreamEvents(t *testing.T, stream <-chan SSEEvent) []SSEEvent {
	t.Helper()

	var events []SSEEvent
	timeout := time.After(2 * time.Second)
	for {
		select {
		case event, ok := <-stream:
			if !ok {
				return events
			}
			events = append(events, event)
		case <-timeout:
			t.Fatalf("timed out waiting for stream events: %+v", events)
		}
	}
}

func waitForStreamEvent(t *testing.T, stream <-chan SSEEvent) SSEEvent {
	t.Helper()

	select {
	case event, ok := <-stream:
		if !ok {
			t.Fatal("stream closed before first event")
		}
		return event
	case <-time.After(2 * time.Second):
		t.Fatal("timed out waiting for stream event")
	}
	return SSEEvent{}
}

func collectRemainingStreamEvents(t *testing.T, stream <-chan SSEEvent) []SSEEvent {
	t.Helper()

	var events []SSEEvent
	timeout := time.After(2 * time.Second)
	for {
		select {
		case event, ok := <-stream:
			if !ok {
				return events
			}
			events = append(events, event)
		case <-timeout:
			t.Fatalf("timed out waiting for remaining stream events: %+v", events)
		}
	}
}

func assertMessageRounds(events []SSEEvent, round int, expectedCount int) error {
	var messageEvents []SSEEvent
	for _, event := range events {
		if event.Type == "message" && event.Round == round {
			messageEvents = append(messageEvents, event)
		}
	}
	if len(messageEvents) != expectedCount {
		return fmt.Errorf("expected %d message events in round %d, got %+v", expectedCount, round, events)
	}
	for _, event := range messageEvents {
		if event.RoundTitle != roundTitle(round) {
			return fmt.Errorf("unexpected round metadata for round %d: %+v", round, event)
		}
		if event.PersonaID == "" || event.PersonaName == "" || event.Content == "" {
			return fmt.Errorf("message event should carry persona and content, got %+v", event)
		}
	}
	return nil
}

func assertMessageCount(events []SSEEvent, expectedCount int) error {
	var count int
	for _, event := range events {
		if event.Type == "message" {
			count++
		}
	}
	if count != expectedCount {
		return fmt.Errorf("expected %d total message events, got %d in %+v", expectedCount, count, events)
	}
	return nil
}

func testSession(id string, personas []Persona) *DebateSession {
	now := nowString()
	return &DebateSession{
		ID:                 id,
		Topic:              "要不要裸辞创业",
		Mode:               DebateModeFunny,
		Status:             DebateStatusCreated,
		PersonaCount:       len(personas),
		CurrentRound:       1,
		LastCompletedRound: 0,
		Personas:           personas,
		Messages:           []DebateMessage{},
		SupportHistory:     []RoundSupportChoice{},
		CreatedAt:          now,
		UpdatedAt:          now,
	}
}

func testPersonas() []Persona {
	return []Persona{
		{ID: "p1", Name: "理性派"},
		{ID: "p2", Name: "毒舌派"},
	}
}

func findPersonaByID(personas []Persona, id string) (Persona, bool) {
	for _, persona := range personas {
		if persona.ID == id {
			return persona, true
		}
	}
	return Persona{}, false
}
