package lifetrace

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"
	"valley-server/internal/database"
	"valley-server/internal/model"
)

func TestPlanAndTraceLocationsCreateAndReusePlaces(t *testing.T) {
	router := setupTraceTestRouter(t, 101)

	planBody := bytes.NewBufferString(`{
		"title": "周末晚餐",
		"type": "吃饭",
		"timeLabel": "周六 18:30",
		"scheduledDate": "2026-06-13",
		"scheduledTime": "18:30",
		"reminder": true,
		"location": " 山目 / 日料 ",
		"note": "朋友聚餐"
	}`)
	planReq := httptest.NewRequest(http.MethodPost, "/api/v1/life-trace/plans", planBody)
	planReq.Header.Set("Content-Type", "application/json")
	planResp := httptest.NewRecorder()
	router.ServeHTTP(planResp, planReq)
	createdPlan := decodeTracePayload(t, planResp)["data"].(map[string]interface{})

	traceBody := bytes.NewBufferString(`{
		"title": "晚餐记录",
		"summary": "吃到了喜欢的寿喜锅。",
		"timeLabel": "周六 20:10",
		"location": "山目日料",
		"mood": "满足",
		"tags": ["晚餐"],
		"source": "手动"
	}`)
	traceReq := httptest.NewRequest(http.MethodPost, "/api/v1/life-trace/traces", traceBody)
	traceReq.Header.Set("Content-Type", "application/json")
	traceResp := httptest.NewRecorder()
	router.ServeHTTP(traceResp, traceReq)
	createdTrace := decodeTracePayload(t, traceResp)["data"].(map[string]interface{})

	if createdPlan["placeId"] == nil || createdTrace["placeId"] == nil {
		t.Fatalf("expected plan and trace to include placeId, got plan=%+v trace=%+v", createdPlan, createdTrace)
	}
	if createdPlan["placeId"] != createdTrace["placeId"] {
		t.Fatalf("expected same normalized place, got plan=%v trace=%v", createdPlan["placeId"], createdTrace["placeId"])
	}

	listReq := httptest.NewRequest(http.MethodGet, "/api/v1/life-trace/places", nil)
	listResp := httptest.NewRecorder()
	router.ServeHTTP(listResp, listReq)

	places := decodeTracePayload(t, listResp)["data"].(map[string]interface{})["list"].([]interface{})
	if len(places) != 1 {
		t.Fatalf("expected one place, got %+v", places)
	}
	place := places[0].(map[string]interface{})
	if place["name"] != "山目 / 日料" || place["visitCount"] != float64(2) {
		t.Fatalf("unexpected place stats: %+v", place)
	}
}

func TestPlacesAreScopedToCurrentUser(t *testing.T) {
	router := setupTraceTestRouter(t, 101)
	if err := database.GetDB().Create(&model.LifeTracePlace{
		UserID:         202,
		Name:           "别人的咖啡馆",
		NormalizedName: "别人的咖啡馆",
		VisitCount:     1,
	}).Error; err != nil {
		t.Fatalf("seed other user place: %v", err)
	}

	body := bytes.NewBufferString(`{
		"title": "自己的咖啡",
		"summary": "喝一杯拿铁。",
		"timeLabel": "今天 14:00",
		"location": "自己的咖啡馆",
		"mood": "平静",
		"tags": ["咖啡"],
		"source": "手动"
	}`)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/life-trace/traces", body)
	req.Header.Set("Content-Type", "application/json")
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)
	decodeTracePayload(t, resp)

	listReq := httptest.NewRequest(http.MethodGet, "/api/v1/life-trace/places", nil)
	listResp := httptest.NewRecorder()
	router.ServeHTTP(listResp, listReq)

	places := decodeTracePayload(t, listResp)["data"].(map[string]interface{})["list"].([]interface{})
	if len(places) != 1 {
		t.Fatalf("expected only current user place, got %+v", places)
	}
	if places[0].(map[string]interface{})["name"] != "自己的咖啡馆" {
		t.Fatalf("unexpected current user place list: %+v", places)
	}
}

