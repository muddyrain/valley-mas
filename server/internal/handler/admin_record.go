package handler

import (
	"strconv"
	"valley-server/internal/database"
	"valley-server/internal/model"

	"github.com/gin-gonic/gin"
)

// ListDownloadRecords 下载记录列表
// @Summary      获取下载记录
// @Description  管理员查看所有下载记录
// @Tags         管理后台 - 记录管理
// @Accept       json
// @Produce      json
// @Security     Bearer
// @Param        page       query  int     false  "页码"        default(1)
// @Param        pageSize   query  int     false  "每页数量"     default(20)
// @Param        creatorId  query  string  false  "创作者ID筛选"
// @Param        resourceId query  string  false  "资源ID筛选"
// @Param        userId     query  string  false  "用户ID筛选"
// @Success      200  {object}  map[string]interface{}  "下载记录列表"
// @Failure      401  {object}  map[string]interface{}  "未登录"
// @Failure      403  {object}  map[string]interface{}  "无权限"
// @Router       /admin/records/downloads [get]
func ListDownloadRecords(c *gin.Context) {
	db := database.DB

	// 解析分页参数
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "20"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	offset := (page - 1) * pageSize

	// 解析筛选参数
	creatorIDStr := c.Query("creatorId")
	resourceIDStr := c.Query("resourceId")
	userIDStr := c.Query("userId")

	// 构建查询
	query := db.Model(&model.DownloadRecord{})

	// 创作者筛选
	if creatorIDStr != "" {
		var creatorID model.Int64String
		if err := creatorID.Scan(creatorIDStr); err == nil {
			query = query.Where("creator_id = ?", creatorID)
		}
	}

	// 资源筛选
	if resourceIDStr != "" {
		var resourceID model.Int64String
		if err := resourceID.Scan(resourceIDStr); err == nil {
			query = query.Where("resource_id = ?", resourceID)
		}
	}

	// 用户筛选
	if userIDStr != "" {
		var userID model.Int64String
		if err := userID.Scan(userIDStr); err == nil {
			query = query.Where("user_id = ?", userID)
		}
	}

	// 查询总数
	var total int64
	if err := query.Count(&total).Error; err != nil {
		Error(c, 500, "查询下载记录总数失败")
		return
	}

	// 查询列表(预加载关联数据)
	var records []model.DownloadRecord
	if err := query.
		Preload("User").
		Preload("Resource").
		Preload("Creator").
		Preload("Creator.User").
		Order("created_at DESC").
		Offset(offset).
		Limit(pageSize).
		Find(&records).Error; err != nil {
		Error(c, 500, "查询下载记录列表失败")
		return
	}

	// 格式化返回数据
	type UserInfo struct {
		ID       string `json:"id"`
		Nickname string `json:"nickname"`
		Avatar   string `json:"avatar"`
	}

	type ResourceInfo struct {
		ID           string `json:"id"`
		Title        string `json:"title"`
		Type         string `json:"type"`
		URL          string `json:"url"`
		ThumbnailURL string `json:"thumbnailUrl"`
	}

	type CreatorInfo struct {
		ID   string    `json:"id"`
		Code string    `json:"code"`
		User *UserInfo `json:"user,omitempty"`
	}

	type DownloadRecordResponse struct {
		ID         string        `json:"id"`
		UserID     string        `json:"userId"`
		ResourceID string        `json:"resourceId"`
		CreatorID  string        `json:"creatorId"`
		IP         string        `json:"ip"`
		UserAgent  string        `json:"userAgent"`
		CreatedAt  string        `json:"createdAt"`
		User       *UserInfo     `json:"user,omitempty"`
		Resource   *ResourceInfo `json:"resource,omitempty"`
		Creator    *CreatorInfo  `json:"creator,omitempty"`
	}

	list := make([]DownloadRecordResponse, len(records))
	for i, record := range records {
		list[i] = DownloadRecordResponse{
			ID:         record.ID.String(),
			UserID:     record.UserID.String(),
			ResourceID: record.ResourceID.String(),
			CreatorID:  record.CreatorID.String(),
			IP:         record.IP,
			UserAgent:  record.UserAgent,
			CreatedAt:  record.CreatedAt.Format("2006-01-02 15:04:05"),
		}

		// 用户信息
		if record.User != nil {
			list[i].User = &UserInfo{
				ID:       record.User.ID.String(),
				Nickname: record.User.Nickname,
				Avatar:   record.User.Avatar,
			}
		}

		// 资源信息
		if record.Resource != nil {
			list[i].Resource = &ResourceInfo{
				ID:           record.Resource.ID.String(),
				Title:        record.Resource.Title,
				Type:         record.Resource.Type,
				URL:          record.Resource.URL,
				ThumbnailURL: record.Resource.ThumbnailURL,
			}
		}

		// 创作者信息
		if record.Creator != nil {
			list[i].Creator = &CreatorInfo{
				ID:   record.Creator.ID.String(),
				Code: record.Creator.Code,
			}
			if record.Creator.User != nil {
				list[i].Creator.User = &UserInfo{
					ID:       record.Creator.User.ID.String(),
					Nickname: record.Creator.User.Nickname,
					Avatar:   record.Creator.User.Avatar,
				}
			}
		}
	}

	Success(c, gin.H{
		"list":  list,
		"total": total,
	})
}
