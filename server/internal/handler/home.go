package handler

import (
	"fmt"
	"strconv"
	"strings"
	"sync"
	"time"
	"valley-server/internal/database"
	"valley-server/internal/model"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

const publicVisibilityWhere = "visibility = 'public'"
const publicResourceListCacheTTL = 30 * time.Second

type publicResourceListCacheEntry struct {
	response  []HotResourceResponse
	total     int64
	page      int
	pageSize  int
	expiresAt time.Time
}

var publicResourceListCache = struct {
	mu      sync.RWMutex
	entries map[string]publicResourceListCacheEntry
}{
	entries: make(map[string]publicResourceListCacheEntry),
}

func buildPublicResourceListCacheKey(
	page int,
	pageSize int,
	resourceType string,
	keyword string,
	tagID string,
	sort string,
) string {
	return strings.Join(
		[]string{
			strconv.Itoa(page),
			strconv.Itoa(pageSize),
			resourceType,
			keyword,
			tagID,
			sort,
		},
		"|",
	)
}

func cloneHotResourceResponseList(items []HotResourceResponse) []HotResourceResponse {
	cloned := make([]HotResourceResponse, len(items))
	copy(cloned, items)
	return cloned
}

func getCachedPublicResourceList(key string) ([]HotResourceResponse, int64, int, int, bool) {
	publicResourceListCache.mu.RLock()
	entry, ok := publicResourceListCache.entries[key]
	publicResourceListCache.mu.RUnlock()
	if !ok {
		return nil, 0, 0, 0, false
	}
	if time.Now().After(entry.expiresAt) {
		publicResourceListCache.mu.Lock()
		delete(publicResourceListCache.entries, key)
		publicResourceListCache.mu.Unlock()
		return nil, 0, 0, 0, false
	}

	return cloneHotResourceResponseList(entry.response), entry.total, entry.page, entry.pageSize, true
}

func setCachedPublicResourceList(
	key string,
	response []HotResourceResponse,
	total int64,
	page int,
	pageSize int,
) {
	publicResourceListCache.mu.Lock()
	publicResourceListCache.entries[key] = publicResourceListCacheEntry{
		response:  cloneHotResourceResponseList(response),
		total:     total,
		page:      page,
		pageSize:  pageSize,
		expiresAt: time.Now().Add(publicResourceListCacheTTL),
	}
	publicResourceListCache.mu.Unlock()
}

func invalidatePublicResourceListCache() {
	publicResourceListCache.mu.Lock()
	publicResourceListCache.entries = make(map[string]publicResourceListCacheEntry)
	publicResourceListCache.mu.Unlock()
}

// HomePage 服务入口页（浏览器访问友好）
func HomePage(c *gin.Context) {
	now := time.Now().Format("2006-01-02 15:04:05")
	html := fmt.Sprintf(`<!doctype html>
<html lang="zh-CN">
<head>
	<meta charset="UTF-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1.0" />
	<title>Valley MAS Server</title>
	<style>
		:root {
			color-scheme: light dark;
			--bg: #0b1020;
			--card: #121a33;
			--text: #e8ecff;
			--muted: #9fb0e0;
			--ok: #41d1a3;
			--line: #2b3761;
			--link: #7cb4ff;
		}
		* { box-sizing: border-box; }
		body {
			margin: 0;
			min-height: 100vh;
			font-family: -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"PingFang SC","Microsoft YaHei",sans-serif;
			background: radial-gradient(1200px 600px at 20%% 0%%, #1b2a57 0%%, var(--bg) 60%%);
			color: var(--text);
			display: grid;
			place-items: center;
			padding: 24px;
		}
		.card {
			width: min(780px, 100%%);
			background: color-mix(in oklab, var(--card) 88%%, black);
			border: 1px solid var(--line);
			border-radius: 16px;
			padding: 24px;
			box-shadow: 0 12px 40px rgba(0,0,0,.35);
		}
		h1 { margin: 0 0 8px; font-size: 28px; }
		p { margin: 8px 0; color: var(--muted); line-height: 1.7; }
		.ok {
			display: inline-flex;
			align-items: center;
			gap: 8px;
			color: var(--ok);
			font-weight: 600;
			margin: 6px 0 16px;
		}
		.dot {
			width: 10px;
			height: 10px;
			border-radius: 999px;
			background: var(--ok);
			box-shadow: 0 0 0 6px rgba(65,209,163,.2);
		}
		.list {
			margin-top: 16px;
			border: 1px solid var(--line);
			border-radius: 12px;
			overflow: hidden;
		}
		.row {
			display: grid;
			grid-template-columns: 220px 1fr;
			gap: 12px;
			padding: 10px 14px;
			border-bottom: 1px solid var(--line);
		}
		.row:last-child { border-bottom: none; }
		code, a {
			color: var(--link);
			text-decoration: none;
			word-break: break-all;
		}
		.footer { margin-top: 14px; font-size: 12px; color: #7e8db6; }
	</style>
</head>
<body>
	<main class="card">
		<h1>Valley MAS Go 服务</h1>
		<div class="ok"><span class="dot"></span>服务运行中</div>
		<p>这是后端入口页（浏览器友好模式）。如果你熟悉 Node.js，可以把它理解为 Express 的 <code>GET /</code> 欢迎路由。</p>
		<div class="list">
			<div class="row"><strong>健康检查</strong><span><a href="/health">GET /health</a></span></div>
			<div class="row"><strong>验证口令</strong><span><code>POST /api/v1/code/verify</code></span></div>
			<div class="row"><strong>创作者资源</strong><span><code>GET /api/v1/creator/:code/resources</code></span></div>
			<div class="row"><strong>管理后台</strong><span><code>/api/v1/admin/*</code></span></div>
		</div>
		<p class="footer">当前时间：%s</p>
	</main>
</body>
</html>`, now)

	c.Data(200, "text/html; charset=utf-8", []byte(html))
}

// HotCreatorResponse 热门创作者响应项
type HotCreatorResponse struct {
	ID            string `json:"id" example:"1234567890"`
	Code          string `json:"code" example:"ABCD1234"`
	Name          string `json:"name" example:"设计师小王"`
	Avatar        string `json:"avatar" example:"https://example.com/avatar.jpg"`
	ResourceCount int    `json:"resourceCount" example:"156"`
	DownloadCount int64  `json:"downloadCount" example:"8920"`
	FollowerCount int64  `json:"followerCount" example:"365"`
	Description   string `json:"description" example:"分享精美头像和壁纸"`
	CreatedAt     string `json:"createdAt" example:"2026-03-01T12:00:00Z"`
}

// GetHotCreators 获取热门创作者
// @Summary      获取热门创作者列表
// @Description  获取热门创作者列表，按资源数量和下载量排序
// @Tags         公开接口
// @Accept       json
// @Produce      json
// @Param        page     query     int    false  "页码"    default(1)
// @Param        pageSize  query     int    false  "每页数量"  default(10)
// @Success      200  {object}  map[string]interface{}  "获取成功"
// @Failure      400  {object}  map[string]interface{}  "参数错误"
// @Failure      500  {object}  map[string]interface{}  "服务器错误"
// @Router       /public/hot-creators [get]
func GetHotCreators(c *gin.Context) {
	db := database.DB

	// 获取分页参数
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "10"))

	// 限制每页最大数量
	if pageSize > 50 {
		pageSize = 50
	}
	if pageSize <= 0 {
		pageSize = 10
	}
	if page <= 0 {
		page = 1
	}

	offset := (page - 1) * pageSize

	var creators []model.Creator
	var total int64

	// 查询热门创作者（按资源数量和下载量排序）
	err := db.Table("creators").
		Select(`creators.id, creators.user_id, creators.code, creators.description, creators.created_at,
			COALESCE(resource_stats.resource_count, 0) as resource_count,
			COALESCE(resource_stats.download_count, 0) as download_count`).
		Joins(`LEFT JOIN (
			SELECT 
				user_id, 
				COUNT(*) as resource_count,
				SUM(download_count) as download_count
			FROM resources 
			WHERE deleted_at IS NULL
			GROUP BY user_id
		) as resource_stats ON creators.user_id = resource_stats.user_id`).
		Where("creators.is_active = ? AND creators.deleted_at IS NULL", true).
		Order("resource_count DESC, download_count DESC").
		Limit(pageSize).
		Offset(offset).
		Scan(&creators).Error

	if err != nil {
		c.JSON(500, gin.H{
			"code":    500,
			"message": "查询热门创作者失败",
			"data":    nil,
		})
		return
	}

	// 获取总数
	db.Model(&model.Creator{}).
		Where("is_active = ? AND deleted_at IS NULL", true).
		Count(&total)

	// 转换为响应格式
	var response []HotCreatorResponse
	for _, creator := range creators {
		// 获取用户信息以获取昵称和头像
		var user model.User
		var name, avatar string
		if err := db.Where("id = ?", creator.UserID).First(&user).Error; err == nil {
			name = user.Nickname
			avatar = user.Avatar
		}

		response = append(response, HotCreatorResponse{
			ID:            fmt.Sprintf("%d", creator.ID),
			Code:          creator.Code,
			Name:          name,
			Avatar:        avatar,
			Description:   creator.Description,
			ResourceCount: 0,
			DownloadCount: 0,
			CreatedAt:     creator.CreatedAt.Format("2006-01-02T15:04:05Z"),
		})
	}

	// 查询每个创作者的统计数据
	for i, creator := range creators {
		var resourceCount int64
		var downloadCount int64
		var followerCount int64

		db.Model(&model.Resource{}).
			Where("user_id = ? AND deleted_at IS NULL", creator.UserID).
			Count(&resourceCount)

		db.Model(&model.Resource{}).
			Where("user_id = ? AND deleted_at IS NULL", creator.UserID).
			Select("COALESCE(SUM(download_count), 0)").
			Scan(&downloadCount)

		db.Model(&model.UserFollow{}).
			Where("creator_id = ?", creator.ID).
			Count(&followerCount)

		response[i].ResourceCount = int(resourceCount)
		response[i].DownloadCount = downloadCount
		response[i].FollowerCount = followerCount
	}

	c.JSON(200, gin.H{
		"code":    0,
		"message": "获取成功",
		"data": gin.H{
			"list":     response,
			"total":    total,
			"page":     page,
			"pageSize": pageSize,
		},
	})
}

