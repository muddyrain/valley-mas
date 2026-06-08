package lifetrace

import (
	"errors"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"
	"valley-server/internal/database"
	"valley-server/internal/logger"
	"valley-server/internal/model"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type apiResponse struct {
	Code      int         `json:"code"`
	Message   string      `json:"message"`
	Data      interface{} `json:"data,omitempty"`
	ErrorCode string      `json:"errorCode,omitempty"`
}

type createPlanRequest struct {
	Title         string `json:"title"`
	Type          string `json:"type"`
	TimeLabel     string `json:"timeLabel"`
	ScheduledDate string `json:"scheduledDate"`
	ScheduledTime string `json:"scheduledTime"`
	Timezone      string `json:"timezone"`
	Reminder      bool   `json:"reminder"`
	ImageURL      string `json:"imageUrl"`
	Location      string `json:"location"`
	Note          string `json:"note"`
	Source        string `json:"source"`
}

type updatePlanStatusRequest struct {
	Completed bool `json:"completed"`
}

type listPagination struct {
	Page     int   `json:"page"`
	PageSize int   `json:"pageSize"`
	Total    int64 `json:"total"`
	HasMore  bool  `json:"hasMore"`
}

var validPlanTypes = map[string]bool{
	"电影":   true,
	"吃饭":   true,
	"运动":   true,
	"阅读":   true,
	"聚会":   true,
	"普通事项": true,
}

var validPlanSources = map[string]bool{
	"manual":         true,
	"weather_advice": true,
	"ai_advice":      true,
	"image_ai":       true,
}

var planInternalMarkerPattern = regexp.MustCompile(`\s*#(?:assistant-plan|assistant-reminder|advice):[^\s。；;，,]+`)

func success(c *gin.Context, data interface{}) {
	c.JSON(http.StatusOK, apiResponse{Code: 0, Message: "success", Data: data})
}

func fail(c *gin.Context, code int, message string) {
	c.JSON(http.StatusOK, apiResponse{Code: code, Message: message})
}

func failWithErrorCode(c *gin.Context, code int, message string, errorCode string) {
	c.JSON(http.StatusOK, apiResponse{Code: code, Message: message, ErrorCode: errorCode})
}

func currentUserID(c *gin.Context) (model.Int64String, bool) {
	userID, ok := c.Get("userId")
	if !ok {
		return 0, false
	}

	switch value := userID.(type) {
	case int64:
		return model.Int64String(value), true
	case model.Int64String:
		return value, true
	default:
		return 0, false
	}
}

func normalizePlanSource(source string) string {
	source = strings.TrimSpace(source)
	if source == "" {
		return "manual"
	}
	if !validPlanSources[source] {
		return "manual"
	}
	return source
}

func normalizePlanType(planType string) string {
	planType = strings.TrimSpace(planType)
	if !validPlanTypes[planType] {
		return "普通事项"
	}
	return planType
}

func sanitizePlanNote(note string) string {
	return strings.TrimSpace(planInternalMarkerPattern.ReplaceAllString(strings.TrimSpace(note), ""))
}

func normalizePlanSchedule(date string, clock string, timezone string) (string, string, string, bool) {
	date = strings.TrimSpace(date)
	clock = strings.TrimSpace(clock)
	timezone = strings.TrimSpace(timezone)

	if timezone == "" {
		timezone = "Asia/Shanghai"
	}

	if date == "" && clock == "" {
		return "", "", timezone, true
	}

	if date == "" || clock == "" {
		return "", "", "", false
	}

	if _, err := time.Parse("2006-01-02", date); err != nil {
		return "", "", "", false
	}
	if _, err := time.Parse("15:04", clock); err != nil {
		return "", "", "", false
	}

	return date, clock, timezone, true
}

func parseListPagination(c *gin.Context) (page int, pageSize int) {
	page = parsePositiveQueryInt(c, "page", 1)
	pageSize = parsePositiveQueryInt(c, "pageSize", 20)
	if pageSize > 50 {
		pageSize = 50
	}
	return page, pageSize
}

func parsePositiveQueryInt(c *gin.Context, key string, fallback int) int {
	raw := strings.TrimSpace(c.Query(key))
	if raw == "" {
		return fallback
	}
	value, err := strconv.Atoi(raw)
	if err != nil || value <= 0 {
		return fallback
	}
	return value
}

func buildListPagination(page int, pageSize int, total int64) listPagination {
	return listPagination{
		Page:     page,
		PageSize: pageSize,
		Total:    total,
		HasMore:  int64(page*pageSize) < total,
	}
}

func applyPlanListFilters(query *gorm.DB, c *gin.Context) *gorm.DB {
	status := strings.TrimSpace(c.Query("status"))
	switch status {
	case "open":
		query = query.Where("completed = ?", false)
	case "completed":
		query = query.Where("completed = ?", true)
	}

	planType := strings.TrimSpace(c.Query("type"))
	if planType != "" && validPlanTypes[planType] {
		query = query.Where("type = ?", planType)
	}

	keyword := strings.TrimSpace(c.Query("q"))
	if keyword != "" {
		like := "%" + keyword + "%"
		query = query.Where("(title LIKE ? OR note LIKE ? OR location LIKE ?)", like, like, like)
	}

	if reminder := strings.TrimSpace(c.Query("reminder")); reminder == "true" || reminder == "false" {
		query = query.Where("reminder = ?", reminder == "true")
	}

	dateFrom := strings.TrimSpace(c.Query("dateFrom"))
	if dateFrom != "" {
		if _, err := time.Parse("2006-01-02", dateFrom); err == nil {
			query = query.Where("scheduled_date >= ?", dateFrom)
		}
	}

	dateTo := strings.TrimSpace(c.Query("dateTo"))
	if dateTo != "" {
		if _, err := time.Parse("2006-01-02", dateTo); err == nil {
			query = query.Where("scheduled_date <= ?", dateTo)
		}
	}

	return query
}

func (h *Handler) ListPlans(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		fail(c, http.StatusUnauthorized, "未登录")
		return
	}

	page, pageSize := parseListPagination(c)
	offset := (page - 1) * pageSize
	baseQuery := database.GetDB().
		Model(&model.LifeTracePlan{}).
		Where("user_id = ?", userID)
	baseQuery = applyPlanListFilters(baseQuery, c)

	var total int64
	if err := baseQuery.Count(&total).Error; err != nil {
		fail(c, http.StatusInternalServerError, "获取计划失败")
		return
	}

	var plans []model.LifeTracePlan
	if err := baseQuery.
		Order("completed ASC, scheduled_date ASC, scheduled_time ASC, created_at DESC").
		Limit(pageSize).
		Offset(offset).
		Find(&plans).Error; err != nil {
		fail(c, http.StatusInternalServerError, "获取计划失败")
		return
	}

	success(c, gin.H{
		"list":       plans,
		"pagination": buildListPagination(page, pageSize, total),
	})
}

