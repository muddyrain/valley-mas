package lifetrace

import "testing"

func TestNormalizePantryPhotoDateHintsFiltersNonShelfLifeText(t *testing.T) {
	hints := normalizePantryPhotoDateHints([]pantryPhotoDateHint{
		{
			Kind:            "shelf_life_text",
			Text:            "巧乐兹经典巧脆棒 冰淇淋",
			NormalizedValue: "巧乐兹经典巧脆棒 冰淇淋",
		},
		{
			Kind:            "production_date",
			Text:            "生产日期 2026-06-01",
			NormalizedValue: "2026-06-01",
		},
	})

	if len(hints) != 1 {
		t.Fatalf("expected only production date hint to remain, got %+v", hints)
	}
	if hints[0].Kind != "production_date" {
		t.Fatalf("expected production_date hint, got %+v", hints)
	}
}

func TestNormalizePantryPhotoDateHintsKeepsShelfLifeSemanticText(t *testing.T) {
	hints := normalizePantryPhotoDateHints([]pantryPhotoDateHint{
		{
			Kind:            "shelf_life_text",
			Text:            "保质期180天",
			NormalizedValue: "180天",
		},
		{
			Kind:            "shelf_life_text",
			Text:            "冷藏保存",
			NormalizedValue: "冷藏保存",
		},
	})

	if len(hints) != 1 {
		t.Fatalf("expected only shelf-life semantic text to remain, got %+v", hints)
	}
	if hints[0].Text != "保质期180天" {
		t.Fatalf("expected shelf-life hint to remain, got %+v", hints)
	}
}
