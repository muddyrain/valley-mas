package model

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"strconv"
	"time"
	"valley-server/internal/utils"

	"gorm.io/gorm"
)

// Int64String 用于将 int64 序列化为字符串，避免 JavaScript 精度丢失
type Int64String int64

// MarshalJSON 将 int64 序列化为 JSON 字符串
func (i Int64String) MarshalJSON() ([]byte, error) {
	return json.Marshal(strconv.FormatInt(int64(i), 10))
}

// UnmarshalJSON 从 JSON 字符串或数字反序列化为 int64
func (i *Int64String) UnmarshalJSON(data []byte) error {
	// 尝试解析为字符串
	var str string
	if err := json.Unmarshal(data, &str); err == nil {
		val, err := strconv.ParseInt(str, 10, 64)
		if err != nil {
			return err
		}
		*i = Int64String(val)
		return nil
	}

	// 尝试解析为数字
	var num int64
	if err := json.Unmarshal(data, &num); err != nil {
		return err
	}
	*i = Int64String(num)
	return nil
}

// Value 实现 driver.Valuer 接口，用于 GORM
func (i Int64String) Value() (driver.Value, error) {
	return int64(i), nil
}

// Scan 实现 sql.Scanner 接口，用于 GORM
func (i *Int64String) Scan(value interface{}) error {
	if value == nil {
		*i = 0
		return nil
	}
	switch v := value.(type) {
	case int64:
		*i = Int64String(v)
	case []byte:
		val, err := strconv.ParseInt(string(v), 10, 64)
		if err != nil {
			return err
		}
		*i = Int64String(val)
	case string:
		val, err := strconv.ParseInt(v, 10, 64)
		if err != nil {
			return err
		}
		*i = Int64String(val)
	default:
		return fmt.Errorf("cannot scan type %T into Int64String", value)
	}
	return nil
}

