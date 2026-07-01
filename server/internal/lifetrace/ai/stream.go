package ai

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"valley-server/internal/aiclient"

	arkmodel "github.com/volcengine/volcengine-go-sdk/service/arkruntime/model"
)

// AssistantStreamOptions 描述一次 Assistant 流式对话的参数。
// BeforeDone 在收到上游 EOF / stream error / done 信号时触发，
// 让调用方在最终 done chunk 之前追加 SSE 帧（例如 Action payload）。
type AssistantStreamOptions struct {
	ModelID     string
	System      string
	User        string
	MaxTokens   int
	Temperature float32
	BeforeDone  func(w *aiclient.SSEWriter)
}

// assistantStreamFrame 与 lifeTraceAssistantStreamChunk 在无 Action 时 JSON 字节等价。
type assistantStreamFrame struct {
	Chunk  string `json:"chunk,omitempty"`
	Done   bool   `json:"done,omitempty"`
	Error  string `json:"error,omitempty"`
	Source string `json:"source,omitempty"`
	Model  string `json:"model,omitempty"`
}

func (Client) StreamAssistantARK(ctx context.Context, w *aiclient.SSEWriter, opts AssistantStreamOptions) error {
	if w == nil {
		return errors.New("nil SSEWriter")
	}
	client := EnsureARKClient("", "")
	if client == nil {
		return errors.New("ARK client unavailable")
	}
	maxTokens := opts.MaxTokens
	if maxTokens <= 0 {
		maxTokens = 320
	}
	temperature := opts.Temperature
	if temperature <= 0 {
		temperature = 0.55
	}
	_ = w.Send(assistantStreamFrame{Source: "ark", Model: opts.ModelID})

	systemContent := opts.System
	userContent := opts.User
	stream, err := client.CreateChatCompletionStream(ctx, arkmodel.CreateChatCompletionRequest{
		Model: opts.ModelID,
		Messages: []*arkmodel.ChatCompletionMessage{
			{Role: arkmodel.ChatMessageRoleSystem, Content: &arkmodel.ChatCompletionMessageContent{StringValue: &systemContent}},
			{Role: arkmodel.ChatMessageRoleUser, Content: &arkmodel.ChatCompletionMessageContent{StringValue: &userContent}},
		},
		MaxTokens:   &maxTokens,
		Temperature: &temperature,
	})
	if err != nil {
		_ = w.Send(assistantStreamFrame{Error: "AI 服务请求失败：" + err.Error(), Done: true})
		return nil
	}
	defer stream.Close()

	for {
		resp, err := stream.Recv()
		if errors.Is(err, io.EOF) {
			if opts.BeforeDone != nil {
				opts.BeforeDone(w)
			}
			_ = w.Send(assistantStreamFrame{Source: "ark", Model: opts.ModelID, Done: true})
			return nil
		}
		if err != nil {
			_ = w.Send(assistantStreamFrame{Error: "AI 服务请求失败：" + err.Error(), Done: true})
			return nil
		}

		currentModel := strings.TrimSpace(resp.Model)
		if currentModel == "" {
			currentModel = opts.ModelID
		}

		done := false
		for _, choice := range resp.Choices {
			if choice == nil {
				continue
			}
			if strings.TrimSpace(choice.Delta.Content) != "" {
				_ = w.Send(assistantStreamFrame{Source: "ark", Model: currentModel, Chunk: choice.Delta.Content})
			}
			if choice.FinishReason != arkmodel.FinishReasonNull && choice.FinishReason != "" {
				done = true
			}
		}
		if done {
			if opts.BeforeDone != nil {
				opts.BeforeDone(w)
			}
			_ = w.Send(assistantStreamFrame{Source: "ark", Model: currentModel, Done: true})
			return nil
		}
	}
}

func (Client) StreamAssistantOpenAI(ctx context.Context, w *aiclient.SSEWriter, cfg TextConfig, opts AssistantStreamOptions) error {
	if w == nil {
		return errors.New("nil SSEWriter")
	}
	maxTokens := opts.MaxTokens
	if maxTokens <= 0 {
		maxTokens = 320
	}
	temperature := opts.Temperature
	if temperature <= 0 {
		temperature = 0.55
	}
	_ = w.Send(assistantStreamFrame{Source: "openai", Model: cfg.Model})

	body, err := json.Marshal(aiclient.OpenAIRequest{
		Model: cfg.Model,
		Messages: []aiclient.OpenAIMessage{
			{Role: "system", Content: opts.System},
			{Role: "user", Content: opts.User},
		},
		Temperature: float64(temperature),
		MaxTokens:   maxTokens,
		Stream:      true,
	})
	if err != nil {
		_ = w.Send(assistantStreamFrame{Error: "AI 服务请求失败：" + err.Error(), Done: true})
		return nil
	}

	httpClient := &http.Client{Timeout: cfg.Timeout}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, cfg.BaseURL+"/chat/completions", bytes.NewReader(body))
	if err != nil {
		_ = w.Send(assistantStreamFrame{Error: "AI 服务请求失败：" + err.Error(), Done: true})
		return nil
	}
	req.Header.Set("Authorization", "Bearer "+cfg.APIKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "text/event-stream")

	resp, err := httpClient.Do(req)
	if err != nil {
		_ = w.Send(assistantStreamFrame{Error: "AI 服务请求失败：" + err.Error(), Done: true})
		return nil
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		respBody, readErr := io.ReadAll(resp.Body)
		if readErr != nil {
			_ = w.Send(assistantStreamFrame{Error: "AI 服务请求失败：" + readErr.Error(), Done: true})
			return nil
		}
		_ = w.Send(assistantStreamFrame{
			Error: fmt.Sprintf("AI 服务请求失败：OpenAI upstream returned %d: %s", resp.StatusCode, aiclient.TrimRunes(string(respBody), 180)),
			Done:  true,
		})
		return nil
	}

	scanner := bufio.NewScanner(resp.Body)
	scanner.Buffer(make([]byte, 0, 64*1024), 1024*1024)
	currentModel := cfg.Model
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, ":") {
			continue
		}
		if !strings.HasPrefix(line, "data:") {
			continue
		}
		data := strings.TrimSpace(strings.TrimPrefix(line, "data:"))
		if data == "[DONE]" {
			if opts.BeforeDone != nil {
				opts.BeforeDone(w)
			}
			_ = w.Send(assistantStreamFrame{Source: "openai", Model: currentModel, Done: true})
			return nil
		}

		var chunk aiclient.OpenAIStreamResponse
		if err := json.Unmarshal([]byte(data), &chunk); err != nil {
			continue
		}
		if strings.TrimSpace(chunk.Model) != "" {
			currentModel = chunk.Model
		}
		for _, choice := range chunk.Choices {
			if strings.TrimSpace(choice.Delta.Content) != "" {
				_ = w.Send(assistantStreamFrame{Source: "openai", Model: currentModel, Chunk: choice.Delta.Content})
			}
			if choice.FinishReason != "" {
				if opts.BeforeDone != nil {
					opts.BeforeDone(w)
				}
				_ = w.Send(assistantStreamFrame{Source: "openai", Model: currentModel, Done: true})
				return nil
			}
		}
	}
	if err := scanner.Err(); err != nil {
		_ = w.Send(assistantStreamFrame{Error: "AI 服务请求失败：" + err.Error(), Done: true})
		return nil
	}

	if opts.BeforeDone != nil {
		opts.BeforeDone(w)
	}
	_ = w.Send(assistantStreamFrame{Source: "openai", Model: currentModel, Done: true})
	return nil
}