// GetResourceDetail 获取单个资源详情（公开接口）
func GetResourceDetail(c *gin.Context) {
	id := c.Param("id")
	db := database.GetDB()

	var resource model.Resource
	if err := db.Where("id = ? AND deleted_at IS NULL", id).Preload("Tags").First(&resource).Error; err != nil {
		Error(c, 404, "资源不存在")
		return
	}

	visibility := resource.Visibility
	if visibility == "" {
		visibility = "public"
	}

	canView := visibility == "public"
	if !canView {
		if userIDAny, exists := c.Get("userId"); exists {
			if userID, ok := userIDAny.(int64); ok && int64(resource.UserID) == userID {
				canView = true
			}
		}
	}
	if !canView {
		if roleAny, exists := c.Get("userRole"); exists {
			if role, ok := roleAny.(string); ok && role == "admin" {
				canView = true
			}
		}
	}
	if !canView {
		Error(c, 404, "资源不存在或无权访问")
		return
	}

	// 查询上传者信息
	var user model.User
	if err := db.Where("id = ? AND deleted_at IS NULL", resource.UserID).First(&user).Error; err != nil {
		user = model.User{}
	}

	// 查询创作者 code（用于跳转创作者主页）
	var creator model.Creator
	creatorCode := ""
	if err := db.Where("user_id = ?", resource.UserID).First(&creator).Error; err == nil {
		creatorCode = creator.Code
	}

	// 收藏状态（OptionalAuth 已解析 userId）
	isFavorited := false
	if uid, exists := c.Get("userId"); exists {
		var fav model.UserFavorite
		if err := db.Where("user_id = ? AND resource_id = ? AND deleted_at IS NULL", uid, resource.ID).
			First(&fav).Error; err == nil {
			isFavorited = true
		}
	}

	resource.FillThumbnailURL()

	Success(c, gin.H{
		"id":            strconv.FormatInt(int64(resource.ID), 10),
		"title":         resource.Title,
		"description":   resource.Description,
		"type":          resource.Type,
		"visibility":    visibility,
		"url":           resource.URL,
		"thumbnailUrl":  resource.ThumbnailURL,
		"size":          resource.Size,
		"width":         resource.Width,
		"height":        resource.Height,
		"downloadCount": resource.DownloadCount,
		"favoriteCount": resource.FavoriteCount,
		"extension":     resource.Extension,
		"createdAt":     resource.CreatedAt.Format("2006-01-02T15:04:05Z"),
		"userId":        fmt.Sprintf("%d", resource.UserID),
		"creatorName":   user.Nickname,
		"creatorAvatar": user.Avatar,
		"creatorCode":   creatorCode,
		"isFavorited":   isFavorited,
		"tags":          resource.Tags,
	})
} // HotResourceResponse 热门资源响应
type HotResourceResponse struct {
	ID            string              `json:"id"`
	Title         string              `json:"title"`
	Type          string              `json:"type"`
	URL           string              `json:"url"`
	ThumbnailURL  string              `json:"thumbnailUrl"`
	Size          int64               `json:"size"`
	Width         int                 `json:"width"`
	Height        int                 `json:"height"`
	Extension     string              `json:"extension"`
	DownloadCount int64               `json:"downloadCount"`
	FavoriteCount int                 `json:"favoriteCount"`
	UserId        string              `json:"userId"`
	CreatorName   string              `json:"creatorName"`
	CreatorAvatar string              `json:"creatorAvatar"`
	CreatedAt     string              `json:"createdAt"`
	IsFavorited   bool                `json:"isFavorited"`
	Tags          []model.ResourceTag `json:"tags"`
}

