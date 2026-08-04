package handler

import (
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"valley-server/internal/model"
	"valley-server/internal/workflow"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var (
	errWorkflowCollaborationChangeNotFound  = errors.New("workflow collaboration change not found")
	errWorkflowCollaborationAlreadyReverted = errors.New("workflow collaboration change already reverted")
)

func resolveCanonicalWorkflowSession(db *gorm.DB, userID, workflowID model.Int64String) (model.AIWorkbenchCopilotSession, error) {
	var resolved model.AIWorkbenchCopilotSession
	err := db.Transaction(func(tx *gorm.DB) error {
		query := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("user_id = ? AND scope = ? AND target_id = ? AND canonical = ? AND archived_at IS NULL", userID, "workflow", workflowID.String(), true).
			Order("updated_at DESC, id DESC")
		if err := query.First(&resolved).Error; err == nil {
			return nil
		} else if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}

		var sessions []model.AIWorkbenchCopilotSession
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("user_id = ? AND scope = ? AND target_id = ?", userID, "workflow", workflowID.String()).
			Order("updated_at DESC, id DESC").Find(&sessions).Error; err != nil {
			return err
		}
		if len(sessions) == 0 {
			resolved = model.AIWorkbenchCopilotSession{
				UserID: userID, Scope: "workflow", TargetID: workflowID.String(), Title: "工作流协作", Canonical: true,
			}
			return tx.Create(&resolved).Error
		}

		resolved = sessions[0]
		now := time.Now()
		if len(sessions) > 1 {
			otherIDs := make([]model.Int64String, 0, len(sessions)-1)
			for _, session := range sessions[1:] {
				otherIDs = append(otherIDs, session.ID)
			}
			if err := tx.Model(&model.AIWorkbenchCopilotSession{}).Where("id IN ?", otherIDs).
				Updates(map[string]any{"canonical": false, "archived_at": &now}).Error; err != nil {
				return err
			}
		}
		resolved.Canonical = true
		resolved.ArchivedAt = nil
		return tx.Model(&resolved).Updates(map[string]any{"canonical": true, "archived_at": nil}).Error
	})
	return resolved, err
}

func applyWorkflowCollaborationOperations(
	db *gorm.DB,
	task *model.WorkflowCollaborationTask,
	base workflow.Graph,
	operations []workflow.WorkflowOperation,
) (model.WorkflowCollaborationChange, []workflow.OperationConflict, error) {
	var change model.WorkflowCollaborationChange
	var conflicts []workflow.OperationConflict
	err := db.Transaction(func(tx *gorm.DB) error {
		var lockedTask model.WorkflowCollaborationTask
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&lockedTask, task.ID).Error; err != nil {
			return err
		}
		if lockedTask.Status == "succeeded" && lockedTask.ChangeID != nil {
			return tx.Where("task_id = ?", lockedTask.ID).First(&change).Error
		}

		var definition model.Workflow
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("id = ? AND user_id = ?", lockedTask.WorkflowID, lockedTask.UserID).First(&definition).Error; err != nil {
			return err
		}
		var latest workflow.Graph
		if err := json.Unmarshal([]byte(definition.Graph), &latest); err != nil {
			return fmt.Errorf("decode latest workflow: %w", err)
		}
		merged, detected, err := workflow.MergeOperations(base, latest, operations, workflowRuntimeRegistry())
		if err != nil {
			return err
		}
		if len(detected) > 0 {
			conflicts = detected
			conflictJSON, _ := json.Marshal(detected)
			return tx.Model(&lockedTask).Updates(map[string]any{
				"status": "conflicted", "status_message": "工作流相关位置已被手动修改", "error_code": "WORKFLOW_EDIT_CONFLICT",
				"finished_at": time.Now(), "progress": 100, "partial_output": string(conflictJSON),
			}).Error
		}
		inverse, err := workflow.BuildInverseOperations(latest, operations, workflowRuntimeRegistry())
		if err != nil {
			return err
		}
		mergedJSON, err := json.Marshal(merged)
		if err != nil {
			return err
		}
		if err := validateWorkflowDraftForPersistence(string(mergedJSON)); err != nil {
			return err
		}
		forwardJSON, _ := json.Marshal(operations)
		inverseJSON, _ := json.Marshal(inverse)
		diffJSON, _ := json.Marshal(copilotSemanticDiff(
			"workflow",
			aiWorkflowDraft{Name: definition.Name, Description: definition.Description, Graph: latest},
			aiWorkflowDraft{Name: definition.Name, Description: definition.Description, Graph: merged},
			operations,
		))
		change = model.WorkflowCollaborationChange{
			UserID: lockedTask.UserID, WorkflowID: lockedTask.WorkflowID, SessionID: lockedTask.SessionID, TaskID: lockedTask.ID,
			BaseRevision: lockedTask.BaseRevision, AppliedRevision: definition.Revision + 1,
			BaseHash: lockedTask.BaseHash, AppliedHash: workflowGraphHash(string(mergedJSON)), AppliedGraph: string(mergedJSON),
			ForwardOperations: string(forwardJSON), InverseOperations: string(inverseJSON), Diff: string(diffJSON), Status: "applied",
		}
		if err := tx.Create(&change).Error; err != nil {
			return err
		}
		if err := tx.Model(&definition).Updates(map[string]any{
			"graph": string(mergedJSON), "status": "draft", "revision": gorm.Expr("revision + ?", 1),
		}).Error; err != nil {
			return err
		}
		definition.Graph = string(mergedJSON)
		definition.Status = "draft"
		definition.Revision++
		if _, _, err := syncWorkflowAIAppWithSnapshot(tx, definition, false); err != nil {
			return err
		}
		changeID := change.ID
		if err := tx.Model(&lockedTask).Updates(map[string]any{
			"status": "succeeded", "status_message": "已更新工作流草稿", "progress": 100,
			"change_id": &changeID, "finished_at": time.Now(),
		}).Error; err != nil {
			return err
		}
		task.Status = "succeeded"
		task.ChangeID = &changeID
		return nil
	})
	return change, conflicts, err
}

