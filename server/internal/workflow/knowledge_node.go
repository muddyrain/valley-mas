package workflow

import (
	"context"
	"fmt"
	"strings"
)

// KnowledgeRetrieveExecutor delegates lookup to a handler-provided retriever.
// The executor never selects a knowledge base itself, so owner and version
// snapshot checks remain at the application boundary.
type KnowledgeRetrieveExecutor struct{}

func (KnowledgeRetrieveExecutor) Type() NodeType { return NodeTypeKnowledgeRetrieve }

func (KnowledgeRetrieveExecutor) Execute(ctx context.Context, run RunContext, execution NodeExecution) (NodeResult, error) {
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
