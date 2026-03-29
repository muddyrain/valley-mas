package model

import (
	"time"
	"valley-server/internal/utils"

	"gorm.io/gorm"
)

// Post 鍗氬鏂囩珷妯″瀷
type Post struct {
	ID          Int64String    `gorm:"primaryKey;autoIncrement:false" json:"id"`         // Snowflake ID
	Title       string         `gorm:"size:200;not null" json:"title"`                   // 鏂囩珷鏍囬
	Slug        string         `gorm:"size:200;uniqueIndex;not null" json:"slug"`        // URL 鍙嬪ソ鏍囪瘑
	PostType     string         `gorm:"size:20;default:'blog';index" json:"postType"`    // blog/image_text
	TemplateKey  string         `gorm:"size:64" json:"templateKey,omitempty"`             // 图文模板标识
	TemplateData string         `gorm:"type:text" json:"templateData,omitempty"`          // 图文模板数据(JSON)
	Content     string         `gorm:"type:text;not null" json:"content"`                // Markdown 鍐呭
	HTMLContent string         `gorm:"type:text" json:"htmlContent,omitempty"`           // 娓叉煋鍚庣殑 HTML锛堝彲閫夛紝缂撳瓨鐢級
	Excerpt     string         `gorm:"size:500" json:"excerpt"`                          // 鎽樿
	Cover       string         `gorm:"size:500" json:"cover,omitempty"`                  // 灏侀潰鍥?
	AuthorID    Int64String    `gorm:"index" json:"authorId"`                            // 浣滆€?ID
	CategoryID  Int64String    `gorm:"index" json:"categoryId"`                          // 鍒嗙被 ID
	Status      string         `gorm:"size:20;default:'draft';index" json:"status"`      // draft/published/archived
	ViewCount   int            `gorm:"default:0" json:"viewCount"`                       // 娴忚娆℃暟
	LikeCount   int            `gorm:"default:0" json:"likeCount"`                       // 鐐硅禐娆℃暟
	IsTop       bool           `gorm:"default:false" json:"isTop"`                       // 鏄惁缃《
	PublishedAt *time.Time     `json:"publishedAt,omitempty"`                            // 鍙戝竷鏃堕棿
	CreatedAt   time.Time      `json:"createdAt"`
	UpdatedAt   time.Time      `json:"updatedAt"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`

	// 鍏宠仈
	Author   *User          `gorm:"foreignKey:AuthorID" json:"author,omitempty"`
	Category *PostCategory  `gorm:"foreignKey:CategoryID" json:"category,omitempty"`
	Tags     []PostTag      `gorm:"many2many:post_tag_relations;" json:"tags,omitempty"`
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
	ID          Int64String    `gorm:"primaryKey;autoIncrement:false" json:"id"`    // Snowflake ID
	Name        string         `gorm:"size:50;uniqueIndex;not null" json:"name"`    // 鍒嗙被鍚嶇О
	Slug        string         `gorm:"size:50;uniqueIndex;not null" json:"slug"`    // URL 鏍囪瘑
	Description string         `gorm:"size:255" json:"description"`                 // 鍒嗙被鎻忚堪
	SortOrder   int            `gorm:"default:0" json:"sortOrder"`                  // 鎺掑簭
	PostCount   int            `gorm:"default:0" json:"postCount"`                  // 鏂囩珷鏁伴噺
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

// PostTag 鏂囩珷鏍囩妯″瀷
type PostTag struct {
	ID        Int64String    `gorm:"primaryKey;autoIncrement:false" json:"id"` // Snowflake ID
	Name      string         `gorm:"size:30;uniqueIndex;not null" json:"name"` // 鏍囩鍚嶇О
	Slug      string         `gorm:"size:30;uniqueIndex;not null" json:"slug"` // URL 鏍囪瘑
	PostCount int            `gorm:"default:0" json:"postCount"`               // 鏂囩珷鏁伴噺
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
