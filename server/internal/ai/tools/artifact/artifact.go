// Package artifact provides owner-scoped request context and persistence for
// files produced by internal AI tools.
package artifact

import (
	"context"
	"errors"
	"fmt"
	"path/filepath"
	"strings"
	"time"

	"valley-server/internal/model"
	"valley-server/internal/service"

	"gorm.io/gorm"
)

type requestContextKey struct{}

type RequestContext struct {
	UserID         model.Int64String
	AppID          model.Int64String
	ConversationID model.Int64String
	RunID          model.Int64String
	TaskID         *model.Int64String
	AttachmentIDs  []model.Int64String
}

func WithRequestContext(ctx context.Context, input RequestContext) context.Context {
	input.AttachmentIDs = append([]model.Int64String(nil), input.AttachmentIDs...)
	return context.WithValue(ctx, requestContextKey{}, input)
}

func RequestFromContext(ctx context.Context) (RequestContext, error) {
	input, ok := ctx.Value(requestContextKey{}).(RequestContext)
	if !ok || input.UserID <= 0 || input.AppID <= 0 || input.ConversationID <= 0 || input.RunID <= 0 {
		return RequestContext{}, errors.New("artifact: conversation context missing")
	}
	return input, nil
}

func ResolveAttachmentID(input RequestContext, raw string) (model.Int64String, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		if len(input.AttachmentIDs) != 1 {
			return 0, errors.New("artifact: source attachment is ambiguous")
		}
		return input.AttachmentIDs[0], nil
	}
	var parsed int64
	if _, err := fmt.Sscan(raw, &parsed); err != nil || parsed <= 0 {
		return 0, errors.New("artifact: invalid source attachment")
	}
	id := model.Int64String(parsed)
	for _, allowed := range input.AttachmentIDs {
		if allowed == id {
			return id, nil
		}
	}
	return 0, errors.New("artifact: source attachment is not available in this request")
}

func LoadAttachment(ctx context.Context, db *gorm.DB, input RequestContext, id model.Int64String) (model.AIAppConversationAttachment, error) {
	if db == nil {
		return model.AIAppConversationAttachment{}, errors.New("artifact: database unavailable")
	}
	var attachment model.AIAppConversationAttachment
	err := db.WithContext(ctx).Where(
		"id = ? AND user_id = ? AND app_id = ? AND conversation_id = ?",
		id, input.UserID, input.AppID, input.ConversationID,
	).First(&attachment).Error
	if err != nil {
		return model.AIAppConversationAttachment{}, errors.New("artifact: source attachment not found")
	}
	return attachment, nil
}

type File struct {
	Name         string
	ContentType  string
	Description  string
	Kind         string
	SourceFormat string
	TargetFormat string
	Content      []byte
}

type Writer interface {
	Write(context.Context, RequestContext, File) (model.AIAppArtifact, error)
}

type Store struct {
	db *gorm.DB
}

func NewStore(db *gorm.DB) *Store {
	return &Store{db: db}
}

func (store *Store) Write(ctx context.Context, input RequestContext, file File) (model.AIAppArtifact, error) {
	if store == nil || store.db == nil {
		return model.AIAppArtifact{}, errors.New("artifact: store unavailable")
	}
	name := filepath.Base(strings.TrimSpace(file.Name))
	if name == "." || name == "" || len(file.Content) == 0 {
		return model.AIAppArtifact{}, errors.New("artifact: output file is empty")
	}
	uploadConfig := service.UploadConfig{
		Type:         service.UploadType("agent_output"),
		UserID:       int64(input.UserID),
		MaxSize:      10,
		AllowedExts:  []string{".md", ".json", ".csv", ".jpg", ".jpeg", ".png", ".webp", ".docx"},
		CustomFolder: fmt.Sprintf("agent-outputs/%d", input.UserID),
	}
	uploader := service.NewUploadService()
	stored, err := uploader.UploadBytesWithContext(ctx, name, file.Content, uploadConfig)
	if err != nil {
		return model.AIAppArtifact{}, fmt.Errorf("artifact: upload output: %w", err)
	}
	description := strings.TrimSpace(file.Description)
	if description == "" {
		description = "智能体成果文件"
	}
	resource := model.Resource{
		UserID: input.UserID, Type: "agent_file", Visibility: "private",
		Title: strings.TrimSuffix(name, stored.Ext), Description: description,
		URL: stored.URL, StorageKey: stored.Key, Size: stored.Size,
		Extension: strings.TrimPrefix(stored.Ext, "."),
	}
	expiresAt := service.NewAIAppArtifactExpiry(time.Now())
	result := model.AIAppArtifact{
		UserID: input.UserID, AppID: input.AppID, ConversationID: input.ConversationID,
		RunID: input.RunID, TaskID: input.TaskID, FileName: name,
		ContentType: file.ContentType, Kind: strings.TrimSpace(file.Kind),
		SourceFormat: strings.ToLower(strings.TrimSpace(file.SourceFormat)),
		TargetFormat: strings.ToLower(strings.TrimSpace(file.TargetFormat)),
		SizeBytes:    stored.Size, URL: stored.URL,
		StorageKey: stored.Key, ExpiresAt: &expiresAt,
	}
	if result.Kind == "" {
		result.Kind = "file"
	}
	if err := store.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&resource).Error; err != nil {
			return err
		}
		result.ResourceID = resource.ID
		return tx.Create(&result).Error
	}); err != nil {
		_ = uploader.DeleteByKey(stored.Key)
		return model.AIAppArtifact{}, errors.New("artifact: persist output failed")
	}
	return result, nil
}

var _ Writer = (*Store)(nil)
