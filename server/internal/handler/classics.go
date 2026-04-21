package handler

import (
	"net/http"
	"strconv"
	"valley-server/internal/database"

	"github.com/gin-gonic/gin"
)

// ---- 响应结构 ----

type ClassicsAuthorResp struct {
	ID      int64  `json:"id"`
	Name    string `json:"name"`
	Dynasty string `json:"dynasty,omitempty"`
	Brief   string `json:"brief,omitempty"`
}

type ClassicsEditionResp struct {
	ID          int64  `json:"id"`
	Label       string `json:"label"`
	Translator  string `json:"translator,omitempty"`
	PublishYear int    `json:"publishYear,omitempty"`
	IsDefault   bool   `json:"isDefault"`
}

type ClassicsBookResp struct {
	ID           int64                 `json:"id"`
	Title        string                `json:"title"`
	CoverURL     string                `json:"coverUrl,omitempty"`
	Category     string                `json:"category"`
	Dynasty      string                `json:"dynasty,omitempty"`
	Brief        string                `json:"brief,omitempty"`
	WordCount    int                   `json:"wordCount,omitempty"`
	ChapterCount int                   `json:"chapterCount,omitempty"`
	Authors      []ClassicsAuthorResp  `json:"authors"`
	Editions     []ClassicsEditionResp `json:"editions"`
	CreatedAt    string                `json:"createdAt"`
}

type ClassicsChapterResp struct {
	Index     int    `json:"index"`
	Title     string `json:"title"`
	Content   string `json:"content,omitempty"`
	WordCount int    `json:"wordCount,omitempty"`
}

// ---- 列表 ----

// GetClassicsList 名著列表
func GetClassicsList(c *gin.Context) {
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
		CoverURL     string `gorm:"column:cover_url"`
		Category     string `gorm:"column:category"`
		Dynasty      string `gorm:"column:dynasty"`
		Brief        string `gorm:"column:brief"`
		WordCount    int    `gorm:"column:word_count"`
		ChapterCount int    `gorm:"column:chapter_count"`
		CreatedAt    string `gorm:"column:created_at"`
	}

	query := db.Table("classics_books").
		Where("deleted_at IS NULL AND is_published = ?", true)
	if keyword != "" {
		query = query.Where("title LIKE ?", "%"+keyword+"%")
	}
	if category != "" {
		query = query.Where("category = ?", category)
	}
	if dynasty != "" {
		query = query.Where("dynasty = ?", dynasty)
	}

	var total int64
	query.Count(&total)

	var rows []BookRow
	query.Select("id, title, cover_url, category, dynasty, brief, word_count, chapter_count, created_at").
		Order("CASE WHEN category = '现代文学' THEN 0 WHEN category = '外国文学' THEN 1 WHEN dynasty = '近现代' THEN 2 WHEN dynasty = '外国' THEN 3 ELSE 4 END ASC, id DESC").
		Limit(pageSize).Offset(offset).
		Find(&rows)

	// 批量查作者和默认版本
	bookIDs := make([]int64, 0, len(rows))
	for _, r := range rows {
		bookIDs = append(bookIDs, r.ID)
	}

	type AuthorRow struct {
		BookID   int64  `gorm:"column:book_id"`
		AuthorID int64  `gorm:"column:author_id"`
		Name     string `gorm:"column:name"`
		Dynasty  string `gorm:"column:dynasty"`
	}
	var authorRows []AuthorRow
	if len(bookIDs) > 0 {
		db.Table("classics_book_authors ba").
			Joins("JOIN classics_authors a ON a.id = ba.author_id").
			Where("ba.book_id IN ?", bookIDs).
			Select("ba.book_id, ba.author_id, a.name, a.dynasty").
			Order("ba.sort_order").
			Find(&authorRows)
	}
	authorMap := map[int64][]ClassicsAuthorResp{}
	for _, a := range authorRows {
		authorMap[a.BookID] = append(authorMap[a.BookID], ClassicsAuthorResp{
			ID:      a.AuthorID,
			Name:    a.Name,
			Dynasty: a.Dynasty,
		})
	}

	type EditionRow struct {
		ID          int64  `gorm:"column:id"`
		BookID      int64  `gorm:"column:book_id"`
		Label       string `gorm:"column:label"`
		Translator  string `gorm:"column:translator"`
		PublishYear int    `gorm:"column:publish_year"`
		IsDefault   bool   `gorm:"column:is_default"`
	}
	var editionRows []EditionRow
	if len(bookIDs) > 0 {
		db.Table("classics_editions").
			Where("book_id IN ?", bookIDs).
			Select("id, book_id, label, translator, publish_year, is_default").
			Order("book_id ASC, is_default DESC, id ASC").
			Find(&editionRows)
	}
	editionMap := map[int64][]ClassicsEditionResp{}
	for _, e := range editionRows {
		editionMap[e.BookID] = append(editionMap[e.BookID], ClassicsEditionResp{
			ID:          e.ID,
			Label:       e.Label,
			Translator:  e.Translator,
			PublishYear: e.PublishYear,
			IsDefault:   e.IsDefault,
		})
	}

	list := make([]ClassicsBookResp, 0, len(rows))
	for _, r := range rows {
		authors := authorMap[r.ID]
		if authors == nil {
			authors = []ClassicsAuthorResp{}
		}
		editions := editionMap[r.ID]
		if editions == nil {
			editions = []ClassicsEditionResp{}
		}
		list = append(list, ClassicsBookResp{
			ID:           r.ID,
			Title:        r.Title,
			CoverURL:     resolveClassicsCoverURL(r.CoverURL, r.Title, r.Category, r.Dynasty),
			Category:     r.Category,
			Dynasty:      r.Dynasty,
			Brief:        r.Brief,
			WordCount:    r.WordCount,
			ChapterCount: r.ChapterCount,
			Authors:      authors,
			Editions:     editions,
			CreatedAt:    r.CreatedAt,
		})
	}

	Success(c, gin.H{
		"list":  list,
		"total": total,
	})
}

