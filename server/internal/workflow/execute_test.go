package workflow

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"reflect"
	"strings"
	"testing"
)

func TestExecutePublishesOutputForNextExecutor(t *testing.T) {
	registry := DefaultRegistry()
	first := &stubExecutor{nodeType: NodeTypeBlogParse, result: NodeResult{Output: map[string]any{"title": "文章", "content": "正文"}}}
	second := &stubExecutor{nodeType: NodeTypeLLMText, execute: func(_ context.Context, run RunContext, _ NodeExecution) (NodeResult, error) {
		if got := run.Outputs["parse"]["title"]; got != "文章" {
			return NodeResult{}, fmt.Errorf("expected first output, got %v", got)
		}
		return NodeResult{Output: map[string]any{"text": "摘要"}}, nil
	}}
	third := &stubExecutor{nodeType: NodeTypeBlogCreateDraft, result: NodeResult{Output: map[string]any{"postId": "post-1"}}}
	requireRegisterExecutor(t, registry, first)
	requireRegisterExecutor(t, registry, second)
	requireRegisterExecutor(t, registry, third)

	events := make([]Event, 0)
	run := RunContext{ID: "run-1", Inputs: map[string]any{"markdownFile": FileInput{Filename: "article.md", Content: []byte("# Title\n\nBody")}, "tagIds": []string{"7"}, "visibility": "private"}, Outputs: make(map[string]map[string]any)}
	err := Execute(context.Background(), executionGraph(), registry, run, func(event Event) {
		events = append(events, event)
	})
	if err != nil {
		t.Fatalf("Execute() error = %v", err)
	}
	if got := run.Outputs["summary"]["text"]; got != "摘要" {
		t.Fatalf("summary output = %v, want 摘要", got)
	}
	if len(events) != 10 {
		t.Fatalf("event count = %d, want 10; events=%+v", len(events), events)
	}
	if events[2].Status != StatusRunning || events[3].Status != StatusSucceeded || events[3].Output["title"] != "文章" {
		t.Fatalf("parse events = %+v, want running then successful output", events[2:4])
	}
	if events[4].Status != StatusRunning || events[5].Output["text"] != "摘要" || events[5].Output["textLength"] != 2 {
		t.Fatalf("summary events = %+v, want running then successful output", events[4:6])
	}
}

func TestExecuteStopsAfterNodeFailure(t *testing.T) {
	registry := DefaultRegistry()
	first := &stubExecutor{nodeType: NodeTypeBlogParse, result: NodeResult{Output: map[string]any{"title": "文章"}}}
	second := &stubExecutor{nodeType: NodeTypeLLMText, err: errors.New("ARK unavailable")}
	third := &stubExecutor{nodeType: NodeTypeBlogCreateDraft, result: NodeResult{Output: map[string]any{"postId": "should-not-exist"}}}
	requireRegisterExecutor(t, registry, first)
	requireRegisterExecutor(t, registry, second)
	requireRegisterExecutor(t, registry, third)

	events := make([]Event, 0)
	err := Execute(context.Background(), executionGraph(), registry, RunContext{ID: "run-2", Inputs: validExecutionInputs()}, func(event Event) {
		events = append(events, event)
	})
	if err == nil || err.Error() != "ARK unavailable" {
		t.Fatalf("Execute() error = %v, want ARK unavailable", err)
	}
	if third.calls != 0 {
		t.Fatalf("draft executor calls = %d, want 0", third.calls)
	}
	if len(events) != 6 || events[5].Status != StatusFailed || events[5].Error != "WORKFLOW_NODE_FAILED" {
		t.Fatalf("events = %+v, want failure event for summary", events)
	}
}

