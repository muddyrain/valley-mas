package handler

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"valley-server/internal/database"
	"valley-server/internal/model"
	"valley-server/internal/utils"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type workflowCollaborationTaskContext struct {
	SelectedNodeID string            `json:"selectedNodeId"`
	NodeLabels     map[string]string `json:"nodeLabels"`
}

type workflowCollaborationTaskPayload struct {
	Message         string                           `json:"message"`
	ModelID         string                           `json:"modelId"`
	ActiveSkillID   string                           `json:"activeSkillId"`
	AttachmentIDs   []string                         `json:"attachmentIds"`
	RequestedAction string                           `json:"requestedAction,omitempty"`
	Name            string                           `json:"name"`
	Description     string                           `json:"description"`
	BaseGraph       string                           `json:"baseGraph"`
	Context         workflowCollaborationTaskContext `json:"context"`
}

type archivedWorkflowCollaborationProposal struct {
	ID        model.Int64String `json:"id"`
	Status    string            `json:"status"`
	Summary   string            `json:"summary"`
	CreatedAt time.Time         `json:"createdAt"`
	UpdatedAt time.Time         `json:"updatedAt"`
}

func GetWorkflowCollaboration(c *gin.Context) {
	userID, _, ok := currentUser(c)
	if !ok {
		Error(c, http.StatusUnauthorized, "未登录")
		return
	}
	workflowID, err := parsePathInt64(c, "id")
	if err != nil {
		Error(c, http.StatusBadRequest, "无效的工作流 ID")
		return
	}
	workflowKey := model.Int64String(workflowID)
	ownerID := model.Int64String(userID)
	if err := requireOwnedWorkflow(database.GetDB(), ownerID, workflowKey); err != nil {
		Error(c, http.StatusNotFound, "工作流不存在")
		return
	}
	session, err := resolveCanonicalWorkflowSession(database.GetDB(), ownerID, workflowKey)
	if err != nil {
		Error(c, http.StatusInternalServerError, "加载工作流协作会话失败")
		return
	}
	var messages []model.AIWorkbenchCopilotMessage
	if err := database.GetDB().Where("session_id = ? AND user_id = ?", session.ID, ownerID).
		Order("created_at DESC, id DESC").Limit(100).Find(&messages).Error; err != nil {
		Error(c, http.StatusInternalServerError, "加载工作流协作记录失败")
		return
	}
	reverseWorkflowCollaborationMessages(messages)
	var tasks []model.WorkflowCollaborationTask
	_ = database.GetDB().Where("session_id = ? AND user_id = ?", session.ID, ownerID).
		Order("created_at DESC, id DESC").Limit(30).Find(&tasks).Error
	for index := range tasks {
		setWorkflowCollaborationQueuePosition(database.GetDB(), &tasks[index])
	}
	var changes []model.WorkflowCollaborationChange
	_ = database.GetDB().Where("session_id = ? AND user_id = ?", session.ID, ownerID).
		Order("created_at DESC, id DESC").Limit(30).Find(&changes).Error
	var attachments []model.WorkflowCollaborationAttachment
	_ = database.GetDB().Where("session_id = ? AND user_id = ? AND message_id IS NOT NULL", session.ID, ownerID).
		Order("created_at ASC, id ASC").Limit(100).Find(&attachments).Error
	var approvals []model.WorkflowCollaborationApproval
	_ = database.GetDB().Where("workflow_id = ? AND user_id = ? AND status = ?", workflowID, ownerID, "pending").
		Order("created_at ASC, id ASC").Find(&approvals).Error
	var archivedSessions []model.AIWorkbenchCopilotSession
	_ = database.GetDB().Where("user_id = ? AND scope = ? AND target_id = ? AND archived_at IS NOT NULL", ownerID, "workflow", workflowKey.String()).
		Order("updated_at DESC, id DESC").Find(&archivedSessions).Error
	Success(c, gin.H{
		"enabled": true, "session": session, "messages": messages, "tasks": tasks,
		"changes": changes, "approvals": approvals, "attachments": attachments, "archivedSessions": archivedSessions,
	})
}

