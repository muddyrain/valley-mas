package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"valley-server/internal/database"
	"valley-server/internal/model"
	"valley-server/internal/workflow"
)

func TestWorkflowCollaborationPromptDefinesOperationContract(t *testing.T) {
	prompt := workflowCollaborationSystemPrompt()
	contract := workflowCollaborationOperationContract()
	for _, expected := range []string{"node.insert", "afterNodeId", "nodeId", "patch", "capabilityId", "{{sourceTitle}}", "不得直接引用"} {
		if !strings.Contains(prompt+contract, expected) {
			t.Fatalf("workflow collaboration prompt is missing %q", expected)
		}
	}
}

func TestWorkflowCollaborationFailureMessageIsActionable(t *testing.T) {
	message := workflowCollaborationModelFailureMessage(copilotValidationError{err: errors.New("invalid operation")})
	if !strings.Contains(message, "画布没有变化") || !strings.Contains(message, "重试") {
		t.Fatalf("failure message is not actionable: %q", message)
	}
	timeoutMessage := workflowCollaborationModelFailureMessage(context.DeadlineExceeded)
	if !strings.Contains(timeoutMessage, "响应超时") || !strings.Contains(timeoutMessage, "画布没有变化") {
		t.Fatalf("timeout message is not actionable: %q", timeoutMessage)
	}
}

func TestCreateWorkflowCollaborationTaskUsesCanonicalTimeline(t *testing.T) {
	router, definition := setupWorkflowRuntimeTestRouter(t)
	migrateWorkflowCollaborationTestModels(t)
	body := bytes.NewBufferString(`{"message":"把结束节点名称改得更清楚","modelId":"","context":{"selectedNodeId":"end","nodeLabels":{"end":"结束"}}}`)
	request := httptest.NewRequest(http.MethodPost, "/workflows/"+definition.ID.String()+"/collaboration/tasks", body)
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Authorization", workflowRuntimeAuthHeader(t, "101"))
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, request)
	if responseCode(recorder) != 0 || !strings.Contains(recorder.Body.String(), `"status":"queued"`) {
		t.Fatalf("create task: %s", recorder.Body.String())
	}

	getRequest := httptest.NewRequest(http.MethodGet, "/workflows/"+definition.ID.String()+"/collaboration", nil)
	getRequest.Header.Set("Authorization", workflowRuntimeAuthHeader(t, "101"))
	getRecorder := httptest.NewRecorder()
	router.ServeHTTP(getRecorder, getRequest)
	if responseCode(getRecorder) != 0 || !strings.Contains(getRecorder.Body.String(), `"canonical":true`) ||
		!strings.Contains(getRecorder.Body.String(), "把结束节点名称改得更清楚") {
		t.Fatalf("get collaboration: %s", getRecorder.Body.String())
	}
}

func migrateWorkflowCollaborationTestModels(t *testing.T) {
	t.Helper()
	if err := database.DB.AutoMigrate(
		&model.AIWorkbenchCopilotSession{},
		&model.AIWorkbenchCopilotMessage{},
		&model.AIWorkbenchChangeProposal{},
		&model.WorkflowCollaborationTask{},
		&model.WorkflowCollaborationAttachment{},
		&model.WorkflowCollaborationApproval{},
		&model.WorkflowCollaborationChange{},
		&model.AISkill{},
		&model.UserNotification{},
	); err != nil {
		t.Fatal(err)
	}
}

