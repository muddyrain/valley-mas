package handler

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strings"
	"time"

	"valley-server/internal/database"
	"valley-server/internal/model"
	"valley-server/internal/workflow"
	"valley-server/internal/workflowtrigger"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func workflowCollaborationRequestedAction(message string) string {
	normalized := strings.ToLower(strings.Join(strings.Fields(message), ""))
	if normalized == "" {
		return ""
	}
	if strings.Contains(normalized, "触发器") || strings.Contains(normalized, "trigger") {
		if containsWorkflowActionRequest(normalized, "停用", "禁用", "disable") {
			return "triggers.disable"
		}
		if containsWorkflowActionRequest(normalized, "启用", "开启", "enable") {
			return "triggers.enable"
		}
	}
	if containsWorkflowActionRequest(normalized, "发布", "publish") &&
		!strings.Contains(normalized, "节点") {
		return "publish"
	}
	if containsWorkflowActionRequest(normalized, "试运行", "运行当前工作流", "运行这个工作流", "runworkflow") {
		return "run"
	}
	return ""
}

func containsWorkflowActionRequest(message string, actions ...string) bool {
	prefixes := []string{"请", "帮我", "现在", "立即", "直接", "确认", "/"}
	for _, action := range actions {
		for _, prefix := range prefixes {
			if strings.Contains(message, prefix+action) {
				return true
			}
		}
		if strings.HasPrefix(message, action+"当前") || strings.HasPrefix(message, action+"这个") ||
			message == action+"触发器" {
			return true
		}
	}
	return false
}

func handleWorkflowCollaborationRequestedAction(db *gorm.DB, task *model.WorkflowCollaborationTask, action string) error {
	var approval model.WorkflowCollaborationApproval
	err := db.Where("task_id = ? AND user_id = ? AND workflow_id = ? AND action = ?", task.ID, task.UserID, task.WorkflowID, action).
		First(&approval).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		arguments, _ := json.Marshal(map[string]any{"workflowId": task.WorkflowID, "action": action})
		fingerprintRaw := fmt.Sprintf("%s:%s:%s", task.ID, action, arguments)
		digest := sha256.Sum256([]byte(fingerprintRaw))
		approval = model.WorkflowCollaborationApproval{
			TaskID: task.ID, UserID: task.UserID, WorkflowID: task.WorkflowID, Action: action,
			RiskLevel: "high", Fingerprint: hex.EncodeToString(digest[:]), Summary: workflowCollaborationApprovalSummary(db, task, action),
			Arguments: string(arguments), Status: "pending",
		}
		if err := db.Transaction(func(tx *gorm.DB) error {
			if err := tx.Create(&approval).Error; err != nil {
				return err
			}
			return tx.Model(task).Updates(map[string]any{
				"status": "waiting_approval", "progress": 50, "status_message": "等待你的确认",
			}).Error
		}); err != nil {
			return err
		}
		createWorkflowCollaborationNotification(db, task, "waiting_approval", approval.Summary)
		return nil
	}
	if err != nil {
		return err
	}
	if approval.Status == "pending" {
		return db.Model(task).Updates(map[string]any{
			"status": "waiting_approval", "progress": 50, "status_message": "等待你的确认",
		}).Error
	}
	if approval.Status != "approved" {
		return cancelWorkflowCollaborationTask(db, task)
	}

	message, err := executeWorkflowCollaborationApprovedAction(db, task, action)
	if err != nil {
		return failWorkflowCollaborationTask(db, task, "WORKFLOW_ACTION_FAILED", "已确认的工作流操作执行失败", err)
	}
	if err := createWorkflowCollaborationAssistantMessage(db, task, "answer", message); err != nil {
		return err
	}
	now := time.Now()
	if err := db.Model(task).Updates(map[string]any{
		"status": "succeeded", "progress": 100, "status_message": "操作已完成", "partial_output": message, "finished_at": &now,
	}).Error; err != nil {
		return err
	}
	createWorkflowCollaborationNotification(db, task, "succeeded", message)
	return nil
}

func workflowCollaborationApprovalSummary(db *gorm.DB, task *model.WorkflowCollaborationTask, action string) string {
	switch action {
	case "publish":
		return "发布当前工作流。发布后外部入口将使用新的已发布版本。"
	case "run":
		return "试运行当前工作流。运行可能调用模型、HTTP、通知或写入类节点。"
	case "triggers.enable", "triggers.disable":
		var count int64
		_ = db.Model(&model.WorkflowTrigger{}).Where("workflow_id = ? AND user_id = ?", task.WorkflowID, task.UserID).Count(&count).Error
		verb := "启用"
		if action == "triggers.disable" {
			verb = "停用"
		}
		return fmt.Sprintf("%s当前工作流的 %d 个现有触发器。", verb, count)
	default:
		return "执行工作流高风险操作。"
	}
}

