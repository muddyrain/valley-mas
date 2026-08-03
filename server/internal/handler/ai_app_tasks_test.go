package handler

import (
	"context"
	"errors"
	"testing"
	"time"

	"valley-server/internal/ai/agent"
	"valley-server/internal/model"
)

func TestShouldRetryAIAppAgentRunOnlyBeforeObservableWork(t *testing.T) {
	transient := errors.New("agent: backend chat failed at step 1: AI 上游返回 503: busy")
	if !shouldRetryAIAppAgentRun(transient, false, false) {
		t.Fatal("expected transient upstream failure to retry")
	}
	if shouldRetryAIAppAgentRun(transient, true, false) {
		t.Fatal("must not retry after streaming visible output")
	}
	if shouldRetryAIAppAgentRun(transient, false, true) {
		t.Fatal("must not retry after invoking a tool")
	}
	if !shouldRetryAIAppAgentRun(errAIAppAgentEmptyReply, false, false) {
		t.Fatal("expected empty reply to retry")
	}
	if !shouldRetryAIAppAgentRun(agent.ErrEmptyStreamResponse, false, false) {
		t.Fatal("expected empty upstream stream to retry")
	}
	if shouldRetryAIAppAgentRun(errors.New("AI 上游返回 400: invalid request"), false, false) {
		t.Fatal("must not retry a permanent request error")
	}
	if shouldRetryAIAppAgentRun(context.Canceled, false, false) {
		t.Fatal("must not retry cancellation")
	}
}

func TestClaimAIAppTaskRespectsPerUserConcurrency(t *testing.T) {
	_, db := setupAIPlatformTestRouter(t)
	for index := 0; index < aiAppTaskMaxConcurrentPerUser; index++ {
		task := model.AIAppTask{
			UserID: 101, AppID: 1, ConversationID: 1, RunID: model.Int64String(100 + index),
			UserMessageID: model.Int64String(200 + index), Title: "running", Status: "running", Payload: `{}`,
		}
		if err := db.Create(&task).Error; err != nil {
			t.Fatalf("create running task: %v", err)
		}
	}
	blocked := model.AIAppTask{UserID: 101, AppID: 1, ConversationID: 1, RunID: 301, UserMessageID: 401, Title: "blocked", Status: "queued", Payload: `{}`}
	available := model.AIAppTask{UserID: 202, AppID: 1, ConversationID: 1, RunID: 302, UserMessageID: 402, Title: "available", Status: "queued", Payload: `{}`}
	if err := db.Create(&blocked).Error; err != nil {
		t.Fatalf("create blocked task: %v", err)
	}
	if err := db.Create(&available).Error; err != nil {
		t.Fatalf("create available task: %v", err)
	}

	claimed, ok, err := claimAIAppTask(context.Background(), db)
	if err != nil {
		t.Fatalf("claim task: %v", err)
	}
	if !ok || claimed.ID != available.ID {
		t.Fatalf("claimed task = %#v, want available user task", claimed)
	}
}

func TestClaimAIAppTaskStartsThreeTasksBeforeQueueing(t *testing.T) {
	_, db := setupAIPlatformTestRouter(t)
	tasks := make([]model.AIAppTask, 0, aiAppTaskMaxConcurrentPerUser+1)
	for index := 0; index < aiAppTaskMaxConcurrentPerUser+1; index++ {
		run := model.AIAppRun{
			AppID: 1, VersionID: 1, UserID: 101, Status: "queued", Input: "test",
		}
		if err := db.Create(&run).Error; err != nil {
			t.Fatalf("create run: %v", err)
		}
		task := model.AIAppTask{
			UserID: 101, AppID: 1, ConversationID: model.Int64String(index + 1), RunID: run.ID,
			UserMessageID: model.Int64String(200 + index), Title: "task", Status: "queued", Payload: `{}`,
		}
		if err := db.Create(&task).Error; err != nil {
			t.Fatalf("create task: %v", err)
		}
		tasks = append(tasks, task)
	}

	for index := 0; index < aiAppTaskMaxConcurrentPerUser; index++ {
		claimed, ok, err := claimAIAppTask(context.Background(), db)
		if err != nil {
			t.Fatalf("claim task %d: %v", index+1, err)
		}
		if !ok || claimed.ID != tasks[index].ID || claimed.Status != "running" {
			t.Fatalf("claim %d = %#v, want running task %s", index+1, claimed, tasks[index].ID)
		}
	}

	if claimed, ok, err := claimAIAppTask(context.Background(), db); err != nil {
		t.Fatalf("claim fourth task: %v", err)
	} else if ok {
		t.Fatalf("fourth task was claimed unexpectedly: %#v", claimed)
	}
	var fourth model.AIAppTask
	if err := db.First(&fourth, tasks[aiAppTaskMaxConcurrentPerUser].ID).Error; err != nil {
		t.Fatalf("load fourth task: %v", err)
	}
	setAIAppTaskQueuePosition(db, &fourth)
	if fourth.Status != "queued" || fourth.QueuePosition != 1 {
		t.Fatalf("fourth task = status %q position %d, want queued position 1", fourth.Status, fourth.QueuePosition)
	}
}

