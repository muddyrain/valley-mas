package ai

import (
	"context"
	"os"
	"strings"
	"valley-server/internal/mindarena"
)

const (
	AIProviderMock             = "mock"
	AIProviderOpenAICompatible = "openai-compatible"
	AIProviderDoubao           = "doubao"
)

type AIService interface {
	GeneratePersonas(ctx context.Context, topic string, mode string, count int) ([]mindarena.Persona, error)
	GeneratePersona(ctx context.Context, topic string, mode string, persona mindarena.Persona, index int, count int) (*mindarena.Persona, error)
	GenerateDebateRound(ctx context.Context, topic string, mode string, personas []mindarena.Persona, round int, history []mindarena.DebateMessage, supportHistory []mindarena.RoundSupportChoice) ([]mindarena.DebateMessage, error)
	GenerateDebateMessage(ctx context.Context, topic string, mode string, personas []mindarena.Persona, persona mindarena.Persona, round int, history []mindarena.DebateMessage, supportHistory []mindarena.RoundSupportChoice) (*mindarena.DebateMessage, error)
	JudgeDebate(ctx context.Context, topic string, personas []mindarena.Persona, messages []mindarena.DebateMessage) (*mindarena.DebateResult, error)
}

func NewServiceFromEnv() AIService {
	mock := NewMockAIService()
	provider := normalizeAIProvider(firstEnv("MIND_ARENA_AI_PROVIDER", "AI_PROVIDER"))
	apiKey := firstEnv("MIND_ARENA_AI_API_KEY", "AI_API_KEY")
	if isOpenAICompatibleProvider(provider) && apiKey != "" {
		primary := NewOpenAICompatibleService(OpenAICompatibleConfig{
			Provider: provider,
			BaseURL:  firstEnv("MIND_ARENA_AI_BASE_URL", "AI_BASE_URL"),
			APIKey:   apiKey,
			Model:    firstEnv("MIND_ARENA_AI_MODEL", "AI_MODEL", "ARK_TEXT_MODEL"),
		})
		return NewFallbackService(primary, mock)
	}
	return mock
}

func firstEnv(keys ...string) string {
	for _, key := range keys {
		value := strings.TrimSpace(os.Getenv(key))
		if value != "" {
			return value
		}
	}
	return ""
}

func normalizeAIProvider(provider string) string {
	switch strings.ToLower(strings.TrimSpace(provider)) {
	case "openai", "openai_compatible", AIProviderOpenAICompatible:
		return AIProviderOpenAICompatible
	case AIProviderDoubao:
		return AIProviderDoubao
	default:
		return AIProviderMock
	}
}

func isOpenAICompatibleProvider(provider string) bool {
	return provider == AIProviderOpenAICompatible || provider == AIProviderDoubao
}
