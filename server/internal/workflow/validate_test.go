package workflow

import (
	"encoding/json"
	"reflect"
	"strings"
	"testing"
)

func TestValidateGraphRejectsCycleAndUnknownVariable(t *testing.T) {
	graph := Graph{
		SchemaVersion: 1,
		Nodes: []Node{
			{ID: "start", Type: NodeTypeStart, Config: startConfig()},
			{ID: "summary", Type: NodeTypeLLMText, Config: json.RawMessage(`{"modelProfile":"ark-text-default","systemPrompt":"summarize","prompt":"{{missing.output.text}}","temperature":0.4,"maxOutputTokens":120}`)},
			{ID: "end", Type: NodeTypeEnd, Config: json.RawMessage(`{"outputs":{"text":"{{summary.output.text}}"}}`)},
		},
		Edges: []Edge{{Source: "start", SourceHandle: "output", Target: "summary", TargetHandle: "input"}, {Source: "summary", SourceHandle: "output", Target: "start", TargetHandle: "input"}, {Source: "summary", SourceHandle: "output", Target: "end", TargetHandle: "input"}},
	}

	errs := ValidateGraph(graph, DefaultRegistry())
	assertContains(t, errs, "工作流不能包含循环")
	assertContains(t, errs, "变量 missing.output.text 不存在或不在上游")
}

func TestValidateGraphRequiresExactlyOneStartAndEnd(t *testing.T) {
	graph := Graph{SchemaVersion: 1, Nodes: []Node{{ID: "summary", Type: NodeTypeLLMText, Config: json.RawMessage(`{"modelProfile":"ark-text-default","systemPrompt":"summarize","prompt":"article","temperature":0.4,"maxOutputTokens":120}`)}}}

	errs := ValidateGraph(graph, DefaultRegistry())
	assertContains(t, errs, "必须且只能有一个开始节点")
	assertContains(t, errs, "必须且只能有一个结束节点")
}

func TestValidateGraphRejectsInvalidLLMParameters(t *testing.T) {
	graph := Graph{
		SchemaVersion: 1,
		Nodes: []Node{
			{ID: "start", Type: NodeTypeStart, Config: startConfig()},
			{ID: "summary", Type: NodeTypeLLMText, Config: json.RawMessage(`{"modelProfile":"ark-text-default","systemPrompt":"","prompt":"","temperature":2.1,"maxOutputTokens":4097}`)},
			{ID: "end", Type: NodeTypeEnd, Config: json.RawMessage(`{"outputs":{"text":"{{summary.output.text}}"}}`)},
		},
		Edges: []Edge{{Source: "start", SourceHandle: "output", Target: "summary", TargetHandle: "input"}, {Source: "summary", SourceHandle: "output", Target: "end", TargetHandle: "input"}},
	}

	errs := ValidateGraph(graph, DefaultRegistry())
	assertContains(t, errs, "systemPrompt 不能为空")
	assertContains(t, errs, "prompt 不能为空")
	assertContains(t, errs, "temperature 必须在 0 到 2 之间")
	assertContains(t, errs, "maxOutputTokens 必须在 1 到 4096 之间")
}

func TestValidateGraphRejectsUnknownNodeAndUndeclaredPort(t *testing.T) {
	graph := validBlogGraph()
	graph.Nodes = append(graph.Nodes, Node{ID: "unknown", Type: "unsafe.http"})
	graph.Edges[0].SourceHandle = "missing-output"

	errs := ValidateGraph(graph, DefaultRegistry())
	assertContains(t, errs, "节点 unknown 的类型 unsafe.http 未注册")
	assertContains(t, errs, "连线 start -> markdown 的输出端口 missing-output 未声明")
}

func TestValidateGraphRejectsUndeclaredTargetPort(t *testing.T) {
	graph := validBlogGraph()
	graph.Edges[0].TargetHandle = "missing-input"

	errs := ValidateGraph(graph, DefaultRegistry())
	assertContains(t, errs, "连线 start -> markdown 的输入端口 missing-input 未声明")
}

func TestValidateGraphRejectsIsolatedAndHangingNodes(t *testing.T) {
	graph := validBlogGraph()
	graph.Nodes = append(graph.Nodes,
		Node{ID: "orphan", Type: NodeTypeBlogCreateDraft, Config: draftConfig()},
		Node{ID: "hanging", Type: NodeTypeLLMText, Config: llmConfig("article")},
	)
	graph.Edges = append(graph.Edges, Edge{Source: "start", SourceHandle: "output", Target: "hanging", TargetHandle: "input"})

	errs := ValidateGraph(graph, DefaultRegistry())
	assertContains(t, errs, "节点 orphan 无法从开始节点到达")
	assertContains(t, errs, "节点 orphan 无法到达结束节点")
	assertContains(t, errs, "节点 hanging 无法到达结束节点")
}

