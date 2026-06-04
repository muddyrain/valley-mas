package lifetrace

import (
	"bytes"
	"encoding/json"
	"errors"
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

func TestPushSubscriptionInvalidDetectsExpiredSubscriptionErrors(t *testing.T) {
	cases := []struct {
		name       string
		statusCode int
		err        error
	}{
		{
			name:       "forbidden",
			statusCode: http.StatusForbidden,
			err:        errors.New("web push rejected"),
		},
		{
			name:       "gone",
			statusCode: http.StatusGone,
			err:        errors.New("subscription gone"),
		},
		{
			name:       "bad jwt token",
			statusCode: http.StatusBadRequest,
			err:        errors.New(`web push failed: {"reason":"BadJwtToken"}`),
		},
		{
			name:       "expired subscription",
			statusCode: 0,
			err:        errors.New("ExpiredSubscription"),
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if !isPushSubscriptionInvalid(tc.statusCode, tc.err) {
				t.Fatalf("expected invalid subscription for status %d and error %v", tc.statusCode, tc.err)
			}
		})
	}
}

func TestMarkPushSubscriptionErrorDisablesInvalidJwtSubscription(t *testing.T) {
	_ = setupTraceTestRouter(t, 101, testWebPushConfig())
	subscription := model.LifeTracePushSubscription{
		UserID:   101,
		Endpoint: "https://push.example/device",
		P256DH:   "p256dh-key",
		Auth:     "auth-key",
		Status:   "active",
	}
	if err := database.GetDB().Create(&subscription).Error; err != nil {
		t.Fatalf("create subscription: %v", err)
	}

	markPushSubscriptionError(
		subscription.ID,
		http.StatusForbidden,
		errors.New(`web push failed: {"reason":"BadJwtToken"}`),
	)

	var persisted model.LifeTracePushSubscription
	if err := database.GetDB().First(&persisted, "id = ?", subscription.ID).Error; err != nil {
		t.Fatalf("read subscription: %v", err)
	}
	if persisted.Status != "disabled" {
		t.Fatalf("expected subscription to be disabled, got %s", persisted.Status)
	}
	if persisted.LastError == "" {
		t.Fatalf("expected last error to be persisted")
	}
}
