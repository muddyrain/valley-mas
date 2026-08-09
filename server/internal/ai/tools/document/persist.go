package document

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"valley-server/internal/ai/tools"
	"valley-server/internal/ai/tools/artifact"
	"valley-server/internal/model"
	"valley-server/internal/service"

	"gorm.io/gorm"
)

const (
	SaveToolName      = "document.save"
	OverwriteToolName = "document.overwrite"
)

type SaveTool struct{ db *gorm.DB }

type OverwriteTool struct {
	db               *gorm.DB
	deleteStorageKey func(string) error
}

type saveArgs struct {
	ArtifactID string `json:"artifactId"`
}

type overwriteArgs struct {
	ArtifactID       string `json:"artifactId"`
	TargetResourceID string `json:"targetResourceId"`
}

func NewSaveTool(db *gorm.DB) *SaveTool { return &SaveTool{db: db} }

func NewOverwriteTool(db *gorm.DB) *OverwriteTool {
	return newOverwriteTool(db, service.NewUploadService().DeleteByKey)
}

func newOverwriteTool(db *gorm.DB, deleteStorageKey func(string) error) *OverwriteTool {
	return &OverwriteTool{db: db, deleteStorageKey: deleteStorageKey}
}

func (tool *SaveTool) Name() string  { return SaveToolName }
func (tool *SaveTool) Scope() string { return toolScope }
func (tool *SaveTool) Description() string {
	return "把当前用户的临时成果文件保存为长期私有文档。执行前必须获得用户确认。"
}
func (tool *SaveTool) Schema() map[string]any {
	return map[string]any{"type": "object", "required": []string{"artifactId"}, "properties": map[string]any{"artifactId": map[string]any{"type": "string"}}}
}
func (tool *SaveTool) ToolContract() tools.Contract {
	return persistentDocumentContract(SaveToolName)
}

func (tool *SaveTool) Run(ctx context.Context, raw json.RawMessage) (json.RawMessage, error) {
	if tool == nil || tool.db == nil {
		return nil, errors.New("document.save: service unavailable")
	}
	request, id, err := parseArtifactWriteRequest(ctx, raw)
	if err != nil {
		return nil, fmt.Errorf("document.save: %w", err)
	}
	var item model.AIAppArtifact
	var resource model.Resource
	now := time.Now()
	err = tool.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("id = ? AND user_id = ? AND app_id = ?", id, request.UserID, request.AppID).First(&item).Error; err != nil {
			return errors.New("成果文件不存在或无权访问")
		}
		if item.IsExpired(now) {
			return errors.New("成果文件已过期")
		}
		if err := tx.Where("id = ? AND user_id = ?", item.ResourceID, request.UserID).First(&resource).Error; err != nil {
			return errors.New("成果文件资源不存在")
		}
		updates := map[string]any{"type": "document", "visibility": "private", "description": "智能体长期文档", "title": documentTitle(item.FileName)}
		if err := tx.Model(&resource).Updates(updates).Error; err != nil {
			return err
		}
		if err := tx.Model(&item).Updates(map[string]any{"persisted_at": now, "expires_at": nil}).Error; err != nil {
			return err
		}
		item.PersistedAt = &now
		item.ExpiresAt = nil
		return nil
	})
	if err != nil {
		return nil, fmt.Errorf("document.save: %w", err)
	}
	return json.Marshal(map[string]any{"ok": true, "artifactId": item.ID.String(), "resourceId": resource.ID.String(), "fileName": item.FileName, "persistedAt": now})
}

func (tool *OverwriteTool) Name() string  { return OverwriteToolName }
func (tool *OverwriteTool) Scope() string { return toolScope }
func (tool *OverwriteTool) Description() string {
	return "用临时成果文件覆盖当前用户已有的私有文档。执行前必须展示目标并获得用户确认。"
}
func (tool *OverwriteTool) Schema() map[string]any {
	return map[string]any{
		"type": "object", "required": []string{"artifactId", "targetResourceId"},
		"properties": map[string]any{"artifactId": map[string]any{"type": "string"}, "targetResourceId": map[string]any{"type": "string"}},
	}
}
func (tool *OverwriteTool) ToolContract() tools.Contract {
	return persistentDocumentContract(OverwriteToolName)
}

