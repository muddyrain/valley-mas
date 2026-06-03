package lifetrace

import (
	"context"
	"strings"
	"testing"
	"time"
	"valley-server/internal/config"
	"valley-server/internal/database"
	"valley-server/internal/model"
)

type fakePushSender struct {
	payloads []PushPayload
}

func (f *fakePushSender) Enabled() bool {
	return true
}

func (f *fakePushSender) Send(_ context.Context, _ model.LifeTracePushSubscription, payload PushPayload) (int, error) {
	f.payloads = append(f.payloads, payload)
	return 201, nil
}

func TestDailyBriefDueAtMatchesWindow(t *testing.T) {
	settings := model.LifeTraceSettings{DailyBriefTime: "08:10"}
	now := time.Date(2026, 6, 2, 8, 15, 0, 0, time.Local)

	dueAt, ok := dailyBriefDueAt(settings, now, 10)
	if !ok {
		t.Fatalf("expected daily brief to be due")
	}
	if dueAt.Format("15:04") != "08:10" {
		t.Fatalf("expected parsed due time 08:10, got %s", dueAt.Format(time.RFC3339))
	}
}

func TestPlanReminderDueAtRespectsLeadMinutes(t *testing.T) {
	dueAt, ok := planReminderDueAt(model.LifeTracePlan{
		ScheduledDate: "2026-06-03",
		ScheduledTime: "09:30",
		Timezone:      "Asia/Shanghai",
	}, model.LifeTraceSettings{
		PlanReminderLeadMinutes: 30,
	})
	if !ok {
		t.Fatal("expected valid plan reminder due time")
	}
	if dueAt.Format("15:04") != "09:00" {
		t.Fatalf("expected reminder due at 09:00, got %s", dueAt.Format(time.RFC3339))
	}
}

func TestIsQuietHoursSupportsCrossMidnightWindow(t *testing.T) {
	settings := model.LifeTraceSettings{QuietStart: "22:30", QuietEnd: "07:30"}
	lateNight := time.Date(2026, 6, 3, 23, 10, 0, 0, time.Local)
	earlyMorning := time.Date(2026, 6, 4, 7, 10, 0, 0, time.Local)
	dayTime := time.Date(2026, 6, 4, 10, 0, 0, 0, time.Local)

	if !isQuietHours(settings, lateNight) {
		t.Fatal("expected late night time to be inside quiet hours")
	}
	if !isQuietHours(settings, earlyMorning) {
		t.Fatal("expected early morning time to be inside quiet hours")
	}
	if isQuietHours(settings, dayTime) {
		t.Fatal("expected day time to be outside quiet hours")
	}
}

func TestShouldSendDailyBriefOnDateRespectsWorkdayRules(t *testing.T) {
	saturday := time.Date(2026, 6, 6, 8, 10, 0, 0, time.Local)

	legal := model.LifeTraceSettings{WorkdayMode: "legal", HolidaySync: true}
	if shouldSendDailyBriefOnDate(legal, saturday) {
		t.Fatalf("expected legal workday mode to skip saturday")
	}

	weekendEnabled := model.LifeTraceSettings{
		WorkdayMode:      "legal",
		HolidaySync:      true,
		WeekendReminders: true,
	}
	if !shouldSendDailyBriefOnDate(weekendEnabled, saturday) {
		t.Fatalf("expected weekend reminders to allow saturday daily brief")
	}

	custom := model.LifeTraceSettings{WorkdayMode: "custom", Workdays: model.StringList{"6"}}
	if !shouldSendDailyBriefOnDate(custom, saturday) {
		t.Fatalf("expected custom saturday workday to allow daily brief")
	}
}

