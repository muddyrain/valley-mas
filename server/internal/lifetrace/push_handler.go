package lifetrace

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"
	"valley-server/internal/database"
	"valley-server/internal/logger"
	"valley-server/internal/model"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

const pushErrorCodeRebindRequired = "PUSH_REBIND_REQUIRED"
const pushErrorCodeVapidKeyInvalid = "PUSH_VAPID_KEY_INVALID"

type pushSubscriptionRequest struct {
	Endpoint string          `json:"endpoint"`
	Keys     pushKeysRequest `json:"keys"`
}

type pushKeysRequest struct {
	P256DH string `json:"p256dh"`
	Auth   string `json:"auth"`
}

func (h *Handler) GetPushConfig(c *gin.Context) {
	success(c, gin.H{
		"enabled":   h.push.Enabled(),
		"publicKey": h.push.PublicKey(),
	})
}

func (h *Handler) SavePushSubscription(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		fail(c, http.StatusUnauthorized, "未登录")
		return
	}
	if !h.push.Enabled() {
		fail(c, http.StatusServiceUnavailable, "Web Push 未配置")
		return
	}

	var req pushSubscriptionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		fail(c, http.StatusBadRequest, "参数错误")
		return
	}

	endpoint := strings.TrimSpace(req.Endpoint)
	p256dh := strings.TrimSpace(req.Keys.P256DH)
	auth := strings.TrimSpace(req.Keys.Auth)
	if endpoint == "" || p256dh == "" || auth == "" {
		fail(c, http.StatusBadRequest, "订阅信息不完整")
		return
	}

	db := database.GetDB()
	var subscription model.LifeTracePushSubscription
	err := db.Unscoped().Where("endpoint = ?", endpoint).First(&subscription).Error
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		fail(c, http.StatusInternalServerError, "读取订阅失败")
		return
	}

	updates := map[string]interface{}{
		"user_id":    userID,
		"p256dh":     p256dh,
		"auth":       auth,
		"status":     "active",
		"user_agent": c.Request.UserAgent(),
		"last_error": "",
		"deleted_at": nil,
	}

	if subscription.ID == 0 {
		subscription = model.LifeTracePushSubscription{
			UserID:    userID,
			Endpoint:  endpoint,
			P256DH:    p256dh,
			Auth:      auth,
			Status:    "active",
			UserAgent: c.Request.UserAgent(),
		}
		if err := db.Create(&subscription).Error; err != nil {
			fail(c, http.StatusInternalServerError, "保存订阅失败")
			return
		}
		success(c, subscription)
		return
	}

	if err := db.Unscoped().Model(&subscription).Updates(updates).Error; err != nil {
		fail(c, http.StatusInternalServerError, "保存订阅失败")
		return
	}
	if err := db.First(&subscription, "id = ?", subscription.ID).Error; err != nil {
		fail(c, http.StatusInternalServerError, "读取订阅失败")
		return
	}
	success(c, subscription)
}

func (h *Handler) DeletePushSubscription(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		fail(c, http.StatusUnauthorized, "未登录")
		return
	}

	endpoint := strings.TrimSpace(c.Query("endpoint"))
	if endpoint == "" {
		fail(c, http.StatusBadRequest, "订阅地址不能为空")
		return
	}

	if err := database.GetDB().
		Where("user_id = ? AND endpoint = ?", userID, endpoint).
		Delete(&model.LifeTracePushSubscription{}).Error; err != nil {
		fail(c, http.StatusInternalServerError, "删除订阅失败")
		return
	}
	success(c, gin.H{"endpoint": endpoint})
}

func (h *Handler) TestPush(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		fail(c, http.StatusUnauthorized, "未登录")
		return
	}
	if !h.push.Enabled() {
		fail(c, http.StatusServiceUnavailable, "Web Push 未配置")
		return
	}

	var subscription model.LifeTracePushSubscription
	if err := database.GetDB().
		Where("user_id = ? AND status = ?", userID, "active").
		Order("updated_at DESC").
		First(&subscription).Error; err != nil {
		fail(c, http.StatusNotFound, "还没有可用的推送订阅")
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()
	statusCode, err := h.push.Send(ctx, subscription, PushPayload{
		Title: "Life Trace 测试提醒",
		Body:  "这条通知来自服务端 Web Push。",
		URL:   "/plans",
		Tag:   "life-trace-test",
	})
	if err != nil {
		markPushSubscriptionError(subscription.ID, statusCode, err)
		if isPushVapidKeyInvalid(err) {
			failWithErrorCode(
				c,
				http.StatusBadGateway,
				"VAPID 公私钥不匹配或线上环境变量未生效，请检查 WEB_PUSH_PUBLIC_KEY / WEB_PUSH_PRIVATE_KEY",
				pushErrorCodeVapidKeyInvalid,
			)
			return
		}
		if isPushSubscriptionInvalid(statusCode, err) {
			failWithErrorCode(
				c,
				http.StatusBadGateway,
				"设备推送订阅已失效，请重新绑定推送",
				pushErrorCodeRebindRequired,
			)
			return
		}
		fail(c, http.StatusBadGateway, pushTestFailureMessage(statusCode, err))
		return
	}

	now := time.Now()
	_ = database.GetDB().Model(&subscription).Updates(map[string]interface{}{
		"last_sent_at": &now,
		"last_error":   "",
	}).Error
	success(c, gin.H{"sent": true})
}

