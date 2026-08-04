package model

import (
	"strings"
	"time"
	"valley-server/internal/utils"

	"gorm.io/gorm"
)

type Workflow struct {
	ID                     Int64String    `gorm:"primaryKey;autoIncrement:false" json:"id"`
	UserID                 Int64String    `gorm:"index;not null" json:"userId"`
	Name                   string         `gorm:"size:100;not null" json:"name"`
	Description            string         `gorm:"size:500" json:"description"`
	Graph                  string         `gorm:"type:json;not null" json:"graph"`
	GraphHash              string         `gorm:"-" json:"graphHash,omitempty"`
	Revision               int64          `gorm:"not null;default:1" json:"revision"`
	Status                 string         `gorm:"size:20;not null;default:'draft';index" json:"status"`
	CreatedAt              time.Time      `json:"createdAt"`
	UpdatedAt              time.Time      `json:"updatedAt"`
	CollaborationStatus    string         `gorm:"-" json:"collaborationStatus,omitempty"`
	CollaborationUpdatedAt *time.Time     `gorm:"-" json:"collaborationUpdatedAt,omitempty"`
	DeletedAt              gorm.DeletedAt `gorm:"index" json:"-"`
}

// WorkflowCollaborationTask is the durable queue record for the workflow-only
// collaboration agent. Messages stay in the canonical workbench session while
// this record owns execution, cancellation and direct draft mutation state.
type WorkflowCollaborationTask struct {
	ID                Int64String    `gorm:"primaryKey;autoIncrement:false" json:"id"`
	UserID            Int64String    `gorm:"index;not null" json:"userId"`
	WorkflowID        Int64String    `gorm:"index;not null" json:"workflowId"`
	SessionID         Int64String    `gorm:"index;not null" json:"sessionId"`
	UserMessageID     Int64String    `gorm:"index;not null" json:"userMessageId"`
	ChangeID          *Int64String   `gorm:"index" json:"changeId,omitempty"`
	Title             string         `gorm:"size:160;not null" json:"title"`
	Status            string         `gorm:"size:24;index;not null;default:'queued'" json:"status"`
	Payload           string         `gorm:"type:text;not null" json:"-"`
	Progress          int            `gorm:"not null;default:0" json:"progress"`
	StatusMessage     string         `gorm:"size:500;not null;default:''" json:"statusMessage"`
	PartialOutput     string         `gorm:"type:text;not null;default:''" json:"partialOutput"`
	QueuePosition     int            `gorm:"-" json:"queuePosition,omitempty"`
	ErrorCode         string         `gorm:"size:80;not null;default:''" json:"errorCode,omitempty"`
	BaseRevision      int64          `gorm:"not null" json:"baseRevision"`
	BaseHash          string         `gorm:"size:64;not null" json:"baseHash"`
	IdempotencyKey    string         `gorm:"size:100;not null;uniqueIndex" json:"-"`
	CancelRequestedAt *time.Time     `gorm:"index" json:"cancelRequestedAt,omitempty"`
	StartedAt         *time.Time     `json:"startedAt,omitempty"`
	FinishedAt        *time.Time     `json:"finishedAt,omitempty"`
	CreatedAt         time.Time      `json:"createdAt"`
	UpdatedAt         time.Time      `json:"updatedAt"`
	DeletedAt         gorm.DeletedAt `gorm:"index" json:"-"`
}

func (task *WorkflowCollaborationTask) BeforeCreate(tx *gorm.DB) error {
	if task.ID == 0 {
		task.ID = Int64String(utils.GenerateID())
	}
	if task.Status == "" {
		task.Status = "queued"
	}
	return nil
}

