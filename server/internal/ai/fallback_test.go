package ai

import (
	"context"
	"errors"
	"testing"
	"valley-server/internal/mindarena"
)

type stubAIService struct {
	generatePersonas func(ctx context.Context, topic string, mode string, count int) ([]mindarena.Persona, error)
	generatePersona  func(ctx context.Context, topic string, mode string, persona mindarena.Persona, index int, count int) (*mindarena.Persona, error)
	generateRound    func(ctx context.Context, topic string, mode string, personas []mindarena.Persona, round int, history []mindarena.DebateMessage) ([]mindarena.DebateMessage, error)
	generateMessage  func(ctx context.Context, topic string, mode string, personas []mindarena.Persona, persona mindarena.Persona, round int, history []mindarena.DebateMessage) (*mindarena.DebateMessage, error)
	judgeDebate      func(ctx context.Context, topic string, personas []mindarena.Persona, messages []mindarena.DebateMessage) (*mindarena.DebateResult, error)
}

func (s stubAIService) GeneratePersonas(ctx context.Context, topic string, mode string, count int) ([]mindarena.Persona, error) {
	return s.generatePersonas(ctx, topic, mode, count)
}

func (s stubAIService) GeneratePersona(ctx context.Context, topic string, mode string, persona mindarena.Persona, index int, count int) (*mindarena.Persona, error) {
	if s.generatePersona != nil {
		return s.generatePersona(ctx, topic, mode, persona, index, count)
	}
	return &persona, nil
}

func (s stubAIService) GenerateDebateRound(ctx context.Context, topic string, mode string, personas []mindarena.Persona, round int, history []mindarena.DebateMessage) ([]mindarena.DebateMessage, error) {
	return s.generateRound(ctx, topic, mode, personas, round, history)
}

func (s stubAIService) GenerateDebateMessage(ctx context.Context, topic string, mode string, personas []mindarena.Persona, persona mindarena.Persona, round int, history []mindarena.DebateMessage) (*mindarena.DebateMessage, error) {
	if s.generateMessage != nil {
		return s.generateMessage(ctx, topic, mode, personas, persona, round, history)
	}
	messages, err := s.GenerateDebateRound(ctx, topic, mode, personas, round, history)
	if err != nil || len(messages) == 0 {
		return nil, err
	}
	return &messages[0], nil
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

func TestFallbackServiceGeneratePersona(t *testing.T) {
	t.Parallel()

	persona := mindarena.Persona{ID: "p1", Name: "理性派"}
	service := NewFallbackService(
		stubAIService{
			generatePersonas: func(ctx context.Context, topic string, mode string, count int) ([]mindarena.Persona, error) {
				return nil, nil
			},
			generatePersona: func(ctx context.Context, topic string, mode string, persona mindarena.Persona, index int, count int) (*mindarena.Persona, error) {
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

	generated, err := service.GeneratePersona(context.Background(), "要不要创业", "funny", persona, 0, 5)
	if err != nil {
		t.Fatalf("expected fallback persona, got error: %v", err)
	}
	if generated == nil || generated.Name != persona.Name {
		t.Fatalf("expected fallback persona, got %+v", generated)
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

func TestFallbackServiceGenerateDebateMessage(t *testing.T) {
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
			generateMessage: func(ctx context.Context, topic string, mode string, personas []mindarena.Persona, persona mindarena.Persona, round int, history []mindarena.DebateMessage) (*mindarena.DebateMessage, error) {
				return nil, errors.New("AI upstream failed")
			},
			judgeDebate: func(ctx context.Context, topic string, personas []mindarena.Persona, messages []mindarena.DebateMessage) (*mindarena.DebateResult, error) {
				return nil, nil
			},
		},
		NewMockAIService(),
	)

	message, err := service.GenerateDebateMessage(context.Background(), "要不要创业", "funny", personas, personas[0], 1, nil)
	if err != nil {
		t.Fatalf("expected fallback message, got error: %v", err)
	}
	if message == nil || message.PersonaName != "理性派" {
		t.Fatalf("expected fallback message for 理性派, got %+v", message)
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
