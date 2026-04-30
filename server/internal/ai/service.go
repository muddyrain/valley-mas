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
	GenerateDebateRound(ctx context.Context, topic string, mode string, personas []mindarena.Persona, round int, history []mindarena.DebateMessage) ([]mindarena.DebateMessage, error)
	GenerateDebateMessage(ctx context.Context, topic string, mode string, personas []mindarena.Persona, persona mindarena.Persona, round int, history []mindarena.DebateMessage) (*mindarena.DebateMessage, error)
	JudgeDebate(ctx context.Context, topic string, personas []mindarena.Persona, messages []mindarena.DebateMessage) (*mindarena.DebateResult, error)
}

func NewServiceFromEnv() AIService {
	mock := NewMockAIService()
	provider := normalizeAIProvider(os.Getenv("AI_PROVIDER"))
	if isOpenAICompatibleProvider(provider) && strings.TrimSpace(os.Getenv("AI_API_KEY")) != "" {
		primary := NewOpenAICompatibleService(OpenAICompatibleConfig{
			Provider: provider,
			BaseURL:  os.Getenv("AI_BASE_URL"),
			APIKey:   os.Getenv("AI_API_KEY"),
			Model:    os.Getenv("AI_MODEL"),
		})
		return NewFallbackService(primary, mock)
	}
	return mock
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
