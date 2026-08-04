package handler

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"

	"valley-server/internal/aiclient"
	"valley-server/internal/aimodel"
	"valley-server/internal/database"
	"valley-server/internal/logger"
	"valley-server/internal/model"
	"valley-server/internal/workflow"

	"gorm.io/gorm"
)

const workflowCollaborationPollInterval = 2 * time.Second

var (
	workflowCollaborationWorkerOnce sync.Once
	workflowCollaborationClaimMu    sync.Mutex
	workflowCollaborationCancelsMu  sync.Mutex
	workflowCollaborationCancels    = map[string]context.CancelFunc{}
	workflowCollaborationWorkerWake = make(chan struct{}, 1)
)

func StartWorkflowCollaborationWorker(ctx context.Context) {
	workflowCollaborationWorkerOnce.Do(func() {
		if db := database.GetDB(); db != nil {
			_ = db.Model(&model.WorkflowCollaborationTask{}).Where("status = ?", "running").Updates(map[string]any{
				"status": "queued", "progress": 0, "status_message": "等待恢复执行", "partial_output": "", "started_at": nil,
			}).Error
		}
		go func() {
			ticker := time.NewTicker(workflowCollaborationPollInterval)
			defer ticker.Stop()
			runWorkflowCollaborationWorkerTick(ctx)
			for {
				select {
				case <-ctx.Done():
					return
				case <-workflowCollaborationWorkerWake:
					runWorkflowCollaborationWorkerTick(ctx)
				case <-ticker.C:
					runWorkflowCollaborationWorkerTick(ctx)
				}
			}
		}()
	})
}

func notifyWorkflowCollaborationWorker() {
	select {
	case workflowCollaborationWorkerWake <- struct{}{}:
	default:
	}
}

func runWorkflowCollaborationWorkerTick(ctx context.Context) {
	db := database.GetDB()
	if db == nil {
		return
	}
	for {
		task, claimed, err := claimWorkflowCollaborationTask(ctx, db)
		if err != nil {
			logger.Log.Warnf("workflow collaboration task claim failed: %v", err)
			return
		}
		if !claimed {
			return
		}
		launchWorkflowCollaborationTask(ctx, db, task)
	}
}

func claimWorkflowCollaborationTask(ctx context.Context, db *gorm.DB) (model.WorkflowCollaborationTask, bool, error) {
	workflowCollaborationClaimMu.Lock()
	defer workflowCollaborationClaimMu.Unlock()
	var candidates []model.WorkflowCollaborationTask
	if err := db.WithContext(ctx).Where("status = ?", "queued").Order("created_at ASC, id ASC").Limit(100).Find(&candidates).Error; err != nil {
		return model.WorkflowCollaborationTask{}, false, err
	}
	for _, candidate := range candidates {
		claimed := false
		err := db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
			var earlier, workflowActive, ownerWorkflowActive, ownerAppActive int64
			if err := tx.Model(&model.WorkflowCollaborationTask{}).
				Where("workflow_id = ? AND status = ?", candidate.WorkflowID, "queued").
				Where("created_at < ? OR (created_at = ? AND id < ?)", candidate.CreatedAt, candidate.CreatedAt, candidate.ID).
				Count(&earlier).Error; err != nil {
				return err
			}
			if earlier > 0 {
				return nil
			}
			if err := tx.Model(&model.WorkflowCollaborationTask{}).
				Where("workflow_id = ? AND status IN ?", candidate.WorkflowID, []string{"running", "waiting_approval"}).
				Count(&workflowActive).Error; err != nil {
				return err
			}
			if workflowActive > 0 {
				return nil
			}
			if err := tx.Model(&model.WorkflowCollaborationTask{}).
				Where("user_id = ? AND status IN ?", candidate.UserID, []string{"running", "waiting_approval"}).
				Count(&ownerWorkflowActive).Error; err != nil {
				return err
			}
			if err := tx.Model(&model.AIAppTask{}).
				Where("user_id = ? AND status IN ?", candidate.UserID, []string{"running", "waiting_approval"}).
				Count(&ownerAppActive).Error; err != nil && !strings.Contains(strings.ToLower(err.Error()), "no such table") {
				return err
			}
			if ownerWorkflowActive+ownerAppActive >= aiAppTaskMaxConcurrentPerUser {
				return nil
			}
			now := time.Now()
			result := tx.Model(&model.WorkflowCollaborationTask{}).Where("id = ? AND status = ?", candidate.ID, "queued").Updates(map[string]any{
				"status": "running", "progress": 5, "status_message": "正在读取工作流", "started_at": &now,
			})
			if result.Error != nil {
				return result.Error
			}
			if result.RowsAffected == 0 {
				return nil
			}
			if err := tx.First(&candidate, candidate.ID).Error; err != nil {
				return err
			}
			claimed = true
			return nil
		})
		if err != nil {
			return model.WorkflowCollaborationTask{}, false, err
		}
		if claimed {
			return candidate, true, nil
		}
	}
	return model.WorkflowCollaborationTask{}, false, nil
}

