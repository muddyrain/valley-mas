package lifetrace

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestLegacyCheckinsReturnEmptyListForCachedClients(t *testing.T) {
	router := setupTraceTestRouter(t, 101)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/life-trace/checkins?date=2026-06-25", nil)
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", recorder.Code, recorder.Body.String())
	}
	payload := decodeTracePayload(t, recorder)
	data := payload["data"].(map[string]interface{})
	if data["date"] != "2026-06-25" {
		t.Fatalf("expected requested date, got %+v", data)
	}
	list := data["list"].([]interface{})
	if len(list) != 0 {
		t.Fatalf("expected empty legacy checkin list, got %+v", list)
	}
}

func TestLegacyCheckinsToggleIsNoopForCachedClients(t *testing.T) {
	router := setupTraceTestRouter(t, 101)

	body := strings.NewReader(`{"date":"2026-06-25","name":"喝水","completed":true}`)
	req := httptest.NewRequest(http.MethodPut, "/api/v1/life-trace/checkins", body)
	req.Header.Set("Content-Type", "application/json")
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", recorder.Code, recorder.Body.String())
	}
	payload := decodeTracePayload(t, recorder)
	data := payload["data"].(map[string]interface{})
	if data["date"] != "2026-06-25" || data["name"] != "喝水" || data["completed"] != true {
		t.Fatalf("expected no-op legacy checkin payload, got %+v", data)
	}
}
