// Package clarification defines the transport-neutral protocol used when an
// agent lacks required information for a tool call.
package clarification

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"valley-server/internal/ai/tools"
)

const ToolName = "clarification.ask"

type Complexity string

const (
	ComplexitySimple  Complexity = "simple"
	ComplexityNormal  Complexity = "normal"
	ComplexityComplex Complexity = "complex"
)

type AnswerType string

const (
	AnswerSingleSelect AnswerType = "single_select"
	AnswerMultiSelect  AnswerType = "multi_select"
	AnswerText         AnswerType = "text"
	AnswerFile         AnswerType = "file"
)

type Suggestion struct {
	Label       string `json:"label"`
	Value       string `json:"value"`
	Description string `json:"description,omitempty"`
}

type Input struct {
	ID                string
	Question          string
	Reason            string
	AnswerType        AnswerType
	Suggestions       []Suggestion
	AllowCustomAnswer bool
	Blocking          bool
	Complexity        Complexity
	Round             int
}

type Request struct {
	ID                string       `json:"id"`
	Question          string       `json:"question"`
	Reason            string       `json:"reason"`
	AnswerType        AnswerType   `json:"answerType"`
	Suggestions       []Suggestion `json:"suggestions,omitempty"`
	AllowCustomAnswer bool         `json:"allowCustomAnswer"`
	Blocking          bool         `json:"blocking"`
	Round             int          `json:"round"`
	MaxRounds         int          `json:"maxRounds"`
}

type roundContextKey struct{}

func WithRound(ctx context.Context, round int) context.Context {
	if round < 1 {
		round = 1
	}
	return context.WithValue(ctx, roundContextKey{}, round)
}

func roundFromContext(ctx context.Context) int {
	if round, ok := ctx.Value(roundContextKey{}).(int); ok && round > 0 {
		return round
	}
	return 1
}

type RequiredError struct {
	Request Request
}

func (err *RequiredError) Error() string {
	return "clarification: user input required"
}

func Require(request Request) error {
	return &RequiredError{Request: request}
}

type AskTool struct{}

func NewAskTool() *AskTool { return &AskTool{} }

func (*AskTool) Name() string  { return ToolName }
func (*AskTool) Scope() string { return "workbench" }
func (*AskTool) Description() string {
	return "当回答或执行用户请求前需要补充信息、确认偏好或解决会改变结果的歧义时，暂停任务并向用户显示一个结构化问题；普通对话中的必要追问也应使用此工具。"
}

func (*AskTool) Schema() map[string]any {
	return map[string]any{
		"type":     "object",
		"required": []string{"question", "reason", "answerType", "blocking", "complexity"},
		"properties": map[string]any{
			"question":   map[string]any{"type": "string", "description": "一句可以直接回答的问题。"},
			"reason":     map[string]any{"type": "string", "description": "为什么需要这项信息。"},
			"answerType": map[string]any{"type": "string", "enum": []string{"single_select", "multi_select", "text", "file"}},
			"suggestions": map[string]any{
				"type": "array",
				"items": map[string]any{"type": "object", "required": []string{"label", "value"}, "properties": map[string]any{
					"label": map[string]any{"type": "string"}, "value": map[string]any{"type": "string"},
					"description": map[string]any{"type": "string"},
				}},
			},
			"allowCustomAnswer": map[string]any{"type": "boolean"},
			"blocking":          map[string]any{"type": "boolean"},
			"complexity":        map[string]any{"type": "string", "enum": []string{"simple", "normal", "complex"}},
		},
	}
}

func (*AskTool) ToolContract() tools.Contract {
	return tools.Contract{
		OutputSchema: map[string]any{"type": "object"},
		RiskLevel:    tools.RiskLow, Confirmation: tools.ConfirmationNever,
		ResultCard: tools.ResultCardClarification,
	}
}

