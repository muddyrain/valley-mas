package prompts

import "testing"

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
