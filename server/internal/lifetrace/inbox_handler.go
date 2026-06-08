package lifetrace

import (
	"errors"
	"net/http"
	"strings"
	"time"
	"valley-server/internal/database"
	"valley-server/internal/model"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type inboxItemRequest struct {
	Title    string   `json:"title"`
	Content  string   `json:"content"`
	ItemType string   `json:"itemType"`
	LinkURL  string   `json:"linkUrl"`
	Tags     []string `json:"tags"`
}

type updateInboxStatusRequest struct {
	Status string `json:"status"`
}

type convertInboxItemRequest struct {
	ConvertedType string `json:"convertedType"`
	ConvertedID   string `json:"convertedId"`
}

var validInboxItemTypes = map[string]bool{
	"text": true,
	"link": true,
}

var validInboxStatuses = map[string]bool{
	"inbox":     true,
	"converted": true,
	"archived":  true,
}

var validInboxConvertedTypes = map[string]bool{
	"plan":  true,
	"trace": true,
}

func normalizeInboxItemType(itemType string) string {
	itemType = strings.TrimSpace(itemType)
	if !validInboxItemTypes[itemType] {
		return "text"
	}
	return itemType
}

func normalizeInboxTags(tags []string) model.StringList {
	seen := map[string]bool{}
	result := model.StringList{}
	for _, tag := range tags {
		tag = strings.TrimSpace(tag)
		if tag == "" || seen[tag] {
			continue
		}
		seen[tag] = true
		result = append(result, tag)
	}
	return result
}

func isValidInboxLink(linkURL string) bool {
	linkURL = strings.TrimSpace(linkURL)
	return strings.HasPrefix(linkURL, "http://") || strings.HasPrefix(linkURL, "https://")
}

func buildInboxItemFromRequest(req inboxItemRequest, userID model.Int64String) (model.LifeTraceInboxItem, string, bool) {
	title := strings.TrimSpace(req.Title)
	if title == "" {
		return model.LifeTraceInboxItem{}, "标题不能为空", false
	}

	itemType := normalizeInboxItemType(req.ItemType)
	linkURL := strings.TrimSpace(req.LinkURL)
	if itemType == "link" && !isValidInboxLink(linkURL) {
		return model.LifeTraceInboxItem{}, "链接格式不正确", false
	}
	if itemType != "link" {
		linkURL = ""
	}

	return model.LifeTraceInboxItem{
		UserID:   userID,
		Title:    title,
		Content:  strings.TrimSpace(req.Content),
		ItemType: itemType,
		LinkURL:  linkURL,
		Tags:     normalizeInboxTags(req.Tags),
		Status:   "inbox",
	}, "", true
}

func applyInboxListFilters(query *gorm.DB, c *gin.Context) *gorm.DB {
	status := strings.TrimSpace(c.Query("status"))
	if status != "" && validInboxStatuses[status] {
		query = query.Where("status = ?", status)
	}

	itemType := strings.TrimSpace(c.Query("type"))
	if itemType != "" && validInboxItemTypes[itemType] {
		query = query.Where("item_type = ?", itemType)
	}

	keyword := strings.TrimSpace(c.Query("q"))
	if keyword != "" {
		like := "%" + keyword + "%"
		query = query.Where("(title LIKE ? OR content LIKE ? OR link_url LIKE ?)", like, like, like)
	}

	return query
}

func (h *Handler) ListInboxItems(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		fail(c, http.StatusUnauthorized, "未登录")
		return
	}

	page, pageSize := parseListPagination(c)
	offset := (page - 1) * pageSize
	baseQuery := database.GetDB().
		Model(&model.LifeTraceInboxItem{}).
		Where("user_id = ?", userID)
	baseQuery = applyInboxListFilters(baseQuery, c)

	var total int64
	if err := baseQuery.Count(&total).Error; err != nil {
		fail(c, http.StatusInternalServerError, "获取 Inbox 失败")
		return
	}

	var items []model.LifeTraceInboxItem
	if err := baseQuery.
		Order("created_at DESC").
		Limit(pageSize).
		Offset(offset).
		Find(&items).Error; err != nil {
		fail(c, http.StatusInternalServerError, "获取 Inbox 失败")
		return
	}

	success(c, gin.H{
		"list":       items,
		"pagination": buildListPagination(page, pageSize, total),
	})
}

func (h *Handler) CreateInboxItem(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		fail(c, http.StatusUnauthorized, "未登录")
		return
	}

	var req inboxItemRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		fail(c, http.StatusBadRequest, "参数错误")
		return
	}

	item, message, ok := buildInboxItemFromRequest(req, userID)
	if !ok {
		fail(c, http.StatusBadRequest, message)
		return
	}

	if err := database.GetDB().Create(&item).Error; err != nil {
		fail(c, http.StatusInternalServerError, "创建 Inbox 失败")
		return
	}

	success(c, item)
}

