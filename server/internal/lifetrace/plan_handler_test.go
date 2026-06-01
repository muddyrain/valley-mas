package lifetrace

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
	"valley-server/internal/database"
	"valley-server/internal/model"
)

func TestCreatePlanPersistsStructuredSchedule(t *testing.T) {
	router := setupTraceTestRouter(t, 101)

	body := bytes.NewBufferString(`{
		"title": "周六看电影",
		"type": "电影",
		"timeLabel": "周六 20:00",
		"scheduledDate": "2026-05-30",
		"scheduledTime": "20:00",
		"timezone": "Asia/Shanghai",
		"reminder": true,
		"note": "提前买票",
		"source": "manual"
	}`)
	createReq := httptest.NewRequest(http.MethodPost, "/api/v1/life-trace/plans", body)
	createReq.Header.Set("Content-Type", "application/json")
	createResp := httptest.NewRecorder()

	router.ServeHTTP(createResp, createReq)

	if createResp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", createResp.Code)
	}
	created := decodeTracePayload(t, createResp)["data"].(map[string]interface{})
	if created["scheduledDate"] != "2026-05-30" {
		t.Fatalf("expected scheduledDate to round-trip, got %+v", created)
	}
	if created["scheduledTime"] != "20:00" {
		t.Fatalf("expected scheduledTime to round-trip, got %+v", created)
	}
	if created["timezone"] != "Asia/Shanghai" {
		t.Fatalf("expected timezone to round-trip, got %+v", created)
	}

	listReq := httptest.NewRequest(http.MethodGet, "/api/v1/life-trace/plans", nil)
	listResp := httptest.NewRecorder()
	router.ServeHTTP(listResp, listReq)

	list := decodeTracePayload(t, listResp)["data"].(map[string]interface{})["list"].([]interface{})
	if len(list) != 1 {
		t.Fatalf("expected one plan, got %+v", list)
	}
	plan := list[0].(map[string]interface{})
	if plan["scheduledDate"] != "2026-05-30" || plan["scheduledTime"] != "20:00" {
		t.Fatalf("expected listed plan schedule to round-trip, got %+v", plan)
	}
}

func TestCreatePlanRejectsPartialStructuredSchedule(t *testing.T) {
	router := setupTraceTestRouter(t, 101)

	body := bytes.NewBufferString(`{
		"title": "缺少时间",
		"type": "普通事项",
		"timeLabel": "今天 20:00",
		"scheduledDate": "2026-05-27",
		"reminder": true
	}`)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/life-trace/plans", body)
	req.Header.Set("Content-Type", "application/json")
	resp := httptest.NewRecorder()

	router.ServeHTTP(resp, req)

	var payload map[string]interface{}
	if err := json.Unmarshal(resp.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode response: %v\nbody: %s", err, resp.Body.String())
	}
	if payload["code"].(float64) == 0 {
		t.Fatalf("expected validation failure, got %+v", payload)
	}
}

func TestCreatePlanPersistsReminderFalse(t *testing.T) {
	router := setupTraceTestRouter(t, 101)

	body := bytes.NewBufferString(`{
		"title": "不需要提醒的计划",
		"type": "普通事项",
		"timeLabel": "今天 21:00",
		"scheduledDate": "2026-05-29",
		"scheduledTime": "21:00",
		"timezone": "Asia/Shanghai",
		"reminder": false,
		"source": "manual"
	}`)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/life-trace/plans", body)
	req.Header.Set("Content-Type", "application/json")
	resp := httptest.NewRecorder()

	router.ServeHTTP(resp, req)

	created := decodeTracePayload(t, resp)["data"].(map[string]interface{})
	if created["reminder"] != false {
		t.Fatalf("expected reminder=false to persist on create, got %+v", created)
	}
}

func TestUpdatePlanPersistsEditableFields(t *testing.T) {
	router := setupTraceTestRouter(t, 101)

	createBody := bytes.NewBufferString(`{
		"title": "晚上预约取车",
		"type": "普通事项",
		"timeLabel": "明天 18:00",
		"scheduledDate": "2026-05-29",
		"scheduledTime": "18:00",
		"timezone": "Asia/Shanghai",
		"reminder": true,
		"note": "提前联系门店",
		"source": "manual"
	}`)
	createReq := httptest.NewRequest(http.MethodPost, "/api/v1/life-trace/plans", createBody)
	createReq.Header.Set("Content-Type", "application/json")
	createResp := httptest.NewRecorder()
	router.ServeHTTP(createResp, createReq)
	created := decodeTracePayload(t, createResp)["data"].(map[string]interface{})
	planID := created["id"].(string)

	updateBody := bytes.NewBufferString(`{
		"title": "改到晚上取车",
		"type": "普通事项",
		"timeLabel": "明天 19:30",
		"scheduledDate": "2026-05-29",
		"scheduledTime": "19:30",
		"timezone": "Asia/Shanghai",
		"reminder": false,
		"location": "城西门店",
		"note": "带身份证",
		"source": "manual"
	}`)
	updateReq := httptest.NewRequest(http.MethodPatch, "/api/v1/life-trace/plans/"+planID, updateBody)
	updateReq.Header.Set("Content-Type", "application/json")
	updateResp := httptest.NewRecorder()
	router.ServeHTTP(updateResp, updateReq)

	updated := decodeTracePayload(t, updateResp)["data"].(map[string]interface{})
	if updated["title"] != "改到晚上取车" || updated["scheduledTime"] != "19:30" {
		t.Fatalf("expected editable fields to update, got %+v", updated)
	}
	if updated["reminder"] != false || updated["location"] != "城西门店" {
		t.Fatalf("expected reminder and location to update, got %+v", updated)
	}
}

