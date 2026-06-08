package lifetrace

import (
	"errors"
	"net/http"
	"strconv"
	"strings"
	"valley-server/internal/database"
	"valley-server/internal/logger"
	"valley-server/internal/model"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type createTraceRequest struct {
	PlanID    string   `json:"planId"`
	Title     string   `json:"title"`
	Summary   string   `json:"summary"`
	TimeLabel string   `json:"timeLabel"`
	Location  string   `json:"location"`
	ImageURL  string   `json:"imageUrl"`
	Mood      string   `json:"mood"`
	Tags      []string `json:"tags"`
	Source    string   `json:"source"`
}

var validTraceSources = map[string]bool{
	"计划": true,
	"打卡": true,
	"库存": true,
	"手动": true,
}

func normalizeTraceSource(source string) string {
	source = strings.TrimSpace(source)
	if !validTraceSources[source] {
		return "手动"
	}
	return source
}

func normalizeTraceMood(mood string) string {
	mood = strings.TrimSpace(mood)
	if mood == "" {
		return "放松"
	}
	return mood
}

func normalizeTraceTags(tags []string) model.StringList {
	seen := map[string]bool{}
	result := model.StringList{}
	for _, tag := range tags {
		tag = strings.TrimSpace(tag)
		if tag == "" || seen[tag] {
			continue
		}
		seen[tag] = true
		result = append(result, tag)
	}
	if len(result) == 0 {
		return model.StringList{"生活迹"}
	}
	return result
}

func parseOptionalPlanID(raw string) (*model.Int64String, bool) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil, true
	}
	id, err := strconv.ParseInt(raw, 10, 64)
	if err != nil || id <= 0 {
		return nil, false
	}
	value := model.Int64String(id)
	return &value, true
}

func (h *Handler) ListTraces(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		fail(c, http.StatusUnauthorized, "未登录")
		return
	}

	page, pageSize := parseListPagination(c)
	offset := (page - 1) * pageSize
	var total int64
	if err := database.GetDB().
		Model(&model.LifeTraceTrace{}).
		Where("user_id = ?", userID).
		Count(&total).Error; err != nil {
		fail(c, http.StatusInternalServerError, "获取踪迹失败")
		return
	}

	var traces []model.LifeTraceTrace
	if err := database.GetDB().
		Where("user_id = ?", userID).
		Order("created_at DESC").
		Limit(pageSize).
		Offset(offset).
		Find(&traces).Error; err != nil {
		fail(c, http.StatusInternalServerError, "获取踪迹失败")
		return
	}

	success(c, gin.H{
		"list":       traces,
		"pagination": buildListPagination(page, pageSize, total),
	})
}

func (h *Handler) CreateTrace(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		fail(c, http.StatusUnauthorized, "未登录")
		return
	}

	var req createTraceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		fail(c, http.StatusBadRequest, "参数错误")
		return
	}

	title := strings.TrimSpace(req.Title)
	summary := strings.TrimSpace(req.Summary)
	timeLabel := strings.TrimSpace(req.TimeLabel)
	if title == "" || summary == "" || timeLabel == "" {
		fail(c, http.StatusBadRequest, "踪迹标题、内容和时间不能为空")
		return
	}

	planID, valid := parseOptionalPlanID(req.PlanID)
	if !valid {
		fail(c, http.StatusBadRequest, "计划 ID 不合法")
		return
	}

	trace := model.LifeTraceTrace{
		UserID:    userID,
		PlanID:    planID,
		Title:     title,
		Summary:   summary,
		TimeLabel: timeLabel,
		Location:  strings.TrimSpace(req.Location),
		ImageURL:  strings.TrimSpace(req.ImageURL),
		Mood:      normalizeTraceMood(req.Mood),
		Tags:      normalizeTraceTags(req.Tags),
		Source:    normalizeTraceSource(req.Source),
	}

	if err := database.GetDB().Create(&trace).Error; err != nil {
		if logger.Log != nil {
			logger.Log.WithFields(map[string]interface{}{
				"userId":      userID.String(),
				"planId":      strings.TrimSpace(req.PlanID),
				"titleLength": len(title),
				"summarySize": len(summary),
				"timeLabel":   timeLabel,
				"source":      trace.Source,
			}).WithError(err).Error("LifeTrace CreateTrace insert failed")
		}
		fail(c, http.StatusInternalServerError, "创建踪迹失败")
		return
	}

	evaluateAchievementsQuietly(userID)
	success(c, trace)
}

func (h *Handler) UpdateTrace(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		fail(c, http.StatusUnauthorized, "未登录")
		return
	}

	trace, found := findTrace(c.Param("id"), userID)
	if !found {
		fail(c, http.StatusNotFound, "踪迹不存在")
		return
	}

	var req createTraceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		fail(c, http.StatusBadRequest, "参数错误")
		return
	}

	title := strings.TrimSpace(req.Title)
	summary := strings.TrimSpace(req.Summary)
	timeLabel := strings.TrimSpace(req.TimeLabel)
	if title == "" || summary == "" || timeLabel == "" {
		fail(c, http.StatusBadRequest, "踪迹标题、内容和时间不能为空")
		return
	}

	planID, valid := parseOptionalPlanID(req.PlanID)
	if !valid {
		fail(c, http.StatusBadRequest, "计划 ID 不合法")
		return
	}

	updates := map[string]interface{}{
		"plan_id":    planID,
		"title":      title,
		"summary":    summary,
		"time_label": timeLabel,
		"location":   strings.TrimSpace(req.Location),
		"image_url":  strings.TrimSpace(req.ImageURL),
		"mood":       normalizeTraceMood(req.Mood),
		"tags":       normalizeTraceTags(req.Tags),
		"source":     normalizeTraceSource(req.Source),
	}

	if err := database.GetDB().Model(&trace).Updates(updates).Error; err != nil {
		fail(c, http.StatusInternalServerError, "更新踪迹失败")
		return
	}

	if err := database.GetDB().First(&trace, "id = ? AND user_id = ?", trace.ID, userID).Error; err != nil {
		fail(c, http.StatusInternalServerError, "读取踪迹失败")
		return
	}

	success(c, trace)
}

func (h *Handler) DeleteTrace(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		fail(c, http.StatusUnauthorized, "未登录")
		return
	}

	trace, found := findTrace(c.Param("id"), userID)
	if !found {
		fail(c, http.StatusNotFound, "踪迹不存在")
		return
	}

	if err := database.GetDB().Delete(&trace).Error; err != nil {
		fail(c, http.StatusInternalServerError, "删除踪迹失败")
		return
	}

	success(c, gin.H{"id": trace.ID})
}

func findTrace(id string, userID model.Int64String) (model.LifeTraceTrace, bool) {
	var trace model.LifeTraceTrace
	err := database.GetDB().First(&trace, "id = ? AND user_id = ?", id, userID).Error
	if err == nil {
		return trace, true
	}
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return trace, false
	}
	return trace, false
}
