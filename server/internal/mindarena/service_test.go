package mindarena

import (
	"context"
	"errors"
	"fmt"
	"testing"
	"time"
)

type streamStubAI struct {
	generatePersonas func(ctx context.Context, topic string, mode string, count int) ([]Persona, error)
	generatePersona  func(ctx context.Context, topic string, mode string, persona Persona, index int, count int) (*Persona, error)
	generateRound    func(ctx context.Context, topic string, mode string, personas []Persona, round int, history []DebateMessage) ([]DebateMessage, error)
	generateMessage  func(ctx context.Context, topic string, mode string, personas []Persona, persona Persona, round int, history []DebateMessage) (*DebateMessage, error)
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

func (s streamStubAI) GenerateDebateRound(ctx context.Context, topic string, mode string, personas []Persona, round int, history []DebateMessage) ([]DebateMessage, error) {
	return s.generateRound(ctx, topic, mode, personas, round, history)
}

func (s streamStubAI) GenerateDebateMessage(ctx context.Context, topic string, mode string, personas []Persona, persona Persona, round int, history []DebateMessage) (*DebateMessage, error) {
	if s.generateMessage != nil {
		return s.generateMessage(ctx, topic, mode, personas, persona, round, history)
	}
	messages, err := s.GenerateDebateRound(ctx, topic, mode, personas, round, history)
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
		generateRound: func(ctx context.Context, topic string, mode string, personas []Persona, round int, history []DebateMessage) ([]DebateMessage, error) {
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
	if session.PersonaCount != 5 || len(session.Personas) != 0 {
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
			t.Fatal("StreamDebate should reveal personas one model call at a time")
			return nil, nil
		},
		generatePersona: func(ctx context.Context, topic string, mode string, persona Persona, index int, count int) (*Persona, error) {
			generated := personas[index]
			if index == 0 {
				generated.Catchphrase = "先试小步"
			}
			return &generated, nil
		},
		generateRound: func(ctx context.Context, topic string, mode string, personas []Persona, round int, history []DebateMessage) ([]DebateMessage, error) {
			return nil, nil
		},
		generateMessage: func(ctx context.Context, topic string, mode string, personas []Persona, persona Persona, round int, history []DebateMessage) (*DebateMessage, error) {
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

	events := collectStreamEvents(t, service.StreamDebate(context.Background(), "deb_stream_ok"))
	if len(events) != 10 {
		t.Fatalf("expected 2 persona reveal events, 6 message events, judge and done, got %+v", events)
	}
	personaEvents := make([]SSEEvent, 0, len(personas))
	messageEvents := make([]SSEEvent, 0, 6)
	for i := range events {
		switch events[i].Type {
		case "personas":
			personaEvents = append(personaEvents, events[i])
		case "message":
			messageEvents = append(messageEvents, events[i])
		}
	}
	if len(personaEvents) != len(personas) {
		t.Fatalf("expected one persona reveal event per persona, got %+v", personaEvents)
	}
	if len(personaEvents[0].Personas) != 1 || len(personaEvents[1].Personas) != len(personas) {
		t.Fatalf("expected incremental persona reveal events, got %+v", personaEvents)
	}
	if personaEvents[1].PersonaCount != len(personas) || personaEvents[1].Personas[0].Catchphrase != "先试小步" {
		t.Fatalf("expected final personas event with updated catchphrase, got %+v", personaEvents[1])
	}
	if len(messageEvents) != 6 {
		t.Fatalf("expected 6 message events, got %+v", messageEvents)
	}

	for i := 0; i < 6; i++ {
		event := messageEvents[i]
		if event.Type != "message" {
			t.Fatalf("event %d should be message, got %+v", i, event)
		}
		wantRound := i/len(personas) + 1
		if event.Round != wantRound || event.RoundTitle != roundTitle(wantRound) {
			t.Fatalf("unexpected round metadata for event %d: %+v", i, event)
		}
		if event.PersonaID == "" || event.PersonaName == "" || event.Content == "" {
			t.Fatalf("message event should carry persona and content, got %+v", event)
		}
	}
	if events[len(events)-2].Type != "judge" || events[len(events)-2].Result == nil || events[len(events)-2].Result.Winner != "理性派" {
		t.Fatalf("expected judge event with result, got %+v", events[len(events)-2])
	}
	if events[len(events)-1].Type != "done" || events[len(events)-1].SessionID != "deb_stream_ok" {
		t.Fatalf("expected done event with session id, got %+v", events[len(events)-1])
	}

	session, err := store.Get("deb_stream_ok")
	if err != nil {
		t.Fatalf("get session failed: %v", err)
	}
	if session.Status != DebateStatusDone || len(session.Messages) != 6 || session.Result == nil {
		t.Fatalf("expected completed persisted session, got %+v", session)
	}
	if session.Personas[0].Catchphrase != "先试小步" {
		t.Fatalf("expected updated personas to be persisted, got %+v", session.Personas)
	}
}

func TestStreamDebateEmitsFirstPersonaBeforeSecondPersonaCompletes(t *testing.T) {
	restore := disableStreamDelays(t)
	defer restore()

	personas := testPersonas()
	store := NewMemoryStore()
	session := testSession("deb_first_persona_fast", nil)
	session.PersonaCount = len(personas)
	if err := store.Create(session); err != nil {
		t.Fatalf("create session failed: %v", err)
	}

	secondPersonaStarted := make(chan struct{})
	releaseSecondPersona := make(chan struct{})
	service := NewService(store, streamStubAI{
		generatePersonas: func(ctx context.Context, topic string, mode string, count int) ([]Persona, error) {
			t.Fatal("StreamDebate should not wait for batch persona generation")
			return nil, nil
		},
		generatePersona: func(ctx context.Context, topic string, mode string, persona Persona, index int, count int) (*Persona, error) {
			if index == 1 {
				close(secondPersonaStarted)
				select {
				case <-releaseSecondPersona:
				case <-ctx.Done():
					return nil, ctx.Err()
				}
			}
			generated := personas[index]
			return &generated, nil
		},
		generateRound: func(ctx context.Context, topic string, mode string, personas []Persona, round int, history []DebateMessage) ([]DebateMessage, error) {
			return nil, nil
		},
		generateMessage: func(ctx context.Context, topic string, mode string, personas []Persona, persona Persona, round int, history []DebateMessage) (*DebateMessage, error) {
			return &DebateMessage{PersonaID: persona.ID, PersonaName: persona.Name, Content: "发言"}, nil
		},
		judgeDebate: func(ctx context.Context, topic string, personas []Persona, messages []DebateMessage) (*DebateResult, error) {
			return &DebateResult{Winner: personas[0].Name, FinalAdvice: "先看第一位。", Quote: "先有人入场。"}, nil
		},
	})

	stream := service.StreamDebate(context.Background(), "deb_first_persona_fast")
	firstEvent := waitForStreamEvent(t, stream)
	if firstEvent.Type != "personas" || len(firstEvent.Personas) != 1 || firstEvent.Personas[0].ID != personas[0].ID {
		t.Fatalf("expected first persona to stream before second completes, got %+v", firstEvent)
	}

	select {
	case <-secondPersonaStarted:
	case <-time.After(time.Second):
		t.Fatal("expected second persona generation to start after first persona event")
	}
	close(releaseSecondPersona)
	_ = collectRemainingStreamEvents(t, stream)
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

func TestStreamDebateEmitsErrorAndMarksFailedWhenRoundGenerationFails(t *testing.T) {
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
		generateRound: func(ctx context.Context, topic string, mode string, personas []Persona, round int, history []DebateMessage) ([]DebateMessage, error) {
			return nil, nil
		},
		generateMessage: func(ctx context.Context, topic string, mode string, personas []Persona, persona Persona, round int, history []DebateMessage) (*DebateMessage, error) {
			if round == 2 {
				return nil, errors.New("model offline")
			}
			return &DebateMessage{PersonaID: persona.ID, PersonaName: persona.Name, Content: "第一轮先开场。"}, nil
		},
		judgeDebate: func(ctx context.Context, topic string, personas []Persona, messages []DebateMessage) (*DebateResult, error) {
			t.Fatal("judge should not run when round generation fails")
			return nil, nil
		},
	})

	events := collectStreamEvents(t, service.StreamDebate(context.Background(), "deb_stream_failed"))
	if len(events) < 3 {
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
	if hasPersonas && len(events) < 4 {
		t.Fatalf("expected personas event to be accompanied by messages and error, got %+v", events)
	}
	if messageCount != 2 {
		t.Fatalf("expected first-round message events, got %+v", events)
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

func disableStreamDelays(t *testing.T) func() {
	t.Helper()
	oldPersonaDelay := streamPersonaRevealDelay
	oldMessageDelay := streamMessageDelay
	oldDoneDelay := streamDoneDelay
	streamPersonaRevealDelay = 0
	streamMessageDelay = 0
	streamDoneDelay = 0
	return func() {
		streamPersonaRevealDelay = oldPersonaDelay
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

func testSession(id string, personas []Persona) *DebateSession {
	now := nowString()
	return &DebateSession{
		ID:           id,
		Topic:        "要不要裸辞创业",
		Mode:         DebateModeFunny,
		Status:       DebateStatusCreated,
		PersonaCount: len(personas),
		Personas:     personas,
		Messages:     []DebateMessage{},
		CreatedAt:    now,
		UpdatedAt:    now,
	}
}

func testPersonas() []Persona {
	return []Persona{
		{ID: "p1", Name: "理性派"},
		{ID: "p2", Name: "毒舌派"},
	}
}
