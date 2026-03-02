package handler

import (
	"valley-server/internal/database"
	"valley-server/internal/model"
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

	db := database.GetDB()
	var resources []model.Resource
	var total int64

	query := db.Model(&model.Resource{})
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
// @Description  管理员上传头像或壁纸资源
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

	// 验证文件类型
	allowedTypes := []string{".jpg", ".jpeg", ".png", ".webp"}
	if !utils.ValidateFileType(file.Filename, allowedTypes) {
		Error(c, 400, "只支持 JPG、PNG、WEBP 格式的图片")
		return
	}

	// 验证文件大小（头像最大 2MB，壁纸最大 5MB）
	maxSize := int64(2)
	if resourceType == "wallpaper" {
		maxSize = 5
	}
	if !utils.ValidateFileSize(file.Size, maxSize) {
		Error(c, 400, "文件过大")
		return
	}

	// 获取 TOS 上传器
	uploader := utils.GetTOSUploader()
	if uploader == nil {
		Error(c, 500, "文件上传服务未配置")
		return
	}

	// 上传到 TOS
	folder := "avatars"
	if resourceType == "wallpaper" {
		folder = "wallpapers"
	}
	url, err := uploader.UploadFile(folder, file)
	if err != nil {
		Error(c, 500, "文件上传失败: "+err.Error())
		return
	}

	// 获取当前登录用户 ID
	userID, exists := c.Get("userId")
	if !exists {
		Error(c, 401, "未授权")
		return
	}

	// 保存到数据库
	resource := model.Resource{
		ID:          model.Int64String(utils.GenerateID()),
		Type:        resourceType,
		URL:         url,
		Title:       file.Filename,
		Size:        file.Size,
		CreatorID:   model.Int64String(userID.(int64)),
		Description: "",
	}

	db := database.GetDB()
	if err := db.Create(&resource).Error; err != nil {
		// 如果数据库保存失败，删除已上传的文件
		_ = uploader.DeleteFile(uploader.ExtractKeyFromURL(url))
		Error(c, 500, "保存资源信息失败")
		return
	}

	Success(c, resource)
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

	// 从 TOS 删除文件
	uploader := utils.GetTOSUploader()
	if uploader != nil {
		key := uploader.ExtractKeyFromURL(resource.URL)
		_ = uploader.DeleteFile(key)
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
// @Description  管理员修改资源的上传者（CreatorID）
// @Tags         管理后台 - 资源管理
// @Accept       json
// @Produce      json
// @Security     Bearer
// @Param        id          path    string  true   "资源ID"
// @Param        creatorId   body    string  true   "新的上传者ID（用户ID）"
// @Success      200  {object}  map[string]interface{}  "更新成功"
// @Failure      400  {object}  map[string]interface{}  "参数错误"
// @Failure      401  {object}  map[string]interface{}  "未登录"
// @Failure      403  {object}  map[string]interface{}  "无权限"
// @Failure      404  {object}  map[string]interface{}  "资源不存在"
// @Router       /admin/resources/{id}/creator [put]
func UpdateResourceCreator(c *gin.Context) {
	id := c.Param("id")

	var req struct {
		CreatorID string `json:"creatorId" binding:"required"`
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
	if err := db.First(&user, "id = ?", req.CreatorID).Error; err != nil {
		Error(c, 404, "指定的用户不存在")
		return
	}

	// 更新上传者（使用 Scan 方法转换字符串）
	var creatorID model.Int64String
	if err := creatorID.Scan(req.CreatorID); err != nil {
		Error(c, 400, "用户ID格式错误："+err.Error())
		return
	}
	resource.CreatorID = creatorID

	if err := db.Save(&resource).Error; err != nil {
		Error(c, 500, "更新失败："+err.Error())
		return
	}

	// 重新加载资源并预加载用户信息
	db.Preload("User").First(&resource, "id = ?", id)

	Success(c, resource)
}
