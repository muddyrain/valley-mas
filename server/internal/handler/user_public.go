package handler

import (
	"net/http"
	"strconv"
	"strings"
	"valley-server/internal/database"
	"valley-server/internal/logger"
	"valley-server/internal/model"
	"valley-server/internal/utils"

	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"
)

// GetUserSpace 获取用户空间信息（公开接口，用户端）
// @Summary      获取用户空间
// @Description  通过用户ID获取用户空间信息，包含资源列表
// @Tags         用户端 - 公开接口
// @Accept       json
// @Produce      json
// @Param        id  path  string  true  "用户ID"
// @Success      200  {object}  map[string]interface{}  "空间信息"
// @Failure      404  {object}  map[string]interface{}  "空间不存在"
// @Router       /public/users/{id}/space [get]
func GetUserSpace(c *gin.Context) {
	// 空间功能已下线
	Error(c, http.StatusNotFound, "空间功能已下线")
}

// DownloadResource 下载资源（公开接口，暂时不需要广告令牌）
// @Summary      下载资源
// @Description  用户下载资源，记录下载行为
// @Tags         用户端 - 公开接口
// @Accept       json
// @Produce      json
// @Param        id  path  string  true  "资源ID"
// @Success      200  {object}  map[string]interface{}  "下载链接"
// @Failure      404  {object}  map[string]interface{}  "资源不存在"
// @Router       /public/resource/{id}/download [post]
func DownloadResource(c *gin.Context) {
	resourceID := c.Param("id")

	db := database.GetDB()

	// 查找资源
	var resource model.Resource
	if err := db.Where("id = ?", resourceID).
		Where("(visibility = ? OR visibility IS NULL OR visibility = '')", "public").
		First(&resource).Error; err != nil {
		Error(c, http.StatusNotFound, "资源不存在")
		return
	}

	// 获取当前用户ID（如果已登录）
	var userID model.Int64String
	if uid, exists := c.Get("userId"); exists {
		if id, ok := uid.(int64); ok {
			userID = model.Int64String(id)
		}
	}

	// 记录下载行为
	downloadRecord := model.DownloadRecord{
		ID:         model.Int64String(utils.GenerateID()),
		UserID:     userID, // 如果未登录则为 0
		ResourceID: resource.ID,
		IP:         c.ClientIP(),
		UserAgent:  c.GetHeader("User-Agent"),
	}

	if err := db.Create(&downloadRecord).Error; err != nil {
		ErrorWithDetail(c, 500, "创建下载记录失败", err, logrus.Fields{
			"resource_id": resourceID,
			"user_id":     userID,
		})
		// 记录失败不影响下载，继续返回下载链接
		logger.Warn(c, "Failed to create download record, but continue download", logrus.Fields{
			"resource_id": resourceID,
			"error":       err.Error(),
		})
	}

	// 增加资源下载次数
	db.Model(&resource).Update("download_count", resource.DownloadCount+1)

	logger.Info(c, "Resource downloaded", logrus.Fields{
		"resource_id":    resourceID,
		"user_id":        userID,
		"download_count": resource.DownloadCount + 1,
	})

	// 返回下载链接（直接返回 TOS URL）
	Success(c, gin.H{
		"downloadUrl": resource.URL,
		"resource": gin.H{
			"id":    resource.ID,
			"title": resource.Title,
			"type":  resource.Type,
			"size":  resource.Size,
		},
	})
}

// GetMyDownloads 获取我的下载记录（需要登录）
// @Summary      获取我的下载记录
// @Description  用户查看自己的下载历史
// @Tags         用户端 - 我的
// @Accept       json
// @Produce      json
// @Security     Bearer
// @Param        page      query  int  false  "页码"  default(1)
// @Param        pageSize  query  int  false  "每页数量"  default(20)
// @Success      200  {object}  map[string]interface{}  "下载记录"
// @Failure      401  {object}  map[string]interface{}  "未登录"
// @Router       /user/downloads [get]
func GetMyDownloads(c *gin.Context) {
	userID, exists := c.Get("userId")
	if !exists {
		Error(c, 401, "未登录")
		return
	}

	page := GetIntQuery(c, "page", 1)
	pageSize := GetIntQuery(c, "pageSize", 20)
	offset := (page - 1) * pageSize

	db := database.GetDB()

	var records []model.DownloadRecord
	var total int64

	query := db.Model(&model.DownloadRecord{}).Where("user_id = ?", userID)
	query.Count(&total)
	query.Preload("Resource").
		Preload("User").
		Offset(offset).
		Limit(pageSize).
		Order("created_at DESC").
		Find(&records)

	// 填充缩略图 URL（Resource.ThumbnailURL 不存储在数据库中，需要动态生成）
	for i := range records {
		if records[i].Resource != nil {
			records[i].Resource.FillThumbnailURL()
		}
	}

	Success(c, gin.H{
		"list":  records,
		"total": total,
	})
}

