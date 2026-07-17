package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"valley-server/internal/aiapp"
	"valley-server/internal/model"
	"valley-server/internal/workflow"
)

func TestValidateAgentProposalRestrictsResources(t *testing.T) {
	proposal := agentProposal{
		Name: "资料助手", Description: "回答内部资料问题",
		Config:                   aiapp.Config{ModelProfile: aiapp.ModelProfileARKTextDefault, SystemPrompt: "仅依据授权资料回答。"},
		ToolSuggestions:          []agentToolSuggestion{{Name: "content.search", Reason: "需要检索内容"}},
		KnowledgeBaseSuggestions: []agentKnowledgeSuggestion{{ID: 10, Name: "伪造名称", Reason: "需求相关"}},
	}
	catalog := []model.AIKnowledgeBase{{ID: 10, Name: "产品资料"}}
	if err := validateAgentProposal(&proposal, catalog); err != nil {
		t.Fatalf("validateAgentProposal() error = %v", err)
	}
	if proposal.KnowledgeBaseSuggestions[0].Name != "产品资料" {
		t.Fatalf("knowledge name = %q, want owner catalog name", proposal.KnowledgeBaseSuggestions[0].Name)
	}
	proposal.ToolSuggestions[0].Name = "blog.create_draft"
	if err := validateAgentProposal(&proposal, catalog); err == nil {
		t.Fatal("validateAgentProposal() accepted write tool")
	}
}

func TestValidatePromptSuggestionPreservesWorkflowVariables(t *testing.T) {
	original := "总结 {{parse.output.content}} 并参考 {{start.output.topic}}"
	suggestion := promptAssistantSuggestion{OptimizedPrompt: "请总结 {{parse.output.content}}", Summary: []string{"明确任务"}}
	err := validatePromptSuggestion(&suggestion, original, "workflow_llm", []string{"{{parse.output.content}}", "{{start.output.topic}}"}, false, promptFieldSystem)
	if err == nil || !strings.Contains(err.Error(), "丢失变量") {
		t.Fatalf("validatePromptSuggestion() error = %v, want missing variable", err)
	}
	suggestion.OptimizedPrompt = "请总结 {{parse.output.content}}，主题为 {{start.output.topic}}，并使用 {{unknown.output.text}}"
	err = validatePromptSuggestion(&suggestion, original, "workflow_llm", []string{"{{parse.output.content}}", "{{start.output.topic}}"}, false, promptFieldSystem)
	if err == nil || !strings.Contains(err.Error(), "未知变量") {
		t.Fatalf("validatePromptSuggestion() error = %v, want unknown variable", err)
	}
}

func TestValidateAIWorkflowDraftUsesServerWhitelist(t *testing.T) {
	draft := aiWorkflowDraft{Name: "安全工作流", Description: "变量赋值", Graph: workflow.Graph{
		SchemaVersion: 2,
		Nodes: []workflow.Node{
			{ID: "start", Type: workflow.NodeTypeStart, Config: json.RawMessage(`{"inputs":{}}`)},
			{ID: "unsafe", Type: workflow.NodeTypeHTTP, Config: json.RawMessage(`{"url":"https://example.com"}`)},
			{ID: "end", Type: workflow.NodeTypeEnd, Config: json.RawMessage(`{"outputs":{}}`)},
		},
	}}
	if err := validateAIWorkflowDraft(&draft); err == nil || !strings.Contains(err.Error(), "白名单") {
		t.Fatalf("validateAIWorkflowDraft() error = %v, want whitelist rejection", err)
	}
}

func TestDecodeStructuredWorkbenchOutputRejectsUnknownFields(t *testing.T) {
	var suggestion promptAssistantSuggestion
	err := decodeStructuredWorkbenchOutput(`{"optimizedPrompt":"ok","summary":["x"],"secret":"no"}`, &suggestion)
	if err == nil {
		t.Fatal("decodeStructuredWorkbenchOutput() accepted unknown field")
	}
}

