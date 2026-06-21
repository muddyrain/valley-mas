package mail

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"
	"valley-server/internal/config"
	"valley-server/internal/model"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type Service struct {
	db     *gorm.DB
	cfg    config.MailConfig
	vault  *CredentialVault
	gmail  *GmailProvider
	qqIMAP *QQIMAPProvider
	now    func() time.Time
}

func NewService(db *gorm.DB, cfg config.MailConfig) (*Service, error) {
	if db == nil {
		return nil, errors.New("database is not initialized")
	}
	vault, err := NewCredentialVault(cfg.SecretKey)
	if err != nil {
		return nil, err
	}
	return &Service{
		db:     db,
		cfg:    cfg,
		vault:  vault,
		gmail:  NewGmailProvider(cfg),
		qqIMAP: NewQQIMAPProvider(),
		now:    func() time.Time { return time.Now().UTC() },
	}, nil
}

func (s *Service) ListAccounts(userID int64) ([]AccountDTO, error) {
	var accounts []model.MailAccount
	if err := s.db.Where("user_id = ?", userID).Order("created_at DESC").Find(&accounts).Error; err != nil {
		return nil, err
	}
	result := make([]AccountDTO, 0, len(accounts))
	for _, account := range accounts {
		result = append(result, accountDTO(account))
	}
	return result, nil
}

func (s *Service) BindQQIMAP(ctx context.Context, userID int64, email string, authorizationCode string) (AccountDTO, error) {
	email = strings.ToLower(strings.TrimSpace(email))
	authorizationCode = strings.TrimSpace(authorizationCode)
	if email == "" || !strings.Contains(email, "@") {
		return AccountDTO{}, errors.New("邮箱地址无效")
	}
	if authorizationCode == "" {
		return AccountDTO{}, errors.New("授权码不能为空")
	}

	ciphertext, err := s.vault.Encrypt(authorizationCode)
	if err != nil {
		return AccountDTO{}, err
	}

	account := model.MailAccount{
		UserID:               model.Int64String(userID),
		Provider:             ProviderQQIMAP,
		AuthType:             AuthTypeAppPassword,
		Email:                email,
		CredentialCiphertext: ciphertext,
		Status:               AccountStatusConnected,
		LastError:            "",
	}
	if err := s.db.WithContext(ctx).Clauses(clause.OnConflict{
		Columns: []clause.Column{
			{Name: "user_id"},
			{Name: "provider"},
			{Name: "email"},
		},
		DoUpdates: clause.AssignmentColumns([]string{"credential_ciphertext", "status", "last_error", "updated_at"}),
	}).Create(&account).Error; err != nil {
		return AccountDTO{}, err
	}

	if err := s.db.Where("user_id = ? AND provider = ? AND email = ?", userID, ProviderQQIMAP, email).First(&account).Error; err != nil {
		return AccountDTO{}, err
	}
	return accountDTO(account), nil
}

func (s *Service) StartGmail(userID int64) (string, error) {
	state, err := s.signOAuthState(userID)
	if err != nil {
		return "", err
	}
	return s.gmail.AuthURL(state)
}

func (s *Service) CompleteGmail(ctx context.Context, state string, code string) (AccountDTO, error) {
	userID, err := s.verifyOAuthState(state)
	if err != nil {
		return AccountDTO{}, err
	}
	token, err := s.gmail.ExchangeCode(ctx, strings.TrimSpace(code))
	if err != nil {
		return AccountDTO{}, err
	}
	credential := token.RefreshToken
	if credential == "" {
		credential = token.AccessToken
	}
	email, err := s.gmail.ProfileEmail(ctx, token.AccessToken)
	if err != nil {
		return AccountDTO{}, err
	}
	ciphertext, err := s.vault.Encrypt(credential)
	if err != nil {
		return AccountDTO{}, err
	}
	account := model.MailAccount{
		UserID:               model.Int64String(userID),
		Provider:             ProviderGmail,
		AuthType:             AuthTypeOAuth,
		Email:                email,
		CredentialCiphertext: ciphertext,
		Status:               AccountStatusConnected,
		LastError:            "",
	}
	if err := s.db.WithContext(ctx).Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "user_id"}, {Name: "provider"}, {Name: "email"}},
		DoUpdates: clause.AssignmentColumns([]string{"credential_ciphertext", "status", "last_error", "updated_at"}),
	}).Create(&account).Error; err != nil {
		return AccountDTO{}, err
	}
	if err := s.db.Where("user_id = ? AND provider = ? AND email = ?", userID, ProviderGmail, email).First(&account).Error; err != nil {
		return AccountDTO{}, err
	}
	return accountDTO(account), nil
}

