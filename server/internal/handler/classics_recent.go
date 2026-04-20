package handler

import (
	"net/http"
	"strconv"
	"strings"
	"time"
	"valley-server/internal/database"
	"valley-server/internal/model"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm/clause"
)

type saveClassicsRecentReq struct {
	BookID       string `json:"bookId"`
	EditionID    string `json:"editionId"`
	ChapterIndex int    `json:"chapterIndex"`
	ChapterTitle string `json:"chapterTitle"`
	SavedAt      int64  `json:"savedAt"`
}

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
			CoverURL:     item.CoverURL,
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

	var req saveClassicsRecentReq
	if err := c.ShouldBindJSON(&req); err != nil {
		Error(c, http.StatusBadRequest, "参数错误")
		return
	}
	req.BookID = strings.TrimSpace(req.BookID)
	req.EditionID = strings.TrimSpace(req.EditionID)
	req.ChapterTitle = strings.TrimSpace(req.ChapterTitle)

	if req.BookID == "" || req.EditionID == "" {
		Error(c, http.StatusBadRequest, "bookId 或 editionId 不能为空")
		return
	}
	if req.ChapterIndex < 0 {
		Error(c, http.StatusBadRequest, "chapterIndex 不能小于 0")
		return
	}

	bookID, err := strconv.ParseInt(req.BookID, 10, 64)
	if err != nil || bookID <= 0 {
		Error(c, http.StatusBadRequest, "bookId 无效")
		return
	}
	editionID, err := strconv.ParseInt(req.EditionID, 10, 64)
	if err != nil || editionID <= 0 {
		Error(c, http.StatusBadRequest, "editionId 无效")
		return
	}

	var bookExists int64
	if err := db.Table("classics_books").
		Where("id = ? AND deleted_at IS NULL AND is_published = ?", bookID, true).
		Count(&bookExists).Error; err != nil {
		Error(c, http.StatusInternalServerError, "查询书籍失败")
		return
	}
	if bookExists == 0 {
		Error(c, http.StatusNotFound, "书籍不存在")
		return
	}

	var editionExists int64
	if err := db.Table("classics_editions").
		Where("id = ? AND book_id = ?", editionID, bookID).
		Count(&editionExists).Error; err != nil {
		Error(c, http.StatusInternalServerError, "查询版本失败")
		return
	}
	if editionExists == 0 {
		Error(c, http.StatusNotFound, "版本不存在")
		return
	}

	savedAt := time.Now()
	if req.SavedAt > 0 {
		savedAt = time.UnixMilli(req.SavedAt)
	}
	now := time.Now()
	item := model.ClassicsUserRecent{
		UserID:       userID,
		BookID:       bookID,
		EditionID:    editionID,
		ChapterIndex: req.ChapterIndex,
		ChapterTitle: req.ChapterTitle,
		SavedAt:      savedAt,
	}

	if err := db.Clauses(clause.OnConflict{
		Columns: []clause.Column{
			{Name: "user_id"},
			{Name: "book_id"},
		},
		DoUpdates: clause.Assignments(map[string]interface{}{
			"edition_id":    editionID,
			"chapter_index": req.ChapterIndex,
			"chapter_title": req.ChapterTitle,
			"saved_at":      savedAt,
			"updated_at":    now,
		}),
	}).Create(&item).Error; err != nil {
		Error(c, http.StatusInternalServerError, "保存最近阅读失败")
		return
	}

	Success(c, classicsRecentResp{
		BookID:       req.BookID,
		EditionID:    req.EditionID,
		ChapterIndex: req.ChapterIndex,
		ChapterTitle: req.ChapterTitle,
		SavedAt:      savedAt.UnixMilli(),
	})
}