func TestCreateWorkflowCollaborationTaskKeepsOneTurnSkillInPayload(t *testing.T) {
	router, definition := setupWorkflowRuntimeTestRouter(t)
	migrateWorkflowCollaborationTestModels(t)
	skill := model.AISkill{UserID: 101, Name: "流程审查", Content: "优先检查分支完整性。"}
	if err := database.DB.Create(&skill).Error; err != nil {
		t.Fatal(err)
	}
	body := bytes.NewBufferString(`{"message":"检查当前流程","activeSkillId":"` + skill.ID.String() + `"}`)
	request := httptest.NewRequest(http.MethodPost, "/workflows/"+definition.ID.String()+"/collaboration/tasks", body)
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Authorization", workflowRuntimeAuthHeader(t, "101"))
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, request)
	if responseCode(recorder) != 0 {
		t.Fatalf("create task: %s", recorder.Body.String())
	}
	var task model.WorkflowCollaborationTask
	if err := database.DB.Order("created_at DESC").First(&task).Error; err != nil {
		t.Fatal(err)
	}
	var payload workflowCollaborationTaskPayload
	if err := json.Unmarshal([]byte(task.Payload), &payload); err != nil {
		t.Fatal(err)
	}
	if payload.ActiveSkillID != skill.ID.String() {
		t.Fatalf("active skill=%q payload=%s", payload.ActiveSkillID, task.Payload)
	}

	otherSkill := model.AISkill{UserID: 202, Name: "他人技能", Content: "不可访问"}
	if err := database.DB.Create(&otherSkill).Error; err != nil {
		t.Fatal(err)
	}
	badBody := bytes.NewBufferString(`{"message":"检查当前流程","activeSkillId":"` + otherSkill.ID.String() + `"}`)
	badRequest := httptest.NewRequest(http.MethodPost, "/workflows/"+definition.ID.String()+"/collaboration/tasks", badBody)
	badRequest.Header.Set("Content-Type", "application/json")
	badRequest.Header.Set("Authorization", workflowRuntimeAuthHeader(t, "101"))
	badRecorder := httptest.NewRecorder()
	router.ServeHTTP(badRecorder, badRequest)
	if responseCode(badRecorder) != http.StatusBadRequest {
		t.Fatalf("cross-owner skill status=%d body=%s", responseCode(badRecorder), badRecorder.Body.String())
	}
}

func TestWorkflowCollaborationRiskApprovalResumesOnlyOwnedTask(t *testing.T) {
	router, definition := setupWorkflowRuntimeTestRouter(t)
	migrateWorkflowCollaborationTestModels(t)
	body := bytes.NewBufferString(`{"message":"请发布当前工作流"}`)
	request := httptest.NewRequest(http.MethodPost, "/workflows/"+definition.ID.String()+"/collaboration/tasks", body)
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Authorization", workflowRuntimeAuthHeader(t, "101"))
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, request)
	if responseCode(recorder) != 0 {
		t.Fatalf("create task: %s", recorder.Body.String())
	}
	var task model.WorkflowCollaborationTask
	if err := database.DB.Order("created_at DESC").First(&task).Error; err != nil {
		t.Fatal(err)
	}
	if err := executeWorkflowCollaborationTask(context.Background(), database.DB, &task); err != nil {
		t.Fatal(err)
	}
	if err := database.DB.First(&task, task.ID).Error; err != nil {
		t.Fatal(err)
	}
	if task.Status != "waiting_approval" {
		t.Fatalf("task status=%s", task.Status)
	}
	var approval model.WorkflowCollaborationApproval
	if err := database.DB.Where("task_id = ?", task.ID).First(&approval).Error; err != nil {
		t.Fatal(err)
	}
	if approval.Action != "publish" || approval.Status != "pending" || approval.Arguments == "" {
		t.Fatalf("approval=%+v", approval)
	}

	otherRequest := httptest.NewRequest(http.MethodPost, "/workflows/"+definition.ID.String()+"/collaboration/tasks/"+task.ID.String()+"/approvals/"+approval.ID.String()+"/decision", bytes.NewBufferString(`{"decision":"approved"}`))
	otherRequest.Header.Set("Content-Type", "application/json")
	otherRequest.Header.Set("Authorization", workflowRuntimeAuthHeader(t, "202"))
	otherRecorder := httptest.NewRecorder()
	router.ServeHTTP(otherRecorder, otherRequest)
	if responseCode(otherRecorder) != http.StatusNotFound {
		t.Fatalf("cross-owner decision status=%d body=%s", responseCode(otherRecorder), otherRecorder.Body.String())
	}

	decisionRequest := httptest.NewRequest(http.MethodPost, "/workflows/"+definition.ID.String()+"/collaboration/tasks/"+task.ID.String()+"/approvals/"+approval.ID.String()+"/decision", bytes.NewBufferString(`{"decision":"approved"}`))
	decisionRequest.Header.Set("Content-Type", "application/json")
	decisionRequest.Header.Set("Authorization", workflowRuntimeAuthHeader(t, "101"))
	decisionRecorder := httptest.NewRecorder()
	router.ServeHTTP(decisionRecorder, decisionRequest)
	if responseCode(decisionRecorder) != 0 || !strings.Contains(decisionRecorder.Body.String(), `"status":"queued"`) {
		t.Fatalf("approve: %s", decisionRecorder.Body.String())
	}
	repeatedRecorder := httptest.NewRecorder()
	repeatedRequest := httptest.NewRequest(http.MethodPost, "/workflows/"+definition.ID.String()+"/collaboration/tasks/"+task.ID.String()+"/approvals/"+approval.ID.String()+"/decision", bytes.NewBufferString(`{"decision":"rejected"}`))
	repeatedRequest.Header.Set("Content-Type", "application/json")
	repeatedRequest.Header.Set("Authorization", workflowRuntimeAuthHeader(t, "101"))
	router.ServeHTTP(repeatedRecorder, repeatedRequest)
	if responseCode(repeatedRecorder) != http.StatusConflict {
		t.Fatalf("repeated decision: %s", repeatedRecorder.Body.String())
	}
	if strings.Contains(decisionRecorder.Body.String(), `"arguments"`) || strings.Contains(decisionRecorder.Body.String(), `"fingerprint"`) {
		t.Fatalf("approval leaked server-only fields: %s", decisionRecorder.Body.String())
	}
	if err := database.DB.First(&task, task.ID).Error; err != nil {
		t.Fatal(err)
	}
	if err := executeWorkflowCollaborationTask(context.Background(), database.DB, &task); err != nil {
		t.Fatal(err)
	}
	if err := database.DB.First(&task, task.ID).Error; err != nil {
		t.Fatal(err)
	}
	if task.Status != "succeeded" {
		t.Fatalf("approved task status=%s message=%s", task.Status, task.StatusMessage)
	}
	var published model.Workflow
	if err := database.DB.First(&published, definition.ID).Error; err != nil {
		t.Fatal(err)
	}
	if published.Status != "published" {
		t.Fatalf("workflow status=%s", published.Status)
	}
}