func TestValidateGraphRequiresDeclaredFileInput(t *testing.T) {
	graph := validBlogGraph()
	graph.Nodes[1].Config = json.RawMessage(`{"fileInput":"missingFile"}`)
	errs := ValidateGraph(graph, DefaultRegistry())
	assertContains(t, errs, "fileInput missingFile 未在开始节点中声明")

	graph = validBlogGraph()
	graph.Nodes[1].Config = json.RawMessage(`{"fileInput":"tagIds"}`)
	errs = ValidateGraph(graph, DefaultRegistry())
	assertContains(t, errs, "fileInput tagIds 必须引用 file 类型输入")
}

func TestValidateGraphRequiresDeclaredVisibilityInput(t *testing.T) {
	graph := validBlogGraph()
	graph.Nodes[3].Config = json.RawMessage(`{"title":"{{markdown.output.title}}","content":"{{markdown.output.content}}","tags":"{{start.output.tagIds}}","tagMode":"merge","visibility":"public"}`)

	errs := ValidateGraph(graph, DefaultRegistry())
	assertContains(t, errs, "visibility 必须引用开始节点输入")
}

func TestValidateGraphRequiresTemplateDraftMappingsAndStartTagIDs(t *testing.T) {
	graph := validBlogGraph()
	graph.Nodes[3].Config = json.RawMessage(`{"title":"literal title","content":"{{markdown.output.content}}","tags":"{{start.output.visibility}}","tagMode":"merge","visibility":"{{start.output.visibility}}"}`)

	errs := ValidateGraph(graph, DefaultRegistry())
	assertContains(t, errs, "title 必须是模板变量")
	assertContains(t, errs, "tags 必须引用开始节点中 string[] 类型的 tagIds 输入")

	graph = validBlogGraph()
	graph.Nodes[0].Config = json.RawMessage(`{"inputs":{"markdownFile":{"type":"file","required":true},"visibility":{"type":"string"}}}`)
	errs = ValidateGraph(graph, DefaultRegistry())
	assertContains(t, errs, "tags 必须引用开始节点中 string[] 类型的 tagIds 输入")
}

func TestValidateGraphUsesDeclaredStartInputsForVariables(t *testing.T) {
	graph := validBlogGraph()
	graph.Nodes[0].Config = json.RawMessage(`{"inputs":{"markdownFile":{"type":"file","required":true},"tagIds":{"type":"string[]"},"visibility":{"type":"string"}}}`)
	graph.Nodes[2].Config = llmConfig("{{start.output.groupId}}")

	errs := ValidateGraph(graph, DefaultRegistry())
	assertContains(t, errs, "变量 start.output.groupId 不存在或不在上游")
}

func TestValidateGraphRejectsMappingTypeMismatch(t *testing.T) {
	graph := validBlogGraph()
	graph.Nodes[3].Config = json.RawMessage(`{"title":"{{summary.output.tokenUsage}}","content":"{{markdown.output.content}}","tags":"{{start.output.tagIds}}","tagMode":"merge","visibility":"{{start.output.visibility}}"}`)

	errs := ValidateGraph(graph, DefaultRegistry())
	assertContains(t, errs, "title 映射类型必须为 string，实际为 number")
}

func TestValidateGraphRejectsUnsupportedStartInputType(t *testing.T) {
	graph := validBlogGraph()
	graph.Nodes[0].Config = json.RawMessage(`{"inputs":{"markdownFile":{"type":"file","required":true},"tagIds":{"type":"string[]"},"visibility":{"type":"string"},"unknown":{"type":"binary"}}}`)

	errs := ValidateGraph(graph, DefaultRegistry())
	assertContains(t, errs, "开始节点输入 unknown 的类型 binary 不支持")
}

func TestValidateGraphRejectsDuplicateEdges(t *testing.T) {
	graph := validBlogGraph()
	graph.Edges = append(graph.Edges, graph.Edges[0])

	errs := ValidateGraph(graph, DefaultRegistry())
	assertContains(t, errs, "连线 start -> markdown 重复")
}

