package handler

import (
	"valley-server/internal/database"
	"valley-server/internal/logger"
	"valley-server/internal/model"
	"valley-server/internal/utils"

	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"
)

// GetCreatorSpace 获取创作者空间信息（公开接口，用户端）
// @Summary      获取创作者空间
// @Description  通过创作者口令获取创作者空间信息，包含资源列表
// @Tags         用户端 - 公开接口
// @Accept       json
// @Produce      json
// @Param        code  path  string  true  "创作者口令"
// @Success      200  {object}  map[string]interface{}  "空间信息"
// @Failure      404  {object}  map[string]interface{}  "空间不存在"
// @Router       /public/space/{code} [get]
func GetCreatorSpace(c *gin.Context) {
	code := c.Param("code")

	db := database.GetDB()

	// 查找创作者
	var creator model.Creator
	if err := db.Where("code = ? AND is_active = ?", code, true).
		Preload("User"). // 预加载用户信息
		Preload("Space").
		Preload("Space.Resources").
		First(&creator).Error; err != nil {
		Error(c, 404, "创作者不存在或未激活")
		return
	}

	// 记录访问日志
	accessLog := model.CodeAccessLog{
		ID:        model.Int64String(utils.GenerateID()),
		CreatorID: creator.ID,
		Code:      code,
		IP:        c.ClientIP(),
		UserAgent: c.GetHeader("User-Agent"),
	}
	db.Create(&accessLog)

	// 统计数据
	var totalViews int64
	var totalDownloads int64
	db.Model(&model.CodeAccessLog{}).Where("creator_id = ?", creator.ID).Count(&totalViews)
	db.Model(&model.DownloadRecord{}).Where("creator_id = ?", creator.ID).Count(&totalDownloads)

	creatorName := ""
	if creator.User != nil {
		creatorName = creator.User.Nickname
	}

	response := gin.H{
		"creator": gin.H{
			"id":          creator.ID,
			"name":        creatorName,
			"avatar":      creator.Avatar,
			"description": creator.Description,
			"code":        creator.Code,
		},
		"stats": gin.H{
			"totalViews":     totalViews,
			"totalDownloads": totalDownloads,
		},
	}

	if creator.Space != nil {
		response["space"] = gin.H{
			"id":          creator.Space.ID,
			"description": creator.Space.Description,
			"banner":      creator.Space.Banner,
		}
		response["resources"] = creator.Space.Resources
	}

	Success(c, response)
}

// DownloadResource 下载资源（公开接口，暂时不需要广告令牌）
// @Summary      下载资源
// @Description  用户下载资源，记录下载行为，增加创作者下载量统计
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
	if err := db.First(&resource, "id = ?", resourceID).Error; err != nil {
		Error(c, 404, "资源不存在")
		return
	}

	// 根据资源的 CreatorID (User.ID) 查找对应的 Creator
	var creator model.Creator
	if err := db.Where("user_id = ?", resource.CreatorID).First(&creator).Error; err != nil {
		ErrorWithDetail(c, 500, "查询创作者信息失败", err, logrus.Fields{
			"resource_id":     resourceID,
			"creator_user_id": resource.CreatorID,
		})
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
		CreatorID:  creator.ID, // 使用 Creator.ID 而不是 User.ID
		IP:         c.ClientIP(),
		UserAgent:  c.GetHeader("User-Agent"),
	}

	if err := db.Create(&downloadRecord).Error; err != nil {
		ErrorWithDetail(c, 500, "创建下载记录失败", err, logrus.Fields{
			"resource_id": resourceID,
			"user_id":     userID,
			"creator_id":  creator.ID,
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
		"creator_id":     creator.ID,
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
		Preload("Creator").
		Offset(offset).
		Limit(pageSize).
		Order("created_at DESC").
		Find(&records)

	Success(c, gin.H{
		"list":  records,
		"total": total,
	})
}

// GetCreatorResourcesList 获取创作者的资源列表（公开接口）
// @Summary      获取创作者资源列表
// @Description  通过创作者ID获取该创作者的所有资源
// @Tags         用户端 - 公开接口
// @Accept       json
// @Produce      json
// @Param        id        path   string  true   "创作者ID"
// @Param        page      query  int     false  "页码"      default(1)
// @Param        pageSize  query  int     false  "每页数量"  default(20)
// @Param        type      query  string  false  "资源类型(avatar/wallpaper)"
// @Success      200  {object}  map[string]interface{}  "资源列表"
// @Failure      404  {object}  map[string]interface{}  "创作者不存在"
// @Router       /public/creators/{id}/resources [get]
func GetCreatorResourcesList(c *gin.Context) {
	creatorID := c.Param("id")
	page := GetIntQuery(c, "page", 1)
	pageSize := GetIntQuery(c, "pageSize", 20)
	resourceType := c.Query("type")

	if pageSize > 50 {
		pageSize = 50
	}
	offset := (page - 1) * pageSize

	db := database.GetDB()

	// 验证创作者是否存在
	var creator model.Creator
	if err := db.Where("id = ? AND is_active = ? AND deleted_at IS NULL", creatorID, true).
		First(&creator).Error; err != nil {
		Error(c, 404, "创作者不存在或未激活")
		return
	}

	// 查询资源
	query := db.Model(&model.Resource{}).
		Where("creator_id = ? AND deleted_at IS NULL", creator.UserID)

	// 按类型筛选
	if resourceType != "" {
		query = query.Where("type = ?", resourceType)
	}

	// 统计总数
	var total int64
	query.Count(&total)

	// 查询资源列表
	var resources []model.Resource
	err := query.Order("created_at DESC").
		Limit(pageSize).
		Offset(offset).
		Find(&resources).Error

	if err != nil {
		Error(c, 500, "查询失败: "+err.Error())
		return
	}

	// 获取创作者名称
	var creatorName string
	var user model.User
	if err := db.Where("id = ?", creator.UserID).First(&user).Error; err == nil {
		creatorName = user.Nickname
	}

	// 构建响应
	resourceList := make([]gin.H, 0, len(resources))
	for _, resource := range resources {
		resourceList = append(resourceList, gin.H{
			"id":            resource.ID,
			"title":         resource.Title,
			"type":          resource.Type,
			"url":           resource.URL,
			"thumbnailUrl":  resource.ThumbnailURL,
			"size":          resource.Size,
			"downloadCount": resource.DownloadCount,
			"creatorId":     creator.ID,
			"creatorName":   creatorName,
			"creatorAvatar": creator.Avatar,
			"createdAt":     resource.CreatedAt.Format("2006-01-02T15:04:05Z"),
		})
	}

	Success(c, gin.H{
		"list":     resourceList,
		"total":    total,
		"page":     page,
		"pageSize": pageSize,
	})
}
