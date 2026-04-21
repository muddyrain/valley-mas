package handler

import (
	"encoding/json"
	"fmt"
	"net/http"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"
	"valley-server/internal/database"
	"valley-server/internal/model"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

const (
	classicsImportJobQueued     = "queued"
	classicsImportJobProcessing = "processing"
	classicsImportJobSuccess    = "success"
	classicsImportJobFailed     = "failed"

	maxImportTXTChars = 2_000_000
)

var classicsTXTChapterHeadingRE = regexp.MustCompile(
	`(?i)^(第[\d零〇一二三四五六七八九十百千万两]+[回章节卷部篇].*|chapter\s+[\divxlcdm]+.*)$`,
)
var classicsCollapseBlankLineRE = regexp.MustCompile(`\n{3,}`)

type AdminCreateClassicsImportJobReq struct {
	Title          string   `json:"title"`
	Category       string   `json:"category"`
	Dynasty        string   `json:"dynasty"`
	Brief          string   `json:"brief"`
	CoverURL       string   `json:"coverUrl"`
	IsPublished    bool     `json:"isPublished"`
	AuthorNames    []string `json:"authorNames"`
	EditionLabel   string   `json:"editionLabel"`
	Translator     string   `json:"translator"`
	PublishYear    int      `json:"publishYear"`
	SourceFileName string   `json:"sourceFileName"`
	TXTContent     string   `json:"txtContent" binding:"required"`
}

type adminClassicsImportJobPayload struct {
	Title          string   `json:"title"`
	Category       string   `json:"category"`
	Dynasty        string   `json:"dynasty"`
	Brief          string   `json:"brief"`
	CoverURL       string   `json:"coverUrl"`
	IsPublished    bool     `json:"isPublished"`
	AuthorNames    []string `json:"authorNames"`
	EditionLabel   string   `json:"editionLabel"`
	Translator     string   `json:"translator"`
	PublishYear    int      `json:"publishYear"`
	SourceFileName string   `json:"sourceFileName"`
	TXTContent     string   `json:"txtContent"`
}

type adminClassicsImportChapter struct {
	Title   string
	Content string
}

type AdminClassicsImportJobResp struct {
	ID               int64      `json:"id"`
	UserID           string     `json:"userId"`
	Status           string     `json:"status"`
	Stage            string     `json:"stage"`
	Progress         int        `json:"progress"`
	Attempt          int        `json:"attempt"`
	SourceFileName   string     `json:"sourceFileName"`
	ErrorMessage     string     `json:"errorMessage,omitempty"`
	CreatedBookID    *int64     `json:"createdBookId,omitempty"`
	CreatedEditionID *int64     `json:"createdEditionId,omitempty"`
	ImportedChapters int        `json:"importedChapters"`
	TotalWords       int        `json:"totalWords"`
	StartedAt        *time.Time `json:"startedAt,omitempty"`
	FinishedAt       *time.Time `json:"finishedAt,omitempty"`
	CreatedAt        time.Time  `json:"createdAt"`
	UpdatedAt        time.Time  `json:"updatedAt"`
}

func toAdminClassicsImportJobResp(job model.ClassicsImportJob) AdminClassicsImportJobResp {
	return AdminClassicsImportJobResp{
		ID:               job.ID,
		UserID:           job.UserID.String(),
		Status:           job.Status,
		Stage:            job.Stage,
		Progress:         job.Progress,
		Attempt:          job.Attempt,
		SourceFileName:   job.SourceFileName,
		ErrorMessage:     job.ErrorMessage,
		CreatedBookID:    job.CreatedBookID,
		CreatedEditionID: job.CreatedEditionID,
		ImportedChapters: job.ImportedChapters,
		TotalWords:       job.TotalWords,
		StartedAt:        job.StartedAt,
		FinishedAt:       job.FinishedAt,
		CreatedAt:        job.CreatedAt,
		UpdatedAt:        job.UpdatedAt,
	}
}

func normalizeClassicsImportPayload(req AdminCreateClassicsImportJobReq) (adminClassicsImportJobPayload, error) {
	content := strings.TrimSpace(strings.ReplaceAll(req.TXTContent, "\r\n", "\n"))
	if content == "" {
		return adminClassicsImportJobPayload{}, fmt.Errorf("txtContent 不能为空")
	}
	if len([]rune(content)) > maxImportTXTChars {
		return adminClassicsImportJobPayload{}, fmt.Errorf("txtContent 过大，请控制在 %d 字以内", maxImportTXTChars)
	}

	category := strings.TrimSpace(req.Category)
	if category == "" {
		category = "其他"
	}
	editionLabel := strings.TrimSpace(req.EditionLabel)
	if editionLabel == "" {
		editionLabel = "TXT 导入版"
	}

	authorNames := make([]string, 0, len(req.AuthorNames))
	seen := map[string]struct{}{}
	for _, name := range req.AuthorNames {
		n := strings.TrimSpace(name)
		if n == "" {
			continue
		}
		if _, ok := seen[n]; ok {
			continue
		}
		seen[n] = struct{}{}
		authorNames = append(authorNames, n)
	}

	return adminClassicsImportJobPayload{
		Title:          strings.TrimSpace(req.Title),
		Category:       category,
		Dynasty:        strings.TrimSpace(req.Dynasty),
		Brief:          strings.TrimSpace(req.Brief),
		CoverURL:       strings.TrimSpace(req.CoverURL),
		IsPublished:    req.IsPublished,
		AuthorNames:    authorNames,
		EditionLabel:   editionLabel,
		Translator:     strings.TrimSpace(req.Translator),
		PublishYear:    req.PublishYear,
		SourceFileName: strings.TrimSpace(req.SourceFileName),
		TXTContent:     content,
	}, nil
}

func deriveClassicsImportBookTitle(payload adminClassicsImportJobPayload) string {
	if payload.Title != "" {
		return payload.Title
	}
	if payload.SourceFileName != "" {
		base := strings.TrimSpace(strings.TrimSuffix(filepath.Base(payload.SourceFileName), filepath.Ext(payload.SourceFileName)))
		if base != "" {
			return base
		}
	}
	for _, line := range strings.Split(payload.TXTContent, "\n") {
		trimmed := strings.TrimSpace(line)
		if trimmed == "" {
			continue
		}
		if len([]rune(trimmed)) <= 60 {
			return trimmed
		}
		break
	}
	return "TXT 导入书籍 " + time.Now().Format("20060102150405")
}

func parseClassicsTXTToChapters(raw string) []adminClassicsImportChapter {
	normalized := strings.TrimSpace(strings.ReplaceAll(strings.ReplaceAll(raw, "\r\n", "\n"), "\uFEFF", ""))
	if normalized == "" {
		return nil
	}

	lines := strings.Split(normalized, "\n")
	chapters := make([]adminClassicsImportChapter, 0, 64)
	currentTitle := ""
	currentLines := make([]string, 0, 64)
	hasHeading := false

	flush := func() {
		content := strings.TrimSpace(strings.Join(currentLines, "\n"))
		content = classicsCollapseBlankLineRE.ReplaceAllString(content, "\n\n")
		if content == "" {
			currentLines = currentLines[:0]
			return
		}
		fallbackTitle := "正文"
		if hasHeading {
			fallbackTitle = fmt.Sprintf("第%d章", len(chapters)+1)
		}
		title := strings.TrimSpace(currentTitle)
		if title == "" {
			title = fallbackTitle
		}
		chapters = append(chapters, adminClassicsImportChapter{
			Title:   title,
			Content: content,
		})
		currentTitle = ""
		currentLines = currentLines[:0]
	}

	for _, rawLine := range lines {
		trimmed := strings.TrimSpace(rawLine)
		if classicsTXTChapterHeadingRE.MatchString(trimmed) {
			hasHeading = true
			if len(currentLines) > 0 {
				flush()
			}
			currentTitle = trimmed
			continue
		}
		if trimmed == "" && len(currentLines) == 0 {
			continue
		}
		currentLines = append(currentLines, strings.TrimRight(rawLine, " \t"))
	}
	if len(currentLines) > 0 {
		flush()
	}
	if len(chapters) == 0 {
		return nil
	}
	return chapters
}

func updateClassicsImportJob(id int64, updates map[string]interface{}) {
	updates["updated_at"] = time.Now()
	database.DB.Table("classics_import_jobs").Where("id = ?", id).Updates(updates)
}

func failClassicsImportJob(id int64, stage, errMsg string) {
	finishedAt := time.Now()
	updateClassicsImportJob(id, map[string]interface{}{
		"status":        classicsImportJobFailed,
		"stage":         stage,
		"progress":      100,
		"error_message": errMsg,
		"finished_at":   finishedAt,
	})
}

func createClassicsBookAndEdition(tx *gorm.DB, payload adminClassicsImportJobPayload) (int64, int64, error) {
	now := time.Now()
	type Book struct {
		ID           int64     `gorm:"column:id;primaryKey;autoIncrement"`
		Title        string    `gorm:"column:title"`
		Category     string    `gorm:"column:category"`
		Dynasty      string    `gorm:"column:dynasty"`
		Brief        string    `gorm:"column:brief"`
		CoverURL     string    `gorm:"column:cover_url"`
		WordCount    int       `gorm:"column:word_count"`
		ChapterCount int       `gorm:"column:chapter_count"`
		IsPublished  bool      `gorm:"column:is_published"`
		CreatedAt    time.Time `gorm:"column:created_at"`
		UpdatedAt    time.Time `gorm:"column:updated_at"`
	}
	book := Book{
		Title:        deriveClassicsImportBookTitle(payload),
		Category:     payload.Category,
		Dynasty:      payload.Dynasty,
		Brief:        payload.Brief,
		CoverURL:     payload.CoverURL,
		IsPublished:  payload.IsPublished,
		WordCount:    0,
		ChapterCount: 0,
		CreatedAt:    now,
		UpdatedAt:    now,
	}
	if err := tx.Table("classics_books").Create(&book).Error; err != nil {
		return 0, 0, err
	}

	type BookAuthor struct {
		BookID    int64 `gorm:"column:book_id"`
		AuthorID  int64 `gorm:"column:author_id"`
		SortOrder int   `gorm:"column:sort_order"`
	}
	for i, name := range payload.AuthorNames {
		authorID, err := getOrCreateAuthor(nil, name, payload.Dynasty)
		if err != nil || authorID == 0 {
			continue
		}
		if err := tx.Table("classics_book_authors").Create(&BookAuthor{
			BookID:    book.ID,
			AuthorID:  authorID,
			SortOrder: i,
		}).Error; err != nil {
			return 0, 0, err
		}
	}

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
		Label:       payload.EditionLabel,
		Translator:  payload.Translator,
		PublishYear: payload.PublishYear,
		IsDefault:   true,
		CreatedAt:   now,
		UpdatedAt:   now,
	}
	if err := tx.Table("classics_editions").Create(&edition).Error; err != nil {
		return 0, 0, err
	}

	return book.ID, edition.ID, nil
}

