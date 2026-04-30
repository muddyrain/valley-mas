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
	TryMarkRunning(id string) (*DebateSession, bool, error)
	AppendMessages(id string, messages []DebateMessage) (*DebateSession, error)
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
	session.UpdatedAt = nowString()
	return cloneSession(session), nil
}

func (s *MemoryStore) TryMarkRunning(id string) (*DebateSession, bool, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	session, ok := s.sessions[id]
	if !ok {
		return nil, false, ErrDebateNotFound
	}
	if session.Status != DebateStatusCreated {
		return cloneSession(session), false, nil
	}
	session.Status = DebateStatusRunning
	session.UpdatedAt = nowString()
	return cloneSession(session), true, nil
}

func (s *MemoryStore) AppendMessages(id string, messages []DebateMessage) (*DebateSession, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	session, ok := s.sessions[id]
	if !ok {
		return nil, ErrDebateNotFound
	}
	session.Messages = append(session.Messages, messages...)
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
	if session.Result != nil {
		result := *session.Result
		result.Scores = append([]DebateScore(nil), session.Result.Scores...)
		copied.Result = &result
	}
	return &copied
}
