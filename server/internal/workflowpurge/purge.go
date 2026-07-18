package workflowpurge

import (
	"fmt"
	"sort"

	"valley-server/internal/model"

	"gorm.io/gorm"
)

type Report map[string]int64

func Inspect(db *gorm.DB) (Report, error) {
	if db == nil {
		return nil, fmt.Errorf("database is required")
	}
	workflowIDs, appIDs, versionIDs, runIDs, sessionIDs, err := targetIDs(db)
	if err != nil {
		return nil, err
	}
	report := Report{}
	queries := []struct {
		name   string
		model  any
		clause string
		values []any
	}{
		{"workflows", &model.Workflow{}, "id IN ?", []any{workflowIDs}},
		{"workflow_runs", &model.WorkflowRun{}, "workflow_id IN ?", []any{workflowIDs}},
		{"workflow_node_runs", &model.WorkflowNodeRun{}, "workflow_run_id IN ?", []any{runIDs}},
		{"copilot_sessions", &model.AIWorkbenchCopilotSession{}, "id IN ?", []any{sessionIDs}},
		{"copilot_messages", &model.AIWorkbenchCopilotMessage{}, "session_id IN ?", []any{sessionIDs}},
		{"copilot_proposals", &model.AIWorkbenchChangeProposal{}, "session_id IN ?", []any{sessionIDs}},
		{"ai_apps", &model.AIApp{}, "id IN ?", []any{appIDs}},
		{"ai_app_versions", &model.AIAppVersion{}, "id IN ?", []any{versionIDs}},
		{"ai_app_version_knowledge_bases", &model.AIAppVersionKnowledgeBase{}, "app_version_id IN ?", []any{versionIDs}},
		{"ai_app_version_tool_bindings", &model.AIAppVersionToolBinding{}, "app_version_id IN ?", []any{versionIDs}},
		{"ai_app_knowledge_bases", &model.AIAppKnowledgeBase{}, "app_id IN ?", []any{appIDs}},
		{"ai_app_tool_bindings", &model.AIAppToolBinding{}, "app_id IN ?", []any{appIDs}},
		{"ai_app_runs", &model.AIAppRun{}, "app_id IN ?", []any{appIDs}},
		{"ai_app_conversations", &model.AIAppConversation{}, "app_id IN ?", []any{appIDs}},
		{"ai_app_conversation_messages", &model.AIAppConversationMessage{}, "app_id IN ?", []any{appIDs}},
		{"ai_app_conversation_tool_traces", &model.AIAppConversationToolTrace{}, "app_id IN ?", []any{appIDs}},
		{"ai_api_key_app_bindings", &model.AIAPIKeyAppBinding{}, "app_id IN ?", []any{appIDs}},
		{"ai_app_public_invocations", &model.AIAppPublicInvocation{}, "app_id IN ?", []any{appIDs}},
	}
	for _, query := range queries {
		if lenSlice(query.values[0]) == 0 {
			report[query.name] = 0
			continue
		}
		var count int64
		if err := db.Unscoped().Model(query.model).Where(query.clause, query.values...).Count(&count).Error; err != nil {
			return nil, err
		}
		report[query.name] = count
	}
	return report, nil
}

func Purge(db *gorm.DB) (Report, error) {
	report, err := Inspect(db)
	if err != nil {
		return nil, err
	}
	err = db.Transaction(func(tx *gorm.DB) error {
		workflowIDs, appIDs, versionIDs, runIDs, sessionIDs, err := targetIDs(tx)
		if err != nil {
			return err
		}
		deletions := []struct {
			model  any
			clause string
			value  any
		}{
			{&model.AIWorkbenchChangeProposal{}, "session_id IN ?", sessionIDs}, {&model.AIWorkbenchCopilotMessage{}, "session_id IN ?", sessionIDs}, {&model.AIWorkbenchCopilotSession{}, "id IN ?", sessionIDs},
			{&model.AIAppPublicInvocation{}, "app_id IN ?", appIDs}, {&model.AIAPIKeyAppBinding{}, "app_id IN ?", appIDs}, {&model.AIAppConversationToolTrace{}, "app_id IN ?", appIDs}, {&model.AIAppConversationMessage{}, "app_id IN ?", appIDs}, {&model.AIAppConversation{}, "app_id IN ?", appIDs}, {&model.AIAppRun{}, "app_id IN ?", appIDs},
			{&model.AIAppVersionKnowledgeBase{}, "app_version_id IN ?", versionIDs}, {&model.AIAppVersionToolBinding{}, "app_version_id IN ?", versionIDs}, {&model.AIAppKnowledgeBase{}, "app_id IN ?", appIDs}, {&model.AIAppToolBinding{}, "app_id IN ?", appIDs}, {&model.AIAppVersion{}, "id IN ?", versionIDs}, {&model.AIApp{}, "id IN ?", appIDs},
			{&model.WorkflowNodeRun{}, "workflow_run_id IN ?", runIDs}, {&model.WorkflowRun{}, "workflow_id IN ?", workflowIDs}, {&model.Workflow{}, "id IN ?", workflowIDs},
		}
		for _, deletion := range deletions {
			if lenSlice(deletion.value) == 0 {
				continue
			}
			if err := tx.Unscoped().Where(deletion.clause, deletion.value).Delete(deletion.model).Error; err != nil {
				return err
			}
		}
		return nil
	})
	return report, err
}

func SortedReportKeys(report Report) []string {
	keys := make([]string, 0, len(report))
	for key := range report {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	return keys
}

func targetIDs(db *gorm.DB) (workflowIDs, appIDs, versionIDs, runIDs, sessionIDs []model.Int64String, err error) {
	if err = db.Unscoped().Model(&model.Workflow{}).Pluck("id", &workflowIDs).Error; err != nil {
		return
	}
	if err = db.Unscoped().Model(&model.AIApp{}).Where("type = ? OR workflow_id IS NOT NULL", "workflow").Pluck("id", &appIDs).Error; err != nil {
		return
	}
	if len(appIDs) > 0 {
		if err = db.Unscoped().Model(&model.AIAppVersion{}).Where("app_id IN ?", appIDs).Pluck("id", &versionIDs).Error; err != nil {
			return
		}
	}
	if len(workflowIDs) > 0 {
		if err = db.Unscoped().Model(&model.WorkflowRun{}).Where("workflow_id IN ?", workflowIDs).Pluck("id", &runIDs).Error; err != nil {
			return
		}
	}
	if err = db.Model(&model.AIWorkbenchCopilotSession{}).Where("scope = ?", "workflow").Pluck("id", &sessionIDs).Error; err != nil {
		return
	}
	return
}

func lenSlice(value any) int {
	switch typed := value.(type) {
	case []model.Int64String:
		return len(typed)
	}
	return 0
}
