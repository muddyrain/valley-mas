package workflow

import (
	"context"
	"testing"

	"valley-server/internal/database"
	"valley-server/internal/model"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func TestBlogCreateDraftExecutorTracksGeneratedCoverStorageKey(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open database: %v", err)
	}
	if err := db.AutoMigrate(
		&model.AIImageGeneration{},
		&model.Post{},
		&model.PostCategory{},
		&model.PostGroup{},
		&model.PostTag{},
		&model.PostTagRelation{},
	); err != nil {
		t.Fatalf("migrate database: %v", err)
	}

	previousDB := database.DB
	database.DB = db
	t.Cleanup(func() { database.DB = previousDB })

	coverURL := "https://bucket.tos-cn-beijing.volces.com/ai-images/101/generated.png"
	if err := db.Create(&model.AIImageGeneration{
		ID:               10,
		UserID:           101,
		ModelCatalogID:   1,
		ResultURL:        coverURL,
		ResultStorageKey: "ai-images/101/generated.png",
		Status:           "succeeded",
		Stage:            "completed",
	}).Error; err != nil {
		t.Fatalf("create generation: %v", err)
	}

	result, err := (BlogCreateDraftCapabilityAdapter{}).Execute(context.Background(), RunContext{
		Actor: Actor{UserID: 101, Role: "user"},
	}, NodeExecution{Input: map[string]any{
		"title":      "Generated post",
		"content":    "Body",
		"cover":      coverURL,
		"tags":       []string{},
		"visibility": "private",
	}})
	if err != nil {
		t.Fatalf("execute create draft: %v", err)
	}

	var post model.Post
	if err := db.First(&post, result.Output["postId"]).Error; err != nil {
		t.Fatalf("load post: %v", err)
	}
	if post.CoverStorageKey != "ai-images/101/generated.png" {
		t.Fatalf("cover storage key = %q", post.CoverStorageKey)
	}
}
