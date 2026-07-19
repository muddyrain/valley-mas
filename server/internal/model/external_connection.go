package model

import (
	"time"
	"valley-server/internal/utils"

	"gorm.io/gorm"
)

// ExternalConnection stores one owner-private OAuth connection. Credentials
// are encrypted at rest and intentionally excluded from every JSON response.
type ExternalConnection struct {
	ID                     Int64String `gorm:"primaryKey;autoIncrement:false" json:"id"`
	UserID                 Int64String `gorm:"uniqueIndex:uidx_external_connection_owner_provider;not null" json:"userId"`
	Provider               string      `gorm:"size:40;uniqueIndex:uidx_external_connection_owner_provider;not null" json:"provider"`
	Status                 string      `gorm:"size:30;index;not null;default:'connected'" json:"status"`
	ProviderAccountID      string      `gorm:"size:120" json:"providerAccountId,omitempty"`
	WorkspaceID            string      `gorm:"size:120" json:"workspaceId,omitempty"`
	WorkspaceName          string      `gorm:"size:240" json:"workspaceName,omitempty"`
	AccessTokenCiphertext  string      `gorm:"type:text;not null" json:"-"`
	RefreshTokenCiphertext string      `gorm:"type:text" json:"-"`
	LastError              string      `gorm:"size:500" json:"lastError,omitempty"`
	ConnectedAt            time.Time   `json:"connectedAt"`
	CreatedAt              time.Time   `json:"createdAt"`
	UpdatedAt              time.Time   `json:"updatedAt"`
}

func (c *ExternalConnection) BeforeCreate(_ *gorm.DB) error {
	if c.ID == 0 {
		c.ID = Int64String(utils.GenerateID())
	}
	return nil
}

// ExternalOAuthState is a single-use, short-lived CSRF binding for a browser
// OAuth callback. Only a SHA-256 hash of the outbound state is persisted.
type ExternalOAuthState struct {
	ID         Int64String `gorm:"primaryKey;autoIncrement:false" json:"id"`
	Provider   string      `gorm:"size:40;index;not null" json:"provider"`
	UserID     Int64String `gorm:"index;not null" json:"userId"`
	StateHash  string      `gorm:"size:64;uniqueIndex;not null" json:"-"`
	ExpiresAt  time.Time   `gorm:"index;not null" json:"expiresAt"`
	ConsumedAt *time.Time  `json:"-"`
	CreatedAt  time.Time   `json:"createdAt"`
}

func (s *ExternalOAuthState) BeforeCreate(_ *gorm.DB) error {
	if s.ID == 0 {
		s.ID = Int64String(utils.GenerateID())
	}
	return nil
}

// ExternalConnectionAudit records security-relevant connector lifecycle
// events without retaining access tokens, authorization codes, or raw errors.
type ExternalConnectionAudit struct {
	ID           Int64String `gorm:"primaryKey;autoIncrement:false" json:"id"`
	ConnectionID Int64String `gorm:"index" json:"connectionId,omitempty"`
	UserID       Int64String `gorm:"index;not null" json:"userId"`
	Provider     string      `gorm:"size:40;index;not null" json:"provider"`
	Action       string      `gorm:"size:60;not null" json:"action"`
	Status       string      `gorm:"size:30;not null" json:"status"`
	Detail       string      `gorm:"size:240" json:"detail,omitempty"`
	CreatedAt    time.Time   `json:"createdAt"`
}

func (a *ExternalConnectionAudit) BeforeCreate(_ *gorm.DB) error {
	if a.ID == 0 {
		a.ID = Int64String(utils.GenerateID())
	}
	return nil
}
