package handler

import (
	"net/http"
	"strconv"
	"strings"
	"time"
	"valley-server/internal/database"

	"github.com/gin-gonic/gin"
)

// ---- 请求体 ----

type AdminCreateBookReq struct {
	Title       string `json:"title" binding:"required"`
	Category    string `json:"category" binding:"required"`
	Dynasty     string `json:"dynasty"`
	Brief       string `json:"brief"`
	CoverURL    string `json:"coverUrl"`
	WordCount   int    `json:"wordCount"`
	IsPublished bool   `json:"isPublished"`
	// 作者名列表（已存在就复用，不存在就新建）
	AuthorNames []string `json:"authorNames"`
	// 首个版本
	EditionLabel string `json:"editionLabel" binding:"required"`
	Translator   string `json:"translator"`
	PublishYear  int    `json:"publishYear"`
}

type AdminUpdateBookReq struct {
	Title       *string `json:"title"`
	Category    *string `json:"category"`
	Dynasty     *string `json:"dynasty"`
	Brief       *string `json:"brief"`
	CoverURL    *string `json:"coverUrl"`
	WordCount   *int    `json:"wordCount"`
	IsPublished *bool   `json:"isPublished"`
}

type AdminCreateChaptersReq struct {
	// chapters[].title + chapters[].content 批量导入
	Chapters []struct {
		Title   string `json:"title" binding:"required"`
		Content string `json:"content"`
	} `json:"chapters" binding:"required"`
}

// ---- 辅助 ----

func getOrCreateAuthor(db interface{ Raw(sql string, values ...interface{}) interface{ Scan(dest interface{}) error } }, name, dynasty string) (int64, error) {
	// 用 database.DB 直接操作
	gdb := database.DB
	type Row struct {
		ID int64 `gorm:"column:id"`
	}
	var row Row
	name = strings.TrimSpace(name)
	if name == "" {
		return 0, nil
	}
	if err := gdb.Raw("SELECT id FROM classics_authors WHERE name = ? LIMIT 1", name).Scan(&row).Error; err == nil && row.ID > 0 {
		return row.ID, nil
	}
	type InsertRow struct {
		ID        int64     `gorm:"column:id;primaryKey;autoIncrement"`
		Name      string    `gorm:"column:name"`
		Dynasty   string    `gorm:"column:dynasty"`
		CreatedAt time.Time `gorm:"column:created_at"`
		UpdatedAt time.Time `gorm:"column:updated_at"`
	}
	now := time.Now()
	r := InsertRow{Name: name, Dynasty: dynasty, CreatedAt: now, UpdatedAt: now}
	if err := gdb.Table("classics_authors").Create(&r).Error; err != nil {
		return 0, err
	}
	return r.ID, nil
}

// ---- Admin: 书目列表（含未发布）----
// GET /admin/classics

func AdminGetClassicsList(c *gin.Context) {
	db := database.DB
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "20"))
	keyword := c.Query("keyword")
	category := c.Query("category")
	dynasty := c.Query("dynasty")
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	offset := (page - 1) * pageSize

	type BookRow struct {
		ID           int64  `gorm:"column:id"`
		Title        string `gorm:"column:title"`
		Category     string `gorm:"column:category"`
		Dynasty      string `gorm:"column:dynasty"`
		WordCount    int    `gorm:"column:word_count"`
		ChapterCount int    `gorm:"column:chapter_count"`
		IsPublished  bool   `gorm:"column:is_published"`
		CreatedAt    string `gorm:"column:created_at"`
	}

	q := db.Table("classics_books").Where("deleted_at IS NULL")
	if keyword != "" {
		q = q.Where("title LIKE ?", "%"+keyword+"%")
	}
	if category != "" {
		q = q.Where("category = ?", category)
	}
	if dynasty != "" {
		q = q.Where("dynasty = ?", dynasty)
	}

	var total int64
	q.Count(&total)

	var rows []BookRow
	q.Select("id, title, category, dynasty, word_count, chapter_count, is_published, created_at").
		Order("id DESC").Limit(pageSize).Offset(offset).Find(&rows)

	// 批量查作者
	bookIDs := make([]int64, 0, len(rows))
	for _, r := range rows {
		bookIDs = append(bookIDs, r.ID)
	}
	type AuthorRow struct {
		BookID int64  `gorm:"column:book_id"`
		Name   string `gorm:"column:name"`
	}
	var authorRows []AuthorRow
	if len(bookIDs) > 0 {
		db.Table("classics_book_authors ba").
			Joins("JOIN classics_authors a ON a.id = ba.author_id").
			Where("ba.book_id IN ?", bookIDs).
			Select("ba.book_id, a.name").
			Order("ba.sort_order").
			Find(&authorRows)
	}
	authorMap := map[int64][]string{}
	for _, a := range authorRows {
		authorMap[a.BookID] = append(authorMap[a.BookID], a.Name)
	}

	type Item struct {
		ID           int64    `json:"id"`
		Title        string   `json:"title"`
		Category     string   `json:"category"`
		Dynasty      string   `json:"dynasty"`
		AuthorNames  []string `json:"authorNames"`
		WordCount    int      `json:"wordCount"`
		ChapterCount int      `json:"chapterCount"`
		IsPublished  bool     `json:"isPublished"`
		CreatedAt    string   `json:"createdAt"`
	}
	list := make([]Item, 0, len(rows))
	for _, r := range rows {
		names := authorMap[r.ID]
		if names == nil {
			names = []string{}
		}
		list = append(list, Item{
			ID:           r.ID,
			Title:        r.Title,
			Category:     r.Category,
			Dynasty:      r.Dynasty,
			AuthorNames:  names,
			WordCount:    r.WordCount,
			ChapterCount: r.ChapterCount,
			IsPublished:  r.IsPublished,
			CreatedAt:    r.CreatedAt,
		})
	}
	Success(c, gin.H{"list": list, "total": total})
}