func TestWorkflowListIncludesLatestCollaborationStatus(t *testing.T) {
	router, definition := setupWorkflowRuntimeTestRouter(t)
	migrateWorkflowCollaborationTestModels(t)
	session, err := resolveCanonicalWorkflowSession(database.DB, 101, definition.ID)
	if err != nil {
		t.Fatal(err)
	}
	message := model.AIWorkbenchCopilotMessage{SessionID: session.ID, UserID: 101, Role: "user", Kind: "text", Content: "后台修改"}
	if err := database.DB.Create(&message).Error; err != nil {
		t.Fatal(err)
	}
	task := model.WorkflowCollaborationTask{UserID: 101, WorkflowID: definition.ID, SessionID: session.ID, UserMessageID: message.ID, Title: "后台修改", Status: "running", Payload: `{}`, BaseRevision: 1, BaseHash: "hash", IdempotencyKey: "list-status"}
	if err := database.DB.Create(&task).Error; err != nil {
		t.Fatal(err)
	}
	request := httptest.NewRequest(http.MethodGet, "/workflows", nil)
	request.Header.Set("Authorization", workflowRuntimeAuthHeader(t, "101"))
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, request)
	if responseCode(recorder) != 0 || !strings.Contains(recorder.Body.String(), `"collaborationStatus":"running"`) {
		t.Fatalf("list workflows: %s", recorder.Body.String())
	}
}

