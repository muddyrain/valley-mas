package model

import (
	"time"
	"valley-server/internal/utils"

	"gorm.io/gorm"
)

// MailAccount stores a user's external mailbox binding.
type MailAccount struct {
	ID                   Int64String    `gorm:"primaryKey;autoIncrement:false" json:"id"`
	UserID               Int64String    `gorm:"index;uniqueIndex:uidx_mail_account_user_provider_email;not null" json:"userId"`
	Provider             string         `gorm:"size:40;uniqueIndex:uidx_mail_account_user_provider_email;not null" json:"provider"`
	AuthType             string         `gorm:"size:40;not null" json:"authType"`
	Email                string         `gorm:"size:160;uniqueIndex:uidx_mail_account_user_provider_email;not null" json:"email"`
	CredentialCiphertext string         `gorm:"type:text;not null" json:"-"`
	Status               string         `gorm:"size:30;index;not null;default:'connected'" json:"status"`
	LastSyncedAt         *time.Time     `json:"lastSyncedAt,omitempty"`
	LastError            string         `gorm:"size:500" json:"lastError,omitempty"`
	CreatedAt            time.Time      `json:"createdAt"`
	UpdatedAt            time.Time      `json:"updatedAt"`
	DeletedAt            gorm.DeletedAt `gorm:"index" json:"-"`
}

func (a *MailAccount) BeforeCreate(tx *gorm.DB) error {
	if a.ID == 0 {
		a.ID = Int64String(utils.GenerateID())
	}
	return nil
}

// MailMessage stores a safe, text-only cache of a read-only mailbox message.
type MailMessage struct {
	ID                Int64String    `gorm:"primaryKey;autoIncrement:false" json:"id"`
	UserID            Int64String    `gorm:"index;not null" json:"userId"`
	AccountID         Int64String    `gorm:"index;uniqueIndex:uidx_mail_message_account_provider_id;not null" json:"accountId"`
	Provider          string         `gorm:"size:40;index;not null" json:"provider"`
	ProviderMessageID string         `gorm:"size:240;uniqueIndex:uidx_mail_message_account_provider_id;not null" json:"providerMessageId"`
	ThreadID          string         `gorm:"size:240" json:"threadId,omitempty"`
	FromAddress       string         `gorm:"size:300" json:"fromAddress"`
	Subject           string         `gorm:"size:500" json:"subject"`
	Snippet           string         `gorm:"size:1000" json:"snippet"`
	TextBody          string         `gorm:"type:text" json:"textBody,omitempty"`
	IsRead            bool           `gorm:"default:false" json:"isRead"`
	SentAt            time.Time      `gorm:"index" json:"sentAt"`
	CreatedAt         time.Time      `json:"createdAt"`
	UpdatedAt         time.Time      `json:"updatedAt"`
	DeletedAt         gorm.DeletedAt `gorm:"index" json:"-"`
}

func (m *MailMessage) BeforeCreate(tx *gorm.DB) error {
	if m.ID == 0 {
		m.ID = Int64String(utils.GenerateID())
	}
	return nil
}
