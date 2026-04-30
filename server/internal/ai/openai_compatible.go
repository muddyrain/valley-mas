package ai

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"time"
	"valley-server/internal/mindarena"
)

type OpenAICompatibleConfig struct {
	Provider string
	BaseURL  string
	APIKey   string
	Model    string
}

type OpenAICompatibleService struct {
	provider string
	baseURL  string
	apiKey   string
	model    string
	client   *http.Client
}

func NewOpenAICompatibleService(cfg OpenAICompatibleConfig) *OpenAICompatibleService {
	provider := normalizeAIProvider(cfg.Provider)
	baseURL := defaultAIBaseURL(provider, cfg.BaseURL)
	model := strings.TrimSpace(cfg.Model)
	if model == "" && provider != AIProviderDoubao {
		model = "gpt-4o-mini"
	}
	return &OpenAICompatibleService{
		provider: provider,
		baseURL:  baseURL,
		apiKey:   strings.TrimSpace(cfg.APIKey),
		model:    model,
		client:   &http.Client{Timeout: 45 * time.Second},
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
	return normalizeGeneratedPersonas(out.Personas), nil
}

func (s *OpenAICompatibleService) GeneratePersona(ctx context.Context, topic string, mode string, persona mindarena.Persona, index int, count int) (*mindarena.Persona, error) {
	startedAt := time.Now()
	log.Printf("ai-mind-arena: upstream persona request start provider=%s model=%s index=%d/%d persona=%s", s.provider, s.model, index+1, count, persona.Name)

	var out struct {
		Persona  *mindarena.Persona  `json:"persona"`
		Personas []mindarena.Persona `json:"personas"`
	}
	if err := s.chatJSON(ctx, PERSONA_SINGLE_GENERATOR_PROMPT, buildSinglePersonaPromptInput(topic, mode, persona, index, count), &out); err != nil {
		log.Printf("ai-mind-arena: upstream persona request failed provider=%s model=%s index=%d/%d persona=%s elapsed=%s err=%v", s.provider, s.model, index+1, count, persona.Name, time.Since(startedAt).Round(time.Millisecond), err)
		return nil, err
	}
	if out.Persona != nil {
		normalized := normalizeGeneratedPersona(*out.Persona, persona)
		log.Printf("ai-mind-arena: upstream persona request done provider=%s model=%s index=%d/%d persona=%s elapsed=%s", s.provider, s.model, index+1, count, normalized.Name, time.Since(startedAt).Round(time.Millisecond))
		return &normalized, nil
	}
	if len(out.Personas) > 0 {
		normalized := normalizeGeneratedPersona(out.Personas[0], persona)
		log.Printf("ai-mind-arena: upstream persona request done provider=%s model=%s index=%d/%d persona=%s elapsed=%s", s.provider, s.model, index+1, count, normalized.Name, time.Since(startedAt).Round(time.Millisecond))
		return &normalized, nil
	}
	log.Printf("ai-mind-arena: upstream persona request empty provider=%s model=%s index=%d/%d persona=%s elapsed=%s", s.provider, s.model, index+1, count, persona.Name, time.Since(startedAt).Round(time.Millisecond))
	return nil, errors.New("model returned empty persona")
}

func (s *OpenAICompatibleService) GenerateDebateRound(ctx context.Context, topic string, mode string, personas []mindarena.Persona, round int, history []mindarena.DebateMessage, supportHistory []mindarena.RoundSupportChoice) ([]mindarena.DebateMessage, error) {
	var out struct {
		Messages []mindarena.DebateMessage `json:"messages"`
	}
	if err := s.chatJSON(ctx, DEBATE_ROUND_PROMPT, buildDebateRoundPromptInput(topic, mode, personas, round, history, supportHistory), &out); err != nil {
		return nil, err
	}
	if len(out.Messages) == 0 {
		return nil, errors.New("model returned empty debate messages")
	}
	return normalizeGeneratedDebateMessages(out.Messages, personas, round), nil
}

func (s *OpenAICompatibleService) GenerateDebateMessage(ctx context.Context, topic string, mode string, personas []mindarena.Persona, persona mindarena.Persona, round int, history []mindarena.DebateMessage, supportHistory []mindarena.RoundSupportChoice) (*mindarena.DebateMessage, error) {
	var out struct {
		Messages []mindarena.DebateMessage `json:"messages"`
	}
	if err := s.chatJSON(ctx, DEBATE_ROUND_PROMPT, buildDebateMessagePromptInput(topic, mode, personas, persona, round, history, supportHistory), &out); err != nil {
		return nil, err
	}
	normalized := normalizeGeneratedDebateMessages(out.Messages, []mindarena.Persona{persona}, round)
	if len(normalized) == 0 {
		return nil, errors.New("model returned empty debate message")
	}
	return &normalized[0], nil
}

func (s *OpenAICompatibleService) JudgeDebate(ctx context.Context, topic string, personas []mindarena.Persona, messages []mindarena.DebateMessage) (*mindarena.DebateResult, error) {
	var result mindarena.DebateResult
	if err := s.chatJSON(ctx, JUDGE_PROMPT, buildJudgePromptInput(topic, personas, messages), &result); err != nil {
		return nil, err
	}
	return normalizeGeneratedDebateResult(result, personas, messages), nil
}

func (s *OpenAICompatibleService) chatJSON(ctx context.Context, systemPrompt string, userPrompt string, out any) error {
	if s.apiKey == "" {
		return errors.New("AI_API_KEY is empty")
	}
	if s.model == "" {
		if s.provider == AIProviderDoubao {
			return errors.New("AI_MODEL is empty for doubao provider")
		}
		return errors.New("AI_MODEL is empty")
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
	respBody, statusCode, err := s.sendChatCompletionRequest(ctx, reqBody)
	if err != nil {
		return err
	}
	if statusCode >= 200 && statusCode < 300 {
		return decodeChatCompletion(respBody, out)
	}
	if shouldRetryWithoutResponseFormat(statusCode, respBody) {
		reqBody.ResponseFormat = nil
		respBody, statusCode, err = s.sendChatCompletionRequest(ctx, reqBody)
		if err != nil {
			return err
		}
		if statusCode >= 200 && statusCode < 300 {
			return decodeChatCompletion(respBody, out)
		}
	}
	return fmt.Errorf("AI upstream returned %d: %s", statusCode, strings.TrimSpace(string(respBody)))
}

func (s *OpenAICompatibleService) sendChatCompletionRequest(ctx context.Context, reqBody chatCompletionRequest) ([]byte, int, error) {
	body, err := json.Marshal(reqBody)
	if err != nil {
		return nil, 0, err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, s.baseURL+"/chat/completions", strings.NewReader(string(body)))
	if err != nil {
		return nil, 0, err
	}
	req.Header.Set("Authorization", "Bearer "+s.apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, 0, fmt.Errorf("AI upstream request failed: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, 0, err
	}
	return respBody, resp.StatusCode, nil
}

func decodeChatCompletion(respBody []byte, out any) error {
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

func shouldRetryWithoutResponseFormat(statusCode int, respBody []byte) bool {
	if statusCode != http.StatusBadRequest {
		return false
	}
	body := strings.ToLower(string(respBody))
	return strings.Contains(body, "response_format.type") && strings.Contains(body, "not supported")
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

func defaultAIBaseURL(provider string, baseURL string) string {
	trimmed := strings.TrimRight(strings.TrimSpace(baseURL), "/")
	if trimmed != "" {
		return trimmed
	}
	if provider == AIProviderDoubao {
		return "https://ark.cn-beijing.volces.com/api/v3"
	}
	return "https://api.openai.com/v1"
}
