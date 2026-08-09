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

func TestAIImagePlannerCompilesRequestScopedVariation(t *testing.T) {
	planner := NewAIImagePlanner(nil)
	first, err := planner.Resolve(context.Background(), 1, AIImagePlanIntent{
		RecipeID: "cover", Brief: "React 元数据标记文章封面",
		VariationMode: AIImageVariationModeBalanced, VariationSeed: "variation-a",
	})
	if err != nil {
		t.Fatal(err)
	}
	second, err := planner.Resolve(context.Background(), 1, AIImagePlanIntent{
		RecipeID: "cover", Brief: "React 元数据标记文章封面",
		VariationMode: AIImageVariationModeBalanced, VariationSeed: "variation-b",
	})
	if err != nil {
		t.Fatal(err)
	}
	if first.VariationMode != AIImageVariationModeBalanced || first.VariationSeed != "variation-a" {
		t.Fatalf("variation snapshot was not preserved: %+v", first)
	}
	if first.VariationPrompt == "" || !strings.Contains(first.Prompt, "[CREATIVE VARIATION]") {
		t.Fatalf("compiled prompt is missing variation guidance: %s", first.Prompt)
	}
	if first.Prompt == second.Prompt {
		t.Fatal("different request variation seeds must not compile to the same prompt")
	}
}

func TestAIImagePlannerPreciseModeDoesNotInjectVariation(t *testing.T) {
	plan, err := NewAIImagePlanner(nil).Resolve(context.Background(), 1, AIImagePlanIntent{
		RecipeID: "cover", Brief: "保持指定的蓝色正面构图",
		VariationMode: AIImageVariationModePrecise, VariationSeed: "ignored",
	})
	if err != nil {
		t.Fatal(err)
	}
	if plan.VariationPrompt != "" || strings.Contains(plan.Prompt, "[CREATIVE VARIATION]") {
		t.Fatalf("precise mode must preserve the brief without automatic variation: %s", plan.Prompt)
	}
}

func TestAIImagePlannerSeparatesSubjectContextFromUserInstructions(t *testing.T) {
	plan, err := NewAIImagePlanner(nil).Resolve(context.Background(), 1, AIImagePlanIntent{
		RecipeID: "cover", SubjectContext: "文章标题：元数据标记\n正文要点：介绍 tags 和 token",
		Brief: "使用编辑插画，不要人物", VariationMode: AIImageVariationModePrecise,
	})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(plan.Prompt, "[SUBJECT CONTEXT]") ||
		!strings.Contains(plan.Prompt, "[USER BRIEF]\n使用编辑插画，不要人物") {
		t.Fatalf("subject context and user brief were not compiled separately: %s", plan.Prompt)
	}
}

func TestAIImagePlannerRejectsUnknownVariationMode(t *testing.T) {
	_, err := NewAIImagePlanner(nil).Resolve(context.Background(), 1, AIImagePlanIntent{
		RecipeID: "free", Brief: "山谷", VariationMode: "random",
	})
	if err == nil || !strings.Contains(err.Error(), "画面变化幅度") {
		t.Fatalf("unexpected error: %v", err)
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
