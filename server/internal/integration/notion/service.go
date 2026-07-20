package notion

import (
	"bytes"
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
	"valley-server/internal/config"
	mailvault "valley-server/internal/mail"
	"valley-server/internal/model"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const (
	Provider          = "notion"
	notionAuthURL     = "https://api.notion.com/v1/oauth/authorize"
	notionTokenURL    = "https://api.notion.com/v1/oauth/token"
	notionRevokeURL   = "https://api.notion.com/v1/oauth/revoke"
	notionSearchURL   = "https://api.notion.com/v1/search"
	notionAPIVersion  = "2026-03-11"
	oauthStateTTL     = 10 * time.Minute
	requestTimeout    = 12 * time.Second
	statusConnected   = "connected"
	auditStarted      = "authorization_started"
	auditConnected    = "connected"
	auditDisconnected = "disconnected"
	auditSearched     = "searched"
	auditFailed       = "failed"
)

var errNotConfigured = errors.New("Notion OAuth 尚未配置")

type ConnectionDTO struct {
	Connected         bool       `json:"connected"`
	Configured        bool       `json:"configured"`
	ReconnectRequired bool       `json:"reconnectRequired"`
	WorkspaceID       string     `json:"workspaceId,omitempty"`
	WorkspaceName     string     `json:"workspaceName,omitempty"`
	ConnectedAt       *time.Time `json:"connectedAt,omitempty"`
}

type DisconnectResult struct {
	RemoteRevoked bool `json:"remoteRevoked"`
}

// SearchItem is the safe, workflow-facing subset of a Notion search result.
// It intentionally excludes properties, page content, and provider metadata.
type SearchItem struct {
	ID           string `json:"id"`
	Title        string `json:"title"`
	URL          string `json:"url"`
	Kind         string `json:"kind"`
	LastEditedAt string `json:"lastEditedAt,omitempty"`
}

type SearchResult struct {
	Items []SearchItem `json:"items"`
}

type Service struct {
	db        *gorm.DB
	cfg       config.NotionOAuthConfig
	http      *http.Client
	authURL   string
	tokenURL  string
	revokeURL string
	searchURL string
	now       func() time.Time
}

func NewService(db *gorm.DB, cfg config.NotionOAuthConfig) (*Service, error) {
	if db == nil {
		return nil, errors.New("database is not initialized")
	}
	return &Service{
		db:        db,
		cfg:       cfg,
		http:      &http.Client{Timeout: requestTimeout},
		authURL:   notionAuthURL,
		tokenURL:  notionTokenURL,
		revokeURL: notionRevokeURL,
		searchURL: notionSearchURL,
		now:       func() time.Time { return time.Now().UTC() },
	}, nil
}

func (s *Service) IsConfigured() bool {
	if strings.TrimSpace(s.cfg.ClientID) == "" ||
		strings.TrimSpace(s.cfg.ClientSecret) == "" ||
		strings.TrimSpace(s.cfg.RedirectURL) == "" ||
		strings.TrimSpace(s.cfg.TokenKey) == "" {
		return false
	}
	_, err := mailvault.NewCredentialVault(s.cfg.TokenKey)
	return err == nil
}

func (s *Service) Status(ctx context.Context, userID int64) (ConnectionDTO, error) {
	result := ConnectionDTO{Configured: s.IsConfigured()}
	var connection model.ExternalConnection
	err := s.db.WithContext(ctx).
		Where("user_id = ? AND provider = ?", userID, Provider).
		First(&connection).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return result, nil
	}
	if err != nil {
		return ConnectionDTO{}, err
	}
	connectedAt := connection.ConnectedAt
	result.Connected = connection.Status == statusConnected
	result.WorkspaceID = connection.WorkspaceID
	result.WorkspaceName = connection.WorkspaceName
	result.ConnectedAt = &connectedAt
	if !result.Connected || !result.Configured {
		return result, nil
	}
	vault, err := mailvault.NewCredentialVault(s.cfg.TokenKey)
	if err != nil {
		return result, nil
	}
	if _, err := vault.Decrypt(connection.AccessTokenCiphertext); err != nil {
		result.Connected = false
		result.ReconnectRequired = true
	}
	return result, nil
}

