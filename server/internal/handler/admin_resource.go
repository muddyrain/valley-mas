package handler

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"valley-server/internal/database"
	"valley-server/internal/model"
	"valley-server/internal/service"
	"valley-server/internal/utils"

	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"
	"gorm.io/gorm"
)

const resourceUploadHashDedupWindow = 10 * time.Minute

func truncateRunes(s string, max int) string {
	if max <= 0 || s == "" {
		return ""
	}
	runes := []rune(strings.TrimSpace(s))
	if len(runes) <= max {
		return string(runes)
	}
	return string(runes[:max])
}

func normalizeResourceVisibility(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "public":
		return "public"
	case "shared":
		return "shared"
	default:
		return "private"
	}
}

func normalizeUploadKey(value string) string {
	key := truncateRunes(strings.TrimSpace(value), 80)
	if key != "" {
		return key
	}
	return truncateRunes(fmt.Sprintf("legacy-%d", utils.GenerateID()), 80)
}

func findExistingResourceByUploadKey(
	db *gorm.DB,
	userID int64,
	uploadKey string,
) (*model.Resource, error) {
	if uploadKey == "" {
		return nil, nil
	}

	var resource model.Resource
	err := db.Where("user_id = ? AND upload_key = ? AND deleted_at IS NULL", userID, uploadKey).
		First(&resource).Error
	if err == nil {
		return &resource, nil
	}
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	return nil, err
}

func findRecentResourceByFileHash(
	db *gorm.DB,
	userID int64,
	fileHash string,
) (*model.Resource, error) {
	if strings.TrimSpace(fileHash) == "" {
		return nil, nil
	}

	var resource model.Resource
	err := db.Where(
		"user_id = ? AND file_hash = ? AND deleted_at IS NULL AND created_at >= ?",
		userID,
		fileHash,
		time.Now().Add(-resourceUploadHashDedupWindow),
	).
		Order("created_at DESC").
		First(&resource).Error
	if err == nil {
		return &resource, nil
	}
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	return nil, err
}

func respondResourceUploadSuccess(c *gin.Context, resource *model.Resource) {
	resource.FillThumbnailURL()
	Success(c, gin.H{
		"resource":    resource,
		"storagePath": resource.StorageKey,
	})
}

func isDuplicateResourceUploadError(err error) bool {
	if err == nil {
		return false
	}
	lower := strings.ToLower(err.Error())
	return strings.Contains(lower, "duplicate entry") ||
		strings.Contains(lower, "duplicate key value") ||
		strings.Contains(lower, "duplicated key")
}

func isRequestCanceledError(err error) bool {
	return errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded)
}

