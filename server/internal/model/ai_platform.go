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
	return nil
}

type AIAppVersion struct {
	ID        Int64String    `gorm:"primaryKey;autoIncrement:false" json:"id"`
	AppID     Int64String    `gorm:"index:uidx_ai_app_version,unique;not null" json:"appId"`
	Number    int            `gorm:"index:uidx_ai_app_version,unique;not null" json:"number"`
	Config    string         `gorm:"type:text;not null" json:"config"`
	CreatedAt time.Time      `json:"createdAt"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
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
	ID            Int64String    `gorm:"primaryKey;autoIncrement:false" json:"id"`
	AppID         Int64String    `gorm:"index;not null" json:"appId"`
	VersionID     Int64String    `gorm:"index;not null" json:"versionId"`
	WorkflowRunID *Int64String   `gorm:"index" json:"workflowRunId,omitempty"`
	UserID        Int64String    `gorm:"index;not null" json:"userId"`
	Status        string         `gorm:"size:20;index;not null" json:"status"`
	Model         string         `gorm:"size:160" json:"model"`
	Input         string         `gorm:"type:text;not null" json:"input"`
	Output        string         `gorm:"type:text" json:"output"`
	ErrorCode     string         `gorm:"size:80" json:"errorCode"`
	DurationMs    int64          `json:"durationMs"`
	CreatedAt     time.Time      `json:"createdAt"`
	DeletedAt     gorm.DeletedAt `gorm:"index" json:"-"`
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
	ChunkCount      int            `json:"chunkCount"`
	CreatedAt       time.Time      `json:"createdAt"`
	UpdatedAt       time.Time      `json:"updatedAt"`
	DeletedAt       gorm.DeletedAt `gorm:"index" json:"-"`
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
