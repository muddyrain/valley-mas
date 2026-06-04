package middleware

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"valley-server/internal/config"
	"valley-server/internal/database"
	"valley-server/internal/model"
	"valley-server/internal/utils"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func TestAuthReturnsServiceUnavailableWhenDatabaseFails(t *testing.T) {
	gin.SetMode(gin.TestMode)

	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite db: %v", err)
	}
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatalf("get sql db: %v", err)
	}
	if err := sqlDB.Close(); err != nil {
		t.Fatalf("close sql db: %v", err)
	}

	previousDB := database.DB
	database.DB = db
	t.Cleanup(func() {
		database.DB = previousDB
	})

	cfg := &config.Config{JWT: config.JWTConfig{Secret: "test-secret"}}
	token, err := utils.GenerateToken("123", "tester", "user", cfg.JWT.Secret, 1)
	if err != nil {
		t.Fatalf("generate token: %v", err)
	}

	router := gin.New()
	router.GET("/private", Auth(cfg), func(c *gin.Context) {
		c.Status(http.StatusNoContent)
	})

	req := httptest.NewRequest(http.MethodGet, "/private", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected status %d, got %d: %s", http.StatusServiceUnavailable, resp.Code, resp.Body.String())
	}

	var payload map[string]interface{}
	if err := json.Unmarshal(resp.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if payload["errorCode"] != authErrorCodeUserQueryFailed {
		t.Fatalf("expected errorCode %s, got %+v", authErrorCodeUserQueryFailed, payload)
	}
}

func TestAuthReturnsDatabaseUnavailableCodeWhenDatabaseIsMissing(t *testing.T) {
	gin.SetMode(gin.TestMode)

	previousDB := database.DB
	database.DB = nil
	t.Cleanup(func() {
		database.DB = previousDB
	})

	cfg := &config.Config{JWT: config.JWTConfig{Secret: "test-secret"}}
	token, err := utils.GenerateToken("123", "tester", "user", cfg.JWT.Secret, 1)
	if err != nil {
		t.Fatalf("generate token: %v", err)
	}

	router := gin.New()
	router.GET("/private", Auth(cfg), func(c *gin.Context) {
		c.Status(http.StatusNoContent)
	})

	req := httptest.NewRequest(http.MethodGet, "/private", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected status %d, got %d: %s", http.StatusServiceUnavailable, resp.Code, resp.Body.String())
	}

	var payload map[string]interface{}
	if err := json.Unmarshal(resp.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if payload["errorCode"] != authErrorCodeDBUnavailable {
		t.Fatalf("expected errorCode %s, got %+v", authErrorCodeDBUnavailable, payload)
	}
}

func TestAuthReturnsUnauthorizedForExpiredToken(t *testing.T) {
	gin.SetMode(gin.TestMode)

	cfg := &config.Config{JWT: config.JWTConfig{Secret: "test-secret"}}
	token, err := utils.GenerateToken("123", "tester", "user", cfg.JWT.Secret, -1)
	if err != nil {
		t.Fatalf("generate token: %v", err)
	}

	router := gin.New()
	router.GET("/private", Auth(cfg), func(c *gin.Context) {
		c.Status(http.StatusNoContent)
	})

	req := httptest.NewRequest(http.MethodGet, "/private", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusUnauthorized {
		t.Fatalf("expected status %d, got %d: %s", http.StatusUnauthorized, resp.Code, resp.Body.String())
	}
}

func TestAuthReturnsForbiddenForInactiveUser(t *testing.T) {
	gin.SetMode(gin.TestMode)

	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite db: %v", err)
	}
	if err := db.AutoMigrate(&model.User{}); err != nil {
		t.Fatalf("migrate user: %v", err)
	}
	if err := db.Create(&model.User{
		ID:       123,
		Username: "tester",
		Role:     "user",
		IsActive: true,
	}).Error; err != nil {
		t.Fatalf("create user: %v", err)
	}
	if err := db.Model(&model.User{}).Where("id = ?", 123).Update("is_active", false).Error; err != nil {
		t.Fatalf("deactivate user: %v", err)
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

	cfg := &config.Config{JWT: config.JWTConfig{Secret: "test-secret"}}
	token, err := utils.GenerateToken("123", "tester", "user", cfg.JWT.Secret, 1)
	if err != nil {
		t.Fatalf("generate token: %v", err)
	}

	router := gin.New()
	router.GET("/private", Auth(cfg), func(c *gin.Context) {
		c.Status(http.StatusNoContent)
	})

	req := httptest.NewRequest(http.MethodGet, "/private", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusForbidden {
		t.Fatalf("expected status %d, got %d: %s", http.StatusForbidden, resp.Code, resp.Body.String())
	}
}
