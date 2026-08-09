package blog

import (
	"context"
	"encoding/json"
	"testing"

	"valley-server/internal/ai/tools"
	"valley-server/internal/ai/tools/artifact"
	"valley-server/internal/model"
	"valley-server/internal/service/blogworkflow"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func TestPublishToolRequiresConfirmationAndPublishesOwnedPost(t *testing.T) {
	db, err := gorm.Open(sqlite.Open("file:"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(&model.Post{}); err != nil {
		t.Fatal(err)
	}
	createDraft := func(_ *gorm.DB, input blogworkflow.CreateDraftInput) (blogworkflow.Draft, error) {
		post := model.Post{Title: input.Title, Slug: "draft-post", Content: input.Content, AuthorID: model.Int64String(input.AuthorID), Status: "draft", Visibility: input.Visibility, PostType: "blog"}
		if err := db.Create(&post).Error; err != nil {
			return blogworkflow.Draft{}, err
		}
		return blogworkflow.Draft{PostID: post.ID.String(), Title: post.Title}, nil
	}
	tool := newPublishTool(db, createDraft)
	contract := tools.ContractFor(tool)
	if contract.Confirmation != tools.ConfirmationBeforeWrite {
		t.Fatalf("contract = %#v", contract)
	}
	ctx := artifact.WithRequestContext(context.Background(), artifact.RequestContext{UserID: 101, AppID: 11, ConversationID: 12, RunID: 13})
	raw, err := tool.Run(ctx, json.RawMessage(`{"title":"公开文章","content":"正文","visibility":"public"}`))
	if err != nil {
		t.Fatal(err)
	}
	var result map[string]any
	_ = json.Unmarshal(raw, &result)
	var post model.Post
	if err := db.First(&post, result["postId"]).Error; err != nil || post.Status != "published" || post.PublishedAt == nil || post.AuthorID != 101 {
		t.Fatalf("post = %#v result=%s err=%v", post, raw, err)
	}
}
