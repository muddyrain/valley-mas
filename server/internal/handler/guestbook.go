package handler

import (
	"net/http"
	"strings"
	"time"
	"unicode/utf8"
	"valley-server/internal/database"
	"valley-server/internal/model"

	"github.com/gin-gonic/gin"
)

const (
	guestbookStatusApproved  = "approved"
	guestbookMaxContentRunes = 500
	guestbookSubmitCooldown  = 15 * time.Second
)

type createGuestbookMessageRequest struct {
	Content string `json:"content" binding:"required,max=1000"`
}

type updateGuestbookPinRequest struct {
	IsPinned bool `json:"isPinned"`
}

func formatGuestbookMessageItem(item model.GuestbookMessage, viewerID model.Int64String, isAdmin bool) gin.H {
	canDelete := false
	if isAdmin {
		canDelete = true
	} else if item.UserID != nil && viewerID > 0 && *item.UserID == viewerID {
		canDelete = true
	}

	return gin.H{
		"id":        item.ID,
		"userId":    item.UserID,
		"nickname":  item.Nickname,
		"avatar":    item.Avatar,
		"content":   item.Content,
		"isPinned":  item.IsPinned,
		"canDelete": canDelete,
		"canPin":    isAdmin,
		"createdAt": item.CreatedAt,
	}
}

// ListGuestbookMessages 获取公开留言列表
func ListGuestbookMessages(c *gin.Context) {
	db := database.GetDB()
	page := GetIntQuery(c, "page", 1)
	pageSize := GetIntQuery(c, "pageSize", 20)
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 20
	}
	if pageSize > 50 {
		pageSize = 50
	}
	offset := (page - 1) * pageSize

	query := db.Model(&model.GuestbookMessage{}).
		Where("status = ? AND deleted_at IS NULL", guestbookStatusApproved)

	var total int64
	if err := query.Count(&total).Error; err != nil {
		Error(c, http.StatusInternalServerError, "查询留言失败")
		return
	}

	var list []model.GuestbookMessage
	if err := query.Order("is_pinned DESC").Order("created_at DESC").
		Offset(offset).Limit(pageSize).Find(&list).Error; err != nil {
		Error(c, http.StatusInternalServerError, "查询留言失败")
		return
	}

	viewerID := model.Int64String(GetCurrentUserID(c))
	isAdmin := GetCurrentUserRole(c) == "admin"

	items := make([]gin.H, 0, len(list))
	for _, item := range list {
		items = append(items, formatGuestbookMessageItem(item, viewerID, isAdmin))
	}

	totalPages := 0
	if total > 0 {
		totalPages = int((total + int64(pageSize) - 1) / int64(pageSize))
	}

	Success(c, gin.H{
		"list":       items,
		"total":      total,
		"page":       page,
		"pageSize":   pageSize,
		"totalPages": totalPages,
	})
}

