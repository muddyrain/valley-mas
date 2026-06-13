package lifetrace

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
	"valley-server/internal/database"
	"valley-server/internal/model"
)

func TestCreateAndListPantryItemsForCurrentUser(t *testing.T) {
	router := setupTraceTestRouter(t, 101)
	thumbnailURL := "data:image/svg+xml;charset=UTF-8," + strings.Repeat("a", 1800)
	expiresAt := time.Now().AddDate(0, 0, 3).Format("2006-01-02")

	body := bytes.NewBufferString(`{
		"name": "鲜牛奶",
		"category": "食品",
		"tags": ["冷藏", "早餐", "早餐"],
		"quantity": 2,
		"unit": "盒",
		"location": "冷藏",
		"expiresAt": "` + expiresAt + `",
		"note": "早餐优先喝掉",
		"imageUrl": "https://example.com/milk.jpg",
		"thumbnailUrl": "` + thumbnailURL + `",
		"barcodeValue": " 6901234567890 ",
		"barcodeFormat": "EAN_13",
		"status": "normal",
		"reminder": {
			"enabled": true,
			"useDefault": false,
			"rules": ["3d", "same-day"],
			"reminderTime": "08:30"
		}
	}`)
	createReq := httptest.NewRequest(http.MethodPost, "/api/v1/life-trace/pantry", body)
	createReq.Header.Set("Content-Type", "application/json")
	createResp := httptest.NewRecorder()
	router.ServeHTTP(createResp, createReq)

	created := decodeTracePayload(t, createResp)["data"].(map[string]interface{})
	if created["name"] != "鲜牛奶" {
		t.Fatalf("unexpected pantry item: %+v", created)
	}
	if created["householdId"] == nil || created["createdBy"] != "101" || created["updatedBy"] != "101" {
		t.Fatalf("expected pantry item to bind personal household and operator, got %+v", created)
	}
	if created["unit"] != "盒" || created["location"] != "冷藏" {
		t.Fatalf("expected persisted pantry metadata, got %+v", created)
	}
	tags := created["tags"].([]interface{})
	if len(tags) != 2 || tags[0] != "冷藏" || tags[1] != "早餐" {
		t.Fatalf("expected tags to be normalized, got %+v", tags)
	}
	if created["thumbnailUrl"] != thumbnailURL {
		t.Fatalf("expected long thumbnail url to round-trip, got %+v", created["thumbnailUrl"])
	}
	if created["barcodeValue"] != "6901234567890" || created["barcodeFormat"] != "ean_13" {
		t.Fatalf("expected barcode fields to round-trip, got %+v", created)
	}
	rules := created["reminderRules"].([]interface{})
	if len(rules) != 2 || rules[0] != "3d" {
		t.Fatalf("expected reminder rules to round-trip, got %+v", rules)
	}

	listReq := httptest.NewRequest(http.MethodGet, "/api/v1/life-trace/pantry?category=食品", nil)
	listResp := httptest.NewRecorder()
	router.ServeHTTP(listResp, listReq)

	list := decodeTracePayload(t, listResp)["data"].(map[string]interface{})["list"].([]interface{})
	if len(list) != 1 {
		t.Fatalf("expected one pantry item, got %+v", list)
	}
	if list[0].(map[string]interface{})["householdId"] != created["householdId"] {
		t.Fatalf("expected list response to stay in same household, got %+v", list[0])
	}
	if list[0].(map[string]interface{})["thumbnailUrl"] != thumbnailURL {
		t.Fatalf("expected list response to keep long thumbnail url, got %+v", list[0])
	}
	if list[0].(map[string]interface{})["barcodeValue"] != "6901234567890" {
		t.Fatalf("expected list response to keep barcode value, got %+v", list[0])
	}
	listTags := list[0].(map[string]interface{})["tags"].([]interface{})
	if len(listTags) != 2 || listTags[0] != "冷藏" {
		t.Fatalf("expected list response to keep tags, got %+v", listTags)
	}
	if decodeTracePayload(t, listResp)["data"].(map[string]interface{})["householdName"] != "我的空间" {
		t.Fatalf("expected list response to include household name, got %+v", decodeTracePayload(t, listResp)["data"])
	}
	summary := decodeTracePayload(t, listResp)["data"].(map[string]interface{})["summary"].(map[string]interface{})
	if summary["total"] != float64(1) || summary["expiring"] != float64(1) || summary["expired"] != float64(0) || summary["active"] != float64(1) {
		t.Fatalf("expected pantry summary for one active item, got %+v", summary)
	}

	detailReq := httptest.NewRequest(http.MethodGet, "/api/v1/life-trace/pantry/"+created["id"].(string), nil)
	detailResp := httptest.NewRecorder()
	router.ServeHTTP(detailResp, detailReq)

	detail := decodeTracePayload(t, detailResp)["data"].(map[string]interface{})
	detailItem := detail["item"].(map[string]interface{})
	if detailItem["id"] != created["id"] || detailItem["name"] != "鲜牛奶" {
		t.Fatalf("expected pantry detail to include item, got %+v", detail)
	}
	detailHousehold := detail["household"].(map[string]interface{})
	if detailHousehold["name"] != "我的空间" || detailHousehold["kind"] != "personal" {
		t.Fatalf("expected pantry detail to include household, got %+v", detailHousehold)
	}

	timelineReq := httptest.NewRequest(http.MethodGet, "/api/v1/life-trace/pantry/"+created["id"].(string)+"/timeline", nil)
	timelineResp := httptest.NewRecorder()
	router.ServeHTTP(timelineResp, timelineReq)

	timeline := decodeTracePayload(t, timelineResp)["data"].(map[string]interface{})
	if timeline["itemId"] != created["id"] {
		t.Fatalf("expected pantry timeline item id, got %+v", timeline)
	}
	timelineList := timeline["list"].([]interface{})
	if len(timelineList) != 1 || timelineList[0].(map[string]interface{})["title"] != "新增库存：鲜牛奶" {
		t.Fatalf("expected pantry timeline to include create trace, got %+v", timelineList)
	}

	var traces []model.LifeTraceTrace
	if err := database.GetDB().
		Where("user_id = ?", 101).
		Order("created_at DESC").
		Find(&traces).Error; err != nil {
		t.Fatalf("list traces: %v", err)
	}
	if len(traces) != 1 || traces[0].Source != "库存" || traces[0].Title != "新增库存：鲜牛奶" {
		t.Fatalf("expected pantry create to write trace, got %+v", traces)
	}
	if !strings.Contains(traces[0].Summary, "我的空间") || !strings.Contains(traces[0].Summary, "2盒") {
		t.Fatalf("expected pantry create trace summary to include household and quantity, got %+v", traces[0])
	}
	if traces[0].PantryItemID == nil || traces[0].PantryItemID.String() != created["id"] {
		t.Fatalf("expected pantry create trace to reference item, got %+v", traces[0].PantryItemID)
	}
}

