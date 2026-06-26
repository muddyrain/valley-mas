package lifetrace

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
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

func TestCreateInboxImageRequiresImageURL(t *testing.T) {
	router := setupTraceTestRouter(t, 101)

	body := bytes.NewBufferString(`{
		"title": "票据照片",
		"itemType": "image"
	}`)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/life-trace/inbox", body)
	req.Header.Set("Content-Type", "application/json")
	resp := httptest.NewRecorder()

	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusOK {
		t.Fatalf("expected 200 envelope, got %d", resp.Code)
	}
	payload := decodeTraceErrorPayload(t, resp)
	if payload["message"] != "图片不能为空" {
		t.Fatalf("expected image validation message, got %+v", payload)
	}
}

func TestCreateInboxImageRoundTripsImageURL(t *testing.T) {
	router := setupTraceTestRouter(t, 101)

	body := bytes.NewBufferString(`{
		"title": "票据照片",
		"itemType": "image",
		"imageUrl": "https://example.com/receipt.jpg",
		"tags": ["票据"]
	}`)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/life-trace/inbox", body)
	req.Header.Set("Content-Type", "application/json")
	resp := httptest.NewRecorder()

	router.ServeHTTP(resp, req)

	created := decodeTracePayload(t, resp)["data"].(map[string]interface{})
	if created["itemType"] != "image" || created["imageUrl"] != "https://example.com/receipt.jpg" {
		t.Fatalf("expected image inbox item to round-trip, got %+v", created)
	}
}

