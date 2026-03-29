package model

import "time"

// OperationLog 请求操作日志（审计用）
type OperationLog struct {
	ID        Int64String `gorm:"primaryKey;autoIncrement:false" json:"id"`
	LogID     string      `gorm:"size:32;index" json:"logId"`
	Method    string      `gorm:"size:16;index" json:"method"`
	Path      string      `gorm:"size:255;index" json:"path"`
	Query     string      `gorm:"size:1024" json:"query"`
	Status    int         `gorm:"index" json:"status"`
	LatencyMs int64       `json:"latencyMs"`
	IP        string      `gorm:"size:64;index" json:"ip"`
	UserAgent string      `gorm:"size:512" json:"userAgent"`
	UserID    string      `gorm:"size:32;index" json:"userId"`
	UserRole  string      `gorm:"size:32;index" json:"userRole"`
	Level     string      `gorm:"size:16;index" json:"level"`
	Message   string      `gorm:"size:128" json:"message"`
	CreatedAt time.Time   `gorm:"index" json:"createdAt"`
}
