package service

import (
	"context"
	"errors"
	"time"

	"valley-server/internal/model"

	"gorm.io/gorm"
)

const DefaultAIAppArtifactTTL = 72 * time.Hour

func NewAIAppArtifactExpiry(now time.Time) time.Time {
	return now.Add(DefaultAIAppArtifactTTL)
}

// CleanupExpiredAIAppArtifacts removes owner-private temporary artifacts in a
// bounded batch. Object deletion happens before database deletion so a storage
// failure leaves the record available for a later retry.
func CleanupExpiredAIAppArtifacts(
	ctx context.Context,
	db *gorm.DB,
	now time.Time,
	limit int,
	deleteObject func(context.Context, string) error,
) (int, error) {
	if db == nil || deleteObject == nil {
		return 0, errors.New("artifact cleanup: service unavailable")
	}
	if limit <= 0 {
		limit = 100
	}
	var artifacts []model.AIAppArtifact
	if err := db.WithContext(ctx).
		Where("expires_at IS NOT NULL AND expires_at <= ? AND persisted_at IS NULL", now).
		Order("expires_at ASC").Limit(limit).Find(&artifacts).Error; err != nil {
		return 0, err
	}
	removed := 0
	for _, artifact := range artifacts {
		if artifact.StorageKey != "" {
			if err := deleteObject(ctx, artifact.StorageKey); err != nil {
				return removed, err
			}
		}
		if err := db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
			if err := tx.Delete(&model.AIAppArtifact{}, artifact.ID).Error; err != nil {
				return err
			}
			if artifact.ResourceID > 0 {
				return tx.Delete(&model.Resource{}, artifact.ResourceID).Error
			}
			return nil
		}); err != nil {
			return removed, err
		}
		removed++
	}
	return removed, nil
}
