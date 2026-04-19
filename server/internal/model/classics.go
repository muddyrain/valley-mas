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