func TestSendDueDailyBriefPushesSendsOnlyOncePerDay(t *testing.T) {
	_ = setupTraceTestRouter(t, 101)

	now := time.Date(2026, 6, 2, 8, 15, 0, 0, time.Local)
	settings := model.LifeTraceSettings{
		UserID:            model.Int64String(101),
		City:              "上海",
		DailyBriefTime:    "08:10",
		WorkdayMode:       "daily",
		Habits:            model.StringList{"喝水", "运动"},
		WeekendReminders:  true,
		HolidaySync:       true,
		PlanReminders:     true,
		WeatherAlerts:     true,
		AIPersonalization: true,
	}
	if err := database.GetDB().Create(&settings).Error; err != nil {
		t.Fatalf("create settings: %v", err)
	}
	if err := database.GetDB().Create(&model.LifeTracePushSubscription{
		UserID:    model.Int64String(101),
		Endpoint:  "https://push.example/device",
		P256DH:    "p256dh-key",
		Auth:      "auth-key",
		Status:    "active",
		UserAgent: "test",
	}).Error; err != nil {
		t.Fatalf("create subscription: %v", err)
	}
	if err := database.GetDB().Create(&model.LifeTracePlan{
		UserID:        model.Int64String(101),
		Title:         "预约取车",
		Type:          "普通事项",
		TimeLabel:     "2026-06-02 19:30",
		ScheduledDate: "2026-06-02",
		ScheduledTime: "19:30",
		Timezone:      "Asia/Shanghai",
		Reminder:      true,
		Note:          "测试计划",
	}).Error; err != nil {
		t.Fatalf("create plan: %v", err)
	}
	if err := database.GetDB().Create(&model.LifeTraceCheckin{
		UserID:    model.Int64String(101),
		Date:      "2026-06-02",
		Name:      "喝水",
		Completed: true,
	}).Error; err != nil {
		t.Fatalf("create checkin: %v", err)
	}

	sender := &fakePushSender{}
	weather := NewWeatherService(config.QWeatherConfig{})
	if err := sendDueDailyBriefPushesAt(context.Background(), sender, weather, 10, now); err != nil {
		t.Fatalf("send daily brief: %v", err)
	}
	if len(sender.payloads) != 1 {
		t.Fatalf("expected one daily brief push, got %d", len(sender.payloads))
	}
	if sender.payloads[0].URL != "/today" {
		t.Fatalf("expected daily brief to route to /today, got %+v", sender.payloads[0])
	}

	if err := sendDueDailyBriefPushesAt(context.Background(), sender, weather, 10, now); err != nil {
		t.Fatalf("send duplicate daily brief: %v", err)
	}
	if len(sender.payloads) != 1 {
		t.Fatalf("expected duplicate scan to be skipped, got %d pushes", len(sender.payloads))
	}
}

func TestSendDuePantryPushRemindersUsesCustomRulesAndOnlySendsOnce(t *testing.T) {
	_ = setupTraceTestRouter(t, 201)

	now := time.Date(2026, 6, 2, 9, 5, 0, 0, time.Local)
	if err := database.GetDB().Create(&model.LifeTracePushSubscription{
		UserID:    model.Int64String(201),
		Endpoint:  "https://push.example/pantry-custom",
		P256DH:    "p256dh-key",
		Auth:      "auth-key",
		Status:    "active",
		UserAgent: "test",
	}).Error; err != nil {
		t.Fatalf("create subscription: %v", err)
	}
	if err := database.GetDB().Create(&model.LifeTracePantryItem{
		UserID:             model.Int64String(201),
		Name:               "牛奶",
		Category:           "食品",
		Quantity:           2,
		Unit:               "盒",
		Location:           "冷藏",
		ExpiresAt:          "2026-06-05",
		Status:             "normal",
		ReminderEnabled:    true,
		ReminderUseDefault: false,
		ReminderRules:      model.StringList{"3d"},
		ReminderTime:       "09:00",
	}).Error; err != nil {
		t.Fatalf("create pantry item: %v", err)
	}

	sender := &fakePushSender{}
	if err := sendDuePantryPushRemindersAt(context.Background(), sender, 10, now); err != nil {
		t.Fatalf("send pantry push: %v", err)
	}
	if len(sender.payloads) != 1 {
		t.Fatalf("expected one pantry push, got %d", len(sender.payloads))
	}
	if sender.payloads[0].URL != "/pantry" {
		t.Fatalf("expected pantry reminder to route to /pantry, got %+v", sender.payloads[0])
	}
	if !strings.Contains(sender.payloads[0].Body, "还有 3 天到期") {
		t.Fatalf("expected pantry reminder body to mention 3 days, got %+v", sender.payloads[0])
	}

	if err := sendDuePantryPushRemindersAt(context.Background(), sender, 10, now); err != nil {
		t.Fatalf("send duplicate pantry push: %v", err)
	}
	if len(sender.payloads) != 1 {
		t.Fatalf("expected duplicate pantry scan to be skipped, got %d pushes", len(sender.payloads))
	}
}

