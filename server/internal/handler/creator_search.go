package handler

import (
	"strconv"
	"strings"
	"time"
	"valley-server/internal/database"
	"valley-server/internal/logger"

	"github.com/gin-gonic/gin"
)

type publicCreatorSearchRow struct {
	ID            int64
	Code          string
	Name          string
	Avatar        string
	Description   string
	ResourceCount int64
	DownloadCount int64
	FollowerCount int64
	CreatedAt     time.Time
}

// SearchCreators 公开创作者检索，支持关键词与分页。
func SearchCreators(c *gin.Context) {
	db := database.GetDB()

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "12"))
	keyword := strings.TrimSpace(c.Query("keyword"))

	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 12
	}
	if pageSize > 50 {
		pageSize = 50
	}

	offset := (page - 1) * pageSize

	baseQuery := db.Table("creators").
		Joins("LEFT JOIN users ON creators.user_id = users.id AND users.deleted_at IS NULL").
		Joins(`LEFT JOIN (
			SELECT
				user_id,
				COUNT(*) as resource_count,
				COALESCE(SUM(download_count), 0) as download_count
			FROM resources
			WHERE deleted_at IS NULL
			GROUP BY user_id
		) as resource_stats ON creators.user_id = resource_stats.user_id`).
		Joins(`LEFT JOIN (
			SELECT
				creator_id,
				COUNT(*) as follower_count
			FROM user_follows
			WHERE deleted_at IS NULL
			GROUP BY creator_id
		) as follow_stats ON creators.id = follow_stats.creator_id`).
		Where("creators.is_active = ? AND creators.deleted_at IS NULL", true)

	if keyword != "" {
		like := "%" + keyword + "%"
		baseQuery = baseQuery.Where(
			"creators.code LIKE ? OR creators.description LIKE ? OR users.nickname LIKE ?",
			like,
			like,
			like,
		)
	}

	var total int64
	if err := baseQuery.Count(&total).Error; err != nil {
		logger.Log.WithField("error", err).Error("SearchCreators count failed")
		Error(c, 500, "查询创作者失败："+err.Error())
		return
	}

	var rows []publicCreatorSearchRow
	if err := baseQuery.
		Select(`creators.id, creators.code, creators.description, creators.created_at,
			COALESCE(users.nickname, '') as name,
			COALESCE(users.avatar, '') as avatar,
			COALESCE(resource_stats.resource_count, 0) as resource_count,
			COALESCE(resource_stats.download_count, 0) as download_count,
			COALESCE(follow_stats.follower_count, 0) as follower_count`).
		Order("resource_count DESC, download_count DESC, creators.created_at DESC").
		Limit(pageSize).
		Offset(offset).
		Scan(&rows).Error; err != nil {
		logger.Log.WithField("error", err).Error("SearchCreators scan failed")
		Error(c, 500, "查询创作者失败："+err.Error())
		return
	}

	list := make([]HotCreatorResponse, 0, len(rows))
	for _, row := range rows {
		list = append(list, HotCreatorResponse{
			ID:            strconv.FormatInt(row.ID, 10),
			Code:          row.Code,
			Name:          row.Name,
			Avatar:        row.Avatar,
			Description:   row.Description,
			ResourceCount: int(row.ResourceCount),
			DownloadCount: row.DownloadCount,
			FollowerCount: row.FollowerCount,
			CreatedAt:     row.CreatedAt.Format("2006-01-02T15:04:05Z"),
		})
	}

	Success(c, gin.H{
		"list":     list,
		"total":    total,
		"page":     page,
		"pageSize": pageSize,
	})
}
