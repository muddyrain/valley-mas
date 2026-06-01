package lifetrace

import (
	"context"
	"fmt"
	"net/http"
	"time"
	"valley-server/internal/config"
	"valley-server/internal/database"
	"valley-server/internal/logger"
	"valley-server/internal/model"

	"gorm.io/gorm"
)

func StartPushReminderWorker(ctx context.Context, cfg config.WebPushConfig) {
	service := NewPushService(cfg)
	if !service.Enabled() {
		logger.Log.Info("LifeTrace Web Push worker disabled: VAPID keys not configured")
		return
	}

	interval := time.Duration(cfg.ScanIntervalSeconds) * time.Second
	if interval < 15*time.Second {
		interval = time.Minute
	}

	go func() {
		ticker := time.NewTicker(interval)
		defer ticker.Stop()

		if err := sendDuePlanPushReminders(ctx, service, cfg.ReminderWindowMin); err != nil {
			logger.Log.WithField("error", err).Warn("LifeTrace Web Push initial scan failed")
		}

		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				if err := sendDuePlanPushReminders(ctx, service, cfg.ReminderWindowMin); err != nil {
					logger.Log.WithField("error", err).Warn("LifeTrace Web Push scan failed")
				}
			}
		}
	}()
}

func sendDuePlanPushReminders(ctx context.Context, service *PushService, windowMinutes int) error {
	if windowMinutes <= 0 {
		windowMinutes = 10
	}

	now := time.Now()
	windowStart := now.Add(-time.Duration(windowMinutes) * time.Minute)
	dateStart := windowStart.Format("2006-01-02")
	dateEnd := now.Format("2006-01-02")

	var plans []model.LifeTracePlan
	if err := database.GetDB().
		Where("reminder = ? AND completed = ? AND scheduled_date >= ? AND scheduled_date <= ?", true, false, dateStart, dateEnd).
		Find(&plans).Error; err != nil {
		return err
	}

	for _, plan := range plans {
		dueAt, ok := parsePlanDueAt(plan)
		if !ok || dueAt.After(now) || dueAt.Before(windowStart) {
			continue
		}
		if err := sendPlanPushReminder(ctx, service, plan, dueAt); err != nil {
			logger.Log.WithFields(map[string]interface{}{
				"planId": plan.ID,
				"error":  err,
			}).Warn("LifeTrace Web Push plan reminder failed")
		}
	}

	return nil
}

func sendPlanPushReminder(ctx context.Context, service *PushService, plan model.LifeTracePlan, dueAt time.Time) error {
	var subscriptions []model.LifeTracePushSubscription
	if err := database.GetDB().
		Where("user_id = ? AND status = ?", plan.UserID, "active").
		Find(&subscriptions).Error; err != nil {
		return err
	}

	for _, subscription := range subscriptions {
		if pushDeliveryExists(plan.UserID, plan.ID, subscription.ID, dueAt) {
			continue
		}

		payload := PushPayload{
			Title:  "计划提醒：" + plan.Title,
			Body:   fmt.Sprintf("%s %s · 点开 Life Trace 处理", formatPushDateText(dueAt), dueAt.Format("15:04")),
			URL:    "/plans",
			Tag:    fmt.Sprintf("life-trace-plan-%s-%d", plan.ID.String(), dueAt.Unix()),
			PlanID: plan.ID.String(),
		}

		sendCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
		statusCode, err := service.Send(sendCtx, subscription, payload)
		cancel()

		deliveryStatus := "sent"
		errorText := ""
		if err != nil {
			deliveryStatus = "failed"
			errorText = err.Error()
			markPushSubscriptionError(subscription.ID, statusCode, err)
		} else {
			now := time.Now()
			_ = database.GetDB().Model(&subscription).Updates(map[string]interface{}{
				"last_sent_at": &now,
				"last_error":   "",
			}).Error
		}

		_ = database.GetDB().Create(&model.LifeTracePushDelivery{
			UserID:         plan.UserID,
			PlanID:         plan.ID,
			DueAt:          dueAt,
			SubscriptionID: subscription.ID,
			Status:         deliveryStatus,
			Error:          errorText,
		}).Error
	}

	return nil
}

func pushDeliveryExists(userID model.Int64String, planID model.Int64String, subscriptionID model.Int64String, dueAt time.Time) bool {
	var count int64
	if err := database.GetDB().
		Model(&model.LifeTracePushDelivery{}).
		Where("user_id = ? AND plan_id = ? AND subscription_id = ? AND due_at = ?", userID, planID, subscriptionID, dueAt).
		Count(&count).Error; err != nil {
		return false
	}
	return count > 0
}

func markPushSubscriptionError(subscriptionID model.Int64String, statusCode int, err error) {
	status := "active"
	if statusCode == http.StatusGone || statusCode == http.StatusNotFound {
		status = "disabled"
	}

	_ = database.GetDB().
		Model(&model.LifeTracePushSubscription{}).
		Where("id = ?", subscriptionID).
		Updates(map[string]interface{}{
			"status":     status,
			"last_error": err.Error(),
		}).Error
}

func formatPushDateText(dueAt time.Time) string {
	now := time.Now().In(dueAt.Location())
	base := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	target := time.Date(dueAt.Year(), dueAt.Month(), dueAt.Day(), 0, 0, 0, 0, dueAt.Location())
	diffDays := int(target.Sub(base).Hours() / 24)

	switch diffDays {
	case 0:
		return "今天"
	case 1:
		return "明天"
	case -1:
		return "昨天"
	default:
		return dueAt.Format("01/02")
	}
}

func resetPushDeliveriesForPlan(tx *gorm.DB, planID model.Int64String) {
	if tx == nil {
		tx = database.GetDB()
	}
	_ = tx.Unscoped().Where("plan_id = ?", planID).Delete(&model.LifeTracePushDelivery{}).Error
}