func TestListPlansReturnsCurrentUserOpenPlansFirst(t *testing.T) {
	router := setupTraceTestRouter(t, 101)
	now := time.Now()
	completedAt := now.Add(-time.Hour)
	seedPlans := []model.LifeTracePlan{
		{
			UserID:        101,
			Title:         "已完成计划",
			Type:          "电影",
			TimeLabel:     "昨天 20:00",
			ScheduledDate: "2026-05-28",
			ScheduledTime: "20:00",
			Timezone:      "Asia/Shanghai",
			Reminder:      true,
			Source:        "manual",
			Completed:     true,
			CompletedAt:   &completedAt,
			CreatedAt:     now.Add(2 * time.Hour),
		},
		{
			UserID:        101,
			Title:         "未完成计划",
			Type:          "吃饭",
			TimeLabel:     "今天 19:00",
			ScheduledDate: "2026-05-29",
			ScheduledTime: "19:00",
			Timezone:      "Asia/Shanghai",
			Reminder:      false,
			Source:        "ai_advice",
			CreatedAt:     now.Add(time.Hour),
		},
		{
			UserID:        202,
			Title:         "其他用户计划",
			Type:          "运动",
			TimeLabel:     "今天 18:00",
			ScheduledDate: "2026-05-29",
			ScheduledTime: "18:00",
			Timezone:      "Asia/Shanghai",
			Reminder:      true,
			Source:        "manual",
			CreatedAt:     now.Add(3 * time.Hour),
		},
	}
	if err := database.GetDB().Select("*").Create(&seedPlans).Error; err != nil {
		t.Fatalf("seed plans: %v", err)
	}
	if err := database.GetDB().
		Model(&model.LifeTracePlan{}).
		Where("user_id = ? AND title = ?", model.Int64String(101), "未完成计划").
		Update("reminder", false).Error; err != nil {
		t.Fatalf("seed reminder false: %v", err)
	}

	req := httptest.NewRequest(http.MethodGet, "/api/v1/life-trace/plans", nil)
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	list := decodeTracePayload(t, resp)["data"].(map[string]interface{})["list"].([]interface{})
	if len(list) != 2 {
		t.Fatalf("expected only current user plans, got %+v", list)
	}
	first := list[0].(map[string]interface{})
	second := list[1].(map[string]interface{})
	if first["title"] != "未完成计划" || first["completed"] != false || first["reminder"] != false {
		t.Fatalf("expected open current-user plan first, got %+v", first)
	}
	if second["title"] != "已完成计划" || second["completed"] != true {
		t.Fatalf("expected completed current-user plan second, got %+v", second)
	}
}

func TestListPlansReturnsPagination(t *testing.T) {
	router := setupTraceTestRouter(t, 101)
	for index := 0; index < 25; index++ {
		if err := database.GetDB().Create(&model.LifeTracePlan{
			UserID:        101,
			Title:         "分页计划",
			Type:          "普通事项",
			TimeLabel:     "今天 20:00",
			ScheduledDate: "2026-05-29",
			ScheduledTime: "20:00",
			Timezone:      "Asia/Shanghai",
			Reminder:      true,
			Source:        "manual",
			CreatedAt:     time.Now().Add(time.Duration(index) * time.Minute),
		}).Error; err != nil {
			t.Fatalf("seed plan: %v", err)
		}
	}

	req := httptest.NewRequest(http.MethodGet, "/api/v1/life-trace/plans?page=2&pageSize=10", nil)
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	data := decodeTracePayload(t, resp)["data"].(map[string]interface{})
	list := data["list"].([]interface{})
	pagination := data["pagination"].(map[string]interface{})
	if len(list) != 10 {
		t.Fatalf("expected second page size 10, got %d", len(list))
	}
	if pagination["page"] != float64(2) || pagination["pageSize"] != float64(10) {
		t.Fatalf("expected page metadata, got %+v", pagination)
	}
	if pagination["total"] != float64(25) || pagination["hasMore"] != true {
		t.Fatalf("expected total and hasMore, got %+v", pagination)
	}
}

