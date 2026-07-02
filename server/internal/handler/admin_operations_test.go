package handler

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
	"valley-server/internal/database"
	"valley-server/internal/logger"
	"valley-server/internal/model"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/sirupsen/logrus"
	"gorm.io/gorm"
)

func ioNopCloser(value string) io.ReadCloser {
	return io.NopCloser(strings.NewReader(value))
}

func setupAdminOperationsTestDB(t *testing.T) *gin.Engine {
	t.Helper()
	gin.SetMode(gin.TestMode)

	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(
		&model.User{},
		&model.GuestbookMessage{},
		&model.OperationLog{},
		&model.AIUsageLog{},
		&model.CodeAccessLog{},
		&model.PostCategory{},
		&model.PostTag{},
		&model.Post{},
		&model.PostComment{},
		&model.Creator{},
		&model.CreatorAlbum{},
		&model.Resource{},
		&model.DownloadRecord{},
		&model.UserFavorite{},
		&model.UserFollow{},
		&model.UserNotification{},
		&model.UserAvatarHistory{},
		&model.BlogCoverUpload{},
		&model.GuestbookMessage{},
		&model.LifeTracePlan{},
		&model.LifeTraceTrace{},
		&model.LifeTracePantryItem{},
		&model.LifeTraceAIConversation{},
		&model.MindArenaDebateSession{},
		&model.MindArenaDebateMessage{},
		&model.MindArenaDebateScore{},
	); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	database.DB = db
	logger.Log = logrus.New()
	logger.Log.SetOutput(io.Discard)

	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set("userId", int64(1))
		c.Set("userRole", "admin")
		c.Next()
	})
	router.GET("/admin/guestbook/messages", AdminListGuestbookMessages)
	router.PATCH("/admin/guestbook/messages/:id/status", AdminUpdateGuestbookMessageStatus)
	router.GET("/admin/audit/operation-logs", AdminListOperationLogs)
	router.GET("/admin/audit/code-access-logs", AdminListCodeAccessLogs)
	router.GET("/admin/audit/storage-assets", AdminListStorageAssets)
	router.GET("/admin/ai/usage-logs", AdminListAIUsageLogs)
	router.GET("/admin/ai/usage-summary", AdminGetAIUsageSummary)
	router.POST("/admin/blog/categories", AdminCreateBlogCategory)
	router.GET("/admin/blog/categories", AdminListBlogCategories)
	router.GET("/admin/notifications", AdminListNotifications)
	router.GET("/admin/users/:id/operations", AdminGetUserOperations)
	router.GET("/admin/resources/:id/operations", AdminGetResourceOperations)
	router.GET("/admin/mind-arena/debates", AdminListMindArenaDebates)
	router.GET("/admin/mind-arena/debates/:id", AdminGetMindArenaDebate)
	return router
}