func TestListInboxItemsSupportsFiltersSearchAndPagination(t *testing.T) {
	router := setupTraceTestRouter(t, 101)
	items := []model.LifeTraceInboxItem{
		{UserID: 101, Title: "读书链接", Content: "书单资料", ItemType: "link", LinkURL: "https://example.com/books", Status: "inbox", Tags: model.StringList{"阅读"}},
		{UserID: 101, Title: "运动想法", Content: "周末慢跑", ItemType: "text", Status: "archived", Tags: model.StringList{"运动"}},
		{UserID: 101, Title: "阅读计划", Content: "转成计划", ItemType: "text", Status: "converted", ConvertedType: "plan", ConvertedID: "888", Tags: model.StringList{"阅读"}},
		{UserID: 101, Title: "票据照片", Content: "周末晚餐", ItemType: "image", ImageURL: "https://example.com/receipt.jpg", Status: "inbox", Tags: model.StringList{"票据"}},
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

	imageReq := httptest.NewRequest(http.MethodGet, "/api/v1/life-trace/inbox?type=image", nil)
	imageResp := httptest.NewRecorder()
	router.ServeHTTP(imageResp, imageReq)

	imageList := decodeTracePayload(t, imageResp)["data"].(map[string]interface{})["list"].([]interface{})
	if len(imageList) != 1 {
		t.Fatalf("expected one image inbox item, got %+v", imageList)
	}
	imageItem := imageList[0].(map[string]interface{})
	if imageItem["title"] != "票据照片" || imageItem["imageUrl"] != "https://example.com/receipt.jpg" {
		t.Fatalf("unexpected image inbox item: %+v", imageItem)
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

	ledgerItem := model.LifeTraceInboxItem{
		UserID:   101,
		Title:    "午饭 32 元",
		Content:  "小面馆",
		ItemType: "text",
		Status:   "inbox",
		Tags:     model.StringList{"账目"},
	}
	if err := database.GetDB().Create(&ledgerItem).Error; err != nil {
		t.Fatalf("seed ledger inbox item: %v", err)
	}
	ledgerConvertBody := bytes.NewBufferString(`{"convertedType": "ledger", "convertedId": "7001"}`)
	ledgerConvertReq := httptest.NewRequest(http.MethodPatch, "/api/v1/life-trace/inbox/"+ledgerItem.ID.String()+"/convert", ledgerConvertBody)
	ledgerConvertReq.Header.Set("Content-Type", "application/json")
	ledgerConvertResp := httptest.NewRecorder()
	router.ServeHTTP(ledgerConvertResp, ledgerConvertReq)

	ledgerConverted := decodeTracePayload(t, ledgerConvertResp)["data"].(map[string]interface{})
	if ledgerConverted["status"] != "converted" || ledgerConverted["convertedType"] != "ledger" || ledgerConverted["convertedId"] != "7001" {
		t.Fatalf("unexpected ledger converted inbox item: %+v", ledgerConverted)
	}

	for _, target := range []struct {
		convertedType string
		convertedID   string
		title         string
	}{
		{convertedType: "media", convertedID: "6001", title: "看完《活着》"},
		{convertedType: "place", convertedID: "5001", title: "想去的小酒馆"},
	} {
		seedItem := model.LifeTraceInboxItem{
			UserID:   101,
			Title:    target.title,
			ItemType: "text",
			Status:   "inbox",
		}
		if err := database.GetDB().Create(&seedItem).Error; err != nil {
			t.Fatalf("seed %s inbox item: %v", target.convertedType, err)
		}
		body := bytes.NewBufferString(`{"convertedType": "` + target.convertedType + `", "convertedId": "` + target.convertedID + `"}`)
		req := httptest.NewRequest(http.MethodPatch, "/api/v1/life-trace/inbox/"+seedItem.ID.String()+"/convert", body)
		req.Header.Set("Content-Type", "application/json")
		resp := httptest.NewRecorder()
		router.ServeHTTP(resp, req)

		got := decodeTracePayload(t, resp)["data"].(map[string]interface{})
		if got["status"] != "converted" || got["convertedType"] != target.convertedType || got["convertedId"] != target.convertedID {
			t.Fatalf("unexpected %s converted inbox item: %+v", target.convertedType, got)
		}
	}

	deleteReq := httptest.NewRequest(http.MethodDelete, "/api/v1/life-trace/inbox/"+item.ID.String(), nil)
	deleteResp := httptest.NewRecorder()
	router.ServeHTTP(deleteResp, deleteReq)

	deleted := decodeTracePayload(t, deleteResp)["data"].(map[string]interface{})
	if deleted["id"] != item.ID.String() {
		t.Fatalf("unexpected delete payload: %+v", deleted)
	}
}

func TestOrganizeInboxItemSavesAISuggestionsWithoutConverting(t *testing.T) {
	var captured lifeTraceOpenAIRequest
	openAIServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if err := json.NewDecoder(r.Body).Decode(&captured); err != nil {
			t.Fatalf("decode OpenAI request: %v", err)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
			"model": "gpt-inbox",
			"choices": [{
				"message": {
					"role": "assistant",
					"content": "{\"title\":\"周末晚餐票据\",\"summary\":\"记录一张周末晚餐票据，适合稍后补成生活踪迹。\",\"tags\":[\"票据\",\"晚餐\"],\"suggestedType\":\"trace\",\"reason\":\"这更像已经发生的生活记录\"}"
				}
			}]
		}`))
	}))
	defer openAIServer.Close()

	t.Setenv("OPENAI_API_KEY", "test-openai-key")
	t.Setenv("OPENAI_API_BASE_URL", openAIServer.URL)
	t.Setenv("OPENAI_API_MODEL", "gpt-inbox")

	router := setupTraceTestRouter(t, 101)
	item := model.LifeTraceInboxItem{
		UserID:   101,
		Title:    "晚餐记录",
		Content:  "朋友聚餐",
		ItemType: "text",
		Status:   "inbox",
		Tags:     model.StringList{"待整理"},
	}
	if err := database.GetDB().Create(&item).Error; err != nil {
		t.Fatalf("seed inbox item: %v", err)
	}

	req := httptest.NewRequest(http.MethodPost, "/api/v1/life-trace/inbox/"+item.ID.String()+"/organize", nil)
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", resp.Code, resp.Body.String())
	}
	data := decodeTracePayload(t, resp)["data"].(map[string]interface{})
	if data["aiTitle"] != "周末晚餐票据" || data["aiSuggestedType"] != "trace" {
		t.Fatalf("unexpected AI suggestions: %+v", data)
	}
	if data["status"] != "inbox" || data["convertedType"] != nil {
		t.Fatalf("organize should not convert item, got %+v", data)
	}
	if data["aiOrganizedAt"] == nil || data["aiModel"] != "gpt-inbox" {
		t.Fatalf("expected AI metadata, got %+v", data)
	}
	if !strings.Contains(captured.Messages[1].Content, "晚餐记录") ||
		!strings.Contains(captured.Messages[1].Content, "朋友聚餐") {
		t.Fatalf("expected prompt to include inbox context, got %+v", captured.Messages)
	}
}

func TestOrganizeInboxItemFallsBackWhenAISuggestsUnsupportedType(t *testing.T) {
	openAIServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
			"model": "gpt-inbox",
			"choices": [{
				"message": {
					"role": "assistant",
					"content": "{\"title\":\"午饭票据\",\"summary\":\"记录一张午饭票据照片。\",\"tags\":[\"票据\"],\"suggestedType\":\"ledger\",\"reason\":\"模型误判为账目\"}"
				}
			}]
		}`))
	}))
	defer openAIServer.Close()

	t.Setenv("OPENAI_API_KEY", "test-openai-key")
	t.Setenv("OPENAI_API_BASE_URL", openAIServer.URL)
	t.Setenv("OPENAI_API_MODEL", "gpt-inbox")

	router := setupTraceTestRouter(t, 101)
	item := model.LifeTraceInboxItem{
		UserID:   101,
		Title:    "午饭票据",
		Content:  "已经吃完的午饭记录",
		ItemType: "text",
		Status:   "inbox",
	}
	if err := database.GetDB().Create(&item).Error; err != nil {
		t.Fatalf("seed inbox item: %v", err)
	}

	req := httptest.NewRequest(http.MethodPost, "/api/v1/life-trace/inbox/"+item.ID.String()+"/organize", nil)
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	data := decodeTracePayload(t, resp)["data"].(map[string]interface{})
	if data["aiSuggestedType"] != "trace" {
		t.Fatalf("expected unsupported AI suggestion to fall back to plan/trace, got %+v", data)
	}
}

