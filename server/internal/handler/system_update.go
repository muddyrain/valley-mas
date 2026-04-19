package handler

import (
	"net/http"
	"strings"
	"time"
	"valley-server/internal/database"
	"valley-server/internal/model"

	"github.com/gin-gonic/gin"
)

const (
	systemUpdatePlatformWeb     = "web"
	systemUpdateStatusDraft     = "draft"
	systemUpdateStatusPublished = "published"
	systemUpdateDefaultPageSize = 20
	systemUpdateMaxPageSize     = 100
	systemUpdateMaxTitleRunes   = 120
	systemUpdateMaxContentRunes = 2000
)

type systemUpdateSaveRequest struct {
	Title       string  `json:"title"`
	Content     string  `json:"content"`
	Status      string  `json:"status"`
	PublishedAt *string `json:"publishedAt"`
}

func normalizeSystemUpdateStatus(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case systemUpdateStatusPublished:
		return systemUpdateStatusPublished
	default:
		return systemUpdateStatusDraft
	}
}

func trimRunes(value string, max int) string {
	if max <= 0 {
		return ""
	}
	runes := []rune(strings.TrimSpace(value))
	if len(runes) <= max {
		return string(runes)
	}
	return string(runes[:max])
}

func parsePublishedAt(raw *string, status string) *time.Time {
	if raw == nil {
		if status == systemUpdateStatusPublished {
			now := time.Now()
			return &now
		}
		return nil
	}
	value := strings.TrimSpace(*raw)
	if value == "" {
		if status == systemUpdateStatusPublished {
			now := time.Now()
			return &now
		}
		return nil
	}
	parsed, err := time.Parse(time.RFC3339, value)
	if err != nil {
		return nil
	}
	return &parsed
}

// ListPublicWebSystemUpdates 获取公开 Web 更新日志列表
func ListPublicWebSystemUpdates(c *gin.Context) {
	db := database.GetDB()
	page := GetIntQuery(c, "page", 1)
	pageSize := GetIntQuery(c, "pageSize", systemUpdateDefaultPageSize)
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > systemUpdateMaxPageSize {
		pageSize = systemUpdateDefaultPageSize
	}
	offset := (page - 1) * pageSize

	now := time.Now()
	base := db.Model(&model.SystemUpdate{}).
		Where("platform = ?", systemUpdatePlatformWeb).
		Where("status = ?", systemUpdateStatusPublished).
		Where("published_at IS NOT NULL").
		Where("published_at <= ?", now)

	var total int64
	if err := base.Count(&total).Error; err != nil {
		Error(c, http.StatusInternalServerError, "查询更新日志失败")
		return
	}

	var list []model.SystemUpdate
	if err := base.Order("published_at DESC, created_at DESC").
		Offset(offset).
		Limit(pageSize).
		Find(&list).Error; err != nil {
		Error(c, http.StatusInternalServerError, "查询更新日志失败")
		return
	}

	// 对外仅返回用户可见字段
	items := make([]gin.H, 0, len(list))
	for _, item := range list {
		items = append(items, gin.H{
			"id":          item.ID,
			"title":       item.Title,
			"content":     item.Content,
			"publishedAt": item.PublishedAt,
			"updatedAt":   item.UpdatedAt,
		})
	}

	Success(c, gin.H{
		"list":     items,
		"total":    total,
		"page":     page,
		"pageSize": pageSize,
	})
}

