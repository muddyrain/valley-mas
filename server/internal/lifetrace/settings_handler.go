package lifetrace

import (
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"
	"valley-server/internal/database"
	"valley-server/internal/model"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type updateSettingsRequest struct {
	ActivePantryHouseholdID string   `json:"activePantryHouseholdId"`
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
	PantryReminderEnabled   bool     `json:"pantryReminderEnabled"`
	PantryReminderRules     []string `json:"pantryReminderRules"`
	PantryReminderTime      string   `json:"pantryReminderTime"`
	SubscriptionReminderEnabled bool     `json:"subscriptionReminderEnabled"`
	SubscriptionReminderRules   []string `json:"subscriptionReminderRules"`
	SubscriptionReminderTime    string   `json:"subscriptionReminderTime"`
	PantryListStatusFilter      string   `json:"pantryListStatusFilter"`
	PantryListCategoryFilter    string   `json:"pantryListCategoryFilter"`
	PantryListSortMode          string   `json:"pantryListSortMode"`
}

var errPreferredPantryHouseholdInaccessible = errors.New("preferred pantry household inaccessible")

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
		PantryReminderEnabled:   true,
		PantryReminderRules:     model.StringList{"7d", "3d", "same-day", "expired"},
		PantryReminderTime:      "09:00",
		SubscriptionReminderEnabled: true,
		SubscriptionReminderRules:   model.StringList{"7d", "3d", "same-day", "overdue"},
		SubscriptionReminderTime:    "09:00",
		PantryListStatusFilter:      "all",
		PantryListCategoryFilter:    "all",
		PantryListSortMode:          "expiry-asc",
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
	if value == "" || !isValidClockText(value) {
		return fallback
	}
	return value
}

func isValidClockText(value string) bool {
	_, err := time.Parse("15:04", strings.TrimSpace(value))
	return err == nil
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

var validPantryReminderRules = map[string]bool{
	"7d":       true,
	"3d":       true,
	"same-day": true,
	"expired":  true,
}

func normalizePantryReminderRules(rules []string) model.StringList {
	seen := map[string]bool{}
	result := model.StringList{}
	for _, rule := range rules {
		rule = strings.TrimSpace(rule)
		if !validPantryReminderRules[rule] || seen[rule] {
			continue
		}
		seen[rule] = true
		result = append(result, rule)
	}
	if len(result) == 0 {
		return model.StringList{"7d", "3d", "same-day", "expired"}
	}
	return result
}

var validSubscriptionReminderRules = map[string]bool{
	"7d":       true,
	"3d":       true,
	"same-day": true,
	"overdue":  true,
}

func normalizeSubscriptionReminderRules(rules []string) model.StringList {
	seen := map[string]bool{}
	result := model.StringList{}
	for _, rule := range rules {
		rule = strings.TrimSpace(rule)
		if !validSubscriptionReminderRules[rule] || seen[rule] {
			continue
		}
		seen[rule] = true
		result = append(result, rule)
	}
	if len(result) == 0 {
		return model.StringList{"7d", "3d", "same-day", "overdue"}
	}
	return result
}

var validPantryListStatusFilters = map[string]bool{
	"all":       true,
	"normal":    true,
	"expiring":  true,
	"expired":   true,
	"no-expiry": true,
	"used-up":   true,
	"discarded": true,
}

func normalizePantryListStatusFilter(value string) string {
	value = strings.TrimSpace(value)
	if !validPantryListStatusFilters[value] {
		return "all"
	}
	return value
}

func normalizePantryListCategoryFilter(value string) string {
	value = strings.TrimSpace(value)
	if value == "all" {
		return "all"
	}
	if !validPantryCategories[value] {
		return "all"
	}
	return value
}

func normalizePantryListSortMode(value string) string {
	value = strings.TrimSpace(value)
	if !validPantrySorts[value] {
		return "expiry-asc"
	}
	return value
}

func resolvePreferredPantryHouseholdID(userID model.Int64String, raw string) (model.Int64String, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return 0, nil
	}

	value, err := strconv.ParseInt(raw, 10, 64)
	if err != nil || value <= 0 {
		return 0, fmt.Errorf("%w: invalid id", errPreferredPantryHouseholdInaccessible)
	}

	preferredID := model.Int64String(value)
	if preferredID == personalHouseholdID(userID) {
		return 0, nil
	}

	var household model.Household
	if err := database.GetDB().
		Where("id = ? AND status = ?", preferredID, householdStatusActive).
		First(&household).Error; err != nil {
		return 0, fmt.Errorf("%w: household not active", errPreferredPantryHouseholdInaccessible)
	}

	var member model.HouseholdMember
	if err := database.GetDB().
		Where("household_id = ? AND user_id = ? AND status = ?", preferredID, userID, householdMemberStatusActive).
		First(&member).Error; err != nil {
		return 0, fmt.Errorf("%w: member not active", errPreferredPantryHouseholdInaccessible)
	}

	return preferredID, nil
}

func applySettingsRequest(settings *model.LifeTraceSettings, req updateSettingsRequest) error {
	activePantryHouseholdID, err := resolvePreferredPantryHouseholdID(
		settings.UserID,
		req.ActivePantryHouseholdID,
	)
	if err != nil {
		return err
	}
	settings.ActivePantryHouseholdID = activePantryHouseholdID
	settings.City = normalizeText(req.City, "上海")
	settings.WorkStart = normalizeTimeText(req.WorkStart, "09:30")
	settings.WorkEnd = normalizeTimeText(req.WorkEnd, "18:30")
	settings.CommuteMethod = normalizeCommuteMethod(req.CommuteMethod)
	settings.DailyBriefTime = normalizeTimeText(req.DailyBriefTime, "08:10")
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
	settings.PantryReminderEnabled = req.PantryReminderEnabled
	settings.PantryReminderRules = normalizePantryReminderRules(req.PantryReminderRules)
	settings.PantryReminderTime = normalizeTimeText(req.PantryReminderTime, "09:00")
	settings.SubscriptionReminderEnabled = req.SubscriptionReminderEnabled
	settings.SubscriptionReminderRules = normalizeSubscriptionReminderRules(req.SubscriptionReminderRules)
	settings.SubscriptionReminderTime = normalizeTimeText(req.SubscriptionReminderTime, "09:00")
	settings.PantryListStatusFilter = normalizePantryListStatusFilter(req.PantryListStatusFilter)
	settings.PantryListCategoryFilter = normalizePantryListCategoryFilter(req.PantryListCategoryFilter)
	settings.PantryListSortMode = normalizePantryListSortMode(req.PantryListSortMode)
	return nil
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

	if err := applySettingsRequest(&settings, req); err != nil {
		if errors.Is(err, errPreferredPantryHouseholdInaccessible) {
			fail(c, http.StatusForbidden, "家庭空间不存在或不可访问")
			return
		}
		fail(c, http.StatusInternalServerError, "保存偏好失败")
		return
	}
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
