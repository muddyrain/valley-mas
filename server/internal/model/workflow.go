package model

import (
	"time"
	"valley-server/internal/utils"

	"gorm.io/gorm"
)

type Workflow struct {
	ID          Int64String    `gorm:"primaryKey;autoIncrement:false" json:"id"`
	UserID      Int64String    `gorm:"index;not null" json:"userId"`
	Name        string         `gorm:"size:100;not null" json:"name"`
	Description string         `gorm:"size:500" json:"description"`
	Graph       string         `gorm:"type:json;not null" json:"graph"`
	Status      string         `gorm:"size:20;not null;default:'draft';index" json:"status"`
	CreatedAt   time.Time      `json:"createdAt"`
	UpdatedAt   time.Time      `json:"updatedAt"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
}

func (w *Workflow) BeforeCreate(tx *gorm.DB) error {
	if w.ID == 0 {
		w.ID = Int64String(utils.GenerateID())
	}
	return nil
}

type WorkflowRun struct {
	ID         Int64String    `gorm:"primaryKey;autoIncrement:false" json:"id"`
	WorkflowID Int64String    `gorm:"index;not null" json:"workflowId"`
	Status     string         `gorm:"size:20;not null;default:'running';index" json:"status"`
	Inputs     string         `gorm:"type:json" json:"inputs,omitempty"`
	Result     string         `gorm:"type:json" json:"result,omitempty"`
	StartedAt  time.Time      `json:"startedAt"`
	FinishedAt *time.Time     `json:"finishedAt,omitempty"`
	CreatedAt  time.Time      `json:"createdAt"`
	DeletedAt  gorm.DeletedAt `gorm:"index" json:"-"`
}

func (r *WorkflowRun) BeforeCreate(tx *gorm.DB) error {
	if r.ID == 0 {
		r.ID = Int64String(utils.GenerateID())
	}
	return nil
}
