package lifetrace

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestCreatePlanPersistsStructuredSchedule(t *testing.T) {
	router := setupTraceTestRouter(t, 101)

	body := bytes.NewBufferString(`{
		"title": "周六看电影",
		"type": "电影",
		"timeLabel": "周六 20:00",
		"scheduledDate": "2026-05-30",
		"scheduledTime": "20:00",
		"timezone": "Asia/Shanghai",
		"reminder": true,
		"note": "提前买票",
		"source": "manual"
	}`)
	createReq := httptest.NewRequest(http.MethodPost, "/api/v1/life-trace/plans", body)
	createReq.Header.Set("Content-Type", "application/json")
	createResp := httptest.NewRecorder()

	router.ServeHTTP(createResp, createReq)

	if createResp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", createResp.Code)
	}
	created := decodeTracePayload(t, createResp)["data"].(map[string]interface{})
	if created["scheduledDate"] != "2026-05-30" {
		t.Fatalf("expected scheduledDate to round-trip, got %+v", created)
	}
	if created["scheduledTime"] != "20:00" {
		t.Fatalf("expected scheduledTime to round-trip, got %+v", created)
	}
	if created["timezone"] != "Asia/Shanghai" {
		t.Fatalf("expected timezone to round-trip, got %+v", created)
	}

	listReq := httptest.NewRequest(http.MethodGet, "/api/v1/life-trace/plans", nil)
	listResp := httptest.NewRecorder()
	router.ServeHTTP(listResp, listReq)

	list := decodeTracePayload(t, listResp)["data"].(map[string]interface{})["list"].([]interface{})
	if len(list) != 1 {
		t.Fatalf("expected one plan, got %+v", list)
	}
	plan := list[0].(map[string]interface{})
	if plan["scheduledDate"] != "2026-05-30" || plan["scheduledTime"] != "20:00" {
		t.Fatalf("expected listed plan schedule to round-trip, got %+v", plan)
	}
}

func TestCreatePlanRejectsPartialStructuredSchedule(t *testing.T) {
	router := setupTraceTestRouter(t, 101)

	body := bytes.NewBufferString(`{
		"title": "缺少时间",
		"type": "普通事项",
		"timeLabel": "今天 20:00",
		"scheduledDate": "2026-05-27",
		"reminder": true
	}`)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/life-trace/plans", body)
	req.Header.Set("Content-Type", "application/json")
	resp := httptest.NewRecorder()

	router.ServeHTTP(resp, req)

	var payload map[string]interface{}
	if err := json.Unmarshal(resp.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode response: %v\nbody: %s", err, resp.Body.String())
	}
	if payload["code"].(float64) == 0 {
		t.Fatalf("expected validation failure, got %+v", payload)
	}
}
