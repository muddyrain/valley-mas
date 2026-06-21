package mail

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
	"valley-server/internal/config"
)

const gmailReadonlyScope = "https://www.googleapis.com/auth/gmail.readonly"

type GmailProvider struct {
	cfg        config.MailConfig
	httpClient *http.Client
}

func NewGmailProvider(cfg config.MailConfig) *GmailProvider {
	return &GmailProvider{
		cfg:        cfg,
		httpClient: &http.Client{Timeout: 12 * time.Second},
	}
}

func (p *GmailProvider) AuthURL(state string) (string, error) {
	if strings.TrimSpace(p.cfg.GmailClientID) == "" || strings.TrimSpace(p.cfg.GmailRedirectURL) == "" {
		return "", errors.New("Gmail OAuth is not configured")
	}
	values := url.Values{}
	values.Set("client_id", p.cfg.GmailClientID)
	values.Set("redirect_uri", p.cfg.GmailRedirectURL)
	values.Set("response_type", "code")
	values.Set("scope", gmailReadonlyScope)
	values.Set("access_type", "offline")
	values.Set("prompt", "consent")
	values.Set("include_granted_scopes", "true")
	values.Set("state", state)
	return "https://accounts.google.com/o/oauth2/v2/auth?" + values.Encode(), nil
}

func (p *GmailProvider) ExchangeCode(ctx context.Context, code string) (gmailTokenResponse, error) {
	if strings.TrimSpace(p.cfg.GmailClientID) == "" || strings.TrimSpace(p.cfg.GmailClientSecret) == "" || strings.TrimSpace(p.cfg.GmailRedirectURL) == "" {
		return gmailTokenResponse{}, errors.New("Gmail OAuth is not configured")
	}
	values := url.Values{}
	values.Set("code", code)
	values.Set("client_id", p.cfg.GmailClientID)
	values.Set("client_secret", p.cfg.GmailClientSecret)
	values.Set("redirect_uri", p.cfg.GmailRedirectURL)
	values.Set("grant_type", "authorization_code")

	var token gmailTokenResponse
	if err := p.doJSON(ctx, http.MethodPost, "https://oauth2.googleapis.com/token", "application/x-www-form-urlencoded", strings.NewReader(values.Encode()), &token); err != nil {
		return gmailTokenResponse{}, err
	}
	if token.RefreshToken == "" && token.AccessToken == "" {
		return gmailTokenResponse{}, errors.New("Gmail token response is empty")
	}
	return token, nil
}

func (p *GmailProvider) RefreshAccessToken(ctx context.Context, refreshToken string) (string, error) {
	values := url.Values{}
	values.Set("client_id", p.cfg.GmailClientID)
	values.Set("client_secret", p.cfg.GmailClientSecret)
	values.Set("refresh_token", refreshToken)
	values.Set("grant_type", "refresh_token")

	var token gmailTokenResponse
	if err := p.doJSON(ctx, http.MethodPost, "https://oauth2.googleapis.com/token", "application/x-www-form-urlencoded", strings.NewReader(values.Encode()), &token); err != nil {
		return "", err
	}
	if token.AccessToken == "" {
		return "", errors.New("Gmail refresh response is missing access token")
	}
	return token.AccessToken, nil
}

func (p *GmailProvider) ProfileEmail(ctx context.Context, accessToken string) (string, error) {
	var profile gmailProfile
	if err := p.doGmailJSON(ctx, accessToken, "https://gmail.googleapis.com/gmail/v1/users/me/profile", &profile); err != nil {
		return "", err
	}
	if profile.EmailAddress == "" {
		return "", errors.New("Gmail profile email is empty")
	}
	return strings.ToLower(strings.TrimSpace(profile.EmailAddress)), nil
}

func (p *GmailProvider) FetchInbox(ctx context.Context, accountID string, refreshToken string, limit int) ([]FetchedMessage, error) {
	accessToken, err := p.RefreshAccessToken(ctx, refreshToken)
	if err != nil {
		return nil, err
	}

	if limit <= 0 || limit > 50 {
		limit = 20
	}

	listURL := fmt.Sprintf("https://gmail.googleapis.com/gmail/v1/users/me/messages?labelIds=INBOX&maxResults=%d", limit)
	var list gmailListResponse
	if err := p.doGmailJSON(ctx, accessToken, listURL, &list); err != nil {
		return nil, err
	}

	messages := make([]FetchedMessage, 0, len(list.Messages))
	for _, item := range list.Messages {
		if item.ID == "" {
			continue
		}
		detailURL := "https://gmail.googleapis.com/gmail/v1/users/me/messages/" + url.PathEscape(item.ID) + "?format=full"
		var detail gmailMessage
		if err := p.doGmailJSON(ctx, accessToken, detailURL, &detail); err != nil {
			return nil, err
		}
		messages = append(messages, extractGmailMessage(detail, accountID))
	}
	return messages, nil
}

