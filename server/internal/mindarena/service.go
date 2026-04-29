package mindarena

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"strings"
	"time"
)

type DebateAI interface {
	GeneratePersonas(ctx context.Context, topic string, mode string, count int) ([]Persona, error)
	GenerateDebateRound(ctx context.Context, topic string, mode string, personas []Persona, round int, history []DebateMessage) ([]DebateMessage, error)
	JudgeDebate(ctx context.Context, topic string, personas []Persona, messages []DebateMessage) (*DebateResult, error)
}

type Service struct {
	store Store
	ai    DebateAI
}

func NewService(store Store, ai DebateAI) *Service {
	return &Service{store: store, ai: ai}
}

func (s *Service) CreateDebate(ctx context.Context, req CreateDebateRequest) (*CreateDebateResponse, error) {
	topic := strings.TrimSpace(req.Topic)
	if topic == "" {
		return nil, fmt.Errorf("议题不能为空")
	}

	mode := normalizeMode(req.Mode)
	count := normalizePersonaCount(req.PersonaCount)
	personas, err := s.ai.GeneratePersonas(ctx, topic, string(mode), count)
	if err != nil {
		return nil, fmt.Errorf("生成本场嘉宾失败: %w", err)
	}
	if len(personas) == 0 {
		return nil, fmt.Errorf("生成本场嘉宾失败: 返回为空")
	}

	now := nowString()
	session := &DebateSession{
		ID:        newID("deb"),
		Topic:     topic,
		Mode:      mode,
		Status:    DebateStatusCreated,
		Personas:  personas,
		Messages:  []DebateMessage{},
		CreatedAt: now,
		UpdatedAt: now,
	}
	if err := s.store.Create(session); err != nil {
		return nil, err
	}

	return &CreateDebateResponse{
		SessionID: session.ID,
		Topic:     session.Topic,
		Mode:      session.Mode,
		Status:    session.Status,
		Personas:  session.Personas,
	}, nil
}

func (s *Service) GetDebate(id string) (*DebateSession, error) {
	return s.store.Get(id)
}

func (s *Service) StreamDebate(ctx context.Context, id string) <-chan SSEEvent {
	events := make(chan SSEEvent)

	go func() {
		defer close(events)

		session, shouldRun, err := s.store.TryMarkRunning(id)
		if err != nil {
			events <- SSEEvent{Type: "error", Message: "没有找到这场脑内会议"}
			return
		}

		if !shouldRun {
			s.replaySession(ctx, session, events)
			return
		}

		history := append([]DebateMessage(nil), session.Messages...)
		for round := 1; round <= 3; round++ {
			messages, err := s.ai.GenerateDebateRound(ctx, session.Topic, string(session.Mode), session.Personas, round, history)
			if err != nil {
				s.failAndSend(events, id, fmt.Sprintf("生成第 %d 轮失败: %v", round, err))
				return
			}

			for i := range messages {
				messages[i].Round = round
				messages[i].RoundTitle = roundTitle(round)
				if messages[i].ID == "" {
					messages[i].ID = newID("msg")
				}
				if messages[i].CreatedAt == "" {
					messages[i].CreatedAt = nowString()
				}
			}

			updated, err := s.store.AppendMessages(id, messages)
			if err != nil {
				s.failAndSend(events, id, err.Error())
				return
			}
			history = append([]DebateMessage(nil), updated.Messages...)

			for _, message := range messages {
				if !sendEvent(ctx, events, SSEEvent{
					Type:        "message",
					Round:       message.Round,
					RoundTitle:  message.RoundTitle,
					PersonaID:   message.PersonaID,
					PersonaName: message.PersonaName,
					Content:     message.Content,
				}) {
					return
				}
				if !sleepWithContext(ctx, 650*time.Millisecond) {
					return
				}
			}
		}

		result, err := s.ai.JudgeDebate(ctx, session.Topic, session.Personas, history)
		if err != nil {
			s.failAndSend(events, id, fmt.Sprintf("裁判团掉线了: %v", err))
			return
		}
		if _, err := s.store.Complete(id, result); err != nil {
			s.failAndSend(events, id, err.Error())
			return
		}
		if !sendEvent(ctx, events, SSEEvent{Type: "judge", Result: result}) {
			return
		}
		_ = sleepWithContext(ctx, 350*time.Millisecond)
		sendEvent(ctx, events, SSEEvent{Type: "done", SessionID: id})
	}()

	return events
}

func (s *Service) replaySession(ctx context.Context, session *DebateSession, events chan<- SSEEvent) {
	if session.Status == DebateStatusFailed {
		sendEvent(ctx, events, SSEEvent{Type: "error", Message: session.Error})
		return
	}
	for _, message := range session.Messages {
		if !sendEvent(ctx, events, SSEEvent{
			Type:        "message",
			Round:       message.Round,
			RoundTitle:  message.RoundTitle,
			PersonaID:   message.PersonaID,
			PersonaName: message.PersonaName,
			Content:     message.Content,
		}) {
			return
		}
	}
	if session.Result != nil {
		if !sendEvent(ctx, events, SSEEvent{Type: "judge", Result: session.Result}) {
			return
		}
	}
	sendEvent(ctx, events, SSEEvent{Type: "done", SessionID: session.ID})
}

func (s *Service) failAndSend(events chan<- SSEEvent, id string, message string) {
	_, _ = s.store.Fail(id, message)
	events <- SSEEvent{Type: "error", Message: message}
}

func newID(prefix string) string {
	var bytes [8]byte
	if _, err := rand.Read(bytes[:]); err != nil {
		return fmt.Sprintf("%s_%d", prefix, time.Now().UnixNano())
	}
	return prefix + "_" + hex.EncodeToString(bytes[:])
}

func sleepWithContext(ctx context.Context, delay time.Duration) bool {
	timer := time.NewTimer(delay)
	defer timer.Stop()
	select {
	case <-ctx.Done():
		return false
	case <-timer.C:
		return true
	}
}

func sendEvent(ctx context.Context, events chan<- SSEEvent, event SSEEvent) bool {
	select {
	case <-ctx.Done():
		return false
	case events <- event:
		return true
	}
}