// ---- Admin: 新建书目 ----
// POST /admin/classics

func AdminCreateBook(c *gin.Context) {
	var req AdminCreateBookReq
	if err := c.ShouldBindJSON(&req); err != nil {
		Error(c, http.StatusBadRequest, err.Error())
		return
	}

	db := database.DB
	now := time.Now()

	// 1. 新建 book
	type Book struct {
		ID          int64     `gorm:"column:id;primaryKey;autoIncrement"`
		Title       string    `gorm:"column:title"`
		Category    string    `gorm:"column:category"`
		Dynasty     string    `gorm:"column:dynasty"`
		Brief       string    `gorm:"column:brief"`
		CoverURL    string    `gorm:"column:cover_url"`
		WordCount   int       `gorm:"column:word_count"`
		IsPublished bool      `gorm:"column:is_published"`
		CreatedAt   time.Time `gorm:"column:created_at"`
		UpdatedAt   time.Time `gorm:"column:updated_at"`
	}
	book := Book{
		Title:       strings.TrimSpace(req.Title),
		Category:    strings.TrimSpace(req.Category),
		Dynasty:     strings.TrimSpace(req.Dynasty),
		Brief:       strings.TrimSpace(req.Brief),
		CoverURL:    strings.TrimSpace(req.CoverURL),
		WordCount:   req.WordCount,
		IsPublished: req.IsPublished,
		CreatedAt:   now,
		UpdatedAt:   now,
	}
	if err := db.Table("classics_books").Create(&book).Error; err != nil {
		Error(c, http.StatusInternalServerError, "创建书目失败: "+err.Error())
		return
	}

	// 2. 作者绑定
	for i, name := range req.AuthorNames {
		authorID, err := getOrCreateAuthor(nil, name, req.Dynasty)
		if err != nil || authorID == 0 {
			continue
		}
		type BookAuthor struct {
			BookID    int64 `gorm:"column:book_id"`
			AuthorID  int64 `gorm:"column:author_id"`
			SortOrder int   `gorm:"column:sort_order"`
		}
		db.Table("classics_book_authors").Create(&BookAuthor{
			BookID:    book.ID,
			AuthorID:  authorID,
			SortOrder: i,
		})
	}

	// 3. 默认版本
	type Edition struct {
		ID          int64     `gorm:"column:id;primaryKey;autoIncrement"`
		BookID      int64     `gorm:"column:book_id"`
		Label       string    `gorm:"column:label"`
		Translator  string    `gorm:"column:translator"`
		PublishYear int       `gorm:"column:publish_year"`
		IsDefault   bool      `gorm:"column:is_default"`
		CreatedAt   time.Time `gorm:"column:created_at"`
		UpdatedAt   time.Time `gorm:"column:updated_at"`
	}
	edition := Edition{
		BookID:      book.ID,
		Label:       strings.TrimSpace(req.EditionLabel),
		Translator:  strings.TrimSpace(req.Translator),
		PublishYear: req.PublishYear,
		IsDefault:   true,
		CreatedAt:   now,
		UpdatedAt:   now,
	}
	db.Table("classics_editions").Create(&edition)

	Success(c, gin.H{"id": book.ID, "editionId": edition.ID})
}

// ---- Admin: 更新书目基本信息 ----
// PUT /admin/classics/:id

