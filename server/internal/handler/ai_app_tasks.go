package handler

import (
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"

	"valley-server/internal/ai/agent"
	"valley-server/internal/ai/tools/content"
	filetool "valley-server/internal/ai/tools/file"
	imagetool "valley-server/internal/ai/tools/image"
	"valley-server/internal/aiapp"
	"valley-server/internal/aiclient"
	"valley-server/internal/aimodel"
	"valley-server/internal/database"
	"valley-server/internal/logger"
	"valley-server/internal/model"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const (
	aiAppTaskPollInterval         = 2 * time.Second
	aiAppTaskPartialFlushInterval = 200 * time.Millisecond
	aiAppTaskMaxConcurrentPerUser = 3
	aiAppTaskMaxUnfinishedPerUser = 20
	aiAppTaskAgentMaxAttempts     = 5
)

var errAIAppAgentEmptyReply = errors.New("agent returned empty reply")

type aiAppTaskPayload struct {
	Message        string   `json:"message"`
	ModelID        string   `json:"modelId"`
	ActiveSkillIDs []string `json:"activeSkillIds"`
	AttachmentIDs  []string `json:"attachmentIds"`
}

var (
	aiAppTaskWorkerOnce sync.Once
	aiAppTaskCancelsMu  sync.Mutex
	aiAppTaskCancels    = map[string]context.CancelFunc{}
	aiAppTaskClaimMu    sync.Mutex
	aiAppTaskWorkerWake = make(chan struct{}, 1)
	aiAppTaskLauncher   = launchAIAppTask
)

func StartAIAppTaskWorker(ctx context.Context) {
	aiAppTaskWorkerOnce.Do(func() {
		if db := database.GetDB(); db != nil {
			_ = db.Model(&model.AIAppTask{}).Where("status = ?", "running").Updates(map[string]any{
				"status": "queued", "progress": 0, "status_message": "等待恢复执行", "partial_output": "", "started_at": nil,
			}).Error
		}
		go func() {
			ticker := time.NewTicker(aiAppTaskPollInterval)
			defer ticker.Stop()
			runAIAppTaskWorkerTick(ctx)
			for {
				select {
				case <-ctx.Done():
					return
				case <-aiAppTaskWorkerWake:
					runAIAppTaskWorkerTick(ctx)
				case <-ticker.C:
					runAIAppTaskWorkerTick(ctx)
				}
			}
		}()
	})
}

func runAIAppTaskWorkerTick(ctx context.Context) {
	db := database.GetDB()
	if db == nil {
		return
	}
	for {
		task, claimed, err := claimAIAppTask(ctx, db)
		if err != nil {
			logger.Log.Warnf("AI app task claim failed: %v", err)
			return
		}
		if !claimed {
			return
		}
		aiAppTaskLauncher(ctx, db, task)
	}
}

func claimAIAppTask(ctx context.Context, db *gorm.DB) (model.AIAppTask, bool, error) {
	return claimAIAppTaskByID(ctx, db, nil)
}

func claimAIAppTaskByID(ctx context.Context, db *gorm.DB, taskID *model.Int64String) (model.AIAppTask, bool, error) {
	aiAppTaskClaimMu.Lock()
	defer aiAppTaskClaimMu.Unlock()

	var candidates []model.AIAppTask
	query := db.WithContext(ctx).Where("status = ?", "queued")
	if taskID != nil {
		query = query.Where("id = ?", *taskID)
	}
	if err := query.Order("created_at ASC, id ASC").Limit(100).Find(&candidates).Error; err != nil {
		return model.AIAppTask{}, false, err
	}
	for _, candidate := range candidates {
		claimed := false
		err := db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
			var earlierQueuedForConversation int64
			if err := tx.Model(&model.AIAppTask{}).
				Where("user_id = ? AND conversation_id = ? AND status = ?", candidate.UserID, candidate.ConversationID, "queued").
				Where("created_at < ? OR (created_at = ? AND id < ?)", candidate.CreatedAt, candidate.CreatedAt, candidate.ID).
				Count(&earlierQueuedForConversation).Error; err != nil {
				return err
			}
			if earlierQueuedForConversation > 0 {
				return nil
			}
			var activeForConversation int64
			if err := tx.Model(&model.AIAppTask{}).
				Where("user_id = ? AND conversation_id = ? AND status IN ?", candidate.UserID, candidate.ConversationID, []string{"running", "waiting_approval"}).
				Count(&activeForConversation).Error; err != nil {
				return err
			}
			if activeForConversation > 0 {
				return nil
			}
			var activeForUser int64
			if err := tx.Model(&model.AIAppTask{}).
				Where("user_id = ? AND status IN ?", candidate.UserID, []string{"running", "waiting_approval"}).
				Count(&activeForUser).Error; err != nil {
				return err
			}
			if activeForUser >= aiAppTaskMaxConcurrentPerUser {
				return nil
			}
			now := time.Now()
			result := tx.Model(&model.AIAppTask{}).Where("id = ? AND status = ?", candidate.ID, "queued").Updates(map[string]any{
				"status": "running", "progress": 5, "status_message": "正在准备", "partial_output": "", "started_at": now,
			})
			if result.Error != nil {
				return result.Error
			}
			if result.RowsAffected == 0 {
				return nil
			}
			if err := tx.Model(&model.AIAppRun{}).Where("id = ?", candidate.RunID).Update("status", "running").Error; err != nil {
				return err
			}
			if err := tx.First(&candidate, candidate.ID).Error; err != nil {
				return err
			}
			claimed = true
			return nil
		})
		if err != nil {
			return model.AIAppTask{}, false, err
		}
		if claimed {
			return candidate, true, nil
		}
	}
	return model.AIAppTask{}, false, nil
}

