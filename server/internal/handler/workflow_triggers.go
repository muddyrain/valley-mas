package handler

import (
	"net/http"
	"strings"
	"time"

	"valley-server/internal/database"
	"valley-server/internal/model"
	"valley-server/internal/workflowtrigger"

	"github.com/gin-gonic/gin"
)

func workflowTriggerDefinition(c *gin.Context) (int64, model.Workflow, model.AIAppVersion, bool) {
	userID, _, ok := currentUser(c)
	if !ok {
		Error(c, http.StatusUnauthorized, "未登录")
		return 0, model.Workflow{}, model.AIAppVersion{}, false
	}
	workflowID, err := parsePathInt64(c, "id")
	if err != nil {
		Error(c, http.StatusBadRequest, "无效的 ID")
		return 0, model.Workflow{}, model.AIAppVersion{}, false
	}
	var definition model.Workflow
	if err := database.GetDB().Where("id = ? AND user_id = ?", workflowID, userID).First(&definition).Error; err != nil {
		Error(c, http.StatusNotFound, "工作流不存在")
		return 0, model.Workflow{}, model.AIAppVersion{}, false
	}
	var app model.AIApp
	if err := database.GetDB().Where("workflow_id = ? AND user_id = ? AND type = ?", definition.ID, userID, aiAppTypeWorkflow).First(&app).Error; err != nil || app.PublishedVersionID == 0 {
		Error(c, http.StatusConflict, "请先发布工作流后再创建定时触发")
		return 0, model.Workflow{}, model.AIAppVersion{}, false
	}
	var version model.AIAppVersion
	if err := database.GetDB().Where("id = ? AND app_id = ? AND published_at IS NOT NULL", app.PublishedVersionID, app.ID).First(&version).Error; err != nil {
		Error(c, http.StatusConflict, "已发布工作流版本不可用")
		return 0, model.Workflow{}, model.AIAppVersion{}, false
	}
	return userID, definition, version, true
}

func ListWorkflowTriggers(c *gin.Context) {
	userID, definition, _, ok := workflowTriggerDefinition(c)
	if !ok {
		return
	}
	var triggers []model.WorkflowTrigger
	if err := database.GetDB().Where("workflow_id = ? AND user_id = ?", definition.ID, userID).Order("created_at DESC").Find(&triggers).Error; err != nil {
		Error(c, http.StatusInternalServerError, "加载定时触发失败")
		return
	}
	Success(c, gin.H{"list": triggers})
}

func CreateWorkflowTrigger(c *gin.Context) {
	userID, definition, version, ok := workflowTriggerDefinition(c)
	if !ok {
		return
	}
	var payload struct {
		CronExpression string `json:"cronExpression"`
		Timezone       string `json:"timezone"`
	}
	if err := c.ShouldBindJSON(&payload); err != nil {
		Error(c, http.StatusBadRequest, "定时触发参数无效")
		return
	}
	schedule, err := workflowtrigger.Parse(payload.CronExpression, payload.Timezone)
	if err != nil {
		Error(c, http.StatusBadRequest, "Cron 表达式或时区无效")
		return
	}
	graph, err := decodeWorkflowGraph(version.Config)
	if err != nil {
		Error(c, http.StatusConflict, "已发布工作流版本无效")
		return
	}
	if err := workflowtrigger.ValidateScheduledGraph(graph, workflowRuntimeRegistry()); err != nil {
		Error(c, http.StatusBadRequest, "该工作流暂不支持定时运行: "+err.Error())
		return
	}
	nextRunAt := schedule.Next(time.Now())
	trigger := model.WorkflowTrigger{
		WorkflowID:     definition.ID,
		UserID:         model.Int64String(userID),
		Type:           "cron",
		CronExpression: schedule.Expression,
		Timezone:       schedule.Timezone,
		Status:         "active",
		NextRunAt:      &nextRunAt,
	}
	if err := database.GetDB().Create(&trigger).Error; err != nil {
		Error(c, http.StatusInternalServerError, "创建定时触发失败")
		return
	}
	Success(c, trigger)
}

func UpdateWorkflowTrigger(c *gin.Context) {
	userID, definition, _, ok := workflowTriggerDefinition(c)
	if !ok {
		return
	}
	triggerID, err := parsePathInt64(c, "triggerId")
	if err != nil {
		Error(c, http.StatusBadRequest, "无效的定时触发 ID")
		return
	}
	var payload struct {
		Status string `json:"status"`
	}
	if err := c.ShouldBindJSON(&payload); err != nil {
		Error(c, http.StatusBadRequest, "定时触发参数无效")
		return
	}
	payload.Status = strings.TrimSpace(payload.Status)
	if payload.Status != "active" && payload.Status != "disabled" {
		Error(c, http.StatusBadRequest, "定时触发状态无效")
		return
	}
	var trigger model.WorkflowTrigger
	if err := database.GetDB().Where("id = ? AND workflow_id = ? AND user_id = ?", triggerID, definition.ID, userID).First(&trigger).Error; err != nil {
		Error(c, http.StatusNotFound, "定时触发不存在")
		return
	}
	updates := map[string]any{"status": payload.Status}
	if payload.Status == "active" {
		schedule, parseErr := workflowtrigger.Parse(trigger.CronExpression, trigger.Timezone)
		if parseErr != nil {
			Error(c, http.StatusConflict, "定时触发规则已失效，请重新创建")
			return
		}
		nextRunAt := schedule.Next(time.Now())
		updates["next_run_at"] = nextRunAt
		trigger.NextRunAt = &nextRunAt
	} else {
		updates["next_run_at"] = nil
		trigger.NextRunAt = nil
	}
	if err := database.GetDB().Model(&trigger).Updates(updates).Error; err != nil {
		Error(c, http.StatusInternalServerError, "更新定时触发失败")
		return
	}
	trigger.Status = payload.Status
	Success(c, trigger)
}

func DeleteWorkflowTrigger(c *gin.Context) {
	userID, definition, _, ok := workflowTriggerDefinition(c)
	if !ok {
		return
	}
	triggerID, err := parsePathInt64(c, "triggerId")
	if err != nil {
		Error(c, http.StatusBadRequest, "无效的定时触发 ID")
		return
	}
	result := database.GetDB().Where("id = ? AND workflow_id = ? AND user_id = ?", triggerID, definition.ID, userID).Delete(&model.WorkflowTrigger{})
	if result.Error != nil {
		Error(c, http.StatusInternalServerError, "删除定时触发失败")
		return
	}
	if result.RowsAffected == 0 {
		Error(c, http.StatusNotFound, "定时触发不存在")
		return
	}
	Success(c, gin.H{"deletedId": triggerID})
}
