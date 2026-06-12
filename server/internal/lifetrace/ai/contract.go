package ai

import (
	"context"
	"encoding/json"
	"strings"
)

type PromptContract[I any, O any] struct {
	Name        string
	Version     string
	AuditScene  string
	MaxTokens   int
	BuildPrompt func(I) string
	Normalize   func(O) (O, error)
}

func (c PromptContract[I, O]) Build(input I) string {
	if c.BuildPrompt == nil {
		return ""
	}
	return strings.TrimSpace(c.BuildPrompt(input))
}

func (c PromptContract[I, O]) Parse(raw string) (O, error) {
	var output O
	if err := json.Unmarshal([]byte(extractJSONObject(raw)), &output); err != nil {
		return output, err
	}
	if c.Normalize == nil {
		return output, nil
	}
	return c.Normalize(output)
}

func (c PromptContract[I, O]) Generate(ctx context.Context, client Client, cfg TextConfig, input I) (O, Result, error) {
	prompt := c.Build(input)
	result, err := client.GenerateJSON(ctx, cfg, TextRequest{
		Prompt:    prompt,
		MaxTokens: c.MaxTokens,
		JSONMode:  true,
	})
	var empty O
	if err != nil {
		return empty, result, err
	}
	parsed, err := c.Parse(result.Content)
	if err != nil {
		return empty, result, err
	}
	return parsed, result, nil
}

func extractJSONObject(raw string) string {
	text := strings.TrimSpace(raw)
	if strings.HasPrefix(text, "```") {
		text = strings.TrimPrefix(text, "```json")
		text = strings.TrimPrefix(text, "```")
		text = strings.TrimSuffix(text, "```")
		text = strings.TrimSpace(text)
	}
	start := strings.Index(text, "{")
	end := strings.LastIndex(text, "}")
	if start >= 0 && end >= start {
		return text[start : end+1]
	}
	return text
}