func (tool *OverwriteTool) Run(ctx context.Context, raw json.RawMessage) (json.RawMessage, error) {
	if tool == nil || tool.db == nil {
		return nil, errors.New("document.overwrite: service unavailable")
	}
	request, err := artifact.RequestFromContext(ctx)
	if err != nil {
		return nil, fmt.Errorf("document.overwrite: %w", err)
	}
	var args overwriteArgs
	if json.Unmarshal(raw, &args) != nil {
		return nil, errors.New("document.overwrite: invalid arguments")
	}
	artifactID, err := parsePositiveID(args.ArtifactID)
	if err != nil {
		return nil, fmt.Errorf("document.overwrite: %w", err)
	}
	targetID, err := parsePositiveID(args.TargetResourceID)
	if err != nil {
		return nil, fmt.Errorf("document.overwrite: 目标文档 ID 无效")
	}
	var item model.AIAppArtifact
	var source, target model.Resource
	oldTargetKey := ""
	now := time.Now()
	err = tool.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("id = ? AND user_id = ? AND app_id = ?", artifactID, request.UserID, request.AppID).First(&item).Error; err != nil {
			return errors.New("成果文件不存在或无权访问")
		}
		if item.IsExpired(now) {
			return errors.New("成果文件已过期")
		}
		if err := tx.Where("id = ? AND user_id = ?", item.ResourceID, request.UserID).First(&source).Error; err != nil {
			return errors.New("成果文件资源不存在")
		}
		if err := tx.Where("id = ? AND user_id = ? AND visibility = ? AND type IN ?", targetID, request.UserID, "private", []string{"document", "agent_file"}).First(&target).Error; err != nil {
			return errors.New("目标文档不存在或无权覆盖")
		}
		oldTargetKey = target.StorageKey
		updates := map[string]any{
			"url": source.URL, "storage_key": source.StorageKey, "size": source.Size,
			"extension": source.Extension, "type": "document", "description": "智能体长期文档",
		}
		if err := tx.Model(&target).Updates(updates).Error; err != nil {
			return err
		}
		if source.ID != target.ID {
			if err := tx.Delete(&source).Error; err != nil {
				return err
			}
		}
		if err := tx.Model(&item).Updates(map[string]any{"resource_id": target.ID, "persisted_at": now, "expires_at": nil}).Error; err != nil {
			return err
		}
		item.ResourceID = target.ID
		item.PersistedAt = &now
		item.ExpiresAt = nil
		return nil
	})
	if err != nil {
		return nil, fmt.Errorf("document.overwrite: %w", err)
	}
	if tool.deleteStorageKey != nil && oldTargetKey != "" && oldTargetKey != item.StorageKey {
		_ = tool.deleteStorageKey(oldTargetKey)
	}
	return json.Marshal(map[string]any{"ok": true, "artifactId": item.ID.String(), "resourceId": target.ID.String(), "fileName": item.FileName, "persistedAt": now})
}

func persistentDocumentContract(_ string) tools.Contract {
	return tools.Contract{
		OutputSchema: map[string]any{"type": "object", "required": []string{"artifactId", "resourceId", "fileName", "persistedAt"}},
		RiskLevel:    tools.RiskMedium, Confirmation: tools.ConfirmationBeforeWrite, ResultCard: tools.ResultCardFile,
	}
}

func parseArtifactWriteRequest(ctx context.Context, raw json.RawMessage) (artifact.RequestContext, model.Int64String, error) {
	request, err := artifact.RequestFromContext(ctx)
	if err != nil {
		return request, 0, err
	}
	var args saveArgs
	if json.Unmarshal(raw, &args) != nil {
		return request, 0, errors.New("invalid arguments")
	}
	id, err := parsePositiveID(args.ArtifactID)
	return request, id, err
}

func parsePositiveID(value string) (model.Int64String, error) {
	id, err := strconv.ParseInt(strings.TrimSpace(value), 10, 64)
	if err != nil || id <= 0 {
		return 0, errors.New("成果文件 ID 无效")
	}
	return model.Int64String(id), nil
}

func documentTitle(fileName string) string {
	base := filepath.Base(strings.TrimSpace(fileName))
	return strings.TrimSuffix(base, filepath.Ext(base))
}

var _ tools.Tool = (*SaveTool)(nil)
var _ tools.Tool = (*OverwriteTool)(nil)
