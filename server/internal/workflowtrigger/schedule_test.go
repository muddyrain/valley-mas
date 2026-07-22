package workflowtrigger

import (
	"testing"
	"time"
)

func TestParseUsesConfiguredTimezoneForNextRun(t *testing.T) {
	schedule, err := Parse("0 9 * * 1-5", "Asia/Shanghai")
	if err != nil {
		t.Fatal(err)
	}
	next := schedule.Next(time.Date(2026, time.July, 22, 0, 30, 0, 0, time.UTC))
	want := time.Date(2026, time.July, 22, 1, 0, 0, 0, time.UTC)
	if !next.Equal(want) {
		t.Fatalf("next=%s want=%s", next, want)
	}
}

func TestParseRejectsInlineTimezoneAndInvalidExpression(t *testing.T) {
	if _, err := Parse("CRON_TZ=UTC 0 9 * * *", "Asia/Shanghai"); err == nil {
		t.Fatal("expected inline timezone to be rejected")
	}
	if _, err := Parse("0 0", "Asia/Shanghai"); err == nil {
		t.Fatal("expected invalid expression to be rejected")
	}
}