func launchAIAppTask(parent context.Context, db *gorm.DB, task model.AIAppTask) {
	go func() {
		if err := executeAIAppTask(parent, db, &task); err != nil {
			logger.Log.Warnf("AI app task %s failed: %v", task.ID, err)
		}
		notifyAIAppTaskWorker()
	}()
}

func notifyAIAppTaskWorker() {
	select {
	case aiAppTaskWorkerWake <- struct{}{}:
	default:
	}
}

func setAIAppTaskQueuePosition(db *gorm.DB, task *model.AIAppTask) {
	if task.Status != "queued" {
		task.QueuePosition = 0
		return
	}
	var activeForConversation int64
	if err := db.Model(&model.AIAppTask{}).
		Where("user_id = ? AND conversation_id = ? AND status IN ?", task.UserID, task.ConversationID, []string{"running", "waiting_approval"}).
		Count(&activeForConversation).Error; err != nil {
		return
	}
	if activeForConversation > 0 {
		task.QueuePosition = 0
		return
	}
	var queuedIDs []model.Int64String
	if err := db.Model(&model.AIAppTask{}).
		Where("user_id = ? AND status = ?", task.UserID, "queued").
		Order("created_at ASC, id ASC").
		Pluck("id", &queuedIDs).Error; err != nil {
		return
	}
	for index, queuedID := range queuedIDs {
		if queuedID == task.ID {
			task.QueuePosition = index + 1
			return
		}
	}
}

type aiAppTaskPartialWriter struct {
	db            *gorm.DB
	taskID        model.Int64String
	content       strings.Builder
	persisted     string
	lastPersisted time.Time
}

func newAIAppTaskPartialWriter(db *gorm.DB, taskID model.Int64String) *aiAppTaskPartialWriter {
	return &aiAppTaskPartialWriter{db: db, taskID: taskID}
}

func (writer *aiAppTaskPartialWriter) Append(delta string) {
	if delta == "" {
		return
	}
	writer.content.WriteString(delta)
	if writer.lastPersisted.IsZero() || time.Since(writer.lastPersisted) >= aiAppTaskPartialFlushInterval {
		_ = writer.Flush()
	}
}

func (writer *aiAppTaskPartialWriter) Flush() error {
	output := writer.content.String()
	if output == writer.persisted {
		return nil
	}
	result := writer.db.Model(&model.AIAppTask{}).
		Where("id = ? AND status = ?", writer.taskID, "running").
		Update("partial_output", output)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected > 0 {
		writer.persisted = output
		writer.lastPersisted = time.Now()
	}
	return nil
}

