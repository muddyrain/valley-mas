package lifetrace

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"
	"strconv"
	"strings"
	"time"
	"valley-server/internal/config"
	"valley-server/internal/database"
	"valley-server/internal/logger"
	"valley-server/internal/model"
	"valley-server/internal/utils"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const lifeTraceReminderTimezone = "Asia/Shanghai"

type pushSender interface {
	Enabled() bool
	Send(context.Context, model.LifeTracePushSubscription, PushPayload) (int, error)
}

func StartPushReminderWorker(ctx context.Context, cfg config.WebPushConfig, weather *WeatherService) {
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

		if err := scanPushReminders(ctx, service, weather, cfg.ReminderWindowMin, reminderNow()); err != nil {
			logger.Log.WithField("error", err).Warn("LifeTrace Web Push initial scan failed")
		}

		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				if err := scanPushReminders(ctx, service, weather, cfg.ReminderWindowMin, reminderNow()); err != nil {
					logger.Log.WithField("error", err).Warn("LifeTrace Web Push scan failed")
				}
			}
		}
	}()
}

func reminderNow() time.Time {
	return time.Now().In(reminderLocation())
}

func reminderLocation() *time.Location {
	location, err := time.LoadLocation(lifeTraceReminderTimezone)
	if err != nil {
		return time.FixedZone("CST", 8*60*60)
	}
	return location
}

func scanPushReminders(
	ctx context.Context,
	sender pushSender,
	weather *WeatherService,
	windowMinutes int,
	now time.Time,
) error {
	now = now.In(reminderLocation())
	if err := sendDuePlanPushRemindersAt(ctx, sender, windowMinutes, now); err != nil {
		return err
	}
	if err := sendDuePantryPushRemindersAt(ctx, sender, windowMinutes, now); err != nil {
		return err
	}
	if err := sendDueRecurringPaymentRemindersAt(ctx, sender, windowMinutes, now); err != nil {
		return err
	}
	if err := sendDueDailyBriefPushesAt(ctx, sender, weather, windowMinutes, now); err != nil {
		return err
	}
	return nil
}

func sendDuePlanPushReminders(ctx context.Context, sender pushSender, windowMinutes int) error {
	return sendDuePlanPushRemindersAt(ctx, sender, windowMinutes, reminderNow())
}

func sendDuePantryPushReminders(ctx context.Context, sender pushSender, windowMinutes int) error {
	return sendDuePantryPushRemindersAt(ctx, sender, windowMinutes, reminderNow())
}

func sendDuePlanPushRemindersAt(
	ctx context.Context,
	sender pushSender,
	windowMinutes int,
	now time.Time,
) error {
	if windowMinutes <= 0 {
		windowMinutes = 10
	}

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
		settings, ok := resolvePushSettingsForUser(plan.UserID)
		if !ok || !settings.PlanReminders {
			continue
		}
		dueAt, ok := planReminderDueAt(plan, settings)
		if !ok || isQuietHours(settings, dueAt) || !isWithinReminderWindow(dueAt, now, windowMinutes) {
			continue
		}
		if err := sendPlanPushReminder(ctx, sender, plan, dueAt); err != nil {
			logger.Log.WithFields(map[string]interface{}{
				"planId": plan.ID,
				"error":  err,
			}).Warn("LifeTrace Web Push plan reminder failed")
		}
	}

	return nil
}

func sendDuePantryPushRemindersAt(
	ctx context.Context,
	sender pushSender,
	windowMinutes int,
	now time.Time,
) error {
	if windowMinutes <= 0 {
		windowMinutes = 10
	}

	var items []model.LifeTracePantryItem
	if err := database.GetDB().
		Where("status <> ? AND status <> ?", "used-up", "discarded").
		Find(&items).Error; err != nil {
		return err
	}
	if len(items) == 0 {
		return nil
	}

	settingsByUser := map[model.Int64String]model.LifeTraceSettings{}
	for _, item := range items {
		if _, ok := settingsByUser[item.UserID]; ok {
			continue
		}
		var settings model.LifeTraceSettings
		if err := database.GetDB().Where("user_id = ?", item.UserID).First(&settings).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				settings = model.LifeTraceSettings{
					UserID:                item.UserID,
					PantryReminderEnabled: true,
					PantryReminderRules:   model.StringList{"7d", "3d", "same-day", "expired"},
					PantryReminderTime:    "09:00",
				}
			} else {
				return err
			}
		}
		settingsByUser[item.UserID] = settings
	}

	for _, item := range items {
		settings := settingsByUser[item.UserID]
		if isQuietHours(settings, now) {
			continue
		}
		if err := sendPantryPushReminder(ctx, sender, item, settings, now, windowMinutes); err != nil {
			logger.Log.WithFields(map[string]interface{}{
				"pantryItemId": item.ID,
				"error":        err,
			}).Warn("LifeTrace Web Push pantry reminder failed")
		}
	}

	return nil
}

func sendDueDailyBriefPushes(
	ctx context.Context,
	sender pushSender,
	weather *WeatherService,
	windowMinutes int,
) error {
	return sendDueDailyBriefPushesAt(ctx, sender, weather, windowMinutes, reminderNow())
}

