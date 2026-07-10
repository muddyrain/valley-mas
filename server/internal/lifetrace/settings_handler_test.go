package lifetrace

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"valley-server/internal/database"
	"valley-server/internal/model"
)

func TestGetSettingsCreatesDefaultForCurrentUser(t *testing.T) {
	router := setupTraceTestRouter(t, 101)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/life-trace/settings", nil)
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	payload := decodeTracePayload(t, resp)
	settings := payload["data"].(map[string]interface{})
	if settings["city"] != "上海" {
		t.Fatalf("expected default city 上海, got %+v", settings)
	}
	if settings["commuteMethod"] != "开车" {
		t.Fatalf("expected default commute method 开车, got %+v", settings)
	}
	if settings["workdayMode"] != "legal" || settings["planReminderLeadMinutes"] != float64(10) {
		t.Fatalf("expected default workday settings, got %+v", settings)
	}
	pantryRules := settings["pantryReminderRules"].([]interface{})
	if settings["pantryReminderEnabled"] != true || settings["pantryReminderTime"] != "09:00" {
		t.Fatalf("expected default pantry reminder settings, got %+v", settings)
	}
	if len(pantryRules) != 4 || pantryRules[0] != "7d" {
		t.Fatalf("expected default pantry reminder rules, got %+v", pantryRules)
	}
	if settings["activePantryHouseholdId"] != nil {
		t.Fatalf("expected default active pantry household id to be empty, got %+v", settings)
	}
	if settings["pantryListIncludeExpired"] != false {
		t.Fatalf("expected expired pantry items to be hidden by default, got %+v", settings)
	}
}

func decodeTraceFailurePayload(t *testing.T, recorder *httptest.ResponseRecorder) map[string]interface{} {
	t.Helper()

	var payload map[string]interface{}
	if err := json.Unmarshal(recorder.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode response: %v\nbody: %s", err, recorder.Body.String())
	}
	if payload["code"].(float64) == 0 {
		t.Fatalf("expected failure response, got %+v", payload)
	}
	return payload
}

func TestUpdateSettingsPersistsCurrentUserPreferences(t *testing.T) {
	router := setupTraceTestRouter(t, 101)
	sharedHousehold := model.Household{
		ID:          301,
		Name:        "开心家庭",
		Kind:        householdKindShared,
		OwnerUserID: 101,
		Status:      householdStatusActive,
	}
	sharedMember := model.HouseholdMember{
		HouseholdID: 301,
		UserID:      101,
		Role:        householdRoleOwner,
		Status:      householdMemberStatusActive,
	}
	if err := database.GetDB().Create(&sharedHousehold).Error; err != nil {
		t.Fatalf("create household failed: %v", err)
	}
	if err := database.GetDB().Create(&sharedMember).Error; err != nil {
		t.Fatalf("create household member failed: %v", err)
	}

	body := bytes.NewBufferString(`{
		"activePantryHouseholdId": "301",
		"city": "杭州",
		"workStart": "10:00",
		"workEnd": "19:00",
		"commuteMethod": "地铁",
		"dailyBriefTime": "08:40",
		"workdayMode": "custom",
		"workdays": ["1", "3", "5", "3"],
		"holidaySync": true,
		"weekendReminders": true,
		"planReminderLeadMinutes": 30,
		"quietStart": "23:00",
		"quietEnd": "07:45",
		"weatherAlerts": false,
		"planReminders": true,
		"aiPersonalization": false,
		"pantryReminderEnabled": true,
		"pantryReminderRules": ["3d", "same-day", "same-day"],
		"pantryReminderTime": "08:45",
		"pantryListIncludeExpired": true,
		"pantryListSortMode": "created-desc"
	}`)
	updateReq := httptest.NewRequest(http.MethodPut, "/api/v1/life-trace/settings", body)
	updateReq.Header.Set("Content-Type", "application/json")
	updateResp := httptest.NewRecorder()
	router.ServeHTTP(updateResp, updateReq)

	settings := decodeTracePayload(t, updateResp)["data"].(map[string]interface{})
	if settings["city"] != "杭州" {
		t.Fatalf("expected updated city 杭州, got %+v", settings)
	}
	if settings["commuteMethod"] != "地铁" {
		t.Fatalf("expected updated commute method 地铁, got %+v", settings)
	}
	if settings["weatherAlerts"] != false || settings["aiPersonalization"] != false {
		t.Fatalf("expected boolean preferences to persist, got %+v", settings)
	}
	if settings["workdayMode"] != "custom" || settings["planReminderLeadMinutes"] != float64(30) {
		t.Fatalf("expected reminder strategy to persist, got %+v", settings)
	}
	workdays := settings["workdays"].([]interface{})
	if len(workdays) != 3 || workdays[1] != "3" {
		t.Fatalf("expected deduplicated workdays, got %+v", workdays)
	}
	pantryRules := settings["pantryReminderRules"].([]interface{})
	if len(pantryRules) != 2 || pantryRules[0] != "3d" {
		t.Fatalf("expected pantry reminder rules to persist, got %+v", pantryRules)
	}
	if settings["pantryReminderTime"] != "08:45" {
		t.Fatalf("expected pantry reminder time to persist, got %+v", settings)
	}
	if settings["activePantryHouseholdId"] != "301" {
		t.Fatalf("expected active pantry household id to persist, got %+v", settings)
	}
	if settings["pantryListIncludeExpired"] != true || settings["pantryListSortMode"] != "created-desc" {
		t.Fatalf("expected pantry list preferences to persist, got %+v", settings)
	}

	getReq := httptest.NewRequest(http.MethodGet, "/api/v1/life-trace/settings", nil)
	getResp := httptest.NewRecorder()
	router.ServeHTTP(getResp, getReq)

	persisted := decodeTracePayload(t, getResp)["data"].(map[string]interface{})
	if persisted["city"] != "杭州" || persisted["workStart"] != "10:00" || persisted["pantryReminderTime"] != "08:45" || persisted["activePantryHouseholdId"] != "301" || persisted["pantryListIncludeExpired"] != true || persisted["pantryListSortMode"] != "created-desc" {
		t.Fatalf("expected settings to persist, got %+v", persisted)
	}
}

