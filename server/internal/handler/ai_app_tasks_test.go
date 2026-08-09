package handler

import (
	"context"
	"errors"
	"slices"
	"strings"
	"testing"
	"time"

	"valley-server/internal/ai/agent"
	"valley-server/internal/ai/tools"
	"valley-server/internal/aimodel"
	"valley-server/internal/model"
)

func TestAIAppTaskKnowledgeRetrievalFailureKeepsSpecificCode(t *testing.T) {
	if got := aiAppTaskKnowledgeRetrievalFailureCode(aimodel.ErrEmbeddingModelUnavailable); got != "RAG_EMBEDDING_MODEL_UNAVAILABLE" {
		t.Fatalf("retrieval failure code = %q", got)
	}
	if retryableAIAppTaskError("RAG_EMBEDDING_MODEL_UNAVAILABLE") {
		t.Fatal("missing catalog model is not retryable without a configuration change")
	}
	if !retryableAIAppTaskError("RAG_EMBEDDING_FAILED") {
		t.Fatal("temporary embedding provider failures should be retryable")
	}
}

func TestResolveAIKnowledgeAugmentationDegradesWithoutAbortingConversation(t *testing.T) {
	augmentation, err := resolveAIKnowledgeAugmentation(context.Background(), func(context.Context) (string, []aiKnowledgeReference, error) {
		return "", nil, aimodel.ErrEmbeddingModelUnavailable
	})
	if err != nil {
		t.Fatalf("knowledge failure must not abort conversation: %v", err)
	}
	if augmentation.Status != aiKnowledgeStatusDegraded {
		t.Fatalf("status = %q, want %q", augmentation.Status, aiKnowledgeStatusDegraded)
	}
	if augmentation.ErrorCode != "RAG_EMBEDDING_MODEL_UNAVAILABLE" {
		t.Fatalf("error code = %q", augmentation.ErrorCode)
	}
	if augmentation.Context != "" || len(augmentation.References) != 0 {
		t.Fatalf("degraded augmentation leaked context: %#v", augmentation)
	}
}

func TestResolveAIKnowledgeAugmentationPreservesUserCancellation(t *testing.T) {
	parent, cancel := context.WithCancel(context.Background())
	cancel()
	augmentation, err := resolveAIKnowledgeAugmentation(parent, func(context.Context) (string, []aiKnowledgeReference, error) {
		return "", nil, context.Canceled
	})
	if !errors.Is(err, context.Canceled) {
		t.Fatalf("cancellation error = %v", err)
	}
	if augmentation.Status != "" {
		t.Fatalf("cancelled augmentation must not be persisted: %#v", augmentation)
	}
}

func TestResolveAIKnowledgeAugmentationKeepsRetrievedContext(t *testing.T) {
	references := []aiKnowledgeReference{{Index: 1, DocumentName: "旅行资料.md"}}
	augmentation, err := resolveAIKnowledgeAugmentation(context.Background(), func(context.Context) (string, []aiKnowledgeReference, error) {
		return "周末可去西湖。", references, nil
	})
	if err != nil {
		t.Fatal(err)
	}
	if augmentation.Status != aiKnowledgeStatusUsed || augmentation.Context != "周末可去西湖。" {
		t.Fatalf("augmentation = %#v", augmentation)
	}
	if len(augmentation.References) != 1 || augmentation.References[0].DocumentName != "旅行资料.md" {
		t.Fatalf("references = %#v", augmentation.References)
	}
}

func TestLoadAIAppTaskConversationHistorySkipsUnansweredFailedTurn(t *testing.T) {
	_, db := setupAIPlatformTestRouter(t)
	const userID model.Int64String = 101
	const appID model.Int64String = 200
	conversationID := model.Int64String(300)
	runs := []model.AIAppRun{
		{UserID: userID, AppID: appID, ConversationID: &conversationID, Status: "failed"},
		{UserID: userID, AppID: appID, ConversationID: &conversationID, Status: "succeeded"},
		{UserID: userID, AppID: appID, ConversationID: &conversationID, Status: "queued"},
	}
	if err := db.Create(&runs).Error; err != nil {
		t.Fatal(err)
	}
	failedUser := model.AIAppConversationMessage{UserID: userID, AppID: appID, ConversationID: conversationID, RunID: &runs[0].ID, Role: "user", Content: "旧失败问题"}
	succeededUser := model.AIAppConversationMessage{UserID: userID, AppID: appID, ConversationID: conversationID, RunID: &runs[1].ID, Role: "user", Content: "已完成问题"}
	succeededAssistant := model.AIAppConversationMessage{UserID: userID, AppID: appID, ConversationID: conversationID, RunID: &runs[1].ID, Role: "assistant", Content: "已完成回答"}
	currentUser := model.AIAppConversationMessage{UserID: userID, AppID: appID, ConversationID: conversationID, RunID: &runs[2].ID, Role: "user", Content: "当前问题"}
	for _, message := range []*model.AIAppConversationMessage{&failedUser, &succeededUser, &succeededAssistant, &currentUser} {
		if err := db.Create(message).Error; err != nil {
			t.Fatal(err)
		}
	}
	task := model.AIAppTask{
		UserID: userID, AppID: appID, ConversationID: conversationID,
		RunID: runs[2].ID, UserMessageID: currentUser.ID,
	}

	history, err := loadAIAppTaskConversationHistory(db, task)
	if err != nil {
		t.Fatal(err)
	}
	contents := make([]string, 0, len(history))
	for _, message := range history {
		contents = append(contents, message.Content)
	}
	if slices.Contains(contents, failedUser.Content) {
		t.Fatalf("unanswered failed turn leaked into history: %#v", contents)
	}
	for _, expected := range []string{succeededUser.Content, succeededAssistant.Content, currentUser.Content} {
		if !slices.Contains(contents, expected) {
			t.Fatalf("history is missing %q: %#v", expected, contents)
		}
	}

	retryTask := task
	retryTask.UserMessageID = failedUser.ID
	retryHistory, err := loadAIAppTaskConversationHistory(db, retryTask)
	if err != nil {
		t.Fatal(err)
	}
	retryContents := make([]string, 0, len(retryHistory))
	for _, message := range retryHistory {
		retryContents = append(retryContents, message.Content)
	}
	if !slices.Contains(retryContents, failedUser.Content) {
		t.Fatalf("explicit retry lost its source user message: %#v", retryContents)
	}
}

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

