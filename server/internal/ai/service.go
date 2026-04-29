package ai

import (
	"context"
	"os"
	"strings"
	"valley-server/internal/mindarena"
)

type AIService interface {
	GeneratePersonas(ctx context.Context, topic string, mode string, count int) ([]mindarena.Persona, error)
	GenerateDebateRound(ctx context.Context, topic string, mode string, personas []mindarena.Persona, round int, history []mindarena.DebateMessage) ([]mindarena.DebateMessage, error)
	JudgeDebate(ctx context.Context, topic string, personas []mindarena.Persona, messages []mindarena.DebateMessage) (*mindarena.DebateResult, error)
}

func NewServiceFromEnv() AIService {
	provider := strings.ToLower(strings.TrimSpace(os.Getenv("AI_PROVIDER")))
	if provider == "openai-compatible" && strings.TrimSpace(os.Getenv("AI_API_KEY")) != "" {
		return NewOpenAICompatibleService(OpenAICompatibleConfig{
			BaseURL: os.Getenv("AI_BASE_URL"),
			APIKey:  os.Getenv("AI_API_KEY"),
			Model:   os.Getenv("AI_MODEL"),
		})
	}
	return NewMockAIService()
}
