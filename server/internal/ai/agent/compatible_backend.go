package agent

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"valley-server/internal/aiclient"
)

// CompatibleBackend adapts an OpenAI-compatible catalog provider to the
// provider-neutral agent loop. It deliberately uses non-streaming calls: the
// loop can still execute tool calls over multiple steps without losing their
// complete arguments to fragmented stream deltas.
type CompatibleBackend struct {
	Client *aiclient.CompatibleClient
}

func NewCompatibleBackend(client *aiclient.CompatibleClient) *CompatibleBackend {
	return &CompatibleBackend{Client: client}
}

func (b *CompatibleBackend) Chat(ctx context.Context, spec Spec, messages []Message, descriptors []ToolDescriptor) (BackendResponse, error) {
	if b == nil || b.Client == nil {
		return BackendResponse{}, errors.New("AI_AGENT_BACKEND_UNAVAILABLE")
	}
	temperature := float64(spec.Temperature)
	if temperature <= 0 {
		temperature = 0.2
	}
	payload := aiclient.CompatibleChatRequest{
		Model:       spec.Model,
		Messages:    compatibleAgentMessages(messages),
		Temperature: &temperature,
	}
	if spec.MaxTokens > 0 {
		maxTokens := spec.MaxTokens
		payload.MaxTokens = &maxTokens
	}
	if len(descriptors) > 0 {
		payload.Tools = compatibleAgentTools(descriptors)
		payload.ToolChoice = "auto"
	}
	response, err := b.Client.Chat(ctx, payload)
	if err != nil {
		return BackendResponse{}, err
	}
	choice := response.Choices[0].Message
	message, err := compatibleAgentMessage(choice)
	if err != nil {
		return BackendResponse{}, err
	}
	return BackendResponse{Message: message, Model: strings.TrimSpace(response.Model)}, nil
}

func compatibleAgentMessages(messages []Message) []aiclient.CompatibleMessage {
	result := make([]aiclient.CompatibleMessage, 0, len(messages))
	for _, message := range messages {
		role := "user"
		switch message.Role {
		case RoleSystem:
			role = "system"
		case RoleAssistant:
			role = "assistant"
		case RoleTool:
			role = "tool"
		}
		item := aiclient.CompatibleMessage{Role: role, Content: message.Content, ToolCallID: message.ToolCallID}
		if len(message.ToolCalls) > 0 {
			calls := make([]map[string]any, 0, len(message.ToolCalls))
			for _, call := range message.ToolCalls {
				calls = append(calls, map[string]any{
					"id": call.ID, "type": "function", "function": map[string]any{
						"name": call.Name, "arguments": string(call.Args),
					},
				})
			}
			item.ToolCalls = calls
		}
		result = append(result, item)
	}
	return result
}

func compatibleAgentTools(descriptors []ToolDescriptor) []aiclient.CompatibleTool {
	result := make([]aiclient.CompatibleTool, 0, len(descriptors))
	for _, descriptor := range descriptors {
		result = append(result, aiclient.CompatibleTool{Type: "function", Function: map[string]any{
			"name": descriptor.Name, "description": descriptor.Description, "parameters": descriptor.Schema,
		}})
	}
	return result
}

func compatibleAgentMessage(message aiclient.CompatibleMessage) (Message, error) {
	result := Message{Role: RoleAssistant, Content: compatibleContentText(message.Content)}
	if message.ToolCalls == nil {
		return result, nil
	}
	encoded, err := json.Marshal(message.ToolCalls)
	if err != nil {
		return Message{}, fmt.Errorf("encode compatible tool calls: %w", err)
	}
	var calls []struct {
		ID       string `json:"id"`
		Function struct {
			Name      string `json:"name"`
			Arguments string `json:"arguments"`
		} `json:"function"`
	}
	if err := json.Unmarshal(encoded, &calls); err != nil {
		return Message{}, fmt.Errorf("decode compatible tool calls: %w", err)
	}
	for _, call := range calls {
		if strings.TrimSpace(call.ID) == "" || strings.TrimSpace(call.Function.Name) == "" || !json.Valid([]byte(call.Function.Arguments)) {
			return Message{}, errors.New("AI 返回了无效的工具调用")
		}
		result.ToolCalls = append(result.ToolCalls, ToolCall{ID: call.ID, Name: call.Function.Name, Args: json.RawMessage(call.Function.Arguments)})
	}
	return result, nil
}

func compatibleContentText(content any) string {
	if value, ok := content.(string); ok {
		return strings.TrimSpace(value)
	}
	encoded, err := json.Marshal(content)
	if err != nil {
		return ""
	}
	var parts []struct {
		Type string `json:"type"`
		Text string `json:"text"`
	}
	if json.Unmarshal(encoded, &parts) != nil {
		return ""
	}
	var builder strings.Builder
	for _, part := range parts {
		if part.Type == "text" {
			builder.WriteString(part.Text)
		}
	}
	return strings.TrimSpace(builder.String())
}
