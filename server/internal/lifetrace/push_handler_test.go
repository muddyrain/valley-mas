package lifetrace

import (
	"bytes"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
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

func TestScanPushRemindersRequiresCronSecretConfig(t *testing.T) {
	router := setupTraceTestRouter(t, 101, testWebPushConfig())
	req := httptest.NewRequest(http.MethodPost, "/api/v1/life-trace/push/scan", nil)
	req.Header.Set("X-Cron-Secret", "secret")
	resp := httptest.NewRecorder()

	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503 when cron secret is not configured, got %d", resp.Code)
	}
}

func TestScanPushRemindersRequiresMatchingCronSecret(t *testing.T) {
	cfg := testWebPushConfig()
	cfg.CronSecret = "expected-secret"
	router := setupTraceTestRouter(t, 101, cfg)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/life-trace/push/scan", nil)
	req.Header.Set("X-Cron-Secret", "wrong-secret")
	resp := httptest.NewRecorder()

	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 for wrong cron secret, got %d", resp.Code)
	}
}

func TestScanPushRemindersRunsWithCronSecret(t *testing.T) {
	cfg := testWebPushConfig()
	cfg.CronSecret = "expected-secret"
	cfg.ReminderWindowMin = 15
	router := setupTraceTestRouter(t, 101, cfg)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/life-trace/push/scan", nil)
	req.Header.Set("Authorization", "Bearer expected-secret")
	resp := httptest.NewRecorder()

	router.ServeHTTP(resp, req)

	data := decodeTracePayload(t, resp)["data"].(map[string]interface{})
	if data["scanned"] != true {
		t.Fatalf("expected scan success, got %+v", data)
	}
	if data["timezone"] != lifeTraceReminderTimezone {
		t.Fatalf("expected reminder timezone %s, got %+v", lifeTraceReminderTimezone, data)
	}
	if data["windowMinutes"] != float64(15) {
		t.Fatalf("expected configured reminder window, got %+v", data)
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

func TestPreviewDailyBriefPushBuildsPayload(t *testing.T) {
	router := setupTraceTestRouter(t, 101, testWebPushConfig())
	today := reminderNow().Format("2006-01-02")

	if err := database.GetDB().Create(&model.LifeTraceSettings{
		UserID:         101,
		City:           "杭州",
		DailyBriefTime: "08:10",
		WeatherAlerts:  true,
	}).Error; err != nil {
		t.Fatalf("seed settings: %v", err)
	}
	if err := database.GetDB().Create(&model.LifeTracePlan{
		UserID:        101,
		Title:         "晨间散步",
		Type:          "运动",
		ScheduledDate: today,
		ScheduledTime: "09:30",
		Reminder:      true,
	}).Error; err != nil {
		t.Fatalf("seed plan: %v", err)
	}

	req := httptest.NewRequest(http.MethodPost, "/api/v1/life-trace/push/daily-brief-preview", nil)
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	data := decodeTracePayload(t, resp)["data"].(map[string]interface{})
	if data["url"] != "/today" {
		t.Fatalf("expected daily brief preview to route to today, got %+v", data)
	}
	body := data["body"].(string)
	if body == "" || !strings.Contains(body, "晨间散步") {
		t.Fatalf("expected preview body to include plan summary, got %+v", data)
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

func TestPushVapidKeyInvalidDetectsJwtErrors(t *testing.T) {
	cases := []error{
		errors.New(`web push failed: {"reason":"BadJwtToken"}`),
		errors.New("invalid jwt signature"),
		errors.New("invalid token"),
		errors.New("vapid jwt rejected"),
	}

	for _, err := range cases {
		t.Run(err.Error(), func(t *testing.T) {
			if !isPushVapidKeyInvalid(err) {
				t.Fatalf("expected VAPID key diagnostic for %v", err)
			}
			if isPushSubscriptionInvalid(http.StatusForbidden, err) {
				t.Fatalf("expected VAPID key diagnostic to stay separate from subscription invalid")
			}
		})
	}
}

func TestMarkPushSubscriptionErrorDisablesExpiredSubscription(t *testing.T) {
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
		http.StatusGone,
		errors.New("subscription gone"),
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

func TestMarkPushSubscriptionErrorKeepsVapidJwtSubscriptionActive(t *testing.T) {
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
	if persisted.Status != "active" {
		t.Fatalf("expected subscription to stay active, got %s", persisted.Status)
	}
	if persisted.LastError == "" {
		t.Fatalf("expected last error to be persisted")
	}
}
