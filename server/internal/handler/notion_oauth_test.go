package handler

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
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

func TestNotionConnectionStatusIsOwnerScopedAndNeverLeaksCredentials(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(&model.User{}, &model.ExternalConnection{}, &model.ExternalOAuthState{}, &model.ExternalConnectionAudit{}); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	if err := db.Create(&[]model.User{{ID: 101, Username: "notion-owner", Role: "user", IsActive: true}, {ID: 202, Username: "other-owner", Role: "user", IsActive: true}}).Error; err != nil {
		t.Fatalf("seed users: %v", err)
	}
	if err := db.Create(&model.ExternalConnection{
		ID:                    301,
		UserID:                101,
		Provider:              "notion",
		Status:                "connected",
		WorkspaceName:         "Private Workspace",
		AccessTokenCiphertext: "encrypted-value",
	}).Error; err != nil {
		t.Fatalf("seed connection: %v", err)
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

	cfg := &config.Config{
		JWT: config.JWTConfig{Secret: "notion-handler-test-secret"},
		NotionOAuth: config.NotionOAuthConfig{
			ClientID:     "notion-client",
			ClientSecret: "notion-secret",
			RedirectURL:  "http://localhost:8080/api/v1/integrations/notion/callback",
			TokenKey:     "12345678901234567890123456789012",
		},
	}
	router := gin.New()
	api := router.Group("/api/v1")
	auth := api.Group("")
	auth.Use(middleware.Auth(cfg))
	RegisterNotionOAuthRoutes(auth, api, cfg)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/integrations/notion", nil)
	req.Header.Set("Authorization", notionAuthHeader(t, "202", cfg.JWT.Secret))
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	var response struct {
		Code int `json:"code"`
		Data struct {
			Connected bool `json:"connected"`
		} `json:"data"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &response); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if response.Code != 0 || response.Data.Connected {
		t.Fatalf("owner-scoped status expected disconnected, got %s", rec.Body.String())
	}
	if body := rec.Body.String(); strings.Contains(body, "encrypted-value") || strings.Contains(body, "accessTokenCiphertext") || strings.Contains(body, "refreshTokenCiphertext") {
		t.Fatalf("credential leaked in response: %s", body)
	}
}

func notionAuthHeader(t *testing.T, userID string, secret string) string {
	t.Helper()
	token, err := utils.GenerateToken(userID, "tester", "user", secret, 1)
	if err != nil {
		t.Fatalf("generate token: %v", err)
	}
	return "Bearer " + token
}
