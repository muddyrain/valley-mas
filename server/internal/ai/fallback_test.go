package ai

import (
	"context"
	"errors"
	"testing"
	"valley-server/internal/mindarena"
)

type stubAIService struct {
	generatePersonas func(ctx context.Context, topic string, mode string, count int) ([]mindarena.Persona, error)
	generateRound    func(ctx context.Context, topic string, mode string, personas []mindarena.Persona, round int, history []mindarena.DebateMessage) ([]mindarena.DebateMessage, error)
	judgeDebate      func(ctx context.Context, topic string, personas []mindarena.Persona, messages []mindarena.DebateMessage) (*mindarena.DebateResult, error)
}

func (s stubAIService) GeneratePersonas(ctx context.Context, topic string, mode string, count int) ([]mindarena.Persona, error) {
	return s.generatePersonas(ctx, topic, mode, count)
}

func (s stubAIService) GenerateDebateRound(ctx context.Context, topic string, mode string, personas []mindarena.Persona, round int, history []mindarena.DebateMessage) ([]mindarena.DebateMessage, error) {
	return s.generateRound(ctx, topic, mode, personas, round, history)
}

func (s stubAIService) JudgeDebate(ctx context.Context, topic string, personas []mindarena.Persona, messages []mindarena.DebateMessage) (*mindarena.DebateResult, error) {
	return s.judgeDebate(ctx, topic, personas, messages)
}

func TestFallbackServiceGeneratePersonas(t *testing.T) {
	t.Parallel()

	service := NewFallbackService(
		stubAIService{
			generatePersonas: func(ctx context.Context, topic string, mode string, count int) ([]mindarena.Persona, error) {
				return nil, errors.New("AI upstream returned 502")
			},
			generateRound: func(ctx context.Context, topic string, mode string, personas []mindarena.Persona, round int, history []mindarena.DebateMessage) ([]mindarena.DebateMessage, error) {
				return nil, nil
			},
			judgeDebate: func(ctx context.Context, topic string, personas []mindarena.Persona, messages []mindarena.DebateMessage) (*mindarena.DebateResult, error) {
				return nil, nil
			},
		},
		NewMockAIService(),
	)

	personas, err := service.GeneratePersonas(context.Background(), "要不要创业", "funny", 5)
	if err != nil {
		t.Fatalf("expected fallback personas, got error: %v", err)
	}
	if len(personas) != 5 {
		t.Fatalf("expected 5 personas from fallback, got %d", len(personas))
	}
}

func TestFallbackServiceGenerateDebateRound(t *testing.T) {
	t.Parallel()

	personas := []mindarena.Persona{
		{ID: "p1", Name: "理性派"},
		{ID: "p2", Name: "毒舌派"},
	}
	service := NewFallbackService(
		stubAIService{
			generatePersonas: func(ctx context.Context, topic string, mode string, count int) ([]mindarena.Persona, error) {
				return personas, nil
			},
			generateRound: func(ctx context.Context, topic string, mode string, personas []mindarena.Persona, round int, history []mindarena.DebateMessage) ([]mindarena.DebateMessage, error) {
				return nil, errors.New("parse AI JSON failed")
			},
			judgeDebate: func(ctx context.Context, topic string, personas []mindarena.Persona, messages []mindarena.DebateMessage) (*mindarena.DebateResult, error) {
				return nil, nil
			},
		},
		NewMockAIService(),
	)

	messages, err := service.GenerateDebateRound(context.Background(), "要不要创业", "funny", personas, 2, nil)
	if err != nil {
		t.Fatalf("expected fallback messages, got error: %v", err)
	}
	if len(messages) != len(personas) {
		t.Fatalf("expected %d messages from fallback, got %d", len(personas), len(messages))
	}
}

func TestFallbackServiceJudgeDebate(t *testing.T) {
	t.Parallel()

	personas := []mindarena.Persona{
		{ID: "p1", Name: "理性派"},
		{ID: "p2", Name: "毒舌派"},
	}
	service := NewFallbackService(
		stubAIService{
			generatePersonas: func(ctx context.Context, topic string, mode string, count int) ([]mindarena.Persona, error) {
				return personas, nil
			},
			generateRound: func(ctx context.Context, topic string, mode string, personas []mindarena.Persona, round int, history []mindarena.DebateMessage) ([]mindarena.DebateMessage, error) {
				return nil, nil
			},
			judgeDebate: func(ctx context.Context, topic string, personas []mindarena.Persona, messages []mindarena.DebateMessage) (*mindarena.DebateResult, error) {
				return nil, errors.New("AI_MODEL is empty for doubao provider")
			},
		},
		NewMockAIService(),
	)

	result, err := service.JudgeDebate(context.Background(), "要不要创业", personas, nil)
	if err != nil {
		t.Fatalf("expected fallback judge result, got error: %v", err)
	}
	if result == nil || result.Winner == "" {
		t.Fatalf("expected fallback judge result, got %#v", result)
	}
}

func TestShouldFallbackToMock(t *testing.T) {
	t.Parallel()

	if !shouldFallbackToMock(errors.New("AI upstream failed")) {
		t.Fatal("expected non-context error to fallback")
	}
	if shouldFallbackToMock(context.Canceled) {
		t.Fatal("expected context cancellation not to fallback")
	}
	if shouldFallbackToMock(context.DeadlineExceeded) {
		t.Fatal("expected context deadline not to fallback")
	}
}