func collectResourceIDs(resources []model.Resource) []model.Int64String {
	ids := make([]model.Int64String, 0, len(resources))
	for _, resource := range resources {
		ids = append(ids, resource.ID)
	}
	return ids
}

func loadFavoritedSetForResources(db *gorm.DB, c *gin.Context, resourceIDs []model.Int64String) map[string]bool {
	favoritedSet := map[string]bool{}
	if len(resourceIDs) == 0 {
		return favoritedSet
	}

	uid, exists := c.Get("userId")
	if !exists {
		return favoritedSet
	}

	userID, ok := uid.(int64)
	if !ok {
		return favoritedSet
	}

	var favs []model.UserFavorite
	db.Where("user_id = ? AND resource_id IN ? AND deleted_at IS NULL", userID, resourceIDs).Find(&favs)
	for _, fav := range favs {
		favoritedSet[strconv.FormatInt(int64(fav.ResourceID), 10)] = true
	}

	return favoritedSet
}

func buildHotResourceResponseList(resources []model.Resource, favoritedSet map[string]bool) []HotResourceResponse {
	response := make([]HotResourceResponse, 0, len(resources))
	for _, resource := range resources {
		rid := strconv.FormatInt(int64(resource.ID), 10)
		resource.FillThumbnailURL()

		creatorName := ""
		creatorAvatar := ""
		if resource.User != nil {
			creatorName = resource.User.Nickname
			creatorAvatar = resource.User.Avatar
		}

		response = append(response, HotResourceResponse{
			ID:            rid,
			Title:         resource.Title,
			Type:          resource.Type,
			URL:           resource.URL,
			ThumbnailURL:  resource.ThumbnailURL,
			Size:          resource.Size,
			Width:         resource.Width,
			Height:        resource.Height,
			Extension:     resource.Extension,
			DownloadCount: int64(resource.DownloadCount),
			FavoriteCount: resource.FavoriteCount,
			UserId:        fmt.Sprintf("%d", resource.UserID),
			CreatorName:   creatorName,
			CreatorAvatar: creatorAvatar,
			CreatedAt:     resource.CreatedAt.Format("2006-01-02T15:04:05Z"),
			IsFavorited:   favoritedSet[rid],
			Tags:          resource.Tags,
		})
	}

	return response
}

