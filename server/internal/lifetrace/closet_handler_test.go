package lifetrace

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"slices"
	"strings"
	"testing"
	"time"
	"valley-server/internal/config"
	"valley-server/internal/database"
	"valley-server/internal/model"

	"github.com/gin-gonic/gin"
)

func lifeTraceRouterForTestUser(userID model.Int64String) *gin.Engine {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	auth := func(c *gin.Context) {
		c.Set("userId", userID)
		c.Next()
	}
	RegisterRoutes(router.Group("/api/v1"), NewHandler(NewWeatherService(config.QWeatherConfig{})), auth)
	return router
}

func TestClosetPersonalItemsStayPrivate(t *testing.T) {
	ownerRouter := setupTraceTestRouter(t, 101)

	body := bytes.NewBufferString(`{
		"name": "蓝色衬衫",
		"category": "上装",
		"color": "蓝色",
		"warmthLevel": "轻薄",
		"seasons": ["春", "夏"],
		"sceneTags": ["通勤", "日常"],
		"imageUrl": "https://example.com/shirt.jpg"
	}`)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/life-trace/closet/items", body)
	req.Header.Set("Content-Type", "application/json")
	resp := httptest.NewRecorder()
	ownerRouter.ServeHTTP(resp, req)

	created := decodeTracePayload(t, resp)["data"].(map[string]interface{})
	if created["name"] != "蓝色衬衫" || created["shared"] != false {
		t.Fatalf("unexpected closet item: %+v", created)
	}

	otherRouter := lifeTraceRouterForTestUser(202)
	detailReq := httptest.NewRequest(http.MethodGet, "/api/v1/life-trace/closet/items/"+created["id"].(string), nil)
	detailResp := httptest.NewRecorder()
	otherRouter.ServeHTTP(detailResp, detailReq)
	detailPayload := decodeTraceErrorPayload(t, detailResp)
	if detailPayload["message"] != "衣物不存在" {
		t.Fatalf("expected private closet item to stay hidden, got %+v", detailPayload)
	}
}

func TestClosetSharedPoolVisibleToHouseholdMembers(t *testing.T) {
	router := setupTraceTestRouter(t, 101)
	now := model.Int64String(301)
	if err := database.GetDB().Create(&model.Household{
		ID:          now,
		Name:        "共享衣橱",
		Kind:        householdKindShared,
		OwnerUserID: 101,
		Status:      householdStatusActive,
	}).Error; err != nil {
		t.Fatalf("seed household: %v", err)
	}
	for _, member := range []model.HouseholdMember{
		{HouseholdID: now, UserID: 101, Role: householdRoleOwner, Status: householdMemberStatusActive},
		{HouseholdID: now, UserID: 202, Role: householdRoleMember, Status: householdMemberStatusActive},
	} {
		if err := database.GetDB().Create(&member).Error; err != nil {
			t.Fatalf("seed member: %v", err)
		}
	}

	body := bytes.NewBufferString(`{
		"name": "雨天外套",
		"category": "外套",
		"color": "黑色",
		"warmthLevel": "保暖",
		"seasons": ["秋", "冬"],
		"sceneTags": ["通勤", "雨天"],
		"shared": true
	}`)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/life-trace/closet/items?householdId=301", body)
	req.Header.Set("Content-Type", "application/json")
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	created := decodeTracePayload(t, resp)["data"].(map[string]interface{})
	if created["householdId"] != "301" || created["shared"] != true {
		t.Fatalf("expected shared closet item, got %+v", created)
	}

	memberRouter := lifeTraceRouterForTestUser(202)
	listReq := httptest.NewRequest(http.MethodGet, "/api/v1/life-trace/closet/items?householdId=301", nil)
	listResp := httptest.NewRecorder()
	memberRouter.ServeHTTP(listResp, listReq)

	data := decodeTracePayload(t, listResp)["data"].(map[string]interface{})
	list := data["list"].([]interface{})
	if len(list) != 1 || list[0].(map[string]interface{})["name"] != "雨天外套" {
		t.Fatalf("expected household member to see shared item, got %+v", data)
	}

	outsiderRouter := lifeTraceRouterForTestUser(303)
	outsiderReq := httptest.NewRequest(http.MethodGet, "/api/v1/life-trace/closet/items?householdId=301", nil)
	outsiderResp := httptest.NewRecorder()
	outsiderRouter.ServeHTTP(outsiderResp, outsiderReq)
	outsiderPayload := decodeTraceErrorPayload(t, outsiderResp)
	if outsiderPayload["message"] != "家庭不存在或不可访问" {
		t.Fatalf("expected outsider rejection, got %+v", outsiderPayload)
	}
}

