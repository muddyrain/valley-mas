package lifetrace

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"valley-server/internal/config"
	"valley-server/internal/database"
	"valley-server/internal/model"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func setupTraceTestRouter(t *testing.T, userID model.Int64String, webPush ...config.WebPushConfig) *gin.Engine {
	t.Helper()

	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite db: %v", err)
	}
	if err := db.AutoMigrate(
		&model.Household{},
		&model.HouseholdMember{},
		&model.HouseholdInvite{},
		&model.LifeTracePlan{},
		&model.LifeTraceCheckin{},
		&model.LifeTraceTrace{},
		&model.LifeTracePantryItem{},
		&model.LifeTraceSettings{},
		&model.LifeTraceWeeklyReview{},
		&model.LifeTraceAIConversation{},
		&model.LifeTraceAIMessage{},
		&model.LifeTracePushSubscription{},
		&model.LifeTracePushDelivery{},
		&model.LifeTraceDailyBriefDelivery{},
		&model.LifeTracePantryReminderDelivery{},
		&model.LifeTraceHolidayCalendar{},
	); err != nil {
		t.Fatalf("migrate test db: %v", err)
	}

	previousDB := database.DB
	database.DB = db
	t.Cleanup(func() {
		database.DB = previousDB
	})

	gin.SetMode(gin.TestMode)
	router := gin.New()
	auth := func(c *gin.Context) {
		c.Set("userId", userID)
		c.Next()
	}
	handlerArgs := []config.WebPushConfig{}
	if len(webPush) > 0 {
		handlerArgs = append(handlerArgs, webPush[0])
	}
	RegisterRoutes(router.Group("/api/v1"), NewHandler(NewWeatherService(config.QWeatherConfig{}), handlerArgs...), auth)
	return router
}

func decodeTracePayload(t *testing.T, recorder *httptest.ResponseRecorder) map[string]interface{} {
	t.Helper()

	var payload map[string]interface{}
	if err := json.Unmarshal(recorder.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode response: %v\nbody: %s", err, recorder.Body.String())
	}
	if payload["code"].(float64) != 0 {
		t.Fatalf("expected success response, got %+v", payload)
	}
	return payload
}

func TestCreateAndListTracesForCurrentUser(t *testing.T) {
	router := setupTraceTestRouter(t, 101)

	body := bytes.NewBufferString(`{
		"title": "晚饭散步",
		"summary": "饭后走了二十分钟，状态轻一点。",
		"timeLabel": "今天 20:10",
		"location": "小区",
		"mood": "放松",
		"tags": ["计划完成", "生活迹"],
		"source": "计划"
	}`)
	createReq := httptest.NewRequest(http.MethodPost, "/api/v1/life-trace/traces", body)
	createReq.Header.Set("Content-Type", "application/json")
	createResp := httptest.NewRecorder()

	router.ServeHTTP(createResp, createReq)

	if createResp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", createResp.Code)
	}
	created := decodeTracePayload(t, createResp)["data"].(map[string]interface{})
	if created["title"] != "晚饭散步" {
		t.Fatalf("unexpected created trace: %+v", created)
	}
	if created["source"] != "计划" {
		t.Fatalf("expected source 计划, got %+v", created["source"])
	}

	listReq := httptest.NewRequest(http.MethodGet, "/api/v1/life-trace/traces", nil)
	listResp := httptest.NewRecorder()
	router.ServeHTTP(listResp, listReq)

	list := decodeTracePayload(t, listResp)["data"].(map[string]interface{})["list"].([]interface{})
	if len(list) != 1 {
		t.Fatalf("expected one trace, got %+v", list)
	}
	trace := list[0].(map[string]interface{})
	if trace["title"] != "晚饭散步" {
		t.Fatalf("unexpected listed trace: %+v", trace)
	}
	tags := trace["tags"].([]interface{})
	if len(tags) != 2 || tags[0] != "计划完成" {
		t.Fatalf("expected tags to round-trip, got %+v", tags)
	}
}