func (h *Handler) UpdateInboxItem(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		fail(c, http.StatusUnauthorized, "未登录")
		return
	}

	item, found := findInboxItem(c.Param("id"), userID)
	if !found {
		fail(c, http.StatusNotFound, "Inbox 不存在")
		return
	}

	var req inboxItemRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		fail(c, http.StatusBadRequest, "参数错误")
		return
	}

	nextItem, message, ok := buildInboxItemFromRequest(req, userID)
	if !ok {
		fail(c, http.StatusBadRequest, message)
		return
	}

	updates := map[string]interface{}{
		"title":     nextItem.Title,
		"content":   nextItem.Content,
		"item_type": nextItem.ItemType,
		"link_url":  nextItem.LinkURL,
		"tags":      nextItem.Tags,
	}

	if err := database.GetDB().Model(&item).Updates(updates).Error; err != nil {
		fail(c, http.StatusInternalServerError, "更新 Inbox 失败")
		return
	}

	if err := database.GetDB().First(&item, "id = ? AND user_id = ?", item.ID, userID).Error; err != nil {
		fail(c, http.StatusInternalServerError, "读取 Inbox 失败")
		return
	}

	success(c, item)
}

func (h *Handler) UpdateInboxItemStatus(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		fail(c, http.StatusUnauthorized, "未登录")
		return
	}

	item, found := findInboxItem(c.Param("id"), userID)
	if !found {
		fail(c, http.StatusNotFound, "Inbox 不存在")
		return
	}

	var req updateInboxStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		fail(c, http.StatusBadRequest, "参数错误")
		return
	}
	status := strings.TrimSpace(req.Status)
	if status == "" || !validInboxStatuses[status] {
		fail(c, http.StatusBadRequest, "状态不正确")
		return
	}

	updates := map[string]interface{}{"status": status}
	if status != "converted" {
		updates["converted_type"] = ""
		updates["converted_id"] = ""
		updates["converted_at"] = nil
	}

	if err := database.GetDB().Model(&item).Updates(updates).Error; err != nil {
		fail(c, http.StatusInternalServerError, "更新 Inbox 失败")
		return
	}
	if err := database.GetDB().First(&item, "id = ? AND user_id = ?", item.ID, userID).Error; err != nil {
		fail(c, http.StatusInternalServerError, "读取 Inbox 失败")
		return
	}

	success(c, item)
}

func (h *Handler) ConvertInboxItem(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		fail(c, http.StatusUnauthorized, "未登录")
		return
	}

	item, found := findInboxItem(c.Param("id"), userID)
	if !found {
		fail(c, http.StatusNotFound, "Inbox 不存在")
		return
	}

	var req convertInboxItemRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		fail(c, http.StatusBadRequest, "参数错误")
		return
	}
	convertedType := strings.TrimSpace(req.ConvertedType)
	convertedID := strings.TrimSpace(req.ConvertedID)
	if !validInboxConvertedTypes[convertedType] || convertedID == "" {
		fail(c, http.StatusBadRequest, "转化目标不正确")
		return
	}

	now := time.Now()
	updates := map[string]interface{}{
		"status":         "converted",
		"converted_type": convertedType,
		"converted_id":   convertedID,
		"converted_at":   &now,
	}
	if err := database.GetDB().Model(&item).Updates(updates).Error; err != nil {
		fail(c, http.StatusInternalServerError, "转化 Inbox 失败")
		return
	}
	if err := database.GetDB().First(&item, "id = ? AND user_id = ?", item.ID, userID).Error; err != nil {
		fail(c, http.StatusInternalServerError, "读取 Inbox 失败")
		return
	}

	success(c, item)
}

func (h *Handler) DeleteInboxItem(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		fail(c, http.StatusUnauthorized, "未登录")
		return
	}

	item, found := findInboxItem(c.Param("id"), userID)
	if !found {
		fail(c, http.StatusNotFound, "Inbox 不存在")
		return
	}

	if err := database.GetDB().Delete(&item).Error; err != nil {
		fail(c, http.StatusInternalServerError, "删除 Inbox 失败")
		return
	}

	success(c, gin.H{"id": item.ID})
}

func findInboxItem(id string, userID model.Int64String) (model.LifeTraceInboxItem, bool) {
	var item model.LifeTraceInboxItem
	err := database.GetDB().First(&item, "id = ? AND user_id = ?", id, userID).Error
	if err == nil {
		return item, true
	}
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return item, false
	}
	return item, false
}