func TestWorkflowCollaborationApprovedActionsExecute(t *testing.T) {
	_, definition := setupWorkflowRuntimeTestRouter(t)
	migrateWorkflowCollaborationTestModels(t)
	definition.Graph = strings.Replace(definition.Graph, `"required":true`, `"required":false`, 1)
	definition.Graph = strings.Replace(definition.Graph, `{{start.output.title}}`, `测试完成`, 1)
	if err := database.DB.Model(&definition).Update("graph", definition.Graph).Error; err != nil {
		t.Fatal(err)
	}

	runMessage, err := runOwnedWorkflowForCollaboration(database.DB, 101, definition.ID)
	if err != nil || !strings.Contains(runMessage, "已完成") {
		t.Fatalf("run message=%q err=%v", runMessage, err)
	}
	var run model.WorkflowRun
	if err := database.DB.Where("workflow_id = ?", definition.ID).Order("started_at DESC").First(&run).Error; err != nil {
		t.Fatal(err)
	}
	if run.Status != string(workflow.StatusSucceeded) {
		t.Fatalf("run status=%s result=%s", run.Status, run.Result)
	}

	trigger := model.WorkflowTrigger{
		WorkflowID: definition.ID, UserID: 101, Type: "cron", CronExpression: "*/5 * * * *",
		Timezone: "Asia/Shanghai", Status: "disabled",
	}
	if err := database.DB.Create(&trigger).Error; err != nil {
		t.Fatal(err)
	}
	count, err := setOwnedWorkflowTriggersStatus(database.DB, 101, definition.ID, "active")
	if err != nil || count != 1 {
		t.Fatalf("enable triggers count=%d err=%v", count, err)
	}
	if err := database.DB.First(&trigger, trigger.ID).Error; err != nil {
		t.Fatal(err)
	}
	if trigger.Status != "active" || trigger.NextRunAt == nil {
		t.Fatalf("trigger=%+v", trigger)
	}
}

func TestDownloadWorkflowCollaborationAttachmentKeepsOwnerBoundary(t *testing.T) {
	router, definition := setupWorkflowRuntimeTestRouter(t)
	migrateWorkflowCollaborationTestModels(t)
	session, err := resolveCanonicalWorkflowSession(database.DB, 101, definition.ID)
	if err != nil {
		t.Fatal(err)
	}
	attachment := model.WorkflowCollaborationAttachment{
		UserID: 101, WorkflowID: definition.ID, SessionID: session.ID, Name: "notes.txt",
		MimeType: "text/plain", SizeBytes: 5, ParsedText: "hello", SourceContent: []byte("hello"),
	}
	if err := database.DB.Create(&attachment).Error; err != nil {
		t.Fatal(err)
	}
	path := "/workflows/" + definition.ID.String() + "/collaboration/attachments/" + attachment.ID.String()
	request := httptest.NewRequest(http.MethodGet, path, nil)
	request.Header.Set("Authorization", workflowRuntimeAuthHeader(t, "101"))
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, request)
	if recorder.Code != http.StatusOK || recorder.Body.String() != "hello" {
		t.Fatalf("download status=%d body=%q", recorder.Code, recorder.Body.String())
	}

	otherRequest := httptest.NewRequest(http.MethodGet, path, nil)
	otherRequest.Header.Set("Authorization", workflowRuntimeAuthHeader(t, "202"))
	otherRecorder := httptest.NewRecorder()
	router.ServeHTTP(otherRecorder, otherRequest)
	if responseCode(otherRecorder) != http.StatusNotFound {
		t.Fatalf("cross-owner download: %s", otherRecorder.Body.String())
	}
}

func TestWorkflowCollaborationRequestedActionIsExplicit(t *testing.T) {
	tests := map[string]string{
		"请发布当前工作流":      "publish",
		"请试运行一次":        "run",
		"启用这个工作流的触发器":   "triggers.enable",
		"停用触发器":         "triggers.disable",
		"增加一个名为发布结果的节点": "",
		"调整运行节点的名称":     "",
		"如何发布当前工作流":     "",
		"启用触发器有什么风险":    "",
	}
	for message, expected := range tests {
		if actual := workflowCollaborationRequestedAction(message); actual != expected {
			t.Errorf("message=%q action=%q expected=%q", message, actual, expected)
		}
	}
}

func TestResolveCanonicalWorkflowSessionMigratesLatestTimeline(t *testing.T) {
	_, definition := setupWorkflowRuntimeTestRouter(t)
	migrateWorkflowCollaborationTestModels(t)
	older := model.AIWorkbenchCopilotSession{
		UserID: 101, Scope: "workflow", TargetID: definition.ID.String(), Title: "旧会话",
		CreatedAt: time.Now().Add(-time.Hour), UpdatedAt: time.Now().Add(-time.Hour),
	}
	latest := model.AIWorkbenchCopilotSession{
		UserID: 101, Scope: "workflow", TargetID: definition.ID.String(), Title: "最近会话",
		CreatedAt: time.Now(), UpdatedAt: time.Now(),
	}
	if err := database.DB.Create(&older).Error; err != nil {
		t.Fatal(err)
	}
	if err := database.DB.Create(&latest).Error; err != nil {
		t.Fatal(err)
	}

	resolved, err := resolveCanonicalWorkflowSession(database.DB, 101, definition.ID)
	if err != nil {
		t.Fatal(err)
	}
	if resolved.ID != latest.ID || !resolved.Canonical {
		t.Fatalf("resolved=%+v latest=%s", resolved, latest.ID.String())
	}
	var archived model.AIWorkbenchCopilotSession
	if err := database.DB.First(&archived, older.ID).Error; err != nil {
		t.Fatal(err)
	}
	if archived.ArchivedAt == nil || archived.Canonical {
		t.Fatalf("older session was not archived: %+v", archived)
	}
}

