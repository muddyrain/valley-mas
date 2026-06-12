package ai

import "testing"

func TestNormalizeAIProvider(t *testing.T) {
	t.Parallel()

	cases := map[string]string{
		"":                  AIProviderMock,
		"mock":              AIProviderMock,
		"openai":            AIProviderOpenAICompatible,
		"openai-compatible": AIProviderOpenAICompatible,
		"openai_compatible": AIProviderOpenAICompatible,
		"doubao":            AIProviderDoubao,
		"unknown":           AIProviderMock,
	}

	for input, want := range cases {
		input := input
		want := want
		t.Run(input, func(t *testing.T) {
			t.Parallel()
			if got := normalizeAIProvider(input); got != want {
				t.Fatalf("normalizeAIProvider(%q) = %q, want %q", input, got, want)
			}
		})
	}
}

func TestNewServiceFromEnv(t *testing.T) {
	t.Run("prefers namespaced mind arena env", func(t *testing.T) {
		t.Setenv("MIND_ARENA_AI_PROVIDER", "doubao")
		t.Setenv("MIND_ARENA_AI_API_KEY", "mind-key")
		t.Setenv("MIND_ARENA_AI_BASE_URL", "")
		t.Setenv("MIND_ARENA_AI_MODEL", "ep-mind")
		t.Setenv("AI_PROVIDER", "mock")
		t.Setenv("AI_API_KEY", "")
		t.Setenv("AI_MODEL", "")

		service := NewServiceFromEnv()
		fallback, ok := service.(*FallbackService)
		if !ok {
			t.Fatalf("expected *FallbackService, got %T", service)
		}
		primary, ok := fallback.primary.(*OpenAICompatibleService)
		if !ok {
			t.Fatalf("expected primary *OpenAICompatibleService, got %T", fallback.primary)
		}
		if primary.model != "ep-mind" {
			t.Fatalf("expected namespaced model, got %q", primary.model)
		}
	})

	t.Run("falls back to shared ark text model", func(t *testing.T) {
		t.Setenv("MIND_ARENA_AI_PROVIDER", "doubao")
		t.Setenv("MIND_ARENA_AI_API_KEY", "mind-key")
		t.Setenv("MIND_ARENA_AI_BASE_URL", "")
		t.Setenv("MIND_ARENA_AI_MODEL", "")
		t.Setenv("ARK_TEXT_MODEL", "ep-shared-text")

		service := NewServiceFromEnv()
		fallback, ok := service.(*FallbackService)
		if !ok {
			t.Fatalf("expected *FallbackService, got %T", service)
		}
		primary, ok := fallback.primary.(*OpenAICompatibleService)
		if !ok {
			t.Fatalf("expected primary *OpenAICompatibleService, got %T", fallback.primary)
		}
		if primary.model != "ep-shared-text" {
			t.Fatalf("expected shared ARK text model, got %q", primary.model)
		}
	})

	t.Run("returns openai compatible service for doubao provider", func(t *testing.T) {
		t.Setenv("AI_PROVIDER", "doubao")
		t.Setenv("AI_API_KEY", "test-key")
		t.Setenv("AI_BASE_URL", "")
		t.Setenv("AI_MODEL", "ep-test")

		service := NewServiceFromEnv()
		fallback, ok := service.(*FallbackService)
		if !ok {
			t.Fatalf("expected *FallbackService, got %T", service)
		}
		if _, ok := fallback.primary.(*OpenAICompatibleService); !ok {
			t.Fatalf("expected primary *OpenAICompatibleService, got %T", fallback.primary)
		}
		if _, ok := fallback.fallback.(*MockAIService); !ok {
			t.Fatalf("expected fallback *MockAIService, got %T", fallback.fallback)
		}
	})

	t.Run("returns openai compatible service for openai alias", func(t *testing.T) {
		t.Setenv("AI_PROVIDER", "openai")
		t.Setenv("AI_API_KEY", "test-key")
		t.Setenv("AI_BASE_URL", "")
		t.Setenv("AI_MODEL", "gpt-4o-mini")

		service := NewServiceFromEnv()
		fallback, ok := service.(*FallbackService)
		if !ok {
			t.Fatalf("expected *FallbackService, got %T", service)
		}
		if _, ok := fallback.primary.(*OpenAICompatibleService); !ok {
			t.Fatalf("expected primary *OpenAICompatibleService, got %T", fallback.primary)
		}
	})

	t.Run("falls back to mock when api key is missing", func(t *testing.T) {
		t.Setenv("AI_PROVIDER", "doubao")
		t.Setenv("AI_API_KEY", "")
		t.Setenv("AI_BASE_URL", "")
		t.Setenv("AI_MODEL", "ep-test")

		service := NewServiceFromEnv()
		if _, ok := service.(*MockAIService); !ok {
			t.Fatalf("expected *MockAIService, got %T", service)
		}
	})
}