func TestExecuteUsesTopologicalOrderInsteadOfNodeSliceOrder(t *testing.T) {
	registry := DefaultRegistry()
	order := make([]string, 0)
	for _, nodeType := range []NodeType{NodeTypeBlogParse, NodeTypeLLMText, NodeTypeBlogCreateDraft} {
		nodeType := nodeType
		requireRegisterExecutor(t, registry, &stubExecutor{nodeType: nodeType, execute: func(_ context.Context, _ RunContext, execution NodeExecution) (NodeResult, error) {
			order = append(order, execution.NodeID)
			switch execution.NodeID {
			case "parse":
				return NodeResult{Output: map[string]any{"title": "文章", "content": "正文"}}, nil
			case "summary":
				return NodeResult{Output: map[string]any{"text": "摘要"}}, nil
			default:
				return NodeResult{Output: map[string]any{"postId": "post-1"}}, nil
			}
		}})
	}

	graph := executionGraph()
	graph.Nodes[1], graph.Nodes[3] = graph.Nodes[3], graph.Nodes[1]
	if err := Execute(context.Background(), graph, registry, RunContext{ID: "run-3", Inputs: validExecutionInputs()}, nil); err != nil {
		t.Fatalf("Execute() error = %v", err)
	}
	if want := []string{"parse", "summary", "draft"}; !reflect.DeepEqual(order, want) {
		t.Fatalf("execution order = %v, want %v", order, want)
	}
}

func TestResolveTemplateAllowsOnlyDeclaredOutputReferences(t *testing.T) {
	outputs := map[string]map[string]any{"parse": {"title": "文章"}}
	resolved, err := ResolveTemplate("标题：{{parse.output.title}}", outputs)
	if err != nil || resolved != "标题：文章" {
		t.Fatalf("ResolveTemplate() = %q, %v", resolved, err)
	}
	if _, err := ResolveTemplate("{{parse.output.missing}}", outputs); err == nil {
		t.Fatal("ResolveTemplate() missing field error = nil")
	}
	if _, err := ResolveTemplate("{{printf \"unsafe\"}}", outputs); err == nil {
		t.Fatal("ResolveTemplate() expression error = nil")
	}
}

func TestResolveTemplatePreservesTypeForWholeReference(t *testing.T) {
	outputs := map[string]map[string]any{"start": {"tagIds": []string{"tag-a", "tag-b"}}}

	resolved, err := ResolveTemplate("{{start.output.tagIds}}", outputs)
	if err != nil {
		t.Fatalf("ResolveTemplate() error = %v", err)
	}
	if want := []string{"tag-a", "tag-b"}; !reflect.DeepEqual(resolved, want) {
		t.Fatalf("ResolveTemplate() = %#v, want %#v", resolved, want)
	}
}

func TestResolveTemplateRendersEmbeddedReferenceAsString(t *testing.T) {
	outputs := map[string]map[string]any{"parse": {"title": "文章"}}

	resolved, err := ResolveTemplate("标题：{{parse.output.title}}", outputs)
	if err != nil {
		t.Fatalf("ResolveTemplate() error = %v", err)
	}
	if got, ok := resolved.(string); !ok || got != "标题：文章" {
		t.Fatalf("ResolveTemplate() = %#v (%T), want string 标题：文章", resolved, resolved)
	}
}

func TestExecutePassesResolvedTypedInputToExecutor(t *testing.T) {
	registry := DefaultRegistry()
	draft := &stubExecutor{nodeType: NodeTypeBlogCreateDraft, execute: func(_ context.Context, _ RunContext, execution NodeExecution) (NodeResult, error) {
		got, ok := execution.Input["tags"].([]string)
		if !ok || !reflect.DeepEqual(got, []string{"tag-a", "tag-b"}) {
			return NodeResult{}, fmt.Errorf("tags = %#v (%T), want []string", execution.Input["tags"], execution.Input["tags"])
		}
		return NodeResult{Output: map[string]any{"postId": "post-1"}}, nil
	}}
	requireRegisterExecutor(t, registry, draft)

	graph := executionGraph()
	graph.Nodes = []Node{graph.Nodes[0], graph.Nodes[3], graph.Nodes[4]}
	graph.Nodes[0].Config = []byte(`{"inputs":{"title":{"type":"string","required":true},"content":{"type":"string","required":true},"tagIds":{"type":"string[]"},"visibility":{"type":"string"}}}`)
	graph.Nodes[1].Config = []byte(`{"title":"{{start.output.title}}","content":"{{start.output.content}}","tags":"{{start.output.tagIds}}","tagMode":"merge","visibility":"{{start.output.visibility}}"}`)
	graph.Edges = []Edge{
		{Source: "start", SourceHandle: "output", Target: "draft", TargetHandle: "input"},
		{Source: "draft", SourceHandle: "output", Target: "end", TargetHandle: "input"},
	}
	if err := Execute(context.Background(), graph, registry, RunContext{ID: "run-typed-input", Inputs: map[string]any{"title": "title", "content": "content", "tagIds": []string{"tag-a", "tag-b"}, "visibility": "private"}}, nil); err != nil {
		t.Fatalf("Execute() error = %v", err)
	}
}

