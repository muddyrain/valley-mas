package handler

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"valley-server/internal/workflow"
)

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
		SchemaVersion: 4,
		Nodes: []workflow.Node{
			{ID: "start", Type: workflow.NodeTypeStart, Config: json.RawMessage(`{"inputs":{}}`)},
			{ID: "unsafe", Type: workflow.NodeType("sql"), Config: json.RawMessage(`{"query":"select 1"}`)},
			{ID: "end", Type: workflow.NodeTypeEnd, Config: json.RawMessage(`{"outputs":{}}`)},
		},
	}}
	if err := validateAIWorkflowDraft(&draft); err == nil || !strings.Contains(err.Error(), "未开放") {
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

func TestPromptAssistantSuggestionUsesDefaultModelWhenNoneIsProvided(t *testing.T) {
	router, _ := setupAIPlatformTestRouter(t)
	request := httptest.NewRequest(http.MethodPost, "/ai/prompt-assistant/suggestions", strings.NewReader(`{"target":"workflow_llm","mode":"auto","currentPrompt":"提取文章要点"}`))
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Authorization", aiPlatformAuthHeader(t))
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)
	var payload Response
	if err := json.Unmarshal(response.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode response: %v; body = %s", err, response.Body.String())
	}
	if payload.Code != http.StatusServiceUnavailable {
		t.Fatalf("prompt assistant code = %d, want 503; response = %s", payload.Code, response.Body.String())
	}
}

func TestPromptAssistantAllowsEmptySystemPrompt(t *testing.T) {
	router, _ := setupAIPlatformTestRouter(t)
	request := httptest.NewRequest(
		http.MethodPost,
		"/ai/prompt-assistant/suggestions",
		strings.NewReader(`{"target":"workflow_llm","field":"system_prompt","mode":"auto","currentPrompt":""}`),
	)
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Authorization", aiPlatformAuthHeader(t))
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)
	var payload Response
	if err := json.Unmarshal(response.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode response: %v; body = %s", err, response.Body.String())
	}
	if payload.Code != http.StatusServiceUnavailable {
		t.Fatalf("empty system prompt should reach default model selection, code = %d, response = %s", payload.Code, response.Body.String())
	}
}

func TestPromptAssistantQuickPolicyUsesFieldBudgetWithoutRepair(t *testing.T) {
	tests := []struct {
		field     string
		maxTokens int
		timeout   time.Duration
	}{
		{field: promptFieldDescription, maxTokens: 256, timeout: quickPromptAssistantTimeout},
		{field: promptFieldOpening, maxTokens: 320, timeout: quickPromptAssistantTimeout},
		{field: promptFieldQuestions, maxTokens: 400, timeout: quickPromptAssistantTimeout},
		{field: promptFieldSystem, maxTokens: 512, timeout: quickSystemPromptAssistantTimeout},
	}
	for _, test := range tests {
		policy := promptAssistantPolicy(test.field, true)
		if policy.Timeout != test.timeout || policy.MaxTokens != test.maxTokens || policy.AllowRepair {
			t.Fatalf("quick policy for %s = %+v", test.field, policy)
		}
	}
	standard := promptAssistantPolicy(promptFieldDescription, false)
	if standard.Timeout != 75*time.Second || standard.MaxTokens != 4096 || !standard.AllowRepair {
		t.Fatalf("standard policy = %+v", standard)
	}
}

func TestSplitQuickAssistantQuestionsNormalizesNumberedLines(t *testing.T) {
	questions := splitQuickAssistantQuestions("1. 帮我制定学习计划\n2、解释这个概念\n- 帮我复盘今天的任务\n• 给我下一步建议")
	if len(questions) != 4 || questions[0] != "帮我制定学习计划" || questions[3] != "给我下一步建议" {
		t.Fatalf("questions = %#v", questions)
	}
}

func TestPromptAssistantImagePromptRequiresCurrentContent(t *testing.T) {
	router, _ := setupAIPlatformTestRouter(t)
	request := httptest.NewRequest(
		http.MethodPost,
		"/ai/prompt-assistant/suggestions",
		strings.NewReader(
			`{"target":"image_studio","field":"image_prompt","mode":"auto","modelId":"1","currentPrompt":""}`,
		),
	)
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Authorization", aiPlatformAuthHeader(t))
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)
	var payload Response
	if err := json.Unmarshal(response.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode response: %v; body = %s", err, response.Body.String())
	}
	if payload.Code != http.StatusBadRequest {
		t.Fatalf("image prompt code = %d, want 400; response = %s", payload.Code, response.Body.String())
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
		return validatePromptSuggestion(&suggestion, "原提示词", "workflow_llm", nil, false, promptFieldSystem)
	})
	if err != nil {
		t.Fatalf("runStructuredWorkbenchAI() error = %v", err)
	}
	if calls != 2 || suggestion.OptimizedPrompt != "清晰回答问题" {
		t.Fatalf("calls = %d, suggestion = %#v", calls, suggestion)
	}
}

func TestValidatePromptSuggestionSupportsGeneratedFields(t *testing.T) {
	description := promptAssistantSuggestion{Description: "帮助用户练习真实英语对话。", Summary: []string{"突出练习场景"}}
	if err := validatePromptSuggestion(&description, "", "workflow_llm", nil, false, promptFieldDescription); err != nil {
		t.Fatalf("validate description error = %v", err)
	}
	opening := promptAssistantSuggestion{OpeningMessage: "你好，我们从一段日常英语对话开始吧。", Summary: []string{"增加行动引导"}}
	if err := validatePromptSuggestion(&opening, "", "workflow_llm", nil, false, promptFieldOpening); err != nil {
		t.Fatalf("validate opening message error = %v", err)
	}
	questions := promptAssistantSuggestion{ExampleQuestions: []string{"模拟一次咖啡店点单", "纠正我的英语发音表达"}, Summary: []string{"覆盖常用练习"}}
	if err := validatePromptSuggestion(&questions, "", "workflow_llm", nil, false, promptFieldQuestions); err != nil {
		t.Fatalf("validate example questions error = %v", err)
	}
}

func TestValidatePromptSuggestionSupportsImagePrompt(t *testing.T) {
	suggestion := promptAssistantSuggestion{
		OptimizedPrompt: "一株清晨的小草，叶片带着露珠，低机位微距摄影，柔和逆光。",
		Summary:         []string{"补充构图与光线"},
	}
	if err := validatePromptSuggestion(
		&suggestion,
		"小草",
		"image_studio",
		nil,
		false,
		promptFieldImage,
	); err != nil {
		t.Fatalf("validate image prompt error = %v", err)
	}
}

func TestStructuredRepairRequestIncludesOriginalContract(t *testing.T) {
	_, repairUser := buildStructuredRepairRequest("只输出字段 optimizedPrompt 和 summary", "优化当前内容", "{", errors.New("JSON 截断"))
	if !strings.Contains(repairUser, "optimizedPrompt") || !strings.Contains(repairUser, "JSON 截断") {
		t.Fatalf("repair request did not preserve contract: %s", repairUser)
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
