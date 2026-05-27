package model

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"time"
	"valley-server/internal/utils"

	"gorm.io/gorm"
)

type LifeTracePlan struct {
	ID            Int64String    `gorm:"primaryKey;autoIncrement:false" json:"id"`
	UserID        Int64String    `gorm:"column:user_id;index;not null" json:"userId"`
	Title         string         `gorm:"size:160;not null" json:"title"`
	Type          string         `gorm:"size:30;not null" json:"type"`
	TimeLabel     string         `gorm:"size:80;not null" json:"timeLabel"`
	ScheduledDate string         `gorm:"size:20;index" json:"scheduledDate,omitempty"`
	ScheduledTime string         `gorm:"size:20" json:"scheduledTime,omitempty"`
	Timezone      string         `gorm:"size:64;default:'Asia/Shanghai'" json:"timezone,omitempty"`
	Reminder      bool           `gorm:"default:true" json:"reminder"`
	ImageURL      string         `gorm:"size:800" json:"imageUrl,omitempty"`
	Location      string         `gorm:"size:120" json:"location,omitempty"`
	Note          string         `gorm:"size:1000" json:"note"`
	Source        string         `gorm:"size:40;default:'manual';index" json:"source"`
	Completed     bool           `gorm:"default:false;index" json:"completed"`
	CompletedAt   *time.Time     `json:"completedAt,omitempty"`
	CreatedAt     time.Time      `json:"createdAt"`
	UpdatedAt     time.Time      `json:"updatedAt"`
	DeletedAt     gorm.DeletedAt `gorm:"index" json:"-"`
}

func (p *LifeTracePlan) BeforeCreate(tx *gorm.DB) error {
	if p.ID == 0 {
		p.ID = Int64String(utils.GenerateID())
	}
	if p.Source == "" {
		p.Source = "manual"
	}
	if p.Timezone == "" {
		p.Timezone = "Asia/Shanghai"
	}
	return nil
}

type StringList []string

func (list StringList) Value() (driver.Value, error) {
	if list == nil {
		return "[]", nil
	}
	data, err := json.Marshal(list)
	if err != nil {
		return nil, err
	}
	return string(data), nil
}

func (list *StringList) Scan(value interface{}) error {
	if value == nil {
		*list = StringList{}
		return nil
	}

	var data []byte
	switch v := value.(type) {
	case []byte:
		data = v
	case string:
		data = []byte(v)
	default:
		return fmt.Errorf("unsupported StringList value: %T", value)
	}

	if len(data) == 0 {
		*list = StringList{}
		return nil
	}
	return json.Unmarshal(data, list)
}

type LifeTraceTrace struct {
	ID        Int64String    `gorm:"primaryKey;autoIncrement:false" json:"id"`
	UserID    Int64String    `gorm:"column:user_id;index;not null" json:"userId"`
	PlanID    *Int64String   `gorm:"column:plan_id;index" json:"planId,omitempty"`
	Title     string         `gorm:"size:160;not null" json:"title"`
	Summary   string         `gorm:"size:1000;not null" json:"summary"`
	TimeLabel string         `gorm:"size:80;not null" json:"timeLabel"`
	Location  string         `gorm:"size:120" json:"location,omitempty"`
	ImageURL  string         `gorm:"size:800" json:"imageUrl,omitempty"`
	Mood      string         `gorm:"size:30;not null;default:'放松'" json:"mood"`
	Tags      StringList     `gorm:"type:text" json:"tags"`
	Source    string         `gorm:"size:20;not null;default:'手动';index" json:"source"`
	CreatedAt time.Time      `json:"createdAt"`
	UpdatedAt time.Time      `json:"updatedAt"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

func (trace *LifeTraceTrace) BeforeCreate(tx *gorm.DB) error {
	if trace.ID == 0 {
		trace.ID = Int64String(utils.GenerateID())
	}
	if trace.Mood == "" {
		trace.Mood = "放松"
	}
	if trace.Source == "" {
		trace.Source = "手动"
	}
	if trace.Tags == nil {
		trace.Tags = StringList{"生活迹"}
	}
	return nil
}

type LifeTraceSettings struct {
	ID                Int64String    `gorm:"primaryKey;autoIncrement:false" json:"id"`
	UserID            Int64String    `gorm:"column:user_id;uniqueIndex;not null" json:"userId"`
	City              string         `gorm:"size:80;not null;default:'上海'" json:"city"`
	WorkStart         string         `gorm:"size:20;not null;default:'09:30'" json:"workStart"`
	WorkEnd           string         `gorm:"size:20;not null;default:'18:30'" json:"workEnd"`
	CommuteMethod     string         `gorm:"size:20;not null;default:'开车'" json:"commuteMethod"`
	DailyBriefTime    string         `gorm:"size:20;not null;default:'08:10'" json:"dailyBriefTime"`
	WeatherAlerts     bool           `gorm:"default:true" json:"weatherAlerts"`
	PlanReminders     bool           `gorm:"default:true" json:"planReminders"`
	AIPersonalization bool           `gorm:"column:ai_personalization;default:true" json:"aiPersonalization"`
	Habits            StringList     `gorm:"type:text" json:"habits"`
	CreatedAt         time.Time      `json:"createdAt"`
	UpdatedAt         time.Time      `json:"updatedAt"`
	DeletedAt         gorm.DeletedAt `gorm:"index" json:"-"`
}

func (settings *LifeTraceSettings) BeforeCreate(tx *gorm.DB) error {
	if settings.ID == 0 {
		settings.ID = Int64String(utils.GenerateID())
	}
	if settings.City == "" {
		settings.City = "上海"
	}
	if settings.WorkStart == "" {
		settings.WorkStart = "09:30"
	}
	if settings.WorkEnd == "" {
		settings.WorkEnd = "18:30"
	}
	if settings.CommuteMethod == "" {
		settings.CommuteMethod = "开车"
	}
	if settings.DailyBriefTime == "" {
		settings.DailyBriefTime = "08:10"
	}
	if settings.Habits == nil {
		settings.Habits = StringList{"喝水", "休息", "运动", "护肤"}
	}
	return nil
}
