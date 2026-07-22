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
	GraphHash   string         `gorm:"-" json:"graphHash,omitempty"`
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
	SourceRunID   *Int64String   `gorm:"index" json:"sourceRunId,omitempty"`
	Result        string         `gorm:"type:json" json:"result,omitempty"`
	StartedAt     time.Time      `gorm:"index:idx_workflow_runs_workflow_user_started,priority:3" json:"startedAt"`
	FinishedAt    *time.Time     `json:"finishedAt,omitempty"`
	CreatedAt     time.Time      `json:"createdAt"`
	DeletedAt     gorm.DeletedAt `gorm:"index" json:"-"`
}

// WorkflowTrigger is an owner-private schedule that can enqueue a published
// workflow. P14.1 only permits cron triggers for graphs with no file input or
// side-effect capability.
type WorkflowTrigger struct {
	ID             Int64String    `gorm:"primaryKey;autoIncrement:false" json:"id"`
	WorkflowID     Int64String    `gorm:"not null;index:idx_workflow_trigger_owner_workflow" json:"workflowId"`
	UserID         Int64String    `gorm:"not null;index:idx_workflow_trigger_owner_workflow" json:"userId"`
	Type           string         `gorm:"size:20;not null;default:'cron'" json:"type"`
	CronExpression string         `gorm:"size:120;not null" json:"cronExpression"`
	Timezone       string         `gorm:"size:80;not null;default:'Asia/Shanghai'" json:"timezone"`
	Status         string         `gorm:"size:20;not null;default:'active';index" json:"status"`
	NextRunAt      *time.Time     `gorm:"index" json:"nextRunAt,omitempty"`
	LastRunAt      *time.Time     `json:"lastRunAt,omitempty"`
	CreatedAt      time.Time      `json:"createdAt"`
	UpdatedAt      time.Time      `json:"updatedAt"`
	DeletedAt      gorm.DeletedAt `gorm:"index" json:"-"`
}

// WorkflowRunJob is the durable handoff between a trigger and the background
// worker. The idempotency key is unique so concurrent scanners cannot enqueue
// the same trigger slot twice.
type WorkflowRunJob struct {
	ID             Int64String    `gorm:"primaryKey;autoIncrement:false" json:"id"`
	TriggerID      Int64String    `gorm:"not null;index" json:"triggerId"`
	WorkflowID     Int64String    `gorm:"not null;index" json:"workflowId"`
	UserID         Int64String    `gorm:"not null;index" json:"userId"`
	VersionID      Int64String    `gorm:"not null" json:"versionId"`
	GraphSnapshot  string         `gorm:"type:json;not null" json:"-"`
	Status         string         `gorm:"size:20;not null;default:'queued';index" json:"status"`
	IdempotencyKey string         `gorm:"size:180;not null;uniqueIndex" json:"-"`
	ScheduledAt    time.Time      `gorm:"not null;index" json:"scheduledAt"`
	LeaseUntil     *time.Time     `gorm:"index" json:"leaseUntil,omitempty"`
	Attempt        int            `gorm:"not null;default:0" json:"attempt"`
	CreatedAt      time.Time      `json:"createdAt"`
	UpdatedAt      time.Time      `json:"updatedAt"`
	DeletedAt      gorm.DeletedAt `gorm:"index" json:"-"`
}

func (job *WorkflowRunJob) BeforeCreate(tx *gorm.DB) error {
	if job.ID == 0 {
		job.ID = Int64String(utils.GenerateID())
	}
	job.GraphSnapshot = normalizeWorkflowJSON(job.GraphSnapshot)
	return nil
}