// WorkflowCollaborationAttachment stores the bounded source and parsed text
// for one workflow collaboration turn. ParsedText is never returned directly.
type WorkflowCollaborationAttachment struct {
	ID            Int64String    `gorm:"primaryKey;autoIncrement:false" json:"id"`
	UserID        Int64String    `gorm:"index;not null" json:"userId"`
	WorkflowID    Int64String    `gorm:"index;not null" json:"workflowId"`
	SessionID     Int64String    `gorm:"index;not null" json:"sessionId"`
	MessageID     *Int64String   `gorm:"index" json:"messageId,omitempty"`
	Name          string         `gorm:"size:255;not null" json:"name"`
	MimeType      string         `gorm:"size:120;not null" json:"mimeType"`
	SizeBytes     int64          `gorm:"not null" json:"sizeBytes"`
	ParsedText    string         `gorm:"type:text;not null" json:"-"`
	SourceContent []byte         `gorm:"type:bytea" json:"-"`
	Status        string         `gorm:"size:20;index;not null;default:'ready'" json:"status"`
	CreatedAt     time.Time      `json:"createdAt"`
	DeletedAt     gorm.DeletedAt `gorm:"index" json:"-"`
}

func (attachment *WorkflowCollaborationAttachment) BeforeCreate(tx *gorm.DB) error {
	if attachment.ID == 0 {
		attachment.ID = Int64String(utils.GenerateID())
	}
	if attachment.Status == "" {
		attachment.Status = "ready"
	}
	return nil
}