func DecideWorkflowCollaborationApproval(c *gin.Context) {
	userID, _, ok := currentUser(c)
	if !ok {
		return
	}
	workflowID, workflowErr := parsePathInt64(c, "id")
	taskID, taskErr := parsePathInt64(c, "taskId")
	approvalID, approvalErr := parsePathInt64(c, "approvalId")
	if workflowErr != nil || taskErr != nil || approvalErr != nil {
		Error(c, http.StatusBadRequest, "无效的确认请求")
		return
	}
	var request struct {
		Decision string `json:"decision"`
		Note     string `json:"note"`
	}
	if c.ShouldBindJSON(&request) != nil {
		Error(c, http.StatusBadRequest, "确认参数无效")
		return
	}
	request.Decision = strings.ToLower(strings.TrimSpace(request.Decision))
	if request.Decision != "approved" && request.Decision != "rejected" {
		Error(c, http.StatusBadRequest, "确认决定无效")
		return
	}
	ownerID := model.Int64String(userID)
	var task model.WorkflowCollaborationTask
	var approval model.WorkflowCollaborationApproval
	now := time.Now()
	err := database.GetDB().Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("id = ? AND workflow_id = ? AND user_id = ?", taskID, workflowID, ownerID).First(&task).Error; err != nil {
			return err
		}
		if err := tx.Where("id = ? AND task_id = ? AND workflow_id = ? AND user_id = ?", approvalID, task.ID, workflowID, ownerID).First(&approval).Error; err != nil {
			return err
		}
		if approval.Status != "pending" || task.Status != "waiting_approval" {
			return errWorkflowCollaborationApprovalDecided
		}
		approvalResult := tx.Model(&model.WorkflowCollaborationApproval{}).
			Where("id = ? AND status = ?", approval.ID, "pending").Updates(map[string]any{
			"status": request.Decision, "note": truncateAIAgentRunes(strings.TrimSpace(request.Note), 500), "decided_at": &now,
		})
		if approvalResult.Error != nil {
			return approvalResult.Error
		}
		if approvalResult.RowsAffected != 1 {
			return errWorkflowCollaborationApprovalDecided
		}
		var taskResult *gorm.DB
		if request.Decision == "approved" {
			taskResult = tx.Model(&model.WorkflowCollaborationTask{}).
				Where("id = ? AND status = ?", task.ID, "waiting_approval").Updates(map[string]any{
				"status": "queued", "progress": 0, "status_message": "已确认，等待执行", "started_at": nil,
			})
		} else {
			taskResult = tx.Model(&model.WorkflowCollaborationTask{}).
				Where("id = ? AND status = ?", task.ID, "waiting_approval").Updates(map[string]any{
				"status": "cancelled", "progress": 100, "status_message": "已拒绝", "finished_at": &now,
			})
		}
		if taskResult.Error != nil {
			return taskResult.Error
		}
		if taskResult.RowsAffected != 1 {
			return errWorkflowCollaborationApprovalDecided
		}
		return nil
	})
	if errors.Is(err, gorm.ErrRecordNotFound) {
		Error(c, http.StatusNotFound, "确认记录不存在")
		return
	}
	if errors.Is(err, errWorkflowCollaborationApprovalDecided) {
		Error(c, http.StatusConflict, "这项操作已经处理")
		return
	}
	if err != nil {
		Error(c, http.StatusInternalServerError, "保存确认决定失败")
		return
	}
	if request.Decision == "approved" {
		notifyWorkflowCollaborationWorker()
	} else {
		_ = createWorkflowCollaborationAssistantMessage(database.GetDB(), &task, "answer", "已拒绝高风险操作，本次任务未执行对应动作。")
	}
	_ = database.GetDB().First(&task, task.ID).Error
	_ = database.GetDB().First(&approval, approval.ID).Error
	Success(c, gin.H{"task": task, "approval": approval})
}

var errWorkflowCollaborationApprovalDecided = errors.New("workflow collaboration approval already decided")

func executeWorkflowCollaborationApprovedAction(db *gorm.DB, task *model.WorkflowCollaborationTask, action string) (string, error) {
	switch action {
	case "publish":
		if err := publishOwnedWorkflow(db, task.UserID, task.WorkflowID); err != nil {
			return "", err
		}
		return "工作流已发布。", nil
	case "run":
		return runOwnedWorkflowForCollaboration(db, task.UserID, task.WorkflowID)
	case "triggers.enable":
		count, err := setOwnedWorkflowTriggersStatus(db, task.UserID, task.WorkflowID, "active")
		return fmt.Sprintf("已启用 %d 个工作流触发器。", count), err
	case "triggers.disable":
		count, err := setOwnedWorkflowTriggersStatus(db, task.UserID, task.WorkflowID, "disabled")
		return fmt.Sprintf("已停用 %d 个工作流触发器。", count), err
	default:
		return "", errors.New("unsupported workflow collaboration action")
	}
}

