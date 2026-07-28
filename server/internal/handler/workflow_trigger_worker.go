package handler

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sync"
	"time"

	"valley-server/internal/database"
	"valley-server/internal/logger"
	"valley-server/internal/model"
	"valley-server/internal/workflow"
	"valley-server/internal/workflowtrigger"

	"gorm.io/gorm"
)

const (
	workflowTriggerPollInterval = 5 * time.Second
	workflowJobLeaseDuration    = 30 * time.Minute
)

var workflowTriggerWorkerOnce sync.Once

// StartWorkflowTriggerWorker closes the existing durable-trigger loop:
// materialize due Cron slots, atomically lease queued jobs, then execute their
// frozen graph through the same owner-scoped workflow runtime used by manual
// runs.
func StartWorkflowTriggerWorker(ctx context.Context) {
	workflowTriggerWorkerOnce.Do(func() {
		go func() {
			ticker := time.NewTicker(workflowTriggerPollInterval)
			defer ticker.Stop()
			runWorkflowTriggerWorkerTick(ctx, time.Now())
			for {
				select {
				case <-ctx.Done():
					return
				case now := <-ticker.C:
					runWorkflowTriggerWorkerTick(ctx, now)
				}
			}
		}()
	})
}

func runWorkflowTriggerWorkerTick(ctx context.Context, now time.Time) {
	db := database.GetDB()
	if db == nil {
		return
	}
	if _, err := workflowtrigger.EnqueueDue(ctx, db, now); err != nil {
		logger.Log.Warnf("workflow trigger enqueue failed: %v", err)
		return
	}
	resumeDecidedWorkflowApprovals(ctx, now)
	for {
		job, claimed, err := claimWorkflowRunJob(ctx, db, now)
		if err != nil {
			logger.Log.Warnf("workflow trigger job claim failed: %v", err)
			return
		}
		if !claimed {
			return
		}
		if err := executeWorkflowRunJob(ctx, db, &job); err != nil {
			logger.Log.Warnf("workflow trigger job %s failed: %v", job.ID, err)
		}
	}
}

func claimWorkflowRunJob(ctx context.Context, db *gorm.DB, now time.Time) (model.WorkflowRunJob, bool, error) {
	var candidates []model.WorkflowRunJob
	if err := db.WithContext(ctx).
		Where("status = ? OR (status = ? AND lease_until IS NOT NULL AND lease_until < ?)", "queued", "running", now).
		Order("scheduled_at ASC, id ASC").
		Limit(10).
		Find(&candidates).Error; err != nil {
		return model.WorkflowRunJob{}, false, err
	}
	for _, candidate := range candidates {
		leaseUntil := now.Add(workflowJobLeaseDuration)
		result := db.WithContext(ctx).Model(&model.WorkflowRunJob{}).
			Where(
				"id = ? AND (status = ? OR (status = ? AND lease_until IS NOT NULL AND lease_until < ?))",
				candidate.ID, "queued", "running", now,
			).
			Updates(map[string]any{
				"status":      "running",
				"lease_until": leaseUntil,
				"attempt":     gorm.Expr("attempt + 1"),
			})
		if result.Error != nil {
			return model.WorkflowRunJob{}, false, result.Error
		}
		if result.RowsAffected == 0 {
			continue
		}
		if err := db.WithContext(ctx).First(&candidate, candidate.ID).Error; err != nil {
			return model.WorkflowRunJob{}, false, err
		}
		return candidate, true, nil
	}
	return model.WorkflowRunJob{}, false, nil
}

