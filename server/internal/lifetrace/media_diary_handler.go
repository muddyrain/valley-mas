package lifetrace

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"
	"valley-server/internal/aiusage"
	"valley-server/internal/database"
	"valley-server/internal/model"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

const lifeTraceMediaDiaryAISuggestMaxTokens = 420

type mediaDiaryEntryRequest struct {
	MediaType     string   `json:"mediaType"`
	Status        string   `json:"status"`
	Title         string   `json:"title"`
	OriginalTitle string   `json:"originalTitle"`
	Creator       string   `json:"creator"`
	ReleaseYear   int      `json:"releaseYear"`
	CoverURL      string   `json:"coverUrl"`
	Rating        int      `json:"rating"`
	StartedAt     string   `json:"startedAt"`
	FinishedAt    string   `json:"finishedAt"`
	Note          string   `json:"note"`
	Quote         string   `json:"quote"`
	Tags          []string `json:"tags"`
	Source        string   `json:"source"`
}

type mediaDiaryAISuggestRequest struct {
	MediaType string `json:"mediaType"`
	Title     string `json:"title"`
}

type mediaDiaryAISuggestion struct {
	OriginalTitle string   `json:"originalTitle"`
	Creator       string   `json:"creator"`
	ReleaseYear   int      `json:"releaseYear"`
	Tags          []string `json:"tags"`
	Note          string   `json:"note"`
}

type mediaDiarySummary struct {
	Total          int64                           `json:"total"`
	CompletedMonth int64                           `json:"completedMonth"`
	BestRating     int                             `json:"bestRating"`
	Recent         *model.LifeTraceMediaDiaryEntry `json:"recent,omitempty"`
}

var validMediaDiaryTypes = map[string]bool{
	"书籍": true,
	"电影": true,
	"剧集": true,
	"动漫": true,
	"音乐": true,
}

var validMediaDiaryStatuses = map[string]bool{
	"想看":  true,
	"进行中": true,
	"已完成": true,
	"搁置":  true,
}

func normalizeMediaDiaryType(mediaType string) string {
	mediaType = strings.TrimSpace(mediaType)
	if !validMediaDiaryTypes[mediaType] {
		return "书籍"
	}
	return mediaType
}

func normalizeMediaDiaryStatus(status string) string {
	status = strings.TrimSpace(status)
	if !validMediaDiaryStatuses[status] {
		return "想看"
	}
	return status
}

func normalizeMediaDiaryRating(rating int) int {
	if rating < 0 {
		return 0
	}
	if rating > 10 {
		return 10
	}
	return rating
}

func normalizeMediaDiaryYear(year int) int {
	currentYear := time.Now().Year() + 1
	if year < 0 || year > currentYear {
		return 0
	}
	return year
}

func normalizeMediaDiaryDate(raw string) string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return ""
	}
	if _, err := time.Parse("2006-01-02", raw); err != nil {
		return ""
	}
	return raw
}

func normalizeMediaDiarySource(source string) string {
	source = strings.TrimSpace(source)
	if source == "ai_suggest" {
		return source
	}
	return "manual"
}

func buildMediaDiaryEntryFromRequest(req mediaDiaryEntryRequest, userID model.Int64String) (model.LifeTraceMediaDiaryEntry, string, bool) {
	title := strings.TrimSpace(req.Title)
	if title == "" {
		return model.LifeTraceMediaDiaryEntry{}, "作品标题不能为空", false
	}

	entry := model.LifeTraceMediaDiaryEntry{
		UserID:        userID,
		MediaType:     normalizeMediaDiaryType(req.MediaType),
		Status:        normalizeMediaDiaryStatus(req.Status),
		Title:         trimRunes(title, 160),
		OriginalTitle: trimRunes(strings.TrimSpace(req.OriginalTitle), 160),
		Creator:       trimRunes(strings.TrimSpace(req.Creator), 160),
		ReleaseYear:   normalizeMediaDiaryYear(req.ReleaseYear),
		CoverURL:      strings.TrimSpace(req.CoverURL),
		Rating:        normalizeMediaDiaryRating(req.Rating),
		StartedAt:     normalizeMediaDiaryDate(req.StartedAt),
		FinishedAt:    normalizeMediaDiaryDate(req.FinishedAt),
		Note:          trimRunes(strings.TrimSpace(req.Note), 1000),
		Quote:         trimRunes(strings.TrimSpace(req.Quote), 500),
		Tags:          normalizeTraceTags(req.Tags),
		Source:        normalizeMediaDiarySource(req.Source),
	}

	if len(entry.Tags) == 0 {
		entry.Tags = model.StringList{entry.MediaType, "书影音"}
	}
	if !stringListContains(entry.Tags, entry.MediaType) {
		entry.Tags = append(model.StringList{entry.MediaType}, entry.Tags...)
	}
	if !stringListContains(entry.Tags, "书影音") {
		entry.Tags = append(entry.Tags, "书影音")
	}

	return entry, "", true
}

