package handler

import (
	"bytes"
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"path/filepath"
	"strings"
	"time"

	"valley-server/internal/ai/agent"
	"valley-server/internal/ai/tools"
	"valley-server/internal/ai/tools/content"
	"valley-server/internal/aiapp"
	"valley-server/internal/aiclient"
	"valley-server/internal/aimodel"
	"valley-server/internal/database"
	"valley-server/internal/logger"
	"valley-server/internal/model"

	"github.com/gin-gonic/gin"
	"github.com/ledongthuc/pdf"
	"github.com/sirupsen/logrus"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const (
	aiAppTypeAgent         = "agent"
	aiAppTypeWorkflow      = "workflow"
	aiAPIKeyDailyCallLimit = 100
)

var ErrAIAPIKeyDailyQuotaExceeded = errors.New("ai api key daily quota exceeded")

// consumeAIAPIKeyDailyUsage atomically reserves one call from a key's daily
// quota. The conditional update is the quota gate: concurrent callers can
// never increment the count beyond aiAPIKeyDailyCallLimit.
func consumeAIAPIKeyDailyUsage(db *gorm.DB, apiKeyID model.Int64String, usageDate string) (int, error) {
	usage := model.AIAPIKeyDailyUsage{APIKeyID: apiKeyID, UsageDate: usageDate}
	if err := db.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "api_key_id"}, {Name: "usage_date"}},
		DoNothing: true,
	}).Create(&usage).Error; err != nil {
		return 0, err
	}

	result := db.Model(&model.AIAPIKeyDailyUsage{}).
		Where("api_key_id = ? AND usage_date = ? AND request_count < ?", apiKeyID, usageDate, aiAPIKeyDailyCallLimit).
		UpdateColumn("request_count", gorm.Expr("request_count + ?", 1))
	if result.Error != nil {
		return 0, result.Error
	}
	if result.RowsAffected == 0 {
		return 0, ErrAIAPIKeyDailyQuotaExceeded
	}

	var current model.AIAPIKeyDailyUsage
	if err := db.Where("api_key_id = ? AND usage_date = ?", apiKeyID, usageDate).First(&current).Error; err != nil {
		return 0, err
	}
	return aiAPIKeyDailyCallLimit - current.RequestCount, nil
}

var builtInAITools = []gin.H{
	{"name": "content.search", "description": "搜索当前用户可访问的内容", "permission": "read"},
	{"name": "blog.create_draft", "description": "创建当前用户的博客草稿", "permission": "write"},
	{"name": "blog.update_draft", "description": "更新当前用户的博客草稿", "permission": "write"},
	{"name": "resource.create_draft", "description": "创建当前用户的资源草稿", "permission": "write"},
}

type aiKnowledgeReference struct {
	DocumentName string            `json:"documentName"`
	ChunkID      model.Int64String `json:"chunkId"`
	Excerpt      string            `json:"excerpt"`
}

type aiKnowledgeSearchRow struct {
	ChunkID      model.Int64String `gorm:"column:chunk_id"`
	DocumentName string            `gorm:"column:document_name"`
	Content      string            `gorm:"column:content"`
	Score        float64           `gorm:"column:score"`
}

type aiKnowledgeDocumentResponse struct {
	model.AIKnowledgeDocument
	Source string `json:"source"`
}

type aiKnowledgeBaseResponse struct {
	model.AIKnowledgeBase
	DocumentCount int `json:"documentCount"`
}

type aiKnowledgeChunkPreview struct {
	ID         model.Int64String `json:"id"`
	Position   int               `json:"position"`
	Content    string            `json:"content"`
	TokenCount int               `json:"tokenCount"`
	PageNumber int               `json:"pageNumber"`
	SourceType string            `json:"sourceType"`
}

type aiKnowledgeRetrievalTestRequest struct {
	Query string `json:"query"`
}

type aiKnowledgeRetrievalTestResult struct {
	DocumentName string            `json:"documentName"`
	ChunkID      model.Int64String `json:"chunkId"`
	Excerpt      string            `json:"excerpt"`
	Score        float64           `json:"score"`
}

func presentAIKnowledgeDocument(document model.AIKnowledgeDocument) aiKnowledgeDocumentResponse {
	return aiKnowledgeDocumentResponse{AIKnowledgeDocument: document, Source: "upload"}
}

type aiAppPayload struct {
	Type             string              `json:"type"`
	Name             string              `json:"name"`
	Description      string              `json:"description"`
	Config           json.RawMessage     `json:"config"`
	ToolNames        []string            `json:"toolNames"`
	KnowledgeBaseIDs []model.Int64String `json:"knowledgeBaseIds"`
}

type aiAppRetrievalConfig struct {
	TopK        int     `json:"topK"`
	MinScore    float64 `json:"minScore"`
	CiteSources bool    `json:"citeSources"`
}

func defaultAIAppRetrievalConfig() aiAppRetrievalConfig {
	return aiAppRetrievalConfig{TopK: 4, MinScore: 0.45, CiteSources: true}
}

func parseAIAppRetrievalConfig(raw string) (aiAppRetrievalConfig, error) {
	config := defaultAIAppRetrievalConfig()
	if strings.TrimSpace(raw) == "" || strings.TrimSpace(raw) == "{}" {
		return config, nil
	}
	if err := json.Unmarshal([]byte(raw), &config); err != nil {
		return aiAppRetrievalConfig{}, err
	}
	if config.TopK < 1 || config.TopK > 8 || config.MinScore < 0.20 || config.MinScore > 0.80 {
		return aiAppRetrievalConfig{}, errors.New("retrieval config out of range")
	}
	return config, nil
}

// aiKnowledgeRetrievalFailure converts internal RAG failures into a stable
// public contract. The original error is kept for structured server logs only.
func aiKnowledgeRetrievalFailure(err error) (code, message string) {
	if err == nil {
		return "", ""
	}

	value := err.Error()
	lowerValue := strings.ToLower(value)
	switch {
	case strings.Contains(value, "RAG requires PostgreSQL"):
		return "RAG_POSTGRES_REQUIRED", "知识库检索需要 PostgreSQL 数据库"
	case strings.Contains(value, "pgvector extension is not installed"):
		return "RAG_PGVECTOR_UNAVAILABLE", "数据库未启用 pgvector 扩展"
	case strings.Contains(lowerValue, "different vector dimensions"):
		return "RAG_VECTOR_DIMENSION_MISMATCH", "知识库向量维度不匹配，请重新索引全部文档"
	case strings.Contains(lowerValue, "operator does not exist") && strings.Contains(lowerValue, "vector"):
		return "RAG_VECTOR_OPERATOR_UNAVAILABLE", "知识库向量检索不可用，请检查 pgvector 与数据库迁移"
	case strings.Contains(lowerValue, "relation \"ai_knowledge_") || strings.Contains(lowerValue, "column \"embedding\""):
		return "RAG_SCHEMA_OUTDATED", "知识库数据库结构未迁移，请执行服务端迁移"
	case strings.Contains(lowerValue, "connection refused") ||
		strings.Contains(lowerValue, "failed to connect") ||
		strings.Contains(lowerValue, "connection reset") ||
		strings.Contains(lowerValue, "database is closed"):
		return "RAG_DATABASE_UNAVAILABLE", "知识库数据库暂不可用，请稍后重试"
	case strings.Contains(value, "ARK_EMBEDDING_MODEL"):
		return "ARK_EMBEDDING_NOT_CONFIGURED", "知识库向量模型未配置"
	case strings.Contains(value, "ARK embedding"):
		return "ARK_EMBEDDING_FAILED", "知识库向量服务调用失败"
	case strings.Contains(value, "retrieval config"):
		return "RAG_CONFIG_INVALID", "知识库检索配置无效"
	default:
		return "RAG_QUERY_FAILED", "知识库检索服务异常"
	}
}

func logAIKnowledgeRetrievalFailure(c *gin.Context, err error, fields logrus.Fields) {
	logger.Error(c, "AI knowledge retrieval failed", err, fields)
}

func serializeAIAppRetrievalConfig(config aiAppRetrievalConfig) string {
	encoded, _ := json.Marshal(config)
	return string(encoded)
}

func copyAIAppVersionKnowledgeBaseSnapshot(tx *gorm.DB, app model.AIApp, source, target model.AIAppVersion) error {
	var sourceBindings []model.AIAppVersionKnowledgeBase
	if source.ID != 0 && source.KnowledgeBaseSnapshot {
		if err := tx.Where("app_version_id = ?", source.ID).Find(&sourceBindings).Error; err != nil {
			return err
		}
	} else {
		var legacyBindings []model.AIAppKnowledgeBase
		if err := tx.Where("app_id = ?", app.ID).Find(&legacyBindings).Error; err != nil {
			return err
		}
		for _, binding := range legacyBindings {
			sourceBindings = append(sourceBindings, model.AIAppVersionKnowledgeBase{KnowledgeBaseID: binding.KnowledgeBaseID})
		}
	}
	bindings := make([]model.AIAppVersionKnowledgeBase, 0, len(sourceBindings))
	for _, binding := range sourceBindings {
		bindings = append(bindings, model.AIAppVersionKnowledgeBase{AppVersionID: target.ID, KnowledgeBaseID: binding.KnowledgeBaseID})
	}
	if len(bindings) > 0 {
		return tx.Create(&bindings).Error
	}
	return nil
}

func copyAIAppVersionToolSnapshot(tx *gorm.DB, app model.AIApp, source, target model.AIAppVersion) error {
	var sourceBindings []model.AIAppVersionToolBinding
	if source.ID != 0 && source.ToolSnapshot {
		if err := tx.Where("app_version_id = ?", source.ID).Find(&sourceBindings).Error; err != nil {
			return err
		}
	} else if source.ID != 0 {
		var legacyBindings []model.AIAppToolBinding
		if err := tx.Where("app_id = ?", app.ID).Find(&legacyBindings).Error; err != nil {
			return err
		}
		for _, binding := range legacyBindings {
			sourceBindings = append(sourceBindings, model.AIAppVersionToolBinding{ToolName: binding.ToolName})
		}
	}
	bindings := make([]model.AIAppVersionToolBinding, 0, len(sourceBindings))
	for _, binding := range sourceBindings {
		bindings = append(bindings, model.AIAppVersionToolBinding{AppVersionID: target.ID, ToolName: binding.ToolName})
	}
	if len(bindings) > 0 {
		return tx.Create(&bindings).Error
	}
	return nil
}