func (s *Service) DeleteAccount(ctx context.Context, userID int64, accountID string) error {
	id, err := strconv.ParseInt(accountID, 10, 64)
	if err != nil {
		return errors.New("账号ID无效")
	}
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("user_id = ? AND account_id = ?", userID, id).Delete(&model.MailMessage{}).Error; err != nil {
			return err
		}
		result := tx.Where("user_id = ? AND id = ?", userID, id).Delete(&model.MailAccount{})
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			return gorm.ErrRecordNotFound
		}
		return nil
	})
}

type MessageListOptions struct {
	AccountID string
	Query     string
	Page      int
	PageSize  int
}

func (s *Service) ListMessages(userID int64, opts MessageListOptions) (map[string]any, error) {
	page := opts.Page
	if page <= 0 {
		page = 1
	}
	pageSize := opts.PageSize
	if pageSize <= 0 || pageSize > 50 {
		pageSize = 20
	}

	query := s.db.Model(&model.MailMessage{}).Where("user_id = ?", userID)
	if opts.AccountID != "" {
		query = query.Where("account_id = ?", opts.AccountID)
	}
	if keyword := strings.TrimSpace(opts.Query); keyword != "" {
		like := "%" + keyword + "%"
		query = query.Where("subject LIKE ? OR from_address LIKE ? OR snippet LIKE ?", like, like, like)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, err
	}
	var messages []model.MailMessage
	if err := query.Order("sent_at DESC, created_at DESC").Offset((page - 1) * pageSize).Limit(pageSize).Find(&messages).Error; err != nil {
		return nil, err
	}
	list := make([]MessageDTO, 0, len(messages))
	for _, message := range messages {
		list = append(list, messageDTO(message, false))
	}
	return map[string]any{
		"list": list,
		"pagination": map[string]any{
			"page":     page,
			"pageSize": pageSize,
			"total":    total,
			"hasMore":  int64(page*pageSize) < total,
		},
	}, nil
}

func (s *Service) GetMessage(userID int64, id string) (MessageDTO, error) {
	messageID, err := strconv.ParseInt(id, 10, 64)
	if err != nil {
		return MessageDTO{}, errors.New("邮件ID无效")
	}
	var message model.MailMessage
	if err := s.db.Where("user_id = ? AND id = ?", userID, messageID).First(&message).Error; err != nil {
		return MessageDTO{}, err
	}
	return messageDTO(message, true), nil
}

func (s *Service) SyncAccount(ctx context.Context, userID int64, accountID string) (AccountDTO, error) {
	id, err := strconv.ParseInt(accountID, 10, 64)
	if err != nil {
		return AccountDTO{}, errors.New("账号ID无效")
	}
	var account model.MailAccount
	if err := s.db.Where("user_id = ? AND id = ?", userID, id).First(&account).Error; err != nil {
		return AccountDTO{}, err
	}
	secret, err := s.vault.Decrypt(account.CredentialCiphertext)
	if err != nil {
		return AccountDTO{}, err
	}

	var messages []FetchedMessage
	switch account.Provider {
	case ProviderGmail:
		messages, err = s.gmail.FetchInbox(ctx, account.ID.String(), secret, 20)
	case ProviderQQIMAP:
		messages, err = s.qqIMAP.FetchInbox(ctx, account.ID.String(), account.Email, secret, 20)
	default:
		err = fmt.Errorf("unsupported mail provider %q", account.Provider)
	}
	if err != nil {
		_ = s.db.Model(&account).Updates(map[string]any{"status": AccountStatusError, "last_error": err.Error()}).Error
		account.Status = AccountStatusError
		account.LastError = err.Error()
		return accountDTO(account), err
	}

	if err := s.upsertMessages(ctx, model.Int64String(userID), account, messages); err != nil {
		return AccountDTO{}, err
	}
	now := s.now()
	if err := s.db.Model(&account).Updates(map[string]any{
		"status":         AccountStatusConnected,
		"last_error":     "",
		"last_synced_at": &now,
	}).Error; err != nil {
		return AccountDTO{}, err
	}
	account.Status = AccountStatusConnected
	account.LastError = ""
	account.LastSyncedAt = &now
	return accountDTO(account), nil
}

