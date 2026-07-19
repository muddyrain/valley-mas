package workflow

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"testing"
)

type textGeneratorFunc func(context.Context, TextGenerationRequest) (TextGenerationResult, error)

func (fn textGeneratorFunc) Generate(ctx context.Context, request TextGenerationRequest) (TextGenerationResult, error) {
	return fn(ctx, request)
}

func testRegistry(t *testing.T) *Registry {
	t.Helper()
	registry := DefaultRegistry()
	if err := RegisterWorkflowCapabilities(registry); err != nil {
		t.Fatal(err)
	}
	return registry
}

func node(id string, nodeType NodeType, config string) Node {
	return Node{ID: id, Type: nodeType, Label: id, Config: json.RawMessage(config)}
}

func TestGraphV4RejectsLegacySchemaAndBusinessNode(t *testing.T) {
	registry := testRegistry(t)
	legacy := Graph{SchemaVersion: 3, Nodes: []Node{node("start", NodeTypeStart, `{"inputs":{}}`)}}
	errs := ValidateGraph(legacy, registry)
	if len(errs) != 1 || !strings.Contains(errs[0], "GRAPH_VERSION_UNSUPPORTED") {
		t.Fatalf("unexpected errors: %v", errs)
	}
	graph := Graph{SchemaVersion: 4, Nodes: []Node{node("start", NodeTypeStart, `{"inputs":{}}`), node("legacy", NodeType("blog.createDraft"), `{}`), node("end", NodeTypeEnd, `{"outputs":{}}`)}, Edges: []Edge{{Source: "start", Target: "legacy"}, {Source: "legacy", Target: "end"}}}
	if errs := ValidateGraph(graph, registry); !containsError(errs, "未开放") {
		t.Fatalf("unexpected errors: %v", errs)
	}
}

func TestWorkflowCapabilitiesExposeInputGuidance(t *testing.T) {
	registry := testRegistry(t)
	capability, _, ok := registry.Capability(CapabilityGenerateCover)
	if !ok {
		t.Fatal("generate cover capability is missing")
	}
	properties, ok := capability.InputSchema["properties"].(map[string]any)
	if !ok {
		t.Fatalf("properties=%T", capability.InputSchema["properties"])
	}
	title, ok := properties["title"].(map[string]any)
	if !ok || title["title"] != "封面标题" || title["placeholder"] == "" {
		t.Fatalf("title field=%+v", title)
	}
}

func TestGraphV4MergeUsesFirstActiveBranch(t *testing.T) {
	registry := testRegistry(t)
	graph := Graph{SchemaVersion: 4, Nodes: []Node{
		node("start", NodeTypeStart, `{"inputs":{"enabled":{"type":"boolean","required":true}}}`),
		node("condition", NodeTypeCondition, `{"left":"{{start.output.enabled}}","operator":"equals","right":true}`),
		node("yes", NodeTypeVariable, `{"assignments":[{"name":"value","type":"string","value":"yes"}]}`),
		node("no", NodeTypeVariable, `{"assignments":[{"name":"value","type":"string","value":"no"}]}`),
		node("merge", NodeTypeMerge, `{"fields":[{"name":"value","type":"string","sources":["{{yes.output.value}}","{{no.output.value}}"]}]}`),
		node("end", NodeTypeEnd, `{"outputs":{"value":"{{merge.output.value}}"}}`),
	}, Edges: []Edge{{Source: "start", Target: "condition"}, {Source: "condition", SourceHandle: "true", Target: "yes"}, {Source: "condition", SourceHandle: "false", Target: "no"}, {Source: "yes", Target: "merge"}, {Source: "no", Target: "merge"}, {Source: "merge", Target: "end"}}}
	if errs := ValidateGraph(graph, registry); len(errs) > 0 {
		t.Fatalf("validation errors: %v", errs)
	}
	for _, test := range []struct {
		enabled bool
		want    string
	}{{true, "yes"}, {false, "no"}} {
		var final map[string]any
		err := Execute(context.Background(), graph, registry, RunContext{ID: "run", Inputs: map[string]any{"enabled": test.enabled}}, func(event Event) {
			if event.NodeID == "end" && event.Status == StatusSucceeded {
				final = event.Output
			}
		})
		if err != nil {
			t.Fatal(err)
		}
		if final["value"] != test.want {
			t.Fatalf("enabled=%v output=%v", test.enabled, final)
		}
	}
}