// ---- 详情 ----

// GetClassicsDetail 名著详情（含所有版本）
func GetClassicsDetail(c *gin.Context) {
	db := database.DB
	idStr := c.Param("id")
	bookID, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		Error(c, http.StatusBadRequest, "参数错误")
		return
	}

	type BookRow struct {
		ID           int64  `gorm:"column:id"`
		Title        string `gorm:"column:title"`
		CoverURL     string `gorm:"column:cover_url"`
		Category     string `gorm:"column:category"`
		Dynasty      string `gorm:"column:dynasty"`
		Brief        string `gorm:"column:brief"`
		WordCount    int    `gorm:"column:word_count"`
		ChapterCount int    `gorm:"column:chapter_count"`
		IsPublished  bool   `gorm:"column:is_published"`
		CreatedAt    string `gorm:"column:created_at"`
	}
	var book BookRow
	if err := db.Table("classics_books").
		Where("id = ? AND deleted_at IS NULL AND is_published = ?", bookID, true).
		Select("id, title, cover_url, category, dynasty, brief, word_count, chapter_count, is_published, created_at").
		First(&book).Error; err != nil {
		Error(c, http.StatusNotFound, "未找到该名著")
		return
	}

	type AuthorRow struct {
		AuthorID int64  `gorm:"column:author_id"`
		Name     string `gorm:"column:name"`
		Dynasty  string `gorm:"column:dynasty"`
		Brief    string `gorm:"column:brief"`
	}
	var authorRows []AuthorRow
	db.Table("classics_book_authors ba").
		Joins("JOIN classics_authors a ON a.id = ba.author_id").
		Where("ba.book_id = ?", bookID).
		Select("ba.author_id, a.name, a.dynasty, a.brief").
		Order("ba.sort_order").
		Find(&authorRows)

	authors := make([]ClassicsAuthorResp, 0, len(authorRows))
	for _, a := range authorRows {
		authors = append(authors, ClassicsAuthorResp{
			ID:      a.AuthorID,
			Name:    a.Name,
			Dynasty: a.Dynasty,
			Brief:   a.Brief,
		})
	}

	type EditionRow struct {
		ID          int64  `gorm:"column:id"`
		Label       string `gorm:"column:label"`
		Translator  string `gorm:"column:translator"`
		PublishYear int    `gorm:"column:publish_year"`
		IsDefault   bool   `gorm:"column:is_default"`
	}
	var editionRows []EditionRow
	db.Table("classics_editions").
		Where("book_id = ?", bookID).
		Select("id, label, translator, publish_year, is_default").
		Order("is_default DESC, id ASC").
		Find(&editionRows)

	editions := make([]ClassicsEditionResp, 0, len(editionRows))
	for _, e := range editionRows {
		editions = append(editions, ClassicsEditionResp{
			ID:          e.ID,
			Label:       e.Label,
			Translator:  e.Translator,
			PublishYear: e.PublishYear,
			IsDefault:   e.IsDefault,
		})
	}

	Success(c, ClassicsBookResp{
		ID:           book.ID,
		Title:        book.Title,
		CoverURL:     resolveClassicsCoverURL(book.CoverURL, book.Title, book.Category, book.Dynasty),
		Category:     book.Category,
		Dynasty:      book.Dynasty,
		Brief:        book.Brief,
		WordCount:    book.WordCount,
		ChapterCount: book.ChapterCount,
		Authors:      authors,
		Editions:     editions,
		CreatedAt:    book.CreatedAt,
	})
}