func createAIAppVersionSnapshot(tx *gorm.DB, app model.AIApp, config string, retrievalConfig aiAppRetrievalConfig, source model.AIAppVersion) (model.AIAppVersion, error) {
	var latest model.AIAppVersion
	if err := tx.Where("app_id = ?", app.ID).Order("number DESC").First(&latest).Error; err != nil && err != gorm.ErrRecordNotFound {
		return model.AIAppVersion{}, err
	}
	version := model.AIAppVersion{AppID: app.ID, Number: latest.Number + 1, Config: config, RetrievalConfig: serializeAIAppRetrievalConfig(retrievalConfig), KnowledgeBaseSnapshot: true, ToolSnapshot: true}
	if err := tx.Create(&version).Error; err != nil {
		return model.AIAppVersion{}, err
	}
	if err := copyAIAppVersionKnowledgeBaseSnapshot(tx, app, source, version); err != nil {
		return model.AIAppVersion{}, err
	}
	if err := copyAIAppVersionToolSnapshot(tx, app, source, version); err != nil {
		return model.AIAppVersion{}, err
	}
	return version, nil
}

func currentAIAppUser(c *gin.Context) (model.Int64String, bool) {
	userID := GetCurrentUserID(c)
	if userID <= 0 {
		Error(c, http.StatusUnauthorized, "未登录")
		return 0, false
	}
	return model.Int64String(userID), true
}

func validAIAppType(value string) bool { return value == aiAppTypeAgent || value == aiAppTypeWorkflow }

func ListAIApps(c *gin.Context) {
	userID, ok := currentAIAppUser(c)
	if !ok {
		return
	}
	if err := syncLegacyWorkflowApps(userID); err != nil {
		Error(c, 500, "同步工作流应用失败")
		return
	}
	var apps []model.AIApp
	if err := database.GetDB().Where("user_id = ?", userID).Order("updated_at DESC").Find(&apps).Error; err != nil {
		Error(c, 500, "加载应用失败")
		return
	}
	Success(c, gin.H{"list": apps})
}

// syncLegacyWorkflowApps materializes an AIApp mirror for old workflow rows.
// Legacy routes keep owning the graph editor and detailed node history.
func syncLegacyWorkflowApps(userID model.Int64String) error {
	return database.GetDB().Transaction(func(tx *gorm.DB) error {
		var workflows []model.Workflow
		if err := tx.Where("user_id = ?", userID).Find(&workflows).Error; err != nil {
			return err
		}
		for _, definition := range workflows {
			if _, _, err := syncWorkflowAIApp(tx, definition); err != nil {
				return err
			}
		}
		return nil
	})
}

func syncWorkflowAIApp(tx *gorm.DB, definition model.Workflow) (model.AIApp, model.AIAppVersion, error) {
	return syncWorkflowAIAppWithSnapshot(tx, definition, true)
}

// syncWorkflowAIAppWithoutSnapshot keeps the editable workflow draft in its own
// table without turning every autosave, read, or run into a user-visible history version.
func syncWorkflowAIAppWithoutSnapshot(tx *gorm.DB, definition model.Workflow) (model.AIApp, model.AIAppVersion, error) {
	return syncWorkflowAIAppWithSnapshot(tx, definition, false)
}

func syncWorkflowAIAppWithSnapshot(tx *gorm.DB, definition model.Workflow, createSnapshot bool) (model.AIApp, model.AIAppVersion, error) {
	workflowID := definition.ID
	var app model.AIApp
	err := tx.Where("workflow_id = ?", workflowID).First(&app).Error
	if err != nil && err != gorm.ErrRecordNotFound {
		return model.AIApp{}, model.AIAppVersion{}, err
	}
	if err == gorm.ErrRecordNotFound {
		var unlinked []model.AIApp
		if err := tx.Where("user_id = ? AND type = ? AND workflow_id IS NULL AND name = ?", definition.UserID, aiAppTypeWorkflow, definition.Name).Limit(2).Find(&unlinked).Error; err != nil {
			return model.AIApp{}, model.AIAppVersion{}, err
		}
		if len(unlinked) == 1 {
			app = unlinked[0]
			if err := tx.Model(&app).Update("workflow_id", workflowID).Error; err != nil {
				return model.AIApp{}, model.AIAppVersion{}, err
			}
			app.WorkflowID = &workflowID
		} else {
			app = model.AIApp{UserID: definition.UserID, Type: aiAppTypeWorkflow, WorkflowID: &workflowID, Name: definition.Name, Description: definition.Description, Status: definition.Status}
			if err := tx.Create(&app).Error; err != nil {
				return model.AIApp{}, model.AIAppVersion{}, err
			}
		}
	}
	var latest model.AIAppVersion
	if err := tx.Where("app_id = ?", app.ID).Order("number DESC").First(&latest).Error; err != nil && err != gorm.ErrRecordNotFound {
		return model.AIApp{}, model.AIAppVersion{}, err
	}

	// DraftVersionID is the editor's current saved draft. A metadata read must
	// not replace it with the numerically newest version, because that version
	// may be an immutable published snapshot.
	draft := model.AIAppVersion{}
	if app.DraftVersionID != 0 {
		if err := tx.Where("id = ? AND app_id = ?", app.DraftVersionID, app.ID).First(&draft).Error; err != nil && err != gorm.ErrRecordNotFound {
			return model.AIApp{}, model.AIAppVersion{}, err
		}
	}
	if draft.ID == 0 {
		draft = latest
	}
	if draft.ID == 0 || (createSnapshot && draft.Config != definition.Graph) {
		var source model.AIAppVersion
		if latest.ID != 0 {
			source = latest
		}
		retrievalConfig, parseErr := parseAIAppRetrievalConfig(source.RetrievalConfig)
		if parseErr != nil {
			return model.AIApp{}, model.AIAppVersion{}, parseErr
		}
		var createErr error
		draft, createErr = createAIAppVersionSnapshot(tx, app, definition.Graph, retrievalConfig, source)
		if createErr != nil {
			return model.AIApp{}, model.AIAppVersion{}, createErr
		}
	}
	updates := map[string]any{"name": definition.Name, "description": definition.Description, "status": definition.Status, "draft_version_id": draft.ID}
	// A saved draft must never silently replace an already published workflow
	// version. Keep the one-time backfill for legacy published workflows that
	// have not acquired a published pointer yet; explicit publish is the only
	// path that advances an existing published pointer.
	if definition.Status == "published" && app.PublishedVersionID == 0 {
		updates["published_version_id"] = draft.ID
	}
	if err := tx.Model(&app).Updates(updates).Error; err != nil {
		return model.AIApp{}, model.AIAppVersion{}, err
	}
	if definition.Status == "published" && app.PublishedVersionID == 0 {
		if err := tx.Model(&model.AIAppVersion{}).Where("id = ?", draft.ID).Update("published_at", time.Now()).Error; err != nil {
			return model.AIApp{}, model.AIAppVersion{}, err
		}
		publishedAt := time.Now()
		draft.PublishedAt = &publishedAt
	}
	app.Name = definition.Name
	app.Description = definition.Description
	app.Status = definition.Status
	app.DraftVersionID = draft.ID
	if definition.Status == "published" && app.PublishedVersionID == 0 {
		app.PublishedVersionID = draft.ID
	}
	return app, draft, nil
}

func CreateAIApp(c *gin.Context) {
	userID, ok := currentAIAppUser(c)
	if !ok {
		return
	}
	var payload aiAppPayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		Error(c, 400, "应用参数错误")
		return
	}
	payload.Type = strings.TrimSpace(payload.Type)
	payload.Name = strings.TrimSpace(payload.Name)
	if !validAIAppType(payload.Type) || payload.Name == "" {
		Error(c, 400, "应用类型、名称不能为空")
		return
	}
	config := payload.Config
	if len(config) == 0 {
		config = json.RawMessage(`{}`)
	}
	if !json.Valid(config) {
		Error(c, 400, "应用配置必须为 JSON")
		return
	}
	if payload.Type == aiAppTypeAgent {
		parsed, err := aiapp.Parse(string(config))
		if err != nil {
			Error(c, 400, err.Error())
			return
		}
		normalized, err := aiapp.Marshal(parsed)
		if err != nil {
			Error(c, 400, "智能体配置无效")
			return
		}
		config = normalized
	}
	toolNames, err := validateInitialAIAppTools(payload.ToolNames)
	if err != nil {
		Error(c, 400, err.Error())
		return
	}
	knowledgeBaseIDs, err := validateInitialAIAppKnowledgeBases(database.GetDB(), userID, payload.KnowledgeBaseIDs)
	if err != nil {
		Error(c, 400, err.Error())
		return
	}
	app := model.AIApp{UserID: userID, Type: payload.Type, Name: payload.Name, Description: strings.TrimSpace(payload.Description)}
	var version model.AIAppVersion
	if err := database.GetDB().Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&app).Error; err != nil {
			return err
		}
		var createErr error
		version, createErr = createAIAppVersionSnapshot(tx, app, string(config), defaultAIAppRetrievalConfig(), model.AIAppVersion{})
		if createErr != nil {
			return createErr
		}
		for _, toolName := range toolNames {
			if err := tx.Create(&model.AIAppVersionToolBinding{AppVersionID: version.ID, ToolName: toolName}).Error; err != nil {
				return err
			}
		}
		for _, knowledgeBaseID := range knowledgeBaseIDs {
			if err := tx.Create(&model.AIAppVersionKnowledgeBase{AppVersionID: version.ID, KnowledgeBaseID: knowledgeBaseID}).Error; err != nil {
				return err
			}
		}
		return tx.Model(&app).Update("draft_version_id", version.ID).Error
	}); err != nil {
		Error(c, 500, "创建应用失败")
		return
	}
	app.DraftVersionID = version.ID
	Success(c, gin.H{"app": app, "version": version})
}

