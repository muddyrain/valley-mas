package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"

	"valley-server/internal/config"
	"valley-server/internal/database"
	"valley-server/internal/middleware"
	"valley-server/internal/model"
	"valley-server/internal/utils"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

const aiPlatformTestSecret = "ai-platform-test-secret"

func setupAIPlatformTestRouter(t *testing.T) (*gin.Engine, *gorm.DB) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(&model.User{}, &model.Workflow{}, &model.AIApp{}, &model.AIAppVersion{}); err != nil {
		t.Fatalf("migrate ai platform: %v", err)
	}
	if err := db.Create(&model.User{ID: 101, Username: "platform-user", Role: "user", IsActive: true}).Error; err != nil {
		t.Fatalf("seed user: %v", err)
	}
	previousDB := database.DB
	database.DB = db
	t.Cleanup(func() {
		database.DB = previousDB
		sqlDB, sqlErr := db.DB()
		if sqlErr == nil {
			_ = sqlDB.Close()
		}
	})
	router := gin.New()
	auth := router.Group("/ai")
	auth.Use(middleware.Auth(&config.Config{JWT: config.JWTConfig{Secret: aiPlatformTestSecret}}))
	auth.POST("/apps/:appId/versions", SaveAIAppVersion)
	auth.POST("/apps/:appId/restore", RestoreAIAppVersion)
	return router, db
}

func aiPlatformAuthHeader(t *testing.T) string {
	t.Helper()
	token, err := utils.GenerateToken("101", "platform-user", "user", aiPlatformTestSecret, 1)
	if err != nil {
		t.Fatalf("generate token: %v", err)
	}
	return "Bearer " + token
}

func TestSaveAIAppVersionUpdatesDraftVersionID(t *testing.T) {
	router, db := setupAIPlatformTestRouter(t)
	app := model.AIApp{UserID: 101, Type: aiAppTypeAgent, Name: "测试智能体"}
	if err := db.Create(&app).Error; err != nil {
		t.Fatalf("create app: %v", err)
	}
	body, _ := json.Marshal(map[string]any{"name": "测试智能体", "config": map[string]any{"systemPrompt": "你好"}})
	req := httptest.NewRequest(http.MethodPost, "/ai/apps/"+strconv.FormatInt(int64(app.ID), 10)+"/versions", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", aiPlatformAuthHeader(t))
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("save response = %d body=%s", rec.Code, rec.Body.String())
	}
	var stored model.AIApp
	if err := db.First(&stored, app.ID).Error; err != nil {
		t.Fatalf("load app: %v", err)
	}
	if stored.DraftVersionID == 0 {
		t.Fatal("expected saved version to become the draft version")
	}
	var version model.AIAppVersion
	if err := db.First(&version, stored.DraftVersionID).Error; err != nil {
		t.Fatalf("draft version not persisted: %v", err)
	}
}

func TestRestoreAIAppVersionCreatesNewDraftWithoutChangingPublishedVersion(t *testing.T) {
	router, db := setupAIPlatformTestRouter(t)
	app := model.AIApp{UserID: 101, Type: aiAppTypeAgent, Name: "回滚测试"}
	if err := db.Create(&app).Error; err != nil {
		t.Fatalf("create app: %v", err)
	}
	first := model.AIAppVersion{AppID: app.ID, Number: 1, Config: `{"systemPrompt":"旧版本"}`}
	second := model.AIAppVersion{AppID: app.ID, Number: 2, Config: `{"systemPrompt":"新版本"}`}
	if err := db.Create(&first).Error; err != nil {
		t.Fatalf("create first version: %v", err)
	}
	if err := db.Create(&second).Error; err != nil {
		t.Fatalf("create second version: %v", err)
	}
	if err := db.Model(&app).Updates(map[string]any{"draft_version_id": second.ID, "published_version_id": first.ID, "status": "published"}).Error; err != nil {
		t.Fatalf("set app pointers: %v", err)
	}
	body, _ := json.Marshal(map[string]any{"versionId": first.ID})
	req := httptest.NewRequest(http.MethodPost, "/ai/apps/"+strconv.FormatInt(int64(app.ID), 10)+"/restore", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", aiPlatformAuthHeader(t))
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("restore response = %d body=%s", rec.Code, rec.Body.String())
	}
	var stored model.AIApp
	if err := db.First(&stored, app.ID).Error; err != nil {
		t.Fatalf("load app: %v", err)
	}
	if stored.PublishedVersionID != first.ID {
		t.Fatalf("published version changed to %d, want %d", stored.PublishedVersionID, first.ID)
	}
	if stored.DraftVersionID == first.ID || stored.DraftVersionID == second.ID {
		t.Fatalf("restore must create a new draft, got %d", stored.DraftVersionID)
	}
	var restored model.AIAppVersion
	if err := db.First(&restored, stored.DraftVersionID).Error; err != nil {
		t.Fatalf("load restored draft: %v", err)
	}
	if restored.Number != 3 || restored.Config != first.Config {
		t.Fatalf("restored version = %#v, want copy of v1 as v3", restored)
	}
}

func TestSyncWorkflowAIAppReusesSingleUnlinkedWorkflowApp(t *testing.T) {
	_, db := setupAIPlatformTestRouter(t)
	workflow := model.Workflow{UserID: 101, Name: "自动导入博客", Graph: `{"nodes":[],"edges":[]}`, Status: "draft"}
	if err := db.Create(&workflow).Error; err != nil {
		t.Fatalf("create workflow: %v", err)
	}
	legacyApp := model.AIApp{UserID: 101, Type: aiAppTypeWorkflow, Name: workflow.Name, Status: "draft"}
	if err := db.Create(&legacyApp).Error; err != nil {
		t.Fatalf("create unlinked app: %v", err)
	}
	var synced model.AIApp
	if err := db.Transaction(func(tx *gorm.DB) error {
		var syncErr error
		synced, _, syncErr = syncWorkflowAIApp(tx, workflow)
		return syncErr
	}); err != nil {
		t.Fatalf("sync workflow app: %v", err)
	}
	if synced.ID != legacyApp.ID || synced.WorkflowID == nil || *synced.WorkflowID != workflow.ID {
		t.Fatalf("workflow app was not safely linked: %#v", synced)
	}
	var count int64
	if err := db.Model(&model.AIApp{}).Where("user_id = ? AND type = ?", 101, aiAppTypeWorkflow).Count(&count).Error; err != nil {
		t.Fatalf("count workflow apps: %v", err)
	}
	if count != 1 {
		t.Fatalf("workflow app count = %d, want 1", count)
	}
}
