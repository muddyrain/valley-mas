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
	generateRound    func(ctx context.Context, topic string, mode string, personas []Persona, round int, history []DebateMessage) ([]DebateMessage, error)
	judgeDebate      func(ctx context.Context, topic string, personas []Persona, messages []DebateMessage) (*DebateResult, error)
}

func (s streamStubAI) GeneratePersonas(ctx context.Context, topic string, mode string, count int) ([]Persona, error) {
	return s.generatePersonas(ctx, topic, mode, count)
}

func (s streamStubAI) GenerateDebateRound(ctx context.Context, topic string, mode string, personas []Persona, round int, history []DebateMessage) ([]DebateMessage, error) {
	return s.generateRound(ctx, topic, mode, personas, round, history)
}

func (s streamStubAI) JudgeDebate(ctx context.Context, topic string, personas []Persona, messages []DebateMessage) (*DebateResult, error) {
	return s.judgeDebate(ctx, topic, personas, messages)
}

func TestStreamDebateEmitsMessageJudgeAndDoneEvents(t *testing.T) {
	restore := disableStreamDelays(t)
	defer restore()

	personas := testPersonas()
	store := NewMemoryStore()
	if err := store.Create(testSession("deb_stream_ok", personas)); err != nil {
		t.Fatalf("create session failed: %v", err)
	}

	service := NewService(store, streamStubAI{
		generatePersonas: func(ctx context.Context, topic string, mode string, count int) ([]Persona, error) {
			return personas, nil
		},
		generateRound: func(ctx context.Context, topic string, mode string, personas []Persona, round int, history []DebateMessage) ([]DebateMessage, error) {
			messages := make([]DebateMessage, 0, len(personas))
			for _, persona := range personas {
				messages = append(messages, DebateMessage{
					PersonaID:   persona.ID,
					PersonaName: persona.Name,
					Content:     fmt.Sprintf("%s 第 %d 轮发言", persona.Name, round),
				})
			}
			return messages, nil
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
	if len(events) != 8 {
		t.Fatalf("expected 6 message events plus judge and done, got %+v", events)
	}

	for i := 0; i < 6; i++ {
		event := events[i]
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
	if events[6].Type != "judge" || events[6].Result == nil || events[6].Result.Winner != "理性派" {
		t.Fatalf("expected judge event with result, got %+v", events[6])
	}
	if events[7].Type != "done" || events[7].SessionID != "deb_stream_ok" {
		t.Fatalf("expected done event with session id, got %+v", events[7])
	}

	session, err := store.Get("deb_stream_ok")
	if err != nil {
		t.Fatalf("get session failed: %v", err)
	}
	if session.Status != DebateStatusDone || len(session.Messages) != 6 || session.Result == nil {
		t.Fatalf("expected completed persisted session, got %+v", session)
	}
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
		generateRound: func(ctx context.Context, topic string, mode string, personas []Persona, round int, history []DebateMessage) ([]DebateMessage, error) {
			if round == 2 {
				return nil, errors.New("model offline")
			}
			return []DebateMessage{
				{PersonaID: personas[0].ID, PersonaName: personas[0].Name, Content: "第一轮先开场。"},
			}, nil
		},
		judgeDebate: func(ctx context.Context, topic string, personas []Persona, messages []DebateMessage) (*DebateResult, error) {
			t.Fatal("judge should not run when round generation fails")
			return nil, nil
		},
	})

	events := collectStreamEvents(t, service.StreamDebate(context.Background(), "deb_stream_failed"))
	if len(events) != 2 {
		t.Fatalf("expected one message and one error, got %+v", events)
	}
	if events[0].Type != "message" {
		t.Fatalf("expected first event to be message, got %+v", events[0])
	}
	if events[1].Type != "error" || events[1].Message == "" {
		t.Fatalf("expected error event, got %+v", events[1])
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

func testSession(id string, personas []Persona) *DebateSession {
	now := nowString()
	return &DebateSession{
		ID:        id,
		Topic:     "要不要裸辞创业",
		Mode:      DebateModeFunny,
		Status:    DebateStatusCreated,
		Personas:  personas,
		Messages:  []DebateMessage{},
		CreatedAt: now,
		UpdatedAt: now,
	}
}

func testPersonas() []Persona {
	return []Persona{
		{ID: "p1", Name: "理性派"},
		{ID: "p2", Name: "毒舌派"},
	}
}
