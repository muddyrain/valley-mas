package service

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"unicode/utf8"

	"valley-server/internal/model"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// AIImageResourceSaver contains the one write path that turns a completed AI
// image generation into a resource. HTTP, workflow and agent adapters must use
// this service instead of reimplementing ownership, idempotency or storage.
type AIImageResourceSaver struct {
	DB               *gorm.DB
	FetchImage       func(context.Context, string) ([]byte, string, error)
	GenerateMetadata func(context.Context, model.AIImageGeneration, []byte, string, string) (AIImageResourceMetadata, error)
}

type AIImageResourceMetadata struct {
	Title string
	Tags  []string
	Model string
}

type SaveAIImageGenerationResourceInput struct {
	UserID       model.Int64String
	GenerationID model.Int64String
	Visibility   string
}

type SaveAIImageGenerationResourceResult struct {
	Resource      model.Resource
	MetadataModel string
}

var (
	ErrAIImageGenerationNotFound  = errors.New("AI image generation not found")
	ErrAIImageGenerationNotReady  = errors.New("AI image generation is not ready")
	ErrAIImageAlreadySaved        = errors.New("AI image generation is already saved")
	ErrAIImageMetadataUnavailable = errors.New("AI image metadata generator is unavailable")
)

func (s AIImageResourceSaver) Save(ctx context.Context, input SaveAIImageGenerationResourceInput) (SaveAIImageGenerationResourceResult, error) {
	if s.DB == nil {
		return SaveAIImageGenerationResourceResult{}, errors.New("database unavailable")
	}
	if input.UserID <= 0 || input.GenerationID <= 0 {
		return SaveAIImageGenerationResourceResult{}, ErrAIImageGenerationNotFound
	}
	if s.FetchImage == nil || s.GenerateMetadata == nil {
		return SaveAIImageGenerationResourceResult{}, ErrAIImageMetadataUnavailable
	}

	var generation model.AIImageGeneration
	if err := s.DB.Where("id = ? AND user_id = ?", input.GenerationID, input.UserID).First(&generation).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return SaveAIImageGenerationResourceResult{}, ErrAIImageGenerationNotFound
		}
		return SaveAIImageGenerationResourceResult{}, fmt.Errorf("load image generation: %w", err)
	}
	if generation.Status != "succeeded" || strings.TrimSpace(generation.ResultURL) == "" {
		return SaveAIImageGenerationResourceResult{}, ErrAIImageGenerationNotReady
	}
	if generation.ResourceID != nil && *generation.ResourceID != 0 {
		return SaveAIImageGenerationResourceResult{}, ErrAIImageAlreadySaved
	}

	content, mimeType, err := s.FetchImage(ctx, generation.ResultURL)
	if err != nil {
		return SaveAIImageGenerationResourceResult{}, fmt.Errorf("fetch generated image: %w", err)
	}
	metadata, err := s.GenerateMetadata(ctx, generation, content, mimeType, resourceTypeForAIImage(generation))
	if err != nil {
		return SaveAIImageGenerationResourceResult{}, fmt.Errorf("generate image metadata: %w", err)
	}
	if strings.TrimSpace(metadata.Title) == "" || len(metadata.Tags) == 0 {
		return SaveAIImageGenerationResourceResult{}, errors.New("AI image metadata is incomplete")
	}

	uploadConfig := GetDefaultConfig(UploadType(resourceTypeForAIImage(generation)))
	uploadConfig.UserID = int64(input.UserID)
	// Generated images can be high-resolution even when they are square.
	uploadConfig.MaxSize = MaxGeneratedAIImageSizeMB
	uploadConfig.AllowedExts = AIImageStorageExtensions()
	stored, err := NewUploadService().UploadBytesWithContext(ctx, "saved-ai-image"+aiImageExtension(mimeType), content, uploadConfig)
	if err != nil {
		return SaveAIImageGenerationResourceResult{}, fmt.Errorf("upload generated image: %w", err)
	}

	result := SaveAIImageGenerationResourceResult{MetadataModel: strings.TrimSpace(metadata.Model)}
	err = s.DB.Transaction(func(tx *gorm.DB) error {
		var locked model.AIImageGeneration
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("id = ? AND user_id = ?", input.GenerationID, input.UserID).
			First(&locked).Error; err != nil {
			return err
		}
		if locked.Status != "succeeded" || strings.TrimSpace(locked.ResultURL) == "" {
			return ErrAIImageGenerationNotReady
		}
		if locked.ResourceID != nil && *locked.ResourceID != 0 {
			return ErrAIImageAlreadySaved
		}
		resource := model.Resource{
			UserID:      input.UserID,
			Type:        resourceTypeForAIImage(locked),
			Visibility:  normalizeAIImageVisibility(input.Visibility),
			Title:       truncateAIImageText(metadata.Title, 100),
			Description: "AI 图片创作",
			URL:         stored.URL,
			StorageKey:  stored.Key,
			Width:       locked.ResultWidth,
			Height:      locked.ResultHeight,
			Size:        stored.Size,
			Extension:   strings.TrimPrefix(stored.Ext, "."),
			Tags:        normalizeAIImageTags(metadata.Tags),
		}
		if err := tx.Create(&resource).Error; err != nil {
			return err
		}
		if err := tx.Model(&locked).Update("resource_id", resource.ID).Error; err != nil {
			return err
		}
		result.Resource = resource
		return nil
	})
	if err != nil {
		_ = NewUploadService().DeleteByKey(stored.Key)
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return SaveAIImageGenerationResourceResult{}, ErrAIImageGenerationNotFound
		}
		return SaveAIImageGenerationResourceResult{}, err
	}
	return result, nil
}

func resourceTypeForAIImage(generation model.AIImageGeneration) string {
	if generation.AspectRatio == "1:1" {
		return "avatar"
	}
	return "wallpaper"
}

func normalizeAIImageVisibility(value string) string {
	if strings.EqualFold(strings.TrimSpace(value), "public") {
		return "public"
	}
	return "private"
}

func normalizeAIImageTags(raw []string) model.StringList {
	seen := make(map[string]struct{}, len(raw))
	result := make(model.StringList, 0, 8)
	for _, tag := range raw {
		tag = truncateAIImageText(tag, 20)
		if tag == "" {
			continue
		}
		if _, exists := seen[tag]; exists {
			continue
		}
		seen[tag] = struct{}{}
		result = append(result, tag)
		if len(result) == 12 {
			break
		}
	}
	return result
}

func truncateAIImageText(value string, limit int) string {
	value = strings.TrimSpace(value)
	if limit <= 0 || utf8.RuneCountInString(value) <= limit {
		return value
	}
	return string([]rune(value)[:limit])
}

func aiImageExtension(mimeType string) string {
	return AIImageExtension(mimeType)
}
