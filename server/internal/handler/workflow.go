package handler

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"
	contenttool "valley-server/internal/ai/tools/content"
	"valley-server/internal/aiclient"
	"valley-server/internal/config"
	"valley-server/internal/database"
	"valley-server/internal/integration/notion"
	"valley-server/internal/model"
	"valley-server/internal/utils"
	"valley-server/internal/workflow"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const (
	workflowRunRequestMaxBytes  = 6 * 1024 * 1024
	workflowRunExecutionTimeout = 2 * time.Minute
)

var (
	errWorkflowSaveConflict = errors.New("workflow save conflict")
	errWorkflowDraftInvalid = errors.New("workflow draft invalid")
)

// AdminCreateWorkflow 创建工作流
func AdminCreateWorkflow(c *gin.Context) {
	userID, _, ok := currentUser(c)
	if !ok {
		Error(c, http.StatusUnauthorized, "未登录")
		return
	}

	var req struct {
		Name        string `json:"name" binding:"required"`
		Description string `json:"description"`
		Graph       string `json:"graph"`
		Status      string `json:"status"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		Error(c, http.StatusBadRequest, "参数错误: "+err.Error())
		return
	}

	if req.Graph == "" {
		req.Graph = `{"schemaVersion":4,"nodes":[{"id":"start","type":"start","label":"开始","position":{"x":80,"y":200},"config":{"inputs":{}}},{"id":"end","type":"end","label":"结束","position":{"x":420,"y":200},"config":{"outputs":{}}}],"edges":[{"source":"start","sourceHandle":"output","target":"end","targetHandle":"input"}]}`
	}
	if req.Status == "" {
		req.Status = "draft"
	}

	workflow := model.Workflow{
		UserID:      model.Int64String(userID),
		Name:        req.Name,
		Description: req.Description,
		Graph:       req.Graph,
		Status:      req.Status,
	}

	if err := database.DB.Transaction(func(tx *gorm.DB) error {
		if err := validateWorkflowDraftForPersistence(req.Graph); err != nil {
			return fmt.Errorf("%w: %v", errWorkflowDraftInvalid, err)
		}
		if err := tx.Create(&workflow).Error; err != nil {
			return err
		}
		_, _, err := syncWorkflowAIApp(tx, workflow)
		return err
	}); err != nil {
		if errors.Is(err, errWorkflowDraftInvalid) {
			Error(c, http.StatusBadRequest, "工作流草稿无效: "+strings.TrimPrefix(err.Error(), errWorkflowDraftInvalid.Error()+": "))
			return
		}
		Error(c, http.StatusInternalServerError, "创建失败: "+err.Error())
		return
	}

	workflow.GraphHash = workflowGraphHash(workflow.Graph)
	Success(c, workflow)
}

// AdminListWorkflows 工作流列表
func AdminListWorkflows(c *gin.Context) {
	userID, _, ok := currentUser(c)
	if !ok {
		Error(c, http.StatusUnauthorized, "未登录")
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "20"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	var total int64
	var workflows []model.Workflow

	query := database.DB.Model(&model.Workflow{}).Where("user_id = ?", userID)
	query.Count(&total)

	if err := query.Order("updated_at DESC").
		Offset((page - 1) * pageSize).
		Limit(pageSize).
		Find(&workflows).Error; err != nil {
		Error(c, http.StatusInternalServerError, "查询失败: "+err.Error())
		return
	}

	Success(c, gin.H{
		"list":     workflows,
		"total":    total,
		"page":     page,
		"pageSize": pageSize,
	})
}

// AdminGetWorkflow 获取工作流详情
func AdminGetWorkflow(c *gin.Context) {
	userID, _, ok := currentUser(c)
	if !ok {
		Error(c, http.StatusUnauthorized, "未登录")
		return
	}

	id, err := parsePathInt64(c, "id")
	if err != nil {
		Error(c, http.StatusBadRequest, "无效的 ID")
		return
	}

	var workflow model.Workflow
	if err := database.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("id = ? AND user_id = ?", id, userID).First(&workflow).Error; err != nil {
			return err
		}
		return reconcileWorkflowEditorDraft(tx, &workflow)
	}); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			Error(c, http.StatusNotFound, "工作流不存在")
			return
		}
		Error(c, http.StatusInternalServerError, "加载工作流草稿失败")
		return
	}

	// 编辑器必须读取当前草稿；已发布版本只用于子工作流调用和历史回放。
	c.Header("Cache-Control", "private, no-store")
	workflow.GraphHash = workflowGraphHash(workflow.Graph)
	Success(c, workflow)
}

// reconcileWorkflowEditorDraft repairs legacy rows where the editable canvas
// and the AI app draft pointer diverged. The newer saved representation wins;
// a published version is never selected merely because it is newer by number.
func reconcileWorkflowEditorDraft(tx *gorm.DB, definition *model.Workflow) error {
	_, draft, err := syncWorkflowAIAppWithoutSnapshot(tx, *definition)
	if err != nil {
		return err
	}
	if draft.ID == 0 || draft.Config == definition.Graph {
		return nil
	}

	// The workflow table is the newer saved canvas. Materialize it as a fresh
	// draft snapshot instead of allowing a stale published snapshot to replace it.
	if definition.UpdatedAt.After(draft.CreatedAt) {
		_, _, err = syncWorkflowAIAppWithSnapshot(tx, *definition, true)
		return err
	}

	// The versioned draft is newer (for example a draft saved by an older editor
	// path). Restore the editable table from it, without touching publication.
	if err := tx.Model(definition).Update("graph", draft.Config).Error; err != nil {
		return err
	}
	definition.Graph = draft.Config
	return nil
}

// AdminUpdateWorkflow 更新工作流
func AdminUpdateWorkflow(c *gin.Context) {
	userID, _, ok := currentUser(c)
	if !ok {
		Error(c, http.StatusUnauthorized, "未登录")
		return
	}

	id, err := parsePathInt64(c, "id")
	if err != nil {
		Error(c, http.StatusBadRequest, "无效的 ID")
		return
	}

	var req struct {
		Name          *string `json:"name"`
		Description   *string `json:"description"`
		Graph         *string `json:"graph"`
		Status        *string `json:"status"`
		BaseHash      *string `json:"baseHash"`
		RecordHistory bool    `json:"recordHistory"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		Error(c, http.StatusBadRequest, "参数错误: "+err.Error())
		return
	}

	updates := map[string]interface{}{}
	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.Description != nil {
		updates["description"] = *req.Description
	}
	if req.Graph != nil {
		updates["graph"] = *req.Graph
	}
	if req.Status != nil {
		updates["status"] = *req.Status
	}

	if len(updates) == 0 {
		Error(c, http.StatusBadRequest, "没有需要更新的字段")
		return
	}

	var definition model.Workflow
	err = database.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("id = ? AND user_id = ?", id, userID).First(&definition).Error; err != nil {
			return err
		}
		if req.BaseHash != nil && strings.TrimSpace(*req.BaseHash) != "" &&
			!strings.EqualFold(strings.TrimSpace(*req.BaseHash), workflowGraphHash(definition.Graph)) {
			return errWorkflowSaveConflict
		}
		graphToPersist := definition.Graph
		if req.Graph != nil {
			graphToPersist = *req.Graph
		}
		if err := validateWorkflowDraftForPersistence(graphToPersist); err != nil {
			return fmt.Errorf("%w: %v", errWorkflowDraftInvalid, err)
		}
		if err := tx.Model(&definition).Updates(updates).Error; err != nil {
			return err
		}
		if err := tx.Where("id = ?", definition.ID).First(&definition).Error; err != nil {
			return err
		}
		_, _, syncErr := syncWorkflowAIAppWithSnapshot(tx, definition, req.RecordHistory)
		return syncErr
	})
	if errors.Is(err, errWorkflowSaveConflict) {
		Error(c, http.StatusConflict, "工作流草稿已被其他编辑覆盖，请刷新后重试")
		return
	}
	if errors.Is(err, errWorkflowDraftInvalid) {
		Error(c, http.StatusBadRequest, "工作流草稿无效: "+strings.TrimPrefix(err.Error(), errWorkflowDraftInvalid.Error()+": "))
		return
	}
	if errors.Is(err, gorm.ErrRecordNotFound) {
		Error(c, http.StatusNotFound, "工作流不存在")
		return
	}
	if err != nil {
		Error(c, http.StatusInternalServerError, "保存工作流版本失败")
		return
	}

	definition.GraphHash = workflowGraphHash(definition.Graph)
	Success(c, gin.H{"graphHash": definition.GraphHash})
}

