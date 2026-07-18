package workflowpurge

import (
	"testing"

	"valley-server/internal/model"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func openPurgeTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	models := []any{&model.Workflow{}, &model.WorkflowRun{}, &model.WorkflowNodeRun{}, &model.AIApp{}, &model.AIAppVersion{}, &model.AIAppVersionKnowledgeBase{}, &model.AIAppVersionToolBinding{}, &model.AIAppKnowledgeBase{}, &model.AIAppToolBinding{}, &model.AIAppRun{}, &model.AIAppConversation{}, &model.AIAppConversationMessage{}, &model.AIAppConversationToolTrace{}, &model.AIAPIKey{}, &model.AIAPIKeyAppBinding{}, &model.AIAppPublicInvocation{}, &model.AIWorkbenchCopilotSession{}, &model.AIWorkbenchCopilotMessage{}, &model.AIWorkbenchChangeProposal{}, &model.AIKnowledgeBase{}}
	if err := db.AutoMigrate(models...); err != nil {
		t.Fatal(err)
	}
	return db
}

func TestPurgeRemovesWorkflowDataAndPreservesAgentKnowledgeAndKey(t *testing.T) {
	db := openPurgeTestDB(t)
	workflowID := model.Int64String(1)
	workflowAppID := model.Int64String(2)
	agentAppID := model.Int64String(3)
	versionID := model.Int64String(4)
	runID := model.Int64String(5)
	sessionID := model.Int64String(6)
	keyID := model.Int64String(7)
	knowledgeID := model.Int64String(8)
	seed := []any{
		&model.Workflow{ID: workflowID, UserID: 10, Name: "legacy", Graph: `{}`},
		&model.WorkflowRun{ID: runID, WorkflowID: workflowID, UserID: 10, Status: "success", GraphSnapshot: `{}`},
		&model.WorkflowNodeRun{ID: 9, WorkflowRunID: runID, NodeID: "start", NodeType: "start", Status: "success"},
		&model.AIApp{ID: workflowAppID, UserID: 10, Type: "workflow", WorkflowID: &workflowID, Name: "legacy"},
		&model.AIApp{ID: agentAppID, UserID: 10, Type: "agent", Name: "agent"},
		&model.AIAppVersion{ID: versionID, AppID: workflowAppID, Number: 1, Config: `{}`},
		&model.AIAppVersionKnowledgeBase{ID: 12, AppVersionID: versionID, KnowledgeBaseID: knowledgeID},
		&model.AIAppVersionToolBinding{ID: 13, AppVersionID: versionID, ToolName: "content.search"},
		&model.AIAppKnowledgeBase{ID: 14, AppID: workflowAppID, KnowledgeBaseID: knowledgeID},
		&model.AIAppToolBinding{ID: 15, AppID: workflowAppID, ToolName: "content.search"},
		&model.AIAppRun{ID: 16, AppID: workflowAppID, VersionID: versionID, UserID: 10, Status: "success", Input: `{}`},
		&model.AIAppConversation{ID: 17, UserID: 10, AppID: workflowAppID, VersionID: versionID},
		&model.AIAppConversationMessage{ID: 18, UserID: 10, AppID: workflowAppID, ConversationID: 17, Role: "user", Content: "hello"},
		&model.AIAppConversationToolTrace{ID: 19, UserID: 10, AppID: workflowAppID, ConversationID: 17, RunID: 16, ToolName: "content.search", Status: "success"},
		&model.AIAPIKey{ID: keyID, UserID: 10, Name: "key", KeyPrefix: "valley", KeyHash: "hash"},
		&model.AIAPIKeyAppBinding{ID: 10, APIKeyID: keyID, AppID: workflowAppID},
		&model.AIAppPublicInvocation{ID: 20, UserID: 10, AppID: workflowAppID, VersionID: versionID, APIKeyID: keyID, Status: "success"},
		&model.AIKnowledgeBase{ID: knowledgeID, UserID: 10, Name: "knowledge"},
		&model.AIWorkbenchCopilotSession{ID: sessionID, UserID: 10, Scope: "workflow", TargetID: workflowID.String()},
		&model.AIWorkbenchCopilotMessage{ID: 11, SessionID: sessionID, UserID: 10, Role: "user", Kind: "text", Content: "hello"},
		&model.AIWorkbenchChangeProposal{ID: 21, SessionID: sessionID, UserID: 10, TargetType: "workflow", TargetID: workflowID.String(), BaseHash: "base", Candidate: `{}`},
	}
	for _, value := range seed {
		if err := db.Create(value).Error; err != nil {
			t.Fatal(err)
		}
	}
	report, err := Inspect(db)
	if err != nil {
		t.Fatal(err)
	}
	if report["workflows"] != 1 || report["ai_apps"] != 1 {
		t.Fatalf("report=%v", report)
	}
	if _, err := Purge(db); err != nil {
		t.Fatal(err)
	}
	for _, check := range []struct {
		model any
		want  int64
	}{
		{&model.Workflow{}, 0}, {&model.WorkflowRun{}, 0}, {&model.WorkflowNodeRun{}, 0},
		{&model.AIWorkbenchCopilotSession{}, 0}, {&model.AIWorkbenchCopilotMessage{}, 0}, {&model.AIWorkbenchChangeProposal{}, 0},
		{&model.AIAppVersion{}, 0}, {&model.AIAppVersionKnowledgeBase{}, 0}, {&model.AIAppVersionToolBinding{}, 0},
		{&model.AIAppKnowledgeBase{}, 0}, {&model.AIAppToolBinding{}, 0}, {&model.AIAppRun{}, 0},
		{&model.AIAppConversation{}, 0}, {&model.AIAppConversationMessage{}, 0}, {&model.AIAppConversationToolTrace{}, 0},
		{&model.AIAPIKeyAppBinding{}, 0}, {&model.AIAppPublicInvocation{}, 0},
		{&model.AIApp{}, 1}, {&model.AIAPIKey{}, 1}, {&model.AIKnowledgeBase{}, 1},
	} {
		var count int64
		if err := db.Unscoped().Model(check.model).Count(&count).Error; err != nil || count != check.want {
			t.Fatalf("model %T count=%d want=%d err=%v", check.model, count, check.want, err)
		}
	}
}

func TestPurgeRollsBackAllDeletesWhenOneTableFails(t *testing.T) {
	db := openPurgeTestDB(t)
	workflowID := model.Int64String(101)
	runID := model.Int64String(102)
	for _, value := range []any{
		&model.Workflow{ID: workflowID, UserID: 10, Name: "legacy", Graph: `{}`},
		&model.WorkflowRun{ID: runID, WorkflowID: workflowID, UserID: 10, Status: "success", GraphSnapshot: `{}`},
		&model.WorkflowNodeRun{ID: 103, WorkflowRunID: runID, NodeID: "start", NodeType: "start", Status: "success"},
	} {
		if err := db.Create(value).Error; err != nil {
			t.Fatal(err)
		}
	}
	if err := db.Exec(`CREATE TRIGGER fail_workflow_delete BEFORE DELETE ON workflows BEGIN SELECT RAISE(ABORT, 'forced rollback'); END;`).Error; err != nil {
		t.Fatal(err)
	}
	if _, err := Purge(db); err == nil {
		t.Fatal("expected purge to fail")
	}
	for _, item := range []any{&model.Workflow{}, &model.WorkflowRun{}, &model.WorkflowNodeRun{}} {
		var count int64
		if err := db.Unscoped().Model(item).Count(&count).Error; err != nil || count != 1 {
			t.Fatalf("model %T count=%d want=1 err=%v", item, count, err)
		}
	}
}
