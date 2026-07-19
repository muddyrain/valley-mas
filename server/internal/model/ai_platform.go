package model

import (
	"time"
	"valley-server/internal/utils"

	"gorm.io/gorm"
)

// AIApp is the owner-scoped product surface exposed by the AI workbench.
// Configuration lives in immutable versions so published runs remain reproducible.
type AIApp struct {
	ID                 Int64String    `gorm:"primaryKey;autoIncrement:false" json:"id"`
	UserID             Int64String    `gorm:"index;not null" json:"userId"`
	Type               string         `gorm:"size:20;index;not null" json:"type"`
	WorkflowID         *Int64String   `gorm:"uniqueIndex" json:"workflowId,omitempty"`
	Name               string         `gorm:"size:100;not null" json:"name"`
	Description        string         `gorm:"size:500" json:"description"`
	AvatarURL          string         `gorm:"column:avatar_url;size:1000" json:"avatarUrl"`
	AvatarSource       string         `gorm:"column:avatar_source;size:20;not null;default:'default'" json:"avatarSource"`
	AvatarStorageKey   string         `gorm:"column:avatar_storage_key;size:500" json:"-"`
	Status             string         `gorm:"size:20;index;not null;default:'draft'" json:"status"`
	DraftVersionID     Int64String    `gorm:"index" json:"draftVersionId"`
	PublishedVersionID Int64String    `gorm:"index" json:"publishedVersionId"`
	CreatedAt          time.Time      `json:"createdAt"`
	UpdatedAt          time.Time      `json:"updatedAt"`
	DeletedAt          gorm.DeletedAt `gorm:"index" json:"-"`
}

func (a *AIApp) BeforeCreate(tx *gorm.DB) error {
	if a.ID == 0 {
		a.ID = Int64String(utils.GenerateID())
	}
	if a.Status == "" {
		a.Status = "draft"
	}
	if a.AvatarSource == "" {
		a.AvatarSource = "default"
	}
	return nil
}

type AIAppVersion struct {
	ID                    Int64String    `gorm:"primaryKey;autoIncrement:false" json:"id"`
	AppID                 Int64String    `gorm:"index:uidx_ai_app_version,unique;not null" json:"appId"`
	Number                int            `gorm:"index:uidx_ai_app_version,unique;not null" json:"number"`
	Config                string         `gorm:"type:text;not null" json:"config"`
	RetrievalConfig       string         `gorm:"type:text;not null;default:'{}'" json:"retrievalConfig"`
	KnowledgeBaseSnapshot bool           `gorm:"not null;default:false" json:"knowledgeBaseSnapshot"`
	ToolSnapshot          bool           `gorm:"not null;default:false" json:"toolSnapshot"`
	PublishedAt           *time.Time     `gorm:"index" json:"publishedAt,omitempty"`
	CreatedAt             time.Time      `json:"createdAt"`
	DeletedAt             gorm.DeletedAt `gorm:"index" json:"-"`
}

// AIAppVersionKnowledgeBase is an immutable knowledge-base binding snapshot
// used by one application version. It prevents later app edits from changing
// historical debug, workflow, and public API runs.
type AIAppVersionKnowledgeBase struct {
	ID              Int64String `gorm:"primaryKey;autoIncrement:false" json:"id"`
	AppVersionID    Int64String `gorm:"uniqueIndex:uidx_ai_app_version_kb;not null" json:"appVersionId"`
	KnowledgeBaseID Int64String `gorm:"uniqueIndex:uidx_ai_app_version_kb;not null" json:"knowledgeBaseId"`
	CreatedAt       time.Time   `json:"createdAt"`
}

// AIAppVersionToolBinding freezes the reviewed tool allowlist for one app
// version. Conversations must never pick up a later app-level binding change.
type AIAppVersionToolBinding struct {
	ID           Int64String `gorm:"primaryKey;autoIncrement:false" json:"id"`
	AppVersionID Int64String `gorm:"uniqueIndex:uidx_ai_app_version_tool;not null" json:"appVersionId"`
	ToolName     string      `gorm:"size:100;uniqueIndex:uidx_ai_app_version_tool;not null" json:"toolName"`
	CreatedAt    time.Time   `json:"createdAt"`
}