func TestAppendAIAppClarificationInstructionsCoversConversationalFollowUp(t *testing.T) {
	got := appendAIAppClarificationInstructions("基础指令", []string{"clarification.ask"})
	for _, expected := range []string{
		"即使不需要调用其他工具",
		"必须调用 clarification.ask",
		"不要在普通回复中列出一组问题",
		"普通回复中不得包含要求用户回答的问句",
		"一次只问一个最能推进任务的问题",
	} {
		if !strings.Contains(got, expected) {
			t.Fatalf("clarification instructions missing %q: %s", expected, got)
		}
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

func TestAIAppArtifactRequestContextLimitsToolsToCurrentAttachments(t *testing.T) {
	taskID := model.Int64String(14)
	attachments := []model.AIAppConversationAttachment{{ID: 21}, {ID: 22}}
	input := aiAppArtifactRequestContext(101, 11, 12, 13, &taskID, attachments)
	if input.UserID != 101 || input.AppID != 11 || input.ConversationID != 12 || input.RunID != 13 {
		t.Fatalf("unexpected request context: %#v", input)
	}
	if input.TaskID == nil || *input.TaskID != taskID {
		t.Fatalf("task id was not retained: %#v", input.TaskID)
	}
	if len(input.AttachmentIDs) != 2 || input.AttachmentIDs[0] != 21 || input.AttachmentIDs[1] != 22 {
		t.Fatalf("attachment ids = %#v", input.AttachmentIDs)
	}
}

func TestGeneratedAndConvertedOutputsNeverPauseForApproval(t *testing.T) {
	for _, name := range []string{"image.generate", "image.convert", "document.convert", "file.create", "content.search"} {
		if aiAppToolRequiresApproval(name, "always") {
			t.Fatalf("%s must run without approval", name)
		}
	}
	if !aiAppToolRequiresApproval("blog.create_draft", "always") {
		t.Fatal("durable blog writes must keep approval")
	}
	if aiAppToolRequiresApproval("blog.create_draft", "auto") {
		t.Fatal("auto policy must not pause")
	}
	for _, name := range []string{"document.save", "document.overwrite", "blog.publish"} {
		if !aiAppToolRequiresApproval(name, "auto", tools.ConfirmationBeforeWrite) {
			t.Fatalf("%s must require confirmation from its tool contract", name)
		}
	}
}

func TestBuildAIAppAttachmentContextIncludesIDsForToolSelection(t *testing.T) {
	contextText := buildAIAppAttachmentContext([]model.AIAppConversationAttachment{
		{ID: 21, Name: "cover.webp", MimeType: "image/webp"},
		{ID: 22, Name: "report.pdf", MimeType: "application/pdf", ParsedText: "Quarterly summary"},
	})
	for _, expected := range []string{"cover.webp", "附件 ID：21", "report.pdf", "附件 ID：22", "Quarterly summary"} {
		if !strings.Contains(contextText, expected) {
			t.Fatalf("attachment context does not contain %q: %s", expected, contextText)
		}
	}
}

func TestBuildAIAppCreatorWorkspaceContextIsOwnerScopedAndOmitsExpiredArtifacts(t *testing.T) {
	_, db := setupAIPlatformTestRouter(t)
	now := time.Now()
	ownedResource := model.Resource{UserID: 101, Type: "agent_file", Visibility: "private", Title: "报告", URL: "owned", StorageKey: "owned-key"}
	foreignResource := model.Resource{UserID: 202, Type: "document", Visibility: "private", Title: "他人文档", URL: "foreign", StorageKey: "foreign-key"}
	_ = db.Create(&ownedResource).Error
	_ = db.Create(&foreignResource).Error
	expires := now.Add(time.Hour)
	expired := now.Add(-time.Hour)
	_ = db.Create(&model.AIAppArtifact{UserID: 101, AppID: 11, ConversationID: 12, RunID: 13, ResourceID: ownedResource.ID, FileName: "report.pdf", ContentType: "application/pdf", SizeBytes: 12, URL: "owned", ExpiresAt: &expires}).Error
	_ = db.Create(&model.AIAppArtifact{UserID: 101, AppID: 11, ConversationID: 12, RunID: 14, ResourceID: ownedResource.ID, FileName: "expired.pdf", ContentType: "application/pdf", SizeBytes: 12, URL: "owned", ExpiresAt: &expired}).Error

	contextText, err := buildAIAppCreatorWorkspaceContext(db, 101, 11, now)
	if err != nil {
		t.Fatal(err)
	}
	for _, expected := range []string{"report.pdf", "成果 ID", ownedResource.ID.String()} {
		if !strings.Contains(contextText, expected) {
			t.Fatalf("context missing %q: %s", expected, contextText)
		}
	}
	for _, forbidden := range []string{"expired.pdf", "他人文档", foreignResource.ID.String()} {
		if strings.Contains(contextText, forbidden) {
			t.Fatalf("context leaked %q: %s", forbidden, contextText)
		}
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
