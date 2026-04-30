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
	GenerateDebateRound(ctx context.Context, topic string, mode string, personas []Persona, round int, history []DebateMessage, supportHistory []RoundSupportChoice) ([]DebateMessage, error)
	GenerateDebateMessage(ctx context.Context, topic string, mode string, personas []Persona, persona Persona, round int, history []DebateMessage, supportHistory []RoundSupportChoice) (*DebateMessage, error)
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

const maxOvertimeRounds = 8

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
		ID:                 newID("deb"),
		Topic:              topic,
		Mode:               mode,
		Status:             DebateStatusCreated,
		PersonaCount:       count,
		CurrentRound:       1,
		LastCompletedRound: 0,
		Personas:           []Persona{},
		Messages:           []DebateMessage{},
		SupportHistory:     []RoundSupportChoice{},
		CreatedAt:          now,
		UpdatedAt:          now,
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
		CurrentRound: session.CurrentRound,
		Personas:     session.Personas,
	}, nil
}

func (s *Service) GetDebate(id string) (*DebateSession, error) {
	return s.store.Get(id)
}

func (s *Service) SubmitRoundSupport(ctx context.Context, id string, req SubmitRoundSupportRequest) (*DebateSession, error) {
	session, err := s.store.Get(id)
	if err != nil {
		return nil, err
	}
	if session.Status == DebateStatusDone || session.Status == DebateStatusFailed {
		return nil, fmt.Errorf("这场脑内会议已经结束，不能再站队")
	}
	if !session.AwaitingSupport || session.AwaitingSupportRound <= 0 {
		return nil, fmt.Errorf("当前回合还不需要站队")
	}
	if req.Round != session.AwaitingSupportRound {
		return nil, fmt.Errorf("站队回合不匹配，当前等待第 %d 轮", session.AwaitingSupportRound)
	}

	choice := RoundSupportChoice{
		Round:        req.Round,
		Skipped:      req.Skip,
		SupportScore: 0,
		CreatedAt:    nowString(),
	}
	if !req.Skip {
		persona, ok := findSessionPersonaByID(session.Personas, req.SupportedPersonaID)
		if !ok {
			return nil, fmt.Errorf("没有找到你支持的人格")
		}
		choice.PersonaID = persona.ID
		choice.PersonaName = persona.Name
		choice.SupportScore = supportScoreForRound(req.Round)
	}

	updated, err := s.store.SubmitRoundSupport(id, choice)
	if err != nil {
		return nil, err
	}
	return updated, nil
}

