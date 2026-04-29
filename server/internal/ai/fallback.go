package ai

import (
	"context"
	"errors"
	"log"
	"valley-server/internal/mindarena"
)

type FallbackService struct {
	primary  AIService
	fallback AIService
}

func NewFallbackService(primary AIService, fallback AIService) *FallbackService {
	return &FallbackService{primary: primary, fallback: fallback}
}

func (s *FallbackService) GeneratePersonas(ctx context.Context, topic string, mode string, count int) ([]mindarena.Persona, error) {
	personas, err := s.primary.GeneratePersonas(ctx, topic, mode, count)
	if err == nil || !shouldFallbackToMock(err) {
		return personas, err
	}

	log.Printf("ai-mind-arena: fallback to mock personas because primary AI failed: %v", err)
	return s.fallback.GeneratePersonas(ctx, topic, mode, count)
}

func (s *FallbackService) GenerateDebateRound(ctx context.Context, topic string, mode string, personas []mindarena.Persona, round int, history []mindarena.DebateMessage) ([]mindarena.DebateMessage, error) {
	messages, err := s.primary.GenerateDebateRound(ctx, topic, mode, personas, round, history)
	if err == nil || !shouldFallbackToMock(err) {
		return messages, err
	}

	log.Printf("ai-mind-arena: fallback to mock round %d because primary AI failed: %v", round, err)
	return s.fallback.GenerateDebateRound(ctx, topic, mode, personas, round, history)
}

func (s *FallbackService) JudgeDebate(ctx context.Context, topic string, personas []mindarena.Persona, messages []mindarena.DebateMessage) (*mindarena.DebateResult, error) {
	result, err := s.primary.JudgeDebate(ctx, topic, personas, messages)
	if err == nil || !shouldFallbackToMock(err) {
		return result, err
	}

	log.Printf("ai-mind-arena: fallback to mock judge because primary AI failed: %v", err)
	return s.fallback.JudgeDebate(ctx, topic, personas, messages)
}

func shouldFallbackToMock(err error) bool {
	if err == nil {
		return false
	}
	return !errors.Is(err, context.Canceled) && !errors.Is(err, context.DeadlineExceeded)
}
