package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"
	"time"

	"valley-server/internal/ai/agent"
	"valley-server/internal/model"
	"valley-server/internal/workflow"
)

func TestCopilotPlanningPublishesActivityAndStopsAtDeadline(t *testing.T) {
	var activities []string
	err := runCopilotPlanningWithActivity(
		context.Background(),
		30*time.Millisecond,
		5*time.Millisecond,
		func(label string) { activities = append(activities, label) },
		func(ctx context.Context) error {
			<-ctx.Done()
			return ctx.Err()
		},
	)
	if !errors.Is(err, context.DeadlineExceeded) {
		t.Fatalf("expected planning deadline, got %v", err)
	}
	if len(activities) == 0 {
		t.Fatal("expected at least one activity update while planning")
	}
}

func TestCopilotStructuredResultDoesNotRepairAgentFailure(t *testing.T) {
	upstreamErr := errors.New("upstream timeout")
	repairCalls := 0
	err := completeCopilotStructuredResult(
		context.Background(),
		agent.Result{},
		upstreamErr,
		&struct{}{},
		nil,
		func(context.Context, string, error) (agent.Result, error) {
			repairCalls++
			return agent.Result{}, nil
		},
	)
	if !errors.Is(err, upstreamErr) {
		t.Fatalf("expected original agent failure, got %v", err)
	}
	if repairCalls != 0 {
		t.Fatalf("agent failure must not trigger structured repair, calls=%d", repairCalls)
	}
}

func TestCopilotStructuredResultRepairsInvalidOutputOnce(t *testing.T) {
	target := struct {
		Value string `json:"value"`
	}{}
	repairCalls := 0
	err := completeCopilotStructuredResult(
		context.Background(),
		agent.Result{Reply: "not-json"},
		nil,
		&target,
		nil,
		func(_ context.Context, _ string, outputErr error) (agent.Result, error) {
			if outputErr == nil {
				t.Fatal("repair must receive the structured output error")
			}
			repairCalls++
			return agent.Result{Reply: `{"value":"repaired"}`}, nil
		},
	)
	if err != nil {
		t.Fatalf("repair invalid output: %v", err)
	}
	if repairCalls != 1 || target.Value != "repaired" {
		t.Fatalf("unexpected repair result calls=%d value=%q", repairCalls, target.Value)
	}
}

func TestCopilotSessionAndMessagesAreOwnerIsolated(t *testing.T) {
	router, db := setupAIPlatformTestRouter(t)
	ownerSession, err := resolveCopilotSession(101, "workbench", "")
	if err != nil {
		t.Fatalf("resolve owner session: %v", err)
	}
	otherSession, err := resolveCopilotSession(202, "workbench", "")
	if err != nil {
		t.Fatalf("resolve other session: %v", err)
	}
	if ownerSession.ID == otherSession.ID {
		t.Fatal("different owners resolved to the same copilot session")
	}
	if err := db.Create(&model.AIWorkbenchCopilotMessage{SessionID: otherSession.ID, UserID: 202, Role: "user", Kind: "text", Content: "private-other-message"}).Error; err != nil {
		t.Fatalf("create other message: %v", err)
	}
	req := httptest.NewRequest(http.MethodGet, "/ai/workbench/copilot/session?scope=workbench", nil)
	req.Header.Set("Authorization", aiPlatformAuthHeader(t))
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)
	if recorder.Code != http.StatusOK || bytes.Contains(recorder.Body.Bytes(), []byte("private-other-message")) {
		t.Fatalf("owner session response status=%d body=%s", recorder.Code, recorder.Body.String())
	}
}

func TestCopilotSessionsCanBeListedAndSelectedByOwner(t *testing.T) {
	router, db := setupAIPlatformTestRouter(t)
	first, err := resolveCopilotSession(101, "workbench", "")
	if err != nil {
		t.Fatalf("resolve first session: %v", err)
	}
	first.Title = "第一段对话"
	first.UpdatedAt = time.Now().Add(-time.Hour)
	if err := db.Save(&first).Error; err != nil {
		t.Fatalf("save first session: %v", err)
	}
	second := model.AIWorkbenchCopilotSession{UserID: 101, Scope: "workbench", TargetID: "", Title: "第二段对话"}
	if err := db.Create(&second).Error; err != nil {
		t.Fatalf("create second session: %v", err)
	}
	other := model.AIWorkbenchCopilotSession{UserID: 202, Scope: "workbench", TargetID: "", Title: "其他用户私有会话"}
	if err := db.Create(&other).Error; err != nil {
		t.Fatalf("create other session: %v", err)
	}
	if err := db.Create(&model.AIWorkbenchCopilotMessage{SessionID: first.ID, UserID: 101, Role: "user", Kind: "text", Content: "第一段消息"}).Error; err != nil {
		t.Fatalf("create first message: %v", err)
	}

	request := func(path string) *httptest.ResponseRecorder {
		req := httptest.NewRequest(http.MethodGet, path, nil)
		req.Header.Set("Authorization", aiPlatformAuthHeader(t))
		recorder := httptest.NewRecorder()
		router.ServeHTTP(recorder, req)
		return recorder
	}
	list := request("/ai/workbench/copilot/sessions?scope=workbench")
	if list.Code != http.StatusOK || !bytes.Contains(list.Body.Bytes(), []byte("第一段对话")) || !bytes.Contains(list.Body.Bytes(), []byte("第二段对话")) || bytes.Contains(list.Body.Bytes(), []byte("其他用户私有会话")) {
		t.Fatalf("session list status=%d body=%s", list.Code, list.Body.String())
	}
	selected := request("/ai/workbench/copilot/session?scope=workbench&sessionId=" + first.ID.String())
	if selected.Code != http.StatusOK || !bytes.Contains(selected.Body.Bytes(), []byte("第一段消息")) {
		t.Fatalf("selected session status=%d body=%s", selected.Code, selected.Body.String())
	}
}

