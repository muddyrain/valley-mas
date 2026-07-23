package aiclient

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// CompatibleClient is the shared OpenAI-compatible transport. Image behavior
// is selected by provider defaults or an explicit model-level protocol adapter.
type CompatibleClient struct {
	Provider      string
	ImageProtocol string
	BaseURL       string
	APIKey        string
	Client        *http.Client
}

type CompatibleMessage struct {
	Role       string `json:"role"`
	Content    any    `json:"content,omitempty"`
	ToolCallID string `json:"tool_call_id,omitempty"`
	ToolCalls  any    `json:"tool_calls,omitempty"`
}

type CompatibleTool struct {
	Type     string `json:"type"`
	Function any    `json:"function"`
}

type CompatibleUsage struct {
	PromptTokens     int `json:"prompt_tokens"`
	CompletionTokens int `json:"completion_tokens"`
	TotalTokens      int `json:"total_tokens"`
}

type CompatibleChatRequest struct {
	Model          string              `json:"model"`
	Messages       []CompatibleMessage `json:"messages"`
	Temperature    *float64            `json:"temperature,omitempty"`
	MaxTokens      *int                `json:"max_tokens,omitempty"`
	ResponseFormat any                 `json:"response_format,omitempty"`
	Tools          []CompatibleTool    `json:"tools,omitempty"`
	ToolChoice     any                 `json:"tool_choice,omitempty"`
}

type CompatibleChatResponse struct {
	Model   string `json:"model"`
	Choices []struct {
		Message CompatibleMessage `json:"message"`
	} `json:"choices"`
	Usage CompatibleUsage `json:"usage"`
}

type CompatibleChatStreamChunk struct {
	Model   string `json:"model"`
	Choices []struct {
		Delta CompatibleMessage `json:"delta"`
	} `json:"choices"`
	Usage CompatibleUsage `json:"usage"`
}

type CompatibleEmbeddingResponse struct {
	Data []struct {
		Embedding []float32 `json:"embedding"`
		Index     int       `json:"index"`
	} `json:"data"`
	Usage CompatibleUsage `json:"usage"`
}

func NewCompatibleClient(baseURL, apiKey string, timeout time.Duration) *CompatibleClient {
	return NewProviderCompatibleClient("", baseURL, apiKey, timeout)
}

func NewProviderCompatibleClient(provider, baseURL, apiKey string, timeout time.Duration) *CompatibleClient {
	if timeout <= 0 {
		timeout = 60 * time.Second
	}
	return &CompatibleClient{
		Provider:      strings.TrimSpace(provider),
		ImageProtocol: "auto",
		BaseURL:       strings.TrimRight(strings.TrimSpace(baseURL), "/"),
		APIKey:        strings.TrimSpace(apiKey),
		Client:        &http.Client{Timeout: timeout},
	}
}

func (c *CompatibleClient) Chat(ctx context.Context, request CompatibleChatRequest) (CompatibleChatResponse, error) {
	var response CompatibleChatResponse
	if err := c.doJSON(ctx, http.MethodPost, "/chat/completions", request, &response); err != nil {
		return CompatibleChatResponse{}, err
	}
	if len(response.Choices) == 0 {
		return CompatibleChatResponse{}, fmt.Errorf("AI 上游返回空 choices")
	}
	return response, nil
}

