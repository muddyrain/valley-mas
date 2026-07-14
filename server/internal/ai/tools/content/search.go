package content

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"valley-server/internal/ai/tools"
	"valley-server/internal/model"

	"gorm.io/gorm"
)

const (
	toolName      = "content.search"
	toolScope     = "workbench"
	maxQueryRunes = 120
	maxResults    = 5
)

type ownerContextKey struct{}

type SearchTool struct {
	db *gorm.DB
}

type searchArgs struct {
	Query string `json:"query"`
}

type searchItem struct {
	Type    string            `json:"type"`
	ID      model.Int64String `json:"id"`
	Title   string            `json:"title"`
	Excerpt string            `json:"excerpt"`
	Href    string            `json:"href"`
}

func WithOwner(ctx context.Context, userID model.Int64String) context.Context {
	return context.WithValue(ctx, ownerContextKey{}, userID)
}

func ownerFromContext(ctx context.Context) (model.Int64String, error) {
	userID, ok := ctx.Value(ownerContextKey{}).(model.Int64String)
	if !ok || userID <= 0 {
		return 0, errors.New("content.search: owner missing")
	}
	return userID, nil
}

func NewSearchTool(db *gorm.DB) *SearchTool {
	return &SearchTool{db: db}
}

func (t *SearchTool) Name() string { return toolName }

func (t *SearchTool) Description() string {
	return "搜索当前用户自己创建的博客和资源，返回标题、摘要和站内链接。"
}

func (t *SearchTool) Schema() map[string]any {
	return map[string]any{
		"type":     "object",
		"required": []string{"query"},
		"properties": map[string]any{
			"query": map[string]any{
				"type":      "string",
				"minLength": 1,
				"maxLength": maxQueryRunes,
			},
		},
	}
}

func (t *SearchTool) Scope() string { return toolScope }

func (t *SearchTool) Run(ctx context.Context, raw json.RawMessage) (json.RawMessage, error) {
	if t == nil || t.db == nil {
		return nil, errors.New("content.search: database unavailable")
	}
	userID, err := ownerFromContext(ctx)
	if err != nil {
		return nil, err
	}
	var args searchArgs
	if err := json.Unmarshal(raw, &args); err != nil {
		return nil, errors.New("content.search: invalid arguments")
	}
	query := strings.TrimSpace(args.Query)
	if query == "" || len([]rune(query)) > maxQueryRunes {
		return nil, errors.New("content.search: query must contain 1 to 120 characters")
	}

	like := "%" + query + "%"
	items := make([]searchItem, 0, maxResults)
	var posts []model.Post
	if err := t.db.Where("author_id = ? AND (LOWER(title) LIKE LOWER(?) OR LOWER(excerpt) LIKE LOWER(?) OR LOWER(content) LIKE LOWER(?))", userID, like, like, like).
		Order("updated_at DESC").Limit(maxResults).Find(&posts).Error; err != nil {
		return nil, fmt.Errorf("content.search: query posts: %w", err)
	}
	for _, post := range posts {
		items = append(items, searchItem{
			Type:    "blog",
			ID:      post.ID,
			Title:   post.Title,
			Excerpt: post.Excerpt,
			Href:    "/blog/" + post.ID.String(),
		})
	}
	if len(items) < maxResults {
		var resources []model.Resource
		if err := t.db.Where("user_id = ? AND (LOWER(title) LIKE LOWER(?) OR LOWER(description) LIKE LOWER(?))", userID, like, like).
			Order("updated_at DESC").Limit(maxResults - len(items)).Find(&resources).Error; err != nil {
			return nil, fmt.Errorf("content.search: query resources: %w", err)
		}
		for _, resource := range resources {
			items = append(items, searchItem{
				Type:    "resource",
				ID:      resource.ID,
				Title:   resource.Title,
				Excerpt: resource.Description,
				Href:    "/resource/" + resource.ID.String(),
			})
		}
	}

	return json.Marshal(map[string]any{"ok": true, "query": query, "items": items})
}

var _ tools.Tool = (*SearchTool)(nil)