func TestExecuteEmitsCancelledStatusWhenContextIsCancelled(t *testing.T) {
	registry := testRegistry(t)
	graph := Graph{
		SchemaVersion: 4,
		Nodes: []Node{
			node("start", NodeTypeStart, `{"inputs":{}}`),
			node("end", NodeTypeEnd, `{"outputs":{}}`),
		},
		Edges: []Edge{{Source: "start", Target: "end"}},
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	var events []Event
	err := Execute(ctx, graph, registry, RunContext{ID: "cancelled"}, func(event Event) {
		events = append(events, event)
	})
	if !errors.Is(err, context.Canceled) {
		t.Fatalf("error=%v", err)
	}
	if len(events) != 1 || events[0].Status != StatusCancelled || events[0].Error != "WORKFLOW_CANCELLED" {
		t.Fatalf("events=%+v", events)
	}
}

func TestGraphV4WhenSkipsCoverAndReturnsEmptyStringOutput(t *testing.T) {
	registry := testRegistry(t)
	called := 0
	graph := Graph{SchemaVersion: 4, Nodes: []Node{
		node("start", NodeTypeStart, `{"inputs":{"title":{"type":"string","required":true},"generateCover":{"type":"boolean","required":false}}}`),
		{ID: "cover", Type: NodeTypeTool, Label: "cover", Config: json.RawMessage(`{"capabilityId":"image.generateCover","inputs":{"title":"{{start.output.title}}","summary":"","style":"editorial"}}`), When: &Rule{Left: "{{start.output.generateCover}}", Operator: "equals", Right: true}},
		node("end", NodeTypeEnd, `{"outputs":{"imageUrl":"{{cover.output.imageUrl}}"},"outputTypes":{"imageUrl":"string"}}`),
	}, Edges: []Edge{{Source: "start", Target: "cover"}, {Source: "cover", Target: "end"}}}
	if errs := ValidateGraph(graph, registry); len(errs) > 0 {
		t.Fatalf("validation errors: %v", errs)
	}

	var final map[string]any
	err := Execute(context.Background(), graph, registry, RunContext{Inputs: map[string]any{"title": "hello", "generateCover": false}, CoverGenerator: CoverGeneratorFunc(func(context.Context, int64, string, string, string) (GeneratedCover, error) {
		called++
		return GeneratedCover{URL: "https://example.test/cover.png"}, nil
	})}, func(event Event) {
		if event.NodeID == "end" && event.Status == StatusSucceeded {
			final = event.Output
		}
	})
	if err != nil {
		t.Fatal(err)
	}
	if called != 0 {
		t.Fatalf("cover generator called %d times", called)
	}
	if final["imageUrl"] != "" {
		t.Fatalf("final=%v", final)
	}
}

func TestGraphV4GeneratedCoverExposesImageURLForDownstreamNodes(t *testing.T) {
	registry := testRegistry(t)
	graph := Graph{SchemaVersion: 4, Nodes: []Node{
		node("start", NodeTypeStart, `{"inputs":{"title":{"type":"string","required":true}}}`),
		node("cover", NodeTypeTool, `{"capabilityId":"image.generateCover","inputs":{"title":"{{start.output.title}}"}}`),
		node("end", NodeTypeEnd, `{"outputs":{"imageUrl":"{{cover.output.imageUrl}}"},"outputTypes":{"imageUrl":"string"}}`),
	}, Edges: []Edge{{Source: "start", Target: "cover"}, {Source: "cover", Target: "end"}}}
	if errs := ValidateGraph(graph, registry); len(errs) > 0 {
		t.Fatalf("validation errors: %v", errs)
	}

	var final map[string]any
	err := Execute(context.Background(), graph, registry, RunContext{
		Inputs: map[string]any{"title": "hello"},
		CoverGenerator: CoverGeneratorFunc(func(context.Context, int64, string, string, string) (GeneratedCover, error) {
			return GeneratedCover{URL: "https://example.test/cover.png"}, nil
		}),
	}, func(event Event) {
		if event.NodeID == "end" && event.Status == StatusSucceeded {
			final = event.Output
		}
	})
	if err != nil {
		t.Fatal(err)
	}
	if final["imageUrl"] != "https://example.test/cover.png" {
		t.Fatalf("final=%v", final)
	}
}

func TestApplyOperationsInsertsCoverAndPreservesOtherNodes(t *testing.T) {
	registry := testRegistry(t)
	base := Graph{SchemaVersion: 4, Nodes: []Node{
		node("start", NodeTypeStart, `{"inputs":{"title":{"type":"string","required":true}}}`),
		node("summary", NodeTypeLLM, `{"systemPrompt":"summarize","prompt":"title","modelProfile":"ark-text-default","temperature":0.2,"maxOutputTokens":64}`),
		node("end", NodeTypeEnd, `{"outputs":{"text":"{{summary.output.text}}"}}`),
	}, Edges: []Edge{{Source: "start", Target: "summary"}, {Source: "summary", Target: "end"}}}
	cover := node("cover", NodeTypeTool, `{"capabilityId":"image.generateCover","inputs":{"title":"{{start.output.title}}","summary":"{{summary.output.text}}","style":"editorial"}}`)
	cover.When = &Rule{Left: "{{start.output.generateCover}}", Operator: "equals", Right: true}
	candidate, err := ApplyOperations(base, []WorkflowOperation{{Type: OperationStartInputUpsert, InputName: "generateCover", Input: &InputDefinition{Type: ValueTypeBoolean}}, {Type: OperationNodeInsert, Node: &cover, AfterNodeID: "summary"}}, registry)
	if err != nil {
		t.Fatal(err)
	}
	if len(candidate.Nodes) != 4 || len(candidate.Edges) != 3 {
		t.Fatalf("candidate=%+v", candidate)
	}
	if candidate.Edges[1].Target != "cover" && candidate.Edges[2].Target != "cover" {
		t.Fatalf("cover was not inserted: %+v", candidate.Edges)
	}
}

func TestGraphV4RejectsUnknownToolAndBudgetOverflow(t *testing.T) {
	registry := testRegistry(t)
	unknown := Graph{SchemaVersion: 4, Nodes: []Node{node("start", NodeTypeStart, `{"inputs":{}}`), node("tool", NodeTypeTool, `{"capabilityId":"unsafe.http","inputs":{}}`), node("end", NodeTypeEnd, `{"outputs":{}}`)}, Edges: []Edge{{Source: "start", Target: "tool"}, {Source: "tool", Target: "end"}}}
	if errs := ValidateGraph(unknown, registry); !containsError(errs, "未开放") {
		t.Fatalf("unexpected errors: %v", errs)
	}
	nodes := []Node{node("start", NodeTypeStart, `{"inputs":{}}`)}
	edges := []Edge{}
	previous := "start"
	for index := 0; index < 6; index++ {
		id := string(rune('a' + index))
		nodes = append(nodes, node(id, NodeTypeLLM, `{"systemPrompt":"system","prompt":"prompt"}`))
		edges = append(edges, Edge{Source: previous, Target: id})
		previous = id
	}
	nodes = append(nodes, node("end", NodeTypeEnd, `{"outputs":{}}`))
	edges = append(edges, Edge{Source: previous, Target: "end"})
	if errs := ValidateGraph(Graph{SchemaVersion: 4, Nodes: nodes, Edges: edges}, registry); !containsError(errs, "模型能力预算") {
		t.Fatalf("unexpected errors: %v", errs)
	}
}

func TestGraphV4RejectsSkippedBranchOutputWithoutMerge(t *testing.T) {
	registry := testRegistry(t)
	graph := Graph{SchemaVersion: 4, Nodes: []Node{
		node("start", NodeTypeStart, `{"inputs":{"enabled":{"type":"boolean","required":true}}}`),
		node("condition", NodeTypeCondition, `{"left":"{{start.output.enabled}}","operator":"equals","right":true}`),
		node("yes", NodeTypeVariable, `{"assignments":[{"name":"value","type":"string","value":"yes"}]}`),
		node("no", NodeTypeVariable, `{"assignments":[{"name":"value","type":"string","value":"no"}]}`),
		node("end", NodeTypeEnd, `{"outputs":{"value":"{{yes.output.value}}"}}`),
	}, Edges: []Edge{{Source: "start", Target: "condition"}, {Source: "condition", SourceHandle: "true", Target: "yes"}, {Source: "condition", SourceHandle: "false", Target: "no"}, {Source: "yes", Target: "end"}, {Source: "no", Target: "end"}}}
	if errs := ValidateGraph(graph, registry); !containsError(errs, "可能被跳过") {
		t.Fatalf("unexpected errors: %v", errs)
	}
}

func TestGraphV4AllowsSkippedBranchOutputForOptionalToolInput(t *testing.T) {
	registry := testRegistry(t)
	graph := Graph{SchemaVersion: 4, Nodes: []Node{
		node("start", NodeTypeStart, `{"inputs":{"enabled":{"type":"boolean","required":true},"title":{"type":"string","required":true}}}`),
		node("condition", NodeTypeCondition, `{"left":"{{start.output.enabled}}","operator":"equals","right":true}`),
		node("cover", NodeTypeTool, `{"capabilityId":"image.generateCover","inputs":{"title":"{{start.output.title}}"}}`),
		node("bypass", NodeTypeVariable, `{"assignments":[{"name":"value","type":"string","value":"none"}]}`),
		node("draft", NodeTypeTool, `{"capabilityId":"blog.createDraft","inputs":{"title":"{{start.output.title}}","content":"body","cover":"{{cover.output.cover}}","tags":[],"tagMode":"manual","visibility":"private"}}`),
		node("end", NodeTypeEnd, `{"outputs":{}}`),
	}, Edges: []Edge{{Source: "start", Target: "condition"}, {Source: "condition", SourceHandle: "true", Target: "cover"}, {Source: "condition", SourceHandle: "false", Target: "bypass"}, {Source: "cover", Target: "draft"}, {Source: "bypass", Target: "draft"}, {Source: "draft", Target: "end"}}}
	if errs := ValidateGraph(graph, registry); len(errs) > 0 {
		t.Fatalf("validation errors: %v", errs)
	}
}

func TestGraphV4ValidatesBindingAndRuleTypes(t *testing.T) {
	registry := testRegistry(t)
	graph := Graph{SchemaVersion: 4, Nodes: []Node{
		node("start", NodeTypeStart, `{"inputs":{"enabled":{"type":"boolean","required":true}}}`),
		node("cover", NodeTypeTool, `{"capabilityId":"image.generateCover","inputs":{"title":"{{start.output.enabled}}"}}`),
		node("end", NodeTypeEnd, `{"outputs":{}}`),
	}, Edges: []Edge{{Source: "start", Target: "cover"}, {Source: "cover", Target: "end"}}}
	if errs := ValidateGraph(graph, registry); !containsError(errs, "需要 string，实际为 boolean") {
		t.Fatalf("unexpected errors: %v", errs)
	}

	ruleGraph := Graph{SchemaVersion: 4, Nodes: []Node{
		node("start", NodeTypeStart, `{"inputs":{"enabled":{"type":"boolean","required":true}}}`),
		node("condition", NodeTypeCondition, `{"left":"{{start.output.enabled}}","operator":"equals","right":"true"}`),
		node("yes", NodeTypeVariable, `{"assignments":[{"name":"value","type":"string","value":"yes"}]}`),
		node("no", NodeTypeVariable, `{"assignments":[{"name":"value","type":"string","value":"no"}]}`),
		node("end", NodeTypeEnd, `{"outputs":{}}`),
	}, Edges: []Edge{{Source: "start", Target: "condition"}, {Source: "condition", SourceHandle: "true", Target: "yes"}, {Source: "condition", SourceHandle: "false", Target: "no"}, {Source: "yes", Target: "end"}, {Source: "no", Target: "end"}}}
	if errs := ValidateGraph(ruleGraph, registry); !containsError(errs, "条件左右值类型不一致") {
		t.Fatalf("unexpected errors: %v", errs)
	}
}

func TestGraphV4EndOutputTypesValidateAndExecute(t *testing.T) {
	registry := testRegistry(t)
	graph := Graph{SchemaVersion: 4, Nodes: []Node{
		node("start", NodeTypeStart, `{"inputs":{"count":{"type":"number","required":true}}}`),
		node("end", NodeTypeEnd, `{"outputs":{"count":"{{start.output.count}}"},"outputTypes":{"count":"number"}}`),
	}, Edges: []Edge{{Source: "start", Target: "end"}}}
	if errs := ValidateGraph(graph, registry); len(errs) > 0 {
		t.Fatalf("validation errors: %v", errs)
	}
	var final map[string]any
	if err := Execute(context.Background(), graph, registry, RunContext{Inputs: map[string]any{"count": 3}}, func(event Event) {
		if event.NodeID == "end" && event.Status == StatusSucceeded {
			final = event.Output
		}
	}); err != nil {
		t.Fatal(err)
	}
	if final["count"] != 3 {
		t.Fatalf("final=%v", final)
	}

	graph.Nodes[1] = node("end", NodeTypeEnd, `{"outputs":{"count":"{{start.output.count}}"},"outputTypes":{"count":"string"}}`)
	if errs := ValidateGraph(graph, registry); !containsError(errs, "需要 string，实际为 number") {
		t.Fatalf("unexpected errors: %v", errs)
	}
}

func TestSubworkflowContractExposesTypedOutputs(t *testing.T) {
	registry := testRegistry(t)
	graph := Graph{SchemaVersion: 4, Nodes: []Node{
		node("start", NodeTypeStart, `{"inputs":{"topic":{"type":"string","required":true}}}`),
		node("child", NodeTypeSubworkflow, `{"workflowId":"1","versionId":"2","inputs":{"topic":"{{start.output.topic}}"},"inputSchema":{"topic":"string"},"outputSchema":{"title":"string"}}`),
		node("end", NodeTypeEnd, `{"outputs":{"title":"{{child.output.title}}"},"outputTypes":{"title":"string"}}`),
	}, Edges: []Edge{{Source: "start", Target: "child"}, {Source: "child", Target: "end"}}}
	if errs := ValidateGraph(graph, registry); len(errs) > 0 {
		t.Fatalf("validation errors: %v", errs)
	}

	graph.Nodes[1] = node("child", NodeTypeSubworkflow, `{"workflowId":"1","versionId":"2","inputs":{"topic":"{{start.output.topic}}"},"inputSchema":{"topic":"string"},"outputSchema":{"title":"number"}}`)
	if errs := ValidateGraph(graph, registry); !containsError(errs, "需要 string，实际为 number") {
		t.Fatalf("expected output type mismatch, got %v", errs)
	}

	child := Graph{SchemaVersion: 4, Nodes: []Node{
		node("start", NodeTypeStart, `{"inputs":{"topic":{"type":"string","required":true}}}`),
		node("end", NodeTypeEnd, `{"outputs":{"title":"{{start.output.topic}}"},"outputTypes":{"title":"string"}}`),
	}, Edges: []Edge{{Source: "start", Target: "end"}}}
	contract, err := SubworkflowContractFromGraph(child)
	if err != nil || contract.Inputs["topic"].Type != ValueTypeString || contract.Outputs["title"] != ValueTypeString {
		t.Fatalf("contract=%+v err=%v", contract, err)
	}
}

func TestLLMNodeAllowsEmptySystemPromptAndReportsSafeErrors(t *testing.T) {
	executor := LLMTextExecutor{Generator: textGeneratorFunc(func(_ context.Context, request TextGenerationRequest) (TextGenerationResult, error) {
		if request.SystemPrompt != "" || request.Prompt != "write\n\n输入变量：\n- count: 3\n- topic: AI" {
			t.Fatalf("request=%+v", request)
		}
		return TextGenerationResult{Text: "done", Model: "test"}, nil
	})}
	result, err := executor.Execute(context.Background(), RunContext{}, NodeExecution{Input: map[string]any{
		"modelProfile": "ark-text-default",
		"prompt":       "write",
		"inputs":       map[string]any{"topic": "AI", "count": 3},
	}})
	if err != nil || result.Output["text"] != "done" {
		t.Fatalf("result=%v err=%v", result, err)
	}

	message, code := publicExecutionError(Node{Type: NodeTypeLLM}, errors.New("AI 未配置：ARK_API_KEY 未设置"))
	if code != "AI_CONFIGURATION_UNAVAILABLE" || !strings.Contains(message, "ARK_API_KEY") {
		t.Fatalf("message=%q code=%q", message, code)
	}
}

func TestLLMStructuredOutputValidatesDeclaredFields(t *testing.T) {
	executor := LLMTextExecutor{Generator: textGeneratorFunc(func(_ context.Context, request TextGenerationRequest) (TextGenerationResult, error) {
		if !strings.Contains(request.Prompt, "只返回一个 JSON 对象") {
			t.Fatalf("prompt=%q", request.Prompt)
		}
		return TextGenerationResult{Text: "```json\n{\"title\":\"AI\",\"tags\":[\"workflow\"]}\n```", Model: "test"}, nil
	})}
	result, err := executor.Execute(context.Background(), RunContext{}, NodeExecution{Input: map[string]any{
		"modelProfile": "ark-text-default",
		"prompt":       "write",
		"outputMode":   "json",
		"outputSchema": map[string]any{"title": "string", "tags": "string[]"},
	}})
	if err != nil || result.Output["title"] != "AI" || result.Output["model"] != "test" {
		t.Fatalf("result=%v err=%v", result, err)
	}
	invalid := LLMTextExecutor{Generator: textGeneratorFunc(func(context.Context, TextGenerationRequest) (TextGenerationResult, error) {
		return TextGenerationResult{Text: `{"title":3}`, Model: "test"}, nil
	})}
	_, err = invalid.Execute(context.Background(), RunContext{}, NodeExecution{Input: map[string]any{
		"modelProfile": "ark-text-default",
		"prompt":       "write",
		"outputMode":   "json",
		"outputSchema": map[string]any{"title": "string"},
	}})
	if !errors.Is(err, ErrLLMStructuredOutputInvalid) {
		t.Fatalf("err=%v", err)
	}
}

func TestLLMInputBindingTypeValidation(t *testing.T) {
	registry := testRegistry(t)
	graph := Graph{SchemaVersion: 4, Nodes: []Node{
		node("start", NodeTypeStart, `{"inputs":{"count":{"type":"number","required":true}}}`),
		node("model", NodeTypeLLM, `{"modelProfile":"ark-text-default","prompt":"write","inputs":{"count":"{{start.output.count}}"},"inputTypes":{"count":"string"}}`),
		node("end", NodeTypeEnd, `{"outputs":{"text":"{{model.output.text}}"},"outputTypes":{"text":"string"}}`),
	}, Edges: []Edge{{Source: "start", Target: "model"}, {Source: "model", Target: "end"}}}
	if errs := ValidateGraph(graph, registry); !containsError(errs, "需要 string，实际为 number") {
		t.Fatalf("unexpected errors: %v", errs)
	}

	graph.Nodes[1] = node("model", NodeTypeLLM, `{"modelProfile":"ark-text-default","prompt":"write","inputs":{"count":"{{start.output.count}}"},"inputTypes":{"count":"number"}}`)
	if errs := ValidateGraph(graph, registry); len(errs) > 0 {
		t.Fatalf("validation errors: %v", errs)
	}
}

func TestLLMInputAliasIsValidAndResolvesInsidePrompts(t *testing.T) {
	registry := testRegistry(t)
	graph := Graph{SchemaVersion: 4, Nodes: []Node{
		node("start", NodeTypeStart, `{"inputs":{"topic":{"type":"string","required":true}}}`),
		node("writer", NodeTypeLLM, `{"modelProfile":"ark-text-default","inputs":{"model_input":"{{start.output.topic}}"},"inputTypes":{"model_input":"string"},"systemPrompt":"You write about {{model_input}}","prompt":"Draft {{model_input}}"}`),
		node("end", NodeTypeEnd, `{"outputs":{"text":"{{writer.output.text}}"},"outputTypes":{"text":"string"}}`),
	}, Edges: []Edge{{Source: "start", Target: "writer"}, {Source: "writer", Target: "end"}}}
	if errs := ValidateGraph(graph, registry); len(errs) != 0 {
		t.Fatalf("validation errors: %v", errs)
	}
	config, err := decodeConfig(graph.Nodes[1].Config)
	if err != nil {
		t.Fatal(err)
	}
	resolved, err := resolveLLMNodeInput(config, map[string]map[string]any{"start": {"topic": "AI"}})
	if err != nil {
		t.Fatal(err)
	}
	if resolved["systemPrompt"] != "You write about AI" || resolved["prompt"] != "Draft AI" {
		t.Fatalf("resolved=%+v", resolved)
	}

	graph.Nodes[1] = node("writer", NodeTypeLLM, `{"modelProfile":"ark-text-default","inputs":{"model_input":"{{model_input}}"},"inputTypes":{"model_input":"string"},"prompt":"Draft {{model_input}}"}`)
	if errs := ValidateGraph(graph, registry); !containsError(errs, "不能引用本节点输入") {
		t.Fatalf("expected self-reference error, got %v", errs)
	}
}

func containsError(errs []string, text string) bool {
	for _, err := range errs {
		if strings.Contains(err, text) {
			return true
		}
	}
	return false
}