// CreateGuestbookMessage 创建留言
func CreateGuestbookMessage(c *gin.Context) {
	var req createGuestbookMessageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		Error(c, http.StatusBadRequest, "参数错误")
		return
	}

	db := database.GetDB()
	content := strings.TrimSpace(req.Content)
	if content == "" {
		Error(c, http.StatusBadRequest, "留言内容不能为空")
		return
	}
	if utf8.RuneCountInString(content) > guestbookMaxContentRunes {
		Error(c, http.StatusBadRequest, "留言内容不能超过500字")
		return
	}
	ip := strings.TrimSpace(c.ClientIP())
	if ip != "" {
		var recentCount int64
		if err := db.Model(&model.GuestbookMessage{}).
			Where("client_ip = ? AND created_at >= ? AND deleted_at IS NULL", ip, time.Now().Add(-guestbookSubmitCooldown)).
			Count(&recentCount).Error; err == nil && recentCount > 0 {
			Error(c, http.StatusTooManyRequests, "留言太频繁啦，请稍后再试")
			return
		}
	}

	rawUserID, exists := c.Get("userId")
	if !exists {
		Error(c, http.StatusUnauthorized, "请先登录后再留言")
		return
	}
	currentUserID, ok := rawUserID.(int64)
	if !ok || currentUserID <= 0 {
		Error(c, http.StatusUnauthorized, "请先登录后再留言")
		return
	}

	userIDValue := model.Int64String(currentUserID)
	var (
		nickname string
		avatar   string
	)

	var user model.User
	if err := db.Select("id", "nickname", "avatar").First(&user, userIDValue).Error; err != nil {
		Error(c, http.StatusUnauthorized, "登录状态已失效，请重新登录")
		return
	}
	nickname = strings.TrimSpace(user.Nickname)
	avatar = strings.TrimSpace(user.Avatar)
	if nickname == "" {
		nickname = "访客"
	}

	item := model.GuestbookMessage{
		UserID:    &userIDValue,
		Nickname:  nickname,
		Avatar:    avatar,
		Content:   content,
		Status:    guestbookStatusApproved,
		IsPinned:  false,
		ClientIP:  ip,
		UserAgent: strings.TrimSpace(c.GetHeader("User-Agent")),
	}
	if err := db.Create(&item).Error; err != nil {
		Error(c, http.StatusInternalServerError, "留言发布失败，请稍后重试")
		return
	}

	Success(c, gin.H{
		"message": formatGuestbookMessageItem(item, userIDValue, GetCurrentUserRole(c) == "admin"),
	})
}

// DeleteGuestbookMessage 删除留言（本人或管理员）
func DeleteGuestbookMessage(c *gin.Context) {
	db := database.GetDB()
	userID := model.Int64String(GetCurrentUserID(c))
	if userID == 0 {
		Error(c, http.StatusUnauthorized, "请先登录")
		return
	}

	id := strings.TrimSpace(c.Param("id"))
	if id == "" {
		Error(c, http.StatusBadRequest, "留言ID不能为空")
		return
	}

	var item model.GuestbookMessage
	if err := db.Where("id = ? AND deleted_at IS NULL", id).First(&item).Error; err != nil {
		Error(c, http.StatusNotFound, "留言不存在")
		return
	}

	isAdmin := GetCurrentUserRole(c) == "admin"
	isOwner := item.UserID != nil && *item.UserID == userID
	if !isAdmin && !isOwner {
		Error(c, http.StatusForbidden, "只能删除自己的留言")
		return
	}

	if err := db.Delete(&item).Error; err != nil {
		Error(c, http.StatusInternalServerError, "删除留言失败")
		return
	}

	Success(c, gin.H{
		"id":      item.ID,
		"deleted": true,
	})
}

// UpdateGuestbookMessagePin 更新留言置顶状态（仅管理员）
func UpdateGuestbookMessagePin(c *gin.Context) {
	if GetCurrentUserRole(c) != "admin" {
		Error(c, http.StatusForbidden, "仅管理员可设置置顶")
		return
	}

	id := strings.TrimSpace(c.Param("id"))
	if id == "" {
		Error(c, http.StatusBadRequest, "留言ID不能为空")
		return
	}

	var req updateGuestbookPinRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		Error(c, http.StatusBadRequest, "参数错误")
		return
	}

	db := database.GetDB()
	var item model.GuestbookMessage
	if err := db.Where("id = ? AND deleted_at IS NULL", id).First(&item).Error; err != nil {
		Error(c, http.StatusNotFound, "留言不存在")
		return
	}

	if err := db.Model(&item).Update("is_pinned", req.IsPinned).Error; err != nil {
		Error(c, http.StatusInternalServerError, "更新置顶状态失败")
		return
	}

	item.IsPinned = req.IsPinned
	viewerID := model.Int64String(GetCurrentUserID(c))
	Success(c, gin.H{
		"message": formatGuestbookMessageItem(item, viewerID, true),
	})
}
