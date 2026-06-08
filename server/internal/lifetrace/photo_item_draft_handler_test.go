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

func decodePhotoItemDraftPayload(t *testing.T, recorder *httptest.ResponseRecorder) map[string]interface{} {
	t.Helper()

	var payload map[string]interface{}
	if err := json.Unmarshal(recorder.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode response: %v\nbody: %s", err, recorder.Body.String())
	}
	if payload["code"].(float64) != 0 {
		t.Fatalf("expected success response, got %+v", payload)
	}
	return payload
}

func TestPhotoItemDraftCloudSyncAndList(t *testing.T) {
	router := setupTraceTestRouter(t, 101)

	body := []byte(`{
		"items": [
			{
				"id": "photo-item-local-1",
				"imageUrl": "https://example.test/bottle.jpg",
				"analysis": {"name": "气泡水"},
				"form": {"name": "气泡水"},
				"status": "draft",
				"createdAt": "2026-06-01T00:00:00.000Z",
				"updatedAt": "2026-06-01T00:00:00.000Z"
			}
		]
	}`)
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/api/v1/life-trace/pantry/photo-drafts/sync", bytes.NewReader(body))
	request.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(recorder, request)
	payload := decodePhotoItemDraftPayload(t, recorder)

	data := payload["data"].(map[string]interface{})
	if data["synced"].(float64) != 1 {
		t.Fatalf("expected one synced draft, got %+v", data)
	}

	recorder = httptest.NewRecorder()
	request = httptest.NewRequest(http.MethodGet, "/api/v1/life-trace/pantry/photo-drafts", nil)
	router.ServeHTTP(recorder, request)
	payload = decodePhotoItemDraftPayload(t, recorder)

	data = payload["data"].(map[string]interface{})
	list := data["list"].([]interface{})
	if len(list) != 1 {
		t.Fatalf("expected one draft, got %d", len(list))
	}
	item := list[0].(map[string]interface{})
	if item["id"] != "photo-item-local-1" || item["imageUrl"] != "https://example.test/bottle.jpg" {
		t.Fatalf("unexpected draft payload: %+v", item)
	}
}

func TestPhotoItemDraftDeleteIsScopedToCurrentUser(t *testing.T) {
	router := setupTraceTestRouter(t, 101)
	if err := database.GetDB().Create(&model.LifeTracePhotoItemDraft{
		UserID:  202,
		DraftID: "photo-item-shared-id",
		Status:  "draft",
		Payload: `{"id":"photo-item-shared-id","status":"draft"}`,
	}).Error; err != nil {
		t.Fatalf("seed other user draft: %v", err)
	}

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodDelete, "/api/v1/life-trace/pantry/photo-drafts/photo-item-shared-id", nil)
	router.ServeHTTP(recorder, request)
	decodePhotoItemDraftPayload(t, recorder)

	var count int64
	if err := database.GetDB().
		Model(&model.LifeTracePhotoItemDraft{}).
		Where("user_id = ? AND draft_id = ?", 202, "photo-item-shared-id").
		Count(&count).Error; err != nil {
		t.Fatalf("count other user draft: %v", err)
	}
	if count != 1 {
		t.Fatalf("expected other user's draft to remain, got %d", count)
	}
}