func (trigger *WorkflowTrigger) BeforeCreate(tx *gorm.DB) error {
	if trigger.ID == 0 {
		trigger.ID = Int64String(utils.GenerateID())
	}
	return nil
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
	CapabilityID  string         `gorm:"size:120;index" json:"capabilityId,omitempty"`
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

// WorkflowRunEvent is an immutable, owner-scoped trace event. It stores only
// the same safe previews that are emitted to the workflow SSE stream.
type WorkflowRunEvent struct {
	ID            Int64String    `gorm:"primaryKey;autoIncrement:false" json:"id"`
	WorkflowRunID Int64String    `gorm:"index;not null;uniqueIndex:uidx_workflow_run_event_sequence,priority:1" json:"workflowRunId"`
	Sequence      int64          `gorm:"not null;uniqueIndex:uidx_workflow_run_event_sequence,priority:2" json:"sequence"`
	NodeID        string         `gorm:"size:120;index" json:"nodeId,omitempty"`
	NodeType      string         `gorm:"size:80" json:"nodeType,omitempty"`
	CapabilityID  string         `gorm:"size:120;index" json:"capabilityId,omitempty"`
	Status        string         `gorm:"size:20;not null;index" json:"status"`
	Message       string         `gorm:"size:500" json:"message,omitempty"`
	Input         string         `gorm:"type:json" json:"input,omitempty"`
	Output        string         `gorm:"type:json" json:"output,omitempty"`
	ErrorCode     string         `gorm:"size:80" json:"errorCode,omitempty"`
	DurationMs    int64          `json:"durationMs,omitempty"`
	OccurredAt    time.Time      `gorm:"index;not null" json:"occurredAt"`
	CreatedAt     time.Time      `json:"createdAt"`
	DeletedAt     gorm.DeletedAt `gorm:"index" json:"-"`
}

// WorkflowTestCase is an owner-private, version-locked regression case. Inputs
// and assertions are structured JSON so the server can validate them before a
// test run is created.
type WorkflowTestCase struct {
	ID         Int64String    `gorm:"primaryKey;autoIncrement:false" json:"id"`
	WorkflowID Int64String    `gorm:"index;not null" json:"workflowId"`
	UserID     Int64String    `gorm:"index;not null" json:"userId"`
	VersionID  Int64String    `gorm:"index;not null" json:"versionId"`
	Name       string         `gorm:"size:120;not null" json:"name"`
	Inputs     string         `gorm:"type:json;not null" json:"inputs"`
	Assertions string         `gorm:"type:json;not null" json:"assertions"`
	CreatedAt  time.Time      `json:"createdAt"`
	UpdatedAt  time.Time      `json:"updatedAt"`
	DeletedAt  gorm.DeletedAt `gorm:"index" json:"-"`
}

func (r *WorkflowTestCase) BeforeCreate(tx *gorm.DB) error {
	if r.ID == 0 {
		r.ID = Int64String(utils.GenerateID())
	}
	r.Inputs = normalizeWorkflowJSON(r.Inputs)
	r.Assertions = normalizeWorkflowJSONArray(r.Assertions)
	return nil
}

// WorkflowTestResult records one independent test run. It never alters the
// immutable workflow version or ordinary run history.
type WorkflowTestResult struct {
	ID                 Int64String    `gorm:"primaryKey;autoIncrement:false" json:"id"`
	WorkflowTestCaseID Int64String    `gorm:"index;not null" json:"workflowTestCaseId"`
	WorkflowRunID      *Int64String   `gorm:"index" json:"workflowRunId,omitempty"`
	WorkflowID         Int64String    `gorm:"index;not null" json:"workflowId"`
	UserID             Int64String    `gorm:"index;not null" json:"userId"`
	VersionID          Int64String    `gorm:"index;not null" json:"versionId"`
	Status             string         `gorm:"size:20;not null;index" json:"status"`
	Output             string         `gorm:"type:json" json:"output,omitempty"`
	AssertionResults   string         `gorm:"type:json" json:"assertionResults,omitempty"`
	ErrorCode          string         `gorm:"size:80" json:"errorCode,omitempty"`
	StartedAt          time.Time      `json:"startedAt"`
	FinishedAt         *time.Time     `json:"finishedAt,omitempty"`
	CreatedAt          time.Time      `json:"createdAt"`
	DeletedAt          gorm.DeletedAt `gorm:"index" json:"-"`
}

func (r *WorkflowTestResult) BeforeCreate(tx *gorm.DB) error {
	if r.ID == 0 {
		r.ID = Int64String(utils.GenerateID())
	}
	r.Output = normalizeWorkflowJSON(r.Output)
	r.AssertionResults = normalizeWorkflowJSONArray(r.AssertionResults)
	return nil
}

func (r *WorkflowRunEvent) BeforeCreate(tx *gorm.DB) error {
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

func normalizeWorkflowJSONArray(value string) string {
	if strings.TrimSpace(value) == "" {
		return "[]"
	}
	return value
}
