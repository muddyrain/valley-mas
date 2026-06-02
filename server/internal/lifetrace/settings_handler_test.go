package lifetrace

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"
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
	habits := settings["habits"].([]interface{})
	if len(habits) != 4 || habits[0] != "喝水" {
		t.Fatalf("expected default habits, got %+v", habits)
	}
	pantryRules := settings["pantryReminderRules"].([]interface{})
	if settings["pantryReminderEnabled"] != true || settings["pantryReminderTime"] != "09:00" {
		t.Fatalf("expected default pantry reminder settings, got %+v", settings)
	}
	if len(pantryRules) != 4 || pantryRules[0] != "7d" {
		t.Fatalf("expected default pantry reminder rules, got %+v", pantryRules)
	}
}

func TestUpdateSettingsPersistsCurrentUserPreferences(t *testing.T) {
	router := setupTraceTestRouter(t, 101)

	body := bytes.NewBufferString(`{
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
		"habits": ["喝水", "早睡", "喝水"],
		"pantryReminderEnabled": true,
		"pantryReminderRules": ["3d", "same-day", "same-day"],
		"pantryReminderTime": "08:45"
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
	habits := settings["habits"].([]interface{})
	if len(habits) != 2 || habits[1] != "早睡" {
		t.Fatalf("expected deduplicated habits, got %+v", habits)
	}
	pantryRules := settings["pantryReminderRules"].([]interface{})
	if len(pantryRules) != 2 || pantryRules[0] != "3d" {
		t.Fatalf("expected pantry reminder rules to persist, got %+v", pantryRules)
	}
	if settings["pantryReminderTime"] != "08:45" {
		t.Fatalf("expected pantry reminder time to persist, got %+v", settings)
	}

	getReq := httptest.NewRequest(http.MethodGet, "/api/v1/life-trace/settings", nil)
	getResp := httptest.NewRecorder()
	router.ServeHTTP(getResp, getReq)

	persisted := decodeTracePayload(t, getResp)["data"].(map[string]interface{})
	if persisted["city"] != "杭州" || persisted["workStart"] != "10:00" || persisted["pantryReminderTime"] != "08:45" {
		t.Fatalf("expected settings to persist, got %+v", persisted)
	}
}
