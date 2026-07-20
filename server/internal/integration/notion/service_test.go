package notion

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"valley-server/internal/config"
	mailvault "valley-server/internal/mail"
	"valley-server/internal/model"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func TestNotionOAuthStoresEncryptedOwnerPrivateConnectionAndRevokes(t *testing.T) {
	var revokeToken string
	provider := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Notion-Version") != notionAPIVersion {
			t.Fatalf("expected Notion-Version header, got %q", r.Header.Get("Notion-Version"))
		}
		if !strings.HasPrefix(r.Header.Get("Authorization"), "Basic ") {
			t.Fatalf("expected basic authorization header")
		}
		switch r.URL.Path {
		case "/token":
			var body map[string]string
			if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
				t.Fatal(err)
			}
			if body["grant_type"] != "authorization_code" || body["code"] != "temporary-code" {
				t.Fatalf("unexpected token request: %#v", body)
			}
			_, _ = w.Write([]byte(`{"access_token":"secret-access-token","refresh_token":"secret-refresh-token","bot_id":"bot-1","workspace_id":"workspace-1","workspace_name":"Valley Team"}`))
		case "/revoke":
			var body map[string]string
			if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
				t.Fatal(err)
			}
			revokeToken = body["token"]
			_, _ = w.Write([]byte(`{"request_id":"revoked"}`))
		default:
			t.Fatalf("unexpected provider path %q", r.URL.Path)
		}
	}))
	defer provider.Close()

	db := openTestDB(t)
	service := newTestService(t, db)
	service.tokenURL = provider.URL + "/token"
	service.revokeURL = provider.URL + "/revoke"

	authURL, err := service.Start(context.Background(), 101)
	if err != nil {
		t.Fatalf("start: %v", err)
	}
	parsed, err := url.Parse(authURL)
	if err != nil {
		t.Fatal(err)
	}
	state := parsed.Query().Get("state")
	if state == "" || parsed.Query().Get("owner") != "user" || parsed.Query().Get("response_type") != "code" {
		t.Fatalf("unexpected authorization URL %q", authURL)
	}

	if err := service.Complete(context.Background(), state, "temporary-code"); err != nil {
		t.Fatalf("complete: %v", err)
	}
	status, err := service.Status(context.Background(), 101)
	if err != nil {
		t.Fatalf("status: %v", err)
	}
	if !status.Connected || status.WorkspaceName != "Valley Team" || status.WorkspaceID != "workspace-1" {
		t.Fatalf("unexpected status: %#v", status)
	}

	var stored model.ExternalConnection
	if err := db.Where("user_id = ? AND provider = ?", 101, Provider).First(&stored).Error; err != nil {
		t.Fatalf("load stored connection: %v", err)
	}
	if stored.AccessTokenCiphertext == "secret-access-token" || strings.Contains(stored.AccessTokenCiphertext, "secret-access-token") {
		t.Fatalf("access token was not encrypted: %q", stored.AccessTokenCiphertext)
	}
	disconnectResult, err := service.Disconnect(context.Background(), 101)
	if err != nil {
		t.Fatalf("disconnect: %v", err)
	}
	if !disconnectResult.RemoteRevoked {
		t.Fatalf("disconnect result=%#v", disconnectResult)
	}
	if revokeToken != "secret-access-token" {
		t.Fatalf("expected external revoke with access token, got %q", revokeToken)
	}
	status, err = service.Status(context.Background(), 101)
	if err != nil {
		t.Fatalf("status after disconnect: %v", err)
	}
	if status.Connected {
		t.Fatalf("connection should be removed after revocation")
	}
}

func TestNotionConnectionWithRotatedTokenKeyRequiresReconnectAndCanBeCleanedUp(t *testing.T) {
	db := openTestDB(t)
	service := newTestService(t, db)
	oldVault, err := mailvault.NewCredentialVault("abcdefghijklmnopqrstuvwxzy123456")
	if err != nil {
		t.Fatal(err)
	}
	ciphertext, err := oldVault.Encrypt("old-access-token")
	if err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&model.ExternalConnection{
		UserID:                101,
		Provider:              Provider,
		Status:                statusConnected,
		WorkspaceName:         "旧工作区",
		AccessTokenCiphertext: ciphertext,
		ConnectedAt:           service.now(),
	}).Error; err != nil {
		t.Fatal(err)
	}

	status, err := service.Status(context.Background(), 101)
	if err != nil {
		t.Fatal(err)
	}
	if status.Connected || !status.ReconnectRequired || status.WorkspaceName != "旧工作区" {
		t.Fatalf("status=%#v", status)
	}

	disconnectResult, err := service.Disconnect(context.Background(), 101)
	if err != nil {
		t.Fatal(err)
	}
	if disconnectResult.RemoteRevoked {
		t.Fatalf("disconnect result=%#v", disconnectResult)
	}
	var remaining int64
	if err := db.Model(&model.ExternalConnection{}).Where("user_id = ? AND provider = ?", 101, Provider).Count(&remaining).Error; err != nil {
		t.Fatal(err)
	}
	if remaining != 0 {
		t.Fatalf("remaining connections=%d", remaining)
	}
	var audit model.ExternalConnectionAudit
	if err := db.Where("user_id = ? AND action = ?", 101, auditDisconnected).Order("created_at DESC").First(&audit).Error; err != nil {
		t.Fatal(err)
	}
	if audit.Status != "succeeded" || audit.Detail != "credential_unavailable_local_cleanup" {
		t.Fatalf("audit=%#v", audit)
	}
}

