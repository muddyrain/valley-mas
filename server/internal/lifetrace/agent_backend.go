package lifetrace

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

	"valley-server/internal/ai/agent"
	"valley-server/internal/aiclient"
	lifeai "valley-server/internal/lifetrace/ai"

	arkmodel "github.com/volcengine/volcengine-go-sdk/service/arkruntime/model"
)

// lifeTraceAgentBackend 是 agent.Backend 的双轨实现。
// 走原有 aiclient 的 ARK / OpenAI 路径,不做 JSON mode 降级——tool loop 场景
// 一旦上游不支持 tools 就直接返回错误,交由 handler 决定是否回退到旧路径。
type lifeTraceAgentBackend struct {
	cfg lifeTraceAIConfig
}

func newLifeTraceAgentBackend(cfg lifeTraceAIConfig) *lifeTraceAgentBackend {
	return &lifeTraceAgentBackend{cfg: cfg}
}

// Chat 实现 agent.Backend。
func (b *lifeTraceAgentBackend) Chat(
	ctx context.Context,
	spec agent.Spec,
	msgs []agent.Message,
	tools []agent.ToolDescriptor,
) (agent.BackendResponse, error) {
	if b.cfg.Source == "openai" {
		return b.chatOpenAI(ctx, spec, msgs, tools)
	}
	return b.chatARK(ctx, spec, msgs, tools)
}

func (b *lifeTraceAgentBackend) chatARK(
	ctx context.Context,
	spec agent.Spec,
	msgs []agent.Message,
	tools []agent.ToolDescriptor,
) (agent.BackendResponse, error) {
	client := lifeai.EnsureARKClient(b.cfg.APIKey, b.cfg.BaseURL)
	arkMsgs := make([]*arkmodel.ChatCompletionMessage, 0, len(msgs))
	for i := range msgs {
		arkMsgs = append(arkMsgs, toARKMessage(msgs[i]))
	}

	arkTools := make([]*arkmodel.Tool, 0, len(tools))
	for _, t := range tools {
		arkTools = append(arkTools, &arkmodel.Tool{
			Type: arkmodel.ToolTypeFunction,
			Function: &arkmodel.FunctionDefinition{
				Name:        t.Name,
				Description: t.Description,
				Parameters:  t.Schema,
			},
		})
	}

	opts := []aiclient.ARKChatOption{}
	if spec.MaxTokens > 0 {
		opts = append(opts, aiclient.WithARKChatTokens(spec.MaxTokens))
	}
	if spec.Temperature > 0 {
		opts = append(opts, aiclient.WithARKChatTemperature(spec.Temperature))
	}

	var req arkmodel.CreateChatCompletionRequest
	if len(arkTools) > 0 {
		req = aiclient.NewARKChatRequestWithTools(
			b.cfg.Model,
			arkMsgs,
			arkTools,
			arkmodel.ToolChoice{Type: arkmodel.ToolTypeFunction},
			opts...,
		)
		// 允许模型在无需调 tool 时直接回复;把 tool_choice 改成 auto。
		req.ToolChoice = arkmodel.ToolChoiceStringTypeAuto
	} else {
		req = aiclient.NewARKChatRequest(b.cfg.Model, arkMsgs, opts...)
	}

	resp, err := client.CreateChatCompletion(ctx, req)
	if err != nil {
		if aiclient.IsARKToolUnsupportedError(err) {
			return agent.BackendResponse{}, fmt.Errorf("%w: %v", errAgentToolsUnsupported, err)
		}
		return agent.BackendResponse{}, err
	}
	if len(resp.Choices) == 0 {
		return agent.BackendResponse{}, errors.New("agent backend: ark returned no choices")
	}
	choice := resp.Choices[0].Message
	msg := agent.Message{
		Role:    agent.RoleAssistant,
		Content: extractARKContent(choice.Content),
	}
	for _, tc := range choice.ToolCalls {
		if tc == nil {
			continue
		}
		msg.ToolCalls = append(msg.ToolCalls, agent.ToolCall{
			ID:   tc.ID,
			Name: tc.Function.Name,
			Args: json.RawMessage(tc.Function.Arguments),
		})
	}
	return agent.BackendResponse{Message: msg, Model: resp.Model}, nil
}

func toARKMessage(m agent.Message) *arkmodel.ChatCompletionMessage {
	role := arkmodel.ChatMessageRoleUser
	switch m.Role {
	case agent.RoleSystem:
		role = arkmodel.ChatMessageRoleSystem
	case agent.RoleAssistant:
		role = arkmodel.ChatMessageRoleAssistant
	case agent.RoleTool:
		role = arkmodel.ChatMessageRoleTool
	}
	content := m.Content
	arkMsg := &arkmodel.ChatCompletionMessage{
		Role: role,
		Content: &arkmodel.ChatCompletionMessageContent{
			StringValue: &content,
		},
		ToolCallID: m.ToolCallID,
	}
	if len(m.ToolCalls) > 0 {
		for _, tc := range m.ToolCalls {
			arkMsg.ToolCalls = append(arkMsg.ToolCalls, &arkmodel.ToolCall{
				ID:   tc.ID,
				Type: arkmodel.ToolTypeFunction,
				Function: arkmodel.FunctionCall{
					Name:      tc.Name,
					Arguments: string(tc.Args),
				},
			})
		}
	}
	return arkMsg
}