func TestArchivedWorkflowCollaborationSessionIsReadableWithoutCandidateDraft(t *testing.T) {
	router, definition := setupWorkflowRuntimeTestRouter(t)
	migrateWorkflowCollaborationTestModels(t)
	now := time.Now()
	archived := model.AIWorkbenchCopilotSession{
		UserID: 101, Scope: "workflow", TargetID: definition.ID.String(), Title: "旧会话", ArchivedAt: &now,
	}
	if err := database.DB.Create(&archived).Error; err != nil {
		t.Fatal(err)
	}
	message := model.AIWorkbenchCopilotMessage{
		SessionID: archived.ID, UserID: 101, Role: "user", Kind: "text", Content: "旧消息内容",
	}
	if err := database.DB.Create(&message).Error; err != nil {
		t.Fatal(err)
	}
	proposal := model.AIWorkbenchChangeProposal{
		SessionID: archived.ID, UserID: 101, TargetType: "workflow", TargetID: definition.ID.String(),
		BaseHash: "base", BaseDraft: `{"secret":"base"}`, Candidate: `{"secret":"candidate"}`,
		CandidateHash: "candidate", Diff: `{}`, Status: "pending",
	}
	if err := database.DB.Create(&proposal).Error; err != nil {
		t.Fatal(err)
	}

	path := "/workflows/" + definition.ID.String() + "/collaboration/archived-sessions/" + archived.ID.String()
	request := httptest.NewRequest(http.MethodGet, path, nil)
	request.Header.Set("Authorization", workflowRuntimeAuthHeader(t, "101"))
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, request)
	if responseCode(recorder) != 0 || !strings.Contains(recorder.Body.String(), "旧消息内容") || !strings.Contains(recorder.Body.String(), "旧版未应用变更") {
		t.Fatalf("archived session response: %s", recorder.Body.String())
	}
	if strings.Contains(recorder.Body.String(), "secret") || strings.Contains(recorder.Body.String(), "candidateDraft") {
		t.Fatalf("legacy candidate leaked: %s", recorder.Body.String())
	}

	otherRequest := httptest.NewRequest(http.MethodGet, path, nil)
	otherRequest.Header.Set("Authorization", workflowRuntimeAuthHeader(t, "202"))
	otherRecorder := httptest.NewRecorder()
	router.ServeHTTP(otherRecorder, otherRequest)
	if responseCode(otherRecorder) != http.StatusNotFound {
		t.Fatalf("cross-owner archived session: %s", otherRecorder.Body.String())
	}
}

