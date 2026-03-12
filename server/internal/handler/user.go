package handler

import (
	"valley-server/internal/database"
	"valley-server/internal/model"
	"valley-server/internal/utils"

	"github.com/gin-gonic/gin"
)

// GetUserInfo 获取用户信息
func GetUserInfo(c *gin.Context) {
	userID, exists := c.Get("userId")
	if !exists {
		Error(c, 401, "未登录")
		return
	}

	var user model.User
	db := database.GetDB()
	if err := db.First(&user, userID).Error; err != nil {
		Error(c, 404, "用户不存在")
		return
	}

	// 统计下载次数
	var downloadCount int64
	db.Model(&model.DownloadRecord{}).Where("user_id = ?", userID).Count(&downloadCount)

	Success(c, gin.H{
		"id":            user.ID,
		"username":      user.Username,
		"nickname":      user.Nickname,
		"avatar":        user.Avatar,
		"role":          user.Role,
		"email":         user.Email,
		"phone":         user.Phone,
		"createdAt":     user.CreatedAt,
		"downloadCount": downloadCount,
	})
}

// UpdateMyProfile 用户更新自己的个人信息
func UpdateMyProfile(c *gin.Context) {
	userID, exists := c.Get("userId")
	if !exists {
		Error(c, 401, "未登录")
		return
	}

	var req struct {
		Nickname string `json:"nickname"`
		Avatar   string `json:"avatar"`
		Email    string `json:"email"`
		Phone    string `json:"phone"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		Error(c, 400, "参数错误")
		return
	}

	db := database.GetDB()
	var user model.User
	if err := db.First(&user, userID).Error; err != nil {
		Error(c, 404, "用户不存在")
		return
	}

	updates := map[string]interface{}{}
	if req.Nickname != "" {
		updates["nickname"] = req.Nickname
	}
	if req.Avatar != "" {
		updates["avatar"] = req.Avatar
	}
	if req.Email != "" {
		updates["email"] = req.Email
	}
	if req.Phone != "" {
		updates["phone"] = req.Phone
	}

	if err := db.Model(&user).Updates(updates).Error; err != nil {
		Error(c, 500, "更新失败")
		return
	}

	// 重新查询最新数据返回
	db.First(&user, userID)
	Success(c, gin.H{
		"id":       user.ID,
		"username": user.Username,
		"nickname": user.Nickname,
		"avatar":   user.Avatar,
		"role":     user.Role,
		"email":    user.Email,
		"phone":    user.Phone,
	})
}

// ChangePassword 用户修改密码
func ChangePassword(c *gin.Context) {
	userID, exists := c.Get("userId")
	if !exists {
		Error(c, 401, "未登录")
		return
	}

	var req struct {
		OldPassword string `json:"oldPassword" binding:"required"`
		NewPassword string `json:"newPassword" binding:"required,min=6"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		Error(c, 400, "参数错误：新密码至少6位")
		return
	}

	db := database.GetDB()
	var user model.User
	if err := db.First(&user, userID).Error; err != nil {
		Error(c, 404, "用户不存在")
		return
	}

	if !utils.CheckPassword(req.OldPassword, user.Password) {
		Error(c, 400, "原密码错误")
		return
	}

	hashed := utils.HashPassword(req.NewPassword)

	if err := db.Model(&user).Update("password", hashed).Error; err != nil {
		Error(c, 500, "修改密码失败")
		return
	}

	Success(c, nil)
}

// GetUserDownloads 获取用户下载记录
func GetUserDownloads(c *gin.Context) {
	Success(c, gin.H{
		"list":  []gin.H{},
		"total": 0,
	})
}

// RecordDownload 记录下载
func RecordDownload(c *gin.Context) {
	var req struct {
		ResourceID string `json:"resourceId" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		Error(c, 400, "参数错误")
		return
	}

	// TODO: 记录下载

	Success(c, nil)
}
