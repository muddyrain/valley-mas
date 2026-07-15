package workflow

import (
	"context"
	"testing"
)

func TestKnowledgeRetrieveExecutorReturnsOnlyRetrieverResult(t *testing.T) {
	executor := KnowledgeRetrieveExecutor{}
	result, err := executor.Execute(context.Background(), RunContext{KnowledgeRetriever: KnowledgeRetrieverFunc(func(_ context.Context, query string) (KnowledgeResult, error) {
		if query != "创作主题" {
			t.Fatalf("query = %q", query)
		}
		return KnowledgeResult{Context: "资料摘要", References: []KnowledgeReference{{DocumentName: "notes.md", ChunkID: "chunk-1", Excerpt: "摘要", Score: 0.8}}}, nil
	})}, NodeExecution{Input: map[string]any{"query": "创作主题"}})
	if err != nil {
		t.Fatalf("Execute() error = %v", err)
	}
	if result.Output["context"] != "资料摘要" {
		t.Fatalf("context = %#v", result.Output["context"])
	}
	references, ok := result.Output["references"].([]KnowledgeReference)
	if !ok || len(references) != 1 || references[0].DocumentName != "notes.md" {
		t.Fatalf("references = %#v", result.Output["references"])
	}
}
