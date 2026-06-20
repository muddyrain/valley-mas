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

const preferenceTestSecret = "preference-test-secret"

func setupUserPreferenceTestRouter(t *testing.T) *gin.Engine {
	t.Helper()
	gin.SetMode(gin.TestMode)

	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(&model.User{}, &model.UserPreference{}); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	if err := db.Create(&[]model.User{
		{ID: 101, Username: "dock-user", Role: "user", IsActive: true},
		{ID: 202, Username: "other-user", Role: "user", IsActive: true},
	}).Error; err != nil {
		t.Fatalf("seed users: %v", err)
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

	cfg := &config.Config{JWT: config.JWTConfig{Secret: preferenceTestSecret}}
	router := gin.New()
	user := router.Group("/user")
	user.Use(middleware.Auth(cfg))
	user.GET("/preferences/:namespace", GetUserPreference)
	user.PUT("/preferences/:namespace", UpsertUserPreference)
	return router
}

func preferenceAuthHeader(t *testing.T, userID string) string {
	t.Helper()
	token, err := utils.GenerateToken(userID, "tester", "user", preferenceTestSecret, 1)
	if err != nil {
		t.Fatalf("generate token: %v", err)
	}
	return "Bearer " + token
}

func decodePreferenceResponse(t *testing.T, rec *httptest.ResponseRecorder) map[string]interface{} {
	t.Helper()
	var body struct {
		Code int                    `json:"code"`
		Data map[string]interface{} `json:"data"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode response: %v\n%s", err, rec.Body.String())
	}
	if body.Code != 0 {
		t.Fatalf("unexpected response code %d body=%s", body.Code, rec.Body.String())
	}
	return body.Data
}

func putPreference(t *testing.T, router *gin.Engine, userID string, namespace string, value string) map[string]interface{} {
	t.Helper()
	req := httptest.NewRequest(http.MethodPut, "/user/preferences/"+namespace, strings.NewReader(`{"value":`+jsonString(value)+`}`))
	req.Header.Set("Authorization", preferenceAuthHeader(t, userID))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	return decodePreferenceResponse(t, rec)
}

func getPreference(t *testing.T, router *gin.Engine, userID string, namespace string) map[string]interface{} {
	t.Helper()
	req := httptest.NewRequest(http.MethodGet, "/user/preferences/"+namespace, nil)
	req.Header.Set("Authorization", preferenceAuthHeader(t, userID))
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	return decodePreferenceResponse(t, rec)
}

func jsonString(value string) string {
	raw, _ := json.Marshal(value)
	return string(raw)
}

func TestUserPreferenceRequiresAuth(t *testing.T) {
	router := setupUserPreferenceTestRouter(t)

	req := httptest.NewRequest(http.MethodGet, "/user/preferences/desktop-os.dock", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected unauthorized, got %d body=%s", rec.Code, rec.Body.String())
	}
}

func TestUserPreferenceCreateAndUpdate(t *testing.T) {
	router := setupUserPreferenceTestRouter(t)

	created := putPreference(t, router, "101", "desktop-os.dock", `{"iconSize":56}`)
	if created["namespace"] != "desktop-os.dock" || created["value"] != `{"iconSize":56}` {
		t.Fatalf("unexpected created preference: %#v", created)
	}

	updated := putPreference(t, router, "101", "desktop-os.dock", `{"iconSize":64}`)
	if updated["id"] != created["id"] || updated["value"] != `{"iconSize":64}` {
		t.Fatalf("unexpected updated preference: created=%#v updated=%#v", created, updated)
	}

	fetched := getPreference(t, router, "101", "desktop-os.dock")
	if fetched["id"] != created["id"] || fetched["value"] != `{"iconSize":64}` {
		t.Fatalf("unexpected fetched preference: %#v", fetched)
	}
}

func TestUserPreferenceIsolatedByUser(t *testing.T) {
	router := setupUserPreferenceTestRouter(t)

	putPreference(t, router, "101", "desktop-os.dock", `{"iconSize":56}`)
	putPreference(t, router, "202", "desktop-os.dock", `{"iconSize":72}`)

	userPreference := getPreference(t, router, "101", "desktop-os.dock")
	otherPreference := getPreference(t, router, "202", "desktop-os.dock")
	if userPreference["value"] != `{"iconSize":56}` || otherPreference["value"] != `{"iconSize":72}` {
		t.Fatalf("preferences should be isolated: user=%#v other=%#v", userPreference, otherPreference)
	}
}

func TestUserPreferenceAllowsUnknownNamespace(t *testing.T) {
	router := setupUserPreferenceTestRouter(t)

	preference := putPreference(t, router, "101", "desktop-os.widgets", `{"visible":["weather"]}`)
	if preference["namespace"] != "desktop-os.widgets" || preference["value"] != `{"visible":["weather"]}` {
		t.Fatalf("unexpected preference: %#v", preference)
	}
}