func importClassicsChapters(tx *gorm.DB, bookID, editionID int64, chapters []adminClassicsImportChapter) (int, error) {
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

	rows := make([]Chapter, 0, len(chapters))
	totalWords := 0
	for i, ch := range chapters {
		content := strings.TrimSpace(ch.Content)
		if content == "" {
			continue
		}
		wordCount := len([]rune(content))
		totalWords += wordCount
		title := strings.TrimSpace(ch.Title)
		if title == "" {
			title = fmt.Sprintf("第%d章", i+1)
		}
		rows = append(rows, Chapter{
			BookID:       bookID,
			EditionID:    editionID,
			ChapterIndex: len(rows),
			Title:        title,
			Content:      content,
			WordCount:    wordCount,
			CreatedAt:    now,
			UpdatedAt:    now,
		})
	}
	if len(rows) == 0 {
		return 0, fmt.Errorf("没有可导入的章节内容")
	}
	if err := tx.Table("classics_chapters").CreateInBatches(rows, 50).Error; err != nil {
		return 0, err
	}
	if err := tx.Table("classics_books").Where("id = ?", bookID).Updates(map[string]interface{}{
		"chapter_count": len(rows),
		"word_count":    totalWords,
		"updated_at":    now,
	}).Error; err != nil {
		return 0, err
	}
	return totalWords, nil
}