func validateInitialAIAppTools(values []string) ([]string, error) {
	seen := make(map[string]struct{}, len(values))
	result := make([]string, 0, len(values))
	for _, value := range values {
		name := strings.TrimSpace(value)
		if name == "" {
			continue
		}
		if name != "content.search" {
			return nil, errors.New("首期仅允许绑定只读工具 content.search")
		}
		if _, exists := seen[name]; exists {
			continue
		}
		seen[name] = struct{}{}
		result = append(result, name)
	}
	return result, nil
}

func validateInitialAIAppKnowledgeBases(db *gorm.DB, userID model.Int64String, values []model.Int64String) ([]model.Int64String, error) {
	seen := make(map[model.Int64String]struct{}, len(values))
	ids := make([]model.Int64String, 0, len(values))
	for _, value := range values {
		if value == 0 {
			continue
		}
		if _, exists := seen[value]; exists {
			continue
		}
		seen[value] = struct{}{}
		ids = append(ids, value)
	}
	if len(ids) == 0 {
		return ids, nil
	}
	var count int64
	if err := db.Model(&model.AIKnowledgeBase{}).Where("user_id = ? AND id IN ?", userID, ids).Count(&count).Error; err != nil {
		return nil, errors.New("校验知识库失败")
	}
	if count != int64(len(ids)) {
		return nil, errors.New("知识库不存在或无权访问")
	}
	return ids, nil
}

func GetAIApp(c *gin.Context) {
	userID, ok := currentAIAppUser(c)
	if !ok {
		return
	}
	app, found := findAIApp(c, userID)
	if !found {
		return
	}
	var versions []model.AIAppVersion
	_ = database.GetDB().Where("app_id = ?", app.ID).Order("number DESC").Find(&versions).Error
	Success(c, gin.H{"app": app, "versions": versions})
}

func SaveAIAppVersion(c *gin.Context) {
	userID, ok := currentAIAppUser(c)
	if !ok {
		return
	}
	app, found := findAIApp(c, userID)
	if !found {
		return
	}
	var payload aiAppPayload
	if err := c.ShouldBindJSON(&payload); err != nil || !json.Valid(payload.Config) {
		Error(c, 400, "版本配置必须为 JSON")
		return
	}
	configValue := payload.Config
	if app.Type == aiAppTypeAgent {
		config, err := aiapp.Parse(string(payload.Config))
		if err != nil {
			Error(c, http.StatusBadRequest, err.Error())
			return
		}
		configValue, err = aiapp.Marshal(config)
		if err != nil {
			Error(c, http.StatusBadRequest, "智能体配置无效")
			return
		}
	}
	var version model.AIAppVersion
	if err := database.GetDB().Transaction(func(tx *gorm.DB) error {
		var source model.AIAppVersion
		if app.DraftVersionID != 0 {
			if err := tx.Where("id = ? AND app_id = ?", app.DraftVersionID, app.ID).First(&source).Error; err != nil {
				return err
			}
		}
		retrievalConfig, err := parseAIAppRetrievalConfig(source.RetrievalConfig)
		if err != nil {
			return err
		}
		var createErr error
		version, createErr = createAIAppVersionSnapshot(tx, app, string(configValue), retrievalConfig, source)
		if createErr != nil {
			return createErr
		}
		updates := map[string]any{"draft_version_id": version.ID}
		if strings.TrimSpace(payload.Name) != "" {
			updates["name"] = strings.TrimSpace(payload.Name)
		}
		if payload.Description != "" {
			updates["description"] = strings.TrimSpace(payload.Description)
		}
		return tx.Model(&app).Updates(updates).Error
	}); err != nil {
		Error(c, 500, "保存版本失败")
		return
	}
	Success(c, gin.H{"version": version})
}

// RestoreAIAppVersion copies a historical immutable snapshot into a new draft.
// It deliberately does not alter the published pointer: restoring is reviewable
// and must be followed by an explicit publish action.
func RestoreAIAppVersion(c *gin.Context) {
	userID, ok := currentAIAppUser(c)
	if !ok {
		return
	}
	app, found := findAIApp(c, userID)
	if !found {
		return
	}
	var payload struct {
		VersionID model.Int64String `json:"versionId"`
	}
	if c.ShouldBindJSON(&payload) != nil || payload.VersionID == 0 {
		Error(c, http.StatusBadRequest, "请选择要恢复的历史版本")
		return
	}
	var source model.AIAppVersion
	if err := database.GetDB().Where("id = ? AND app_id = ?", payload.VersionID, app.ID).First(&source).Error; err != nil {
		Error(c, http.StatusNotFound, "历史版本不存在")
		return
	}
	var restored model.AIAppVersion
	if err := database.GetDB().Transaction(func(tx *gorm.DB) error {
		retrievalConfig, err := parseAIAppRetrievalConfig(source.RetrievalConfig)
		if err != nil {
			return err
		}
		var createErr error
		restored, createErr = createAIAppVersionSnapshot(tx, app, source.Config, retrievalConfig, source)
		if createErr != nil {
			return createErr
		}
		return tx.Model(&app).Update("draft_version_id", restored.ID).Error
	}); err != nil {
		Error(c, http.StatusInternalServerError, "恢复历史版本失败")
		return
	}
	Success(c, gin.H{"version": restored, "restoredFromVersionId": source.ID})
}

func PublishAIApp(c *gin.Context) {
	userID, ok := currentAIAppUser(c)
	if !ok {
		return
	}
	app, found := findAIApp(c, userID)
	if !found {
		return
	}
	var payload struct {
		VersionID model.Int64String `json:"versionId"`
	}
	_ = c.ShouldBindJSON(&payload)
	versionID := payload.VersionID
	if versionID == 0 {
		versionID = app.DraftVersionID
	}
	var version model.AIAppVersion
	if versionID == 0 || database.GetDB().Where("id = ? AND app_id = ?", versionID, app.ID).First(&version).Error != nil {
		Error(c, 400, "待发布版本不存在")
		return
	}
	if err := database.GetDB().Transaction(func(tx *gorm.DB) error {
		now := time.Now()
		if err := tx.Model(&model.AIAppVersion{}).Where("id = ? AND app_id = ?", version.ID, app.ID).Update("published_at", now).Error; err != nil {
			return err
		}
		return tx.Model(&app).Updates(map[string]any{"published_version_id": version.ID, "status": "published"}).Error
	}); err != nil {
		Error(c, 500, "发布应用失败")
		return
	}
	Success(c, gin.H{"appId": app.ID, "publishedVersionId": version.ID})
}

// DebugAIApp executes the current draft version privately with only the
// owner's explicitly bound, ready knowledge-base segments as RAG context.
func DebugAIApp(c *gin.Context) {
	started := time.Now()
	userID, ok := currentAIAppUser(c)
	if !ok {
		return
	}
	app, found := findAIApp(c, userID)
	if !found {
		return
	}
	if app.Type != aiAppTypeAgent {
		Error(c, 400, "当前仅支持调试智能体应用")
		return
	}
	var payload struct {
		Message string `json:"message"`
		ModelID string `json:"modelId"`
		Stream  bool   `json:"stream"`
	}
	if c.ShouldBindJSON(&payload) != nil || strings.TrimSpace(payload.Message) == "" || strings.TrimSpace(payload.ModelID) == "" {
		Error(c, 400, "请输入调试消息并选择文本模型")
		return
	}
	message := truncateAIAgentRunes(payload.Message, 12000)
	var version model.AIAppVersion
	if app.DraftVersionID == 0 || database.GetDB().Where("id = ? AND app_id = ?", app.DraftVersionID, app.ID).First(&version).Error != nil {
		Error(c, 400, "草稿版本不存在")
		return
	}
	config, configParseErr := aiapp.Parse(version.Config)
	if configParseErr != nil {
		Error(c, 400, "智能体版本配置无效")
		return
	}
	invocation, err := aimodel.ResolveInvocation(database.GetDB(), payload.ModelID, "text", 60*time.Second)
	if err != nil {
		persistAIAppRun(app, version, userID, "failed", payload.ModelID, message, "", "MODEL_NOT_CONFIGURED", started)
		respondCatalogModelError(c, err)
		return
	}
	knowledgeContext, references, retrievalErr := retrieveAIKnowledgeContext(c.Request.Context(), userID, version, message)
	if retrievalErr != nil {
		code, publicMessage := aiKnowledgeRetrievalFailure(retrievalErr)
		logAIKnowledgeRetrievalFailure(c, retrievalErr, logrus.Fields{"app_id": app.ID, "version_id": version.ID, "feature": "ai-workbench-debug"})
		persistAIAppRun(app, version, userID, "failed", invocation.Model.ModelID, message, "", code, started)
		Error(c, http.StatusServiceUnavailable, publicMessage)
		return
	}
	system := strings.TrimSpace(config.SystemPrompt)
	if knowledgeContext != "" {
		system = strings.TrimSpace(system + "\n\n以下是与当前问题相关的私有参考资料。请优先依据这些资料回答；资料不足时明确说明。\n" + knowledgeContext)
	}
	registry, toolNames, toolErr := resolveAIAppTools(database.GetDB(), app.ID, version)
	if toolErr != nil {
		persistAIAppRun(app, version, userID, "failed", invocation.Model.ModelID, message, "", "AI_TOOL_REGISTRY_UNAVAILABLE", started)
		Error(c, http.StatusInternalServerError, "加载智能体工具失败")
		return
	}
	if !aimodel.HasCapabilities(invocation.Model, []string{"tool_call"}) {
		toolNames = nil
	}
	system = appendContentSearchDateContext(system, toolNames, time.Now())
	debugAIAppWithTools(c, payload.Stream, invocation, system, message, app, version, userID, registry, toolNames, references, started)
}

