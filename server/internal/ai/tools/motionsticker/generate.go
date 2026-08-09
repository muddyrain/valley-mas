// Package motionsticker exposes the durable motion-sticker queue as a stable
// tool boundary for future agent and workflow adapters.
package motionsticker

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"unicode/utf8"

	"valley-server/internal/ai/tools"
	"valley-server/internal/model"
	"valley-server/internal/service"

	"gorm.io/gorm"
)

const ToolName = "motion_sticker.generate"

type requestContextKey struct{}

type requestInput struct {
	UserID              model.Int64String
	ReferenceURL        string
	ReferenceStorageKey string
}

// WithRequestInput supplies an already validated and stored owner reference.
// Transport adapters remain responsible for resolving attachments into this
// request-scoped input and must never accept another owner's storage key.
func WithRequestInput(ctx context.Context, userID model.Int64String, referenceURL, referenceStorageKey string) context.Context {
	return context.WithValue(ctx, requestContextKey{}, requestInput{
		UserID: userID, ReferenceURL: strings.TrimSpace(referenceURL),
		ReferenceStorageKey: strings.TrimSpace(referenceStorageKey),
	})
}

type GenerateTool struct {
	db *gorm.DB
}

type generateArgs struct {
	ModelID string `json:"modelId"`
	Mode    string `json:"mode"`
	Action  string `json:"action"`
}

func NewGenerateTool(db *gorm.DB) *GenerateTool { return &GenerateTool{db: db} }

func (tool *GenerateTool) Name() string  { return ToolName }
func (tool *GenerateTool) Scope() string { return "workbench" }
func (tool *GenerateTool) Description() string {
	return "根据当前用户的一张角色参考图和动作描述，创建异步动态表情任务；默认由生图模型生成循环 GIF，也可选择视频增强。"
}

func (tool *GenerateTool) Schema() map[string]any {
	return map[string]any{
		"type": "object", "required": []string{"modelId", "action"},
		"properties": map[string]any{
			"modelId": map[string]any{"type": "string", "description": "支持当前生成方式和参考图的模型目录 ID。"},
			"mode": map[string]any{
				"type": "string", "enum": []string{service.AIMotionStickerModeImage, service.AIMotionStickerModeVideo},
				"default": service.AIMotionStickerModeImage, "description": "生成方式；image 为默认生图 GIF，video 为视频增强。",
			},
			"action": map[string]any{"type": "string", "minLength": 1, "maxLength": 500, "description": "角色要完成的动作和可选场景。"},
		},
	}
}

func (tool *GenerateTool) ToolContract() tools.Contract {
	return tools.Contract{
		OutputSchema: map[string]any{"type": "object", "required": []string{"generationId", "status"}},
		RiskLevel:    tools.RiskMedium, Confirmation: tools.ConfirmationNever, ResultCard: tools.ResultCardTool,
	}
}

func (tool *GenerateTool) Run(ctx context.Context, raw json.RawMessage) (json.RawMessage, error) {
	if tool == nil || tool.db == nil {
		return nil, errors.New("motion_sticker.generate: service unavailable")
	}
	var args generateArgs
	if err := json.Unmarshal(raw, &args); err != nil {
		return nil, errors.New("motion_sticker.generate: invalid arguments")
	}
	args.Action = strings.TrimSpace(args.Action)
	if args.Action == "" || utf8.RuneCountInString(args.Action) > 500 {
		return nil, errors.New("motion_sticker.generate: action must contain 1 to 500 characters")
	}
	input, _ := ctx.Value(requestContextKey{}).(requestInput)
	if input.UserID <= 0 || input.ReferenceURL == "" || input.ReferenceStorageKey == "" {
		return nil, errors.New("motion_sticker.generate: owner reference missing")
	}
	generation, err := service.NewAIMotionStickerService(tool.db).Queue(ctx, service.AIMotionStickerQueueInput{
		UserID: input.UserID, ModelID: args.ModelID, Mode: args.Mode, Action: args.Action,
		ReferenceURL: input.ReferenceURL, ReferenceStorageKey: input.ReferenceStorageKey,
	})
	if err != nil {
		return nil, fmt.Errorf("motion_sticker.generate: %w", err)
	}
	return json.Marshal(map[string]any{
		"generationId": generation.ID.String(), "status": generation.Status, "generationMode": generation.GenerationMode,
		"detailPath": "/workbench/gifs", "message": "动态表情任务已创建，完成后会通知用户。",
	})
}

var _ tools.Tool = (*GenerateTool)(nil)