func processClassicsImportJob(id int64) {
	db := database.DB

	var job model.ClassicsImportJob
	if err := db.Table("classics_import_jobs").Where("id = ?", id).First(&job).Error; err != nil {
		return
	}

	startedAt := time.Now()
	updateClassicsImportJob(id, map[string]interface{}{
		"status":        classicsImportJobProcessing,
		"stage":         "步骤 1/4：读取导入内容",
		"progress":      10,
		"started_at":    startedAt,
		"finished_at":   nil,
		"error_message": "",
	})

	var payload adminClassicsImportJobPayload
	if err := json.Unmarshal([]byte(job.PayloadJSON), &payload); err != nil {
		failClassicsImportJob(id, "步骤 1/4：导入内容解析失败", "任务参数解析失败："+err.Error())
		return
	}

	updateClassicsImportJob(id, map[string]interface{}{
		"stage":    "步骤 2/4：解析 TXT 章节结构",
		"progress": 30,
	})
	chapters := parseClassicsTXTToChapters(payload.TXTContent)
	if len(chapters) == 0 {
		failClassicsImportJob(id, "步骤 2/4：章节解析失败", "未识别到可导入章节，请检查 TXT 内容")
		return
	}

	updateClassicsImportJob(id, map[string]interface{}{
		"stage":    "步骤 3/4：创建书目与默认版本",
		"progress": 55,
	})

	var createdBookID int64
	var createdEditionID int64
	var totalWords int
	err := db.Transaction(func(tx *gorm.DB) error {
		bookID, editionID, err := createClassicsBookAndEdition(tx, payload)
		if err != nil {
			return err
		}
		createdBookID = bookID
		createdEditionID = editionID

		updateClassicsImportJob(id, map[string]interface{}{
			"stage":              "步骤 4/4：写入章节正文与统计",
			"progress":           78,
			"created_book_id":    createdBookID,
			"created_edition_id": createdEditionID,
		})
		totalWords, err = importClassicsChapters(tx, createdBookID, createdEditionID, chapters)
		return err
	})
	if err != nil {
		failClassicsImportJob(id, "步骤 4/4：写入章节失败", "导入失败："+err.Error())
		return
	}

	finishedAt := time.Now()
	updateClassicsImportJob(id, map[string]interface{}{
		"status":             classicsImportJobSuccess,
		"stage":              "导入完成",
		"progress":           100,
		"created_book_id":    createdBookID,
		"created_edition_id": createdEditionID,
		"imported_chapters":  len(chapters),
		"total_words":        totalWords,
		"finished_at":        finishedAt,
		"error_message":      "",
	})
}

