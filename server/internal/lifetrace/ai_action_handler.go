package lifetrace

import (
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"
	"valley-server/internal/database"
	"valley-server/internal/model"

	"github.com/gin-gonic/gin"
)

const aiActionListLimit = 80

type createAIActionRequest struct {
	Title      string `json:"title"`
	ActionType string `json:"actionType"`
}

type aiActionResponse struct {
	ID         model.Int64String `json:"id"`
	Title      string            `json:"title"`
	ActionType string            `json:"actionType"`
	TimeLabel  string            `json:"timeLabel"`
	CreatedAt  time.Time         `json:"createdAt"`
}

func (h *Handler) ListAIActions(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		fail(c, http.StatusUnauthorized, "未登录")
		return
	}

	var actions []model.LifeTraceAIAction
	if err := database.GetDB().
		Where("user_id = ?", userID).
		Order("created_at DESC").
		Limit(aiActionListLimit).
		Find(&actions).Error; err != nil {
		fail(c, http.StatusInternalServerError, "读取 AI 操作失败")
		return
	}

	success(c, gin.H{"list": buildAIActionResponses(actions)})
}

func (h *Handler) CreateAIAction(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		fail(c, http.StatusUnauthorized, "未登录")
		return
	}

	var req createAIActionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		fail(c, http.StatusBadRequest, "参数错误")
		return
	}

	action, err := createAIAction(userID, req)
	if err != nil {
		fail(c, http.StatusBadRequest, err.Error())
		return
	}

	success(c, buildAIActionResponse(action))
}

func createAIAction(
	userID model.Int64String,
	req createAIActionRequest,
) (model.LifeTraceAIAction, error) {
	title := strings.TrimSpace(req.Title)
	if title == "" {
		return model.LifeTraceAIAction{}, errors.New("操作标题不能为空")
	}

	actionType := strings.TrimSpace(req.ActionType)
	if actionType == "" {
		actionType = "general"
	}

	action := model.LifeTraceAIAction{
		UserID:     userID,
		Title:      trimRunes(title, 160),
		ActionType: trimRunes(actionType, 40),
	}
	if err := database.GetDB().Create(&action).Error; err != nil {
		return model.LifeTraceAIAction{}, errors.New("保存 AI 操作失败")
	}
	return action, nil
}

func buildAIActionResponses(actions []model.LifeTraceAIAction) []aiActionResponse {
	responses := make([]aiActionResponse, 0, len(actions))
	for _, action := range actions {
		responses = append(responses, buildAIActionResponse(action))
	}
	return responses
}

func buildAIActionResponse(action model.LifeTraceAIAction) aiActionResponse {
	return aiActionResponse{
		ID:         action.ID,
		Title:      action.Title,
		ActionType: action.ActionType,
		TimeLabel:  formatAIActionTimeLabel(action.CreatedAt),
		CreatedAt:  action.CreatedAt,
	}
}

func formatAIActionTimeLabel(createdAt time.Time) string {
	if createdAt.IsZero() {
		return "刚刚"
	}

	elapsed := time.Since(createdAt)
	switch {
	case elapsed < time.Minute:
		return "刚刚"
	case elapsed < time.Hour:
		return timeAgoLabel(int(elapsed.Minutes()), "分钟前")
	case elapsed < 24*time.Hour:
		return timeAgoLabel(int(elapsed.Hours()), "小时前")
	default:
		return createdAt.Format("01-02 15:04")
	}
}

func timeAgoLabel(value int, unit string) string {
	if value < 1 {
		value = 1
	}
	return strings.TrimSpace(strings.Join([]string{strconv.Itoa(value), unit}, ""))
}
