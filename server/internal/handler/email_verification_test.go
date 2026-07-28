package handler

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
	"valley-server/internal/config"
	"valley-server/internal/database"
	"valley-server/internal/model"
	"valley-server/internal/utils"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func setupEmailVerificationTestDB(t *testing.T) {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(&model.User{}, &model.EmailVerificationCode{}, &model.EmailVerificationRateLimit{}); err != nil {
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
}

func TestConsumeEmailVerificationCodeExpiresAfterTooManyAttempts(t *testing.T) {
	setupEmailVerificationTestDB(t)
	if err := database.GetDB().Create(&model.EmailVerificationCode{
		Email:      "verify@example.com",
		Purpose:    emailCodePurposeReset,
		CodeHash:   utils.HashPassword("123456"),
		ExpiresAt:  time.Now().Add(emailCodeTTL),
		LastSentAt: time.Now(),
	}).Error; err != nil {
		t.Fatal(err)
	}

	for attempt := 0; attempt < emailCodeMaxAttempts; attempt++ {
		if err := consumeEmailVerificationCode("verify@example.com", emailCodePurposeReset, "000000"); err == nil {
			t.Fatal("incorrect verification code should fail")
		}
	}
	if err := consumeEmailVerificationCode("verify@example.com", emailCodePurposeReset, "123456"); err == nil {
		t.Fatal("code should be removed after too many failed attempts")
	}
}

func TestReserveEmailCodeIPRateLimitsPersistentRecord(t *testing.T) {
	setupEmailVerificationTestDB(t)
	for request := 0; request < emailCodeIPMaxRequests; request++ {
		if err := reserveEmailCodeIP(database.GetDB(), "203.0.113.8"); err != nil {
			t.Fatalf("request %d should be allowed: %v", request+1, err)
		}
	}
	if err := reserveEmailCodeIP(database.GetDB(), "203.0.113.8"); err == nil {
		t.Fatal("request over the IP limit should fail")
	}
}

func TestResetEmailCodeRequestDoesNotRevealUnknownEmail(t *testing.T) {
	setupEmailVerificationTestDB(t)
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.POST("/email-code/send", SendEmailVerificationCode(&config.Config{}))

	req := httptest.NewRequest(http.MethodPost, "/email-code/send", strings.NewReader(`{"email":"unknown@example.com","purpose":"reset"}`))
	req.Header.Set("Content-Type", "application/json")
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	var payload struct {
		Code int `json:"code"`
	}
	if err := json.Unmarshal(resp.Body.Bytes(), &payload); err != nil {
		t.Fatal(err)
	}
	if payload.Code != 0 {
		t.Fatalf("unknown reset email should receive generic success: %s", resp.Body.String())
	}
}