func GetWorkflowPlatform(c *gin.Context) {
	userID, _, ok := currentUser(c)
	if !ok {
		return
	}
	definition, app, versions, ok := workflowPlatform(c, model.Int64String(userID))
	if !ok {
		return
	}
	Success(c, gin.H{"workflow": definition, "app": app, "versions": versions})
}

func RestoreWorkflowVersion(c *gin.Context) {
	userID, _, ok := currentUser(c)
	if !ok {
		return
	}
	var payload struct {
		VersionID model.Int64String `json:"versionId"`
	}
	if c.ShouldBindJSON(&payload) != nil || payload.VersionID == 0 {
		Error(c, 400, "请选择要恢复的历史版本")
		return
	}
	id, err := parsePathInt64(c, "id")
	if err != nil {
		Error(c, 400, "无效的 ID")
		return
	}
	var restored model.AIAppVersion
	if err := database.DB.Transaction(func(tx *gorm.DB) error {
		var definition model.Workflow
		if err := tx.Where("id = ? AND user_id = ?", id, userID).First(&definition).Error; err != nil {
			return err
		}
		app, _, err := syncWorkflowAIAppWithoutSnapshot(tx, definition)
		if err != nil {
			return err
		}
		var source model.AIAppVersion
		if err := tx.Where("id = ? AND app_id = ?", payload.VersionID, app.ID).First(&source).Error; err != nil {
			return err
		}
		if err := validateWorkflowDraftForPersistence(source.Config); err != nil {
			return fmt.Errorf("%w: %v", errWorkflowDraftInvalid, err)
		}
		retrievalConfig, err := parseAIAppRetrievalConfig(source.RetrievalConfig)
		if err != nil {
			return err
		}
		var createErr error
		restored, createErr = createAIAppVersionSnapshot(tx, app, source.Config, retrievalConfig, source)
		if createErr != nil {
			return createErr
		}
		return tx.Model(&definition).Updates(map[string]any{"graph": restored.Config, "status": "draft"}).Error
	}); err != nil {
		Error(c, 400, "恢复历史版本失败")
		return
	}
	Success(c, gin.H{"version": restored})
}

