package handler

import (
	"time"
	"valley-server/internal/database"
	"valley-server/internal/model"

	"github.com/gin-gonic/gin"
)

// CreatorStats 创作者数据概览
type CreatorStats struct {
	// 基础统计
	TotalResources int `json:"totalResources"` // 总资源数
	TotalSpaces    int `json:"totalSpaces"`    // 总空间数
	TotalDownloads int `json:"totalDownloads"` // 总下载量
	TotalViews     int `json:"totalViews"`     // 总访问量

	// 今日数据
	TodayDownloads int `json:"todayDownloads"` // 今日下载
	TodayViews     int `json:"todayViews"`     // 今日访问

	// 近7天数据
	Last7DaysDownloads int `json:"last7DaysDownloads"` // 近7天下载
	Last7DaysViews     int `json:"last7DaysViews"`     // 近7天访问

	// 趋势数据（近7天）
	DownloadTrend []DailyData `json:"downloadTrend"` // 下载趋势
	ViewTrend     []DailyData `json:"viewTrend"`     // 访问趋势

	// 热门资源 Top 5
	TopResources []TopResource `json:"topResources"`

	// 创作者信息
	CreatorInfo CreatorInfo `json:"creatorInfo"`
}

// DailyData 每日数据
type DailyData struct {
	Date  string `json:"date"`  // 日期 YYYY-MM-DD
	Count int    `json:"count"` // 数量
}

// TopResource 热门资源
type TopResource struct {
	ID            string `json:"id"`
	Title         string `json:"title"`
	Type          string `json:"type"`
	DownloadCount int    `json:"downloadCount"`
	URL           string `json:"url"`
	ThumbnailURL  string `json:"thumbnailUrl"`
}

// CreatorInfo 创作者信息
type CreatorInfo struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Avatar      string `json:"avatar"`
	Description string `json:"description"`
}

// GetCreatorStats 获取创作者数据概览（创作者专用）
// @Summary      获取创作者数据概览
// @Description  创作者查看自己的数据统计和趋势
// @Tags         创作者管理
// @Accept       json
// @Produce      json
// @Security     Bearer
// @Success      200  {object}  map[string]interface{}  "数据概览"
// @Failure      401  {object}  map[string]interface{}  "未登录"
// @Failure      403  {object}  map[string]interface{}  "无权限"
// @Router       /admin/creator/stats [get]
func GetCreatorStats(c *gin.Context) {
	db := database.DB

	// 获取当前用户信息
	userId, _ := c.Get("userId")

	// 查找该用户对应的创作者记录
	var creator model.Creator
	if err := db.Where("user_id = ?", userId).First(&creator).Error; err != nil {
		Error(c, 404, "未找到创作者信息")
		return
	}

	// 初始化统计数据
	stats := CreatorStats{
		CreatorInfo: CreatorInfo{
			ID:          string(creator.ID),
			Name:        creator.Name,
			Avatar:      creator.Avatar,
			Description: creator.Description,
		},
	}

	// 1. 基础统计
	// 总资源数（Resource.CreatorID 存储的是 User ID）
	var totalResources int64
	db.Model(&model.Resource{}).Where("creator_id = ?", userId).Count(&totalResources)
	stats.TotalResources = int(totalResources)

	// 总空间数
	var totalSpaces int64
	db.Model(&model.CreatorSpace{}).Where("creator_id = ?", creator.ID).Count(&totalSpaces)
	stats.TotalSpaces = int(totalSpaces)

	// 总下载量
	var totalDownloads int64
	db.Model(&model.DownloadRecord{}).Where("creator_id = ?", creator.ID).Count(&totalDownloads)
	stats.TotalDownloads = int(totalDownloads)

	// 总访问量（通过创作者的所有空间）
	var spaceIDs []int64
	db.Model(&model.CreatorSpace{}).Where("creator_id = ?", creator.ID).Pluck("id", &spaceIDs)
	var totalViews int64
	if len(spaceIDs) > 0 {
		db.Model(&model.CodeAccessLog{}).Where("space_id IN ?", spaceIDs).Count(&totalViews)
	}
	stats.TotalViews = int(totalViews)

	// 2. 今日数据
	today := time.Now().Format("2006-01-02")
	todayStart := today + " 00:00:00"
	todayEnd := today + " 23:59:59"

	var todayDownloads int64
	db.Model(&model.DownloadRecord{}).
		Where("creator_id = ? AND created_at BETWEEN ? AND ?", creator.ID, todayStart, todayEnd).
		Count(&todayDownloads)
	stats.TodayDownloads = int(todayDownloads)

	var todayViews int64
	if len(spaceIDs) > 0 {
		db.Model(&model.CodeAccessLog{}).
			Where("space_id IN ? AND created_at BETWEEN ? AND ?", spaceIDs, todayStart, todayEnd).
			Count(&todayViews)
	}
	stats.TodayViews = int(todayViews)

	// 3. 近7天数据
	sevenDaysAgo := time.Now().AddDate(0, 0, -7).Format("2006-01-02") + " 00:00:00"

	var last7DaysDownloads int64
	db.Model(&model.DownloadRecord{}).
		Where("creator_id = ? AND created_at >= ?", creator.ID, sevenDaysAgo).
		Count(&last7DaysDownloads)
	stats.Last7DaysDownloads = int(last7DaysDownloads)

	var last7DaysViews int64
	if len(spaceIDs) > 0 {
		db.Model(&model.CodeAccessLog{}).
			Where("space_id IN ? AND created_at >= ?", spaceIDs, sevenDaysAgo).
			Count(&last7DaysViews)
	}
	stats.Last7DaysViews = int(last7DaysViews)

	// 4. 趋势数据（近7天）
	stats.DownloadTrend = make([]DailyData, 7)
	stats.ViewTrend = make([]DailyData, 7)

	for i := 0; i < 7; i++ {
		date := time.Now().AddDate(0, 0, -6+i)
		dateStr := date.Format("2006-01-02")
		dayStart := dateStr + " 00:00:00"
		dayEnd := dateStr + " 23:59:59"

		// 下载趋势
		var downloadCount int64
		db.Model(&model.DownloadRecord{}).
			Where("creator_id = ? AND created_at BETWEEN ? AND ?", creator.ID, dayStart, dayEnd).
			Count(&downloadCount)
		stats.DownloadTrend[i] = DailyData{
			Date:  dateStr,
			Count: int(downloadCount),
		}

		// 访问趋势
		var viewCount int64
		if len(spaceIDs) > 0 {
			db.Model(&model.CodeAccessLog{}).
				Where("space_id IN ? AND created_at BETWEEN ? AND ?", spaceIDs, dayStart, dayEnd).
				Count(&viewCount)
		}
		stats.ViewTrend[i] = DailyData{
			Date:  dateStr,
			Count: int(viewCount),
		}
	}

	// 5. 热门资源 Top 5
	var resources []model.Resource
	db.Where("creator_id = ?", userId).
		Order("download_count DESC").
		Limit(5).
		Find(&resources)

	stats.TopResources = make([]TopResource, len(resources))
	for i, r := range resources {
		stats.TopResources[i] = TopResource{
			ID:            string(r.ID),
			Title:         r.Title,
			Type:          r.Type,
			DownloadCount: r.DownloadCount,
			URL:           r.URL,
			ThumbnailURL:  r.ThumbnailURL,
		}
	}

	Success(c, stats)
}
