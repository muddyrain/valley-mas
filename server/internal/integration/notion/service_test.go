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
	if err := service.Disconnect(context.Background(), 101); err != nil {
		t.Fatalf("disconnect: %v", err)
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