func PublishWorkflowVersion(c *gin.Context) {
	userID, _, ok := currentUser(c)
	if !ok {
		return
	}
	id, err := parsePathInt64(c, "id")
	if err != nil {
		Error(c, 400, "无效的 ID")
		return
	}
	if err := database.DB.Transaction(func(tx *gorm.DB) error {
		var definition model.Workflow
		if err := tx.Where("id = ? AND user_id = ?", id, userID).First(&definition).Error; err != nil {
			return err
		}
		if err := validateWorkflowDraftForSave(tx, definition.Graph, userID, id); err != nil {
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
	}); err != nil {
		if errors.Is(err, errWorkflowDraftInvalid) {
			Error(c, http.StatusBadRequest, "工作流配置无效: "+strings.TrimPrefix(err.Error(), errWorkflowDraftInvalid.Error()+": "))
			return
		}
		Error(c, 400, "发布工作流失败")
		return
	}
	Success(c, nil)
}

func workflowPlatform(c *gin.Context, userID model.Int64String) (model.Workflow, model.AIApp, []model.AIAppVersion, bool) {
	id, err := parsePathInt64(c, "id")
	if err != nil {
		Error(c, 400, "无效的 ID")
		return model.Workflow{}, model.AIApp{}, nil, false
	}
	var definition model.Workflow
	if err := database.DB.Where("id = ? AND user_id = ?", id, userID).First(&definition).Error; err != nil {
		Error(c, 404, "工作流不存在")
		return model.Workflow{}, model.AIApp{}, nil, false
	}
	var app model.AIApp
	if err := database.DB.Transaction(func(tx *gorm.DB) error {
		var syncErr error
		app, _, syncErr = syncWorkflowAIAppWithoutSnapshot(tx, definition)
		return syncErr
	}); err != nil {
		if errors.Is(err, errWorkflowDraftInvalid) {
			Error(c, 400, "工作流草稿无效: "+strings.TrimPrefix(err.Error(), errWorkflowDraftInvalid.Error()+": "))
			return model.Workflow{}, model.AIApp{}, nil, false
		}
		Error(c, 500, "同步工作流应用失败")
		return model.Workflow{}, model.AIApp{}, nil, false
	}
	var versions []model.AIAppVersion
	if err := database.DB.Where("app_id = ?", app.ID).Order("number DESC").Find(&versions).Error; err != nil {
		Error(c, 500, "加载工作流版本失败")
		return model.Workflow{}, model.AIApp{}, nil, false
	}
	return definition, app, versions, true
}

// AdminDeleteWorkflow 删除工作流
func AdminDeleteWorkflow(c *gin.Context) {
	userID, _, ok := currentUser(c)
	if !ok {
		Error(c, http.StatusUnauthorized, "未登录")
		return
	}

	id, err := parsePathInt64(c, "id")
	if err != nil {
		Error(c, http.StatusBadRequest, "无效的 ID")
		return
	}

	result := database.DB.Where("id = ? AND user_id = ?", id, userID).Delete(&model.Workflow{})
	if result.RowsAffected == 0 {
		Error(c, http.StatusNotFound, "工作流不存在")
		return
	}

	Success(c, nil)
}

// AdminRunWorkflow runs a server-reviewed graph and streams only safe node previews.
func AdminRunWorkflow(c *gin.Context) {
	userID, role, ok := currentUser(c)
	if !ok {
		Error(c, http.StatusUnauthorized, "未登录")
		return
	}
	workflowID, err := parsePathInt64(c, "id")
	if err != nil {
		Error(c, http.StatusBadRequest, "无效的 ID")
		return
	}
	var definition model.Workflow
	if err := database.DB.Where("id = ? AND user_id = ?", workflowID, userID).First(&definition).Error; err != nil {
		Error(c, http.StatusNotFound, "工作流不存在")
		return
	}
	var app model.AIApp
	var appVersion model.AIAppVersion
	if err := database.DB.Transaction(func(tx *gorm.DB) error {
		var syncErr error
		app, appVersion, syncErr = syncWorkflowAIAppWithoutSnapshot(tx, definition)
		return syncErr
	}); err != nil {
		Error(c, http.StatusInternalServerError, "同步工作流应用失败")
		return
	}
	graph, err := decodeWorkflowGraph(definition.Graph)
	if err != nil {
		Error(c, http.StatusBadRequest, "工作流格式错误")
		return
	}
	registry := workflowRuntimeRegistry()
	if validationErrors := workflow.ValidateGraph(graph, registry); len(validationErrors) > 0 {
		Error(c, http.StatusBadRequest, "工作流配置无效: "+strings.Join(validationErrors, "；"))
		return
	}
	budget := workflowExecutionBudget{}
	if err := validateSubworkflowReferences(database.DB, graph, model.Int64String(userID), definition.ID, map[string]bool{}, &budget); err != nil {
		Error(c, http.StatusBadRequest, "工作流配置无效: "+err.Error())
		return
	}
	runWorkflowGraph(c, userID, role, definition, graph, app, appVersion, nil)
}

// RetryWorkflowRun starts a new run from a terminal run's immutable graph snapshot.
// It deliberately requires fresh request inputs because run history only stores safe summaries.
func RetryWorkflowRun(c *gin.Context) {
	userID, role, ok := currentUser(c)
	if !ok {
		Error(c, http.StatusUnauthorized, "未登录")
		return
	}
	workflowID, err := parsePathInt64(c, "id")
	if err != nil {
		Error(c, http.StatusBadRequest, "无效的 ID")
		return
	}
	runID, err := parsePathInt64(c, "runId")
	if err != nil {
		Error(c, http.StatusBadRequest, "无效的运行 ID")
		return
	}
	var sourceRun model.WorkflowRun
	if err := database.DB.Where("id = ? AND workflow_id = ? AND user_id = ?", runID, workflowID, userID).First(&sourceRun).Error; err != nil {
		Error(c, http.StatusNotFound, "运行记录不存在")
		return
	}
	if sourceRun.Status == string(workflow.StatusRunning) || sourceRun.Status == "cancelling" {
		Error(c, http.StatusConflict, "该运行尚未结束，不能重新运行")
		return
	}
	graph, err := decodeWorkflowGraph(sourceRun.GraphSnapshot)
	if err != nil {
		Error(c, http.StatusBadRequest, "历史工作流格式错误")
		return
	}
	registry := workflowRuntimeRegistry()
	if validationErrors := workflow.ValidateGraph(graph, registry); len(validationErrors) > 0 {
		Error(c, http.StatusConflict, "历史工作流已不符合当前运行规则: "+strings.Join(validationErrors, "；"))
		return
	}
	budget := workflowExecutionBudget{}
	if err := validateSubworkflowReferences(database.DB, graph, model.Int64String(userID), model.Int64String(workflowID), map[string]bool{}, &budget); err != nil {
		Error(c, http.StatusConflict, "历史工作流已不符合当前运行规则: "+err.Error())
		return
	}
	if workflowRetryRequiresConfirmation(graph, registry) && c.GetHeader("X-Workflow-Retry-Confirmed") != "true" {
		Error(c, http.StatusConflict, "本次重试可能再次执行 AI 存储或写入操作，请确认后重试")
		return
	}
	var definition model.Workflow
	if err := database.DB.Where("id = ? AND user_id = ?", workflowID, userID).First(&definition).Error; err != nil {
		Error(c, http.StatusNotFound, "工作流不存在")
		return
	}
	app, appVersion, found := workflowRunAIAppVersion(sourceRun.ID, model.Int64String(userID))
	if !found {
		if err := database.DB.Transaction(func(tx *gorm.DB) error {
			var syncErr error
			app, appVersion, syncErr = syncWorkflowAIAppWithoutSnapshot(tx, definition)
			return syncErr
		}); err != nil {
			Error(c, http.StatusInternalServerError, "同步工作流应用失败")
			return
		}
	}
	sourceRunID := sourceRun.ID
	runWorkflowGraph(c, userID, role, definition, graph, app, appVersion, &sourceRunID)
}

func workflowRunAIAppVersion(workflowRunID, userID model.Int64String) (model.AIApp, model.AIAppVersion, bool) {
	var appRun model.AIAppRun
	if err := database.DB.Where("workflow_run_id = ? AND user_id = ?", workflowRunID, userID).Order("created_at DESC").First(&appRun).Error; err != nil {
		return model.AIApp{}, model.AIAppVersion{}, false
	}
	var app model.AIApp
	if err := database.DB.Where("id = ? AND user_id = ?", appRun.AppID, userID).First(&app).Error; err != nil {
		return model.AIApp{}, model.AIAppVersion{}, false
	}
	var version model.AIAppVersion
	if err := database.DB.Where("id = ? AND app_id = ?", appRun.VersionID, app.ID).First(&version).Error; err != nil {
		return model.AIApp{}, model.AIAppVersion{}, false
	}
	return app, version, true
}

func workflowRetryRequiresConfirmation(graph workflow.Graph, registry *workflow.Registry) bool {
	for _, node := range graph.Nodes {
		if node.Type != workflow.NodeTypeTool {
			continue
		}
		var config struct {
			CapabilityID string `json:"capabilityId"`
		}
		if json.Unmarshal(node.Config, &config) != nil {
			continue
		}
		capability, _, found := registry.Capability(config.CapabilityID)
		if found && (capability.SideEffect == "write" || capability.SideEffect == "model_and_storage") {
			return true
		}
	}
	return false
}

func mustEncodeWorkflowGraph(graph workflow.Graph, fallback string) string {
	encoded, err := json.Marshal(graph)
	if err != nil {
		return fallback
	}
	return string(encoded)
}

func runWorkflowGraph(
	c *gin.Context,
	userID int64,
	role string,
	definition model.Workflow,
	graph workflow.Graph,
	app model.AIApp,
	appVersion model.AIAppVersion,
	sourceRunID *model.Int64String,
) {
	registry := workflowRuntimeRegistry()
	fileInputs, err := declaredStartFileInputs(graph)
	if err != nil {
		Error(c, http.StatusBadRequest, "工作流文件输入配置无效")
		return
	}
	inputs, err := readWorkflowRunInputs(c, fileInputs)
	if err != nil {
		Error(c, http.StatusBadRequest, "运行输入无效: "+err.Error())
		return
	}
	inputsJSON, err := json.Marshal(safeWorkflowRunInputs(inputs))
	if err != nil {
		Error(c, http.StatusInternalServerError, "运行记录序列化失败")
		return
	}
	run := model.WorkflowRun{WorkflowID: definition.ID, UserID: model.Int64String(userID), Status: string(workflow.StatusRunning), Inputs: string(inputsJSON), GraphSnapshot: mustEncodeWorkflowGraph(graph, definition.Graph), SourceRunID: sourceRunID, StartedAt: time.Now()}
	if err := database.DB.Create(&run).Error; err != nil {
		Error(c, http.StatusInternalServerError, "创建运行记录失败")
		return
	}
	if workflowRequiresARKImage(graph) {
		if _, _, configErr := aiclient.ReadARKImageConfig(); configErr != "" {
			_ = finishWorkflowRun(&run, string(workflow.StatusFailed), map[string]any{"error": "ARK_IMAGE_NOT_CONFIGURED"})
			persistWorkflowAIAppRun(app, appVersion, run, "failed", nil, "ARK_IMAGE_NOT_CONFIGURED")
			Error(c, http.StatusServiceUnavailable, "AI 生图服务未配置：请检查 ARK_API_KEY 和 ARK_IMAGE_MODEL")
			return
		}
		if utils.GetTOSUploader() == nil {
			_ = finishWorkflowRun(&run, string(workflow.StatusFailed), map[string]any{"error": "IMAGE_STORAGE_NOT_CONFIGURED"})
			persistWorkflowAIAppRun(app, appVersion, run, "failed", nil, "IMAGE_STORAGE_NOT_CONFIGURED")
			Error(c, http.StatusServiceUnavailable, "封面存储服务未配置")
			return
		}
	}

	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")
	c.Header("X-Accel-Buffering", "no")
	send := func(event workflow.Event, streamStatus string) {
		payload := map[string]any{
			"step":     event.NodeID,
			"status":   streamStatus,
			"message":  event.Message,
			"sequence": event.Sequence,
			"data":     event,
		}
		encoded, _ := json.Marshal(payload)
		if event.Sequence > 0 {
			_, _ = fmt.Fprintf(c.Writer, "id: %d\n", event.Sequence)
		}
		_, _ = fmt.Fprintf(c.Writer, "data: %s\n\n", encoded)
		c.Writer.(http.Flusher).Flush()
	}
	nodeTypes := make(map[string]workflow.NodeType, len(graph.Nodes))
	for _, node := range graph.Nodes {
		nodeTypes[node.ID] = node.Type
	}
	var persistenceErr error
	var finalOutput map[string]any
	var failureMessage string
	var failureCode string
	var failedNodeID string
	var eventSequence int64
	persistNodeEvent := func(event workflow.Event) (workflow.Event, error) {
		eventSequence++
		event.Sequence = eventSequence
		err := database.DB.Transaction(func(tx *gorm.DB) error {
			if err := persistWorkflowNodeEvent(tx, run.ID, nodeTypes[event.NodeID], event); err != nil {
				return err
			}
			return persistWorkflowRunEvent(tx, run.ID, event)
		})
		return event, err
	}
	persistTerminalEvent := func(status workflow.RunStatus, nodeID, message, errorCode string, output map[string]any) (workflow.Event, error) {
		eventSequence++
		event := workflow.Event{
			RunID:    run.ID.String(),
			Sequence: eventSequence,
			NodeID:   nodeID,
			Status:   status,
			Message:  message,
			Error:    errorCode,
			Output:   workflow.SafePreviewMap(output),
		}
		return event, database.DB.Transaction(func(tx *gorm.DB) error {
			return persistWorkflowRunEvent(tx, run.ID, event)
		})
	}
	executionContext, releaseRun := activeWorkflowRuns.Start(run.ID.String(), workflowRunExecutionTimeout)
	defer releaseRun()
	executeErr := workflow.Execute(executionContext, graph, registry, workflow.RunContext{ID: run.ID.String(), Actor: workflow.Actor{UserID: userID, Role: role}, Inputs: inputs, Outputs: make(map[string]map[string]any), KnowledgeRetriever: workflowKnowledgeRetriever(model.Int64String(userID), appVersion), ContentSearcher: workflowContentSearcher(model.Int64String(userID)), NotionSearcher: workflowNotionSearcher(model.Int64String(userID)), CoverGenerator: workflowCoverGenerator(), SubworkflowRunner: workflowSubworkflowRunner(model.Int64String(userID))}, func(event workflow.Event) {
		if persistenceErr == nil {
			event, persistenceErr = persistNodeEvent(event)
			if persistenceErr == nil {
				send(event, string(event.Status))
			}
		}
		if nodeTypes[event.NodeID] == workflow.NodeTypeEnd && event.Status == workflow.StatusSucceeded {
			finalOutput = event.Output
		}
		if event.Status == workflow.StatusFailed || event.Status == workflow.StatusCancelled {
			failureMessage = event.Message
			failureCode = event.Error
			failedNodeID = event.NodeID
		}
	})
	if persistenceErr != nil {
		_ = finishWorkflowRun(&run, string(workflow.StatusFailed), map[string]any{"error": "RUN_PERSISTENCE_FAILED"})
		persistWorkflowAIAppRun(app, appVersion, run, "failed", nil, "RUN_PERSISTENCE_FAILED")
		send(workflow.Event{RunID: run.ID.String(), Status: workflow.StatusFailed, Message: "运行记录保存失败", Error: "RUN_PERSISTENCE_FAILED"}, "error")
		return
	}
	if executeErr != nil {
		if failureMessage == "" {
			failureMessage = "工作流执行失败"
		}
		if failureCode == "" {
			failureCode = "WORKFLOW_NODE_FAILED"
		}
		if failureCode == "WORKFLOW_CANCELLED" {
			_ = finishWorkflowRun(&run, string(workflow.StatusCancelled), map[string]any{"error": failureCode})
			persistWorkflowAIAppRun(app, appVersion, run, "cancelled", nil, failureCode)
			event, eventErr := persistTerminalEvent(workflow.StatusCancelled, failedNodeID, failureMessage, failureCode, nil)
			if eventErr != nil {
				send(workflow.Event{RunID: run.ID.String(), Status: workflow.StatusFailed, Message: "运行记录保存失败", Error: "RUN_PERSISTENCE_FAILED"}, "error")
				return
			}
			send(event, string(workflow.StatusCancelled))
			return
		}
		_ = finishWorkflowRun(&run, string(workflow.StatusFailed), map[string]any{"error": failureCode})
		persistWorkflowAIAppRun(app, appVersion, run, "failed", nil, failureCode)
		event, eventErr := persistTerminalEvent(workflow.StatusFailed, failedNodeID, failureMessage, failureCode, nil)
		if eventErr != nil {
			send(workflow.Event{RunID: run.ID.String(), Status: workflow.StatusFailed, Message: "运行记录保存失败", Error: "RUN_PERSISTENCE_FAILED"}, "error")
			return
		}
		send(event, "error")
		return
	}
	if finalOutput == nil {
		finalOutput = map[string]any{}
	}
	if err := finishWorkflowRun(&run, string(workflow.StatusSucceeded), finalOutput); err != nil {
		_ = finishWorkflowRun(&run, string(workflow.StatusFailed), map[string]any{"error": "RUN_PERSISTENCE_FAILED"})
		persistWorkflowAIAppRun(app, appVersion, run, "failed", nil, "RUN_PERSISTENCE_FAILED")
		send(workflow.Event{RunID: run.ID.String(), Status: workflow.StatusFailed, Message: "运行结果保存失败", Error: "RUN_PERSISTENCE_FAILED"}, "error")
		return
	}
	persistWorkflowAIAppRun(app, appVersion, run, "succeeded", finalOutput, "")
	event, eventErr := persistTerminalEvent(workflow.StatusSucceeded, "", "工作流执行完成", "", finalOutput)
	if eventErr != nil {
		_ = finishWorkflowRun(&run, string(workflow.StatusFailed), map[string]any{"error": "RUN_PERSISTENCE_FAILED"})
		persistWorkflowAIAppRun(app, appVersion, run, "failed", nil, "RUN_PERSISTENCE_FAILED")
		send(workflow.Event{RunID: run.ID.String(), Status: workflow.StatusFailed, Message: "运行记录保存失败", Error: "RUN_PERSISTENCE_FAILED"}, "error")
		return
	}
	send(event, "done")
}

func persistWorkflowAIAppRun(app model.AIApp, version model.AIAppVersion, workflowRun model.WorkflowRun, status string, output map[string]any, errorCode string) {
	result := ""
	if output != nil {
		if encoded, err := json.Marshal(output); err == nil {
			result = string(encoded)
		}
	}
	runID := workflowRun.ID
	run := model.AIAppRun{AppID: app.ID, VersionID: version.ID, WorkflowRunID: &runID, UserID: workflowRun.UserID, Status: status, Model: "workflow-runtime", Input: aiclient.TrimRunes(workflowRun.Inputs, 1000), Output: aiclient.TrimRunes(result, 2000), ErrorCode: errorCode, DurationMs: time.Since(workflowRun.StartedAt).Milliseconds()}
	_ = database.DB.Create(&run).Error
}

func AdminListWorkflowRuns(c *gin.Context) {
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
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "20"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	testRunIDs := database.DB.Model(&model.WorkflowTestResult{}).
		Select("workflow_run_id").Where("workflow_run_id IS NOT NULL")
	query := database.DB.Model(&model.WorkflowRun{}).
		Where("workflow_id = ? AND user_id = ?", workflowID, userID).
		Where("id NOT IN (?)", testRunIDs)
	var total int64
	if err := query.Count(&total).Error; err != nil {
		Error(c, http.StatusInternalServerError, "查询运行历史失败")
		return
	}
	var runs []model.WorkflowRun
	if err := query.Order("started_at DESC, id DESC").Offset((page - 1) * pageSize).Limit(pageSize).Find(&runs).Error; err != nil {
		Error(c, http.StatusInternalServerError, "查询运行历史失败")
		return
	}
	Success(c, gin.H{"list": runs, "total": total, "page": page, "pageSize": pageSize})
}

func AdminGetWorkflowRun(c *gin.Context) {
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
	runID, err := parsePathInt64(c, "runId")
	if err != nil {
		Error(c, http.StatusBadRequest, "无效的运行 ID")
		return
	}
	var run model.WorkflowRun
	if err := database.DB.Where("id = ? AND workflow_id = ? AND user_id = ?", runID, workflowID, userID).First(&run).Error; err != nil {
		Error(c, http.StatusNotFound, "运行记录不存在")
		return
	}
	var nodes []model.WorkflowNodeRun
	if err := database.DB.Where("workflow_run_id = ?", run.ID).Order("created_at ASC").Find(&nodes).Error; err != nil {
		Error(c, http.StatusInternalServerError, "查询节点记录失败")
		return
	}
	var events []model.WorkflowRunEvent
	if err := database.DB.Where("workflow_run_id = ?", run.ID).Order("sequence ASC").Find(&events).Error; err != nil {
		Error(c, http.StatusInternalServerError, "查询运行事件失败")
		return
	}
	retry := gin.H{
		"allowed":              run.Status != string(workflow.StatusRunning) && run.Status != "cancelling",
		"requiresConfirmation": false,
	}
	if graph, graphErr := decodeWorkflowGraph(run.GraphSnapshot); graphErr == nil {
		retry["requiresConfirmation"] = workflowRetryRequiresConfirmation(graph, workflowRuntimeRegistry())
	}
	Success(c, gin.H{"run": run, "nodes": nodes, "events": events, "retry": retry})
}

func CancelWorkflowRun(c *gin.Context) {
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
	runID, err := parsePathInt64(c, "runId")
	if err != nil {
		Error(c, http.StatusBadRequest, "无效的运行 ID")
		return
	}
	var run model.WorkflowRun
	if err := database.DB.Where("id = ? AND workflow_id = ? AND user_id = ?", runID, workflowID, userID).First(&run).Error; err != nil {
		Error(c, http.StatusNotFound, "运行记录不存在")
		return
	}
	if run.Status != string(workflow.StatusRunning) {
		Error(c, http.StatusConflict, "该运行已结束，不能取消")
		return
	}
	if !activeWorkflowRuns.Cancel(run.ID.String()) {
		Error(c, http.StatusConflict, "该运行不在当前服务进程中，不能取消")
		return
	}
	if err := database.DB.Model(&run).Update("status", "cancelling").Error; err != nil {
		Error(c, http.StatusInternalServerError, "更新取消状态失败")
		return
	}
	Success(c, gin.H{"status": "cancelling"})
}

func StreamWorkflowRunEvents(c *gin.Context) {
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
	runID, err := parsePathInt64(c, "runId")
	if err != nil {
		Error(c, http.StatusBadRequest, "无效的运行 ID")
		return
	}
	var run model.WorkflowRun
	if err := database.DB.Where("id = ? AND workflow_id = ? AND user_id = ?", runID, workflowID, userID).First(&run).Error; err != nil {
		Error(c, http.StatusNotFound, "运行记录不存在")
		return
	}
	after, _ := strconv.ParseInt(c.GetHeader("Last-Event-ID"), 10, 64)
	if queryAfter := c.Query("after"); queryAfter != "" {
		if parsed, parseErr := strconv.ParseInt(queryAfter, 10, 64); parseErr == nil {
			after = parsed
		}
	}
	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")
	c.Header("X-Accel-Buffering", "no")
	ticker := time.NewTicker(400 * time.Millisecond)
	defer ticker.Stop()
	for {
		var events []model.WorkflowRunEvent
		if err := database.DB.Where("workflow_run_id = ? AND sequence > ?", run.ID, after).Order("sequence ASC").Find(&events).Error; err != nil {
			return
		}
		for _, event := range events {
			writeWorkflowRunSSE(c, event)
			after = event.Sequence
		}
		if err := database.DB.First(&run, run.ID).Error; err != nil || run.Status == "success" || run.Status == "error" || run.Status == "cancelled" {
			return
		}
		select {
		case <-c.Request.Context().Done():
			return
		case <-ticker.C:
			_, _ = fmt.Fprint(c.Writer, ": keep-alive\n\n")
			c.Writer.(http.Flusher).Flush()
		}
	}
}

func writeWorkflowRunSSE(c *gin.Context, event model.WorkflowRunEvent) {
	streamStatus := event.Status
	if event.NodeType == "" && event.Status == string(workflow.StatusSucceeded) {
		streamStatus = "done"
	}
	payload := gin.H{
		"step":     event.NodeID,
		"status":   streamStatus,
		"message":  event.Message,
		"sequence": event.Sequence,
		"data": gin.H{
			"runId":        event.WorkflowRunID,
			"sequence":     event.Sequence,
			"nodeId":       event.NodeID,
			"nodeType":     event.NodeType,
			"capabilityId": event.CapabilityID,
			"status":       event.Status,
			"message":      event.Message,
			"input":        workflowEventPreview(event.Input),
			"output":       workflowEventPreview(event.Output),
			"error":        event.ErrorCode,
			"durationMs":   event.DurationMs,
		},
	}
	encoded, _ := json.Marshal(payload)
	_, _ = fmt.Fprintf(c.Writer, "id: %d\ndata: %s\n\n", event.Sequence, encoded)
	c.Writer.(http.Flusher).Flush()
}

func workflowEventPreview(raw string) map[string]any {
	result := map[string]any{}
	_ = json.Unmarshal([]byte(raw), &result)
	return result
}

func decodeWorkflowGraph(raw string) (workflow.Graph, error) {
	var graph workflow.Graph
	if err := json.Unmarshal([]byte(raw), &graph); err != nil {
		return workflow.Graph{}, err
	}
	return graph, nil
}

func workflowGraphHash(raw string) string {
	var value any
	if json.Unmarshal([]byte(raw), &value) != nil {
		return canonicalJSONHash(raw)
	}
	return canonicalJSONHash(value)
}

// Saved drafts may be incomplete while users build a workflow, but they must remain
// serializable Graph v4 data so the editor can safely restore them.
func validateWorkflowDraftForPersistence(raw string) error {
	graph, err := decodeWorkflowGraph(raw)
	if err != nil {
		return fmt.Errorf("Graph JSON 无法解析")
	}
	if graph.SchemaVersion != workflow.SchemaVersion {
		return fmt.Errorf("GRAPH_VERSION_UNSUPPORTED: schemaVersion 必须为 %d", workflow.SchemaVersion)
	}
	return nil
}

// Publishing and execution require a complete, executable graph and must never
// bypass the server-owned capability, owner, version, recursion, or budget boundaries.
func validateWorkflowDraftForSave(db *gorm.DB, raw string, userID, currentWorkflowID int64) error {
	graph, err := decodeWorkflowGraph(raw)
	if err != nil {
		return fmt.Errorf("Graph JSON 无法解析")
	}
	validationErrors := workflow.ValidateGraph(graph, workflowRuntimeRegistry())
	if len(validationErrors) > 0 {
		return fmt.Errorf("%s", strings.Join(validationErrors, "；"))
	}
	budget := workflowExecutionBudget{}
	return validateSubworkflowReferences(db, graph, model.Int64String(userID), model.Int64String(currentWorkflowID), map[string]bool{}, &budget)
}

type workflowExecutionBudget struct {
	modelCapabilities int
	writeCapabilities int
}

func validateSubworkflowReferences(db *gorm.DB, graph workflow.Graph, userID, currentWorkflowID model.Int64String, visiting map[string]bool, budget *workflowExecutionBudget) error {
	registry := workflowRuntimeRegistry()
	if validationErrors := workflow.ValidateGraph(graph, registry); len(validationErrors) > 0 {
		return fmt.Errorf("%s", strings.Join(validationErrors, "；"))
	}
	for _, node := range graph.Nodes {
		switch node.Type {
		case workflow.NodeTypeLLM:
			budget.modelCapabilities++
		case workflow.NodeTypeTool:
			var config struct {
				CapabilityID string `json:"capabilityId"`
			}
			_ = json.Unmarshal(node.Config, &config)
			if capability, _, ok := registry.Capability(config.CapabilityID); ok {
				budget.modelCapabilities += capability.ModelCost
				budget.writeCapabilities += capability.WriteCost
			}
		}
	}
	if budget.modelCapabilities > workflow.DefaultLimits.MaxModelCapabilities {
		return fmt.Errorf("包含子工作流后的模型能力预算超过 %d", workflow.DefaultLimits.MaxModelCapabilities)
	}
	if budget.writeCapabilities > workflow.DefaultLimits.MaxWriteCapabilities {
		return fmt.Errorf("包含子工作流后的写入能力预算超过 %d", workflow.DefaultLimits.MaxWriteCapabilities)
	}
	for _, node := range graph.Nodes {
		if node.Type != workflow.NodeTypeSubworkflow {
			continue
		}
		var config struct {
			WorkflowID   string                        `json:"workflowId"`
			VersionID    string                        `json:"versionId"`
			Inputs       map[string]any                `json:"inputs"`
			InputSchema  map[string]workflow.ValueType `json:"inputSchema"`
			OutputSchema map[string]workflow.ValueType `json:"outputSchema"`
		}
		if err := json.Unmarshal(node.Config, &config); err != nil {
			return fmt.Errorf("子工作流节点 %s 配置无效", node.ID)
		}
		workflowID, err := strconv.ParseInt(config.WorkflowID, 10, 64)
		if err != nil || workflowID <= 0 {
			return fmt.Errorf("子工作流节点 %s 的 workflowId 无效", node.ID)
		}
		versionID, err := strconv.ParseInt(config.VersionID, 10, 64)
		if err != nil || versionID <= 0 {
			return fmt.Errorf("子工作流节点 %s 的 versionId 无效", node.ID)
		}
		if currentWorkflowID != 0 && model.Int64String(workflowID) == currentWorkflowID {
			return fmt.Errorf("子工作流不能直接或传递调用自身")
		}
		key := config.VersionID
		if visiting[key] {
			return fmt.Errorf("子工作流存在传递循环")
		}
		var app model.AIApp
		if err := db.Where("user_id = ? AND type = ? AND workflow_id = ?", userID, aiAppTypeWorkflow, workflowID).First(&app).Error; err != nil {
			return fmt.Errorf("子工作流 %s 不存在或不属于当前用户", config.WorkflowID)
		}
		var version model.AIAppVersion
		if err := db.Where("id = ? AND app_id = ?", versionID, app.ID).First(&version).Error; err != nil {
			return fmt.Errorf("子工作流版本不存在")
		}
		if version.PublishedAt == nil && version.ID != app.PublishedVersionID {
			return fmt.Errorf("子工作流 %s 必须锁定已发布版本", config.WorkflowID)
		}
		child, err := decodeWorkflowGraph(version.Config)
		if err != nil {
			return fmt.Errorf("子工作流版本 Graph 无效")
		}
		contract, err := workflow.SubworkflowContractFromGraph(child)
		if err != nil {
			return fmt.Errorf("子工作流版本契约无效: %w", err)
		}
		if err := validateSubworkflowNodeContract(node.ID, config.Inputs, config.InputSchema, config.OutputSchema, contract); err != nil {
			return err
		}
		visiting[key] = true
		if err := validateSubworkflowReferences(db, child, userID, currentWorkflowID, visiting, budget); err != nil {
			return err
		}
		delete(visiting, key)
	}
	return nil
}

func validateSubworkflowNodeContract(nodeID string, inputs map[string]any, inputSchema, outputSchema map[string]workflow.ValueType, expected workflow.SubworkflowContract) error {
	declared := inputSchema != nil || outputSchema != nil
	if !declared {
		return nil
	}
	if inputSchema == nil || outputSchema == nil {
		return fmt.Errorf("子工作流节点 %s 必须同时声明输入和输出契约", nodeID)
	}
	if !workflowValueTypeSchemaEqual(inputSchema, inputDefinitionTypes(expected.Inputs)) || !workflowValueTypeSchemaEqual(outputSchema, expected.Outputs) {
		return fmt.Errorf("子工作流节点 %s 的字段契约与锁定版本不一致，请重新选择该版本", nodeID)
	}
	for name := range inputs {
		if _, ok := expected.Inputs[name]; !ok {
			return fmt.Errorf("子工作流节点 %s 包含锁定版本不存在的输入 %s", nodeID, name)
		}
	}
	for name, definition := range expected.Inputs {
		if definition.Required {
			if _, ok := inputs[name]; !ok {
				return fmt.Errorf("子工作流节点 %s 缺少必填输入 %s", nodeID, name)
			}
		}
	}
	return nil
}

func inputDefinitionTypes(inputs map[string]workflow.InputDefinition) map[string]workflow.ValueType {
	types := make(map[string]workflow.ValueType, len(inputs))
	for name, definition := range inputs {
		types[name] = definition.Type
	}
	return types
}

func workflowValueTypeSchemaEqual(left, right map[string]workflow.ValueType) bool {
	if len(left) != len(right) {
		return false
	}
	for name, valueType := range left {
		if right[name] != valueType {
			return false
		}
	}
	return true
}

func workflowRuntimeRegistry() *workflow.Registry {
	registry := workflow.DefaultRegistry()
	_ = workflow.RegisterWorkflowCapabilities(registry)
	return registry
}

func workflowContentSearcher(userID model.Int64String) workflow.ContentSearcher {
	searchTool := contenttool.NewSearchTool(database.GetDB())
	return workflow.ContentSearcherFunc(func(ctx context.Context, query, createdFrom, createdTo string) (workflow.ContentSearchResult, error) {
		arguments, _ := json.Marshal(map[string]string{"query": query, "createdFrom": createdFrom, "createdTo": createdTo})
		raw, err := searchTool.Run(contenttool.WithOwner(ctx, userID), arguments)
		if err != nil {
			return workflow.ContentSearchResult{}, err
		}
		var result workflow.ContentSearchResult
		if err := json.Unmarshal(raw, &result); err != nil {
			return workflow.ContentSearchResult{}, err
		}
		return result, nil
	})
}

func workflowNotionSearcher(userID model.Int64String) workflow.NotionSearcher {
	return workflow.NotionSearcherFunc(func(ctx context.Context, query string, limit int) (workflow.NotionSearchResult, error) {
		service, err := notion.NewService(database.GetDB(), config.Load().NotionOAuth)
		if err != nil {
			return workflow.NotionSearchResult{}, err
		}
		result, err := service.Search(ctx, int64(userID), query, limit)
		if err != nil {
			return workflow.NotionSearchResult{}, err
		}
		items := make([]workflow.NotionSearchItem, len(result.Items))
		for index, item := range result.Items {
			items[index] = workflow.NotionSearchItem{ID: item.ID, Title: item.Title, URL: item.URL, Kind: item.Kind, LastEditedAt: item.LastEditedAt}
		}
		return workflow.NotionSearchResult{Items: items}, nil
	})
}

func workflowCoverGenerator() workflow.CoverGenerator {
	return workflow.CoverGeneratorFunc(func(ctx context.Context, userID int64, title, summary, style string) (workflow.GeneratedCover, error) {
		image, err := aiclient.GenerateARKImage(ctx, workflow.BuildCoverPrompt(title, summary, style), "3072x1536", "2560x1280", "2048x1024", "1536x768", "adaptive")
		if err != nil {
			return workflow.GeneratedCover{}, err
		}
		extension := ".png"
		switch strings.ToLower(strings.TrimSpace(image.MIMEType)) {
		case "image/jpeg", "image/jpg":
			extension = ".jpg"
		case "image/webp":
			extension = ".webp"
		}
		key := fmt.Sprintf("workflow-covers/%d/%s/%d%s", userID, time.Now().Format("20060102"), time.Now().UnixNano(), extension)
		uploader := utils.GetTOSUploader()
		if uploader == nil {
			return workflow.GeneratedCover{}, fmt.Errorf("封面存储服务未配置")
		}
		url, err := uploader.UploadBytesWithPathContext(ctx, key, image.Bytes)
		if err != nil {
			return workflow.GeneratedCover{}, fmt.Errorf("封面上传失败: %w", err)
		}
		return workflow.GeneratedCover{URL: url, StorageKey: key, Model: image.Model, Size: image.Size}, nil
	})
}

type subworkflowStackContextKey struct{}

func workflowSubworkflowRunner(ownerID model.Int64String) workflow.SubworkflowRunner {
	var runner workflow.SubworkflowRunnerFunc
	runner = func(ctx context.Context, actor workflow.Actor, request workflow.SubworkflowRequest) (map[string]any, error) {
		workflowID, err := strconv.ParseInt(request.WorkflowID, 10, 64)
		if err != nil || workflowID <= 0 {
			return nil, fmt.Errorf("子工作流 ID 无效")
		}
		versionID, err := strconv.ParseInt(request.VersionID, 10, 64)
		if err != nil || versionID <= 0 {
			return nil, fmt.Errorf("子工作流版本 ID 无效")
		}
		stack, _ := ctx.Value(subworkflowStackContextKey{}).(map[string]bool)
		if stack[request.VersionID] {
			return nil, fmt.Errorf("子工作流存在递归调用")
		}
		if len(stack) >= 10 {
			return nil, fmt.Errorf("子工作流调用深度超过限制")
		}
		nextStack := make(map[string]bool, len(stack)+1)
		for key, value := range stack {
			nextStack[key] = value
		}
		nextStack[request.VersionID] = true
		var app model.AIApp
		if err := database.DB.Where("user_id = ? AND type = ? AND workflow_id = ? AND published_version_id = ?", ownerID, aiAppTypeWorkflow, workflowID, versionID).First(&app).Error; err != nil {
			return nil, fmt.Errorf("子工作流未发布、已删除或不属于当前用户")
		}
		var version model.AIAppVersion
		if err := database.DB.Where("id = ? AND app_id = ?", versionID, app.ID).First(&version).Error; err != nil {
			return nil, fmt.Errorf("子工作流版本不存在")
		}
		graph, err := decodeWorkflowGraph(version.Config)
		if err != nil {
			return nil, fmt.Errorf("子工作流版本 Graph 无效")
		}
		var final map[string]any
		executionContext := context.WithValue(ctx, subworkflowStackContextKey{}, nextStack)
		err = workflow.Execute(executionContext, graph, workflowRuntimeRegistry(), workflow.RunContext{ID: request.VersionID, Actor: actor, Inputs: request.Inputs, Outputs: map[string]map[string]any{}, KnowledgeRetriever: workflowKnowledgeRetriever(ownerID, version), ContentSearcher: workflowContentSearcher(ownerID), CoverGenerator: workflowCoverGenerator(), SubworkflowRunner: runner}, func(event workflow.Event) {
			if event.NodeType == workflow.NodeTypeEnd && event.Status == workflow.StatusSucceeded {
				final = event.Output
			}
		})
		if err != nil {
			return nil, err
		}
		if final == nil {
			final = map[string]any{}
		}
		return final, nil
	}
	return runner
}

func ListWorkflowCapabilities(c *gin.Context) {
	if _, _, ok := currentUser(c); !ok {
		Error(c, http.StatusUnauthorized, "未登录")
		return
	}
	Success(c, workflow.Capabilities(workflowRuntimeRegistry()))
}

func workflowKnowledgeRetriever(userID model.Int64String, version model.AIAppVersion) workflow.KnowledgeRetriever {
	return workflow.KnowledgeRetrieverFunc(func(ctx context.Context, query string) (workflow.KnowledgeResult, error) {
		knowledgeContext, references, err := retrieveAIKnowledgeContext(ctx, userID, version, query)
		if err != nil {
			return workflow.KnowledgeResult{}, err
		}
		result := workflow.KnowledgeResult{Context: knowledgeContext, References: make([]workflow.KnowledgeReference, 0, len(references))}
		for _, reference := range references {
			result.References = append(result.References, workflow.KnowledgeReference{DocumentName: reference.DocumentName, ChunkID: reference.ChunkID.String(), Excerpt: reference.Excerpt})
		}
		return result, nil
	})
}

func workflowRequiresARKImage(graph workflow.Graph) bool {
	for _, node := range graph.Nodes {
		if node.Type == workflow.NodeTypeTool {
			var config struct {
				CapabilityID string `json:"capabilityId"`
			}
			_ = json.Unmarshal(node.Config, &config)
			if config.CapabilityID != workflow.CapabilityGenerateCover {
				continue
			}
			return true
		}
	}
	return false
}

func declaredStartFileInputs(graph workflow.Graph) (map[string]struct{}, error) {
	allowed := make(map[string]struct{})
	for _, node := range graph.Nodes {
		if node.Type != workflow.NodeTypeStart {
			continue
		}
		var config struct {
			Inputs map[string]struct {
				Type workflow.ValueType `json:"type"`
			} `json:"inputs"`
		}
		if err := json.Unmarshal(node.Config, &config); err != nil {
			return nil, err
		}
		for name, input := range config.Inputs {
			if input.Type == workflow.ValueTypeFile {
				allowed[name] = struct{}{}
			}
		}
	}
	return allowed, nil
}

func readWorkflowRunInputs(c *gin.Context, allowedFileInputs map[string]struct{}) (map[string]any, error) {
	if !strings.HasPrefix(c.ContentType(), "multipart/form-data") {
		return nil, fmt.Errorf("请求必须使用 multipart/form-data")
	}
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, workflowRunRequestMaxBytes)
	if err := c.Request.ParseMultipartForm(workflowRunRequestMaxBytes); err != nil {
		return nil, err
	}
	inputs := make(map[string]any)
	if rawInputs := c.PostForm("inputs"); strings.TrimSpace(rawInputs) != "" {
		if err := json.Unmarshal([]byte(rawInputs), &inputs); err != nil {
			return nil, fmt.Errorf("inputs 必须是 JSON 对象")
		}
	}
	if c.Request.MultipartForm == nil {
		return inputs, nil
	}
	for inputName, files := range c.Request.MultipartForm.File {
		if _, allowed := allowedFileInputs[inputName]; !allowed {
			return nil, fmt.Errorf("输入 %s 未在开始节点声明为文件", inputName)
		}
		if len(files) != 1 {
			return nil, fmt.Errorf("输入 %s 只能上传一个文件", inputName)
		}
		fileHeader := files[0]
		file, err := fileHeader.Open()
		if err != nil {
			return nil, fmt.Errorf("读取输入文件失败")
		}
		content, readErr := io.ReadAll(io.LimitReader(file, 5*1024*1024+1))
		closeErr := file.Close()
		if readErr != nil || closeErr != nil {
			return nil, fmt.Errorf("读取输入文件失败")
		}
		if len(content) > 5*1024*1024 {
			return nil, fmt.Errorf("输入文件不能超过 5MB")
		}
		inputs[inputName] = workflow.FileInput{Filename: fileHeader.Filename, ContentType: fileHeader.Header.Get("Content-Type"), Size: int64(len(content)), Content: content}
	}
	return inputs, nil
}

