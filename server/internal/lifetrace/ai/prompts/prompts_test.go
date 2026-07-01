package prompts

import (
	"strings"
	"testing"
)

func TestImageAnalysisContractParsesMarkdownJSON(t *testing.T) {
	parsed, err := ParseImageAnalysisOutput("```json\n{\"title\":\"看展\",\"planType\":\"聚会\",\"schedule\":{\"dateOption\":\"明天\",\"time\":\"19:30\"}}\n```", "生活照片")
	if err != nil {
		t.Fatalf("parse image analysis: %v", err)
	}
	if parsed.Title != "看展" || parsed.PlanType != "聚会" || parsed.Schedule.Time != "19:30" {
		t.Fatalf("unexpected parsed image analysis: %+v", parsed)
	}
}

func TestInboxOrganizeContractFallsBackSafely(t *testing.T) {
	parsed, err := ParseInboxOrganizeOutput(`{"title":"","summary":"","tags":[],"suggestedType":"unknown","reason":""}`, InboxOrganizeInput{
		Title:                 "周末买菜",
		Content:               "记得买牛奶",
		Tags:                  []string{"生活"},
		FallbackSuggestedType: "plan",
	})
	if err != nil {
		t.Fatalf("parse inbox organize: %v", err)
	}
	if parsed.Title != "周末买菜" || parsed.SuggestedType != "plan" || len(parsed.Tags) != 1 {
		t.Fatalf("unexpected inbox fallback: %+v", parsed)
	}
}

func TestMediaDiaryContractNormalizesSuggestion(t *testing.T) {
	parsed, err := ParseMediaDiarySuggestion(`{"originalTitle":"  Dune  ","creator":"  Frank Herbert  ","releaseYear":9999,"tags":["科幻","科幻"],"note":"  好看  "}`)
	if err != nil {
		t.Fatalf("parse media diary: %v", err)
	}
	if parsed.OriginalTitle != "Dune" || parsed.ReleaseYear != 0 || len(parsed.Tags) != 1 {
		t.Fatalf("unexpected media diary suggestion: %+v", parsed)
	}
}

func TestTodayAdviceContractParseFallsBackOnEmptySummary(t *testing.T) {
	parsed, err := ParseTodayAdviceOutput(`{"summary":"","items":[{"id":"wear","detail":""}]}`)
	if err != nil {
		t.Fatalf("parse today advice: %v", err)
	}
	if parsed.Summary != "今天优先完成一件轻量计划。" {
		t.Fatalf("expected summary fallback, got %q", parsed.Summary)
	}
	if len(parsed.Items) != len(TodayAdviceOrder) {
		t.Fatalf("expected %d items, got %d", len(TodayAdviceOrder), len(parsed.Items))
	}
	for idx, id := range TodayAdviceOrder {
		if parsed.Items[idx].ID != id {
			t.Fatalf("expected item[%d].ID=%s, got %s", idx, id, parsed.Items[idx].ID)
		}
		if parsed.Items[idx].Title != TodayAdviceDefaults[id].Title {
			t.Fatalf("expected item[%d].Title=%s, got %s", idx, TodayAdviceDefaults[id].Title, parsed.Items[idx].Title)
		}
	}
	if parsed.Items[0].Detail != TodayAdviceDefaults["wear"].Detail {
		t.Fatalf("expected wear detail fallback, got %q", parsed.Items[0].Detail)
	}
}

