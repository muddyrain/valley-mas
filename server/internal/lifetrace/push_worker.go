package lifetrace

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"
	"valley-server/internal/config"
	"valley-server/internal/database"
	"valley-server/internal/logger"
	"valley-server/internal/model"

	"gorm.io/gorm"
)

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

		if err := scanPushReminders(ctx, service, weather, cfg.ReminderWindowMin, time.Now()); err != nil {
			logger.Log.WithField("error", err).Warn("LifeTrace Web Push initial scan failed")
		}

		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				if err := scanPushReminders(ctx, service, weather, cfg.ReminderWindowMin, time.Now()); err != nil {
					logger.Log.WithField("error", err).Warn("LifeTrace Web Push scan failed")
				}
			}
		}
	}()
}

func scanPushReminders(
	ctx context.Context,
	sender pushSender,
	weather *WeatherService,
	windowMinutes int,
	now time.Time,
) error {
	if err := sendDuePlanPushRemindersAt(ctx, sender, windowMinutes, now); err != nil {
		return err
	}
	if err := sendDuePantryPushRemindersAt(ctx, sender, windowMinutes, now); err != nil {
		return err
	}
	if err := sendDueDailyBriefPushesAt(ctx, sender, weather, windowMinutes, now); err != nil {
		return err
	}
	return nil
}

func sendDuePlanPushReminders(ctx context.Context, sender pushSender, windowMinutes int) error {
	return sendDuePlanPushRemindersAt(ctx, sender, windowMinutes, time.Now())
}

func sendDuePantryPushReminders(ctx context.Context, sender pushSender, windowMinutes int) error {
	return sendDuePantryPushRemindersAt(ctx, sender, windowMinutes, time.Now())
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
	return sendDueDailyBriefPushesAt(ctx, sender, weather, windowMinutes, time.Now())
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

		deliveryStatus, errorText := sendPushPayload(ctx, sender, subscription, payload)
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

			deliveryStatus, errorText := sendPushPayload(ctx, sender, subscription, payload)
			_ = database.GetDB().Create(&model.LifeTracePantryReminderDelivery{
				UserID:         item.UserID,
				PantryItemID:   item.ID,
				Rule:           string(rule),
				DueAt:          dueAt,
				SubscriptionID: subscription.ID,
				Status:         deliveryStatus,
				Error:          errorText,
			}).Error
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

	var checkins []model.LifeTraceCheckin
	if err := database.GetDB().
		Where("user_id = ? AND date = ?", settings.UserID, today).
		Order("created_at ASC").
		Find(&checkins).Error; err != nil {
		return err
	}

	var weatherResp WeatherResponse
	if weather != nil {
		weatherResp = weather.Fetch(ctx, settings.City, false)
	}

	payload := buildDailyBriefPushPayload(settings, weatherResp, plans, checkins, dueAt)
	for _, subscription := range subscriptions {
		if dailyBriefDeliveryExists(settings.UserID, today, subscription.ID) {
			continue
		}

		deliveryStatus, errorText := sendPushPayload(ctx, sender, subscription, payload)
		_ = database.GetDB().Create(&model.LifeTraceDailyBriefDelivery{
			UserID:         settings.UserID,
			BriefDate:      today,
			ScheduledAt:    dueAt,
			SubscriptionID: subscription.ID,
			Status:         deliveryStatus,
			Error:          errorText,
		}).Error
	}

	return nil
}

func sendPushPayload(
	ctx context.Context,
	sender pushSender,
	subscription model.LifeTracePushSubscription,
	payload PushPayload,
) (string, string) {
	sendCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	statusCode, err := sender.Send(sendCtx, subscription, payload)
	cancel()

	if err != nil {
		markPushSubscriptionError(subscription.ID, statusCode, err)
		return "failed", err.Error()
	}

	markPushSubscriptionSent(subscription)
	return "sent", ""
}