// AdminListSystemUpdates 管理端查询更新日志
func AdminListSystemUpdates(c *gin.Context) {
	db := database.GetDB()
	page := GetIntQuery(c, "page", 1)
	pageSize := GetIntQuery(c, "pageSize", systemUpdateDefaultPageSize)
	keyword := strings.TrimSpace(c.Query("keyword"))
	status := normalizeSystemUpdateStatus(c.Query("status"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > systemUpdateMaxPageSize {
		pageSize = systemUpdateDefaultPageSize
	}
	offset := (page - 1) * pageSize

	query := db.Model(&model.SystemUpdate{}).Where("platform = ?", systemUpdatePlatformWeb)
	if strings.TrimSpace(c.Query("status")) != "" {
		query = query.Where("status = ?", status)
	}
	if keyword != "" {
		like := "%" + keyword + "%"
		query = query.Where("title LIKE ? OR content LIKE ?", like, like)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		Error(c, http.StatusInternalServerError, "查询更新日志失败")
		return
	}

	var list []model.SystemUpdate
	if err := query.Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&list).Error; err != nil {
		Error(c, http.StatusInternalServerError, "查询更新日志失败")
		return
	}

	Success(c, gin.H{
		"list":     list,
		"total":    total,
		"page":     page,
		"pageSize": pageSize,
	})
}

// AdminCreateSystemUpdate 管理端新增更新日志
func AdminCreateSystemUpdate(c *gin.Context) {
	var req systemUpdateSaveRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		Error(c, http.StatusBadRequest, "参数错误")
		return
	}

	title := trimRunes(req.Title, systemUpdateMaxTitleRunes)
	content := trimRunes(req.Content, systemUpdateMaxContentRunes)
	if title == "" || content == "" {
		Error(c, http.StatusBadRequest, "标题和内容不能为空")
		return
	}

	status := normalizeSystemUpdateStatus(req.Status)
	publishedAt := parsePublishedAt(req.PublishedAt, status)
	if status == systemUpdateStatusPublished && publishedAt == nil {
		Error(c, http.StatusBadRequest, "发布时间格式错误")
		return
	}

	var creatorID *model.Int64String
	if uid := GetCurrentUserID(c); uid > 0 {
		value := model.Int64String(uid)
		creatorID = &value
	}

	item := model.SystemUpdate{
		Platform:    systemUpdatePlatformWeb,
		Title:       title,
		Content:     content,
		Status:      status,
		PublishedAt: publishedAt,
		CreatedBy:   creatorID,
		UpdatedBy:   creatorID,
	}

	if err := database.GetDB().Create(&item).Error; err != nil {
		Error(c, http.StatusInternalServerError, "创建更新日志失败")
		return
	}

	Success(c, item)
}

// AdminUpdateSystemUpdate 管理端更新更新日志
func AdminUpdateSystemUpdate(c *gin.Context) {
	id := strings.TrimSpace(c.Param("id"))
	if id == "" {
		Error(c, http.StatusBadRequest, "更新日志ID不能为空")
		return
	}

	var item model.SystemUpdate
	db := database.GetDB()
	if err := db.Where("id = ? AND platform = ?", id, systemUpdatePlatformWeb).First(&item).Error; err != nil {
		Error(c, http.StatusNotFound, "更新日志不存在")
		return
	}

	var req systemUpdateSaveRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		Error(c, http.StatusBadRequest, "参数错误")
		return
	}

	title := trimRunes(req.Title, systemUpdateMaxTitleRunes)
	content := trimRunes(req.Content, systemUpdateMaxContentRunes)
	if title == "" || content == "" {
		Error(c, http.StatusBadRequest, "标题和内容不能为空")
		return
	}

	status := normalizeSystemUpdateStatus(req.Status)
	publishedAt := parsePublishedAt(req.PublishedAt, status)
	if status == systemUpdateStatusPublished && publishedAt == nil {
		Error(c, http.StatusBadRequest, "发布时间格式错误")
		return
	}

	updates := map[string]interface{}{
		"title":        title,
		"content":      content,
		"status":       status,
		"published_at": publishedAt,
	}
	if uid := GetCurrentUserID(c); uid > 0 {
		updates["updated_by"] = model.Int64String(uid)
	}

	if err := db.Model(&item).Updates(updates).Error; err != nil {
		Error(c, http.StatusInternalServerError, "更新更新日志失败")
		return
	}

	if err := db.Where("id = ?", item.ID).First(&item).Error; err != nil {
		Error(c, http.StatusInternalServerError, "查询更新日志失败")
		return
	}

	Success(c, item)
}

// AdminDeleteSystemUpdate 管理端删除更新日志
func AdminDeleteSystemUpdate(c *gin.Context) {
	id := strings.TrimSpace(c.Param("id"))
	if id == "" {
		Error(c, http.StatusBadRequest, "更新日志ID不能为空")
		return
	}

	if err := database.GetDB().
		Where("id = ? AND platform = ?", id, systemUpdatePlatformWeb).
		Delete(&model.SystemUpdate{}).Error; err != nil {
		Error(c, http.StatusInternalServerError, "删除更新日志失败")
		return
	}

	Success(c, gin.H{"deleted": true})
}
