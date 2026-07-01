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
	"valley-server/internal/aiclient"
	"valley-server/internal/aiusage"

	arkmodel "github.com/volcengine/volcengine-go-sdk/service/arkruntime/model"
)

// AssistantCallOptions 描述一次 Assistant tool-call 请求的可调参数。
// ToolSchema 从调用方注入，避免 lifeai 反向依赖 lifetrace 域业务枚举。
type AssistantCallOptions struct {
	ToolName    string
	ToolSchema  map[string]any
	MaxTokens   int
	Temperature float32
}

// AssistantStructuredResult 是一次 Assistant 调用的原始产出。
// Content 为 tool_call arguments 或 JSON mode 返回的 JSON 字符串；由上层解析。
type AssistantStructuredResult struct {
	Content string
	Model   string
	Source  string
}

// CallAssistantStructured 走双轨（OpenAI / ARK）tool 调用；
// 若上游拒绝 tools（返回 ErrAssistantToolUnsupported 或 ErrAssistantToolInvalid），
// 则自动降级到 JSON mode（复用 Client.GenerateJSON），并返回 raw JSON 字符串。
func (Client) CallAssistantStructured(
	ctx context.Context,
	cfg TextConfig,
	systemPrompt string,
	structuredPrompt string,
	opts AssistantCallOptions,
) (AssistantStructuredResult, error) {
	if opts.MaxTokens <= 0 {
		opts.MaxTokens = 420
	}
	if opts.Temperature <= 0 {
		opts.Temperature = 0.2
	}

	result, err := callAssistantTool(ctx, cfg, systemPrompt, structuredPrompt, opts)
	if err == nil {
		return result, nil
	}
	if !shouldFallbackToJSON(err) {
		return AssistantStructuredResult{Model: result.Model, Source: result.Source}, err
	}

	jsonResult, jsonErr := NewClient().GenerateJSON(ctx, cfg, TextRequest{
		System:      systemPrompt,
		Prompt:      structuredPrompt,
		MaxTokens:   opts.MaxTokens,
		Temperature: opts.Temperature,
	})
	if jsonErr != nil {
		return AssistantStructuredResult{Model: jsonResult.Model, Source: jsonResult.Source}, jsonErr
	}
	return AssistantStructuredResult{
		Content: jsonResult.Content,
		Model:   jsonResult.Model,
		Source:  jsonResult.Source,
	}, nil
}

func shouldFallbackToJSON(err error) bool {
	return errors.Is(err, ErrAssistantToolUnsupported) || errors.Is(err, ErrAssistantToolInvalid)
}

func callAssistantTool(
	ctx context.Context,
	cfg TextConfig,
	systemPrompt string,
	structuredPrompt string,
	opts AssistantCallOptions,
) (AssistantStructuredResult, error) {
	if cfg.Source == "openai" {
		return callAssistantToolOpenAI(ctx, cfg, systemPrompt, structuredPrompt, opts)
	}
	return callAssistantToolARK(ctx, cfg, systemPrompt, structuredPrompt, opts)
}

func callAssistantToolARK(
	ctx context.Context,
	cfg TextConfig,
	systemPrompt string,
	structuredPrompt string,
	opts AssistantCallOptions,
) (AssistantStructuredResult, error) {
	start := time.Now()
	client := EnsureARKClient(cfg.APIKey, cfg.BaseURL)
	systemContent := strings.TrimSpace(systemPrompt)
	userContent := strings.TrimSpace(structuredPrompt)

	req := aiclient.NewARKChatRequestWithTools(
		cfg.Model,
		[]*arkmodel.ChatCompletionMessage{
			{
				Role: arkmodel.ChatMessageRoleSystem,
				Content: &arkmodel.ChatCompletionMessageContent{
					StringValue: &systemContent,
				},
			},
			{
				Role: arkmodel.ChatMessageRoleUser,
				Content: &arkmodel.ChatCompletionMessageContent{
					StringValue: &userContent,
				},
			},
		},
		[]*arkmodel.Tool{
			{
				Type: arkmodel.ToolTypeFunction,
				Function: &arkmodel.FunctionDefinition{
					Name:        opts.ToolName,
					Description: "提交 Life Trace 生活助理的回复和动作结果",
					Parameters:  opts.ToolSchema,
				},
			},
		},
		arkmodel.ToolChoice{
			Type:     arkmodel.ToolTypeFunction,
			Function: arkmodel.ToolChoiceFunction{Name: opts.ToolName},
		},
		aiclient.WithARKChatTokens(opts.MaxTokens),
		aiclient.WithARKChatTemperature(opts.Temperature),
	)

	resp, err := client.CreateChatCompletion(ctx, req)
	if err != nil {
		recordUsage(ctx, "ark", cfg.Model, structuredPrompt, "", aiusage.Since(start), err)
		if aiclient.IsARKToolUnsupportedError(err) {
			return AssistantStructuredResult{Source: "ark"}, fmt.Errorf("%w: %v", ErrAssistantToolUnsupported, err)
		}
		return AssistantStructuredResult{Source: "ark"}, err
	}
	if len(resp.Choices) == 0 {
		invalid := fmt.Errorf("%w: empty AI response", ErrAssistantToolInvalid)
		recordUsage(ctx, "ark", resp.Model, structuredPrompt, "", aiusage.Since(start), invalid)
		return AssistantStructuredResult{Model: resp.Model, Source: "ark"}, invalid
	}
	raw, err := extractARKToolCallArguments(resp.Choices[0].Message.ToolCalls, opts.ToolName)
	if err != nil {
		recordUsage(ctx, "ark", resp.Model, structuredPrompt, "", aiusage.Since(start), err)
		return AssistantStructuredResult{Model: resp.Model, Source: "ark"}, err
	}
	recordUsage(ctx, "ark", resp.Model, structuredPrompt, raw, aiusage.Since(start), nil)
	return AssistantStructuredResult{Content: raw, Model: resp.Model, Source: "ark"}, nil
}

