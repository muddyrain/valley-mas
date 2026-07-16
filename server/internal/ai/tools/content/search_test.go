package content

import (
	"context"
	"encoding/json"
	"testing"
	"time"

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

func TestSearchToolFiltersBlogsByCreatedDateRange(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open database: %v", err)
	}
	if err := db.AutoMigrate(&model.Post{}, &model.Resource{}); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	cst := time.FixedZone("CST", 8*60*60)
	if err := db.Create(&[]model.Post{
		{ID: 1, AuthorID: 101, Title: "七月初", Slug: "july-first", Excerpt: "included", Content: "included", CreatedAt: time.Date(2026, time.July, 1, 0, 0, 0, 0, cst), UpdatedAt: time.Date(2026, time.August, 1, 0, 0, 0, 0, cst)},
		{ID: 2, AuthorID: 101, Title: "七月末", Slug: "july-last", Excerpt: "included", Content: "included", CreatedAt: time.Date(2026, time.July, 31, 23, 59, 59, 0, cst), UpdatedAt: time.Date(2026, time.July, 1, 0, 0, 0, 0, cst)},
		{ID: 3, AuthorID: 101, Title: "八月初", Slug: "august-first", Excerpt: "excluded", Content: "excluded", CreatedAt: time.Date(2026, time.August, 1, 0, 0, 0, 0, cst)},
		{ID: 4, AuthorID: 202, Title: "他人的七月博客", Slug: "foreign-july", Excerpt: "excluded", Content: "excluded", CreatedAt: time.Date(2026, time.July, 15, 12, 0, 0, 0, cst)},
	}).Error; err != nil {
		t.Fatalf("seed posts: %v", err)
	}
	if err := db.Create(&model.Resource{
		ID: 5, UserID: 101, Title: "七月资源", Description: "must not be returned", CreatedAt: time.Date(2026, time.July, 15, 12, 0, 0, 0, cst),
	}).Error; err != nil {
		t.Fatalf("seed resource: %v", err)
	}

	raw, err := NewSearchTool(db).Run(WithOwner(context.Background(), 101), json.RawMessage(`{"createdFrom":"2026-07-01","createdTo":"2026-07-31"}`))
	if err != nil {
		t.Fatalf("run search: %v", err)
	}
	var result searchResult
	if err := json.Unmarshal(raw, &result); err != nil {
		t.Fatalf("decode result: %v", err)
	}
	if !result.OK || len(result.Items) != 2 {
		t.Fatalf("expected exactly two July blogs, got %s", raw)
	}
	if result.Items[0].ID != "2" || result.Items[1].ID != "1" {
		t.Fatalf("expected descending created date order, got %s", raw)
	}
	for _, item := range result.Items {
		if item.Type != "blog" || (item.ID != "1" && item.ID != "2") {
			t.Fatalf("unexpected date-filtered item: %#v", item)
		}
	}
}

func TestSearchToolSupportsIndependentCreatedDateEndpoints(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open database: %v", err)
	}
	if err := db.AutoMigrate(&model.Post{}); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	cst := time.FixedZone("CST", 8*60*60)
	if err := db.Create(&[]model.Post{
		{ID: 1, AuthorID: 101, Title: "before", Slug: "before", Excerpt: "included", Content: "included", CreatedAt: time.Date(2026, time.June, 30, 12, 0, 0, 0, cst)},
		{ID: 2, AuthorID: 101, Title: "july", Slug: "july", Excerpt: "included", Content: "included", CreatedAt: time.Date(2026, time.July, 2, 12, 0, 0, 0, cst)},
		{ID: 3, AuthorID: 101, Title: "after", Slug: "after", Excerpt: "included", Content: "included", CreatedAt: time.Date(2026, time.August, 1, 12, 0, 0, 0, cst)},
	}).Error; err != nil {
		t.Fatalf("seed posts: %v", err)
	}

	fromRaw, err := NewSearchTool(db).Run(WithOwner(context.Background(), 101), json.RawMessage(`{"createdFrom":"2026-07-01"}`))
	if err != nil {
		t.Fatalf("run from-only search: %v", err)
	}
	assertSearchItemIDs(t, fromRaw, "3", "2")

	toRaw, err := NewSearchTool(db).Run(WithOwner(context.Background(), 101), json.RawMessage(`{"createdTo":"2026-07-31"}`))
	if err != nil {
		t.Fatalf("run to-only search: %v", err)
	}
	assertSearchItemIDs(t, toRaw, "2", "1")
}