func TestCreatePantryItemDisablesReminderWithoutExpiry(t *testing.T) {
	router := setupTraceTestRouter(t, 101)

	body := bytes.NewBufferString(`{
		"name": "马克杯",
		"category": "日用品",
		"quantity": 1,
		"unit": "个",
		"location": "厨房",
		"expiresAt": "",
		"status": "normal",
		"reminder": {
			"enabled": true,
			"useDefault": false,
			"rules": ["3d", "same-day"],
			"reminderTime": "08:30"
		}
	}`)
	createReq := httptest.NewRequest(http.MethodPost, "/api/v1/life-trace/pantry", body)
	createReq.Header.Set("Content-Type", "application/json")
	createResp := httptest.NewRecorder()
	router.ServeHTTP(createResp, createReq)

	created := decodeTracePayload(t, createResp)["data"].(map[string]interface{})
	if expiresAt, ok := created["expiresAt"]; ok && expiresAt != "" {
		t.Fatalf("expected empty expiry to round-trip, got %+v", created)
	}
	if created["reminderEnabled"] != false {
		t.Fatalf("expected reminder disabled without expiry, got %+v", created)
	}
}

func TestUpdatePantryItemStatusAndDelete(t *testing.T) {
	router := setupTraceTestRouter(t, 101)
	item := model.LifeTracePantryItem{
		UserID:             101,
		Name:               "生菜",
		Category:           "食品",
		Quantity:           1,
		Unit:               "袋",
		Location:           "冷藏",
		Status:             "normal",
		ReminderEnabled:    true,
		ReminderUseDefault: true,
		ReminderRules:      model.StringList{"7d", "3d", "same-day", "expired"},
		ReminderTime:       "09:00",
	}
	if err := database.GetDB().Create(&item).Error; err != nil {
		t.Fatalf("seed pantry item: %v", err)
	}

	statusReq := httptest.NewRequest(
		http.MethodPatch,
		"/api/v1/life-trace/pantry/"+item.ID.String()+"/status",
		bytes.NewBufferString(`{"status":"used-up"}`),
	)
	statusReq.Header.Set("Content-Type", "application/json")
	statusResp := httptest.NewRecorder()
	router.ServeHTTP(statusResp, statusReq)

	updated := decodeTracePayload(t, statusResp)["data"].(map[string]interface{})
	if updated["status"] != "used-up" {
		t.Fatalf("expected status used-up, got %+v", updated)
	}
	if updated["householdId"] == nil || updated["updatedBy"] != "101" {
		t.Fatalf("expected update to backfill household/operator, got %+v", updated)
	}

	var traces []model.LifeTraceTrace
	if err := database.GetDB().
		Where("user_id = ?", 101).
		Order("created_at DESC").
		Find(&traces).Error; err != nil {
		t.Fatalf("list traces after status update: %v", err)
	}
	if len(traces) != 1 || traces[0].Source != "库存" || traces[0].Title != "已用完：生菜" {
		t.Fatalf("expected pantry status update to write inventory trace, got %+v", traces)
	}
	if !strings.Contains(traces[0].Summary, "1袋") {
		t.Fatalf("expected pantry status trace summary to include quantity, got %+v", traces[0])
	}
	if traces[0].PantryItemID == nil || *traces[0].PantryItemID != item.ID {
		t.Fatalf("expected pantry status trace to reference item, got %+v", traces[0].PantryItemID)
	}

	deleteReq := httptest.NewRequest(http.MethodDelete, "/api/v1/life-trace/pantry/"+item.ID.String(), nil)
	deleteResp := httptest.NewRecorder()
	router.ServeHTTP(deleteResp, deleteReq)

	if decodeTracePayload(t, deleteResp)["data"].(map[string]interface{})["id"] == "" {
		t.Fatalf("expected delete response to contain id")
	}
}

