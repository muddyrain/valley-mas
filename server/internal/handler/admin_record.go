package handler

import (
	"bytes"
	"encoding/csv"
	"fmt"
	"strconv"
	"strings"
	"time"
	"valley-server/internal/database"
	"valley-server/internal/logger"
	"valley-server/internal/model"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type downloadRecordListFilters struct {
	CreatorID    model.Int64String
	ResourceID   model.Int64String
	UserID       model.Int64String
	Keyword      string
	ResourceType string
	DateFrom     string
	DateTo       string
}

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
// @Param        keyword    query  string  false  "按资源标题、创作者昵称/口令、下载用户昵称、IP 搜索"
// @Param        resourceType query string false  "资源类型筛选"
// @Param        dateFrom   query  string  false  "起始时间"
// @Param        dateTo     query  string  false  "结束时间"
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

	filters := parseDownloadRecordListFilters(c)
	query := buildDownloadRecordQuery(db, filters)

	// 查询总数
	var total int64
	if err := query.Count(&total).Error; err != nil {
		logger.Log.WithField("error", err).Error("ListDownloadRecords count failed")
		Error(c, 500, "查询下载记录总数失败："+err.Error())
		return
	}

	// 查询列表(预加载关联数据)
	var records []model.DownloadRecord
	if err := query.
		Preload("User").
		Preload("Resource").
		Preload("Creator").
		Preload("Creator.User").
		Order("download_records.created_at DESC").
		Offset(offset).
		Limit(pageSize).
		Find(&records).Error; err != nil {
		logger.Log.WithField("error", err).Error("ListDownloadRecords list failed")
		Error(c, 500, "查询下载记录列表失败："+err.Error())
		return
	}

	// 格式化返回数据
	type UserInfo struct {
		ID       string `json:"id"`
		Nickname string `json:"nickname"`
		Avatar   string `json:"avatar"`
	}

	type ResourceInfo struct {
		ID    string `json:"id"`
		Title string `json:"title"`
		Type  string `json:"type"`
		URL   string `json:"url"`
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
				ID:    record.Resource.ID.String(),
				Title: record.Resource.Title,
				Type:  record.Resource.Type,
				URL:   record.Resource.URL,
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

// ExportDownloadRecords 导出下载记录 CSV
func ExportDownloadRecords(c *gin.Context) {
	db := database.DB
	filters := parseDownloadRecordListFilters(c)

	var records []model.DownloadRecord
	if err := buildDownloadRecordQuery(db, filters).
		Preload("User").
		Preload("Resource").
		Preload("Creator").
		Preload("Creator.User").
		Order("download_records.created_at DESC").
		Find(&records).Error; err != nil {
		logger.Log.WithField("error", err).Error("ExportDownloadRecords query failed")
		Error(c, 500, "导出下载记录失败："+err.Error())
		return
	}

	buffer := &bytes.Buffer{}
	buffer.WriteString("\uFEFF")
	writer := csv.NewWriter(buffer)
	if err := writer.Write([]string{
		"下载记录ID",
		"下载用户ID",
		"下载用户昵称",
		"资源ID",
		"资源标题",
		"资源类型",
		"创作者ID",
		"创作者口令",
		"创作者昵称",
		"IP地址",
		"User-Agent",
		"下载时间",
	}); err != nil {
		Error(c, 500, "生成导出表头失败")
		return
	}

	for _, record := range records {
		downloadUserName := "匿名下载"
		if record.User != nil && strings.TrimSpace(record.User.Nickname) != "" {
			downloadUserName = record.User.Nickname
		}

		resourceTitle := ""
		resourceType := ""
		if record.Resource != nil {
			resourceTitle = record.Resource.Title
			resourceType = record.Resource.Type
		}

		creatorCode := ""
		creatorName := ""
		if record.Creator != nil {
			creatorCode = record.Creator.Code
			if record.Creator.User != nil {
				creatorName = record.Creator.User.Nickname
			}
		}

		if err := writer.Write([]string{
			record.ID.String(),
			record.UserID.String(),
			downloadUserName,
			record.ResourceID.String(),
			resourceTitle,
			resourceType,
			record.CreatorID.String(),
			creatorCode,
			creatorName,
			record.IP,
			record.UserAgent,
			record.CreatedAt.Format("2006-01-02 15:04:05"),
		}); err != nil {
			Error(c, 500, "生成导出内容失败")
			return
		}
	}

	writer.Flush()
	if err := writer.Error(); err != nil {
		Error(c, 500, "生成导出文件失败")
		return
	}

	filename := fmt.Sprintf("download-records-%s.csv", time.Now().Format("20060102-150405"))
	c.Header("Content-Type", "text/csv; charset=utf-8")
	c.Header("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, filename))
	c.Data(200, "text/csv; charset=utf-8", buffer.Bytes())
}

func parseDownloadRecordListFilters(c *gin.Context) downloadRecordListFilters {
	filters := downloadRecordListFilters{
		Keyword:      strings.TrimSpace(c.Query("keyword")),
		ResourceType: strings.TrimSpace(c.Query("resourceType")),
		DateFrom:     strings.TrimSpace(c.Query("dateFrom")),
		DateTo:       strings.TrimSpace(c.Query("dateTo")),
	}

	if creatorIDStr := strings.TrimSpace(c.Query("creatorId")); creatorIDStr != "" {
		_ = filters.CreatorID.Scan(creatorIDStr)
	}
	if resourceIDStr := strings.TrimSpace(c.Query("resourceId")); resourceIDStr != "" {
		_ = filters.ResourceID.Scan(resourceIDStr)
	}
	if userIDStr := strings.TrimSpace(c.Query("userId")); userIDStr != "" {
		_ = filters.UserID.Scan(userIDStr)
	}

	return filters
}

func buildDownloadRecordQuery(db *gorm.DB, filters downloadRecordListFilters) *gorm.DB {
	query := db.Model(&model.DownloadRecord{}).
		Joins("LEFT JOIN resources ON resources.id = download_records.resource_id").
		Joins("LEFT JOIN creators ON creators.id = download_records.creator_id").
		Joins("LEFT JOIN users AS download_users ON download_users.id = download_records.user_id").
		Joins("LEFT JOIN users AS creator_users ON creator_users.id = creators.user_id")

	if filters.CreatorID != 0 {
		query = query.Where("download_records.creator_id = ?", filters.CreatorID)
	}
	if filters.ResourceID != 0 {
		query = query.Where("download_records.resource_id = ?", filters.ResourceID)
	}
	if filters.UserID != 0 {
		query = query.Where("download_records.user_id = ?", filters.UserID)
	}
	if filters.ResourceType != "" {
		query = query.Where("resources.type = ?", filters.ResourceType)
	}
	if filters.DateFrom != "" {
		query = query.Where("download_records.created_at >= ?", filters.DateFrom)
	}
	if filters.DateTo != "" {
		query = query.Where("download_records.created_at <= ?", filters.DateTo)
	}
	if filters.Keyword != "" {
		like := "%" + filters.Keyword + "%"
		query = query.Where(
			`resources.title LIKE ? OR creators.code LIKE ? OR download_users.nickname LIKE ? OR creator_users.nickname LIKE ? OR download_records.ip LIKE ?`,
			like,
			like,
			like,
			like,
			like,
		)
	}

	return query
}