func decodeResponseData(t *testing.T, recorder *httptest.ResponseRecorder) map[string]interface{} {
	t.Helper()
	var body struct {
		Code int                    `json:"code"`
		Data map[string]interface{} `json:"data"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode response: %v\n%s", err, recorder.Body.String())
	}
	if body.Code != 0 {
		t.Fatalf("unexpected response code %d body=%s", body.Code, recorder.Body.String())
	}
	return body.Data
}

func TestAdminListGuestbookMessagesIncludesNonApprovedAndFiltersStatus(t *testing.T) {
	router := setupAdminOperationsTestDB(t)
	userID := model.Int64String(1)
	if err := database.DB.Create(&[]model.GuestbookMessage{
		{ID: 11, UserID: &userID, Nickname: "Ann", Content: "visible", Status: "approved", IsPinned: true},
		{ID: 12, UserID: &userID, Nickname: "Ben", Content: "hidden", Status: "hidden"},
	}).Error; err != nil {
		t.Fatalf("seed guestbook: %v", err)
	}

	req := httptest.NewRequest(http.MethodGet, "/admin/guestbook/messages?status=hidden", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	data := decodeResponseData(t, rec)
	if got := int(data["total"].(float64)); got != 1 {
		t.Fatalf("total=%d, want 1", got)
	}
	list := data["list"].([]interface{})
	item := list[0].(map[string]interface{})
	if item["status"] != "hidden" || item["content"] != "hidden" {
		t.Fatalf("unexpected item: %#v", item)
	}
}

func TestAdminUpdateGuestbookMessageStatusRejectsUnsupportedStatus(t *testing.T) {
	router := setupAdminOperationsTestDB(t)
	if err := database.DB.Create(&model.GuestbookMessage{
		ID: 21, Nickname: "Ann", Content: "hello", Status: "approved",
	}).Error; err != nil {
		t.Fatalf("seed guestbook: %v", err)
	}

	req := httptest.NewRequest(http.MethodPatch, "/admin/guestbook/messages/21/status", nil)
	req.Body = http.NoBody
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	var body struct {
		Code int `json:"code"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if body.Code == 0 {
		t.Fatalf("empty status update should fail, body=%s", rec.Body.String())
	}
}

func TestAdminAuditListsApplyKeywordAndDateFilters(t *testing.T) {
	router := setupAdminOperationsTestDB(t)
	if err := database.DB.Create(&[]model.OperationLog{
		{ID: 31, LogID: "a", Method: "GET", Path: "/api/v1/admin/users", Status: 200, CreatedAt: time.Date(2026, 6, 1, 10, 0, 0, 0, time.UTC)},
		{ID: 32, LogID: "b", Method: "POST", Path: "/api/v1/public/resources", Status: 500, CreatedAt: time.Date(2026, 6, 3, 10, 0, 0, 0, time.UTC)},
	}).Error; err != nil {
		t.Fatalf("seed operation logs: %v", err)
	}
	if err := database.DB.Create(&[]model.CodeAccessLog{
		{ID: 41, CreatorID: 100, Code: "alpha", IP: "127.0.0.1", CreatedAt: time.Date(2026, 6, 2, 10, 0, 0, 0, time.UTC)},
		{ID: 42, CreatorID: 101, Code: "beta", IP: "10.0.0.1", CreatedAt: time.Date(2026, 6, 4, 10, 0, 0, 0, time.UTC)},
	}).Error; err != nil {
		t.Fatalf("seed code logs: %v", err)
	}

	req := httptest.NewRequest(http.MethodGet, "/admin/audit/operation-logs?keyword=admin&dateTo=2026-06-02", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	data := decodeResponseData(t, rec)
	if got := int(data["total"].(float64)); got != 1 {
		t.Fatalf("operation total=%d, want 1", got)
	}

	req = httptest.NewRequest(http.MethodGet, "/admin/audit/code-access-logs?keyword=alpha&dateFrom=2026-06-01", nil)
	rec = httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	data = decodeResponseData(t, rec)
	if got := int(data["total"].(float64)); got != 1 {
		t.Fatalf("code access total=%d, want 1", got)
	}
}

func TestAdminAIUsageLogsFilterAndSummary(t *testing.T) {
	router := setupAdminOperationsTestDB(t)
	if err := database.DB.Create(&[]model.AIUsageLog{
		{
			ID: 91, Feature: "valley-ai-chat", Provider: "ark", Model: "ep-text", UserID: "11",
			Status: "success", PromptChars: 12, ResponseChars: 20, TotalTokens: 0, LatencyMs: 120,
			CreatedAt: time.Date(2026, 6, 1, 10, 0, 0, 0, time.UTC),
		},
		{
			ID: 92, Feature: "life-trace-today-advice", Provider: "openai", Model: "gpt-test", UserID: "11",
			Status: "failed", PromptChars: 30, ResponseChars: 0, TotalTokens: 5, LatencyMs: 300,
			ErrorMessage: "upstream failed",
			CreatedAt:    time.Date(2026, 6, 2, 10, 0, 0, 0, time.UTC),
		},
		{
			ID: 93, Feature: "life-trace-weekly-review", Provider: "ark", Model: "ep-text", UserID: "12",
			Status: "success", PromptChars: 40, ResponseChars: 80, TotalTokens: 9, LatencyMs: 90,
			CreatedAt: time.Date(2026, 6, 3, 10, 0, 0, 0, time.UTC),
		},
	}).Error; err != nil {
		t.Fatalf("seed ai usage logs: %v", err)
	}

	req := httptest.NewRequest(http.MethodGet, "/admin/ai/usage-logs?status=failed&type=life-trace-today-advice&userId=11", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	data := decodeResponseData(t, rec)
	if got := int(data["total"].(float64)); got != 1 {
		t.Fatalf("ai usage total=%d, want 1", got)
	}
	item := data["list"].([]interface{})[0].(map[string]interface{})
	if item["feature"] != "life-trace-today-advice" || item["status"] != "failed" {
		t.Fatalf("unexpected ai usage item: %#v", item)
	}

	req = httptest.NewRequest(http.MethodGet, "/admin/ai/usage-summary?userId=11&dateFrom=2026-06-01&dateTo=2026-06-02", nil)
	rec = httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	data = decodeResponseData(t, rec)
	if got := int(data["calls"].(float64)); got != 2 {
		t.Fatalf("summary calls=%d, want 2 data=%#v", got, data)
	}
	if got := int(data["failures"].(float64)); got != 1 {
		t.Fatalf("summary failures=%d, want 1 data=%#v", got, data)
	}
	if got := int(data["promptChars"].(float64)); got != 42 {
		t.Fatalf("summary promptChars=%d, want 42 data=%#v", got, data)
	}
}

func TestAdminStorageAssetsExposeReferenceAndRisk(t *testing.T) {
	router := setupAdminOperationsTestDB(t)
	user := model.User{ID: 96, Nickname: "Asset User", OpenID: "asset-user", Username: "asset-user", Avatar: "https://cdn.example.com/avatar/current.png", IsActive: true}
	post := model.Post{ID: 97, Title: "Cover Post", Slug: "cover-post", Content: "content", AuthorID: user.ID, Cover: "https://cdn.example.com/cover/active.png", CoverStorageKey: "cover/active.png"}
	if err := database.DB.Create(&user).Error; err != nil {
		t.Fatalf("seed user: %v", err)
	}
	if err := database.DB.Create(&post).Error; err != nil {
		t.Fatalf("seed post: %v", err)
	}
	if err := database.DB.Create(&[]model.Resource{
		{ID: 98, UserID: user.ID, Title: "Resource Asset", URL: "https://cdn.example.com/resource.png", StorageKey: "resource/r.png", Visibility: "public"},
	}).Error; err != nil {
		t.Fatalf("seed resource: %v", err)
	}
	if err := database.DB.Create(&[]model.UserAvatarHistory{
		{ID: 99, UserID: user.ID, AvatarURL: "https://cdn.example.com/avatar/current.png", StorageKey: "avatar/current.png"},
		{ID: 100, UserID: user.ID, AvatarURL: "https://cdn.example.com/avatar/old.png", StorageKey: "avatar/old.png"},
	}).Error; err != nil {
		t.Fatalf("seed avatars: %v", err)
	}
	if err := database.DB.Create(&[]model.BlogCoverUpload{
		{ID: 101, UserID: user.ID, URL: "https://cdn.example.com/cover/active.png", StorageKey: "cover/active.png", Status: "active", PostID: &post.ID},
		{ID: 102, UserID: user.ID, URL: "https://cdn.example.com/cover/tmp.png", StorageKey: "cover/tmp.png", Status: "tmp"},
	}).Error; err != nil {
		t.Fatalf("seed blog covers: %v", err)
	}

	req := httptest.NewRequest(http.MethodGet, "/admin/audit/storage-assets?risk=orphan-suspected", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	data := decodeResponseData(t, rec)
	if got := int(data["total"].(float64)); got != 2 {
		t.Fatalf("storage orphan total=%d, want 2 data=%#v", got, data)
	}
	for _, raw := range data["list"].([]interface{}) {
		item := raw.(map[string]interface{})
		if item["risk"] != "orphan-suspected" || item["referenced"] != false {
			t.Fatalf("unexpected orphan item: %#v", item)
		}
	}

	req = httptest.NewRequest(http.MethodGet, "/admin/audit/storage-assets?kind=avatar&keyword=current", nil)
	rec = httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	data = decodeResponseData(t, rec)
	item := data["list"].([]interface{})[0].(map[string]interface{})
	if item["referenced"] != true || int(item["referenceCount"].(float64)) != 1 {
		t.Fatalf("current avatar should be referenced: %#v", item)
	}
}

func TestAdminBlogCategoryCreateAndList(t *testing.T) {
	router := setupAdminOperationsTestDB(t)

	req := httptest.NewRequest(http.MethodPost, "/admin/blog/categories", nil)
	req.Body = ioNopCloser(`{"name":"运营","slug":"ops","description":"运营内容","sortOrder":3}`)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	decodeResponseData(t, rec)

	req = httptest.NewRequest(http.MethodGet, "/admin/blog/categories?keyword=运营", nil)
	rec = httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	data := decodeResponseData(t, rec)
	if got := int(data["total"].(float64)); got != 1 {
		t.Fatalf("category total=%d, want 1", got)
	}
}

func TestAdminListNotificationsFiltersReadState(t *testing.T) {
	router := setupAdminOperationsTestDB(t)
	if err := database.DB.Create(&[]model.UserNotification{
		{ID: 51, UserID: 1, Type: "system", Title: "Unread", Content: "A", IsRead: false},
		{ID: 52, UserID: 1, Type: "system", Title: "Read", Content: "B", IsRead: true},
	}).Error; err != nil {
		t.Fatalf("seed notifications: %v", err)
	}

	req := httptest.NewRequest(http.MethodGet, "/admin/notifications?isRead=false", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	data := decodeResponseData(t, rec)
	if got := int(data["total"].(float64)); got != 1 {
		t.Fatalf("notification total=%d, want 1", got)
	}
	list := data["list"].([]interface{})
	if list[0].(map[string]interface{})["title"] != "Unread" {
		t.Fatalf("unexpected notification list: %#v", list)
	}
}

func TestAdminGetUserOperationsReturnsAggregatedActivity(t *testing.T) {
	router := setupAdminOperationsTestDB(t)
	user := model.User{ID: 61, Nickname: "Ops User", OpenID: "ops-user", Username: "ops-user", Role: "user", IsActive: true}
	creatorUser := model.User{ID: 62, Nickname: "Creator", OpenID: "creator", Username: "creator-user", Role: "creator", IsActive: true}
	creator := model.Creator{ID: 63, UserID: creatorUser.ID, Code: "CREATOR"}
	resource := model.Resource{ID: 64, UserID: creatorUser.ID, Title: "Ops Resource", URL: "https://example.com/a.png"}
	post := model.Post{ID: 65, Title: "Ops Post", Slug: "ops-post", Content: "content", AuthorID: creatorUser.ID}
	guestUserID := user.ID
	if err := database.DB.Create(&[]model.User{user, creatorUser}).Error; err != nil {
		t.Fatalf("seed users: %v", err)
	}
	if err := database.DB.Create(&creator).Error; err != nil {
		t.Fatalf("seed creator: %v", err)
	}
	if err := database.DB.Create(&resource).Error; err != nil {
		t.Fatalf("seed resource: %v", err)
	}
	if err := database.DB.Create(&post).Error; err != nil {
		t.Fatalf("seed post: %v", err)
	}
	seeds := []interface{}{
		&model.DownloadRecord{ID: 66, UserID: user.ID, ResourceID: resource.ID, CreatorID: creator.ID},
		&model.UserFavorite{ID: 67, UserID: user.ID, ResourceID: resource.ID},
		&model.UserFollow{ID: 68, UserID: user.ID, CreatorID: creator.ID},
		&model.UserNotification{ID: 69, UserID: user.ID, Type: "admin", Title: "Notice", Content: "Hello"},
		&model.PostComment{ID: 70, UserID: user.ID, PostID: post.ID, Content: "Comment"},
		&model.GuestbookMessage{ID: 71, UserID: &guestUserID, Nickname: "Ops User", Content: "Guestbook", Status: "approved"},
		&model.LifeTracePlan{ID: 72, UserID: user.ID, Title: "Plan", Type: "work", TimeLabel: "09:00"},
		&model.LifeTraceTrace{ID: 73, UserID: user.ID, Title: "Trace", Summary: "Done", TimeLabel: "today"},
		&model.LifeTracePantryItem{ID: 74, UserID: user.ID, Name: "Milk"},
		&model.LifeTraceAIConversation{ID: 75, UserID: user.ID, Title: "AI"},
	}
	for _, seed := range seeds {
		if err := database.DB.Create(seed).Error; err != nil {
			t.Fatalf("seed activity: %v", err)
		}
	}

	req := httptest.NewRequest(http.MethodGet, "/admin/users/61/operations", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	data := decodeResponseData(t, rec)
	summary := data["summary"].(map[string]interface{})
	if got := int(summary["downloads"].(float64)); got != 1 {
		t.Fatalf("downloads=%d, want 1 summary=%#v", got, summary)
	}
	lifeTrace := data["lifeTrace"].(map[string]interface{})
	if got := int(lifeTrace["plans"].(float64)); got != 1 {
		t.Fatalf("lifeTrace plans=%d, want 1 data=%#v", got, lifeTrace)
	}
}

func TestAdminGetResourceOperationsReturnsTagsAlbumsAndCounters(t *testing.T) {
	router := setupAdminOperationsTestDB(t)
	uploader := model.User{ID: 81, Nickname: "Uploader", OpenID: "uploader", Username: "uploader", Role: "creator", IsActive: true}
	creator := model.Creator{ID: 82, UserID: uploader.ID, Code: "UP"}
	resource := model.Resource{
		ID: 83, UserID: uploader.ID, Title: "Wallpaper", URL: "https://example.com/w.png",
		StorageKey: "resources/w.png", DownloadCount: 7, FavoriteCount: 3,
		Tags: model.StringList{"运营"},
	}
	album := model.CreatorAlbum{ID: 85, CreatorID: creator.ID, Name: "精选"}
	favUser := model.User{ID: 86, Nickname: "Fan", OpenID: "fan", Username: "fan", Role: "user", IsActive: true}
	if err := database.DB.Create(&[]model.User{uploader, favUser}).Error; err != nil {
		t.Fatalf("seed users: %v", err)
	}
	if err := database.DB.Create(&creator).Error; err != nil {
		t.Fatalf("seed creator: %v", err)
	}
	if err := database.DB.Create(&resource).Error; err != nil {
		t.Fatalf("seed resource: %v", err)
	}
	if err := database.DB.Create(&album).Error; err != nil {
		t.Fatalf("seed album: %v", err)
	}
	if err := database.DB.Model(&album).Association("Resources").Append(&resource); err != nil {
		t.Fatalf("append album resource: %v", err)
	}
	for _, seed := range []interface{}{
		&model.DownloadRecord{ID: 87, UserID: favUser.ID, ResourceID: resource.ID, CreatorID: creator.ID},
		&model.UserFavorite{ID: 88, UserID: favUser.ID, ResourceID: resource.ID},
	} {
		if err := database.DB.Create(seed).Error; err != nil {
			t.Fatalf("seed counters: %v", err)
		}
	}

	req := httptest.NewRequest(http.MethodGet, "/admin/resources/83/operations", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	data := decodeResponseData(t, rec)
	detail := data["resource"].(map[string]interface{})
	if detail["storageKey"] != "resources/w.png" {
		t.Fatalf("unexpected storageKey: %#v", detail)
	}
	if got := int(data["downloadCount"].(float64)); got != 1 {
		t.Fatalf("downloadCount=%d, want 1 data=%#v", got, data)
	}
	tags := data["tags"].([]interface{})
	albums := data["albums"].([]interface{})
	if len(tags) == 0 || tags[0].(string) != "运营" || albums[0].(map[string]interface{})["name"] != "精选" {
		t.Fatalf("unexpected tags/albums: tags=%#v albums=%#v", tags, albums)
	}
}

func TestAdminListMindArenaDebatesFiltersStatus(t *testing.T) {
	router := setupAdminOperationsTestDB(t)
	if err := database.DB.Create(&[]model.MindArenaDebateSession{
		{ID: "deb_done", Topic: "已完成议题", Mode: "funny", Status: "done", PersonaCount: 5, CurrentRound: 3},
		{ID: "deb_running", Topic: "进行中议题", Mode: "serious", Status: "running", PersonaCount: 5, CurrentRound: 1},
	}).Error; err != nil {
		t.Fatalf("seed mind arena debates: %v", err)
	}

	req := httptest.NewRequest(http.MethodGet, "/admin/mind-arena/debates?status=done", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	data := decodeResponseData(t, rec)
	if got := int(data["total"].(float64)); got != 1 {
		t.Fatalf("debate total=%d, want 1", got)
	}
	list := data["list"].([]interface{})
	if list[0].(map[string]interface{})["id"] != "deb_done" {
		t.Fatalf("unexpected debate list: %#v", list)
	}
}
