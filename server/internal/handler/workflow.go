package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"
	"valley-server/internal/aiclient"
	"valley-server/internal/database"
	"valley-server/internal/model"
	"valley-server/internal/workflow"

	"github.com/gin-gonic/gin"
)

const (
	workflowRunRequestMaxBytes  = 6 * 1024 * 1024
	workflowRunExecutionTimeout = 2 * time.Minute
)

var legacyWorkflowReferencePattern = regexp.MustCompile(`\{\{([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)\}\}`)

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
		req.Graph = `{"nodes":[],"edges":[]}`
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

	if err := database.DB.Create(&workflow).Error; err != nil {
		Error(c, http.StatusInternalServerError, "创建失败: "+err.Error())
		return
	}

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
		Name        *string `json:"name"`
		Description *string `json:"description"`
		Graph       *string `json:"graph"`
		Status      *string `json:"status"`
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

	result := database.DB.Model(&model.Workflow{}).
		Where("id = ? AND user_id = ?", id, userID).
		Updates(updates)
	if result.RowsAffected == 0 {
		Error(c, http.StatusNotFound, "工作流不存在")
		return
	}

	Success(c, nil)
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
			Error(c, http.StatusServiceUnavailable, "AI 服务未配置")
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
	executionContext, cancel := context.WithTimeout(c.Request.Context(), workflowRunExecutionTimeout)
	defer cancel()
	executeErr := workflow.Execute(executionContext, graph, registry, workflow.RunContext{ID: run.ID.String(), Actor: workflow.Actor{UserID: userID, Role: role}, Inputs: inputs, Outputs: make(map[string]map[string]any)}, func(event workflow.Event) {
		if persistenceErr == nil {
			persistenceErr = persistWorkflowNodeEvent(run.ID, nodeTypes[event.NodeID], event)
		}
		if nodeTypes[event.NodeID] == workflow.NodeTypeEnd && event.Status == workflow.StatusSucceeded {
			finalOutput = event.Output
		}
		send(event.NodeID, string(event.Status), event.Message, event)
	})
	if persistenceErr != nil {
		_ = finishWorkflowRun(&run, string(workflow.StatusFailed), map[string]any{"error": "RUN_PERSISTENCE_FAILED"})
		send("", "error", "运行记录保存失败", nil)
		return
	}
	if executeErr != nil {
		_ = finishWorkflowRun(&run, string(workflow.StatusFailed), map[string]any{"error": "WORKFLOW_NODE_FAILED"})
		send("", "error", "工作流执行失败", map[string]any{"runId": run.ID, "error": "WORKFLOW_NODE_FAILED"})
		return
	}
	if finalOutput == nil {
		finalOutput = map[string]any{}
	}
	if err := finishWorkflowRun(&run, string(workflow.StatusSucceeded), finalOutput); err != nil {
		_ = finishWorkflowRun(&run, string(workflow.StatusFailed), map[string]any{"error": "RUN_PERSISTENCE_FAILED"})
		send("", "error", "运行结果保存失败", map[string]any{"runId": run.ID, "error": "RUN_PERSISTENCE_FAILED", "statusCode": http.StatusInternalServerError})
		return
	}
	send("", "done", "工作流执行完成", map[string]any{"runId": run.ID, "output": finalOutput})
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
	upgradeLegacyOutputReferences(&graph)
	return graph, nil
}

// upgradeLegacyOutputReferences keeps graphs saved before Graph v1 usable.
// The old editor emitted {{node.field}} while the runtime contract requires
// {{node.output.field}}. Only references to IDs present in this graph change;
// arbitrary user text and already-valid three-part references stay untouched.
func upgradeLegacyOutputReferences(graph *workflow.Graph) {
	nodeIDs := make(map[string]struct{}, len(graph.Nodes))
	for _, node := range graph.Nodes {
		nodeIDs[node.ID] = struct{}{}
	}
	for index := range graph.Nodes {
		config := string(graph.Nodes[index].Config)
		normalized := legacyWorkflowReferencePattern.ReplaceAllStringFunc(config, func(reference string) string {
			parts := legacyWorkflowReferencePattern.FindStringSubmatch(reference)
			if len(parts) != 3 {
				return reference
			}
			if _, exists := nodeIDs[parts[1]]; !exists {
				return reference
			}
			return "{{" + parts[1] + ".output." + parts[2] + "}}"
		})
		if normalized != config {
			graph.Nodes[index].Config = json.RawMessage(normalized)
		}
	}
}

func workflowRuntimeRegistry() *workflow.Registry {
	registry := workflow.DefaultRegistry()
	_ = workflow.RegisterBlogWorkflowExecutors(registry, nil)
	return registry
}

func workflowRequiresARKText(graph workflow.Graph) bool {
	for _, node := range graph.Nodes {
		if node.Type == workflow.NodeTypeLLMText {
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
		return database.DB.Create(&model.WorkflowNodeRun{WorkflowRunID: runID, NodeID: event.NodeID, NodeType: string(nodeType), Status: string(event.Status), Input: string(input), StartedAt: now}).Error
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
