package handler

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"strings"

	"valley-server/internal/ai/agent"
	"valley-server/internal/aiclient"

	"github.com/volcengine/volcengine-go-sdk/service/arkruntime"
	arkmodel "github.com/volcengine/volcengine-go-sdk/service/arkruntime/model"
)

type aiAppAgentBackend struct {
	client *arkruntime.Client
}

func (b *aiAppAgentBackend) Chat(ctx context.Context, spec agent.Spec, messages []agent.Message, descriptors []agent.ToolDescriptor) (agent.BackendResponse, error) {
	if b == nil || b.client == nil {
		return agent.BackendResponse{}, errors.New("AI_AGENT_BACKEND_UNAVAILABLE")
	}
	response, err := b.client.CreateChatCompletion(ctx, b.request(spec, messages, descriptors))
	if err != nil {
		return agent.BackendResponse{}, err
	}
	if len(response.Choices) == 0 {
		return agent.BackendResponse{}, errors.New("AI_AGENT_EMPTY_RESPONSE")
	}
	choice := response.Choices[0].Message
	return agent.BackendResponse{Message: aiAppAgentMessage(&choice), Model: response.Model}, nil
}

func (b *aiAppAgentBackend) ChatStream(ctx context.Context, spec agent.Spec, messages []agent.Message, descriptors []agent.ToolDescriptor, emit func(string)) (agent.BackendResponse, error) {
	if b == nil || b.client == nil {
		return agent.BackendResponse{}, errors.New("AI_AGENT_BACKEND_UNAVAILABLE")
	}
	stream, err := b.client.CreateChatCompletionStream(ctx, b.request(spec, messages, descriptors))
	if err != nil {
		return agent.BackendResponse{}, err
	}
	defer stream.Close()

	var content strings.Builder
	modelName := ""
	toolCalls := make(map[int]*arkmodel.ToolCall)
	toolCallOrder := make([]int, 0)
	for {
		response, recvErr := stream.Recv()
		if errors.Is(recvErr, io.EOF) {
			break
		}
		if recvErr != nil {
			return agent.BackendResponse{}, recvErr
		}
		if strings.TrimSpace(response.Model) != "" {
			modelName = response.Model
		}
		for _, choice := range response.Choices {
			if choice == nil {
				continue
			}
			if delta := choice.Delta.Content; delta != "" {
				content.WriteString(delta)
				if emit != nil {
					emit(delta)
				}
			}
			for position, deltaCall := range choice.Delta.ToolCalls {
				if deltaCall == nil {
					continue
				}
				index := position
				if deltaCall.Index != nil {
					index = *deltaCall.Index
				}
				call, found := toolCalls[index]
				if !found {
					call = &arkmodel.ToolCall{}
					toolCalls[index] = call
					toolCallOrder = append(toolCallOrder, index)
				}
				if deltaCall.ID != "" {
					call.ID = deltaCall.ID
				}
				if deltaCall.Type != "" {
					call.Type = deltaCall.Type
				}
				if deltaCall.Function.Name != "" {
					call.Function.Name = deltaCall.Function.Name
				}
				call.Function.Arguments += deltaCall.Function.Arguments
			}
		}
	}

	message := agent.Message{Role: agent.RoleAssistant, Content: content.String()}
	for _, index := range toolCallOrder {
		call := toolCalls[index]
		if call == nil {
			continue
		}
		message.ToolCalls = append(message.ToolCalls, agent.ToolCall{ID: call.ID, Name: call.Function.Name, Args: json.RawMessage(call.Function.Arguments)})
	}
	return agent.BackendResponse{Message: message, Model: modelName}, nil
}

func (b *aiAppAgentBackend) request(spec agent.Spec, messages []agent.Message, descriptors []agent.ToolDescriptor) arkmodel.CreateChatCompletionRequest {
	arkMessages := make([]*arkmodel.ChatCompletionMessage, 0, len(messages))
	for _, message := range messages {
		arkMessages = append(arkMessages, toAIAppARKMessage(message))
	}
	arkTools := make([]*arkmodel.Tool, 0, len(descriptors))
	for _, descriptor := range descriptors {
		arkTools = append(arkTools, &arkmodel.Tool{
			Type: arkmodel.ToolTypeFunction,
			Function: &arkmodel.FunctionDefinition{
				Name:        descriptor.Name,
				Description: descriptor.Description,
				Parameters:  descriptor.Schema,
			},
		})
	}
	var request arkmodel.CreateChatCompletionRequest
	if len(arkTools) == 0 {
		return aiclient.NewARKChatRequest(spec.Model, arkMessages)
	} else {
		request = aiclient.NewARKChatRequestWithTools(spec.Model, arkMessages, arkTools, arkmodel.ToolChoice{Type: arkmodel.ToolTypeFunction})
		request.ToolChoice = arkmodel.ToolChoiceStringTypeAuto
	}
	return request
}

func aiAppAgentMessage(choice *arkmodel.ChatCompletionMessage) agent.Message {
	message := agent.Message{Role: agent.RoleAssistant, Content: aiAppARKContent(choice.Content)}
	for _, call := range choice.ToolCalls {
		if call == nil {
			continue
		}
		message.ToolCalls = append(message.ToolCalls, agent.ToolCall{
			ID: call.ID, Name: call.Function.Name, Args: json.RawMessage(call.Function.Arguments),
		})
	}
	return message
}

func toAIAppARKMessage(message agent.Message) *arkmodel.ChatCompletionMessage {
	role := arkmodel.ChatMessageRoleUser
	switch message.Role {
	case agent.RoleSystem:
		role = arkmodel.ChatMessageRoleSystem
	case agent.RoleAssistant:
		role = arkmodel.ChatMessageRoleAssistant
	case agent.RoleTool:
		role = arkmodel.ChatMessageRoleTool
	}
	content := message.Content
	arkMessage := &arkmodel.ChatCompletionMessage{
		Role: role, Content: &arkmodel.ChatCompletionMessageContent{StringValue: &content}, ToolCallID: message.ToolCallID,
	}
	for _, call := range message.ToolCalls {
		arkMessage.ToolCalls = append(arkMessage.ToolCalls, &arkmodel.ToolCall{
			ID: call.ID, Type: arkmodel.ToolTypeFunction,
			Function: arkmodel.FunctionCall{Name: call.Name, Arguments: string(call.Args)},
		})
	}
	return arkMessage
}

func aiAppARKContent(content *arkmodel.ChatCompletionMessageContent) string {
	if content == nil || content.StringValue == nil {
		return ""
	}
	return *content.StringValue
}