func (h *Handler) CreatePlan(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		fail(c, http.StatusUnauthorized, "未登录")
		return
	}

	var req createPlanRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		fail(c, http.StatusBadRequest, "参数错误")
		return
	}

	title := strings.TrimSpace(req.Title)
	timeLabel := strings.TrimSpace(req.TimeLabel)
	if title == "" || timeLabel == "" {
		fail(c, http.StatusBadRequest, "计划标题和时间不能为空")
		return
	}

	scheduledDate, scheduledTime, timezone, ok := normalizePlanSchedule(
		req.ScheduledDate,
		req.ScheduledTime,
		req.Timezone,
	)
	if !ok {
		fail(c, http.StatusBadRequest, "计划时间格式错误")
		return
	}

	plan := model.LifeTracePlan{
		UserID:        userID,
		Title:         title,
		Type:          normalizePlanType(req.Type),
		TimeLabel:     timeLabel,
		ScheduledDate: scheduledDate,
		ScheduledTime: scheduledTime,
		Timezone:      timezone,
		Reminder:      req.Reminder,
		ImageURL:      strings.TrimSpace(req.ImageURL),
		Location:      strings.TrimSpace(req.Location),
		Note:          sanitizePlanNote(req.Note),
		Source:        normalizePlanSource(req.Source),
	}

	if plan.Note == "" {
		plan.Note = "由 Life Trace 创建的新生活计划。"
	}

	db := database.GetDB()
	if err := db.Create(&plan).Error; err != nil {
		logger.Log.WithField("error", err).Error("LifeTrace CreatePlan insert failed")
		fail(c, http.StatusInternalServerError, "创建计划失败")
		return
	}
	if !req.Reminder {
		if err := db.Model(&plan).Update("reminder", false).Error; err != nil {
			logger.Log.WithField("error", err).Error("LifeTrace CreatePlan reminder update failed")
			fail(c, http.StatusInternalServerError, "创建计划失败")
			return
		}
		plan.Reminder = false
	}

	evaluateAchievementsQuietly(userID)
	success(c, plan)
}

