package model

import (
	"time"
	"valley-server/internal/utils"

	"gorm.io/gorm"
)

// Post 鍗氬鏂囩珷妯″瀷
type Post struct {
	ID            Int64String    `gorm:"primaryKey;autoIncrement:false" json:"id"`     // Snowflake ID
	Title         string         `gorm:"size:200;not null" json:"title"`               // 标题
	Slug          string         `gorm:"size:200;uniqueIndex;not null" json:"slug"`    // Slug
	PostType      string         `gorm:"size:20;default:'blog';index" json:"postType"` // 文章类型
	TemplateKey   string         `gorm:"size:64" json:"templateKey,omitempty"`         // 图文模板标识
	TemplateData  string         `gorm:"type:text" json:"templateData,omitempty"`      // 图文模板数据(JSON)
	ImageTextData string         `gorm:"type:json" json:"imageTextData,omitempty"`     // 图文结构化数据(JSON)
	Content       string         `gorm:"type:text;not null" json:"content"`            // Markdown 内容
	HTMLContent   string         `gorm:"type:text" json:"htmlContent,omitempty"`       // 渲染后的 HTML，便于前端展示
	Excerpt       string         `gorm:"size:500" json:"excerpt"`                      // 摘要
	Cover         string         `gorm:"size:500" json:"cover,omitempty"`              // 封面图
	AuthorID      Int64String    `gorm:"index" json:"authorId"`                        // 作者 ID
	GroupID       Int64String    `gorm:"index" json:"groupId"`                         // 分组 ID
	CategoryID    Int64String    `gorm:"index" json:"categoryId"`                      // 分类 ID
	Status        string         `gorm:"size:20;default:'draft';index" json:"status"`  // draft/published/archived
	ViewCount     int            `gorm:"default:0" json:"viewCount"`                   // 浏览量
	LikeCount     int            `gorm:"default:0" json:"likeCount"`                   // 点赞数
	IsTop         bool           `gorm:"default:false" json:"isTop"`                   // 是否置顶
	PublishedAt   *time.Time     `json:"publishedAt,omitempty"`                        // 发表时间
	CreatedAt     time.Time      `json:"createdAt"`
	UpdatedAt     time.Time      `json:"updatedAt"`
	DeletedAt     gorm.DeletedAt `gorm:"index" json:"-"`

	// 鍏宠仈
	Author   *User         `gorm:"foreignKey:AuthorID" json:"author,omitempty"`
	Group    *PostGroup    `gorm:"foreignKey:GroupID" json:"group,omitempty"`
	Category *PostCategory `gorm:"foreignKey:CategoryID" json:"category,omitempty"`
	Tags     []PostTag     `gorm:"many2many:post_tag_relations;" json:"tags,omitempty"`
}

// BeforeCreate GORM 閽╁瓙锛氬垱寤哄墠鑷姩鐢熸垚 Snowflake ID
func (p *Post) BeforeCreate(tx *gorm.DB) error {
	if p.ID == 0 {
		p.ID = Int64String(utils.GenerateID())
	}
	return nil
}

// PostCategory 鏂囩珷鍒嗙被妯″瀷
type PostCategory struct {
	ID          Int64String    `gorm:"primaryKey;autoIncrement:false" json:"id"` // Snowflake ID
	Name        string         `gorm:"size:50;uniqueIndex;not null" json:"name"` // 分类名称
	Slug        string         `gorm:"size:50;uniqueIndex;not null" json:"slug"` // URL Slug
	Description string         `gorm:"size:255" json:"description"`              // 分类描述
	SortOrder   int            `gorm:"default:0" json:"sortOrder"`               // 排序
	PostCount   int            `gorm:"default:0" json:"postCount"`               // 文章数量
	CreatedAt   time.Time      `json:"createdAt"`
	UpdatedAt   time.Time      `json:"updatedAt"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
}

// BeforeCreate GORM 閽╁瓙锛氬垱寤哄墠鑷姩鐢熸垚 Snowflake ID
func (c *PostCategory) BeforeCreate(tx *gorm.DB) error {
	if c.ID == 0 {
		c.ID = Int64String(utils.GenerateID())
	}
	return nil
}

// PostGroup 文章分组模型（支持一层嵌套）
type PostGroup struct {
	ID          Int64String    `gorm:"primaryKey;autoIncrement:false" json:"id"`
	Name        string         `gorm:"size:80;not null" json:"name"`
	Slug        string         `gorm:"size:100;not null;uniqueIndex" json:"slug"`
	Description string         `gorm:"size:255" json:"description"`
	AuthorID    Int64String    `gorm:"index;not null" json:"authorId"`
	ParentID    *Int64String   `gorm:"index" json:"parentId,omitempty"`
	SortOrder   int            `gorm:"default:0" json:"sortOrder"`
	PostCount   int            `gorm:"default:0" json:"postCount"`
	CreatedAt   time.Time      `json:"createdAt"`
	UpdatedAt   time.Time      `json:"updatedAt"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`

	Author *User      `gorm:"foreignKey:AuthorID" json:"author,omitempty"`
	Parent *PostGroup `gorm:"foreignKey:ParentID" json:"parent,omitempty"`
}

// BeforeCreate GORM 钩子：创建前自动生成 Snowflake ID
func (g *PostGroup) BeforeCreate(tx *gorm.DB) error {
	if g.ID == 0 {
		g.ID = Int64String(utils.GenerateID())
	}
	return nil
}

// PostTag 鏂囩珷鏍囩妯″瀷
type PostTag struct {
	ID        Int64String    `gorm:"primaryKey;autoIncrement:false" json:"id"` // Snowflake ID
	Name      string         `gorm:"size:30;uniqueIndex;not null" json:"name"` // 标签名称
	Slug      string         `gorm:"size:30;uniqueIndex;not null" json:"slug"` // URL Slug
	PostCount int            `gorm:"default:0" json:"postCount"`               // 文章数量
	CreatedAt time.Time      `json:"createdAt"`
	UpdatedAt time.Time      `json:"updatedAt"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

// BeforeCreate GORM 閽╁瓙锛氬垱寤哄墠鑷姩鐢熸垚 Snowflake ID
func (t *PostTag) BeforeCreate(tx *gorm.DB) error {
	if t.ID == 0 {
		t.ID = Int64String(utils.GenerateID())
	}
	return nil
}

// PostTagRelation 鏂囩珷鏍囩鍏宠仈琛?
type PostTagRelation struct {
	PostID Int64String `gorm:"primaryKey;index" json:"postId"`
	TagID  Int64String `gorm:"primaryKey;index" json:"tagId"`
}

// TableName 鎸囧畾琛ㄥ悕
func (PostTagRelation) TableName() string {
	return "post_tag_relations"
}
