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
	"sync"
	"time"
	"valley-server/internal/aiusage"

	"github.com/volcengine/volcengine-go-sdk/service/arkruntime"
	arkmodel "github.com/volcengine/volcengine-go-sdk/service/arkruntime/model"
)

type TextRequest struct {
	System      string
	Prompt      string
	MaxTokens   int
	Temperature float32
	JSONMode    bool
}

type VisionRequest struct {
	ImageInput  string
	Prompt      string
	MaxTokens   int
	Temperature float32
}

type Result struct {
	Content string
	Model   string
	Source  string
}

type Client struct{}

var (
	arkClientOnce sync.Once
	arkClient     *arkruntime.Client
)

func NewClient() Client {
	return Client{}
}

func EnsureARKClient(apiKey, baseURL string) *arkruntime.Client {
	arkClientOnce.Do(func() {
		arkClient = arkruntime.NewClientWithApiKey(
			apiKey,
			arkruntime.WithBaseUrl(baseURL),
			arkruntime.WithTimeout(35*time.Second),
		)
	})
	return arkClient
}

func ResetARKClientForTest() {
	arkClient = nil
	arkClientOnce = sync.Once{}
}

func (Client) GenerateJSON(ctx context.Context, cfg TextConfig, req TextRequest) (Result, error) {
	if req.MaxTokens <= 0 {
		req.MaxTokens = 260
	}
	if req.Temperature <= 0 {
		req.Temperature = 0.35
	}
	if strings.TrimSpace(req.System) == "" {
		req.System = "你是 Life Trace 的生活计划 AI。只输出 JSON 对象，不要 Markdown，不要解释。"
	}
	req.JSONMode = true
	return NewClient().GenerateText(ctx, cfg, req)
}

func (Client) GenerateText(ctx context.Context, cfg TextConfig, req TextRequest) (Result, error) {
	if req.MaxTokens <= 0 {
		req.MaxTokens = 260
	}
	if req.Temperature <= 0 {
		req.Temperature = 0.35
	}

	if cfg.Source == "openai" {
		return generateOpenAIText(ctx, cfg, req)
	}
	return generateARKText(ctx, cfg, req)
}

func (Client) GenerateVisionJSON(ctx context.Context, cfg ImageConfig, req VisionRequest) (Result, error) {
	if req.MaxTokens <= 0 {
		req.MaxTokens = 900
	}
	if req.Temperature <= 0 {
		req.Temperature = 0.3
	}

	start := time.Now()
	client := EnsureARKClient(cfg.APIKey, cfg.BaseURL)
	content := &arkmodel.ChatCompletionMessageContent{}
	if cfg.UseVision {
		imageURL := NormalizeImageInput(req.ImageInput)
		content.ListValue = []*arkmodel.ChatCompletionMessageContentPart{
			{
				Type: arkmodel.ChatCompletionMessageContentPartTypeImageURL,
				ImageURL: &arkmodel.ChatMessageImageURL{
					URL:    imageURL,
					Detail: arkmodel.ImageURLDetailLow,
				},
			},
			{
				Type: arkmodel.ChatCompletionMessageContentPartTypeText,
				Text: req.Prompt,
			},
		}
	} else {
		content.StringValue = &req.Prompt
	}

	resp, err := client.CreateChatCompletion(ctx, arkmodel.CreateChatCompletionRequest{
		Model: cfg.Model,
		Messages: []*arkmodel.ChatCompletionMessage{
			{Role: arkmodel.ChatMessageRoleUser, Content: content},
		},
		MaxTokens:   &req.MaxTokens,
		Temperature: &req.Temperature,
	})
	if err != nil {
		recordUsage(ctx, "ark", cfg.Model, req.Prompt, "", aiusage.Since(start), err)
		return Result{}, err
	}
	raw, err := extractARKContent(resp)
	if err != nil {
		recordUsage(ctx, "ark", resp.Model, req.Prompt, "", aiusage.Since(start), err)
		return Result{Model: resp.Model, Source: "ark"}, err
	}
	recordUsage(ctx, "ark", resp.Model, req.Prompt, raw, aiusage.Since(start), nil)
	return Result{Content: raw, Model: resp.Model, Source: "ark"}, nil
}

func generateARKText(ctx context.Context, cfg TextConfig, req TextRequest) (Result, error) {
	start := time.Now()
	client := EnsureARKClient(cfg.APIKey, cfg.BaseURL)
	resp, err := client.CreateChatCompletion(ctx, arkmodel.CreateChatCompletionRequest{
		Model: cfg.Model,
		Messages: []*arkmodel.ChatCompletionMessage{
			{
				Role: arkmodel.ChatMessageRoleSystem,
				Content: &arkmodel.ChatCompletionMessageContent{
					StringValue: &req.System,
				},
			},
			{
				Role: arkmodel.ChatMessageRoleUser,
				Content: &arkmodel.ChatCompletionMessageContent{
					StringValue: &req.Prompt,
				},
			},
		},
		MaxTokens:   &req.MaxTokens,
		Temperature: &req.Temperature,
	})
	if err != nil {
		recordUsage(ctx, "ark", cfg.Model, req.Prompt, "", aiusage.Since(start), err)
		return Result{}, err
	}

	raw, err := extractARKContent(resp)
	if err != nil {
		recordUsage(ctx, "ark", resp.Model, req.Prompt, "", aiusage.Since(start), err)
		return Result{Model: resp.Model, Source: "ark"}, err
	}
	recordUsage(ctx, "ark", resp.Model, req.Prompt, raw, aiusage.Since(start), nil)
	return Result{Content: raw, Model: resp.Model, Source: "ark"}, nil
}