func TestExecuteEmitsSafeEventPreview(t *testing.T) {
	registry := DefaultRegistry()
	longPrompt := strings.Repeat("x", 2200)
	summary := &stubExecutor{nodeType: NodeTypeLLMText, result: NodeResult{Output: map[string]any{
		"text":     strings.Repeat("y", 2200),
		"apiToken": "must-not-leak",
		"file":     map[string]any{"filename": "article.md", "size": int64(12), "content": "must-not-leak"},
	}}}
	requireRegisterExecutor(t, registry, summary)
	graph := executionGraph()
	graph.Nodes = []Node{graph.Nodes[0], {ID: "summary", Type: NodeTypeLLMText, Config: []byte(fmt.Sprintf(`{"modelProfile":"ark-text-default","systemPrompt":"%s","prompt":"short","temperature":0.4,"maxOutputTokens":120}`, longPrompt))}, {ID: "end", Type: NodeTypeEnd, Config: []byte(`{"outputs":{"text":"{{summary.output.text}}"}}`)}}
	graph.Edges = []Edge{
		{Source: "start", SourceHandle: "output", Target: "summary", TargetHandle: "input"},
		{Source: "summary", SourceHandle: "output", Target: "end", TargetHandle: "input"},
	}
	var success Event
	if err := Execute(context.Background(), graph, registry, RunContext{ID: "run-safe-preview", Inputs: validExecutionInputs()}, func(event Event) {
		if event.NodeID == "summary" && event.Status == StatusSucceeded {
			success = event
		}
	}); err != nil {
		t.Fatalf("Execute() error = %v", err)
	}
	if _, exists := success.Input["systemPrompt"]; exists {
		t.Fatalf("event input leaked system prompt: %#v", success.Input)
	}
	if _, exists := success.Input["prompt"]; exists {
		t.Fatalf("event input leaked prompt: %#v", success.Input)
	}
	if got, want := success.Output["text"], strings.Repeat("y", previewTextLimit); got != want {
		t.Fatalf("event text preview = %#v, want %#v", got, want)
	}
	if got, want := success.Output["textLength"], 2200; got != want {
		t.Fatalf("event text length = %#v, want %#v", got, want)
	}
	if _, exists := success.Output["apiToken"]; exists {
		t.Fatalf("event output leaked sensitive field: %#v", success.Output)
	}
	if _, exists := success.Output["file"]; exists {
		t.Fatalf("event output leaked arbitrary field: %#v", success.Output)
	}
}

func TestSafeEventOutputUsesOnlySafeNodePreviews(t *testing.T) {
	longContent := strings.Repeat("m", previewTextLimit+1)

	start := safeEventOutput(NodeTypeStart, map[string]any{
		"markdownFile": FileInput{Filename: "article.md", ContentType: "text/markdown", Size: 12, Content: []byte("must-not-leak")},
		"tagIds":       []string{"tag-a", "tag-b"},
		"groupId":      "group-1",
		"visibility":   "private",
		"apiToken":     "must-not-leak",
	})
	if got, want := start["tagCount"], 2; got != want {
		t.Fatalf("start tag count = %#v, want %#v", got, want)
	}
	if _, exists := start["tagIds"]; exists {
		t.Fatalf("start output leaked tag IDs: %#v", start)
	}
	file, ok := start["markdownFile"].(map[string]any)
	if !ok || file["filename"] != "article.md" || file["contentType"] != "text/markdown" || file["size"] != int64(12) {
		t.Fatalf("start file metadata = %#v", start["markdownFile"])
	}
	if _, exists := file["content"]; exists {
		t.Fatalf("start output leaked file content: %#v", file)
	}

	parsed := safeEventOutput(NodeTypeBlogParse, map[string]any{
		"title":       "Title",
		"excerpt":     "Excerpt",
		"tagNames":    []string{"go"},
		"content":     longContent,
		"frontMatter": map[string]any{"password": "must-not-leak"},
	})
	if got, want := parsed["contentPreview"], strings.Repeat("m", previewTextLimit); got != want {
		t.Fatalf("markdown content preview = %#v, want %#v", got, want)
	}
	if got, want := parsed["contentLength"], previewTextLimit+1; got != want {
		t.Fatalf("markdown content length = %#v, want %#v", got, want)
	}
	if _, exists := parsed["content"]; exists {
		t.Fatalf("markdown output leaked full content: %#v", parsed)
	}
	if _, exists := parsed["frontMatter"]; exists {
		t.Fatalf("markdown output leaked arbitrary metadata: %#v", parsed)
	}

	for _, nodeType := range []NodeType{NodeTypeBlogCreateDraft, NodeTypeEnd} {
		preview := safeEventOutput(nodeType, map[string]any{
			"postId": "post-1", "title": "Draft", "editPath": "/my-space/blog-edit/post-1", "tagIds": []string{"tag-a"}, "secret": "must-not-leak",
		})
		if _, exists := preview["secret"]; exists {
			t.Fatalf("%s output leaked sensitive field: %#v", nodeType, preview)
		}
	}
}

