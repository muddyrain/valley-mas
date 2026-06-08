package lifetrace

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"
	"valley-server/internal/database"
	"valley-server/internal/model"
)

func TestAIActionCreateAndListStoresForCurrentUser(t *testing.T) {
	router := setupTraceTestRouter(t, 101)

	createReq := httptest.NewRequest(
		http.MethodPost,
		"/api/v1/life-trace/ai/actions",
		bytes.NewBufferString(`{"title":"生成了今日生活建议","actionType":"advice"}`),
	)
	createReq.Header.Set("Content-Type", "application/json")
	createResp := httptest.NewRecorder()
	router.ServeHTTP(createResp, createReq)

	if createResp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", createResp.Code, createResp.Body.String())
	}
	created := decodeTracePayload(t, createResp)["data"].(map[string]interface{})
	if created["title"] != "生成了今日生活建议" || created["actionType"] != "advice" {
		t.Fatalf("unexpected created action: %+v", created)
	}
	if created["timeLabel"] == "" {
		t.Fatalf("expected time label, got %+v", created)
	}

	listReq := httptest.NewRequest(http.MethodGet, "/api/v1/life-trace/ai/actions", nil)
	listResp := httptest.NewRecorder()
	router.ServeHTTP(listResp, listReq)

	list := decodeTracePayload(t, listResp)["data"].(map[string]interface{})["list"].([]interface{})
	if len(list) != 1 {
		t.Fatalf("expected one action, got %+v", list)
	}
	action := list[0].(map[string]interface{})
	if action["title"] != "生成了今日生活建议" || action["actionType"] != "advice" {
		t.Fatalf("unexpected listed action: %+v", action)
	}
}

func TestAIActionListOnlyReturnsCurrentUserActions(t *testing.T) {
	router := setupTraceTestRouter(t, 101)

	if err := database.GetDB().Create(&model.LifeTraceAIAction{
		UserID:     202,
		Title:      "不应该出现",
		ActionType: "chat",
	}).Error; err != nil {
		t.Fatalf("seed other action: %v", err)
	}

	req := httptest.NewRequest(http.MethodGet, "/api/v1/life-trace/ai/actions", nil)
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	list := decodeTracePayload(t, resp)["data"].(map[string]interface{})["list"].([]interface{})
	if len(list) != 0 {
		t.Fatalf("expected no current user actions, got %+v", list)
	}
}

func TestAIActionRejectsEmptyTitle(t *testing.T) {
	router := setupTraceTestRouter(t, 101)

	req := httptest.NewRequest(
		http.MethodPost,
		"/api/v1/life-trace/ai/actions",
		bytes.NewBufferString(`{"title":"   "}`),
	)
	req.Header.Set("Content-Type", "application/json")
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	payload := decodeTraceErrorPayload(t, resp)
	if payload["code"] != float64(http.StatusBadRequest) {
		t.Fatalf("expected business 400, got %+v", payload)
	}
}
