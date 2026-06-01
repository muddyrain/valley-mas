package lifetrace

import (
	"errors"
	"net/http"
	"strings"
	"valley-server/internal/database"
	"valley-server/internal/model"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type updateSettingsRequest struct {
	City                    string   `json:"city"`
	WorkStart               string   `json:"workStart"`
	WorkEnd                 string   `json:"workEnd"`
	CommuteMethod           string   `json:"commuteMethod"`
	DailyBriefTime          string   `json:"dailyBriefTime"`
	WorkdayMode             string   `json:"workdayMode"`
	Workdays                []string `json:"workdays"`
	HolidaySync             bool     `json:"holidaySync"`
	WeekendReminders        bool     `json:"weekendReminders"`
	PlanReminderLeadMinutes int      `json:"planReminderLeadMinutes"`
	QuietStart              string   `json:"quietStart"`
	QuietEnd                string   `json:"quietEnd"`
	WeatherAlerts           bool     `json:"weatherAlerts"`
	PlanReminders           bool     `json:"planReminders"`
	AIPersonalization       bool     `json:"aiPersonalization"`
	Habits                  []string `json:"habits"`
}

var validCommuteMethods = map[string]bool{
	"开车": true,
	"地铁": true,
	"步行": true,
	"骑行": true,
	"远程": true,
}

var validWorkdayModes = map[string]bool{
	"legal":  true,
	"custom": true,
	"daily":  true,
}

var validWorkdays = map[string]bool{
	"1": true,
	"2": true,
	"3": true,
	"4": true,
	"5": true,
	"6": true,
	"7": true,
}

func defaultSettings(userID model.Int64String) model.LifeTraceSettings {
	return model.LifeTraceSettings{
		UserID:                  userID,
		City:                    "上海",
		WorkStart:               "09:30",
		WorkEnd:                 "18:30",
		CommuteMethod:           "开车",
		DailyBriefTime:          "08:10",
		WorkdayMode:             "legal",
		Workdays:                model.StringList{"1", "2", "3", "4", "5"},
		HolidaySync:             true,
		WeekendReminders:        false,
		PlanReminderLeadMinutes: 10,
		QuietStart:              "22:30",
		QuietEnd:                "07:30",
		WeatherAlerts:           true,
		PlanReminders:           true,
		AIPersonalization:       true,
		Habits:                  model.StringList{"喝水", "休息", "运动", "护肤"},
	}
}

func normalizeCommuteMethod(method string) string {
	method = strings.TrimSpace(method)
	if !validCommuteMethods[method] {
		return "开车"
	}
	return method
}

func normalizeWorkdayMode(mode string) string {
	mode = strings.TrimSpace(mode)
	if !validWorkdayModes[mode] {
		return "legal"
	}
	return mode
}

func normalizeText(value string, fallback string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return fallback
	}
	return value
}

func normalizeTimeText(value string, fallback string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return fallback
	}
	return value
}

func normalizePlanReminderLeadMinutes(value int) int {
	switch value {
	case 0, 5, 10, 15, 30, 60:
		return value
	default:
		return 10
	}
}

func normalizeWorkdays(days []string) model.StringList {
	seen := map[string]bool{}
	result := model.StringList{}
	for _, day := range days {
		day = strings.TrimSpace(day)
		if !validWorkdays[day] || seen[day] {
			continue
		}
		seen[day] = true
		result = append(result, day)
	}
	if len(result) == 0 {
		return model.StringList{"1", "2", "3", "4", "5"}
	}
	return result
}

func normalizeHabits(habits []string) model.StringList {
	seen := map[string]bool{}
	result := model.StringList{}
	for _, habit := range habits {
		habit = strings.TrimSpace(habit)
		if habit == "" || seen[habit] {
			continue
		}
		seen[habit] = true
		result = append(result, habit)
	}
	if len(result) == 0 {
		return model.StringList{"喝水", "休息", "运动", "护肤"}
	}
	return result
}

func applySettingsRequest(settings *model.LifeTraceSettings, req updateSettingsRequest) {
	settings.City = normalizeText(req.City, "上海")
	settings.WorkStart = normalizeText(req.WorkStart, "09:30")
	settings.WorkEnd = normalizeText(req.WorkEnd, "18:30")
	settings.CommuteMethod = normalizeCommuteMethod(req.CommuteMethod)
	settings.DailyBriefTime = normalizeText(req.DailyBriefTime, "08:10")
	settings.WorkdayMode = normalizeWorkdayMode(req.WorkdayMode)
	settings.Workdays = normalizeWorkdays(req.Workdays)
	settings.HolidaySync = req.HolidaySync
	settings.WeekendReminders = req.WeekendReminders
	settings.PlanReminderLeadMinutes = normalizePlanReminderLeadMinutes(req.PlanReminderLeadMinutes)
	settings.QuietStart = normalizeTimeText(req.QuietStart, "22:30")
	settings.QuietEnd = normalizeTimeText(req.QuietEnd, "07:30")
	settings.WeatherAlerts = req.WeatherAlerts
	settings.PlanReminders = req.PlanReminders
	settings.AIPersonalization = req.AIPersonalization
	settings.Habits = normalizeHabits(req.Habits)
}

func (h *Handler) GetSettings(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		fail(c, http.StatusUnauthorized, "未登录")
		return
	}

	settings, err := findSettings(userID)
	if err != nil {
		fail(c, http.StatusInternalServerError, "获取偏好失败")
		return
	}

	success(c, settings)
}

func (h *Handler) UpdateSettings(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		fail(c, http.StatusUnauthorized, "未登录")
		return
	}

	var req updateSettingsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		fail(c, http.StatusBadRequest, "参数错误")
		return
	}

	settings, err := findSettings(userID)
	if err != nil {
		fail(c, http.StatusInternalServerError, "保存偏好失败")
		return
	}

	applySettingsRequest(&settings, req)
	if err := database.GetDB().Save(&settings).Error; err != nil {
		fail(c, http.StatusInternalServerError, "保存偏好失败")
		return
	}

	success(c, settings)
}

func findSettings(userID model.Int64String) (model.LifeTraceSettings, error) {
	var settings model.LifeTraceSettings
	err := database.GetDB().First(&settings, "user_id = ?", userID).Error
	if err == nil {
		return settings, nil
	}
	if errors.Is(err, gorm.ErrRecordNotFound) {
		settings = defaultSettings(userID)
		if err := database.GetDB().Create(&settings).Error; err != nil {
			return settings, err
		}
		return settings, nil
	}
	return settings, err
}