// fillResourceThumbnails 批量填充缩略图 URL（就地修改）
func fillResourceThumbnails(resources []model.Resource) {
	for i := range resources {
		resources[i].FillThumbnailURL()
	}
}

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
	keyword := strings.TrimSpace(c.Query("keyword"))
	uploaderID := strings.TrimSpace(c.Query("uploaderId"))
	albumID := strings.TrimSpace(c.Query("albumId"))

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
	} else if uploaderID != "" {
		query = query.Where("user_id = ?", uploaderID)
	}

	// 按专辑过滤
	if albumID != "" {
		query = query.
			Joins("JOIN creator_album_resources ON creator_album_resources.resource_id = resources.id").
			Where("creator_album_resources.creator_album_id = ?", albumID)
	}

	if resourceType != "" {
		query = query.Where("type = ?", resourceType)
	}
	if keyword != "" {
		like := "%" + keyword + "%"
		query = query.Where("title LIKE ? OR description LIKE ?", like, like)
	}

	countQuery := query
	countQuery.Count(&total)
	query.Preload("User").Preload("Tags").Offset(offset).Limit(pageSize).Order("created_at DESC").Find(&resources)
	fillResourceThumbnails(resources)

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
	userIDInt64 := userID.(int64)
	uploadKey := normalizeUploadKey(c.PostForm("uploadKey"))
	db := database.GetDB()

	existingByUploadKey, err := findExistingResourceByUploadKey(db, userIDInt64, uploadKey)
	if err != nil {
		ErrorWithDetail(c, 500, "查询上传状态失败", err, logrus.Fields{
			"user_id":    userIDInt64,
			"upload_key": uploadKey,
			"file_name":  file.Filename,
		})
		return
	}
	if existingByUploadKey != nil {
		respondResourceUploadSuccess(c, existingByUploadKey)
		return
	}

	// 创建上传服务
	uploadService := service.NewUploadService()

	// 获取上传配置
	uploadType := service.UploadType(resourceType)
	config := service.GetDefaultConfig(uploadType)
	config.UserID = userIDInt64 // 设置用户ID，用于生成用户专属目录

	// 上传文件
	requestCtx := c.Request.Context()
	result, err := uploadService.UploadWithContext(requestCtx, file, config)
	if err != nil {
		if isRequestCanceledError(err) {
			logrus.WithError(err).WithFields(logrus.Fields{
				"user_id":    userIDInt64,
				"upload_key": uploadKey,
				"file_name":  file.Filename,
			}).Warn("resource upload canceled before completion")
			return
		}
		Error(c, 400, err.Error())
		return
	}
	if err := requestCtx.Err(); err != nil {
		_ = uploadService.DeleteByKey(result.Key)
		logrus.WithError(err).WithFields(logrus.Fields{
			"user_id":     userIDInt64,
			"upload_key":  uploadKey,
			"file_name":   file.Filename,
			"storage_key": result.Key,
		}).Warn("resource upload canceled after object upload")
		return
	}

	// 保存到数据库
	title := strings.TrimSpace(c.PostForm("title"))
	description := strings.TrimSpace(c.PostForm("description"))
	if title == "" {
		title = strings.TrimSuffix(file.Filename, result.Ext)
	}

	resource := model.Resource{
		ID:          model.Int64String(utils.GenerateID()),
		Type:        resourceType,
		Visibility:  normalizeResourceVisibility(c.PostForm("visibility")),
		URL:         result.URL,
		StorageKey:  result.Key,
		UploadKey:   uploadKey,
		FileHash:    result.FileHash,
		Title:       truncateRunes(title, 100),
		Description: truncateRunes(description, 255),
		Size:        file.Size,
		Width:       result.Width,
		Height:      result.Height,
		Extension:   truncateRunes(strings.TrimPrefix(result.Ext, "."), 20), // 去掉前导点，并限制长度
		UserID:      model.Int64String(userIDInt64),
	}

	existingByHash, err := findRecentResourceByFileHash(db, userIDInt64, result.FileHash)
	if err != nil {
		_ = uploadService.DeleteByKey(result.Key)
		ErrorWithDetail(c, 500, "查询重复资源失败", err, logrus.Fields{
			"user_id":     userIDInt64,
			"upload_key":  uploadKey,
			"file_hash":   result.FileHash,
			"storage_key": result.Key,
		})
		return
	}
	if existingByHash != nil {
		_ = uploadService.DeleteByKey(result.Key)
		respondResourceUploadSuccess(c, existingByHash)
		return
	}

	if err := db.Create(&resource).Error; err != nil {
		// 如果数据库保存失败，删除已上传的文件
		_ = uploadService.DeleteByKey(result.Key)
		if isDuplicateResourceUploadError(err) {
			existing, lookupErr := findExistingResourceByUploadKey(db, userIDInt64, uploadKey)
			if lookupErr == nil && existing != nil {
				respondResourceUploadSuccess(c, existing)
				return
			}
		}
		ErrorWithDetail(c, 500, "保存资源信息失败", err, logrus.Fields{
			"user_id":     userIDInt64,
			"upload_key":  uploadKey,
			"file_hash":   result.FileHash,
			"title":       resource.Title,
			"description": resource.Description,
			"extension":   resource.Extension,
			"file_name":   file.Filename,
			"file_size":   file.Size,
			"storage_key": result.Key,
		})
		return
	}

	invalidatePublicResourceListCache()
	respondResourceUploadSuccess(c, &resource)
}