func TestConsumePantryItemPartiallyAndDiscardAll(t *testing.T) {
	router := setupTraceTestRouter(t, 101)
	item := model.LifeTracePantryItem{
		UserID:             101,
		HouseholdID:        personalHouseholdID(101),
		Name:               "抽纸",
		Category:           "日用品",
		Quantity:           18,
		Unit:               "包",
		Location:           "卫生间",
		Status:             "normal",
		ReminderEnabled:    true,
		ReminderUseDefault: true,
		ReminderRules:      model.StringList{"7d", "3d", "same-day", "expired"},
		ReminderTime:       "09:00",
	}
	if err := database.GetDB().Create(&item).Error; err != nil {
		t.Fatalf("seed pantry item: %v", err)
	}

	consumeReq := httptest.NewRequest(
		http.MethodPatch,
		"/api/v1/life-trace/pantry/"+item.ID.String()+"/consume",
		bytes.NewBufferString(`{"action":"used","quantity":3}`),
	)
	consumeReq.Header.Set("Content-Type", "application/json")
	consumeResp := httptest.NewRecorder()
	router.ServeHTTP(consumeResp, consumeReq)

	consumed := decodeTracePayload(t, consumeResp)["data"].(map[string]interface{})
	if consumed["quantity"] != float64(15) || consumed["status"] != "normal" {
		t.Fatalf("expected partial consume to keep item active with reduced quantity, got %+v", consumed)
	}

	discardReq := httptest.NewRequest(
		http.MethodPatch,
		"/api/v1/life-trace/pantry/"+item.ID.String()+"/consume",
		bytes.NewBufferString(`{"action":"discarded","quantity":15}`),
	)
	discardReq.Header.Set("Content-Type", "application/json")
	discardResp := httptest.NewRecorder()
	router.ServeHTTP(discardResp, discardReq)

	discarded := decodeTracePayload(t, discardResp)["data"].(map[string]interface{})
	if discarded["quantity"] != float64(15) || discarded["status"] != "discarded" {
		t.Fatalf("expected full discard to mark item discarded without repeated clicks, got %+v", discarded)
	}

	var traces []model.LifeTraceTrace
	if err := database.GetDB().Where("user_id = ?", 101).Order("created_at ASC").Find(&traces).Error; err != nil {
		t.Fatalf("list traces: %v", err)
	}
	if len(traces) != 2 {
		t.Fatalf("expected consume and discard traces, got %+v", traces)
	}
	if traces[0].Title != "使用库存：抽纸" || !strings.Contains(traces[0].Summary, "3包") || !strings.Contains(traces[0].Summary, "剩余 15包") {
		t.Fatalf("expected partial consume trace to include delta and remaining quantity, got %+v", traces[0])
	}
	if traces[1].Title != "已丢弃：抽纸" || !strings.Contains(traces[1].Summary, "15包") {
		t.Fatalf("expected full discard trace to include processed quantity, got %+v", traces[1])
	}
}

func TestListPantryOnlyReturnsCurrentUserData(t *testing.T) {
	router := setupTraceTestRouter(t, 101)
	if err := database.GetDB().Create(&model.LifeTracePantryItem{
		UserID:             202,
		Name:               "别人的药",
		Category:           "药品",
		Quantity:           1,
		Unit:               "盒",
		Location:           "储物柜",
		Status:             "normal",
		ReminderEnabled:    true,
		ReminderUseDefault: true,
		ReminderRules:      model.StringList{"7d", "3d", "same-day", "expired"},
		ReminderTime:       "09:00",
	}).Error; err != nil {
		t.Fatalf("seed other pantry item: %v", err)
	}

	req := httptest.NewRequest(http.MethodGet, "/api/v1/life-trace/pantry", nil)
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	list := decodeTracePayload(t, resp)["data"].(map[string]interface{})["list"].([]interface{})
	if len(list) != 0 {
		t.Fatalf("expected no current user pantry items, got %+v", list)
	}
}

