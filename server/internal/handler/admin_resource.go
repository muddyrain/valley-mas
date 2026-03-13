package handler

import (
	"valley-server/internal/database"
	"valley-server/internal/model"
	"valley-server/internal/service"
	"valley-server/internal/utils"

	"github.com/gin-gonic/gin"
)

// ListResources 资源列表
// @Summary      获取资源列表
// @Description  管理员查看所有资源列表
// @Tags         管理后台 - 资源管理
// @Accept       json
// @Produce      json
// @Security     Bearer
// @Param        page      query  int     false  "页码"  default(1)
// @Param        pageSize  query  int     false  "每页数量"  default(20)
// @Param        type      query  string  false  "资源类型"  Enums(avatar, wallpaper)
// @Success      200  {object}  map[string]interface{}  "资源列表"
// @Failure      401  {object}  map[string]interface{}  "未登录"
// @Failure      403  {object}  map[string]interface{}  "无权限"
// @Router       /admin/resources [get]
func ListResources(c *gin.Context) {
	page := GetIntQuery(c, "page", 1)
	pageSize := GetIntQuery(c, "pageSize", 20)
	resourceType := c.Query("type")

	offset := (page - 1) * pageSize

	// 获取当前用户信息
	userRole, _ := c.Get("userRole")
	userId, _ := c.Get("userId")

	db := database.GetDB()
	var resources []model.Resource
	var total int64

	query := db.Model(&model.Resource{})

	// 🔒 如果是创作者角色，只能查看自己上传的资源
	if userRole == "creator" {
		query = query.Where("user_id = ?", userId)
	}

	if resourceType != "" {
		query = query.Where("type = ?", resourceType)
	}

	query.Count(&total)
	query.Preload("User").Offset(offset).Limit(pageSize).Order("created_at DESC").Find(&resources)

	Success(c, gin.H{
		"list":  resources,
		"total": total,
	})
}

// UploadResource 上传资源
// @Summary      上传资源
// @Description  管理员上传头像或壁纸资源（按用户目录分类存储）
// @Tags         管理后台 - 资源管理
// @Accept       multipart/form-data
// @Produce      json
// @Security     Bearer
// @Param        file  formData  file    true   "资源文件"
// @Param        type  formData  string  true   "资源类型"  Enums(avatar, wallpaper)
// @Success      200  {object}  map[string]interface{}  "上传成功"
// @Failure      401  {object}  map[string]interface{}  "未登录"
// @Failure      403  {object}  map[string]interface{}  "无权限"
// @Router       /admin/resources/upload [post]
func UploadResource(c *gin.Context) {
	resourceType := c.PostForm("type")
	if resourceType != "avatar" && resourceType != "wallpaper" {
		Error(c, 400, "资源类型必须是 avatar 或 wallpaper")
		return
	}

	// 获取上传的文件
	file, err := c.FormFile("file")
	if err != nil {
		Error(c, 400, "请上传文件")
		return
	}

	// 获取当前登录用户 ID（作为资源的上传者）
	userID, exists := c.Get("userId")
	if !exists {
		Error(c, 401, "未授权")
		return
	}

	// 创建上传服务
	uploadService := service.NewUploadService()

	// 获取上传配置
	uploadType := service.UploadType(resourceType)
	config := service.GetDefaultConfig(uploadType)
	config.UserID = userID.(int64) // 设置用户ID，用于生成用户专属目录

	// 上传文件
	result, err := uploadService.Upload(file, config)
	if err != nil {
		Error(c, 400, err.Error())
		return
	}

	// 保存到数据库
	resource := model.Resource{
		ID:          model.Int64String(utils.GenerateID()),
		Type:        resourceType,
		URL:         result.URL,
		StorageKey:  result.Key, // 保存对象存储键名
		Title:       file.Filename,
		Size:        file.Size,
		UserID:      model.Int64String(userID.(int64)),
		Description: "",
	}

	db := database.GetDB()
	if err := db.Create(&resource).Error; err != nil {
		// 如果数据库保存失败，删除已上传的文件
		_ = uploadService.DeleteByKey(result.Key)
		Error(c, 500, "保存资源信息失败")
		return
	}

	Success(c, gin.H{
		"resource":    resource,
		"storagePath": result.Key, // 返回存储路径，便于调试
	})
}

