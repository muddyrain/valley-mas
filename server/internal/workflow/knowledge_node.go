package workflow

import (
	"context"
	"fmt"
	"strings"
	"unicode/utf8"
)

// KnowledgeRetrieveExecutor delegates lookup to a handler-provided retriever.
// The executor never selects a knowledge base itself, so owner and version
// snapshot checks remain at the application boundary.
type KnowledgeRetrieveCapabilityAdapter struct{}

func (KnowledgeRetrieveCapabilityAdapter) Execute(ctx context.Context, run RunContext, execution NodeExecution) (NodeResult, error) {
	if run.KnowledgeRetriever == nil {
		return NodeResult{}, fmt.Errorf("知识库检索未配置")
	}
	query := strings.TrimSpace(stringFromValue(execution.Input["query"]))
	if query == "" {
		return NodeResult{}, fmt.Errorf("知识检索 query 不能为空")
	}
	result, err := run.KnowledgeRetriever.Retrieve(ctx, query)
	if err != nil {
		return NodeResult{}, err
	}
	return NodeResult{Output: map[string]any{"context": result.Context, "references": result.References}}, nil
}

// KnowledgeWriteCapabilityAdapter creates an owner-private document and
// delegates its asynchronous indexing to the handler-provided writer.
type KnowledgeWriteCapabilityAdapter struct{}

func (KnowledgeWriteCapabilityAdapter) Execute(
	ctx context.Context,
	run RunContext,
	execution NodeExecution,
) (NodeResult, error) {
	if run.KnowledgeWriter == nil {
		return NodeResult{}, fmt.Errorf("知识库写入未配置")
	}
	request := KnowledgeWriteRequest{
		KnowledgeBaseID: strings.TrimSpace(stringFromValue(execution.Input["knowledgeBaseId"])),
		Name:            strings.TrimSpace(stringFromValue(execution.Input["name"])),
		Content:         strings.TrimSpace(stringFromValue(execution.Input["content"])),
	}
	if request.KnowledgeBaseID == "" {
		return NodeResult{}, fmt.Errorf("目标知识库不能为空")
	}
	if request.Name == "" {
		return NodeResult{}, fmt.Errorf("知识库文档名称不能为空")
	}
	if request.Content == "" {
		return NodeResult{}, fmt.Errorf("知识库文档内容不能为空")
	}
	result, err := run.KnowledgeWriter.Write(ctx, run.Actor.UserID, request)
	if err != nil {
		return NodeResult{}, err
	}
	return NodeResult{Output: map[string]any{
		"documentId": result.DocumentID,
		"status":     result.Status,
		"chunkCount": result.ChunkCount,
	}}, nil
}

const maxKnowledgeReferenceExcerptRunes = 240

// KnowledgeFormatReferencesCapabilityAdapter turns retrieval metadata into
// deterministic citation-ready text. It does not call a model or re-query the
// knowledge base.
type KnowledgeFormatReferencesCapabilityAdapter struct{}

func (KnowledgeFormatReferencesCapabilityAdapter) Execute(_ context.Context, _ RunContext, execution NodeExecution) (NodeResult, error) {
	references, err := knowledgeReferencesFromValue(execution.Input["references"])
	if err != nil {
		return NodeResult{}, err
	}
	style := stringFromValue(execution.Input["style"])
	if style == "" {
		style = "markdown"
	}
	if style != "markdown" && style != "numbered" {
		return NodeResult{}, fmt.Errorf("引用样式必须为 markdown 或 numbered")
	}

	seen := make(map[string]struct{}, len(references))
	items := make([]map[string]any, 0, len(references))
	lines := make([]string, 0, len(references))
	for _, reference := range references {
		name := strings.TrimSpace(reference.DocumentName)
		if name == "" {
			name = "未命名文档"
		}
		excerpt := trimKnowledgeExcerpt(reference.Excerpt)
		key := strings.TrimSpace(reference.ChunkID)
		if key == "" {
			key = name + "\x00" + excerpt
		}
		if _, exists := seen[key]; exists {
			continue
		}
		seen[key] = struct{}{}
		index := len(items) + 1
		items = append(items, map[string]any{
			"index":        index,
			"documentName": name,
			"chunkId":      reference.ChunkID,
			"excerpt":      excerpt,
			"score":        reference.Score,
		})
		if style == "numbered" {
			lines = append(lines, fmt.Sprintf("%d. %s：%s", index, name, excerpt))
		} else {
			lines = append(lines, fmt.Sprintf("[%d] **%s** — %s", index, name, excerpt))
		}
	}
	return NodeResult{Output: map[string]any{
		"citationText":  strings.Join(lines, "\n"),
		"referenceList": items,
		"count":         len(items),
	}}, nil
}

func knowledgeReferencesFromValue(value any) ([]KnowledgeReference, error) {
	switch typed := value.(type) {
	case []KnowledgeReference:
		return append([]KnowledgeReference(nil), typed...), nil
	case []any:
		result := make([]KnowledgeReference, 0, len(typed))
		for index, item := range typed {
			switch reference := item.(type) {
			case KnowledgeReference:
				result = append(result, reference)
			case map[string]any:
				result = append(result, KnowledgeReference{
					DocumentName: stringFromValue(reference["documentName"]),
					ChunkID:      stringFromValue(reference["chunkId"]),
					Excerpt:      stringFromValue(reference["excerpt"]),
					Score:        numberFromValue(reference["score"]),
				})
			default:
				return nil, fmt.Errorf("知识引用第 %d 项无效", index+1)
			}
		}
		return result, nil
	default:
		return nil, fmt.Errorf("知识引用必须是引用列表")
	}
}

func trimKnowledgeExcerpt(value string) string {
	value = strings.Join(strings.Fields(value), " ")
	if utf8.RuneCountInString(value) <= maxKnowledgeReferenceExcerptRunes {
		return value
	}
	runes := []rune(value)
	return string(runes[:maxKnowledgeReferenceExcerptRunes]) + "…"
}
