package handler

import (
	"encoding/json"
	"strings"
	"testing"

	clarificationprotocol "valley-server/internal/ai/clarification"
	documenttool "valley-server/internal/ai/tools/document"
	imagetool "valley-server/internal/ai/tools/image"
	"valley-server/internal/model"
)

func TestBuildAIAppConversionClarificationRequiresSourceAttachment(t *testing.T) {
	request, ok := buildAIAppConversionClarification(
		99,
		"帮我转换一下",
		nil,
		nil,
		[]string{imagetool.ConvertToolName, documenttool.ToolName, clarificationprotocol.ToolName},
		1,
	)
	if !ok {
		t.Fatal("expected an ambiguous conversion request to require clarification")
	}
	if request.AnswerType != clarificationprotocol.AnswerFile || !request.Blocking || request.Round != 1 || request.MaxRounds != 3 {
		t.Fatalf("request = %#v", request)
	}
	if request.Question != "请上传要转换的图片或 PDF，并告诉我希望转换成什么格式。" {
		t.Fatalf("question = %q", request.Question)
	}
}

func TestBuildAIAppConversionClarificationRequiresImageTargetFormat(t *testing.T) {
	attachments := []model.AIAppConversationAttachment{{ID: 7, Name: "cover.webp", MimeType: "image/webp"}}
	request, ok := buildAIAppConversionClarification(
		99,
		"帮我转换这张图片",
		attachments,
		nil,
		[]string{imagetool.ConvertToolName, clarificationprotocol.ToolName},
		1,
	)
	if !ok || request.AnswerType != clarificationprotocol.AnswerSingleSelect {
		t.Fatalf("request = %#v ok=%v", request, ok)
	}
	if len(request.Suggestions) != 2 || request.Suggestions[0].Value == "webp" || request.Suggestions[1].Value == "webp" {
		t.Fatalf("suggestions = %#v", request.Suggestions)
	}

	if _, ok := buildAIAppConversionClarification(
		99,
		"把这张图片转成 PNG",
		attachments,
		nil,
		[]string{imagetool.ConvertToolName, clarificationprotocol.ToolName},
		1,
	); ok {
		t.Fatal("an explicit supported target format must not trigger clarification")
	}
}

func TestBuildAIAppConversionClarificationIgnoresUnrelatedRequestsAndFixedPDFTarget(t *testing.T) {
	tools := []string{imagetool.ConvertToolName, documenttool.ToolName, clarificationprotocol.ToolName}
	if _, ok := buildAIAppConversionClarification(99, "帮我换一种表达", nil, nil, tools, 1); ok {
		t.Fatal("unrelated wording must not trigger a conversion clarification")
	}
	attachments := []model.AIAppConversationAttachment{{ID: 8, Name: "draft.pdf", MimeType: "application/pdf"}}
	if _, ok := buildAIAppConversionClarification(99, "转换这个 PDF", attachments, nil, tools, 1); ok {
		t.Fatal("PDF conversion has a single supported DOCX target and should continue directly")
	}
}

func TestResolveAIAppTaskClarificationPersistsAnswerAndRequeuesTask(t *testing.T) {
	_, db := setupAIPlatformTestRouter(t)
	app := model.AIApp{UserID: 101, Type: aiAppTypeAgent, Name: "clarification agent"}
	if err := db.Create(&app).Error; err != nil {
		t.Fatal(err)
	}
	conversation := model.AIAppConversation{UserID: 101, AppID: app.ID, VersionID: 1}
	if err := db.Create(&conversation).Error; err != nil {
		t.Fatal(err)
	}
	run := model.AIAppRun{UserID: 101, AppID: app.ID, VersionID: 1, ConversationID: &conversation.ID, Status: "running", Input: "帮我转换一下"}
	if err := db.Create(&run).Error; err != nil {
		t.Fatal(err)
	}
	userMessage := model.AIAppConversationMessage{UserID: 101, AppID: app.ID, ConversationID: conversation.ID, RunID: &run.ID, Role: "user", Content: "帮我转换一下"}
	if err := db.Create(&userMessage).Error; err != nil {
		t.Fatal(err)
	}
	payload, _ := json.Marshal(aiAppTaskPayload{Message: userMessage.Content})
	task := model.AIAppTask{UserID: 101, AppID: app.ID, ConversationID: conversation.ID, RunID: run.ID, UserMessageID: userMessage.ID, Title: userMessage.Content, Status: "needs_input", Payload: string(payload)}
	if err := db.Create(&task).Error; err != nil {
		t.Fatal(err)
	}
	request := model.AIAppTaskClarification{
		TaskID: task.ID, RunID: run.ID, UserID: 101, AppID: app.ID, ConversationID: conversation.ID,
		RequestID: "request-1", Question: "请选择目标格式", Reason: "转换前需要目标格式",
		AnswerType: "single_select", Suggestions: `[{"label":"PNG","value":"png"}]`,
		AllowCustomAnswer: true, Blocking: true, Round: 1, MaxRounds: 3, Status: "pending",
	}
	if err := db.Create(&request).Error; err != nil {
		t.Fatal(err)
	}
	if _, _, err := resolveAIAppTaskClarification(db, 202, app.ID, task.ID, request.ID, clarificationprotocol.DecisionAnswer, "png"); err == nil {
		t.Fatal("foreign owner must not resolve the clarification")
	}

	resolved, answerMessage, err := resolveAIAppTaskClarification(db, 101, app.ID, task.ID, request.ID, clarificationprotocol.DecisionAnswer, "png")
	if err != nil {
		t.Fatalf("resolve clarification: %v", err)
	}
	if resolved.Status != "answered" || answerMessage.Content != "png" || answerMessage.RunID == nil || *answerMessage.RunID != run.ID {
		t.Fatalf("unexpected resolution=%#v message=%#v", resolved, answerMessage)
	}
	if err := db.First(&task, task.ID).Error; err != nil {
		t.Fatal(err)
	}
	if task.Status != "queued" || task.StatusMessage != "已补充信息，等待恢复执行" {
		t.Fatalf("task = %#v", task)
	}
	var resumed aiAppTaskPayload
	if err := json.Unmarshal([]byte(task.Payload), &resumed); err != nil {
		t.Fatal(err)
	}
	if len(resumed.ClarificationAnswers) != 1 || resumed.ClarificationAnswers[0].Answer != "png" {
		t.Fatalf("clarification answers = %#v", resumed.ClarificationAnswers)
	}
}