func TestCreateTraceAcceptsPantrySource(t *testing.T) {
	router := setupTraceTestRouter(t, 101)

	body := bytes.NewBufferString(`{
		"title": "新增库存：牛奶",
		"summary": "Life Trace 已将牛奶加入家庭库存。",
		"timeLabel": "今天 10:00",
		"location": "冷藏",
		"mood": "踏实",
		"tags": ["食品", "家庭库存", "新增库存"],
		"source": "库存"
	}`)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/life-trace/traces", body)
	req.Header.Set("Content-Type", "application/json")
	resp := httptest.NewRecorder()

	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.Code)
	}
	created := decodeTracePayload(t, resp)["data"].(map[string]interface{})
	if created["source"] != "库存" {
		t.Fatalf("expected source 库存, got %+v", created["source"])
	}
}

func TestListTracesOnlyReturnsCurrentUserData(t *testing.T) {
	router := setupTraceTestRouter(t, 101)
	if err := database.GetDB().Create(&model.LifeTraceTrace{
		UserID:    202,
		Title:     "别人的踪迹",
		Summary:   "不应该出现在当前用户列表",
		TimeLabel: "今天 12:00",
		Mood:      "放松",
		Source:    "手动",
		Tags:      model.StringList{"生活迹"},
	}).Error; err != nil {
		t.Fatalf("seed other user trace: %v", err)
	}

	req := httptest.NewRequest(http.MethodGet, "/api/v1/life-trace/traces", nil)
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	list := decodeTracePayload(t, resp)["data"].(map[string]interface{})["list"].([]interface{})
	if len(list) != 0 {
		t.Fatalf("expected no current user traces, got %+v", list)
	}
}

func TestListTracesReturnsPagination(t *testing.T) {
	router := setupTraceTestRouter(t, 101)
	for index := 0; index < 23; index++ {
		if err := database.GetDB().Create(&model.LifeTraceTrace{
			UserID:    101,
			Title:     "分页踪迹",
			Summary:   "用于分页测试",
			TimeLabel: "今天 20:00",
			Mood:      "放松",
			Tags:      model.StringList{"生活迹"},
			Source:    "手动",
		}).Error; err != nil {
			t.Fatalf("seed trace: %v", err)
		}
	}

	req := httptest.NewRequest(http.MethodGet, "/api/v1/life-trace/traces?page=2&pageSize=10", nil)
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
	if pagination["total"] != float64(23) || pagination["hasMore"] != true {
		t.Fatalf("expected total and hasMore, got %+v", pagination)
	}
}

func TestUpdateTraceForCurrentUser(t *testing.T) {
	router := setupTraceTestRouter(t, 101)
	trace := model.LifeTraceTrace{
		UserID:    101,
		Title:     "旧标题",
		Summary:   "旧摘要",
		TimeLabel: "昨天 19:00",
		Location:  "旧地点",
		Mood:      "平静",
		Tags:      model.StringList{"生活迹"},
		Source:    "手动",
	}
	if err := database.GetDB().Create(&trace).Error; err != nil {
		t.Fatalf("seed trace: %v", err)
	}

	body := bytes.NewBufferString(`{
		"title": "晚饭散步",
		"summary": "饭后走了二十分钟，状态轻一点。",
		"timeLabel": "今天 20:10",
		"location": "小区",
		"imageUrl": "https://example.com/walk.jpg",
		"mood": "放松",
		"tags": ["计划完成", "散步"],
		"source": "计划"
	}`)
	req := httptest.NewRequest(http.MethodPatch, "/api/v1/life-trace/traces/"+trace.ID.String(), body)
	req.Header.Set("Content-Type", "application/json")
	resp := httptest.NewRecorder()

	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.Code)
	}
	updated := decodeTracePayload(t, resp)["data"].(map[string]interface{})
	if updated["title"] != "晚饭散步" {
		t.Fatalf("unexpected updated trace: %+v", updated)
	}
	if updated["source"] != "计划" {
		t.Fatalf("expected source 计划, got %+v", updated["source"])
	}
	tags := updated["tags"].([]interface{})
	if len(tags) != 2 || tags[1] != "散步" {
		t.Fatalf("expected tags to update, got %+v", tags)
	}
}