func CreateAIAppConversationTask(c *gin.Context) {
	userID, app, ok := aiAppConversationContext(c)
	if !ok {
		return
	}
	conversationID, err := parsePathInt64(c, "conversationId")
	if err != nil {
		Error(c, http.StatusBadRequest, "无效的会话 ID")
		return
	}
	conversation, found := findAIAppConversation(database.GetDB(), userID, app.ID, model.Int64String(conversationID))
	if !found {
		Error(c, http.StatusNotFound, "私有会话不存在")
		return
	}
	var payload aiAppTaskPayload
	if c.ShouldBindJSON(&payload) != nil {
		Error(c, http.StatusBadRequest, "任务内容无效")
		return
	}
	payload.Message = truncateAIAgentRunes(payload.Message, 12000)
	attachments, _, attachmentErr := resolveAIAppConversationAttachments(database.GetDB(), userID, app.ID, conversation.ID, payload.AttachmentIDs)
	if attachmentErr != nil {
		Error(c, http.StatusBadRequest, attachmentErr.Error())
		return
	}
	if strings.TrimSpace(payload.Message) == "" && len(attachments) == 0 {
		Error(c, http.StatusBadRequest, "请输入消息或附加文件")
		return
	}
	var unfinishedCount int64
	if err := database.GetDB().Model(&model.AIAppTask{}).
		Where("user_id = ? AND status IN ?", userID, []string{"queued", "running", "waiting_approval"}).
		Count(&unfinishedCount).Error; err != nil {
		Error(c, http.StatusInternalServerError, "检查任务队列失败")
		return
	}
	if unfinishedCount >= aiAppTaskMaxUnfinishedPerUser {
		Error(c, http.StatusTooManyRequests, "当前已有 20 个未完成任务，请等待部分任务完成后再试")
		return
	}
	latestVersionID := app.DraftVersionID
	if latestVersionID == 0 {
		latestVersionID = app.PublishedVersionID
	}
	if latestVersionID != 0 {
		conversation.VersionID = latestVersionID
	}
	title := aiclient.TrimRunes(strings.TrimSpace(payload.Message), 80)
	if title == "" {
		title = attachments[0].Name
	}
	serializedPayload, _ := json.Marshal(payload)
	run := model.AIAppRun{AppID: app.ID, VersionID: conversation.VersionID, ConversationID: &conversation.ID, UserID: userID, Status: "queued", Input: aiclient.TrimRunes(title, 1000)}
	userMessage := model.AIAppConversationMessage{UserID: userID, AppID: app.ID, ConversationID: conversation.ID, Role: "user", Content: payload.Message}
	task := model.AIAppTask{UserID: userID, AppID: app.ID, ConversationID: conversation.ID, Title: title, Status: "queued", Payload: string(serializedPayload), StatusMessage: "等待执行"}
	if err := database.GetDB().Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&run).Error; err != nil {
			return err
		}
		userMessage.RunID = &run.ID
		if err := tx.Create(&userMessage).Error; err != nil {
			return err
		}
		task.RunID = run.ID
		task.UserMessageID = userMessage.ID
		if err := tx.Create(&task).Error; err != nil {
			return err
		}
		if len(attachments) > 0 {
			ids := make([]model.Int64String, 0, len(attachments))
			for _, attachment := range attachments {
				ids = append(ids, attachment.ID)
			}
			if err := tx.Model(&model.AIAppConversationAttachment{}).Where("id IN ?", ids).Update("message_id", userMessage.ID).Error; err != nil {
				return err
			}
		}
		return tx.Model(&conversation).Updates(map[string]any{"version_id": conversation.VersionID, "title": gorm.Expr("CASE WHEN title = ? THEN ? ELSE title END", "新对话", truncateAIAgentRunes(title, 32)), "updated_at": time.Now()}).Error
	}); err != nil {
		Error(c, http.StatusInternalServerError, "创建后台任务失败")
		return
	}
	startedTask, started, startErr := claimAIAppTaskByID(context.Background(), database.GetDB(), &task.ID)
	if startErr != nil {
		logger.Log.Warnf("AI app task %s immediate start failed: %v", task.ID, startErr)
	}
	if started {
		task = startedTask
		run.Status = "running"
		aiAppTaskLauncher(context.Background(), database.GetDB(), task)
	} else {
		_ = database.GetDB().First(&task, task.ID).Error
		if task.Status == "running" {
			run.Status = "running"
		} else {
			setAIAppTaskQueuePosition(database.GetDB(), &task)
			notifyAIAppTaskWorker()
		}
	}
	Success(c, gin.H{"task": task, "run": run, "userMessage": userMessage})
}

func ListAIAppTasks(c *gin.Context) {
	userID, app, ok := aiAppConversationContext(c)
	if !ok {
		return
	}
	query := database.GetDB().Where("user_id = ? AND app_id = ?", userID, app.ID)
	if conversationID := strings.TrimSpace(c.Query("conversationId")); conversationID != "" {
		query = query.Where("conversation_id = ?", conversationID)
	}
	var tasks []model.AIAppTask
	if err := query.Order("created_at DESC").Limit(100).Find(&tasks).Error; err != nil {
		Error(c, http.StatusInternalServerError, "加载任务失败")
		return
	}
	taskIDs := make([]model.Int64String, 0, len(tasks))
	for _, task := range tasks {
		taskIDs = append(taskIDs, task.ID)
	}
	approvals := []model.AIAppToolApproval{}
	if len(taskIDs) > 0 {
		_ = database.GetDB().Where("user_id = ? AND task_id IN ?", userID, taskIDs).Order("created_at ASC").Find(&approvals).Error
	}
	var queued []model.AIAppTask
	if err := database.GetDB().Where("user_id = ? AND status = ?", userID, "queued").Order("created_at ASC, id ASC").Find(&queued).Error; err == nil {
		positions := make(map[model.Int64String]int, len(queued))
		for index, task := range queued {
			positions[task.ID] = index + 1
		}
		for index := range tasks {
			tasks[index].QueuePosition = positions[tasks[index].ID]
		}
	}
	Success(c, gin.H{"list": tasks, "approvals": approvals})
}