func TestSearchToolCombinesKeywordAndCreatedDateRange(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open database: %v", err)
	}
	if err := db.AutoMigrate(&model.Post{}); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	cst := time.FixedZone("CST", 8*60*60)
	if err := db.Create(&[]model.Post{
		{ID: 1, AuthorID: 101, Title: "needle july", Slug: "needle-july", Excerpt: "included", Content: "included", CreatedAt: time.Date(2026, time.July, 2, 12, 0, 0, 0, cst)},
		{ID: 2, AuthorID: 101, Title: "other july", Slug: "other-july", Excerpt: "included", Content: "included", CreatedAt: time.Date(2026, time.July, 3, 12, 0, 0, 0, cst)},
		{ID: 3, AuthorID: 101, Title: "needle august", Slug: "needle-august", Excerpt: "included", Content: "included", CreatedAt: time.Date(2026, time.August, 1, 12, 0, 0, 0, cst)},
	}).Error; err != nil {
		t.Fatalf("seed posts: %v", err)
	}

	raw, err := NewSearchTool(db).Run(WithOwner(context.Background(), 101), json.RawMessage(`{"query":"needle","createdFrom":"2026-07-01","createdTo":"2026-07-31"}`))
	if err != nil {
		t.Fatalf("run keyword and date search: %v", err)
	}
	assertSearchItemIDs(t, raw, "1")
}

func TestSearchToolRejectsInvalidOrInvertedCreatedDateRange(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open database: %v", err)
	}
	tool := NewSearchTool(db)
	ctx := WithOwner(context.Background(), 101)
	if _, err := tool.Run(ctx, json.RawMessage(`{"createdFrom":"2026-07-32"}`)); err == nil || err.Error() != "content.search: createdFrom must be YYYY-MM-DD" {
		t.Fatalf("expected invalid createdFrom error, got %v", err)
	}
	if _, err := tool.Run(ctx, json.RawMessage(`{"createdFrom":"2026-08-01","createdTo":"2026-07-31"}`)); err == nil || err.Error() != "content.search: createdFrom must not be after createdTo" {
		t.Fatalf("expected inverted date range error, got %v", err)
	}
}

func TestSearchToolLimitsDateRangeResultsToFive(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open database: %v", err)
	}
	if err := db.AutoMigrate(&model.Post{}); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	cst := time.FixedZone("CST", 8*60*60)
	posts := make([]model.Post, 0, 6)
	for day := 1; day <= 6; day++ {
		posts = append(posts, model.Post{
			ID:        model.Int64String(day),
			AuthorID:  101,
			Title:     "july post",
			Slug:      "july-post-" + string(rune('0'+day)),
			Excerpt:   "included",
			Content:   "included",
			CreatedAt: time.Date(2026, time.July, day, 12, 0, 0, 0, cst),
			UpdatedAt: time.Date(2026, time.July, 7-day, 12, 0, 0, 0, cst),
		})
	}
	if err := db.Create(&posts).Error; err != nil {
		t.Fatalf("seed posts: %v", err)
	}

	raw, err := NewSearchTool(db).Run(WithOwner(context.Background(), 101), json.RawMessage(`{"createdFrom":"2026-07-01","createdTo":"2026-07-31"}`))
	if err != nil {
		t.Fatalf("run search: %v", err)
	}
	assertSearchItemIDs(t, raw, "6", "5", "4", "3", "2")
}

func assertSearchItemIDs(t *testing.T, raw json.RawMessage, want ...string) {
	t.Helper()
	var result searchResult
	if err := json.Unmarshal(raw, &result); err != nil {
		t.Fatalf("decode result: %v", err)
	}
	if !result.OK || len(result.Items) != len(want) {
		t.Fatalf("expected %d result items, got %s", len(want), raw)
	}
	for i, id := range want {
		if result.Items[i].ID != id {
			t.Fatalf("expected item %d to have ID %s, got %s", i, id, result.Items[i].ID)
		}
	}
}
