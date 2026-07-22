package lifetrace

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"time"

	"valley-server/internal/aiusage"
	"valley-server/internal/database"
	prompts "valley-server/internal/lifetrace/ai/prompts"
	"valley-server/internal/model"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

const lifeTraceWeeklyReviewMaxTokens = prompts.WeeklyReviewMaxTokens

type weeklyReviewRequest struct {
	ModelID string `json:"modelId" binding:"required"`
}

func (h *Handler) GenerateWeeklyReview(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, apiResponse{Code: http.StatusUnauthorized, Message: "未登录"})
		return
	}

	var req weeklyReviewRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		fail(c, http.StatusBadRequest, "请选择用于生成周报的模型")
		return
	}
	invocation, ok := resolveLifeTraceCatalogInvocation(c, req.ModelID, "text", 45*time.Second)
	if !ok {
		return
	}

	settings, err := findSettings(userID)
	if err != nil {
		c.JSON(http.StatusOK, apiResponse{Code: http.StatusInternalServerError, Message: "获取偏好失败"})
		return
	}

	now := time.Now()
	weekStart, weekEnd := currentWeeklyReviewRange(now)
	var completedPlans []model.LifeTracePlan
	if err := database.GetDB().
		Where("user_id = ? AND completed = ? AND completed_at >= ?", userID, true, weekStart).
		Order("completed_at DESC, updated_at DESC").
		Limit(12).
		Find(&completedPlans).Error; err != nil {
		c.JSON(http.StatusOK, apiResponse{Code: http.StatusInternalServerError, Message: "获取已完成计划失败"})
		return
	}

	var openPlans []model.LifeTracePlan
	if err := database.GetDB().
		Where("user_id = ? AND completed = ?", userID, false).
		Order("created_at DESC").
		Limit(12).
		Find(&openPlans).Error; err != nil {
		c.JSON(http.StatusOK, apiResponse{Code: http.StatusInternalServerError, Message: "获取未完成计划失败"})
		return
	}

	var traces []model.LifeTraceTrace
	if err := database.GetDB().
		Where("user_id = ? AND created_at >= ?", userID, weekStart).
		Order("created_at DESC").
		Limit(12).
		Find(&traces).Error; err != nil {
		c.JSON(http.StatusOK, apiResponse{Code: http.StatusInternalServerError, Message: "获取踪迹失败"})
		return
	}

	prompt := buildWeeklyReviewPrompt(settings, weekStart, weekEnd, completedPlans, openPlans, traces)
	aiCtx, cancel := context.WithTimeout(c.Request.Context(), 45*time.Second)
	aiCtx = aiusage.WithAudit(aiCtx, "life-trace-weekly-review", userID.String())
	defer cancel()

	raw, modelName, err := callLifeTraceCatalogJSON(aiCtx, invocation, prompt, lifeTraceWeeklyReviewMaxTokens)
	if err != nil {
		c.JSON(http.StatusBadGateway, apiResponse{Code: http.StatusBadGateway, Message: "AI 服务请求失败：" + err.Error()})
		return
	}

	parsed, err := parseWeeklyReviewAIResponse(raw)
	if err != nil {
		c.JSON(http.StatusBadGateway, apiResponse{Code: http.StatusBadGateway, Message: "AI 周报解析失败：" + err.Error()})
		return
	}

	modelName = strings.TrimSpace(modelName)
	if modelName == "" {
		modelName = invocation.Model.ModelID
	}
	review, err := saveWeeklyReview(userID, weekStart, weekEnd, parsed, invocation.Provider.Provider, modelName)
	if err != nil {
		c.JSON(http.StatusOK, apiResponse{Code: http.StatusInternalServerError, Message: weeklyReviewSaveErrorMessage(err)})
		return
	}

	evaluateAchievementsQuietly(userID)
	success(c, weeklyReviewPayload(review))
}

func (h *Handler) ListWeeklyReviews(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, apiResponse{Code: http.StatusUnauthorized, Message: "未登录"})
		return
	}

	var reviews []model.LifeTraceWeeklyReview
	if err := database.GetDB().
		Where("user_id = ?", userID).
		Order("week_start DESC").
		Limit(24).
		Find(&reviews).Error; err != nil {
		c.JSON(http.StatusOK, apiResponse{Code: http.StatusInternalServerError, Message: "获取每周回顾失败"})
		return
	}

	list := make([]gin.H, 0, len(reviews))
	for _, review := range reviews {
		list = append(list, weeklyReviewPayload(review))
	}
	success(c, gin.H{"list": list})
}

func (h *Handler) DeleteWeeklyReview(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		fail(c, http.StatusUnauthorized, "未登录")
		return
	}

	var review model.LifeTraceWeeklyReview
	err := database.GetDB().First(&review, "id = ? AND user_id = ?", c.Param("id"), userID).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		fail(c, http.StatusNotFound, "周报不存在")
		return
	}
	if err != nil {
		fail(c, http.StatusInternalServerError, "读取周报失败")
		return
	}

	if err := database.GetDB().Delete(&review).Error; err != nil {
		fail(c, http.StatusInternalServerError, "删除周报失败")
		return
	}

	success(c, gin.H{"id": review.ID})
}

