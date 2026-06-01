package lifetrace

import (
	"testing"
	"time"
	"valley-server/internal/model"

	webpush "github.com/SherClockHolmes/webpush-go"
)

func TestGenerateVAPIDKeys(t *testing.T) {
	privateKey, publicKey, err := webpush.GenerateVAPIDKeys()
	if err != nil {
		t.Fatalf("generate VAPID keys: %v", err)
	}
	if privateKey == "" || publicKey == "" {
		t.Fatal("expected generated VAPID keys")
	}
	t.Logf("WEB_PUSH_PUBLIC_KEY=%s", publicKey)
	t.Logf("WEB_PUSH_PRIVATE_KEY=%s", privateKey)
}

func TestParsePlanDueAtUsesPlanTimezone(t *testing.T) {
	dueAt, ok := parsePlanDueAt(model.LifeTracePlan{
		ScheduledDate: "2026-06-01",
		ScheduledTime: "08:30",
		Timezone:      "Asia/Shanghai",
	})
	if !ok {
		t.Fatal("expected valid due time")
	}

	location, err := time.LoadLocation("Asia/Shanghai")
	if err != nil {
		t.Fatalf("load timezone: %v", err)
	}
	expected := time.Date(2026, 6, 1, 8, 30, 0, 0, location)
	if !dueAt.Equal(expected) {
		t.Fatalf("expected %s, got %s", expected, dueAt)
	}
}
