package model

import "time"

// CreatorAuditConfig 创作者申请 AI 审核配置
// 目前使用单行配置（id=1）存储全局严谨度。
type CreatorAuditConfig struct {
	ID         uint         `gorm:"primaryKey;autoIncrement:false" json:"id"`
	Strictness int          `gorm:"not null;default:20" json:"strictness"` // 0-100，越高越严格
	UpdatedBy  *Int64String `gorm:"index" json:"updatedBy,omitempty"`
	CreatedAt  time.Time    `json:"createdAt"`
	UpdatedAt  time.Time    `json:"updatedAt"`
}

func (CreatorAuditConfig) TableName() string {
	return "creator_audit_configs"
}