func debugAIAppWithTools(c *gin.Context, stream bool, invocation aimodel.Invocation, system, message string, app model.AIApp, version model.AIAppVersion, userID model.Int64String, registry *tools.Registry, toolNames []string, references []aiKnowledgeReference, started time.Time) {
	modelID := invocation.Model.ModelID
	loop := agent.NewLocalLoop(agent.NewCompatibleBackend(invocation.Client), registry)
	spec := agent.Spec{Provider: invocation.Provider.Provider, Model: modelID, System: system, Tools: toolNames, MaxSteps: 6, MaxTokens: 1200, Feature: "ai-workbench"}
	ctx := content.WithOwner(c.Request.Context(), userID)
	if !stream {
		result, err := loop.Run(ctx, spec, []agent.Message{{Role: agent.RoleUser, Content: message}})
		if err != nil {
			persistAIAppRun(app, version, userID, "failed", modelID, message, result.Reply, "AI_AGENT_RUN_FAILED", started)
			Error(c, http.StatusBadGateway, "智能体工具调用失败")
			return
		}
		if result.Model == "" {
			result.Model = modelID
		}
		run := persistAIAppRunWithReferences(app, version, userID, "succeeded", result.Model, message, result.Reply, "", references, started)
		Success(c, gin.H{"run": run, "reply": result.Reply, "model": result.Model, "versionId": version.ID, "references": references})
		return
	}
	events, err := loop.RunStream(ctx, spec, []agent.Message{{Role: agent.RoleUser, Content: message}})
	if err != nil {
		persistAIAppRun(app, version, userID, "failed", modelID, message, "", "AI_AGENT_RUN_FAILED", started)
		Error(c, http.StatusBadGateway, "智能体工具调用失败")
		return
	}
	writer, err := aiclient.NewSSEWriter(c)
	if err != nil {
		return
	}
	var reply strings.Builder
	var result agent.Result
	var loopErr error
	for event := range events {
		switch event.Type {
		case agent.EventDelta:
			reply.WriteString(event.Delta)
			_ = writer.Send(gin.H{"type": "delta", "chunk": event.Delta})
		case agent.EventToolCall:
			_ = writer.Send(gin.H{"type": "tool_call", "toolName": event.ToolName})
		case agent.EventToolResult:
			_ = writer.Send(gin.H{"type": "tool_result", "toolName": event.ToolName, "ok": !strings.Contains(string(event.ToolResult), `"ok":false`)})
		case agent.EventDone:
			if event.Result != nil {
				result = *event.Result
			}
		case agent.EventError:
			loopErr = event.Err
		}
	}
	if result.Reply == "" {
		result.Reply = reply.String()
	}
	if loopErr != nil {
		run := persistAIAppRun(app, version, userID, "failed", modelID, message, result.Reply, "AI_AGENT_RUN_FAILED", started)
		_ = writer.Send(gin.H{"type": "error", "message": "智能体工具调用失败", "run": run})
		return
	}
	if result.Model == "" {
		result.Model = modelID
	}
	run := persistAIAppRunWithReferences(app, version, userID, "succeeded", result.Model, message, result.Reply, "", references, started)
	_ = writer.Send(gin.H{"type": "done", "run": run, "reply": result.Reply, "references": references})
}

func retrieveAIKnowledgeContext(ctx context.Context, userID model.Int64String, version model.AIAppVersion, message string) (string, []aiKnowledgeReference, error) {
	db := database.GetDB()
	if db == nil {
		return "", nil, nil
	}
	config, err := parseAIAppRetrievalConfig(version.RetrievalConfig)
	if err != nil {
		return "", nil, err
	}
	knowledgeBaseIDs := make([]model.Int64String, 0)
	if version.KnowledgeBaseSnapshot {
		var bindings []model.AIAppVersionKnowledgeBase
		if err := db.Where("app_version_id = ?", version.ID).Find(&bindings).Error; err != nil {
			return "", nil, err
		}
		for _, binding := range bindings {
			knowledgeBaseIDs = append(knowledgeBaseIDs, binding.KnowledgeBaseID)
		}
	} else {
		var bindings []model.AIAppKnowledgeBase
		if err := db.Where("app_id = ?", version.AppID).Find(&bindings).Error; err != nil {
			return "", nil, err
		}
		for _, binding := range bindings {
			knowledgeBaseIDs = append(knowledgeBaseIDs, binding.KnowledgeBaseID)
		}
	}
	if len(knowledgeBaseIDs) == 0 {
		return "", nil, nil
	}
	rows, err := searchAIKnowledgeChunks(ctx, userID, knowledgeBaseIDs, config, message)
	if err != nil {
		return "", nil, err
	}
	var contextBuilder strings.Builder
	references := make([]aiKnowledgeReference, 0, len(rows))
	const maxKnowledgeContextRunes = 4500
	for _, row := range rows {
		content := aiclient.TrimRunes(strings.TrimSpace(row.Content), 1600)
		if content == "" || len([]rune(contextBuilder.String()))+len([]rune(content)) > maxKnowledgeContextRunes {
			continue
		}
		contextBuilder.WriteString("[资料：")
		contextBuilder.WriteString(row.DocumentName)
		contextBuilder.WriteString("]\n")
		contextBuilder.WriteString(content)
		contextBuilder.WriteString("\n\n")
		if config.CiteSources {
			references = append(references, aiKnowledgeReference{DocumentName: row.DocumentName, ChunkID: row.ChunkID, Excerpt: aiclient.TrimRunes(content, 240)})
		}
	}
	return strings.TrimSpace(contextBuilder.String()), references, nil
}

func searchAIKnowledgeChunks(ctx context.Context, userID model.Int64String, knowledgeBaseIDs []model.Int64String, config aiAppRetrievalConfig, query string) ([]aiKnowledgeSearchRow, error) {
	db := database.GetDB()
	if db == nil || db.Dialector.Name() != "postgres" {
		return nil, errors.New("RAG requires PostgreSQL")
	}
	if !hasPGVectorExtension(db) {
		return nil, errors.New("pgvector extension is not installed")
	}
	var readyDocumentCount int64
	if err := db.Model(&model.AIKnowledgeDocument{}).
		Where("user_id = ? AND knowledge_base_id IN ? AND status = ?", userID, knowledgeBaseIDs, "ready").
		Count(&readyDocumentCount).Error; err != nil {
		return nil, err
	}
	if readyDocumentCount == 0 {
		return []aiKnowledgeSearchRow{}, nil
	}
	queryVectors, err := aiclient.CreateARKEmbeddings(ctx, []string{query})
	if err != nil {
		return nil, err
	}
	queryVector, err := json.Marshal(queryVectors[0])
	if err != nil {
		return nil, err
	}
	var rows []aiKnowledgeSearchRow
	err = db.Raw(`
		SELECT chunks.id AS chunk_id, documents.name AS document_name, chunks.content,
		       1 - (chunks.embedding <=> ?::vector) AS score
		FROM ai_knowledge_chunks AS chunks
		JOIN ai_knowledge_documents AS documents ON documents.id = chunks.document_id
		JOIN ai_knowledge_bases AS knowledge_bases ON knowledge_bases.id = documents.knowledge_base_id
		WHERE chunks.user_id = ? AND documents.user_id = ? AND knowledge_bases.user_id = ?
		  AND documents.knowledge_base_id IN ? AND documents.status = 'ready'
		  AND chunks.embedding IS NOT NULL
		ORDER BY chunks.embedding <=> ?::vector
	LIMIT ?`, string(queryVector), userID, userID, userID, knowledgeBaseIDs, string(queryVector), config.TopK).Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	filtered := make([]aiKnowledgeSearchRow, 0, len(rows))
	for _, row := range rows {
		if row.Score >= config.MinScore && strings.TrimSpace(row.Content) != "" {
			filtered = append(filtered, row)
		}
	}
	return filtered, nil
}

func ListAIAppRuns(c *gin.Context) {
	userID, ok := currentAIAppUser(c)
	if !ok {
		return
	}
	app, found := findAIApp(c, userID)
	if !found {
		return
	}
	var runs []model.AIAppRun
	if err := database.GetDB().Where("app_id = ? AND user_id = ?", app.ID, userID).Order("created_at DESC").Limit(20).Find(&runs).Error; err != nil {
		Error(c, 500, "加载调试记录失败")
		return
	}
	Success(c, gin.H{"list": runs})
}

func persistAIAppRun(app model.AIApp, version model.AIAppVersion, userID model.Int64String, status, modelName, input, output, errorCode string, started time.Time) model.AIAppRun {
	return persistAIAppRunWithReferences(app, version, userID, status, modelName, input, output, errorCode, nil, started)
}

func persistAIAppRunWithReferences(app model.AIApp, version model.AIAppVersion, userID model.Int64String, status, modelName, input, output, errorCode string, references []aiKnowledgeReference, started time.Time) model.AIAppRun {
	referenceSummary, _ := json.Marshal(references)
	run := model.AIAppRun{AppID: app.ID, VersionID: version.ID, UserID: userID, Status: status, Model: modelName, Input: aiclient.TrimRunes(input, 1000), Output: aiclient.TrimRunes(output, 2000), ErrorCode: errorCode, References: string(referenceSummary), DurationMs: time.Since(started).Milliseconds()}
	_ = database.GetDB().Create(&run).Error
	return run
}

func ListAIAppTools(c *gin.Context) {
	if _, ok := currentAIAppUser(c); ok {
		Success(c, gin.H{"list": builtInAITools})
	}
}

