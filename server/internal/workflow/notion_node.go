package workflow

import (
	"context"
	"fmt"
	"strings"
)

type NotionSearchCapabilityAdapter struct{}

func (NotionSearchCapabilityAdapter) Execute(ctx context.Context, run RunContext, execution NodeExecution) (NodeResult, error) {
	if run.NotionSearcher == nil {
		return NodeResult{}, fmt.Errorf("Notion 搜索未配置")
	}
	query := strings.TrimSpace(stringFromValue(execution.Input["query"]))
	if length := len([]rune(query)); length == 0 || length > 200 {
		return NodeResult{}, fmt.Errorf("Notion 搜索关键词需为 1 到 200 个字符")
	}
	limit := int(numberFromValue(execution.Input["limit"]))
	if limit == 0 {
		limit = 5
	}
	if limit < 1 || limit > 10 {
		return NodeResult{}, fmt.Errorf("Notion 搜索结果数量需为 1 到 10")
	}
	result, err := run.NotionSearcher.Search(ctx, query, limit)
	if err != nil {
		return NodeResult{}, err
	}
	return NodeResult{Output: map[string]any{"count": len(result.Items), "results": result.Items}}, nil
}
