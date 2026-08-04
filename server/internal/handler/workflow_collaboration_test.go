package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"valley-server/internal/database"
	"valley-server/internal/model"
	"valley-server/internal/workflow"
)

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
	if badRecorder.Code != http.StatusBadRequest {
		t.Fatalf("cross-owner skill status=%d body=%s", badRecorder.Code, badRecorder.Body.String())
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
	if otherRecorder.Code != http.StatusNotFound {
		t.Fatalf("cross-owner decision status=%d body=%s", otherRecorder.Code, otherRecorder.Body.String())
	}

	decisionRequest := httptest.NewRequest(http.MethodPost, "/workflows/"+definition.ID.String()+"/collaboration/tasks/"+task.ID.String()+"/approvals/"+approval.ID.String()+"/decision", bytes.NewBufferString(`{"decision":"approved"}`))
	decisionRequest.Header.Set("Content-Type", "application/json")
	decisionRequest.Header.Set("Authorization", workflowRuntimeAuthHeader(t, "101"))
	decisionRecorder := httptest.NewRecorder()
	router.ServeHTTP(decisionRecorder, decisionRequest)
	if responseCode(decisionRecorder) != 0 || !strings.Contains(decisionRecorder.Body.String(), `"status":"queued"`) {
		t.Fatalf("approve: %s", decisionRecorder.Body.String())
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