func executeWorkflowRunJob(parent context.Context, db *gorm.DB, job *model.WorkflowRunJob) error {
	if handled, err := reconcileExistingWorkflowRunJob(parent, db, job); handled {
		return err
	}
	graph, err := decodeWorkflowGraph(job.GraphSnapshot)
	if err != nil {
		return failWorkflowRunJob(db, job, "WORKFLOW_GRAPH_INVALID", err)
	}
	registry := workflowRuntimeRegistry()
	if validationErrors := workflow.ValidateGraph(graph, registry); len(validationErrors) > 0 {
		return failWorkflowRunJob(db, job, "WORKFLOW_GRAPH_INVALID", fmt.Errorf("%v", validationErrors))
	}
	if err := workflowtrigger.ValidateGraph(graph, registry, job.TriggerType); err != nil {
		return failWorkflowRunJob(db, job, "WORKFLOW_TRIGGER_INELIGIBLE", err)
	}
	inputs := map[string]any{}
	if err := json.Unmarshal([]byte(job.Inputs), &inputs); err != nil || inputs == nil {
		return failWorkflowRunJob(db, job, "WORKFLOW_INPUTS_INVALID", fmt.Errorf("invalid trigger input snapshot"))
	}

	var app model.AIApp
	if err := db.WithContext(parent).
		Where("workflow_id = ? AND user_id = ? AND type = ?", job.WorkflowID, job.UserID, aiAppTypeWorkflow).
		First(&app).Error; err != nil {
		return failWorkflowRunJob(db, job, "WORKFLOW_APP_UNAVAILABLE", err)
	}
	var version model.AIAppVersion
	if err := db.WithContext(parent).
		Where("id = ? AND app_id = ? AND published_at IS NOT NULL", job.VersionID, app.ID).
		First(&version).Error; err != nil {
		return failWorkflowRunJob(db, job, "WORKFLOW_VERSION_UNAVAILABLE", err)
	}
	var user model.User
	if err := db.WithContext(parent).Select("id", "role").First(&user, job.UserID).Error; err != nil {
		return failWorkflowRunJob(db, job, "WORKFLOW_OWNER_UNAVAILABLE", err)
	}

	run := model.WorkflowRun{
		WorkflowID: job.WorkflowID, UserID: job.UserID, AppID: app.ID, VersionID: version.ID, Status: string(workflow.StatusRunning),
		Inputs: job.Inputs, GraphSnapshot: job.GraphSnapshot, TriggerID: &job.TriggerID, RunJobID: &job.ID,
		StartedAt: time.Now(),
	}
	if err := db.WithContext(parent).Create(&run).Error; err != nil {
		return failWorkflowRunJob(db, job, "WORKFLOW_RUN_CREATE_FAILED", err)
	}
	nodeTypes := make(map[string]workflow.NodeType, len(graph.Nodes))
	for _, node := range graph.Nodes {
		nodeTypes[node.ID] = node.Type
	}
	var sequence int64
	var finalOutput map[string]any
	var failureCode string
	var persistenceErr error
	executionContext, releaseRun := activeWorkflowRuns.Start(run.ID.String(), 0)
	defer releaseRun()
	stopCancellationWatch := watchWorkflowRunCancellation(run.ID.String())
	defer stopCancellationWatch()
	executeErr := workflow.Execute(
		executionContext,
		graph,
		registry,
		workflow.RunContext{
			ID: run.ID.String(), Actor: workflow.Actor{UserID: int64(job.UserID), Role: user.Role},
			Inputs: inputs, Outputs: make(map[string]map[string]any),
			KnowledgeRetriever:       workflowKnowledgeRetriever(job.UserID, version),
			ContentSearcher:          workflowContentSearcher(job.UserID),
			NotionSearcher:           workflowNotionSearcher(job.UserID),
			CoverGenerator:           workflowCoverGenerator(),
			AIImageGenerator:         workflowAIImageGenerator(),
			AIImageUnderstander:      workflowAIImageUnderstander(),
			AIImageResourceSaver:     workflowAIImageResourceSaver(),
			NotificationSender:       workflowNotificationSender(),
			SubworkflowRunner:        workflowSubworkflowRunner(job.UserID),
			ApprovalGate:             workflowApprovalGate(run),
			SkillInstructionResolver: workflowAISkillInstructionResolver(job.UserID),
		},
		func(event workflow.Event) {
			if persistenceErr != nil {
				return
			}
			sequence++
			event.Sequence = sequence
			persistenceErr = db.Transaction(func(tx *gorm.DB) error {
				if event.BodyNodeID == "" {
					if err := persistWorkflowNodeEvent(tx, run.ID, nodeTypes[event.NodeID], event); err != nil {
						return err
					}
				}
				return persistWorkflowRunEvent(tx, run.ID, event)
			})
			if nodeTypes[event.NodeID] == workflow.NodeTypeEnd && event.Status == workflow.StatusSucceeded {
				finalOutput = event.Output
			}
			if event.Status == workflow.StatusFailed || event.Status == workflow.StatusCancelled {
				failureCode = event.Error
			}
		},
	)
	if persistenceErr != nil {
		executeErr = persistenceErr
		failureCode = "RUN_PERSISTENCE_FAILED"
	}
	if executeErr != nil {
		if errors.Is(executeErr, workflow.ErrApprovalRequired) {
			if err := db.WithContext(parent).Model(&run).Updates(map[string]any{
				"status": string(workflow.StatusWaiting),
				"result": `{"status":"waiting_approval"}`,
			}).Error; err != nil {
				return failWorkflowRunJob(db, job, "RUN_PERSISTENCE_FAILED", err)
			}
			return db.WithContext(parent).Model(job).Updates(map[string]any{
				"status": "waiting_approval", "lease_until": nil, "error_code": "",
			}).Error
		}
		if failureCode == "" {
			failureCode = "WORKFLOW_NODE_FAILED"
		}
		if failureCode == "WORKFLOW_CANCELLED" {
			_ = finishWorkflowRun(&run, string(workflow.StatusCancelled), map[string]any{"error": failureCode})
			persistWorkflowAIAppRun(app, version, run, "cancelled", nil, failureCode)
			return failWorkflowRunJob(db, job, failureCode, executeErr)
		}
		_ = finishWorkflowRun(&run, string(workflow.StatusFailed), map[string]any{"error": failureCode})
		persistWorkflowAIAppRun(app, version, run, "failed", nil, failureCode)
		return failWorkflowRunJob(db, job, failureCode, executeErr)
	}
	if finalOutput == nil {
		finalOutput = map[string]any{}
	}
	if err := finishWorkflowRun(&run, string(workflow.StatusSucceeded), finalOutput); err != nil {
		return failWorkflowRunJob(db, job, "RUN_PERSISTENCE_FAILED", err)
	}
	persistWorkflowAIAppRun(app, version, run, "succeeded", finalOutput, "")
	return db.WithContext(parent).Model(job).Updates(map[string]any{
		"status": "success", "lease_until": nil, "error_code": "",
	}).Error
}