func TestListPlansAppliesFilters(t *testing.T) {
	router := setupTraceTestRouter(t, 101)
	seedPlans := []model.LifeTracePlan{
		{
			UserID:        101,
			Title:         "周末看电影",
			Type:          "电影",
			TimeLabel:     "周六 20:00",
			ScheduledDate: "2026-05-30",
			ScheduledTime: "20:00",
			Timezone:      "Asia/Shanghai",
			Reminder:      true,
			Location:      "万象影城",
			Note:          "提前买票",
			Source:        "manual",
		},
		{
			UserID:        101,
			Title:         "今晚跑步",
			Type:          "运动",
			TimeLabel:     "今天 20:00",
			ScheduledDate: "2026-05-29",
			ScheduledTime: "20:00",
			Timezone:      "Asia/Shanghai",
			Reminder:      false,
			Note:          "轻松跑",
			Source:        "manual",
		},
		{
			UserID:        101,
			Title:         "已完成饭局",
			Type:          "吃饭",
			TimeLabel:     "昨天 19:00",
			ScheduledDate: "2026-05-28",
			ScheduledTime: "19:00",
			Timezone:      "Asia/Shanghai",
			Reminder:      true,
			Completed:     true,
			Note:          "火锅",
			Source:        "manual",
		},
	}
	if err := database.GetDB().Select("*").Create(&seedPlans).Error; err != nil {
		t.Fatalf("seed plans: %v", err)
	}
	if err := database.GetDB().
		Model(&model.LifeTracePlan{}).
		Where("user_id = ? AND title = ?", model.Int64String(101), "今晚跑步").
		Update("reminder", false).Error; err != nil {
		t.Fatalf("seed reminder false: %v", err)
	}

	req := httptest.NewRequest(http.MethodGet, "/api/v1/life-trace/plans?status=open&type=电影&reminder=true&q=影城&dateFrom=2026-05-30&dateTo=2026-05-30", nil)
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	data := decodeTracePayload(t, resp)["data"].(map[string]interface{})
	list := data["list"].([]interface{})
	pagination := data["pagination"].(map[string]interface{})
	if len(list) != 1 {
		t.Fatalf("expected one filtered plan, got %+v", list)
	}
	plan := list[0].(map[string]interface{})
	if plan["title"] != "周末看电影" {
		t.Fatalf("expected movie plan, got %+v", plan)
	}
	if pagination["total"] != float64(1) {
		t.Fatalf("expected filtered total 1, got %+v", pagination)
	}
}

func TestCreatePlanFromAIAdviceSanitizesInternalMarkers(t *testing.T) {
	router := setupTraceTestRouter(t, 101)

	body := bytes.NewBufferString(`{
		"title": "预约取车",
		"type": "普通事项",
		"timeLabel": "今天 18:30",
		"scheduledDate": "2026-05-29",
		"scheduledTime": "18:30",
		"timezone": "Asia/Shanghai",
		"reminder": true,
		"note": "来自生活助理提醒：预约取车。#assistant-plan:2026-05-29-18:30-普通事项-预约取车",
		"source": "ai_advice"
	}`)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/life-trace/plans", body)
	req.Header.Set("Content-Type", "application/json")
	resp := httptest.NewRecorder()

	router.ServeHTTP(resp, req)

	created := decodeTracePayload(t, resp)["data"].(map[string]interface{})
	if created["source"] != "ai_advice" || created["reminder"] != true {
		t.Fatalf("expected AI source and reminder to persist, got %+v", created)
	}
	if created["note"] != "来自生活助理提醒：预约取车。" {
		t.Fatalf("expected internal assistant marker to be stripped, got %+v", created["note"])
	}
}

func TestUpdatePlanStatusTogglesCompletedAt(t *testing.T) {
	router := setupTraceTestRouter(t, 101)
	plan := model.LifeTracePlan{
		UserID:        101,
		Title:         "晚上跑步",
		Type:          "运动",
		TimeLabel:     "今天 20:00",
		ScheduledDate: "2026-05-29",
		ScheduledTime: "20:00",
		Timezone:      "Asia/Shanghai",
		Reminder:      true,
		Source:        "manual",
	}
	if err := database.GetDB().Create(&plan).Error; err != nil {
		t.Fatalf("seed plan: %v", err)
	}

	completeReq := httptest.NewRequest(http.MethodPatch, "/api/v1/life-trace/plans/"+plan.ID.String()+"/status", bytes.NewBufferString(`{"completed":true}`))
	completeReq.Header.Set("Content-Type", "application/json")
	completeResp := httptest.NewRecorder()
	router.ServeHTTP(completeResp, completeReq)

	completed := decodeTracePayload(t, completeResp)["data"].(map[string]interface{})
	if completed["completed"] != true || completed["completedAt"] == nil {
		t.Fatalf("expected completed plan with completedAt, got %+v", completed)
	}

	undoReq := httptest.NewRequest(http.MethodPatch, "/api/v1/life-trace/plans/"+plan.ID.String()+"/status", bytes.NewBufferString(`{"completed":false}`))
	undoReq.Header.Set("Content-Type", "application/json")
	undoResp := httptest.NewRecorder()
	router.ServeHTTP(undoResp, undoReq)

	undone := decodeTracePayload(t, undoResp)["data"].(map[string]interface{})
	if undone["completed"] != false {
		t.Fatalf("expected plan to become incomplete, got %+v", undone)
	}
	if _, exists := undone["completedAt"]; exists {
		t.Fatalf("expected completedAt to be omitted after undo, got %+v", undone)
	}
}
