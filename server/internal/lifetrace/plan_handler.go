package lifetrace

import (
	"errors"
	"net/http"
	"strings"
	"time"
	"valley-server/internal/database"
	"valley-server/internal/model"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type apiResponse struct {
	Code    int         `json:"code"`
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
}

type createPlanRequest struct {
	Title     string `json:"title"`
	Type      string `json:"type"`
	TimeLabel string `json:"timeLabel"`
	Reminder  bool   `json:"reminder"`
	ImageURL  string `json:"imageUrl"`
	Location  string `json:"location"`
	Note      string `json:"note"`
	Source    string `json:"source"`
}

type updatePlanStatusRequest struct {
	Completed bool `json:"completed"`
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

func success(c *gin.Context, data interface{}) {
	c.JSON(http.StatusOK, apiResponse{Code: 0, Message: "success", Data: data})
}

func fail(c *gin.Context, code int, message string) {
	c.JSON(http.StatusOK, apiResponse{Code: code, Message: message})
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

func (h *Handler) ListPlans(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		fail(c, http.StatusUnauthorized, "未登录")
		return
	}

	var plans []model.LifeTracePlan
	if err := database.GetDB().
		Where("user_id = ?", userID).
		Order("completed ASC, created_at DESC").
		Find(&plans).Error; err != nil {
		fail(c, http.StatusInternalServerError, "获取计划失败")
		return
	}

	success(c, gin.H{"list": plans})
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

	plan := model.LifeTracePlan{
		UserID:    userID,
		Title:     title,
		Type:      normalizePlanType(req.Type),
		TimeLabel: timeLabel,
		Reminder:  req.Reminder,
		ImageURL:  strings.TrimSpace(req.ImageURL),
		Location:  strings.TrimSpace(req.Location),
		Note:      strings.TrimSpace(req.Note),
		Source:    normalizePlanSource(req.Source),
	}

	if plan.Note == "" {
		plan.Note = "由 Life Trace 创建的新生活计划。"
	}

	if err := database.GetDB().Create(&plan).Error; err != nil {
		fail(c, http.StatusInternalServerError, "创建计划失败")
		return
	}

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
