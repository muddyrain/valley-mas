package service

import (
	"context"
	"strings"
	"testing"

	"valley-server/internal/model"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func newAIImagePlannerTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(&model.AISkill{}); err != nil {
		t.Fatal(err)
	}
	return db
}

func TestAIImagePlannerKeepsRecipeStyleAndBriefInSeparateSections(t *testing.T) {
	db := newAIImagePlannerTestDB(t)
	if err := db.Create(&model.AISkill{
		ID: 21, UserID: 7, Name: "纸张海报",
		Content: "使用旧纸张质感", ReferenceContent: "大面积留白与克制配色",
		SourceURL: "https://example.com/paper",
	}).Error; err != nil {
		t.Fatal(err)
	}
	plan, err := NewAIImagePlanner(db).Resolve(context.Background(), 7, AIImagePlanIntent{
		RecipeID: "cover", StyleProfileID: "skill:21",
		Brief: "雨夜中的山谷图书馆",
	})
	if err != nil {
		t.Fatal(err)
	}
	for _, expected := range []string{
		"[USER BRIEF]", "雨夜中的山谷图书馆",
		"[OUTPUT RECIPE]", "editorial cover",
		"[VISUAL STYLE]", "使用旧纸张质感", "大面积留白",
	} {
		if !strings.Contains(plan.Prompt, expected) {
			t.Fatalf("compiled plan must contain %q: %s", expected, plan.Prompt)
		}
	}
	if plan.StyleProfile == nil || plan.StyleProfile.SkillID == nil || *plan.StyleProfile.SkillID != 21 {
		t.Fatalf("skill-backed style profile was not resolved: %+v", plan.StyleProfile)
	}
}

func TestAIImagePlannerFreeRecipeIsNeutral(t *testing.T) {
	plan, err := NewAIImagePlanner(nil).Resolve(context.Background(), 1, AIImagePlanIntent{
		RecipeID: "free", Brief: "一只站在雪地里的狐狸",
	})
	if err != nil {
		t.Fatal(err)
	}
	if plan.Recipe.Instructions != "" || strings.Contains(strings.ToLower(plan.Prompt), "wallpaper") {
		t.Fatalf("free recipe added hidden output-purpose constraints: %+v\n%s", plan.Recipe, plan.Prompt)
	}
}

func TestAIImagePlannerRejectsAnotherOwnersSkill(t *testing.T) {
	db := newAIImagePlannerTestDB(t)
	if err := db.Create(&model.AISkill{
		ID: 22, UserID: 8, Name: "私有风格", Content: "秘密规则",
		SourceURL: "https://example.com/private",
	}).Error; err != nil {
		t.Fatal(err)
	}
	_, err := NewAIImagePlanner(db).Resolve(context.Background(), 7, AIImagePlanIntent{
		RecipeID: "free", StyleProfileID: "skill:22", Brief: "山谷",
	})
	if err == nil || !strings.Contains(err.Error(), "不存在或不可用") {
		t.Fatalf("expected owner-scoped style rejection, got %v", err)
	}
}

func TestAIImagePlannerMapsLegacyStylePreset(t *testing.T) {
	plan, err := NewAIImagePlanner(nil).Resolve(context.Background(), 1, AIImagePlanIntent{
		RecipeID: "anime", Brief: "云海城市",
	})
	if err != nil {
		t.Fatal(err)
	}
	if plan.Recipe.ID != "wallpaper" || plan.StyleProfile == nil ||
		plan.StyleProfile.ID != "builtin:anime" {
		t.Fatalf("legacy preset was not mapped to recipe and style: %+v", plan)
	}
}
