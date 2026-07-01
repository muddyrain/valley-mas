package lifetrace

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"
	"valley-server/internal/aiclient"
	"valley-server/internal/aiusage"
	lifeai "valley-server/internal/lifetrace/ai"

	"github.com/gin-gonic/gin"
	"github.com/volcengine/volcengine-go-sdk/service/arkruntime"
	arkmodel "github.com/volcengine/volcengine-go-sdk/service/arkruntime/model"
)

func readLifeTraceAIConfig() (lifeTraceAIConfig, string) {
	return lifeai.ReadTextConfig(lifeTraceTodayAdviceDefaultTimeout)
}

func readLifeTraceArkTextConfig() (apiKey, arkBaseURL, textModel string, errMsg string) {
	apiKey = strings.TrimSpace(os.Getenv("ARK_API_KEY"))
	textModel = strings.TrimSpace(os.Getenv("ARK_TEXT_MODEL"))
	arkBaseURL = strings.TrimSpace(os.Getenv("ARK_BASE_URL"))
	if arkBaseURL == "" {
		arkBaseURL = "https://ark.cn-beijing.volces.com/api/v3"
	}
	if apiKey == "" {
		return "", "", "", "AI 未配置：缺少 ARK_API_KEY"
	}
	if !strings.HasPrefix(textModel, "ep-") {
		return "", "", "", "AI 未配置：ARK_TEXT_MODEL 必须以 ep- 开头"
	}
	return apiKey, arkBaseURL, textModel, ""
}

func ensureLifeTraceArkClient(apiKey, arkBaseURL string) *arkruntime.Client {
	return lifeai.EnsureARKClient(apiKey, arkBaseURL)
}

func callLifeTraceAssistantStructuredResponse(
	ctx context.Context,
	cfg lifeTraceAIConfig,
	systemPrompt string,
	structuredPrompt string,
) (lifeTraceAssistantStructuredResponse, string, error) {
	decision, model, err := callLifeTraceAssistantToolResponse(ctx, cfg, systemPrompt, structuredPrompt)
	if err == nil {
		return decision, model, nil
	}
	if !shouldFallbackToStructuredJSON(err) {
		return lifeTraceAssistantStructuredResponse{}, model, err
	}

	var (
		raw       string
		jsonModel string
		jsonErr   error
	)

	if cfg.Source == "openai" {
		raw, jsonModel, jsonErr = callLifeTraceAssistantStructuredOpenAI(ctx, cfg, systemPrompt, structuredPrompt)
	} else {
		raw, jsonModel, jsonErr = callLifeTraceAssistantStructuredARK(ctx, cfg, systemPrompt, structuredPrompt)
	}
	if jsonErr != nil {
		return lifeTraceAssistantStructuredResponse{}, jsonModel, jsonErr
	}

	parsed, err := parseLifeTraceAssistantStructuredResponse(raw)
	if err != nil {
		return lifeTraceAssistantStructuredResponse{}, jsonModel, err
	}
	return parsed, jsonModel, nil
}

func shouldFallbackToStructuredJSON(err error) bool {
	return errors.Is(err, errLifeTraceAssistantToolUnsupported) || errors.Is(err, errLifeTraceAssistantToolInvalid)
}

func callLifeTraceAssistantToolResponse(
	ctx context.Context,
	cfg lifeTraceAIConfig,
	systemPrompt string,
	structuredPrompt string,
) (lifeTraceAssistantStructuredResponse, string, error) {
	if cfg.Source == "openai" {
		return callLifeTraceAssistantToolOpenAI(ctx, cfg, systemPrompt, structuredPrompt)
	}
	return callLifeTraceAssistantToolARK(ctx, cfg, systemPrompt, structuredPrompt)
}

