package workflow

import (
	"context"
	"strings"
	"testing"
)

func TestDocumentExtractCapabilityReturnsStableFields(t *testing.T) {
	result, err := (DocumentExtractCapabilityAdapter{}).Execute(
		context.Background(),
		RunContext{},
		NodeExecution{Input: map[string]any{"fileInput": FileInput{
			Filename: "notes.txt",
			Content:  []byte("第一段\n\n第二段"),
		}}},
	)
	if err != nil {
		t.Fatal(err)
	}
	if result.Output["format"] != "text" || result.Output["pageCount"] != 1 ||
		result.Output["text"] != "第一段\n\n第二段" {
		t.Fatalf("unexpected document output: %#v", result.Output)
	}
}

func TestStructuredExtractCapabilityValidatesModelOutput(t *testing.T) {
	adapter := StructuredExtractCapabilityAdapter{Generator: textGeneratorFunc(func(
		_ context.Context,
		request TextGenerationRequest,
	) (TextGenerationResult, error) {
		if request.ModelID != "12" || !strings.Contains(request.Prompt, "待提取文本") {
			t.Fatalf("unexpected request: %+v", request)
		}
		return TextGenerationResult{
			Text:  `{"title":"Valley","tags":["AI","工作流"],"score":9}`,
			Model: "text-model", TokenUsage: 18,
		}, nil
	})}
	result, err := adapter.Execute(context.Background(), RunContext{}, NodeExecution{Input: map[string]any{
		"modelId": "12",
		"text":    "标题是 Valley，标签为 AI、工作流，评分 9。",
		"schema": map[string]any{
			"title": "string",
			"tags":  "string[]",
			"score": "number",
		},
	}})
	if err != nil {
		t.Fatal(err)
	}
	data, ok := result.Output["data"].(map[string]any)
	if !ok || data["title"] != "Valley" || result.Output["tokenUsage"] != 18 {
		t.Fatalf("unexpected structured output: %#v", result.Output)
	}
}

func TestJSONParseCapabilityRejectsMultipleRootValues(t *testing.T) {
	_, err := (JSONParseCapabilityAdapter{}).Execute(
		context.Background(),
		RunContext{},
		NodeExecution{Input: map[string]any{"text": `{"ok":true} {"extra":true}`}},
	)
	if err == nil || !strings.Contains(err.Error(), "只能包含一个") {
		t.Fatalf("expected trailing JSON error, got %v", err)
	}
}

func TestChunkListCapabilityCreatesLoopReadyBatches(t *testing.T) {
	result, err := (ChunkListCapabilityAdapter{}).Execute(
		context.Background(),
		RunContext{},
		NodeExecution{Input: map[string]any{
			"items":     []any{"a", "b", "c", "d", "e"},
			"batchSize": 2,
		}},
	)
	if err != nil {
		t.Fatal(err)
	}
	batches, ok := result.Output["batches"].([]any)
	if !ok || len(batches) != 3 || result.Output["itemCount"] != 5 {
		t.Fatalf("unexpected batches: %#v", result.Output)
	}
}

func TestKnowledgeFormatReferencesDeduplicatesChunks(t *testing.T) {
	references := []KnowledgeReference{
		{DocumentName: "指南", ChunkID: "chunk-1", Excerpt: "第一段"},
		{DocumentName: "指南", ChunkID: "chunk-1", Excerpt: "重复段"},
		{DocumentName: "规范", ChunkID: "chunk-2", Excerpt: "第二段"},
	}
	result, err := (KnowledgeFormatReferencesCapabilityAdapter{}).Execute(
		context.Background(),
		RunContext{},
		NodeExecution{Input: map[string]any{"references": references, "style": "markdown"}},
	)
	if err != nil {
		t.Fatal(err)
	}
	if result.Output["count"] != 2 || !strings.Contains(result.Output["citationText"].(string), "[2]") {
		t.Fatalf("unexpected references: %#v", result.Output)
	}
}
