package content

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"valley-server/internal/ai/tools"
	"valley-server/internal/model"

	"gorm.io/gorm"
)

const (
	toolName      = "content.search"
	toolScope     = "workbench"
	maxQueryRunes = 120
	maxResults    = 5
	dateLayout    = "2006-01-02"
)

var chinaStandardTime = time.FixedZone("CST", 8*60*60)

type ownerContextKey struct{}

type SearchTool struct {
	db *gorm.DB
}

type searchArgs struct {
	Query       string `json:"query"`
	CreatedFrom string `json:"createdFrom"`
	CreatedTo   string `json:"createdTo"`
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
	return "按关键词搜索当前用户自己创建的博客和资源；提供创建日期端点时仅搜索博客，返回标题、摘要和站内链接。"
}

func (t *SearchTool) Schema() map[string]any {
	return map[string]any{
		"type": "object",
		"anyOf": []map[string]any{
			{"required": []string{"query"}},
			{"required": []string{"createdFrom"}},
			{"required": []string{"createdTo"}},
		},
		"properties": map[string]any{
			"query": map[string]any{
				"type":        "string",
				"minLength":   1,
				"maxLength":   maxQueryRunes,
				"description": "可选关键词；与创建日期筛选至少提供一项。",
			},
			"createdFrom": map[string]any{
				"type":        "string",
				"format":      "date",
				"description": "可单独提供的创建日期下限（YYYY-MM-DD，CST）；省略时不限制最早创建日期。",
			},
			"createdTo": map[string]any{
				"type":        "string",
				"format":      "date",
				"description": "可单独提供的创建日期上限（YYYY-MM-DD，CST，含当天）；省略时不限制最晚创建日期。",
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
	if query != "" && len([]rune(query)) > maxQueryRunes {
		return nil, errors.New("content.search: query must contain 1 to 120 characters")
	}
	createdFrom, createdUntil, hasDateRange, err := parseCreatedDateRange(args.CreatedFrom, args.CreatedTo)
	if err != nil {
		return nil, err
	}
	if query == "" && !hasDateRange {
		return nil, errors.New("content.search: query or created date range is required")
	}

	items := make([]searchItem, 0, maxResults)
	var posts []model.Post
	postQuery := t.db.Where("author_id = ?", userID)
	if query != "" {
		like := "%" + query + "%"
		postQuery = postQuery.Where("LOWER(title) LIKE LOWER(?) OR LOWER(excerpt) LIKE LOWER(?) OR LOWER(content) LIKE LOWER(?)", like, like, like)
	}
	if hasDateRange {
		if !createdFrom.IsZero() {
			postQuery = postQuery.Where("created_at >= ?", createdFrom)
		}
		if !createdUntil.IsZero() {
			postQuery = postQuery.Where("created_at < ?", createdUntil)
		}
	}
	orderBy := "updated_at DESC"
	if hasDateRange {
		orderBy = "created_at DESC"
	}
	if err := postQuery.Order(orderBy).Limit(maxResults).Find(&posts).Error; err != nil {
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
	if !hasDateRange && len(items) < maxResults {
		like := "%" + query + "%"
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

func parseCreatedDateRange(rawFrom, rawTo string) (time.Time, time.Time, bool, error) {
	createdFrom := strings.TrimSpace(rawFrom)
	createdTo := strings.TrimSpace(rawTo)
	if createdFrom == "" && createdTo == "" {
		return time.Time{}, time.Time{}, false, nil
	}
	var from time.Time
	if createdFrom != "" {
		parsedFrom, err := time.ParseInLocation(dateLayout, createdFrom, chinaStandardTime)
		if err != nil {
			return time.Time{}, time.Time{}, false, errors.New("content.search: createdFrom must be YYYY-MM-DD")
		}
		from = parsedFrom
	}
	var until time.Time
	if createdTo != "" {
		to, err := time.ParseInLocation(dateLayout, createdTo, chinaStandardTime)
		if err != nil {
			return time.Time{}, time.Time{}, false, errors.New("content.search: createdTo must be YYYY-MM-DD")
		}
		if !from.IsZero() && from.After(to) {
			return time.Time{}, time.Time{}, false, errors.New("content.search: createdFrom must not be after createdTo")
		}
		until = to.AddDate(0, 0, 1)
	}
	if !from.IsZero() && !until.IsZero() && !from.Before(until) {
		return time.Time{}, time.Time{}, false, errors.New("content.search: createdFrom must not be after createdTo")
	}
	return from, until, true, nil
}

var _ tools.Tool = (*SearchTool)(nil)