func reconcileExistingWorkflowRunJob(
	ctx context.Context,
	db *gorm.DB,
	job *model.WorkflowRunJob,
) (bool, error) {
	var existing model.WorkflowRun
	err := db.WithContext(ctx).Where("run_job_id = ?", job.ID).First(&existing).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return false, nil
	}
	if err != nil {
		return true, failWorkflowRunJob(db, job, "RUN_LOOKUP_FAILED", err)
	}
	switch existing.Status {
	case string(workflow.StatusSucceeded):
		return true, db.WithContext(ctx).Model(job).Updates(map[string]any{
			"status": "success", "lease_until": nil, "error_code": "",
		}).Error
	case string(workflow.StatusWaiting):
		return true, db.WithContext(ctx).Model(job).Updates(map[string]any{
			"status": "waiting_approval", "lease_until": nil, "error_code": "",
		}).Error
	case string(workflow.StatusFailed), string(workflow.StatusCancelled):
		return true, db.WithContext(ctx).Model(job).Updates(map[string]any{
			"status": "error", "lease_until": nil, "error_code": "WORKFLOW_RUN_ALREADY_FINISHED",
		}).Error
	default:
		now := time.Now()
		_ = db.WithContext(ctx).Model(&existing).Updates(map[string]any{
			"status":      string(workflow.StatusFailed),
			"result":      `{"error":"WORKFLOW_RUN_INTERRUPTED"}`,
			"finished_at": now,
		}).Error
		return true, failWorkflowRunJob(db, job, "WORKFLOW_RUN_INTERRUPTED", fmt.Errorf("stale job already owns a run"))
	}
}

func failWorkflowRunJob(db *gorm.DB, job *model.WorkflowRunJob, code string, cause error) error {
	updateErr := db.Model(job).Updates(map[string]any{
		"status": "error", "lease_until": nil, "error_code": code,
	}).Error
	if updateErr != nil {
		return fmt.Errorf("%s: %v; persist job failure: %w", code, cause, updateErr)
	}
	return fmt.Errorf("%s: %w", code, cause)
}
