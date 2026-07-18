package workflow

import (
	"context"
	"encoding/json"
	"fmt"
	"sort"
	"strings"
	"time"

	"valley-server/internal/aiclient"

	arkmodel "github.com/volcengine/volcengine-go-sdk/service/arkruntime/model"
)

// TextGenerator is injectable so workflow tests never need an ARK network
// call. Production uses ARKTextGenerator exclusively.
type TextGenerator interface {
	Generate(context.Context, TextGenerationRequest) (TextGenerationResult, error)
}

type TextGenerationRequest struct {
	SystemPrompt    string
	Prompt          string
	Temperature     float64
	MaxOutputTokens int
}

type TextGenerationResult struct {
	Text       string
	Model      string
	TokenUsage int
}

type LLMTextExecutor struct {
	Generator TextGenerator
}

func (LLMTextExecutor) Type() NodeType { return NodeTypeLLM }

func (executor LLMTextExecutor) Execute(ctx context.Context, _ RunContext, execution NodeExecution) (NodeResult, error) {
	if stringFromValue(execution.Input["modelProfile"]) != "ark-text-default" {
		return NodeResult{}, fmt.Errorf("modelProfile 必须为 ark-text-default")
	}
	inputs, _ := execution.Input["inputs"].(map[string]any)
	request := TextGenerationRequest{
		SystemPrompt:    stringFromValue(execution.Input["systemPrompt"]),
		Prompt:          promptWithInputs(stringFromValue(execution.Input["prompt"]), inputs),
		Temperature:     numberFromValue(execution.Input["temperature"]),
		MaxOutputTokens: int(numberFromValue(execution.Input["maxOutputTokens"])),
	}
	if request.Prompt == "" {
		return NodeResult{}, fmt.Errorf("大模型节点用户提示词不能为空")
	}
	generator := executor.Generator
	if generator == nil {
		generator = ARKTextGenerator{}
	}
	result, err := generator.Generate(ctx, request)
	if err != nil {
		return NodeResult{}, err
	}
	if strings.TrimSpace(result.Text) == "" {
		return NodeResult{}, fmt.Errorf("AI 返回为空")
	}
	return NodeResult{Output: map[string]any{"text": strings.TrimSpace(result.Text), "model": result.Model, "tokenUsage": result.TokenUsage}}, nil
}

func promptWithInputs(prompt string, inputs map[string]any) string {
	if len(inputs) == 0 {
		return prompt
	}
	names := make([]string, 0, len(inputs))
	for name := range inputs {
		names = append(names, name)
	}
	sort.Strings(names)
	var builder strings.Builder
	builder.WriteString(prompt)
	builder.WriteString("\n\n输入变量：")
	for _, name := range names {
		builder.WriteString("\n- ")
		builder.WriteString(name)
		builder.WriteString(": ")
		if text, ok := inputs[name].(string); ok {
			builder.WriteString(text)
			continue
		}
		encoded, err := json.Marshal(inputs[name])
		if err != nil {
			builder.WriteString(fmt.Sprint(inputs[name]))
			continue
		}
		builder.Write(encoded)
	}
	return builder.String()
}

// ARKTextGenerator is intentionally restricted to ReadARKTextConfig: graph
// authors may tune generation parameters but cannot choose an endpoint.
type ARKTextGenerator struct{}

func (ARKTextGenerator) Generate(ctx context.Context, input TextGenerationRequest) (TextGenerationResult, error) {
	cfg, configErr := aiclient.ReadARKTextConfig()
	if configErr != "" {
		return TextGenerationResult{}, fmt.Errorf("%s", configErr)
	}
	client := aiclient.ARKClient(45 * time.Second)
	if client == nil {
		return TextGenerationResult{}, fmt.Errorf("AI 未配置：ARK client 不可用")
	}
	prompt := input.Prompt
	messages := []*arkmodel.ChatCompletionMessage{}
	if system := strings.TrimSpace(input.SystemPrompt); system != "" {
		messages = append(messages, &arkmodel.ChatCompletionMessage{Role: arkmodel.ChatMessageRoleSystem, Content: &arkmodel.ChatCompletionMessageContent{StringValue: &system}})
	}
	messages = append(messages, &arkmodel.ChatCompletionMessage{Role: arkmodel.ChatMessageRoleUser, Content: &arkmodel.ChatCompletionMessageContent{StringValue: &prompt}})
	request := aiclient.NewARKChatRequest(cfg.Model, messages, aiclient.WithARKChatTemperature(float32(input.Temperature)), aiclient.WithARKChatTokens(input.MaxOutputTokens))
	response, err := client.CreateChatCompletion(ctx, request)
	if err != nil {
		return TextGenerationResult{}, fmt.Errorf("AI 上游调用失败: %w", err)
	}
	text, err := aiclient.ExtractARKContent(response)
	if err != nil {
		return TextGenerationResult{}, fmt.Errorf("AI 响应解析失败: %w", err)
	}
	return TextGenerationResult{Text: text, Model: response.Model}, nil
}

func numberFromValue(value any) float64 {
	switch typed := value.(type) {
	case float64:
		return typed
	case float32:
		return float64(typed)
	case int:
		return float64(typed)
	case int64:
		return float64(typed)
	default:
		return 0
	}
}
