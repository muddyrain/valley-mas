package blogworkflow

import (
	"strings"
	"testing"

	"valley-server/internal/model"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func TestParseMarkdownRejectsEmptyBody(t *testing.T) {
	_, err := ParseMarkdown("empty.md", []byte("---\ntitle: Empty\n---\n\n"))
	if err == nil || !strings.Contains(err.Error(), "内容为空") {
		t.Fatalf("ParseMarkdown() error = %v, want empty body error", err)
	}
}

func TestCreateDraftRetainsManualTags(t *testing.T) {
	db := newTestDB(t)
	manual := model.PostTag{ID: 11, Name: "Manual", Slug: "manual"}
	if err := db.Create(&manual).Error; err != nil {
		t.Fatalf("create tag: %v", err)
	}

	draft, err := CreateDraft(db, CreateDraftInput{
		Title:         "Imported",
		Content:       "# Imported\nContent",
		ManualTagIDs:  []string{"11"},
		SuggestedTags: []string{"Automatic"},
		TagMode:       TagModeMerge,
		Visibility:    "private",
		AuthorID:      101,
		ActorRole:     "user",
	})
	if err != nil {
		t.Fatalf("CreateDraft() error = %v", err)
	}
	if !contains(draft.TagIDs, "11") {
		t.Fatalf("draft tag ids = %v, manual tag was dropped", draft.TagIDs)
	}
	if len(draft.TagIDs) != 2 {
		t.Fatalf("draft tag ids = %v, want manual + suggested tag", draft.TagIDs)
	}
	var post model.Post
	if err := db.First(&post, draft.PostID).Error; err != nil {
		t.Fatalf("load draft: %v", err)
	}
	if post.Status != "draft" || post.AuthorID != 101 {
		t.Fatalf("post = %+v, want user draft", post)
	}
}

func TestCreateDraftRollsBackWhenManualTagIsInvalid(t *testing.T) {
	db := newTestDB(t)
	_, err := CreateDraft(db, CreateDraftInput{
		Title:        "Will fail",
		Content:      "Body",
		ManualTagIDs: []string{"999"},
		TagMode:      TagModeManualOnly,
		Visibility:   "private",
		AuthorID:     101,
		ActorRole:    "user",
	})
	if err == nil {
		t.Fatal("CreateDraft() error = nil, want invalid tag error")
	}
	var count int64
	if err := db.Model(&model.Post{}).Count(&count).Error; err != nil {
		t.Fatalf("count posts: %v", err)
	}
	if count != 0 {
		t.Fatalf("post count = %d, transaction left a partial post", count)
	}
}

func newTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(&model.Post{}, &model.PostCategory{}, &model.PostGroup{}, &model.PostTag{}, &model.PostTagRelation{}); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	return db
}

func contains(values []string, expected string) bool {
	for _, value := range values {
		if value == expected {
			return true
		}
	}
	return false
}
