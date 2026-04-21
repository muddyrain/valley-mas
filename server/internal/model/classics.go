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

// ClassicsImportJob 阅读库导入任务（TXT 自动建书任务状态跟踪）
type ClassicsImportJob struct {
	ID               int64       `gorm:"primaryKey;autoIncrement" json:"id"`
	UserID           Int64String `gorm:"column:user_id;index:idx_classics_import_jobs_user_created,priority:1;not null" json:"userId"`
	Status           string      `gorm:"column:status;size:20;index;not null" json:"status"` // queued/processing/success/failed
	Stage            string      `gorm:"column:stage;size:200" json:"stage"`
	Progress         int         `gorm:"column:progress;default:0" json:"progress"`
	Attempt          int         `gorm:"column:attempt;default:1" json:"attempt"`
	SourceFileName   string      `gorm:"column:source_file_name;size:255" json:"sourceFileName"`
	PayloadJSON      string      `gorm:"column:payload_json;type:text;not null" json:"-"`
	ErrorMessage     string      `gorm:"column:error_message;type:text" json:"errorMessage,omitempty"`
	CreatedBookID    *int64      `gorm:"column:created_book_id" json:"createdBookId,omitempty"`
	CreatedEditionID *int64      `gorm:"column:created_edition_id" json:"createdEditionId,omitempty"`
	ImportedChapters int         `gorm:"column:imported_chapters;default:0" json:"importedChapters"`
	TotalWords       int         `gorm:"column:total_words;default:0" json:"totalWords"`
	StartedAt        *time.Time  `gorm:"column:started_at" json:"startedAt,omitempty"`
	FinishedAt       *time.Time  `gorm:"column:finished_at" json:"finishedAt,omitempty"`
	CreatedAt        time.Time   `gorm:"index:idx_classics_import_jobs_user_created,priority:2" json:"createdAt"`
	UpdatedAt        time.Time   `json:"updatedAt"`
}

func (ClassicsImportJob) TableName() string {
	return "classics_import_jobs"
}
