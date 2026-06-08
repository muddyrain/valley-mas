package lifetrace

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"
	"valley-server/internal/database"
	"valley-server/internal/model"
)

func TestCreateAndListInboxItemsForCurrentUser(t *testing.T) {
	router := setupTraceTestRouter(t, 101)

	body := bytes.NewBufferString(`{
		"title": "周末想看展",
		"content": "先收下，晚点再排时间。",
		"itemType": "text",
		"tags": ["灵感", "周末"]
	}`)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/life-trace/inbox", body)
	req.Header.Set("Content-Type", "application/json")
	resp := httptest.NewRecorder()

	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.Code)
	}
	created := decodeTracePayload(t, resp)["data"].(map[string]interface{})
	if created["title"] != "周末想看展" || created["status"] != "inbox" {
		t.Fatalf("unexpected created inbox item: %+v", created)
	}

	listReq := httptest.NewRequest(http.MethodGet, "/api/v1/life-trace/inbox", nil)
	listResp := httptest.NewRecorder()
	router.ServeHTTP(listResp, listReq)

	list := decodeTracePayload(t, listResp)["data"].(map[string]interface{})["list"].([]interface{})
	if len(list) != 1 {
		t.Fatalf("expected one inbox item, got %+v", list)
	}
	item := list[0].(map[string]interface{})
	if item["title"] != "周末想看展" {
		t.Fatalf("unexpected listed inbox item: %+v", item)
	}
	tags := item["tags"].([]interface{})
	if len(tags) != 2 || tags[0] != "灵感" {
		t.Fatalf("expected tags to round-trip, got %+v", tags)
	}
}

func TestListInboxItemsOnlyReturnsCurrentUserData(t *testing.T) {
	router := setupTraceTestRouter(t, 101)
	if err := database.GetDB().Create(&model.LifeTraceInboxItem{
		UserID:   202,
		Title:    "别人的捕捉",
		Content:  "不应该出现在当前用户列表",
		ItemType: "text",
		Status:   "inbox",
		Tags:     model.StringList{"灵感"},
	}).Error; err != nil {
		t.Fatalf("seed other user inbox item: %v", err)
	}

	req := httptest.NewRequest(http.MethodGet, "/api/v1/life-trace/inbox", nil)
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	list := decodeTracePayload(t, resp)["data"].(map[string]interface{})["list"].([]interface{})
	if len(list) != 0 {
		t.Fatalf("expected no current user inbox items, got %+v", list)
	}
}

func TestCreateInboxLinkRequiresHttpURL(t *testing.T) {
	router := setupTraceTestRouter(t, 101)

	body := bytes.NewBufferString(`{
		"title": "资料链接",
		"itemType": "link",
		"linkUrl": "ftp://example.com/file"
	}`)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/life-trace/inbox", body)
	req.Header.Set("Content-Type", "application/json")
	resp := httptest.NewRecorder()

	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusOK {
		t.Fatalf("expected 200 envelope, got %d", resp.Code)
	}
	payload := decodeTraceErrorPayload(t, resp)
	if payload["message"] != "链接格式不正确" {
		t.Fatalf("expected link validation message, got %+v", payload)
	}
}

func TestListInboxItemsSupportsFiltersSearchAndPagination(t *testing.T) {
	router := setupTraceTestRouter(t, 101)
	items := []model.LifeTraceInboxItem{
		{UserID: 101, Title: "读书链接", Content: "书单资料", ItemType: "link", LinkURL: "https://example.com/books", Status: "inbox", Tags: model.StringList{"阅读"}},
		{UserID: 101, Title: "运动想法", Content: "周末慢跑", ItemType: "text", Status: "archived", Tags: model.StringList{"运动"}},
		{UserID: 101, Title: "阅读计划", Content: "转成计划", ItemType: "text", Status: "converted", ConvertedType: "plan", ConvertedID: "888", Tags: model.StringList{"阅读"}},
	}
	for _, item := range items {
		if err := database.GetDB().Create(&item).Error; err != nil {
			t.Fatalf("seed inbox item: %v", err)
		}
	}

	req := httptest.NewRequest(http.MethodGet, "/api/v1/life-trace/inbox?status=inbox&type=link&q=书&page=1&pageSize=1", nil)
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	data := decodeTracePayload(t, resp)["data"].(map[string]interface{})
	list := data["list"].([]interface{})
	pagination := data["pagination"].(map[string]interface{})
	if len(list) != 1 {
		t.Fatalf("expected one filtered inbox item, got %+v", list)
	}
	item := list[0].(map[string]interface{})
	if item["title"] != "读书链接" {
		t.Fatalf("unexpected filtered inbox item: %+v", item)
	}
	if pagination["page"] != float64(1) || pagination["pageSize"] != float64(1) || pagination["total"] != float64(1) {
		t.Fatalf("unexpected pagination: %+v", pagination)
	}
}

