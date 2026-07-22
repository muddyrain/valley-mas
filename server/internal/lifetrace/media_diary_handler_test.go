package lifetrace

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"
	"valley-server/internal/database"
	"valley-server/internal/model"
)

func TestCreateMediaDiaryEntryCreatesTrace(t *testing.T) {
	router := setupTraceTestRouter(t, 101)

	body := bytes.NewBufferString(`{
		"mediaType": "电影",
		"status": "已完成",
		"title": "花束般的恋爱",
		"creator": "土井裕泰",
		"releaseYear": 2021,
		"coverUrl": "https://example.com/movie.jpg",
		"rating": 9,
		"finishedAt": "2026-06-08",
		"note": "很适合周末晚上慢慢看。",
		"quote": "喜欢会改变日常的纹理。",
		"tags": ["爱情", "周末"]
	}`)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/life-trace/media-diary", body)
	req.Header.Set("Content-Type", "application/json")
	resp := httptest.NewRecorder()

	router.ServeHTTP(resp, req)

	created := decodeTracePayload(t, resp)["data"].(map[string]interface{})
	if created["mediaType"] != "电影" || created["status"] != "已完成" || created["rating"] != float64(9) {
		t.Fatalf("unexpected created media diary entry: %+v", created)
	}
	traceID := created["traceId"].(string)
	if traceID == "" {
		t.Fatalf("expected created entry to include trace id, got %+v", created)
	}

	var trace model.LifeTraceTrace
	if err := database.GetDB().First(&trace, "id = ? AND user_id = ?", traceID, 101).Error; err != nil {
		t.Fatalf("load created trace: %v", err)
	}
	if trace.Source != "书影音" || trace.MediaDiaryID == nil || trace.Title != "电影：花束般的恋爱" {
		t.Fatalf("expected media diary trace link and source, got %+v", trace)
	}
	if trace.ImageURL != "https://example.com/movie.jpg" {
		t.Fatalf("expected trace cover to sync, got %+v", trace)
	}
}

func TestUpdateMediaDiaryEntrySyncsTrace(t *testing.T) {
	router := setupTraceTestRouter(t, 101)

	createBody := bytes.NewBufferString(`{
		"mediaType": "书籍",
		"status": "进行中",
		"title": "夜航西飞",
		"creator": "柏瑞尔·马卡姆",
		"rating": 8,
		"note": "刚开始读。"
	}`)
	createReq := httptest.NewRequest(http.MethodPost, "/api/v1/life-trace/media-diary", createBody)
	createReq.Header.Set("Content-Type", "application/json")
	createResp := httptest.NewRecorder()
	router.ServeHTTP(createResp, createReq)
	created := decodeTracePayload(t, createResp)["data"].(map[string]interface{})
	entryID := created["id"].(string)
	traceID := created["traceId"].(string)

	updateBody := bytes.NewBufferString(`{
		"mediaType": "书籍",
		"status": "已完成",
		"title": "夜航西飞",
		"creator": "柏瑞尔·马卡姆",
		"rating": 10,
		"finishedAt": "2026-06-09",
		"note": "读完后很想再看一次天空。",
		"tags": ["非虚构"]
	}`)
	updateReq := httptest.NewRequest(http.MethodPatch, "/api/v1/life-trace/media-diary/"+entryID, updateBody)
	updateReq.Header.Set("Content-Type", "application/json")
	updateResp := httptest.NewRecorder()
	router.ServeHTTP(updateResp, updateReq)

	updated := decodeTracePayload(t, updateResp)["data"].(map[string]interface{})
	if updated["status"] != "已完成" || updated["rating"] != float64(10) {
		t.Fatalf("unexpected updated entry: %+v", updated)
	}

	var trace model.LifeTraceTrace
	if err := database.GetDB().First(&trace, "id = ?", traceID).Error; err != nil {
		t.Fatalf("load updated trace: %v", err)
	}
	if trace.TimeLabel != "2026-06-09" || !stringListContains(trace.Tags, "书影音") || !stringListContains(trace.Tags, "书籍") {
		t.Fatalf("expected trace fields to sync, got %+v", trace)
	}
	if !bytes.Contains([]byte(trace.Summary), []byte("评分 5.0")) {
		t.Fatalf("expected trace summary to include rating, got %q", trace.Summary)
	}
}

