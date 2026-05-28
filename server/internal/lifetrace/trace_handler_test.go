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

func setupTraceTestRouter(t *testing.T, userID model.Int64String) *gin.Engine {
	t.Helper()

	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite db: %v", err)
	}
	if err := db.AutoMigrate(
		&model.LifeTracePlan{},
		&model.LifeTraceCheckin{},
		&model.LifeTraceTrace{},
		&model.LifeTraceSettings{},
		&model.LifeTraceWeeklyReview{},
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
	RegisterRoutes(router.Group("/api/v1"), NewHandler(NewWeatherService(config.QWeatherConfig{})), auth)
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
