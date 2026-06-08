package model

import (
	"time"
	"valley-server/internal/utils"

	"gorm.io/gorm"
)

// AIUsageLog records operational AI calls for Admin audit views.
type AIUsageLog struct {
	ID               Int64String `gorm:"primaryKey;autoIncrement:false" json:"id"`
	Feature          string      `gorm:"size:80;index;not null" json:"feature"`
	Provider         string      `gorm:"size:40;index;not null" json:"provider"`
	Model            string      `gorm:"size:120;index" json:"model"`
	UserID           string      `gorm:"size:32;index" json:"userId,omitempty"`
	Status           string      `gorm:"size:20;index;not null" json:"status"`
	Stream           bool        `gorm:"index;default:false" json:"stream"`
	PromptChars      int         `json:"promptChars"`
	ResponseChars    int         `json:"responseChars"`
	PromptTokens     int         `json:"promptTokens"`
	CompletionTokens int         `json:"completionTokens"`
	TotalTokens      int         `json:"totalTokens"`
	LatencyMs        int64       `gorm:"index" json:"latencyMs"`
	ErrorMessage     string      `gorm:"size:1000" json:"errorMessage,omitempty"`
	CreatedAt        time.Time   `gorm:"index" json:"createdAt"`
}

func (l *AIUsageLog) BeforeCreate(tx *gorm.DB) error {
	if l.ID == 0 {
		l.ID = Int64String(utils.GenerateID())
	}
	return nil
}