// GetHotResources 获取热门资源
// @Summary 获取热门资源
// @Description 获取热门资源列表，按下载量排序
// @Tags 公共接口
// @Accept json
// @Produce json
// @Param page query int false "页码" default(1)
// @Param pageSize query int false "每页数量" default(10)
// @Success 200 {object} Response{data=object{list=[]HotResourceResponse,total=int64,page=int,pageSize=int}}
// @Router /api/v1/public/hot-resources [get]
func GetHotResources(c *gin.Context) {
	db := database.GetDB()

	// 解析分页参数
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "10"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 10
	}
	if pageSize > 50 {
		pageSize = 50
	}

	offset := (page - 1) * pageSize

	// 查询总数（只统计有下载量的资源）
	var total int64
	db.Model(&model.Resource{}).
		Where("deleted_at IS NULL AND download_count > 0").
		Where(publicVisibilityWhere).
		Count(&total)

	// 查询热门资源，按下载量排序
	var resources []model.Resource
	err := db.Where("deleted_at IS NULL AND download_count > 0").
		Where(publicVisibilityWhere).
		Order("download_count DESC, created_at DESC").
		Limit(pageSize).
		Offset(offset).
		Preload("User").
		Preload("Tags").
		Find(&resources).Error

	if err != nil {
		c.JSON(500, gin.H{
			"code":    500,
			"message": "查询失败: " + err.Error(),
		})
		return
	}
	fillResourceThumbnails(resources)

	resourceIDs := collectResourceIDs(resources)
	favoritedSet := loadFavoritedSetForResources(db, c, resourceIDs)
	response := buildHotResourceResponseList(resources, favoritedSet)

	c.JSON(200, gin.H{
		"code":    0,
		"message": "获取成功",
		"data": gin.H{
			"list":     response,
			"total":    total,
			"page":     page,
			"pageSize": pageSize,
		},
	})
}

