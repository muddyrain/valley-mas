package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"valley-server/internal/database"
	"valley-server/internal/model"
	"valley-server/internal/workflow"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func workflowApprovalGate(run model.WorkflowRun) workflow.ApprovalGate {
	return workflow.ApprovalGateFunc(func(
		ctx context.Context,
		_ string,
		nodeID string,
		title string,
		description string,
	) (workflow.ApprovalDecision, error) {
		approval := model.WorkflowApproval{}
		err := database.GetDB().WithContext(ctx).
			Where("workflow_run_id = ? AND node_id = ?", run.ID, nodeID).
			Attrs(model.WorkflowApproval{
				WorkflowRunID: run.ID, WorkflowID: run.WorkflowID, UserID: run.UserID,
				NodeID: nodeID, Title: title, Description: description, Status: "pending",
			}).
			FirstOrCreate(&approval).Error
		if err != nil {
			return workflow.ApprovalDecision{}, err
		}
		return workflow.ApprovalDecision{
			ApprovalID: approval.ID.String(), Status: approval.Status, Note: approval.Note,
		}, nil
	})
}

func ListWorkflowApprovals(c *gin.Context) {
	userID, _, ok := currentUser(c)
	if !ok {
		Error(c, http.StatusUnauthorized, "未登录")
		return
	}
	workflowID, err := parsePathInt64(c, "id")
	if err != nil {
		Error(c, http.StatusBadRequest, "无效的 ID")
		return
	}
	if !workflowOwnedBy(workflowID, userID) {
		Error(c, http.StatusNotFound, "工作流不存在")
		return
	}
	var approvals []model.WorkflowApproval
	if err := database.GetDB().
		Where("workflow_id = ? AND user_id = ?", workflowID, userID).
		Order("created_at DESC").
		Limit(100).
		Find(&approvals).Error; err != nil {
		Error(c, http.StatusInternalServerError, "加载人工审批失败")
		return
	}
	Success(c, gin.H{"list": approvals})
}

func DecideWorkflowApproval(c *gin.Context) {
	userID, _, ok := currentUser(c)
	if !ok {
		Error(c, http.StatusUnauthorized, "未登录")
		return
	}
	workflowID, err := parsePathInt64(c, "id")
	if err != nil {
		Error(c, http.StatusBadRequest, "无效的 ID")
		return
	}
	approvalID, err := parsePathInt64(c, "approvalId")
	if err != nil {
		Error(c, http.StatusBadRequest, "无效的审批 ID")
		return
	}
	var payload struct {
		Decision string `json:"decision"`
		Note     string `json:"note"`
	}
	if err := c.ShouldBindJSON(&payload); err != nil {
		Error(c, http.StatusBadRequest, "审批参数无效")
		return
	}
	payload.Decision = strings.TrimSpace(payload.Decision)
	payload.Note = strings.TrimSpace(payload.Note)
	if payload.Decision != "approved" && payload.Decision != "rejected" {
		Error(c, http.StatusBadRequest, "审批决定必须为 approved 或 rejected")
		return
	}
	if len([]rune(payload.Note)) > 1000 {
		Error(c, http.StatusBadRequest, "审批备注不能超过 1000 个字符")
		return
	}
	now := time.Now()
	result := database.GetDB().Model(&model.WorkflowApproval{}).
		Where(
			"id = ? AND workflow_id = ? AND user_id = ? AND status = ?",
			approvalID, workflowID, userID, "pending",
		).
		Updates(map[string]any{
			"status": payload.Decision, "note": payload.Note, "decided_at": now,
		})
	if result.Error != nil {
		Error(c, http.StatusInternalServerError, "保存审批决定失败")
		return
	}
	if result.RowsAffected == 0 {
		Error(c, http.StatusConflict, "审批不存在或已经处理")
		return
	}
	var approval model.WorkflowApproval
	if err := database.GetDB().First(&approval, approvalID).Error; err != nil {
		Error(c, http.StatusInternalServerError, "加载审批结果失败")
		return
	}
	Success(c, approval)
}

func resumeDecidedWorkflowApprovals(ctx context.Context, now time.Time) {
	db := database.GetDB()
	var candidates []model.WorkflowApproval
	if err := db.WithContext(ctx).
		Where("status IN ? AND resumed_at IS NULL", []string{"approved", "rejected"}).
		Order("decided_at ASC").
		Limit(10).
		Find(&candidates).Error; err != nil {
		return
	}
	for _, candidate := range candidates {
		result := db.WithContext(ctx).Model(&model.WorkflowApproval{}).
			Where("id = ? AND resumed_at IS NULL", candidate.ID).
			Update("resumed_at", now)
		if result.Error != nil || result.RowsAffected == 0 {
			continue
		}
		if err := resumeWorkflowApproval(ctx, db, candidate); err != nil {
			_ = db.Model(&model.WorkflowRun{}).Where("id = ?", candidate.WorkflowRunID).
				Updates(map[string]any{
					"status":      string(workflow.StatusFailed),
					"result":      `{"error":"WORKFLOW_APPROVAL_RESUME_FAILED"}`,
					"finished_at": time.Now(),
				}).Error
			_ = finishTriggeredApprovalJob(db, candidate.WorkflowRunID, "error", "WORKFLOW_APPROVAL_RESUME_FAILED")
		}
	}
}