func ListAIAppToolBindings(c *gin.Context) {
	userID, ok := currentAIAppUser(c)
	if !ok {
		return
	}
	app, found := findAIApp(c, userID)
	if !found {
		return
	}
	var version model.AIAppVersion
	if app.DraftVersionID == 0 || database.GetDB().Where("id = ? AND app_id = ?", app.DraftVersionID, app.ID).First(&version).Error != nil {
		Error(c, http.StatusNotFound, "草稿版本不存在")
		return
	}
	var bindings []model.AIAppVersionToolBinding
	if err := database.GetDB().Where("app_version_id = ?", version.ID).Order("tool_name ASC").Find(&bindings).Error; err != nil {
		Error(c, 500, "加载智能体工具失败")
		return
	}
	names := make([]string, 0, len(bindings))
	for _, binding := range bindings {
		names = append(names, binding.ToolName)
	}
	Success(c, gin.H{"tools": names})
}

func ListAIAppKnowledgeBases(c *gin.Context) {
	userID, ok := currentAIAppUser(c)
	if !ok {
		return
	}
	app, found := findAIApp(c, userID)
	if !found {
		return
	}
	if app.DraftVersionID == 0 {
		Success(c, gin.H{"list": []model.AIKnowledgeBase{}})
		return
	}
	var version model.AIAppVersion
	if err := database.GetDB().Where("id = ? AND app_id = ?", app.DraftVersionID, app.ID).First(&version).Error; err != nil {
		Error(c, http.StatusNotFound, "草稿版本不存在")
		return
	}
	var items []model.AIKnowledgeBase
	query := database.GetDB().Table("ai_knowledge_bases AS knowledge_bases").Select("knowledge_bases.*")
	if version.KnowledgeBaseSnapshot {
		query = query.Joins("JOIN ai_app_version_knowledge_bases bindings ON bindings.knowledge_base_id = knowledge_bases.id").
			Where("bindings.app_version_id = ? AND knowledge_bases.user_id = ?", version.ID, userID)
	} else {
		query = query.Joins("JOIN ai_app_knowledge_bases bindings ON bindings.knowledge_base_id = knowledge_bases.id").
			Where("bindings.app_id = ? AND knowledge_bases.user_id = ?", app.ID, userID)
	}
	if err := query.Order("knowledge_bases.updated_at DESC").Find(&items).Error; err != nil {
		Error(c, 500, "加载智能体知识库失败")
		return
	}
	Success(c, gin.H{"list": items})
}

func ReplaceAIAppKnowledgeBases(c *gin.Context) {
	userID, ok := currentAIAppUser(c)
	if !ok {
		return
	}
	app, found := findAIApp(c, userID)
	if !found {
		return
	}
	var payload struct {
		KnowledgeBaseIDs []model.Int64String `json:"knowledgeBaseIds"`
	}
	if c.ShouldBindJSON(&payload) != nil {
		Error(c, 400, "知识库参数错误")
		return
	}
	seen := make(map[model.Int64String]struct{}, len(payload.KnowledgeBaseIDs))
	ids := make([]model.Int64String, 0, len(payload.KnowledgeBaseIDs))
	for _, id := range payload.KnowledgeBaseIDs {
		if id > 0 {
			if _, exists := seen[id]; !exists {
				seen[id] = struct{}{}
				ids = append(ids, id)
			}
		}
	}
	if len(ids) > 0 {
		var count int64
		if err := database.GetDB().Model(&model.AIKnowledgeBase{}).Where("user_id = ? AND id IN ?", userID, ids).Count(&count).Error; err != nil {
			Error(c, 500, "校验知识库失败")
			return
		}
		if count != int64(len(ids)) {
			Error(c, 400, "包含无权访问的知识库")
			return
		}
	}
	var version model.AIAppVersion
	if err := database.GetDB().Transaction(func(tx *gorm.DB) error {
		var source model.AIAppVersion
		if app.DraftVersionID != 0 {
			if err := tx.Where("id = ? AND app_id = ?", app.DraftVersionID, app.ID).First(&source).Error; err != nil {
				return err
			}
		}
		retrievalConfig, err := parseAIAppRetrievalConfig(source.RetrievalConfig)
		if err != nil {
			return err
		}
		var createErr error
		version, createErr = createAIAppVersionSnapshot(tx, app, source.Config, retrievalConfig, model.AIAppVersion{})
		if createErr != nil {
			return createErr
		}
		if err := tx.Where("app_version_id = ?", version.ID).Delete(&model.AIAppVersionKnowledgeBase{}).Error; err != nil {
			return err
		}
		bindings := make([]model.AIAppVersionKnowledgeBase, 0, len(ids))
		for _, knowledgeBaseID := range ids {
			bindings = append(bindings, model.AIAppVersionKnowledgeBase{AppVersionID: version.ID, KnowledgeBaseID: knowledgeBaseID})
		}
		if len(bindings) > 0 {
			if err := tx.Create(&bindings).Error; err != nil {
				return err
			}
		}
		return tx.Model(&app).Update("draft_version_id", version.ID).Error
	}); err != nil {
		Error(c, 500, "保存智能体知识库失败")
		return
	}
	Success(c, gin.H{"knowledgeBaseIds": ids, "version": version})
}

func GetAIAppRetrievalConfig(c *gin.Context) {
	userID, ok := currentAIAppUser(c)
	if !ok {
		return
	}
	app, found := findAIApp(c, userID)
	if !found {
		return
	}
	config := defaultAIAppRetrievalConfig()
	if app.DraftVersionID != 0 {
		var version model.AIAppVersion
		if err := database.GetDB().Where("id = ? AND app_id = ?", app.DraftVersionID, app.ID).First(&version).Error; err != nil {
			Error(c, http.StatusNotFound, "草稿版本不存在")
			return
		}
		var err error
		config, err = parseAIAppRetrievalConfig(version.RetrievalConfig)
		if err != nil {
			Error(c, http.StatusBadGateway, "草稿检索配置无效")
			return
		}
	}
	Success(c, gin.H{"retrievalConfig": config})
}

func UpdateAIAppRetrievalConfig(c *gin.Context) {
	userID, ok := currentAIAppUser(c)
	if !ok {
		return
	}
	app, found := findAIApp(c, userID)
	if !found {
		return
	}
	var config aiAppRetrievalConfig
	if c.ShouldBindJSON(&config) != nil || config.TopK < 1 || config.TopK > 8 || config.MinScore < 0.20 || config.MinScore > 0.80 {
		Error(c, http.StatusBadRequest, "检索配置无效")
		return
	}
	var version model.AIAppVersion
	if err := database.GetDB().Transaction(func(tx *gorm.DB) error {
		var source model.AIAppVersion
		if app.DraftVersionID == 0 {
			return gorm.ErrRecordNotFound
		}
		if err := tx.Where("id = ? AND app_id = ?", app.DraftVersionID, app.ID).First(&source).Error; err != nil {
			return err
		}
		var createErr error
		version, createErr = createAIAppVersionSnapshot(tx, app, source.Config, config, source)
		if createErr != nil {
			return createErr
		}
		return tx.Model(&app).Update("draft_version_id", version.ID).Error
	}); err != nil {
		Error(c, http.StatusInternalServerError, "保存检索配置失败")
		return
	}
	Success(c, gin.H{"retrievalConfig": config, "version": version})
}

func ReplaceAIAppTools(c *gin.Context) {
	userID, ok := currentAIAppUser(c)
	if !ok {
		return
	}
	app, found := findAIApp(c, userID)
	if !found {
		return
	}
	var payload struct {
		Tools []string `json:"tools"`
	}
	if c.ShouldBindJSON(&payload) != nil {
		Error(c, 400, "工具参数错误")
		return
	}
	allowed := map[string]bool{"content.search": true}
	seen := map[string]bool{}
	bindings := make([]model.AIAppVersionToolBinding, 0, len(payload.Tools))
	for _, name := range payload.Tools {
		name = strings.TrimSpace(name)
		if !allowed[name] {
			Error(c, 400, "包含未审核的工具")
			return
		}
		if !seen[name] {
			seen[name] = true
			bindings = append(bindings, model.AIAppVersionToolBinding{ToolName: name})
		}
	}
	var version model.AIAppVersion
	if err := database.GetDB().Transaction(func(tx *gorm.DB) error {
		var source model.AIAppVersion
		if app.DraftVersionID == 0 || tx.Where("id = ? AND app_id = ?", app.DraftVersionID, app.ID).First(&source).Error != nil {
			return gorm.ErrRecordNotFound
		}
		retrievalConfig, err := parseAIAppRetrievalConfig(source.RetrievalConfig)
		if err != nil {
			return err
		}
		var createErr error
		version, createErr = createAIAppVersionSnapshot(tx, app, source.Config, retrievalConfig, source)
		if createErr != nil {
			return createErr
		}
		if err := tx.Where("app_version_id = ?", version.ID).Delete(&model.AIAppVersionToolBinding{}).Error; err != nil {
			return err
		}
		for index := range bindings {
			bindings[index].AppVersionID = version.ID
		}
		if len(bindings) > 0 {
			if err := tx.Create(&bindings).Error; err != nil {
				return err
			}
		}
		return tx.Model(&app).Update("draft_version_id", version.ID).Error
	}); err != nil {
		Error(c, 500, "保存工具绑定失败")
		return
	}
	Success(c, gin.H{"tools": payload.Tools, "version": version})
}