func (b *AIAppVersionToolBinding) BeforeCreate(tx *gorm.DB) error {
	if b.ID == 0 {
		b.ID = Int64String(utils.GenerateID())
	}
	return nil
}

func (b *AIAppVersionKnowledgeBase) BeforeCreate(tx *gorm.DB) error {
	if b.ID == 0 {
		b.ID = Int64String(utils.GenerateID())
	}
	return nil
}

func (v *AIAppVersion) BeforeCreate(tx *gorm.DB) error {
	if v.ID == 0 {
		v.ID = Int64String(utils.GenerateID())
	}
	return nil
}

// AIAppRun records a safe summary of an interactive app debug run. It never
// stores raw files, credentials, or the full system prompt.
type AIAppRun struct {
	ID             Int64String    `gorm:"primaryKey;autoIncrement:false" json:"id"`
	AppID          Int64String    `gorm:"index;not null" json:"appId"`
	VersionID      Int64String    `gorm:"index;not null" json:"versionId"`
	WorkflowRunID  *Int64String   `gorm:"index" json:"workflowRunId,omitempty"`
	ConversationID *Int64String   `gorm:"index" json:"conversationId,omitempty"`
	UserID         Int64String    `gorm:"index;not null" json:"userId"`
	Status         string         `gorm:"size:20;index;not null" json:"status"`
	Model          string         `gorm:"size:160" json:"model"`
	Input          string         `gorm:"type:text;not null" json:"input"`
	Output         string         `gorm:"type:text" json:"output"`
	ErrorCode      string         `gorm:"size:80" json:"errorCode"`
	References     string         `gorm:"type:text;not null;default:'[]'" json:"-"`
	DurationMs     int64          `json:"durationMs"`
	CreatedAt      time.Time      `json:"createdAt"`
	DeletedAt      gorm.DeletedAt `gorm:"index" json:"-"`
}