func DecideAIAppToolApproval(c *gin.Context) {
	userID, app, ok := aiAppConversationContext(c)
	if !ok {
		return
	}
	taskID, taskErr := parsePathInt64(c, "taskId")
	approvalID, approvalErr := parsePathInt64(c, "approvalId")
	if taskErr != nil || approvalErr != nil {
		Error(c, http.StatusBadRequest, "无效的确认请求")
		return
	}
	var payload struct {
		Decision string `json:"decision"`
		Note     string `json:"note"`
	}
	if c.ShouldBindJSON(&payload) != nil || (payload.Decision != "approve" && payload.Decision != "reject") {
		Error(c, http.StatusBadRequest, "请选择允许或拒绝")
		return
	}
	status := "approved"
	if payload.Decision == "reject" {
		status = "rejected"
	}
	now := time.Now()
	var approval model.AIAppToolApproval
	err := database.GetDB().Transaction(func(tx *gorm.DB) error {
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("id = ? AND task_id = ? AND user_id = ? AND status = ?", approvalID, taskID, userID, "pending").First(&approval).Error; err != nil {
			return err
		}
		var task model.AIAppTask
		if err := tx.Where("id = ? AND app_id = ? AND user_id = ?", taskID, app.ID, userID).First(&task).Error; err != nil {
			return err
		}
		if err := tx.Model(&approval).Updates(map[string]any{"status": status, "note": aiclient.TrimRunes(payload.Note, 500), "decided_at": now}).Error; err != nil {
			return err
		}
		if !isAIAppTaskActive(task.ID) && task.Status == "waiting_approval" {
			if status == "approved" {
				return tx.Model(&task).Updates(map[string]any{"status": "queued", "status_message": "确认通过，等待恢复执行"}).Error
			}
			if err := tx.Model(&task).Updates(map[string]any{"status": "failed", "progress": 100, "status_message": "已拒绝工具执行", "error_code": "TOOL_APPROVAL_REJECTED", "finished_at": now}).Error; err != nil {
				return err
			}
			return tx.Model(&model.AIAppRun{}).Where("id = ?", task.RunID).Updates(map[string]any{"status": "failed", "error_code": "TOOL_APPROVAL_REJECTED"}).Error
		}
		return nil
	})
	if err != nil {
		Error(c, http.StatusConflict, "确认请求已处理或不存在")
		return
	}
	notifyAIAppTaskWorker()
	Success(c, gin.H{"approval": approval})
}

func CancelAIAppTask(c *gin.Context) {
	userID, app, ok := aiAppConversationContext(c)
	if !ok {
		return
	}
	taskID, err := parsePathInt64(c, "taskId")
	if err != nil {
		Error(c, http.StatusBadRequest, "无效的任务 ID")
		return
	}
	var task model.AIAppTask
	if err := database.GetDB().Where("id = ? AND user_id = ? AND app_id = ?", taskID, userID, app.ID).First(&task).Error; err != nil {
		Error(c, http.StatusConflict, "任务已结束或不存在")
		return
	}
	now := time.Now()
	result := database.GetDB().Model(&model.AIAppTask{}).Where("id = ? AND user_id = ? AND app_id = ? AND status IN ?", taskID, userID, app.ID, []string{"queued", "running", "waiting_approval"}).Updates(map[string]any{
		"status": "cancelled", "status_message": "已停止", "cancel_requested_at": now, "finished_at": now,
	})
	if result.Error != nil || result.RowsAffected == 0 {
		Error(c, http.StatusConflict, "任务已结束或不存在")
		return
	}
	_ = database.GetDB().Model(&model.AIAppRun{}).Where("id = ?", task.RunID).Updates(map[string]any{"status": "cancelled", "error_code": "RUN_CANCELLED"}).Error
	aiAppTaskCancelsMu.Lock()
	cancel := aiAppTaskCancels[fmt.Sprint(taskID)]
	aiAppTaskCancelsMu.Unlock()
	if cancel != nil {
		cancel()
	}
	notifyAIAppTaskWorker()
	Success(c, gin.H{"cancelledId": fmt.Sprint(taskID)})
}

