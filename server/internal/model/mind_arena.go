package model

import (
	"time"
	"valley-server/internal/utils"

	"gorm.io/gorm"
)

type MindArenaDebateSession struct {
	ID                   string         `gorm:"primaryKey;size:80" json:"id"`
	Topic                string         `gorm:"type:text;not null" json:"topic"`
	Mode                 string         `gorm:"size:30;index;not null" json:"mode"`
	CatalogModelID       string         `gorm:"size:40;index" json:"catalogModelId,omitempty"`
	Provider             string         `gorm:"size:40" json:"provider,omitempty"`
	Model                string         `gorm:"size:180" json:"model,omitempty"`
	Status               string         `gorm:"size:30;index;not null" json:"status"`
	PersonaCount         int            `gorm:"not null;default:5" json:"personaCount"`
	CurrentRound         int            `gorm:"not null;default:1" json:"currentRound"`
	LastCompletedRound   int            `gorm:"not null;default:0" json:"lastCompletedRound"`
	AwaitingSupport      bool           `gorm:"index;default:false" json:"awaitingSupport"`
	AwaitingSupportRound int            `gorm:"not null;default:0" json:"awaitingSupportRound"`
	PersonasJSON         string         `gorm:"type:text;not null;default:'[]'" json:"-"`
	LiveScoresJSON       string         `gorm:"type:text;not null;default:'[]'" json:"-"`
	NeutralJudgeJSON     string         `gorm:"type:text" json:"-"`
	OvertimePersonaIDs   string         `gorm:"type:text;not null;default:'[]'" json:"-"`
	SupportHistoryJSON   string         `gorm:"type:text;not null;default:'[]'" json:"-"`
	ResultJSON           string         `gorm:"type:text" json:"-"`
	Error                string         `gorm:"type:text" json:"error,omitempty"`
	CreatedAt            time.Time      `json:"createdAt"`
	UpdatedAt            time.Time      `json:"updatedAt"`
	DeletedAt            gorm.DeletedAt `gorm:"index" json:"-"`
}

type MindArenaDebateMessage struct {
	ID          string         `gorm:"primaryKey;size:80" json:"id"`
	SessionID   string         `gorm:"size:80;index;not null" json:"sessionId"`
	Round       int            `gorm:"index;not null" json:"round"`
	RoundTitle  string         `gorm:"size:80" json:"roundTitle"`
	PersonaID   string         `gorm:"size:80;index" json:"personaId"`
	PersonaName string         `gorm:"size:80" json:"personaName"`
	Content     string         `gorm:"type:text;not null" json:"content"`
	CreatedAt   time.Time      `json:"createdAt"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
}

type MindArenaDebateScore struct {
	ID            Int64String    `gorm:"primaryKey;autoIncrement:false" json:"id"`
	SessionID     string         `gorm:"size:80;index;not null" json:"sessionId"`
	Persona       string         `gorm:"size:80;not null" json:"persona"`
	PersonaID     string         `gorm:"size:80;index" json:"personaId,omitempty"`
	Score         int            `gorm:"not null;default:0" json:"score"`
	JudgeScore    int            `gorm:"not null;default:0" json:"judgeScore,omitempty"`
	AudienceScore int            `gorm:"not null;default:0" json:"audienceScore,omitempty"`
	JudgeNote     string         `gorm:"size:500" json:"judgeNote,omitempty"`
	CreatedAt     time.Time      `json:"createdAt"`
	UpdatedAt     time.Time      `json:"updatedAt"`
	DeletedAt     gorm.DeletedAt `gorm:"index" json:"-"`
}

func (score *MindArenaDebateScore) BeforeCreate(tx *gorm.DB) error {
	if score.ID == 0 {
		score.ID = Int64String(utils.GenerateID())
	}
	return nil
}