func TestNotionOAuthStateIsSingleUseAndOwnerScoped(t *testing.T) {
	db := openTestDB(t)
	service := newTestService(t, db)
	service.tokenURL = "http://127.0.0.1:1/token"

	authURL, err := service.Start(context.Background(), 202)
	if err != nil {
		t.Fatalf("start: %v", err)
	}
	parsed, err := url.Parse(authURL)
	if err != nil {
		t.Fatal(err)
	}
	state := parsed.Query().Get("state")
	if _, err := service.consumeState(context.Background(), state); err != nil {
		t.Fatalf("first state consumption: %v", err)
	}
	if _, err := service.consumeState(context.Background(), state); err == nil {
		t.Fatal("consumed OAuth state must not be reusable")
	}

	status, err := service.Status(context.Background(), 203)
	if err != nil {
		t.Fatalf("other owner status: %v", err)
	}
	if status.Connected {
		t.Fatal("another owner must not see a connection")
	}
}

func TestNotionSearchUsesEncryptedOwnerConnectionAndReturnsSafeResults(t *testing.T) {
	var requestCount int
	provider := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requestCount++
		if r.Method != http.MethodPost || r.URL.Path != "/search" {
			t.Fatalf("unexpected search request %s %s", r.Method, r.URL.Path)
		}
		if r.Header.Get("Authorization") != "Bearer secret-access-token" {
			t.Fatalf("authorization=%q", r.Header.Get("Authorization"))
		}
		if r.Header.Get("Notion-Version") != notionAPIVersion {
			t.Fatalf("notion version=%q", r.Header.Get("Notion-Version"))
		}
		var body map[string]any
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			t.Fatal(err)
		}
		if body["query"] != "项目计划" || body["page_size"] != float64(2) {
			t.Fatalf("body=%#v", body)
		}
		_, _ = w.Write([]byte(`{"results":[{"object":"page","id":"page-1","url":"https://www.notion.so/page-1","last_edited_time":"2026-07-20T08:00:00.000Z","properties":{"Name":{"type":"title","title":[{"plain_text":"项目计划"}]}},"ignored":"full-page-content"},{"object":"data_source","id":"source-1","url":"https://www.notion.so/source-1","last_edited_time":"2026-07-19T08:00:00Z","title":[{"plain_text":"项目数据源"}]},{"object":"comment","id":"comment-1","url":"https://www.notion.so/comment-1"}]}`))
	}))
	defer provider.Close()

	db := openTestDB(t)
	service := newTestService(t, db)
	service.searchURL = provider.URL + "/search"
	seedSearchConnection(t, db, service, 101)

	result, err := service.Search(context.Background(), 101, " 项目计划 ", 2)
	if err != nil {
		t.Fatalf("search: %v", err)
	}
	if requestCount != 1 || len(result.Items) != 2 {
		t.Fatalf("requestCount=%d result=%#v", requestCount, result)
	}
	if result.Items[0].Title != "项目计划" || result.Items[0].Kind != "page" || result.Items[0].LastEditedAt != "2026-07-20T08:00:00Z" {
		t.Fatalf("first item=%#v", result.Items[0])
	}
	if result.Items[1].Title != "项目数据源" || result.Items[1].Kind != "data_source" {
		t.Fatalf("second item=%#v", result.Items[1])
	}
	var audit model.ExternalConnectionAudit
	if err := db.Where("user_id = ? AND action = ?", 101, auditSearched).Order("created_at DESC").First(&audit).Error; err != nil {
		t.Fatalf("search audit: %v", err)
	}
	if audit.Status != "succeeded" || audit.Detail != "result_count=2" {
		t.Fatalf("audit=%#v", audit)
	}
	if _, err := service.Search(context.Background(), 202, "项目计划", 2); err == nil {
		t.Fatal("other owner must not be able to use the connection")
	}
	if requestCount != 1 {
		t.Fatalf("other owner unexpectedly reached provider: %d", requestCount)
	}
}

func seedSearchConnection(t *testing.T, db *gorm.DB, service *Service, userID int64) {
	t.Helper()
	vault, err := mailvault.NewCredentialVault(service.cfg.TokenKey)
	if err != nil {
		t.Fatal(err)
	}
	ciphertext, err := vault.Encrypt("secret-access-token")
	if err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&model.ExternalConnection{
		UserID:                model.Int64String(userID),
		Provider:              Provider,
		Status:                statusConnected,
		AccessTokenCiphertext: ciphertext,
		ConnectedAt:           service.now(),
	}).Error; err != nil {
		t.Fatal(err)
	}
}

func openTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open("file:"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(&model.ExternalConnection{}, &model.ExternalOAuthState{}, &model.ExternalConnectionAudit{}); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	return db
}

func newTestService(t *testing.T, db *gorm.DB) *Service {
	t.Helper()
	service, err := NewService(db, config.NotionOAuthConfig{
		ClientID:     "notion-client-id",
		ClientSecret: "notion-client-secret",
		RedirectURL:  "http://localhost:8080/api/v1/integrations/notion/callback",
		TokenKey:     "12345678901234567890123456789012",
	})
	if err != nil {
		t.Fatalf("new service: %v", err)
	}
	return service
}
