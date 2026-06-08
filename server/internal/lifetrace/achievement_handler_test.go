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

func TestListAchievementsReturnsLockedStateForNewUser(t *testing.T) {
	router := setupTraceTestRouter(t, 101)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/life-trace/achievements", nil)
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	data := decodeTracePayload(t, resp)["data"].(map[string]interface{})
	summary := data["summary"].(map[string]interface{})
	if summary["unlocked"].(float64) != 0 || summary["total"].(float64) != 20 {
		t.Fatalf("expected locked achievement set, got %+v", summary)
	}
	list := data["list"].([]interface{})
	if len(list) != 20 {
		t.Fatalf("expected 20 definitions, got %d", len(list))
	}
	first := findAchievementCard(t, list, "first_plan")
	if first["unlocked"].(bool) {
		t.Fatalf("expected first_plan to be locked, got %+v", first)
	}
}

func TestAchievementsUnlockFromLifeTraceActions(t *testing.T) {
	router := setupTraceTestRouter(t, 101)

	planBody := bytes.NewBufferString(`{
		"title": "今天散步",
		"type": "运动",
		"timeLabel": "今天 19:00",
		"scheduledDate": "2026-05-29",
		"scheduledTime": "19:00",
		"timezone": "Asia/Shanghai",
		"reminder": true,
		"source": "manual"
	}`)
	createPlanReq := httptest.NewRequest(http.MethodPost, "/api/v1/life-trace/plans", planBody)
	createPlanReq.Header.Set("Content-Type", "application/json")
	createPlanResp := httptest.NewRecorder()
	router.ServeHTTP(createPlanResp, createPlanReq)
	createdPlan := decodeTracePayload(t, createPlanResp)["data"].(map[string]interface{})
	planID := createdPlan["id"].(string)

	completeReq := httptest.NewRequest(http.MethodPatch, "/api/v1/life-trace/plans/"+planID+"/status", bytes.NewBufferString(`{"completed":true}`))
	completeReq.Header.Set("Content-Type", "application/json")
	completeResp := httptest.NewRecorder()
	router.ServeHTTP(completeResp, completeReq)

	traceBody := bytes.NewBufferString(`{
		"title": "散步结束",
		"summary": "今天绕着小区走了一圈，风很舒服，整个人也慢慢安静下来。",
		"timeLabel": "今天 20:00",
		"mood": "放松",
		"source": "手动"
	}`)
	traceReq := httptest.NewRequest(http.MethodPost, "/api/v1/life-trace/traces", traceBody)
	traceReq.Header.Set("Content-Type", "application/json")
	traceResp := httptest.NewRecorder()
	router.ServeHTTP(traceResp, traceReq)

	pantryBody := bytes.NewBufferString(`{
		"name": "牛奶",
		"category": "食品",
		"quantity": 1,
		"unit": "盒",
		"location": "冷藏",
		"expiresAt": "2026-06-10",
		"reminder": {"enabled": true, "useDefault": true, "rules": ["7d"], "reminderTime": "09:00"}
	}`)
	pantryReq := httptest.NewRequest(http.MethodPost, "/api/v1/life-trace/pantry", pantryBody)
	pantryReq.Header.Set("Content-Type", "application/json")
	pantryResp := httptest.NewRecorder()
	router.ServeHTTP(pantryResp, pantryReq)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/life-trace/achievements", nil)
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	list := decodeTracePayload(t, resp)["data"].(map[string]interface{})["list"].([]interface{})
	for _, code := range []string{"first_plan", "first_plan_done", "first_trace", "first_pantry"} {
		card := findAchievementCard(t, list, code)
		if !card["unlocked"].(bool) {
			t.Fatalf("expected %s to unlock, got %+v", code, card)
		}
	}

	var count int64
	if err := database.GetDB().Model(&model.LifeTraceAchievement{}).
		Where("user_id = ? AND code = ?", model.Int64String(101), "first_plan").
		Count(&count).Error; err != nil {
		t.Fatalf("count achievements: %v", err)
	}
	if count != 1 {
		t.Fatalf("expected first_plan to be stored once, got %d", count)
	}
}

func TestAchievementsStayScopedToCurrentUserAndWeeklyReview(t *testing.T) {
	router := setupTraceTestRouter(t, 101)
	if err := database.GetDB().Create(&model.LifeTracePlan{
		UserID:    202,
		Title:     "其他用户计划",
		Type:      "运动",
		TimeLabel: "今天",
		Source:    "manual",
	}).Error; err != nil {
		t.Fatalf("seed other user plan: %v", err)
	}
	if err := database.GetDB().Create(&model.LifeTraceWeeklyReview{
		UserID:    101,
		WeekStart: "2026-06-01",
		WeekEnd:   "2026-06-07",
		Summary:   "本周有复盘。",
		Wins:      model.StringList{"完成一次复盘"},
		Delays:    model.StringList{},
		Insights:  model.StringList{},
		Source:    "test",
		CreatedAt: time.Now(),
	}).Error; err != nil {
		t.Fatalf("seed weekly review: %v", err)
	}

	req := httptest.NewRequest(http.MethodGet, "/api/v1/life-trace/achievements", nil)
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	list := decodeTracePayload(t, resp)["data"].(map[string]interface{})["list"].([]interface{})
	if findAchievementCard(t, list, "first_plan")["unlocked"].(bool) {
		t.Fatal("expected other user's plan not to unlock current user achievement")
	}
	weekly := findAchievementCard(t, list, "weekly_review")
	if !weekly["unlocked"].(bool) {
		t.Fatalf("expected weekly_review to unlock from current user review, got %+v", weekly)
	}
}

func findAchievementCard(t *testing.T, list []interface{}, code string) map[string]interface{} {
	t.Helper()
	for _, item := range list {
		card := item.(map[string]interface{})
		if card["code"] == code {
			return card
		}
	}
	t.Fatalf("missing achievement card %s", code)
	return nil
}