// AdminCreateClassicsImportJob 创建阅读库导入任务（TXT 自动建书）
// POST /admin/classics/import-jobs
func AdminCreateClassicsImportJob(c *gin.Context) {
	var req AdminCreateClassicsImportJobReq
	if err := c.ShouldBindJSON(&req); err != nil {
		Error(c, http.StatusBadRequest, err.Error())
		return
	}

	payload, err := normalizeClassicsImportPayload(req)
	if err != nil {
		Error(c, http.StatusBadRequest, err.Error())
		return
	}
	payloadJSON, err := json.Marshal(payload)
	if err != nil {
		Error(c, http.StatusInternalServerError, "任务序列化失败")
		return
	}

	userID := GetCurrentUserID(c)
	if userID == 0 {
		Error(c, http.StatusUnauthorized, "未登录")
		return
	}

	job := model.ClassicsImportJob{
		UserID:         model.Int64String(userID),
		Status:         classicsImportJobQueued,
		Stage:          "任务已创建，等待执行",
		Progress:       0,
		Attempt:        1,
		SourceFileName: payload.SourceFileName,
		PayloadJSON:    string(payloadJSON),
	}
	if err := database.DB.Table("classics_import_jobs").Create(&job).Error; err != nil {
		Error(c, http.StatusInternalServerError, "创建导入任务失败")
		return
	}

	go processClassicsImportJob(job.ID)
	Success(c, toAdminClassicsImportJobResp(job))
}

