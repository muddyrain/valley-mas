package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"path/filepath"
	"strings"
	"time"
	"unicode"

	"valley-server/internal/aiclient"
	"valley-server/internal/aimodel"
	"valley-server/internal/database"
	"valley-server/internal/logger"
	"valley-server/internal/model"

	"github.com/gin-gonic/gin"
	"github.com/ledongthuc/pdf"
	"github.com/sirupsen/logrus"
	"gorm.io/gorm"
)

type aiKnowledgeReference struct {
	Index        int               `json:"index"`
	DocumentName string            `json:"documentName"`
	ChunkID      model.Int64String `json:"chunkId"`
	Excerpt      string            `json:"excerpt"`
	Score        float64           `json:"score"`
	PageNumber   int               `json:"pageNumber,omitempty"`
}

type aiKnowledgeSearchRow struct {
	ChunkID      model.Int64String `gorm:"column:chunk_id"`
	DocumentName string            `gorm:"column:document_name"`
	Content      string            `gorm:"column:content"`
	Score        float64           `gorm:"column:score"`
	PageNumber   int               `gorm:"column:page_number"`
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

type aiAppRetrievalConfig struct {
	TopK            int     `json:"topK"`
	MinScore        float64 `json:"minScore"`
	CiteSources     bool    `json:"citeSources"`
	SearchMode      string  `json:"searchMode"`
	KeywordWeight   float64 `json:"keywordWeight"`
	MaxContextChars int     `json:"maxContextChars"`
}

func defaultAIAppRetrievalConfig() aiAppRetrievalConfig {
	return aiAppRetrievalConfig{TopK: 4, MinScore: 0.45, CiteSources: true, SearchMode: "hybrid", KeywordWeight: 0.2, MaxContextChars: 4500}
}

func parseAIAppRetrievalConfig(raw string) (aiAppRetrievalConfig, error) {
	config := defaultAIAppRetrievalConfig()
	if strings.TrimSpace(raw) == "" || strings.TrimSpace(raw) == "{}" {
		return config, nil
	}
	if err := json.Unmarshal([]byte(raw), &config); err != nil {
		return aiAppRetrievalConfig{}, err
	}
	if !validAIAppRetrievalConfig(config) {
		return aiAppRetrievalConfig{}, errors.New("retrieval config out of range")
	}
	return config, nil
}

func validAIAppRetrievalConfig(config aiAppRetrievalConfig) bool {
	return config.TopK >= 1 && config.TopK <= 8 &&
		config.MinScore >= 0.20 && config.MinScore <= 0.80 &&
		(config.SearchMode == "semantic" || config.SearchMode == "hybrid") &&
		config.KeywordWeight >= 0 && config.KeywordWeight <= 0.5 &&
		config.MaxContextChars >= 1500 && config.MaxContextChars <= 8000
}

const aiKnowledgeSearchQuery = `
	SELECT chunks.id AS chunk_id, documents.name AS document_name, chunks.content, chunks.page_number,
	       ((1 - ?) * (1 - (chunks.embedding <=> ?::vector)) +
	       ? * CASE WHEN chunks.content ILIKE ? OR documents.name ILIKE ? THEN 1 ELSE 0 END) AS score
	FROM ai_knowledge_chunks AS chunks
	JOIN ai_knowledge_documents AS documents ON documents.id = chunks.document_id
	JOIN ai_knowledge_bases AS knowledge_bases ON knowledge_bases.id = documents.knowledge_base_id
	WHERE chunks.user_id = ? AND documents.user_id = ? AND knowledge_bases.user_id = ?
	  AND chunks.deleted_at IS NULL AND documents.deleted_at IS NULL AND knowledge_bases.deleted_at IS NULL
	  AND documents.knowledge_base_id IN ? AND documents.status = 'ready'
	  AND chunks.embedding IS NOT NULL
	ORDER BY score DESC, chunks.embedding <=> ?::vector
	LIMIT ?`

// aiKnowledgeRetrievalFailure converts internal RAG failures into a stable
// public contract. The original error is kept for structured server logs only.
func aiKnowledgeRetrievalFailure(err error) (code, message string) {
	if err == nil {
		return "", ""
	}

	value := err.Error()
	lowerValue := strings.ToLower(value)
	switch {
	case errors.Is(err, aimodel.ErrEmbeddingModelUnavailable):
		return "RAG_EMBEDDING_MODEL_UNAVAILABLE", "没有可用且验证通过的知识库向量模型"
	case errors.Is(err, aimodel.ErrEmbeddingMetadataUnavailable):
		return "RAG_EMBEDDING_REINDEX_REQUIRED", "知识库向量已升级，请先重新索引文档"
	case errors.Is(err, aimodel.ErrEmbeddingIdentityMismatch):
		return "RAG_EMBEDDING_MODEL_MISMATCH", "知识库包含不同向量模型，请重新索引全部文档"
	case errors.Is(err, aimodel.ErrEmbeddingProviderUnavailable):
		return "RAG_EMBEDDING_PROVIDER_UNAVAILABLE", "知识库向量模型的 Provider 未配置"
	case errors.Is(err, aimodel.ErrEmbeddingRequestFailed):
		return "RAG_EMBEDDING_FAILED", "知识库向量服务调用失败，请稍后重试"
	case errors.Is(err, aimodel.ErrEmbeddingDimensionUnavailable):
		return "RAG_VECTOR_DIMENSION_MISMATCH", "知识库向量维度不匹配，请重新索引全部文档"
	case strings.Contains(value, "RAG requires PostgreSQL"):
		return "RAG_POSTGRES_REQUIRED", "知识库检索需要 PostgreSQL 数据库"
	case strings.Contains(value, "pgvector extension is not installed"):
		return "RAG_PGVECTOR_UNAVAILABLE", "数据库未启用 pgvector 扩展"
	case strings.Contains(lowerValue, "different vector dimensions"):
		return "RAG_VECTOR_DIMENSION_MISMATCH", "知识库向量维度不匹配，请重新索引全部文档"
	case strings.Contains(lowerValue, "operator does not exist") && strings.Contains(lowerValue, "vector"):
		return "RAG_VECTOR_OPERATOR_UNAVAILABLE", "知识库向量检索不可用，请检查 pgvector 与数据库迁移"
	case strings.Contains(lowerValue, "relation \"ai_knowledge_") ||
		strings.Contains(lowerValue, "column \"embedding\"") ||
		strings.Contains(lowerValue, "column \"embedding_model_id\""):
		return "RAG_SCHEMA_OUTDATED", "知识库数据库结构未迁移，请执行服务端迁移"
	case strings.Contains(lowerValue, "connection refused") ||
		strings.Contains(lowerValue, "failed to connect") ||
		strings.Contains(lowerValue, "connection reset") ||
		strings.Contains(lowerValue, "database is closed"):
		return "RAG_DATABASE_UNAVAILABLE", "知识库数据库暂不可用，请稍后重试"
	case strings.Contains(value, "ARK_EMBEDDING_MODEL") || value == aiclient.LegacyARKModelUnavailableMessage:
		return "ARK_EMBEDDING_NOT_CONFIGURED", "知识库向量能力正在迁移"
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
		bindings = append(bindings, model.AIAppVersionToolBinding{AppVersionID: target.ID, ToolName: binding.ToolName, ApprovalMode: binding.ApprovalMode})
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

func retrieveAIKnowledgeContext(ctx context.Context, userID model.Int64String, version model.AIAppVersion, message string) (string, []aiKnowledgeReference, error) {
	if !shouldRetrieveAIKnowledge(message) {
		return "", nil, nil
	}
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
	referenceIndex := 0
	for _, row := range rows {
		content := aiclient.TrimRunes(strings.TrimSpace(row.Content), 1600)
		if content == "" || len([]rune(contextBuilder.String()))+len([]rune(content)) > config.MaxContextChars {
			continue
		}
		referenceIndex++
		index := referenceIndex
		contextBuilder.WriteString(fmt.Sprintf("[%d] 来源：", index))
		contextBuilder.WriteString(row.DocumentName)
		if row.PageNumber > 0 {
			contextBuilder.WriteString(fmt.Sprintf("（第 %d 页）", row.PageNumber))
		}
		contextBuilder.WriteString("\n")
		contextBuilder.WriteString(content)
		contextBuilder.WriteString("\n\n")
		if config.CiteSources {
			references = append(references, aiKnowledgeReference{Index: index, DocumentName: row.DocumentName, ChunkID: row.ChunkID, Excerpt: aiclient.TrimRunes(content, 240), Score: row.Score, PageNumber: row.PageNumber})
		}
	}
	return strings.TrimSpace(contextBuilder.String()), references, nil
}

func shouldRetrieveAIKnowledge(message string) bool {
	var normalized strings.Builder
	for _, character := range strings.ToLower(strings.TrimSpace(message)) {
		if unicode.IsLetter(character) || unicode.IsDigit(character) {
			normalized.WriteRune(character)
		}
	}

	switch normalized.String() {
	case "hi", "hello", "hey", "hihi", "hellohello", "你好", "您好", "嗨", "哈喽", "哈囉", "在吗", "在么", "有人吗", "早上好", "下午好", "晚上好", "你好吗":
		return false
	default:
		return true
	}
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
	storedModelID, storedDimension, err := currentAIKnowledgeEmbeddingIdentity(db, userID, knowledgeBaseIDs)
	if err != nil {
		return nil, err
	}
	invocation, err := aimodel.ResolveStoredEmbeddingInvocation(db, storedModelID, storedDimension, knowledgeEmbeddingTimeout)
	if err != nil {
		return nil, err
	}
	queryVectors, err := aimodel.CreateEmbeddingsWithProgress(ctx, invocation, []string{query}, nil)
	if err != nil {
		return nil, err
	}
	queryVector, err := json.Marshal(queryVectors[0])
	if err != nil {
		return nil, err
	}
	keywordWeight := 0.0
	if config.SearchMode == "hybrid" {
		keywordWeight = config.KeywordWeight
	}
	keywordPattern := "%" + strings.TrimSpace(query) + "%"
	var rows []aiKnowledgeSearchRow
	err = db.Raw(
		aiKnowledgeSearchQuery,
		keywordWeight,
		string(queryVector),
		keywordWeight,
		keywordPattern,
		keywordPattern,
		userID,
		userID,
		userID,
		knowledgeBaseIDs,
		string(queryVector),
		config.TopK,
	).Scan(&rows).Error
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
		version, createErr = createAIAppVersionSnapshot(tx, app, source.Config, retrievalConfig, source)
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
	document, err := createAIKnowledgeTextDocument(
		database.GetDB(),
		userID,
		model.Int64String(id),
		file.Filename,
		text,
		file.Header.Get("Content-Type"),
		file.Size,
	)
	if err != nil {
		Error(c, 500, "保存知识库文档失败")
		return
	}
	scheduleAIKnowledgeDocumentIndexing(document.ID)
	Success(c, gin.H{"document": presentAIKnowledgeDocument(document)})
}

// createAIKnowledgeTextDocument is shared by manual uploads and workflow
// output ingestion. It persists the same pending_embedding document contract
// so both paths use one chunking and background-indexing pipeline.
func createAIKnowledgeTextDocument(
	db *gorm.DB,
	userID model.Int64String,
	knowledgeBaseID model.Int64String,
	name string,
	text string,
	mimeType string,
	sizeBytes int64,
) (model.AIKnowledgeDocument, error) {
	if db == nil {
		return model.AIKnowledgeDocument{}, errors.New("知识库数据库不可用")
	}
	name = strings.TrimSpace(name)
	text = strings.TrimSpace(text)
	if name == "" || len(name) > 255 {
		return model.AIKnowledgeDocument{}, errors.New("知识库文档名称无效")
	}
	if text == "" || len([]byte(text)) > knowledgeDocumentMaxBytes {
		return model.AIKnowledgeDocument{}, errors.New("知识库文档内容大小无效")
	}
	var base model.AIKnowledgeBase
	if err := db.Where("id = ? AND user_id = ?", knowledgeBaseID, userID).First(&base).Error; err != nil {
		return model.AIKnowledgeDocument{}, err
	}
	chunks := splitKnowledgeText(text)
	if len(chunks) == 0 || len(chunks) > knowledgeChunkMaxCount {
		return model.AIKnowledgeDocument{}, errors.New("文档分段数量超出限制")
	}
	document := model.AIKnowledgeDocument{
		KnowledgeBaseID: knowledgeBaseID,
		UserID:          userID,
		Name:            name,
		Status:          "pending_embedding",
		ChunkCount:      len(chunks),
		MimeType:        mimeType,
		SizeBytes:       sizeBytes,
		ParsedText:      text,
	}
	if err := db.Transaction(func(tx *gorm.DB) error {
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
		return model.AIKnowledgeDocument{}, err
	}
	return document, nil
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
	var document model.AIKnowledgeDocument
	if err := db.Select("id", "user_id", "knowledge_base_id").First(&document, documentID).Error; err != nil {
		return
	}
	invocation, err := resolveAIKnowledgeIndexInvocation(db, document)
	if err != nil {
		markAIKnowledgeDocumentFailed(documentID, knowledgeEmbeddingErrorCode(err))
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
	vectors, err := aimodel.CreateEmbeddingsWithProgress(ctx, invocation, inputs, func(completed, total int) {
		progress := 10 + completed*70/total
		updateAIKnowledgeDocumentProgress(db, documentID, progress)
	})
	if err != nil || len(vectors) != len(chunks) {
		markAIKnowledgeDocumentFailed(documentID, knowledgeEmbeddingErrorCode(err))
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
		return tx.Model(&model.AIKnowledgeDocument{}).Where("id = ?", documentID).Updates(map[string]any{
			"status":              "ready",
			"error_code":          "",
			"index_progress":      100,
			"embedding_model_id":  invocation.Model.ID,
			"embedding_dimension": invocation.Model.EmbeddingDimension,
		}).Error
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

func currentAIKnowledgeEmbeddingIdentity(
	db *gorm.DB,
	userID model.Int64String,
	knowledgeBaseIDs []model.Int64String,
) (model.Int64String, int, error) {
	var rows []struct {
		ModelID   model.Int64String `gorm:"column:embedding_model_id"`
		Dimension int               `gorm:"column:embedding_dimension"`
	}
	if err := db.Model(&model.AIKnowledgeDocument{}).
		Distinct("embedding_model_id", "embedding_dimension").
		Where("user_id = ? AND knowledge_base_id IN ? AND status = ?", userID, knowledgeBaseIDs, "ready").
		Order("embedding_model_id ASC, embedding_dimension ASC").
		Find(&rows).Error; err != nil {
		return 0, 0, err
	}
	if len(rows) == 0 {
		return 0, 0, aimodel.ErrEmbeddingMetadataUnavailable
	}
	for _, row := range rows {
		if row.ModelID == 0 || row.Dimension <= 0 {
			return 0, 0, aimodel.ErrEmbeddingMetadataUnavailable
		}
	}
	if len(rows) > 1 {
		return 0, 0, fmt.Errorf("%w: found %d stored identities", aimodel.ErrEmbeddingIdentityMismatch, len(rows))
	}
	return rows[0].ModelID, rows[0].Dimension, nil
}

func resolveAIKnowledgeIndexInvocation(db *gorm.DB, document model.AIKnowledgeDocument) (aimodel.Invocation, error) {
	var readyDocumentCount int64
	if err := db.Model(&model.AIKnowledgeDocument{}).
		Where(
			"user_id = ? AND knowledge_base_id = ? AND status = ?",
			document.UserID,
			document.KnowledgeBaseID,
			"ready",
		).
		Count(&readyDocumentCount).Error; err != nil {
		return aimodel.Invocation{}, err
	}
	if readyDocumentCount == 0 {
		return aimodel.ResolveDefaultEmbeddingInvocation(db, knowledgeEmbeddingTimeout)
	}
	modelID, dimension, err := currentAIKnowledgeEmbeddingIdentity(
		db,
		document.UserID,
		[]model.Int64String{document.KnowledgeBaseID},
	)
	if err != nil {
		return aimodel.Invocation{}, err
	}
	return aimodel.ResolveStoredEmbeddingInvocation(db, modelID, dimension, knowledgeEmbeddingTimeout)
}

func knowledgeEmbeddingErrorCode(err error) string {
	if err == nil {
		return "RAG_EMBEDDING_FAILED"
	}
	code, _ := aiKnowledgeRetrievalFailure(err)
	return code
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