func sendDueDailyBriefPushesAt(
	ctx context.Context,
	sender pushSender,
	weather *WeatherService,
	windowMinutes int,
	now time.Time,
) error {
	if windowMinutes <= 0 {
		windowMinutes = 10
	}

	var settingsList []model.LifeTraceSettings
	if err := database.GetDB().Find(&settingsList).Error; err != nil {
		return err
	}

	for _, settings := range settingsList {
		dueAt, ok := dailyBriefDueAt(settings, now, windowMinutes)
		if !ok || isQuietHours(settings, dueAt) || !shouldSendDailyBriefOnDate(settings, dueAt) {
			continue
		}
		if err := sendDailyBriefPush(ctx, sender, weather, settings, dueAt); err != nil {
			logger.Log.WithFields(map[string]interface{}{
				"userId": settings.UserID,
				"error":  err,
			}).Warn("LifeTrace Web Push daily brief failed")
		}
	}

	return nil
}

func sendPlanPushReminder(ctx context.Context, sender pushSender, plan model.LifeTracePlan, dueAt time.Time) error {
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

		deliveryStatus, errorText := sendPushPayload(
			ctx,
			sender,
			subscription,
			payload,
			pushFailureContext{
				kind:     "plan",
				targetID: plan.ID.String(),
				dueAt:    dueAt,
			},
		)
		savePlanPushDelivery(model.LifeTracePushDelivery{
			UserID:         plan.UserID,
			PlanID:         plan.ID,
			DueAt:          dueAt,
			SubscriptionID: subscription.ID,
			Status:         deliveryStatus,
			Error:          errorText,
		})
	}

	return nil
}

type pantryReminderConfig struct {
	enabled      bool
	rules        model.StringList
	reminderTime string
}

func sendPantryPushReminder(
	ctx context.Context,
	sender pushSender,
	item model.LifeTracePantryItem,
	settings model.LifeTraceSettings,
	now time.Time,
	windowMinutes int,
) error {
	config := resolvePantryReminderConfig(item, settings)
	if !config.enabled || len(config.rules) == 0 {
		return nil
	}

	var subscriptions []model.LifeTracePushSubscription
	if err := database.GetDB().
		Where("user_id = ? AND status = ?", item.UserID, "active").
		Find(&subscriptions).Error; err != nil {
		return err
	}
	if len(subscriptions) == 0 {
		return nil
	}

	for _, rule := range config.rules {
		dueAt, ok := pantryReminderDueAt(item, config.reminderTime, rule, now, windowMinutes)
		if !ok {
			continue
		}

		payload := buildPantryPushPayload(item, rule, dueAt)
		for _, subscription := range subscriptions {
			if pantryReminderDeliveryExists(item.UserID, item.ID, string(rule), subscription.ID, dueAt) {
				continue
			}

			deliveryStatus, errorText := sendPushPayload(
				ctx,
				sender,
				subscription,
				payload,
				pushFailureContext{
					kind:     "pantry",
					targetID: item.ID.String(),
					rule:     string(rule),
					dueAt:    dueAt,
				},
			)
			savePantryReminderDelivery(model.LifeTracePantryReminderDelivery{
				UserID:         item.UserID,
				PantryItemID:   item.ID,
				Rule:           string(rule),
				DueAt:          dueAt,
				SubscriptionID: subscription.ID,
				Status:         deliveryStatus,
				Error:          errorText,
			})
		}
	}

	return nil
}

func sendDailyBriefPush(
	ctx context.Context,
	sender pushSender,
	weather *WeatherService,
	settings model.LifeTraceSettings,
	dueAt time.Time,
) error {
	var subscriptions []model.LifeTracePushSubscription
	if err := database.GetDB().
		Where("user_id = ? AND status = ?", settings.UserID, "active").
		Find(&subscriptions).Error; err != nil {
		return err
	}
	if len(subscriptions) == 0 {
		return nil
	}

	today := dueAt.Format("2006-01-02")
	var plans []model.LifeTracePlan
	if err := database.GetDB().
		Where("user_id = ? AND completed = ? AND scheduled_date = ?", settings.UserID, false, today).
		Order("scheduled_time ASC, created_at ASC").
		Find(&plans).Error; err != nil {
		return err
	}

	var weatherResp WeatherResponse
	if weather != nil {
		weatherResp = weather.Fetch(ctx, settings.City, false)
	}

	payload := buildDailyBriefPushPayload(settings, weatherResp, plans, dueAt)
	for _, subscription := range subscriptions {
		if dailyBriefDeliveryExists(settings.UserID, today, subscription.ID) {
			continue
		}

		deliveryStatus, errorText := sendPushPayload(
			ctx,
			sender,
			subscription,
			payload,
			pushFailureContext{
				kind:     "daily_brief",
				targetID: today,
				dueAt:    dueAt,
			},
		)
		saveDailyBriefDelivery(model.LifeTraceDailyBriefDelivery{
			UserID:         settings.UserID,
			BriefDate:      today,
			ScheduledAt:    dueAt,
			SubscriptionID: subscription.ID,
			Status:         deliveryStatus,
			Error:          errorText,
		})
	}

	return nil
}

type pushFailureContext struct {
	kind     string
	targetID string
	rule     string
	dueAt    time.Time
}

func sendPushPayload(
	ctx context.Context,
	sender pushSender,
	subscription model.LifeTracePushSubscription,
	payload PushPayload,
	failureContext pushFailureContext,
) (string, string) {
	sendCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	statusCode, err := sender.Send(sendCtx, subscription, payload)
	cancel()

	if err != nil {
		markPushSubscriptionError(subscription.ID, statusCode, err)
		recordPushFailureOperationLog(subscription, payload, failureContext, statusCode, err)
		return "failed", err.Error()
	}

	markPushSubscriptionSent(subscription)
	return "sent", ""
}