func revertWorkflowCollaborationChange(
	db *gorm.DB,
	userID, workflowID, changeID model.Int64String,
) (model.Workflow, []workflow.OperationConflict, error) {
	var definition model.Workflow
	var conflicts []workflow.OperationConflict
	err := db.Transaction(func(tx *gorm.DB) error {
		var change model.WorkflowCollaborationChange
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("id = ? AND workflow_id = ? AND user_id = ?", changeID, workflowID, userID).First(&change).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return errWorkflowCollaborationChangeNotFound
			}
			return err
		}
		if change.Status != "applied" {
			return errWorkflowCollaborationAlreadyReverted
		}
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("id = ? AND user_id = ?", workflowID, userID).First(&definition).Error; err != nil {
			return err
		}
		var applied, latest workflow.Graph
		var inverse []workflow.WorkflowOperation
		if err := json.Unmarshal([]byte(change.AppliedGraph), &applied); err != nil {
			return err
		}
		if err := json.Unmarshal([]byte(definition.Graph), &latest); err != nil {
			return err
		}
		if err := json.Unmarshal([]byte(change.InverseOperations), &inverse); err != nil {
			return err
		}
		reverted, detected, err := workflow.MergeOperations(applied, latest, inverse, workflowRuntimeRegistry())
		if err != nil {
			return err
		}
		if len(detected) > 0 {
			conflicts = detected
			conflictJSON, _ := json.Marshal(detected)
			return tx.Model(&change).Update("conflict_paths", string(conflictJSON)).Error
		}
		revertedJSON, err := json.Marshal(reverted)
		if err != nil {
			return err
		}
		if err := validateWorkflowDraftForPersistence(string(revertedJSON)); err != nil {
			return err
		}
		if err := tx.Model(&definition).Updates(map[string]any{
			"graph": string(revertedJSON), "status": "draft", "revision": gorm.Expr("revision + ?", 1),
		}).Error; err != nil {
			return err
		}
		definition.Graph = string(revertedJSON)
		definition.Status = "draft"
		definition.Revision++
		if _, _, err := syncWorkflowAIAppWithSnapshot(tx, definition, false); err != nil {
			return err
		}
		now := time.Now()
		revertedRevision := definition.Revision
		return tx.Model(&change).Updates(map[string]any{
			"status": "reverted", "reverted_at": &now, "reverted_revision": &revertedRevision, "conflict_paths": "[]",
		}).Error
	})
	return definition, conflicts, err
}