// GetArchivedWorkflowCollaborationSession exposes legacy workflow conversations
// as owner-only, read-only records. Candidate and baseline drafts remain server-side.
func GetArchivedWorkflowCollaborationSession(c *gin.Context) {
	userID, _, ok := currentUser(c)
	if !ok {
		Error(c, http.StatusUnauthorized, "未登录")
		return
	}
	workflowID, workflowErr := parsePathInt64(c, "id")
	sessionID, sessionErr := parsePathInt64(c, "sessionId")
	if workflowErr != nil || sessionErr != nil {
		Error(c, http.StatusBadRequest, "无效的旧会话 ID")
		return
	}
	ownerID := model.Int64String(userID)
	workflowKey := model.Int64String(workflowID)
	if err := requireOwnedWorkflow(database.GetDB(), ownerID, workflowKey); err != nil {
		Error(c, http.StatusNotFound, "工作流不存在")
		return
	}

	var session model.AIWorkbenchCopilotSession
	if err := database.GetDB().Where(
		"id = ? AND user_id = ? AND scope = ? AND target_id = ? AND archived_at IS NOT NULL",
		sessionID, ownerID, "workflow", workflowKey.String(),
	).First(&session).Error; err != nil {
		Error(c, http.StatusNotFound, "旧会话不存在")
		return
	}
	var messages []model.AIWorkbenchCopilotMessage
	if err := database.GetDB().Where("session_id = ? AND user_id = ?", session.ID, ownerID).
		Order("created_at DESC, id DESC").Limit(200).Find(&messages).Error; err != nil {
		Error(c, http.StatusInternalServerError, "加载旧会话消息失败")
		return
	}
	reverseWorkflowCollaborationMessages(messages)
	var legacyProposals []model.AIWorkbenchChangeProposal
	if err := database.GetDB().Where("session_id = ? AND user_id = ?", session.ID, ownerID).
		Order("created_at ASC, id ASC").Find(&legacyProposals).Error; err != nil {
		Error(c, http.StatusInternalServerError, "加载旧版变更记录失败")
		return
	}
	proposals := make([]archivedWorkflowCollaborationProposal, 0, len(legacyProposals))
	for _, proposal := range legacyProposals {
		summary := "旧版变更记录"
		switch proposal.Status {
		case "pending":
			summary = "旧版未应用变更"
		case "accepted":
			summary = "旧版已应用变更"
		case "rejected":
			summary = "旧版已拒绝变更"
		case "superseded":
			summary = "旧版变更已被后续记录替代"
		}
		proposals = append(proposals, archivedWorkflowCollaborationProposal{
			ID: proposal.ID, Status: proposal.Status, Summary: summary,
			CreatedAt: proposal.CreatedAt, UpdatedAt: proposal.UpdatedAt,
		})
	}
	Success(c, gin.H{"session": session, "messages": messages, "proposals": proposals})
}

