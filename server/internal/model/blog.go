package model

import (
	"time"
	"valley-server/internal/utils"

	"gorm.io/gorm"
)

// Post 博客文章模型
type Post struct {
	ID          Int64String    `gorm:"primaryKey;autoIncrement:false" json:"id"`         // Snowflake ID
	Title       string         `gorm:"size:200;not null" json:"title"`                   // 文章标题
	Slug        string         `gorm:"size:200;uniqueIndex;not null" json:"slug"`        // URL 友好标识
	Content     string         `gorm:"type:text;not null" json:"content"`                // Markdown 内容
	HTMLContent string         `gorm:"type:text" json:"htmlContent,omitempty"`           // 渲染后的 HTML（可选，缓存用）
	Excerpt     string         `gorm:"size:500" json:"excerpt"`                          // 摘要
	Cover       string         `gorm:"size:500" json:"cover,omitempty"`                  // 封面图
	AuthorID    Int64String    `gorm:"index" json:"authorId"`                            // 作者 ID
	CategoryID  Int64String    `gorm:"index" json:"categoryId"`                          // 分类 ID
	Status      string         `gorm:"size:20;default:'draft';index" json:"status"`      // draft/published/archived
	ViewCount   int            `gorm:"default:0" json:"viewCount"`                       // 浏览次数
	LikeCount   int            `gorm:"default:0" json:"likeCount"`                       // 点赞次数
	IsTop       bool           `gorm:"default:false" json:"isTop"`                       // 是否置顶
	PublishedAt *time.Time     `json:"publishedAt,omitempty"`                            // 发布时间
	CreatedAt   time.Time      `json:"createdAt"`
	UpdatedAt   time.Time      `json:"updatedAt"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`

	// 关联
	Author   *User          `gorm:"foreignKey:AuthorID" json:"author,omitempty"`
	Category *PostCategory  `gorm:"foreignKey:CategoryID" json:"category,omitempty"`
	Tags     []PostTag      `gorm:"many2many:post_tag_relations;" json:"tags,omitempty"`
}

// BeforeCreate GORM 钩子：创建前自动生成 Snowflake ID
func (p *Post) BeforeCreate(tx *gorm.DB) error {
	if p.ID == 0 {
		p.ID = Int64String(utils.GenerateID())
	}
	return nil
}

// PostCategory 文章分类模型
type PostCategory struct {
	ID          Int64String    `gorm:"primaryKey;autoIncrement:false" json:"id"`    // Snowflake ID
	Name        string         `gorm:"size:50;uniqueIndex;not null" json:"name"`    // 分类名称
	Slug        string         `gorm:"size:50;uniqueIndex;not null" json:"slug"`    // URL 标识
	Description string         `gorm:"size:255" json:"description"`                 // 分类描述
	SortOrder   int            `gorm:"default:0" json:"sortOrder"`                  // 排序
	PostCount   int            `gorm:"default:0" json:"postCount"`                  // 文章数量
	CreatedAt   time.Time      `json:"createdAt"`
	UpdatedAt   time.Time      `json:"updatedAt"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
}

// BeforeCreate GORM 钩子：创建前自动生成 Snowflake ID
func (c *PostCategory) BeforeCreate(tx *gorm.DB) error {
	if c.ID == 0 {
		c.ID = Int64String(utils.GenerateID())
	}
	return nil
}

// PostTag 文章标签模型
type PostTag struct {
	ID        Int64String    `gorm:"primaryKey;autoIncrement:false" json:"id"` // Snowflake ID
	Name      string         `gorm:"size:30;uniqueIndex;not null" json:"name"` // 标签名称
	Slug      string         `gorm:"size:30;uniqueIndex;not null" json:"slug"` // URL 标识
	PostCount int            `gorm:"default:0" json:"postCount"`               // 文章数量
	CreatedAt time.Time      `json:"createdAt"`
	UpdatedAt time.Time      `json:"updatedAt"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

// BeforeCreate GORM 钩子：创建前自动生成 Snowflake ID
func (t *PostTag) BeforeCreate(tx *gorm.DB) error {
	if t.ID == 0 {
		t.ID = Int64String(utils.GenerateID())
	}
	return nil
}

// PostTagRelation 文章标签关联表
type PostTagRelation struct {
	PostID Int64String `gorm:"primaryKey;index" json:"postId"`
	TagID  Int64String `gorm:"primaryKey;index" json:"tagId"`
}

// TableName 指定表名
func (PostTagRelation) TableName() string {
	return "post_tag_relations"
}