// WorkflowCollaborationApproval holds an owner decision for one risky action.
// Arguments remain server-only and approval is scoped to a stable fingerprint.
type WorkflowCollaborationApproval struct {
	ID          Int64String    `gorm:"primaryKey;autoIncrement:false" json:"id"`
	TaskID      Int64String    `gorm:"index;not null" json:"taskId"`
	UserID      Int64String    `gorm:"index;not null" json:"userId"`
	WorkflowID  Int64String    `gorm:"index;not null" json:"workflowId"`
	Action      string         `gorm:"size:100;not null" json:"action"`
	RiskLevel   string         `gorm:"size:20;not null" json:"riskLevel"`
	Fingerprint string         `gorm:"size:64;uniqueIndex:uidx_workflow_collaboration_approval;not null" json:"-"`
	Summary     string         `gorm:"size:500;not null" json:"summary"`
	Arguments   string         `gorm:"type:text;not null" json:"-"`
	Status      string         `gorm:"size:20;index;not null;default:'pending'" json:"status"`
	Note        string         `gorm:"size:500;not null;default:''" json:"note,omitempty"`
	DecidedAt   *time.Time     `json:"decidedAt,omitempty"`
	CreatedAt   time.Time      `json:"createdAt"`
	UpdatedAt   time.Time      `json:"updatedAt"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
}

func (approval *WorkflowCollaborationApproval) BeforeCreate(tx *gorm.DB) error {
	if approval.ID == 0 {
		approval.ID = Int64String(utils.GenerateID())
	}
	if approval.Status == "" {
		approval.Status = "pending"
	}
	return nil
}

// WorkflowCollaborationChange is the server-side source of truth for one
// direct AI draft mutation and its all-or-nothing inverse operation sequence.
type WorkflowCollaborationChange struct {
	ID                Int64String    `gorm:"primaryKey;autoIncrement:false" json:"id"`
	UserID            Int64String    `gorm:"index;not null" json:"userId"`
	WorkflowID        Int64String    `gorm:"index;not null" json:"workflowId"`
	SessionID         Int64String    `gorm:"index;not null" json:"sessionId"`
	TaskID            Int64String    `gorm:"index;not null;uniqueIndex" json:"taskId"`
	BaseRevision      int64          `gorm:"not null" json:"baseRevision"`
	AppliedRevision   int64          `gorm:"not null" json:"appliedRevision"`
	RevertedRevision  *int64         `json:"revertedRevision,omitempty"`
	BaseHash          string         `gorm:"size:64;not null" json:"baseHash"`
	AppliedHash       string         `gorm:"size:64;not null" json:"appliedHash"`
	AppliedGraph      string         `gorm:"type:text;not null" json:"-"`
	ForwardOperations string         `gorm:"type:text;not null" json:"forwardOperations"`
	InverseOperations string         `gorm:"type:text;not null" json:"-"`
	Diff              string         `gorm:"type:text;not null;default:'{}'" json:"diff"`
	ConflictPaths     string         `gorm:"type:text;not null;default:'[]'" json:"conflictPaths,omitempty"`
	Status            string         `gorm:"size:20;index;not null;default:'applied'" json:"status"`
	RevertedAt        *time.Time     `json:"revertedAt,omitempty"`
	CreatedAt         time.Time      `json:"createdAt"`
	UpdatedAt         time.Time      `json:"updatedAt"`
	DeletedAt         gorm.DeletedAt `gorm:"index" json:"-"`
}

func (change *WorkflowCollaborationChange) BeforeCreate(tx *gorm.DB) error {
	if change.ID == 0 {
		change.ID = Int64String(utils.GenerateID())
	}
	if change.Status == "" {
		change.Status = "applied"
	}
	return nil
}

func (w *Workflow) BeforeCreate(tx *gorm.DB) error {
	if w.ID == 0 {
		w.ID = Int64String(utils.GenerateID())
	}
	return nil
}

type WorkflowRun struct {
	ID                Int64String    `gorm:"primaryKey;autoIncrement:false;index:idx_workflow_runs_workflow_user_started,priority:4" json:"id"`
	WorkflowID        Int64String    `gorm:"index;not null;index:idx_workflow_runs_workflow_user_started,priority:1" json:"workflowId"`
	UserID            Int64String    `gorm:"index;not null;index:idx_workflow_runs_workflow_user_started,priority:2" json:"userId"`
	AppID             Int64String    `gorm:"index" json:"appId,omitempty"`
	VersionID         Int64String    `gorm:"index" json:"versionId,omitempty"`
	Status            string         `gorm:"size:20;not null;default:'running';index" json:"status"`
	Inputs            string         `gorm:"type:json" json:"inputs,omitempty"`
	GraphSnapshot     string         `gorm:"type:json;not null" json:"graphSnapshot"`
	SourceRunID       *Int64String   `gorm:"index" json:"sourceRunId,omitempty"`
	TriggerID         *Int64String   `gorm:"index" json:"triggerId,omitempty"`
	RunJobID          *Int64String   `gorm:"uniqueIndex" json:"runJobId,omitempty"`
	RuntimeState      string         `gorm:"type:text" json:"-"`
	CancelRequestedAt *time.Time     `gorm:"index" json:"cancelRequestedAt,omitempty"`
	Result            string         `gorm:"type:json" json:"result,omitempty"`
	StartedAt         time.Time      `gorm:"index:idx_workflow_runs_workflow_user_started,priority:3" json:"startedAt"`
	FinishedAt        *time.Time     `json:"finishedAt,omitempty"`
	CreatedAt         time.Time      `json:"createdAt"`
	DeletedAt         gorm.DeletedAt `gorm:"index" json:"-"`
}

type WorkflowApproval struct {
	ID            Int64String    `gorm:"primaryKey;autoIncrement:false" json:"id"`
	WorkflowRunID Int64String    `gorm:"not null;index;uniqueIndex:uidx_workflow_approval_run_node" json:"workflowRunId"`
	WorkflowID    Int64String    `gorm:"not null;index" json:"workflowId"`
	UserID        Int64String    `gorm:"not null;index" json:"userId"`
	NodeID        string         `gorm:"size:120;not null;uniqueIndex:uidx_workflow_approval_run_node" json:"nodeId"`
	Title         string         `gorm:"size:200;not null" json:"title"`
	Description   string         `gorm:"size:1000" json:"description"`
	Status        string         `gorm:"size:20;not null;default:'pending';index" json:"status"`
	Note          string         `gorm:"size:1000" json:"note,omitempty"`
	DecidedAt     *time.Time     `json:"decidedAt,omitempty"`
	ResumedAt     *time.Time     `gorm:"index" json:"resumedAt,omitempty"`
	CreatedAt     time.Time      `json:"createdAt"`
	UpdatedAt     time.Time      `json:"updatedAt"`
	DeletedAt     gorm.DeletedAt `gorm:"index" json:"-"`
}

func (approval *WorkflowApproval) BeforeCreate(tx *gorm.DB) error {
	if approval.ID == 0 {
		approval.ID = Int64String(utils.GenerateID())
	}
	return nil
}

// WorkflowTrigger is an owner-private invocation rule for a published
// workflow. Secrets are write-only API data; only their digest is persisted.
type WorkflowTrigger struct {
	ID             Int64String    `gorm:"primaryKey;autoIncrement:false" json:"id"`
	WorkflowID     Int64String    `gorm:"not null;index:idx_workflow_trigger_owner_workflow" json:"workflowId"`
	UserID         Int64String    `gorm:"not null;index:idx_workflow_trigger_owner_workflow" json:"userId"`
	Type           string         `gorm:"size:20;not null;default:'cron'" json:"type"`
	CronExpression string         `gorm:"size:120;not null" json:"cronExpression"`
	Timezone       string         `gorm:"size:80;not null;default:'Asia/Shanghai'" json:"timezone"`
	EventKey       string         `gorm:"size:100;index" json:"eventKey,omitempty"`
	SecretHash     string         `gorm:"size:64" json:"-"`
	Status         string         `gorm:"size:20;not null;default:'active';index" json:"status"`
	NextRunAt      *time.Time     `gorm:"index" json:"nextRunAt,omitempty"`
	LastRunAt      *time.Time     `json:"lastRunAt,omitempty"`
	WebhookSecret  string         `gorm:"-" json:"webhookSecret,omitempty"`
	WebhookPath    string         `gorm:"-" json:"webhookPath,omitempty"`
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
	TriggerType    string         `gorm:"size:20;not null;default:'cron'" json:"triggerType"`
	WorkflowID     Int64String    `gorm:"not null;index" json:"workflowId"`
	UserID         Int64String    `gorm:"not null;index" json:"userId"`
	VersionID      Int64String    `gorm:"not null" json:"versionId"`
	GraphSnapshot  string         `gorm:"type:json;not null" json:"-"`
	Inputs         string         `gorm:"type:json;not null" json:"-"`
	Status         string         `gorm:"size:20;not null;default:'queued';index" json:"status"`
	IdempotencyKey string         `gorm:"size:180;not null;uniqueIndex" json:"-"`
	ScheduledAt    time.Time      `gorm:"not null;index" json:"scheduledAt"`
	LeaseUntil     *time.Time     `gorm:"index" json:"leaseUntil,omitempty"`
	Attempt        int            `gorm:"not null;default:0" json:"attempt"`
	ErrorCode      string         `gorm:"size:80" json:"errorCode,omitempty"`
	CreatedAt      time.Time      `json:"createdAt"`
	UpdatedAt      time.Time      `json:"updatedAt"`
	DeletedAt      gorm.DeletedAt `gorm:"index" json:"-"`
}

func (job *WorkflowRunJob) BeforeCreate(tx *gorm.DB) error {
	if job.ID == 0 {
		job.ID = Int64String(utils.GenerateID())
	}
	job.GraphSnapshot = normalizeWorkflowJSON(job.GraphSnapshot)
	job.Inputs = normalizeWorkflowJSON(job.Inputs)
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
// Raw files, prompts and upstream error text are never written to this table;
// ErrorMessage is a reviewed, normalized summary for retry and history views.
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
	ErrorMessage  string         `gorm:"size:500" json:"errorMessage,omitempty"`
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
	LoopIteration *int           `json:"loopIteration,omitempty"`
	LoopDepth     int            `json:"loopDepth,omitempty"`
	BodyNodeID    string         `gorm:"size:120;index" json:"bodyNodeId,omitempty"`
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
