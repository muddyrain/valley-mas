package model

import (
	"time"
	"valley-server/internal/utils"

	"gorm.io/gorm"
)

// Post 博客/图文内容
// 注意：CoverStorageKey 用于封面文件替换/删除时做对象存储清理。
type Post struct {
	ID              Int64String    `gorm:"primaryKey;autoIncrement:false" json:"id"`
	Title           string         `gorm:"size:200;not null" json:"title"`
	Slug            string         `gorm:"size:200;uniqueIndex;not null" json:"slug"`
	PostType        string         `gorm:"size:20;default:'blog';index" json:"postType"`
	Visibility      string         `gorm:"size:20;default:'private';index" json:"visibility"`
	TemplateKey     string         `gorm:"size:64" json:"templateKey,omitempty"`
	TemplateData    string         `gorm:"type:text" json:"templateData,omitempty"`
	ImageTextData   string         `gorm:"type:json" json:"imageTextData,omitempty"`
	Content         string         `gorm:"type:text;not null" json:"content"`
	HTMLContent     string         `gorm:"type:text" json:"htmlContent,omitempty"`
	DraftData       string         `gorm:"type:text" json:"draftData,omitempty"`
	Excerpt         string         `gorm:"size:500" json:"excerpt"`
	Cover           string         `gorm:"size:500" json:"cover,omitempty"`
	CoverStorageKey string         `gorm:"size:500" json:"coverStorageKey,omitempty"`
	AuthorID        Int64String    `gorm:"index" json:"authorId"`
	GroupID         Int64String    `gorm:"index" json:"groupId"`
	CategoryID      Int64String    `gorm:"index" json:"categoryId"`
	Status          string         `gorm:"size:20;default:'draft';index" json:"status"`
	ViewCount       int            `gorm:"default:0" json:"viewCount"`
	LikeCount       int            `gorm:"default:0" json:"likeCount"`
	IsTop           bool           `gorm:"default:false" json:"isTop"`
	SortOrder       int            `gorm:"default:0;index" json:"sortOrder"`
	GroupSortOrder  int            `gorm:"default:0;index" json:"groupSortOrder"`
	PublishedAt     *time.Time     `json:"publishedAt,omitempty"`
	DraftUpdatedAt  *time.Time     `json:"draftUpdatedAt,omitempty"`
	CreatedAt       time.Time      `json:"createdAt"`
	UpdatedAt       time.Time      `json:"updatedAt"`
	DeletedAt       gorm.DeletedAt `gorm:"index" json:"-"`

	Author   *User         `gorm:"foreignKey:AuthorID" json:"author,omitempty"`
	Group    *PostGroup    `gorm:"foreignKey:GroupID" json:"group,omitempty"`
	Category *PostCategory `gorm:"foreignKey:CategoryID" json:"category,omitempty"`
	Tags     []PostTag     `gorm:"many2many:post_tag_relations;" json:"tags,omitempty"`
}

func (p *Post) BeforeCreate(tx *gorm.DB) error {
	if p.ID == 0 {
		p.ID = Int64String(utils.GenerateID())
	}
	return nil
}

type PostCategory struct {
	ID          Int64String    `gorm:"primaryKey;autoIncrement:false" json:"id"`
	Name        string         `gorm:"size:50;uniqueIndex;not null" json:"name"`
	Slug        string         `gorm:"size:50;uniqueIndex;not null" json:"slug"`
	Description string         `gorm:"size:255" json:"description"`
	SortOrder   int            `gorm:"default:0" json:"sortOrder"`
	PostCount   int            `gorm:"default:0" json:"postCount"`
	CreatedAt   time.Time      `json:"createdAt"`
	UpdatedAt   time.Time      `json:"updatedAt"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
}

func (c *PostCategory) BeforeCreate(tx *gorm.DB) error {
	if c.ID == 0 {
		c.ID = Int64String(utils.GenerateID())
	}
	return nil
}

type PostGroup struct {
	ID          Int64String    `gorm:"primaryKey;autoIncrement:false" json:"id"`
	Name        string         `gorm:"size:80;not null" json:"name"`
	Slug        string         `gorm:"size:100;not null;uniqueIndex" json:"slug"`
	GroupType   string         `gorm:"size:20;default:'blog';index" json:"groupType"`
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

func (g *PostGroup) BeforeCreate(tx *gorm.DB) error {
	if g.ID == 0 {
		g.ID = Int64String(utils.GenerateID())
	}
	return nil
}

type PostTag struct {
	ID        Int64String    `gorm:"primaryKey;autoIncrement:false" json:"id"`
	Name      string         `gorm:"size:30;uniqueIndex;not null" json:"name"`
	Slug      string         `gorm:"size:30;uniqueIndex;not null" json:"slug"`
	PostCount int            `gorm:"default:0" json:"postCount"`
	CreatedAt time.Time      `json:"createdAt"`
	UpdatedAt time.Time      `json:"updatedAt"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

func (t *PostTag) BeforeCreate(tx *gorm.DB) error {
	if t.ID == 0 {
		t.ID = Int64String(utils.GenerateID())
	}
	return nil
}

type PostTagRelation struct {
	PostID Int64String `gorm:"primaryKey;index" json:"postId"`
	TagID  Int64String `gorm:"primaryKey;index" json:"tagId"`
}

func (PostTagRelation) TableName() string {
	return "post_tag_relations"
}

type PostComment struct {
	ID        Int64String    `gorm:"primaryKey;autoIncrement:false" json:"id"`
	PostID    Int64String    `gorm:"index;not null" json:"postId"`
	UserID    Int64String    `gorm:"index;not null" json:"userId"`
	Content   string         `gorm:"size:2000;not null" json:"content"`
	CreatedAt time.Time      `json:"createdAt"`
	UpdatedAt time.Time      `json:"updatedAt"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	Post *Post `gorm:"foreignKey:PostID" json:"post,omitempty"`
	User *User `gorm:"foreignKey:UserID" json:"user,omitempty"`
}

func (c *PostComment) BeforeCreate(tx *gorm.DB) error {
	if c.ID == 0 {
		c.ID = Int64String(utils.GenerateID())
	}
	return nil
}