func TestPantrySupportsSharedHouseholdSelection(t *testing.T) {
	router := setupTraceTestRouter(t, 101)

	sharedHousehold := model.Household{
		Name:        "三口之家",
		Kind:        householdKindShared,
		OwnerUserID: 101,
		Status:      householdStatusActive,
	}
	if err := database.GetDB().Create(&sharedHousehold).Error; err != nil {
		t.Fatalf("create shared household: %v", err)
	}
	if err := database.GetDB().Create(&model.HouseholdMember{
		HouseholdID: sharedHousehold.ID,
		UserID:      101,
		Role:        householdRoleOwner,
		Status:      householdMemberStatusActive,
	}).Error; err != nil {
		t.Fatalf("create owner membership: %v", err)
	}
	if err := database.GetDB().Create(&model.HouseholdMember{
		HouseholdID: sharedHousehold.ID,
		UserID:      202,
		Role:        householdRoleMember,
		Status:      householdMemberStatusActive,
	}).Error; err != nil {
		t.Fatalf("create member membership: %v", err)
	}
	if err := database.GetDB().Create(&model.LifeTracePantryItem{
		UserID:             202,
		HouseholdID:        sharedHousehold.ID,
		CreatedBy:          202,
		UpdatedBy:          202,
		Name:               "家庭牛排",
		Category:           "食品",
		Quantity:           2,
		Unit:               "份",
		Location:           "冷冻",
		Status:             "normal",
		ReminderEnabled:    true,
		ReminderUseDefault: true,
		ReminderRules:      model.StringList{"7d", "3d", "same-day", "expired"},
		ReminderTime:       "09:00",
	}).Error; err != nil {
		t.Fatalf("create shared pantry item: %v", err)
	}

	personalReq := httptest.NewRequest(http.MethodGet, "/api/v1/life-trace/pantry", nil)
	personalResp := httptest.NewRecorder()
	router.ServeHTTP(personalResp, personalReq)

	personalList := decodeTracePayload(t, personalResp)["data"].(map[string]interface{})["list"].([]interface{})
	if len(personalList) != 0 {
		t.Fatalf("expected personal pantry to stay isolated, got %+v", personalList)
	}

	sharedReq := httptest.NewRequest(http.MethodGet, "/api/v1/life-trace/pantry?householdId="+sharedHousehold.ID.String(), nil)
	sharedResp := httptest.NewRecorder()
	router.ServeHTTP(sharedResp, sharedReq)

	sharedData := decodeTracePayload(t, sharedResp)["data"].(map[string]interface{})
	sharedList := sharedData["list"].([]interface{})
	if len(sharedList) != 1 || sharedList[0].(map[string]interface{})["name"] != "家庭牛排" {
		t.Fatalf("expected shared household pantry item, got %+v", sharedList)
	}
	if sharedData["householdId"] != sharedHousehold.ID.String() {
		t.Fatalf("expected selected household id, got %+v", sharedData["householdId"])
	}
}

func TestLookupPantryBarcodeMatchReturnsLatestItemFromCurrentHousehold(t *testing.T) {
	router := setupTraceTestRouter(t, 101)
	olderTime := time.Date(2026, 6, 5, 10, 0, 0, 0, time.UTC)
	newerTime := time.Date(2026, 6, 6, 10, 0, 0, 0, time.UTC)

	seedItems := []model.LifeTracePantryItem{
		{
			UserID:        101,
			HouseholdID:   personalHouseholdID(101),
			Name:          "旧名称纸巾",
			Category:      "日用品",
			Quantity:      1,
			Unit:          "件",
			Location:      "储物柜",
			Status:        "normal",
			BarcodeValue:  "6972205226407",
			BarcodeFormat: "ean_13",
			UpdatedAt:     olderTime,
		},
		{
			UserID:        101,
			HouseholdID:   personalHouseholdID(101),
			Name:          "植护抽纸",
			Category:      "日用品",
			Quantity:      1,
			Unit:          "包",
			Location:      "卫生间",
			Status:        "used-up",
			BarcodeValue:  "6972205226407",
			BarcodeFormat: "ean_13",
			UpdatedAt:     newerTime,
		},
		{
			UserID:        202,
			HouseholdID:   personalHouseholdID(202),
			Name:          "别人家的纸巾",
			Category:      "日用品",
			Quantity:      1,
			Unit:          "包",
			Location:      "厨房",
			Status:        "normal",
			BarcodeValue:  "6972205226407",
			BarcodeFormat: "ean_13",
			UpdatedAt:     newerTime.Add(time.Hour),
		},
	}
	for _, item := range seedItems {
		if err := database.GetDB().Create(&item).Error; err != nil {
			t.Fatalf("create pantry item: %v", err)
		}
	}

	req := httptest.NewRequest(
		http.MethodGet,
		"/api/v1/life-trace/pantry/barcode-match?barcodeValue=6972205226407&barcodeFormat=EAN-13",
		nil,
	)
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	data := decodeTracePayload(t, resp)["data"].(map[string]interface{})
	if data["matched"] != true || data["name"] != "植护抽纸" {
		t.Fatalf("expected latest current-household barcode match, got %+v", data)
	}
	if data["unit"] != "包" || data["location"] != "卫生间" || data["source"] != "pantry-history" {
		t.Fatalf("expected stable barcode profile fields, got %+v", data)
	}
	if data["quantity"] != nil || data["expiresAt"] != nil || data["imageUrl"] != nil {
		t.Fatalf("barcode match must not return volatile pantry fields, got %+v", data)
	}

	noMatchReq := httptest.NewRequest(
		http.MethodGet,
		"/api/v1/life-trace/pantry/barcode-match?barcodeValue=0000000000000&barcodeFormat=ean_13",
		nil,
	)
	noMatchResp := httptest.NewRecorder()
	router.ServeHTTP(noMatchResp, noMatchReq)
	noMatchData := decodeTracePayload(t, noMatchResp)["data"].(map[string]interface{})
	if noMatchData["matched"] != false {
		t.Fatalf("expected no match response, got %+v", noMatchData)
	}
}

