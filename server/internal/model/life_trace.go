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

type LifeTraceCheckin struct {
	ID          Int64String    `gorm:"primaryKey;autoIncrement:false" json:"id"`
	UserID      Int64String    `gorm:"column:user_id;index;not null;uniqueIndex:uidx_life_trace_checkin_day_item" json:"userId"`
	Date        string         `gorm:"size:20;not null;index;uniqueIndex:uidx_life_trace_checkin_day_item" json:"date"`
	Name        string         `gorm:"size:80;not null;uniqueIndex:uidx_life_trace_checkin_day_item" json:"name"`
	Completed   bool           `gorm:"default:false;index" json:"completed"`
	CompletedAt *time.Time     `json:"completedAt,omitempty"`
	CreatedAt   time.Time      `json:"createdAt"`
	UpdatedAt   time.Time      `json:"updatedAt"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
}

func (checkin *LifeTraceCheckin) BeforeCreate(tx *gorm.DB) error {
	if checkin.ID == 0 {
		checkin.ID = Int64String(utils.GenerateID())
	}
	return nil
}

func (LifeTraceCheckin) TableName() string {
	return "life_trace_checkins"
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
	ID           Int64String    `gorm:"primaryKey;autoIncrement:false" json:"id"`
	UserID       Int64String    `gorm:"column:user_id;index;not null" json:"userId"`
	PlanID       *Int64String   `gorm:"column:plan_id;index" json:"planId,omitempty"`
	PantryItemID *Int64String   `gorm:"column:pantry_item_id;index" json:"pantryItemId,omitempty"`
	Title        string         `gorm:"size:160;not null" json:"title"`
	Summary      string         `gorm:"size:1000;not null" json:"summary"`
	TimeLabel    string         `gorm:"size:80;not null" json:"timeLabel"`
	Location     string         `gorm:"size:120" json:"location,omitempty"`
	ImageURL     string         `gorm:"size:800" json:"imageUrl,omitempty"`
	Mood         string         `gorm:"size:30;not null;default:'放松'" json:"mood"`
	Tags         StringList     `gorm:"type:text" json:"tags"`
	Source       string         `gorm:"size:20;not null;default:'手动';index" json:"source"`
	CreatedAt    time.Time      `json:"createdAt"`
	UpdatedAt    time.Time      `json:"updatedAt"`
	DeletedAt    gorm.DeletedAt `gorm:"index" json:"-"`
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

type LifeTraceInboxItem struct {
	ID            Int64String    `gorm:"primaryKey;autoIncrement:false" json:"id"`
	UserID        Int64String    `gorm:"column:user_id;index;not null" json:"userId"`
	Title         string         `gorm:"size:160;not null" json:"title"`
	Content       string         `gorm:"type:text" json:"content,omitempty"`
	ItemType      string         `gorm:"column:item_type;size:20;not null;default:'text';index" json:"itemType"`
	LinkURL       string         `gorm:"column:link_url;size:800" json:"linkUrl,omitempty"`
	Tags          StringList     `gorm:"type:text" json:"tags"`
	Status        string         `gorm:"size:20;not null;default:'inbox';index" json:"status"`
	ConvertedType string         `gorm:"column:converted_type;size:30" json:"convertedType,omitempty"`
	ConvertedID   string         `gorm:"column:converted_id;size:80;index" json:"convertedId,omitempty"`
	ConvertedAt   *time.Time     `json:"convertedAt,omitempty"`
	CreatedAt     time.Time      `json:"createdAt"`
	UpdatedAt     time.Time      `json:"updatedAt"`
	DeletedAt     gorm.DeletedAt `gorm:"index" json:"-"`
}

func (item *LifeTraceInboxItem) BeforeCreate(tx *gorm.DB) error {
	if item.ID == 0 {
		item.ID = Int64String(utils.GenerateID())
	}
	if item.ItemType == "" {
		item.ItemType = "text"
	}
	if item.Status == "" {
		item.Status = "inbox"
	}
	if item.Tags == nil {
		item.Tags = StringList{}
	}
	return nil
}

type LifeTracePantryItem struct {
	ID                 Int64String    `gorm:"primaryKey;autoIncrement:false" json:"id"`
	UserID             Int64String    `gorm:"column:user_id;index;not null" json:"userId"`
	HouseholdID        Int64String    `gorm:"column:household_id;index" json:"householdId,omitempty"`
	Name               string         `gorm:"size:160;not null" json:"name"`
	Category           string         `gorm:"size:30;not null;default:'食品';index" json:"category"`
	Quantity           int            `gorm:"not null;default:1" json:"quantity"`
	Unit               string         `gorm:"size:20;not null;default:'件'" json:"unit"`
	Location           string         `gorm:"size:30;not null;default:'冷藏';index" json:"location"`
	ExpiresAt          string         `gorm:"size:20;index" json:"expiresAt,omitempty"`
	OpenedAt           string         `gorm:"size:20" json:"openedAt,omitempty"`
	Note               string         `gorm:"size:1000" json:"note"`
	ImageURL           string         `gorm:"size:800" json:"imageUrl,omitempty"`
	ThumbnailURL       string         `gorm:"type:text" json:"thumbnailUrl,omitempty"`
	BarcodeValue       string         `gorm:"size:120;index" json:"barcodeValue,omitempty"`
	BarcodeFormat      string         `gorm:"size:40" json:"barcodeFormat,omitempty"`
	Status             string         `gorm:"size:20;not null;default:'normal';index" json:"status"`
	CreatedBy          Int64String    `gorm:"column:created_by;index" json:"createdBy,omitempty"`
	UpdatedBy          Int64String    `gorm:"column:updated_by;index" json:"updatedBy,omitempty"`
	ReminderEnabled    bool           `gorm:"column:reminder_enabled;default:true" json:"reminderEnabled"`
	ReminderUseDefault bool           `gorm:"column:reminder_use_default;default:true" json:"reminderUseDefault"`
	ReminderRules      StringList     `gorm:"type:text" json:"reminderRules"`
	ReminderTime       string         `gorm:"size:20;not null;default:'09:00'" json:"reminderTime"`
	CreatedAt          time.Time      `json:"createdAt"`
	UpdatedAt          time.Time      `json:"updatedAt"`
	DeletedAt          gorm.DeletedAt `gorm:"index" json:"-"`
}

type LifeTracePhotoItemDraft struct {
	ID          Int64String    `gorm:"primaryKey;autoIncrement:false" json:"id"`
	UserID      Int64String    `gorm:"column:user_id;index;not null;uniqueIndex:uidx_life_trace_photo_item_draft" json:"userId"`
	DraftID     string         `gorm:"column:draft_id;size:120;not null;uniqueIndex:uidx_life_trace_photo_item_draft" json:"draftId"`
	ImageURL    string         `gorm:"type:text" json:"imageUrl,omitempty"`
	Status      string         `gorm:"size:20;not null;default:'draft';index" json:"status"`
	SavedItemID string         `gorm:"column:saved_item_id;size:80;index" json:"savedItemId,omitempty"`
	Payload     string         `gorm:"type:text;not null" json:"payload"`
	CreatedAt   time.Time      `json:"createdAt"`
	UpdatedAt   time.Time      `json:"updatedAt"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
}

