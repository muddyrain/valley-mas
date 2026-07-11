package workflow

import (
	"context"
	"fmt"
	"strconv"
	"strings"

	"valley-server/internal/database"
	"valley-server/internal/service/blogworkflow"
)

// BlogParseExecutor converts the runtime-only uploaded file into normalized
// Markdown fields. It never returns the original file bytes.
type BlogParseExecutor struct{}

func (BlogParseExecutor) Type() NodeType { return NodeTypeBlogParse }

func (BlogParseExecutor) Execute(_ context.Context, _ RunContext, execution NodeExecution) (NodeResult, error) {
	file, err := fileFromValue(execution.Input["fileInput"])
	if err != nil {
		return NodeResult{}, err
	}
	parsed, err := blogworkflow.ParseMarkdown(file.Filename, file.Content)
	if err != nil {
		return NodeResult{}, err
	}
	return NodeResult{Output: map[string]any{
		"title":    parsed.Title,
		"content":  parsed.Content,
		"excerpt":  parsed.Excerpt,
		"cover":    map[string]any{"url": parsed.Cover},
		"tagNames": parsed.FrontMatterTag,
		"frontMatter": map[string]any{
			"excerpt": parsed.Excerpt,
			"cover":   parsed.Cover,
			"tags":    parsed.FrontMatterTag,
		},
	}}, nil
}

// BlogCreateDraftExecutor writes the final draft. The actor comes from the
// trusted RunContext, never graph configuration.
type BlogCreateDraftExecutor struct{}

func (BlogCreateDraftExecutor) Type() NodeType { return NodeTypeBlogCreateDraft }

func (BlogCreateDraftExecutor) Execute(ctx context.Context, run RunContext, execution NodeExecution) (NodeResult, error) {
	if err := ctx.Err(); err != nil {
		return NodeResult{}, err
	}
	manualTagIDs, err := stringListFromValue(execution.Input["tags"])
	if err != nil {
		return NodeResult{}, fmt.Errorf("草稿节点 tags 无效: %w", err)
	}
	suggestedTags, err := optionalStringListFromValue(execution.Input["suggestedTags"])
	if err != nil {
		return NodeResult{}, fmt.Errorf("草稿节点 suggestedTags 无效: %w", err)
	}
	groupID, err := optionalInt64FromValue(run.Inputs["groupId"])
	if err != nil {
		return NodeResult{}, fmt.Errorf("开始节点 groupId 无效: %w", err)
	}
	draft, err := blogworkflow.CreateDraft(database.DB.WithContext(ctx), blogworkflow.CreateDraftInput{
		Title:         stringFromValue(execution.Input["title"]),
		Content:       stringFromValue(execution.Input["content"]),
		Excerpt:       stringFromValue(execution.Input["excerpt"]),
		Cover:         coverURLFromValue(execution.Input["cover"]),
		ManualTagIDs:  manualTagIDs,
		SuggestedTags: suggestedTags,
		TagMode:       stringFromValue(execution.Input["tagMode"]),
		Visibility:    stringFromValue(execution.Input["visibility"]),
		GroupID:       groupID,
		AuthorID:      run.Actor.UserID,
		ActorRole:     run.Actor.Role,
	})
	if err != nil {
		return NodeResult{}, err
	}
	return NodeResult{Output: map[string]any{
		"postId":   draft.PostID,
		"title":    draft.Title,
		"editPath": "/my-space/blog-edit/" + draft.PostID,
		"tagIds":   draft.TagIDs,
	}}, nil
}

func fileFromValue(value any) (FileInput, error) {
	switch typed := value.(type) {
	case FileInput:
		return typed, nil
	case *FileInput:
		if typed != nil {
			return *typed, nil
		}
	}
	return FileInput{}, fmt.Errorf("Markdown 文件不存在")
}

func stringFromValue(value any) string {
	text, _ := value.(string)
	return strings.TrimSpace(text)
}

func stringListFromValue(value any) ([]string, error) {
	switch typed := value.(type) {
	case []string:
		return append([]string(nil), typed...), nil
	case []any:
		result := make([]string, len(typed))
		for index, item := range typed {
			text, ok := item.(string)
			if !ok {
				return nil, fmt.Errorf("第 %d 项不是字符串", index)
			}
			result[index] = text
		}
		return result, nil
	default:
		return nil, fmt.Errorf("必须是 string[]")
	}
}

func optionalStringListFromValue(value any) ([]string, error) {
	if value == nil {
		return nil, nil
	}
	return stringListFromValue(value)
}

func optionalInt64FromValue(value any) (int64, error) {
	if value == nil || value == "" {
		return 0, nil
	}
	switch typed := value.(type) {
	case int64:
		return typed, nil
	case int:
		return int64(typed), nil
	case float64:
		return int64(typed), nil
	case string:
		return strconv.ParseInt(strings.TrimSpace(typed), 10, 64)
	default:
		return 0, fmt.Errorf("必须是整数")
	}
}

func coverURLFromValue(value any) string {
	if text, ok := value.(string); ok {
		return strings.TrimSpace(text)
	}
	if object, ok := value.(map[string]any); ok {
		return stringFromValue(object["url"])
	}
	return ""
}
