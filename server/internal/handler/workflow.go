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
	"valley-server/internal/database"
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
		if err := validateWorkflowDraftForSave(tx, req.Graph, userID, 0); err != nil {
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
	if err := database.DB.Where("id = ? AND user_id = ?", id, userID).First(&workflow).Error; err != nil {
		Error(c, http.StatusNotFound, "工作流不存在")
		return
	}

	workflow.GraphHash = workflowGraphHash(workflow.Graph)
	Success(c, workflow)
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
		graphToValidate := definition.Graph
		if req.Graph != nil {
			graphToValidate = *req.Graph
		}
		if err := validateWorkflowDraftForSave(tx, graphToValidate, userID, id); err != nil {
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
		if err := validateWorkflowDraftForSave(tx, source.Config, userID, id); err != nil {
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
		return tx.Model(&app).Updates(map[string]any{"status": "published", "published_version_id": version.ID}).Error
	}); err != nil {
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
		if err := validateWorkflowDraftForSave(tx, definition.Graph, int64(userID), int64(definition.ID)); err != nil {
			return fmt.Errorf("%w: %v", errWorkflowDraftInvalid, err)
		}
		var syncErr error
		app, _, syncErr = syncWorkflowAIAppWithoutSnapshot(tx, definition)
		return syncErr
	}); err != nil {
		if errors.Is(err, errWorkflowDraftInvalid) {
			Error(c, 400, "工作流草稿已不受 Graph v4 支持")
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
	run := model.WorkflowRun{WorkflowID: model.Int64String(workflowID), UserID: model.Int64String(userID), Status: string(workflow.StatusRunning), Inputs: string(inputsJSON), GraphSnapshot: definition.Graph, StartedAt: time.Now()}
	if err := database.DB.Create(&run).Error; err != nil {
		Error(c, http.StatusInternalServerError, "创建运行记录失败")
		return
	}
	if workflowRequiresARKText(graph) {
		if _, configErr := aiclient.ReadARKTextConfig(); configErr != "" {
			_ = finishWorkflowRun(&run, string(workflow.StatusFailed), map[string]any{"error": "ARK_NOT_CONFIGURED"})
			persistWorkflowAIAppRun(app, appVersion, run, "failed", nil, "ARK_NOT_CONFIGURED")
			Error(c, http.StatusServiceUnavailable, "AI 服务未配置：请检查 ARK_API_KEY 和 ARK_TEXT_MODEL")
			return
		}
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
	send := func(step string, status string, message string, data any) {
		event := map[string]any{"step": step, "status": status, "message": message}
		if data != nil {
			event["data"] = data
		}
		encoded, _ := json.Marshal(event)
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
	executionContext, cancel := context.WithTimeout(c.Request.Context(), workflowRunExecutionTimeout)
	defer cancel()
	executeErr := workflow.Execute(executionContext, graph, registry, workflow.RunContext{ID: run.ID.String(), Actor: workflow.Actor{UserID: userID, Role: role}, Inputs: inputs, Outputs: make(map[string]map[string]any), KnowledgeRetriever: workflowKnowledgeRetriever(model.Int64String(userID), appVersion), ContentSearcher: workflowContentSearcher(model.Int64String(userID)), CoverGenerator: workflowCoverGenerator(), SubworkflowRunner: workflowSubworkflowRunner(model.Int64String(userID))}, func(event workflow.Event) {
		if persistenceErr == nil {
			persistenceErr = persistWorkflowNodeEvent(run.ID, nodeTypes[event.NodeID], event)
		}
		if nodeTypes[event.NodeID] == workflow.NodeTypeEnd && event.Status == workflow.StatusSucceeded {
			finalOutput = event.Output
		}
		if event.Status == workflow.StatusFailed || event.Status == workflow.StatusCancelled {
			failureMessage = event.Message
			failureCode = event.Error
			failedNodeID = event.NodeID
		}
		send(event.NodeID, string(event.Status), event.Message, event)
	})
	if persistenceErr != nil {
		_ = finishWorkflowRun(&run, string(workflow.StatusFailed), map[string]any{"error": "RUN_PERSISTENCE_FAILED"})
		persistWorkflowAIAppRun(app, appVersion, run, "failed", nil, "RUN_PERSISTENCE_FAILED")
		send("", "error", "运行记录保存失败", nil)
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
			send("", string(workflow.StatusCancelled), failureMessage, map[string]any{"runId": run.ID, "nodeId": failedNodeID, "error": failureCode})
			return
		}
		_ = finishWorkflowRun(&run, string(workflow.StatusFailed), map[string]any{"error": failureCode})
		persistWorkflowAIAppRun(app, appVersion, run, "failed", nil, failureCode)
		send("", "error", failureMessage, map[string]any{"runId": run.ID, "nodeId": failedNodeID, "error": failureCode})
		return
	}
	if finalOutput == nil {
		finalOutput = map[string]any{}
	}
	if err := finishWorkflowRun(&run, string(workflow.StatusSucceeded), finalOutput); err != nil {
		_ = finishWorkflowRun(&run, string(workflow.StatusFailed), map[string]any{"error": "RUN_PERSISTENCE_FAILED"})
		persistWorkflowAIAppRun(app, appVersion, run, "failed", nil, "RUN_PERSISTENCE_FAILED")
		send("", "error", "运行结果保存失败", map[string]any{"runId": run.ID, "error": "RUN_PERSISTENCE_FAILED", "statusCode": http.StatusInternalServerError})
		return
	}
	persistWorkflowAIAppRun(app, appVersion, run, "succeeded", finalOutput, "")
	send("", "done", "工作流执行完成", map[string]any{"runId": run.ID, "output": finalOutput})
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
	query := database.DB.Model(&model.WorkflowRun{}).Where("workflow_id = ? AND user_id = ?", workflowID, userID)
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
	Success(c, gin.H{"run": run, "nodes": nodes})
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

// Saved drafts must remain executable and must never bypass the server-owned
// capability, owner, version, recursion, or transitive budget boundaries.
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
			WorkflowID string `json:"workflowId"`
			VersionID  string `json:"versionId"`
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
		if err := db.Where("user_id = ? AND type = ? AND workflow_id = ? AND published_version_id = ?", userID, aiAppTypeWorkflow, workflowID, versionID).First(&app).Error; err != nil {
			return fmt.Errorf("子工作流 %s 必须锁定当前 owner 的已发布版本", config.WorkflowID)
		}
		var version model.AIAppVersion
		if err := db.Where("id = ? AND app_id = ?", versionID, app.ID).First(&version).Error; err != nil {
			return fmt.Errorf("子工作流版本不存在")
		}
		child, err := decodeWorkflowGraph(version.Config)
		if err != nil {
			return fmt.Errorf("子工作流版本 Graph 无效")
		}
		visiting[key] = true
		if err := validateSubworkflowReferences(db, child, userID, currentWorkflowID, visiting, budget); err != nil {
			return err
		}
		delete(visiting, key)
	}
	return nil
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

func workflowRequiresARKText(graph workflow.Graph) bool {
	for _, node := range graph.Nodes {
		if node.Type == workflow.NodeTypeLLM {
			return true
		}
	}
	return false
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

func persistWorkflowNodeEvent(runID model.Int64String, nodeType workflow.NodeType, event workflow.Event) error {
	now := time.Now()
	if event.Status == workflow.StatusRunning {
		input, err := json.Marshal(event.Input)
		if err != nil {
			return err
		}
		return database.DB.Create(&model.WorkflowNodeRun{WorkflowRunID: runID, NodeID: event.NodeID, NodeType: string(nodeType), CapabilityID: event.CapabilityID, Status: string(event.Status), Input: string(input), StartedAt: now}).Error
	}
	if event.Status == workflow.StatusSkipped {
		return database.DB.Create(&model.WorkflowNodeRun{
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
	return database.DB.Model(&model.WorkflowNodeRun{}).Where("workflow_run_id = ? AND node_id = ?", runID, event.NodeID).Updates(updates).Error
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