func TestListClosetItemsIncludesIdleWearStats(t *testing.T) {
	router := setupTraceTestRouter(t, 101)
	now := time.Now()
	idleCreatedAt := now.AddDate(0, 0, -45)
	recentWornDate := now.AddDate(0, 0, -7).Format("2006-01-02")

	idleItem := model.LifeTraceClosetItem{
		UserID:      101,
		HouseholdID: -101,
		Name:        "闲置风衣",
		Category:    "外套",
		Color:       "卡其色",
		WarmthLevel: "常规",
		Seasons:     model.StringList{"春", "秋"},
		SceneTags:   model.StringList{"日常"},
		Status:      "active",
		CreatedAt:   idleCreatedAt,
		UpdatedAt:   idleCreatedAt,
	}
	recentItem := model.LifeTraceClosetItem{
		UserID:      101,
		HouseholdID: -101,
		Name:        "常穿白 T",
		Category:    "上装",
		Color:       "白色",
		WarmthLevel: "轻薄",
		Seasons:     model.StringList{"夏"},
		SceneTags:   model.StringList{"日常"},
		Status:      "active",
	}
	for _, item := range []*model.LifeTraceClosetItem{&idleItem, &recentItem} {
		if err := database.GetDB().Create(item).Error; err != nil {
			t.Fatalf("seed closet item: %v", err)
		}
	}

	recentOutfit := model.LifeTraceOutfit{
		UserID:      101,
		HouseholdID: -101,
		Title:       "最近穿搭",
		ItemIDs:     model.StringList{recentItem.ID.String()},
		Scene:       "日常",
		Status:      "worn",
		WornDate:    recentWornDate,
	}
	if err := database.GetDB().Create(&recentOutfit).Error; err != nil {
		t.Fatalf("seed outfit: %v", err)
	}

	req := httptest.NewRequest(http.MethodGet, "/api/v1/life-trace/closet/items?status=all", nil)
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	data := decodeTracePayload(t, resp)["data"].(map[string]interface{})
	list := data["list"].([]interface{})
	var foundIdle bool
	var foundRecent bool
	for _, raw := range list {
		entry := raw.(map[string]interface{})
		stats, ok := entry["wearStats"].(map[string]interface{})
		if !ok {
			t.Fatalf("expected wearStats on closet list item, got %+v", entry)
		}
		if entry["name"] == "闲置风衣" {
			foundIdle = true
			if stats["idleLevel"] != "idle" {
				t.Fatalf("expected idle level for idle item, got %+v", stats)
			}
			if stats["idleDays"].(float64) < 30 {
				t.Fatalf("expected idle days to reflect long inactivity, got %+v", stats)
			}
		}
		if entry["name"] == "常穿白 T" {
			foundRecent = true
			if stats["lastWornDate"] != recentWornDate {
				t.Fatalf("expected recent worn date, got %+v", stats)
			}
			if stats["idleLevel"] != "normal" {
				t.Fatalf("expected normal idle level for recent item, got %+v", stats)
			}
		}
	}
	if !foundIdle || !foundRecent {
		t.Fatalf("expected both closet items in response, got %+v", list)
	}
}

