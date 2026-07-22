package workflowtrigger

import (
	"context"
	"fmt"
	"time"

	"valley-server/internal/model"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// EnqueueDue atomically materializes one durable job per due trigger. The
// unique key keeps concurrent server instances from duplicating the same slot.
func EnqueueDue(ctx context.Context, db *gorm.DB, now time.Time) (int, error) {
	if db == nil {
		return 0, fmt.Errorf("database is not initialized")
	}
	var triggers []model.WorkflowTrigger
	if err := db.WithContext(ctx).Where("status = ? AND next_run_at IS NOT NULL AND next_run_at <= ?", "active", now).Find(&triggers).Error; err != nil {
		return 0, err
	}
	created := 0
	for _, candidate := range triggers {
		err := db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
			var trigger model.WorkflowTrigger
			if err := tx.Where("id = ? AND status = ? AND next_run_at IS NOT NULL AND next_run_at <= ?", candidate.ID, "active", now).First(&trigger).Error; err != nil {
				if err == gorm.ErrRecordNotFound {
					return nil
				}
				return err
			}
			var app model.AIApp
			if err := tx.Where("workflow_id = ? AND user_id = ? AND type = ? AND published_version_id <> ?", trigger.WorkflowID, trigger.UserID, "workflow", 0).First(&app).Error; err != nil {
				return err
			}
			var version model.AIAppVersion
			if err := tx.Where("id = ? AND app_id = ? AND published_at IS NOT NULL", app.PublishedVersionID, app.ID).First(&version).Error; err != nil {
				return err
			}
			schedule, err := Parse(trigger.CronExpression, trigger.Timezone)
			if err != nil {
				return err
			}
			slot := trigger.NextRunAt.UTC()
			job := model.WorkflowRunJob{TriggerID: trigger.ID, WorkflowID: trigger.WorkflowID, UserID: trigger.UserID, VersionID: version.ID, GraphSnapshot: version.Config, Status: "queued", ScheduledAt: slot, IdempotencyKey: fmt.Sprintf("trigger:%s:%d", trigger.ID, slot.UnixNano())}
			result := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&job)
			if result.Error != nil {
				return result.Error
			}
			if result.RowsAffected > 0 {
				created++
			}
			next := schedule.Next(now)
			return tx.Model(&trigger).Updates(map[string]any{"last_run_at": slot, "next_run_at": next}).Error
		})
		if err != nil {
			return created, err
		}
	}
	return created, nil
}
