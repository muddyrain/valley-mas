package model

import (
	"time"
	"valley-server/internal/utils"

	"gorm.io/gorm"
)

// AIImageConversation stores one owner-private image studio transcript.
type AIImageConversation struct {
	ID        Int64String    `gorm:"primaryKey;autoIncrement:false" json:"id"`
	UserID    Int64String    `gorm:"column:user_id;index:idx_ai_image_conversations_owner_updated;not null" json:"userId"`
	Title     string         `gorm:"size:160;not null;default:''" json:"title"`
	CreatedAt time.Time      `json:"createdAt"`
	UpdatedAt time.Time      `gorm:"index:idx_ai_image_conversations_owner_updated,priority:2" json:"updatedAt"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

func (conversation *AIImageConversation) BeforeCreate(tx *gorm.DB) error {
	if conversation.ID == 0 {
		conversation.ID = Int64String(utils.GenerateID())
	}
	if conversation.Title == "" {
		conversation.Title = "AI 图片对话"
	}
	return nil
}

// AIImageConversationMessage stores user and assistant messages for an image
// studio transcript. Assistant messages may reference the generated image.
type AIImageConversationMessage struct {
	ID             Int64String  `gorm:"primaryKey;autoIncrement:false" json:"id"`
	UserID         Int64String  `gorm:"column:user_id;index;not null" json:"userId"`
	ConversationID Int64String  `gorm:"column:conversation_id;index;not null" json:"conversationId"`
	Role           string       `gorm:"size:20;not null;index" json:"role"`
	Content        string       `gorm:"type:text;not null" json:"content"`
	GenerationID   *Int64String `gorm:"column:generation_id;index" json:"generationId,omitempty"`
	CreatedAt      time.Time    `gorm:"index" json:"createdAt"`
}

func (message *AIImageConversationMessage) BeforeCreate(tx *gorm.DB) error {
	if message.ID == 0 {
		message.ID = Int64String(utils.GenerateID())
	}
	return nil
}