func launchWorkflowCollaborationTask(parent context.Context, db *gorm.DB, task model.WorkflowCollaborationTask) {
	go func() {
		if err := executeWorkflowCollaborationTask(parent, db, &task); err != nil && !errors.Is(err, context.Canceled) {
			logger.Log.Warnf("workflow collaboration task %s failed: %v", task.ID, err)
		}
		notifyWorkflowCollaborationWorker()
	}()
}

func executeWorkflowCollaborationTask(parent context.Context, db *gorm.DB, task *model.WorkflowCollaborationTask) error {
	ctx, cancel := context.WithTimeout(parent, copilotPlanningTimeout)
	workflowCollaborationCancelsMu.Lock()
	workflowCollaborationCancels[task.ID.String()] = cancel
	workflowCollaborationCancelsMu.Unlock()
	defer func() {
		cancel()
		workflowCollaborationCancelsMu.Lock()
		delete(workflowCollaborationCancels, task.ID.String())
		workflowCollaborationCancelsMu.Unlock()
	}()

	var payload workflowCollaborationTaskPayload
	if err := json.Unmarshal([]byte(task.Payload), &payload); err != nil {
		return failWorkflowCollaborationTask(db, task, "WORKFLOW_TASK_INVALID", "任务上下文无效", err)
	}
	var baseGraph workflow.Graph
	if err := json.Unmarshal([]byte(payload.BaseGraph), &baseGraph); err != nil {
		return failWorkflowCollaborationTask(db, task, "WORKFLOW_GRAPH_INVALID", "任务基线工作流无效", err)
	}
	if workflowCollaborationCancelRequested(db, task.ID) {
		return cancelWorkflowCollaborationTask(db, task)
	}
	if payload.RequestedAction != "" {
		return handleWorkflowCollaborationRequestedAction(db, task, payload.RequestedAction)
	}

	var attachments []model.WorkflowCollaborationAttachment
	_ = db.Where("message_id = ? AND user_id = ? AND workflow_id = ?", task.UserMessageID, task.UserID, task.WorkflowID).
		Order("created_at ASC, id ASC").Find(&attachments).Error
	referenceImages := workflowCollaborationReferenceImages(attachments)
	requiredCapability := "text"
	if len(referenceImages) > 0 {
		requiredCapability = "vision"
	}
	selectedModel, err := selectWorkflowCollaborationModel(db, payload.ModelID, requiredCapability)
	if err != nil {
		return failWorkflowCollaborationTask(db, task, "MODEL_NOT_CONFIGURED", "当前没有可用的文本模型", err)
	}
	invocation, err := aimodel.ResolveInvocation(db, selectedModel.ID.String(), requiredCapability, copilotPlanningTimeout)
	if err != nil {
		return failWorkflowCollaborationTask(db, task, "MODEL_NOT_CONFIGURED", "协作模型不可用", err)
	}

	draft := aiWorkflowDraft{Name: payload.Name, Description: payload.Description, Graph: baseGraph}
	draftJSON, _ := json.Marshal(draft)
	copilotPayload := copilotMessageRequest{
		Scope: "workflow", TargetID: task.WorkflowID.String(), SessionID: task.SessionID.String(), ModelID: payload.ModelID, Message: payload.Message,
		Context: copilotContextPayload{Draft: draftJSON, SelectedNodeID: payload.Context.SelectedNodeID, NodeLabels: payload.Context.NodeLabels, BaseHash: canonicalJSONHash(draft)},
	}
	historyJSON := workflowCollaborationHistoryJSON(db, task)
	capabilities, _ := json.Marshal(compactCopilotCapabilities(workflowRuntimeRegistry()))
	labelsJSON, _ := json.Marshal(payload.Context.NodeLabels)
	systemPrompt := `你是 Valley 工作流专用协作智能体。严格只输出 JSON，字段只能是 mode、message、targetType、questions、operations、workflow、agent。mode 只能是 answer、clarify、proposal。修改工作流时 targetType 必须是 workflow，proposal 只能返回 operations，不得返回完整候选图。operations 只能使用 startInput.upsert、startInput.remove、node.insert、node.update、node.remove、edge.connect、edge.disconnect。节点不唯一或存在高风险意图时先澄清；不得运行、发布或修改触发器。草稿修改必须保持 Graph v4 有效，优先局部布局。`
	if payload.ActiveSkillID != "" {
		skillInstructions, skillErr := resolveAISkillRuntimeInstructions(db, task.UserID, []string{payload.ActiveSkillID})
		if skillErr != nil {
			return failWorkflowCollaborationTask(db, task, "WORKFLOW_SKILL_UNAVAILABLE", "本轮选择的技能已不可用", skillErr)
		}
		if strings.TrimSpace(skillInstructions) != "" {
			systemPrompt = strings.TrimSpace(systemPrompt + "\n\n以下技能仅用于本次协作任务，不得自动绑定到工作流节点：\n" + skillInstructions)
		}
	}
	if attachmentContext := workflowCollaborationAttachmentContext(attachments); attachmentContext != "" {
		systemPrompt = strings.TrimSpace(systemPrompt + "\n\n以下是用户本轮明确附加的文件内容。生成或修改工作流时应结合这些内容：\n" + attachmentContext)
	}
	userPrompt := fmt.Sprintf("工作流 ID：%s\n选中节点：%s\n节点名称映射：%s\n能力目录：%s\n上下文重置后的最近对话：%s\n任务开始时草稿：%s\n\n用户消息：%s", task.WorkflowID, payload.Context.SelectedNodeID, labelsJSON, capabilities, historyJSON, draftJSON, payload.Message)
	_ = db.Model(task).Updates(map[string]any{"progress": 25, "status_message": "正在理解需求"}).Error

	var envelope copilotAIEnvelope
	var knowledgeBases []model.AIKnowledgeBase
	_ = db.Where("user_id = ?", task.UserID).Order("updated_at DESC").Limit(50).Find(&knowledgeBases).Error
	if planned, handled := planDeterministicWorkflowOperations(copilotPayload, draft); handled {
		envelope = planned
		err = validateCopilotEnvelopeForRun(&envelope, knowledgeBases, copilotPayload, draft)
	} else {
		err = runCopilotAgentStructuredWithImages(ctx, task.UserID, invocation, systemPrompt, userPrompt, referenceImages, copilotPayload, draft, &envelope, func() error {
			_ = db.Model(task).Updates(map[string]any{"progress": 70, "status_message": "正在校验工作流变更"}).Error
			return validateCopilotEnvelopeForRun(&envelope, knowledgeBases, copilotPayload, draft)
		})
	}
	if err != nil {
		if errors.Is(err, context.Canceled) || workflowCollaborationCancelRequested(db, task.ID) {
			return cancelWorkflowCollaborationTask(db, task)
		}
		if errors.Is(err, context.DeadlineExceeded) {
			return failWorkflowCollaborationTask(db, task, "WORKFLOW_TASK_TIMEOUT", "AI 协作超时", err)
		}
		return failWorkflowCollaborationTask(db, task, "WORKFLOW_TASK_FAILED", "AI 未返回可用的工作流变更", err)
	}

	if envelope.Mode == "proposal" {
		change, conflicts, applyErr := applyWorkflowCollaborationOperations(db, task, baseGraph, envelope.Operations)
		if applyErr != nil {
			return failWorkflowCollaborationTask(db, task, "WORKFLOW_APPLY_FAILED", "应用工作流变更失败", applyErr)
		}
		if len(conflicts) > 0 {
			message := "检测到与手动编辑冲突，未覆盖你的修改。"
			_ = createWorkflowCollaborationAssistantMessage(db, task, "conflicted", message)
			createWorkflowCollaborationNotification(db, task, "conflicted", message)
			return nil
		}
		task.ChangeID = &change.ID
		_ = createWorkflowCollaborationAssistantMessage(db, task, "result", envelope.Message)
		createWorkflowCollaborationNotification(db, task, "succeeded", envelope.Message)
		return nil
	}

	kind := envelope.Mode
	if kind == "" {
		kind = "answer"
	}
	if err := createWorkflowCollaborationAssistantMessage(db, task, kind, envelope.Message); err != nil {
		return failWorkflowCollaborationTask(db, task, "WORKFLOW_MESSAGE_FAILED", "保存 AI 回复失败", err)
	}
	now := time.Now()
	if err := db.Model(task).Updates(map[string]any{
		"status": "succeeded", "progress": 100, "status_message": "已回复", "partial_output": envelope.Message, "finished_at": &now,
	}).Error; err != nil {
		return err
	}
	createWorkflowCollaborationNotification(db, task, "succeeded", envelope.Message)
	return nil
}