func TestUpdatePlaceFavoriteRenameArchiveAndRecords(t *testing.T) {
	router := setupTraceTestRouter(t, 101)

	body := bytes.NewBufferString(`{
		"title": "小区花园散步",
		"summary": "晚风很舒服。",
		"timeLabel": "今天 20:00",
		"location": "小区花园",
		"mood": "放松",
		"tags": ["散步"],
		"source": "手动"
	}`)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/life-trace/traces", body)
	req.Header.Set("Content-Type", "application/json")
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)
	createdTrace := decodeTracePayload(t, resp)["data"].(map[string]interface{})
	placeID := createdTrace["placeId"].(string)

	updateBody := bytes.NewBufferString(`{
		"name": "小区中央花园",
		"favorite": true,
		"archived": true,
		"note": "晚上散步常去"
	}`)
	updateReq := httptest.NewRequest(http.MethodPatch, "/api/v1/life-trace/places/"+placeID, updateBody)
	updateReq.Header.Set("Content-Type", "application/json")
	updateResp := httptest.NewRecorder()
	router.ServeHTTP(updateResp, updateReq)

	updated := decodeTracePayload(t, updateResp)["data"].(map[string]interface{})
	if updated["name"] != "小区中央花园" || updated["favorite"] != true || updated["archived"] != true {
		t.Fatalf("unexpected updated place: %+v", updated)
	}

	defaultListReq := httptest.NewRequest(http.MethodGet, "/api/v1/life-trace/places", nil)
	defaultListResp := httptest.NewRecorder()
	router.ServeHTTP(defaultListResp, defaultListReq)
	defaultPlaces := decodeTracePayload(t, defaultListResp)["data"].(map[string]interface{})["list"].([]interface{})
	if len(defaultPlaces) != 0 {
		t.Fatalf("archived place should be hidden by default, got %+v", defaultPlaces)
	}

	recordsReq := httptest.NewRequest(http.MethodGet, "/api/v1/life-trace/places/"+placeID+"/records", nil)
	recordsResp := httptest.NewRecorder()
	router.ServeHTTP(recordsResp, recordsReq)
	records := decodeTracePayload(t, recordsResp)["data"].(map[string]interface{})["list"].([]interface{})
	if len(records) != 1 {
		t.Fatalf("expected one place record after rename, got %+v", records)
	}
	if records[0].(map[string]interface{})["title"] != "小区花园散步" {
		t.Fatalf("unexpected place records: %+v", records)
	}
}

func TestCreateWantPlaceFilterUpdateAndExport(t *testing.T) {
	router := setupTraceTestRouter(t, 101)

	createBody := bytes.NewBufferString(`{
		"name": "环湖书店",
		"status": "want",
		"favorite": true,
		"city": "杭州",
		"district": "西湖区",
		"address": "湖边路 18 号",
		"latitude": 30.25,
		"longitude": 120.12,
		"note": "想找个周末去"
	}`)
	createReq := httptest.NewRequest(http.MethodPost, "/api/v1/life-trace/places", createBody)
	createReq.Header.Set("Content-Type", "application/json")
	createResp := httptest.NewRecorder()
	router.ServeHTTP(createResp, createReq)
	created := decodeTracePayload(t, createResp)["data"].(map[string]interface{})
	if created["status"] != "want" || created["city"] != "杭州" {
		t.Fatalf("unexpected created want place: %+v", created)
	}
	placeID := created["id"].(string)

	filterReq := httptest.NewRequest(http.MethodGet, "/api/v1/life-trace/places?status=want", nil)
	filterResp := httptest.NewRecorder()
	router.ServeHTTP(filterResp, filterReq)
	filtered := decodeTracePayload(t, filterResp)["data"].(map[string]interface{})["list"].([]interface{})
	if len(filtered) != 1 {
		t.Fatalf("expected one want place, got %+v", filtered)
	}

	updateBody := bytes.NewBufferString(`{
		"status": "visited",
		"city": "上海",
		"district": "徐汇区",
		"address": "衡山路 1 号",
		"latitude": 31.2,
		"longitude": 121.4
	}`)
	updateReq := httptest.NewRequest(http.MethodPatch, "/api/v1/life-trace/places/"+placeID, updateBody)
	updateReq.Header.Set("Content-Type", "application/json")
	updateResp := httptest.NewRecorder()
	router.ServeHTTP(updateResp, updateReq)
	updated := decodeTracePayload(t, updateResp)["data"].(map[string]interface{})
	if updated["status"] != "visited" || updated["city"] != "上海" {
		t.Fatalf("unexpected updated place metadata: %+v", updated)
	}

	exportReq := httptest.NewRequest(http.MethodGet, "/api/v1/life-trace/places/export", nil)
	exportResp := httptest.NewRecorder()
	router.ServeHTTP(exportResp, exportReq)
	exported := decodeTracePayload(t, exportResp)["data"].(map[string]interface{})
	places := exported["places"].([]interface{})
	if len(places) != 1 {
		t.Fatalf("expected one exported place, got %+v", exported)
	}
	if places[0].(map[string]interface{})["name"] != "环湖书店" {
		t.Fatalf("unexpected exported place: %+v", places)
	}
}