func buildLifeTraceAssistantToolSchema() map[string]any {
	actionTypes := append([]string{"none"}, lifeTraceAssistantActionRegistry.Types()...)
	return map[string]any{
		"type": "object",
		"properties": map[string]any{
			"reply": map[string]any{
				"type":        "string",
				"description": "给用户看的简短中文回复",
			},
			"action": map[string]any{
				"type":        "object",
				"description": "要执行的生活迹动作，没有动作时 type=none",
				"properties": map[string]any{
					"type": map[string]any{
						"type": "string",
						"enum": actionTypes,
					},
					"message": map[string]any{
						"type": "string",
					},
					"needMoreInfoFields": map[string]any{
						"type": "array",
						"items": map[string]any{
							"type": "string",
							"enum": []string{"expiresAt", "scheduledDate", "scheduledTime", "amount"},
						},
					},
					"plan": map[string]any{
						"type": "object",
						"properties": map[string]any{
							"title":         map[string]any{"type": "string"},
							"type":          map[string]any{"type": "string", "enum": []string{"电影", "吃饭", "运动", "阅读", "聚会", "普通事项"}},
							"scheduledDate": map[string]any{"type": "string"},
							"scheduledTime": map[string]any{"type": "string"},
							"timezone":      map[string]any{"type": "string"},
							"notePrefix":    map[string]any{"type": "string"},
						},
					},
					"pantry": map[string]any{
						"type": "object",
						"properties": map[string]any{
							"name":      map[string]any{"type": "string"},
							"category":  map[string]any{"type": "string", "enum": []string{"食品", "日用品", "药品", "宠物", "其他"}},
							"quantity":  map[string]any{"type": "integer"},
							"unit":      map[string]any{"type": "string"},
							"location":  map[string]any{"type": "string", "enum": []string{"冷藏", "冷冻", "厨房", "储物柜", "卫生间", "玄关", "其他"}},
							"expiresAt": map[string]any{"type": "string"},
							"openedAt":  map[string]any{"type": "string"},
							"note":      map[string]any{"type": "string"},
						},
					},
					"ledger": map[string]any{
						"type": "object",
						"properties": map[string]any{
							"amount":     map[string]any{"type": "number"},
							"currency":   map[string]any{"type": "string"},
							"direction":  map[string]any{"type": "string", "enum": []string{"支出", "收入", "退款", "转账备注"}},
							"category":   map[string]any{"type": "string", "enum": []string{"吃饭", "交通", "购物", "书影音", "订阅", "家用", "礼物", "医疗", "其他"}},
							"occurredAt": map[string]any{"type": "string"},
							"merchant":   map[string]any{"type": "string"},
							"location":   map[string]any{"type": "string"},
							"note":       map[string]any{"type": "string"},
						},
					},
				},
				"required": []string{"type"},
			},
		},
		"required": []string{"reply", "action"},
	}
}

func buildLifeTraceAssistantARKTools() []*arkmodel.Tool {
	return []*arkmodel.Tool{
		{
			Type: arkmodel.ToolTypeFunction,
			Function: &arkmodel.FunctionDefinition{
				Name:        lifeTraceAssistantToolName,
				Description: "提交 Life Trace 生活助理的回复和动作结果",
				Parameters:  buildLifeTraceAssistantToolSchema(),
			},
		},
	}
}

func buildLifeTraceAssistantOpenAITools() []lifeTraceOpenAITool {
	return []lifeTraceOpenAITool{
		{
			Type: "function",
			Function: &lifeTraceOpenAIFunctionDefinition{
				Name:        lifeTraceAssistantToolName,
				Description: "提交 Life Trace 生活助理的回复和动作结果",
				Parameters:  buildLifeTraceAssistantToolSchema(),
			},
		},
	}
}

func parseLifeTraceAssistantToolArguments(raw string) (lifeTraceAssistantStructuredResponse, error) {
	return parseLifeTraceAssistantStructuredResponse(raw)
}