func TestGetClosetItemIncludesCareStatsAndMarkCareResetsCycle(t *testing.T) {
	router := setupTraceTestRouter(t, 101)
	item := model.LifeTraceClosetItem{
		UserID:            101,
		HouseholdID:       -101,
		Name:              "白衬衫",
		Category:          "上装",
		Color:             "白色",
		WarmthLevel:       "常规",
		Seasons:           model.StringList{"四季"},
		SceneTags:         model.StringList{"通勤"},
		Status:            "active",
		CareMethod:        "机洗",
		CareIntervalWears: 2,
		LastCareDate:      "2026-06-01",
	}
	if err := database.GetDB().Create(&item).Error; err != nil {
		t.Fatalf("seed closet item: %v", err)
	}
	for _, outfit := range []model.LifeTraceOutfit{
		{UserID: 101, HouseholdID: -101, Title: "周一穿搭", ItemIDs: model.StringList{item.ID.String()}, Scene: "通勤", Status: "worn", WornDate: "2026-06-03"},
		{UserID: 101, HouseholdID: -101, Title: "周二穿搭", ItemIDs: model.StringList{item.ID.String()}, Scene: "通勤", Status: "worn", WornDate: "2026-06-05"},
		{UserID: 101, HouseholdID: -101, Title: "周三穿搭", ItemIDs: model.StringList{item.ID.String()}, Scene: "通勤", Status: "worn", WornDate: "2026-06-08"},
	} {
		if err := database.GetDB().Create(&outfit).Error; err != nil {
			t.Fatalf("seed outfit: %v", err)
		}
	}

	req := httptest.NewRequest(http.MethodGet, "/api/v1/life-trace/closet/items/"+item.ID.String(), nil)
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	data := decodeTracePayload(t, resp)["data"].(map[string]interface{})
	careStats := data["careStats"].(map[string]interface{})
	if careStats["careStatus"] != "overdue" {
		t.Fatalf("expected overdue care status, got %+v", careStats)
	}
	if careStats["wornCountSinceCare"] != float64(3) {
		t.Fatalf("expected worn count since care, got %+v", careStats)
	}

	markReq := httptest.NewRequest(
		http.MethodPatch,
		"/api/v1/life-trace/closet/items/"+item.ID.String()+"/care",
		bytes.NewBufferString(`{"lastCareDate":"2026-06-15"}`),
	)
	markReq.Header.Set("Content-Type", "application/json")
	markResp := httptest.NewRecorder()
	router.ServeHTTP(markResp, markReq)

	updated := decodeTracePayload(t, markResp)["data"].(map[string]interface{})
	if updated["lastCareDate"] != "2026-06-15" {
		t.Fatalf("expected care date update, got %+v", updated)
	}
}

func TestClosetDefaultsToPersonalHouseholdWhenPantryPrefersShared(t *testing.T) {
	router := setupTraceTestRouter(t, 101)
	sharedHouseholdID := model.Int64String(301)
	if err := database.GetDB().Create(&model.Household{
		ID:          sharedHouseholdID,
		Name:        "开心家庭",
		Kind:        householdKindShared,
		OwnerUserID: 101,
		Status:      householdStatusActive,
	}).Error; err != nil {
		t.Fatalf("seed household: %v", err)
	}
	if err := database.GetDB().Create(&model.HouseholdMember{
		HouseholdID: sharedHouseholdID,
		UserID:      101,
		Role:        householdRoleOwner,
		Status:      householdMemberStatusActive,
	}).Error; err != nil {
		t.Fatalf("seed member: %v", err)
	}
	if err := database.GetDB().Create(&model.LifeTraceSettings{
		UserID:                  101,
		ActivePantryHouseholdID: sharedHouseholdID,
	}).Error; err != nil {
		t.Fatalf("seed settings: %v", err)
	}

	body := bytes.NewBufferString(`{
		"name": "碎花裙",
		"category": "套装",
		"color": "白色",
		"warmthLevel": "轻薄",
		"seasons": ["春", "夏"],
		"sceneTags": ["日常"]
	}`)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/life-trace/closet/items", body)
	req.Header.Set("Content-Type", "application/json")
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	created := decodeTracePayload(t, resp)["data"].(map[string]interface{})
	if created["householdId"] != "-101" {
		t.Fatalf("expected default closet item in personal household, got %+v", created)
	}

	listReq := httptest.NewRequest(http.MethodGet, "/api/v1/life-trace/closet/items", nil)
	listResp := httptest.NewRecorder()
	router.ServeHTTP(listResp, listReq)
	data := decodeTracePayload(t, listResp)["data"].(map[string]interface{})
	list := data["list"].([]interface{})
	if len(list) != 1 || list[0].(map[string]interface{})["name"] != "碎花裙" {
		t.Fatalf("expected personal closet list to include saved item, got %+v", data)
	}
}

