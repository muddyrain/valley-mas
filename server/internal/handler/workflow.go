package handler

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"time"
	"valley-server/internal/database"
	"valley-server/internal/model"

	"github.com/gin-gonic/gin"
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

// AdminRunWorkflow 运行工作流（SSE）
func AdminRunWorkflow(c *gin.Context) {
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

	// 解析运行参数
	var inputsJSON string
	if c.Request.Body != nil {
		bodyBytes, readErr := io.ReadAll(c.Request.Body)
		if readErr == nil && len(bodyBytes) > 0 {
			var runReq struct {
				Inputs json.RawMessage `json:"inputs"`
			}
			if json.Unmarshal(bodyBytes, &runReq) == nil && len(runReq.Inputs) > 0 {
				inputsJSON = string(runReq.Inputs)
			}
		}
	}

	// 创建运行记录
	workflowRun := model.WorkflowRun{
		WorkflowID: model.Int64String(id),
		Status:     "running",
		Inputs:     inputsJSON,
		StartedAt:  time.Now(),
	}
	database.DB.Create(&workflowRun)

	// 设置 SSE 头
	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")
	c.Header("X-Accel-Buffering", "no")

	sendWorkflowSSEEvent := func(step string, status string, message string, data interface{}) {
		event := map[string]interface{}{
			"step":    step,
			"status":  status,
			"message": message,
		}
		if data != nil {
			event["data"] = data
		}
		jsonData, _ := json.Marshal(event)
		fmt.Fprintf(c.Writer, "data: %s\n\n", jsonData)
		c.Writer.(http.Flusher).Flush()
	}

	// 解析 graph 并遍历节点
	var graph struct {
		Nodes []struct {
			ID   string `json:"id"`
			Data struct {
				Label    string `json:"label"`
				NodeType string `json:"nodeType"`
			} `json:"data"`
		} `json:"nodes"`
		Edges []struct {
			Source string `json:"source"`
			Target string `json:"target"`
		} `json:"edges"`
	}

	if err := json.Unmarshal([]byte(workflow.Graph), &graph); err != nil {
		sendWorkflowSSEEvent("", "error", "工作流格式错误", nil)
		now := time.Now()
		database.DB.Model(&workflowRun).Updates(map[string]interface{}{
			"status":      "failed",
			"result":      `{"error":"invalid graph format"}`,
			"finished_at": &now,
		})
		return
	}

	// 按拓扑顺序遍历节点（简化版：按添加顺序）
	for _, node := range graph.Nodes {
		sendWorkflowSSEEvent(node.ID, "running", fmt.Sprintf("正在执行: %s", node.Data.Label), nil)

		// TODO: 根据节点类型执行实际逻辑（AI 调用、代码执行等）
		// P0 阶段只模拟执行

		time.Sleep(500 * time.Millisecond) // 模拟执行耗时

		sendWorkflowSSEEvent(node.ID, "success", fmt.Sprintf("完成: %s", node.Data.Label), nil)
	}

	// 完成运行
	now := time.Now()
	database.DB.Model(&workflowRun).Updates(map[string]interface{}{
		"status":      "success",
		"result":      `{"status":"completed"}`,
		"finished_at": &now,
	})

	sendWorkflowSSEEvent("", "done", "工作流执行完成", map[string]interface{}{"runId": workflowRun.ID})
}
