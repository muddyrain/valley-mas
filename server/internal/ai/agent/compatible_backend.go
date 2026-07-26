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
// provider-neutral agent loop. Streaming calls emit text immediately while
// accumulating fragmented tool calls for the next loop step.
type CompatibleBackend struct {
	Client *aiclient.CompatibleClient
}

func NewCompatibleBackend(client *aiclient.CompatibleClient) *CompatibleBackend {
	return &CompatibleBackend{Client: client}
}

func compatibleAgentChatRequest(spec Spec, messages []Message, descriptors []ToolDescriptor) aiclient.CompatibleChatRequest {
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
	return payload
}

func (b *CompatibleBackend) Chat(ctx context.Context, spec Spec, messages []Message, descriptors []ToolDescriptor) (BackendResponse, error) {
	if b == nil || b.Client == nil {
		return BackendResponse{}, errors.New("AI_AGENT_BACKEND_UNAVAILABLE")
	}
	payload := compatibleAgentChatRequest(spec, messages, descriptors)
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

type compatibleStreamToolCallDelta struct {
	Index    int    `json:"index"`
	ID       string `json:"id"`
	Function struct {
		Name      string `json:"name"`
		Arguments string `json:"arguments"`
	} `json:"function"`
}

type compatibleStreamToolCall struct {
	ID        string
	Name      string
	Arguments strings.Builder
}

func (b *CompatibleBackend) ChatStream(
	ctx context.Context,
	spec Spec,
	messages []Message,
	descriptors []ToolDescriptor,
	emit func(string),
) (BackendResponse, error) {
	if b == nil || b.Client == nil {
		return BackendResponse{}, errors.New("AI_AGENT_BACKEND_UNAVAILABLE")
	}
	var content strings.Builder
	var modelName string
	sawChoice := false
	callOrder := make([]int, 0)
	calls := make(map[int]*compatibleStreamToolCall)
	err := b.Client.ChatStream(ctx, compatibleAgentChatRequest(spec, messages, descriptors), func(chunk aiclient.CompatibleChatStreamChunk) error {
		if trimmed := strings.TrimSpace(chunk.Model); trimmed != "" {
			modelName = trimmed
		}
		if len(chunk.Choices) == 0 {
			return nil
		}
		sawChoice = true
		delta := chunk.Choices[0].Delta
		if text := compatibleContentDelta(delta.Content); text != "" {
			content.WriteString(text)
			if emit != nil {
				emit(text)
			}
		}
		fragments, err := compatibleToolCallDeltas(delta.ToolCalls)
		if err != nil {
			return err
		}
		for _, fragment := range fragments {
			call := calls[fragment.Index]
			if call == nil {
				call = &compatibleStreamToolCall{}
				calls[fragment.Index] = call
				callOrder = append(callOrder, fragment.Index)
			}
			call.ID = mergeCompatibleStreamIdentifier(call.ID, fragment.ID)
			call.Name = mergeCompatibleStreamIdentifier(call.Name, fragment.Function.Name)
			call.Arguments.WriteString(fragment.Function.Arguments)
		}
		return nil
	})
	if err != nil {
		return BackendResponse{}, err
	}
	if !sawChoice {
		return BackendResponse{}, errors.New("AI 上游流响应为空")
	}

	var toolCalls any
	if len(callOrder) > 0 {
		assembled := make([]map[string]any, 0, len(callOrder))
		for _, index := range callOrder {
			call := calls[index]
			assembled = append(assembled, map[string]any{
				"id":   call.ID,
				"type": "function",
				"function": map[string]any{
					"name": call.Name, "arguments": call.Arguments.String(),
				},
			})
		}
		toolCalls = assembled
	}
	message, err := compatibleAgentMessage(aiclient.CompatibleMessage{
		Role:      "assistant",
		Content:   content.String(),
		ToolCalls: toolCalls,
	})
	if err != nil {
		return BackendResponse{}, err
	}
	if modelName == "" {
		modelName = spec.Model
	}
	return BackendResponse{Message: message, Model: modelName}, nil
}

func compatibleToolCallDeltas(value any) ([]compatibleStreamToolCallDelta, error) {
	if value == nil {
		return nil, nil
	}
	encoded, err := json.Marshal(value)
	if err != nil {
		return nil, fmt.Errorf("encode compatible tool call deltas: %w", err)
	}
	var fragments []compatibleStreamToolCallDelta
	if err := json.Unmarshal(encoded, &fragments); err != nil {
		return nil, fmt.Errorf("decode compatible tool call deltas: %w", err)
	}
	return fragments, nil
}

func mergeCompatibleStreamIdentifier(current, fragment string) string {
	if fragment == "" || fragment == current || strings.HasSuffix(current, fragment) {
		return current
	}
	if current == "" || strings.HasPrefix(fragment, current) {
		return fragment
	}
	return current + fragment
}

func compatibleContentDelta(content any) string {
	if value, ok := content.(string); ok {
		return value
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
	return builder.String()
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