func TestOutfitRequiresAccessibleItemsAndWritesTraceWhenWorn(t *testing.T) {
	router := setupTraceTestRouter(t, 101)
	item := model.LifeTraceClosetItem{
		UserID:      101,
		HouseholdID: -101,
		Name:        "白 T",
		Category:    "上装",
		Color:       "白色",
		WarmthLevel: "轻薄",
		Seasons:     model.StringList{"夏"},
		SceneTags:   model.StringList{"日常"},
		Status:      "active",
	}
	other := model.LifeTraceClosetItem{
		UserID:      202,
		HouseholdID: -202,
		Name:        "别人外套",
		Category:    "外套",
		Color:       "灰色",
		WarmthLevel: "常规",
		Seasons:     model.StringList{"四季"},
		SceneTags:   model.StringList{"日常"},
		Status:      "active",
	}
	if err := database.GetDB().Create(&item).Error; err != nil {
		t.Fatalf("seed item: %v", err)
	}
	if err := database.GetDB().Create(&other).Error; err != nil {
		t.Fatalf("seed other item: %v", err)
	}

	badBody := bytes.NewBufferString(`{"itemIds":["` + item.ID.String() + `","` + other.ID.String() + `"]}`)
	badReq := httptest.NewRequest(http.MethodPost, "/api/v1/life-trace/closet/outfits", badBody)
	badReq.Header.Set("Content-Type", "application/json")
	badResp := httptest.NewRecorder()
	router.ServeHTTP(badResp, badReq)
	badPayload := decodeTraceErrorPayload(t, badResp)
	if badPayload["message"] != "穿搭包含不可访问的衣物" {
		t.Fatalf("expected inaccessible item rejection, got %+v", badPayload)
	}

	body := bytes.NewBufferString(`{
		"title": "清爽日常",
		"itemIds": ["` + item.ID.String() + `"],
		"scene": "日常",
		"status": "saved"
	}`)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/life-trace/closet/outfits", body)
	req.Header.Set("Content-Type", "application/json")
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)
	created := decodeTracePayload(t, resp)["data"].(map[string]interface{})

	statusReq := httptest.NewRequest(http.MethodPatch, "/api/v1/life-trace/closet/outfits/"+created["id"].(string)+"/status", bytes.NewBufferString(`{"status":"worn","wornDate":"2026-06-09","rating":4}`))
	statusReq.Header.Set("Content-Type", "application/json")
	statusResp := httptest.NewRecorder()
	router.ServeHTTP(statusResp, statusReq)
	updated := decodeTracePayload(t, statusResp)["data"].(map[string]interface{})
	if updated["status"] != "worn" || updated["wornDate"] != "2026-06-09" {
		t.Fatalf("expected worn outfit, got %+v", updated)
	}

	var trace model.LifeTraceTrace
	if err := database.GetDB().First(&trace, "outfit_id = ?", created["id"]).Error; err != nil {
		t.Fatalf("expected outfit trace: %v", err)
	}
	if trace.Source != "穿搭" || !strings.Contains(trace.Title, "清爽日常") {
		t.Fatalf("unexpected outfit trace: %+v", trace)
	}
}

func TestGetClosetItemReturnsWearStats(t *testing.T) {
	router := setupTraceTestRouter(t, 101)
	item := model.LifeTraceClosetItem{
		UserID:      101,
		HouseholdID: -101,
		Name:        "白 T",
		Category:    "上装",
		Color:       "白色",
		WarmthLevel: "轻薄",
		Seasons:     model.StringList{"夏"},
		SceneTags:   model.StringList{"日常"},
		Status:      "active",
	}
	otherItem := model.LifeTraceClosetItem{
		UserID:      101,
		HouseholdID: -101,
		Name:        "牛仔裤",
		Category:    "下装",
		Color:       "蓝色",
		WarmthLevel: "常规",
		Seasons:     model.StringList{"四季"},
		SceneTags:   model.StringList{"日常"},
		Status:      "active",
	}
	otherUserItem := model.LifeTraceClosetItem{
		UserID:      202,
		HouseholdID: -202,
		Name:        "别人衬衫",
		Category:    "上装",
		Color:       "灰色",
		WarmthLevel: "常规",
		Seasons:     model.StringList{"四季"},
		SceneTags:   model.StringList{"日常"},
		Status:      "active",
	}
	for _, seed := range []*model.LifeTraceClosetItem{&item, &otherItem, &otherUserItem} {
		if err := database.GetDB().Create(seed).Error; err != nil {
			t.Fatalf("seed closet item: %v", err)
		}
	}

	outfits := []model.LifeTraceOutfit{
		{UserID: 101, HouseholdID: -101, Title: "周一穿搭", ItemIDs: model.StringList{item.ID.String()}, Scene: "日常", Status: "worn", WornDate: "2026-06-09"},
		{UserID: 101, HouseholdID: -101, Title: "周二穿搭", ItemIDs: model.StringList{item.ID.String(), otherItem.ID.String()}, Scene: "日常", Status: "worn", WornDate: "2026-06-10"},
		{UserID: 101, HouseholdID: -101, Title: "收藏穿搭", ItemIDs: model.StringList{item.ID.String()}, Scene: "日常", Status: "saved", WornDate: "2026-06-11"},
		{UserID: 101, HouseholdID: -101, Title: "其他穿搭", ItemIDs: model.StringList{otherItem.ID.String()}, Scene: "日常", Status: "worn", WornDate: "2026-06-12"},
		{UserID: 202, HouseholdID: -202, Title: "别人穿搭", ItemIDs: model.StringList{otherUserItem.ID.String()}, Scene: "日常", Status: "worn", WornDate: "2026-06-13"},
	}
	for _, outfit := range outfits {
		if err := database.GetDB().Create(&outfit).Error; err != nil {
			t.Fatalf("seed outfit: %v", err)
		}
	}

	req := httptest.NewRequest(http.MethodGet, "/api/v1/life-trace/closet/items/"+item.ID.String(), nil)
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	data := decodeTracePayload(t, resp)["data"].(map[string]interface{})
	wearStats := data["wearStats"].(map[string]interface{})
	if wearStats["wornCount"] != float64(2) || wearStats["lastWornDate"] != "2026-06-10" {
		t.Fatalf("unexpected wear stats: %+v", wearStats)
	}
}