func AdminUpdateBook(c *gin.Context) {
	idStr := c.Param("id")
	bookID, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		Error(c, http.StatusBadRequest, "参数错误")
		return
	}

	var req AdminUpdateBookReq
	if err := c.ShouldBindJSON(&req); err != nil {
		Error(c, http.StatusBadRequest, err.Error())
		return
	}

	db := database.DB
	updates := map[string]interface{}{"updated_at": time.Now()}
	if req.Title != nil {
		updates["title"] = strings.TrimSpace(*req.Title)
	}
	if req.Category != nil {
		updates["category"] = strings.TrimSpace(*req.Category)
	}
	if req.Dynasty != nil {
		updates["dynasty"] = strings.TrimSpace(*req.Dynasty)
	}
	if req.Brief != nil {
		updates["brief"] = strings.TrimSpace(*req.Brief)
	}
	if req.CoverURL != nil {
		updates["cover_url"] = strings.TrimSpace(*req.CoverURL)
	}
	if req.WordCount != nil {
		updates["word_count"] = *req.WordCount
	}
	if req.IsPublished != nil {
		updates["is_published"] = *req.IsPublished
	}

	if err := db.Table("classics_books").
		Where("id = ? AND deleted_at IS NULL", bookID).
		Updates(updates).Error; err != nil {
		Error(c, http.StatusInternalServerError, "更新失败: "+err.Error())
		return
	}
	Success(c, nil)
}

// ---- Admin: 删除书目（软删除）----
// DELETE /admin/classics/:id

func AdminDeleteBook(c *gin.Context) {
	idStr := c.Param("id")
	bookID, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		Error(c, http.StatusBadRequest, "参数错误")
		return
	}

	db := database.DB
	now := time.Now()
	if err := db.Table("classics_books").
		Where("id = ? AND deleted_at IS NULL", bookID).
		Update("deleted_at", now).Error; err != nil {
		Error(c, http.StatusInternalServerError, "删除失败: "+err.Error())
		return
	}
	Success(c, nil)
}

// ---- Admin: 批量导入章节 ----
// POST /admin/classics/:id/editions/:editionId/chapters/import

func AdminImportChapters(c *gin.Context) {
	bookIDStr := c.Param("id")
	editionIDStr := c.Param("editionId")
	bookID, err1 := strconv.ParseInt(bookIDStr, 10, 64)
	editionID, err2 := strconv.ParseInt(editionIDStr, 10, 64)
	if err1 != nil || err2 != nil {
		Error(c, http.StatusBadRequest, "参数错误")
		return
	}

	var req AdminCreateChaptersReq
	if err := c.ShouldBindJSON(&req); err != nil {
		Error(c, http.StatusBadRequest, err.Error())
		return
	}
	if len(req.Chapters) == 0 {
		Error(c, http.StatusBadRequest, "章节列表不能为空")
		return
	}

	db := database.DB
	now := time.Now()

	type Chapter struct {
		ID           int64     `gorm:"column:id;primaryKey;autoIncrement"`
		BookID       int64     `gorm:"column:book_id"`
		EditionID    int64     `gorm:"column:edition_id"`
		ChapterIndex int       `gorm:"column:chapter_index"`
		Title        string    `gorm:"column:title"`
		Content      string    `gorm:"column:content"`
		WordCount    int       `gorm:"column:word_count"`
		CreatedAt    time.Time `gorm:"column:created_at"`
		UpdatedAt    time.Time `gorm:"column:updated_at"`
	}

	// 先删除已有章节（允许重复导入覆盖）
	db.Table("classics_chapters").
		Where("book_id = ? AND edition_id = ?", bookID, editionID).
		Delete(nil)

	chapters := make([]Chapter, 0, len(req.Chapters))
	totalWords := 0
	for i, ch := range req.Chapters {
		content := strings.TrimSpace(ch.Content)
		wc := len([]rune(content))
		totalWords += wc
		chapters = append(chapters, Chapter{
			BookID:       bookID,
			EditionID:    editionID,
			ChapterIndex: i,
			Title:        strings.TrimSpace(ch.Title),
			Content:      content,
			WordCount:    wc,
			CreatedAt:    now,
			UpdatedAt:    now,
		})
	}

	if err := db.Table("classics_chapters").CreateInBatches(chapters, 50).Error; err != nil {
		Error(c, http.StatusInternalServerError, "章节导入失败: "+err.Error())
		return
	}

	// 更新 chapter_count 和 word_count
	db.Table("classics_books").
		Where("id = ?", bookID).
		Updates(map[string]interface{}{
			"chapter_count": len(chapters),
			"word_count":    totalWords,
			"updated_at":    now,
		})

	Success(c, gin.H{"imported": len(chapters), "totalWords": totalWords})
}