func selectWorkflowCollaborationModel(db *gorm.DB, requestedID, capability string) (model.AIModel, error) {
	requestedID = strings.TrimSpace(requestedID)
	if requestedID != "" {
		return aimodel.FindEnabledModel(db, requestedID, capability)
	}
	items, err := aimodel.ListEnabledModels(db, capability)
	if err != nil {
		return model.AIModel{}, err
	}
	if len(items) == 0 {
		return model.AIModel{}, fmt.Errorf("no enabled %s model", capability)
	}
	return items[0], nil
}

func workflowCollaborationAttachmentContext(attachments []model.WorkflowCollaborationAttachment) string {
	var builder strings.Builder
	for index, attachment := range attachments {
		text := aiclient.TrimRunes(strings.TrimSpace(attachment.ParsedText), 5000)
		if text == "" || len([]rune(builder.String()))+len([]rune(text)) > aiAppAttachmentContextRunes {
			continue
		}
		builder.WriteString(fmt.Sprintf("[用户文件 %d：%s]\n%s\n\n", index+1, attachment.Name, text))
	}
	return strings.TrimSpace(builder.String())
}

func workflowCollaborationReferenceImages(attachments []model.WorkflowCollaborationAttachment) []string {
	images := make([]string, 0, len(attachments))
	for _, attachment := range attachments {
		if !strings.HasPrefix(strings.ToLower(attachment.MimeType), "image/") || len(attachment.SourceContent) == 0 {
			continue
		}
		images = append(images, "data:"+attachment.MimeType+";base64,"+base64.StdEncoding.EncodeToString(attachment.SourceContent))
	}
	return images
}