func ListAIKnowledgeBases(c *gin.Context) {
	userID, ok := currentAIAppUser(c)
	if !ok {
		return
	}
	var items []model.AIKnowledgeBase
	if err := database.GetDB().Where("user_id = ?", userID).Order("updated_at DESC").Find(&items).Error; err != nil {
		Error(c, 500, "加载知识库失败")
		return
	}
	counts := make([]struct {
		KnowledgeBaseID model.Int64String `gorm:"column:knowledge_base_id"`
		DocumentCount   int               `gorm:"column:document_count"`
	}, 0)
	if len(items) > 0 {
		baseIDs := make([]model.Int64String, 0, len(items))
		for _, item := range items {
			baseIDs = append(baseIDs, item.ID)
		}
		if err := database.GetDB().Model(&model.AIKnowledgeDocument{}).
			Select("knowledge_base_id, COUNT(*) AS document_count").
			Where("user_id = ? AND knowledge_base_id IN ?", userID, baseIDs).
			Group("knowledge_base_id").
			Scan(&counts).Error; err != nil {
			Error(c, 500, "加载知识库文档数量失败")
			return
		}
	}
	countByBaseID := make(map[model.Int64String]int, len(counts))
	for _, count := range counts {
		countByBaseID[count.KnowledgeBaseID] = count.DocumentCount
	}
	list := make([]aiKnowledgeBaseResponse, 0, len(items))
	for _, item := range items {
		list = append(list, aiKnowledgeBaseResponse{
			AIKnowledgeBase: item,
			DocumentCount:   countByBaseID[item.ID],
		})
	}
	Success(c, gin.H{"list": list})
}
func CreateAIKnowledgeBase(c *gin.Context) {
	userID, ok := currentAIAppUser(c)
	if !ok {
		return
	}
	var input model.AIKnowledgeBase
	if c.ShouldBindJSON(&input) != nil || strings.TrimSpace(input.Name) == "" {
		Error(c, 400, "知识库名称不能为空")
		return
	}
	input.UserID = userID
	if database.GetDB().Create(&input).Error != nil {
		Error(c, 500, "创建知识库失败")
		return
	}
	Success(c, input)
}

func UpdateAIKnowledgeBase(c *gin.Context) {
	userID, ok := currentAIAppUser(c)
	if !ok {
		return
	}
	id, err := parsePathInt64(c, "knowledgeBaseId")
	if err != nil {
		Error(c, 400, "无效的知识库 ID")
		return
	}
	var input struct {
		Name        string `json:"name"`
		Description string `json:"description"`
	}
	if c.ShouldBindJSON(&input) != nil || strings.TrimSpace(input.Name) == "" {
		Error(c, 400, "知识库名称不能为空")
		return
	}
	result := database.GetDB().Model(&model.AIKnowledgeBase{}).Where("id = ? AND user_id = ?", id, userID).Updates(map[string]any{"name": strings.TrimSpace(input.Name), "description": strings.TrimSpace(input.Description)})
	if result.Error != nil {
		Error(c, 500, "更新知识库失败")
		return
	}
	if result.RowsAffected == 0 {
		Error(c, 404, "知识库不存在")
		return
	}
	Success(c, nil)
}

func DeleteAIKnowledgeBase(c *gin.Context) {
	userID, ok := currentAIAppUser(c)
	if !ok {
		return
	}
	id, err := parsePathInt64(c, "knowledgeBaseId")
	if err != nil {
		Error(c, 400, "无效的知识库 ID")
		return
	}
	var base model.AIKnowledgeBase
	if database.GetDB().Where("id = ? AND user_id = ?", id, userID).First(&base).Error != nil {
		Error(c, 404, "知识库不存在")
		return
	}
	if err := database.GetDB().Transaction(func(tx *gorm.DB) error {
		var documentIDs []model.Int64String
		if err := tx.Model(&model.AIKnowledgeDocument{}).Where("knowledge_base_id = ? AND user_id = ?", id, userID).Pluck("id", &documentIDs).Error; err != nil {
			return err
		}
		if len(documentIDs) > 0 {
			if err := tx.Where("document_id IN ?", documentIDs).Delete(&model.AIKnowledgeChunk{}).Error; err != nil {
				return err
			}
			if err := tx.Where("id IN ?", documentIDs).Delete(&model.AIKnowledgeDocument{}).Error; err != nil {
				return err
			}
		}
		return tx.Where("id = ? AND user_id = ?", id, userID).Delete(&model.AIKnowledgeBase{}).Error
	}); err != nil {
		Error(c, 500, "删除知识库失败")
		return
	}
	Success(c, nil)
}

func ListAIKnowledgeDocuments(c *gin.Context) {
	userID, ok := currentAIAppUser(c)
	if !ok {
		return
	}
	id, err := parsePathInt64(c, "knowledgeBaseId")
	if err != nil {
		Error(c, 400, "无效的知识库 ID")
		return
	}
	var base model.AIKnowledgeBase
	if database.GetDB().Where("id = ? AND user_id = ?", id, userID).First(&base).Error != nil {
		Error(c, 404, "知识库不存在")
		return
	}
	var documents []model.AIKnowledgeDocument
	if err := database.GetDB().Where("knowledge_base_id = ? AND user_id = ?", id, userID).Order("created_at DESC").Find(&documents).Error; err != nil {
		Error(c, 500, "加载知识库文档失败")
		return
	}
	items := make([]aiKnowledgeDocumentResponse, 0, len(documents))
	for _, document := range documents {
		items = append(items, presentAIKnowledgeDocument(document))
	}
	Success(c, gin.H{"list": items})
}

func ListAIKnowledgeDocumentChunks(c *gin.Context) {
	userID, ok := currentAIAppUser(c)
	if !ok {
		return
	}
	knowledgeBaseID, err := parsePathInt64(c, "knowledgeBaseId")
	if err != nil {
		Error(c, 400, "无效的知识库 ID")
		return
	}
	documentID, err := parsePathInt64(c, "documentId")
	if err != nil {
		Error(c, 400, "无效的文档 ID")
		return
	}
	var document model.AIKnowledgeDocument
	if err := database.GetDB().Where("id = ? AND knowledge_base_id = ? AND user_id = ?", documentID, knowledgeBaseID, userID).First(&document).Error; err != nil {
		Error(c, 404, "知识库文档不存在")
		return
	}
	var chunks []model.AIKnowledgeChunk
	if err := database.GetDB().Where("document_id = ? AND user_id = ?", document.ID, userID).Order("position ASC").Find(&chunks).Error; err != nil {
		Error(c, 500, "加载文档片段失败")
		return
	}
	previews := make([]aiKnowledgeChunkPreview, 0, len(chunks))
	for _, chunk := range chunks {
		previews = append(previews, aiKnowledgeChunkPreview{
			ID:         chunk.ID,
			Position:   chunk.Position,
			Content:    aiclient.TrimRunes(strings.TrimSpace(chunk.Content), 800),
			TokenCount: chunk.TokenCount,
			PageNumber: chunk.PageNumber,
			SourceType: chunk.SourceType,
		})
	}
	Success(c, gin.H{"document": presentAIKnowledgeDocument(document), "list": previews})
}

func TestAIKnowledgeRetrieval(c *gin.Context) {
	userID, ok := currentAIAppUser(c)
	if !ok {
		return
	}
	knowledgeBaseID, err := parsePathInt64(c, "knowledgeBaseId")
	if err != nil {
		Error(c, 400, "无效的知识库 ID")
		return
	}
	var base model.AIKnowledgeBase
	if err := database.GetDB().Where("id = ? AND user_id = ?", knowledgeBaseID, userID).First(&base).Error; err != nil {
		Error(c, 404, "知识库不存在")
		return
	}
	var payload aiKnowledgeRetrievalTestRequest
	if err := c.ShouldBindJSON(&payload); err != nil {
		Error(c, 400, "检索内容格式无效")
		return
	}
	query := aiclient.TrimRunes(strings.TrimSpace(payload.Query), 1000)
	if query == "" {
		Error(c, 400, "请输入检索内容")
		return
	}

	rows, err := searchAIKnowledgeChunks(c.Request.Context(), userID, []model.Int64String{base.ID}, defaultAIAppRetrievalConfig(), query)
	if err != nil {
		_, publicMessage := aiKnowledgeRetrievalFailure(err)
		logAIKnowledgeRetrievalFailure(c, err, logrus.Fields{"knowledge_base_id": base.ID, "feature": "ai-knowledge-retrieval-test"})
		Error(c, http.StatusServiceUnavailable, publicMessage)
		return
	}
	results := make([]aiKnowledgeRetrievalTestResult, 0, len(rows))
	for _, row := range rows {
		results = append(results, aiKnowledgeRetrievalTestResult{
			DocumentName: row.DocumentName,
			ChunkID:      row.ChunkID,
			Excerpt:      aiclient.TrimRunes(strings.TrimSpace(row.Content), 360),
			Score:        row.Score,
		})
	}
	Success(c, gin.H{"list": results})
}

const (
	knowledgeDocumentMaxBytes = 2 * 1024 * 1024
	knowledgeChunkMaxCount    = 200
	knowledgeChunkSize        = 1000
	knowledgeChunkOverlap     = 150
	knowledgeEmbeddingTimeout = 60 * time.Second
)

var scheduleAIKnowledgeDocumentIndexing = func(documentID model.Int64String) {
	go indexAIKnowledgeDocument(documentID)
}

func resolveAIAppTools(db *gorm.DB, appID model.Int64String, version model.AIAppVersion) (*tools.Registry, []string, error) {
	registry := tools.NewRegistry()
	if db == nil {
		return registry, nil, errors.New("AI_TOOL_REGISTRY_UNAVAILABLE")
	}
	var bindings []model.AIAppVersionToolBinding
	if version.ToolSnapshot {
		if err := db.Where("app_version_id = ?", version.ID).Order("tool_name ASC").Find(&bindings).Error; err != nil {
			return registry, nil, err
		}
	} else {
		var legacyBindings []model.AIAppToolBinding
		if err := db.Where("app_id = ?", appID).Order("tool_name ASC").Find(&legacyBindings).Error; err != nil {
			return registry, nil, err
		}
		for _, binding := range legacyBindings {
			bindings = append(bindings, model.AIAppVersionToolBinding{ToolName: binding.ToolName})
		}
	}
	allowed := make([]string, 0, len(bindings))
	for _, binding := range bindings {
		switch binding.ToolName {
		case "content.search":
			if registry.Get(binding.ToolName) == nil {
				registry.MustRegister(content.NewSearchTool(db))
			}
			allowed = append(allowed, binding.ToolName)
		}
	}
	return registry, allowed, nil
}