func (s *Service) Start(ctx context.Context, userID int64) (string, error) {
	if !s.IsConfigured() {
		return "", errNotConfigured
	}
	state, err := randomState()
	if err != nil {
		return "", err
	}
	now := s.now()
	if err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		_ = tx.Where("expires_at < ? OR consumed_at IS NOT NULL", now).Delete(&model.ExternalOAuthState{}).Error
		if err := tx.Create(&model.ExternalOAuthState{
			Provider:  Provider,
			UserID:    model.Int64String(userID),
			StateHash: hashState(state),
			ExpiresAt: now.Add(oauthStateTTL),
		}).Error; err != nil {
			return err
		}
		return s.writeAudit(tx, userID, 0, auditStarted, "succeeded", "")
	}); err != nil {
		return "", err
	}
	values := url.Values{}
	values.Set("owner", "user")
	values.Set("client_id", s.cfg.ClientID)
	values.Set("redirect_uri", s.cfg.RedirectURL)
	values.Set("response_type", "code")
	values.Set("state", state)
	return s.authURL + "?" + values.Encode(), nil
}

func (s *Service) Complete(ctx context.Context, state string, code string) error {
	state = strings.TrimSpace(state)
	code = strings.TrimSpace(code)
	if state == "" || code == "" {
		return errors.New("Notion 授权参数不完整")
	}
	if !s.IsConfigured() {
		return errNotConfigured
	}
	userID, err := s.consumeState(ctx, state)
	if err != nil {
		return err
	}
	token, err := s.exchangeCode(ctx, code)
	if err != nil {
		_ = s.writeAudit(s.db.WithContext(ctx), userID, 0, auditConnected, auditFailed, "token_exchange_failed")
		return err
	}
	vault, err := mailvault.NewCredentialVault(s.cfg.TokenKey)
	if err != nil {
		return err
	}
	accessCiphertext, err := vault.Encrypt(token.AccessToken)
	if err != nil {
		return err
	}
	refreshCiphertext := ""
	if strings.TrimSpace(token.RefreshToken) != "" {
		refreshCiphertext, err = vault.Encrypt(token.RefreshToken)
		if err != nil {
			return err
		}
	}

	connection := model.ExternalConnection{
		UserID:                 model.Int64String(userID),
		Provider:               Provider,
		Status:                 statusConnected,
		ProviderAccountID:      trimValue(token.BotID, 120),
		WorkspaceID:            trimValue(token.WorkspaceID, 120),
		WorkspaceName:          trimValue(token.WorkspaceName, 240),
		AccessTokenCiphertext:  accessCiphertext,
		RefreshTokenCiphertext: refreshCiphertext,
		LastError:              "",
		ConnectedAt:            s.now(),
	}
	if err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Clauses(clause.OnConflict{
			Columns: []clause.Column{{Name: "user_id"}, {Name: "provider"}},
			DoUpdates: clause.AssignmentColumns([]string{
				"status", "provider_account_id", "workspace_id", "workspace_name",
				"access_token_ciphertext", "refresh_token_ciphertext", "last_error",
				"connected_at", "updated_at",
			}),
		}).Create(&connection).Error; err != nil {
			return err
		}
		var stored model.ExternalConnection
		if err := tx.Where("user_id = ? AND provider = ?", userID, Provider).First(&stored).Error; err != nil {
			return err
		}
		return s.writeAudit(tx, userID, stored.ID, auditConnected, "succeeded", "")
	}); err != nil {
		return err
	}
	return nil
}

func (s *Service) Disconnect(ctx context.Context, userID int64) (DisconnectResult, error) {
	if !s.IsConfigured() {
		return DisconnectResult{}, errNotConfigured
	}
	var connection model.ExternalConnection
	if err := s.db.WithContext(ctx).Where("user_id = ? AND provider = ?", userID, Provider).First(&connection).Error; err != nil {
		return DisconnectResult{}, err
	}
	vault, err := mailvault.NewCredentialVault(s.cfg.TokenKey)
	if err != nil {
		return DisconnectResult{}, err
	}
	accessToken, err := vault.Decrypt(connection.AccessTokenCiphertext)
	if err != nil {
		if cleanupErr := s.deleteConnection(ctx, userID, connection, "credential_unavailable_local_cleanup"); cleanupErr != nil {
			return DisconnectResult{}, cleanupErr
		}
		return DisconnectResult{RemoteRevoked: false}, nil
	}
	if err := s.revokeToken(ctx, accessToken); err != nil {
		_ = s.writeAudit(s.db.WithContext(ctx), userID, connection.ID, auditDisconnected, auditFailed, "token_revoke_failed")
		return DisconnectResult{}, err
	}
	if err := s.deleteConnection(ctx, userID, connection, ""); err != nil {
		return DisconnectResult{}, err
	}
	return DisconnectResult{RemoteRevoked: true}, nil
}

func (s *Service) deleteConnection(ctx context.Context, userID int64, connection model.ExternalConnection, detail string) error {
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Delete(&connection).Error; err != nil {
			return err
		}
		return s.writeAudit(tx, userID, connection.ID, auditDisconnected, "succeeded", detail)
	})
}

