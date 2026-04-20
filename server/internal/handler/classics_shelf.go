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

type addClassicsShelfReq struct {
	BookID string `json:"bookId"`
}

// GetMyClassicsShelf 获取当前用户书架书目 ID 列表（按最近更新倒序）
func GetMyClassicsShelf(c *gin.Context) {
	db := database.DB
	userID := model.Int64String(GetCurrentUserID(c))
	if userID == 0 {
		Error(c, http.StatusUnauthorized, "未登录")
		return
	}

	type shelfRow struct {
		BookID int64 `gorm:"column:book_id"`
	}
	var rows []shelfRow
	if err := db.Table("classics_user_shelves us").
		Joins("JOIN classics_books b ON b.id = us.book_id").
		Where("us.user_id = ? AND b.deleted_at IS NULL AND b.is_published = ?", userID, true).
		Select("us.book_id").
		Order("us.updated_at DESC, us.id DESC").
		Find(&rows).Error; err != nil {
		Error(c, http.StatusInternalServerError, "获取书架失败")
		return
	}

	bookIDs := make([]string, 0, len(rows))
	for _, row := range rows {
		bookIDs = append(bookIDs, strconv.FormatInt(row.BookID, 10))
	}

	Success(c, gin.H{"bookIds": bookIDs})
}

// AddMyClassicsShelf 添加书到当前用户书架（已存在则更新时间）
func AddMyClassicsShelf(c *gin.Context) {
	db := database.DB
	userID := model.Int64String(GetCurrentUserID(c))
	if userID == 0 {
		Error(c, http.StatusUnauthorized, "未登录")
		return
	}

	var req addClassicsShelfReq
	if err := c.ShouldBindJSON(&req); err != nil {
		Error(c, http.StatusBadRequest, "参数错误")
		return
	}

	req.BookID = strings.TrimSpace(req.BookID)
	if req.BookID == "" {
		Error(c, http.StatusBadRequest, "bookId 不能为空")
		return
	}
	bookID, err := strconv.ParseInt(req.BookID, 10, 64)
	if err != nil || bookID <= 0 {
		Error(c, http.StatusBadRequest, "bookId 无效")
		return
	}

	var exists int64
	if err := db.Table("classics_books").
		Where("id = ? AND deleted_at IS NULL AND is_published = ?", bookID, true).
		Count(&exists).Error; err != nil {
		Error(c, http.StatusInternalServerError, "查询书籍失败")
		return
	}
	if exists == 0 {
		Error(c, http.StatusNotFound, "书籍不存在")
		return
	}

	now := time.Now()
	item := model.ClassicsUserShelf{
		UserID: userID,
		BookID: bookID,
	}
	if err := db.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "user_id"}, {Name: "book_id"}},
		DoUpdates: clause.Assignments(map[string]interface{}{"updated_at": now}),
	}).Create(&item).Error; err != nil {
		Error(c, http.StatusInternalServerError, "加入书架失败")
		return
	}

	Success(c, gin.H{"bookId": req.BookID})
}

// RemoveMyClassicsShelf 从当前用户书架移除书籍
func RemoveMyClassicsShelf(c *gin.Context) {
	db := database.DB
	userID := model.Int64String(GetCurrentUserID(c))
	if userID == 0 {
		Error(c, http.StatusUnauthorized, "未登录")
		return
	}

	bookIDStr := strings.TrimSpace(c.Param("bookId"))
	if bookIDStr == "" {
		Error(c, http.StatusBadRequest, "bookId 不能为空")
		return
	}
	bookID, err := strconv.ParseInt(bookIDStr, 10, 64)
	if err != nil || bookID <= 0 {
		Error(c, http.StatusBadRequest, "bookId 无效")
		return
	}

	if err := db.Where("user_id = ? AND book_id = ?", userID, bookID).
		Delete(&model.ClassicsUserShelf{}).Error; err != nil {
		Error(c, http.StatusInternalServerError, "移除书架失败")
		return
	}

	Success(c, gin.H{"bookId": bookIDStr})
}