func executeAIAppTask(parent context.Context, db *gorm.DB, task *model.AIAppTask) error {
	ctx, cancel := context.WithCancel(parent)
	aiAppTaskCancelsMu.Lock()
	aiAppTaskCancels[task.ID.String()] = cancel
	aiAppTaskCancelsMu.Unlock()
	defer func() {
		cancel()
		aiAppTaskCancelsMu.Lock()
		delete(aiAppTaskCancels, task.ID.String())
		aiAppTaskCancelsMu.Unlock()
	}()
	var currentTask model.AIAppTask
	if err := db.Select("id", "status").First(&currentTask, task.ID).Error; err != nil {
		return err
	}
	if currentTask.Status == "cancelled" {
		return context.Canceled
	}

	var payload aiAppTaskPayload
	if err := json.Unmarshal([]byte(task.Payload), &payload); err != nil {
		return failAIAppTask(db, task, "TASK_PAYLOAD_INVALID", err)
	}
	var app model.AIApp
	var conversation model.AIAppConversation
	var version model.AIAppVersion
	if err := db.WithContext(ctx).Where("id = ? AND user_id = ?", task.AppID, task.UserID).First(&app).Error; err != nil {
		return failAIAppTask(db, task, "APP_NOT_FOUND", err)
	}
	if err := db.WithContext(ctx).Where("id = ? AND user_id = ? AND app_id = ?", task.ConversationID, task.UserID, task.AppID).First(&conversation).Error; err != nil {
		return failAIAppTask(db, task, "CONVERSATION_NOT_FOUND", err)
	}
	if err := db.WithContext(ctx).Where("id = ? AND app_id = ?", conversation.VersionID, app.ID).First(&version).Error; err != nil {
		return failAIAppTask(db, task, "CONVERSATION_VERSION_NOT_FOUND", err)
	}
	config, err := aiapp.Parse(version.Config)
	if err != nil {
		return failAIAppTask(db, task, "APP_CONFIG_INVALID", err)
	}
	styleProfileID, err := selectedAIAppImageStyle(config, payload.ActiveSkillIDs)
	if err != nil {
		return failAIAppTask(db, task, "SKILL_SELECTION_INVALID", err)
	}
	skillInstructions, err := resolveAISkillRuntimeInstructions(db, task.UserID, config.SkillIDs)
	if err != nil {
		return failAIAppTask(db, task, "APP_SKILLS_UNAVAILABLE", err)
	}
	var attachments []model.AIAppConversationAttachment
	if err := db.Where("user_id = ? AND app_id = ? AND conversation_id = ? AND message_id = ?", task.UserID, task.AppID, task.ConversationID, task.UserMessageID).Order("created_at ASC").Find(&attachments).Error; err != nil {
		return failAIAppTask(db, task, "ATTACHMENTS_UNAVAILABLE", err)
	}
	referenceImages := aiAppAttachmentReferenceImages(attachments)
	selectedModelID, requiredCapability, missingModelCode := selectAIAppConversationModel(config, payload.ModelID, len(referenceImages) > 0)
	if selectedModelID == "" {
		return failAIAppTask(db, task, missingModelCode, errors.New("no compatible model selected"))
	}
	invocation, err := aimodel.ResolveInvocation(db, selectedModelID, requiredCapability, 60*time.Second)
	if err != nil {
		code := "MODEL_NOT_CONFIGURED"
		if requiredCapability == "vision" {
			code = "VISION_MODEL_NOT_CONFIGURED"
		}
		return failAIAppTask(db, task, code, err)
	}
	_ = db.Model(&model.AIAppRun{}).Where("id = ?", task.RunID).Updates(map[string]any{"status": "running", "model": invocation.Model.ModelID}).Error
	effectiveMessage := strings.TrimSpace(payload.Message)
	if effectiveMessage == "" {
		effectiveMessage = "请理解并处理本轮附加的文件，提取重要信息并给出有用结果。"
	}
	_ = updateAIAppTask(db, task.ID, "running", 15, "正在检索资料")
	knowledgeContext, references, err := retrieveAIKnowledgeContext(ctx, task.UserID, version, effectiveMessage)
	if err != nil {
		return failAIAppTask(db, task, "RAG_QUERY_FAILED", err)
	}
	system := buildAIAppConversationSystemPrompt(config.SystemInstructions(), knowledgeContext)
	if attachmentContext := buildAIAppAttachmentContext(attachments); attachmentContext != "" {
		system = strings.TrimSpace(system + "\n\n以下是用户本轮明确附加的文件内容。回答时应结合文件；若文件内容与用户要求冲突，以用户最新要求为准。\n" + attachmentContext)
	}
	system = appendAIAppConversationImageContext(system, len(referenceImages), styleProfileID)
	if skillInstructions != "" {
		system = strings.TrimSpace(system + "\n\n" + skillInstructions)
	}
	registry, toolNames, err := resolveAIAppTools(db, app.ID, version)
	if err != nil {
		return failAIAppTask(db, task, "AI_TOOL_REGISTRY_UNAVAILABLE", err)
	}
	if !aimodel.HasCapabilities(invocation.Model, []string{"tool_call"}) {
		toolNames = nil
	}
	for _, toolName := range toolNames {
		if toolName == filetool.ToolName {
			system = strings.TrimSpace(system + "\n\n当用户要求生成 Markdown、JSON 或 CSV 等可下载文件时，必须调用 file.create 创建成果文件；不要只在回复中展示代码块或声称已经保存。")
			break
		}
	}
	system = appendContentSearchDateContext(system, toolNames, time.Now())
	var history []model.AIAppConversationMessage
	if err := db.Where("user_id = ? AND app_id = ? AND conversation_id = ? AND id <= ?", task.UserID, app.ID, conversation.ID, task.UserMessageID).Order("created_at DESC").Limit(aiAppConversationHistoryLimit).Find(&history).Error; err != nil {
		return failAIAppTask(db, task, "CONVERSATION_HISTORY_UNAVAILABLE", err)
	}
	messages := make([]agent.Message, 0, len(history))
	for index := len(history) - 1; index >= 0; index-- {
		role := agent.RoleUser
		if history[index].Role == "assistant" {
			role = agent.RoleAssistant
		}
		messageContent := history[index].Content
		if history[index].ID == task.UserMessageID && strings.TrimSpace(messageContent) == "" {
			messageContent = effectiveMessage
		}
		message := agent.Message{Role: role, Content: messageContent}
		if history[index].ID == task.UserMessageID {
			message.Images = referenceImages
		}
		messages = append(messages, message)
	}
	policies, err := loadAIAppToolPolicies(db, version)
	if err != nil {
		return failAIAppTask(db, task, "AI_TOOL_POLICY_UNAVAILABLE", err)
	}
	gate := &aiAppToolApprovalGate{db: db, task: task, policies: policies}
	loop := agent.NewLocalLoop(agent.NewCompatibleBackend(invocation.Client), registry)
	runContext := content.WithOwner(ctx, task.UserID)
	runContext = imagetool.WithRequestInput(runContext, task.UserID, referenceImages, styleProfileID)
	runContext = filetool.WithRequestContext(runContext, filetool.RequestContext{UserID: task.UserID, AppID: app.ID, ConversationID: conversation.ID, RunID: task.RunID, TaskID: &task.ID})
	spec := agent.Spec{Provider: invocation.Provider.Provider, Model: invocation.Model.ModelID, System: system, Tools: toolNames, MaxSteps: 6, MaxTokens: 1200, Feature: "ai-workbench-background-task", ToolGate: gate}
	var reply strings.Builder
	partialWriter := newAIAppTaskPartialWriter(db, task.ID)
	var result agent.Result
	var runErr error
	imageGenerationIDs := make([]string, 0, 1)
	for attempt := 1; attempt <= aiAppTaskAgentMaxAttempts; attempt++ {
		_ = updateAIAppTask(db, task.ID, "running", 30, "正在思考")
		reply.Reset()
		result = agent.Result{}
		runErr = nil
		emittedOutput := false
		invokedTool := false
		pendingNarrations := make([]string, 0, 1)
		events, streamErr := loop.RunStream(runContext, spec, messages)
		if streamErr != nil {
			runErr = streamErr
		} else {
			for event := range events {
				switch event.Type {
				case agent.EventDelta:
					emittedOutput = emittedOutput || event.Delta != ""
					reply.WriteString(event.Delta)
					partialWriter.Append(event.Delta)
				case agent.EventToolCall:
					invokedTool = true
					pendingNarrations = append(pendingNarrations, event.Narration)
					_ = updateAIAppTask(db, task.ID, "running", 55, "正在调用 "+humanAIAppToolName(event.ToolName))
				case agent.EventToolResult:
					narration := ""
					if len(pendingNarrations) > 0 {
						narration = pendingNarrations[0]
						pendingNarrations = pendingNarrations[1:]
					}
					imageGenerationIDs = append(imageGenerationIDs, imageGenerationIDsFromToolResult(event.ToolName, event.ToolResult)...)
					status := "succeeded"
					if strings.Contains(string(event.ToolResult), `"ok":false`) {
						status = "failed"
					}
					_ = db.Create(&model.AIAppConversationToolTrace{UserID: task.UserID, AppID: app.ID, ConversationID: conversation.ID, RunID: task.RunID, ToolName: event.ToolName, Narration: narration, Status: status, DurationMs: event.ToolDurationMs}).Error
				case agent.EventDone:
					if event.Result != nil {
						result = *event.Result
					}
				case agent.EventError:
					runErr = event.Err
				}
			}
		}
		if result.Reply == "" {
			result.Reply = reply.String()
		}
		if runErr == nil && strings.TrimSpace(result.Reply) != "" {
			break
		}
		if runErr == nil {
			runErr = errAIAppAgentEmptyReply
		}
		if attempt >= aiAppTaskAgentMaxAttempts || !shouldRetryAIAppAgentRun(runErr, emittedOutput, invokedTool) {
			break
		}
		_ = updateAIAppTask(db, task.ID, "running", 30, fmt.Sprintf("模型服务波动，正在重试（%d/%d）", attempt, aiAppTaskAgentMaxAttempts-1))
		if err := waitAIAppAgentRetry(runContext, attempt); err != nil {
			runErr = err
			break
		}
	}
	_ = partialWriter.Flush()
	if runErr != nil || strings.TrimSpace(result.Reply) == "" {
		code := "AI_AGENT_RUN_FAILED"
		if errors.Is(runErr, agent.ErrToolApprovalRejected) {
			code = "TOOL_APPROVAL_REJECTED"
		}
		if errors.Is(runErr, context.Canceled) {
			code = "RUN_CANCELLED"
		}
		return failAIAppTask(db, task, code, runErr)
	}
	modelName := result.Model
	if modelName == "" {
		modelName = invocation.Model.ModelID
	}
	referenceSummary, _ := json.Marshal(references)
	imageGenerationIDs = uniqueAIAppGenerationIDs(imageGenerationIDs)
	serializedImageGenerationIDs, _ := json.Marshal(imageGenerationIDs)
	finishedAt := time.Now()
	durationMs := int64(0)
	if task.StartedAt != nil {
		durationMs = finishedAt.Sub(*task.StartedAt).Milliseconds()
	}
	assistantMessage := model.AIAppConversationMessage{UserID: task.UserID, AppID: app.ID, ConversationID: conversation.ID, RunID: &task.RunID, Role: "assistant", Content: strings.TrimSpace(result.Reply), ImageGenerationIDs: string(serializedImageGenerationIDs)}
	if err := db.Transaction(func(tx *gorm.DB) error {
		var lockedTask model.AIAppTask
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Select("id", "status").First(&lockedTask, task.ID).Error; err != nil {
			return err
		}
		if lockedTask.Status == "cancelled" {
			return context.Canceled
		}
		if err := tx.Create(&assistantMessage).Error; err != nil {
			return err
		}
		if err := tx.Model(&model.AIAppRun{}).Where("id = ?", task.RunID).Updates(map[string]any{"status": "succeeded", "model": modelName, "output": aiclient.TrimRunes(result.Reply, 2000), "references": string(referenceSummary), "duration_ms": durationMs}).Error; err != nil {
			return err
		}
		return tx.Model(&model.AIAppTask{}).Where("id = ?", task.ID).Updates(map[string]any{"status": "succeeded", "progress": 100, "status_message": "已完成", "partial_output": strings.TrimSpace(result.Reply), "finished_at": finishedAt}).Error
	}); err != nil {
		if errors.Is(err, context.Canceled) {
			return failAIAppTask(db, task, "RUN_CANCELLED", err)
		}
		return failAIAppTask(db, task, "RESULT_PERSISTENCE_FAILED", err)
	}
	return nil
}

