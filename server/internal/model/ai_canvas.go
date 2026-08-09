package model

import (
	"time"
	"valley-server/internal/utils"
)

// AICanvasDocument stores the single editable canvas workspace owned by a user.
// Image layers remain data URLs so the document can be restored across devices.
type AICanvasDocument struct {
	ID           Int64String `gorm:"primaryKey;autoIncrement:false" json:"id"`
	UserID       Int64String `gorm:"uniqueIndex:uidx_ai_canvas_documents_user;not null" json:"userId"`
	Version      int         `gorm:"not null;default:1" json:"version"`
	AspectRatio  string      `gorm:"size:10;not null" json:"aspectRatio"`
	DocumentJSON string      `gorm:"type:text;not null" json:"-"`
	Revision     int         `gorm:"not null;default:1" json:"revision"`
	CreatedAt    time.Time   `json:"createdAt"`
	UpdatedAt    time.Time   `json:"updatedAt"`
}

func (document *AICanvasDocument) BeforeCreate() error {
	if document.ID == 0 {
		document.ID = Int64String(utils.GenerateID())
	}
	if document.Version == 0 {
		document.Version = 1
	}
	if document.Revision == 0 {
		document.Revision = 1
	}
	return nil
}