func (s *Service) upsertMessages(ctx context.Context, userID model.Int64String, account model.MailAccount, messages []FetchedMessage) error {
	for _, fetched := range messages {
		sentAt := fetched.SentAt
		if sentAt.IsZero() {
			sentAt = s.now()
		}
		message := model.MailMessage{
			UserID:            userID,
			AccountID:         account.ID,
			Provider:          account.Provider,
			ProviderMessageID: fetched.ProviderMessageID,
			ThreadID:          fetched.ThreadID,
			FromAddress:       trimText(fetched.FromAddress, 300),
			Subject:           trimText(fetched.Subject, 500),
			Snippet:           trimText(fetched.Snippet, 1000),
			TextBody:          trimBodyText(fetched.TextBody, 8000),
			HTMLBody:          trimHTMLBody(fetched.HTMLBody, 200000),
			IsRead:            fetched.IsRead,
			SentAt:            sentAt,
		}
		if err := s.db.WithContext(ctx).Clauses(clause.OnConflict{
			Columns: []clause.Column{{Name: "account_id"}, {Name: "provider_message_id"}},
			DoUpdates: clause.AssignmentColumns([]string{
				"thread_id", "from_address", "subject", "snippet", "text_body", "html_body", "is_read", "sent_at", "updated_at",
			}),
		}).Create(&message).Error; err != nil {
			return err
		}
	}
	return nil
}

type oauthState struct {
	UserID    int64 `json:"userId"`
	ExpiresAt int64 `json:"expiresAt"`
}

func (s *Service) signOAuthState(userID int64) (string, error) {
	payload, err := json.Marshal(oauthState{UserID: userID, ExpiresAt: s.now().Add(10 * time.Minute).Unix()})
	if err != nil {
		return "", err
	}
	payloadEncoded := base64.RawURLEncoding.EncodeToString(payload)
	mac := hmac.New(sha256.New, []byte(s.cfg.SecretKey))
	mac.Write([]byte(payloadEncoded))
	signature := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
	return payloadEncoded + "." + signature, nil
}

func (s *Service) verifyOAuthState(state string) (int64, error) {
	parts := strings.Split(state, ".")
	if len(parts) != 2 {
		return 0, errors.New("OAuth state 无效")
	}
	mac := hmac.New(sha256.New, []byte(s.cfg.SecretKey))
	mac.Write([]byte(parts[0]))
	expected := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
	if !hmac.Equal([]byte(expected), []byte(parts[1])) {
		return 0, errors.New("OAuth state 签名无效")
	}
	raw, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		return 0, err
	}
	var payload oauthState
	if err := json.Unmarshal(raw, &payload); err != nil {
		return 0, err
	}
	if payload.UserID <= 0 || s.now().Unix() > payload.ExpiresAt {
		return 0, errors.New("OAuth state 已过期")
	}
	return payload.UserID, nil
}

func accountDTO(account model.MailAccount) AccountDTO {
	return AccountDTO{
		ID:           account.ID.String(),
		Provider:     account.Provider,
		AuthType:     account.AuthType,
		Email:        account.Email,
		Status:       account.Status,
		LastSyncedAt: account.LastSyncedAt,
		LastError:    account.LastError,
		CreatedAt:    account.CreatedAt,
		UpdatedAt:    account.UpdatedAt,
	}
}

func messageDTO(message model.MailMessage, includeBody bool) MessageDTO {
	dto := MessageDTO{
		ID:                message.ID.String(),
		AccountID:         message.AccountID.String(),
		Provider:          message.Provider,
		ProviderMessageID: message.ProviderMessageID,
		ThreadID:          message.ThreadID,
		FromAddress:       message.FromAddress,
		Subject:           message.Subject,
		Snippet:           message.Snippet,
		IsRead:            message.IsRead,
		SentAt:            message.SentAt,
		CreatedAt:         message.CreatedAt,
		UpdatedAt:         message.UpdatedAt,
	}
	if includeBody {
		dto.TextBody = message.TextBody
		dto.HTMLBody = message.HTMLBody
	}
	return dto
}
