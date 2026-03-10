package handler

import (
	"fmt"
	"strconv"
	"time"
	"valley-server/internal/database"
	"valley-server/internal/model"

	"github.com/gin-gonic/gin"
)

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
	Name          string `json:"name" example:"设计师小王"`
	Avatar        string `json:"avatar" example:"https://example.com/avatar.jpg"`
	ResourceCount int    `json:"resourceCount" example:"156"`
	DownloadCount int64  `json:"downloadCount" example:"8920"`
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
	// 使用子查询计算每个创作者的资源数量和总下载量
	err := db.Table("creators").
		Select(`creators.id, creators.user_id, creators.avatar, creators.description, creators.created_at,
			COALESCE(resource_stats.resource_count, 0) as resource_count,
			COALESCE(resource_stats.download_count, 0) as download_count`).
		Joins(`LEFT JOIN (
			SELECT 
				creator_id, 
				COUNT(*) as resource_count,
				SUM(download_count) as download_count
			FROM resources 
			WHERE deleted_at IS NULL
			GROUP BY creator_id
		) as resource_stats ON creators.id = resource_stats.creator_id`).
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
		// 获取用户信息以获取昵称
		var user model.User
		var name string
		if err := db.Where("id = ?", creator.UserID).First(&user).Error; err == nil {
			name = user.Nickname
		}

		response = append(response, HotCreatorResponse{
			ID:            fmt.Sprintf("%d", creator.ID),
			Name:          name,
			Avatar:        creator.Avatar,
			Description:   creator.Description,
			ResourceCount: 0, // 将在下面设置
			DownloadCount: 0, // 将在下面设置
			CreatedAt:     creator.CreatedAt.Format("2006-01-02T15:04:05Z"),
		})
	}

	// 再次查询每个创作者的统计数据（因为上面的扫描可能无法正确获取）
	for i, creator := range creators {
		var resourceCount int64
		var downloadCount int64

		// 查询资源数量
		db.Model(&model.Resource{}).
			Where("creator_id = ? AND deleted_at IS NULL", creator.ID).
			Count(&resourceCount)

		// 查询总下载量
		db.Model(&model.Resource{}).
			Where("creator_id = ? AND deleted_at IS NULL", creator.ID).
			Select("COALESCE(SUM(download_count), 0)").
			Scan(&downloadCount)

		response[i].ResourceCount = int(resourceCount)
		response[i].DownloadCount = downloadCount
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
