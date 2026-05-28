package lifetrace

import (
	"errors"
	"net/http"
	"strings"
	"time"
	"valley-server/internal/database"
	"valley-server/internal/logger"
	"valley-server/internal/model"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type toggleCheckinRequest struct {
	Date      string `json:"date"`
	Name      string `json:"name"`
	Completed bool   `json:"completed"`
}

func normalizeCheckinDate(raw string) (string, bool) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return time.Now().Format("2006-01-02"), true
	}
	if _, err := time.Parse("2006-01-02", raw); err != nil {
		return "", false
	}
	return raw, true
}

func normalizeCheckinName(raw string) (string, bool) {
	name := strings.TrimSpace(raw)
	if name == "" || len([]rune(name)) > 40 {
		return "", false
	}
	return name, true
}

func (h *Handler) ListCheckins(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		fail(c, http.StatusUnauthorized, "未登录")
		return
	}

	date, ok := normalizeCheckinDate(c.Query("date"))
	if !ok {
		fail(c, http.StatusBadRequest, "打卡日期格式错误")
		return
	}

	var checkins []model.LifeTraceCheckin
	if err := database.GetDB().
		Where("user_id = ? AND date = ?", userID, date).
		Order("created_at ASC").
		Find(&checkins).Error; err != nil {
		fail(c, http.StatusInternalServerError, "获取打卡失败")
		return
	}

	success(c, gin.H{"date": date, "list": checkins})
}

func (h *Handler) ToggleCheckin(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		fail(c, http.StatusUnauthorized, "未登录")
		return
	}

	var req toggleCheckinRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		fail(c, http.StatusBadRequest, "参数错误")
		return
	}

	date, ok := normalizeCheckinDate(req.Date)
	if !ok {
		fail(c, http.StatusBadRequest, "打卡日期格式错误")
		return
	}

	name, ok := normalizeCheckinName(req.Name)
	if !ok {
		fail(c, http.StatusBadRequest, "打卡项不能为空")
		return
	}

	var checkin model.LifeTraceCheckin
	err := database.GetDB().
		Where("user_id = ? AND date = ? AND name = ?", userID, date, name).
		First(&checkin).Error
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		fail(c, http.StatusInternalServerError, "读取打卡失败")
		return
	}

	if errors.Is(err, gorm.ErrRecordNotFound) {
		checkin = model.LifeTraceCheckin{
			UserID:    userID,
			Date:      date,
			Name:      name,
			Completed: req.Completed,
		}
		if req.Completed {
			now := time.Now()
			checkin.CompletedAt = &now
		}
		if err := database.GetDB().Create(&checkin).Error; err != nil {
			logger.Log.WithField("error", err).Error("LifeTrace ToggleCheckin insert failed")
			fail(c, http.StatusInternalServerError, "保存打卡失败")
			return
		}
		success(c, checkin)
		return
	}

	updates := map[string]interface{}{"completed": req.Completed}
	if req.Completed {
		now := time.Now()
		updates["completed_at"] = &now
	} else {
		updates["completed_at"] = nil
	}

	if err := database.GetDB().Model(&checkin).Updates(updates).Error; err != nil {
		logger.Log.WithField("error", err).Error("LifeTrace ToggleCheckin update failed")
		fail(c, http.StatusInternalServerError, "保存打卡失败")
		return
	}

	if err := database.GetDB().First(&checkin, "id = ? AND user_id = ?", checkin.ID, userID).Error; err != nil {
		fail(c, http.StatusInternalServerError, "读取打卡失败")
		return
	}

	success(c, checkin)
}