func (draft *LifeTracePhotoItemDraft) BeforeCreate(tx *gorm.DB) error {
	if draft.ID == 0 {
		draft.ID = Int64String(utils.GenerateID())
	}
	if draft.Status == "" {
		draft.Status = "draft"
	}
	return nil
}

func (item *LifeTracePantryItem) BeforeCreate(tx *gorm.DB) error {
	if item.ID == 0 {
		item.ID = Int64String(utils.GenerateID())
	}
	if item.Category == "" {
		item.Category = "食品"
	}
	if item.Quantity <= 0 {
		item.Quantity = 1
	}
	if item.Unit == "" {
		item.Unit = "件"
	}
	if item.Location == "" {
		item.Location = "冷藏"
	}
	if item.Status == "" {
		item.Status = "normal"
	}
	if item.ReminderRules == nil {
		item.ReminderRules = StringList{"7d", "3d", "same-day", "expired"}
	}
	if item.ReminderTime == "" {
		item.ReminderTime = "09:00"
	}
	return nil
}

type LifeTraceSettings struct {
	ID                      Int64String    `gorm:"primaryKey;autoIncrement:false" json:"id"`
	UserID                  Int64String    `gorm:"column:user_id;uniqueIndex;not null" json:"userId"`
	ActivePantryHouseholdID Int64String    `gorm:"column:active_pantry_household_id;index" json:"activePantryHouseholdId,omitempty"`
	City                    string         `gorm:"size:80;not null;default:'上海'" json:"city"`
	WorkStart               string         `gorm:"size:20;not null;default:'09:30'" json:"workStart"`
	WorkEnd                 string         `gorm:"size:20;not null;default:'18:30'" json:"workEnd"`
	CommuteMethod           string         `gorm:"size:20;not null;default:'开车'" json:"commuteMethod"`
	DailyBriefTime          string         `gorm:"size:20;not null;default:'08:10'" json:"dailyBriefTime"`
	WorkdayMode             string         `gorm:"size:20;not null;default:'legal'" json:"workdayMode"`
	Workdays                StringList     `gorm:"type:text" json:"workdays"`
	HolidaySync             bool           `gorm:"default:true" json:"holidaySync"`
	WeekendReminders        bool           `gorm:"default:false" json:"weekendReminders"`
	PlanReminderLeadMinutes int            `gorm:"default:10" json:"planReminderLeadMinutes"`
	QuietStart              string         `gorm:"size:20;not null;default:'22:30'" json:"quietStart"`
	QuietEnd                string         `gorm:"size:20;not null;default:'07:30'" json:"quietEnd"`
	WeatherAlerts           bool           `gorm:"default:true" json:"weatherAlerts"`
	PlanReminders           bool           `gorm:"default:true" json:"planReminders"`
	AIPersonalization       bool           `gorm:"column:ai_personalization;default:true" json:"aiPersonalization"`
	Habits                  StringList     `gorm:"type:text" json:"habits"`
	PantryReminderEnabled   bool           `gorm:"column:pantry_reminder_enabled;default:true" json:"pantryReminderEnabled"`
	PantryReminderRules     StringList     `gorm:"type:text" json:"pantryReminderRules"`
	PantryReminderTime      string         `gorm:"size:20;not null;default:'09:00'" json:"pantryReminderTime"`
	CreatedAt               time.Time      `json:"createdAt"`
	UpdatedAt               time.Time      `json:"updatedAt"`
	DeletedAt               gorm.DeletedAt `gorm:"index" json:"-"`
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
	if settings.WorkdayMode == "" {
		settings.WorkdayMode = "legal"
	}
	if settings.Workdays == nil {
		settings.Workdays = StringList{"1", "2", "3", "4", "5"}
	}
	if settings.PlanReminderLeadMinutes <= 0 {
		settings.PlanReminderLeadMinutes = 10
	}
	if settings.QuietStart == "" {
		settings.QuietStart = "22:30"
	}
	if settings.QuietEnd == "" {
		settings.QuietEnd = "07:30"
	}
	if settings.Habits == nil {
		settings.Habits = StringList{"喝水", "休息", "运动", "护肤"}
	}
	if settings.PantryReminderRules == nil {
		settings.PantryReminderRules = StringList{"7d", "3d", "same-day", "expired"}
	}
	if settings.PantryReminderTime == "" {
		settings.PantryReminderTime = "09:00"
	}
	return nil
}

