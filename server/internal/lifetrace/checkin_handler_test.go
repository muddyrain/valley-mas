package lifetrace

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestToggleAndListCheckinsForCurrentUser(t *testing.T) {
	router := setupTraceTestRouter(t, 101)

	body := bytes.NewBufferString(`{
		"date": "2026-05-28",
		"name": "喝水",
		"completed": true
	}`)
	toggleReq := httptest.NewRequest(http.MethodPut, "/api/v1/life-trace/checkins", body)
	toggleReq.Header.Set("Content-Type", "application/json")
	toggleResp := httptest.NewRecorder()
	router.ServeHTTP(toggleResp, toggleReq)

	created := decodeTracePayload(t, toggleResp)["data"].(map[string]interface{})
	if created["name"] != "喝水" || created["completed"] != true {
		t.Fatalf("expected completed checkin, got %+v", created)
	}

	listReq := httptest.NewRequest(http.MethodGet, "/api/v1/life-trace/checkins?date=2026-05-28", nil)
	listResp := httptest.NewRecorder()
	router.ServeHTTP(listResp, listReq)

	list := decodeTracePayload(t, listResp)["data"].(map[string]interface{})["list"].([]interface{})
	if len(list) != 1 {
		t.Fatalf("expected one checkin, got %+v", list)
	}
}

func TestToggleCheckinCanUndoCompletion(t *testing.T) {
	router := setupTraceTestRouter(t, 101)

	completeBody := bytes.NewBufferString(`{
		"date": "2026-05-28",
		"name": "休息",
		"completed": true
	}`)
	completeReq := httptest.NewRequest(http.MethodPut, "/api/v1/life-trace/checkins", completeBody)
	completeReq.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(httptest.NewRecorder(), completeReq)

	undoBody := bytes.NewBufferString(`{
		"date": "2026-05-28",
		"name": "休息",
		"completed": false
	}`)
	undoReq := httptest.NewRequest(http.MethodPut, "/api/v1/life-trace/checkins", undoBody)
	undoReq.Header.Set("Content-Type", "application/json")
	undoResp := httptest.NewRecorder()
	router.ServeHTTP(undoResp, undoReq)

	updated := decodeTracePayload(t, undoResp)["data"].(map[string]interface{})
	if updated["completed"] != false {
		t.Fatalf("expected undone checkin, got %+v", updated)
	}
}
