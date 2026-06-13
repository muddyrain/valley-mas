package lifetrace

import (
	"strings"
	"testing"
)

func TestBuildPantryPhotoAnalysisPromptSupportsOCRMode(t *testing.T) {
	prompt := buildPantryPhotoAnalysisPrompt("", "我的空间", true, "ocr", "", "", "")

	if !strings.Contains(prompt, "当前模式：OCR 拍照分析") {
		t.Fatalf("expected OCR mode instruction, got %s", prompt)
	}
	for _, want := range []string{"生产日期", "到期日", "保质期天数", "保质期原文"} {
		if !strings.Contains(prompt, want) {
			t.Fatalf("expected OCR prompt to mention %s, got %s", want, prompt)
		}
	}
}

func TestNormalizePantryPhotoAnalysisMode(t *testing.T) {
	if got := normalizePantryPhotoAnalysisMode(" OCR "); got != "ocr" {
		t.Fatalf("expected ocr mode, got %s", got)
	}
	if got := normalizePantryPhotoAnalysisMode("unknown"); got != "ai" {
		t.Fatalf("expected fallback ai mode, got %s", got)
	}
}

func TestBuildPantryPhotoOCRAnalysisResponseDerivesExpiry(t *testing.T) {
	parsed := buildPantryPhotoOCRAnalysisResponse("生产日期：2026年06月01日 保质期270天")

	if parsed.ProductionDate != "2026-06-01" {
		t.Fatalf("expected production date, got %+v", parsed)
	}
	if parsed.ShelfLifeDays != 270 {
		t.Fatalf("expected shelf life days, got %+v", parsed)
	}
	if parsed.ExpiresAt != "2027-02-26" {
		t.Fatalf("expected derived expiry, got %+v", parsed)
	}
	if len(parsed.OCRHints) < 2 {
		t.Fatalf("expected OCR hints, got %+v", parsed.OCRHints)
	}
}

func TestBuildPantryPhotoOCRAnalysisResponseKeepsExpiryDate(t *testing.T) {
	parsed := buildPantryPhotoOCRAnalysisResponse("有效期至 2026/12/31")

	if parsed.ExpiresAt != "2026-12-31" {
		t.Fatalf("expected expiry date, got %+v", parsed)
	}
}

func TestBuildPantryPhotoOCRAnalysisResponseIgnoresShelfLifeWithoutDateAnchor(t *testing.T) {
	parsed := buildPantryPhotoOCRAnalysisResponse("生产日期：见背封口处喷码 保质期：9个月")

	if parsed.ProductionDate != "" || parsed.ExpiresAt != "" || parsed.ShelfLifeDays != 0 {
		t.Fatalf("expected no form date fields without date anchor, got %+v", parsed)
	}
	if len(parsed.OCRHints) == 0 {
		t.Fatalf("expected OCR hints to remain visible, got %+v", parsed.OCRHints)
	}
	if !strings.Contains(strings.Join(parsed.Warnings, " "), "缺少生产日期") {
		t.Fatalf("expected missing production date warning, got %+v", parsed.Warnings)
	}
}

func TestNormalizePantryPhotoOCRHintsFiltersNonShelfLifeText(t *testing.T) {
	hints := normalizePantryPhotoOCRHints([]pantryPhotoOCRHint{
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

func TestNormalizePantryPhotoOCRHintsKeepsShelfLifeSemanticText(t *testing.T) {
	hints := normalizePantryPhotoOCRHints([]pantryPhotoOCRHint{
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