func TestLookupPantryBarcodeMatchUsesHouseholdMembership(t *testing.T) {
	router := setupTraceTestRouter(t, 202)
	sharedHousehold := model.Household{
		Name:        "共享家庭",
		Kind:        householdKindShared,
		OwnerUserID: 101,
		Status:      householdStatusActive,
	}
	if err := database.GetDB().Create(&sharedHousehold).Error; err != nil {
		t.Fatalf("create shared household: %v", err)
	}
	if err := database.GetDB().Create(&model.HouseholdMember{
		HouseholdID: sharedHousehold.ID,
		UserID:      202,
		Role:        householdRoleMember,
		Status:      householdMemberStatusActive,
	}).Error; err != nil {
		t.Fatalf("create member membership: %v", err)
	}
	if err := database.GetDB().Create(&model.LifeTracePantryItem{
		UserID:        101,
		HouseholdID:   sharedHousehold.ID,
		Name:          "共享家庭牛奶",
		Category:      "食品",
		Quantity:      1,
		Unit:          "盒",
		Location:      "冷藏",
		Status:        "normal",
		BarcodeValue:  "6901234567890",
		BarcodeFormat: "ean_13",
	}).Error; err != nil {
		t.Fatalf("create shared pantry item: %v", err)
	}

	req := httptest.NewRequest(
		http.MethodGet,
		"/api/v1/life-trace/pantry/barcode-match?barcodeValue=6901234567890&barcodeFormat=ean_13&householdId="+sharedHousehold.ID.String(),
		nil,
	)
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	data := decodeTracePayload(t, resp)["data"].(map[string]interface{})
	if data["matched"] != true || data["name"] != "共享家庭牛奶" {
		t.Fatalf("expected shared household member barcode match, got %+v", data)
	}

	blockedHousehold := model.Household{
		Name:        "不可访问家庭",
		Kind:        householdKindShared,
		OwnerUserID: 404,
		Status:      householdStatusActive,
	}
	if err := database.GetDB().Create(&blockedHousehold).Error; err != nil {
		t.Fatalf("create blocked household: %v", err)
	}
	forbiddenReq := httptest.NewRequest(
		http.MethodGet,
		"/api/v1/life-trace/pantry/barcode-match?barcodeValue=6901234567890&barcodeFormat=ean_13&householdId="+blockedHousehold.ID.String(),
		nil,
	)
	forbiddenResp := httptest.NewRecorder()
	router.ServeHTTP(forbiddenResp, forbiddenReq)
	var forbiddenPayload map[string]interface{}
	if err := json.Unmarshal(forbiddenResp.Body.Bytes(), &forbiddenPayload); err != nil {
		t.Fatalf("decode forbidden response: %v", err)
	}
	if forbiddenPayload["code"] != float64(http.StatusForbidden) {
		t.Fatalf("expected non-member lookup to be forbidden, got %+v", forbiddenPayload)
	}
}

