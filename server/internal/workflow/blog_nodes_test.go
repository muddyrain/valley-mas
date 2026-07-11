package workflow

import (
	"context"
	"path/filepath"
	"strings"
	"testing"

	"valley-server/internal/database"
	"valley-server/internal/model"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func TestBlogParseExecutorRejectsEmptyMarkdown(t *testing.T) {
	_, err := (BlogParseExecutor{}).Execute(context.Background(), RunContext{}, NodeExecution{Input: map[string]any{
		"fileInput": FileInput{Filename: "empty.md", Content: []byte("---\ntitle: Empty\n---\n")},
	}})
	if err == nil || !strings.Contains(err.Error(), "内容为空") {
		t.Fatalf("Execute() error = %v, want empty Markdown error", err)
	}
}

func TestLLMTextExecutorFailsBeforeNetworkWhenARKIsNotConfigured(t *testing.T) {
	t.Setenv("ARK_API_KEY", "")
	t.Setenv("ARK_TEXT_MODEL", "")
	_, err := (LLMTextExecutor{}).Execute(context.Background(), RunContext{}, NodeExecution{Input: llmExecutionInput()})
	if err == nil || !strings.Contains(err.Error(), "缺少 ARK_API_KEY") {
		t.Fatalf("Execute() error = %v, want ARK configuration error", err)
	}
}

func TestLLMTextExecutorUsesInjectedGenerator(t *testing.T) {
	fake := fakeTextGenerator{result: TextGenerationResult{Text: "Summary", Model: "ep-test", TokenUsage: 7}}
	result, err := (LLMTextExecutor{Generator: fake}).Execute(context.Background(), RunContext{}, NodeExecution{Input: llmExecutionInput()})
	if err != nil {
		t.Fatalf("Execute() error = %v", err)
	}
	if result.Output["text"] != "Summary" || result.Output["tokenUsage"] != 7 {
		t.Fatalf("output = %#v", result.Output)
	}
}

func TestBlogCreateDraftExecutorHonorsCanceledContextBeforeWritingPost(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(filepath.Join(t.TempDir(), "workflow-draft.db")), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatalf("open sqlite connection: %v", err)
	}
	sqlDB.SetMaxOpenConns(1)
	t.Cleanup(func() { _ = sqlDB.Close() })
	if err := db.AutoMigrate(&model.Post{}, &model.PostCategory{}, &model.PostGroup{}, &model.PostTag{}, &model.PostTagRelation{}); err != nil {
		t.Fatalf("migrate draft models: %v", err)
	}
	previousDB := database.DB
	database.DB = db
	t.Cleanup(func() { database.DB = previousDB })
	ctx, cancel := context.WithCancel(context.Background())
	callbackName := "workflow_cancel_draft_transaction"
	if err := db.Callback().Query().Before("gorm:query").Register(callbackName, func(*gorm.DB) { cancel() }); err != nil {
		t.Fatalf("register cancellation callback: %v", err)
	}
	defer db.Callback().Query().Remove(callbackName)
	_, err = (BlogCreateDraftExecutor{}).Execute(ctx, RunContext{Actor: Actor{UserID: 101, Role: "user"}}, NodeExecution{Input: map[string]any{
		"title":      "Canceled draft",
		"content":    "content",
		"tags":       []string{},
		"tagMode":    "manual_only",
		"visibility": "private",
	}})
	if err == nil {
		t.Fatal("Execute() error = nil, want cancellation")
	}
	var posts int64
	if err := db.Model(&model.Post{}).Count(&posts).Error; err != nil {
		t.Fatalf("count posts: %v", err)
	}
	if posts != 0 {
		t.Fatalf("post count = %d, canceled draft was written", posts)
	}
}

func TestBlogCreateDraftExecutorReturnsMySpaceEditPath(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(filepath.Join(t.TempDir(), "workflow-edit-path.db")), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatalf("open sqlite connection: %v", err)
	}
	t.Cleanup(func() { _ = sqlDB.Close() })
	if err := db.AutoMigrate(&model.Post{}, &model.PostCategory{}, &model.PostGroup{}, &model.PostTag{}, &model.PostTagRelation{}); err != nil {
		t.Fatalf("migrate draft models: %v", err)
	}
	previousDB := database.DB
	database.DB = db
	t.Cleanup(func() { database.DB = previousDB })

	result, err := (BlogCreateDraftExecutor{}).Execute(context.Background(), RunContext{Actor: Actor{UserID: 101, Role: "user"}}, NodeExecution{Input: map[string]any{
		"title":      "Imported draft",
		"content":    "content",
		"tags":       []string{},
		"tagMode":    "manual_only",
		"visibility": "private",
	}})
	if err != nil {
		t.Fatalf("Execute() error = %v", err)
	}
	postID, ok := result.Output["postId"].(string)
	if !ok || postID == "" {
		t.Fatalf("postId = %#v, want non-empty string", result.Output["postId"])
	}
	if got, want := result.Output["editPath"], "/my-space/blog-edit/"+postID; got != want {
		t.Fatalf("editPath = %q, want %q", got, want)
	}
}

type fakeTextGenerator struct {
	result TextGenerationResult
	err    error
}

func (generator fakeTextGenerator) Generate(_ context.Context, _ TextGenerationRequest) (TextGenerationResult, error) {
	return generator.result, generator.err
}

func llmExecutionInput() map[string]any {
	return map[string]any{
		"modelProfile":    "ark-text-default",
		"systemPrompt":    "Summarize the article.",
		"prompt":          "Article body",
		"temperature":     float64(0.2),
		"maxOutputTokens": float64(120),
	}
}