func shouldRetryAIAppAgentRun(err error, emittedOutput bool, invokedTool bool) bool {
	if err == nil || emittedOutput || invokedTool || errors.Is(err, context.Canceled) || errors.Is(err, agent.ErrToolApprovalRejected) || errors.Is(err, agent.ErrMaxStepsExceeded) {
		return false
	}
	if errors.Is(err, errAIAppAgentEmptyReply) || errors.Is(err, agent.ErrEmptyStreamResponse) || errors.Is(err, context.DeadlineExceeded) {
		return true
	}
	message := strings.ToLower(err.Error())
	for _, fragment := range []string{
		"timeout", "deadline exceeded", "unexpected eof", "connection reset", "connection refused",
		"server disconnected", "temporarily unavailable", "service unavailable", "ai 上游请求失败",
		"ai 上游返回 408:", "ai 上游返回 429:", "ai 上游返回 500:", "ai 上游返回 502:",
		"ai 上游返回 503:", "ai 上游返回 504:", "ai 上游返回空 choices",
	} {
		if strings.Contains(message, fragment) {
			return true
		}
	}
	return false
}

func waitAIAppAgentRetry(ctx context.Context, attempt int) error {
	delay := time.Second * time.Duration(1<<uint(attempt-1))
	timer := time.NewTimer(delay)
	defer timer.Stop()
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-timer.C:
		return nil
	}
}