func TestSendDuePantryPushRemindersUsesDefaultRulesAndSkipsHandledItems(t *testing.T) {
	_ = setupTraceTestRouter(t, 202)

	now := time.Date(2026, 6, 2, 9, 5, 0, 0, time.Local)
	if err := database.GetDB().Create(&model.LifeTraceSettings{
		UserID:                model.Int64String(202),
		PantryReminderEnabled: true,
		PantryReminderRules:   model.StringList{"same-day"},
		PantryReminderTime:    "09:00",
	}).Error; err != nil {
		t.Fatalf("create settings: %v", err)
	}
	if err := database.GetDB().Create(&model.LifeTracePushSubscription{
		UserID:    model.Int64String(202),
		Endpoint:  "https://push.example/pantry-default",
		P256DH:    "p256dh-key",
		Auth:      "auth-key",
		Status:    "active",
		UserAgent: "test",
	}).Error; err != nil {
		t.Fatalf("create subscription: %v", err)
	}
	if err := database.GetDB().Create(&model.LifeTracePantryItem{
		UserID:             model.Int64String(202),
		Name:               "酸奶",
		Category:           "食品",
		Quantity:           1,
		Unit:               "杯",
		Location:           "冷藏",
		ExpiresAt:          "2026-06-02",
		Status:             "normal",
		ReminderEnabled:    true,
		ReminderUseDefault: true,
		ReminderRules:      model.StringList{"7d"},
		ReminderTime:       "08:00",
	}).Error; err != nil {
		t.Fatalf("create pantry item: %v", err)
	}
	if err := database.GetDB().Create(&model.LifeTracePantryItem{
		UserID:             model.Int64String(202),
		Name:               "生菜",
		Category:           "食品",
		Quantity:           1,
		Unit:               "袋",
		Location:           "冷藏",
		ExpiresAt:          "2026-06-02",
		Status:             "used-up",
		ReminderEnabled:    true,
		ReminderUseDefault: true,
		ReminderRules:      model.StringList{"same-day"},
		ReminderTime:       "09:00",
	}).Error; err != nil {
		t.Fatalf("create handled pantry item: %v", err)
	}

	sender := &fakePushSender{}
	if err := sendDuePantryPushRemindersAt(context.Background(), sender, 10, now); err != nil {
		t.Fatalf("send pantry push with defaults: %v", err)
	}
	if len(sender.payloads) != 1 {
		t.Fatalf("expected one default pantry push, got %d", len(sender.payloads))
	}
	if sender.payloads[0].Title != "库存到期提醒：酸奶" {
		t.Fatalf("expected same-day pantry title, got %+v", sender.payloads[0])
	}
}

func TestSendDuePlanPushRemindersUsesLeadMinutesAndQuietHours(t *testing.T) {
	_ = setupTraceTestRouter(t, 303)

	if err := database.GetDB().Create(&model.LifeTraceSettings{
		UserID:                  model.Int64String(303),
		PlanReminders:           true,
		PlanReminderLeadMinutes: 30,
		QuietStart:              "22:30",
		QuietEnd:                "07:30",
	}).Error; err != nil {
		t.Fatalf("create settings: %v", err)
	}
	if err := database.GetDB().Create(&model.LifeTracePushSubscription{
		UserID:    model.Int64String(303),
		Endpoint:  "https://push.example/plan-lead",
		P256DH:    "p256dh-key",
		Auth:      "auth-key",
		Status:    "active",
		UserAgent: "test",
	}).Error; err != nil {
		t.Fatalf("create subscription: %v", err)
	}
	if err := database.GetDB().Create(&model.LifeTracePlan{
		UserID:        model.Int64String(303),
		Title:         "早会",
		Type:          "普通事项",
		TimeLabel:     "2026-06-03 09:30",
		ScheduledDate: "2026-06-03",
		ScheduledTime: "09:30",
		Timezone:      "Asia/Shanghai",
		Reminder:      true,
		Note:          "测试计划提醒",
	}).Error; err != nil {
		t.Fatalf("create plan: %v", err)
	}

	sender := &fakePushSender{}
	now := time.Date(2026, 6, 3, 9, 5, 0, 0, time.Local)
	if err := sendDuePlanPushRemindersAt(context.Background(), sender, 10, now); err != nil {
		t.Fatalf("send lead-time plan push: %v", err)
	}
	if len(sender.payloads) != 1 {
		t.Fatalf("expected one lead-time plan push, got %d", len(sender.payloads))
	}
	if !strings.Contains(sender.payloads[0].Body, "09:00") {
		t.Fatalf("expected plan reminder body to use lead time, got %+v", sender.payloads[0])
	}

	sender.payloads = nil
	if err := database.GetDB().Create(&model.LifeTracePlan{
		UserID:        model.Int64String(303),
		Title:         "深夜计划",
		Type:          "普通事项",
		TimeLabel:     "2026-06-03 23:30",
		ScheduledDate: "2026-06-03",
		ScheduledTime: "23:30",
		Timezone:      "Asia/Shanghai",
		Reminder:      true,
		Note:          "测试勿扰",
	}).Error; err != nil {
		t.Fatalf("create quiet-hour plan: %v", err)
	}
	quietNow := time.Date(2026, 6, 3, 23, 5, 0, 0, time.Local)
	if err := sendDuePlanPushRemindersAt(context.Background(), sender, 10, quietNow); err != nil {
		t.Fatalf("send quiet-hour plan push: %v", err)
	}
	if len(sender.payloads) != 0 {
		t.Fatalf("expected quiet hours to skip plan push, got %d", len(sender.payloads))
	}
}

