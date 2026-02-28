package model

import (
	"time"

	"gorm.io/gorm"
)

// User 用户模型
type User struct {
	ID        uint           `gorm:"primaryKey" json:"id"`
	Nickname  string         `gorm:"size:50" json:"nickname"`
	Avatar    string         `gorm:"size:255" json:"avatar"`
	OpenID    string         `gorm:"size:100;uniqueIndex" json:"openid"`
	Role      string         `gorm:"size:20;default:user" json:"role"` // user, admin
	IsActive  bool           `gorm:"default:true" json:"isActive"`
	CreatedAt time.Time      `json:"createdAt"`
	UpdatedAt time.Time      `json:"updatedAt"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

// Creator 创作者模型
type Creator struct {
	ID          uint           `gorm:"primaryKey" json:"id"`
	UserID      uint           `gorm:"index" json:"userId"`
	Name        string         `gorm:"size:50" json:"name"`
	Description string         `gorm:"size:255" json:"description"`
	Avatar      string         `gorm:"size:255" json:"avatar"`
	Code        string         `gorm:"size:20;uniqueIndex" json:"code"`
	IsActive    bool           `gorm:"default:true" json:"isActive"`
	CreatedAt   time.Time      `json:"createdAt"`
	UpdatedAt   time.Time      `json:"updatedAt"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`

	// 关联
	Resources []Resource `gorm:"foreignKey:CreatorID" json:"resources,omitempty"`
}

// Resource 资源模型
type Resource struct {
	ID            uint           `gorm:"primaryKey" json:"id"`
	CreatorID     uint           `gorm:"index" json:"creatorId"`
	Type          string         `gorm:"size:20" json:"type"` // avatar, wallpaper
	Title         string         `gorm:"size:100" json:"title"`
	Description   string         `gorm:"size:255" json:"description"`
	URL           string         `gorm:"size:500" json:"url"`
	ThumbnailURL  string         `gorm:"size:500" json:"thumbnailUrl"`
	Width         int            `json:"width"`
	Height        int            `json:"height"`
	Size          int64          `json:"size"`
	DownloadCount int            `gorm:"default:0" json:"downloadCount"`
	CreatedAt     time.Time      `json:"createdAt"`
	UpdatedAt     time.Time      `json:"updatedAt"`
	DeletedAt     gorm.DeletedAt `gorm:"index" json:"-"`

	// 关联
	Creator *Creator `gorm:"foreignKey:CreatorID" json:"creator,omitempty"`
}

// DownloadRecord 下载记录模型
type DownloadRecord struct {
	ID           uint      `gorm:"primaryKey" json:"id"`
	UserID       uint      `gorm:"index" json:"userId"`
	ResourceID   uint      `gorm:"index" json:"resourceId"`
	CreatorID    uint      `gorm:"index" json:"creatorId"`
	DownloadedAt time.Time `json:"downloadedAt"`

	// 关联
	User     *User     `gorm:"foreignKey:UserID" json:"user,omitempty"`
	Resource *Resource `gorm:"foreignKey:ResourceID" json:"resource,omitempty"`
	Creator  *Creator  `gorm:"foreignKey:CreatorID" json:"creator,omitempty"`
}

// UploadRecord 上传记录模型
type UploadRecord struct {
	ID         uint      `gorm:"primaryKey" json:"id"`
	CreatorID  uint      `gorm:"index" json:"creatorId"`
	ResourceID uint      `gorm:"index" json:"resourceId"`
	UploadedAt time.Time `json:"uploadedAt"`

	// 关联
	Creator  *Creator  `gorm:"foreignKey:CreatorID" json:"creator,omitempty"`
	Resource *Resource `gorm:"foreignKey:ResourceID" json:"resource,omitempty"`
}