// GetUploadResourceStatus 查询上传幂等键对应的资源状态。
func GetUploadResourceStatus(c *gin.Context) {
	userID := GetCurrentUserID(c)
	if userID == 0 {
		Error(c, 401, "未授权")
		return
	}

	uploadKey := normalizeUploadKey(c.Query("uploadKey"))
	if strings.TrimSpace(c.Query("uploadKey")) == "" {
		Error(c, 400, "uploadKey 不能为空")
		return
	}

	db := database.GetDB()
	resource, err := findExistingResourceByUploadKey(db, userID, uploadKey)
	if err != nil {
		ErrorWithDetail(c, 500, "查询上传状态失败", err, logrus.Fields{
			"user_id":    userID,
			"upload_key": uploadKey,
		})
		return
	}

	if resource == nil {
		Success(c, gin.H{"found": false})
		return
	}

	resource.FillThumbnailURL()
	Success(c, gin.H{
		"found":    true,
		"resource": resource,
	})
}

// DeleteResource 删除资源
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
	affectedAlbumIDs, err := collectAlbumIDsByResourceIDs(db, []model.Int64String{resource.ID})
	if err != nil {
		logrus.WithField("error", err).Error("DeleteResource collect affected albums failed")
		Error(c, 500, "删除失败："+err.Error())
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
		logrus.WithField("error", err).Error("AdminDeleteResource db delete failed")
		Error(c, 500, "删除失败："+err.Error())
		return
	}
	if err := reconcileAlbumCoverResourceByAlbumIDs(db, affectedAlbumIDs); err != nil {
		logrus.WithField("error", err).Error("DeleteResource reconcile album cover failed")
		Error(c, 500, "删除失败："+err.Error())
		return
	}

	invalidatePublicResourceListCache()
	Success(c, nil)
}

