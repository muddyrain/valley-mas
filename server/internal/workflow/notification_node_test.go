package workflow

import (
	"context"
	"testing"
)

func TestNotificationCapabilitySendsOwnerScopedNotification(t *testing.T) {
	var receivedUserID int64
	var received NotificationRequest
	adapter := NotificationCapabilityAdapter{}
	result, err := adapter.Execute(context.Background(), RunContext{
		ID:    "run-1",
		Actor: Actor{UserID: 42},
		NotificationSender: NotificationSenderFunc(func(
			_ context.Context,
			userID int64,
			request NotificationRequest,
		) (SentNotification, error) {
			receivedUserID = userID
			received = request
			return SentNotification{ID: "notice-1", Status: request.Status, Path: request.Path}, nil
		}),
	}, NodeExecution{Input: map[string]any{
		"status":  "success",
		"title":   "  工作流已完成  ",
		"content": "  可以查看结果了  ",
		"path":    "/notifications",
	}})
	if err != nil {
		t.Fatalf("execute notification: %v", err)
	}
	if receivedUserID != 42 || received.RunID != "run-1" {
		t.Fatalf("unexpected owner request: user=%d request=%#v", receivedUserID, received)
	}
	if received.Title != "工作流已完成" || received.Content != "可以查看结果了" {
		t.Fatalf("notification text was not normalized: %#v", received)
	}
	if result.Output["notificationId"] != "notice-1" || result.Output["delivered"] != true {
		t.Fatalf("unexpected output: %#v", result.Output)
	}
}

func TestNotificationCapabilityRejectsUnsafePath(t *testing.T) {
	adapter := NotificationCapabilityAdapter{}
	_, err := adapter.Execute(context.Background(), RunContext{
		Actor: Actor{UserID: 42},
		NotificationSender: NotificationSenderFunc(func(
			context.Context,
			int64,
			NotificationRequest,
		) (SentNotification, error) {
			t.Fatal("sender should not be called")
			return SentNotification{}, nil
		}),
	}, NodeExecution{Input: map[string]any{
		"status":  "error",
		"title":   "失败",
		"content": "查看运行记录",
		"path":    "https://example.com",
	}})
	if err == nil {
		t.Fatal("expected unsafe path error")
	}
}

func TestNotificationCapabilityRequiresConfiguredSender(t *testing.T) {
	_, err := (NotificationCapabilityAdapter{}).Execute(
		context.Background(),
		RunContext{Actor: Actor{UserID: 42}},
		NodeExecution{Input: map[string]any{
			"status": "info", "title": "通知", "content": "内容",
		}},
	)
	if err == nil {
		t.Fatal("expected missing sender error")
	}
}
