package workflow

import (
	"context"
	"encoding/json"
	"fmt"
	"sort"
	"strings"
	"time"

	"valley-server/internal/aiclient"
	"valley-server/internal/aimodel"
	"valley-server/internal/database"
)

// TextGenerator is injectable so workflow tests never need an ARK network
// call. Production uses PolicyTextGenerator exclusively.
type TextGenerator interface {
	Generate(context.Context, TextGenerationRequest) (TextGenerationResult, error)
}

type TextGenerationRequest struct {
	ModelID         string
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
	inputs, _ := execution.Input["inputs"].(map[string]any)
	schema, structured, err := llmStructuredOutputSchema(execution.Input)
	if err != nil {
		return NodeResult{}, err
	}
	prompt := promptWithInputs(stringFromValue(execution.Input["prompt"]), inputs)
	if structured {
		prompt = structuredOutputPrompt(prompt, schema)
	}
	request := TextGenerationRequest{
		ModelID:         stringFromValue(execution.Input["modelId"]),
		SystemPrompt:    stringFromValue(execution.Input["systemPrompt"]),
		Prompt:          prompt,
		Temperature:     numberFromValue(execution.Input["temperature"]),
		MaxOutputTokens: int(numberFromValue(execution.Input["maxOutputTokens"])),
	}
	if request.Prompt == "" {
		return NodeResult{}, fmt.Errorf("大模型节点用户提示词不能为空")
	}
	generator := executor.Generator
	if generator == nil {
		if request.ModelID == "" {
			return NodeResult{}, fmt.Errorf("请选择一个文本模型")
		}
		generator = CatalogTextGenerator{}
	}
	result, err := generator.Generate(ctx, request)
	if err != nil {
		return NodeResult{}, err
	}
	if strings.TrimSpace(result.Text) == "" {
		return NodeResult{}, fmt.Errorf("AI 返回为空")
	}
	if structured {
		output, parseErr := parseStructuredLLMOutput(result.Text, schema)
		if parseErr != nil {
			return NodeResult{}, parseErr
		}
		output["model"] = result.Model
		output["tokenUsage"] = result.TokenUsage
		return NodeResult{Output: output}, nil
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

// CatalogTextGenerator resolves a graph-selected, administrator-approved text
// model. The model ID remains stable in the workflow graph and is revalidated
// at runtime for enablement and capability.
type CatalogTextGenerator struct{}

// workflowModelRequestTimeout applies to one model request only. Loop-level
// budgets are calculated separately from the number of requests the loop will
// make, so a slow single request does not silently turn into a five-minute
// request just because it is inside a loop.
const workflowModelRequestTimeout = 120 * time.Second

func (CatalogTextGenerator) Generate(ctx context.Context, input TextGenerationRequest) (TextGenerationResult, error) {
	selected, err := aimodel.FindEnabledModel(database.GetDB(), input.ModelID, "text")
	if err != nil {
		return TextGenerationResult{}, err
	}
	provider, err := aimodel.ProviderFromEnv(selected.Provider)
	if err != nil {
		return TextGenerationResult{}, err
	}
	messages := make([]aiclient.CompatibleMessage, 0, 2)
	if system := strings.TrimSpace(input.SystemPrompt); system != "" {
		messages = append(messages, aiclient.CompatibleMessage{Role: "system", Content: system})
	}
	messages = append(messages, aiclient.CompatibleMessage{Role: "user", Content: input.Prompt})
	temperature := input.Temperature
	maxTokens := input.MaxOutputTokens
	response, err := aiclient.NewCompatibleClient(provider.BaseURL, provider.APIKey, workflowModelRequestTimeout).Chat(ctx, aiclient.CompatibleChatRequest{
		Model: selected.ModelID, Messages: messages, Temperature: &temperature, MaxTokens: &maxTokens,
	})
	if err != nil {
		return TextGenerationResult{}, fmt.Errorf("AI 上游调用失败: %w", err)
	}
	text, ok := response.Choices[0].Message.Content.(string)
	if !ok || strings.TrimSpace(text) == "" {
		return TextGenerationResult{}, fmt.Errorf("AI 响应解析失败: 未返回文本内容")
	}
	modelID := response.Model
	if modelID == "" {
		modelID = selected.ModelID
	}
	return TextGenerationResult{Text: text, Model: modelID, TokenUsage: response.Usage.TotalTokens}, nil
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