func buildWeeklyReviewPrompt(
	settings model.LifeTraceSettings,
	weekStart time.Time,
	weekEnd time.Time,
	completedPlans []model.LifeTracePlan,
	openPlans []model.LifeTracePlan,
	traces []model.LifeTraceTrace,
) string {
	return prompts.BuildWeeklyReviewPrompt(prompts.WeeklyReviewInput{
		City:           settings.City,
		WorkStart:      settings.WorkStart,
		WorkEnd:        settings.WorkEnd,
		CommuteMethod:  settings.CommuteMethod,
		WeekStart:      weekStart,
		WeekEnd:        weekEnd,
		CompletedPlans: mapWeeklyReviewPlanLines(completedPlans),
		OpenPlans:      mapWeeklyReviewPlanLines(openPlans),
		Traces:         mapWeeklyReviewTraceLines(traces),
	})
}

func mapWeeklyReviewPlanLines(plans []model.LifeTracePlan) []prompts.WeeklyReviewPlanLine {
	lines := make([]prompts.WeeklyReviewPlanLine, 0, len(plans))
	for _, plan := range plans {
		lines = append(lines, prompts.WeeklyReviewPlanLine{
			Title:     plan.Title,
			Type:      plan.Type,
			TimeLabel: plan.TimeLabel,
			Completed: plan.Completed,
		})
	}
	return lines
}

func mapWeeklyReviewTraceLines(traces []model.LifeTraceTrace) []prompts.WeeklyReviewTraceLine {
	lines := make([]prompts.WeeklyReviewTraceLine, 0, len(traces))
	for _, trace := range traces {
		lines = append(lines, prompts.WeeklyReviewTraceLine{
			Title:     trace.Title,
			Mood:      trace.Mood,
			TimeLabel: trace.TimeLabel,
			Source:    trace.Source,
			Tags:      []string(trace.Tags),
		})
	}
	return lines
}

func currentWeeklyReviewRange(now time.Time) (time.Time, time.Time) {
	dayStart := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	daysFromMonday := (int(dayStart.Weekday()) + 6) % 7
	return dayStart.AddDate(0, 0, -daysFromMonday), now
}

func saveWeeklyReview(
	userID model.Int64String,
	weekStart time.Time,
	weekEnd time.Time,
	parsed weeklyReviewAIResponse,
	source string,
	modelName string,
) (model.LifeTraceWeeklyReview, error) {
	review := model.LifeTraceWeeklyReview{
		UserID:      userID,
		WeekStart:   weekStart.Format("2006-01-02"),
		WeekEnd:     weekEnd.Format("2006-01-02"),
		Summary:     parsed.Summary,
		Wins:        model.StringList(parsed.Wins),
		Delays:      model.StringList(parsed.Delays),
		Insights:    model.StringList(parsed.Insights),
		NextActions: model.StringList(parsed.NextActions),
		Source:      source,
		Model:       modelName,
	}

	var existing model.LifeTraceWeeklyReview
	err := database.GetDB().
		Where("user_id = ? AND week_start = ?", userID, review.WeekStart).
		First(&existing).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		if err := database.GetDB().Create(&review).Error; err != nil {
			return model.LifeTraceWeeklyReview{}, err
		}
		return review, nil
	}
	if err != nil {
		return model.LifeTraceWeeklyReview{}, err
	}

	updates := map[string]interface{}{
		"week_end":     review.WeekEnd,
		"summary":      review.Summary,
		"wins":         review.Wins,
		"delays":       review.Delays,
		"insights":     review.Insights,
		"next_actions": review.NextActions,
		"source":       review.Source,
		"model":        review.Model,
	}
	if err := database.GetDB().Model(&existing).Updates(updates).Error; err != nil {
		return model.LifeTraceWeeklyReview{}, err
	}
	if err := database.GetDB().First(&existing, "id = ?", existing.ID).Error; err != nil {
		return model.LifeTraceWeeklyReview{}, err
	}
	return existing, nil
}

func weeklyReviewSaveErrorMessage(err error) string {
	raw := err.Error()
	normalized := strings.ToLower(raw)
	if strings.Contains(normalized, "life_trace_weekly_reviews") &&
		(strings.Contains(normalized, "does not exist") || strings.Contains(normalized, "no such table")) {
		return "保存每周回顾失败：数据表 life_trace_weekly_reviews 不存在，请在 server 目录运行 air db=true 或执行 029 迁移后重试"
	}
	return "保存每周回顾失败：" + trimRunes(raw, 120)
}

func weeklyReviewPayload(review model.LifeTraceWeeklyReview) gin.H {
	return gin.H{
		"id":          review.ID,
		"weekStart":   review.WeekStart,
		"weekEnd":     review.WeekEnd,
		"summary":     review.Summary,
		"wins":        []string(review.Wins),
		"delays":      []string(review.Delays),
		"insights":    []string(review.Insights),
		"nextActions": []string(review.NextActions),
		"source":      review.Source,
		"model":       review.Model,
		"createdAt":   review.CreatedAt,
		"updatedAt":   review.UpdatedAt,
	}
}

func parseWeeklyReviewAIResponse(raw string) (weeklyReviewAIResponse, error) {
	return prompts.ParseWeeklyReviewOutput(raw)
}