func parseLifeTraceAssistantARKToolCalls(toolCalls []*arkmodel.ToolCall) (lifeTraceAssistantStructuredResponse, error) {
	for _, toolCall := range toolCalls {
		if toolCall == nil {
			continue
		}
		if toolCall.Function.Name != lifeTraceAssistantToolName {
			continue
		}
		parsed, err := parseLifeTraceAssistantToolArguments(toolCall.Function.Arguments)
		if err != nil {
			return lifeTraceAssistantStructuredResponse{}, fmt.Errorf("%w: %v", errLifeTraceAssistantToolInvalid, err)
		}
		return parsed, nil
	}
	return lifeTraceAssistantStructuredResponse{}, fmt.Errorf("%w: missing matching tool call", errLifeTraceAssistantToolInvalid)
}

func parseLifeTraceAssistantOpenAIToolCalls(toolCalls []lifeTraceOpenAIToolCall) (lifeTraceAssistantStructuredResponse, error) {
	for _, toolCall := range toolCalls {
		if toolCall.Function.Name != lifeTraceAssistantToolName {
			continue
		}
		parsed, err := parseLifeTraceAssistantToolArguments(toolCall.Function.Arguments)
		if err != nil {
			return lifeTraceAssistantStructuredResponse{}, fmt.Errorf("%w: %v", errLifeTraceAssistantToolInvalid, err)
		}
		return parsed, nil
	}
	return lifeTraceAssistantStructuredResponse{}, fmt.Errorf("%w: missing matching tool call", errLifeTraceAssistantToolInvalid)
}

func isLifeTraceAssistantToolUnsupported(statusCode int, respBody []byte) bool {
	return aiclient.IsOpenAIToolUnsupported(statusCode, respBody)
}

