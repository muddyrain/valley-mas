package handler

import (
	"strconv"
	"valley-server/internal/database"
	"valley-server/internal/model"

	"github.com/gin-gonic/gin"
)

// ListUsers 用户列表（支持分页、关键词搜索、平台和角色筛选）
// @Summary      获取用户列表
// @Description  支持分页、关键词搜索、平台筛选、角色筛选
// @Tags         管理后台 - 用户管理
// @Accept       json
// @Produce      json
// @Security     Bearer
// @Param        page      query     int     false  "页码"  default(1)
// @Param        pageSize  query     int     false  "每页数量"  default(20)
// @Param        keyword   query     string  false  "关键词搜索（昵称/OpenID）"
// @Param        platform  query     string  false  "平台筛选"  Enums(wechat, douyin, all)
// @Param        role      query     string  false  "角色筛选"  Enums(user, creator, admin)
// @Success      200  {object}  map[string]interface{}  "用户列表"
// @Failure      401  {object}  map[string]interface{}  "未登录"
// @Failure      403  {object}  map[string]interface{}  "无权限"
// @Router       /admin/users [get]
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
// @Summary      创建用户
// @Description  管理员创建新用户
// @Tags         管理后台 - 用户管理
// @Accept       json
// @Produce      json
// @Security     Bearer
// @Param        user  body      model.User  true  "用户信息"
// @Success      200   {object}  map[string]interface{}  "创建成功"
// @Failure      400   {object}  map[string]interface{}  "参数错误"
// @Failure      401   {object}  map[string]interface{}  "未登录"
// @Failure      403   {object}  map[string]interface{}  "无权限"
// @Router       /admin/users [post]
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
// @Summary      获取用户详情
// @Description  根据用户ID获取详细信息
// @Tags         管理后台 - 用户管理
// @Accept       json
// @Produce      json
// @Security     Bearer
// @Param        id   path      string  true  "用户ID"
// @Success      200  {object}  map[string]interface{}  "用户详情"
// @Failure      404  {object}  map[string]interface{}  "用户不存在"
// @Failure      401  {object}  map[string]interface{}  "未登录"
// @Failure      403  {object}  map[string]interface{}  "无权限"
// @Router       /admin/users/{id} [get]
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
// @Summary      更新用户信息
// @Description  管理员更新用户信息
// @Tags         管理后台 - 用户管理
// @Accept       json
// @Produce      json
// @Security     Bearer
// @Param        id    path      string      true  "用户ID"
// @Param        user  body      model.User  true  "用户信息"
// @Success      200   {object}  map[string]interface{}  "更新成功"
// @Failure      400   {object}  map[string]interface{}  "参数错误"
// @Failure      404   {object}  map[string]interface{}  "用户不存在"
// @Failure      401   {object}  map[string]interface{}  "未登录"
// @Failure      403   {object}  map[string]interface{}  "无权限"
// @Router       /admin/users/{id} [put]
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
// @Summary      删除用户
// @Description  管理员删除用户（软删除）
// @Tags         管理后台 - 用户管理
// @Accept       json
// @Produce      json
// @Security     Bearer
// @Param        id   path      string  true  "用户ID"
// @Success      200  {object}  map[string]interface{}  "删除成功"
// @Failure      500  {object}  map[string]interface{}  "删除失败"
// @Failure      401  {object}  map[string]interface{}  "未登录"
// @Failure      403  {object}  map[string]interface{}  "无权限"
// @Router       /admin/users/{id} [delete]
func DeleteUser(c *gin.Context) {
	id := c.Param("id")
	if err := database.DB.Delete(&model.User{}, id).Error; err != nil {
		Error(c, 500, "删除用户失败")
		return
	}
	Success(c, nil)
}

// UpdateUserStatus 更新用户状态
// @Summary      更新用户状态
// @Description  启用或禁用用户
// @Tags         管理后台 - 用户管理
// @Accept       json
// @Produce      json
// @Security     Bearer
// @Param        id   path      string  true  "用户ID"
// @Param        status  body   object{isActive=bool}  true  "状态"
// @Success      200  {object}  map[string]interface{}  "更新成功"
// @Failure      400  {object}  map[string]interface{}  "参数错误"
// @Failure      404  {object}  map[string]interface{}  "用户不存在"
// @Failure      401  {object}  map[string]interface{}  "未登录"
// @Failure      403  {object}  map[string]interface{}  "无权限"
// @Router       /admin/users/{id}/status [put]
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
