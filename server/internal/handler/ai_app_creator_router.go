package handler

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"time"

	"valley-server/internal/ai/agent"
	"valley-server/internal/ai/tools"
	"valley-server/internal/aiclient"
	"valley-server/internal/model"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

func buildDeterministicCreatorToolCall(message string, toolNames []string) (agent.ToolCall, string, bool) {
	message = strings.TrimSpace(message)
	if message == "" {
		return agent.ToolCall{}, "", false
	}
	if containsString(toolNames, "document.export") {
		if call, reply, ok := buildDeterministicExportCall(message); ok {
			return call, reply, true
		}
	}
	if containsString(toolNames, "blog.publish") {
		if call, reply, ok := buildDeterministicBlogPublishCall(message); ok {
			return call, reply, true
		}
	}
	return agent.ToolCall{}, "", false
}

func executeDeterministicCreatorToolCall(
	ctx context.Context,
	db *gorm.DB,
	task *model.AIAppTask,
	app model.AIApp,
	conversation model.AIAppConversation,
	registry *tools.Registry,
	gate *aiAppToolApprovalGate,
	call agent.ToolCall,
	reply string,
	modelName string,
) error {
	registered := registry.Get(call.Name)
	if registered == nil {
		return errors.New("creator tool is not registered")
	}
	if err := gate.Authorize(ctx, call); err != nil {
		return err
	}
	_ = updateAIAppTask(db, task.ID, "running", 55, "正在调用 "+humanAIAppToolName(call.Name))
	started := time.Now()
	result, err := registered.Run(ctx, call.Args)
	durationMs := time.Since(started).Milliseconds()
	trace := model.AIAppConversationToolTrace{
		UserID: task.UserID, AppID: app.ID, ConversationID: conversation.ID, RunID: task.RunID,
		ToolName: call.Name, Narration: summarizeAIAppToolCall(call), Status: "succeeded", DurationMs: durationMs,
	}
	if err != nil {
		trace.Status = "failed"
		trace.ErrorCode = "TOOL_EXECUTION_FAILED"
		trace.ErrorMessage = publicAIAppToolFailureMessage(call.Name, trace.ErrorCode)
		_ = db.Create(&trace).Error
		return err
	}
	code, message, retryable := classifyAIAppToolFailure(call.Name, result)
	if code != "" {
		trace.Status = "failed"
		trace.ErrorCode = code
		trace.ErrorMessage = message
		trace.Retryable = retryable
		_ = db.Create(&trace).Error
		return errors.New(message)
	}
	if err := db.Create(&trace).Error; err != nil {
		return err
	}

	finishedAt := time.Now()
	runDurationMs := int64(0)
	if task.StartedAt != nil {
		runDurationMs = finishedAt.Sub(*task.StartedAt).Milliseconds()
	}
	assistantMessage := model.AIAppConversationMessage{
		UserID: task.UserID, AppID: app.ID, ConversationID: conversation.ID,
		RunID: &task.RunID, Role: "assistant", Content: strings.TrimSpace(reply), ImageGenerationIDs: "[]",
	}
	return db.Transaction(func(tx *gorm.DB) error {
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
		if err := tx.Model(&model.AIAppRun{}).Where("id = ?", task.RunID).Updates(map[string]any{
			"status": "succeeded", "model": modelName, "output": aiclient.TrimRunes(reply, 2000),
			"references": "[]", "duration_ms": runDurationMs,
		}).Error; err != nil {
			return err
		}
		return tx.Model(&model.AIAppTask{}).Where("id = ?", task.ID).Updates(map[string]any{
			"status": "succeeded", "progress": 100, "status_message": "已完成",
			"partial_output": strings.TrimSpace(reply), "finished_at": finishedAt,
		}).Error
	})
}

func buildDeterministicExportCall(message string) (agent.ToolCall, string, bool) {
	lower := strings.ToLower(message)
	if !strings.Contains(message, "导出") {
		return agent.ToolCall{}, "", false
	}
	format := ""
	switch {
	case strings.Contains(lower, "markdown") || strings.Contains(lower, " md"):
		format = "markdown"
	case strings.Contains(lower, "docx") || strings.Contains(message, "Word") || strings.Contains(message, "word"):
		format = "docx"
	case strings.Contains(lower, "pdf"):
		format = "pdf"
	}
	content := extractCreatorField(message, "正文")
	if content == "" {
		content = extractCreatorField(message, "内容")
	}
	fileName := extractCreatorFileName(message)
	if format == "" || content == "" || fileName == "" {
		return agent.ToolCall{}, "", false
	}
	args, _ := json.Marshal(map[string]any{"fileName": fileName, "format": format, "content": content})
	return agent.ToolCall{Name: "document.export", Args: args}, "已导出文件《" + fileName + "》，可在下方文件卡中下载。", true
}

func buildDeterministicBlogPublishCall(message string) (agent.ToolCall, string, bool) {
	if !strings.Contains(message, "发布") || !strings.Contains(message, "博客") {
		return agent.ToolCall{}, "", false
	}
	title := extractCreatorField(message, "标题")
	content := extractCreatorField(message, "正文")
	if title == "" || content == "" {
		return agent.ToolCall{}, "", false
	}
	visibility := "private"
	visibilityText := extractCreatorField(message, "可见范围")
	if strings.Contains(visibilityText, "公开") || strings.Contains(strings.ToLower(visibilityText), "public") {
		visibility = "public"
	}
	args, _ := json.Marshal(map[string]any{"title": title, "content": content, "visibility": visibility, "tags": []string{}})
	return agent.ToolCall{Name: "blog.publish", Args: args}, "博客《" + title + "》已发布。", true
}

func extractCreatorFileName(message string) string {
	for _, marker := range []string{"文件名叫", "文件名为", "文件名：", "文件名:"} {
		if index := strings.Index(message, marker); index >= 0 {
			value := message[index+len(marker):]
			if end := strings.IndexAny(value, "：:；;，,\n"); end >= 0 {
				value = value[:end]
			}
			return strings.TrimSpace(value)
		}
	}
	return ""
}

func extractCreatorField(message, label string) string {
	index := strings.Index(message, label+"：")
	markerLength := len(label + "：")
	if index < 0 {
		index = strings.Index(message, label+":")
		markerLength = len(label + ":")
	}
	if index < 0 {
		return ""
	}
	value := message[index+markerLength:]
	if end := strings.IndexAny(value, "；;\n"); end >= 0 {
		value = value[:end]
	}
	return strings.TrimSpace(strings.TrimRight(value, "；; "))
}