func TestDeleteMediaDiaryEntryKeepsTrace(t *testing.T) {
	router := setupTraceTestRouter(t, 101)

	createBody := bytes.NewBufferString(`{
		"mediaType": "音乐",
		"status": "已完成",
		"title": "Blue",
		"creator": "Joni Mitchell"
	}`)
	createReq := httptest.NewRequest(http.MethodPost, "/api/v1/life-trace/media-diary", createBody)
	createReq.Header.Set("Content-Type", "application/json")
	createResp := httptest.NewRecorder()
	router.ServeHTTP(createResp, createReq)
	created := decodeTracePayload(t, createResp)["data"].(map[string]interface{})
	entryID := created["id"].(string)
	traceID := created["traceId"].(string)

	deleteReq := httptest.NewRequest(http.MethodDelete, "/api/v1/life-trace/media-diary/"+entryID, nil)
	deleteResp := httptest.NewRecorder()
	router.ServeHTTP(deleteResp, deleteReq)
	deleted := decodeTracePayload(t, deleteResp)["data"].(map[string]interface{})
	if deleted["id"] != entryID {
		t.Fatalf("unexpected delete payload: %+v", deleted)
	}

	var trace model.LifeTraceTrace
	if err := database.GetDB().First(&trace, "id = ?", traceID).Error; err != nil {
		t.Fatalf("expected trace to remain: %v", err)
	}
	if trace.MediaDiaryID != nil {
		t.Fatalf("expected media diary link to be cleared, got %+v", trace.MediaDiaryID)
	}
}

func TestListMediaDiaryEntriesSupportsFiltersAndSummary(t *testing.T) {
	router := setupTraceTestRouter(t, 101)
	entries := []model.LifeTraceMediaDiaryEntry{
		{UserID: 101, MediaType: "电影", Status: "已完成", Title: "重庆森林", Creator: "王家卫", Rating: 9, FinishedAt: "2026-06-02", Tags: model.StringList{"电影", "书影音", "香港"}},
		{UserID: 101, MediaType: "书籍", Status: "想看", Title: "局外人", Creator: "阿尔贝·加缪", Tags: model.StringList{"书籍", "书影音"}},
		{UserID: 202, MediaType: "电影", Status: "已完成", Title: "别人的电影", Tags: model.StringList{"电影"}},
	}
	for index := range entries {
		if err := database.GetDB().Create(&entries[index]).Error; err != nil {
			t.Fatalf("seed media diary entry: %v", err)
		}
	}

	req := httptest.NewRequest(http.MethodGet, "/api/v1/life-trace/media-diary?type=电影&status=已完成&q=王家卫&tag=香港&page=1&pageSize=10", nil)
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	data := decodeTracePayload(t, resp)["data"].(map[string]interface{})
	list := data["list"].([]interface{})
	if len(list) != 1 {
		t.Fatalf("expected one filtered entry, got %+v", list)
	}
	item := list[0].(map[string]interface{})
	if item["title"] != "重庆森林" {
		t.Fatalf("unexpected filtered item: %+v", item)
	}
	summary := data["summary"].(map[string]interface{})
	if summary["total"] != float64(2) || summary["bestRating"] != float64(9) {
		t.Fatalf("unexpected summary: %+v", summary)
	}
}

func TestSuggestMediaDiaryEntryRejectsUnavailableCatalogModel(t *testing.T) {
	router := setupTraceTestRouter(t, 101)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/life-trace/media-diary/ai-suggest", bytes.NewBufferString(`{"modelId":"missing-model","mediaType":"书籍","title":"小王子"}`))
	req.Header.Set("Content-Type", "application/json")
	resp := httptest.NewRecorder()

	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusOK {
		t.Fatalf("expected business error response, got %d body=%s", resp.Code, resp.Body.String())
	}
	payload := decodeTraceErrorPayload(t, resp)
	if payload["code"] != float64(http.StatusBadRequest) || payload["message"] == "" {
		t.Fatalf("expected unavailable model message, got %+v", payload)
	}
}

func TestParseMediaDiaryAISuggestionNormalizesFields(t *testing.T) {
	raw := `这里是结果：
	{
		"originalTitle": "The Little Prince",
		"creator": "Antoine de Saint-Exupéry",
		"releaseYear": 1943,
		"tags": ["寓言", "童话", "童话", "人生", "星球", "飞行"],
		"note": "一部关于孤独、童真与关系的短篇作品。"
	}`

	suggestion, err := parseMediaDiaryAISuggestion(raw)
	if err != nil {
		t.Fatalf("parse suggestion: %v", err)
	}
	if suggestion.OriginalTitle != "The Little Prince" || suggestion.ReleaseYear != 1943 {
		t.Fatalf("unexpected parsed suggestion: %+v", suggestion)
	}
	if len(suggestion.Tags) != 5 {
		t.Fatalf("expected tags to be deduped and capped, got %+v", suggestion.Tags)
	}
}
