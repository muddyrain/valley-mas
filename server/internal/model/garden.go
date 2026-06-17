package model

import "time"

// Garden 用户的语种园配置
type Garden struct {
	ID         uint64    `gorm:"primaryKey;autoIncrement" json:"id"`
	UserID     uint64    `gorm:"uniqueIndex;not null"     json:"user_id"`
	SlotCount  int       `gorm:"not null;default:3"       json:"slot_count"`
	Experience int       `gorm:"not null;default:0"       json:"experience"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}

func (Garden) TableName() string { return "gardens" }

// Plant 一棵植物
type Plant struct {
	ID           uint64     `gorm:"primaryKey;autoIncrement"             json:"id"`
	UserID       uint64     `gorm:"index;not null"                       json:"user_id"`
	SlotIndex    int        `gorm:"not null"                             json:"slot_index"`
	ConceptInput string     `gorm:"type:varchar(255);not null"           json:"concept_input"`
	ConceptEN    string     `gorm:"type:varchar(120);not null"           json:"concept_en"`
	Name         string     `gorm:"type:varchar(120);not null"           json:"name"`
	Description  string     `gorm:"type:varchar(500);not null"           json:"description"`
	WaterStyle   string     `gorm:"type:varchar(20);not null"            json:"water_style"`
	Rarity       string     `gorm:"type:varchar(8);not null;index"       json:"rarity"`
	Stage        int        `gorm:"not null;default:0"                   json:"stage"`
	StageMax     int        `gorm:"not null;default:3"                   json:"stage_max"`
	AssetKey     string     `gorm:"type:varchar(120);not null;index"     json:"asset_key"`
	NextStageAt  time.Time  `gorm:"index"                                json:"next_stage_at"`
	Mood         string     `gorm:"type:varchar(60);not null;default:''" json:"mood"`
	Status       string     `gorm:"type:varchar(20);not null;index"      json:"status"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`
	HarvestedAt  *time.Time `json:"harvested_at"`
}

func (Plant) TableName() string { return "garden_plants" }

// GrowthLog 生长日志
type GrowthLog struct {
	ID        uint64    `gorm:"primaryKey;autoIncrement"  json:"id"`
	PlantID   uint64    `gorm:"index;not null"            json:"plant_id"`
	Stage     int       `gorm:"not null"                  json:"stage"`
	Type      string    `gorm:"type:varchar(20);not null" json:"type"`
	Content   string    `gorm:"type:text;not null"        json:"content"`
	CreatedAt time.Time `gorm:"index"                     json:"created_at"`
}

func (GrowthLog) TableName() string { return "garden_growth_logs" }

// InteractionLog 用户互动
type InteractionLog struct {
	ID        uint64    `gorm:"primaryKey;autoIncrement"        json:"id"`
	PlantID   uint64    `gorm:"index;not null"                  json:"plant_id"`
	Action    string    `gorm:"type:varchar(20);not null;index" json:"action"`
	UserInput string    `gorm:"type:varchar(500)"               json:"user_input"`
	AIReply   string    `gorm:"type:text"                       json:"ai_reply"`
	CreatedAt time.Time `gorm:"index"                           json:"created_at"`
}

func (InteractionLog) TableName() string { return "garden_interaction_logs" }

// Harvest 收获结果
type Harvest struct {
	ID               uint64    `gorm:"primaryKey;autoIncrement"   json:"id"`
	PlantID          uint64    `gorm:"uniqueIndex;not null"       json:"plant_id"`
	FinalAssetKey    string    `gorm:"type:varchar(120);not null" json:"final_asset_key"`
	FinalStory       string    `gorm:"type:text;not null"         json:"final_story"`
	FruitName        string    `gorm:"type:varchar(120);not null" json:"fruit_name"`
	FruitDescription string    `gorm:"type:varchar(500);not null" json:"fruit_description"`
	FarewellLetter   string    `gorm:"type:text;not null"         json:"farewell_letter"`
	CreatedAt        time.Time `json:"created_at"`
}

func (Harvest) TableName() string { return "garden_harvests" }
