package handler

import (
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"
	"valley-server/internal/database"
	"valley-server/internal/model"

	"github.com/gin-gonic/gin"
)

type classicsProgressResp struct {
	BookID       string `json:"bookId"`
	EditionID    string `json:"editionId"`
	ChapterIndex int    `json:"chapterIndex"`
	ChapterTitle string `json:"chapterTitle,omitempty"`
	SavedAt      int64  `json:"savedAt"`
}

func parseBookIDs(bookIDRaw, bookIDsRaw string) ([]int64, error) {
	parseOne := func(raw string) (int64, error) {
		id, err := strconv.ParseInt(strings.TrimSpace(raw), 10, 64)
		if err != nil {
			return 0, err
		}
		if id <= 0 {
			return 0, errors.New("bookId must be positive")
		}
		return id, nil
	}

	if strings.TrimSpace(bookIDRaw) != "" {
		id, err := parseOne(bookIDRaw)
		if err != nil {
			return nil, err
		}
		return []int64{id}, nil
	}

	rawList := strings.TrimSpace(bookIDsRaw)
	if rawList == "" {
		return nil, nil
	}

	parts := strings.Split(rawList, ",")
	result := make([]int64, 0, len(parts))
	seen := make(map[int64]struct{}, len(parts))
	for _, part := range parts {
		if strings.TrimSpace(part) == "" {
			continue
		}
		id, err := parseOne(part)
		if err != nil {
			return nil, err
		}
		if _, ok := seen[id]; ok {
			continue
		}
		seen[id] = struct{}{}
		result = append(result, id)
	}
	return result, nil
}

// GetMyClassicsProgress 获取当前用户阅读进度（支持按 bookId/bookIds 过滤）
func GetMyClassicsProgress(c *gin.Context) {
	db := database.DB
	userID := model.Int64String(GetCurrentUserID(c))
	if userID == 0 {
		Error(c, http.StatusUnauthorized, "未登录")
		return
	}

	bookIDs, err := parseBookIDs(c.Query("bookId"), c.Query("bookIds"))
	if err != nil {
		Error(c, http.StatusBadRequest, "bookId 参数错误")
		return
	}

	type row struct {
		BookID       int64     `gorm:"column:book_id"`
		EditionID    int64     `gorm:"column:edition_id"`
		ChapterIndex int       `gorm:"column:chapter_index"`
		ChapterTitle string    `gorm:"column:chapter_title"`
		SavedAt      time.Time `gorm:"column:saved_at"`
	}

	query := db.Table("classics_user_progress p").
		Joins("JOIN classics_books b ON b.id = p.book_id").
		Where("p.user_id = ? AND b.deleted_at IS NULL AND b.is_published = ?", userID, true)
	if len(bookIDs) > 0 {
		query = query.Where("p.book_id IN ?", bookIDs)
	}

	var rows []row
	if err := query.
		Select("p.book_id, p.edition_id, p.chapter_index, p.chapter_title, p.saved_at").
		Order("p.saved_at DESC, p.id DESC").
		Find(&rows).Error; err != nil {
		Error(c, http.StatusInternalServerError, "获取阅读进度失败")
		return
	}

	list := make([]classicsProgressResp, 0, len(rows))
	for _, item := range rows {
		list = append(list, classicsProgressResp{
			BookID:       strconv.FormatInt(item.BookID, 10),
			EditionID:    strconv.FormatInt(item.EditionID, 10),
			ChapterIndex: item.ChapterIndex,
			ChapterTitle: item.ChapterTitle,
			SavedAt:      item.SavedAt.UnixMilli(),
		})
	}

	Success(c, gin.H{"list": list})
}

// SaveMyClassicsProgress 保存当前用户阅读进度
func SaveMyClassicsProgress(c *gin.Context) {
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

	if err := upsertClassicsReadingRecord(db, "classics_user_progress", userID, payload); err != nil {
		Error(c, http.StatusInternalServerError, "保存阅读进度失败")
		return
	}

	Success(c, classicsProgressResp{
		BookID:       payload.BookIDStr,
		EditionID:    payload.EditionIDStr,
		ChapterIndex: payload.ChapterIndex,
		ChapterTitle: payload.ChapterTitle,
		SavedAt:      payload.SavedAt.UnixMilli(),
	})
}