func TestOrganizeInboxItemErrorPaths(t *testing.T) {
	t.Run("not found", func(t *testing.T) {
		router := setupTraceTestRouter(t, 101)

		req := httptest.NewRequest(http.MethodPost, "/api/v1/life-trace/inbox/404/organize", nil)
		resp := httptest.NewRecorder()
		router.ServeHTTP(resp, req)

		payload := decodeTraceErrorPayload(t, resp)
		if payload["message"] != "Inbox 不存在" {
			t.Fatalf("expected not found message, got %+v", payload)
		}
	})

	t.Run("missing ai config", func(t *testing.T) {
		t.Setenv("OPENAI_API_KEY", "")
		t.Setenv("ARK_API_KEY", "")
		router := setupTraceTestRouter(t, 101)
		item := model.LifeTraceInboxItem{
			UserID:   101,
			Title:    "待整理",
			ItemType: "text",
			Status:   "inbox",
		}
		if err := database.GetDB().Create(&item).Error; err != nil {
			t.Fatalf("seed inbox item: %v", err)
		}

		req := httptest.NewRequest(http.MethodPost, "/api/v1/life-trace/inbox/"+item.ID.String()+"/organize", nil)
		resp := httptest.NewRecorder()
		router.ServeHTTP(resp, req)

		payload := decodeTraceErrorPayload(t, resp)
		if payload["message"] != "AI 未配置：缺少 ARK_API_KEY" {
			t.Fatalf("expected missing config message, got %+v", payload)
		}
	})

	t.Run("invalid ai json", func(t *testing.T) {
		openAIServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{
				"model": "gpt-inbox",
				"choices": [{
					"message": {
						"role": "assistant",
						"content": "不是 JSON"
					}
				}]
			}`))
		}))
		defer openAIServer.Close()

		t.Setenv("OPENAI_API_KEY", "test-openai-key")
		t.Setenv("OPENAI_API_BASE_URL", openAIServer.URL)
		t.Setenv("OPENAI_API_MODEL", "gpt-inbox")
		router := setupTraceTestRouter(t, 101)
		item := model.LifeTraceInboxItem{
			UserID:   101,
			Title:    "待整理",
			ItemType: "text",
			Status:   "inbox",
		}
		if err := database.GetDB().Create(&item).Error; err != nil {
			t.Fatalf("seed inbox item: %v", err)
		}

		req := httptest.NewRequest(http.MethodPost, "/api/v1/life-trace/inbox/"+item.ID.String()+"/organize", nil)
		resp := httptest.NewRecorder()
		router.ServeHTTP(resp, req)

		payload := decodeTraceErrorPayload(t, resp)
		if !strings.Contains(payload["message"].(string), "AI 整理解析失败") {
			t.Fatalf("expected parse failure message, got %+v", payload)
		}
	})
}