// GetUserResourcesList 获取用户的资源列表（公开接口）
// @Summary      获取用户资源列表
// @Description  通过用户ID获取该用户的所有资源
// @Tags         用户端 - 公开接口
// @Accept       json
// @Produce      json
// @Param        id        path   string  true   "用户ID"
// @Param        page      query  int     false  "页码"      default(1)
// @Param        pageSize  query  int     false  "每页数量"  default(20)
// @Param        type      query  string  false  "资源类型(avatar/wallpaper)"
// @Success      200  {object}  map[string]interface{}  "资源列表"
// @Failure      404  {object}  map[string]interface{}  "用户不存在"
// @Router       /public/users/{id}/resources [get]
func GetUserResourcesList(c *gin.Context) {
	logger.SkipOperationLog(c)
	setPublicListCacheHeaders(c)

	userIDStr := c.Param("id")
	page := GetIntQuery(c, "page", 1)
	pageSize := GetIntQuery(c, "pageSize", 20)
	resourceType := c.Query("type")
	keyword := c.Query("keyword")
	albumIDRaw := strings.TrimSpace(c.Query("albumId"))

	if pageSize > 50 {
		pageSize = 50
	}
	offset := (page - 1) * pageSize

	db := database.GetDB()

	// 验证用户是否存在
	var targetUser model.User
	targetUserID := model.Int64String(0)
	if err := targetUserID.Scan(userIDStr); err != nil {
		Error(c, http.StatusBadRequest, "用户ID格式错误")
		return
	}
	if err := db.Where("id = ? AND deleted_at IS NULL", targetUserID).First(&targetUser).Error; err != nil {
		Error(c, http.StatusNotFound, "用户不存在")
		return
	}

	// 查询资源
	query := db.Model(&model.Resource{}).
		Where("resources.user_id = ? AND resources.deleted_at IS NULL", targetUserID).
		Where("(resources.visibility = ? OR resources.visibility IS NULL OR resources.visibility = '')", "public")

	// 按类型筛选
	if resourceType != "" {
		query = query.Where("resources.type = ?", resourceType)
	}

	// 关键词搜索（匹配标题或描述）
	if keyword != "" {
		like := "%" + keyword + "%"
		query = query.Where("resources.title LIKE ? OR resources.description LIKE ?", like, like)
	}

	if albumIDRaw != "" {
		var albumID model.Int64String
		if err := albumID.Scan(albumIDRaw); err != nil {
			Error(c, http.StatusBadRequest, "专辑ID格式错误")
			return
		}
		query = query.
			Joins("JOIN user_album_resources ON user_album_resources.resource_id = resources.id").
			Joins("JOIN user_albums ON user_albums.id = user_album_resources.user_album_id AND user_albums.deleted_at IS NULL").
			Where("user_albums.id = ? AND user_albums.user_id = ? AND user_albums.deleted_at IS NULL", albumID, targetUserID)
	}

	// 统计总数
	var total int64
	query.Count(&total)

	// 查询资源列表
	var resources []model.Resource
	err := applyResourceListQueryShape(query).
		Order("resources.created_at DESC").
		Limit(pageSize).
		Offset(offset).
		Find(&resources).Error

	if err != nil {
		Error(c, 500, "查询失败: "+err.Error())
		return
	}

	userName := targetUser.Nickname
		userAvatar := targetUser.Avatar

	resourceIDs := collectResourceIDs(resources)
	favoritedSet := loadFavoritedSetForResources(db, c, resourceIDs)

	// 构建响应
	resourceList := make([]gin.H, 0, len(resources))
	for _, resource := range resources {
		resource.FillThumbnailURL()
		rid := strconv.FormatInt(int64(resource.ID), 10)
		resourceList = append(resourceList, gin.H{
			"id":            resource.ID,
			"title":         resource.Title,
			"type":          resource.Type,
			"url":           resource.URL,
			"thumbnailUrl":  resource.ThumbnailURL,
			"size":          resource.Size,
			"width":         resource.Width,
			"height":        resource.Height,
			"extension":     resource.Extension,
			"downloadCount": resource.DownloadCount,
			"favoriteCount": resource.FavoriteCount,
			"userId":        resource.UserID,
			"userName":     userName,
				"userAvatar":   userAvatar,
			"createdAt":     resource.CreatedAt.Format("2006-01-02T15:04:05Z"),
			"isFavorited":   favoritedSet[rid],
			"tags":          resource.Tags,
		})
	}

	Success(c, gin.H{
		"list":     resourceList,
		"total":    total,
		"page":     page,
		"pageSize": pageSize,
	})
}
