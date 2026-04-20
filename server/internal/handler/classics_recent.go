package handler

import (
	"net/http"
	"strconv"
	"strings"
	"time"
	"valley-server/internal/database"
	"valley-server/internal/model"

	"github.com/gin-gonic/gin"
)

type classicsRecentResp struct {
	BookID       string `json:"bookId"`
	Title        string `json:"title"`
	CoverURL     string `json:"coverUrl,omitempty"`
	AuthorNames  string `json:"authorNames"`
	Dynasty      string `json:"dynasty,omitempty"`
	EditionID    string `json:"editionId"`
	ChapterIndex int    `json:"chapterIndex"`
	ChapterTitle string `json:"chapterTitle,omitempty"`
	SavedAt      int64  `json:"savedAt"`
}

// GetMyClassicsRecent 获取当前用户最近阅读列表（按 savedAt 倒序）
func GetMyClassicsRecent(c *gin.Context) {
	db := database.DB
	userID := model.Int64String(GetCurrentUserID(c))
	if userID == 0 {
		Error(c, http.StatusUnauthorized, "未登录")
		return
	}

	limit := GetIntQuery(c, "limit", 10)
	if limit < 1 {
		limit = 10
	}
	if limit > 50 {
		limit = 50
	}

	type row struct {
		BookID       int64     `gorm:"column:book_id"`
		EditionID    int64     `gorm:"column:edition_id"`
		ChapterIndex int       `gorm:"column:chapter_index"`
		ChapterTitle string    `gorm:"column:chapter_title"`
		SavedAt      time.Time `gorm:"column:saved_at"`
		Title        string    `gorm:"column:title"`
		CoverURL     string    `gorm:"column:cover_url"`
		Dynasty      string    `gorm:"column:dynasty"`
	}
	var rows []row
	if err := db.Table("classics_user_recent r").
		Joins("JOIN classics_books b ON b.id = r.book_id").
		Where("r.user_id = ? AND b.deleted_at IS NULL AND b.is_published = ?", userID, true).
		Select("r.book_id, r.edition_id, r.chapter_index, r.chapter_title, r.saved_at, b.title, b.cover_url, b.dynasty").
		Order("r.saved_at DESC, r.id DESC").
		Limit(limit).
		Find(&rows).Error; err != nil {
		Error(c, http.StatusInternalServerError, "获取最近阅读失败")
		return
	}

	bookIDs := make([]int64, 0, len(rows))
	for _, item := range rows {
		bookIDs = append(bookIDs, item.BookID)
	}

	type authorRow struct {
		BookID int64  `gorm:"column:book_id"`
		Name   string `gorm:"column:name"`
	}
	var authorRows []authorRow
	if len(bookIDs) > 0 {
		db.Table("classics_book_authors ba").
			Joins("JOIN classics_authors a ON a.id = ba.author_id").
			Where("ba.book_id IN ?", bookIDs).
			Select("ba.book_id, a.name").
			Order("ba.sort_order ASC").
			Find(&authorRows)
	}
	authorMap := map[int64][]string{}
	for _, item := range authorRows {
		authorMap[item.BookID] = append(authorMap[item.BookID], item.Name)
	}

	list := make([]classicsRecentResp, 0, len(rows))
	for _, item := range rows {
		list = append(list, classicsRecentResp{
			BookID:       strconv.FormatInt(item.BookID, 10),
			Title:        item.Title,
			CoverURL:     resolveClassicsCoverURL(item.CoverURL, item.Title, "", item.Dynasty),
			AuthorNames:  strings.Join(authorMap[item.BookID], "、"),
			Dynasty:      item.Dynasty,
			EditionID:    strconv.FormatInt(item.EditionID, 10),
			ChapterIndex: item.ChapterIndex,
			ChapterTitle: item.ChapterTitle,
			SavedAt:      item.SavedAt.UnixMilli(),
		})
	}

	Success(c, gin.H{"list": list})
}

// SaveMyClassicsRecent 保存当前用户最近阅读
func SaveMyClassicsRecent(c *gin.Context) {
	db := database.DB
	userID := model.Int64String(GetCurrentUserID(c))
	if userID == 0 {
		Error(c, http.StatusUnauthorized, "未登录")
		return
	}

	payload, ok := parseClassicsReadingPayload(c)
	if !ok {
		return
	}

	if !validateClassicsBookAndEdition(c, db, payload.BookID, payload.EditionID) {
		return
	}

	if err := upsertClassicsReadingRecord(db, "classics_user_recent", userID, payload); err != nil {
		Error(c, http.StatusInternalServerError, "保存最近阅读失败")
		return
	}

	Success(c, classicsRecentResp{
		BookID:       payload.BookIDStr,
		EditionID:    payload.EditionIDStr,
		ChapterIndex: payload.ChapterIndex,
		ChapterTitle: payload.ChapterTitle,
		SavedAt:      payload.SavedAt.UnixMilli(),
	})
}
