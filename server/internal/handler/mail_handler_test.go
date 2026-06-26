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
	"valley-server/internal/mail"
	"valley-server/internal/middleware"
	"valley-server/internal/model"
	"valley-server/internal/utils"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

const mailTestSecret = "mail-test-secret"
const mailCredentialSecret = "12345678901234567890123456789012"

func setupMailTestRouter(t *testing.T) (*gin.Engine, *gorm.DB) {
	t.Helper()
	gin.SetMode(gin.TestMode)

	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(&model.User{}, &model.MailAccount{}, &model.MailMessage{}); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	if err := db.Create(&[]model.User{
		{ID: 101, Username: "mail-user", Role: "user", IsActive: true},
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

	cfg := &config.Config{
		JWT: config.JWTConfig{Secret: mailTestSecret},
		Mail: config.MailConfig{
			SecretKey:           mailCredentialSecret,
			PublicBaseURL:       "http://localhost:8080/api/v1",
			FrontendRedirectURL: "http://localhost:5177",
			GmailClientID:       "gmail-client",
			GmailClientSecret:   "gmail-secret",
			GmailRedirectURL:    "http://localhost:8080/api/v1/user/mail/accounts/gmail/callback",
		},
	}
	router := gin.New()
	user := router.Group("/user")
	user.Use(middleware.Auth(cfg))
	RegisterUserMailRoutes(user, cfg)
	return router, db
}

func mailAuthHeader(t *testing.T, userID string) string {
	t.Helper()
	token, err := utils.GenerateToken(userID, "tester", "user", mailTestSecret, 1)
	if err != nil {
		t.Fatalf("generate token: %v", err)
	}
	return "Bearer " + token
}

func decodeMailResponse(t *testing.T, rec *httptest.ResponseRecorder) map[string]interface{} {
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

func TestMailAccountBindingEncryptsCredentialAndHidesSecret(t *testing.T) {
	router, db := setupMailTestRouter(t)

	req := httptest.NewRequest(http.MethodPost, "/user/mail/accounts/qq-imap", strings.NewReader(`{"email":"me@qq.com","authorizationCode":"qq-auth-code"}`))
	req.Header.Set("Authorization", mailAuthHeader(t, "101"))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	account := decodeMailResponse(t, rec)
	if account["email"] != "me@qq.com" || account["provider"] != "qq_imap" {
		t.Fatalf("unexpected account response: %#v", account)
	}
	if _, exists := account["credentialCiphertext"]; exists {
		t.Fatalf("credential leaked in response: %#v", account)
	}

	var stored model.MailAccount
	if err := db.Where("email = ?", "me@qq.com").First(&stored).Error; err != nil {
		t.Fatalf("load stored account: %v", err)
	}
	if stored.CredentialCiphertext == "" || stored.CredentialCiphertext == "qq-auth-code" {
		t.Fatalf("credential should be encrypted, got %q", stored.CredentialCiphertext)
	}
}

func TestMailMessagesAreScopedToCurrentUser(t *testing.T) {
	router, db := setupMailTestRouter(t)

	account := model.MailAccount{ID: 301, UserID: 202, Provider: mail.ProviderQQIMAP, AuthType: "password", Email: "other@qq.com", Status: mail.AccountStatusConnected}
	if err := db.Create(&account).Error; err != nil {
		t.Fatalf("seed account: %v", err)
	}
	if err := db.Create(&model.MailMessage{
		ID:                401,
		UserID:            202,
		AccountID:         301,
		Provider:          mail.ProviderQQIMAP,
		ProviderMessageID: "msg-1",
		FromAddress:       "other@qq.com",
		Subject:           "Private",
		Snippet:           "hidden",
		TextBody:          "hidden body",
		SentAt:            time.Now(),
	}).Error; err != nil {
		t.Fatalf("seed message: %v", err)
	}

	req := httptest.NewRequest(http.MethodGet, "/user/mail/messages", nil)
	req.Header.Set("Authorization", mailAuthHeader(t, "101"))
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	data := decodeMailResponse(t, rec)
	list, ok := data["list"].([]interface{})
	if !ok {
		t.Fatalf("unexpected list response: %#v", data)
	}
	if len(list) != 0 {
		t.Fatalf("messages should be scoped to current user: %#v", list)
	}
}
