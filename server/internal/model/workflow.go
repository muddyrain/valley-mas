package model

import (
	"strings"
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
	ID            Int64String    `gorm:"primaryKey;autoIncrement:false;index:idx_workflow_runs_workflow_user_started,priority:4" json:"id"`
	WorkflowID    Int64String    `gorm:"index;not null;index:idx_workflow_runs_workflow_user_started,priority:1" json:"workflowId"`
	UserID        Int64String    `gorm:"index;not null;index:idx_workflow_runs_workflow_user_started,priority:2" json:"userId"`
	Status        string         `gorm:"size:20;not null;default:'running';index" json:"status"`
	Inputs        string         `gorm:"type:json" json:"inputs,omitempty"`
	GraphSnapshot string         `gorm:"type:json;not null" json:"graphSnapshot"`
	Result        string         `gorm:"type:json" json:"result,omitempty"`
	StartedAt     time.Time      `gorm:"index:idx_workflow_runs_workflow_user_started,priority:3" json:"startedAt"`
	FinishedAt    *time.Time     `json:"finishedAt,omitempty"`
	CreatedAt     time.Time      `json:"createdAt"`
	DeletedAt     gorm.DeletedAt `gorm:"index" json:"-"`
}

func (r *WorkflowRun) BeforeCreate(tx *gorm.DB) error {
	if r.ID == 0 {
		r.ID = Int64String(utils.GenerateID())
	}
	r.Inputs = normalizeWorkflowJSON(r.Inputs)
	r.GraphSnapshot = normalizeWorkflowJSON(r.GraphSnapshot)
	r.Result = normalizeWorkflowJSON(r.Result)
	return nil
}

// WorkflowNodeRun is the safe, user-visible state for one node execution.
// Raw files, prompts and upstream error text are never written to this table.
type WorkflowNodeRun struct {
	ID            Int64String    `gorm:"primaryKey;autoIncrement:false" json:"id"`
	WorkflowRunID Int64String    `gorm:"index;not null;uniqueIndex:uidx_workflow_run_node" json:"workflowRunId"`
	NodeID        string         `gorm:"size:120;not null;uniqueIndex:uidx_workflow_run_node" json:"nodeId"`
	NodeType      string         `gorm:"size:80;not null" json:"nodeType"`
	Status        string         `gorm:"size:20;not null;index" json:"status"`
	Input         string         `gorm:"type:json" json:"input,omitempty"`
	Output        string         `gorm:"type:json" json:"output,omitempty"`
	ErrorCode     string         `gorm:"size:80" json:"errorCode,omitempty"`
	DurationMs    int64          `json:"durationMs,omitempty"`
	StartedAt     time.Time      `json:"startedAt"`
	FinishedAt    *time.Time     `json:"finishedAt,omitempty"`
	CreatedAt     time.Time      `json:"createdAt"`
	UpdatedAt     time.Time      `json:"updatedAt"`
	DeletedAt     gorm.DeletedAt `gorm:"index" json:"-"`
}

func (r *WorkflowNodeRun) BeforeCreate(tx *gorm.DB) error {
	if r.ID == 0 {
		r.ID = Int64String(utils.GenerateID())
	}
	r.Input = normalizeWorkflowJSON(r.Input)
	r.Output = normalizeWorkflowJSON(r.Output)
	return nil
}

func normalizeWorkflowJSON(value string) string {
	if strings.TrimSpace(value) == "" {
		return "{}"
	}
	return value
}
