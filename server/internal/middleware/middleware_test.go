package middleware

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"valley-server/internal/config"
	"valley-server/internal/database"
	"valley-server/internal/model"
	"valley-server/internal/utils"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func TestCorsAllowsWorkflowRequestHeaders(t *testing.T) {
	gin.SetMode(gin.TestMode)

	router := gin.New()
	router.Use(Cors())

	for _, testCase := range []struct {
		name             string
		path             string
		method           string
		requestedHeaders string
	}{
		{name: "resume event stream", path: "/api/v1/workflows/1/runs/2/events", method: http.MethodGet, requestedHeaders: "authorization,last-event-id"},
		{name: "retry run", path: "/api/v1/workflows/1/runs/2/retry", method: http.MethodPost, requestedHeaders: "authorization,x-workflow-retry-confirmed"},
		{name: "resume run", path: "/api/v1/workflows/1/runs/2/resume", method: http.MethodPost, requestedHeaders: "authorization,x-workflow-resume-confirmed"},
	} {
		t.Run(testCase.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodOptions, testCase.path, nil)
			req.Header.Set("Origin", "https://www.muddyrain.top")
			req.Header.Set("Access-Control-Request-Method", testCase.method)
			req.Header.Set("Access-Control-Request-Headers", testCase.requestedHeaders)
			resp := httptest.NewRecorder()
			router.ServeHTTP(resp, req)

			if resp.Code != http.StatusNoContent {
				t.Fatalf("expected status %d, got %d: %s", http.StatusNoContent, resp.Code, resp.Body.String())
			}
			allowedHeaders := strings.ToLower(resp.Header().Get("Access-Control-Allow-Headers"))
			for _, requestedHeader := range strings.Split(testCase.requestedHeaders, ",") {
				if !strings.Contains(allowedHeaders, requestedHeader) {
					t.Fatalf("expected %s to be allowed, got %q", requestedHeader, resp.Header().Get("Access-Control-Allow-Headers"))
				}
			}
		})
	}
}

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

func TestAuthRejectsRevokedSession(t *testing.T) {
	gin.SetMode(gin.TestMode)

	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite db: %v", err)
	}
	if err := db.AutoMigrate(&model.User{}); err != nil {
		t.Fatalf("migrate user: %v", err)
	}
	if err := db.Create(&model.User{ID: 456, Username: "tester", Role: "user", IsActive: true, TokenVersion: 2}).Error; err != nil {
		t.Fatalf("create user: %v", err)
	}

	previousDB := database.DB
	database.DB = db
	t.Cleanup(func() {
		database.DB = previousDB
		if sqlDB, sqlErr := db.DB(); sqlErr == nil {
			_ = sqlDB.Close()
		}
	})

	cfg := &config.Config{JWT: config.JWTConfig{Secret: "test-secret"}}
	token, err := utils.GenerateTokenWithSessionVersion("456", "tester", "user", 1, cfg.JWT.Secret, 1)
	if err != nil {
		t.Fatalf("generate token: %v", err)
	}

	router := gin.New()
	router.GET("/private", Auth(cfg), func(c *gin.Context) { c.Status(http.StatusNoContent) })
	req := httptest.NewRequest(http.MethodGet, "/private", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusUnauthorized {
		t.Fatalf("expected status %d, got %d: %s", http.StatusUnauthorized, resp.Code, resp.Body.String())
	}
}