func TestClaimAIAppTaskSerializesTasksInSameConversation(t *testing.T) {
	_, db := setupAIPlatformTestRouter(t)
	running := model.AIAppTask{
		UserID: 101, AppID: 1, ConversationID: 11, RunID: 501,
		UserMessageID: 601, Title: "running", Status: "running", Payload: `{}`,
	}
	blocked := model.AIAppTask{
		UserID: 101, AppID: 1, ConversationID: 11, RunID: 502,
		UserMessageID: 602, Title: "same conversation", Status: "queued", Payload: `{}`,
	}
	available := model.AIAppTask{
		UserID: 101, AppID: 1, ConversationID: 12, RunID: 503,
		UserMessageID: 603, Title: "other conversation", Status: "queued", Payload: `{}`,
	}
	for _, task := range []*model.AIAppTask{&running, &blocked, &available} {
		if err := db.Create(task).Error; err != nil {
			t.Fatalf("create task: %v", err)
		}
	}

	claimed, ok, err := claimAIAppTask(context.Background(), db)
	if err != nil {
		t.Fatalf("claim task: %v", err)
	}
	if !ok || claimed.ID != available.ID {
		t.Fatalf("claimed task = %#v, want task from another conversation", claimed)
	}

	var stillQueued model.AIAppTask
	if err := db.First(&stillQueued, blocked.ID).Error; err != nil {
		t.Fatalf("load blocked task: %v", err)
	}
	if stillQueued.Status != "queued" {
		t.Fatalf("same-conversation task status = %q, want queued", stillQueued.Status)
	}
	setAIAppTaskQueuePosition(db, &stillQueued)
	if stillQueued.QueuePosition != 0 {
		t.Fatalf("same-conversation queue position = %d, want hidden position 0", stillQueued.QueuePosition)
	}
}

func TestClaimAIAppTaskByIDCannotSkipEarlierQueuedTaskInSameConversation(t *testing.T) {
	_, db := setupAIPlatformTestRouter(t)
	createdAt := time.Now().Add(-time.Minute)
	earlier := model.AIAppTask{
		UserID: 101, AppID: 1, ConversationID: 11, RunID: 701,
		UserMessageID: 801, Title: "earlier", Status: "queued", Payload: `{}`, CreatedAt: createdAt,
	}
	later := model.AIAppTask{
		UserID: 101, AppID: 1, ConversationID: 11, RunID: 702,
		UserMessageID: 802, Title: "later", Status: "queued", Payload: `{}`, CreatedAt: createdAt.Add(time.Second),
	}
	for _, task := range []*model.AIAppTask{&earlier, &later} {
		if err := db.Create(task).Error; err != nil {
			t.Fatalf("create task: %v", err)
		}
	}

	if claimed, ok, err := claimAIAppTaskByID(context.Background(), db, &later.ID); err != nil {
		t.Fatalf("claim later task: %v", err)
	} else if ok {
		t.Fatalf("later task skipped the queue: %#v", claimed)
	}

	claimed, ok, err := claimAIAppTask(context.Background(), db)
	if err != nil {
		t.Fatalf("claim queue head: %v", err)
	}
	if !ok || claimed.ID != earlier.ID {
		t.Fatalf("claimed task = %#v, want earlier task %#v", claimed, earlier)
	}
}

func TestAIAppAttachmentReferenceImages(t *testing.T) {
	attachments := []model.AIAppConversationAttachment{
		{Name: "reference.png", MimeType: "image/png", SourceContent: []byte("png")},
		{Name: "notes.txt", MimeType: "text/plain", SourceContent: []byte("text")},
	}
	images := aiAppAttachmentReferenceImages(attachments)
	if len(images) != 1 || images[0] != "data:image/png;base64,cG5n" {
		t.Fatalf("reference images = %#v", images)
	}
}

func TestAIAppTaskPartialWriterPersistsFirstAndFinalOutput(t *testing.T) {
	_, db := setupAIPlatformTestRouter(t)
	task := model.AIAppTask{
		UserID: 101, AppID: 1, ConversationID: 1, RunID: 501,
		UserMessageID: 601, Title: "stream", Status: "running", Payload: `{}`,
	}
	if err := db.Create(&task).Error; err != nil {
		t.Fatalf("create task: %v", err)
	}

	writer := newAIAppTaskPartialWriter(db, task.ID)
	writer.Append("你")
	writer.Append("好")
	var stored model.AIAppTask
	if err := db.First(&stored, task.ID).Error; err != nil {
		t.Fatalf("load partial task: %v", err)
	}
	if stored.PartialOutput != "你" {
		t.Fatalf("throttled partial output = %q, want first delta", stored.PartialOutput)
	}
	if err := writer.Flush(); err != nil {
		t.Fatalf("flush partial output: %v", err)
	}
	if err := db.First(&stored, task.ID).Error; err != nil {
		t.Fatalf("reload partial task: %v", err)
	}
	if stored.PartialOutput != "你好" {
		t.Fatalf("final partial output = %q, want %q", stored.PartialOutput, "你好")
	}
}