func extractARKToolCallArguments(toolCalls []*arkmodel.ToolCall, toolName string) (string, error) {
	for _, toolCall := range toolCalls {
		if toolCall == nil {
			continue
		}
		if toolCall.Function.Name != toolName {
			continue
		}
		return toolCall.Function.Arguments, nil
	}
	return "", fmt.Errorf("%w: missing matching tool call", ErrAssistantToolInvalid)
}

func callAssistantToolOpenAI(
	ctx context.Context,
	cfg TextConfig,
	systemPrompt string,
	structuredPrompt string,
	opts AssistantCallOptions,
) (AssistantStructuredResult, error) {
	start := time.Now()
	parallelToolCalls := false
	payload := aiclient.OpenAIRequest{
		Model: cfg.Model,
		Messages: []aiclient.OpenAIMessage{
			{Role: "system", Content: systemPrompt},
			{Role: "user", Content: structuredPrompt},
		},
		Temperature: float64(opts.Temperature),
		MaxTokens:   opts.MaxTokens,
		Tools: []aiclient.OpenAITool{
			{
				Type: "function",
				Function: &aiclient.OpenAIFunctionDefinition{
					Name:        opts.ToolName,
					Description: "提交 Life Trace 生活助理的回复和动作结果",
					Parameters:  opts.ToolSchema,
				},
			},
		},
		ToolChoice: aiclient.OpenAIToolChoice{
			Type:     "function",
			Function: aiclient.OpenAIToolChoiceFunction{Name: opts.ToolName},
		},
		ParallelToolCalls: &parallelToolCalls,
	}
	body, err := json.Marshal(payload)
	if err != nil {
		recordUsage(ctx, "openai", cfg.Model, structuredPrompt, "", aiusage.Since(start), err)
		return AssistantStructuredResult{Source: "openai"}, err
	}

	httpClient := &http.Client{Timeout: cfg.Timeout}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, cfg.BaseURL+"/chat/completions", bytes.NewReader(body))
	if err != nil {
		recordUsage(ctx, "openai", cfg.Model, structuredPrompt, "", aiusage.Since(start), err)
		return AssistantStructuredResult{Source: "openai"}, err
	}
	req.Header.Set("Authorization", "Bearer "+cfg.APIKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	resp, err := httpClient.Do(req)
	if err != nil {
		recordUsage(ctx, "openai", cfg.Model, structuredPrompt, "", aiusage.Since(start), err)
		return AssistantStructuredResult{Source: "openai"}, err
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		recordUsage(ctx, "openai", cfg.Model, structuredPrompt, "", aiusage.Since(start), err)
		return AssistantStructuredResult{Source: "openai"}, err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		if aiclient.IsOpenAIToolUnsupported(resp.StatusCode, respBody) {
			unsupported := fmt.Errorf("%w: %s", ErrAssistantToolUnsupported, aiclient.TrimRunes(string(respBody), 180))
			recordUsage(ctx, "openai", cfg.Model, structuredPrompt, "", aiusage.Since(start), unsupported)
			return AssistantStructuredResult{Source: "openai"}, unsupported
		}
		wrapped := fmt.Errorf("OpenAI upstream returned %d: %s", resp.StatusCode, aiclient.TrimRunes(string(respBody), 180))
		recordUsage(ctx, "openai", cfg.Model, structuredPrompt, "", aiusage.Since(start), wrapped)
		return AssistantStructuredResult{Source: "openai"}, wrapped
	}

	var parsed aiclient.OpenAIResponse
	if err := json.Unmarshal(respBody, &parsed); err != nil {
		wrapped := fmt.Errorf("decode OpenAI response failed: %w", err)
		recordUsage(ctx, "openai", cfg.Model, structuredPrompt, "", aiusage.Since(start), wrapped)
		return AssistantStructuredResult{Source: "openai"}, wrapped
	}
	if len(parsed.Choices) == 0 {
		invalid := fmt.Errorf("%w: OpenAI upstream returned no choices", ErrAssistantToolInvalid)
		recordUsage(ctx, "openai", parsed.Model, structuredPrompt, "", aiusage.Since(start), invalid)
		return AssistantStructuredResult{Model: parsed.Model, Source: "openai"}, invalid
	}
	raw, err := extractOpenAIToolCallArguments(parsed.Choices[0].Message.ToolCalls, opts.ToolName)
	if err != nil {
		recordUsage(ctx, "openai", parsed.Model, structuredPrompt, "", aiusage.Since(start), err)
		return AssistantStructuredResult{Model: parsed.Model, Source: "openai"}, err
	}
	recordUsage(ctx, "openai", parsed.Model, structuredPrompt, raw, aiusage.Since(start), nil)
	return AssistantStructuredResult{Content: raw, Model: parsed.Model, Source: "openai"}, nil
}

func extractOpenAIToolCallArguments(toolCalls []aiclient.OpenAIToolCall, toolName string) (string, error) {
	for _, toolCall := range toolCalls {
		if toolCall.Function.Name != toolName {
			continue
		}
		return toolCall.Function.Arguments, nil
	}
	return "", fmt.Errorf("%w: missing matching tool call", ErrAssistantToolInvalid)
}