func buildDailyBriefPushPayload(
	settings model.LifeTraceSettings,
	weather WeatherResponse,
	plans []model.LifeTracePlan,
	dueAt time.Time,
) PushPayload {
	intro := buildDailyBriefIntro(settings, weather, dueAt)
	planText := buildDailyBriefPlanText(plans, weather)

	parts := []string{intro, planText}
	body := strings.Join(compactStrings(parts), "；")
	if body == "" {
		body = "看看今天的天气，再决定怎么安排出门。"
	}

	return PushPayload{
		Title: buildDailyBriefTitle(settings, weather, plans, dueAt),
		Body:  body,
		URL:   "/today",
		Tag:   fmt.Sprintf("life-trace-daily-brief-%s", dueAt.Format("2006-01-02")),
	}
}

func buildDailyBriefTitle(
	settings model.LifeTraceSettings,
	weather WeatherResponse,
	plans []model.LifeTracePlan,
	dueAt time.Time,
) string {
	if settings.WeatherAlerts {
		if riskTitle := buildDailyBriefRiskTitle(weather); riskTitle != "" {
			return riskTitle
		}
	}
	if len(plans) > 0 {
		return "Life Trace 今日计划"
	}
	if isRestDay(settings, dueAt) {
		return "Life Trace 周末天气"
	}
	return "Life Trace 每日天气"
}

func buildDailyBriefIntro(settings model.LifeTraceSettings, weather WeatherResponse, dueAt time.Time) string {
	if settings.WeatherAlerts {
		if riskIntro := buildDailyBriefRiskIntro(weather); riskIntro != "" {
			return riskIntro
		}
	}

	city := strings.TrimSpace(settings.City)
	tempText := strings.TrimSpace(weather.Now.Temp)
	skyText := strings.TrimSpace(weather.Now.Text)

	base := []string{}
	if city != "" {
		base = append(base, city)
	}
	if tempText != "" {
		base = append(base, tempText+"°")
	}
	if skyText != "" {
		base = append(base, skyText)
	}

	if isRestDay(settings, dueAt) {
		if len(base) > 0 {
			return strings.Join(base, " ") + "，适合按自己的节奏出门走走"
		}
		return "今天适合按自己的节奏慢慢展开"
	}

	if len(base) > 0 {
		return strings.Join(base, " ") + buildDailyBriefWeatherSuggestion(skyText)
	}
	return "早上好，看看今天的天气，再决定怎么安排出门"
}

func buildDailyBriefWeatherSuggestion(skyText string) string {
	skyText = strings.TrimSpace(skyText)
	switch {
	case strings.Contains(skyText, "晴"):
		return "，天气不错，适合出门走走"
	case strings.Contains(skyText, "多云"):
		return "，云量不重，可以安排一段轻松出门"
	case strings.Contains(skyText, "阴"):
		return "，光线柔和，适合慢一点出门"
	default:
		return "，出门前看一眼气温就好"
	}
}

func buildDailyBriefPlanText(plans []model.LifeTracePlan, weather WeatherResponse) string {
	if len(plans) == 0 {
		return ""
	}

	nextPlanText := "今天有 1 个计划待处理"
	if len(plans) > 1 {
		nextPlanText = fmt.Sprintf("今天有 %d 个计划待处理", len(plans))
	}
	if nextPlan := findNextPlanWithTime(plans); nextPlan != nil {
		if strings.TrimSpace(nextPlan.ScheduledTime) != "" {
			nextPlanText = fmt.Sprintf("%s，下一项 %s %s", nextPlanText, nextPlan.ScheduledTime, nextPlan.Title)
		} else {
			nextPlanText = fmt.Sprintf("%s，记得留意 %s", nextPlanText, nextPlan.Title)
		}
		if advice := buildOutdoorPlanWeatherAdvice(*nextPlan, weather); advice != "" {
			nextPlanText = fmt.Sprintf("%s，%s", nextPlanText, advice)
		}
	}
	return nextPlanText
}

func buildOutdoorPlanWeatherAdvice(plan model.LifeTracePlan, weather WeatherResponse) string {
	if !isOutdoorPlan(plan) {
		return ""
	}

	switch detectDailyBriefRisk(weather) {
	case "rain":
		return "出门安排记得带伞，路上多留一点缓冲"
	case "heat":
		return "外出尽量避开午后暴晒，记得补水"
	case "wind":
		return "出门注意防风，骑行或步行别太赶"
	case "gap":
		return "早晚温差明显，晚归带件外套"
	case "uv":
		return "户外时间长的话记得补防晒"
	default:
		return ""
	}
}

func isOutdoorPlan(plan model.LifeTracePlan) bool {
	text := strings.TrimSpace(plan.Title + " " + plan.Note + " " + plan.Location)
	if text == "" {
		return false
	}
	for _, keyword := range []string{
		"出门", "出去", "外出", "散步", "跑步", "骑行", "运动", "通勤", "聚会", "约", "见",
		"玩", "旅行", "公园", "逛", "拍照", "露营", "爬山", "徒步", "西湖",
	} {
		if strings.Contains(text, keyword) {
			return true
		}
	}
	return false
}