func CreateWorkflowCollaborationTask(c *gin.Context) {
	userID, _, ok := currentUser(c)
	if !ok {
		Error(c, http.StatusUnauthorized, "未登录")
		return
	}
	workflowID, err := parsePathInt64(c, "id")
	if err != nil {
		Error(c, http.StatusBadRequest, "无效的工作流 ID")
		return
	}
	workflowKey := model.Int64String(workflowID)
	var request struct {
		Message       string                           `json:"message"`
		ModelID       string                           `json:"modelId"`
		ActiveSkillID string                           `json:"activeSkillId"`
		AttachmentIDs []string                         `json:"attachmentIds"`
		Context       workflowCollaborationTaskContext `json:"context"`
	}
	if c.ShouldBindJSON(&request) != nil {
		Error(c, http.StatusBadRequest, "工作流协作请求无效")
		return
	}
	request.Message = truncateAIAgentRunes(strings.TrimSpace(request.Message), 4000)
	request.ModelID = strings.TrimSpace(request.ModelID)
	request.ActiveSkillID = strings.TrimSpace(request.ActiveSkillID)
	if request.Message == "" && len(request.AttachmentIDs) == 0 {
		Error(c, http.StatusBadRequest, "请输入要修改或讨论的内容")
		return
	}
	if request.Message == "" {
		request.Message = "请根据本轮附件生成或修改工作流"
	}
	ownerID := model.Int64String(userID)
	if request.ActiveSkillID != "" {
		if _, err := resolveAISkillRuntimeInstructions(database.GetDB(), ownerID, []string{request.ActiveSkillID}); err != nil {
			Error(c, http.StatusBadRequest, "选择的技能不存在或不可用")
			return
		}
	}
	var definition model.Workflow
	if err := database.GetDB().Where("id = ? AND user_id = ?", workflowID, ownerID).First(&definition).Error; err != nil {
		Error(c, http.StatusNotFound, "工作流不存在")
		return
	}
	if exceeded, err := workflowCollaborationUnfinishedLimitExceeded(database.GetDB(), ownerID); err != nil {
		Error(c, http.StatusInternalServerError, "检查工作流协作队列失败")
		return
	} else if exceeded {
		Error(c, http.StatusTooManyRequests, "未完成的 AI 任务已达到 20 个，请等待或停止部分任务")
		return
	}
	session, err := resolveCanonicalWorkflowSession(database.GetDB(), ownerID, workflowKey)
	if err != nil {
		Error(c, http.StatusInternalServerError, "创建工作流协作会话失败")
		return
	}
	attachments, err := resolveWorkflowCollaborationAttachments(database.GetDB(), ownerID, workflowKey, session.ID, request.AttachmentIDs)
	if err != nil {
		Error(c, http.StatusBadRequest, err.Error())
		return
	}
	payloadJSON, _ := json.Marshal(workflowCollaborationTaskPayload{
		Message: request.Message, ModelID: request.ModelID, ActiveSkillID: request.ActiveSkillID,
		AttachmentIDs: request.AttachmentIDs, RequestedAction: workflowCollaborationRequestedAction(request.Message), Name: definition.Name,
		Description: definition.Description, BaseGraph: definition.Graph, Context: request.Context,
	})
	message := model.AIWorkbenchCopilotMessage{
		SessionID: session.ID, UserID: ownerID, Role: "user", Kind: "text", Content: request.Message,
	}
	task := model.WorkflowCollaborationTask{
		UserID: ownerID, WorkflowID: workflowKey, SessionID: session.ID,
		Title: truncateAIAgentRunes(request.Message, 80), Status: "queued", Payload: string(payloadJSON),
		BaseRevision: definition.Revision, BaseHash: workflowGraphHash(definition.Graph),
		IdempotencyKey: fmt.Sprintf("workflow:%s:%d", workflowKey.String(), utils.GenerateID()),
		StatusMessage:  "等待执行",
	}
	if err := database.GetDB().Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&message).Error; err != nil {
			return err
		}
		if len(attachments) > 0 {
			attachmentIDs := make([]model.Int64String, 0, len(attachments))
			for _, attachment := range attachments {
				attachmentIDs = append(attachmentIDs, attachment.ID)
			}
			if err := tx.Model(&model.WorkflowCollaborationAttachment{}).
				Where("id IN ? AND message_id IS NULL", attachmentIDs).Update("message_id", message.ID).Error; err != nil {
				return err
			}
		}
		task.UserMessageID = message.ID
		if err := tx.Create(&task).Error; err != nil {
			return err
		}
		title := session.Title
		if title == "" || title == "AI 协作" || title == "新会话" || title == "工作流协作" {
			title = truncateAIAgentRunes(request.Message, 36)
		}
		return tx.Model(&session).Updates(map[string]any{"title": title, "updated_at": time.Now()}).Error
	}); err != nil {
		Error(c, http.StatusInternalServerError, "创建工作流协作任务失败")
		return
	}
	setWorkflowCollaborationQueuePosition(database.GetDB(), &task)
	notifyWorkflowCollaborationWorker()
	Success(c, gin.H{"session": session, "message": message, "task": task})
}