func TestWeeklyReviewContractParseFillsFallbackList(t *testing.T) {
	parsed, err := ParseWeeklyReviewOutput(`{"summary":""}`)
	if err != nil {
		t.Fatalf("parse weekly review: %v", err)
	}
	if parsed.Summary == "" {
		t.Fatalf("expected summary fallback, got empty")
	}
	if len(parsed.Wins) != 1 || parsed.Wins[0] != "本周已有可回看的生活记录" {
		t.Fatalf("expected wins fallback, got %+v", parsed.Wins)
	}
	if len(parsed.Delays) != 1 || parsed.Delays[0] != "暂无明显延迟事项" {
		t.Fatalf("expected delays fallback, got %+v", parsed.Delays)
	}
	if len(parsed.Insights) != 1 || parsed.Insights[0] != "稳定记录能让下周安排更清晰" {
		t.Fatalf("expected insights fallback, got %+v", parsed.Insights)
	}
	if len(parsed.NextActions) != 1 || parsed.NextActions[0] != "下周先安排一件轻量计划" {
		t.Fatalf("expected next actions fallback, got %+v", parsed.NextActions)
	}
}

func TestAssistantStructuredContractParseRejectsUnsupportedAction(t *testing.T) {
	_, err := ParseAssistantStructuredOutput(`{"reply":"ok","action":{"type":"delete_all"}}`)
	if err == nil {
		t.Fatal("expected unsupported action error, got nil")
	}
	if !strings.Contains(err.Error(), "unsupported assistant action type") {
		t.Fatalf("expected unsupported error message, got %v", err)
	}
}

func TestBuildClothingPhotoAnalysisPromptIncludesHouseholdAndHint(t *testing.T) {
	prompt := BuildClothingPhotoAnalysisPrompt(ClothingPhotoAnalysisInput{
		HouseholdName: "我的空间",
		Hint:          "米色薄外套",
		UseVision:     true,
	})
	if !strings.Contains(prompt, "当前空间：我的空间") {
		t.Fatal("expected household in prompt")
	}
	if !strings.Contains(prompt, "米色薄外套") {
		t.Fatal("expected hint in prompt")
	}
	if !strings.Contains(prompt, "请直接观察图片中的衣物主体。") {
		t.Fatal("expected vision instruction when UseVision=true")
	}
}

func TestBuildClothingPhotoAnalysisPromptWithoutVisionSwitchesInstruction(t *testing.T) {
	prompt := BuildClothingPhotoAnalysisPrompt(ClothingPhotoAnalysisInput{
		HouseholdName: "我的空间",
		Hint:          "",
		UseVision:     false,
	})
	if !strings.Contains(prompt, "如果无法看到图片") {
		t.Fatal("expected no-vision instruction when UseVision=false")
	}
	if !strings.Contains(prompt, "用户提示：无") {
		t.Fatal("expected hint fallback to 无 when empty")
	}
}

func TestParseClothingPhotoAnalysisOutputExtractsFields(t *testing.T) {
	raw := "prefix ```{\"name\":\"白衬衫\",\"category\":\"上装\",\"color\":\"白色\",\"confidence\":0.8,\"seasons\":[\"春\",\"秋\"]}``` suffix"
	parsed, err := ParseClothingPhotoAnalysisOutput(raw)
	if err != nil {
		t.Fatalf("parse clothing photo: %v", err)
	}
	if parsed.Name != "白衬衫" || parsed.Category != "上装" || len(parsed.Seasons) != 2 {
		t.Fatalf("unexpected clothing photo output: %+v", parsed)
	}
}

func TestBuildPantryPhotoAnalysisPromptIncludesBarcodeAndHint(t *testing.T) {
	prompt := BuildPantryPhotoAnalysisPrompt(PantryPhotoAnalysisInput{
		Hint:          "1L 装",
		HouseholdName: "小家",
		UseVision:     true,
		BarcodeValue:  "6901234567890",
		BarcodeFormat: "ean_13",
		BarcodeSource: "scanner",
	})
	if !strings.Contains(prompt, "当前库存空间：小家") {
		t.Fatal("expected household in prompt")
	}
	if !strings.Contains(prompt, "包装编码：6901234567890；格式：ean_13；来源：scanner。") {
		t.Fatal("expected full barcode instruction")
	}
	if !strings.Contains(prompt, "用户补充说明：1L 装") {
		t.Fatal("expected hint in prompt")
	}
}