// DeleteResource 删除资源
// @Summary      删除资源
// @Description  管理员删除资源
// @Tags         管理后台 - 资源管理
// @Accept       json
// @Produce      json
// @Security     Bearer
// @Param        id  path  string  true  "资源ID"
// @Success      200  {object}  map[string]interface{}  "删除成功"
// @Failure      401  {object}  map[string]interface{}  "未登录"
// @Failure      403  {object}  map[string]interface{}  "无权限"
// @Router       /admin/resources/{id} [delete]
func DeleteResource(c *gin.Context) {
	id := c.Param("id")

	db := database.GetDB()
	var resource model.Resource

	// 查找资源
	if err := db.First(&resource, "id = ?", id).Error; err != nil {
		Error(c, 404, "资源不存在")
		return
	}

	// 使用上传服务删除文件
	uploadService := service.NewUploadService()

	// 优先使用 StorageKey，如果没有则从 URL 提取（兼容旧数据）
	if resource.StorageKey != "" {
		if err := uploadService.DeleteByKey(resource.StorageKey); err != nil {
			// 即使删除文件失败，也继续删除数据库记录（打印日志）
			println("警告: 删除文件失败:", err.Error())
		}
	} else {
		// 兼容旧数据：从 URL 提取 Key
		if err := uploadService.Delete(resource.URL); err != nil {
			println("警告: 删除文件失败:", err.Error())
		}
	}

	// 从数据库软删除
	if err := db.Delete(&resource).Error; err != nil {
		Error(c, 500, "删除失败")
		return
	}

	Success(c, nil)
}

// UpdateResourceCreator 更新资源的上传者
// @Summary      更新资源上传者
// @Description  管理员修改资源的上传者（将资源分配给特定用户）
// @Tags         管理后台 - 资源管理
// @Accept       json
// @Produce      json
// @Security     Bearer
// @Param        id          path    string  true   "资源ID"
// @Param        uploaderId  body    string  true   "新的上传者ID（用户 User.ID）"
// @Success      200  {object}  map[string]interface{}  "更新成功"
// @Failure      400  {object}  map[string]interface{}  "参数错误"
// @Failure      401  {object}  map[string]interface{}  "未登录"
// @Failure      403  {object}  map[string]interface{}  "无权限"
// @Failure      404  {object}  map[string]interface{}  "资源不存在"
// @Router       /admin/resources/{id}/creator [put]
func UpdateResourceCreator(c *gin.Context) {
	id := c.Param("id")

	var req struct {
		UploaderID string `json:"uploaderId" binding:"required"` // API 使用 uploaderId
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		Error(c, 400, "参数错误："+err.Error())
		return
	}

	db := database.GetDB()
	var resource model.Resource

	// 查找资源
	if err := db.First(&resource, "id = ?", id).Error; err != nil {
		Error(c, 404, "资源不存在")
		return
	}

	// 验证新的上传者是否存在
	var user model.User
	if err := db.First(&user, "id = ?", req.UploaderID).Error; err != nil {
		Error(c, 404, "指定的用户不存在")
		return
	}

	// 更新上传者（使用 Scan 方法转换字符串）
	var uploaderID model.Int64String
	if err := uploaderID.Scan(req.UploaderID); err != nil {
		Error(c, 400, "用户ID格式错误："+err.Error())
		return
	}
	resource.UserID = uploaderID

	if err := db.Save(&resource).Error; err != nil {
		Error(c, 500, "更新失败："+err.Error())
		return
	}

	// 重新加载资源并预加载用户信息
	db.Preload("User").First(&resource, "id = ?", id)

	Success(c, resource)
}