func TestListPantrySupportsDerivedStatusFiltersAndPagination(t *testing.T) {
	router := setupTraceTestRouter(t, 101)
	today := time.Now()
	expiringDate := today.AddDate(0, 0, 2).Format("2006-01-02")
	expiredDate := today.AddDate(0, 0, -1).Format("2006-01-02")
	normalDate := today.AddDate(0, 0, 15).Format("2006-01-02")

	seedItems := []model.LifeTracePantryItem{
		{
			UserID:             101,
			Name:               "过期酸奶",
			Category:           "食品",
			Quantity:           1,
			Unit:               "盒",
			Location:           "冷藏",
			ExpiresAt:          expiredDate,
			Status:             "normal",
			ReminderEnabled:    true,
			ReminderUseDefault: true,
			ReminderRules:      model.StringList{"7d", "3d", "same-day", "expired"},
			ReminderTime:       "09:00",
		},
		{
			UserID:             101,
			Name:               "临期鸡蛋",
			Category:           "食品",
			Quantity:           6,
			Unit:               "枚",
			Location:           "冷藏",
			ExpiresAt:          expiringDate,
			Status:             "normal",
			ReminderEnabled:    true,
			ReminderUseDefault: true,
			ReminderRules:      model.StringList{"7d", "3d", "same-day", "expired"},
			ReminderTime:       "09:00",
		},
		{
			UserID:             101,
			Name:               "大米",
			Category:           "食品",
			Quantity:           1,
			Unit:               "袋",
			Location:           "厨房",
			ExpiresAt:          normalDate,
			Status:             "normal",
			ReminderEnabled:    true,
			ReminderUseDefault: true,
			ReminderRules:      model.StringList{"7d", "3d", "same-day", "expired"},
			ReminderTime:       "09:00",
		},
		{
			UserID:             101,
			Name:               "已丢弃牛奶",
			Category:           "食品",
			Quantity:           1,
			Unit:               "盒",
			Location:           "冷藏",
			ExpiresAt:          normalDate,
			Status:             "discarded",
			ReminderEnabled:    true,
			ReminderUseDefault: true,
			ReminderRules:      model.StringList{"7d", "3d", "same-day", "expired"},
			ReminderTime:       "09:00",
		},
	}
	for _, item := range seedItems {
		if err := database.GetDB().Create(&item).Error; err != nil {
			t.Fatalf("seed pantry item: %v", err)
		}
	}

	expiredReq := httptest.NewRequest(http.MethodGet, "/api/v1/life-trace/pantry?status=expired&page=1&pageSize=10", nil)
	expiredResp := httptest.NewRecorder()
	router.ServeHTTP(expiredResp, expiredReq)

	expiredData := decodeTracePayload(t, expiredResp)["data"].(map[string]interface{})
	expiredList := expiredData["list"].([]interface{})
	if len(expiredList) != 1 || expiredList[0].(map[string]interface{})["name"] != "过期酸奶" {
		t.Fatalf("expected derived expired filter to return only expired item, got %+v", expiredList)
	}

	discardedReq := httptest.NewRequest(http.MethodGet, "/api/v1/life-trace/pantry?status=discarded&page=1&pageSize=10", nil)
	discardedResp := httptest.NewRecorder()
	router.ServeHTTP(discardedResp, discardedReq)

	discardedData := decodeTracePayload(t, discardedResp)["data"].(map[string]interface{})
	discardedList := discardedData["list"].([]interface{})
	if len(discardedList) != 1 || discardedList[0].(map[string]interface{})["name"] != "已丢弃牛奶" {
		t.Fatalf("expected discarded filter to return only discarded item, got %+v", discardedList)
	}

	pageReq := httptest.NewRequest(http.MethodGet, "/api/v1/life-trace/pantry?page=1&pageSize=2", nil)
	pageResp := httptest.NewRecorder()
	router.ServeHTTP(pageResp, pageReq)

	pageData := decodeTracePayload(t, pageResp)["data"].(map[string]interface{})
	pageList := pageData["list"].([]interface{})
	if len(pageList) != 2 {
		t.Fatalf("expected first page to contain 2 items, got %+v", pageList)
	}
	if pageList[0].(map[string]interface{})["name"] != "过期酸奶" || pageList[1].(map[string]interface{})["name"] != "临期鸡蛋" {
		t.Fatalf("expected pantry list to prioritize expired then expiring items, got %+v", pageList)
	}
	pagination := pageData["pagination"].(map[string]interface{})
	if pagination["total"] != float64(3) || pagination["hasMore"] != true {
		t.Fatalf("expected pagination metadata for remaining items, got %+v", pagination)
	}
	summary := pageData["summary"].(map[string]interface{})
	if summary["total"] != float64(3) || summary["expiring"] != float64(1) || summary["expired"] != float64(1) || summary["active"] != float64(2) {
		t.Fatalf("expected consolidated pantry summary, got %+v", summary)
	}
}

func TestPreviewPantryTransferReturnsConflictSummary(t *testing.T) {
	router := setupTraceTestRouter(t, 101)

	sharedHousehold := model.Household{
		Name:        "开心家庭",
		Kind:        householdKindShared,
		OwnerUserID: 101,
		Status:      householdStatusActive,
	}
	if err := database.GetDB().Create(&sharedHousehold).Error; err != nil {
		t.Fatalf("create shared household: %v", err)
	}
	if err := database.GetDB().Create(&model.HouseholdMember{
		HouseholdID: sharedHousehold.ID,
		UserID:      101,
		Role:        householdRoleOwner,
		Status:      householdMemberStatusActive,
	}).Error; err != nil {
		t.Fatalf("create shared household member: %v", err)
	}

	sourceItem := model.LifeTracePantryItem{
		UserID:             101,
		HouseholdID:        personalHouseholdID(101),
		CreatedBy:          101,
		UpdatedBy:          101,
		Name:               "鲜牛奶",
		Category:           "食品",
		Quantity:           2,
		Unit:               "盒",
		Location:           "冷藏",
		ExpiresAt:          "2026-06-12",
		Status:             "normal",
		ReminderEnabled:    true,
		ReminderUseDefault: true,
		ReminderRules:      model.StringList{"7d", "3d", "same-day", "expired"},
		ReminderTime:       "09:00",
	}
	targetItem := model.LifeTracePantryItem{
		UserID:             101,
		HouseholdID:        sharedHousehold.ID,
		CreatedBy:          101,
		UpdatedBy:          101,
		Name:               "鲜牛奶",
		Category:           "食品",
		Quantity:           1,
		Unit:               "盒",
		Location:           "冷藏",
		ExpiresAt:          "2026-06-12",
		Status:             "normal",
		ReminderEnabled:    true,
		ReminderUseDefault: true,
		ReminderRules:      model.StringList{"7d", "3d", "same-day", "expired"},
		ReminderTime:       "09:00",
	}
	if err := database.GetDB().Create(&sourceItem).Error; err != nil {
		t.Fatalf("create source item: %v", err)
	}
	if err := database.GetDB().Create(&targetItem).Error; err != nil {
		t.Fatalf("create target item: %v", err)
	}

	previewReq := httptest.NewRequest(
		http.MethodPost,
		"/api/v1/life-trace/pantry/transfer/preview",
		bytes.NewBufferString(`{
			"targetHouseholdId":"`+sharedHousehold.ID.String()+`",
			"itemIds":["`+sourceItem.ID.String()+`"],
			"mode":"move"
		}`),
	)
	previewReq.Header.Set("Content-Type", "application/json")
	previewResp := httptest.NewRecorder()
	router.ServeHTTP(previewResp, previewReq)

	data := decodeTracePayload(t, previewResp)["data"].(map[string]interface{})
	if data["conflictCount"] != float64(1) || data["itemCount"] != float64(1) {
		t.Fatalf("expected one conflict preview, got %+v", data)
	}
	conflicts := data["conflicts"].([]interface{})
	if len(conflicts) != 1 {
		t.Fatalf("expected one conflict detail, got %+v", conflicts)
	}
	conflict := conflicts[0].(map[string]interface{})
	if conflict["reason"] == "" {
		t.Fatalf("expected conflict reason, got %+v", conflict)
	}
}