func isAIAppTaskActive(taskID model.Int64String) bool {
	aiAppTaskCancelsMu.Lock()
	defer aiAppTaskCancelsMu.Unlock()
	_, active := aiAppTaskCancels[taskID.String()]
	return active
}

func buildAIAppAttachmentContext(attachments []model.AIAppConversationAttachment) string {
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

func aiAppAttachmentReferenceImages(attachments []model.AIAppConversationAttachment) []string {
	images := make([]string, 0, len(attachments))
	for _, attachment := range attachments {
		if !strings.HasPrefix(strings.ToLower(attachment.MimeType), "image/") || len(attachment.SourceContent) == 0 {
			continue
		}
		images = append(images, "data:"+attachment.MimeType+";base64,"+base64.StdEncoding.EncodeToString(attachment.SourceContent))
	}
	return images
}

func loadAIAppToolPolicies(db *gorm.DB, version model.AIAppVersion) (map[string]string, error) {
	var bindings []model.AIAppVersionToolBinding
	if err := db.Where("app_version_id = ?", version.ID).Find(&bindings).Error; err != nil {
		return nil, err
	}
	policies := make(map[string]string, len(bindings))
	for _, binding := range bindings {
		policies[binding.ToolName] = binding.ApprovalMode
	}
	return policies, nil
}

type aiAppToolApprovalGate struct {
	db       *gorm.DB
	task     *model.AIAppTask
	policies map[string]string
}

func (gate *aiAppToolApprovalGate) Authorize(ctx context.Context, call agent.ToolCall) error {
	if gate == nil || gate.policies[call.Name] != "always" {
		return nil
	}
	fingerprintSource := gate.task.ID.String() + "\n" + call.Name + "\n" + string(call.Args)
	digest := sha256.Sum256([]byte(fingerprintSource))
	fingerprint := hex.EncodeToString(digest[:])
	approval := model.AIAppToolApproval{
		TaskID: gate.task.ID, RunID: gate.task.RunID, UserID: gate.task.UserID,
		ToolName: call.Name, RiskLevel: aiAppToolRisk(call.Name), Fingerprint: fingerprint,
		Summary: summarizeAIAppToolCall(call), Arguments: string(call.Args), Status: "pending",
	}
	if err := gate.db.Clauses(clause.OnConflict{Columns: []clause.Column{{Name: "fingerprint"}}, DoNothing: true}).Create(&approval).Error; err != nil {
		return err
	}
	_ = updateAIAppTask(gate.db, gate.task.ID, "waiting_approval", 50, "等待确认："+humanAIAppToolName(call.Name))
	ticker := time.NewTicker(500 * time.Millisecond)
	defer ticker.Stop()
	for {
		var current model.AIAppToolApproval
		if err := gate.db.Where("fingerprint = ? AND task_id = ?", fingerprint, gate.task.ID).First(&current).Error; err != nil {
			return err
		}
		switch current.Status {
		case "approved":
			_ = updateAIAppTask(gate.db, gate.task.ID, "running", 55, "确认通过，正在执行")
			return nil
		case "rejected":
			return agent.ErrToolApprovalRejected
		}
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-ticker.C:
		}
	}
}