func stringListContains(list model.StringList, target string) bool {
	for _, item := range list {
		if item == target {
			return true
		}
	}
	return false
}

func mediaDiaryTimeLabel(entry model.LifeTraceMediaDiaryEntry) string {
	if entry.FinishedAt != "" {
		return entry.FinishedAt
	}
	if entry.StartedAt != "" {
		return entry.StartedAt
	}
	return time.Now().Format("2006-01-02")
}

func mediaDiaryTraceTitle(entry model.LifeTraceMediaDiaryEntry) string {
	return fmt.Sprintf("%s：%s", entry.MediaType, entry.Title)
}

func mediaDiaryTraceSummary(entry model.LifeTraceMediaDiaryEntry) string {
	parts := []string{}
	if entry.Creator != "" {
		parts = append(parts, entry.Creator)
	}
	if entry.ReleaseYear > 0 {
		parts = append(parts, strconv.Itoa(entry.ReleaseYear))
	}
	if entry.Rating > 0 {
		parts = append(parts, fmt.Sprintf("评分 %.1f", float64(entry.Rating)/2))
	}
	if entry.Note != "" {
		parts = append(parts, entry.Note)
	}
	if entry.Quote != "" {
		parts = append(parts, "摘录："+entry.Quote)
	}
	if len(parts) == 0 {
		parts = append(parts, entry.Status)
	}
	return trimRunes(strings.Join(parts, " · "), 1000)
}

func buildMediaDiaryTrace(entry model.LifeTraceMediaDiaryEntry) model.LifeTraceTrace {
	mediaDiaryID := entry.ID
	return model.LifeTraceTrace{
		UserID:       entry.UserID,
		MediaDiaryID: &mediaDiaryID,
		Title:        mediaDiaryTraceTitle(entry),
		Summary:      mediaDiaryTraceSummary(entry),
		TimeLabel:    mediaDiaryTimeLabel(entry),
		ImageURL:     entry.CoverURL,
		Mood:         "专注",
		Tags:         entry.Tags,
		Source:       "书影音",
	}
}

func applyMediaDiaryListFilters(query *gorm.DB, c *gin.Context) *gorm.DB {
	mediaType := strings.TrimSpace(c.Query("type"))
	if mediaType != "" && mediaType != "all" && validMediaDiaryTypes[mediaType] {
		query = query.Where("media_type = ?", mediaType)
	}

	status := strings.TrimSpace(c.Query("status"))
	if status != "" && status != "all" && validMediaDiaryStatuses[status] {
		query = query.Where("status = ?", status)
	}

	keyword := strings.TrimSpace(c.Query("q"))
	if keyword != "" {
		like := "%" + keyword + "%"
		query = query.Where("(title LIKE ? OR original_title LIKE ? OR creator LIKE ? OR note LIKE ?)", like, like, like, like)
	}

	tag := strings.TrimSpace(c.Query("tag"))
	if tag != "" {
		query = query.Where("tags LIKE ?", "%"+tag+"%")
	}

	return query
}

func buildMediaDiarySummary(userID model.Int64String) mediaDiarySummary {
	db := database.GetDB()
	summary := mediaDiarySummary{}
	_ = db.Model(&model.LifeTraceMediaDiaryEntry{}).
		Where("user_id = ?", userID).
		Count(&summary.Total).Error

	monthPrefix := time.Now().Format("2006-01")
	_ = db.Model(&model.LifeTraceMediaDiaryEntry{}).
		Where("user_id = ? AND status = ? AND finished_at LIKE ?", userID, "已完成", monthPrefix+"%").
		Count(&summary.CompletedMonth).Error

	_ = db.Model(&model.LifeTraceMediaDiaryEntry{}).
		Where("user_id = ?", userID).
		Select("COALESCE(MAX(rating), 0)").
		Scan(&summary.BestRating).Error

	var recent model.LifeTraceMediaDiaryEntry
	if err := db.Where("user_id = ?", userID).Order("updated_at DESC").First(&recent).Error; err == nil {
		summary.Recent = &recent
	}
	return summary
}

