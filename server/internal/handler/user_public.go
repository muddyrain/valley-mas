package handler

import (
	"valley-server/internal/database"
	"valley-server/internal/model"
	"valley-server/internal/utils"

	"github.com/gin-gonic/gin"
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

	response := gin.H{
		"creator": gin.H{
			"id":          creator.ID,
			"name":        creator.Name,
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
			"title":       creator.Space.Title,
			"description": creator.Space.Description,
			"banner":      creator.Space.Banner,
		}
		response["resources"] = creator.Space.Resources
	}

	Success(c, response)
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
	if err := db.Preload("Creator").First(&resource, "id = ?", resourceID).Error; err != nil {
		Error(c, 404, "资源不存在")
		return
	}

	// 记录下载行为
	downloadRecord := model.DownloadRecord{
		ID:         model.Int64String(utils.GenerateID()),
		UserID:     model.Int64String(0), // 暂时没有用户系统，后续接入
		ResourceID: resource.ID,
		CreatorID:  resource.CreatorID,
		IP:         c.ClientIP(),
		UserAgent:  c.GetHeader("User-Agent"),
	}
	db.Create(&downloadRecord)

	// 增加下载次数
	db.Model(&resource).Update("download_count", resource.DownloadCount+1)

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
