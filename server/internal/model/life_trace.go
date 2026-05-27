package model

import (
	"time"
	"valley-server/internal/utils"

	"gorm.io/gorm"
)

type LifeTracePlan struct {
	ID          Int64String    `gorm:"primaryKey;autoIncrement:false" json:"id"`
	UserID      Int64String    `gorm:"column:user_id;index;not null" json:"userId"`
	Title       string         `gorm:"size:160;not null" json:"title"`
	Type        string         `gorm:"size:30;not null" json:"type"`
	TimeLabel   string         `gorm:"size:80;not null" json:"timeLabel"`
	Reminder    bool           `gorm:"default:true" json:"reminder"`
	ImageURL    string         `gorm:"size:800" json:"imageUrl,omitempty"`
	Location    string         `gorm:"size:120" json:"location,omitempty"`
	Note        string         `gorm:"size:1000" json:"note"`
	Source      string         `gorm:"size:40;default:'manual';index" json:"source"`
	Completed   bool           `gorm:"default:false;index" json:"completed"`
	CompletedAt *time.Time     `json:"completedAt,omitempty"`
	CreatedAt   time.Time      `json:"createdAt"`
	UpdatedAt   time.Time      `json:"updatedAt"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
}

func (p *LifeTracePlan) BeforeCreate(tx *gorm.DB) error {
	if p.ID == 0 {
		p.ID = Int64String(utils.GenerateID())
	}
	if p.Source == "" {
		p.Source = "manual"
	}
	return nil
}