func TestParseClothingPhotoAnalysisNormalizesFields(t *testing.T) {
	parsed, err := parseClothingPhotoAnalysisAIResponse(`衣物：
	{
		"name": "蓝白条纹衬衫适合春夏通勤",
		"category": "不存在",
		"color": "蓝白",
		"material": "棉",
		"warmthLevel": "轻薄",
		"seasons": ["春", "夏", "梅雨"],
		"sceneTags": ["通勤", "日常", "通勤"],
		"summary": "适合春夏通勤的轻薄衬衫。",
		"confidence": 1.4,
		"warnings": ["请确认尺码"]
	}`)
	if err != nil {
		t.Fatalf("parse clothing response: %v", err)
	}
	if parsed.Category != "上装" || parsed.WarmthLevel != "轻薄" || parsed.Confidence != 1 {
		t.Fatalf("unexpected normalized draft: %+v", parsed)
	}
	if len(parsed.Seasons) != 2 || parsed.Seasons[0] != "春" || len(parsed.SceneTags) != 2 {
		t.Fatalf("expected normalized seasons/tags, got %+v %+v", parsed.Seasons, parsed.SceneTags)
	}
}

func TestGenerateOutfitSuggestionsUsesContextForRuleFallback(t *testing.T) {
	router := setupTraceTestRouter(t, 101)
	for _, item := range []model.LifeTraceClosetItem{
		{UserID: 101, HouseholdID: -101, Name: "运动速干衣", Category: "上装", Color: "蓝色", WarmthLevel: "轻薄", Seasons: model.StringList{"夏"}, SceneTags: model.StringList{"运动"}, Status: "active"},
		{UserID: 101, HouseholdID: -101, Name: "厚毛衣", Category: "上装", Color: "灰色", WarmthLevel: "厚重", Seasons: model.StringList{"冬"}, SceneTags: model.StringList{"日常"}, Status: "active"},
		{UserID: 101, HouseholdID: -101, Name: "运动短裤", Category: "下装", Color: "黑色", WarmthLevel: "轻薄", Seasons: model.StringList{"夏"}, SceneTags: model.StringList{"运动"}, Status: "active"},
	} {
		if err := database.GetDB().Create(&item).Error; err != nil {
			t.Fatalf("seed closet item: %v", err)
		}
	}

	req := httptest.NewRequest(http.MethodPost, "/api/v1/life-trace/ai/outfit-suggestions", bytes.NewBufferString(`{"weatherText":"晴","temperature":30,"planType":"运动","scene":"运动","planTitle":"晚上跑步"}`))
	req.Header.Set("Content-Type", "application/json")
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	data := decodeTracePayload(t, resp)["data"].(map[string]interface{})
	suggestions := data["suggestions"].([]interface{})
	if len(suggestions) == 0 {
		t.Fatalf("expected context-aware outfit suggestions, got %+v", data)
	}
	first := suggestions[0].(map[string]interface{})
	items := first["items"].([]interface{})
	if len(items) == 0 {
		t.Fatalf("expected suggested items, got %+v", first)
	}
	firstItem := items[0].(map[string]interface{})
	if firstItem["name"] != "运动速干衣" {
		t.Fatalf("expected sport lightweight item to lead suggestions, got %+v", first)
	}
}