func buildDailyBriefRiskTitle(weather WeatherResponse) string {
	switch detectDailyBriefRisk(weather) {
	case "heat":
		return "Life Trace 高温提醒"
	case "rain":
		return "Life Trace 降雨提醒"
	case "wind":
		return "Life Trace 大风提醒"
	case "gap":
		return "Life Trace 温差提醒"
	case "uv":
		return "Life Trace 防晒提醒"
	default:
		return ""
	}
}

func buildDailyBriefRiskIntro(weather WeatherResponse) string {
	switch detectDailyBriefRisk(weather) {
	case "heat":
		return "今天体感偏热，午后尽量避开暴晒，通勤和外出记得补水"
	case "rain":
		return "今天有降雨信号，出门带伞，路上多留一点缓冲"
	case "wind":
		return "今天风力偏强，步行骑行都注意防风"
	case "gap":
		return fmt.Sprintf("今天温差约 %d°，建议分层穿衣，晚归别忘带外套", dailyBriefTempGap(weather))
	case "uv":
		return "今天紫外线偏强，出门记得补防晒"
	default:
		return ""
	}
}

func detectDailyBriefRisk(weather WeatherResponse) string {
	high := parseWeatherNumber(weather.Now.High)
	low := parseWeatherNumber(weather.Now.Low)
	temp := parseWeatherNumber(weather.Now.Temp)
	windScale := parseWeatherNumber(weather.Now.WindScale)

	switch {
	case high >= 35 || temp >= 32:
		return "heat"
	case hasRainSignalForBrief(weather):
		return "rain"
	case windScale >= 6:
		return "wind"
	case high > 0 && low > 0 && high-low >= 10:
		return "gap"
	case isStrongUVForBrief(weather.Now.UVIndex):
		return "uv"
	default:
		return ""
	}
}

func dailyBriefTempGap(weather WeatherResponse) int {
	high := parseWeatherNumber(weather.Now.High)
	low := parseWeatherNumber(weather.Now.Low)
	if high == 0 && low == 0 {
		return 0
	}
	return int(high - low)
}

func hasRainSignalForBrief(weather WeatherResponse) bool {
	text := strings.TrimSpace(weather.Now.Text)
	if text == "" {
		return false
	}
	for _, keyword := range []string{"雨", "雪", "雷", "阵雨", "雷阵雨"} {
		if strings.Contains(text, keyword) {
			return true
		}
	}
	return false
}

func isStrongUVForBrief(value string) bool {
	value = strings.TrimSpace(value)
	if value == "" {
		return false
	}
	if n := parseWeatherNumber(value); n >= 7 {
		return true
	}
	return strings.Contains(value, "强")
}

func parseWeatherNumber(value string) float64 {
	value = strings.TrimSpace(value)
	if value == "" {
		return 0
	}
	parsed, err := strconv.ParseFloat(value, 64)
	if err == nil {
		return parsed
	}
	return 0
}

func isRestDay(settings model.LifeTraceSettings, dueAt time.Time) bool {
	return !shouldSendDailyBriefOnDate(model.LifeTraceSettings{
		WorkdayMode:       settings.WorkdayMode,
		Workdays:          settings.Workdays,
		HolidaySync:       settings.HolidaySync,
		WeekendReminders:  false,
		PlanReminders:     settings.PlanReminders,
		WeatherAlerts:     settings.WeatherAlerts,
		AIPersonalization: settings.AIPersonalization,
	}, dueAt)
}

func compactStrings(values []string) []string {
	result := make([]string, 0, len(values))
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value != "" {
			result = append(result, value)
		}
	}
	return result
}

func findNextPlanWithTime(plans []model.LifeTracePlan) *model.LifeTracePlan {
	for i := range plans {
		if strings.TrimSpace(plans[i].ScheduledTime) != "" {
			return &plans[i]
		}
	}
	if len(plans) == 0 {
		return nil
	}
	return &plans[0]
}

func resolvePantryReminderConfig(
	item model.LifeTracePantryItem,
	settings model.LifeTraceSettings,
) pantryReminderConfig {
	if item.ReminderUseDefault {
		return pantryReminderConfig{
			enabled:      settings.PantryReminderEnabled,
			rules:        settings.PantryReminderRules,
			reminderTime: normalizeTimeText(settings.PantryReminderTime, "09:00"),
		}
	}
	return pantryReminderConfig{
		enabled:      item.ReminderEnabled,
		rules:        item.ReminderRules,
		reminderTime: normalizeTimeText(item.ReminderTime, "09:00"),
	}
}

func pantryReminderDueAt(
	item model.LifeTracePantryItem,
	reminderTime string,
	rule string,
	now time.Time,
	windowMinutes int,
) (time.Time, bool) {
	expiresAt, ok := parsePantryExpiryDate(item.ExpiresAt, now.Location())
	if !ok {
		return time.Time{}, false
	}

	targetDate := expiresAt
	switch strings.TrimSpace(rule) {
	case "7d":
		targetDate = expiresAt.AddDate(0, 0, -7)
	case "3d":
		targetDate = expiresAt.AddDate(0, 0, -3)
	case "same-day":
		targetDate = expiresAt
	case "expired":
		targetDate = expiresAt.AddDate(0, 0, 1)
	default:
		return time.Time{}, false
	}

	dueAt, ok := parseClockOnDate(reminderTime, targetDate)
	if !ok || !isWithinReminderWindow(dueAt, now, windowMinutes) {
		return time.Time{}, false
	}
	return dueAt, true
}

