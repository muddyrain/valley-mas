package lifetrace

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
	"valley-server/internal/database"
	"valley-server/internal/model"
)

func TestCreateAndListLedgerEntriesWithMonthlySummary(t *testing.T) {
	router := setupTraceTestRouter(t, 101)

	body := bytes.NewBufferString(`{
		"amount": 68.5,
		"currency": "CNY",
		"direction": "支出",
		"category": "吃饭",
		"occurredAt": "2026-06-08T12:30:00+08:00",
		"merchant": "小面馆",
		"location": "徐汇",
		"note": "午饭",
		"imageUrl": "https://example.com/receipt.jpg"
	}`)
	createReq := httptest.NewRequest(http.MethodPost, "/api/v1/life-trace/ledger", body)
	createReq.Header.Set("Content-Type", "application/json")
	createResp := httptest.NewRecorder()

	router.ServeHTTP(createResp, createReq)

	created := decodeTracePayload(t, createResp)["data"].(map[string]interface{})
	if created["amount"] != float64(68.5) || created["amountCents"] != float64(6850) {
		t.Fatalf("expected amount to round-trip as yuan and cents, got %+v", created)
	}
	if created["currency"] != "CNY" || created["direction"] != "支出" || created["category"] != "吃饭" {
		t.Fatalf("unexpected created ledger entry: %+v", created)
	}

	listReq := httptest.NewRequest(http.MethodGet, "/api/v1/life-trace/ledger?month=2026-06&page=1&pageSize=10", nil)
	listResp := httptest.NewRecorder()
	router.ServeHTTP(listResp, listReq)

	data := decodeTracePayload(t, listResp)["data"].(map[string]interface{})
	list := data["list"].([]interface{})
	if len(list) != 1 {
		t.Fatalf("expected one ledger entry, got %+v", list)
	}
	summary := data["summary"].(map[string]interface{})
	if summary["expenseCents"] != float64(6850) || summary["incomeCents"] != float64(0) {
		t.Fatalf("unexpected monthly summary: %+v", summary)
	}
	categories := summary["categories"].([]interface{})
	if len(categories) != 1 {
		t.Fatalf("expected one category summary, got %+v", categories)
	}
	category := categories[0].(map[string]interface{})
	if category["category"] != "吃饭" || category["amountCents"] != float64(6850) {
		t.Fatalf("unexpected category summary: %+v", category)
	}
}

func TestListLedgerEntriesOnlyReturnsCurrentUserData(t *testing.T) {
	router := setupTraceTestRouter(t, 101)
	occurredAt := time.Date(2026, 6, 8, 12, 0, 0, 0, time.FixedZone("CST", 8*60*60))
	if err := database.GetDB().Create(&model.LifeTraceLedgerEntry{
		UserID:      202,
		AmountCents: 1200,
		Currency:    "CNY",
		Direction:   "支出",
		Category:    "交通",
		OccurredAt:  occurredAt,
		Merchant:    "别人的打车",
	}).Error; err != nil {
		t.Fatalf("seed other user ledger entry: %v", err)
	}

	req := httptest.NewRequest(http.MethodGet, "/api/v1/life-trace/ledger?month=2026-06", nil)
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	data := decodeTracePayload(t, resp)["data"].(map[string]interface{})
	list := data["list"].([]interface{})
	if len(list) != 0 {
		t.Fatalf("expected no current user ledger entries, got %+v", list)
	}
	summary := data["summary"].(map[string]interface{})
	if summary["expenseCents"] != float64(0) {
		t.Fatalf("expected other user amount to be excluded, got %+v", summary)
	}
}

func TestLedgerEntryValidationRejectsInvalidAmountCategoryAndDirection(t *testing.T) {
	router := setupTraceTestRouter(t, 101)

	body := bytes.NewBufferString(`{
		"amount": 0,
		"direction": "借款",
		"category": "乱填",
		"occurredAt": "2026-06-08T12:30:00+08:00"
	}`)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/life-trace/ledger", body)
	req.Header.Set("Content-Type", "application/json")
	resp := httptest.NewRecorder()

	router.ServeHTTP(resp, req)

	payload := decodeTraceErrorPayload(t, resp)
	if payload["message"] != "账目金额不正确" {
		t.Fatalf("expected amount validation message, got %+v", payload)
	}

	body = bytes.NewBufferString(`{
		"amount": 12,
		"direction": "借款",
		"category": "乱填",
		"occurredAt": "2026-06-08T12:30:00+08:00"
	}`)
	req = httptest.NewRequest(http.MethodPost, "/api/v1/life-trace/ledger", body)
	req.Header.Set("Content-Type", "application/json")
	resp = httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	payload = decodeTraceErrorPayload(t, resp)
	if payload["message"] != "账目方向不正确" {
		t.Fatalf("expected direction validation message, got %+v", payload)
	}
}

func TestUpdateAndDeleteLedgerEntry(t *testing.T) {
	router := setupTraceTestRouter(t, 101)

	createBody := bytes.NewBufferString(`{
		"amount": 32,
		"direction": "支出",
		"category": "购物",
		"occurredAt": "2026-06-08T12:30:00+08:00",
		"merchant": "便利店"
	}`)
	createReq := httptest.NewRequest(http.MethodPost, "/api/v1/life-trace/ledger", createBody)
	createReq.Header.Set("Content-Type", "application/json")
	createResp := httptest.NewRecorder()
	router.ServeHTTP(createResp, createReq)
	entryID := decodeTracePayload(t, createResp)["data"].(map[string]interface{})["id"].(string)

	updateBody := bytes.NewBufferString(`{
		"amount": 29.9,
		"currency": "CNY",
		"direction": "退款",
		"category": "购物",
		"occurredAt": "2026-06-09T09:00:00+08:00",
		"merchant": "便利店",
		"note": "退差价"
	}`)
	updateReq := httptest.NewRequest(http.MethodPatch, "/api/v1/life-trace/ledger/"+entryID, updateBody)
	updateReq.Header.Set("Content-Type", "application/json")
	updateResp := httptest.NewRecorder()
	router.ServeHTTP(updateResp, updateReq)

	updated := decodeTracePayload(t, updateResp)["data"].(map[string]interface{})
	if updated["amount"] != float64(29.9) || updated["direction"] != "退款" || updated["note"] != "退差价" {
		t.Fatalf("unexpected updated ledger entry: %+v", updated)
	}

	deleteReq := httptest.NewRequest(http.MethodDelete, "/api/v1/life-trace/ledger/"+entryID, nil)
	deleteResp := httptest.NewRecorder()
	router.ServeHTTP(deleteResp, deleteReq)

	deleted := decodeTracePayload(t, deleteResp)["data"].(map[string]interface{})
	if deleted["id"] != entryID {
		t.Fatalf("unexpected delete payload: %+v", deleted)
	}
}