// AIAppConversation is an owner-private chat pinned to one immutable app
// version. It is intentionally separate from the legacy AIAgent conversations.
type AIAppConversation struct {
	ID        Int64String    `gorm:"primaryKey;autoIncrement:false" json:"id"`
	UserID    Int64String    `gorm:"index:idx_ai_app_conversation_owner;not null" json:"userId"`
	AppID     Int64String    `gorm:"index:idx_ai_app_conversation_owner;not null" json:"appId"`
	VersionID Int64String    `gorm:"index;not null" json:"versionId"`
	Title     string         `gorm:"size:120;not null;default:'新对话'" json:"title"`
	Status    string         `gorm:"size:20;not null;default:'active';index" json:"status"`
	CreatedAt time.Time      `json:"createdAt"`
	UpdatedAt time.Time      `json:"updatedAt"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

func (c *AIAppConversation) BeforeCreate(tx *gorm.DB) error {
	if c.ID == 0 {
		c.ID = Int64String(utils.GenerateID())
	}
	if c.Title == "" {
		c.Title = "新对话"
	}
	if c.Status == "" {
		c.Status = "active"
	}
	return nil
}

type AIAppConversationMessage struct {
	ID             Int64String    `gorm:"primaryKey;autoIncrement:false" json:"id"`
	UserID         Int64String    `gorm:"index;not null" json:"userId"`
	AppID          Int64String    `gorm:"index;not null" json:"appId"`
	ConversationID Int64String    `gorm:"index;not null" json:"conversationId"`
	RunID          *Int64String   `gorm:"index" json:"runId,omitempty"`
	Role           string         `gorm:"size:20;not null;index" json:"role"`
	Content        string         `gorm:"type:text;not null" json:"content"`
	CreatedAt      time.Time      `json:"createdAt"`
	DeletedAt      gorm.DeletedAt `gorm:"index" json:"-"`
}

func (m *AIAppConversationMessage) BeforeCreate(tx *gorm.DB) error {
	if m.ID == 0 {
		m.ID = Int64String(utils.GenerateID())
	}
	return nil
}

// AIAppConversationToolTrace keeps only an observable execution summary. Tool
// arguments and raw results are deliberately never persisted here.
type AIAppConversationToolTrace struct {
	ID             Int64String    `gorm:"primaryKey;autoIncrement:false" json:"id"`
	UserID         Int64String    `gorm:"index;not null" json:"userId"`
	AppID          Int64String    `gorm:"index;not null" json:"appId"`
	ConversationID Int64String    `gorm:"index;not null" json:"conversationId"`
	RunID          Int64String    `gorm:"index;not null" json:"runId"`
	ToolName       string         `gorm:"size:100;not null" json:"toolName"`
	Status         string         `gorm:"size:20;not null" json:"status"`
	DurationMs     int64          `gorm:"not null;default:0" json:"durationMs"`
	CreatedAt      time.Time      `json:"createdAt"`
	DeletedAt      gorm.DeletedAt `gorm:"index" json:"-"`
}

// AIWorkbenchCopilotSession is one owner-private collaboration thread for a workbench target.
// A target may have multiple sessions; the most recently updated session is the default.
type AIWorkbenchCopilotSession struct {
	ID        Int64String `gorm:"primaryKey;autoIncrement:false" json:"id"`
	UserID    Int64String `gorm:"index:idx_workbench_copilot_target;not null" json:"userId"`
	Scope     string      `gorm:"size:20;index:idx_workbench_copilot_target;not null" json:"scope"`
	TargetID  string      `gorm:"size:80;index:idx_workbench_copilot_target;not null;default:''" json:"targetId"`
	Title     string      `gorm:"size:120;not null;default:'AI 协作'" json:"title"`
	CreatedAt time.Time   `json:"createdAt"`
	UpdatedAt time.Time   `json:"updatedAt"`
}

func (s *AIWorkbenchCopilotSession) BeforeCreate(tx *gorm.DB) error {
	if s.ID == 0 {
		s.ID = Int64String(utils.GenerateID())
	}
	if s.Title == "" {
		s.Title = "AI 协作"
	}
	return nil
}

type AIWorkbenchCopilotMessage struct {
	ID        Int64String `gorm:"primaryKey;autoIncrement:false" json:"id"`
	SessionID Int64String `gorm:"index;not null" json:"sessionId"`
	UserID    Int64String `gorm:"index;not null" json:"userId"`
	Role      string      `gorm:"size:20;not null" json:"role"`
	Kind      string      `gorm:"size:20;not null;default:'text'" json:"kind"`
	Content   string      `gorm:"type:text;not null" json:"content"`
	CreatedAt time.Time   `json:"createdAt"`
}

// AIWorkbenchCopilotRun records one cancellable planning request. It stores
// lifecycle metadata only; prompts and model replies remain in messages.
type AIWorkbenchCopilotRun struct {
	ID         Int64String `gorm:"primaryKey;autoIncrement:false" json:"id"`
	SessionID  Int64String `gorm:"index;not null" json:"sessionId"`
	UserID     Int64String `gorm:"index;not null" json:"userId"`
	Scope      string      `gorm:"size:20;index;not null" json:"scope"`
	TargetID   string      `gorm:"size:80;index;not null;default:''" json:"targetId"`
	Status     string      `gorm:"size:20;index;not null;default:'running'" json:"status"`
	ErrorCode  string      `gorm:"size:80" json:"errorCode"`
	StartedAt  time.Time   `json:"startedAt"`
	FinishedAt *time.Time  `json:"finishedAt,omitempty"`
	CreatedAt  time.Time   `json:"createdAt"`
	UpdatedAt  time.Time   `json:"updatedAt"`
}

// AIWorkbenchCopilotRunEvent is an owner-private, replayable lifecycle event.
// It deliberately stores only a short status label or safe failure summary;
// prompts and model replies continue to live in the message records.
type AIWorkbenchCopilotRunEvent struct {
	ID        Int64String `gorm:"primaryKey;autoIncrement:false" json:"id"`
	RunID     Int64String `gorm:"not null;uniqueIndex:uidx_workbench_copilot_run_event_sequence" json:"runId"`
	Sequence  int64       `gorm:"not null;uniqueIndex:uidx_workbench_copilot_run_event_sequence" json:"sequence"`
	EventType string      `gorm:"size:24;not null" json:"eventType"`
	Stage     string      `gorm:"size:40;not null;default:''" json:"stage"`
	Message   string      `gorm:"size:500;not null;default:''" json:"message"`
	ErrorCode string      `gorm:"size:80;not null;default:''" json:"errorCode"`
	CreatedAt time.Time   `json:"createdAt"`
}

func (r *AIWorkbenchCopilotRun) BeforeCreate(tx *gorm.DB) error {
	if r.ID == 0 {
		r.ID = Int64String(utils.GenerateID())
	}
	if r.Status == "" {
		r.Status = "running"
	}
	if r.StartedAt.IsZero() {
		r.StartedAt = time.Now()
	}
	return nil
}

func (e *AIWorkbenchCopilotRunEvent) BeforeCreate(tx *gorm.DB) error {
	if e.ID == 0 {
		e.ID = Int64String(utils.GenerateID())
	}
	return nil
}

func (m *AIWorkbenchCopilotMessage) BeforeCreate(tx *gorm.DB) error {
	if m.ID == 0 {
		m.ID = Int64String(utils.GenerateID())
	}
	return nil
}

type AIWorkbenchChangeProposal struct {
	ID            Int64String `gorm:"primaryKey;autoIncrement:false" json:"id"`
	SessionID     Int64String `gorm:"index;not null" json:"sessionId"`
	UserID        Int64String `gorm:"index;not null" json:"userId"`
	TargetType    string      `gorm:"size:20;not null" json:"targetType"`
	TargetID      string      `gorm:"size:80;not null;default:''" json:"targetId"`
	BaseHash      string      `gorm:"size:64;not null" json:"baseHash"`
	BaseDraft     string      `gorm:"type:text;not null;default:'{}'" json:"baseDraft"`
	Candidate     string      `gorm:"type:text;not null" json:"candidate"`
	CandidateHash string      `gorm:"size:64;not null;default:''" json:"candidateHash"`
	Diff          string      `gorm:"type:text;not null;default:'{}'" json:"diff"`
	Status        string      `gorm:"size:20;index;not null;default:'pending'" json:"status"`
	CreatedAt     time.Time   `json:"createdAt"`
	UpdatedAt     time.Time   `json:"updatedAt"`
	ResolvedAt    *time.Time  `json:"resolvedAt,omitempty"`
}

func (p *AIWorkbenchChangeProposal) BeforeCreate(tx *gorm.DB) error {
	if p.ID == 0 {
		p.ID = Int64String(utils.GenerateID())
	}
	if p.Status == "" {
		p.Status = "pending"
	}
	return nil
}

func (t *AIAppConversationToolTrace) BeforeCreate(tx *gorm.DB) error {
	if t.ID == 0 {
		t.ID = Int64String(utils.GenerateID())
	}
	return nil
}

func (r *AIAppRun) BeforeCreate(tx *gorm.DB) error {
	if r.ID == 0 {
		r.ID = Int64String(utils.GenerateID())
	}
	return nil
}

type AIKnowledgeBase struct {
	ID          Int64String    `gorm:"primaryKey;autoIncrement:false" json:"id"`
	UserID      Int64String    `gorm:"index;not null" json:"userId"`
	Name        string         `gorm:"size:100;not null" json:"name"`
	Description string         `gorm:"size:500" json:"description"`
	CreatedAt   time.Time      `json:"createdAt"`
	UpdatedAt   time.Time      `json:"updatedAt"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
}

