package mindarena

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"log"
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

type personaGenerationResult struct {
	index   int
	target  Persona
	persona *Persona
	err     error
	elapsed time.Duration
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
			for i := range session.Personas {
				persona := session.Personas[i]
				message, err := s.ai.GenerateDebateMessage(ctx, session.Topic, string(session.Mode), session.Personas, persona, round, history)
				if err != nil {
					s.failAndSend(events, id, fmt.Sprintf("生成第 %d 轮 %s 发言失败: %v", round, persona.Name, err))
					return
				}
				if message == nil {
					s.failAndSend(events, id, fmt.Sprintf("生成第 %d 轮 %s 发言失败: 返回为空", round, persona.Name))
					return
				}

				prepared := *message
				prepareStreamMessage(&prepared, persona, round)

				updated, err := s.store.AppendMessages(id, []DebateMessage{prepared})
				if err != nil {
					s.failAndSend(events, id, err.Error())
					return
				}
				history = append([]DebateMessage(nil), updated.Messages...)

				if !sendEvent(ctx, events, SSEEvent{
					Type:        "message",
					Round:       prepared.Round,
					RoundTitle:  prepared.RoundTitle,
					PersonaID:   prepared.PersonaID,
					PersonaName: prepared.PersonaName,
					Content:     prepared.Content,
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
	targets := PersonaTargets(count)
	if len(targets) == 0 {
		s.failAndSend(events, session.ID, "生成人格失败: 没有可用的人格模板")
		return session, false
	}

	personaBatchStart := time.Now()
	log.Printf("ai-mind-arena: session=%s 开始并发生成人格 persona_count=%d mode=%s topic=%q", session.ID, count, session.Mode, session.Topic)

	personaCtx, cancel := context.WithCancel(ctx)
	defer cancel()

	results := make(chan personaGenerationResult, len(targets))
	for i, target := range targets {
		go func(index int, target Persona) {
			personaStart := time.Now()
			log.Printf("ai-mind-arena: session=%s 开始生成人格 index=%d/%d persona=%s", session.ID, index+1, count, target.Name)

			generated, err := s.ai.GeneratePersona(personaCtx, session.Topic, string(session.Mode), target, index, count)
			result := personaGenerationResult{
				index:   index,
				target:  target,
				persona: generated,
				err:     err,
				elapsed: time.Since(personaStart),
			}

			select {
			case results <- result:
			case <-personaCtx.Done():
			}
		}(i, target)
	}

	personas := make([]Persona, 0, len(targets))
	for len(personas) < len(targets) {
		var result personaGenerationResult
		select {
		case <-personaCtx.Done():
			return session, false
		case result = <-results:
		}

		if result.err != nil {
			cancel()
			log.Printf("ai-mind-arena: session=%s 生成人格失败 index=%d/%d persona=%s elapsed=%s err=%v", session.ID, result.index+1, count, result.target.Name, result.elapsed.Round(time.Millisecond), result.err)
			s.failAndSend(events, session.ID, fmt.Sprintf("生成人格失败（第 %d 位 %s）: %v", result.index+1, result.target.Name, result.err))
			return session, false
		}
		if result.persona == nil {
			cancel()
			log.Printf("ai-mind-arena: session=%s 生成人格失败 index=%d/%d persona=%s elapsed=%s err=nil persona", session.ID, result.index+1, count, result.target.Name, result.elapsed.Round(time.Millisecond))
			s.failAndSend(events, session.ID, fmt.Sprintf("生成人格失败（第 %d 位 %s）: 返回为空", result.index+1, result.target.Name))
			return session, false
		}

		personas = append(personas, *result.persona)
		updated, err := s.store.UpdatePersonas(session.ID, personas)
		if err != nil {
			cancel()
			s.failAndSend(events, session.ID, err.Error())
			return session, false
		}
		session = updated
		log.Printf("ai-mind-arena: session=%s 生成人格完成 index=%d/%d persona=%s elapsed=%s generated_count=%d", session.ID, result.index+1, count, result.persona.Name, result.elapsed.Round(time.Millisecond), len(session.Personas))

		if !sendEvent(ctx, events, SSEEvent{
			Type:         "personas",
			PersonaCount: count,
			Personas:     append([]Persona(nil), session.Personas...),
		}) {
			return session, false
		}
	}
	log.Printf("ai-mind-arena: session=%s 全部人格生成完成 total_elapsed=%s persona_count=%d", session.ID, time.Since(personaBatchStart).Round(time.Millisecond), len(personas))
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
