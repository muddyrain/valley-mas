package handler

import (
	"time"
	"valley-server/internal/database"
	"valley-server/internal/model"

	"github.com/gin-gonic/gin"
)

// GetStats 获取统计数据
// @Summary      获取系统统计数据
// @Description  返回用户数、创作者数、资源数、下载数等统计信息
// @Tags         管理后台 - 数据统计
// @Accept       json
// @Produce      json
// @Security     Bearer
// @Success      200  {object}  map[string]interface{}  "统计数据"
// @Failure      401  {object}  map[string]interface{}  "未登录"
// @Failure      403  {object}  map[string]interface{}  "无权限"
// @Router       /admin/stats [get]
func GetStats(c *gin.Context) {
	db := database.GetDB()

	// 统计用户数
	var userCount int64
	db.Model(&model.User{}).Count(&userCount)

	// 统计创作者数
	var creatorCount int64
	db.Model(&model.Creator{}).Count(&creatorCount)

	// 统计资源数
	var resourceCount int64
	db.Model(&model.Resource{}).Count(&resourceCount)

	// 统计下载数
	var downloadCount int64
	db.Model(&model.DownloadRecord{}).Count(&downloadCount)

	// 统计访问数
	var accessCount int64
	db.Model(&model.CodeAccessLog{}).Count(&accessCount)

	// 按类型统计资源
	var avatarCount int64
	var wallpaperCount int64
	db.Model(&model.Resource{}).Where("type = ?", "avatar").Count(&avatarCount)
	db.Model(&model.Resource{}).Where("type = ?", "wallpaper").Count(&wallpaperCount)

	// 统计活跃创作者数（有资源的）
	var activeCreatorCount int64
	db.Model(&model.Creator{}).Where("is_active = ?", true).Count(&activeCreatorCount)

	// 获取最热门的资源（下载最多）
	var topResources []model.Resource
	db.Order("download_count DESC").Limit(5).Find(&topResources)

	// 获取最活跃的创作者（资源最多）
	// Resource.user_id = Creator.user_id，通过 JOIN creators 表关联
	type CreatorStats struct {
		CreatorID     model.Int64String `json:"creatorId"`
		ResourceCount int64             `json:"resourceCount"`
		Creator       *model.Creator    `json:"creator"`
	}
	var topCreatorIDs []struct {
		CreatorID     model.Int64String
		ResourceCount int64
	}
	db.Model(&model.Resource{}).
		Select("creators.id as creator_id, COUNT(resources.id) as resource_count").
		Joins("JOIN creators ON creators.user_id = resources.user_id AND creators.deleted_at IS NULL").
		Group("creators.id").
		Order("resource_count DESC").
		Limit(5).
		Scan(&topCreatorIDs)

	topCreators := make([]CreatorStats, 0, len(topCreatorIDs))
	for _, row := range topCreatorIDs {
		var creator model.Creator
		if err := db.Preload("User").First(&creator, "id = ?", row.CreatorID).Error; err != nil {
			continue
		}
		topCreators = append(topCreators, CreatorStats{
			CreatorID:     row.CreatorID,
			ResourceCount: row.ResourceCount,
			Creator:       &creator,
		})
	}

	Success(c, gin.H{
		"overview": gin.H{
			"userCount":          userCount,
			"creatorCount":       creatorCount,
			"activeCreatorCount": activeCreatorCount,
			"resourceCount":      resourceCount,
			"downloadCount":      downloadCount,
			"accessCount":        accessCount,
		},
		"resources": gin.H{
			"total":     resourceCount,
			"avatar":    avatarCount,
			"wallpaper": wallpaperCount,
		},
		"topResources": topResources,
		"topCreators":  topCreators,
	})
}

// GetTrends 获取趋势数据
// @Summary      获取系统趋势数据
// @Description  返回最近 7 天的用户、资源、下载等趋势数据
// @Tags         管理后台 - 数据统计
// @Accept       json
// @Produce      json
// @Security     Bearer
// @Success      200  {object}  map[string]interface{}  "趋势数据"
// @Failure      401  {object}  map[string]interface{}  "未登录"
// @Failure      403  {object}  map[string]interface{}  "无权限"
// @Router       /admin/trends [get]
func GetTrends(c *gin.Context) {
	db := database.GetDB()

	// 获取最近 7 天的日期
	now := time.Now()
	dates := make([]string, 7)
	userCounts := make([]int64, 7)
	creatorCounts := make([]int64, 7)
	resourceCounts := make([]int64, 7)
	downloadCounts := make([]int64, 7)

	for i := 6; i >= 0; i-- {
		date := now.AddDate(0, 0, -i)
		dateStart := time.Date(date.Year(), date.Month(), date.Day(), 0, 0, 0, 0, date.Location())
		dateEnd := dateStart.Add(24 * time.Hour)

		// 格式化日期
		dates[6-i] = date.Format("01-02")

		// 统计当天注册的用户数
		var userCount int64
		db.Model(&model.User{}).Where("created_at >= ? AND created_at < ?", dateStart, dateEnd).Count(&userCount)
		userCounts[6-i] = userCount

		// 统计当天创建的创作者数
		var creatorCount int64
		db.Model(&model.Creator{}).Where("created_at >= ? AND created_at < ?", dateStart, dateEnd).Count(&creatorCount)
		creatorCounts[6-i] = creatorCount

		// 统计当天上传的资源数
		var resourceCount int64
		db.Model(&model.Resource{}).Where("created_at >= ? AND created_at < ?", dateStart, dateEnd).Count(&resourceCount)
		resourceCounts[6-i] = resourceCount

		// 统计当天的下载数
		var downloadCount int64
		db.Model(&model.DownloadRecord{}).Where("created_at >= ? AND created_at < ?", dateStart, dateEnd).Count(&downloadCount)
		downloadCounts[6-i] = downloadCount
	}

	Success(c, gin.H{
		"dates": dates,
		"series": []gin.H{
			{
				"name": "新增用户",
				"data": userCounts,
			},
			{
				"name": "新增创作者",
				"data": creatorCounts,
			},
			{
				"name": "新增资源",
				"data": resourceCounts,
			},
			{
				"name": "下载次数",
				"data": downloadCounts,
			},
		},
	})
}
