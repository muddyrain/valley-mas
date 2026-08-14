package handler

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"valley-server/internal/database"
	"valley-server/internal/model"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func TestDownloadResourceRespectsStoredLicense(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(&model.Resource{}, &model.DownloadRecord{}); err != nil {
		t.Fatal(err)
	}
	resources := []model.Resource{
		{ID: 701, UserID: 1, Title: "仅预览", URL: "https://example.com/preview.png", Type: "wallpaper", Visibility: "public", License: "preview_only", DownloadAllowed: false},
		{ID: 702, UserID: 1, Title: "可下载", URL: "https://example.com/download.png", Type: "wallpaper", Visibility: "public", License: "download_allowed", DownloadAllowed: true},
	}
	if err := db.Create(&resources).Error; err != nil {
		t.Fatal(err)
	}
	previousDB := database.DB
	database.DB = db
	t.Cleanup(func() {
		database.DB = previousDB
	})

	router := gin.New()
	router.POST("/public/resource/:id/download", DownloadResource)

	blocked := httptest.NewRecorder()
	router.ServeHTTP(blocked, httptest.NewRequest(http.MethodPost, "/public/resource/701/download", nil))
	var blockedResponse struct {
		Code int `json:"code"`
	}
	if err := json.Unmarshal(blocked.Body.Bytes(), &blockedResponse); err != nil {
		t.Fatal(err)
	}
	if blockedResponse.Code != http.StatusForbidden {
		t.Fatalf("preview-only resource status=%d body=%s", blocked.Code, blocked.Body.String())
	}

	allowed := httptest.NewRecorder()
	router.ServeHTTP(allowed, httptest.NewRequest(http.MethodPost, "/public/resource/702/download", nil))
	var response struct {
		Code int `json:"code"`
		Data struct {
			DownloadURL string `json:"downloadUrl"`
		} `json:"data"`
	}
	if err := json.Unmarshal(allowed.Body.Bytes(), &response); err != nil {
		t.Fatal(err)
	}
	if allowed.Code != http.StatusOK || response.Data.DownloadURL != resources[1].URL {
		t.Fatalf("unexpected allowed response: %s", allowed.Body.String())
	}
}

func TestUpdateResourcePersistsProvenancePolicy(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(&model.Resource{}); err != nil {
		t.Fatal(err)
	}
	resource := model.Resource{ID: 711, UserID: 42, Title: "图片", URL: "https://example.com/image.png", Type: "wallpaper", Visibility: "private"}
	if err := db.Create(&resource).Error; err != nil {
		t.Fatal(err)
	}
	previousDB := database.DB
	database.DB = db
	t.Cleanup(func() { database.DB = previousDB })

	router := gin.New()
	router.PATCH("/content/resources/:id", func(c *gin.Context) {
		c.Set("userId", int64(42))
		c.Set("userRole", "user")
		UpdateResource(c)
	})
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPatch, "/content/resources/711", strings.NewReader(`{"sourceKind":"licensed","sourceUrl":"https://example.com/source","license":"preview_only","downloadAllowed":false}`))
	request.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(recorder, request)
	if recorder.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s", recorder.Code, recorder.Body.String())
	}
	if err := db.First(&resource, "id = ?", resource.ID).Error; err != nil {
		t.Fatal(err)
	}
	if resource.SourceKind != "licensed" || resource.SourceURL != "https://example.com/source" || resource.License != "preview_only" || resource.DownloadAllowed {
		t.Fatalf("resource policy not persisted: %+v", resource)
	}
}
