package lifetrace

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
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