func workflowCollaborationHistoryJSON(db *gorm.DB, task *model.WorkflowCollaborationTask) string {
	var session model.AIWorkbenchCopilotSession
	_ = db.First(&session, task.SessionID).Error
	query := db.Where("session_id = ? AND user_id = ?", task.SessionID, task.UserID)
	if session.ContextResetAt != nil {
		query = query.Where("created_at >= ?", *session.ContextResetAt)
	}
	var history []model.AIWorkbenchCopilotMessage
	_ = query.Order("created_at DESC, id DESC").Limit(20).Find(&history).Error
	reverseWorkflowCollaborationMessages(history)
	type promptMessage struct {
		Role    string `json:"role"`
		Content string `json:"content"`
	}
	items := make([]promptMessage, 0, len(history))
	for _, item := range history {
		items = append(items, promptMessage{Role: item.Role, Content: truncateAIAgentRunes(item.Content, 1000)})
	}
	raw, _ := json.Marshal(items)
	return string(raw)
}

func workflowCollaborationCancelRequested(db *gorm.DB, taskID model.Int64String) bool {
	var task model.WorkflowCollaborationTask
	return db.Select("cancel_requested_at", "status").First(&task, taskID).Error == nil &&
		(task.CancelRequestedAt != nil || task.Status == "cancelled")
}