func extractAIKnowledgeDocumentText(ext string, content []byte) (string, error) {
	if ext != ".pdf" {
		return strings.TrimSpace(string(content)), nil
	}

	reader, err := pdf.NewReader(bytes.NewReader(content), int64(len(content)))
	if err != nil {
		return "", err
	}
	plainText, err := reader.GetPlainText()
	if err != nil {
		return "", err
	}
	text, err := io.ReadAll(plainText)
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(string(text)), nil
}

func UploadAIKnowledgeDocument(c *gin.Context) {
	userID, ok := currentAIAppUser(c)
	if !ok {
		return
	}
	id, err := parsePathInt64(c, "knowledgeBaseId")
	if err != nil {
		Error(c, 400, "无效的知识库 ID")
		return
	}
	var base model.AIKnowledgeBase
	if database.GetDB().Where("id = ? AND user_id = ?", id, userID).First(&base).Error != nil {
		Error(c, 404, "知识库不存在")
		return
	}
	file, err := c.FormFile("file")
	if err != nil {
		Error(c, 400, "请上传文档")
		return
	}
	if file.Size <= 0 || file.Size > knowledgeDocumentMaxBytes {
		Error(c, 400, "文档大小需在 1B 到 2MB 之间")
		return
	}
	ext := strings.ToLower(filepath.Ext(file.Filename))
	if ext != ".md" && ext != ".markdown" && ext != ".txt" && ext != ".pdf" {
		Error(c, 400, "当前仅支持 Markdown、TXT 或 PDF 文档")
		return
	}
	src, err := file.Open()
	if err != nil {
		Error(c, 400, "读取文档失败")
		return
	}
	defer src.Close()
	content, err := io.ReadAll(io.LimitReader(src, knowledgeDocumentMaxBytes+1))
	if err != nil || len(content) == 0 || len(content) > knowledgeDocumentMaxBytes {
		Error(c, 400, "读取文档失败")
		return
	}
	visionModelID := strings.TrimSpace(c.PostForm("visionModelId"))
	if ext != ".pdf" && visionModelID != "" {
		Error(c, 400, "仅 PDF 文档支持视觉解析模型")
		return
	}
	if visionModelID != "" {
		if _, err := aimodel.ResolveInvocation(database.GetDB(), visionModelID, "vision", knowledgePDFVisionTimeout); err != nil {
			respondCatalogModelError(c, err)
			return
		}
	}
	text, parseErr := extractAIKnowledgeDocumentText(ext, content)
	if ext == ".pdf" && visionModelID != "" {
		document := model.AIKnowledgeDocument{
			KnowledgeBaseID: model.Int64String(id),
			UserID:          userID,
			Name:            file.Filename,
			Status:          "pending_parse",
			MimeType:        file.Header.Get("Content-Type"),
			SizeBytes:       file.Size,
			ParsedText:      text,
			VisionModelID:   visionModelID,
			SourceContent:   content,
		}
		if err := database.GetDB().Create(&document).Error; err != nil {
			Error(c, 500, "保存知识库文档失败")
			return
		}
		scheduleAIKnowledgeDocumentIndexing(document.ID)
		Success(c, gin.H{"document": presentAIKnowledgeDocument(document)})
		return
	}
	if parseErr != nil || text == "" {
		if ext == ".pdf" {
			document := model.AIKnowledgeDocument{
				KnowledgeBaseID: model.Int64String(id),
				UserID:          userID,
				Name:            file.Filename,
				Status:          "failed",
				ErrorCode:       "DOCUMENT_PARSE_FAILED",
				MimeType:        file.Header.Get("Content-Type"),
				SizeBytes:       file.Size,
			}
			if err := database.GetDB().Create(&document).Error; err != nil {
				Error(c, 500, "保存知识库文档失败")
				return
			}
			Success(c, gin.H{"document": presentAIKnowledgeDocument(document)})
			return
		}
		Error(c, 400, "文档没有可解析文本")
		return
	}
	chunks := splitKnowledgeText(text)
	if len(chunks) == 0 || len(chunks) > knowledgeChunkMaxCount {
		Error(c, 400, "文档分段数量超出限制")
		return
	}
	document := model.AIKnowledgeDocument{
		KnowledgeBaseID: model.Int64String(id),
		UserID:          userID,
		Name:            file.Filename,
		Status:          "pending_embedding",
		ChunkCount:      len(chunks),
		MimeType:        file.Header.Get("Content-Type"),
		SizeBytes:       file.Size,
		ParsedText:      text,
	}
	if err := database.GetDB().Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&document).Error; err != nil {
			return err
		}
		rows := make([]model.AIKnowledgeChunk, 0, len(chunks))
		for position, value := range chunks {
			rows = append(rows, model.AIKnowledgeChunk{
				DocumentID: document.ID,
				UserID:     userID,
				Position:   position,
				Content:    value,
				TokenCount: len([]rune(value)),
			})
		}
		return tx.Create(&rows).Error
	}); err != nil {
		Error(c, 500, "保存知识库文档失败")
		return
	}
	scheduleAIKnowledgeDocumentIndexing(document.ID)
	Success(c, gin.H{"document": presentAIKnowledgeDocument(document)})
}

func RetryAIKnowledgeDocument(c *gin.Context) {
	userID, ok := currentAIAppUser(c)
	if !ok {
		return
	}
	knowledgeBaseID, err := parsePathInt64(c, "knowledgeBaseId")
	if err != nil {
		Error(c, 400, "无效的知识库 ID")
		return
	}
	documentID, err := parsePathInt64(c, "documentId")
	if err != nil {
		Error(c, 400, "无效的文档 ID")
		return
	}
	var document model.AIKnowledgeDocument
	if database.GetDB().Where("id = ? AND knowledge_base_id = ? AND user_id = ?", documentID, knowledgeBaseID, userID).First(&document).Error != nil {
		Error(c, 404, "知识库文档不存在")
		return
	}
	if document.Status == "indexing" {
		Error(c, 409, "文档正在索引")
		return
	}
	status := "pending_embedding"
	if len(document.SourceContent) > 0 && document.ChunkCount == 0 {
		status = "pending_parse"
	}
	if err := database.GetDB().Model(&document).Updates(map[string]any{"status": status, "error_code": "", "index_progress": 0}).Error; err != nil {
		Error(c, 500, "重试文档索引失败")
		return
	}
	document.Status = status
	document.ErrorCode = ""
	document.IndexProgress = 0
	scheduleAIKnowledgeDocumentIndexing(document.ID)
	Success(c, gin.H{"document": presentAIKnowledgeDocument(document)})
}

func DeleteAIKnowledgeDocument(c *gin.Context) {
	userID, ok := currentAIAppUser(c)
	if !ok {
		return
	}
	knowledgeBaseID, err := parsePathInt64(c, "knowledgeBaseId")
	if err != nil {
		Error(c, 400, "无效的知识库 ID")
		return
	}
	documentID, err := parsePathInt64(c, "documentId")
	if err != nil {
		Error(c, 400, "无效的文档 ID")
		return
	}
	if err := database.GetDB().Transaction(func(tx *gorm.DB) error {
		var document model.AIKnowledgeDocument
		if err := tx.Where("id = ? AND knowledge_base_id = ? AND user_id = ?", documentID, knowledgeBaseID, userID).First(&document).Error; err != nil {
			return err
		}
		if err := tx.Where("document_id = ? AND user_id = ?", document.ID, userID).Delete(&model.AIKnowledgeChunk{}).Error; err != nil {
			return err
		}
		return tx.Delete(&document).Error
	}); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			Error(c, 404, "知识库文档不存在")
			return
		}
		Error(c, 500, "删除知识库文档失败")
		return
	}
	Success(c, nil)
}

func indexAIKnowledgeDocument(documentID model.Int64String) {
	db := database.GetDB()
	if db == nil {
		return
	}
	if db.Dialector.Name() != "postgres" {
		markAIKnowledgeDocumentFailed(documentID, "RAG_POSTGRES_REQUIRED")
		return
	}
	if !hasPGVectorExtension(db) {
		markAIKnowledgeDocumentFailed(documentID, "PGVECTOR_NOT_INSTALLED")
		return
	}
	if _, errMsg := aiclient.ReadARKEmbeddingConfig(); errMsg != "" {
		markAIKnowledgeDocumentFailed(documentID, knowledgeEmbeddingErrorCode(errMsg))
		return
	}
	if err := db.Model(&model.AIKnowledgeDocument{}).Where("id = ?", documentID).Updates(map[string]any{"status": "indexing", "error_code": "", "index_progress": 5}).Error; err != nil {
		return
	}
	if err := prepareAIKnowledgeDocumentChunks(db, documentID); err != nil {
		markAIKnowledgeDocumentFailed(documentID, aiKnowledgeDocumentParseErrorCode(err))
		return
	}
	var chunks []model.AIKnowledgeChunk
	if err := db.Where("document_id = ?", documentID).Order("position ASC").Find(&chunks).Error; err != nil || len(chunks) == 0 {
		markAIKnowledgeDocumentFailed(documentID, "KNOWLEDGE_CHUNKS_MISSING")
		return
	}
	inputs := make([]string, 0, len(chunks))
	for _, chunk := range chunks {
		inputs = append(inputs, chunk.Content)
	}
	updateAIKnowledgeDocumentProgress(db, documentID, 10)
	ctx, cancel := context.WithTimeout(context.Background(), knowledgeEmbeddingTimeout)
	defer cancel()
	vectors, err := aiclient.CreateARKEmbeddingsWithProgress(ctx, inputs, func(completed, total int) {
		progress := 10 + completed*70/total
		updateAIKnowledgeDocumentProgress(db, documentID, progress)
	})
	if err != nil || len(vectors) != len(chunks) {
		markAIKnowledgeDocumentFailed(documentID, "ARK_EMBEDDING_FAILED")
		return
	}
	if err := db.Transaction(func(tx *gorm.DB) error {
		for index, chunk := range chunks {
			vector, marshalErr := json.Marshal(vectors[index])
			if marshalErr != nil {
				return marshalErr
			}
			if err := tx.Exec("UPDATE ai_knowledge_chunks SET embedding = ?::vector WHERE id = ? AND document_id = ?", string(vector), chunk.ID, documentID).Error; err != nil {
				return err
			}
		}
		return tx.Model(&model.AIKnowledgeDocument{}).Where("id = ?", documentID).Updates(map[string]any{"status": "ready", "error_code": "", "index_progress": 100}).Error
	}); err != nil {
		markAIKnowledgeDocumentFailed(documentID, "KNOWLEDGE_VECTOR_STORE_FAILED")
	}
}