func callLifeTraceAssistantToolARK(
	ctx context.Context,
	cfg lifeTraceAIConfig,
	systemPrompt string,
	structuredPrompt string,
) (lifeTraceAssistantStructuredResponse, string, error) {
	client := ensureLifeTraceArkClient(cfg.APIKey, cfg.BaseURL)
	maxTokens := 420
	temperature := float32(0.2)
	parallelToolCalls := false
	systemContent := strings.TrimSpace(systemPrompt)
	userContent := strings.TrimSpace(structuredPrompt)

	resp, err := client.CreateChatCompletion(ctx, arkmodel.CreateChatCompletionRequest{
		Model: cfg.Model,
		Messages: []*arkmodel.ChatCompletionMessage{
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
		MaxTokens:         &maxTokens,
		Temperature:       &temperature,
		Tools:             buildLifeTraceAssistantARKTools(),
		ToolChoice:        arkmodel.ToolChoice{Type: arkmodel.ToolTypeFunction, Function: arkmodel.ToolChoiceFunction{Name: lifeTraceAssistantToolName}},
		ParallelToolCalls: &parallelToolCalls,
	})
	if err != nil {
		if aiclient.IsARKToolUnsupportedError(err) {
			return lifeTraceAssistantStructuredResponse{}, "", fmt.Errorf("%w: %v", errLifeTraceAssistantToolUnsupported, err)
		}
		return lifeTraceAssistantStructuredResponse{}, "", err
	}
	if len(resp.Choices) == 0 {
		return lifeTraceAssistantStructuredResponse{}, resp.Model, fmt.Errorf("%w: empty AI response", errLifeTraceAssistantToolInvalid)
	}
	parsed, err := parseLifeTraceAssistantARKToolCalls(resp.Choices[0].Message.ToolCalls)
	if err != nil {
		return lifeTraceAssistantStructuredResponse{}, resp.Model, err
	}
	return parsed, resp.Model, nil
}

func callLifeTraceAssistantToolOpenAI(
	ctx context.Context,
	cfg lifeTraceAIConfig,
	systemPrompt string,
	structuredPrompt string,
) (lifeTraceAssistantStructuredResponse, string, error) {
	parallelToolCalls := false
	body, err := json.Marshal(lifeTraceOpenAIRequest{
		Model: cfg.Model,
		Messages: []lifeTraceOpenAIMessage{
			{Role: "system", Content: systemPrompt},
			{Role: "user", Content: structuredPrompt},
		},
		Temperature:       0.2,
		MaxTokens:         420,
		Tools:             buildLifeTraceAssistantOpenAITools(),
		ToolChoice:        lifeTraceOpenAIToolChoice{Type: "function", Function: lifeTraceOpenAIToolChoiceFunction{Name: lifeTraceAssistantToolName}},
		ParallelToolCalls: &parallelToolCalls,
	})
	if err != nil {
		return lifeTraceAssistantStructuredResponse{}, "", err
	}

	httpClient := &http.Client{Timeout: cfg.Timeout}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, cfg.BaseURL+"/chat/completions", bytes.NewReader(body))
	if err != nil {
		return lifeTraceAssistantStructuredResponse{}, "", err
	}
	req.Header.Set("Authorization", "Bearer "+cfg.APIKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	resp, err := httpClient.Do(req)
	if err != nil {
		return lifeTraceAssistantStructuredResponse{}, "", err
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return lifeTraceAssistantStructuredResponse{}, "", err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		if isLifeTraceAssistantToolUnsupported(resp.StatusCode, respBody) {
			return lifeTraceAssistantStructuredResponse{}, "", fmt.Errorf("%w: %s", errLifeTraceAssistantToolUnsupported, trimRunes(string(respBody), 180))
		}
		return lifeTraceAssistantStructuredResponse{}, "", fmt.Errorf("OpenAI upstream returned %d: %s", resp.StatusCode, trimRunes(string(respBody), 180))
	}

	var parsed lifeTraceOpenAIResponse
	if err := json.Unmarshal(respBody, &parsed); err != nil {
		return lifeTraceAssistantStructuredResponse{}, "", fmt.Errorf("decode OpenAI response failed: %w", err)
	}
	if len(parsed.Choices) == 0 {
		return lifeTraceAssistantStructuredResponse{}, parsed.Model, fmt.Errorf("%w: OpenAI upstream returned no choices", errLifeTraceAssistantToolInvalid)
	}
	decision, err := parseLifeTraceAssistantOpenAIToolCalls(parsed.Choices[0].Message.ToolCalls)
	if err != nil {
		return lifeTraceAssistantStructuredResponse{}, parsed.Model, err
	}
	return decision, parsed.Model, nil
}

func callLifeTraceAssistantStructuredARK(
	ctx context.Context,
	cfg lifeTraceAIConfig,
	systemPrompt string,
	structuredPrompt string,
) (string, string, error) {
	client := ensureLifeTraceArkClient(cfg.APIKey, cfg.BaseURL)
	maxTokens := 420
	temperature := float32(0.2)
	systemContent := strings.TrimSpace(systemPrompt)
	userContent := strings.TrimSpace(structuredPrompt)

	resp, err := client.CreateChatCompletion(ctx, arkmodel.CreateChatCompletionRequest{
		Model: cfg.Model,
		Messages: []*arkmodel.ChatCompletionMessage{
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
		MaxTokens:   &maxTokens,
		Temperature: &temperature,
	})
	if err != nil {
		return "", "", err
	}
	if len(resp.Choices) == 0 || resp.Choices[0].Message.Content == nil {
		return "", resp.Model, errors.New("empty AI response")
	}

	content := resp.Choices[0].Message.Content
	if content.StringValue != nil && strings.TrimSpace(*content.StringValue) != "" {
		return strings.TrimSpace(*content.StringValue), resp.Model, nil
	}

	parts := make([]string, 0, len(content.ListValue))
	for _, part := range content.ListValue {
		if part != nil && strings.TrimSpace(part.Text) != "" {
			parts = append(parts, strings.TrimSpace(part.Text))
		}
	}
	raw := strings.TrimSpace(strings.Join(parts, "\n"))
	if raw == "" {
		return "", resp.Model, errors.New("empty AI content")
	}
	return raw, resp.Model, nil
}

func callLifeTraceAssistantStructuredOpenAI(
	ctx context.Context,
	cfg lifeTraceAIConfig,
	systemPrompt string,
	structuredPrompt string,
) (string, string, error) {
	body, err := json.Marshal(lifeTraceOpenAIRequest{
		Model: cfg.Model,
		Messages: []lifeTraceOpenAIMessage{
			{Role: "system", Content: systemPrompt},
			{Role: "user", Content: structuredPrompt},
		},
		Temperature: 0.2,
		MaxTokens:   420,
		ResponseFormat: &lifeTraceResponseFormat{
			Type: "json_object",
		},
	})
	if err != nil {
		return "", "", err
	}

	httpClient := &http.Client{Timeout: cfg.Timeout}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, cfg.BaseURL+"/chat/completions", bytes.NewReader(body))
	if err != nil {
		return "", "", err
	}
	req.Header.Set("Authorization", "Bearer "+cfg.APIKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	resp, err := httpClient.Do(req)
	if err != nil {
		return "", "", err
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", "", err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", "", fmt.Errorf("OpenAI upstream returned %d: %s", resp.StatusCode, trimRunes(string(respBody), 180))
	}

	var parsed lifeTraceOpenAIResponse
	if err := json.Unmarshal(respBody, &parsed); err != nil {
		return "", "", fmt.Errorf("decode OpenAI response failed: %w", err)
	}
	if len(parsed.Choices) == 0 {
		return "", parsed.Model, errors.New("OpenAI upstream returned no choices")
	}

	content := strings.TrimSpace(parsed.Choices[0].Message.Content)
	if content == "" {
		return "", parsed.Model, errors.New("OpenAI upstream returned empty content")
	}
	return content, parsed.Model, nil
}

func streamLifeTraceAssistantARK(
	c *gin.Context,
	ctx context.Context,
	client *arkruntime.Client,
	modelID string,
	systemPrompt string,
	userPrompt string,
	beforeDone func(func(lifeTraceAssistantStreamChunk)),
) error {
	send, ok := prepareLifeTraceSSE(c)
	if !ok {
		return errors.New("streaming not supported")
	}
	send(lifeTraceAssistantStreamChunk{Source: "ark", Model: modelID})

	maxTokens := 320
	temperature := float32(0.55)
	systemContent := systemPrompt
	userContent := userPrompt
	stream, err := client.CreateChatCompletionStream(ctx, arkmodel.CreateChatCompletionRequest{
		Model: modelID,
		Messages: []*arkmodel.ChatCompletionMessage{
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
		MaxTokens:   &maxTokens,
		Temperature: &temperature,
	})
	if err != nil {
		send(lifeTraceAssistantStreamChunk{Error: "AI 服务请求失败：" + err.Error(), Done: true})
		return nil
	}
	defer stream.Close()

	for {
		resp, err := stream.Recv()
		if errors.Is(err, io.EOF) {
			if beforeDone != nil {
				beforeDone(send)
			}
			send(lifeTraceAssistantStreamChunk{Source: "ark", Model: modelID, Done: true})
			return nil
		}
		if err != nil {
			send(lifeTraceAssistantStreamChunk{Error: "AI 服务请求失败：" + err.Error(), Done: true})
			return nil
		}

		currentModel := strings.TrimSpace(resp.Model)
		if currentModel == "" {
			currentModel = modelID
		}

		done := false
		for _, choice := range resp.Choices {
			if choice == nil {
				continue
			}
			if strings.TrimSpace(choice.Delta.Content) != "" {
				send(lifeTraceAssistantStreamChunk{
					Source: "ark",
					Model:  currentModel,
					Chunk:  choice.Delta.Content,
				})
			}
			if choice.FinishReason != arkmodel.FinishReasonNull && choice.FinishReason != "" {
				done = true
			}
		}
		if done {
			if beforeDone != nil {
				beforeDone(send)
			}
			send(lifeTraceAssistantStreamChunk{Source: "ark", Model: currentModel, Done: true})
			return nil
		}
	}
}

func callLifeTraceTextAI(
	ctx context.Context,
	client *arkruntime.Client,
	modelID string,
	prompt string,
) (string, string, error) {
	return callLifeTraceTextAIWithMaxTokens(ctx, client, modelID, prompt, 260)
}

func callLifeTraceTextAIWithMaxTokens(
	ctx context.Context,
	client *arkruntime.Client,
	modelID string,
	prompt string,
	maxTokens int,
) (string, string, error) {
	start := time.Now()
	temperature := float32(0.35)
	content := strings.TrimSpace(prompt)
	resp, err := client.CreateChatCompletion(ctx, arkmodel.CreateChatCompletionRequest{
		Model: modelID,
		Messages: []*arkmodel.ChatCompletionMessage{
			{
				Role: arkmodel.ChatMessageRoleUser,
				Content: &arkmodel.ChatCompletionMessageContent{
					StringValue: &content,
				},
			},
		},
		MaxTokens:   &maxTokens,
		Temperature: &temperature,
	})
	if err != nil {
		recordLifeTraceAIUsage(ctx, "ark", modelID, prompt, "", aiusage.Since(start), err)
		return "", "", err
	}
	if len(resp.Choices) == 0 || resp.Choices[0].Message.Content == nil {
		err := errors.New("empty AI response")
		recordLifeTraceAIUsage(ctx, "ark", resp.Model, prompt, "", aiusage.Since(start), err)
		return "", resp.Model, err
	}

	raw := ""
	contentValue := resp.Choices[0].Message.Content
	if contentValue.StringValue != nil {
		raw = *contentValue.StringValue
	} else {
		parts := make([]string, 0, len(contentValue.ListValue))
		for _, part := range contentValue.ListValue {
			if part != nil && strings.TrimSpace(part.Text) != "" {
				parts = append(parts, strings.TrimSpace(part.Text))
			}
		}
		raw = strings.Join(parts, "\n")
	}

	raw = strings.TrimSpace(raw)
	if raw == "" {
		err := errors.New("empty AI content")
		recordLifeTraceAIUsage(ctx, "ark", resp.Model, prompt, "", aiusage.Since(start), err)
		return "", resp.Model, err
	}
	recordLifeTraceAIUsage(ctx, "ark", resp.Model, prompt, raw, aiusage.Since(start), nil)
	return raw, resp.Model, nil
}

func recordLifeTraceAIUsage(ctx context.Context, provider string, modelName string, prompt string, response string, latencyMs int64, err error) {
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

func callLifeTraceAI(ctx context.Context, cfg lifeTraceAIConfig, prompt string) (string, string, error) {
	return callLifeTraceAIWithMaxTokens(ctx, cfg, prompt, 260)
}

func callLifeTraceAIWithMaxTokens(ctx context.Context, cfg lifeTraceAIConfig, prompt string, maxTokens int) (string, string, error) {
	result, err := lifeai.NewClient().GenerateJSON(ctx, cfg, lifeai.TextRequest{
		Prompt:    prompt,
		MaxTokens: maxTokens,
		JSONMode:  true,
	})
	return result.Content, result.Model, err
}

type lifeTraceOpenAIRequest = aiclient.OpenAIRequest

type lifeTraceOpenAIMessage = aiclient.OpenAIMessage

type lifeTraceOpenAITool = aiclient.OpenAITool

type lifeTraceOpenAIFunctionDefinition = aiclient.OpenAIFunctionDefinition

type lifeTraceOpenAIToolChoice = aiclient.OpenAIToolChoice

type lifeTraceOpenAIToolChoiceFunction = aiclient.OpenAIToolChoiceFunction

type lifeTraceOpenAIToolCall = aiclient.OpenAIToolCall

type lifeTraceOpenAIFunctionCall = aiclient.OpenAIFunctionCall

type lifeTraceResponseFormat = aiclient.OpenAIResponseFormat

type lifeTraceOpenAIResponse = aiclient.OpenAIResponse

type lifeTraceOpenAIStreamResponse = aiclient.OpenAIStreamResponse

func streamLifeTraceAssistantOpenAI(
	c *gin.Context,
	ctx context.Context,
	cfg lifeTraceAIConfig,
	systemPrompt string,
	userPrompt string,
	beforeDone func(func(lifeTraceAssistantStreamChunk)),
) error {
	send, ok := prepareLifeTraceSSE(c)
	if !ok {
		return errors.New("streaming not supported")
	}
	send(lifeTraceAssistantStreamChunk{Source: "openai", Model: cfg.Model})

	body, err := json.Marshal(lifeTraceOpenAIRequest{
		Model: cfg.Model,
		Messages: []lifeTraceOpenAIMessage{
			{Role: "system", Content: systemPrompt},
			{Role: "user", Content: userPrompt},
		},
		Temperature: 0.55,
		MaxTokens:   320,
		Stream:      true,
	})
	if err != nil {
		send(lifeTraceAssistantStreamChunk{Error: "AI 服务请求失败：" + err.Error(), Done: true})
		return nil
	}

	httpClient := &http.Client{Timeout: cfg.Timeout}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, cfg.BaseURL+"/chat/completions", bytes.NewReader(body))
	if err != nil {
		send(lifeTraceAssistantStreamChunk{Error: "AI 服务请求失败：" + err.Error(), Done: true})
		return nil
	}
	req.Header.Set("Authorization", "Bearer "+cfg.APIKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "text/event-stream")

	resp, err := httpClient.Do(req)
	if err != nil {
		send(lifeTraceAssistantStreamChunk{Error: "AI 服务请求失败：" + err.Error(), Done: true})
		return nil
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		respBody, readErr := io.ReadAll(resp.Body)
		if readErr != nil {
			send(lifeTraceAssistantStreamChunk{Error: "AI 服务请求失败：" + readErr.Error(), Done: true})
			return nil
		}
		send(lifeTraceAssistantStreamChunk{Error: fmt.Sprintf("AI 服务请求失败：OpenAI upstream returned %d: %s", resp.StatusCode, trimRunes(string(respBody), 180)), Done: true})
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
			if beforeDone != nil {
				beforeDone(send)
			}
			send(lifeTraceAssistantStreamChunk{Source: "openai", Model: currentModel, Done: true})
			return nil
		}

		var chunk lifeTraceOpenAIStreamResponse
		if err := json.Unmarshal([]byte(data), &chunk); err != nil {
			continue
		}
		if strings.TrimSpace(chunk.Model) != "" {
			currentModel = chunk.Model
		}
		for _, choice := range chunk.Choices {
			if strings.TrimSpace(choice.Delta.Content) != "" {
				send(lifeTraceAssistantStreamChunk{
					Source: "openai",
					Model:  currentModel,
					Chunk:  choice.Delta.Content,
				})
			}
			if choice.FinishReason != "" {
				if beforeDone != nil {
					beforeDone(send)
				}
				send(lifeTraceAssistantStreamChunk{Source: "openai", Model: currentModel, Done: true})
				return nil
			}
		}
	}
	if err := scanner.Err(); err != nil {
		send(lifeTraceAssistantStreamChunk{Error: "AI 服务请求失败：" + err.Error(), Done: true})
		return nil
	}

	if beforeDone != nil {
		beforeDone(send)
	}
	send(lifeTraceAssistantStreamChunk{Source: "openai", Model: currentModel, Done: true})
	return nil
}