func (h *Handler) ListMediaDiaryEntries(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		fail(c, http.StatusUnauthorized, "未登录")
		return
	}

	page, pageSize := parseListPagination(c)
	offset := (page - 1) * pageSize
	query := database.GetDB().Model(&model.LifeTraceMediaDiaryEntry{}).Where("user_id = ?", userID)
	query = applyMediaDiaryListFilters(query, c)

	var total int64
	if err := query.Count(&total).Error; err != nil {
		fail(c, http.StatusInternalServerError, "获取书影音日记失败")
		return
	}

	var entries []model.LifeTraceMediaDiaryEntry
	if err := query.Order("updated_at DESC").
		Limit(pageSize).
		Offset(offset).
		Find(&entries).Error; err != nil {
		fail(c, http.StatusInternalServerError, "获取书影音日记失败")
		return
	}

	success(c, gin.H{
		"list":       entries,
		"pagination": buildListPagination(page, pageSize, total),
		"summary":    buildMediaDiarySummary(userID),
	})
}

func (h *Handler) CreateMediaDiaryEntry(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		fail(c, http.StatusUnauthorized, "未登录")
		return
	}

	var req mediaDiaryEntryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		fail(c, http.StatusBadRequest, "参数错误")
		return
	}

	entry, message, valid := buildMediaDiaryEntryFromRequest(req, userID)
	if !valid {
		fail(c, http.StatusBadRequest, message)
		return
	}

	err := database.GetDB().Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&entry).Error; err != nil {
			return err
		}

		trace := buildMediaDiaryTrace(entry)
		if err := tx.Create(&trace).Error; err != nil {
			return err
		}

		traceID := trace.ID
		entry.TraceID = &traceID
		if err := tx.Model(&entry).Update("trace_id", traceID).Error; err != nil {
			return err
		}
		return nil
	})
	if err != nil {
		fail(c, http.StatusInternalServerError, "创建书影音日记失败")
		return
	}

	evaluateAchievementsQuietly(userID)
	success(c, entry)
}

func (h *Handler) UpdateMediaDiaryEntry(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		fail(c, http.StatusUnauthorized, "未登录")
		return
	}

	current, found := findMediaDiaryEntry(c.Param("id"), userID)
	if !found {
		fail(c, http.StatusNotFound, "书影音日记不存在")
		return
	}

	var req mediaDiaryEntryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		fail(c, http.StatusBadRequest, "参数错误")
		return
	}

	updated, message, valid := buildMediaDiaryEntryFromRequest(req, userID)
	if !valid {
		fail(c, http.StatusBadRequest, message)
		return
	}
	updated.ID = current.ID
	updated.TraceID = current.TraceID

	err := database.GetDB().Transaction(func(tx *gorm.DB) error {
		updates := map[string]interface{}{
			"media_type":     updated.MediaType,
			"status":         updated.Status,
			"title":          updated.Title,
			"original_title": updated.OriginalTitle,
			"creator":        updated.Creator,
			"release_year":   updated.ReleaseYear,
			"cover_url":      updated.CoverURL,
			"rating":         updated.Rating,
			"started_at":     updated.StartedAt,
			"finished_at":    updated.FinishedAt,
			"note":           updated.Note,
			"quote":          updated.Quote,
			"tags":           updated.Tags,
			"source":         updated.Source,
		}
		if err := tx.Model(&current).Updates(updates).Error; err != nil {
			return err
		}
		if current.TraceID != nil {
			traceUpdates := map[string]interface{}{
				"title":      mediaDiaryTraceTitle(updated),
				"summary":    mediaDiaryTraceSummary(updated),
				"time_label": mediaDiaryTimeLabel(updated),
				"image_url":  updated.CoverURL,
				"tags":       updated.Tags,
				"source":     "书影音",
			}
			if err := tx.Model(&model.LifeTraceTrace{}).
				Where("id = ? AND user_id = ?", *current.TraceID, userID).
				Updates(traceUpdates).Error; err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		fail(c, http.StatusInternalServerError, "更新书影音日记失败")
		return
	}

	if err := database.GetDB().First(&current, "id = ? AND user_id = ?", current.ID, userID).Error; err != nil {
		fail(c, http.StatusInternalServerError, "读取书影音日记失败")
		return
	}
	success(c, current)
}

func (h *Handler) DeleteMediaDiaryEntry(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		fail(c, http.StatusUnauthorized, "未登录")
		return
	}

	entry, found := findMediaDiaryEntry(c.Param("id"), userID)
	if !found {
		fail(c, http.StatusNotFound, "书影音日记不存在")
		return
	}

	err := database.GetDB().Transaction(func(tx *gorm.DB) error {
		if entry.TraceID != nil {
			if err := tx.Model(&model.LifeTraceTrace{}).
				Where("id = ? AND user_id = ?", *entry.TraceID, userID).
				Update("media_diary_id", nil).Error; err != nil {
				return err
			}
		}
		return tx.Delete(&entry).Error
	})
	if err != nil {
		fail(c, http.StatusInternalServerError, "删除书影音日记失败")
		return
	}

	success(c, gin.H{"id": entry.ID})
}