// User 用户模型 - 支持多平台（微信、抖音等）
// 使用 Snowflake ID（int64），序列化为字符串避免 JavaScript 精度丢失
type User struct {
	ID       Int64String `gorm:"primaryKey;autoIncrement:false" json:"id"` // Snowflake ID (序列化为字符串)
	Nickname string      `gorm:"size:50" json:"nickname"`
	Avatar   string      `gorm:"size:255" json:"avatar"`
	Platform string      `gorm:"size:50;default:'wechat'" json:"platform"` // wechat, douyin, mini_app 等
	OpenID   string      `gorm:"size:100;index" json:"openid"`             // 平台唯一标识
	UnionID  string      `gorm:"size:100;index" json:"unionid"`            // 同一主体下的唯一标识

	// 抖音平台特有字段
	DouyinOpenID   string `gorm:"size:100;index" json:"douyinOpenid,omitempty"`  // 抖音用户唯一标识
	DouyinUnionID  string `gorm:"size:100;index" json:"douyinUnionid,omitempty"` // 抖音开放平台账号唯一标识
	DouyinAvatar   string `gorm:"size:500" json:"douyinAvatar,omitempty"`        // 抖音头像
	DouyinNickname string `gorm:"size:100" json:"douyinNickname,omitempty"`      // 抖音昵称
	DouyinGender   int    `gorm:"default:0" json:"douyinGender,omitempty"`       // 抖音性别: 0-未知 1-男 2-女
	DouyinCity     string `gorm:"size:50" json:"douyinCity,omitempty"`           // 抖音用户城市
	DouyinProvince string `gorm:"size:50" json:"douyinProvince,omitempty"`       // 抖音用户省份
	DouyinCountry  string `gorm:"size:50" json:"douyinCountry,omitempty"`        // 抖音用户国家

	// 微信平台特有字段（可选）
	WechatOpenID  string `gorm:"size:100;index" json:"wechatOpenid,omitempty"`
	WechatUnionID string `gorm:"size:100;index" json:"wechatUnionid,omitempty"`

	// 管理后台登录字段
	Username string `gorm:"size:50;uniqueIndex" json:"username,omitempty"` // 登录用户名（管理员必填）
	Password string `gorm:"size:255" json:"-"`                             // 密码（MD5加密，不返回给前端）

	Role      string         `gorm:"size:20;default:'user'" json:"role"` // user, admin, creator
	IsActive  bool           `gorm:"default:true" json:"isActive"`
	Phone     string         `gorm:"size:20" json:"phone,omitempty"`  // 手机号（可选）
	Email     string         `gorm:"size:100" json:"email,omitempty"` // 邮箱（可选）
	CreatedAt time.Time      `json:"createdAt"`
	UpdatedAt time.Time      `json:"updatedAt"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

// BeforeCreate GORM 钩子：创建前自动生成 Snowflake ID
func (u *User) BeforeCreate(tx *gorm.DB) error {
	if u.ID == 0 {
		u.ID = Int64String(utils.GenerateID())
	}
	return nil
}

// Creator 创作者模型
type Creator struct {
	ID          Int64String    `gorm:"primaryKey;autoIncrement:false" json:"id"` // Snowflake ID (序列化为字符串)
	UserID      Int64String    `gorm:"index" json:"userId"`
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

// BeforeCreate GORM 钩子：创建前自动生成 Snowflake ID
func (c *Creator) BeforeCreate(tx *gorm.DB) error {
	if c.ID == 0 {
		c.ID = Int64String(utils.GenerateID())
	}
	return nil
}

// Resource 资源模型
type Resource struct {
	ID            Int64String    `gorm:"primaryKey;autoIncrement:false" json:"id"` // Snowflake ID (序列化为字符串)
	CreatorID     Int64String    `gorm:"index" json:"creatorId"`
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

// BeforeCreate GORM 钩子：创建前自动生成 Snowflake ID
func (r *Resource) BeforeCreate(tx *gorm.DB) error {
	if r.ID == 0 {
		r.ID = Int64String(utils.GenerateID())
	}
	return nil
}

// DownloadRecord 下载记录模型
type DownloadRecord struct {
	ID           Int64String `gorm:"primaryKey;autoIncrement:false" json:"id"` // Snowflake ID (序列化为字符串)
	UserID       Int64String `gorm:"index" json:"userId"`
	ResourceID   Int64String `gorm:"index" json:"resourceId"`
	CreatorID    Int64String `gorm:"index" json:"creatorId"`
	DownloadedAt time.Time   `json:"downloadedAt"`

	// 关联
	User     *User     `gorm:"foreignKey:UserID" json:"user,omitempty"`
	Resource *Resource `gorm:"foreignKey:ResourceID" json:"resource,omitempty"`
	Creator  *Creator  `gorm:"foreignKey:CreatorID" json:"creator,omitempty"`
}

// BeforeCreate GORM 钩子：创建前自动生成 Snowflake ID
func (d *DownloadRecord) BeforeCreate(tx *gorm.DB) error {
	if d.ID == 0 {
		d.ID = Int64String(utils.GenerateID())
	}
	return nil
}

// UploadRecord 上传记录模型
type UploadRecord struct {
	ID         Int64String `gorm:"primaryKey;autoIncrement:false" json:"id"` // Snowflake ID (序列化为字符串)
	CreatorID  Int64String `gorm:"index" json:"creatorId"`
	ResourceID Int64String `gorm:"index" json:"resourceId"`
	UploadedAt time.Time   `json:"uploadedAt"`

	// 关联
	Creator  *Creator  `gorm:"foreignKey:CreatorID" json:"creator,omitempty"`
	Resource *Resource `gorm:"foreignKey:ResourceID" json:"resource,omitempty"`
}

// BeforeCreate GORM 钩子：创建前自动生成 Snowflake ID
func (u *UploadRecord) BeforeCreate(tx *gorm.DB) error {
	if u.ID == 0 {
		u.ID = Int64String(utils.GenerateID())
	}
	return nil
}
