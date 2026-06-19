package lifetrace

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"
	"time"
	"valley-server/internal/database"
	"valley-server/internal/model"
)

func TestNextRecurringDueDateAcrossFrequencies(t *testing.T) {
	cases := []struct {
		frequency string
		interval  int
		base      string
		want      string
	}{
		{"daily", 1, "2026-06-10", "2026-06-11"},
		{"daily", 3, "2026-06-10", "2026-06-13"},
		{"weekly", 1, "2026-06-10", "2026-06-17"},
		{"weekly", 2, "2026-06-10", "2026-06-24"},
		{"monthly", 1, "2026-06-10", "2026-07-10"},
		{"monthly", 2, "2026-06-10", "2026-08-10"},
		{"quarterly", 1, "2026-06-10", "2026-09-10"},
		{"half_year", 1, "2026-06-10", "2026-12-10"},
		{"yearly", 1, "2026-06-10", "2027-06-10"},
	}
	for _, tc := range cases {
		got, ok := nextRecurringDueDate(tc.frequency, tc.interval, tc.base)
		if !ok || got != tc.want {
			t.Fatalf("nextRecurringDueDate(%s, %d, %s) = %s,%v want %s",
				tc.frequency, tc.interval, tc.base, got, ok, tc.want)
		}
	}

	if _, ok := nextRecurringDueDate("monthly", 1, ""); ok {
		t.Fatalf("expected empty base to fail")
	}
	if _, ok := nextRecurringDueDate("unknown", 1, "2026-06-10"); ok {
		t.Fatalf("expected unknown frequency to fail")
	}
}

func TestResolveInitialNextDueAdvancesPastToday(t *testing.T) {
	now := time.Date(2026, 6, 18, 9, 0, 0, 0, time.UTC)

	if got := resolveInitialNextDue("2026-06-15", "monthly", 1, now); got != "2026-07-15" {
		t.Fatalf("expected initial due to advance past today, got %s", got)
	}
	if got := resolveInitialNextDue("2026-06-25", "monthly", 1, now); got != "2026-06-25" {
		t.Fatalf("expected future started_at to keep, got %s", got)
	}
	if got := resolveInitialNextDue("", "monthly", 1, now); got != "2026-06-18" {
		t.Fatalf("expected empty started_at to fall back to today, got %s", got)
	}
}

func TestBuildRecurringPaymentSummaryAggregatesMonthlyExpense(t *testing.T) {
	router := setupTraceTestRouter(t, 401)
	now := time.Date(2026, 6, 18, 9, 0, 0, 0, time.UTC)

	mustSeed := func(item model.LifeTraceRecurringPayment) {
		item.UserID = 401
		if err := database.GetDB().Create(&item).Error; err != nil {
			t.Fatalf("seed recurring payment: %v", err)
		}
	}

	mustSeed(model.LifeTraceRecurringPayment{
		Name: "月度会员", Category: "订阅", AmountCents: 2800, Direction: "支出",
		Frequency: "monthly", Interval: 1,
		StartedAt: "2026-05-01", NextDueAt: "2026-06-19",
	})
	mustSeed(model.LifeTraceRecurringPayment{
		Name: "周购牛奶", Category: "订阅", AmountCents: 5000, Direction: "支出",
		Frequency: "weekly", Interval: 1,
		StartedAt: "2026-05-01", NextDueAt: "2026-06-15",
	})
	mustSeed(model.LifeTraceRecurringPayment{
		Name: "已逾期", Category: "订阅", AmountCents: 1000, Direction: "支出",
		Frequency: "monthly", Interval: 1,
		StartedAt: "2026-04-01", NextDueAt: "2026-06-01",
	})
	mustSeed(model.LifeTraceRecurringPayment{
		Name: "年费会员", Category: "订阅", AmountCents: 36000, Direction: "支出",
		Frequency: "yearly", Interval: 1,
		StartedAt: "2026-01-01", NextDueAt: "2027-01-01",
	})
	mustSeed(model.LifeTraceRecurringPayment{
		Name: "工资", Category: "订阅", AmountCents: 100000, Direction: "收入",
		Frequency: "monthly", Interval: 1,
		StartedAt: "2026-05-01", NextDueAt: "2026-06-30",
	})
	mustSeed(model.LifeTraceRecurringPayment{
		Name: "归档项", Category: "订阅", AmountCents: 999, Direction: "支出",
		Frequency: "monthly", Interval: 1,
		StartedAt: "2026-01-01", NextDueAt: "2026-02-01",
		Archived: true,
	})

	summary, err := buildRecurringPaymentSummary(401, now)
	if err != nil {
		t.Fatalf("buildRecurringPaymentSummary: %v", err)
	}

	if summary.Total != 5 || summary.ActiveCount != 5 {
		t.Fatalf("unexpected total/active: %+v", summary)
	}
	if summary.OverdueCount != 2 {
		t.Fatalf("unexpected overdue count, got %+v", summary)
	}
	if summary.UpcomingCount != 1 {
		t.Fatalf("unexpected upcoming count, got %+v", summary)
	}
	expected := int64(2800) + int64(5000)*4 + int64(1000) + int64(36000)/12
	if summary.MonthlyExpense != expected {
		t.Fatalf("monthly expense expected %d, got %d", expected, summary.MonthlyExpense)
	}

	_ = router
}

