package model

import "time"

// ClassicsChapter 名著章节（用于 AI handler 查询）
type ClassicsChapter struct {
	ID           int64     `gorm:"primaryKey;autoIncrement" json:"id"`
	BookID       int64     `gorm:"column:book_id;index" json:"bookId"`
	EditionID    int64     `gorm:"column:edition_id;index" json:"editionId"`
	Title        string    `gorm:"size:200;not null" json:"title"`
	Content      string    `gorm:"type:text" json:"content"`
	ChapterIndex int       `gorm:"column:chapter_index" json:"chapterIndex"`
	WordCount    int       `gorm:"column:word_count" json:"wordCount"`
	CreatedAt    time.Time `json:"createdAt"`
	UpdatedAt    time.Time `json:"updatedAt"`
}

func (ClassicsChapter) TableName() string {
	return "classics_chapters"
}

// ClassicsUserShelf 用户书架（用于登录态跨设备同步）
type ClassicsUserShelf struct {
	ID        int64       `gorm:"primaryKey;autoIncrement" json:"id"`
	UserID    Int64String `gorm:"column:user_id;index:idx_classics_user_shelves_user_updated,priority:1;not null" json:"userId"`
	BookID    int64       `gorm:"column:book_id;index;not null" json:"bookId"`
	CreatedAt time.Time   `json:"createdAt"`
	UpdatedAt time.Time   `json:"updatedAt"`
}

func (ClassicsUserShelf) TableName() string {
	return "classics_user_shelves"
}

// ClassicsUserProgress 用户阅读进度（用于登录态跨设备同步）
type ClassicsUserProgress struct {
	ID           int64       `gorm:"primaryKey;autoIncrement" json:"id"`
	UserID       Int64String `gorm:"column:user_id;index:idx_classics_user_progress_user_saved,priority:1;not null" json:"userId"`
	BookID       int64       `gorm:"column:book_id;index;not null" json:"bookId"`
	EditionID    int64       `gorm:"column:edition_id;not null" json:"editionId"`
	ChapterIndex int         `gorm:"column:chapter_index;not null" json:"chapterIndex"`
	ChapterTitle string      `gorm:"column:chapter_title;size:300" json:"chapterTitle,omitempty"`
	SavedAt      time.Time   `gorm:"column:saved_at;index:idx_classics_user_progress_user_saved,priority:2" json:"savedAt"`
	CreatedAt    time.Time   `json:"createdAt"`
	UpdatedAt    time.Time   `json:"updatedAt"`
}

func (ClassicsUserProgress) TableName() string {
	return "classics_user_progress"
}

// ClassicsUserRecent 用户最近阅读（用于登录态跨设备同步）
type ClassicsUserRecent struct {
	ID           int64       `gorm:"primaryKey;autoIncrement" json:"id"`
	UserID       Int64String `gorm:"column:user_id;index:idx_classics_user_recent_user_saved,priority:1;not null" json:"userId"`
	BookID       int64       `gorm:"column:book_id;index;not null" json:"bookId"`
	EditionID    int64       `gorm:"column:edition_id;not null" json:"editionId"`
	ChapterIndex int         `gorm:"column:chapter_index;not null" json:"chapterIndex"`
	ChapterTitle string      `gorm:"column:chapter_title;size:300" json:"chapterTitle,omitempty"`
	SavedAt      time.Time   `gorm:"column:saved_at;index:idx_classics_user_recent_user_saved,priority:2" json:"savedAt"`
	CreatedAt    time.Time   `json:"createdAt"`
	UpdatedAt    time.Time   `json:"updatedAt"`
}

func (ClassicsUserRecent) TableName() string {
	return "classics_user_recent"
}

// ClassicsUserAIExplored 用户 AI 探索记录（用于登录态跨设备同步）
type ClassicsUserAIExplored struct {
	ID           int64       `gorm:"primaryKey;autoIncrement" json:"id"`
	UserID       Int64String `gorm:"column:user_id;index:idx_classics_user_ai_explored_user_book_saved,priority:1;not null" json:"userId"`
	BookID       int64       `gorm:"column:book_id;index:idx_classics_user_ai_explored_user_book_saved,priority:2;not null" json:"bookId"`
	ChapterIndex int         `gorm:"column:chapter_index;index:idx_classics_user_ai_explored_user_book_saved,priority:3;not null" json:"chapterIndex"`
	SavedAt      time.Time   `gorm:"column:saved_at;index:idx_classics_user_ai_explored_user_book_saved,priority:4" json:"savedAt"`
	CreatedAt    time.Time   `json:"createdAt"`
	UpdatedAt    time.Time   `json:"updatedAt"`
}

func (ClassicsUserAIExplored) TableName() string {
	return "classics_user_ai_explored"
}