func safeWorkflowRunInputs(inputs map[string]any) map[string]any {
	preview := make(map[string]any, len(inputs))
	for key, value := range inputs {
		switch typed := value.(type) {
		case workflow.FileInput:
			preview[key] = map[string]any{"filename": typed.Filename, "contentType": typed.ContentType, "size": typed.Size}
		case []string:
			preview[key] = map[string]any{"count": len(typed)}
		case []any:
			preview[key] = map[string]any{"count": len(typed)}
		case string:
			preview[key] = "[string input]"
		case bool, float64, float32, int, int64:
			preview[key] = typed
		default:
			preview[key] = "[provided]"
		}
	}
	return preview
}

func persistWorkflowNodeEvent(db *gorm.DB, runID model.Int64String, nodeType workflow.NodeType, event workflow.Event) error {
	now := time.Now()
	if event.Status == workflow.StatusRunning {
		input, err := json.Marshal(event.Input)
		if err != nil {
			return err
		}
		return db.Create(&model.WorkflowNodeRun{WorkflowRunID: runID, NodeID: event.NodeID, NodeType: string(nodeType), CapabilityID: event.CapabilityID, Status: string(event.Status), Input: string(input), StartedAt: now}).Error
	}
	if event.Status == workflow.StatusSkipped {
		return db.Create(&model.WorkflowNodeRun{
			WorkflowRunID: runID, NodeID: event.NodeID, NodeType: string(nodeType), CapabilityID: event.CapabilityID,
			Status: string(event.Status), StartedAt: now, FinishedAt: &now,
		}).Error
	}
	updates := map[string]any{"status": string(event.Status), "duration_ms": event.DurationMs, "finished_at": &now}
	if event.Output != nil {
		output, err := json.Marshal(event.Output)
		if err != nil {
			return err
		}
		updates["output"] = string(output)
	}
	if event.Error != "" {
		updates["error_code"] = event.Error
	}
	return db.Model(&model.WorkflowNodeRun{}).Where("workflow_run_id = ? AND node_id = ?", runID, event.NodeID).Updates(updates).Error
}