func (k *AIKnowledgeBase) BeforeCreate(tx *gorm.DB) error {
	if k.ID == 0 {
		k.ID = Int64String(utils.GenerateID())
	}
	return nil
}

type AIKnowledgeDocument struct {
	ID              Int64String    `gorm:"primaryKey;autoIncrement:false" json:"id"`
	KnowledgeBaseID Int64String    `gorm:"index;not null" json:"knowledgeBaseId"`
	UserID          Int64String    `gorm:"index;not null" json:"userId"`
	Name            string         `gorm:"size:255;not null" json:"name"`
	Status          string         `gorm:"size:20;index;not null;default:'pending'" json:"status"`
	ErrorCode       string         `gorm:"size:80" json:"errorCode"`
	IndexProgress   int            `gorm:"not null;default:0" json:"indexProgress"`
	ChunkCount      int            `json:"chunkCount"`
	MimeType        string         `gorm:"size:120" json:"mimeType"`
	SizeBytes       int64          `json:"sizeBytes"`
	SourceKey       string         `gorm:"size:500" json:"-"`
	ParsedText      string         `gorm:"type:text" json:"-"`
	CreatedAt       time.Time      `json:"createdAt"`
	UpdatedAt       time.Time      `json:"updatedAt"`
	DeletedAt       gorm.DeletedAt `gorm:"index" json:"-"`
}