func (h *Handler) PreviewDailyBriefPush(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		fail(c, http.StatusUnauthorized, "未登录")
		return
	}

	settings, err := findSettings(userID)
	if err != nil {
		fail(c, http.StatusInternalServerError, "读取简报设置失败")
		return
	}

	now := reminderNow()
	today := now.Format("2006-01-02")

	var plans []model.LifeTracePlan
	if err := database.GetDB().
		Where("user_id = ? AND completed = ? AND scheduled_date = ?", userID, false, today).
		Order("scheduled_time ASC, created_at ASC").
		Find(&plans).Error; err != nil {
		fail(c, http.StatusInternalServerError, "读取今日计划失败")
		return
	}

	var weatherResp WeatherResponse
	if h.weather != nil {
		weatherResp = h.weather.Fetch(c.Request.Context(), settings.City, false)
	}

	payload := buildDailyBriefPushPayload(settings, weatherResp, plans, now)
	payload.Tag = "life-trace-daily-brief-preview"
	success(c, payload)
}

func (h *Handler) ScanPushReminders(c *gin.Context) {
	secret := strings.TrimSpace(h.pushConfig.CronSecret)
	if secret == "" {
		setPushScanOperationLogResponse(c, http.StatusServiceUnavailable, "WEB_PUSH_CRON_SECRET 未配置", gin.H{
			"configured": false,
			"scanned":    false,
			"reason":     "WEB_PUSH_CRON_SECRET 未配置",
		})
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"code":    http.StatusServiceUnavailable,
			"message": "WEB_PUSH_CRON_SECRET 未配置",
		})
		return
	}
	if !cronSecretMatches(c, secret) {
		setPushScanOperationLogResponse(c, http.StatusUnauthorized, "定时任务密钥无效", gin.H{
			"configured": true,
			"scanned":    false,
			"reason":     "定时任务密钥无效",
		})
		c.JSON(http.StatusUnauthorized, gin.H{
			"code":    http.StatusUnauthorized,
			"message": "定时任务密钥无效",
		})
		return
	}
	if !h.push.Enabled() {
		setPushScanOperationLogResponse(c, http.StatusServiceUnavailable, "Web Push 未配置", gin.H{
			"configured": true,
			"scanned":    false,
			"reason":     "Web Push 未配置",
		})
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"code":    http.StatusServiceUnavailable,
			"message": "Web Push 未配置",
		})
		return
	}

	now := reminderNow()
	if err := scanPushReminders(
		c.Request.Context(),
		h.push,
		h.weather,
		h.pushConfig.ReminderWindowMin,
		now,
	); err != nil {
		setPushScanOperationLogResponse(c, http.StatusInternalServerError, "推送扫描失败", gin.H{
			"configured":    true,
			"scanned":       false,
			"timezone":      lifeTraceReminderTimezone,
			"windowMinutes": normalizedReminderWindow(h.pushConfig.ReminderWindowMin),
			"error":         err.Error(),
		})
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    http.StatusInternalServerError,
			"message": "推送扫描失败",
			"error":   err.Error(),
		})
		return
	}

	data := gin.H{
		"scanned":       true,
		"now":           now.Format(time.RFC3339),
		"timezone":      lifeTraceReminderTimezone,
		"windowMinutes": normalizedReminderWindow(h.pushConfig.ReminderWindowMin),
	}
	setPushScanOperationLogResponse(c, http.StatusOK, "success", data)
	success(c, data)
}

func setPushScanOperationLogResponse(c *gin.Context, code int, message string, data gin.H) {
	payload := gin.H{
		"code":    code,
		"message": message,
		"data":    data,
	}

	raw, err := json.Marshal(payload)
	if err != nil {
		return
	}
	logger.SetOperationLogResponseBody(c, string(raw))
}

func cronSecretMatches(c *gin.Context, expected string) bool {
	candidates := []string{
		c.GetHeader("X-Cron-Secret"),
		c.GetHeader("X-Webhook-Secret"),
		strings.TrimPrefix(c.GetHeader("Authorization"), "Bearer "),
		c.Query("secret"),
	}
	for _, candidate := range candidates {
		if strings.TrimSpace(candidate) == expected {
			return true
		}
	}
	return false
}

func normalizedReminderWindow(windowMinutes int) int {
	if windowMinutes <= 0 {
		return 10
	}
	return windowMinutes
}

func pushTestFailureMessage(statusCode int, err error) string {
	detail := strings.TrimSpace(err.Error())
	if detail == "" {
		return "测试推送发送失败"
	}

	if statusCode > 0 {
		return "测试推送发送失败（状态 " + strconv.Itoa(statusCode) + "）：" + detail
	}
	return "测试推送发送失败：" + detail
}

func isPushSubscriptionInvalid(statusCode int, err error) bool {
	if isPushVapidKeyInvalid(err) {
		return false
	}

	if statusCode == http.StatusForbidden ||
		statusCode == http.StatusGone ||
		statusCode == http.StatusNotFound {
		return true
	}

	if err == nil {
		return false
	}

	detail := strings.ToLower(err.Error())
	return strings.Contains(detail, "expiredsubscription")
}

func isPushVapidKeyInvalid(err error) bool {
	if err == nil {
		return false
	}

	detail := strings.ToLower(err.Error())
	return strings.Contains(detail, "badjwttoken") ||
		strings.Contains(detail, "invalid jwt") ||
		strings.Contains(detail, "invalid token") ||
		(strings.Contains(detail, "vapid") && strings.Contains(detail, "jwt"))
}
