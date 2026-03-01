package handler

import (
	"strconv"
	"valley-server/internal/database"
	"valley-server/internal/model"

	"github.com/gin-gonic/gin"
)

// ListUsers 用户列表（支持分页、关键词搜索、平台和角色筛选）
func ListUsers(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "20"))
	keyword := c.Query("keyword")
	platform := c.Query("platform")
	role := c.Query("role")

	var users []model.User
	var total int64

	query := database.DB.Model(&model.User{})

	// 关键词搜索（昵称、OpenID）
	if keyword != "" {
		query = query.Where("nickname LIKE ? OR openid LIKE ? OR douyin_openid LIKE ? OR wechat_openid LIKE ?",
			"%"+keyword+"%", "%"+keyword+"%", "%"+keyword+"%", "%"+keyword+"%")
	}

	// 平台筛选
	if platform != "" {
		query = query.Where("platform = ?", platform)
	}

	// 角色筛选
	if role != "" {
		query = query.Where("role = ?", role)
	}

	query.Count(&total)
	query.Order("created_at DESC").Offset((page - 1) * pageSize).Limit(pageSize).Find(&users)

	Success(c, gin.H{
		"list":  users,
		"total": total,
	})
}

// CreateUser 创建用户
func CreateUser(c *gin.Context) {
	var user model.User
	if err := c.ShouldBindJSON(&user); err != nil {
		Error(c, 400, "参数错误")
		return
	}
	if err := database.DB.Create(&user).Error; err != nil {
		Error(c, 500, "创建用户失败")
		return
	}
	Success(c, user)
}

// GetUserDetail 用户详情
func GetUserDetail(c *gin.Context) {
	id := c.Param("id")
	var user model.User
	if err := database.DB.First(&user, id).Error; err != nil {
		Error(c, 404, "用户不存在")
		return
	}
	Success(c, user)
}

// UpdateUser 更新用户
func UpdateUser(c *gin.Context) {
	id := c.Param("id")
	var user model.User
	if err := database.DB.First(&user, id).Error; err != nil {
		Error(c, 404, "用户不存在")
		return
	}

	if err := c.ShouldBindJSON(&user); err != nil {
		Error(c, 400, "参数错误")
		return
	}

	if err := database.DB.Save(&user).Error; err != nil {
		Error(c, 500, "更新用户失败")
		return
	}
	Success(c, user)
}

// DeleteUser 删除用户
func DeleteUser(c *gin.Context) {
	id := c.Param("id")
	if err := database.DB.Delete(&model.User{}, id).Error; err != nil {
		Error(c, 500, "删除用户失败")
		return
	}
	Success(c, nil)
}

// UpdateUserStatus 更新用户状态
func UpdateUserStatus(c *gin.Context) {
	id := c.Param("id")
	var req struct {
		IsActive bool `json:"isActive"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		Error(c, 400, "参数错误")
		return
	}

	if err := database.DB.Model(&model.User{}).Where("id = ?", id).Update("is_active", req.IsActive).Error; err != nil {
		Error(c, 500, "更新状态失败")
		return
	}
	Success(c, nil)
}