func summarizeAIAppToolCall(call agent.ToolCall) string {
	var values map[string]any
	_ = json.Unmarshal(call.Args, &values)
	switch call.Name {
	case imagetool.ToolName:
		return "生成图片：" + aiclient.TrimRunes(fmt.Sprint(values["prompt"]), 160)
	case filetool.ToolName:
		return fmt.Sprintf("创建成果文件：%s（%s）", aiclient.TrimRunes(fmt.Sprint(values["fileName"]), 120), fmt.Sprint(values["format"]))
	case "content.search":
		return "搜索内容：" + aiclient.TrimRunes(fmt.Sprint(values["query"]), 160)
	default:
		return "调用 " + humanAIAppToolName(call.Name)
	}
}

func humanAIAppToolName(name string) string {
	switch name {
	case "content.search":
		return "内容搜索"
	case imagetool.ToolName:
		return "图片生成"
	case filetool.ToolName:
		return "成果文件"
	default:
		return name
	}
}

func aiAppToolRisk(name string) string {
	switch name {
	case "content.search":
		return "low"
	case imagetool.ToolName:
		return "medium"
	default:
		return "high"
	}
}

func updateAIAppTask(db *gorm.DB, taskID model.Int64String, status string, progress int, message string) error {
	return db.Model(&model.AIAppTask{}).Where("id = ? AND status <> ?", taskID, "cancelled").Updates(map[string]any{"status": status, "progress": progress, "status_message": message}).Error
}

func failAIAppTask(db *gorm.DB, task *model.AIAppTask, code string, cause error) error {
	now := time.Now()
	status := "failed"
	message := "执行失败"
	if code == "VISION_MODEL_NOT_CONFIGURED" {
		message = "所选对话模型不支持图片理解，请切换模型"
	}
	if code == "RUN_CANCELLED" || errors.Is(cause, context.Canceled) {
		status = "cancelled"
		message = "已停止"
	}
	_ = db.Model(&model.AIAppTask{}).Where("id = ? AND status <> ?", task.ID, "cancelled").Updates(map[string]any{"status": status, "progress": 100, "status_message": message, "error_code": code, "finished_at": now}).Error
	_ = db.Model(&model.AIAppRun{}).Where("id = ?", task.RunID).Updates(map[string]any{"status": status, "error_code": code}).Error
	if cause == nil {
		cause = errors.New(code)
	}
	return cause
}
