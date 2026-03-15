package handler

import (
	"log"
	"valley-server/internal/database"
	"valley-server/internal/model"
	"valley-server/internal/service"
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

// UploadAvatar 上传用户头像
// @Summary      上传头像
// @Description  上传并更新当前用户头像
// @Tags         用户
// @Accept       multipart/form-data
// @Produce      json
// @Security     Bearer
// @Param        file  formData  file  true  "头像图片"
// @Success      200  {object}  map[string]interface{}  "上传成功，返回头像 URL"
// @Failure      400  {object}  map[string]interface{}  "参数错误"
// @Failure      401  {object}  map[string]interface{}  "未登录"
// @Router       /user/avatar [post]
func UploadAvatar(c *gin.Context) {
	userID, exists := c.Get("userId")
	if !exists {
		Error(c, 401, "未登录")
		return
	}

	file, err := c.FormFile("file")
	if err != nil {
		Error(c, 400, "请上传文件")
		return
	}

	// 限制大小 5MB
	if file.Size > 5*1024*1024 {
		Error(c, 400, "头像文件不能超过 5MB")
		return
	}

	uploadService := service.NewUploadService()
	config := service.GetDefaultConfig(service.UploadTypeUserAvatar)
	config.UserID = userID.(int64)

	result, err := uploadService.Upload(file, config)
	if err != nil {
		Error(c, 400, err.Error())
		return
	}

	// 更新用户头像字段
	db := database.GetDB()
	var user model.User
	if err := db.First(&user, userID).Error; err != nil {
		_ = uploadService.DeleteByKey(result.Key)
		Error(c, 404, "用户不存在")
		return
	}

	if err := db.Model(&user).Update("avatar", result.URL).Error; err != nil {
		_ = uploadService.DeleteByKey(result.Key)
		Error(c, 500, "更新头像失败")
		return
	}

	// 记录头像历史
	history := model.UserAvatarHistory{
		UserID:     model.Int64String(userID.(int64)),
		AvatarURL:  result.URL,
		StorageKey: result.Key,
	}
	if err := db.Create(&history).Error; err != nil {
		// 历史记录写入失败不影响主流程，仅打印日志
		log.Printf("[WARN] 写入头像历史记录失败: userId=%v, err=%v", userID, err)
	}

	Success(c, gin.H{
		"avatarUrl": result.URL,
	})
}
