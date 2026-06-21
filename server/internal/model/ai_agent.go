package model

import (
	"time"
	"valley-server/internal/utils"

	"gorm.io/gorm"
)

type AIAgent struct {
	ID               Int64String    `gorm:"primaryKey;autoIncrement:false" json:"id"`
	UserID           Int64String    `gorm:"column:user_id;index;not null" json:"userId"`
	Name             string         `gorm:"size:80;not null" json:"name"`
	Description      string         `gorm:"size:240" json:"description"`
	AvatarColor      string         `gorm:"column:avatar_color;size:32;not null;default:'#8fb4ff'" json:"avatarColor"`
	AvatarIcon       string         `gorm:"column:avatar_icon;size:40;not null;default:'sparkles'" json:"avatarIcon"`
	SystemPrompt     string         `gorm:"column:system_prompt;type:text;not null" json:"systemPrompt"`
	OpeningMessage   string         `gorm:"column:opening_message;type:text" json:"openingMessage"`
	ExampleQuestions string         `gorm:"column:example_questions;type:text;not null;default:'[]'" json:"exampleQuestions"`
	Status           string         `gorm:"size:20;not null;default:'active';index" json:"status"`
	CreatedAt        time.Time      `json:"createdAt"`
	UpdatedAt        time.Time      `json:"updatedAt"`
	DeletedAt        gorm.DeletedAt `gorm:"index" json:"-"`
}

func (agent *AIAgent) BeforeCreate(tx *gorm.DB) error {
	if agent.ID == 0 {
		agent.ID = Int64String(utils.GenerateID())
	}
	if agent.Name == "" {
		agent.Name = "默认助手"
	}
	if agent.AvatarColor == "" {
		agent.AvatarColor = "#8fb4ff"
	}
	if agent.AvatarIcon == "" {
		agent.AvatarIcon = "sparkles"
	}
	if agent.Status == "" {
		agent.Status = "active"
	}
	if agent.ExampleQuestions == "" {
		agent.ExampleQuestions = "[]"
	}
	return nil
}

type AIConversation struct {
	ID        Int64String    `gorm:"primaryKey;autoIncrement:false" json:"id"`
	UserID    Int64String    `gorm:"column:user_id;index;not null" json:"userId"`
	AgentID   Int64String    `gorm:"column:agent_id;index;not null" json:"agentId"`
	Title     string         `gorm:"size:120;not null;default:'新对话'" json:"title"`
	Status    string         `gorm:"size:20;not null;default:'active';index" json:"status"`
	CreatedAt time.Time      `json:"createdAt"`
	UpdatedAt time.Time      `json:"updatedAt"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

func (conversation *AIConversation) BeforeCreate(tx *gorm.DB) error {
	if conversation.ID == 0 {
		conversation.ID = Int64String(utils.GenerateID())
	}
	if conversation.Title == "" {
		conversation.Title = "新对话"
	}
	if conversation.Status == "" {
		conversation.Status = "active"
	}
	return nil
}

type AIMessage struct {
	ID             Int64String    `gorm:"primaryKey;autoIncrement:false" json:"id"`
	UserID         Int64String    `gorm:"column:user_id;index;not null" json:"userId"`
	AgentID        Int64String    `gorm:"column:agent_id;index;not null" json:"agentId"`
	ConversationID Int64String    `gorm:"column:conversation_id;index;not null" json:"conversationId"`
	Role           string         `gorm:"size:20;not null;index" json:"role"`
	Content        string         `gorm:"type:text;not null" json:"content"`
	CreatedAt      time.Time      `json:"createdAt"`
	DeletedAt      gorm.DeletedAt `gorm:"index" json:"-"`
}

func (message *AIMessage) BeforeCreate(tx *gorm.DB) error {
	if message.ID == 0 {
		message.ID = Int64String(utils.GenerateID())
	}
	return nil
}