// BatchDeleteResources 批量删除资源（创作者只能删自己的）
// DELETE /creator/resources/batch
func BatchDeleteResources(c *gin.Context) {
	userRole, _ := c.Get("userRole")
	userID, _ := c.Get("userId")

	var req struct {
		IDs []string `json:"ids" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || len(req.IDs) == 0 {
		Error(c, 400, "参数错误：ids 不能为空")
		return
	}
	if len(req.IDs) > 100 {
		Error(c, 400, "单次最多批量删除 100 个")
		return
	}

	db := database.GetDB()
	uploadService := service.NewUploadService()

	var resources []model.Resource
	query := db.Where("id IN ?", req.IDs)
	if userRole == "creator" {
		query = query.Where("user_id = ?", userID)
	}
	if err := query.Find(&resources).Error; err != nil {
		logrus.WithField("error", err).Error("BatchDeleteResources query failed")
		Error(c, 500, "查询资源失败："+err.Error())
		return
	}
	if len(resources) == 0 {
		Error(c, 404, "未找到可删除的资源")
		return
	}
	resourceIDs := make([]model.Int64String, 0, len(resources))
	for _, resource := range resources {
		resourceIDs = append(resourceIDs, resource.ID)
	}
	affectedAlbumIDs, err := collectAlbumIDsByResourceIDs(db, resourceIDs)
	if err != nil {
		logrus.WithField("error", err).Error("BatchDeleteResources collect affected albums failed")
		Error(c, 500, "批量删除失败："+err.Error())
		return
	}

	deletedCount := 0
	for _, resource := range resources {
		// 删除存储文件（失败不阻断）
		if resource.StorageKey != "" {
			if err := uploadService.DeleteByKey(resource.StorageKey); err != nil {
				logrus.Warnf("批量删除：删除文件失败 key=%s err=%v", resource.StorageKey, err)
			}
		} else if resource.URL != "" {
			if err := uploadService.Delete(resource.URL); err != nil {
				logrus.Warnf("批量删除：删除文件失败 url=%s err=%v", resource.URL, err)
			}
		}
		if err := db.Delete(&resource).Error; err != nil {
			logrus.Warnf("批量删除：删除记录失败 id=%v err=%v", resource.ID, err)
			continue
		}
		deletedCount++
	}
	if err := reconcileAlbumCoverResourceByAlbumIDs(db, affectedAlbumIDs); err != nil {
		logrus.WithField("error", err).Error("BatchDeleteResources reconcile album cover failed")
		Error(c, 500, "批量删除失败："+err.Error())
		return
	}

	invalidatePublicResourceListCache()
	Success(c, gin.H{"deleted": deletedCount})
}

// BatchUpdateVisibility 批量设置资源访问范围（创作者只能改自己的）
// POST /creator/resources/batch-visibility
func BatchUpdateVisibility(c *gin.Context) {
	userRole, _ := c.Get("userRole")
	userID, _ := c.Get("userId")

	var req struct {
		IDs        []string `json:"ids" binding:"required"`
		Visibility string   `json:"visibility" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || len(req.IDs) == 0 {
		Error(c, 400, "参数错误：ids 和 visibility 不能为空")
		return
	}
	if len(req.IDs) > 100 {
		Error(c, 400, "单次最多批量修改 100 个")
		return
	}

	normalized := normalizeResourceVisibility(req.Visibility)
	db := database.GetDB()

	query := db.Model(&model.Resource{}).Where("id IN ?", req.IDs)
	if userRole == "creator" {
		query = query.Where("user_id = ?", userID)
	}
	result := query.Update("visibility", normalized)
	if result.Error != nil {
		Error(c, 500, "批量更新失败："+result.Error.Error())
		return
	}

	invalidatePublicResourceListCache()
	Success(c, gin.H{"updated": result.RowsAffected})
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

	invalidatePublicResourceListCache()
	Success(c, resource)
}

// UpdateResource 修改资源元数据（标题、描述、类型）
// @Summary      修改资源
// @Description  创作者或管理员修改资源的标题、描述、类型
// @Tags         管理后台 - 资源管理
// @Accept       json
// @Produce      json
// @Security     Bearer
// @Param        id    path  string  true  "资源ID"
// @Param        body  body  object  true  "修改内容"
// @Success      200  {object}  map[string]interface{}  "修改成功"
// @Failure      400  {object}  map[string]interface{}  "参数错误"
// @Failure      401  {object}  map[string]interface{}  "未登录"
// @Failure      403  {object}  map[string]interface{}  "无权限"
// @Failure      404  {object}  map[string]interface{}  "资源不存在"
// @Router       /admin/resources/{id} [patch]
func UpdateResource(c *gin.Context) {
	id := c.Param("id")

	var req struct {
		Title       string `json:"title"`
		Description string `json:"description"`
		Type        string `json:"type"`
		Visibility  string `json:"visibility"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		Error(c, 400, "参数错误："+err.Error())
		return
	}

	db := database.GetDB()
	var resource model.Resource
	if err := db.First(&resource, "id = ?", id).Error; err != nil {
		Error(c, 404, "资源不存在")
		return
	}

	// 权限：创作者只能改自己的资源，管理员可以改所有
	userRole, _ := c.Get("userRole")
	userID, _ := c.Get("userId")
	if userRole == "creator" && int64(resource.UserID) != userID.(int64) {
		Error(c, 403, "无权限修改他人资源")
		return
	}

	// 只更新允许修改的字段（空字符串不覆盖）
	updates := map[string]interface{}{}
	if req.Title != "" {
		updates["title"] = req.Title
	}
	if req.Description != "" {
		updates["description"] = req.Description
	}
	if req.Type != "" {
		validTypes := map[string]bool{"wallpaper": true, "avatar": true, "emoji": true, "background": true, "dynamic": true}
		if !validTypes[req.Type] {
			Error(c, 400, "无效的资源类型")
			return
		}
		updates["type"] = req.Type
	}
	if req.Visibility != "" {
		updates["visibility"] = normalizeResourceVisibility(req.Visibility)
	}

	if len(updates) == 0 {
		Error(c, 400, "没有可更新的字段")
		return
	}

	if err := db.Model(&resource).Updates(updates).Error; err != nil {
		Error(c, 500, "更新失败："+err.Error())
		return
	}

	// 返回最新数据
	db.Preload("Tags").First(&resource, "id = ?", id)
	resource.FillThumbnailURL()
	invalidatePublicResourceListCache()
	Success(c, gin.H{
		"id":          resource.ID,
		"title":       resource.Title,
		"description": resource.Description,
		"type":        resource.Type,
		"tags":        resource.Tags,
	})
}