func TestBuildDailyBriefPushPayloadUsesWeekendTone(t *testing.T) {
	settings := model.LifeTraceSettings{
		City:             "杭州",
		WorkdayMode:      "legal",
		HolidaySync:      true,
		WeekendReminders: true,
		WeatherAlerts:    true,
		Habits:           model.StringList{"喝水", "休息"},
	}
	dueAt := time.Date(2026, 6, 6, 8, 10, 0, 0, time.Local)

	payload := buildDailyBriefPushPayload(settings, WeatherResponse{}, nil, nil, dueAt)
	if payload.Title != "Life Trace 周末天气" {
		t.Fatalf("expected weekend title, got %+v", payload)
	}
	if payload.Body == "" || !containsAny(payload.Body, []string{"放松一点", "自己的节奏"}) {
		t.Fatalf("expected weekend tone in body, got %+v", payload)
	}
}

func TestBuildDailyBriefPushPayloadPrioritizesWeatherRisk(t *testing.T) {
	settings := model.LifeTraceSettings{
		City:          "上海",
		WorkdayMode:   "daily",
		WeatherAlerts: true,
		Habits:        model.StringList{"喝水", "运动"},
	}
	weather := WeatherResponse{}
	weather.Now.Temp = "33"
	weather.Now.High = "36"
	weather.Now.Low = "27"
	weather.Now.Text = "晴"
	dueAt := time.Date(2026, 6, 2, 8, 10, 0, 0, time.Local)

	payload := buildDailyBriefPushPayload(settings, weather, nil, nil, dueAt)
	if payload.Title != "Life Trace 高温提醒" {
		t.Fatalf("expected heat warning title, got %+v", payload)
	}
	if !containsAny(payload.Body, []string{"体感偏热", "补水"}) {
		t.Fatalf("expected heat-focused body, got %+v", payload)
	}
}

func TestBuildDailyBriefPushPayloadKeepsDailyWeatherWhenRiskAlertsDisabled(t *testing.T) {
	settings := model.LifeTraceSettings{
		City:          "上海",
		WorkdayMode:   "daily",
		WeatherAlerts: false,
		Habits:        model.StringList{"喝水", "运动"},
	}
	weather := WeatherResponse{}
	weather.Now.Temp = "33"
	weather.Now.High = "36"
	weather.Now.Low = "27"
	weather.Now.Text = "晴"
	dueAt := time.Date(2026, 6, 2, 8, 10, 0, 0, time.Local)

	payload := buildDailyBriefPushPayload(settings, weather, nil, nil, dueAt)
	if payload.Title != "Life Trace 每日天气" {
		t.Fatalf("expected daily weather title when alerts are disabled, got %+v", payload)
	}
	if !containsAny(payload.Body, []string{"上海", "33°", "晴"}) {
		t.Fatalf("expected daily weather summary in body, got %+v", payload)
	}
	if containsAny(payload.Body, []string{"补水", "暴晒", "降雨信号", "分层穿衣"}) {
		t.Fatalf("expected risk wording to be suppressed when alerts are disabled, got %+v", payload)
	}
}

func containsAny(text string, candidates []string) bool {
	for _, candidate := range candidates {
		if candidate != "" && strings.Contains(text, candidate) {
			return true
		}
	}
	return false
}
