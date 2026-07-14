package content

import (
	"context"
	"encoding/json"
	"testing"

	"valley-server/internal/model"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

type searchResult struct {
	OK    bool `json:"ok"`
	Items []struct {
		Type    string `json:"type"`
		ID      string `json:"id"`
		Title   string `json:"title"`
		Excerpt string `json:"excerpt"`
		Href    string `json:"href"`
	} `json:"items"`
}

func TestSearchToolReturnsOnlyOwnerContent(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open database: %v", err)
	}
	if err := db.AutoMigrate(&model.Post{}, &model.Resource{}); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	if err := db.Create(&[]model.Post{
		{ID: 1, AuthorID: 101, Title: "设计手册", Slug: "owner-design", Excerpt: "owner post", Content: "设计内容"},
		{ID: 2, AuthorID: 202, Title: "设计手册", Slug: "foreign-design", Excerpt: "foreign post", Content: "不应泄露"},
	}).Error; err != nil {
		t.Fatalf("seed posts: %v", err)
	}
	if err := db.Create(&[]model.Resource{
		{ID: 3, UserID: 101, Title: "设计资源", Description: "owner resource"},
		{ID: 4, UserID: 202, Title: "设计资源", Description: "foreign resource"},
	}).Error; err != nil {
		t.Fatalf("seed resources: %v", err)
	}

	raw, err := NewSearchTool(db).Run(WithOwner(context.Background(), 101), json.RawMessage(`{"query":"设计"}`))
	if err != nil {
		t.Fatalf("run search: %v", err)
	}
	var result searchResult
	if err := json.Unmarshal(raw, &result); err != nil {
		t.Fatalf("decode result: %v", err)
	}
	if !result.OK || len(result.Items) != 2 {
		t.Fatalf("unexpected result: %s", raw)
	}
	for _, item := range result.Items {
		if item.Title != "设计手册" && item.Title != "设计资源" {
			t.Fatalf("unexpected item: %#v", item)
		}
		if item.Href != "/blog/1" && item.Href != "/resource/3" {
			t.Fatalf("unsafe or unexpected href: %q", item.Href)
		}
	}
}

func TestSearchToolRejectsBlankQuery(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open database: %v", err)
	}
	if _, err := NewSearchTool(db).Run(WithOwner(context.Background(), 101), json.RawMessage(`{"query":" "}`)); err == nil {
		t.Fatal("expected blank query error")
	}
}

func TestSearchToolMatchesOwnerPostContent(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open database: %v", err)
	}
	if err := db.AutoMigrate(&model.Post{}, &model.Resource{}); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	if err := db.Create(&[]model.Post{
		{ID: 1, AuthorID: 101, Title: "类型系统笔记", Slug: "owner-types", Excerpt: "编程笔记", Content: "使用 TypeScript 编写前端应用"},
		{ID: 2, AuthorID: 202, Title: "其他人的文章", Slug: "foreign-types", Excerpt: "编程笔记", Content: "使用 TypeScript 编写前端应用"},
	}).Error; err != nil {
		t.Fatalf("seed posts: %v", err)
	}

	raw, err := NewSearchTool(db).Run(WithOwner(context.Background(), 101), json.RawMessage(`{"query":"typescript"}`))
	if err != nil {
		t.Fatalf("run search: %v", err)
	}
	var result searchResult
	if err := json.Unmarshal(raw, &result); err != nil {
		t.Fatalf("decode result: %v", err)
	}
	if len(result.Items) != 1 || result.Items[0].ID != "1" {
		t.Fatalf("expected only the owner's content match, got %s", raw)
	}
}
