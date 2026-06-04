package lifetrace

import (
	"context"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"
	"valley-server/internal/database"
	"valley-server/internal/model"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

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
