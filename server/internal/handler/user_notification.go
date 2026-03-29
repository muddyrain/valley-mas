package handler

import (
	"net/http"
	"time"
	"valley-server/internal/database"
	"valley-server/internal/model"

	"github.com/gin-gonic/gin"
)

// ListMyNotifications 获取当前用户通知列表
func ListMyNotifications(c *gin.Context) {
	db := database.DB
	userID := model.Int64String(GetCurrentUserID(c))
	if userID == 0 {
		Error(c, http.StatusUnauthorized, "未登录")
		return
	}

	page := GetIntQuery(c, "page", 1)
	pageSize := GetIntQuery(c, "pageSize", 20)
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	offset := (page - 1) * pageSize

	var total int64
	if err := db.Model(&model.UserNotification{}).
		Where("user_id = ?", userID).
		Count(&total).Error; err != nil {
		Error(c, http.StatusInternalServerError, "查询通知失败")
		return
	}

	var list []model.UserNotification
	if err := db.Where("user_id = ?", userID).
		Order("is_read ASC, created_at DESC").
		Offset(offset).Limit(pageSize).
		Find(&list).Error; err != nil {
		Error(c, http.StatusInternalServerError, "查询通知失败")
		return
	}

	Success(c, gin.H{
		"list":     list,
		"total":    total,
		"page":     page,
		"pageSize": pageSize,
	})
}

// GetUnreadNotificationCount 获取未读通知数量
func GetUnreadNotificationCount(c *gin.Context) {
	db := database.DB
	userID := model.Int64String(GetCurrentUserID(c))
	if userID == 0 {
		Error(c, http.StatusUnauthorized, "未登录")
		return
	}

	var unread int64
	if err := db.Model(&model.UserNotification{}).
		Where("user_id = ? AND is_read = ?", userID, false).
		Count(&unread).Error; err != nil {
		Error(c, http.StatusInternalServerError, "查询未读通知失败")
		return
	}

	Success(c, gin.H{"unread": unread})
}

// MarkNotificationRead 将单条通知标记已读
func MarkNotificationRead(c *gin.Context) {
	db := database.DB
	userID := model.Int64String(GetCurrentUserID(c))
	if userID == 0 {
		Error(c, http.StatusUnauthorized, "未登录")
		return
	}

	id := c.Param("id")
	if id == "" {
		Error(c, http.StatusBadRequest, "通知ID不能为空")
		return
	}

	var item model.UserNotification
	if err := db.Where("id = ? AND user_id = ?", id, userID).First(&item).Error; err != nil {
		Error(c, http.StatusNotFound, "通知不存在")
		return
	}

	if !item.IsRead {
		now := time.Now()
		if err := db.Model(&item).Updates(map[string]interface{}{
			"is_read": true,
			"read_at": &now,
		}).Error; err != nil {
			Error(c, http.StatusInternalServerError, "更新通知失败")
			return
		}
	}

	Success(c, gin.H{"id": item.ID, "isRead": true})
}

// MarkAllNotificationsRead 全部标记已读
func MarkAllNotificationsRead(c *gin.Context) {
	db := database.DB
	userID := model.Int64String(GetCurrentUserID(c))
	if userID == 0 {
		Error(c, http.StatusUnauthorized, "未登录")
		return
	}

	now := time.Now()
	if err := db.Model(&model.UserNotification{}).
		Where("user_id = ? AND is_read = ?", userID, false).
		Updates(map[string]interface{}{
			"is_read": true,
			"read_at": &now,
		}).Error; err != nil {
		Error(c, http.StatusInternalServerError, "更新通知失败")
		return
	}

	Success(c, gin.H{"ok": true})
}