func GetWorkflowCollaborationTask(c *gin.Context) {
	userID, _, ok := currentUser(c)
	if !ok {
		return
	}
	task, found := loadOwnedWorkflowCollaborationTask(c, model.Int64String(userID))
	if !found {
		return
	}
	setWorkflowCollaborationQueuePosition(database.GetDB(), &task)
	Success(c, gin.H{"task": task})
}

func CancelWorkflowCollaborationTask(c *gin.Context) {
	userID, _, ok := currentUser(c)
	if !ok {
		return
	}
	task, found := loadOwnedWorkflowCollaborationTask(c, model.Int64String(userID))
	if !found {
		return
	}
	now := time.Now()
	switch task.Status {
	case "queued":
		_ = database.GetDB().Model(&task).Updates(map[string]any{
			"status": "cancelled", "status_message": "已停止", "cancel_requested_at": &now, "finished_at": &now,
		}).Error
	case "running":
		_ = database.GetDB().Model(&task).Updates(map[string]any{
			"status_message": "正在停止", "cancel_requested_at": &now,
		}).Error
		cancelWorkflowCollaborationExecution(task.ID)
	case "waiting_approval":
		_ = database.GetDB().Transaction(func(tx *gorm.DB) error {
			if err := tx.Model(&model.WorkflowCollaborationApproval{}).
				Where("task_id = ? AND user_id = ? AND status = ?", task.ID, task.UserID, "pending").
				Updates(map[string]any{"status": "rejected", "note": "任务已停止", "decided_at": &now}).Error; err != nil {
				return err
			}
			return tx.Model(&task).Updates(map[string]any{
				"status": "cancelled", "status_message": "已停止", "cancel_requested_at": &now, "finished_at": &now,
			}).Error
		})
	}
	_ = database.GetDB().First(&task, task.ID).Error
	Success(c, gin.H{"task": task})
}

func ResetWorkflowCollaborationContext(c *gin.Context) {
	userID, _, ok := currentUser(c)
	if !ok {
		return
	}
	workflowID, err := parsePathInt64(c, "id")
	if err != nil {
		Error(c, http.StatusBadRequest, "无效的工作流 ID")
		return
	}
	workflowKey := model.Int64String(workflowID)
	ownerID := model.Int64String(userID)
	if err := requireOwnedWorkflow(database.GetDB(), ownerID, workflowKey); err != nil {
		Error(c, http.StatusNotFound, "工作流不存在")
		return
	}
	session, err := resolveCanonicalWorkflowSession(database.GetDB(), ownerID, workflowKey)
	if err != nil {
		Error(c, http.StatusInternalServerError, "加载工作流协作会话失败")
		return
	}
	now := time.Now()
	if err := database.GetDB().Model(&session).Update("context_reset_at", &now).Error; err != nil {
		Error(c, http.StatusInternalServerError, "重置 AI 上下文失败")
		return
	}
	session.ContextResetAt = &now
	Success(c, gin.H{"session": session})
}