func TestExecutePassesDeclaredMarkdownFileInputToParseExecutor(t *testing.T) {
	registry := DefaultRegistry()
	requireRegisterExecutor(t, registry, BlogParseExecutor{})
	graph := Graph{
		SchemaVersion: 2,
		Nodes: []Node{
			{ID: "start", Type: NodeTypeStart, Config: []byte(`{"inputs":{"markdownFile":{"type":"file","required":true}}}`)},
			{ID: "parse", Type: NodeTypeBlogParse, Config: []byte(`{"fileInput":"markdownFile"}`)},
			{ID: "end", Type: NodeTypeEnd, Config: []byte(`{"outputs":{"title":"{{parse.output.title}}"}}`)},
		},
		Edges: []Edge{
			{Source: "start", SourceHandle: "output", Target: "parse", TargetHandle: "input"},
			{Source: "parse", SourceHandle: "output", Target: "end", TargetHandle: "input"},
		},
	}
	run := RunContext{ID: "run-file-input", Inputs: map[string]any{
		"markdownFile": FileInput{Filename: "article.md", Content: []byte("# Imported title\n\nBody")},
	}, Outputs: make(map[string]map[string]any)}
	if err := Execute(context.Background(), graph, registry, run, nil); err != nil {
		t.Fatalf("Execute() error = %v", err)
	}
	if got := run.Outputs["parse"]["title"]; got != "Imported title" {
		t.Fatalf("parse title = %#v, want imported title", got)
	}
}

func TestExecuteRejectsInvalidRequiredStartInputsBeforeEvents(t *testing.T) {
	registry := DefaultRegistry()
	called := false
	requireRegisterExecutor(t, registry, &stubExecutor{nodeType: NodeTypeBlogParse, execute: func(_ context.Context, _ RunContext, _ NodeExecution) (NodeResult, error) {
		called = true
		return NodeResult{}, nil
	}})
	graph := executionGraph()
	events := make([]Event, 0)
	err := Execute(context.Background(), graph, registry, RunContext{ID: "run-invalid-input", Inputs: map[string]any{
		"markdownFile": FileInput{Filename: "wrong.txt", Content: []byte("body")},
		"tagIds":       []string{},
		"visibility":   3,
	}}, func(event Event) { events = append(events, event) })
	if err == nil || !strings.Contains(err.Error(), "markdownFile") {
		t.Fatalf("Execute() error = %v, want invalid file error", err)
	}
	if called || len(events) != 0 {
		t.Fatalf("invalid start input executed graph: called=%t events=%+v", called, events)
	}
}

