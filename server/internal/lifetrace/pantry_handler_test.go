package lifetrace

import (
	"bytes"
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

	body := bytes.NewBufferString(`{
		"name": "鲜牛奶",
		"category": "食品",
		"quantity": 2,
		"unit": "盒",
		"location": "冷藏",
		"expiresAt": "2026-06-10",
		"note": "早餐优先喝掉",
		"imageUrl": "https://example.com/milk.jpg",
		"thumbnailUrl": "` + thumbnailURL + `",
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
	if created["thumbnailUrl"] != thumbnailURL {
		t.Fatalf("expected long thumbnail url to round-trip, got %+v", created["thumbnailUrl"])
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
	if decodeTracePayload(t, listResp)["data"].(map[string]interface{})["householdName"] != "我的空间" {
		t.Fatalf("expected list response to include household name, got %+v", decodeTracePayload(t, listResp)["data"])
	}
	summary := decodeTracePayload(t, listResp)["data"].(map[string]interface{})["summary"].(map[string]interface{})
	if summary["total"] != float64(1) || summary["expiring"] != float64(1) || summary["expired"] != float64(0) || summary["active"] != float64(1) {
		t.Fatalf("expected pantry summary for one active item, got %+v", summary)
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

	deleteReq := httptest.NewRequest(http.MethodDelete, "/api/v1/life-trace/pantry/"+item.ID.String(), nil)
	deleteResp := httptest.NewRecorder()
	router.ServeHTTP(deleteResp, deleteReq)

	if decodeTracePayload(t, deleteResp)["data"].(map[string]interface{})["id"] == "" {
		t.Fatalf("expected delete response to contain id")
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
