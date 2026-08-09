// Package blog exposes owner-confirmed blog publishing to internal agents.
package blog

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"valley-server/internal/ai/tools"
	"valley-server/internal/ai/tools/artifact"
	"valley-server/internal/model"
	"valley-server/internal/service/blogworkflow"

	"gorm.io/gorm"
)

const ToolName = "blog.publish"

type createDraftFunc func(*gorm.DB, blogworkflow.CreateDraftInput) (blogworkflow.Draft, error)

type PublishTool struct {
	db          *gorm.DB
	createDraft createDraftFunc
}

type publishArgs struct {
	Title      string   `json:"title"`
	Content    string   `json:"content"`
	Excerpt    string   `json:"excerpt"`
	Visibility string   `json:"visibility"`
	Tags       []string `json:"tags"`
}

func NewPublishTool(db *gorm.DB) *PublishTool { return newPublishTool(db, blogworkflow.CreateDraft) }

func newPublishTool(db *gorm.DB, createDraft createDraftFunc) *PublishTool {
	return &PublishTool{db: db, createDraft: createDraft}
}

func (tool *PublishTool) Name() string  { return ToolName }
func (tool *PublishTool) Scope() string { return "workbench" }
func (tool *PublishTool) Description() string {
	return "为当前用户创建并发布博客文章。发布是持久写操作，必须先展示标题和可见范围并获得用户确认。"
}

func (tool *PublishTool) Schema() map[string]any {
	return map[string]any{
		"type": "object", "required": []string{"title", "content", "visibility"},
		"properties": map[string]any{
			"title":      map[string]any{"type": "string", "minLength": 1, "maxLength": 200},
			"content":    map[string]any{"type": "string", "minLength": 1, "maxLength": 2 * 1024 * 1024},
			"excerpt":    map[string]any{"type": "string", "maxLength": 500},
			"visibility": map[string]any{"type": "string", "enum": []string{"public", "private"}},
			"tags":       map[string]any{"type": "array", "items": map[string]any{"type": "string"}, "maxItems": 10},
		},
	}
}

func (tool *PublishTool) ToolContract() tools.Contract {
	return tools.Contract{
		OutputSchema: map[string]any{"type": "object", "required": []string{"postId", "title", "status", "visibility", "path"}},
		RiskLevel:    tools.RiskHigh, Confirmation: tools.ConfirmationBeforeWrite, ResultCard: tools.ResultCardTool,
	}
}

func (tool *PublishTool) Run(ctx context.Context, raw json.RawMessage) (json.RawMessage, error) {
	if tool == nil || tool.db == nil || tool.createDraft == nil {
		return nil, errors.New("blog.publish: service unavailable")
	}
	request, err := artifact.RequestFromContext(ctx)
	if err != nil {
		return nil, fmt.Errorf("blog.publish: %w", err)
	}
	var args publishArgs
	if json.Unmarshal(raw, &args) != nil {
		return nil, errors.New("blog.publish: invalid arguments")
	}
	args.Title = strings.TrimSpace(args.Title)
	args.Content = strings.TrimSpace(args.Content)
	args.Excerpt = strings.TrimSpace(args.Excerpt)
	args.Visibility = strings.ToLower(strings.TrimSpace(args.Visibility))
	if args.Title == "" || args.Content == "" || (args.Visibility != "public" && args.Visibility != "private") {
		return nil, errors.New("blog.publish: 标题、正文或可见范围无效")
	}
	draft, err := tool.createDraft(tool.db.WithContext(ctx), blogworkflow.CreateDraftInput{
		Title: args.Title, Content: args.Content, Excerpt: args.Excerpt,
		SuggestedTags: args.Tags, TagMode: blogworkflow.TagModeMerge,
		Visibility: args.Visibility, AuthorID: int64(request.UserID), ActorRole: "user",
	})
	if err != nil {
		return nil, fmt.Errorf("blog.publish: %w", err)
	}
	now := time.Now()
	result := tool.db.WithContext(ctx).Model(&model.Post{}).
		Where("id = ? AND author_id = ? AND status = ?", draft.PostID, request.UserID, "draft").
		Updates(map[string]any{"status": "published", "visibility": args.Visibility, "published_at": now})
	if result.Error != nil || result.RowsAffected != 1 {
		return nil, errors.New("blog.publish: 博客草稿创建成功，但发布失败")
	}
	return json.Marshal(map[string]any{
		"ok": true, "postId": draft.PostID, "title": draft.Title,
		"status": "published", "visibility": args.Visibility, "path": "/blog/" + draft.PostID,
		"publishedAt": now,
	})
}

var _ tools.Tool = (*PublishTool)(nil)