type LifeTraceWeeklyReview struct {
	ID          Int64String    `gorm:"primaryKey;autoIncrement:false" json:"id"`
	UserID      Int64String    `gorm:"column:user_id;index;not null;uniqueIndex:uidx_life_trace_weekly_review" json:"userId"`
	WeekStart   string         `gorm:"size:20;not null;index;uniqueIndex:uidx_life_trace_weekly_review" json:"weekStart"`
	WeekEnd     string         `gorm:"size:20;not null" json:"weekEnd"`
	Summary     string         `gorm:"size:1000;not null" json:"summary"`
	Wins        StringList     `gorm:"type:text" json:"wins"`
	Delays      StringList     `gorm:"type:text" json:"delays"`
	Insights    StringList     `gorm:"type:text" json:"insights"`
	NextActions StringList     `gorm:"type:text" json:"nextActions"`
	Source      string         `gorm:"size:20;not null" json:"source"`
	Model       string         `gorm:"size:120" json:"model,omitempty"`
	CreatedAt   time.Time      `json:"createdAt"`
	UpdatedAt   time.Time      `json:"updatedAt"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
}

func (review *LifeTraceWeeklyReview) BeforeCreate(tx *gorm.DB) error {
	if review.ID == 0 {
		review.ID = Int64String(utils.GenerateID())
	}
	return nil
}

type LifeTraceAchievement struct {
	ID           Int64String    `gorm:"primaryKey;autoIncrement:false" json:"id"`
	UserID       Int64String    `gorm:"column:user_id;index;not null;uniqueIndex:uidx_life_trace_achievement_user_code" json:"userId"`
	Code         string         `gorm:"size:80;not null;uniqueIndex:uidx_life_trace_achievement_user_code" json:"code"`
	Category     string         `gorm:"size:30;not null;index" json:"category"`
	EvidenceType string         `gorm:"size:40" json:"evidenceType,omitempty"`
	EvidenceID   string         `gorm:"size:80" json:"evidenceId,omitempty"`
	Progress     int            `gorm:"not null;default:0" json:"progress"`
	Target       int            `gorm:"not null;default:1" json:"target"`
	AIComment    string         `gorm:"column:ai_comment;size:500" json:"aiComment,omitempty"`
	Metadata     string         `gorm:"type:text;not null;default:'{}'" json:"metadata,omitempty"`
	UnlockedAt   time.Time      `gorm:"column:unlocked_at;not null;index" json:"unlockedAt"`
	CreatedAt    time.Time      `json:"createdAt"`
	UpdatedAt    time.Time      `json:"updatedAt"`
	DeletedAt    gorm.DeletedAt `gorm:"index" json:"-"`
}

func (achievement *LifeTraceAchievement) BeforeCreate(tx *gorm.DB) error {
	if achievement.ID == 0 {
		achievement.ID = Int64String(utils.GenerateID())
	}
	if achievement.Target <= 0 {
		achievement.Target = 1
	}
	if achievement.Metadata == "" {
		achievement.Metadata = "{}"
	}
	if achievement.UnlockedAt.IsZero() {
		achievement.UnlockedAt = time.Now()
	}
	return nil
}

type LifeTraceFeedback struct {
	ID         Int64String    `gorm:"primaryKey;autoIncrement:false" json:"id"`
	UserID     Int64String    `gorm:"column:user_id;index;not null" json:"userId"`
	App        string         `gorm:"size:60;not null;default:'life-trace';index" json:"app"`
	Content    string         `gorm:"type:text;not null" json:"content"`
	ImageURLs  StringList     `gorm:"column:image_urls;type:text" json:"imageUrls"`
	Status     string         `gorm:"size:20;not null;default:'open';index" json:"status"`
	ResolvedBy Int64String    `gorm:"column:resolved_by;index" json:"resolvedBy,omitempty"`
	ResolvedAt *time.Time     `json:"resolvedAt,omitempty"`
	CreatedAt  time.Time      `json:"createdAt"`
	UpdatedAt  time.Time      `json:"updatedAt"`
	DeletedAt  gorm.DeletedAt `gorm:"index" json:"-"`

	User *User `gorm:"foreignKey:UserID" json:"user,omitempty"`
}

func (feedback *LifeTraceFeedback) BeforeCreate(tx *gorm.DB) error {
	if feedback.ID == 0 {
		feedback.ID = Int64String(utils.GenerateID())
	}
	if feedback.App == "" {
		feedback.App = "life-trace"
	}
	if feedback.Status == "" {
		feedback.Status = "open"
	}
	if feedback.ImageURLs == nil {
		feedback.ImageURLs = StringList{}
	}
	return nil
}

type LifeTraceAIConversation struct {
	ID        Int64String    `gorm:"primaryKey;autoIncrement:false" json:"id"`
	UserID    Int64String    `gorm:"column:user_id;index;not null" json:"userId"`
	Title     string         `gorm:"size:120;not null;default:'生活助理对话'" json:"title"`
	Status    string         `gorm:"size:20;not null;default:'active';index" json:"status"`
	CreatedAt time.Time      `json:"createdAt"`
	UpdatedAt time.Time      `json:"updatedAt"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

func (conversation *LifeTraceAIConversation) BeforeCreate(tx *gorm.DB) error {
	if conversation.ID == 0 {
		conversation.ID = Int64String(utils.GenerateID())
	}
	if conversation.Title == "" {
		conversation.Title = "生活助理对话"
	}
	if conversation.Status == "" {
		conversation.Status = "active"
	}
	return nil
}

type LifeTraceAIMessage struct {
	ID             Int64String    `gorm:"primaryKey;autoIncrement:false" json:"id"`
	UserID         Int64String    `gorm:"column:user_id;index;not null" json:"userId"`
	ConversationID Int64String    `gorm:"column:conversation_id;index;not null" json:"conversationId"`
	Role           string         `gorm:"size:20;not null;index" json:"role"`
	Content        string         `gorm:"type:text;not null" json:"content"`
	CreatedAt      time.Time      `json:"createdAt"`
	DeletedAt      gorm.DeletedAt `gorm:"index" json:"-"`
}

func (message *LifeTraceAIMessage) BeforeCreate(tx *gorm.DB) error {
	if message.ID == 0 {
		message.ID = Int64String(utils.GenerateID())
	}
	return nil
}

type LifeTraceAIAction struct {
	ID         Int64String    `gorm:"primaryKey;autoIncrement:false" json:"id"`
	UserID     Int64String    `gorm:"column:user_id;index;not null" json:"userId"`
	Title      string         `gorm:"size:160;not null" json:"title"`
	ActionType string         `gorm:"column:action_type;size:40;not null;default:'general';index" json:"actionType"`
	CreatedAt  time.Time      `json:"createdAt"`
	DeletedAt  gorm.DeletedAt `gorm:"index" json:"-"`
}

func (action *LifeTraceAIAction) BeforeCreate(tx *gorm.DB) error {
	if action.ID == 0 {
		action.ID = Int64String(utils.GenerateID())
	}
	if action.ActionType == "" {
		action.ActionType = "general"
	}
	return nil
}

type LifeTracePushSubscription struct {
	ID         Int64String    `gorm:"primaryKey;autoIncrement:false" json:"id"`
	UserID     Int64String    `gorm:"column:user_id;index;not null" json:"userId"`
	Endpoint   string         `gorm:"type:text;not null" json:"endpoint"`
	P256DH     string         `gorm:"column:p256dh;type:text;not null" json:"p256dh"`
	Auth       string         `gorm:"type:text;not null" json:"auth"`
	Status     string         `gorm:"size:20;not null;default:'active';index" json:"status"`
	UserAgent  string         `gorm:"size:500" json:"userAgent,omitempty"`
	LastError  string         `gorm:"size:500" json:"lastError,omitempty"`
	LastSentAt *time.Time     `json:"lastSentAt,omitempty"`
	CreatedAt  time.Time      `json:"createdAt"`
	UpdatedAt  time.Time      `json:"updatedAt"`
	DeletedAt  gorm.DeletedAt `gorm:"index" json:"-"`
}

func (subscription *LifeTracePushSubscription) BeforeCreate(tx *gorm.DB) error {
	if subscription.ID == 0 {
		subscription.ID = Int64String(utils.GenerateID())
	}
	if subscription.Status == "" {
		subscription.Status = "active"
	}
	return nil
}

type LifeTracePushDelivery struct {
	ID             Int64String    `gorm:"primaryKey;autoIncrement:false" json:"id"`
	UserID         Int64String    `gorm:"column:user_id;index;not null;uniqueIndex:uidx_life_trace_push_delivery" json:"userId"`
	PlanID         Int64String    `gorm:"column:plan_id;index;not null;uniqueIndex:uidx_life_trace_push_delivery" json:"planId"`
	DueAt          time.Time      `gorm:"not null;index;uniqueIndex:uidx_life_trace_push_delivery" json:"dueAt"`
	SubscriptionID Int64String    `gorm:"column:subscription_id;index;not null;uniqueIndex:uidx_life_trace_push_delivery" json:"subscriptionId"`
	Status         string         `gorm:"size:20;not null;default:'sent';index" json:"status"`
	Error          string         `gorm:"size:500" json:"error,omitempty"`
	CreatedAt      time.Time      `json:"createdAt"`
	DeletedAt      gorm.DeletedAt `gorm:"index" json:"-"`
}

func (delivery *LifeTracePushDelivery) BeforeCreate(tx *gorm.DB) error {
	if delivery.ID == 0 {
		delivery.ID = Int64String(utils.GenerateID())
	}
	if delivery.Status == "" {
		delivery.Status = "sent"
	}
	return nil
}

type LifeTraceDailyBriefDelivery struct {
	ID             Int64String    `gorm:"primaryKey;autoIncrement:false" json:"id"`
	UserID         Int64String    `gorm:"column:user_id;index;not null;uniqueIndex:uidx_life_trace_daily_brief_delivery" json:"userId"`
	BriefDate      string         `gorm:"column:brief_date;size:20;not null;index;uniqueIndex:uidx_life_trace_daily_brief_delivery" json:"briefDate"`
	ScheduledAt    time.Time      `gorm:"not null;index" json:"scheduledAt"`
	SubscriptionID Int64String    `gorm:"column:subscription_id;index;not null;uniqueIndex:uidx_life_trace_daily_brief_delivery" json:"subscriptionId"`
	Status         string         `gorm:"size:20;not null;default:'sent';index" json:"status"`
	Error          string         `gorm:"size:500" json:"error,omitempty"`
	CreatedAt      time.Time      `json:"createdAt"`
	DeletedAt      gorm.DeletedAt `gorm:"index" json:"-"`
}

func (delivery *LifeTraceDailyBriefDelivery) BeforeCreate(tx *gorm.DB) error {
	if delivery.ID == 0 {
		delivery.ID = Int64String(utils.GenerateID())
	}
	if delivery.Status == "" {
		delivery.Status = "sent"
	}
	return nil
}

type LifeTracePantryReminderDelivery struct {
	ID             Int64String    `gorm:"primaryKey;autoIncrement:false" json:"id"`
	UserID         Int64String    `gorm:"column:user_id;index;not null;uniqueIndex:uidx_life_trace_pantry_delivery" json:"userId"`
	PantryItemID   Int64String    `gorm:"column:pantry_item_id;index;not null;uniqueIndex:uidx_life_trace_pantry_delivery" json:"pantryItemId"`
	Rule           string         `gorm:"size:20;not null;uniqueIndex:uidx_life_trace_pantry_delivery" json:"rule"`
	DueAt          time.Time      `gorm:"not null;index;uniqueIndex:uidx_life_trace_pantry_delivery" json:"dueAt"`
	SubscriptionID Int64String    `gorm:"column:subscription_id;index;not null;uniqueIndex:uidx_life_trace_pantry_delivery" json:"subscriptionId"`
	Status         string         `gorm:"size:20;not null;default:'sent';index" json:"status"`
	Error          string         `gorm:"size:500" json:"error,omitempty"`
	CreatedAt      time.Time      `json:"createdAt"`
	DeletedAt      gorm.DeletedAt `gorm:"index" json:"-"`
}

func (delivery *LifeTracePantryReminderDelivery) BeforeCreate(tx *gorm.DB) error {
	if delivery.ID == 0 {
		delivery.ID = Int64String(utils.GenerateID())
	}
	if delivery.Status == "" {
		delivery.Status = "sent"
	}
	return nil
}

type LifeTraceHolidayCalendar struct {
	ID            Int64String    `gorm:"primaryKey;autoIncrement:false" json:"id"`
	Country       string         `gorm:"size:8;not null;uniqueIndex:uidx_life_trace_holiday_calendar" json:"country"`
	Year          int            `gorm:"not null;uniqueIndex:uidx_life_trace_holiday_calendar" json:"year"`
	SourceName    string         `gorm:"size:160" json:"sourceName,omitempty"`
	SourceURL     string         `gorm:"size:500" json:"sourceUrl,omitempty"`
	Payload       string         `gorm:"type:text;not null" json:"payload"`
	SyncedAt      time.Time      `json:"syncedAt"`
	LastCheckedAt time.Time      `json:"lastCheckedAt"`
	CreatedAt     time.Time      `json:"createdAt"`
	UpdatedAt     time.Time      `json:"updatedAt"`
	DeletedAt     gorm.DeletedAt `gorm:"index" json:"-"`
}

func (calendar *LifeTraceHolidayCalendar) BeforeCreate(tx *gorm.DB) error {
	if calendar.ID == 0 {
		calendar.ID = Int64String(utils.GenerateID())
	}
	if calendar.Country == "" {
		calendar.Country = "CN"
	}
	if calendar.SyncedAt.IsZero() {
		calendar.SyncedAt = time.Now()
	}
	if calendar.LastCheckedAt.IsZero() {
		calendar.LastCheckedAt = calendar.SyncedAt
	}
	return nil
}