func TestPresentAIAppTaskClarificationIncludesResolvedAnswer(t *testing.T) {
	presented := presentAIAppTaskClarification(model.AIAppTaskClarification{
		Status:      "answered",
		Decision:    "answer",
		Answer:      "南京",
		Suggestions: `[{"label":"南京","value":"南京"}]`,
	})
	if presented["answer"] != "南京" {
		t.Fatalf("answer = %#v", presented["answer"])
	}
}

func TestLoadAIAppTaskConversationHistoryIncludesSameRunClarificationAnswers(t *testing.T) {
	_, db := setupAIPlatformTestRouter(t)
	app := model.AIApp{UserID: 101, Type: aiAppTypeAgent, Name: "history agent"}
	if err := db.Create(&app).Error; err != nil {
		t.Fatal(err)
	}
	conversation := model.AIAppConversation{UserID: 101, AppID: app.ID, VersionID: 1}
	if err := db.Create(&conversation).Error; err != nil {
		t.Fatal(err)
	}
	run := model.AIAppRun{UserID: 101, AppID: app.ID, VersionID: 1, ConversationID: &conversation.ID, Status: "running", Input: "我想练英语"}
	if err := db.Create(&run).Error; err != nil {
		t.Fatal(err)
	}
	original := model.AIAppConversationMessage{UserID: 101, AppID: app.ID, ConversationID: conversation.ID, RunID: &run.ID, Role: "user", Content: "我想练英语"}
	if err := db.Create(&original).Error; err != nil {
		t.Fatal(err)
	}
	answer := model.AIAppConversationMessage{UserID: 101, AppID: app.ID, ConversationID: conversation.ID, RunID: &run.ID, Role: "user", Content: "初中水平，想练日常口语"}
	if err := db.Create(&answer).Error; err != nil {
		t.Fatal(err)
	}
	unrelated := model.AIAppConversationMessage{UserID: 101, AppID: app.ID, ConversationID: conversation.ID, Role: "user", Content: "下一条独立消息"}
	if err := db.Create(&unrelated).Error; err != nil {
		t.Fatal(err)
	}
	task := model.AIAppTask{UserID: 101, AppID: app.ID, ConversationID: conversation.ID, RunID: run.ID, UserMessageID: original.ID}

	history, err := loadAIAppTaskConversationHistory(db, task)
	if err != nil {
		t.Fatal(err)
	}
	if len(history) != 2 || history[0].ID != answer.ID || history[1].ID != original.ID {
		t.Fatalf("history = %#v", history)
	}
}

func TestClassifyAIAppToolFailureReturnsSafeRetryMetadata(t *testing.T) {
	code, message, retryable := classifyAIAppToolFailure("image.convert", json.RawMessage(`{"ok":false,"error":"artifact upload failed"}`))
	if code != "ARTIFACT_STORAGE_UNAVAILABLE" || !retryable || message != "工具服务暂不可用，请稍后重试。" {
		t.Fatalf("classification = %q %q %v", code, message, retryable)
	}
	code, _, retryable = classifyAIAppToolFailure("document.convert", json.RawMessage(`{"ok":false,"error":"only PDF to DOCX is supported"}`))
	if code != "TOOL_INPUT_INVALID" || retryable {
		t.Fatalf("input classification = %q retryable=%v", code, retryable)
	}
}

