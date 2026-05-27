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
	habits := settings["habits"].([]interface{})
	if len(habits) != 4 || habits[0] != "喝水" {
		t.Fatalf("expected default habits, got %+v", habits)
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
		"weatherAlerts": false,
		"planReminders": true,
		"aiPersonalization": false,
		"habits": ["喝水", "早睡", "喝水"]
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
	habits := settings["habits"].([]interface{})
	if len(habits) != 2 || habits[1] != "早睡" {
		t.Fatalf("expected deduplicated habits, got %+v", habits)
	}

	getReq := httptest.NewRequest(http.MethodGet, "/api/v1/life-trace/settings", nil)
	getResp := httptest.NewRecorder()
	router.ServeHTTP(getResp, getReq)

	persisted := decodeTracePayload(t, getResp)["data"].(map[string]interface{})
	if persisted["city"] != "杭州" || persisted["workStart"] != "10:00" {
		t.Fatalf("expected settings to persist, got %+v", persisted)
	}
}