// ---- 章节列表 ----

// GetClassicsChapters 获取某版本的章节列表（不含正文）
func GetClassicsChapters(c *gin.Context) {
	db := database.DB
	bookIDStr := c.Param("id")
	editionIDStr := c.Param("editionId")

	bookID, err1 := strconv.ParseInt(bookIDStr, 10, 64)
	editionID, err2 := strconv.ParseInt(editionIDStr, 10, 64)
	if err1 != nil || err2 != nil {
		Error(c, http.StatusBadRequest, "参数错误")
		return
	}

	type ChapterRow struct {
		ChapterIndex int    `gorm:"column:chapter_index"`
		Title        string `gorm:"column:title"`
		WordCount    int    `gorm:"column:word_count"`
	}
	var rows []ChapterRow
	db.Table("classics_chapters").
		Where("book_id = ? AND edition_id = ?", bookID, editionID).
		Select("chapter_index, title, word_count").
		Order("chapter_index ASC").
		Find(&rows)

	chapters := make([]ClassicsChapterResp, 0, len(rows))
	for _, r := range rows {
		chapters = append(chapters, ClassicsChapterResp{
			Index:     r.ChapterIndex,
			Title:     r.Title,
			WordCount: r.WordCount,
		})
	}
	Success(c, chapters)
}

// ---- 单章正文 ----

// GetClassicsChapter 获取单章正文
func GetClassicsChapter(c *gin.Context) {
	db := database.DB
	bookIDStr := c.Param("id")
	editionIDStr := c.Param("editionId")
	indexStr := c.Param("index")

	bookID, err1 := strconv.ParseInt(bookIDStr, 10, 64)
	editionID, err2 := strconv.ParseInt(editionIDStr, 10, 64)
	chapterIndex, err3 := strconv.Atoi(indexStr)
	if err1 != nil || err2 != nil || err3 != nil {
		Error(c, http.StatusBadRequest, "参数错误")
		return
	}

	type ChapterRow struct {
		ChapterIndex int    `gorm:"column:chapter_index"`
		Title        string `gorm:"column:title"`
		Content      string `gorm:"column:content"`
		WordCount    int    `gorm:"column:word_count"`
	}
	var row ChapterRow
	if err := db.Table("classics_chapters").
		Where("book_id = ? AND edition_id = ? AND chapter_index = ?", bookID, editionID, chapterIndex).
		Select("chapter_index, title, content, word_count").
		First(&row).Error; err != nil {
		Error(c, http.StatusNotFound, "章节不存在")
		return
	}

	Success(c, ClassicsChapterResp{
		Index:     row.ChapterIndex,
		Title:     row.Title,
		Content:   row.Content,
		WordCount: row.WordCount,
	})
}