func resumeWorkflowApproval(parent context.Context, db *gorm.DB, approval model.WorkflowApproval) error {
	var run model.WorkflowRun
	if err := db.WithContext(parent).
		Where("id = ? AND workflow_id = ? AND user_id = ? AND status = ?", approval.WorkflowRunID, approval.WorkflowID, approval.UserID, workflow.StatusWaiting).
		First(&run).Error; err != nil {
		return err
	}
	graph, err := decodeWorkflowGraph(run.GraphSnapshot)
	if err != nil {
		return err
	}
	registry := workflowRuntimeRegistry()
	if validationErrors := workflow.ValidateGraph(graph, registry); len(validationErrors) > 0 {
		return fmt.Errorf("approval graph invalid: %v", validationErrors)
	}
	inputs := map[string]any{}
	if err := json.Unmarshal([]byte(run.Inputs), &inputs); err != nil || inputs == nil {
		return fmt.Errorf("approval run inputs are invalid")
	}
	var app model.AIApp
	if err := db.WithContext(parent).Where("id = ? AND user_id = ?", run.AppID, run.UserID).First(&app).Error; err != nil {
		return err
	}
	var version model.AIAppVersion
	if err := db.WithContext(parent).Where("id = ? AND app_id = ?", run.VersionID, app.ID).First(&version).Error; err != nil {
		return err
	}
	var user model.User
	if err := db.WithContext(parent).Select("id", "role").First(&user, run.UserID).Error; err != nil {
		return err
	}
	if err := db.Model(&run).Updates(map[string]any{
		"status": string(workflow.StatusRunning), "finished_at": nil,
	}).Error; err != nil {
		return err
	}
	var sequence int64
	_ = db.Model(&model.WorkflowRunEvent{}).
		Where("workflow_run_id = ?", run.ID).
		Select("COALESCE(MAX(sequence), 0)").
		Scan(&sequence).Error
	nodeTypes := make(map[string]workflow.NodeType, len(graph.Nodes))
	for _, node := range graph.Nodes {
		nodeTypes[node.ID] = node.Type
	}
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
			ID: run.ID.String(), Actor: workflow.Actor{UserID: int64(run.UserID), Role: user.Role},
			Inputs: inputs, Outputs: make(map[string]map[string]any),
			KnowledgeRetriever:       workflowKnowledgeRetriever(run.UserID, version),
			KnowledgeWriter:          workflowKnowledgeWriter(),
			FileWriter:               workflowFileWriter(),
			ContentSearcher:          workflowContentSearcher(run.UserID),
			NotionSearcher:           workflowNotionSearcher(run.UserID),
			CoverGenerator:           workflowCoverGenerator(),
			AIImageGenerator:         workflowAIImageGenerator(),
			AIImageUnderstander:      workflowAIImageUnderstander(),
			AIImageResourceSaver:     workflowAIImageResourceSaver(),
			NotificationSender:       workflowNotificationSender(),
			SubworkflowRunner:        workflowSubworkflowRunner(run.UserID),
			ApprovalGate:             workflowApprovalGate(run),
			SkillInstructionResolver: workflowAISkillInstructionResolver(run.UserID),
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
		if failureCode == "" {
			failureCode = "WORKFLOW_APPROVAL_RESUME_FAILED"
		}
		if failureCode == "WORKFLOW_CANCELLED" {
			_ = finishWorkflowRun(&run, string(workflow.StatusCancelled), map[string]any{"error": failureCode})
			persistWorkflowAIAppRun(app, version, run, "cancelled", nil, failureCode)
			_ = finishTriggeredApprovalJob(db, run.ID, "error", failureCode)
			return executeErr
		}
		_ = finishWorkflowRun(&run, string(workflow.StatusFailed), map[string]any{"error": failureCode})
		persistWorkflowAIAppRun(app, version, run, "failed", nil, failureCode)
		_ = finishTriggeredApprovalJob(db, run.ID, "error", failureCode)
		return executeErr
	}
	if finalOutput == nil {
		finalOutput = map[string]any{}
	}
	if err := finishWorkflowRun(&run, string(workflow.StatusSucceeded), finalOutput); err != nil {
		return err
	}
	persistWorkflowAIAppRun(app, version, run, "succeeded", finalOutput, "")
	_ = finishTriggeredApprovalJob(db, run.ID, "success", "")
	return nil
}

func finishTriggeredApprovalJob(
	db *gorm.DB,
	runID model.Int64String,
	status string,
	errorCode string,
) error {
	var run model.WorkflowRun
	if err := db.Select("run_job_id").First(&run, runID).Error; err != nil {
		return err
	}
	if run.RunJobID == nil {
		return nil
	}
	return db.Model(&model.WorkflowRunJob{}).Where("id = ?", *run.RunJobID).Updates(map[string]any{
		"status": status, "lease_until": nil, "error_code": errorCode,
	}).Error
}