func (h *Handler) SuggestMediaDiaryEntry(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		fail(c, http.StatusUnauthorized, "未登录")
		return
	}

	var req mediaDiaryAISuggestRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		fail(c, http.StatusBadRequest, "参数错误")
		return
	}

	title := strings.TrimSpace(req.Title)
	if title == "" {
		fail(c, http.StatusBadRequest, "作品标题不能为空")
		return
	}
	mediaType := normalizeMediaDiaryType(req.MediaType)

	cfg, errMsg := readLifeTraceAIConfig()
	if errMsg != "" {
		fail(c, http.StatusServiceUnavailable, errMsg)
		return
	}

	prompt := buildMediaDiaryAISuggestPrompt(mediaType, title)
	aiCtx := aiusage.WithAudit(c.Request.Context(), "life-trace-media-diary", userID.String())
	raw, _, err := callLifeTraceAIWithMaxTokens(aiCtx, cfg, prompt, lifeTraceMediaDiaryAISuggestMaxTokens)
	if err != nil {
		fail(c, http.StatusBadGateway, "AI 补全失败，请稍后再试")
		return
	}

	suggestion, err := parseMediaDiaryAISuggestion(raw)
	if err != nil {
		fail(c, http.StatusBadGateway, "AI 补全结果不可用")
		return
	}
	success(c, suggestion)
}

func buildMediaDiaryAISuggestPrompt(mediaType string, title string) string {
	return strings.Join([]string{
		"你是 Life Trace 的书影音日记助手。只输出 JSON 对象，不要 Markdown，不要解释。",
		"用户会自行确认信息，不能编造冷门事实；不确定的字段留空。",
		"JSON 字段：originalTitle, creator, releaseYear, tags, note。",
		"tags 最多 5 个，每个不超过 12 个字；note 不超过 80 个中文字符。",
		fmt.Sprintf("类型：%s", mediaType),
		fmt.Sprintf("标题：%s", title),
	}, "\n")
}

func parseMediaDiaryAISuggestion(raw string) (mediaDiaryAISuggestion, error) {
	raw = strings.TrimSpace(raw)
	start := strings.Index(raw, "{")
	end := strings.LastIndex(raw, "}")
	if start < 0 || end <= start {
		return mediaDiaryAISuggestion{}, errors.New("missing JSON object")
	}

	var suggestion mediaDiaryAISuggestion
	if err := json.Unmarshal([]byte(raw[start:end+1]), &suggestion); err != nil {
		return mediaDiaryAISuggestion{}, err
	}

	suggestion.OriginalTitle = trimRunes(strings.TrimSpace(suggestion.OriginalTitle), 160)
	suggestion.Creator = trimRunes(strings.TrimSpace(suggestion.Creator), 160)
	suggestion.ReleaseYear = normalizeMediaDiaryYear(suggestion.ReleaseYear)
	suggestion.Note = trimRunes(strings.TrimSpace(suggestion.Note), 80)
	suggestion.Tags = normalizeMediaDiarySuggestionTags(suggestion.Tags)
	return suggestion, nil
}

func normalizeMediaDiarySuggestionTags(tags []string) []string {
	seen := map[string]bool{}
	result := []string{}
	for _, tag := range tags {
		tag = trimRunes(strings.TrimSpace(tag), 12)
		if tag == "" || seen[tag] {
			continue
		}
		seen[tag] = true
		result = append(result, tag)
		if len(result) >= 5 {
			break
		}
	}
	return result
}

func findMediaDiaryEntry(id string, userID model.Int64String) (model.LifeTraceMediaDiaryEntry, bool) {
	var entry model.LifeTraceMediaDiaryEntry
	err := database.GetDB().First(&entry, "id = ? AND user_id = ?", id, userID).Error
	if err == nil {
		return entry, true
	}
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return model.LifeTraceMediaDiaryEntry{}, false
	}
	return model.LifeTraceMediaDiaryEntry{}, false
}

func callMediaDiaryAISuggestForTest(ctx context.Context, mediaType string, title string) (mediaDiaryAISuggestion, error) {
	cfg, errMsg := readLifeTraceAIConfig()
	if errMsg != "" {
		return mediaDiaryAISuggestion{}, errors.New(errMsg)
	}
	raw, _, err := callLifeTraceAIWithMaxTokens(ctx, cfg, buildMediaDiaryAISuggestPrompt(mediaType, title), lifeTraceMediaDiaryAISuggestMaxTokens)
	if err != nil {
		return mediaDiaryAISuggestion{}, err
	}
	return parseMediaDiaryAISuggestion(raw)
}
