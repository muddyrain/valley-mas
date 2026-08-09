package model

import (
	"time"
	"valley-server/internal/utils"

	"gorm.io/gorm"
)

// AIMotionStickerGeneration is the durable, owner-private record for one
// reference-image-to-frames-or-video-to-GIF job.
type AIMotionStickerGeneration struct {
	ID                  Int64String    `gorm:"primaryKey;autoIncrement:false" json:"id"`
	UserID              Int64String    `gorm:"index;not null" json:"userId"`
	ModelCatalogID      Int64String    `gorm:"index;not null" json:"modelCatalogId"`
	Provider            string         `gorm:"size:40;not null" json:"provider"`
	Model               string         `gorm:"size:180;not null" json:"model"`
	GenerationMode      string         `gorm:"size:16;not null;default:'video'" json:"generationMode"`
	ImageProtocol       string         `gorm:"size:40;not null;default:'auto'" json:"imageProtocol,omitempty"`
	VideoProtocol       string         `gorm:"size:40;not null;default:'auto'" json:"videoProtocol"`
	FrameCount          int            `gorm:"not null;default:0" json:"frameCount,omitempty"`
	Action              string         `gorm:"type:text;not null" json:"action"`
	Prompt              string         `gorm:"type:text;not null" json:"-"`
	AspectRatio         string         `gorm:"size:16;not null;default:'1:1'" json:"aspectRatio"`
	DurationSeconds     int            `gorm:"not null;default:5" json:"durationSeconds"`
	Resolution          string         `gorm:"size:16;not null;default:'720p'" json:"resolution"`
	ReferenceURL        string         `gorm:"type:text;not null" json:"-"`
	ReferenceStorageKey string         `gorm:"size:500;not null" json:"-"`
	ProviderTaskID      string         `gorm:"size:180;index;not null;default:''" json:"-"`
	Status              string         `gorm:"size:20;index;not null;default:'queued'" json:"status"`
	Stage               string         `gorm:"size:40;not null;default:'queued'" json:"stage"`
	MP4URL              string         `gorm:"type:text;not null;default:''" json:"-"`
	MP4StorageKey       string         `gorm:"size:500;not null;default:''" json:"-"`
	MP4Size             int64          `gorm:"not null;default:0" json:"mp4Size,omitempty"`
	GIFURL              string         `gorm:"type:text;not null;default:''" json:"-"`
	GIFStorageKey       string         `gorm:"size:500;not null;default:''" json:"-"`
	GIFSize             int64          `gorm:"not null;default:0" json:"gifSize,omitempty"`
	GIFWidth            int            `gorm:"not null;default:0" json:"gifWidth,omitempty"`
	GIFHeight           int            `gorm:"not null;default:0" json:"gifHeight,omitempty"`
	ErrorCode           string         `gorm:"size:80;not null;default:''" json:"errorCode,omitempty"`
	ErrorMessage        string         `gorm:"size:500;not null;default:''" json:"errorMessage,omitempty"`
	StartedAt           *time.Time     `json:"startedAt,omitempty"`
	FinishedAt          *time.Time     `json:"finishedAt,omitempty"`
	CreatedAt           time.Time      `json:"createdAt"`
	UpdatedAt           time.Time      `json:"updatedAt"`
	DeletedAt           gorm.DeletedAt `gorm:"index" json:"-"`
}

func (generation *AIMotionStickerGeneration) BeforeCreate(tx *gorm.DB) error {
	if generation.ID == 0 {
		generation.ID = Int64String(utils.GenerateID())
	}
	if generation.GenerationMode == "" {
		generation.GenerationMode = "video"
	}
	if generation.ImageProtocol == "" {
		generation.ImageProtocol = "auto"
	}
	if generation.VideoProtocol == "" {
		generation.VideoProtocol = "auto"
	}
	if generation.Status == "" {
		generation.Status = "queued"
	}
	if generation.Stage == "" {
		generation.Stage = "queued"
	}
	if generation.AspectRatio == "" {
		generation.AspectRatio = "1:1"
	}
	if generation.DurationSeconds == 0 {
		generation.DurationSeconds = 5
	}
	if generation.Resolution == "" {
		generation.Resolution = "720p"
	}
	return nil
}