func (p *GmailProvider) doGmailJSON(ctx context.Context, accessToken string, endpoint string, out any) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)
	return p.do(req, out)
}

func (p *GmailProvider) doJSON(ctx context.Context, method string, endpoint string, contentType string, body io.Reader, out any) error {
	req, err := http.NewRequestWithContext(ctx, method, endpoint, body)
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", contentType)
	return p.do(req, out)
}

func (p *GmailProvider) do(req *http.Request, out any) error {
	response, err := p.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer response.Body.Close()
	raw, _ := io.ReadAll(io.LimitReader(response.Body, 2<<20))
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return fmt.Errorf("Gmail request failed: status=%d body=%s", response.StatusCode, string(raw))
	}
	if len(raw) == 0 {
		return nil
	}
	return json.NewDecoder(bytes.NewReader(raw)).Decode(out)
}

type gmailTokenResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	ExpiresIn    int    `json:"expires_in"`
	TokenType    string `json:"token_type"`
	Scope        string `json:"scope"`
}

type gmailProfile struct {
	EmailAddress string `json:"emailAddress"`
}

type gmailListResponse struct {
	Messages []struct {
		ID       string `json:"id"`
		ThreadID string `json:"threadId"`
	} `json:"messages"`
}

type gmailMessage struct {
	ID         string       `json:"id"`
	ThreadID   string       `json:"threadId"`
	Snippet    string       `json:"snippet"`
	InternalMs string       `json:"internalDate"`
	LabelIDs   []string     `json:"labelIds"`
	Payload    gmailPayload `json:"payload"`
}

type gmailPayload struct {
	MimeType string         `json:"mimeType"`
	Headers  []gmailHeader  `json:"headers"`
	Body     gmailBody      `json:"body"`
	Parts    []gmailPayload `json:"parts"`
}

type gmailHeader struct {
	Name  string `json:"name"`
	Value string `json:"value"`
}

type gmailBody struct {
	Data string `json:"data"`
}

func extractGmailMessage(message gmailMessage, accountID string) FetchedMessage {
	headers := map[string]string{}
	for _, header := range message.Payload.Headers {
		headers[strings.ToLower(header.Name)] = header.Value
	}

	sentAt := time.Now().UTC()
	if ms, err := strconv.ParseInt(message.InternalMs, 10, 64); err == nil && ms > 0 {
		sentAt = time.UnixMilli(ms).UTC()
	} else if date := headers["date"]; date != "" {
		if parsed, err := http.ParseTime(date); err == nil {
			sentAt = parsed.UTC()
		}
	}

	body := strings.TrimSpace(extractGmailText(message.Payload))
	htmlBody := strings.TrimSpace(extractGmailHTML(message.Payload))
	snippet := strings.TrimSpace(message.Snippet)
	if snippet == "" {
		snippet = trimText(body, 240)
	}

	return FetchedMessage{
		AccountID:         accountID,
		Provider:          ProviderGmail,
		ProviderMessageID: message.ID,
		ThreadID:          message.ThreadID,
		FromAddress:       headers["from"],
		Subject:           headers["subject"],
		Snippet:           snippet,
		TextBody:          trimBodyText(body, 8000),
		HTMLBody:          trimHTMLBody(htmlBody, 200000),
		IsRead:            containsString(message.LabelIDs, "UNREAD") == false,
		SentAt:            sentAt,
	}
}

func extractGmailText(payload gmailPayload) string {
	if strings.EqualFold(payload.MimeType, "text/plain") {
		return decodeGmailPayloadBody(payload.Body.Data)
	}
	for _, part := range payload.Parts {
		if text := extractGmailText(part); strings.TrimSpace(text) != "" {
			return text
		}
	}
	return ""
}

func extractGmailHTML(payload gmailPayload) string {
	if strings.EqualFold(payload.MimeType, "text/html") {
		return decodeGmailPayloadBody(payload.Body.Data)
	}
	for _, part := range payload.Parts {
		if htmlBody := extractGmailHTML(part); strings.TrimSpace(htmlBody) != "" {
			return htmlBody
		}
	}
	return ""
}

func decodeGmailPayloadBody(data string) string {
	if strings.TrimSpace(data) == "" {
		return ""
	}
	if decoded, err := base64.RawURLEncoding.DecodeString(data); err == nil {
		return string(decoded)
	}
	if decoded, err := base64.StdEncoding.DecodeString(data); err == nil {
		return string(decoded)
	}
	return ""
}