func (*AskTool) Run(ctx context.Context, raw json.RawMessage) (json.RawMessage, error) {
	var args struct {
		Question          string       `json:"question"`
		Reason            string       `json:"reason"`
		AnswerType        AnswerType   `json:"answerType"`
		Suggestions       []Suggestion `json:"suggestions"`
		AllowCustomAnswer bool         `json:"allowCustomAnswer"`
		Blocking          bool         `json:"blocking"`
		Complexity        Complexity   `json:"complexity"`
	}
	if err := json.Unmarshal(raw, &args); err != nil {
		return nil, errors.New("clarification: invalid arguments")
	}
	idBytes := make([]byte, 12)
	if _, err := rand.Read(idBytes); err != nil {
		return nil, errors.New("clarification: request id unavailable")
	}
	request, err := NewRequest(Input{
		ID: hex.EncodeToString(idBytes), Question: args.Question, Reason: args.Reason,
		AnswerType: args.AnswerType, Suggestions: args.Suggestions,
		AllowCustomAnswer: args.AllowCustomAnswer, Blocking: args.Blocking,
		Complexity: args.Complexity, Round: roundFromContext(ctx),
	})
	if err != nil {
		return nil, err
	}
	return nil, Require(request)
}

var _ tools.Tool = (*AskTool)(nil)

func NewRequest(input Input) (Request, error) {
	maxRounds, err := maximumRounds(input.Complexity)
	if err != nil {
		return Request{}, err
	}
	if strings.TrimSpace(input.ID) == "" || strings.TrimSpace(input.Question) == "" || strings.TrimSpace(input.Reason) == "" {
		return Request{}, errors.New("clarification: id, question and reason are required")
	}
	if !validAnswerType(input.AnswerType) {
		return Request{}, fmt.Errorf("clarification: unsupported answer type %q", input.AnswerType)
	}
	if input.Round < 1 || input.Round > maxRounds {
		return Request{}, fmt.Errorf("clarification: round %d exceeds server limit %d", input.Round, maxRounds)
	}
	return Request{
		ID: strings.TrimSpace(input.ID), Question: strings.TrimSpace(input.Question), Reason: strings.TrimSpace(input.Reason),
		AnswerType: input.AnswerType, Suggestions: normalizeSuggestions(input.Suggestions),
		AllowCustomAnswer: input.AllowCustomAnswer, Blocking: input.Blocking,
		Round: input.Round, MaxRounds: maxRounds,
	}, nil
}

type Decision string

const (
	DecisionAnswer  Decision = "answer"
	DecisionSkip    Decision = "skip"
	DecisionDecline Decision = "decline"
)

type Resolution struct {
	Status       Decision `json:"status"`
	Answer       string   `json:"answer,omitempty"`
	CanContinue  bool     `json:"canContinue"`
	UsedDefault  bool     `json:"usedDefault"`
	ShouldRepeat bool     `json:"shouldRepeat"`
}

func Resolve(request Request, decision Decision, answer string) (Resolution, error) {
	switch decision {
	case DecisionAnswer:
		trimmed := strings.TrimSpace(answer)
		if trimmed == "" {
			return Resolution{}, errors.New("clarification: answer cannot be empty")
		}
		return Resolution{Status: decision, Answer: trimmed, CanContinue: true}, nil
	case DecisionSkip, DecisionDecline:
		return Resolution{
			Status: decision, CanContinue: !request.Blocking, UsedDefault: !request.Blocking,
			ShouldRepeat: false,
		}, nil
	default:
		return Resolution{}, fmt.Errorf("clarification: unsupported decision %q", decision)
	}
}

func maximumRounds(complexity Complexity) (int, error) {
	switch complexity {
	case ComplexitySimple:
		return 1, nil
	case ComplexityNormal:
		return 3, nil
	case ComplexityComplex:
		return 5, nil
	default:
		return 0, fmt.Errorf("clarification: unsupported complexity %q", complexity)
	}
}

func validAnswerType(value AnswerType) bool {
	switch value {
	case AnswerSingleSelect, AnswerMultiSelect, AnswerText, AnswerFile:
		return true
	default:
		return false
	}
}

func normalizeSuggestions(input []Suggestion) []Suggestion {
	result := make([]Suggestion, 0, len(input))
	for _, suggestion := range input {
		label := strings.TrimSpace(suggestion.Label)
		value := strings.TrimSpace(suggestion.Value)
		description := strings.TrimSpace(suggestion.Description)
		if label != "" && value != "" {
			result = append(result, Suggestion{Label: label, Value: value, Description: description})
		}
	}
	return result
}
