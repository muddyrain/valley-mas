package mail

import "time"

const (
	ProviderGmail  = "gmail"
	ProviderQQIMAP = "qq_imap"

	AuthTypeOAuth          = "oauth"
	AuthTypeAppPassword    = "app_password"
	AccountStatusPending   = "pending"
	AccountStatusConnected = "connected"
	AccountStatusError     = "error"
)

type AccountDTO struct {
	ID           string     `json:"id"`
	Provider     string     `json:"provider"`
	AuthType     string     `json:"authType"`
	Email        string     `json:"email"`
	Status       string     `json:"status"`
	LastSyncedAt *time.Time `json:"lastSyncedAt,omitempty"`
	LastError    string     `json:"lastError,omitempty"`
	CreatedAt    time.Time  `json:"createdAt"`
	UpdatedAt    time.Time  `json:"updatedAt"`
}

type MessageDTO struct {
	ID                string    `json:"id"`
	AccountID         string    `json:"accountId"`
	Provider          string    `json:"provider"`
	ProviderMessageID string    `json:"providerMessageId"`
	ThreadID          string    `json:"threadId,omitempty"`
	FromAddress       string    `json:"fromAddress"`
	Subject           string    `json:"subject"`
	Snippet           string    `json:"snippet"`
	TextBody          string    `json:"textBody,omitempty"`
	HTMLBody          string    `json:"htmlBody,omitempty"`
	IsRead            bool      `json:"isRead"`
	SentAt            time.Time `json:"sentAt"`
	CreatedAt         time.Time `json:"createdAt"`
	UpdatedAt         time.Time `json:"updatedAt"`
}

type FetchedMessage struct {
	AccountID         string
	Provider          string
	ProviderMessageID string
	ThreadID          string
	FromAddress       string
	Subject           string
	Snippet           string
	TextBody          string
	HTMLBody          string
	IsRead            bool
	SentAt            time.Time
}