func parsePantryExpiryDate(value string, location *time.Location) (time.Time, bool) {
	value = strings.TrimSpace(value)
	if value == "" {
		return time.Time{}, false
	}
	parsed, err := time.ParseInLocation("2006-01-02", value, location)
	if err != nil {
		return time.Time{}, false
	}
	return time.Date(parsed.Year(), parsed.Month(), parsed.Day(), 0, 0, 0, 0, location), true
}

func buildPantryPushPayload(
	item model.LifeTracePantryItem,
	rule string,
	dueAt time.Time,
) PushPayload {
	title := "库存提醒：" + item.Name
	bodyPrefix := fmt.Sprintf("%s · 点开 Life Trace 处理", pantryReminderBody(item, rule))
	if location := strings.TrimSpace(item.Location); location != "" {
		bodyPrefix = fmt.Sprintf("%s · %s · 点开 Life Trace 处理", pantryReminderBody(item, rule), location)
	}

	switch strings.TrimSpace(rule) {
	case "same-day":
		title = "库存到期提醒：" + item.Name
	case "expired":
		title = "库存已过期：" + item.Name
	default:
		title = "库存临期提醒：" + item.Name
	}

	return PushPayload{
		Title: title,
		Body:  bodyPrefix,
		URL:   "/pantry",
		Tag:   fmt.Sprintf("life-trace-pantry-%s-%s-%d", item.ID.String(), rule, dueAt.Unix()),
	}
}

func pantryReminderBody(item model.LifeTracePantryItem, rule string) string {
	switch strings.TrimSpace(rule) {
	case "7d":
		return fmt.Sprintf("%s 还有 7 天到期", item.Name)
	case "3d":
		return fmt.Sprintf("%s 还有 3 天到期", item.Name)
	case "same-day":
		return fmt.Sprintf("%s 今天到期", item.Name)
	case "expired":
		return fmt.Sprintf("%s 已经过期", item.Name)
	default:
		return fmt.Sprintf("%s 需要检查", item.Name)
	}
}

func dailyBriefDueAt(settings model.LifeTraceSettings, now time.Time, windowMinutes int) (time.Time, bool) {
	if windowMinutes <= 0 {
		windowMinutes = 10
	}
	dueAt, ok := parseClockOnDate(settings.DailyBriefTime, now)
	if !ok || !isWithinReminderWindow(dueAt, now, windowMinutes) {
		return time.Time{}, false
	}
	return dueAt, true
}

func resolvePushSettingsForUser(userID model.Int64String) (model.LifeTraceSettings, bool) {
	var settings model.LifeTraceSettings
	if err := database.GetDB().Where("user_id = ?", userID).First(&settings).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return model.LifeTraceSettings{
				UserID:                  userID,
				PlanReminders:           true,
				PlanReminderLeadMinutes: 10,
				QuietStart:              "22:30",
				QuietEnd:                "07:30",
			}, true
		}
		return model.LifeTraceSettings{}, false
	}
	return settings, true
}

func planReminderDueAt(plan model.LifeTracePlan, settings model.LifeTraceSettings) (time.Time, bool) {
	dueAt, ok := parsePlanDueAt(plan)
	if !ok {
		return time.Time{}, false
	}

	leadMinutes := settings.PlanReminderLeadMinutes
	switch leadMinutes {
	case 0, 5, 10, 15, 30, 60:
	default:
		leadMinutes = 10
	}
	return dueAt.Add(-time.Duration(leadMinutes) * time.Minute), true
}

func parseClockOnDate(clock string, base time.Time) (time.Time, bool) {
	clock = strings.TrimSpace(clock)
	if clock == "" {
		return time.Time{}, false
	}
	parsed, err := time.ParseInLocation("15:04", clock, base.Location())
	if err != nil {
		return time.Time{}, false
	}
	return time.Date(
		base.Year(),
		base.Month(),
		base.Day(),
		parsed.Hour(),
		parsed.Minute(),
		0,
		0,
		base.Location(),
	), true
}

func isWithinReminderWindow(dueAt time.Time, now time.Time, windowMinutes int) bool {
	if windowMinutes <= 0 {
		windowMinutes = 10
	}
	windowStart := now.Add(-time.Duration(windowMinutes) * time.Minute)
	return !dueAt.After(now) && !dueAt.Before(windowStart)
}

func isQuietHours(settings model.LifeTraceSettings, dueAt time.Time) bool {
	quietStart, ok := parseClockOnDate(normalizeTimeText(settings.QuietStart, "22:30"), dueAt)
	if !ok {
		return false
	}
	quietEnd, ok := parseClockOnDate(normalizeTimeText(settings.QuietEnd, "07:30"), dueAt)
	if !ok {
		return false
	}

	currentMinutes := dueAt.Hour()*60 + dueAt.Minute()
	startMinutes := quietStart.Hour()*60 + quietStart.Minute()
	endMinutes := quietEnd.Hour()*60 + quietEnd.Minute()

	if startMinutes == endMinutes {
		return false
	}
	if startMinutes < endMinutes {
		return currentMinutes >= startMinutes && currentMinutes < endMinutes
	}
	return currentMinutes >= startMinutes || currentMinutes < endMinutes
}