func cancelWorkflowCollaborationExecution(taskID model.Int64String) {
	workflowCollaborationCancelsMu.Lock()
	cancel := workflowCollaborationCancels[taskID.String()]
	workflowCollaborationCancelsMu.Unlock()
	if cancel != nil {
		cancel()
	}
}

func cancelWorkflowCollaborationTask(db *gorm.DB, task *model.WorkflowCollaborationTask) error {
	now := time.Now()
	err := db.Model(task).Updates(map[string]any{
		"status": "cancelled", "progress": 100, "status_message": "已停止", "finished_at": &now,
	}).Error
	createWorkflowCollaborationNotification(db, task, "cancelled", "工作流 AI 协作已停止")
	return err
}

func failWorkflowCollaborationTask(db *gorm.DB, task *model.WorkflowCollaborationTask, code, message string, cause error) error {
	now := time.Now()
	_ = db.Model(task).Updates(map[string]any{
		"status": "failed", "progress": 100, "status_message": message, "error_code": code, "finished_at": &now,
	}).Error
	createWorkflowCollaborationNotification(db, task, "failed", message)
	return cause
}

func createWorkflowCollaborationAssistantMessage(db *gorm.DB, task *model.WorkflowCollaborationTask, kind, content string) error {
	message := model.AIWorkbenchCopilotMessage{
		SessionID: task.SessionID, UserID: task.UserID, Role: "assistant", Kind: kind,
		Content: truncateAIAgentRunes(strings.TrimSpace(content), 4000),
	}
	return db.Create(&message).Error
}

func createWorkflowCollaborationNotification(db *gorm.DB, task *model.WorkflowCollaborationTask, status, content string) {
	extra, _ := json.Marshal(map[string]any{"workflowId": task.WorkflowID, "taskId": task.ID, "status": status})
	var count int64
	if db.Model(&model.UserNotification{}).Where("user_id = ? AND type = ? AND extra_data = ?", task.UserID, "workflow_collaboration", string(extra)).Count(&count).Error != nil || count > 0 {
		return
	}
	title := "工作流 AI 协作已完成"
	if status == "failed" {
		title = "工作流 AI 协作失败"
	} else if status == "conflicted" {
		title = "工作流 AI 协作需要处理冲突"
	} else if status == "cancelled" {
		title = "工作流 AI 协作已停止"
	} else if status == "waiting_approval" {
		title = "工作流 AI 协作等待确认"
	}
	_ = db.Create(&model.UserNotification{
		UserID: task.UserID, Type: "workflow_collaboration", Title: title,
		Content: truncateAIAgentRunes(strings.TrimSpace(content), 500), ExtraData: string(extra),
	}).Error
}