func TestCopilotProposalCanOnlyBeResolvedOnceByOwner(t *testing.T) {
	router, db := setupAIPlatformTestRouter(t)
	session, err := resolveCopilotSession(101, "workbench", "")
	if err != nil {
		t.Fatalf("resolve session: %v", err)
	}
	proposal := model.AIWorkbenchChangeProposal{SessionID: session.ID, UserID: 101, TargetType: "workflow", BaseHash: "base", Candidate: `{}`, Diff: `{}`, Status: "pending"}
	if err := db.Create(&proposal).Error; err != nil {
		t.Fatalf("create proposal: %v", err)
	}
	path := "/ai/workbench/copilot/proposals/" + strconv.FormatInt(int64(proposal.ID), 10)
	request := func(auth string) *httptest.ResponseRecorder {
		body, _ := json.Marshal(map[string]string{"status": "accepted"})
		req := httptest.NewRequest(http.MethodPatch, path, bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", auth)
		recorder := httptest.NewRecorder()
		router.ServeHTTP(recorder, req)
		return recorder
	}
	if response := request(aiPlatformAuthHeaderFor(t, "202", "other-user")); responseCode(response) != http.StatusConflict {
		t.Fatalf("foreign resolve status=%d body=%s", response.Code, response.Body.String())
	}
	if response := request(aiPlatformAuthHeader(t)); responseCode(response) != 0 {
		t.Fatalf("owner resolve status=%d body=%s", response.Code, response.Body.String())
	}
	if response := request(aiPlatformAuthHeader(t)); responseCode(response) != http.StatusConflict {
		t.Fatalf("second resolve status=%d body=%s", response.Code, response.Body.String())
	}
}

func TestAcceptedCopilotProposalRevertRequiresCandidateHash(t *testing.T) {
	router, db := setupAIPlatformTestRouter(t)
	session, err := resolveCopilotSession(101, "workbench", "")
	if err != nil {
		t.Fatalf("resolve session: %v", err)
	}
	proposal := model.AIWorkbenchChangeProposal{
		SessionID: session.ID, UserID: 101, TargetType: "workflow", BaseHash: "base",
		BaseDraft: `{"name":"before"}`, Candidate: `{"name":"after"}`, CandidateHash: "candidate-hash", Diff: `{}`, Status: "accepted",
	}
	if err := db.Create(&proposal).Error; err != nil {
		t.Fatalf("create proposal: %v", err)
	}
	path := "/ai/workbench/copilot/proposals/" + proposal.ID.String()
	request := func(currentHash string) *httptest.ResponseRecorder {
		body, _ := json.Marshal(map[string]string{"status": "reverted", "currentHash": currentHash})
		req := httptest.NewRequest(http.MethodPatch, path, bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", aiPlatformAuthHeader(t))
		recorder := httptest.NewRecorder()
		router.ServeHTTP(recorder, req)
		return recorder
	}
	if response := request("stale-hash"); responseCode(response) != http.StatusConflict {
		t.Fatalf("stale revert status=%d body=%s", response.Code, response.Body.String())
	}
	if response := request("candidate-hash"); responseCode(response) != 0 {
		t.Fatalf("valid revert status=%d body=%s", response.Code, response.Body.String())
	}
	if err := db.First(&proposal, proposal.ID).Error; err != nil || proposal.Status != "reverted" {
		t.Fatalf("proposal after revert status=%s err=%v", proposal.Status, err)
	}
}

func TestCopilotNamedNodeTakesPriorityOverSelectedNodeForCoverInsertion(t *testing.T) {
	base := map[string]any{
		"name": "博客导入工作流",
		"graph": workflow.Graph{
			SchemaVersion: 4,
			Nodes: []workflow.Node{
				{ID: "start", Type: workflow.NodeTypeStart},
				{ID: "summary", Type: workflow.NodeTypeLLM},
				{ID: "create-draft", Type: workflow.NodeTypeTool, Config: json.RawMessage(`{"capabilityId":"blog.createDraft","inputs":{}}`)},
				{ID: "end", Type: workflow.NodeTypeEnd},
			},
			Edges: []workflow.Edge{{Source: "start", Target: "summary"}, {Source: "summary", Target: "create-draft"}, {Source: "create-draft", Target: "end"}},
		},
	}
	payload := copilotMessageRequest{
		Message: "在生成摘要节点后增加封面节点",
		Context: copilotContextPayload{
			SelectedNodeID: "create-draft",
			NodeLabels:     map[string]string{"summary": "生成摘要", "create-draft": "创建博客草稿"},
		},
	}
	candidate := &aiWorkflowDraft{Graph: workflow.Graph{
		SchemaVersion: 4,
		Nodes: []workflow.Node{
			{ID: "start", Type: workflow.NodeTypeStart},
			{ID: "summary", Type: workflow.NodeTypeLLM},
			{ID: "cover", Type: workflow.NodeTypeTool, Config: json.RawMessage(`{"capabilityId":"image.generateCover","inputs":{}}`)},
			{ID: "create-draft", Type: workflow.NodeTypeTool, Config: json.RawMessage(`{"capabilityId":"blog.createDraft","inputs":{}}`)},
			{ID: "end", Type: workflow.NodeTypeEnd},
		},
		Edges: []workflow.Edge{{Source: "start", Target: "summary"}, {Source: "summary", Target: "cover"}, {Source: "cover", Target: "create-draft"}, {Source: "create-draft", Target: "end"}},
	}}
	if err := validateCopilotWorkflowEditIntent(payload, base, candidate); err != nil {
		t.Fatalf("named insertion should pass: %v", err)
	}
	candidate.Graph.Edges = []workflow.Edge{{Source: "start", Target: "summary"}, {Source: "summary", Target: "create-draft"}, {Source: "create-draft", Target: "cover"}, {Source: "cover", Target: "end"}}
	if err := validateCopilotWorkflowEditIntent(payload, base, candidate); err == nil {
		t.Fatal("selected-node insertion must not override explicitly named summary node")
	}
}

func TestPlanDeterministicCoverOperationsOnlyInsertsCoverNode(t *testing.T) {
	base := aiWorkflowDraft{Name: "博客导入", Description: "test", Graph: workflow.Graph{SchemaVersion: 4, Nodes: []workflow.Node{
		{ID: "start", Type: workflow.NodeTypeStart, Label: "开始", Config: json.RawMessage(`{"inputs":{"title":{"type":"string","required":true}}}`)},
		{ID: "summary", Type: workflow.NodeTypeLLM, Label: "生成摘要", Config: json.RawMessage(`{"systemPrompt":"summarize","prompt":"article"}`)},
		{ID: "draft", Type: workflow.NodeTypeTool, Label: "创建草稿", Config: json.RawMessage(`{"capabilityId":"blog.createDraft","inputs":{"title":"{{start.output.title}}","content":"body","tags":[],"tagMode":"manual_only","visibility":"private"}}`)},
		{ID: "end", Type: workflow.NodeTypeEnd, Label: "结束", Config: json.RawMessage(`{"outputs":{"postId":"{{draft.output.postId}}"}}`)},
	}, Edges: []workflow.Edge{{Source: "start", Target: "summary"}, {Source: "summary", Target: "draft"}, {Source: "draft", Target: "end"}}}}
	payload := copilotMessageRequest{Message: "在生成摘要节点后加一个自动生成封面的节点", Context: copilotContextPayload{SelectedNodeID: "draft", NodeLabels: map[string]string{"summary": "生成摘要", "draft": "创建草稿"}}}
	envelope, handled := planDeterministicWorkflowOperations(payload, base)
	if !handled || envelope.Mode != "proposal" || len(envelope.Operations) != 1 {
		t.Fatalf("envelope=%+v", envelope)
	}
	candidate, err := workflow.ApplyOperations(base.Graph, envelope.Operations, workflowRuntimeRegistry())
	if err != nil {
		t.Fatal(err)
	}
	if len(candidate.Nodes) != len(base.Graph.Nodes)+1 {
		t.Fatalf("nodes=%d", len(candidate.Nodes))
	}
	for _, node := range candidate.Nodes {
		if node.ID == "draft" && string(node.Config) != string(base.Graph.Nodes[2].Config) {
			t.Fatal("unrelated draft node changed")
		}
		if node.Type == workflow.NodeTypeCondition {
			t.Fatal("cover operation must not add condition")
		}
		if node.Type == workflow.NodeTypeTool {
			var config struct {
				CapabilityID string `json:"capabilityId"`
			}
			_ = json.Unmarshal(node.Config, &config)
			if config.CapabilityID == workflow.CapabilityGenerateCover && node.When != nil {
				t.Fatalf("cover when=%+v", node.When)
			}
		}
	}
}

func TestCanonicalJSONHashMatchesWebVector(t *testing.T) {
	value := map[string]any{"中文": "<a&b>", "alpha": map[string]any{"z": 1, "a": true}}
	const expected = "979b21ae3d080ec90e1712cbd52d138e6b5f6845504551845425e46e13763024"
	if actual := canonicalJSONHash(value); actual != expected {
		t.Fatalf("hash=%s want=%s", actual, expected)
	}
}

func responseCode(response *httptest.ResponseRecorder) int {
	var payload struct {
		Code int `json:"code"`
	}
	_ = json.Unmarshal(response.Body.Bytes(), &payload)
	return payload.Code
}