func (h *Handler) UpdatePlanStatus(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		fail(c, http.StatusUnauthorized, "未登录")
		return
	}

	var req updatePlanStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		fail(c, http.StatusBadRequest, "参数错误")
		return
	}

	plan, found := findPlan(c.Param("id"), userID)
	if !found {
		fail(c, http.StatusNotFound, "计划不存在")
		return
	}

	updates := map[string]interface{}{"completed": req.Completed}
	if req.Completed {
		now := time.Now()
		updates["completed_at"] = &now
	} else {
		updates["completed_at"] = nil
	}

	if err := database.GetDB().Model(&plan).Updates(updates).Error; err != nil {
		fail(c, http.StatusInternalServerError, "更新计划失败")
		return
	}
	resetPushDeliveriesForPlan(database.GetDB(), plan.ID)

	if err := database.GetDB().First(&plan, "id = ? AND user_id = ?", plan.ID, userID).Error; err != nil {
		fail(c, http.StatusInternalServerError, "读取计划失败")
		return
	}

	evaluateAchievementsQuietly(userID)
	success(c, plan)
}

func (h *Handler) UpdatePlan(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		fail(c, http.StatusUnauthorized, "未登录")
		return
	}

	plan, found := findPlan(c.Param("id"), userID)
	if !found {
		fail(c, http.StatusNotFound, "计划不存在")
		return
	}

	var req createPlanRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		fail(c, http.StatusBadRequest, "参数错误")
		return
	}

	title := strings.TrimSpace(req.Title)
	timeLabel := strings.TrimSpace(req.TimeLabel)
	if title == "" || timeLabel == "" {
		fail(c, http.StatusBadRequest, "计划标题和时间不能为空")
		return
	}

	scheduledDate, scheduledTime, timezone, ok := normalizePlanSchedule(
		req.ScheduledDate,
		req.ScheduledTime,
		req.Timezone,
	)
	if !ok {
		fail(c, http.StatusBadRequest, "计划时间格式错误")
		return
	}

	updates := map[string]interface{}{
		"title":          title,
		"type":           normalizePlanType(req.Type),
		"time_label":     timeLabel,
		"scheduled_date": scheduledDate,
		"scheduled_time": scheduledTime,
		"timezone":       timezone,
		"reminder":       req.Reminder,
		"image_url":      strings.TrimSpace(req.ImageURL),
		"location":       strings.TrimSpace(req.Location),
		"note":           sanitizePlanNote(req.Note),
		"source":         normalizePlanSource(req.Source),
	}
	if updates["note"] == "" {
		updates["note"] = "由 Life Trace 创建的新生活计划。"
	}

	if err := database.GetDB().Model(&plan).Updates(updates).Error; err != nil {
		logger.Log.WithField("error", err).Error("LifeTrace UpdatePlan failed")
		fail(c, http.StatusInternalServerError, "更新计划失败")
		return
	}
	resetPushDeliveriesForPlan(database.GetDB(), plan.ID)

	if err := database.GetDB().First(&plan, "id = ? AND user_id = ?", plan.ID, userID).Error; err != nil {
		fail(c, http.StatusInternalServerError, "读取计划失败")
		return
	}

	success(c, plan)
}

func (h *Handler) DeletePlan(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		fail(c, http.StatusUnauthorized, "未登录")
		return
	}

	plan, found := findPlan(c.Param("id"), userID)
	if !found {
		fail(c, http.StatusNotFound, "计划不存在")
		return
	}

	if err := database.GetDB().Delete(&plan).Error; err != nil {
		fail(c, http.StatusInternalServerError, "删除计划失败")
		return
	}
	resetPushDeliveriesForPlan(database.GetDB(), plan.ID)

	success(c, gin.H{"id": plan.ID})
}

func findPlan(id string, userID model.Int64String) (model.LifeTracePlan, bool) {
	var plan model.LifeTracePlan
	err := database.GetDB().First(&plan, "id = ? AND user_id = ?", id, userID).Error
	if err == nil {
		return plan, true
	}
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return plan, false
	}
	return plan, false
}
