package handler

import (
	"net/http"
	"strconv"
	"strings"
	"time"
	"valley-server/internal/database"
	"valley-server/internal/model"
	"valley-server/internal/utils"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type adminPageParams struct {
	Page     int
	PageSize int
	Offset   int
}

func parseAdminPage(c *gin.Context, defaultSize int, maxSize int) adminPageParams {
	page := GetIntQuery(c, "page", 1)
	pageSize := GetIntQuery(c, "pageSize", defaultSize)
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > maxSize {
		pageSize = defaultSize
	}
	return adminPageParams{Page: page, PageSize: pageSize, Offset: (page - 1) * pageSize}
}

func applyAdminDateRange(query *gorm.DB, c *gin.Context, column string) *gorm.DB {
	if dateFrom := strings.TrimSpace(c.Query("dateFrom")); dateFrom != "" {
		if _, err := time.Parse("2006-01-02", dateFrom); err == nil {
			query = query.Where(column+" >= ?", dateFrom+" 00:00:00")
		}
	}
	if dateTo := strings.TrimSpace(c.Query("dateTo")); dateTo != "" {
		if _, err := time.Parse("2006-01-02", dateTo); err == nil {
			query = query.Where(column+" <= ?", dateTo+" 23:59:59")
		}
	}
	return query
}

func adminListResponse(c *gin.Context, list any, total int64, page adminPageParams) {
	Success(c, gin.H{
		"list":     list,
		"total":    total,
		"page":     page.Page,
		"pageSize": page.PageSize,
	})
}

func AdminListOperationLogs(c *gin.Context) {
	page := parseAdminPage(c, 20, 200)
	query := database.GetDB().Model(&model.OperationLog{})
	if keyword := strings.TrimSpace(c.Query("keyword")); keyword != "" {
		like := "%" + keyword + "%"
		query = query.Where("log_id LIKE ? OR method LIKE ? OR path LIKE ? OR ip LIKE ? OR user_id LIKE ? OR user_role LIKE ? OR message LIKE ?", like, like, like, like, like, like, like)
	}
	if status := strings.TrimSpace(c.Query("status")); status != "" {
		if value, err := strconv.Atoi(status); err == nil {
			query = query.Where("status = ?", value)
		}
	}
	if level := strings.TrimSpace(c.Query("level")); level != "" {
		query = query.Where("level = ?", level)
	}
	query = applyAdminDateRange(query, c, "created_at")

	var total int64
	if err := query.Count(&total).Error; err != nil {
		Error(c, http.StatusInternalServerError, "查询操作日志失败")
		return
	}
	var list []model.OperationLog
	if err := query.Order("created_at DESC").Offset(page.Offset).Limit(page.PageSize).Find(&list).Error; err != nil {
		Error(c, http.StatusInternalServerError, "查询操作日志失败")
		return
	}
	adminListResponse(c, list, total, page)
}

func AdminListCodeAccessLogs(c *gin.Context) {
	page := parseAdminPage(c, 20, 200)
	query := database.GetDB().Model(&model.CodeAccessLog{}).Preload("Creator").Preload("Creator.User")
	if keyword := strings.TrimSpace(c.Query("keyword")); keyword != "" {
		like := "%" + keyword + "%"
		query = query.Where("code LIKE ? OR ip LIKE ? OR user_agent LIKE ?", like, like, like)
	}
	if creatorID := strings.TrimSpace(c.Query("creatorId")); creatorID != "" {
		query = query.Where("creator_id = ?", creatorID)
	}
	query = applyAdminDateRange(query, c, "created_at")

	var total int64
	if err := query.Count(&total).Error; err != nil {
		Error(c, http.StatusInternalServerError, "查询口令访问日志失败")
		return
	}
	var list []model.CodeAccessLog
	if err := query.Order("created_at DESC").Offset(page.Offset).Limit(page.PageSize).Find(&list).Error; err != nil {
		Error(c, http.StatusInternalServerError, "查询口令访问日志失败")
		return
	}
	adminListResponse(c, list, total, page)
}

func AdminListStorageAssets(c *gin.Context) {
	type asset struct {
		ID             string    `json:"id"`
		Kind           string    `json:"kind"`
		Source         string    `json:"source"`
		OwnerID        string    `json:"ownerId,omitempty"`
		URL            string    `json:"url"`
		StorageKey     string    `json:"storageKey,omitempty"`
		Status         string    `json:"status,omitempty"`
		Referenced     bool      `json:"referenced"`
		ReferenceCount int64     `json:"referenceCount"`
		Risk           string    `json:"risk,omitempty"`
		CreatedAt      time.Time `json:"createdAt"`
	}

	page := parseAdminPage(c, 20, 200)
	keyword := strings.TrimSpace(c.Query("keyword"))
	kind := strings.TrimSpace(c.Query("kind"))
	riskFilter := strings.TrimSpace(c.Query("risk"))
	assets := make([]asset, 0)
	db := database.GetDB()

	if kind == "" || kind == "resource" {
		var resources []model.Resource
		query := db.Model(&model.Resource{})
		if keyword != "" {
			like := "%" + keyword + "%"
			query = query.Where("title LIKE ? OR url LIKE ? OR storage_key LIKE ?", like, like, like)
		}
		_ = query.Order("created_at DESC").Find(&resources).Error
		for _, item := range resources {
			assets = append(assets, asset{
				ID: item.ID.String(), Kind: "resource", Source: "resource-library", OwnerID: item.UserID.String(), URL: item.URL,
				StorageKey: item.StorageKey, Status: item.Visibility, Referenced: true, ReferenceCount: 1, CreatedAt: item.CreatedAt,
			})
		}
	}
	if kind == "" || kind == "avatar" {
		var avatars []model.UserAvatarHistory
		query := db.Model(&model.UserAvatarHistory{})
		if keyword != "" {
			query = query.Where("avatar_url LIKE ? OR storage_key LIKE ?", "%"+keyword+"%", "%"+keyword+"%")
		}
		_ = query.Order("created_at DESC").Find(&avatars).Error
		for _, item := range avatars {
			var references int64
			_ = db.Model(&model.User{}).Where("avatar = ?", item.AvatarURL).Count(&references).Error
			risk := ""
			if references == 0 {
				risk = "orphan-suspected"
			}
			assets = append(assets, asset{
				ID: item.ID.String(), Kind: "avatar", Source: "user-avatar-history", OwnerID: item.UserID.String(), URL: item.AvatarURL,
				StorageKey: item.StorageKey, Referenced: references > 0, ReferenceCount: references, Risk: risk, CreatedAt: item.CreatedAt,
			})
		}
	}
	if kind == "" || kind == "blog-cover" {
		var covers []model.BlogCoverUpload
		query := db.Model(&model.BlogCoverUpload{})
		if keyword != "" {
			query = query.Where("url LIKE ? OR storage_key LIKE ? OR status LIKE ?", "%"+keyword+"%", "%"+keyword+"%", "%"+keyword+"%")
		}
		_ = query.Order("created_at DESC").Find(&covers).Error
		for _, item := range covers {
			var references int64
			postQuery := db.Model(&model.Post{}).Where("cover_storage_key = ? OR cover = ?", item.StorageKey, item.URL)
			if item.PostID != nil {
				postQuery = postQuery.Or("id = ?", *item.PostID)
			}
			_ = postQuery.Count(&references).Error
			referenced := references > 0 || item.Status == "active"
			if item.Status == "active" && references == 0 {
				references = 1
			}
			risk := ""
			if !referenced {
				risk = "orphan-suspected"
			}
			assets = append(assets, asset{
				ID: item.ID.String(), Kind: "blog-cover", Source: "blog-cover-upload", OwnerID: item.UserID.String(), URL: item.URL,
				StorageKey: item.StorageKey, Status: item.Status, Referenced: referenced, ReferenceCount: references, Risk: risk, CreatedAt: item.CreatedAt,
			})
		}
	}
	if riskFilter != "" && riskFilter != "all" {
		filtered := assets[:0]
		for _, item := range assets {
			if item.Risk == riskFilter {
				filtered = append(filtered, item)
			}
		}
		assets = filtered
	}

	total := int64(len(assets))
	start := page.Offset
	if start > len(assets) {
		start = len(assets)
	}
	end := start + page.PageSize
	if end > len(assets) {
		end = len(assets)
	}
	adminListResponse(c, assets[start:end], total, page)
}

func applyAdminAIUsageFilters(query *gorm.DB, c *gin.Context) *gorm.DB {
	if keyword := strings.TrimSpace(c.Query("keyword")); keyword != "" {
		like := "%" + keyword + "%"
		query = query.Where("feature LIKE ? OR provider LIKE ? OR model LIKE ? OR user_id LIKE ? OR error_message LIKE ?", like, like, like, like, like)
	}
	if status := strings.TrimSpace(c.Query("status")); status != "" && status != "all" {
		query = query.Where("status = ?", status)
	}
	if feature := strings.TrimSpace(c.Query("type")); feature != "" && feature != "all" {
		query = query.Where("feature = ?", feature)
	}
	if userID := strings.TrimSpace(c.Query("userId")); userID != "" {
		query = query.Where("user_id = ?", userID)
	}
	return applyAdminDateRange(query, c, "created_at")
}

func AdminListAIUsageLogs(c *gin.Context) {
	page := parseAdminPage(c, 20, 200)
	query := applyAdminAIUsageFilters(database.GetDB().Model(&model.AIUsageLog{}), c)

	var total int64
	if err := query.Count(&total).Error; err != nil {
		Error(c, http.StatusInternalServerError, "查询 AI 调用日志失败")
		return
	}

	var list []model.AIUsageLog
	if err := query.Order("created_at DESC").Offset(page.Offset).Limit(page.PageSize).Find(&list).Error; err != nil {
		Error(c, http.StatusInternalServerError, "查询 AI 调用日志失败")
		return
	}
	adminListResponse(c, list, total, page)
}

func AdminGetAIUsageSummary(c *gin.Context) {
	query := applyAdminAIUsageFilters(database.GetDB().Model(&model.AIUsageLog{}), c)

	type row struct {
		Feature       string
		Calls         int64
		Failures      int64
		PromptChars   int64
		ResponseChars int64
		TotalTokens   int64
		AvgLatencyMs  float64
	}

	var rows []row
	if err := query.
		Select("feature, COUNT(*) as calls, SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failures, COALESCE(SUM(prompt_chars), 0) as prompt_chars, COALESCE(SUM(response_chars), 0) as response_chars, COALESCE(SUM(total_tokens), 0) as total_tokens, COALESCE(AVG(latency_ms), 0) as avg_latency_ms").
		Group("feature").
		Order("calls DESC").
		Scan(&rows).Error; err != nil {
		Error(c, http.StatusInternalServerError, "查询 AI 调用汇总失败")
		return
	}

	totalCalls := int64(0)
	totalFailures := int64(0)
	totalPromptChars := int64(0)
	totalResponseChars := int64(0)
	totalTokens := int64(0)
	totalLatencyWeighted := float64(0)
	features := make([]gin.H, 0, len(rows))
	for _, item := range rows {
		totalCalls += item.Calls
		totalFailures += item.Failures
		totalPromptChars += item.PromptChars
		totalResponseChars += item.ResponseChars
		totalTokens += item.TotalTokens
		totalLatencyWeighted += item.AvgLatencyMs * float64(item.Calls)
		failureRate := float64(0)
		if item.Calls > 0 {
			failureRate = float64(item.Failures) / float64(item.Calls)
		}
		features = append(features, gin.H{
			"feature":       item.Feature,
			"calls":         item.Calls,
			"failures":      item.Failures,
			"failureRate":   failureRate,
			"promptChars":   item.PromptChars,
			"responseChars": item.ResponseChars,
			"totalTokens":   item.TotalTokens,
			"avgLatencyMs":  item.AvgLatencyMs,
		})
	}

	failureRate := float64(0)
	avgLatencyMs := float64(0)
	if totalCalls > 0 {
		failureRate = float64(totalFailures) / float64(totalCalls)
		avgLatencyMs = totalLatencyWeighted / float64(totalCalls)
	}

	Success(c, gin.H{
		"calls":         totalCalls,
		"failures":      totalFailures,
		"failureRate":   failureRate,
		"promptChars":   totalPromptChars,
		"responseChars": totalResponseChars,
		"totalTokens":   totalTokens,
		"avgLatencyMs":  avgLatencyMs,
		"features":      features,
	})
}

func AdminListGuestbookMessages(c *gin.Context) {
	page := parseAdminPage(c, 20, 100)
	query := database.GetDB().Model(&model.GuestbookMessage{}).Preload("User")
	if status := strings.TrimSpace(c.Query("status")); status != "" && status != "all" {
		query = query.Where("status = ?", status)
	}
	if keyword := strings.TrimSpace(c.Query("keyword")); keyword != "" {
		like := "%" + keyword + "%"
		query = query.Where("nickname LIKE ? OR content LIKE ? OR client_ip LIKE ?", like, like, like)
	}
	query = applyAdminDateRange(query, c, "created_at")

	var total int64
	if err := query.Count(&total).Error; err != nil {
		Error(c, http.StatusInternalServerError, "查询留言失败")
		return
	}
	var list []model.GuestbookMessage
	if err := query.Order("is_pinned DESC").Order("created_at DESC").Offset(page.Offset).Limit(page.PageSize).Find(&list).Error; err != nil {
		Error(c, http.StatusInternalServerError, "查询留言失败")
		return
	}
	adminListResponse(c, list, total, page)
}

func AdminUpdateGuestbookMessageStatus(c *gin.Context) {
	var req struct {
		Status string `json:"status"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		Error(c, http.StatusBadRequest, "参数错误")
		return
	}
	status := strings.TrimSpace(req.Status)
	if status != "approved" && status != "hidden" && status != "rejected" {
		Error(c, http.StatusBadRequest, "不支持的留言状态")
		return
	}
	var item model.GuestbookMessage
	db := database.GetDB()
	if err := db.Where("id = ? AND deleted_at IS NULL", c.Param("id")).First(&item).Error; err != nil {
		Error(c, http.StatusNotFound, "留言不存在")
		return
	}
	if err := db.Model(&item).Update("status", status).Error; err != nil {
		Error(c, http.StatusInternalServerError, "更新留言状态失败")
		return
	}
	item.Status = status
	Success(c, item)
}

func AdminListBlogCategories(c *gin.Context) {
	page := parseAdminPage(c, 50, 200)
	query := database.GetDB().Model(&model.PostCategory{})
	if keyword := strings.TrimSpace(c.Query("keyword")); keyword != "" {
		like := "%" + keyword + "%"
		query = query.Where("name LIKE ? OR slug LIKE ? OR description LIKE ?", like, like, like)
	}
	var total int64
	if err := query.Count(&total).Error; err != nil {
		Error(c, http.StatusInternalServerError, "查询博客分类失败")
		return
	}
	var list []model.PostCategory
	if err := query.Order("sort_order ASC, created_at DESC").Offset(page.Offset).Limit(page.PageSize).Find(&list).Error; err != nil {
		Error(c, http.StatusInternalServerError, "查询博客分类失败")
		return
	}
	adminListResponse(c, list, total, page)
}

func AdminCreateBlogCategory(c *gin.Context) {
	var req struct {
		Name        string `json:"name"`
		Slug        string `json:"slug"`
		Description string `json:"description"`
		SortOrder   int    `json:"sortOrder"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		Error(c, http.StatusBadRequest, "参数错误")
		return
	}
	name := strings.TrimSpace(req.Name)
	slug := strings.TrimSpace(req.Slug)
	if name == "" || slug == "" {
		Error(c, http.StatusBadRequest, "分类名称和标识不能为空")
		return
	}
	category := model.PostCategory{
		ID:          model.Int64String(utils.GenerateID()),
		Name:        name,
		Slug:        slug,
		Description: strings.TrimSpace(req.Description),
		SortOrder:   req.SortOrder,
	}
	if err := database.GetDB().Create(&category).Error; err != nil {
		Error(c, http.StatusInternalServerError, "创建博客分类失败")
		return
	}
	Success(c, category)
}

func AdminUpdateBlogCategory(c *gin.Context) {
	var req struct {
		Name        string `json:"name"`
		Slug        string `json:"slug"`
		Description string `json:"description"`
		SortOrder   *int   `json:"sortOrder"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		Error(c, http.StatusBadRequest, "参数错误")
		return
	}
	var category model.PostCategory
	db := database.GetDB()
	if err := db.Where("id = ? AND deleted_at IS NULL", c.Param("id")).First(&category).Error; err != nil {
		Error(c, http.StatusNotFound, "博客分类不存在")
		return
	}
	updates := map[string]any{}
	if name := strings.TrimSpace(req.Name); name != "" {
		updates["name"] = name
	}
	if slug := strings.TrimSpace(req.Slug); slug != "" {
		updates["slug"] = slug
	}
	updates["description"] = strings.TrimSpace(req.Description)
	if req.SortOrder != nil {
		updates["sort_order"] = *req.SortOrder
	}
	if err := db.Model(&category).Updates(updates).Error; err != nil {
		Error(c, http.StatusInternalServerError, "更新博客分类失败")
		return
	}
	db.First(&category, "id = ?", c.Param("id"))
	Success(c, category)
}

func AdminDeleteBlogCategory(c *gin.Context) {
	db := database.GetDB()
	var category model.PostCategory
	if err := db.Where("id = ? AND deleted_at IS NULL", c.Param("id")).First(&category).Error; err != nil {
		Error(c, http.StatusNotFound, "博客分类不存在")
		return
	}
	var count int64
	db.Model(&model.Post{}).Where("category_id = ? AND deleted_at IS NULL", category.ID).Count(&count)
	if count > 0 {
		Error(c, http.StatusBadRequest, "分类下仍有内容，不能删除")
		return
	}
	if err := db.Delete(&category).Error; err != nil {
		Error(c, http.StatusInternalServerError, "删除博客分类失败")
		return
	}
	Success(c, nil)
}

func AdminListBlogTags(c *gin.Context) {
	page := parseAdminPage(c, 50, 200)
	query := database.GetDB().Model(&model.PostTag{})
	if keyword := strings.TrimSpace(c.Query("keyword")); keyword != "" {
		like := "%" + keyword + "%"
		query = query.Where("name LIKE ? OR slug LIKE ?", like, like)
	}
	var total int64
	if err := query.Count(&total).Error; err != nil {
		Error(c, http.StatusInternalServerError, "查询博客标签失败")
		return
	}
	var list []model.PostTag
	if err := query.Order("post_count DESC, created_at DESC").Offset(page.Offset).Limit(page.PageSize).Find(&list).Error; err != nil {
		Error(c, http.StatusInternalServerError, "查询博客标签失败")
		return
	}
	adminListResponse(c, list, total, page)
}

func AdminCreateBlogTag(c *gin.Context) {
	var req struct {
		Name string `json:"name"`
		Slug string `json:"slug"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		Error(c, http.StatusBadRequest, "参数错误")
		return
	}
	name := strings.TrimSpace(req.Name)
	slug := strings.TrimSpace(req.Slug)
	if name == "" || slug == "" {
		Error(c, http.StatusBadRequest, "标签名称和标识不能为空")
		return
	}
	tag := model.PostTag{ID: model.Int64String(utils.GenerateID()), Name: name, Slug: slug}
	if err := database.GetDB().Create(&tag).Error; err != nil {
		Error(c, http.StatusInternalServerError, "创建博客标签失败")
		return
	}
	Success(c, tag)
}

func AdminUpdateBlogTag(c *gin.Context) {
	var req struct {
		Name string `json:"name"`
		Slug string `json:"slug"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		Error(c, http.StatusBadRequest, "参数错误")
		return
	}
	var tag model.PostTag
	db := database.GetDB()
	if err := db.Where("id = ? AND deleted_at IS NULL", c.Param("id")).First(&tag).Error; err != nil {
		Error(c, http.StatusNotFound, "博客标签不存在")
		return
	}
	updates := map[string]any{}
	if name := strings.TrimSpace(req.Name); name != "" {
		updates["name"] = name
	}
	if slug := strings.TrimSpace(req.Slug); slug != "" {
		updates["slug"] = slug
	}
	if err := db.Model(&tag).Updates(updates).Error; err != nil {
		Error(c, http.StatusInternalServerError, "更新博客标签失败")
		return
	}
	db.First(&tag, "id = ?", c.Param("id"))
	Success(c, tag)
}

func AdminDeleteBlogTag(c *gin.Context) {
	db := database.GetDB()
	var tag model.PostTag
	if err := db.Where("id = ? AND deleted_at IS NULL", c.Param("id")).First(&tag).Error; err != nil {
		Error(c, http.StatusNotFound, "博客标签不存在")
		return
	}
	if err := db.Where("tag_id = ?", tag.ID).Delete(&model.PostTagRelation{}).Error; err != nil {
		Error(c, http.StatusInternalServerError, "清理博客标签关联失败")
		return
	}
	if err := db.Delete(&tag).Error; err != nil {
		Error(c, http.StatusInternalServerError, "删除博客标签失败")
		return
	}
	Success(c, nil)
}

func AdminListBlogComments(c *gin.Context) {
	page := parseAdminPage(c, 20, 100)
	query := database.GetDB().Model(&model.PostComment{}).Preload("Post").Preload("User")
	if postID := strings.TrimSpace(c.Query("postId")); postID != "" {
		query = query.Where("post_id = ?", postID)
	}
	if userID := strings.TrimSpace(c.Query("userId")); userID != "" {
		query = query.Where("user_id = ?", userID)
	}
	if keyword := strings.TrimSpace(c.Query("keyword")); keyword != "" {
		query = query.Where("content LIKE ?", "%"+keyword+"%")
	}
	query = applyAdminDateRange(query, c, "created_at")
	var total int64
	if err := query.Count(&total).Error; err != nil {
		Error(c, http.StatusInternalServerError, "查询评论失败")
		return
	}
	var list []model.PostComment
	if err := query.Order("created_at DESC").Offset(page.Offset).Limit(page.PageSize).Find(&list).Error; err != nil {
		Error(c, http.StatusInternalServerError, "查询评论失败")
		return
	}
	adminListResponse(c, list, total, page)
}

func AdminDeleteBlogComment(c *gin.Context) {
	var comment model.PostComment
	db := database.GetDB()
	if err := db.Where("id = ? AND deleted_at IS NULL", c.Param("id")).First(&comment).Error; err != nil {
		Error(c, http.StatusNotFound, "评论不存在")
		return
	}
	if err := db.Delete(&comment).Error; err != nil {
		Error(c, http.StatusInternalServerError, "删除评论失败")
		return
	}
	Success(c, gin.H{"deleted": true})
}

func AdminListCreatorAlbums(c *gin.Context) {
	page := parseAdminPage(c, 20, 100)
	query := database.GetDB().Model(&model.CreatorAlbum{}).Preload("Creator").Preload("Creator.User").Preload("CoverResource")
	if creatorID := strings.TrimSpace(c.Query("creatorId")); creatorID != "" {
		query = query.Where("creator_id = ?", creatorID)
	}
	if keyword := strings.TrimSpace(c.Query("keyword")); keyword != "" {
		like := "%" + keyword + "%"
		query = query.Where("name LIKE ? OR description LIKE ?", like, like)
	}
	query = applyAdminDateRange(query, c, "created_at")
	var total int64
	if err := query.Count(&total).Error; err != nil {
		Error(c, http.StatusInternalServerError, "查询创作者专辑失败")
		return
	}
	var list []model.CreatorAlbum
	if err := query.Order("updated_at DESC").Offset(page.Offset).Limit(page.PageSize).Find(&list).Error; err != nil {
		Error(c, http.StatusInternalServerError, "查询创作者专辑失败")
		return
	}
	adminListResponse(c, list, total, page)
}

func AdminGetCreatorAlbumDetail(c *gin.Context) {
	var album model.CreatorAlbum
	if err := database.GetDB().Preload("Creator").Preload("Creator.User").Preload("CoverResource").Preload("Resources").Where("id = ? AND deleted_at IS NULL", c.Param("id")).First(&album).Error; err != nil {
		Error(c, http.StatusNotFound, "创作者专辑不存在")
		return
	}
	Success(c, album)
}

func AdminUpdateCreatorAlbum(c *gin.Context) {
	var req struct {
		Name        string `json:"name"`
		Description string `json:"description"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		Error(c, http.StatusBadRequest, "参数错误")
		return
	}
	var album model.CreatorAlbum
	db := database.GetDB()
	if err := db.Where("id = ? AND deleted_at IS NULL", c.Param("id")).First(&album).Error; err != nil {
		Error(c, http.StatusNotFound, "创作者专辑不存在")
		return
	}
	updates := map[string]any{"description": strings.TrimSpace(req.Description)}
	if name := strings.TrimSpace(req.Name); name != "" {
		updates["name"] = name
	}
	if err := db.Model(&album).Updates(updates).Error; err != nil {
		Error(c, http.StatusInternalServerError, "更新创作者专辑失败")
		return
	}
	db.First(&album, "id = ?", c.Param("id"))
	Success(c, album)
}

func AdminDeleteCreatorAlbum(c *gin.Context) {
	var album model.CreatorAlbum
	db := database.GetDB()
	if err := db.Where("id = ? AND deleted_at IS NULL", c.Param("id")).First(&album).Error; err != nil {
		Error(c, http.StatusNotFound, "创作者专辑不存在")
		return
	}
	if err := db.Select("Resources").Delete(&album).Error; err != nil {
		Error(c, http.StatusInternalServerError, "删除创作者专辑失败")
		return
	}
	Success(c, gin.H{"ok": true})
}

func AdminListFavorites(c *gin.Context) {
	page := parseAdminPage(c, 20, 100)
	query := database.GetDB().Model(&model.UserFavorite{}).Preload("User").Preload("Resource")
	if userID := strings.TrimSpace(c.Query("userId")); userID != "" {
		query = query.Where("user_id = ?", userID)
	}
	if resourceID := strings.TrimSpace(c.Query("resourceId")); resourceID != "" {
		query = query.Where("resource_id = ?", resourceID)
	}
	query = applyAdminDateRange(query, c, "created_at")
	var total int64
	if err := query.Count(&total).Error; err != nil {
		Error(c, http.StatusInternalServerError, "查询收藏关系失败")
		return
	}
	var list []model.UserFavorite
	if err := query.Order("created_at DESC").Offset(page.Offset).Limit(page.PageSize).Find(&list).Error; err != nil {
		Error(c, http.StatusInternalServerError, "查询收藏关系失败")
		return
	}
	adminListResponse(c, list, total, page)
}

func AdminListFollows(c *gin.Context) {
	page := parseAdminPage(c, 20, 100)
	query := database.GetDB().Model(&model.UserFollow{}).Preload("User").Preload("Creator").Preload("Creator.User")
	if userID := strings.TrimSpace(c.Query("userId")); userID != "" {
		query = query.Where("user_id = ?", userID)
	}
	if creatorID := strings.TrimSpace(c.Query("creatorId")); creatorID != "" {
		query = query.Where("creator_id = ?", creatorID)
	}
	query = applyAdminDateRange(query, c, "created_at")
	var total int64
	if err := query.Count(&total).Error; err != nil {
		Error(c, http.StatusInternalServerError, "查询关注关系失败")
		return
	}
	var list []model.UserFollow
	if err := query.Order("created_at DESC").Offset(page.Offset).Limit(page.PageSize).Find(&list).Error; err != nil {
		Error(c, http.StatusInternalServerError, "查询关注关系失败")
		return
	}
	adminListResponse(c, list, total, page)
}

func AdminListNotifications(c *gin.Context) {
	page := parseAdminPage(c, 20, 100)
	query := database.GetDB().Model(&model.UserNotification{})
	if userID := strings.TrimSpace(c.Query("userId")); userID != "" {
		query = query.Where("user_id = ?", userID)
	}
	if itemType := strings.TrimSpace(c.Query("type")); itemType != "" {
		query = query.Where("type = ?", itemType)
	}
	if raw := strings.TrimSpace(c.Query("isRead")); raw == "true" || raw == "false" {
		query = query.Where("is_read = ?", raw == "true")
	}
	if keyword := strings.TrimSpace(c.Query("keyword")); keyword != "" {
		like := "%" + keyword + "%"
		query = query.Where("title LIKE ? OR content LIKE ?", like, like)
	}
	query = applyAdminDateRange(query, c, "created_at")
	var total int64
	if err := query.Count(&total).Error; err != nil {
		Error(c, http.StatusInternalServerError, "查询通知失败")
		return
	}
	var list []model.UserNotification
	if err := query.Order("is_read ASC, created_at DESC").Offset(page.Offset).Limit(page.PageSize).Find(&list).Error; err != nil {
		Error(c, http.StatusInternalServerError, "查询通知失败")
		return
	}
	adminListResponse(c, list, total, page)
}

func AdminCreateNotification(c *gin.Context) {
	var req struct {
		UserID    model.Int64String `json:"userId"`
		Type      string            `json:"type"`
		Title     string            `json:"title"`
		Content   string            `json:"content"`
		ExtraData string            `json:"extraData"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		Error(c, http.StatusBadRequest, "参数错误")
		return
	}
	if req.UserID == 0 || strings.TrimSpace(req.Title) == "" || strings.TrimSpace(req.Content) == "" {
		Error(c, http.StatusBadRequest, "用户、标题和内容不能为空")
		return
	}
	notification := model.UserNotification{
		ID:        model.Int64String(utils.GenerateID()),
		UserID:    req.UserID,
		Type:      strings.TrimSpace(req.Type),
		Title:     strings.TrimSpace(req.Title),
		Content:   strings.TrimSpace(req.Content),
		ExtraData: strings.TrimSpace(req.ExtraData),
	}
	if notification.Type == "" {
		notification.Type = "admin"
	}
	if err := database.GetDB().Create(&notification).Error; err != nil {
		Error(c, http.StatusInternalServerError, "创建通知失败")
		return
	}
	Success(c, notification)
}

func AdminUpdateNotificationReadState(c *gin.Context) {
	var req struct {
		IsRead bool `json:"isRead"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		Error(c, http.StatusBadRequest, "参数错误")
		return
	}
	var notification model.UserNotification
	db := database.GetDB()
	if err := db.Where("id = ? AND deleted_at IS NULL", c.Param("id")).First(&notification).Error; err != nil {
		Error(c, http.StatusNotFound, "通知不存在")
		return
	}
	updates := map[string]any{"is_read": req.IsRead, "read_at": nil}
	if req.IsRead {
		now := time.Now()
		updates["read_at"] = &now
	}
	if err := db.Model(&notification).Updates(updates).Error; err != nil {
		Error(c, http.StatusInternalServerError, "更新通知状态失败")
		return
	}
	db.First(&notification, "id = ?", c.Param("id"))
	Success(c, notification)
}

func AdminGetUserOperations(c *gin.Context) {
	userID := strings.TrimSpace(c.Param("id"))
	db := database.GetDB()

	var user model.User
	if err := db.Where("id = ? AND deleted_at IS NULL", userID).First(&user).Error; err != nil {
		Error(c, http.StatusNotFound, "用户不存在")
		return
	}

	var downloads []model.DownloadRecord
	var favorites []model.UserFavorite
	var follows []model.UserFollow
	var notifications []model.UserNotification
	var comments []model.PostComment
	var guestbookMessages []model.GuestbookMessage
	_ = db.Where("user_id = ?", userID).Preload("Resource").Order("created_at DESC").Limit(10).Find(&downloads).Error
	_ = db.Where("user_id = ?", userID).Preload("Resource").Order("created_at DESC").Limit(10).Find(&favorites).Error
	_ = db.Where("user_id = ?", userID).Preload("Creator").Preload("Creator.User").Order("created_at DESC").Limit(10).Find(&follows).Error
	_ = db.Where("user_id = ?", userID).Order("created_at DESC").Limit(10).Find(&notifications).Error
	_ = db.Where("user_id = ?", userID).Preload("Post").Order("created_at DESC").Limit(10).Find(&comments).Error
	_ = db.Where("user_id = ?", userID).Order("created_at DESC").Limit(10).Find(&guestbookMessages).Error

	summary := map[string]int64{}
	for key, item := range map[string]any{
		"downloads":     &model.DownloadRecord{},
		"favorites":     &model.UserFavorite{},
		"follows":       &model.UserFollow{},
		"notifications": &model.UserNotification{},
		"comments":      &model.PostComment{},
		"guestbook":     &model.GuestbookMessage{},
	} {
		var count int64
		db.Model(item).Where("user_id = ?", userID).Count(&count)
		summary[key] = count
	}

	lifeTrace := map[string]int64{}
	for key, item := range map[string]any{
		"plans":           &model.LifeTracePlan{},
		"traces":          &model.LifeTraceTrace{},
		"pantryItems":     &model.LifeTracePantryItem{},
		"aiConversations": &model.LifeTraceAIConversation{},
	} {
		var count int64
		db.Model(item).Where("user_id = ?", userID).Count(&count)
		lifeTrace[key] = count
	}

	Success(c, gin.H{
		"user":              user,
		"summary":           summary,
		"downloads":         downloads,
		"favorites":         favorites,
		"follows":           follows,
		"notifications":     notifications,
		"comments":          comments,
		"guestbookMessages": guestbookMessages,
		"lifeTrace":         lifeTrace,
	})
}

func AdminGetResourceOperations(c *gin.Context) {
	resourceID := strings.TrimSpace(c.Param("id"))
	db := database.GetDB()

	var resource model.Resource
	if err := db.Preload("User").Where("id = ? AND deleted_at IS NULL", resourceID).First(&resource).Error; err != nil {
		Error(c, http.StatusNotFound, "资源不存在")
		return
	}
	resource.FillThumbnailURL()

	var albums []model.CreatorAlbum
	_ = db.Joins("JOIN creator_album_resources ON creator_album_resources.creator_album_id = creator_albums.id").
		Where("creator_album_resources.resource_id = ?", resource.ID).
		Preload("Creator").Preload("Creator.User").
		Order("creator_albums.updated_at DESC").
		Find(&albums).Error

	var downloads []model.DownloadRecord
	var favorites []model.UserFavorite
	_ = db.Where("resource_id = ?", resource.ID).Preload("User").Order("created_at DESC").Limit(10).Find(&downloads).Error
	_ = db.Where("resource_id = ?", resource.ID).Preload("User").Order("created_at DESC").Limit(10).Find(&favorites).Error

	var downloadCount int64
	var favoriteCount int64
	db.Model(&model.DownloadRecord{}).Where("resource_id = ?", resource.ID).Count(&downloadCount)
	db.Model(&model.UserFavorite{}).Where("resource_id = ?", resource.ID).Count(&favoriteCount)

	Success(c, gin.H{
		"resource":      resource,
		"tags":          resource.Tags,
		"albums":        albums,
		"downloads":     downloads,
		"favorites":     favorites,
		"downloadCount": downloadCount,
		"favoriteCount": favoriteCount,
	})
}