func TestTransferPantryItemsMoveWithMergeDeletesSourceAndAccumulatesQuantity(t *testing.T) {
	router := setupTraceTestRouter(t, 101)

	sharedHousehold := model.Household{
		Name:        "开心家庭",
		Kind:        householdKindShared,
		OwnerUserID: 101,
		Status:      householdStatusActive,
	}
	if err := database.GetDB().Create(&sharedHousehold).Error; err != nil {
		t.Fatalf("create shared household: %v", err)
	}
	if err := database.GetDB().Create(&model.HouseholdMember{
		HouseholdID: sharedHousehold.ID,
		UserID:      101,
		Role:        householdRoleOwner,
		Status:      householdMemberStatusActive,
	}).Error; err != nil {
		t.Fatalf("create shared household member: %v", err)
	}

	sourceA := model.LifeTracePantryItem{
		UserID:             101,
		HouseholdID:        personalHouseholdID(101),
		CreatedBy:          101,
		UpdatedBy:          101,
		Name:               "鲜牛奶",
		Category:           "食品",
		Quantity:           2,
		Unit:               "盒",
		Location:           "冷藏",
		ExpiresAt:          "2026-06-12",
		Status:             "normal",
		ReminderEnabled:    true,
		ReminderUseDefault: true,
		ReminderRules:      model.StringList{"7d", "3d", "same-day", "expired"},
		ReminderTime:       "09:00",
	}
	sourceB := model.LifeTracePantryItem{
		UserID:             101,
		HouseholdID:        personalHouseholdID(101),
		CreatedBy:          101,
		UpdatedBy:          101,
		Name:               "吐司",
		Category:           "食品",
		Quantity:           1,
		Unit:               "袋",
		Location:           "厨房",
		Status:             "normal",
		ReminderEnabled:    false,
		ReminderUseDefault: true,
		ReminderRules:      model.StringList{"7d", "3d", "same-day", "expired"},
		ReminderTime:       "09:00",
	}
	target := model.LifeTracePantryItem{
		UserID:             101,
		HouseholdID:        sharedHousehold.ID,
		CreatedBy:          101,
		UpdatedBy:          101,
		Name:               "鲜牛奶",
		Category:           "食品",
		Quantity:           3,
		Unit:               "盒",
		Location:           "冷藏",
		ExpiresAt:          "2026-06-12",
		Status:             "normal",
		ReminderEnabled:    true,
		ReminderUseDefault: true,
		ReminderRules:      model.StringList{"7d", "3d", "same-day", "expired"},
		ReminderTime:       "09:00",
	}
	for _, item := range []*model.LifeTracePantryItem{&sourceA, &sourceB, &target} {
		if err := database.GetDB().Create(item).Error; err != nil {
			t.Fatalf("seed pantry item: %v", err)
		}
	}

	transferReq := httptest.NewRequest(
		http.MethodPost,
		"/api/v1/life-trace/pantry/transfer",
		bytes.NewBufferString(`{
			"targetHouseholdId":"`+sharedHousehold.ID.String()+`",
			"itemIds":["`+sourceA.ID.String()+`","`+sourceB.ID.String()+`"],
			"mode":"move",
			"conflictPolicy":"merge"
		}`),
	)
	transferReq.Header.Set("Content-Type", "application/json")
	transferResp := httptest.NewRecorder()
	router.ServeHTTP(transferResp, transferReq)

	data := decodeTracePayload(t, transferResp)["data"].(map[string]interface{})
	if data["processedCount"] != float64(2) || data["mergedCount"] != float64(1) || data["createdCount"] != float64(1) {
		t.Fatalf("expected one merged and one created item, got %+v", data)
	}
	if data["deletedSourceCount"] != float64(2) {
		t.Fatalf("expected both source items deleted after move, got %+v", data)
	}

	var merged model.LifeTracePantryItem
	if err := database.GetDB().First(&merged, "id = ?", target.ID).Error; err != nil {
		t.Fatalf("reload merged item: %v", err)
	}
	if merged.Quantity != 5 {
		t.Fatalf("expected merged quantity 5, got %+v", merged)
	}

	var personalCount int64
	if err := database.GetDB().
		Model(&model.LifeTracePantryItem{}).
		Where("household_id = ?", personalHouseholdID(101)).
		Count(&personalCount).Error; err != nil {
		t.Fatalf("count personal items: %v", err)
	}
	if personalCount != 0 {
		t.Fatalf("expected personal household emptied after move, got %d", personalCount)
	}

	var sharedCount int64
	if err := database.GetDB().
		Model(&model.LifeTracePantryItem{}).
		Where("household_id = ?", sharedHousehold.ID).
		Count(&sharedCount).Error; err != nil {
		t.Fatalf("count shared items: %v", err)
	}
	if sharedCount != 2 {
		t.Fatalf("expected two shared items after move, got %d", sharedCount)
	}

	var traces []model.LifeTraceTrace
	if err := database.GetDB().
		Where("user_id = ? AND source = ?", 101, "库存").
		Order("created_at DESC").
		Find(&traces).Error; err != nil {
		t.Fatalf("list traces after transfer: %v", err)
	}
	if len(traces) != 2 {
		t.Fatalf("expected transfer to write two pantry traces, got %+v", traces)
	}
	if traces[0].Title != "转移到共享家庭：吐司" && traces[1].Title != "转移到共享家庭：吐司" {
		t.Fatalf("expected moved created item trace, got %+v", traces)
	}
	var mergedTrace *model.LifeTraceTrace
	for index := range traces {
		if traces[index].Title == "合并数量：鲜牛奶" {
			mergedTrace = &traces[index]
			break
		}
	}
	if mergedTrace == nil {
		t.Fatalf("expected merged transfer trace, got %+v", traces)
	}
	if !strings.Contains(mergedTrace.Summary, "开心家庭") ||
		!strings.Contains(mergedTrace.Summary, "+2盒") ||
		!strings.Contains(mergedTrace.Summary, "当前共 5盒") {
		t.Fatalf("expected merged transfer summary to include target household and quantity delta, got %+v", mergedTrace)
	}
}

