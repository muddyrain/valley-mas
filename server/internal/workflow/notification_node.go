package workflow

import (
	"context"
	"fmt"
	"strings"
	"unicode/utf8"
)

var workflowNotificationStatuses = map[string]bool{
	"info":             true,
	"success":          true,
	"error":            true,
	"waiting_approval": true,
}

type NotificationCapabilityAdapter struct{}

func (NotificationCapabilityAdapter) Execute(
	ctx context.Context,
	run RunContext,
	execution NodeExecution,
) (NodeResult, error) {
	if run.NotificationSender == nil {
		return NodeResult{}, fmt.Errorf("站内通知服务未配置")
	}
	if run.Actor.UserID <= 0 {
		return NodeResult{}, fmt.Errorf("站内通知缺少有效用户")
	}

	status := stringFromValue(execution.Input["status"])
	if status == "" {
		status = "info"
	}
	if !workflowNotificationStatuses[status] {
		return NodeResult{}, fmt.Errorf("站内通知状态无效")
	}

	title := stringFromValue(execution.Input["title"])
	content := stringFromValue(execution.Input["content"])
	path := stringFromValue(execution.Input["path"])
	if title == "" || content == "" {
		return NodeResult{}, fmt.Errorf("站内通知标题和内容不能为空")
	}
	if utf8.RuneCountInString(title) > 120 {
		return NodeResult{}, fmt.Errorf("站内通知标题不能超过 120 个字符")
	}
	if utf8.RuneCountInString(content) > 1000 {
		return NodeResult{}, fmt.Errorf("站内通知内容不能超过 1000 个字符")
	}
	if path != "" && (!strings.HasPrefix(path, "/") || strings.HasPrefix(path, "//")) {
		return NodeResult{}, fmt.Errorf("站内通知跳转地址必须是站内路径")
	}

	sent, err := run.NotificationSender.SendNotification(ctx, run.Actor.UserID, NotificationRequest{
		RunID:   run.ID,
		Status:  status,
		Title:   title,
		Content: content,
		Path:    path,
	})
	if err != nil {
		return NodeResult{}, err
	}
	return NodeResult{Output: map[string]any{
		"notificationId": sent.ID,
		"delivered":      true,
		"status":         sent.Status,
		"path":           sent.Path,
	}}, nil
}
