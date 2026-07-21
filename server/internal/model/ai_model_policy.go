package model

import (
	"time"
	"valley-server/internal/utils"

	"gorm.io/gorm"
)

// AIModel is an administrator-approved model exposed by a configured provider.
// Provider credentials never live in this table.
type AIModel struct {
	ID           Int64String    `gorm:"primaryKey;autoIncrement:false" json:"id"`
	Provider     string         `gorm:"size:40;uniqueIndex:uidx_ai_model_provider_id;not null" json:"provider"`
	ModelID      string         `gorm:"size:180;uniqueIndex:uidx_ai_model_provider_id;not null" json:"modelId"`
	DisplayName  string         `gorm:"size:180;not null" json:"displayName"`
	Capabilities string         `gorm:"type:text;not null;default:'[]'" json:"capabilities"`
	Enabled      bool           `gorm:"index;not null;default:true" json:"enabled"`
	SortOrder    int            `gorm:"index;not null;default:0" json:"sortOrder"`
	CreatedAt    time.Time      `json:"createdAt"`
	UpdatedAt    time.Time      `json:"updatedAt"`
	DeletedAt    gorm.DeletedAt `gorm:"index" json:"-"`
}

func (m *AIModel) BeforeCreate(tx *gorm.DB) error {
	if m.ID == 0 {
		m.ID = Int64String(utils.GenerateID())
	}
	return nil
}