func TestResolveAIAppTaskClarificationStopsOnBlockingDecline(t *testing.T) {
	_, db := setupAIPlatformTestRouter(t)
	app := model.AIApp{UserID: 101, Type: aiAppTypeAgent, Name: "clarification agent"}
	_ = db.Create(&app).Error
	conversation := model.AIAppConversation{UserID: 101, AppID: app.ID, VersionID: 1}
	_ = db.Create(&conversation).Error
	run := model.AIAppRun{UserID: 101, AppID: app.ID, VersionID: 1, ConversationID: &conversation.ID, Status: "running", Input: "转换"}
	_ = db.Create(&run).Error
	message := model.AIAppConversationMessage{UserID: 101, AppID: app.ID, ConversationID: conversation.ID, RunID: &run.ID, Role: "user", Content: "转换"}
	_ = db.Create(&message).Error
	task := model.AIAppTask{UserID: 101, AppID: app.ID, ConversationID: conversation.ID, RunID: run.ID, UserMessageID: message.ID, Title: "转换", Status: "needs_input", Payload: `{"message":"转换"}`}
	_ = db.Create(&task).Error
	request := model.AIAppTaskClarification{TaskID: task.ID, RunID: run.ID, UserID: 101, AppID: app.ID, ConversationID: conversation.ID, RequestID: "request-2", Question: "请选择目标格式", Reason: "必填", AnswerType: "text", Blocking: true, Round: 1, MaxRounds: 1, Status: "pending"}
	_ = db.Create(&request).Error

	resolved, answerMessage, err := resolveAIAppTaskClarification(db, 101, app.ID, task.ID, request.ID, clarificationprotocol.DecisionDecline, "")
	if err != nil {
		t.Fatalf("decline clarification: %v", err)
	}
	if resolved.Status != "declined" || answerMessage.ID == 0 || answerMessage.Role != "assistant" || !strings.Contains(answerMessage.Content, "直接发送") {
		t.Fatalf("resolution=%#v message=%#v", resolved, answerMessage)
	}
	if err := db.First(&task, task.ID).Error; err != nil {
		t.Fatal(err)
	}
	if task.Status != "failed" || task.ErrorCode != "CLARIFICATION_DECLINED" {
		t.Fatalf("task = %#v", task)
	}
}

func TestRetryAIAppTaskCreatesANewRunWithoutDuplicatingTheUserMessage(t *testing.T) {
	_, db := setupAIPlatformTestRouter(t)
	app := model.AIApp{UserID: 101, Type: aiAppTypeAgent, Name: "retry agent"}
	_ = db.Create(&app).Error
	conversation := model.AIAppConversation{UserID: 101, AppID: app.ID, VersionID: 7}
	_ = db.Create(&conversation).Error
	run := model.AIAppRun{UserID: 101, AppID: app.ID, VersionID: 7, ConversationID: &conversation.ID, Status: "succeeded", Input: "转换图片"}
	_ = db.Create(&run).Error
	message := model.AIAppConversationMessage{UserID: 101, AppID: app.ID, ConversationID: conversation.ID, RunID: &run.ID, Role: "user", Content: "转换图片"}
	_ = db.Create(&message).Error
	task := model.AIAppTask{UserID: 101, AppID: app.ID, ConversationID: conversation.ID, RunID: run.ID, UserMessageID: message.ID, Title: "转换图片", Status: "succeeded", Payload: `{"message":"转换图片"}`}
	_ = db.Create(&task).Error
	_ = db.Create(&model.AIAppConversationToolTrace{UserID: 101, AppID: app.ID, ConversationID: conversation.ID, RunID: run.ID, ToolName: "image.convert", Status: "failed", ErrorCode: "ARTIFACT_STORAGE_UNAVAILABLE", ErrorMessage: "工具服务暂不可用，请稍后重试。", Retryable: true}).Error

	retryTask, retryRun, err := retryAIAppTask(db, 101, app.ID, task.ID)
	if err != nil {
		t.Fatalf("retry task: %v", err)
	}
	if retryTask.ID == task.ID || retryTask.RunID != retryRun.ID || retryTask.UserMessageID != message.ID || retryTask.Status != "queued" {
		t.Fatalf("retry task=%#v run=%#v", retryTask, retryRun)
	}
	var messageCount int64
	if err := db.Model(&model.AIAppConversationMessage{}).Where("conversation_id = ? AND role = ?", conversation.ID, "user").Count(&messageCount).Error; err != nil {
		t.Fatal(err)
	}
	if messageCount != 1 {
		t.Fatalf("user message count = %d, want 1", messageCount)
	}
	var retriedMessage model.AIAppConversationMessage
	if err := db.First(&retriedMessage, message.ID).Error; err != nil {
		t.Fatal(err)
	}
	if retriedMessage.RunID == nil || *retriedMessage.RunID != retryRun.ID {
		t.Fatalf("retried message run = %v, want %s", retriedMessage.RunID, retryRun.ID)
	}
}