func TestTransferPantryItemsRequiresConflictPolicyWhenDuplicateExists(t *testing.T) {
	router := setupTraceTestRouter(t, 101)

	sharedHousehold := model.Household{
		Name:        "开心家庭",
		Kind:        householdKindShared,
		OwnerUserID: 101,
		Status:      householdStatusActive,
	}
	if err := database.GetDB().Create(&sharedHousehold).Error; err != nil {
		t.Fatalf("create shared household: %v", err)
	}
	if err := database.GetDB().Create(&model.HouseholdMember{
		HouseholdID: sharedHousehold.ID,
		UserID:      101,
		Role:        householdRoleOwner,
		Status:      householdMemberStatusActive,
	}).Error; err != nil {
		t.Fatalf("create shared household member: %v", err)
	}

	sourceItem := model.LifeTracePantryItem{
		UserID:             101,
		HouseholdID:        personalHouseholdID(101),
		CreatedBy:          101,
		UpdatedBy:          101,
		Name:               "鲜牛奶",
		Category:           "食品",
		Quantity:           1,
		Unit:               "盒",
		Location:           "冷藏",
		ExpiresAt:          "2026-06-12",
		Status:             "normal",
		ReminderEnabled:    true,
		ReminderUseDefault: true,
		ReminderRules:      model.StringList{"7d", "3d", "same-day", "expired"},
		ReminderTime:       "09:00",
	}
	targetItem := model.LifeTracePantryItem{
		UserID:             101,
		HouseholdID:        sharedHousehold.ID,
		CreatedBy:          101,
		UpdatedBy:          101,
		Name:               "鲜牛奶",
		Category:           "食品",
		Quantity:           1,
		Unit:               "盒",
		Location:           "冷藏",
		ExpiresAt:          "2026-06-12",
		Status:             "normal",
		ReminderEnabled:    true,
		ReminderUseDefault: true,
		ReminderRules:      model.StringList{"7d", "3d", "same-day", "expired"},
		ReminderTime:       "09:00",
	}
	for _, item := range []*model.LifeTracePantryItem{&sourceItem, &targetItem} {
		if err := database.GetDB().Create(item).Error; err != nil {
			t.Fatalf("seed pantry item: %v", err)
		}
	}

	transferReq := httptest.NewRequest(
		http.MethodPost,
		"/api/v1/life-trace/pantry/transfer",
		bytes.NewBufferString(`{
			"targetHouseholdId":"`+sharedHousehold.ID.String()+`",
			"itemIds":["`+sourceItem.ID.String()+`"],
			"mode":"copy"
		}`),
	)
	transferReq.Header.Set("Content-Type", "application/json")
	transferResp := httptest.NewRecorder()
	router.ServeHTTP(transferResp, transferReq)

	var payload map[string]interface{}
	if err := json.Unmarshal(transferResp.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode error payload: %v", err)
	}
	if transferResp.Code != http.StatusOK || payload["code"] != float64(http.StatusConflict) {
		t.Fatalf("expected business conflict payload, got status=%d payload=%+v", transferResp.Code, payload)
	}
	if payload["message"] == "" {
		t.Fatalf("expected conflict message, got %+v", payload)
	}
}