func TestExecuteEnforcesPhaseOnePolicyBeforeEvents(t *testing.T) {
	registry := DefaultRegistry()
	graph := executionGraph()
	graph.Nodes = append(graph.Nodes, Node{ID: "summary-2", Type: NodeTypeLLMText, Config: []byte(`{"modelProfile":"ark-text-default","systemPrompt":"summarize","prompt":"{{parse.output.title}}","temperature":0.4,"maxOutputTokens":120}`)})
	graph.Edges[2] = Edge{Source: "summary", SourceHandle: "output", Target: "summary-2", TargetHandle: "input"}
	graph.Edges = append(graph.Edges, Edge{Source: "summary-2", SourceHandle: "output", Target: "draft", TargetHandle: "input"})
	events := make([]Event, 0)
	err := Execute(context.Background(), graph, registry, RunContext{ID: "run-policy", Inputs: validExecutionInputs()}, func(event Event) { events = append(events, event) })
	if err == nil || !strings.Contains(err.Error(), "LLM 节点不能超过 1 个") {
		t.Fatalf("Execute() error = %v, want policy rejection", err)
	}
	if len(events) != 0 {
		t.Fatalf("policy rejection emitted events: %+v", events)
	}
}

func TestExecuteFailureEventDoesNotExposeRawError(t *testing.T) {
	registry := DefaultRegistry()
	requireRegisterExecutor(t, registry, &stubExecutor{nodeType: NodeTypeBlogParse, err: errors.New("ARK key=secret-value database password=unsafe")})
	events := make([]Event, 0)
	err := Execute(context.Background(), executionGraph(), registry, RunContext{ID: "run-safe-error", Inputs: validExecutionInputs()}, func(event Event) { events = append(events, event) })
	if err == nil || !strings.Contains(err.Error(), "secret-value") {
		t.Fatalf("Execute() error = %v, want original internal error", err)
	}
	failed := events[len(events)-1]
	if failed.Error != "WORKFLOW_NODE_FAILED" || strings.Contains(failed.Error, "secret-value") || strings.Contains(failed.Message, "secret-value") {
		t.Fatalf("failure event leaked error: %+v", failed)
	}
}

func validExecutionInputs() map[string]any {
	return map[string]any{
		"markdownFile": FileInput{Filename: "article.md", Content: []byte("# Title\n\nBody")},
		"tagIds":       []string{},
		"visibility":   "private",
	}
}

func TestExecuteDoesNotPassRawConfigToExecutorValidation(t *testing.T) {
	registry := DefaultRegistry()
	requireRegisterExecutor(t, registry, rawConfigRejectingExecutor{})
	graph := Graph{
		SchemaVersion: 2,
		Nodes: []Node{
			{ID: "start", Type: NodeTypeStart, Config: startConfig()},
			{ID: "summary", Type: NodeTypeLLMText, Config: llmConfig("fixed prompt")},
			{ID: "end", Type: NodeTypeEnd, Config: []byte(`{"outputs":{"text":"{{summary.output.text}}"}}`)},
		},
		Edges: []Edge{
			{Source: "start", SourceHandle: "output", Target: "summary", TargetHandle: "input"},
			{Source: "summary", SourceHandle: "output", Target: "end", TargetHandle: "input"},
		},
	}
	if err := Execute(context.Background(), graph, registry, RunContext{ID: "run-no-raw-config", Inputs: validExecutionInputs()}, nil); err != nil {
		t.Fatalf("Execute() error = %v, want executor to receive only NodeExecution", err)
	}
}

func TestExecuteNormalizesJSONStringListInputForExecutor(t *testing.T) {
	registry := DefaultRegistry()
	draft := &stubExecutor{nodeType: NodeTypeBlogCreateDraft, execute: func(_ context.Context, _ RunContext, execution NodeExecution) (NodeResult, error) {
		tags, ok := execution.Input["tags"].([]string)
		if !ok || !reflect.DeepEqual(tags, []string{"tag-a", "tag-b"}) {
			return NodeResult{}, fmt.Errorf("tags = %#v (%T), want []string", execution.Input["tags"], execution.Input["tags"])
		}
		return NodeResult{Output: map[string]any{"postId": "post-1"}}, nil
	}}
	requireRegisterExecutor(t, registry, draft)
	graph := executionGraph()
	graph.Nodes = []Node{graph.Nodes[0], graph.Nodes[3], graph.Nodes[4]}
	graph.Nodes[0].Config = []byte(`{"inputs":{"title":{"type":"string"},"content":{"type":"string"},"tagIds":{"type":"string[]"},"visibility":{"type":"string"}}}`)
	graph.Nodes[1].Config = []byte(`{"title":"{{start.output.title}}","content":"{{start.output.content}}","tags":"{{start.output.tagIds}}","tagMode":"merge","visibility":"{{start.output.visibility}}"}`)
	graph.Edges = []Edge{
		{Source: "start", SourceHandle: "output", Target: "draft", TargetHandle: "input"},
		{Source: "draft", SourceHandle: "output", Target: "end", TargetHandle: "input"},
	}
	inputs := map[string]any{"title": "title", "content": "content", "tagIds": []any{"tag-a", "tag-b"}, "visibility": "private"}
	if err := Execute(context.Background(), graph, registry, RunContext{ID: "run-json-list", Inputs: inputs}, nil); err != nil {
		t.Fatalf("Execute() error = %v", err)
	}
	if got, ok := inputs["tagIds"].([]string); !ok || !reflect.DeepEqual(got, []string{"tag-a", "tag-b"}) {
		t.Fatalf("normalized input = %#v (%T), want []string", inputs["tagIds"], inputs["tagIds"])
	}
}