func extractARKContent(resp arkmodel.ChatCompletionResponse) (string, error) {
	if len(resp.Choices) == 0 || resp.Choices[0].Message.Content == nil {
		return "", errors.New("empty AI response")
	}

	contentValue := resp.Choices[0].Message.Content
	if contentValue.StringValue != nil {
		raw := strings.TrimSpace(*contentValue.StringValue)
		if raw == "" {
			return "", errors.New("empty AI content")
		}
		return raw, nil
	}

	parts := make([]string, 0, len(contentValue.ListValue))
	for _, part := range contentValue.ListValue {
		if part != nil && strings.TrimSpace(part.Text) != "" {
			parts = append(parts, strings.TrimSpace(part.Text))
		}
	}
	raw := strings.TrimSpace(strings.Join(parts, "\n"))
	if raw == "" {
		return "", errors.New("empty AI content")
	}
	return raw, nil
}

type openAIRequest struct {
	Model          string          `json:"model"`
	Messages       []openAIMessage `json:"messages"`
	Temperature    float32         `json:"temperature,omitempty"`
	MaxTokens      int             `json:"max_tokens,omitempty"`
	ResponseFormat *responseFormat `json:"response_format,omitempty"`
	Stream         bool            `json:"stream,omitempty"`
}

type openAIMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type responseFormat struct {
	Type string `json:"type"`
}

type openAIResponse struct {
	Model   string `json:"model"`
	Choices []struct {
		Message openAIMessage `json:"message"`
	} `json:"choices"`
}

func generateOpenAIText(ctx context.Context, cfg TextConfig, req TextRequest) (Result, error) {
	start := time.Now()
	payload := openAIRequest{
		Model: cfg.Model,
		Messages: []openAIMessage{
			{Role: "system", Content: req.System},
			{Role: "user", Content: req.Prompt},
		},
		Temperature: req.Temperature,
		MaxTokens:   req.MaxTokens,
	}
	if req.JSONMode {
		payload.ResponseFormat = &responseFormat{Type: "json_object"}
	}

	body, err := json.Marshal(payload)
	if err != nil {
		recordUsage(ctx, "openai", cfg.Model, req.Prompt, "", aiusage.Since(start), err)
		return Result{}, err
	}

	httpClient := &http.Client{Timeout: cfg.Timeout}
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, cfg.BaseURL+"/chat/completions", bytes.NewReader(body))
	if err != nil {
		recordUsage(ctx, "openai", cfg.Model, req.Prompt, "", aiusage.Since(start), err)
		return Result{}, err
	}
	httpReq.Header.Set("Authorization", "Bearer "+cfg.APIKey)
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Accept", "application/json")

	resp, err := httpClient.Do(httpReq)
	if err != nil {
		recordUsage(ctx, "openai", cfg.Model, req.Prompt, "", aiusage.Since(start), err)
		return Result{}, err
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		recordUsage(ctx, "openai", cfg.Model, req.Prompt, "", aiusage.Since(start), err)
		return Result{}, err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		err := fmt.Errorf("OpenAI upstream returned %d: %s", resp.StatusCode, trimRunes(string(respBody), 180))
		recordUsage(ctx, "openai", cfg.Model, req.Prompt, "", aiusage.Since(start), err)
		return Result{}, err
	}

	var parsed openAIResponse
	if err := json.Unmarshal(respBody, &parsed); err != nil {
		wrapped := fmt.Errorf("decode OpenAI response failed: %w", err)
		recordUsage(ctx, "openai", cfg.Model, req.Prompt, "", aiusage.Since(start), wrapped)
		return Result{}, wrapped
	}
	if len(parsed.Choices) == 0 {
		err := errors.New("OpenAI upstream returned no choices")
		recordUsage(ctx, "openai", parsed.Model, req.Prompt, "", aiusage.Since(start), err)
		return Result{Model: parsed.Model, Source: "openai"}, err
	}

	content := strings.TrimSpace(parsed.Choices[0].Message.Content)
	if content == "" {
		err := errors.New("OpenAI upstream returned empty content")
		recordUsage(ctx, "openai", parsed.Model, req.Prompt, "", aiusage.Since(start), err)
		return Result{Model: parsed.Model, Source: "openai"}, err
	}

	recordUsage(ctx, "openai", parsed.Model, req.Prompt, content, aiusage.Since(start), nil)
	return Result{Content: content, Model: parsed.Model, Source: "openai"}, nil
}

func NormalizeImageInput(raw string) string {
	imageURL := strings.TrimSpace(raw)
	lower := strings.ToLower(imageURL)
	if strings.HasPrefix(lower, "http://") ||
		strings.HasPrefix(lower, "https://") ||
		strings.HasPrefix(lower, "data:") {
		return imageURL
	}
	return "data:image/jpeg;base64," + imageURL
}

func recordUsage(ctx context.Context, provider string, modelName string, prompt string, response string, latencyMs int64, err error) {
	audit := aiusage.FromContext(ctx)
	status := aiusage.StatusSuccess
	errMessage := ""
	if err != nil {
		status = aiusage.StatusFailed
		errMessage = err.Error()
	}
	aiusage.Record(aiusage.Entry{
		Feature:       audit.Feature,
		Provider:      provider,
		Model:         modelName,
		UserID:        audit.UserID,
		Status:        status,
		PromptChars:   aiusage.CharCount(prompt),
		ResponseChars: aiusage.CharCount(response),
		LatencyMs:     latencyMs,
		ErrorMessage:  errMessage,
	})
}

func trimRunes(raw string, max int) string {
	text := strings.TrimSpace(raw)
	if max <= 0 {
		return text
	}
	runes := []rune(text)
	if len(runes) <= max {
		return text
	}
	return string(runes[:max])
}
