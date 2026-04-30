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
	GeneratePersona(ctx context.Context, topic string, mode string, persona Persona, index int, count int) (*Persona, error)
	GenerateDebateRound(ctx context.Context, topic string, mode string, personas []Persona, round int, history []DebateMessage) ([]DebateMessage, error)
	GenerateDebateMessage(ctx context.Context, topic string, mode string, personas []Persona, persona Persona, round int, history []DebateMessage) (*DebateMessage, error)
	JudgeDebate(ctx context.Context, topic string, personas []Persona, messages []DebateMessage) (*DebateResult, error)
}

type Service struct {
	store Store
	ai    DebateAI
}

var (
	streamMessageDelay = 650 * time.Millisecond
	streamDoneDelay    = 350 * time.Millisecond
)

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

	now := nowString()
	session := &DebateSession{
		ID:           newID("deb"),
		Topic:        topic,
		Mode:         mode,
		Status:       DebateStatusCreated,
		PersonaCount: count,
		Personas:     []Persona{},
		Messages:     []DebateMessage{},
		CreatedAt:    now,
		UpdatedAt:    now,
	}
	if err := s.store.Create(session); err != nil {
		return nil, err
	}

	return &CreateDebateResponse{
		SessionID:    session.ID,
		Topic:        session.Topic,
		Mode:         session.Mode,
		Status:       session.Status,
		PersonaCount: session.PersonaCount,
		Personas:     session.Personas,
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

		session, ok := s.revealPersonas(ctx, events, session)
		if !ok {
			return
		}

		history := append([]DebateMessage(nil), session.Messages...)
		for round := 1; round <= 3; round++ {
			roundMessages, err := s.ai.GenerateDebateRound(ctx, session.Topic, string(session.Mode), session.Personas, round, history)
			if err != nil {
				s.failAndSend(events, id, fmt.Sprintf("生成第 %d 轮失败: %v", round, err))
				return
			}
			if len(roundMessages) == 0 {
				s.failAndSend(events, id, fmt.Sprintf("生成第 %d 轮失败: 返回为空", round))
				return
			}

			for i := range roundMessages {
				message := roundMessages[i]
				persona := personaForRoundMessage(session.Personas, message, i)
				prepareStreamMessage(&message, persona, round)

				updated, err := s.store.AppendMessages(id, []DebateMessage{message})
				if err != nil {
					s.failAndSend(events, id, err.Error())
					return
				}
				history = append([]DebateMessage(nil), updated.Messages...)

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
				if !sleepWithContext(ctx, streamMessageDelay) {
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
		_ = sleepWithContext(ctx, streamDoneDelay)
		sendEvent(ctx, events, SSEEvent{Type: "done", SessionID: id})
	}()

	return events
}

func (s *Service) revealPersonas(ctx context.Context, events chan<- SSEEvent, session *DebateSession) (*DebateSession, bool) {
	if len(session.Personas) > 0 {
		if !sendEvent(ctx, events, SSEEvent{
			Type:         "personas",
			PersonaCount: targetPersonaCount(session),
			Personas:     session.Personas,
		}) {
			return session, false
		}
		return session, true
	}

	count := targetPersonaCount(session)
	personas, err := s.ai.GeneratePersonas(ctx, session.Topic, string(session.Mode), count)
	if err != nil {
		s.failAndSend(events, session.ID, fmt.Sprintf("生成人格失败: %v", err))
		return session, false
	}
	if len(personas) == 0 {
		s.failAndSend(events, session.ID, "生成人格失败: 返回为空")
		return session, false
	}

	if len(personas) > count {
		personas = personas[:count]
	}
	updated, err := s.store.UpdatePersonas(session.ID, personas)
	if err != nil {
		s.failAndSend(events, session.ID, err.Error())
		return session, false
	}
	session = updated
	if !sendEvent(ctx, events, SSEEvent{
		Type:         "personas",
		PersonaCount: count,
		Personas:     personas,
	}) {
		return session, false
	}
	return session, true
}

func prepareStreamMessage(message *DebateMessage, persona Persona, round int) {
	message.Round = round
	message.RoundTitle = roundTitle(round)
	if message.ID == "" {
		message.ID = newID("msg")
	}
	if message.PersonaID == "" {
		message.PersonaID = persona.ID
	}
	if message.PersonaName == "" {
		message.PersonaName = persona.Name
	}
	if message.CreatedAt == "" {
		message.CreatedAt = nowString()
	}
}

func personaForRoundMessage(personas []Persona, message DebateMessage, fallbackIndex int) Persona {
	for _, persona := range personas {
		if message.PersonaID != "" && message.PersonaID == persona.ID {
			return persona
		}
		if message.PersonaName != "" && message.PersonaName == persona.Name {
			return persona
		}
	}
	if fallbackIndex >= 0 && fallbackIndex < len(personas) {
		return personas[fallbackIndex]
	}
	return Persona{}
}

func targetPersonaCount(session *DebateSession) int {
	if session == nil {
		return normalizePersonaCount(0)
	}
	if session.PersonaCount > 0 {
		return session.PersonaCount
	}
	if len(session.Personas) > 0 {
		return len(session.Personas)
	}
	return normalizePersonaCount(0)
}

func (s *Service) replaySession(ctx context.Context, session *DebateSession, events chan<- SSEEvent) {
	if session.Status == DebateStatusFailed {
		sendEvent(ctx, events, SSEEvent{Type: "error", Message: session.Error})
		return
	}
	if len(session.Personas) > 0 {
		if !sendEvent(ctx, events, SSEEvent{
			Type:         "personas",
			PersonaCount: targetPersonaCount(session),
			Personas:     session.Personas,
		}) {
			return
		}
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
	if delay <= 0 {
		return true
	}
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