// AdminGetClassicsImportJobs 获取导入任务列表
// GET /admin/classics/import-jobs
func AdminGetClassicsImportJobs(c *gin.Context) {
	limit := 20
	if v := strings.TrimSpace(c.Query("limit")); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil || n <= 0 || n > 100 {
			Error(c, http.StatusBadRequest, "limit 参数错误")
			return
		}
		limit = n
	}
	status := strings.TrimSpace(c.Query("status"))

	query := database.DB.Table("classics_import_jobs").Order("id DESC").Limit(limit)
	if status != "" {
		query = query.Where("status = ?", status)
	}
	var jobs []model.ClassicsImportJob
	if err := query.Find(&jobs).Error; err != nil {
		Error(c, http.StatusInternalServerError, "获取导入任务失败")
		return
	}
	resp := make([]AdminClassicsImportJobResp, 0, len(jobs))
	for _, job := range jobs {
		resp = append(resp, toAdminClassicsImportJobResp(job))
	}
	Success(c, gin.H{"list": resp})
}

// AdminGetClassicsImportJob 获取单个导入任务详情
// GET /admin/classics/import-jobs/:jobId
func AdminGetClassicsImportJob(c *gin.Context) {
	jobID, err := strconv.ParseInt(c.Param("jobId"), 10, 64)
	if err != nil || jobID <= 0 {
		Error(c, http.StatusBadRequest, "jobId 参数错误")
		return
	}

	var job model.ClassicsImportJob
	if err := database.DB.Table("classics_import_jobs").Where("id = ?", jobID).First(&job).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			Error(c, http.StatusNotFound, "导入任务不存在")
			return
		}
		Error(c, http.StatusInternalServerError, "获取导入任务失败")
		return
	}
	Success(c, toAdminClassicsImportJobResp(job))
}

// AdminRetryClassicsImportJob 重试失败的导入任务
// POST /admin/classics/import-jobs/:jobId/retry
func AdminRetryClassicsImportJob(c *gin.Context) {
	jobID, err := strconv.ParseInt(c.Param("jobId"), 10, 64)
	if err != nil || jobID <= 0 {
		Error(c, http.StatusBadRequest, "jobId 参数错误")
		return
	}

	var job model.ClassicsImportJob
	if err := database.DB.Table("classics_import_jobs").Where("id = ?", jobID).First(&job).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			Error(c, http.StatusNotFound, "导入任务不存在")
			return
		}
		Error(c, http.StatusInternalServerError, "读取导入任务失败")
		return
	}
	if job.Status != classicsImportJobFailed {
		Error(c, http.StatusBadRequest, "仅失败任务可重试")
		return
	}

	nextAttempt := job.Attempt + 1
	updateClassicsImportJob(jobID, map[string]interface{}{
		"status":             classicsImportJobQueued,
		"stage":              "任务已重试，等待执行",
		"progress":           0,
		"attempt":            nextAttempt,
		"error_message":      "",
		"started_at":         nil,
		"finished_at":        nil,
		"created_book_id":    nil,
		"created_edition_id": nil,
		"imported_chapters":  0,
		"total_words":        0,
	})

	if err := database.DB.Table("classics_import_jobs").Where("id = ?", jobID).First(&job).Error; err != nil {
		Error(c, http.StatusInternalServerError, "刷新任务失败")
		return
	}
	go processClassicsImportJob(jobID)
	Success(c, toAdminClassicsImportJobResp(job))
}