func TestNormalizeRunInputsFillsOptionalStartValuesForTemplates(t *testing.T) {
	graph := Graph{SchemaVersion: 2, Nodes: []Node{{ID: "start", Type: NodeTypeStart, Config: []byte(`{"inputs":{"topic":{"type":"string","required":true},"audience":{"type":"string"},"tags":{"type":"string[]"}}}`)}}}
	inputs := map[string]any{"topic": "知识库写作"}

	if err := normalizeRunInputs(graph, inputs); err != nil {
		t.Fatalf("normalizeRunInputs() error = %v", err)
	}
	if inputs["audience"] != "" {
		t.Fatalf("audience = %#v, want empty string", inputs["audience"])
	}
	if tags, ok := inputs["tags"].([]string); !ok || len(tags) != 0 {
		t.Fatalf("tags = %#v, want empty string list", inputs["tags"])
	}
}

func TestExecuteRejectsNonStringJSONListInput(t *testing.T) {
	registry := DefaultRegistry()
	draft := &stubExecutor{nodeType: NodeTypeBlogCreateDraft, result: NodeResult{Output: map[string]any{"postId": "post-1"}}}
	requireRegisterExecutor(t, registry, draft)
	graph := executionGraph()
	graph.Nodes = []Node{graph.Nodes[0], graph.Nodes[3], graph.Nodes[4]}
	graph.Nodes[0].Config = []byte(`{"inputs":{"title":{"type":"string"},"content":{"type":"string"},"tagIds":{"type":"string[]"},"visibility":{"type":"string"}}}`)
	graph.Nodes[1].Config = []byte(`{"title":"{{start.output.title}}","content":"{{start.output.content}}","tags":"{{start.output.tagIds}}","tagMode":"merge","visibility":"{{start.output.visibility}}"}`)
	graph.Edges = []Edge{
		{Source: "start", SourceHandle: "output", Target: "draft", TargetHandle: "input"},
		{Source: "draft", SourceHandle: "output", Target: "end", TargetHandle: "input"},
	}
	err := Execute(context.Background(), graph, registry, RunContext{ID: "run-invalid-json-list", Inputs: map[string]any{"title": "title", "content": "content", "tagIds": []any{"tag-a", 2}, "visibility": "private"}}, nil)
	if err == nil || !strings.Contains(err.Error(), "tagIds") {
		t.Fatalf("Execute() error = %v, want tagIds type error", err)
	}
	if draft.calls != 0 {
		t.Fatalf("draft executor calls = %d, want 0", draft.calls)
	}
}

func TestSafePreviewTreatsNamedMapsAsFiles(t *testing.T) {
	for name, input := range map[string]map[string]any{
		"body":   {"name": "article.md", "body": "must-not-leak"},
		"data":   {"filename": "article.md", "data": "must-not-leak"},
		"reader": {"name": "article.md", "reader": "must-not-leak"},
		"bytes":  {"filename": "article.md", "bytes": "must-not-leak"},
	} {
		t.Run(name, func(t *testing.T) {
			preview, ok := safePreviewValue(input).(map[string]any)
			if !ok {
				t.Fatalf("safePreviewValue() = %#v, want file metadata map", safePreviewValue(input))
			}
			if preview["name"] != "article.md" && preview["filename"] != "article.md" {
				t.Fatalf("file metadata = %#v", preview)
			}
			for _, key := range []string{"body", "data", "reader", "content", "bytes"} {
				if _, exists := preview[key]; exists {
					t.Fatalf("file preview leaked %s: %#v", key, preview)
				}
			}
		})
	}
}

