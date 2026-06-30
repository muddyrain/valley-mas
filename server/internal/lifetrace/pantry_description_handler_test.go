package lifetrace

import (
	"strings"
	"testing"
)

func TestParsePantryDescriptionAIResponse_ExtractsTipsAndNote(t *testing.T) {
	raw := "{\"note\":\"开封后冷藏并尽量在 5 天内饮用完毕。\",\"tips\":[\"冷藏 4 度保存\",\"避免阳光直射\",\"开封后 5 天内喝完\"]}"
	parsed, err := parsePantryDescriptionAIResponse(raw)
	if err != nil {
		t.Fatalf("expected ok, got err: %v", err)
	}
	if !strings.Contains(parsed.Note, "5 天") {
		t.Fatalf("expected note to mention 5 天, got %q", parsed.Note)
	}
	if len(parsed.Tips) != 3 {
		t.Fatalf("expected 3 tips, got %d", len(parsed.Tips))
	}
}

func TestParsePantryDescriptionAIResponse_RejectsEmpty(t *testing.T) {
	if _, err := parsePantryDescriptionAIResponse("not json"); err == nil {
		t.Fatal("expected error for non-json input")
	}
}

func TestBuildPantryDescriptionPrompt_IncludesContext(t *testing.T) {
	prompt := buildPantryDescriptionPrompt(pantryDescriptionRequest{
		Name:     "鲜牛奶",
		Category: "食品",
		Location: "冷藏",
	})
	if !strings.Contains(prompt, "鲜牛奶") {
		t.Fatal("prompt should include name")
	}
	if !strings.Contains(prompt, "冷藏") {
		t.Fatal("prompt should include location")
	}
}
