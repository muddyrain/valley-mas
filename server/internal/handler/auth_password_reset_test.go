package handler

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
	"valley-server/internal/database"
	"valley-server/internal/model"
	"valley-server/internal/utils"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func setupPasswordResetTestRouter(t *testing.T) *gin.Engine {
	t.Helper()
	gin.SetMode(gin.TestMode)
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(&model.User{}, &model.EmailVerificationCode{}, &model.EmailVerificationRateLimit{}); err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&model.User{
		ID:       101,
		Username: "reset-user",
		Email:    "reset@example.com",
		Password: utils.HashPassword("old-password"),
		Role:     "user",
		IsActive: true,
	}).Error; err != nil {
		t.Fatal(err)
	}

	previousDB := database.DB
	database.DB = db
	t.Cleanup(func() {
		database.DB = previousDB
		if sqlDB, sqlErr := db.DB(); sqlErr == nil {
			_ = sqlDB.Close()
		}
	})

	router := gin.New()
	router.POST("/password/reset", ResetPassword)
	return router
}

func seedPasswordResetCode(t *testing.T, email, code string) {
	t.Helper()
	if err := database.GetDB().Create(&model.EmailVerificationCode{
		Email:      email,
		Purpose:    emailCodePurposeReset,
		CodeHash:   utils.HashPassword(code),
		ExpiresAt:  time.Now().Add(emailCodeTTL),
		LastSentAt: time.Now(),
	}).Error; err != nil {
		t.Fatal(err)
	}
}

func passwordResetResponseCode(t *testing.T, recorder *httptest.ResponseRecorder) int {
	t.Helper()
	var response struct {
		Code int `json:"code"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	return response.Code
}

func TestResetPasswordUpdatesPasswordAndConsumesCode(t *testing.T) {
	router := setupPasswordResetTestRouter(t)
	seedPasswordResetCode(t, "reset@example.com", "123456")

	request := httptest.NewRequest(
		http.MethodPost,
		"/password/reset",
		strings.NewReader(`{"email":"reset@example.com","verificationCode":"123456","newPassword":"new-password"}`),
	)
	request.Header.Set("Content-Type", "application/json")
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, request)
	if code := passwordResetResponseCode(t, recorder); code != 0 {
		t.Fatalf("reset failed: %s", recorder.Body.String())
	}

	var user model.User
	if err := database.GetDB().Where("email = ?", "reset@example.com").First(&user).Error; err != nil {
		t.Fatal(err)
	}
	if !utils.CheckPassword("new-password", user.Password) || utils.CheckPassword("old-password", user.Password) {
		t.Fatalf("password was not replaced")
	}
	if user.TokenVersion != 2 {
		t.Fatalf("token version = %d, want 2", user.TokenVersion)
	}

	replay := httptest.NewRequest(
		http.MethodPost,
		"/password/reset",
		strings.NewReader(`{"email":"reset@example.com","verificationCode":"123456","newPassword":"another-password"}`),
	)
	replay.Header.Set("Content-Type", "application/json")
	replayRecorder := httptest.NewRecorder()
	router.ServeHTTP(replayRecorder, replay)
	if code := passwordResetResponseCode(t, replayRecorder); code != http.StatusUnauthorized {
		t.Fatalf("used code should be rejected: %s", replayRecorder.Body.String())
	}
}