func TestApplyAndRevertWorkflowCollaborationChangeAtomically(t *testing.T) {
	_, definition := setupWorkflowRuntimeTestRouter(t)
	migrateWorkflowCollaborationTestModels(t)
	session, err := resolveCanonicalWorkflowSession(database.DB, 101, definition.ID)
	if err != nil {
		t.Fatal(err)
	}
	message := model.AIWorkbenchCopilotMessage{SessionID: session.ID, UserID: 101, Role: "user", Kind: "text", Content: "修改结束节点名称"}
	if err := database.DB.Create(&message).Error; err != nil {
		t.Fatal(err)
	}
	task := model.WorkflowCollaborationTask{
		UserID: 101, WorkflowID: definition.ID, SessionID: session.ID, UserMessageID: message.ID,
		Title: "修改结束节点名称", Status: "running", Payload: `{}`, BaseRevision: definition.Revision,
		BaseHash: workflowGraphHash(definition.Graph), IdempotencyKey: "apply-revert-test",
	}
	if err := database.DB.Create(&task).Error; err != nil {
		t.Fatal(err)
	}
	var base workflow.Graph
	if err := json.Unmarshal([]byte(definition.Graph), &base); err != nil {
		t.Fatal(err)
	}
	operations := []workflow.WorkflowOperation{{
		Type: workflow.OperationNodeUpdate, NodeID: "end", Patch: map[string]any{"label": "AI 结束"},
	}}
	change, conflicts, err := applyWorkflowCollaborationOperations(database.DB, &task, base, operations)
	if err != nil || len(conflicts) != 0 {
		t.Fatalf("apply err=%v conflicts=%+v", err, conflicts)
	}
	var applied model.Workflow
	if err := database.DB.First(&applied, definition.ID).Error; err != nil {
		t.Fatal(err)
	}
	if applied.Revision != 2 || !containsWorkflowNodeLabel(applied.Graph, "end", "AI 结束") {
		t.Fatalf("applied workflow=%+v", applied)
	}

	reverted, conflicts, err := revertWorkflowCollaborationChange(database.DB, 101, definition.ID, change.ID)
	if err != nil || len(conflicts) != 0 {
		t.Fatalf("revert err=%v conflicts=%+v", err, conflicts)
	}
	if reverted.Revision != 3 || !containsWorkflowNodeLabel(reverted.Graph, "end", "结束") {
		t.Fatalf("reverted workflow=%+v", reverted)
	}
	var stored model.WorkflowCollaborationChange
	if err := database.DB.First(&stored, change.ID).Error; err != nil {
		t.Fatal(err)
	}
	if stored.Status != "reverted" || stored.RevertedRevision == nil || *stored.RevertedRevision != 3 {
		t.Fatalf("stored change=%+v", stored)
	}
}

func TestClaimWorkflowCollaborationTaskSerializesOneWorkflow(t *testing.T) {
	_, definition := setupWorkflowRuntimeTestRouter(t)
	migrateWorkflowCollaborationTestModels(t)
	session, err := resolveCanonicalWorkflowSession(database.DB, 101, definition.ID)
	if err != nil {
		t.Fatal(err)
	}
	messages := []model.AIWorkbenchCopilotMessage{
		{SessionID: session.ID, UserID: 101, Role: "user", Kind: "text", Content: "第一项"},
		{SessionID: session.ID, UserID: 101, Role: "user", Kind: "text", Content: "第二项"},
	}
	if err := database.DB.Create(&messages).Error; err != nil {
		t.Fatal(err)
	}
	tasks := []model.WorkflowCollaborationTask{
		{UserID: 101, WorkflowID: definition.ID, SessionID: session.ID, UserMessageID: messages[0].ID, Title: "第一项", Status: "queued", Payload: `{}`, BaseRevision: 1, BaseHash: "one", IdempotencyKey: "serial-one"},
		{UserID: 101, WorkflowID: definition.ID, SessionID: session.ID, UserMessageID: messages[1].ID, Title: "第二项", Status: "queued", Payload: `{}`, BaseRevision: 1, BaseHash: "two", IdempotencyKey: "serial-two"},
	}
	if err := database.DB.Create(&tasks).Error; err != nil {
		t.Fatal(err)
	}
	first, claimed, err := claimWorkflowCollaborationTask(context.Background(), database.DB)
	if err != nil || !claimed || first.ID != tasks[0].ID {
		t.Fatalf("first claim=%+v claimed=%v err=%v", first, claimed, err)
	}
	if second, claimed, err := claimWorkflowCollaborationTask(context.Background(), database.DB); err != nil || claimed {
		t.Fatalf("same workflow claimed concurrently: %+v claimed=%v err=%v", second, claimed, err)
	}
	if err := database.DB.Model(&first).Update("status", "succeeded").Error; err != nil {
		t.Fatal(err)
	}
	second, claimed, err := claimWorkflowCollaborationTask(context.Background(), database.DB)
	if err != nil || !claimed || second.ID != tasks[1].ID {
		t.Fatalf("second claim=%+v claimed=%v err=%v", second, claimed, err)
	}
}

func containsWorkflowNodeLabel(raw, nodeID, label string) bool {
	var graph workflow.Graph
	if json.Unmarshal([]byte(raw), &graph) != nil {
		return false
	}
	for _, node := range graph.Nodes {
		if node.ID == nodeID {
			return node.Label == label
		}
	}
	return false
}
