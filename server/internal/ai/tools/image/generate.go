// Package image exposes the bounded image-generation capability to agents.
// It deliberately delegates planning, capability checks, storage and audit to
// the same service used by the image studio.
package image

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"unicode/utf8"

	"valley-server/internal/ai/tools"
	"valley-server/internal/aiapp"
	"valley-server/internal/model"
	"valley-server/internal/service"

	"gorm.io/gorm"
)

const (
	ToolName       = "image.generate"
	toolScope      = "workbench"
	maxPromptRunes = 4_000
)

type requestContextKey struct{}

type requestContext struct {
	UserID         model.Int64String
	References     []string
	StyleProfileID string
}

// WithRequestInput supplies request-scoped values that must never be
// persisted in agent messages, especially reference-image data URLs.
func WithRequestInput(ctx context.Context, userID model.Int64String, references []string, styleProfileID string) context.Context {
	return context.WithValue(ctx, requestContextKey{}, requestContext{
		UserID:         userID,
		References:     append([]string(nil), references...),
		StyleProfileID: strings.TrimSpace(styleProfileID),
	})
}

type GenerateTool struct {
	db     *gorm.DB
	config *aiapp.ImageGenerationConfig
}

type generateArgs struct {
	Prompt             string `json:"prompt"`
	AspectRatio        string `json:"aspectRatio"`
	Quality            string `json:"quality"`
	UseReferenceImages *bool  `json:"useReferenceImages"`
}

func NewGenerateTool(db *gorm.DB, config *aiapp.ImageGenerationConfig) *GenerateTool {
	return &GenerateTool{db: db, config: config}
}

func (t *GenerateTool) Name() string { return ToolName }

func (t *GenerateTool) Description() string {
	return "根据用户明确的画面需求生成一张图片。用户本轮上传参考图或选择视觉技能时，应在确有帮助时使用；一次只能生成一张图片。"
}

func (t *GenerateTool) ToolContract() tools.Contract {
	return tools.Contract{
		OutputSchema: map[string]any{
			"type":     "object",
			"required": []string{"generationId", "imageUrl", "width", "height"},
		},
		RiskLevel: tools.RiskMedium, Confirmation: tools.ConfirmationNever,
		ResultCard: tools.ResultCardImage,
	}
}

func (t *GenerateTool) Schema() map[string]any {
	return map[string]any{
		"type":     "object",
		"required": []string{"prompt"},
		"properties": map[string]any{
			"prompt":             map[string]any{"type": "string", "minLength": 1, "maxLength": maxPromptRunes, "description": "要生成的画面描述，保留用户明确的主体、数量、用途和约束。"},
			"aspectRatio":        map[string]any{"type": "string", "enum": []string{"1:1", "4:3", "3:4", "16:9", "9:16"}, "description": "可选。未提供时使用智能体配置的默认比例。"},
			"quality":            map[string]any{"type": "string", "enum": []string{"1K", "2K", "3K", "4K"}, "description": "可选。未提供时使用智能体配置的默认清晰度。"},
			"useReferenceImages": map[string]any{"type": "boolean", "description": "本轮有用户上传图片时，是否将其作为参考图。未提供时默认使用。"},
		},
	}
}

func (t *GenerateTool) Scope() string { return toolScope }

func (t *GenerateTool) Run(ctx context.Context, raw json.RawMessage) (json.RawMessage, error) {
	if t == nil || t.db == nil {
		return nil, errors.New("image.generate: service unavailable")
	}
	if t.config == nil || strings.TrimSpace(t.config.ModelID) == "" {
		return nil, errors.New("image.generate: 请先在智能体配置中选择图片模型")
	}
	var args generateArgs
	if err := json.Unmarshal(raw, &args); err != nil {
		return nil, errors.New("image.generate: invalid arguments")
	}
	prompt := strings.TrimSpace(args.Prompt)
	if prompt == "" || utf8.RuneCountInString(prompt) > maxPromptRunes {
		return nil, fmt.Errorf("image.generate: prompt must contain 1 to %d characters", maxPromptRunes)
	}
	input, _ := ctx.Value(requestContextKey{}).(requestContext)
	if input.UserID <= 0 {
		return nil, errors.New("image.generate: owner missing")
	}
	useReferences := args.UseReferenceImages == nil || *args.UseReferenceImages
	references := input.References
	if !useReferences {
		references = nil
	}
	aspectRatio := strings.TrimSpace(args.AspectRatio)
	if aspectRatio == "" {
		aspectRatio = t.config.AspectRatio
	}
	quality := strings.TrimSpace(args.Quality)
	if quality == "" {
		quality = t.config.Quality
	}
	generation, err := service.NewAIImageGenerationService(t.db).Generate(ctx, service.AIImageGenerationInput{
		UserID: input.UserID, ModelID: t.config.ModelID, RecipeID: "free", StyleProfileID: input.StyleProfileID,
		Brief: prompt, AspectRatio: aspectRatio, Quality: quality, References: references,
		Feature: "ai-agent-image-generation",
	})
	if err != nil {
		return nil, fmt.Errorf("image.generate: %w", err)
	}
	if generation.Status != "succeeded" || strings.TrimSpace(generation.ResultURL) == "" {
		return nil, errors.New("image.generate: image generation did not complete")
	}
	return json.Marshal(map[string]any{
		"ok": true, "generationId": generation.ID.String(), "imageUrl": generation.ResultURL,
		"width": generation.ResultWidth, "height": generation.ResultHeight,
		"aspectRatio": generation.AspectRatio, "quality": generation.Quality,
	})
}

var _ tools.Tool = (*GenerateTool)(nil)