func updateAIKnowledgeDocumentProgress(db *gorm.DB, documentID model.Int64String, progress int) {
	if db == nil {
		return
	}
	if progress < 0 {
		progress = 0
	}
	if progress > 99 {
		progress = 99
	}
	_ = db.Model(&model.AIKnowledgeDocument{}).
		Where("id = ? AND index_progress < ?", documentID, progress).
		Update("index_progress", progress).Error
}

func markAIKnowledgeDocumentFailed(documentID model.Int64String, errorCode string) {
	if db := database.GetDB(); db != nil {
		_ = db.Model(&model.AIKnowledgeDocument{}).Where("id = ?", documentID).Updates(map[string]any{"status": "failed", "error_code": errorCode}).Error
	}
}

func hasPGVectorExtension(db *gorm.DB) bool {
	var available bool
	if db == nil || db.Dialector.Name() != "postgres" {
		return false
	}
	if err := db.Raw("SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector')").Scan(&available).Error; err != nil {
		return false
	}
	return available
}

func knowledgeEmbeddingErrorCode(message string) string {
	if strings.Contains(message, "ARK_EMBEDDING_MODEL") {
		return "ARK_EMBEDDING_NOT_CONFIGURED"
	}
	return "ARK_NOT_CONFIGURED"
}

func splitKnowledgeText(text string) []string {
	runes := []rune(text)
	chunks := make([]string, 0, (len(runes)/knowledgeChunkSize)+1)
	for start := 0; start < len(runes); {
		end := start + knowledgeChunkSize
		if end > len(runes) {
			end = len(runes)
		}
		chunks = append(chunks, string(runes[start:end]))
		if end == len(runes) {
			break
		}
		start = end - knowledgeChunkOverlap
	}
	return chunks
}

func ListAIAPIKeys(c *gin.Context) {
	userID, ok := currentAIAppUser(c)
	if !ok {
		return
	}
	var keys []model.AIAPIKey
	if database.GetDB().Where("user_id = ?", userID).Order("created_at DESC").Find(&keys).Error != nil {
		Error(c, 500, "加载 API Key 失败")
		return
	}
	Success(c, gin.H{"list": keys})
}
func CreateAIAPIKey(c *gin.Context) {
	userID, ok := currentAIAppUser(c)
	if !ok {
		return
	}
	var payload struct {
		Name string `json:"name"`
	}
	if c.ShouldBindJSON(&payload) != nil || strings.TrimSpace(payload.Name) == "" {
		Error(c, 400, "Key 名称不能为空")
		return
	}
	raw := make([]byte, 24)
	if _, err := rand.Read(raw); err != nil {
		Error(c, 500, "生成 API Key 失败")
		return
	}
	plain := "valley_" + hex.EncodeToString(raw)
	digest := sha256.Sum256([]byte(plain))
	key := model.AIAPIKey{UserID: userID, Name: strings.TrimSpace(payload.Name), KeyPrefix: plain[:13], KeyHash: hex.EncodeToString(digest[:])}
	if database.GetDB().Create(&key).Error != nil {
		Error(c, 500, "创建 API Key 失败")
		return
	}
	Success(c, gin.H{"key": key, "secret": plain})
}
func RevokeAIAPIKey(c *gin.Context) {
	userID, ok := currentAIAppUser(c)
	if !ok {
		return
	}
	id, err := parsePathInt64(c, "keyId")
	if err != nil {
		Error(c, 400, "无效的 Key ID")
		return
	}
	result := database.GetDB().Model(&model.AIAPIKey{}).Where("id = ? AND user_id = ?", id, userID).Update("status", "revoked")
	if result.Error != nil {
		Error(c, 500, "撤销 API Key 失败")
		return
	}
	if result.RowsAffected == 0 {
		Error(c, 404, "API Key 不存在")
		return
	}
	Success(c, nil)
}

func ListAIAPIKeyAppBindings(c *gin.Context) {
	userID, ok := currentAIAppUser(c)
	if !ok {
		return
	}
	key, found := findOwnedAIAPIKey(c, userID)
	if !found {
		return
	}
	var bindings []model.AIAPIKeyAppBinding
	if err := database.GetDB().Where("api_key_id = ?", key.ID).Order("created_at ASC").Find(&bindings).Error; err != nil {
		Error(c, 500, "加载 API Key 应用权限失败")
		return
	}
	Success(c, gin.H{"list": bindings})
}

func ReplaceAIAPIKeyAppBindings(c *gin.Context) {
	userID, ok := currentAIAppUser(c)
	if !ok {
		return
	}
	key, found := findOwnedAIAPIKey(c, userID)
	if !found {
		return
	}
	var payload struct {
		AppIDs []model.Int64String `json:"appIds"`
	}
	if c.ShouldBindJSON(&payload) != nil {
		Error(c, 400, "应用权限参数无效")
		return
	}
	uniqueIDs := make([]model.Int64String, 0, len(payload.AppIDs))
	seen := make(map[model.Int64String]struct{}, len(payload.AppIDs))
	for _, appID := range payload.AppIDs {
		if appID == 0 {
			Error(c, 400, "应用 ID 无效")
			return
		}
		if _, exists := seen[appID]; exists {
			continue
		}
		seen[appID] = struct{}{}
		uniqueIDs = append(uniqueIDs, appID)
	}
	if len(uniqueIDs) > 0 {
		var count int64
		if err := database.GetDB().Model(&model.AIApp{}).Where("user_id = ? AND id IN ?", userID, uniqueIDs).Count(&count).Error; err != nil {
			Error(c, 500, "校验可调用应用失败")
			return
		}
		if count != int64(len(uniqueIDs)) {
			Error(c, 400, "只能绑定自己的应用")
			return
		}
	}
	if err := database.GetDB().Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("api_key_id = ?", key.ID).Delete(&model.AIAPIKeyAppBinding{}).Error; err != nil {
			return err
		}
		for _, appID := range uniqueIDs {
			if err := tx.Create(&model.AIAPIKeyAppBinding{APIKeyID: key.ID, AppID: appID}).Error; err != nil {
				return err
			}
		}
		return nil
	}); err != nil {
		Error(c, 500, "更新 API Key 应用权限失败")
		return
	}
	Success(c, gin.H{"appIds": uniqueIDs})
}

func GetAIAPIKeyDailyUsage(c *gin.Context) {
	userID, ok := currentAIAppUser(c)
	if !ok {
		return
	}
	key, found := findOwnedAIAPIKey(c, userID)
	if !found {
		return
	}
	var usage model.AIAPIKeyDailyUsage
	if err := database.GetDB().Where("api_key_id = ? AND usage_date = ?", key.ID, time.Now().Format("2006-01-02")).First(&usage).Error; err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		Error(c, 500, "加载 API Key 配额失败")
		return
	}
	Success(c, gin.H{"limit": aiAPIKeyDailyCallLimit, "count": usage.RequestCount, "remaining": aiAPIKeyDailyCallLimit - usage.RequestCount})
}

func ListAIAppPublicInvocations(c *gin.Context) {
	userID, ok := currentAIAppUser(c)
	if !ok {
		return
	}
	app, found := findAIApp(c, userID)
	if !found {
		return
	}
	var invocations []model.AIAppPublicInvocation
	if err := database.GetDB().Where("app_id = ? AND user_id = ?", app.ID, userID).Order("created_at DESC").Limit(100).Find(&invocations).Error; err != nil {
		Error(c, 500, "加载公开调用记录失败")
		return
	}
	Success(c, gin.H{"list": invocations})
}

func findOwnedAIAPIKey(c *gin.Context, userID model.Int64String) (model.AIAPIKey, bool) {
	id, err := parsePathInt64(c, "keyId")
	if err != nil {
		Error(c, 400, "无效的 Key ID")
		return model.AIAPIKey{}, false
	}
	var key model.AIAPIKey
	if err := database.GetDB().Where("id = ? AND user_id = ?", id, userID).First(&key).Error; err != nil {
		Error(c, 404, "API Key 不存在")
		return model.AIAPIKey{}, false
	}
	return key, true
}

func findAIApp(c *gin.Context, userID model.Int64String) (model.AIApp, bool) {
	id, err := parsePathInt64(c, "appId")
	if err != nil {
		Error(c, 400, "无效的应用 ID")
		return model.AIApp{}, false
	}
	var app model.AIApp
	if database.GetDB().Where("id = ? AND user_id = ?", id, userID).First(&app).Error != nil {
		Error(c, 404, "应用不存在")
		return model.AIApp{}, false
	}
	return app, true
}

// VerifyAIAPIKey is intentionally reusable by the public invocation middleware.
func VerifyAIAPIKey(raw string) (*model.AIAPIKey, bool) {
	raw = strings.TrimSpace(raw)
	if !strings.HasPrefix(raw, "valley_") {
		return nil, false
	}
	digest := sha256.Sum256([]byte(raw))
	var key model.AIAPIKey
	if database.GetDB().Where("key_hash = ? AND status = ?", hex.EncodeToString(digest[:]), "active").First(&key).Error != nil {
		return nil, false
	}
	now := time.Now()
	_ = database.GetDB().Model(&key).Update("last_used_at", now).Error
	key.LastUsedAt = &now
	return &key, true
}
