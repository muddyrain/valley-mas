package handler

import (
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"
	"valley-server/internal/database"
	"valley-server/internal/model"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm/clause"
)

type saveClassicsAIExploredReq struct {
	BookID       string `json:"bookId"`
	ChapterIndex int    `json:"chapterIndex"`
	SavedAt      int64  `json:"savedAt"`
}

type classicsAIExploredResp struct {
	BookID         string `json:"bookId"`
	ChapterIndexes []int  `json:"chapterIndexes"`
}

// GetMyClassicsAIExplored 获取当前用户 AI 探索记录（支持按 bookId/bookIds 过滤）
func GetMyClassicsAIExplored(c *gin.Context) {
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
		BookID       int64 `gorm:"column:book_id"`
		ChapterIndex int   `gorm:"column:chapter_index"`
	}
	query := db.Table("classics_user_ai_explored ae").
		Joins("JOIN classics_books b ON b.id = ae.book_id").
		Where("ae.user_id = ? AND b.deleted_at IS NULL AND b.is_published = ?", userID, true)
	if len(bookIDs) > 0 {
		query = query.Where("ae.book_id IN ?", bookIDs)
	}

	var rows []row
	if err := query.
		Select("ae.book_id, ae.chapter_index").
		Order("ae.book_id ASC, ae.chapter_index ASC").
		Find(&rows).Error; err != nil {
		Error(c, http.StatusInternalServerError, "获取 AI 探索记录失败")
		return
	}

	bookChapterMap := make(map[int64][]int)
	for _, item := range rows {
		bookChapterMap[item.BookID] = append(bookChapterMap[item.BookID], item.ChapterIndex)
	}

	orderedBookIDs := make([]int64, 0, len(bookChapterMap))
	for bookID := range bookChapterMap {
		orderedBookIDs = append(orderedBookIDs, bookID)
	}
	sort.Slice(orderedBookIDs, func(i, j int) bool {
		return orderedBookIDs[i] < orderedBookIDs[j]
	})

	list := make([]classicsAIExploredResp, 0, len(orderedBookIDs))
	for _, bookID := range orderedBookIDs {
		chapterIndexes := bookChapterMap[bookID]
		list = append(list, classicsAIExploredResp{
			BookID:         strconv.FormatInt(bookID, 10),
			ChapterIndexes: chapterIndexes,
		})
	}

	Success(c, gin.H{"list": list})
}

// SaveMyClassicsAIExplored 保存当前用户 AI 探索记录
func SaveMyClassicsAIExplored(c *gin.Context) {
	db := database.DB
	userID := model.Int64String(GetCurrentUserID(c))
	if userID == 0 {
		Error(c, http.StatusUnauthorized, "未登录")
		return
	}

	var req saveClassicsAIExploredReq
	if err := c.ShouldBindJSON(&req); err != nil {
		Error(c, http.StatusBadRequest, "参数错误")
		return
	}
	req.BookID = strings.TrimSpace(req.BookID)
	if req.BookID == "" {
		Error(c, http.StatusBadRequest, "bookId 不能为空")
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

	savedAt := time.Now()
	if req.SavedAt > 0 {
		savedAt = time.UnixMilli(req.SavedAt)
	}
	now := time.Now()
	item := model.ClassicsUserAIExplored{
		UserID:       userID,
		BookID:       bookID,
		ChapterIndex: req.ChapterIndex,
		SavedAt:      savedAt,
	}
	if err := db.Clauses(clause.OnConflict{
		Columns: []clause.Column{
			{Name: "user_id"},
			{Name: "book_id"},
			{Name: "chapter_index"},
		},
		DoUpdates: clause.Assignments(map[string]interface{}{
			"saved_at":   savedAt,
			"updated_at": now,
		}),
	}).Create(&item).Error; err != nil {
		Error(c, http.StatusInternalServerError, "保存 AI 探索记录失败")
		return
	}

	Success(c, gin.H{
		"bookId":       req.BookID,
		"chapterIndex": req.ChapterIndex,
		"savedAt":      savedAt.UnixMilli(),
	})
}
