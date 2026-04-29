package ai

import (
	"context"
	"testing"
	"valley-server/internal/mindarena"
)

func TestDefaultMindArenaPersonas(t *testing.T) {
	t.Parallel()

	personas := defaultMindArenaPersonas()
	if len(personas) != 5 {
		t.Fatalf("expected 5 personas, got %d", len(personas))
	}

	wantNames := []string{"理性派", "毒舌派", "赌徒派", "父母派", "摆烂派"}
	for i, want := range wantNames {
		if personas[i].Name != want {
			t.Fatalf("persona %d name = %q, want %q", i, personas[i].Name, want)
		}
		if personas[i].ID == "" || personas[i].Color == "" || personas[i].Catchphrase == "" {
			t.Fatalf("persona %q should keep canonical metadata, got %+v", personas[i].Name, personas[i])
		}
	}
}

func TestNormalizeGeneratedPersonas(t *testing.T) {
	t.Parallel()

	generated := []mindarena.Persona{
		{ID: "p1", Name: "理性派", Stance: "先做现金流测算再决定"},
		{ID: "p2", Name: "毒舌派", Stance: "别把情绪高潮误当成梦想召唤"},
		{ID: "p3", Name: "赌徒派", Stance: "窗口来了就该上桌，不然只会后悔"},
	}

	personas := normalizeGeneratedPersonas(generated)
	if len(personas) != 5 {
		t.Fatalf("expected normalized 5 personas, got %d", len(personas))
	}
	if personas[0].Stance != "先做现金流测算再决定" {
		t.Fatalf("expected generated stance to be preserved, got %q", personas[0].Stance)
	}
	if personas[3].Name != "父母派" || personas[4].Name != "摆烂派" {
		t.Fatalf("expected missing personas to fallback to canonical personas, got %+v", personas)
	}
	if personas[4].Catchphrase != "先睡一觉，明天再燃" {
		t.Fatalf("expected canonical catchphrase, got %q", personas[4].Catchphrase)
	}
}

func TestMockGeneratePersonasReturnsCanonicalFive(t *testing.T) {
	t.Parallel()

	service := NewMockAIService()
	personas, err := service.GeneratePersonas(context.Background(), "要不要离职创业", "funny", 5)
	if err != nil {
		t.Fatalf("GeneratePersonas returned error: %v", err)
	}
	if len(personas) != 5 {
		t.Fatalf("expected 5 personas, got %d", len(personas))
	}
	if personas[0].Name != "理性派" || personas[4].Name != "摆烂派" {
		t.Fatalf("unexpected persona order: %+v", personas)
	}
}
