// Package file exposes bounded, owner-private text-file creation to agents.
package file

import (
	"context"
	"encoding/csv"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"path/filepath"
	"strings"

	"valley-server/internal/ai/tools"
	"valley-server/internal/model"
	"valley-server/internal/service"

	"gorm.io/gorm"
)

const (
	ToolName        = "file.create"
	toolScope       = "workbench"
	maxContentBytes = 2 * 1024 * 1024
)

type requestContextKey struct{}

type RequestContext struct {
	UserID         model.Int64String
	AppID          model.Int64String
	ConversationID model.Int64String
	RunID          model.Int64String
	TaskID         *model.Int64String
}

func WithRequestContext(ctx context.Context, input RequestContext) context.Context {
	return context.WithValue(ctx, requestContextKey{}, input)
}

type CreateTool struct{ db *gorm.DB }

type createArgs struct {
	FileName string `json:"fileName"`
	Format   string `json:"format"`
	Content  string `json:"content"`
}

func NewCreateTool(db *gorm.DB) *CreateTool { return &CreateTool{db: db} }
func (t *CreateTool) Name() string          { return ToolName }
func (t *CreateTool) Scope() string         { return toolScope }
func (t *CreateTool) Description() string {
	return "把用户需要保留或下载的结果创建为 Markdown、JSON 或 CSV 文件。仅在用户明确要求成果文件时调用。"
}

func (t *CreateTool) Schema() map[string]any {
	return map[string]any{
		"type":     "object",
		"required": []string{"fileName", "format", "content"},
		"properties": map[string]any{
			"fileName": map[string]any{"type": "string", "minLength": 1, "maxLength": 120, "description": "成果文件名。"},
			"format":   map[string]any{"type": "string", "enum": []string{"markdown", "json", "csv"}},
			"content":  map[string]any{"type": "string", "minLength": 1, "maxLength": maxContentBytes},
		},
	}
}

func (t *CreateTool) Run(ctx context.Context, raw json.RawMessage) (json.RawMessage, error) {
	if t == nil || t.db == nil {
		return nil, errors.New("file.create: service unavailable")
	}
	input, ok := ctx.Value(requestContextKey{}).(RequestContext)
	if !ok || input.UserID <= 0 || input.AppID <= 0 || input.ConversationID <= 0 || input.RunID <= 0 {
		return nil, errors.New("file.create: conversation context missing")
	}
	var args createArgs
	if err := json.Unmarshal(raw, &args); err != nil {
		return nil, errors.New("file.create: invalid arguments")
	}
	name, contentType, err := normalizeFile(args.FileName, args.Format, args.Content)
	if err != nil {
		return nil, err
	}
	uploadConfig := service.WorkflowOutputUploadConfig(int64(input.UserID))
	uploadConfig.CustomFolder = fmt.Sprintf("agent-outputs/%d", input.UserID)
	stored, err := service.NewUploadService().UploadBytesWithContext(ctx, name, []byte(args.Content), uploadConfig)
	if err != nil {
		return nil, fmt.Errorf("file.create: %w", err)
	}
	resource := model.Resource{
		UserID: input.UserID, Type: "agent_file", Visibility: "private",
		Title: strings.TrimSuffix(name, stored.Ext), Description: "智能体生成文件",
		URL: stored.URL, StorageKey: stored.Key, Size: stored.Size, Extension: strings.TrimPrefix(stored.Ext, "."),
	}
	artifact := model.AIAppArtifact{
		UserID: input.UserID, AppID: input.AppID, ConversationID: input.ConversationID,
		RunID: input.RunID, TaskID: input.TaskID, FileName: name, ContentType: contentType,
		SizeBytes: stored.Size, URL: stored.URL,
	}
	if err := t.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&resource).Error; err != nil {
			return err
		}
		artifact.ResourceID = resource.ID
		return tx.Create(&artifact).Error
	}); err != nil {
		_ = service.NewUploadService().DeleteByKey(stored.Key)
		return nil, errors.New("file.create: 文件记录保存失败")
	}
	return json.Marshal(map[string]any{
		"ok": true, "artifactId": artifact.ID.String(), "resourceId": resource.ID.String(),
		"fileName": name, "contentType": contentType, "size": stored.Size, "url": stored.URL,
	})
}

func normalizeFile(rawName, format, content string) (string, string, error) {
	if strings.TrimSpace(content) == "" || len([]byte(content)) > maxContentBytes {
		return "", "", errors.New("file.create: 文件内容为空或超过 2MB")
	}
	definitions := map[string]struct{ extension, contentType string }{
		"markdown": {".md", "text/markdown; charset=utf-8"},
		"json":     {".json", "application/json; charset=utf-8"},
		"csv":      {".csv", "text/csv; charset=utf-8"},
	}
	normalizedFormat := strings.ToLower(strings.TrimSpace(format))
	definition, exists := definitions[normalizedFormat]
	if !exists {
		return "", "", errors.New("file.create: 仅支持 markdown、json 或 csv")
	}
	if normalizedFormat == "json" && !json.Valid([]byte(content)) {
		return "", "", errors.New("file.create: JSON 内容无效")
	}
	if normalizedFormat == "csv" {
		if _, err := csv.NewReader(strings.NewReader(content)).ReadAll(); err != nil && err != io.EOF {
			return "", "", errors.New("file.create: CSV 内容无效")
		}
	}
	name := strings.Trim(strings.TrimSpace(filepath.Base(rawName)), ".")
	if name == "" {
		return "", "", errors.New("file.create: 文件名不能为空")
	}
	if runes := []rune(name); len(runes) > 100 {
		name = string(runes[:100])
	}
	if !strings.HasSuffix(strings.ToLower(name), definition.extension) {
		name += definition.extension
	}
	return name, definition.contentType, nil
}

var _ tools.Tool = (*CreateTool)(nil)