// AIKnowledgeChunk contains the minimum data needed for owner-scoped RAG.
// Embedding is populated only after the ARK embedding stage succeeds. The
// pgvector column is owned exclusively by the reviewed SQL migration so local
// GORM AutoMigrate never makes startup depend on an optional DB extension.
type AIKnowledgeChunk struct {
	ID         Int64String    `gorm:"primaryKey;autoIncrement:false" json:"id"`
	DocumentID Int64String    `gorm:"index:uidx_ai_knowledge_chunk,unique;not null" json:"documentId"`
	UserID     Int64String    `gorm:"index;not null" json:"userId"`
	Position   int            `gorm:"index:uidx_ai_knowledge_chunk,unique;not null" json:"position"`
	Content    string         `gorm:"type:text;not null" json:"content"`
	TokenCount int            `json:"tokenCount"`
	Embedding  string         `gorm:"-" json:"-"`
	CreatedAt  time.Time      `json:"createdAt"`
	DeletedAt  gorm.DeletedAt `gorm:"index" json:"-"`
}

func (c *AIKnowledgeChunk) BeforeCreate(tx *gorm.DB) error {
	if c.ID == 0 {
		c.ID = Int64String(utils.GenerateID())
	}
	return nil
}

func (d *AIKnowledgeDocument) BeforeCreate(tx *gorm.DB) error {
	if d.ID == 0 {
		d.ID = Int64String(utils.GenerateID())
	}
	if d.Status == "" {
		d.Status = "pending"
	}
	return nil
}

type AIAppKnowledgeBase struct {
	ID              Int64String `gorm:"primaryKey;autoIncrement:false" json:"id"`
	AppID           Int64String `gorm:"uniqueIndex:uidx_ai_app_kb;not null" json:"appId"`
	KnowledgeBaseID Int64String `gorm:"uniqueIndex:uidx_ai_app_kb;not null" json:"knowledgeBaseId"`
	CreatedAt       time.Time   `json:"createdAt"`
}

func (b *AIAppKnowledgeBase) BeforeCreate(tx *gorm.DB) error {
	if b.ID == 0 {
		b.ID = Int64String(utils.GenerateID())
	}
	return nil
}

type AIAppToolBinding struct {
	ID        Int64String `gorm:"primaryKey;autoIncrement:false" json:"id"`
	AppID     Int64String `gorm:"uniqueIndex:uidx_ai_app_tool;not null" json:"appId"`
	ToolName  string      `gorm:"size:100;uniqueIndex:uidx_ai_app_tool;not null" json:"toolName"`
	CreatedAt time.Time   `json:"createdAt"`
}

func (b *AIAppToolBinding) BeforeCreate(tx *gorm.DB) error {
	if b.ID == 0 {
		b.ID = Int64String(utils.GenerateID())
	}
	return nil
}

