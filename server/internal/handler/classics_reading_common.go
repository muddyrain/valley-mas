package handler

import (
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"
	"valley-server/internal/model"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

const maxClassicsChapterIndex = 2147483647

type saveClassicsReadingReq struct {
	BookID       model.Int64String `json:"bookId"`
	EditionID    model.Int64String `json:"editionId"`
	ChapterIndex model.Int64String `json:"chapterIndex"`
	ChapterTitle string            `json:"chapterTitle"`
	SavedAt      model.Int64String `json:"savedAt"`
}

type classicsReadingPayload struct {
	BookID       int64
	BookIDStr    string
	EditionID    int64
	EditionIDStr string
	ChapterIndex int
	ChapterTitle string
	SavedAt      time.Time
}

func parseClassicsReadingPayload(c *gin.Context) (classicsReadingPayload, bool) {
	var req saveClassicsReadingReq
	if err := c.ShouldBindJSON(&req); err != nil {
		Error(c, http.StatusBadRequest, "参数错误")
		return classicsReadingPayload{}, false
	}

	bookID := int64(req.BookID)
	editionID := int64(req.EditionID)
	chapterIndex := int64(req.ChapterIndex)
	chapterTitle := strings.TrimSpace(req.ChapterTitle)

	if bookID <= 0 || editionID <= 0 {
		Error(c, http.StatusBadRequest, "bookId 或 editionId 不能为空")
		return classicsReadingPayload{}, false
	}
	if chapterIndex < 0 {
		Error(c, http.StatusBadRequest, "chapterIndex 不能小于 0")
		return classicsReadingPayload{}, false
	}
	if chapterIndex > maxClassicsChapterIndex {
		Error(c, http.StatusBadRequest, "chapterIndex 超出范围")
		return classicsReadingPayload{}, false
	}

	savedAt := time.Now()
	if req.SavedAt > 0 {
		savedAt = time.UnixMilli(int64(req.SavedAt))
	}

	return classicsReadingPayload{
		BookID:       bookID,
		BookIDStr:    strconv.FormatInt(bookID, 10),
		EditionID:    editionID,
		EditionIDStr: strconv.FormatInt(editionID, 10),
		ChapterIndex: int(chapterIndex),
		ChapterTitle: chapterTitle,
		SavedAt:      savedAt,
	}, true
}

func validateClassicsBookAndEdition(c *gin.Context, db *gorm.DB, bookID, editionID int64) bool {
	var bookExists int64
	if err := db.Table("classics_books").
		Where("id = ? AND deleted_at IS NULL AND is_published = ?", bookID, true).
		Count(&bookExists).Error; err != nil {
		Error(c, http.StatusInternalServerError, "查询书籍失败")
		return false
	}
	if bookExists == 0 {
		Error(c, http.StatusNotFound, "书籍不存在")
		return false
	}

	var editionExists int64
	if err := db.Table("classics_editions").
		Where("id = ? AND book_id = ?", editionID, bookID).
		Count(&editionExists).Error; err != nil {
		Error(c, http.StatusInternalServerError, "查询版本失败")
		return false
	}
	if editionExists == 0 {
		Error(c, http.StatusNotFound, "版本不存在")
		return false
	}

	return true
}

func upsertClassicsReadingRecord(db *gorm.DB, tableName string, userID model.Int64String, payload classicsReadingPayload) error {
	now := time.Now()
	updates := map[string]interface{}{
		"edition_id":    payload.EditionID,
		"chapter_index": payload.ChapterIndex,
		"chapter_title": payload.ChapterTitle,
		"saved_at":      payload.SavedAt,
		"updated_at":    now,
	}

	updateTx := db.Table(tableName).
		Where("user_id = ? AND book_id = ?", userID, payload.BookID).
		Updates(updates)
	if updateTx.Error != nil {
		return updateTx.Error
	}
	if updateTx.RowsAffected > 0 {
		return nil
	}

	insertData := map[string]interface{}{
		"user_id":       userID,
		"book_id":       payload.BookID,
		"edition_id":    payload.EditionID,
		"chapter_index": payload.ChapterIndex,
		"chapter_title": payload.ChapterTitle,
		"saved_at":      payload.SavedAt,
		"created_at":    now,
		"updated_at":    now,
	}
	if err := db.Table(tableName).Create(insertData).Error; err != nil {
		if errors.Is(err, gorm.ErrDuplicatedKey) || isLikelyUniqueConstraintError(err) {
			return db.Table(tableName).
				Where("user_id = ? AND book_id = ?", userID, payload.BookID).
				Updates(updates).Error
		}
		return err
	}
	return nil
}

func isLikelyUniqueConstraintError(err error) bool {
	if err == nil {
		return false
	}
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "duplicate key") ||
		strings.Contains(msg, "unique constraint") ||
		strings.Contains(msg, "unique failed")
}