func buildDailyBriefPushPayload(
	settings model.LifeTraceSettings,
	weather WeatherResponse,
	plans []model.LifeTracePlan,
	checkins []model.LifeTraceCheckin,
	dueAt time.Time,
) PushPayload {
	intro := buildDailyBriefIntro(settings, weather, dueAt)
	planText := buildDailyBriefPlanText(plans)
	completedCount := countCompletedCheckins(checkins)
	habitText := buildDailyBriefHabitText(settings, completedCount)

	parts := []string{intro, planText, habitText}
	body := strings.Join(compactStrings(parts), "；")
	if body == "" {
		body = "看看今天的天气、计划和打卡节奏。"
	}

	return PushPayload{
		Title: buildDailyBriefTitle(settings, weather, dueAt),
		Body:  body,
		URL:   "/today",
		Tag:   fmt.Sprintf("life-trace-daily-brief-%s", dueAt.Format("2006-01-02")),
	}
}

func buildDailyBriefTitle(settings model.LifeTraceSettings, weather WeatherResponse, dueAt time.Time) string {
	if riskTitle := buildDailyBriefRiskTitle(weather); riskTitle != "" {
		return riskTitle
	}
	if isRestDay(settings, dueAt) {
		return "Life Trace 周末简报"
	}
	return "Life Trace 每日简报"
}

func buildDailyBriefIntro(settings model.LifeTraceSettings, weather WeatherResponse, dueAt time.Time) string {
	if riskIntro := buildDailyBriefRiskIntro(weather); riskIntro != "" {
		return riskIntro
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
			return strings.Join(base, " ") + "，今天把节奏放松一点也没关系"
		}
		return "今天适合按自己的节奏慢慢展开"
	}

	if len(base) > 0 {
		return strings.Join(base, " ") + "，今天先把最重要的一件事处理掉"
	}
	return "新的一天开始了，先把节奏稳住"
}

func buildDailyBriefPlanText(plans []model.LifeTracePlan) string {
	if len(plans) == 0 {
		return "今天计划比较轻，先完成一件最重要的事"
	}

	nextPlanText := "今天有 1 个计划待处理"
	if len(plans) > 1 {
		nextPlanText = fmt.Sprintf("今天有 %d 个计划待处理", len(plans))
	}
	if nextPlan := findNextPlanWithTime(plans); nextPlan != nil && strings.TrimSpace(nextPlan.ScheduledTime) != "" {
		nextPlanText = fmt.Sprintf("%s，下一项 %s %s", nextPlanText, nextPlan.ScheduledTime, nextPlan.Title)
	}
	return nextPlanText
}

func buildDailyBriefHabitText(settings model.LifeTraceSettings, completedCount int) string {
	totalHabits := len(settings.Habits)
	if totalHabits <= 0 {
		return ""
	}
	if completedCount == 0 {
		return fmt.Sprintf("今日打卡还没开始，先完成 %s", settings.Habits[0])
	}
	if completedCount >= totalHabits {
		return fmt.Sprintf("今日打卡 %d/%d，状态不错，继续保持", completedCount, totalHabits)
	}
	return fmt.Sprintf("今日打卡 %d/%d，再完成一项会更稳", completedCount, totalHabits)
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

func countCompletedCheckins(checkins []model.LifeTraceCheckin) int {
	count := 0
	for _, item := range checkins {
		if item.Completed {
			count++
		}
	}
	return count
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
		Where("user_id = ? AND plan_id = ? AND subscription_id = ? AND due_at = ?", userID, planID, subscriptionID, dueAt).
		Count(&count).Error; err != nil {
		return false
	}
	return count > 0
}

func dailyBriefDeliveryExists(userID model.Int64String, briefDate string, subscriptionID model.Int64String) bool {
	var count int64
	if err := database.GetDB().
		Model(&model.LifeTraceDailyBriefDelivery{}).
		Where("user_id = ? AND brief_date = ? AND subscription_id = ?", userID, briefDate, subscriptionID).
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
			"user_id = ? AND pantry_item_id = ? AND rule = ? AND subscription_id = ? AND due_at = ?",
			userID,
			pantryItemID,
			rule,
			subscriptionID,
			dueAt,
		).
		Count(&count).Error; err != nil {
		return false
	}
	return count > 0
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