func publishOwnedWorkflow(db *gorm.DB, userID, workflowID model.Int64String) error {
	return db.Transaction(func(tx *gorm.DB) error {
		var definition model.Workflow
		if err := tx.Where("id = ? AND user_id = ?", workflowID, userID).First(&definition).Error; err != nil {
			return err
		}
		if err := validateWorkflowDraftForSave(tx, definition.Graph, int64(userID), int64(workflowID)); err != nil {
			return fmt.Errorf("%w: %v", errWorkflowDraftInvalid, err)
		}
		app, version, err := syncWorkflowAIApp(tx, definition)
		if err != nil {
			return err
		}
		if err := tx.Model(&definition).Update("status", "published").Error; err != nil {
			return err
		}
		now := time.Now()
		if err := tx.Model(&model.AIAppVersion{}).Where("id = ? AND app_id = ?", version.ID, app.ID).Update("published_at", now).Error; err != nil {
			return err
		}
		return tx.Model(&app).Updates(map[string]any{"status": "published", "published_version_id": version.ID}).Error
	})
}

func runOwnedWorkflowForCollaboration(db *gorm.DB, userID, workflowID model.Int64String) (string, error) {
	var definition model.Workflow
	if err := db.Where("id = ? AND user_id = ?", workflowID, userID).First(&definition).Error; err != nil {
		return "", err
	}
	var app model.AIApp
	var version model.AIAppVersion
	if err := db.Transaction(func(tx *gorm.DB) error {
		var syncErr error
		app, version, syncErr = syncWorkflowAIAppWithoutSnapshot(tx, definition)
		return syncErr
	}); err != nil {
		return "", err
	}
	graph, err := decodeWorkflowGraph(definition.Graph)
	if err != nil {
		return "", err
	}
	if validationErrors := workflow.ValidateGraph(graph, workflowRuntimeRegistry()); len(validationErrors) > 0 {
		return "", errors.New(strings.Join(validationErrors, "；"))
	}
	budget := workflowExecutionBudget{}
	if err := validateSubworkflowReferences(db, graph, userID, workflowID, map[string]bool{}, &budget); err != nil {
		return "", err
	}
	var requestBody bytes.Buffer
	multipartWriter := multipart.NewWriter(&requestBody)
	if err := multipartWriter.Close(); err != nil {
		return "", err
	}
	recorder := httptest.NewRecorder()
	runContext, _ := gin.CreateTestContext(recorder)
	runContext.Request = httptest.NewRequest(http.MethodPost, "/internal/workflow-collaboration/run", &requestBody)
	runContext.Request.Header.Set("Content-Type", multipartWriter.FormDataContentType())
	startedAt := time.Now()
	runWorkflowGraph(runContext, int64(userID), "user", definition, graph, app, version, nil)
	var run model.WorkflowRun
	if err := db.Where("workflow_id = ? AND user_id = ? AND started_at >= ?", workflowID, userID, startedAt.Add(-time.Second)).Order("started_at DESC, id DESC").First(&run).Error; err != nil {
		return "", fmt.Errorf("试运行未创建运行记录: %w", err)
	}
	if run.Status == string(workflow.StatusFailed) {
		return "", fmt.Errorf("试运行失败，运行记录 %s：%s", run.ID, truncateAIAgentRunes(run.Result, 300))
	}
	if run.Status == string(workflow.StatusWaiting) {
		return fmt.Sprintf("试运行 %s 已启动，当前等待运行节点确认。", run.ID), nil
	}
	return fmt.Sprintf("试运行 %s 已完成。", run.ID), nil
}

func setOwnedWorkflowTriggersStatus(db *gorm.DB, userID, workflowID model.Int64String, status string) (int, error) {
	var triggers []model.WorkflowTrigger
	if err := db.Where("workflow_id = ? AND user_id = ?", workflowID, userID).Find(&triggers).Error; err != nil {
		return 0, err
	}
	if len(triggers) == 0 {
		return 0, errors.New("当前工作流没有可更新的触发器")
	}
	err := db.Transaction(func(tx *gorm.DB) error {
		for index := range triggers {
			updates := map[string]any{"status": status, "next_run_at": nil}
			if status == "active" && triggers[index].Type == workflowtrigger.TypeCron {
				schedule, err := workflowtrigger.Parse(triggers[index].CronExpression, triggers[index].Timezone)
				if err != nil {
					return err
				}
				updates["next_run_at"] = schedule.Next(time.Now())
			}
			if err := tx.Model(&triggers[index]).Updates(updates).Error; err != nil {
				return err
			}
		}
		return nil
	})
	return len(triggers), err
}
