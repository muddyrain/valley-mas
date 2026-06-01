package lifetrace

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"valley-server/internal/config"
	"valley-server/internal/database"
	"valley-server/internal/model"
)

func testWebPushConfig() config.WebPushConfig {
	return config.WebPushConfig{
		Enabled:    true,
		PublicKey:  "public-key",
		PrivateKey: "private-key",
		Subject:    "mailto:test@example.com",
	}
}

func TestGetPushConfig(t *testing.T) {
	router := setupTraceTestRouter(t, 101, testWebPushConfig())
	req := httptest.NewRequest(http.MethodGet, "/api/v1/life-trace/push/config", nil)
	resp := httptest.NewRecorder()

	router.ServeHTTP(resp, req)

	data := decodeTracePayload(t, resp)["data"].(map[string]interface{})
	if data["enabled"] != true || data["publicKey"] != "public-key" {
		t.Fatalf("unexpected push config: %+v", data)
	}
}

func TestSavePushSubscriptionRequiresCompleteKeys(t *testing.T) {
	router := setupTraceTestRouter(t, 101, testWebPushConfig())
	req := httptest.NewRequest(
		http.MethodPut,
		"/api/v1/life-trace/push/subscription",
		bytes.NewBufferString(`{"endpoint":"https://push.example/device","keys":{"p256dh":"abc"}}`),
	)
	req.Header.Set("Content-Type", "application/json")
	resp := httptest.NewRecorder()

	router.ServeHTTP(resp, req)

	var payload map[string]interface{}
	if err := json.Unmarshal(resp.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if payload["code"] == float64(0) {
		t.Fatalf("expected validation error, got %+v", payload)
	}
}

func TestSavePushSubscriptionUpsertsByEndpoint(t *testing.T) {
	router := setupTraceTestRouter(t, 101, testWebPushConfig())
	body := bytes.NewBufferString(`{
		"endpoint": "https://push.example/device",
		"keys": {
			"p256dh": "p256dh-key",
			"auth": "auth-key"
		}
	}`)
	req := httptest.NewRequest(http.MethodPut, "/api/v1/life-trace/push/subscription", body)
	req.Header.Set("Content-Type", "application/json")
	resp := httptest.NewRecorder()

	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.Code)
	}
	data := decodeTracePayload(t, resp)["data"].(map[string]interface{})
	if data["endpoint"] != "https://push.example/device" || data["status"] != "active" {
		t.Fatalf("unexpected saved subscription: %+v", data)
	}

	var count int64
	if err := database.GetDB().Model(&model.LifeTracePushSubscription{}).Count(&count).Error; err != nil {
		t.Fatalf("count subscriptions: %v", err)
	}
	if count != 1 {
		t.Fatalf("expected one subscription, got %d", count)
	}
}
