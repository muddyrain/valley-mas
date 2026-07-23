package model

import (
	"time"
	"valley-server/internal/utils"

	"gorm.io/gorm"
)

// AIImageGeneration stores one owner-private image creation job. Reference
// image bytes remain request-scoped and are deliberately never persisted.
type AIImageGeneration struct {
	ID               Int64String    `gorm:"primaryKey;autoIncrement:false" json:"id"`
	UserID           Int64String    `gorm:"index:idx_ai_image_generations_owner_created;not null" json:"userId"`
	ModelCatalogID   Int64String    `gorm:"index;not null" json:"modelCatalogId"`
	Provider         string         `gorm:"size:40;not null" json:"provider"`
	Model            string         `gorm:"size:180;not null" json:"model"`
	PresetID         string         `gorm:"size:40;not null" json:"presetId"`
	Prompt           string         `gorm:"type:text;not null" json:"prompt"`
	AspectRatio      string         `gorm:"size:10;not null" json:"aspectRatio"`
	Quality          string         `gorm:"size:10;not null" json:"quality"`
	RequestedSize    string         `gorm:"size:30;not null" json:"requestedSize"`
	ReferenceCount   int            `gorm:"not null;default:0" json:"referenceCount"`
	Status           string         `gorm:"size:20;index;not null;default:'queued'" json:"status"`
	Stage            string         `gorm:"size:20;not null;default:'preparing'" json:"stage"`
	ResultURL        string         `gorm:"size:1000" json:"resultUrl"`
	ResultStorageKey string         `gorm:"size:500" json:"-"`
	ResultWidth      int            `json:"resultWidth"`
	ResultHeight     int            `json:"resultHeight"`
	ResultSize       int64          `json:"resultSize"`
	ResourceID       *Int64String   `gorm:"index" json:"resourceId,omitempty"`
	ErrorCode        string         `gorm:"size:80" json:"errorCode"`
	ErrorMessage     string         `gorm:"size:500" json:"errorMessage"`
	StartedAt        *time.Time     `json:"startedAt,omitempty"`
	FinishedAt       *time.Time     `json:"finishedAt,omitempty"`
	CreatedAt        time.Time      `gorm:"index:idx_ai_image_generations_owner_created,priority:2" json:"createdAt"`
	UpdatedAt        time.Time      `json:"updatedAt"`
	DeletedAt        gorm.DeletedAt `gorm:"index" json:"-"`
}

func (generation *AIImageGeneration) BeforeCreate(tx *gorm.DB) error {
	if generation.ID == 0 {
		generation.ID = Int64String(utils.GenerateID())
	}
	if generation.Status == "" {
		generation.Status = "queued"
	}
	if generation.Stage == "" {
		generation.Stage = "preparing"
	}
	return nil
}