func (s *Service) StreamDebate(ctx context.Context, id string) <-chan SSEEvent {
	events := make(chan SSEEvent)

	go func() {
		defer close(events)
		defer func() {
			_, _ = s.store.FinishStreaming(id)
		}()

		session, shouldRun, err := s.store.TryStartStreaming(id)
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
		startRound := session.CurrentRound
		if startRound <= 0 {
			startRound = 1
		}
		for round := startRound; round <= maxOvertimeRounds; round++ {
			activePersonas := activePersonasForRound(session, round)
			for i := range activePersonas {
				persona := activePersonas[i]
				if hasRoundMessageForPersona(history, round, persona) {
					continue
				}

				message, err := s.ai.GenerateDebateMessage(ctx, session.Topic, string(session.Mode), activePersonas, persona, round, history, session.SupportHistory)
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
				session = updated
				history = append([]DebateMessage(nil), updated.Messages...)

				if !sendEvent(ctx, events, SSEEvent{
					Type:               "message",
					Round:              prepared.Round,
					RoundTitle:         prepared.RoundTitle,
					PersonaID:          prepared.PersonaID,
					PersonaName:        prepared.PersonaName,
					Content:            prepared.Content,
					Scores:             append([]DebateScore(nil), updated.LiveScores...),
					NeutralJudge:       cloneNeutralJudge(updated.NeutralJudge),
					OvertimePersonaIDs: append([]string(nil), updated.OvertimePersonaIDs...),
				}) {
					return
				}
				if !sleepWithContext(ctx, streamMessageDelay) {
					return
				}
			}

			session, err = s.store.Get(id)
			if err != nil {
				s.failAndSend(events, id, err.Error())
				return
			}

			if round >= 3 {
				tiedLeaders := leadingPersonaIDs(session.LiveScores, activePersonaIDs(activePersonas))
				if len(tiedLeaders) > 1 {
					if round >= maxOvertimeRounds {
						session.OvertimePersonaIDs = append([]string(nil), tiedLeaders...)
						break
					}
					session, err = s.store.SetOvertimeParticipants(id, tiedLeaders, round+1)
					if err != nil {
						s.failAndSend(events, id, err.Error())
						return
					}
					if shouldPauseAfterRound(round) {
						session, err = s.store.PauseAfterRound(id, round)
						if err != nil {
							s.failAndSend(events, id, err.Error())
							return
						}
						sendEvent(ctx, events, SSEEvent{
							Type:                 "support_prompt",
							Round:                round,
							CurrentRound:         session.CurrentRound,
							AwaitingSupport:      session.AwaitingSupport,
							AwaitingSupportRound: session.AwaitingSupportRound,
							Scores:               append([]DebateScore(nil), session.LiveScores...),
							NeutralJudge:         cloneNeutralJudge(session.NeutralJudge),
							OvertimePersonaIDs:   append([]string(nil), session.OvertimePersonaIDs...),
							SupportHistory:       append([]RoundSupportChoice(nil), session.SupportHistory...),
							Personas:             append([]Persona(nil), session.Personas...),
						})
						return
					}
					continue
				}
				break
			}

			if shouldPauseAfterRound(round) {
				session, err = s.store.PauseAfterRound(id, round)
				if err != nil {
					s.failAndSend(events, id, err.Error())
					return
				}
				sendEvent(ctx, events, SSEEvent{
					Type:                 "support_prompt",
					Round:                round,
					CurrentRound:         session.CurrentRound,
					AwaitingSupport:      session.AwaitingSupport,
					AwaitingSupportRound: session.AwaitingSupportRound,
					Scores:               append([]DebateScore(nil), session.LiveScores...),
					NeutralJudge:         cloneNeutralJudge(session.NeutralJudge),
					OvertimePersonaIDs:   append([]string(nil), session.OvertimePersonaIDs...),
					SupportHistory:       append([]RoundSupportChoice(nil), session.SupportHistory...),
					Personas:             append([]Persona(nil), session.Personas...),
				})
				return
			}
		}

		result, err := s.ai.JudgeDebate(ctx, session.Topic, session.Personas, history)
		if err != nil {
			s.failAndSend(events, id, fmt.Sprintf("裁判团掉线了: %v", err))
			return
		}
		result = mergeFinalResultWithLiveScores(result, session.LiveScores)
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
			Type:               "message",
			Round:              message.Round,
			RoundTitle:         message.RoundTitle,
			PersonaID:          message.PersonaID,
			PersonaName:        message.PersonaName,
			Content:            message.Content,
			OvertimePersonaIDs: append([]string(nil), session.OvertimePersonaIDs...),
		}) {
			return
		}
	}
	if session.StreamActive {
		return
	}
	if session.AwaitingSupport {
		sendEvent(ctx, events, SSEEvent{
			Type:                 "support_prompt",
			Round:                session.AwaitingSupportRound,
			CurrentRound:         session.CurrentRound,
			AwaitingSupport:      session.AwaitingSupport,
			AwaitingSupportRound: session.AwaitingSupportRound,
			Scores:               append([]DebateScore(nil), session.LiveScores...),
			NeutralJudge:         cloneNeutralJudge(session.NeutralJudge),
			OvertimePersonaIDs:   append([]string(nil), session.OvertimePersonaIDs...),
			SupportHistory:       append([]RoundSupportChoice(nil), session.SupportHistory...),
			Personas:             append([]Persona(nil), session.Personas...),
		})
		return
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

func findSessionPersonaByID(personas []Persona, id string) (Persona, bool) {
	for _, persona := range personas {
		if persona.ID == id {
			return persona, true
		}
	}
	return Persona{}, false
}

func hasRoundMessageForPersona(history []DebateMessage, round int, persona Persona) bool {
	for _, message := range history {
		if message.Round != round {
			continue
		}
		if persona.ID != "" && message.PersonaID == persona.ID {
			return true
		}
		if persona.Name != "" && message.PersonaName == persona.Name {
			return true
		}
	}
	return false
}

func cloneNeutralJudge(judge *NeutralJudgeState) *NeutralJudgeState {
	if judge == nil {
		return nil
	}
	cloned := *judge
	return &cloned
}

func activePersonasForRound(session *DebateSession, round int) []Persona {
	if session == nil {
		return nil
	}
	if round <= 3 || len(session.OvertimePersonaIDs) < 2 {
		return append([]Persona(nil), session.Personas...)
	}
	idSet := make(map[string]struct{}, len(session.OvertimePersonaIDs))
	for _, id := range session.OvertimePersonaIDs {
		idSet[id] = struct{}{}
	}
	active := make([]Persona, 0, len(session.OvertimePersonaIDs))
	for _, persona := range session.Personas {
		if _, ok := idSet[persona.ID]; ok {
			active = append(active, persona)
		}
	}
	if len(active) >= 2 {
		return active
	}
	return append([]Persona(nil), session.Personas...)
}

func activePersonaIDs(personas []Persona) []string {
	ids := make([]string, 0, len(personas))
	for _, persona := range personas {
		if strings.TrimSpace(persona.ID) != "" {
			ids = append(ids, persona.ID)
		}
	}
	return ids
}

func leadingPersonaIDs(scores []DebateScore, onlyPersonaIDs []string) []string {
	if len(scores) == 0 {
		return nil
	}

	filter := make(map[string]struct{}, len(onlyPersonaIDs))
	for _, id := range onlyPersonaIDs {
		if strings.TrimSpace(id) != "" {
			filter[id] = struct{}{}
		}
	}

	bestScore := -1
	leaders := make([]string, 0, len(scores))
	for _, score := range scores {
		if len(filter) > 0 {
			if _, ok := filter[score.PersonaID]; !ok {
				continue
			}
		}
		if score.Score > bestScore {
			bestScore = score.Score
			leaders = leaders[:0]
			if strings.TrimSpace(score.PersonaID) != "" {
				leaders = append(leaders, score.PersonaID)
			}
			continue
		}
		if score.Score == bestScore && strings.TrimSpace(score.PersonaID) != "" {
			leaders = append(leaders, score.PersonaID)
		}
	}
	return leaders
}

func mergeFinalResultWithLiveScores(result *DebateResult, liveScores []DebateScore) *DebateResult {
	if result == nil {
		result = &DebateResult{}
	}

	merged := *result
	if len(liveScores) > 0 {
		merged.Scores = append([]DebateScore(nil), liveScores...)
	}
	merged.Winner = resolveFinalWinner(merged.Winner, merged.Scores)
	return &merged
}

func resolveFinalWinner(preferred string, scores []DebateScore) string {
	if len(scores) == 0 {
		return strings.TrimSpace(preferred)
	}

	best := scores[0]
	for _, score := range scores[1:] {
		if score.Score > best.Score {
			best = score
		}
	}
	bestName := strings.TrimSpace(best.Persona)
	if bestName == "" {
		return strings.TrimSpace(preferred)
	}
	if strings.TrimSpace(preferred) == "" {
		return bestName
	}

	bestScore := best.Score
	for _, score := range scores {
		if strings.TrimSpace(score.Persona) == strings.TrimSpace(preferred) && score.Score == bestScore {
			return strings.TrimSpace(preferred)
		}
	}
	return bestName
}