func TestValidateGraphReturnsErrorsInDeterministicOrder(t *testing.T) {
	graph := validBlogGraph()
	graph.Nodes[0].Config = json.RawMessage(`{"inputs":{"zeta":{"type":"binary"},"alpha":{"type":"binary"}}}`)

	want := ValidateGraph(graph, DefaultRegistry())
	for range 20 {
		if got := ValidateGraph(graph, DefaultRegistry()); !reflect.DeepEqual(got, want) {
			t.Fatalf("ValidateGraph() error order changed: first=%v got=%v", want, got)
		}
	}
}

func TestValidateGraphRejectsUnknownConfigAndInvalidProfiles(t *testing.T) {
	graph := validBlogGraph()
	graph.Nodes[2].Config = json.RawMessage(`{"modelProfile":"unsupported","systemPrompt":"summarize","prompt":"{{markdown.output.content}}","temperature":0.4,"maxOutputTokens":320,"unexpected":true}`)
	graph.Nodes[3].Config = json.RawMessage(`{"title":"{{markdown.output.title}}","content":"{{markdown.output.content}}","tags":"{{start.output.tagIds}}","tagMode":"anything","visibility":"{{start.output.visibility}}","unexpected":true}`)

	errs := ValidateGraph(graph, DefaultRegistry())
	assertContains(t, errs, "节点 summary 配置无效")
	assertContains(t, errs, "modelProfile 必须为 ark-text-default")
	assertContains(t, errs, "节点 draft 配置无效")
	assertContains(t, errs, "tagMode 必须为 merge 或 manual_only")
}

func TestValidateGraphAcceptsBlogImportGraph(t *testing.T) {
	graph := validBlogGraph()

	if errs := ValidateGraph(graph, DefaultRegistry()); len(errs) != 0 {
		t.Fatalf("ValidateGraph() errors = %v, want none", errs)
	}
}

func TestDefaultBlogImportGraphPassesMarkdownTagNamesToMergeDraft(t *testing.T) {
	graph := validBlogGraph()
	var config createDraftConfig
	if err := json.Unmarshal(graph.Nodes[3].Config, &config); err != nil {
		t.Fatalf("draft config = %v", err)
	}
	if config.TagMode != "merge" || config.SuggestedTags != "{{markdown.output.tagNames}}" {
		t.Fatalf("draft config = %#v, want merge mode with parsed tag names", config)
	}
}

func validBlogGraph() Graph {
	return Graph{
		SchemaVersion: 1,
		Nodes: []Node{
			{ID: "start", Type: NodeTypeStart, Config: startConfig()},
			{ID: "markdown", Type: NodeTypeBlogParse, Config: json.RawMessage(`{"fileInput":"markdownFile"}`)},
			{ID: "summary", Type: NodeTypeLLMText, Config: llmConfig("{{markdown.output.content}}")},
			{ID: "draft", Type: NodeTypeBlogCreateDraft, Config: draftConfig()},
			{ID: "end", Type: NodeTypeEnd, Config: json.RawMessage(`{"outputs":{"postId":"{{draft.output.postId}}","summary":"{{summary.output.text}}"}}`)},
		},
		Edges: []Edge{
			{Source: "start", SourceHandle: "output", Target: "markdown", TargetHandle: "input"},
			{Source: "markdown", SourceHandle: "output", Target: "summary", TargetHandle: "input"},
			{Source: "summary", SourceHandle: "output", Target: "draft", TargetHandle: "input"},
			{Source: "draft", SourceHandle: "output", Target: "end", TargetHandle: "input"},
		},
	}
}

func startConfig() json.RawMessage {
	return json.RawMessage(`{"inputs":{"markdownFile":{"type":"file","required":true},"tagIds":{"type":"string[]"},"groupId":{"type":"string"},"visibility":{"type":"string"}}}`)
}

func llmConfig(prompt string) json.RawMessage {
	return json.RawMessage(`{"modelProfile":"ark-text-default","systemPrompt":"summarize the article","prompt":"` + prompt + `","temperature":0.4,"maxOutputTokens":320}`)
}

func draftConfig() json.RawMessage {
	return json.RawMessage(`{"title":"{{markdown.output.title}}","content":"{{markdown.output.content}}","tags":"{{start.output.tagIds}}","suggestedTags":"{{markdown.output.tagNames}}","tagMode":"merge","visibility":"{{start.output.visibility}}"}`)
}

func assertContains(t *testing.T, errs []string, want string) {
	t.Helper()
	for _, err := range errs {
		if strings.Contains(err, want) {
			return
		}
	}
	t.Fatalf("errors %v do not contain %q", errs, want)
}