func TestGenerateOutfitSuggestionsPrefersFavoriteItems(t *testing.T) {
	router := setupTraceTestRouter(t, 101)
	for _, item := range []model.LifeTraceClosetItem{
		{
			UserID:          101,
			HouseholdID:     -101,
			Name:            "常穿西装外套",
			Category:        "外套",
			Color:           "藏青",
			WarmthLevel:     "常规",
			Seasons:         model.StringList{"春", "秋"},
			SceneTags:       model.StringList{"通勤"},
			Status:          "active",
			PreferenceLevel: "favorite",
		},
		{
			UserID:          101,
			HouseholdID:     -101,
			Name:            "普通西装外套",
			Category:        "外套",
			Color:           "灰色",
			WarmthLevel:     "常规",
			Seasons:         model.StringList{"春", "秋"},
			SceneTags:       model.StringList{"通勤"},
			Status:          "active",
			PreferenceLevel: "neutral",
		},
		{
			UserID:          101,
			HouseholdID:     -101,
			Name:            "西裤",
			Category:        "下装",
			Color:           "黑色",
			WarmthLevel:     "常规",
			Seasons:         model.StringList{"四季"},
			SceneTags:       model.StringList{"通勤"},
			Status:          "active",
			PreferenceLevel: "favorite",
		},
	} {
		if err := database.GetDB().Create(&item).Error; err != nil {
			t.Fatalf("seed closet item: %v", err)
		}
	}

	req := httptest.NewRequest(
		http.MethodPost,
		"/api/v1/life-trace/ai/outfit-suggestions",
		bytes.NewBufferString(`{"weatherText":"晴","temperature":24,"scene":"通勤"}`),
	)
	req.Header.Set("Content-Type", "application/json")
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	data := decodeTracePayload(t, resp)["data"].(map[string]interface{})
	suggestions := data["suggestions"].([]interface{})
	first := suggestions[0].(map[string]interface{})
	items := first["items"].([]interface{})
	names := make([]string, 0, len(items))
	for _, raw := range items {
		names = append(names, raw.(map[string]interface{})["name"].(string))
	}
	if !slices.Contains(names, "常穿西装外套") || slices.Contains(names, "普通西装外套") {
		t.Fatalf("expected favorite outerwear to outrank neutral one, got %+v", first)
	}
}

func TestGenerateOutfitSuggestionsUsesRuleFallback(t *testing.T) {
	router := setupTraceTestRouter(t, 101)
	for _, item := range []model.LifeTraceClosetItem{
		{UserID: 101, HouseholdID: -101, Name: "白 T", Category: "上装", Color: "白色", WarmthLevel: "轻薄", Seasons: model.StringList{"夏"}, SceneTags: model.StringList{"日常"}, Status: "active"},
		{UserID: 101, HouseholdID: -101, Name: "牛仔裤", Category: "下装", Color: "蓝色", WarmthLevel: "常规", Seasons: model.StringList{"四季"}, SceneTags: model.StringList{"日常"}, Status: "active"},
	} {
		if err := database.GetDB().Create(&item).Error; err != nil {
			t.Fatalf("seed closet item: %v", err)
		}
	}

	req := httptest.NewRequest(http.MethodPost, "/api/v1/life-trace/ai/outfit-suggestions", bytes.NewBufferString(`{"weatherText":"晴","temperature":28,"scene":"日常"}`))
	req.Header.Set("Content-Type", "application/json")
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	data := decodeTracePayload(t, resp)["data"].(map[string]interface{})
	suggestions := data["suggestions"].([]interface{})
	if len(suggestions) == 0 {
		t.Fatalf("expected rule outfit suggestions, got %+v", data)
	}
	first := suggestions[0].(map[string]interface{})
	if first["source"] != "rule" {
		t.Fatalf("expected rule fallback suggestion, got %+v", first)
	}
	_ = json.Valid([]byte(`{}`))
}
