package handler

import (
	"strings"
	"time"
	"valley-server/internal/database"
	"valley-server/internal/model"

	"github.com/gin-gonic/gin"
)

const (
	feedbackStatusOpen     = "open"
	feedbackStatusResolved = "resolved"
)

func ListFeedbacks(c *gin.Context) {
	page := GetIntQuery(c, "page", 1)
	pageSize := GetIntQuery(c, "pageSize", 20)
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	status := strings.TrimSpace(c.Query("status"))
	app := strings.TrimSpace(c.Query("app"))
	keyword := strings.TrimSpace(c.Query("keyword"))

	query := database.DB.Model(&model.LifeTraceFeedback{}).
		Joins("LEFT JOIN users ON users.id = life_trace_feedbacks.user_id")

	if status != "" && status != "all" {
		query = query.Where("life_trace_feedbacks.status = ?", status)
	}
	if app != "" && app != "all" {
		query = query.Where("life_trace_feedbacks.app = ?", app)
	}
	if keyword != "" {
		like := "%" + keyword + "%"
		query = query.Where(
			"life_trace_feedbacks.content LIKE ? OR users.nickname LIKE ? OR users.username LIKE ? OR users.open_id LIKE ?",
			like,
			like,
			like,
			like,
		)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		Error(c, 500, "查询反馈失败")
		return
	}

	var feedbacks []model.LifeTraceFeedback
	if err := query.Preload("User").
		Order("life_trace_feedbacks.created_at DESC").
		Offset((page - 1) * pageSize).
		Limit(pageSize).
		Find(&feedbacks).Error; err != nil {
		Error(c, 500, "查询反馈失败")
		return
	}

	Success(c, gin.H{
		"list":     feedbacks,
		"total":    total,
		"page":     page,
		"pageSize": pageSize,
	})
}

func UpdateFeedbackStatus(c *gin.Context) {
	id := strings.TrimSpace(c.Param("id"))
	if id == "" {
		Error(c, 400, "反馈 ID 不能为空")
		return
	}

	var req struct {
		Status string `json:"status"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		Error(c, 400, "参数错误")
		return
	}

	status := strings.TrimSpace(req.Status)
	if status != feedbackStatusOpen && status != feedbackStatusResolved {
		Error(c, 400, "反馈状态不合法")
		return
	}

	updates := map[string]interface{}{
		"status":      status,
		"resolved_by": 0,
		"resolved_at": nil,
	}
	if status == feedbackStatusResolved {
		now := time.Now()
		updates["resolved_by"] = model.Int64String(GetCurrentUserID(c))
		updates["resolved_at"] = &now
	}

	if err := database.DB.Model(&model.LifeTraceFeedback{}).
		Where("id = ?", id).
		Updates(updates).Error; err != nil {
		Error(c, 500, "更新反馈状态失败")
		return
	}

	var feedback model.LifeTraceFeedback
	if err := database.DB.Preload("User").First(&feedback, "id = ?", id).Error; err != nil {
		Error(c, 404, "反馈不存在")
		return
	}

	Success(c, feedback)
}
