package mindarena

import "time"

type DebateMode string

const (
	DebateModeSerious   DebateMode = "serious"
	DebateModeFunny     DebateMode = "funny"
	DebateModeSharp     DebateMode = "sharp"
	DebateModeWild      DebateMode = "wild"
	DebateModeWorkplace DebateMode = "workplace"
	DebateModeEmotion   DebateMode = "emotion"
)

type DebateStatus string

const (
	DebateStatusCreated DebateStatus = "created"
	DebateStatusRunning DebateStatus = "running"
	DebateStatusDone    DebateStatus = "done"
	DebateStatusFailed  DebateStatus = "failed"
)

type Persona struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Stance      string `json:"stance"`
	Personality string `json:"personality"`
	Style       string `json:"style"`
	Catchphrase string `json:"catchphrase"`
	Avatar      string `json:"avatar,omitempty"`
	Color       string `json:"color,omitempty"`
}

type DebateMessage struct {
	ID          string `json:"id"`
	Round       int    `json:"round"`
	RoundTitle  string `json:"roundTitle"`
	PersonaID   string `json:"personaId"`
	PersonaName string `json:"personaName"`
	Content     string `json:"content"`
	CreatedAt   string `json:"createdAt"`
}

type DebateScore struct {
	Persona string `json:"persona"`
	Score   int    `json:"score"`
}

type DebateResult struct {
	Winner      string        `json:"winner"`
	FinalAdvice string        `json:"finalAdvice"`
	Quote       string        `json:"quote"`
	Scores      []DebateScore `json:"scores"`
}

type DebateSession struct {
	ID           string          `json:"id"`
	Topic        string          `json:"topic"`
	Mode         DebateMode      `json:"mode"`
	Status       DebateStatus    `json:"status"`
	PersonaCount int             `json:"personaCount"`
	Personas     []Persona       `json:"personas"`
	Messages     []DebateMessage `json:"messages"`
	Result       *DebateResult   `json:"result,omitempty"`
	Error        string          `json:"error,omitempty"`
	CreatedAt    string          `json:"createdAt"`
	UpdatedAt    string          `json:"updatedAt"`
}

type CreateDebateRequest struct {
	Topic        string `json:"topic" binding:"required"`
	Mode         string `json:"mode"`
	PersonaCount int    `json:"personaCount"`
}

type CreateDebateResponse struct {
	SessionID    string       `json:"sessionId"`
	Topic        string       `json:"topic"`
	Mode         DebateMode   `json:"mode"`
	Status       DebateStatus `json:"status"`
	PersonaCount int          `json:"personaCount"`
	Personas     []Persona    `json:"personas"`
}

type SSEEvent struct {
	Type         string          `json:"type"`
	Round        int             `json:"round,omitempty"`
	RoundTitle   string          `json:"roundTitle,omitempty"`
	PersonaCount int             `json:"personaCount,omitempty"`
	PersonaID    string          `json:"personaId,omitempty"`
	PersonaName  string          `json:"personaName,omitempty"`
	Content      string          `json:"content,omitempty"`
	Result       *DebateResult   `json:"result,omitempty"`
	SessionID    string          `json:"sessionId,omitempty"`
	Message      string          `json:"message,omitempty"`
	Scores       []DebateScore   `json:"scores,omitempty"`
	Session      *DebateSession  `json:"session,omitempty"`
	Personas     []Persona       `json:"personas,omitempty"`
	Messages     []DebateMessage `json:"messages,omitempty"`
}

func normalizeMode(mode string) DebateMode {
	switch DebateMode(mode) {
	case DebateModeSerious, DebateModeFunny, DebateModeSharp, DebateModeWild, DebateModeWorkplace, DebateModeEmotion:
		return DebateMode(mode)
	default:
		return DebateModeFunny
	}
}

func normalizePersonaCount(count int) int {
	if count < 3 {
		return 5
	}
	if count > 5 {
		return 5
	}
	return count
}

func nowString() string {
	return time.Now().Format(time.RFC3339)
}

func roundTitle(round int) string {
	switch round {
	case 1:
		return "立场表达"
	case 2:
		return "互相反驳"
	case 3:
		return "最终陈词"
	default:
		return "加时讨论"
	}
}