func TestCreateAIAppCommitsInitialSnapshotsAtomically(t *testing.T) {
	router, db := setupAIPlatformTestRouter(t)
	owned := model.AIKnowledgeBase{UserID: 101, Name: "产品资料"}
	foreign := model.AIKnowledgeBase{UserID: 202, Name: "其他用户资料"}
	if err := db.Create(&owned).Error; err != nil {
		t.Fatalf("create owned knowledge base: %v", err)
	}
	if err := db.Create(&foreign).Error; err != nil {
		t.Fatalf("create foreign knowledge base: %v", err)
	}

	invalidBody := []byte(`{"type":"agent","name":"非法绑定","config":{"modelProfile":"ark-text-default"},"knowledgeBaseIds":["` + foreign.ID.String() + `"]}`)
	invalidRequest := httptest.NewRequest(http.MethodPost, "/ai/apps", bytes.NewReader(invalidBody))
	invalidRequest.Header.Set("Content-Type", "application/json")
	invalidRequest.Header.Set("Authorization", aiPlatformAuthHeader(t))
	invalidResponse := httptest.NewRecorder()
	router.ServeHTTP(invalidResponse, invalidRequest)
	var invalidPayload Response
	if err := json.Unmarshal(invalidResponse.Body.Bytes(), &invalidPayload); err != nil {
		t.Fatalf("decode invalid response: %v", err)
	}
	if invalidPayload.Code != http.StatusBadRequest {
		t.Fatalf("invalid create code = %d, want 400", invalidPayload.Code)
	}
	var appCount int64
	if err := db.Model(&model.AIApp{}).Count(&appCount).Error; err != nil || appCount != 0 {
		t.Fatalf("app count after rejected create = %d, err = %v", appCount, err)
	}

	validBody := []byte(`{"type":"agent","name":"资料助手","description":"回答资料问题","config":{"modelProfile":"ark-text-default","systemPrompt":"回答问题","openingMessage":"你好","exampleQuestions":["有什么资料？"]},"toolNames":["content.search"],"knowledgeBaseIds":["` + owned.ID.String() + `"]}`)
	request := httptest.NewRequest(http.MethodPost, "/ai/apps", bytes.NewReader(validBody))
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Authorization", aiPlatformAuthHeader(t))
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)
	var payload struct {
		Code int `json:"code"`
		Data struct {
			App     model.AIApp        `json:"app"`
			Version model.AIAppVersion `json:"version"`
		} `json:"data"`
	}
	if err := json.Unmarshal(response.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode create response: %v", err)
	}
	if payload.Code != 0 || payload.Data.App.ID == 0 || payload.Data.Version.ID == 0 {
		t.Fatalf("create response = %s", response.Body.String())
	}
	var toolBinding model.AIAppVersionToolBinding
	if err := db.Where("app_version_id = ? AND tool_name = ?", payload.Data.Version.ID, "content.search").First(&toolBinding).Error; err != nil {
		t.Fatalf("load initial tool snapshot: %v", err)
	}
	var knowledgeBinding model.AIAppVersionKnowledgeBase
	if err := db.Where("app_version_id = ? AND knowledge_base_id = ?", payload.Data.Version.ID, owned.ID).First(&knowledgeBinding).Error; err != nil {
		t.Fatalf("load initial knowledge snapshot: %v", err)
	}
}

func TestValidateAIAppAvatarContentRejectsFakeImage(t *testing.T) {
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	part, err := writer.CreateFormFile("file", "avatar.png")
	if err != nil {
		t.Fatalf("CreateFormFile() error = %v", err)
	}
	_, _ = part.Write([]byte("not-an-image"))
	_ = writer.Close()
	request := httptest.NewRequest(http.MethodPost, "/avatar", &body)
	request.Header.Set("Content-Type", writer.FormDataContentType())
	if err := request.ParseMultipartForm(1 << 20); err != nil {
		t.Fatalf("ParseMultipartForm() error = %v", err)
	}
	file := request.MultipartForm.File["file"][0]
	if err := validateAIAppAvatarContent(file); err == nil {
		t.Fatal("validateAIAppAvatarContent() accepted fake PNG")
	}
}

func TestAIAppProposalReturns503WhenARKIsMissing(t *testing.T) {
	router, _ := setupAIPlatformTestRouter(t)
	t.Setenv("ARK_API_KEY", "")
	t.Setenv("ARK_TEXT_MODEL", "")
	request := httptest.NewRequest(http.MethodPost, "/ai/app-assistant/proposals", strings.NewReader(`{"description":"创建资料助手"}`))
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Authorization", aiPlatformAuthHeader(t))
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)
	var payload Response
	if err := json.Unmarshal(response.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if payload.Code != http.StatusServiceUnavailable {
		t.Fatalf("proposal code = %d, want 503; response = %s", payload.Code, response.Body.String())
	}
}

func TestRunStructuredWorkbenchAIRepairsInvalidOutputOnce(t *testing.T) {
	_, _ = setupAIPlatformTestRouter(t)
	original := callWorkbenchStructuredAI
	t.Cleanup(func() { callWorkbenchStructuredAI = original })
	calls := 0
	callWorkbenchStructuredAI = func(context.Context, string, string) (structuredAIResult, error) {
		calls++
		if calls == 1 {
			return structuredAIResult{Content: `{"optimizedPrompt":"","summary":[]}`, Model: "test"}, nil
		}
		return structuredAIResult{Content: `{"optimizedPrompt":"清晰回答问题","summary":["补齐目标"]}`, Model: "test"}, nil
	}
	var suggestion promptAssistantSuggestion
	err := runStructuredWorkbenchAI(context.Background(), featurePromptAssistant, 101, "system", "user", &suggestion, func() error {
		return validatePromptSuggestion(&suggestion, "原提示词", "agent", nil, false, promptFieldSystem)
	})
	if err != nil {
		t.Fatalf("runStructuredWorkbenchAI() error = %v", err)
	}
	if calls != 2 || suggestion.OptimizedPrompt != "清晰回答问题" {
		t.Fatalf("calls = %d, suggestion = %#v", calls, suggestion)
	}
}