// Search queries only the current owner's authorized Notion workspace. The
// stored token is decrypted only for this request and never returned or logged.
func (s *Service) Search(ctx context.Context, userID int64, query string, limit int) (SearchResult, error) {
	if !s.IsConfigured() {
		return SearchResult{}, errNotConfigured
	}
	query = strings.TrimSpace(query)
	if length := len([]rune(query)); length == 0 || length > 200 {
		return SearchResult{}, errors.New("Notion 搜索关键词需为 1 到 200 个字符")
	}
	if limit == 0 {
		limit = 5
	}
	if limit < 1 || limit > 10 {
		return SearchResult{}, errors.New("Notion 搜索结果数量需为 1 到 10")
	}

	var connection model.ExternalConnection
	if err := s.db.WithContext(ctx).
		Where("user_id = ? AND provider = ? AND status = ?", userID, Provider, statusConnected).
		First(&connection).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			_ = s.writeAudit(s.db.WithContext(ctx), userID, 0, auditSearched, auditFailed, "not_connected")
			return SearchResult{}, errors.New("Notion 连接不存在，请先连接工作区")
		}
		return SearchResult{}, err
	}
	vault, err := mailvault.NewCredentialVault(s.cfg.TokenKey)
	if err != nil {
		return SearchResult{}, err
	}
	accessToken, err := vault.Decrypt(connection.AccessTokenCiphertext)
	if err != nil {
		_ = s.writeAudit(s.db.WithContext(ctx), userID, connection.ID, auditSearched, auditFailed, "credential_decrypt_failed")
		return SearchResult{}, errors.New("Notion 凭据无法解密，请重新连接")
	}

	result, err := s.searchRequest(ctx, accessToken, query, limit)
	if err != nil {
		_ = s.writeAudit(s.db.WithContext(ctx), userID, connection.ID, auditSearched, auditFailed, "provider_request_failed")
		return SearchResult{}, err
	}
	if err := s.writeAudit(s.db.WithContext(ctx), userID, connection.ID, auditSearched, "succeeded", fmt.Sprintf("result_count=%d", len(result.Items))); err != nil {
		return SearchResult{}, err
	}
	return result, nil
}

func (s *Service) consumeState(ctx context.Context, state string) (int64, error) {
	var stored model.ExternalOAuthState
	now := s.now()
	if err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("provider = ? AND state_hash = ? AND consumed_at IS NULL AND expires_at > ?", Provider, hashState(state), now).First(&stored).Error; err != nil {
			return err
		}
		result := tx.Model(&stored).Where("consumed_at IS NULL").Update("consumed_at", now)
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected != 1 {
			return errors.New("Notion 授权已失效")
		}
		return nil
	}); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return 0, errors.New("Notion 授权已失效或已使用")
		}
		return 0, err
	}
	return int64(stored.UserID), nil
}

func (s *Service) exchangeCode(ctx context.Context, code string) (tokenResponse, error) {
	body, err := json.Marshal(map[string]string{
		"grant_type":   "authorization_code",
		"code":         code,
		"redirect_uri": s.cfg.RedirectURL,
	})
	if err != nil {
		return tokenResponse{}, err
	}
	return s.oauthRequest(ctx, s.tokenURL, bytes.NewReader(body))
}

func (s *Service) revokeToken(ctx context.Context, token string) error {
	body, err := json.Marshal(map[string]string{"token": token})
	if err != nil {
		return err
	}
	_, err = s.oauthRequest(ctx, s.revokeURL, bytes.NewReader(body))
	return err
}

func (s *Service) oauthRequest(ctx context.Context, endpoint string, body io.Reader) (tokenResponse, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, body)
	if err != nil {
		return tokenResponse{}, err
	}
	encodedClient := base64.StdEncoding.EncodeToString([]byte(s.cfg.ClientID + ":" + s.cfg.ClientSecret))
	req.Header.Set("Authorization", "Basic "+encodedClient)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Notion-Version", notionAPIVersion)
	response, err := s.http.Do(req)
	if err != nil {
		return tokenResponse{}, err
	}
	defer response.Body.Close()
	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		return tokenResponse{}, fmt.Errorf("Notion OAuth 请求失败（HTTP %d）", response.StatusCode)
	}
	if endpoint == s.revokeURL {
		return tokenResponse{}, nil
	}
	var token tokenResponse
	if err := json.NewDecoder(io.LimitReader(response.Body, 1<<20)).Decode(&token); err != nil {
		return tokenResponse{}, errors.New("Notion token 响应无效")
	}
	if strings.TrimSpace(token.AccessToken) == "" {
		return tokenResponse{}, errors.New("Notion token 响应缺少访问凭据")
	}
	return token, nil
}