func TestCreateRecurringPaymentValidatesAmountAndCategory(t *testing.T) {
	router := setupTraceTestRouter(t, 402)

	body := bytes.NewBufferString(`{
		"name": "免费试用",
		"category": "订阅",
		"amount": 0,
		"direction": "支出",
		"frequency": "monthly",
		"interval": 1,
		"startedAt": "2026-06-01",
		"reminder": {"enabled": true, "useDefault": true, "rules": ["3d"], "reminderTime": "09:00"}
	}`)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/life-trace/recurring-payments", body)
	req.Header.Set("Content-Type", "application/json")
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	payload := decodeTraceErrorPayload(t, resp)
	if payload["message"] != "订阅金额不正确" {
		t.Fatalf("expected amount validation message, got %+v", payload)
	}

	body = bytes.NewBufferString(`{
		"name": "  ",
		"category": "订阅",
		"amount": 12,
		"direction": "支出",
		"frequency": "monthly",
		"interval": 1,
		"startedAt": "2026-06-01"
	}`)
	req = httptest.NewRequest(http.MethodPost, "/api/v1/life-trace/recurring-payments", body)
	req.Header.Set("Content-Type", "application/json")
	resp = httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	payload = decodeTraceErrorPayload(t, resp)
	if payload["message"] != "订阅名称不能为空" {
		t.Fatalf("expected name validation message, got %+v", payload)
	}

	body = bytes.NewBufferString(`{
		"name": "网易云会员",
		"category": "订阅",
		"amount": 12,
		"direction": "借款",
		"frequency": "monthly",
		"interval": 1,
		"startedAt": "2026-06-01"
	}`)
	req = httptest.NewRequest(http.MethodPost, "/api/v1/life-trace/recurring-payments", body)
	req.Header.Set("Content-Type", "application/json")
	resp = httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	payload = decodeTraceErrorPayload(t, resp)
	if payload["message"] != "订阅方向不正确" {
		t.Fatalf("expected direction validation message, got %+v", payload)
	}
}

func TestAdvanceRecurringPaymentArchivesPastEndAt(t *testing.T) {
	router := setupTraceTestRouter(t, 403)

	endAt := "2026-06-30"
	item := model.LifeTraceRecurringPayment{
		UserID:      403,
		Name:        "限时订阅",
		Category:    "订阅",
		AmountCents: 1000,
		Direction:   "支出",
		Frequency:   "monthly",
		Interval:    1,
		StartedAt:   "2026-05-15",
		NextDueAt:   "2026-06-15",
		EndAt:       &endAt,
	}
	if err := database.GetDB().Create(&item).Error; err != nil {
		t.Fatalf("seed limited subscription: %v", err)
	}

	url := "/api/v1/life-trace/recurring-payments/" + strconv.FormatInt(int64(item.ID), 10) + "/advance"
	req := httptest.NewRequest(http.MethodPost, url, nil)
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	data := decodeTracePayload(t, resp)["data"].(map[string]interface{})
	if data["archived"] != true {
		t.Fatalf("expected advance past end_at to archive, got %+v", data)
	}
	if data["canceledAt"] == nil || data["canceledAt"] == "" {
		t.Fatalf("expected canceledAt to be set, got %+v", data["canceledAt"])
	}
}

func TestAdvanceRecurringPaymentMovesNextDueAt(t *testing.T) {
	router := setupTraceTestRouter(t, 404)

	item := model.LifeTraceRecurringPayment{
		UserID:      404,
		Name:        "云存储",
		Category:    "订阅",
		AmountCents: 2000,
		Direction:   "支出",
		Frequency:   "monthly",
		Interval:    1,
		StartedAt:   "2026-05-15",
		NextDueAt:   "2026-06-15",
	}
	if err := database.GetDB().Create(&item).Error; err != nil {
		t.Fatalf("seed recurring payment: %v", err)
	}

	url := "/api/v1/life-trace/recurring-payments/" + strconv.FormatInt(int64(item.ID), 10) + "/advance"
	req := httptest.NewRequest(http.MethodPost, url, nil)
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	data := decodeTracePayload(t, resp)["data"].(map[string]interface{})
	if data["archived"] != false {
		t.Fatalf("expected not archived, got %+v", data)
	}
	if data["nextDueAt"] != "2026-07-15" {
		t.Fatalf("expected nextDueAt to be 2026-07-15, got %+v", data["nextDueAt"])
	}
}