func shouldSendDailyBriefOnDate(settings model.LifeTraceSettings, date time.Time) bool {
	switch strings.TrimSpace(settings.WorkdayMode) {
	case "daily":
		return true
	case "custom":
		if hasCustomWorkday(settings.Workdays, date) {
			return true
		}
		return settings.WeekendReminders && !isWeekday(date)
	default:
		isWorkday := isWeekday(date)
		if settings.HolidaySync {
			isWorkday = isChinaLegalWorkday(date)
		}
		if isWorkday {
			return true
		}
		return settings.WeekendReminders && !isWeekday(date)
	}
}

func hasCustomWorkday(workdays model.StringList, date time.Time) bool {
	weekday := weekdayCode(date)
	for _, item := range workdays {
		if strings.TrimSpace(item) == weekday {
			return true
		}
	}
	return false
}

func weekdayCode(date time.Time) string {
	switch date.Weekday() {
	case time.Monday:
		return "1"
	case time.Tuesday:
		return "2"
	case time.Wednesday:
		return "3"
	case time.Thursday:
		return "4"
	case time.Friday:
		return "5"
	case time.Saturday:
		return "6"
	default:
		return "7"
	}
}

func pushDeliveryExists(userID model.Int64String, planID model.Int64String, subscriptionID model.Int64String, dueAt time.Time) bool {
	var count int64
	if err := database.GetDB().
		Model(&model.LifeTracePushDelivery{}).
		Where("user_id = ? AND plan_id = ? AND subscription_id = ? AND due_at = ? AND status = ?", userID, planID, subscriptionID, dueAt, "sent").
		Count(&count).Error; err != nil {
		return false
	}
	return count > 0
}

func dailyBriefDeliveryExists(userID model.Int64String, briefDate string, subscriptionID model.Int64String) bool {
	var count int64
	if err := database.GetDB().
		Model(&model.LifeTraceDailyBriefDelivery{}).
		Where("user_id = ? AND brief_date = ? AND subscription_id = ? AND status = ?", userID, briefDate, subscriptionID, "sent").
		Count(&count).Error; err != nil {
		return false
	}
	return count > 0
}

func pantryReminderDeliveryExists(
	userID model.Int64String,
	pantryItemID model.Int64String,
	rule string,
	subscriptionID model.Int64String,
	dueAt time.Time,
) bool {
	var count int64
	if err := database.GetDB().
		Model(&model.LifeTracePantryReminderDelivery{}).
		Where(
			"user_id = ? AND pantry_item_id = ? AND rule = ? AND subscription_id = ? AND due_at = ? AND status = ?",
			userID,
			pantryItemID,
			rule,
			subscriptionID,
			dueAt,
			"sent",
		).
		Count(&count).Error; err != nil {
		return false
	}
	return count > 0
}

func savePlanPushDelivery(delivery model.LifeTracePushDelivery) {
	_ = database.GetDB().
		Clauses(clause.OnConflict{
			Columns: []clause.Column{
				{Name: "user_id"},
				{Name: "plan_id"},
				{Name: "due_at"},
				{Name: "subscription_id"},
			},
			DoUpdates: clause.AssignmentColumns([]string{"status", "error", "created_at"}),
		}).
		Create(&delivery).Error
}

func saveDailyBriefDelivery(delivery model.LifeTraceDailyBriefDelivery) {
	_ = database.GetDB().
		Clauses(clause.OnConflict{
			Columns: []clause.Column{
				{Name: "user_id"},
				{Name: "brief_date"},
				{Name: "subscription_id"},
			},
			DoUpdates: clause.AssignmentColumns([]string{"status", "error", "scheduled_at", "created_at"}),
		}).
		Create(&delivery).Error
}

func savePantryReminderDelivery(delivery model.LifeTracePantryReminderDelivery) {
	_ = database.GetDB().
		Clauses(clause.OnConflict{
			Columns: []clause.Column{
				{Name: "user_id"},
				{Name: "pantry_item_id"},
				{Name: "rule"},
				{Name: "due_at"},
				{Name: "subscription_id"},
			},
			DoUpdates: clause.AssignmentColumns([]string{"status", "error", "created_at"}),
		}).
		Create(&delivery).Error
}

func markPushSubscriptionSent(subscription model.LifeTracePushSubscription) {
	now := time.Now()
	_ = database.GetDB().Model(&subscription).Updates(map[string]interface{}{
		"last_sent_at": &now,
		"last_error":   "",
	}).Error
}