func (s *Service) searchRequest(ctx context.Context, accessToken, query string, limit int) (SearchResult, error) {
	body, err := json.Marshal(map[string]any{"query": query, "page_size": limit})
	if err != nil {
		return SearchResult{}, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, s.searchURL, bytes.NewReader(body))
	if err != nil {
		return SearchResult{}, err
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Notion-Version", notionAPIVersion)
	response, err := s.http.Do(req)
	if err != nil {
		return SearchResult{}, fmt.Errorf("Notion 搜索请求失败: %w", err)
	}
	defer response.Body.Close()
	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		return SearchResult{}, fmt.Errorf("Notion 搜索请求失败（HTTP %d）", response.StatusCode)
	}
	var payload notionSearchResponse
	if err := json.NewDecoder(io.LimitReader(response.Body, 1<<20)).Decode(&payload); err != nil {
		return SearchResult{}, errors.New("Notion 搜索响应无效")
	}
	items := make([]SearchItem, 0, len(payload.Results))
	for _, raw := range payload.Results {
		if raw.Object != "page" && raw.Object != "data_source" {
			continue
		}
		item, ok := safeSearchItem(raw)
		if !ok {
			continue
		}
		items = append(items, item)
		if len(items) == limit {
			break
		}
	}
	return SearchResult{Items: items}, nil
}

func (s *Service) writeAudit(db *gorm.DB, userID int64, connectionID model.Int64String, action, status, detail string) error {
	return db.Create(&model.ExternalConnectionAudit{
		ConnectionID: connectionID,
		UserID:       model.Int64String(userID),
		Provider:     Provider,
		Action:       action,
		Status:       status,
		Detail:       trimValue(detail, 240),
	}).Error
}

func randomState() (string, error) {
	raw := make([]byte, 32)
	if _, err := rand.Read(raw); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(raw), nil
}

func hashState(value string) string {
	digest := sha256.Sum256([]byte(value))
	return hex.EncodeToString(digest[:])
}

func trimValue(value string, limit int) string {
	value = strings.TrimSpace(value)
	if len(value) <= limit {
		return value
	}
	return value[:limit]
}

type tokenResponse struct {
	AccessToken   string `json:"access_token"`
	RefreshToken  string `json:"refresh_token"`
	BotID         string `json:"bot_id"`
	WorkspaceID   string `json:"workspace_id"`
	WorkspaceName string `json:"workspace_name"`
}

type notionSearchResponse struct {
	Results []notionSearchResult `json:"results"`
}

type notionSearchResult struct {
	Object         string                    `json:"object"`
	ID             string                    `json:"id"`
	URL            string                    `json:"url"`
	LastEditedTime string                    `json:"last_edited_time"`
	Title          []notionRichText          `json:"title"`
	Properties     map[string]notionProperty `json:"properties"`
}

type notionProperty struct {
	Type  string           `json:"type"`
	Title []notionRichText `json:"title"`
}

type notionRichText struct {
	PlainText string `json:"plain_text"`
}

func safeSearchItem(raw notionSearchResult) (SearchItem, bool) {
	id := trimValue(raw.ID, 120)
	if id == "" {
		return SearchItem{}, false
	}
	parsedURL, err := url.Parse(strings.TrimSpace(raw.URL))
	if err != nil || parsedURL.Scheme != "https" || parsedURL.Host == "" {
		return SearchItem{}, false
	}
	lastEditedAt := ""
	if parsed, parseErr := time.Parse(time.RFC3339, raw.LastEditedTime); parseErr == nil {
		lastEditedAt = parsed.UTC().Format(time.RFC3339)
	}
	title := richTextValue(raw.Title)
	if title == "" {
		for _, property := range raw.Properties {
			if property.Type == "title" {
				title = richTextValue(property.Title)
				break
			}
		}
	}
	if title == "" {
		title = "未命名 Notion 内容"
	}
	return SearchItem{
		ID:           id,
		Title:        trimRunes(title, 240),
		URL:          trimValue(parsedURL.String(), 2048),
		Kind:         raw.Object,
		LastEditedAt: lastEditedAt,
	}, true
}

func richTextValue(parts []notionRichText) string {
	texts := make([]string, 0, len(parts))
	for _, part := range parts {
		if value := strings.TrimSpace(part.PlainText); value != "" {
			texts = append(texts, value)
		}
	}
	return strings.Join(texts, "")
}

func trimRunes(value string, limit int) string {
	value = strings.TrimSpace(value)
	characters := []rune(value)
	if len(characters) <= limit {
		return value
	}
	return string(characters[:limit])
}