// AIAPIKey stores only a SHA-256 digest. Plaintext is returned exactly once.
type AIAPIKey struct {
	ID         Int64String    `gorm:"primaryKey;autoIncrement:false" json:"id"`
	UserID     Int64String    `gorm:"index;not null" json:"userId"`
	Name       string         `gorm:"size:100;not null" json:"name"`
	KeyPrefix  string         `gorm:"size:20;not null" json:"keyPrefix"`
	KeyHash    string         `gorm:"size:64;uniqueIndex;not null" json:"-"`
	Status     string         `gorm:"size:20;index;not null;default:'active'" json:"status"`
	LastUsedAt *time.Time     `json:"lastUsedAt"`
	CreatedAt  time.Time      `json:"createdAt"`
	UpdatedAt  time.Time      `json:"updatedAt"`
	DeletedAt  gorm.DeletedAt `gorm:"index" json:"-"`
}

func (k *AIAPIKey) BeforeCreate(tx *gorm.DB) error {
	if k.ID == 0 {
		k.ID = Int64String(utils.GenerateID())
	}
	if k.Status == "" {
		k.Status = "active"
	}
	return nil
}

// AIAPIKeyAppBinding limits a public API key to explicitly selected AI apps.
type AIAPIKeyAppBinding struct {
	ID        Int64String `gorm:"primaryKey;autoIncrement:false" json:"id"`
	APIKeyID  Int64String `gorm:"not null;uniqueIndex:uidx_ai_api_key_app" json:"apiKeyId"`
	AppID     Int64String `gorm:"not null;uniqueIndex:uidx_ai_api_key_app" json:"appId"`
	CreatedAt time.Time   `json:"createdAt"`
}

func (b *AIAPIKeyAppBinding) BeforeCreate(tx *gorm.DB) error {
	if b.ID == 0 {
		b.ID = Int64String(utils.GenerateID())
	}
	return nil
}

// AIAPIKeyDailyUsage is the per-key, calendar-day counter used to enforce the
// public API quota. It contains no request or response payload.
type AIAPIKeyDailyUsage struct {
	ID           Int64String `gorm:"primaryKey;autoIncrement:false" json:"id"`
	APIKeyID     Int64String `gorm:"not null;uniqueIndex:uidx_ai_api_key_usage_day" json:"apiKeyId"`
	UsageDate    string      `gorm:"type:date;not null;uniqueIndex:uidx_ai_api_key_usage_day" json:"usageDate"`
	RequestCount int         `gorm:"not null;default:0" json:"requestCount"`
	CreatedAt    time.Time   `json:"createdAt"`
	UpdatedAt    time.Time   `json:"updatedAt"`
}

func (u *AIAPIKeyDailyUsage) BeforeCreate(tx *gorm.DB) error {
	if u.ID == 0 {
		u.ID = Int64String(utils.GenerateID())
	}
	return nil
}

// AIAppPublicInvocation records observability metadata for a public API call.
// Request, response, prompt, tool arguments, and tool results are intentionally
// excluded from this model.
type AIAppPublicInvocation struct {
	ID              Int64String `gorm:"primaryKey;autoIncrement:false" json:"id"`
	UserID          Int64String `gorm:"index;not null" json:"userId"`
	AppID           Int64String `gorm:"index;not null" json:"appId"`
	VersionID       Int64String `gorm:"index;not null" json:"versionId"`
	APIKeyID        Int64String `gorm:"index;not null" json:"apiKeyId"`
	Status          string      `gorm:"size:20;index;not null" json:"status"`
	DurationMs      int64       `gorm:"not null;default:0" json:"durationMs"`
	Stream          bool        `gorm:"not null;default:false" json:"stream"`
	ErrorCode       string      `gorm:"size:80" json:"errorCode"`
	DailyCallNumber int         `gorm:"not null" json:"dailyCallNumber"`
	CreatedAt       time.Time   `gorm:"index" json:"createdAt"`
}

func (i *AIAppPublicInvocation) BeforeCreate(tx *gorm.DB) error {
	if i.ID == 0 {
		i.ID = Int64String(utils.GenerateID())
	}
	return nil
}