func RevertWorkflowCollaborationChange(c *gin.Context) {
	userID, _, ok := currentUser(c)
	if !ok {
		return
	}
	workflowID, err := parsePathInt64(c, "id")
	if err != nil {
		Error(c, http.StatusBadRequest, "无效的工作流 ID")
		return
	}
	workflowKey := model.Int64String(workflowID)
	changeID, err := parsePathInt64(c, "changeId")
	if err != nil {
		Error(c, http.StatusBadRequest, "无效的变更 ID")
		return
	}
	definition, conflicts, err := revertWorkflowCollaborationChange(database.GetDB(), model.Int64String(userID), workflowKey, model.Int64String(changeID))
	if len(conflicts) > 0 {
		Error(c, http.StatusConflict, "相关节点已被后续修改，无法撤销整次 AI 变更")
		return
	}
	if errors.Is(err, errWorkflowCollaborationChangeNotFound) {
		Error(c, http.StatusNotFound, "AI 变更不存在")
		return
	}
	if errors.Is(err, errWorkflowCollaborationAlreadyReverted) {
		Error(c, http.StatusConflict, "这次 AI 变更已经撤销")
		return
	}
	if err != nil {
		Error(c, http.StatusInternalServerError, "撤销 AI 变更失败")
		return
	}
	definition.GraphHash = workflowGraphHash(definition.Graph)
	Success(c, gin.H{"workflow": definition, "graphHash": definition.GraphHash, "revision": definition.Revision})
}

func requireOwnedWorkflow(db *gorm.DB, userID, workflowID model.Int64String) error {
	var count int64
	if err := db.Model(&model.Workflow{}).Where("id = ? AND user_id = ?", workflowID, userID).Count(&count).Error; err != nil {
		return err
	}
	if count != 1 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func loadOwnedWorkflowCollaborationTask(c *gin.Context, userID model.Int64String) (model.WorkflowCollaborationTask, bool) {
	workflowID, err := parsePathInt64(c, "id")
	if err != nil {
		Error(c, http.StatusBadRequest, "无效的工作流 ID")
		return model.WorkflowCollaborationTask{}, false
	}
	taskID, err := parsePathInt64(c, "taskId")
	if err != nil {
		Error(c, http.StatusBadRequest, "无效的任务 ID")
		return model.WorkflowCollaborationTask{}, false
	}
	var task model.WorkflowCollaborationTask
	if err := database.GetDB().Where("id = ? AND workflow_id = ? AND user_id = ?", taskID, workflowID, userID).First(&task).Error; err != nil {
		Error(c, http.StatusNotFound, "工作流协作任务不存在")
		return model.WorkflowCollaborationTask{}, false
	}
	return task, true
}

func workflowCollaborationUnfinishedLimitExceeded(db *gorm.DB, userID model.Int64String) (bool, error) {
	statuses := []string{"queued", "running", "waiting_approval"}
	var workflowCount, appCount int64
	if err := db.Model(&model.WorkflowCollaborationTask{}).Where("user_id = ? AND status IN ?", userID, statuses).Count(&workflowCount).Error; err != nil {
		return false, err
	}
	if err := db.Model(&model.AIAppTask{}).Where("user_id = ? AND status IN ?", userID, statuses).Count(&appCount).Error; err != nil {
		// Older installations may not have migrated AI App tasks yet.
		if !strings.Contains(strings.ToLower(err.Error()), "no such table") {
			return false, err
		}
	}
	return workflowCount+appCount >= aiAppTaskMaxUnfinishedPerUser, nil
}

func setWorkflowCollaborationQueuePosition(db *gorm.DB, task *model.WorkflowCollaborationTask) {
	if task.Status != "queued" {
		task.QueuePosition = 0
		return
	}
	var ids []model.Int64String
	if err := db.Model(&model.WorkflowCollaborationTask{}).
		Where("user_id = ? AND status = ?", task.UserID, "queued").Order("created_at ASC, id ASC").Pluck("id", &ids).Error; err != nil {
		return
	}
	for index, id := range ids {
		if id == task.ID {
			task.QueuePosition = index + 1
			return
		}
	}
}

func reverseWorkflowCollaborationMessages(messages []model.AIWorkbenchCopilotMessage) {
	for left, right := 0, len(messages)-1; left < right; left, right = left+1, right-1 {
		messages[left], messages[right] = messages[right], messages[left]
	}
}