// ChatStream consumes OpenAI-style SSE and exposes normalized delta chunks.
// Providers that omit usage in the stream still work; callers simply retain a
// zero Usage value for audit instead of estimating a billable token count.
func (c *CompatibleClient) ChatStream(ctx context.Context, payload CompatibleChatRequest, emit func(CompatibleChatStreamChunk) error) error {
	if c == nil || c.BaseURL == "" || c.APIKey == "" {
		return fmt.Errorf("AI compatible client 未配置")
	}
	encoded, err := json.Marshal(struct {
		CompatibleChatRequest
		Stream bool `json:"stream"`
	}{CompatibleChatRequest: payload, Stream: true})
	if err != nil {
		return err
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, c.BaseURL+"/chat/completions", bytes.NewReader(encoded))
	if err != nil {
		return err
	}
	request.Header.Set("Authorization", "Bearer "+c.APIKey)
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Accept", "text/event-stream")
	response, err := c.Client.Do(request)
	if err != nil {
		return fmt.Errorf("AI 上游请求失败: %w", err)
	}
	defer response.Body.Close()
	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		body, _ := io.ReadAll(io.LimitReader(response.Body, 8<<20))
		return fmt.Errorf("AI 上游返回 %d: %s", response.StatusCode, strings.TrimSpace(string(body)))
	}
	scanner := bufio.NewScanner(response.Body)
	scanner.Buffer(make([]byte, 4096), 2<<20)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if !strings.HasPrefix(line, "data:") {
			continue
		}
		data := strings.TrimSpace(strings.TrimPrefix(line, "data:"))
		if data == "[DONE]" {
			return nil
		}
		var chunk CompatibleChatStreamChunk
		if err := json.Unmarshal([]byte(data), &chunk); err != nil {
			return fmt.Errorf("解析 AI 流响应失败: %w", err)
		}
		if emit != nil {
			if err := emit(chunk); err != nil {
				return err
			}
		}
	}
	return scanner.Err()
}

func (c *CompatibleClient) Embeddings(ctx context.Context, modelID string, inputs []string) (CompatibleEmbeddingResponse, error) {
	var response CompatibleEmbeddingResponse
	payload := map[string]any{"model": modelID, "input": inputs, "encoding_format": "float"}
	if err := c.doJSON(ctx, http.MethodPost, "/embeddings", payload, &response); err != nil {
		return CompatibleEmbeddingResponse{}, err
	}
	if len(response.Data) != len(inputs) {
		return CompatibleEmbeddingResponse{}, fmt.Errorf("AI embedding 返回数量异常")
	}
	return response, nil
}

func (c *CompatibleClient) ListModels(ctx context.Context) ([]string, error) {
	var response struct {
		Data []struct {
			ID string `json:"id"`
		} `json:"data"`
	}
	if err := c.doJSON(ctx, http.MethodGet, "/models", nil, &response); err != nil {
		return nil, err
	}
	models := make([]string, 0, len(response.Data))
	for _, item := range response.Data {
		if id := strings.TrimSpace(item.ID); id != "" {
			models = append(models, id)
		}
	}
	return models, nil
}

func (c *CompatibleClient) doJSON(ctx context.Context, method, path string, payload any, destination any) error {
	return c.doJSONWithLimit(ctx, method, path, payload, destination, 8<<20)
}

func (c *CompatibleClient) doJSONWithLimit(
	ctx context.Context,
	method string,
	path string,
	payload any,
	destination any,
	maxResponseBytes int64,
) error {
	if c == nil || c.BaseURL == "" || c.APIKey == "" {
		return fmt.Errorf("AI compatible client 未配置")
	}
	var body io.Reader
	if payload != nil {
		encoded, err := json.Marshal(payload)
		if err != nil {
			return err
		}
		body = bytes.NewReader(encoded)
	}
	request, err := http.NewRequestWithContext(ctx, method, c.BaseURL+path, body)
	if err != nil {
		return err
	}
	request.Header.Set("Authorization", "Bearer "+c.APIKey)
	request.Header.Set("Accept", "application/json")
	if payload != nil {
		request.Header.Set("Content-Type", "application/json")
	}
	response, err := c.Client.Do(request)
	if err != nil {
		return fmt.Errorf("AI 上游请求失败: %w", err)
	}
	defer response.Body.Close()
	data, err := io.ReadAll(io.LimitReader(response.Body, maxResponseBytes+1))
	if err != nil {
		return err
	}
	if int64(len(data)) > maxResponseBytes {
		return fmt.Errorf("AI 上游响应超过 %dMB", maxResponseBytes>>20)
	}
	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		return fmt.Errorf("AI 上游返回 %d: %s", response.StatusCode, strings.TrimSpace(string(data)))
	}
	if err := json.Unmarshal(data, destination); err != nil {
		return fmt.Errorf("解析 AI 响应失败: %w", err)
	}
	return nil
}
