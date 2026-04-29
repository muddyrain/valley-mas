package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
	"valley-server/internal/mindarena"
)

type OpenAICompatibleConfig struct {
	BaseURL string
	APIKey  string
	Model   string
}

type OpenAICompatibleService struct {
	baseURL string
	apiKey  string
	model   string
	client  *http.Client
}

func NewOpenAICompatibleService(cfg OpenAICompatibleConfig) *OpenAICompatibleService {
	baseURL := strings.TrimRight(strings.TrimSpace(cfg.BaseURL), "/")
	if baseURL == "" {
		baseURL = "https://api.openai.com/v1"
	}
	model := strings.TrimSpace(cfg.Model)
	if model == "" {
		model = "gpt-4o-mini"
	}
	return &OpenAICompatibleService{
		baseURL: baseURL,
		apiKey:  strings.TrimSpace(cfg.APIKey),
		model:   model,
		client:  &http.Client{Timeout: 45 * time.Second},
	}
}

func (s *OpenAICompatibleService) GeneratePersonas(ctx context.Context, topic string, mode string, count int) ([]mindarena.Persona, error) {
	var out struct {
		Personas []mindarena.Persona `json:"personas"`
	}
	err := s.chatJSON(ctx, PERSONA_GENERATOR_PROMPT, fmt.Sprintf("议题：%s\n模式：%s\n人格数量：%d", topic, mode, count), &out)
	if err != nil {
		return nil, err
	}
	if len(out.Personas) == 0 {
		return nil, errors.New("model returned empty personas")
	}
	for i := range out.Personas {
		if strings.TrimSpace(out.Personas[i].ID) == "" {
			out.Personas[i].ID = fmt.Sprintf("p%d", i+1)
		}
	}
	return out.Personas, nil
}

func (s *OpenAICompatibleService) GenerateDebateRound(ctx context.Context, topic string, mode string, personas []mindarena.Persona, round int, history []mindarena.DebateMessage) ([]mindarena.DebateMessage, error) {
	payload := struct {
		Topic    string                    `json:"topic"`
		Mode     string                    `json:"mode"`
		Round    int                       `json:"round"`
		Personas []mindarena.Persona       `json:"personas"`
		History  []mindarena.DebateMessage `json:"history"`
	}{Topic: topic, Mode: mode, Round: round, Personas: personas, History: history}
	raw, _ := json.Marshal(payload)

	var out struct {
		Messages []mindarena.DebateMessage `json:"messages"`
	}
	if err := s.chatJSON(ctx, DEBATE_ROUND_PROMPT, string(raw), &out); err != nil {
		return nil, err
	}
	if len(out.Messages) == 0 {
		return nil, errors.New("model returned empty debate messages")
	}
	return out.Messages, nil
}

func (s *OpenAICompatibleService) JudgeDebate(ctx context.Context, topic string, personas []mindarena.Persona, messages []mindarena.DebateMessage) (*mindarena.DebateResult, error) {
	payload := struct {
		Topic    string                    `json:"topic"`
		Personas []mindarena.Persona       `json:"personas"`
		Messages []mindarena.DebateMessage `json:"messages"`
	}{Topic: topic, Personas: personas, Messages: messages}
	raw, _ := json.Marshal(payload)

	var result mindarena.DebateResult
	if err := s.chatJSON(ctx, JUDGE_PROMPT, string(raw), &result); err != nil {
		return nil, err
	}
	if strings.TrimSpace(result.Winner) == "" {
		return nil, errors.New("model returned empty judge result")
	}
	return &result, nil
}

func (s *OpenAICompatibleService) chatJSON(ctx context.Context, systemPrompt string, userPrompt string, out any) error {
	if s.apiKey == "" {
		return errors.New("AI_API_KEY is empty")
	}

	reqBody := chatCompletionRequest{
		Model: s.model,
		Messages: []chatMessage{
			{Role: "system", Content: systemPrompt},
			{Role: "user", Content: userPrompt},
		},
		Temperature: 0.85,
		ResponseFormat: &responseFormat{
			Type: "json_object",
		},
	}
	body, err := json.Marshal(reqBody)
	if err != nil {
		return err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, s.baseURL+"/chat/completions", bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+s.apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.client.Do(req)
	if err != nil {
		return fmt.Errorf("AI upstream request failed: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("AI upstream returned %d: %s", resp.StatusCode, strings.TrimSpace(string(respBody)))
	}

	var completion chatCompletionResponse
	if err := json.Unmarshal(respBody, &completion); err != nil {
		return fmt.Errorf("decode AI response failed: %w", err)
	}
	if len(completion.Choices) == 0 {
		return errors.New("AI upstream returned no choices")
	}

	content := extractJSONObject(completion.Choices[0].Message.Content)
	if content == "" {
		return errors.New("AI upstream returned empty JSON content")
	}
	if err := json.Unmarshal([]byte(content), out); err != nil {
		return fmt.Errorf("parse AI JSON failed: %w; content=%s", err, content)
	}
	return nil
}

type chatCompletionRequest struct {
	Model          string          `json:"model"`
	Messages       []chatMessage   `json:"messages"`
	Temperature    float64         `json:"temperature,omitempty"`
	ResponseFormat *responseFormat `json:"response_format,omitempty"`
}

type chatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type responseFormat struct {
	Type string `json:"type"`
}

type chatCompletionResponse struct {
	Choices []struct {
		Message chatMessage `json:"message"`
	} `json:"choices"`
}

func extractJSONObject(content string) string {
	trimmed := strings.TrimSpace(content)
	trimmed = strings.TrimPrefix(trimmed, "```json")
	trimmed = strings.TrimPrefix(trimmed, "```")
	trimmed = strings.TrimSuffix(trimmed, "```")
	trimmed = strings.TrimSpace(trimmed)
	if json.Valid([]byte(trimmed)) {
		return trimmed
	}

	start := strings.Index(trimmed, "{")
	end := strings.LastIndex(trimmed, "}")
	if start >= 0 && end > start {
		candidate := trimmed[start : end+1]
		if json.Valid([]byte(candidate)) {
			return candidate
		}
	}
	return ""
}