func TestUpdateSettingsPreservesExpiredPreferenceWhenOlderClientOmitsField(t *testing.T) {
	router := setupTraceTestRouter(t, 101)
	settings := defaultSettings(101)
	settings.PantryListIncludeExpired = true
	if err := database.GetDB().Create(&settings).Error; err != nil {
		t.Fatalf("seed settings: %v", err)
	}

	updateReq := httptest.NewRequest(http.MethodPut, "/api/v1/life-trace/settings", bytes.NewBufferString(`{}`))
	updateReq.Header.Set("Content-Type", "application/json")
	updateResp := httptest.NewRecorder()
	router.ServeHTTP(updateResp, updateReq)

	updated := decodeTracePayload(t, updateResp)["data"].(map[string]interface{})
	if updated["pantryListIncludeExpired"] != true {
		t.Fatalf("expected omitted expired preference to remain unchanged, got %+v", updated)
	}
}

func TestUpdateSettingsRejectsInaccessibleActivePantryHousehold(t *testing.T) {
	router := setupTraceTestRouter(t, 101)
	sharedHousehold := model.Household{
		ID:          301,
		Name:        "别人家",
		Kind:        householdKindShared,
		OwnerUserID: 202,
		Status:      householdStatusActive,
	}
	if err := database.GetDB().Create(&sharedHousehold).Error; err != nil {
		t.Fatalf("create household failed: %v", err)
	}

	body := bytes.NewBufferString(`{
		"activePantryHouseholdId": "301",
		"city": "杭州",
		"workStart": "09:30",
		"workEnd": "18:30",
		"commuteMethod": "开车",
		"dailyBriefTime": "08:10",
		"workdayMode": "legal",
		"workdays": ["1", "2", "3", "4", "5"],
		"holidaySync": true,
		"weekendReminders": false,
		"planReminderLeadMinutes": 10,
		"quietStart": "22:30",
		"quietEnd": "07:30",
		"weatherAlerts": true,
		"planReminders": true,
		"aiPersonalization": true,
		"pantryReminderEnabled": true,
		"pantryReminderRules": ["7d", "3d", "same-day", "expired"],
		"pantryReminderTime": "09:00"
	}`)
	updateReq := httptest.NewRequest(http.MethodPut, "/api/v1/life-trace/settings", body)
	updateReq.Header.Set("Content-Type", "application/json")
	updateResp := httptest.NewRecorder()
	router.ServeHTTP(updateResp, updateReq)

	payload := decodeTraceFailurePayload(t, updateResp)
	if payload["code"] != float64(http.StatusForbidden) || payload["message"] != "家庭空间不存在或不可访问" {
		t.Fatalf("expected inaccessible household failure, got %+v", payload)
	}

	getReq := httptest.NewRequest(http.MethodGet, "/api/v1/life-trace/settings", nil)
	getResp := httptest.NewRecorder()
	router.ServeHTTP(getResp, getReq)

	settings := decodeTracePayload(t, getResp)["data"].(map[string]interface{})
	if settings["activePantryHouseholdId"] != nil {
		t.Fatalf("expected inaccessible active household not to be silently persisted, got %+v", settings)
	}
}