// GetAllResources 资源广场 - 获取全量资源列表（支持分页、类型、关键词筛选）
func GetAllResources(c *gin.Context) {
	db := database.GetDB()

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "20"))
	resourceType := c.Query("type")
	keyword := c.Query("keyword")
	tagID := strings.TrimSpace(c.Query("tagId"))
	sort := strings.TrimSpace(c.Query("sort"))

	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 50 {
		pageSize = 20
	}
	offset := (page - 1) * pageSize
	cacheKey := buildPublicResourceListCacheKey(page, pageSize, resourceType, keyword, tagID, sort)

	if cachedResponse, cachedTotal, cachedPage, cachedPageSize, ok := getCachedPublicResourceList(cacheKey); ok {
		resourceIDs := make([]model.Int64String, 0, len(cachedResponse))
		for _, item := range cachedResponse {
			var resourceID model.Int64String
			if err := resourceID.Scan(item.ID); err == nil {
				resourceIDs = append(resourceIDs, resourceID)
			}
		}
		favoritedSet := loadFavoritedSetForResources(db, c, resourceIDs)
		for i := range cachedResponse {
			cachedResponse[i].IsFavorited = favoritedSet[cachedResponse[i].ID]
		}

		Success(c, gin.H{
			"list":     cachedResponse,
			"total":    cachedTotal,
			"page":     cachedPage,
			"pageSize": cachedPageSize,
		})
		return
	}

	query := db.Model(&model.Resource{}).Where("deleted_at IS NULL").Where(publicVisibilityWhere)
	if resourceType != "" {
		query = query.Where("type = ?", resourceType)
	}
	if keyword != "" {
		like := "%" + keyword + "%"
		query = query.Where("title LIKE ? OR description LIKE ?", like, like)
	}
	if tagID != "" {
		query = query.
			Joins("JOIN resource_tag_relations ON resource_tag_relations.resource_id = resources.id").
			Where("resource_tag_relations.tag_id = ?", tagID)
	}

	var total int64
	query.Count(&total)

	orderExpr := "created_at DESC"
	if strings.EqualFold(sort, "oldest") {
		orderExpr = "created_at ASC"
	}

	var resources []model.Resource
	if err := query.Order(orderExpr).
		Limit(pageSize).
		Offset(offset).
		Preload("User").
		Preload("Tags").
		Find(&resources).Error; err != nil {
		Error(c, 500, "查询失败: "+err.Error())
		return
	}
	fillResourceThumbnails(resources)

	resourceIDs := collectResourceIDs(resources)
	favoritedSet := loadFavoritedSetForResources(db, c, resourceIDs)
	response := buildHotResourceResponseList(resources, favoritedSet)
	cacheableResponse := cloneHotResourceResponseList(response)
	for i := range cacheableResponse {
		cacheableResponse[i].IsFavorited = false
	}
	setCachedPublicResourceList(cacheKey, cacheableResponse, total, page, pageSize)

	Success(c, gin.H{
		"list":     response,
		"total":    total,
		"page":     page,
		"pageSize": pageSize,
	})
}