func markPushSubscriptionError(subscriptionID model.Int64String, statusCode int, err error) {
	status := "active"
	if isPushSubscriptionInvalid(statusCode, err) {
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

func recordPushFailureOperationLog(
	subscription model.LifeTracePushSubscription,
	payload PushPayload,
	failureContext pushFailureContext,
	statusCode int,
	err error,
) {
	db := database.GetDB()
	if db == nil || err == nil {
		return
	}

	values := url.Values{}
	values.Set("kind", failureContext.kind)
	values.Set("targetId", failureContext.targetID)
	values.Set("subscriptionId", subscription.ID.String())
	values.Set("statusCode", strconv.Itoa(statusCode))
	values.Set("dueAt", failureContext.dueAt.Format(time.RFC3339))
	values.Set("title", payload.Title)
	values.Set("tag", payload.Tag)
	if failureContext.rule != "" {
		values.Set("rule", failureContext.rule)
	}
	values.Set("error", truncateText(err.Error(), 420))
	responseBody := marshalPushFailureOperationLogBody(subscription, payload, failureContext, statusCode, err)

	op := model.OperationLog{
		ID:           model.Int64String(utils.GenerateID()),
		LogID:        "push-" + strconv.FormatInt(time.Now().UnixNano(), 10),
		Method:       "WEB_PUSH",
		Path:         "/life-trace/push/" + failureContext.kind,
		Query:        truncateText(values.Encode(), 1024),
		Status:       statusCode,
		LatencyMs:    0,
		IP:           "",
		UserAgent:    truncateText(subscription.UserAgent, 512),
		UserID:       subscription.UserID.String(),
		UserRole:     "",
		Level:        "error",
		Message:      truncateText("LifeTrace Web Push failed: "+failureContext.kind, 128),
		ResponseBody: responseBody,
	}

	if createErr := db.Create(&op).Error; createErr != nil {
		logger.Log.WithError(createErr).WithField("userId", subscription.UserID.String()).Warn("LifeTrace Web Push failure log write failed")
	}
}

func marshalPushFailureOperationLogBody(
	subscription model.LifeTracePushSubscription,
	payload PushPayload,
	failureContext pushFailureContext,
	statusCode int,
	err error,
) string {
	body := map[string]interface{}{
		"kind":           failureContext.kind,
		"targetId":       failureContext.targetID,
		"subscriptionId": subscription.ID.String(),
		"userId":         subscription.UserID.String(),
		"statusCode":     statusCode,
		"dueAt":          failureContext.dueAt.Format(time.RFC3339),
		"title":          payload.Title,
		"tag":            payload.Tag,
		"error":          err.Error(),
	}
	if failureContext.rule != "" {
		body["rule"] = failureContext.rule
	}

	raw, marshalErr := json.Marshal(body)
	if marshalErr != nil {
		return ""
	}
	return truncateText(string(raw), 4096)
}

func truncateText(value string, maxLength int) string {
	if maxLength <= 0 || len(value) <= maxLength {
		return value
	}
	return value[:maxLength]
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

type recurringReminderConfig struct {
	enabled      bool
	rules        model.StringList
	reminderTime string
}

func sendDueRecurringPaymentRemindersAt(
	ctx context.Context,
	sender pushSender,
	windowMinutes int,
	now time.Time,
) error {
	if windowMinutes <= 0 {
		windowMinutes = 10
	}

	var items []model.LifeTraceRecurringPayment
	if err := database.GetDB().
		Where("archived = ?", false).
		Find(&items).Error; err != nil {
		return err
	}
	if len(items) == 0 {
		return nil
	}

	settingsByUser := map[model.Int64String]model.LifeTraceSettings{}
	for _, item := range items {
		if _, ok := settingsByUser[item.UserID]; ok {
			continue
		}
		var settings model.LifeTraceSettings
		if err := database.GetDB().Where("user_id = ?", item.UserID).First(&settings).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				settings = model.LifeTraceSettings{
					UserID:                      item.UserID,
					SubscriptionReminderEnabled: true,
					SubscriptionReminderRules:   model.StringList{"7d", "3d", "same-day", "overdue"},
					SubscriptionReminderTime:    "09:00",
				}
			} else {
				return err
			}
		}
		settingsByUser[item.UserID] = settings
	}

	for _, item := range items {
		settings := settingsByUser[item.UserID]
		if isQuietHours(settings, now) {
			continue
		}
		if err := sendRecurringPaymentPushReminder(ctx, sender, item, settings, now, windowMinutes); err != nil {
			logger.Log.WithFields(map[string]interface{}{
				"recurringPaymentId": item.ID,
				"error":              err,
			}).Warn("LifeTrace Web Push subscription reminder failed")
		}
	}

	return nil
}

func sendRecurringPaymentPushReminder(
	ctx context.Context,
	sender pushSender,
	item model.LifeTraceRecurringPayment,
	settings model.LifeTraceSettings,
	now time.Time,
	windowMinutes int,
) error {
	config := resolveRecurringReminderConfig(item, settings)
	if !config.enabled || len(config.rules) == 0 {
		return nil
	}

	var subscriptions []model.LifeTracePushSubscription
	if err := database.GetDB().
		Where("user_id = ? AND status = ?", item.UserID, "active").
		Find(&subscriptions).Error; err != nil {
		return err
	}
	if len(subscriptions) == 0 {
		return nil
	}

	for _, rule := range config.rules {
		dueAt, ok := recurringReminderDueAt(item, config.reminderTime, rule, now, windowMinutes)
		if !ok {
			continue
		}

		payload := buildRecurringPaymentPushPayload(item, rule, dueAt)
		for _, subscription := range subscriptions {
			if recurringPaymentDeliveryExists(item.UserID, item.ID, string(rule), subscription.ID, dueAt) {
				continue
			}

			deliveryStatus, errorText := sendPushPayload(
				ctx,
				sender,
				subscription,
				payload,
				pushFailureContext{
					kind:     "recurring_payment",
					targetID: item.ID.String(),
					rule:     string(rule),
					dueAt:    dueAt,
				},
			)
			saveRecurringPaymentDelivery(model.LifeTraceRecurringPaymentDelivery{
				UserID:             item.UserID,
				RecurringPaymentID: item.ID,
				Rule:               string(rule),
				DueAt:              dueAt,
				SubscriptionID:     subscription.ID,
				Status:             deliveryStatus,
				Error:              errorText,
			})
		}
	}

	return nil
}

func resolveRecurringReminderConfig(
	item model.LifeTraceRecurringPayment,
	settings model.LifeTraceSettings,
) recurringReminderConfig {
	if item.ReminderUseDefault {
		return recurringReminderConfig{
			enabled:      settings.SubscriptionReminderEnabled,
			rules:        settings.SubscriptionReminderRules,
			reminderTime: normalizeTimeText(settings.SubscriptionReminderTime, "09:00"),
		}
	}
	return recurringReminderConfig{
		enabled:      item.ReminderEnabled,
		rules:        item.ReminderRules,
		reminderTime: normalizeTimeText(item.ReminderTime, "09:00"),
	}
}

func recurringReminderDueAt(
	item model.LifeTraceRecurringPayment,
	reminderTime string,
	rule string,
	now time.Time,
	windowMinutes int,
) (time.Time, bool) {
	dueDate, ok := parseRecurringDueDate(item.NextDueAt, now.Location())
	if !ok {
		return time.Time{}, false
	}

	targetDate := dueDate
	switch strings.TrimSpace(rule) {
	case "7d":
		targetDate = dueDate.AddDate(0, 0, -7)
	case "3d":
		targetDate = dueDate.AddDate(0, 0, -3)
	case "same-day":
		targetDate = dueDate
	case "overdue":
		targetDate = dueDate.AddDate(0, 0, 1)
	default:
		return time.Time{}, false
	}

	dueAt, ok := parseClockOnDate(reminderTime, targetDate)
	if !ok || !isWithinReminderWindow(dueAt, now, windowMinutes) {
		return time.Time{}, false
	}
	return dueAt, true
}

func parseRecurringDueDate(value string, location *time.Location) (time.Time, bool) {
	value = strings.TrimSpace(value)
	if value == "" {
		return time.Time{}, false
	}
	parsed, err := time.ParseInLocation("2006-01-02", value, location)
	if err != nil {
		return time.Time{}, false
	}
	return time.Date(parsed.Year(), parsed.Month(), parsed.Day(), 0, 0, 0, 0, location), true
}

func buildRecurringPaymentPushPayload(
	item model.LifeTraceRecurringPayment,
	rule string,
	dueAt time.Time,
) PushPayload {
	body := recurringPaymentReminderBody(item, rule)

	title := "订阅续费提醒：" + item.Name
	switch strings.TrimSpace(rule) {
	case "same-day":
		title = "订阅今天扣款：" + item.Name
	case "overdue":
		title = "订阅已逾期：" + item.Name
	}

	urlValues := url.Values{}
	urlValues.Set("new", "1")
	urlValues.Set("recurringPaymentId", item.ID.String())
	urlValues.Set("amount", strconv.FormatFloat(centsToAmount(item.AmountCents), 'f', -1, 64))
	if category := strings.TrimSpace(item.Category); category != "" {
		urlValues.Set("category", category)
	}
	if merchant := strings.TrimSpace(item.Merchant); merchant != "" {
		urlValues.Set("merchant", merchant)
	}
	if direction := strings.TrimSpace(item.Direction); direction != "" {
		urlValues.Set("direction", direction)
	}

	return PushPayload{
		Title: title,
		Body:  body,
		URL:   "/ledger?" + urlValues.Encode(),
		Tag:   fmt.Sprintf("life-trace-recurring-%s-%s-%d", item.ID.String(), rule, dueAt.Unix()),
	}
}

func recurringPaymentReminderBody(item model.LifeTraceRecurringPayment, rule string) string {
	amountText := fmt.Sprintf("¥%.2f", centsToAmount(item.AmountCents))
	switch strings.TrimSpace(rule) {
	case "7d":
		return fmt.Sprintf("%s 还有 7 天扣款 · %s", item.Name, amountText)
	case "3d":
		return fmt.Sprintf("%s 还有 3 天扣款 · %s", item.Name, amountText)
	case "same-day":
		return fmt.Sprintf("%s 今天扣款 · %s", item.Name, amountText)
	case "overdue":
		return fmt.Sprintf("%s 已逾期 · %s · 点开记一笔", item.Name, amountText)
	default:
		return fmt.Sprintf("%s · %s · 需要确认", item.Name, amountText)
	}
}

func recurringPaymentDeliveryExists(
	userID model.Int64String,
	recurringPaymentID model.Int64String,
	rule string,
	subscriptionID model.Int64String,
	dueAt time.Time,
) bool {
	var count int64
	if err := database.GetDB().
		Model(&model.LifeTraceRecurringPaymentDelivery{}).
		Where(
			"user_id = ? AND recurring_payment_id = ? AND rule = ? AND subscription_id = ? AND due_at = ? AND status = ?",
			userID,
			recurringPaymentID,
			rule,
			subscriptionID,
			dueAt,
			"sent",
		).
		Count(&count).Error; err != nil {
		return false
	}
	return count > 0
}

func saveRecurringPaymentDelivery(delivery model.LifeTraceRecurringPaymentDelivery) {
	_ = database.GetDB().
		Clauses(clause.OnConflict{
			Columns: []clause.Column{
				{Name: "user_id"},
				{Name: "recurring_payment_id"},
				{Name: "rule"},
				{Name: "due_at"},
				{Name: "subscription_id"},
			},
			DoUpdates: clause.AssignmentColumns([]string{"status", "error", "created_at"}),
		}).
		Create(&delivery).Error
}