func TestBuildPantryPhotoAnalysisPromptFallsBackWhenEmpty(t *testing.T) {
	prompt := BuildPantryPhotoAnalysisPrompt(PantryPhotoAnalysisInput{
		Hint:          "",
		HouseholdName: "",
		UseVision:     false,
	})
	if !strings.Contains(prompt, "当前库存空间：当前库存空间") {
		t.Fatal("expected household fallback")
	}
	if !strings.Contains(prompt, "用户补充说明：用户没有补充说明。") {
		t.Fatal("expected hint fallback")
	}
	if !strings.Contains(prompt, "包装编码：无。") {
		t.Fatal("expected empty barcode fallback")
	}
	if !strings.Contains(prompt, "视觉模型未配置时") {
		t.Fatal("expected no-vision instruction")
	}
}

func TestBuildRecipeVideoHTMLPromptIncludesHyperFramesSpec(t *testing.T) {
	prompt := BuildRecipeVideoHTMLPrompt(RecipeVideoInput{RecipeID: "recipe-42"})
	if !strings.Contains(prompt, "HyperFrames") {
		t.Fatal("expected HyperFrames marker in prompt")
	}
	if !strings.Contains(prompt, "720x1280") {
		t.Fatal("expected video resolution in prompt")
	}
	if !strings.Contains(prompt, "GSAP") {
		t.Fatal("expected animation library hint in prompt")
	}
}

func TestBuildPantryThumbnailPromptIncludesName(t *testing.T) {
	prompt := BuildPantryThumbnailPrompt(PantryThumbnailInput{
		Name:     "全脂牛奶",
		Category: "食品",
		Location: "冷藏",
		Note:     "1L 家庭装",
	})
	if !strings.Contains(prompt, "全脂牛奶") {
		t.Fatal("expected name in prompt")
	}
}

func TestParseRecipeSuggestionOutputClampsMaxMinutes(t *testing.T) {
	raw := `{"summary":"两道快手菜","recipes":[{"id":"","title":"番茄炒蛋","reason":"","usedItems":[],"missingItems":[],"timeMinutes":600,"difficulty":"魔鬼","servings":100,"steps":[],"tags":[]}],"warnings":[]}`
	parsed, err := ParseRecipeSuggestionOutput(raw, RecipeSuggestionNormalizeContext{MaxMinutes: 30, Servings: 2})
	if err != nil {
		t.Fatalf("parse recipe suggestion: %v", err)
	}
	if len(parsed.Recipes) != 1 {
		t.Fatalf("expected 1 recipe, got %d", len(parsed.Recipes))
	}
	r := parsed.Recipes[0]
	if r.TimeMinutes > 30 {
		t.Fatalf("expected time clamped to <=30, got %d", r.TimeMinutes)
	}
	if r.Difficulty != "简单" && r.Difficulty != "中等" {
		t.Fatalf("expected normalized difficulty, got %q", r.Difficulty)
	}
}

func TestBuildOutfitSuggestionPromptIncludesWeatherAndItems(t *testing.T) {
	prompt := BuildOutfitSuggestionPrompt(OutfitSuggestionInput{
		ItemLines:   []string{"- id=1｜白衬衫｜上装｜白色｜常规｜春｜通勤", "- id=2｜牛仔裤｜下装｜蓝色｜常规｜春｜通勤"},
		WeatherText: "晴",
		Temperature: 22,
		LowTemp:     15,
		HighTemp:    28,
		Precip:      "无",
		PlanType:    "普通事项",
		Scene:       "通勤",
		PlanTitle:   "上班",
	})
	if !strings.Contains(prompt, "id=1") || !strings.Contains(prompt, "id=2") {
		t.Fatal("expected item ids in prompt")
	}
	if !strings.Contains(prompt, "天气：晴；温度：22；低温：15；高温：28；降水：无。") {
		t.Fatal("expected weather line in prompt")
	}
	if !strings.Contains(prompt, "计划：普通事项；场景：通勤；标题：上班。") {
		t.Fatal("expected plan line in prompt")
	}
}