func TestValidatePromptSuggestionSupportsAgentFields(t *testing.T) {
	description := promptAssistantSuggestion{Description: "帮助用户练习真实英语对话。", Summary: []string{"突出练习场景"}}
	if err := validatePromptSuggestion(&description, "", "agent", nil, false, promptFieldDescription); err != nil {
		t.Fatalf("validate description error = %v", err)
	}
	opening := promptAssistantSuggestion{OpeningMessage: "你好，我们从一段日常英语对话开始吧。", Summary: []string{"增加行动引导"}}
	if err := validatePromptSuggestion(&opening, "", "agent", nil, false, promptFieldOpening); err != nil {
		t.Fatalf("validate opening message error = %v", err)
	}
	questions := promptAssistantSuggestion{ExampleQuestions: []string{"模拟一次咖啡店点单", "纠正我的英语发音表达"}, Summary: []string{"覆盖常用练习"}}
	if err := validatePromptSuggestion(&questions, "", "agent", nil, false, promptFieldQuestions); err != nil {
		t.Fatalf("validate example questions error = %v", err)
	}
}

func TestStructuredRepairRequestIncludesOriginalContract(t *testing.T) {
	_, repairUser := buildStructuredRepairRequest("只输出字段 optimizedPrompt 和 summary", "优化当前内容", "{", errors.New("JSON 截断"))
	if !strings.Contains(repairUser, "optimizedPrompt") || !strings.Contains(repairUser, "JSON 截断") {
		t.Fatalf("repair request did not preserve contract: %s", repairUser)
	}
}

func TestBuildAIAppAvatarPromptRequiresChibiAgentCharacter(t *testing.T) {
	prompt := buildAIAppAvatarPrompt(model.AIApp{Name: "英语训练智能体", Description: "练习日常英语对话"}, "你是一位英语教练")
	for _, expected := range []string{"chibi anime avatar", "robot mascot", "Never create an isolated object"} {
		if !strings.Contains(prompt, expected) {
			t.Fatalf("avatar prompt missing %q: %s", expected, prompt)
		}
	}
}

func TestRunStructuredWorkbenchAIHonorsCancellation(t *testing.T) {
	_, _ = setupAIPlatformTestRouter(t)
	original := callWorkbenchStructuredAI
	t.Cleanup(func() { callWorkbenchStructuredAI = original })
	calls := 0
	callWorkbenchStructuredAI = func(ctx context.Context, _, _ string) (structuredAIResult, error) {
		calls++
		return structuredAIResult{}, ctx.Err()
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	err := runStructuredWorkbenchAI(ctx, featurePromptAssistant, 101, "system", "user", &promptAssistantSuggestion{}, nil)
	if !errors.Is(err, context.Canceled) || calls != 1 {
		t.Fatalf("error = %v, calls = %d", err, calls)
	}
}

func TestReplaceAIAppAvatarUpdatesBeforeDeletingOldObject(t *testing.T) {
	_, db := setupAIPlatformTestRouter(t)
	app := model.AIApp{UserID: 101, Type: aiAppTypeAgent, Name: "头像助手", AvatarURL: "old", AvatarStorageKey: "old-key", AvatarSource: "upload"}
	if err := db.Create(&app).Error; err != nil {
		t.Fatalf("create app: %v", err)
	}
	originalDelete := deleteManagedAIAppAvatar
	t.Cleanup(func() { deleteManagedAIAppAvatar = originalDelete })
	deleted := ""
	deleteManagedAIAppAvatar = func(_ context.Context, key string) error {
		var current model.AIApp
		if err := db.First(&current, "id = ?", app.ID).Error; err != nil {
			return err
		}
		if current.AvatarStorageKey != "new-key" {
			t.Fatalf("old object deleted before database update: %#v", current)
		}
		deleted = key
		return nil
	}
	if err := replaceAIAppAvatar(context.Background(), app, "new", "new-key", "ai"); err != nil {
		t.Fatalf("replaceAIAppAvatar() error = %v", err)
	}
	if deleted != "old-key" {
		t.Fatalf("deleted key = %q, want old-key", deleted)
	}
	if err := replaceAIAppAvatar(context.Background(), model.AIApp{ID: 999, UserID: 202}, "x", "x", "ai"); err == nil {
		t.Fatal("replaceAIAppAvatar() accepted missing owner-scoped app")
	}
}
