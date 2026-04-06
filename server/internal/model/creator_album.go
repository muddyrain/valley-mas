package model

import (
	"time"
	"valley-server/internal/utils"

	"gorm.io/gorm"
)

// CreatorAlbum 创作者资源专辑
type CreatorAlbum struct {
	ID              Int64String    `gorm:"primaryKey;autoIncrement:false" json:"id"`
	CreatorID       Int64String    `gorm:"index;not null" json:"creatorId"`
	Name            string         `gorm:"size:80;not null" json:"name"`
	Description     string         `gorm:"size:255" json:"description"`
	CoverResourceID *Int64String   `gorm:"index" json:"coverResourceId,omitempty"`
	CreatedAt       time.Time      `json:"createdAt"`
	UpdatedAt       time.Time      `json:"updatedAt"`
	DeletedAt       gorm.DeletedAt `gorm:"index" json:"-"`

	Creator       *Creator   `gorm:"foreignKey:CreatorID" json:"creator,omitempty"`
	CoverResource *Resource  `gorm:"foreignKey:CoverResourceID" json:"coverResource,omitempty"`
	Resources     []Resource `gorm:"many2many:creator_album_resources;" json:"resources,omitempty"`
}

func (a *CreatorAlbum) BeforeCreate(tx *gorm.DB) error {
	if a.ID == 0 {
		a.ID = Int64String(utils.GenerateID())
	}
	return nil
}