func TestUpdateArchiveConvertAndDeleteInboxItem(t *testing.T) {
	router := setupTraceTestRouter(t, 101)
	item := model.LifeTraceInboxItem{
		UserID:   101,
		Title:    "旧捕捉",
		Content:  "待整理",
		ItemType: "text",
		Status:   "inbox",
		Tags:     model.StringList{"待办"},
	}
	if err := database.GetDB().Create(&item).Error; err != nil {
		t.Fatalf("seed inbox item: %v", err)
	}

	updateBody := bytes.NewBufferString(`{
		"title": "更新后的捕捉",
		"content": "新的内容",
		"itemType": "link",
		"linkUrl": "https://example.com/note",
		"tags": ["资料"]
	}`)
	updateReq := httptest.NewRequest(http.MethodPatch, "/api/v1/life-trace/inbox/"+item.ID.String(), updateBody)
	updateReq.Header.Set("Content-Type", "application/json")
	updateResp := httptest.NewRecorder()
	router.ServeHTTP(updateResp, updateReq)

	updated := decodeTracePayload(t, updateResp)["data"].(map[string]interface{})
	if updated["title"] != "更新后的捕捉" || updated["itemType"] != "link" {
		t.Fatalf("unexpected updated inbox item: %+v", updated)
	}

	archiveBody := bytes.NewBufferString(`{"status": "archived"}`)
	archiveReq := httptest.NewRequest(http.MethodPatch, "/api/v1/life-trace/inbox/"+item.ID.String()+"/status", archiveBody)
	archiveReq.Header.Set("Content-Type", "application/json")
	archiveResp := httptest.NewRecorder()
	router.ServeHTTP(archiveResp, archiveReq)

	archived := decodeTracePayload(t, archiveResp)["data"].(map[string]interface{})
	if archived["status"] != "archived" {
		t.Fatalf("expected archived status, got %+v", archived)
	}

	convertBody := bytes.NewBufferString(`{"convertedType": "plan", "convertedId": "9001"}`)
	convertReq := httptest.NewRequest(http.MethodPatch, "/api/v1/life-trace/inbox/"+item.ID.String()+"/convert", convertBody)
	convertReq.Header.Set("Content-Type", "application/json")
	convertResp := httptest.NewRecorder()
	router.ServeHTTP(convertResp, convertReq)

	converted := decodeTracePayload(t, convertResp)["data"].(map[string]interface{})
	if converted["status"] != "converted" || converted["convertedType"] != "plan" || converted["convertedId"] != "9001" {
		t.Fatalf("unexpected converted inbox item: %+v", converted)
	}
	if converted["convertedAt"] == nil {
		t.Fatalf("expected convertedAt to be set, got %+v", converted)
	}

	deleteReq := httptest.NewRequest(http.MethodDelete, "/api/v1/life-trace/inbox/"+item.ID.String(), nil)
	deleteResp := httptest.NewRecorder()
	router.ServeHTTP(deleteResp, deleteReq)

	deleted := decodeTracePayload(t, deleteResp)["data"].(map[string]interface{})
	if deleted["id"] != item.ID.String() {
		t.Fatalf("unexpected delete payload: %+v", deleted)
	}
}
