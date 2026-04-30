package mindarena

import (
	"errors"
	"sync"
)

var ErrDebateNotFound = errors.New("debate session not found")

type Store interface {
	Create(session *DebateSession) error
	Get(id string) (*DebateSession, error)
	Update(session *DebateSession) error
	UpdatePersonas(id string, personas []Persona) (*DebateSession, error)
	TryStartStreaming(id string) (*DebateSession, bool, error)
	FinishStreaming(id string) (*DebateSession, error)
	AppendMessages(id string, messages []DebateMessage) (*DebateSession, error)
	PauseAfterRound(id string, round int) (*DebateSession, error)
	SetOvertimeParticipants(id string, personaIDs []string, nextRound int) (*DebateSession, error)
	SubmitRoundSupport(id string, choice RoundSupportChoice) (*DebateSession, error)
	Complete(id string, result *DebateResult) (*DebateSession, error)
	Fail(id string, message string) (*DebateSession, error)
}

type MemoryStore struct {
	mu       sync.RWMutex
	sessions map[string]*DebateSession
}

func NewMemoryStore() *MemoryStore {
	return &MemoryStore{sessions: make(map[string]*DebateSession)}
}

func (s *MemoryStore) Create(session *DebateSession) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	copied := cloneSession(session)
	rebuildLiveScoreState(copied)
	s.sessions[copied.ID] = copied
	return nil
}

func (s *MemoryStore) Get(id string) (*DebateSession, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	session, ok := s.sessions[id]
	if !ok {
		return nil, ErrDebateNotFound
	}
	return cloneSession(session), nil
}

func (s *MemoryStore) Update(session *DebateSession) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.sessions[session.ID]; !ok {
		return ErrDebateNotFound
	}
	copied := cloneSession(session)
	copied.UpdatedAt = nowString()
	s.sessions[copied.ID] = copied
	return nil
}

func (s *MemoryStore) UpdatePersonas(id string, personas []Persona) (*DebateSession, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	session, ok := s.sessions[id]
	if !ok {
		return nil, ErrDebateNotFound
	}
	session.Personas = append([]Persona(nil), personas...)
	rebuildLiveScoreState(session)
	session.UpdatedAt = nowString()
	return cloneSession(session), nil
}

func (s *MemoryStore) TryStartStreaming(id string) (*DebateSession, bool, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	session, ok := s.sessions[id]
	if !ok {
		return nil, false, ErrDebateNotFound
	}
	if session.Status == DebateStatusDone || session.Status == DebateStatusFailed {
		return cloneSession(session), false, nil
	}
	if session.AwaitingSupport || session.StreamActive {
		return cloneSession(session), false, nil
	}
	if session.Status == DebateStatusCreated {
		session.Status = DebateStatusRunning
	}
	if session.CurrentRound <= 0 {
		session.CurrentRound = 1
	}
	session.StreamActive = true
	session.UpdatedAt = nowString()
	return cloneSession(session), true, nil
}

func (s *MemoryStore) FinishStreaming(id string) (*DebateSession, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	session, ok := s.sessions[id]
	if !ok {
		return nil, ErrDebateNotFound
	}
	session.StreamActive = false
	session.UpdatedAt = nowString()
	return cloneSession(session), nil
}

func (s *MemoryStore) AppendMessages(id string, messages []DebateMessage) (*DebateSession, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	session, ok := s.sessions[id]
	if !ok {
		return nil, ErrDebateNotFound
	}
	session.Messages = append(session.Messages, messages...)
	rebuildLiveScoreState(session)
	session.UpdatedAt = nowString()
	return cloneSession(session), nil
}

func (s *MemoryStore) PauseAfterRound(id string, round int) (*DebateSession, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	session, ok := s.sessions[id]
	if !ok {
		return nil, ErrDebateNotFound
	}
	session.LastCompletedRound = round
	session.CurrentRound = round + 1
	session.AwaitingSupport = true
	session.AwaitingSupportRound = round
	session.StreamActive = false
	session.UpdatedAt = nowString()
	return cloneSession(session), nil
}

func (s *MemoryStore) SetOvertimeParticipants(id string, personaIDs []string, nextRound int) (*DebateSession, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	session, ok := s.sessions[id]
	if !ok {
		return nil, ErrDebateNotFound
	}
	session.OvertimePersonaIDs = append([]string(nil), personaIDs...)
	if nextRound > session.CurrentRound {
		session.CurrentRound = nextRound
	}
	session.AwaitingSupport = false
	session.AwaitingSupportRound = 0
	session.UpdatedAt = nowString()
	return cloneSession(session), nil
}

func (s *MemoryStore) SubmitRoundSupport(id string, choice RoundSupportChoice) (*DebateSession, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	session, ok := s.sessions[id]
	if !ok {
		return nil, ErrDebateNotFound
	}

	replaced := false
	for i := range session.SupportHistory {
		if session.SupportHistory[i].Round == choice.Round {
			session.SupportHistory[i] = choice
			replaced = true
			break
		}
	}
	if !replaced {
		session.SupportHistory = append(session.SupportHistory, choice)
	}
	session.AwaitingSupport = false
	session.AwaitingSupportRound = 0
	if session.CurrentRound <= choice.Round {
		session.CurrentRound = choice.Round + 1
	}
	session.StreamActive = false
	rebuildLiveScoreState(session)
	session.UpdatedAt = nowString()
	return cloneSession(session), nil
}

func (s *MemoryStore) Complete(id string, result *DebateResult) (*DebateSession, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	session, ok := s.sessions[id]
	if !ok {
		return nil, ErrDebateNotFound
	}
	session.Result = result
	session.Status = DebateStatusDone
	session.StreamActive = false
	session.AwaitingSupport = false
	session.AwaitingSupportRound = 0
	session.OvertimePersonaIDs = nil
	if len(session.Messages) > 0 {
		session.LastCompletedRound = session.Messages[len(session.Messages)-1].Round
		if session.LastCompletedRound > 0 {
			session.CurrentRound = session.LastCompletedRound
		}
	}
	session.UpdatedAt = nowString()
	return cloneSession(session), nil
}

func (s *MemoryStore) Fail(id string, message string) (*DebateSession, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	session, ok := s.sessions[id]
	if !ok {
		return nil, ErrDebateNotFound
	}
	session.Error = message
	session.Status = DebateStatusFailed
	session.StreamActive = false
	session.AwaitingSupport = false
	session.AwaitingSupportRound = 0
	session.OvertimePersonaIDs = nil
	session.UpdatedAt = nowString()
	return cloneSession(session), nil
}

func cloneSession(session *DebateSession) *DebateSession {
	if session == nil {
		return nil
	}
	copied := *session
	copied.Personas = append([]Persona(nil), session.Personas...)
	copied.Messages = append([]DebateMessage(nil), session.Messages...)
	copied.SupportHistory = append([]RoundSupportChoice(nil), session.SupportHistory...)
	copied.LiveScores = append([]DebateScore(nil), session.LiveScores...)
	copied.OvertimePersonaIDs = append([]string(nil), session.OvertimePersonaIDs...)
	if session.NeutralJudge != nil {
		judge := *session.NeutralJudge
		copied.NeutralJudge = &judge
	}
	if session.Result != nil {
		result := *session.Result
		result.Scores = append([]DebateScore(nil), session.Result.Scores...)
		copied.Result = &result
	}
	return &copied
}