func extractARKContent(content *arkmodel.ChatCompletionMessageContent) string {
	if content == nil || content.StringValue == nil {
		return ""
	}
	return *content.StringValue
}

func (b *lifeTraceAgentBackend) chatOpenAI(
	ctx context.Context,
	spec agent.Spec,
	msgs []agent.Message,
	tools []agent.ToolDescriptor,
) (agent.BackendResponse, error) {
	openaiMsgs := make([]aiclient.OpenAIMessage, 0, len(msgs))
	for _, m := range msgs {
		openaiMsgs = append(openaiMsgs, toOpenAIMessage(m))
	}

	openaiTools := make([]aiclient.OpenAITool, 0, len(tools))
	for _, t := range tools {
		openaiTools = append(openaiTools, aiclient.OpenAITool{
			Type: "function",
			Function: &aiclient.OpenAIFunctionDefinition{
				Name:        t.Name,
				Description: t.Description,
				Parameters:  t.Schema,
			},
		})
	}

	parallelToolCalls := false
	payload := aiclient.OpenAIRequest{
		Model:             b.cfg.Model,
		Messages:          openaiMsgs,
		Temperature:       float64(spec.Temperature),
		MaxTokens:         spec.MaxTokens,
		Tools:             openaiTools,
		ParallelToolCalls: &parallelToolCalls,
	}
	if len(openaiTools) > 0 {
		payload.ToolChoice = "auto"
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return agent.BackendResponse{}, err
	}

	timeout := b.cfg.Timeout
	if timeout <= 0 {
		timeout = 30 * time.Second
	}
	httpClient := &http.Client{Timeout: timeout}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, b.cfg.BaseURL+"/chat/completions", bytes.NewReader(body))
	if err != nil {
		return agent.BackendResponse{}, err
	}
	req.Header.Set("Authorization", "Bearer "+b.cfg.APIKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	resp, err := httpClient.Do(req)
	if err != nil {
		return agent.BackendResponse{}, err
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return agent.BackendResponse{}, err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		if aiclient.IsOpenAIToolUnsupported(resp.StatusCode, respBody) {
			return agent.BackendResponse{}, fmt.Errorf("%w: %s", errAgentToolsUnsupported, aiclient.TrimRunes(string(respBody), 180))
		}
		return agent.BackendResponse{}, fmt.Errorf("openai upstream returned %d: %s", resp.StatusCode, aiclient.TrimRunes(string(respBody), 180))
	}

	var parsed aiclient.OpenAIResponse
	if err := json.Unmarshal(respBody, &parsed); err != nil {
		return agent.BackendResponse{}, fmt.Errorf("decode openai response: %w", err)
	}
	if len(parsed.Choices) == 0 {
		return agent.BackendResponse{}, errors.New("agent backend: openai returned no choices")
	}
	choice := parsed.Choices[0].Message
	msg := agent.Message{Role: agent.RoleAssistant, Content: choice.Content}
	for _, tc := range choice.ToolCalls {
		msg.ToolCalls = append(msg.ToolCalls, agent.ToolCall{
			ID:   tc.ID,
			Name: tc.Function.Name,
			Args: json.RawMessage(tc.Function.Arguments),
		})
	}
	return agent.BackendResponse{Message: msg, Model: parsed.Model}, nil
}

func toOpenAIMessage(m agent.Message) aiclient.OpenAIMessage {
	role := "user"
	switch m.Role {
	case agent.RoleSystem:
		role = "system"
	case agent.RoleAssistant:
		role = "assistant"
	case agent.RoleTool:
		role = "tool"
	}
	msg := aiclient.OpenAIMessage{
		Role:       role,
		Content:    m.Content,
		Name:       strings.TrimSpace(m.ToolName),
		ToolCallID: m.ToolCallID,
	}
	for _, tc := range m.ToolCalls {
		msg.ToolCalls = append(msg.ToolCalls, aiclient.OpenAIToolCall{
			ID:   tc.ID,
			Type: "function",
			Function: aiclient.OpenAIFunctionCall{
				Name:      tc.Name,
				Arguments: string(tc.Args),
			},
		})
	}
	return msg
}

// errAgentToolsUnsupported 上游不支持 tools 时返回,handler 层决定是否回退旧路径。
var errAgentToolsUnsupported = errors.New("agent backend: upstream tools not supported")
