package workflowtrigger

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"valley-server/internal/model"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var (
	ErrTriggerUnavailable = errors.New("workflow trigger is unavailable")
	ErrPublishedVersion   = errors.New("published workflow version is unavailable")
)

// EnqueueInvocation freezes the current published version and creates exactly
// one durable job for a caller-provided delivery ID. Repeating the same
// delivery returns the original job without replaying the workflow.
func EnqueueInvocation(
	ctx context.Context,
	db *gorm.DB,
	trigger model.WorkflowTrigger,
	inputs map[string]any,
	deliveryID string,
	now time.Time,
) (model.WorkflowRunJob, bool, error) {
	if db == nil {
		return model.WorkflowRunJob{}, false, fmt.Errorf("database is not initialized")
	}
	deliveryID = strings.TrimSpace(deliveryID)
	if deliveryID == "" {
		return model.WorkflowRunJob{}, false, fmt.Errorf("delivery ID is required")
	}
	encodedInputs, err := json.Marshal(inputs)
	if err != nil {
		return model.WorkflowRunJob{}, false, fmt.Errorf("encode trigger inputs: %w", err)
	}
	var job model.WorkflowRunJob
	created := false
	err = db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var current model.WorkflowTrigger
		if err := tx.Where("id = ? AND status = ?", trigger.ID, "active").First(&current).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrTriggerUnavailable
			}
			return err
		}
		if current.Type != TypeWebhook && current.Type != TypeEvent {
			return ErrTriggerUnavailable
		}
		var app model.AIApp
		if err := tx.Where(
			"workflow_id = ? AND user_id = ? AND type = ? AND published_version_id <> ?",
			current.WorkflowID,
			current.UserID,
			"workflow",
			0,
		).First(&app).Error; err != nil {
			return ErrPublishedVersion
		}
		var version model.AIAppVersion
		if err := tx.Where("id = ? AND app_id = ? AND published_at IS NOT NULL", app.PublishedVersionID, app.ID).
			First(&version).Error; err != nil {
			return ErrPublishedVersion
		}
		idempotencyKey := fmt.Sprintf("trigger:%s:delivery:%s", current.ID, deliveryID)
		job = model.WorkflowRunJob{
			TriggerID:      current.ID,
			TriggerType:    current.Type,
			WorkflowID:     current.WorkflowID,
			UserID:         current.UserID,
			VersionID:      version.ID,
			GraphSnapshot:  version.Config,
			Inputs:         string(encodedInputs),
			Status:         "queued",
			ScheduledAt:    now.UTC(),
			IdempotencyKey: idempotencyKey,
		}
		result := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&job)
		if result.Error != nil {
			return result.Error
		}
		created = result.RowsAffected > 0
		if !created {
			job = model.WorkflowRunJob{}
			if err := tx.Where("idempotency_key = ?", idempotencyKey).First(&job).Error; err != nil {
				return err
			}
			return nil
		}
		return tx.Model(&current).Update("last_run_at", now.UTC()).Error
	})
	return job, created, err
}