func TestSafePreviewTreatsNamedStringMapsAsFiles(t *testing.T) {
	for name, input := range map[string]map[string]string{
		"filename":  {"filename": "article.md", "content": "must-not-leak"},
		"file_name": {"file_name": "article.md", "body": "must-not-leak"},
		"uppercase": {"NAME": "article.md", "data": "must-not-leak"},
	} {
		t.Run(name, func(t *testing.T) {
			preview, ok := safePreviewValue(input).(map[string]any)
			if !ok {
				t.Fatalf("safePreviewValue() = %#v, want file metadata map", safePreviewValue(input))
			}
			for _, key := range []string{"content", "body", "data", "reader", "bytes"} {
				if _, exists := preview[key]; exists {
					t.Fatalf("file preview leaked %s: %#v", key, preview)
				}
			}
		})
	}
}

func TestRegistryRejectsExecutorWithoutDeclaredCapability(t *testing.T) {
	registry := DefaultRegistry()
	err := registry.RegisterExecutor(&stubExecutor{nodeType: NodeType("unsafe.http")})
	if err == nil {
		t.Fatal("RegisterExecutor() error = nil, want undeclared node rejection")
	}
}

type stubExecutor struct {
	nodeType NodeType
	result   NodeResult
	err      error
	execute  func(context.Context, RunContext, NodeExecution) (NodeResult, error)
	calls    int
}

type rawConfigRejectingExecutor struct{}

func (rawConfigRejectingExecutor) Type() NodeType { return NodeTypeLLMText }

func (rawConfigRejectingExecutor) Validate(json.RawMessage) error {
	return errors.New("executors must not validate raw config")
}

func (rawConfigRejectingExecutor) Execute(_ context.Context, _ RunContext, _ NodeExecution) (NodeResult, error) {
	return NodeResult{Output: map[string]any{"text": "summary"}}, nil
}

func (e *stubExecutor) Type() NodeType { return e.nodeType }

func (e *stubExecutor) Validate(_ json.RawMessage) error { return nil }

func (e *stubExecutor) Execute(ctx context.Context, run RunContext, execution NodeExecution) (NodeResult, error) {
	e.calls++
	if e.execute != nil {
		return e.execute(ctx, run, execution)
	}
	return e.result, e.err
}

func requireRegisterExecutor(t *testing.T, registry *Registry, executor NodeExecutor) {
	t.Helper()
	if err := registry.RegisterExecutor(executor); err != nil {
		t.Fatalf("RegisterExecutor() error = %v", err)
	}
}

func executionGraph() Graph {
	return Graph{
		SchemaVersion: 2,
		Nodes: []Node{
			{ID: "start", Type: NodeTypeStart, Config: startConfig()},
			{ID: "parse", Type: NodeTypeBlogParse, Config: []byte(`{"fileInput":"markdownFile"}`)},
			{ID: "summary", Type: NodeTypeLLMText, Config: []byte(`{"modelProfile":"ark-text-default","systemPrompt":"summarize","prompt":"{{parse.output.title}}","temperature":0.4,"maxOutputTokens":120}`)},
			{ID: "draft", Type: NodeTypeBlogCreateDraft, Config: []byte(`{"title":"{{parse.output.title}}","content":"{{parse.output.content}}","tags":"{{start.output.tagIds}}","tagMode":"merge","visibility":"{{start.output.visibility}}"}`)},
			{ID: "end", Type: NodeTypeEnd, Config: []byte(`{"outputs":{"postId":"{{draft.output.postId}}"}}`)},
		},
		Edges: []Edge{
			{Source: "start", SourceHandle: "output", Target: "parse", TargetHandle: "input"},
			{Source: "parse", SourceHandle: "output", Target: "summary", TargetHandle: "input"},
			{Source: "summary", SourceHandle: "output", Target: "draft", TargetHandle: "input"},
			{Source: "draft", SourceHandle: "output", Target: "end", TargetHandle: "input"},
		},
	}
}