func persistWorkflowRunEvent(db *gorm.DB, runID model.Int64String, event workflow.Event) error {
	input, err := json.Marshal(event.Input)
	if err != nil {
		return err
	}
	output, err := json.Marshal(event.Output)
	if err != nil {
		return err
	}
	return db.Create(&model.WorkflowRunEvent{
		WorkflowRunID: runID,
		Sequence:      event.Sequence,
		NodeID:        event.NodeID,
		NodeType:      string(event.NodeType),
		CapabilityID:  event.CapabilityID,
		Status:        string(event.Status),
		Message:       event.Message,
		Input:         string(input),
		Output:        string(output),
		ErrorCode:     event.Error,
		DurationMs:    event.DurationMs,
		OccurredAt:    time.Now(),
	}).Error
}

func finishWorkflowRun(run *model.WorkflowRun, status string, result map[string]any) error {
	encoded, err := json.Marshal(result)
	if err != nil {
		return err
	}
	now := time.Now()
	run.Status, run.Result, run.FinishedAt = status, string(encoded), &now
	return database.DB.Model(run).Updates(map[string]any{"status": status, "result": run.Result, "finished_at": &now}).Error
}

func workflowOwnedBy(workflowID, userID int64) bool {
	var count int64
	return database.DB.Model(&model.Workflow{}).Where("id = ? AND user_id = ?", workflowID, userID).Count(&count).Error == nil && count == 1
}
