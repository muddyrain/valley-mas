package handler

import (
	"bytes"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"

	"valley-server/internal/config"
	"valley-server/internal/database"
	"valley-server/internal/middleware"
	"valley-server/internal/model"
	"valley-server/internal/utils"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

const aiPlatformTestSecret = "ai-platform-test-secret"

func setupAIPlatformTestRouter(t *testing.T) (*gin.Engine, *gorm.DB) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(
		&model.User{},
		&model.Workflow{},
		&model.AIApp{},
		&model.AIAppVersion{},
		&model.AIAppVersionKnowledgeBase{},
		&model.AIAPIKey{},
		&model.AIAPIKeyAppBinding{},
		&model.AIAPIKeyDailyUsage{},
		&model.AIAppPublicInvocation{},
		&model.AIKnowledgeBase{},
		&model.AIKnowledgeDocument{},
		&model.AIKnowledgeChunk{},
		&model.AIAppKnowledgeBase{},
		&model.AIAppToolBinding{},
	); err != nil {
		t.Fatalf("migrate ai platform: %v", err)
	}
	if err := db.Create(&model.User{ID: 101, Username: "platform-user", Role: "user", IsActive: true}).Error; err != nil {
		t.Fatalf("seed user: %v", err)
	}
	if err := db.Create(&model.User{ID: 202, Username: "other-user", Role: "user", IsActive: true}).Error; err != nil {
		t.Fatalf("seed other user: %v", err)
	}
	previousDB := database.DB
	database.DB = db
	t.Cleanup(func() {
		database.DB = previousDB
		sqlDB, sqlErr := db.DB()
		if sqlErr == nil {
			_ = sqlDB.Close()
		}
	})
	router := gin.New()
	auth := router.Group("/ai")
	auth.Use(middleware.Auth(&config.Config{JWT: config.JWTConfig{Secret: aiPlatformTestSecret}}))
	auth.POST("/apps/:appId/versions", SaveAIAppVersion)
	auth.POST("/apps/:appId/restore", RestoreAIAppVersion)
	auth.GET("/knowledge-bases/:knowledgeBaseId/documents", ListAIKnowledgeDocuments)
	auth.POST("/knowledge-bases/:knowledgeBaseId/documents", UploadAIKnowledgeDocument)
	auth.DELETE("/knowledge-bases/:knowledgeBaseId/documents/:documentId", DeleteAIKnowledgeDocument)
	auth.DELETE("/knowledge-bases/:knowledgeBaseId", DeleteAIKnowledgeBase)
	auth.GET("/apps/:appId/knowledge-bases", ListAIAppKnowledgeBases)
	auth.PUT("/apps/:appId/knowledge-bases", ReplaceAIAppKnowledgeBases)
	auth.GET("/apps/:appId/retrieval-config", GetAIAppRetrievalConfig)
	auth.PUT("/apps/:appId/retrieval-config", UpdateAIAppRetrievalConfig)
	auth.GET("/api-keys/:keyId/apps", ListAIAPIKeyAppBindings)
	auth.PUT("/api-keys/:keyId/apps", ReplaceAIAPIKeyAppBindings)
	auth.GET("/apps/:appId/public-invocations", ListAIAppPublicInvocations)
	public := router.Group("/public")
	public.POST("/ai/apps/:appId/chat", PublicAIAppChat)
	return router, db
}

func TestConsumeAIAPIKeyDailyUsageStopsAtDailyLimit(t *testing.T) {
	_, db := setupAIPlatformTestRouter(t)
	key := model.AIAPIKey{UserID: 101, Name: "public-api-key", KeyPrefix: "valley_test", KeyHash: "hash", Status: "active"}
	if err := db.Create(&key).Error; err != nil {
		t.Fatalf("create api key: %v", err)
	}

	for call := 1; call <= aiAPIKeyDailyCallLimit; call++ {
		remaining, err := consumeAIAPIKeyDailyUsage(db, key.ID, "2026-07-14")
		if err != nil {
			t.Fatalf("consume call %d: %v", call, err)
		}
		if remaining != aiAPIKeyDailyCallLimit-call {
			t.Fatalf("call %d remaining = %d, want %d", call, remaining, aiAPIKeyDailyCallLimit-call)
		}
	}

	if _, err := consumeAIAPIKeyDailyUsage(db, key.ID, "2026-07-14"); err != ErrAIAPIKeyDailyQuotaExceeded {
		t.Fatalf("101st call error = %v, want %v", err, ErrAIAPIKeyDailyQuotaExceeded)
	}
}

func TestPublicAIAppChatRejectsUnboundKeyAndWritesMetadataOnlyLog(t *testing.T) {
	router, db := setupAIPlatformTestRouter(t)
	app := model.AIApp{UserID: 101, Type: aiAppTypeAgent, Name: "公开应用"}
	if err := db.Create(&app).Error; err != nil {
		t.Fatalf("create app: %v", err)
	}
	rawKey := "valley_public-api-test-key"
	digest := sha256.Sum256([]byte(rawKey))
	key := model.AIAPIKey{UserID: 101, Name: "public-api-key", KeyPrefix: "valley_public", KeyHash: fmt.Sprintf("%x", digest)}
	if err := db.Create(&key).Error; err != nil {
		t.Fatalf("create api key: %v", err)
	}
	body, _ := json.Marshal(map[string]any{"message": "external request must not be stored"})
	req := httptest.NewRequest(http.MethodPost, "/public/ai/apps/"+strconv.FormatInt(int64(app.ID), 10)+"/chat", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+rawKey)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("unbound key response = %d body=%s", rec.Code, rec.Body.String())
	}

	var invocation model.AIAppPublicInvocation
	if err := db.Where("api_key_id = ? AND app_id = ?", key.ID, app.ID).First(&invocation).Error; err != nil {
		t.Fatalf("load invocation metadata: %v", err)
	}
	if invocation.Status != "rejected" || invocation.ErrorCode != "API_KEY_APP_NOT_BOUND" {
		t.Fatalf("unexpected invocation metadata: %+v", invocation)
	}
}

func TestReplaceAIAPIKeyAppBindingsRestrictsKeysToOwnedApps(t *testing.T) {
	router, db := setupAIPlatformTestRouter(t)
	key := model.AIAPIKey{UserID: 101, Name: "public-api-key", KeyPrefix: "valley_test", KeyHash: "hash"}
	if err := db.Create(&key).Error; err != nil {
		t.Fatalf("create api key: %v", err)
	}
	ownedApp := model.AIApp{UserID: 101, Type: aiAppTypeAgent, Name: "我的应用"}
	foreignApp := model.AIApp{UserID: 202, Type: aiAppTypeAgent, Name: "他人的应用"}
	if err := db.Create(&ownedApp).Error; err != nil {
		t.Fatalf("create owned app: %v", err)
	}
	if err := db.Create(&foreignApp).Error; err != nil {
		t.Fatalf("create foreign app: %v", err)
	}
	body, _ := json.Marshal(map[string]any{"appIds": []model.Int64String{ownedApp.ID, foreignApp.ID}})
	req := httptest.NewRequest(http.MethodPut, "/ai/api-keys/"+strconv.FormatInt(int64(key.ID), 10)+"/apps", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", aiPlatformAuthHeader(t))
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), "\"code\":400") {
		t.Fatalf("foreign bind response = %d body=%s", rec.Code, rec.Body.String())
	}

	body, _ = json.Marshal(map[string]any{"appIds": []model.Int64String{ownedApp.ID}})
	req = httptest.NewRequest(http.MethodPut, "/ai/api-keys/"+strconv.FormatInt(int64(key.ID), 10)+"/apps", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", aiPlatformAuthHeader(t))
	rec = httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("owned bind response = %d body=%s", rec.Code, rec.Body.String())
	}
	var binding model.AIAPIKeyAppBinding
	if err := db.Where("api_key_id = ? AND app_id = ?", key.ID, ownedApp.ID).First(&binding).Error; err != nil {
		t.Fatalf("load binding: %v", err)
	}
}

func aiPlatformAuthHeader(t *testing.T) string {
	return aiPlatformAuthHeaderFor(t, "101", "platform-user")
}

func aiPlatformAuthHeaderFor(t *testing.T, userID, username string) string {
	t.Helper()
	token, err := utils.GenerateToken(userID, username, "user", aiPlatformTestSecret, 1)
	if err != nil {
		t.Fatalf("generate token: %v", err)
	}
	return "Bearer " + token
}

func plainTextPDF(text string) []byte {
	stream := "BT\n/F1 12 Tf\n72 720 Td\n(" + text + ") Tj\nET\n"
	objects := []string{
		"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
		"2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
		"3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>\nendobj\n",
		fmt.Sprintf("4 0 obj\n<< /Length %d >>\nstream\n%sendstream\nendobj\n", len(stream), stream),
		"5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
	}

	var document bytes.Buffer
	document.WriteString("%PDF-1.4\n")
	offsets := make([]int, 0, len(objects))
	for _, object := range objects {
		offsets = append(offsets, document.Len())
		document.WriteString(object)
	}
	xrefOffset := document.Len()
	fmt.Fprintf(&document, "xref\n0 %d\n0000000000 65535 f \n", len(objects)+1)
	for _, offset := range offsets {
		fmt.Fprintf(&document, "%010d 00000 n \n", offset)
	}
	fmt.Fprintf(&document, "trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n", len(objects)+1, xrefOffset)
	return document.Bytes()
}

func TestExtractAIKnowledgeDocumentTextFromPDF(t *testing.T) {
	text, err := extractAIKnowledgeDocumentText(".pdf", plainTextPDF("PDF knowledge content"))
	if err != nil {
		t.Fatalf("extract PDF text: %v", err)
	}
	if text != "PDF knowledge content" {
		t.Fatalf("text = %q, want PDF text", text)
	}
}

func TestUploadAIKnowledgeDocumentAcceptsTextPDF(t *testing.T) {
	router, db := setupAIPlatformTestRouter(t)
	previousSchedule := scheduleAIKnowledgeDocumentIndexing
	scheduleAIKnowledgeDocumentIndexing = func(model.Int64String) {}
	t.Cleanup(func() { scheduleAIKnowledgeDocumentIndexing = previousSchedule })
	base := model.AIKnowledgeBase{UserID: 101, Name: "PDF 资料"}
	if err := db.Create(&base).Error; err != nil {
		t.Fatalf("create knowledge base: %v", err)
	}

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	part, err := writer.CreateFormFile("file", "brief.pdf")
	if err != nil {
		t.Fatalf("create multipart file: %v", err)
	}
	if _, err := part.Write(plainTextPDF("PDF knowledge content")); err != nil {
		t.Fatalf("write PDF: %v", err)
	}
	if err := writer.Close(); err != nil {
		t.Fatalf("close multipart body: %v", err)
	}
	req := httptest.NewRequest(http.MethodPost, "/ai/knowledge-bases/"+strconv.FormatInt(int64(base.ID), 10)+"/documents", &body)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	req.Header.Set("Authorization", aiPlatformAuthHeader(t))
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("upload response = %d body=%s", rec.Code, rec.Body.String())
	}

	var document model.AIKnowledgeDocument
	if err := db.Where("knowledge_base_id = ?", base.ID).First(&document).Error; err != nil {
		t.Fatalf("load document: %v", err)
	}
	if document.Status != "pending_embedding" || !strings.Contains(document.ParsedText, "PDF knowledge content") || document.ChunkCount == 0 {
		t.Fatalf("unexpected document = %#v", document)
	}
}

func TestUploadAIKnowledgeDocumentCreatesPendingChunks(t *testing.T) {
	router, db := setupAIPlatformTestRouter(t)
	previousSchedule := scheduleAIKnowledgeDocumentIndexing
	scheduleAIKnowledgeDocumentIndexing = func(model.Int64String) {}
	t.Cleanup(func() { scheduleAIKnowledgeDocumentIndexing = previousSchedule })
	base := model.AIKnowledgeBase{UserID: 101, Name: "创作资料"}
	if err := db.Create(&base).Error; err != nil {
		t.Fatalf("create knowledge base: %v", err)
	}

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	part, err := writer.CreateFormFile("file", "notes.md")
	if err != nil {
		t.Fatalf("create multipart file: %v", err)
	}
	if _, err := part.Write([]byte(strings.Repeat("知识库内容。", 260))); err != nil {
		t.Fatalf("write multipart file: %v", err)
	}
	if err := writer.Close(); err != nil {
		t.Fatalf("close multipart body: %v", err)
	}
	req := httptest.NewRequest(http.MethodPost, "/ai/knowledge-bases/"+strconv.FormatInt(int64(base.ID), 10)+"/documents", &body)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	req.Header.Set("Authorization", aiPlatformAuthHeader(t))
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("upload response = %d body=%s", rec.Code, rec.Body.String())
	}

	var document model.AIKnowledgeDocument
	if err := db.Where("knowledge_base_id = ?", base.ID).First(&document).Error; err != nil {
		t.Fatalf("load document: %v", err)
	}
	if document.Status != "pending_embedding" || document.IndexProgress != 0 || document.ChunkCount < 2 || document.SizeBytes == 0 {
		t.Fatalf("unexpected document = %#v", document)
	}
	var count int64
	if err := db.Model(&model.AIKnowledgeChunk{}).Where("document_id = ? AND user_id = ?", document.ID, 101).Count(&count).Error; err != nil {
		t.Fatalf("count chunks: %v", err)
	}
	if count != int64(document.ChunkCount) {
		t.Fatalf("chunk count = %d, want %d", count, document.ChunkCount)
	}
}

func TestResolveAIAppToolsReturnsOnlyBoundContentSearch(t *testing.T) {
	_, db := setupAIPlatformTestRouter(t)
	app := model.AIApp{UserID: 101, Type: aiAppTypeAgent, Name: "检索助手"}
	if err := db.Create(&app).Error; err != nil {
		t.Fatalf("create app: %v", err)
	}
	if err := db.Create(&[]model.AIAppToolBinding{
		{AppID: app.ID, ToolName: "content.search"},
		{AppID: app.ID, ToolName: "unreviewed.tool"},
	}).Error; err != nil {
		t.Fatalf("create bindings: %v", err)
	}

	registry, names, err := resolveAIAppTools(db, app.ID)
	if err != nil {
		t.Fatalf("resolve tools: %v", err)
	}
	if len(names) != 1 || names[0] != "content.search" {
		t.Fatalf("names = %#v", names)
	}
	if got := registry.Filter("workbench", names); len(got) != 1 || got[0].Name() != "content.search" {
		t.Fatalf("resolved tools = %#v", got)
	}
}

func TestDeleteAIKnowledgeDocumentRemovesOnlyOwnedChunks(t *testing.T) {
	router, db := setupAIPlatformTestRouter(t)
	base := model.AIKnowledgeBase{UserID: 101, Name: "创作资料"}
	if err := db.Create(&base).Error; err != nil {
		t.Fatalf("create knowledge base: %v", err)
	}
	document := model.AIKnowledgeDocument{KnowledgeBaseID: base.ID, UserID: 101, Name: "notes.md", Status: "ready", IndexProgress: 100}
	if err := db.Create(&document).Error; err != nil {
		t.Fatalf("create document: %v", err)
	}
	chunk := model.AIKnowledgeChunk{DocumentID: document.ID, UserID: 101, Position: 0, Content: "内容"}
	if err := db.Create(&chunk).Error; err != nil {
		t.Fatalf("create chunk: %v", err)
	}
	req := httptest.NewRequest(http.MethodDelete, "/ai/knowledge-bases/"+strconv.FormatInt(int64(base.ID), 10)+"/documents/"+strconv.FormatInt(int64(document.ID), 10), nil)
	req.Header.Set("Authorization", aiPlatformAuthHeader(t))
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("delete response = %d body=%s", rec.Code, rec.Body.String())
	}
	var documentCount, chunkCount int64
	_ = db.Model(&model.AIKnowledgeDocument{}).Where("id = ?", document.ID).Count(&documentCount).Error
	_ = db.Model(&model.AIKnowledgeChunk{}).Where("document_id = ?", document.ID).Count(&chunkCount).Error
	if documentCount != 0 || chunkCount != 0 {
		t.Fatalf("documentCount=%d chunkCount=%d, want both 0", documentCount, chunkCount)
	}
}

func TestKnowledgeBaseDocumentEndpointsAreOwnerScoped(t *testing.T) {
	router, db := setupAIPlatformTestRouter(t)
	base := model.AIKnowledgeBase{UserID: 202, Name: "他人的资料"}
	if err := db.Create(&base).Error; err != nil {
		t.Fatalf("create knowledge base: %v", err)
	}
	req := httptest.NewRequest(http.MethodGet, "/ai/knowledge-bases/"+strconv.FormatInt(int64(base.ID), 10)+"/documents", nil)
	req.Header.Set("Authorization", aiPlatformAuthHeader(t))
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), `"code":404`) {
		t.Fatalf("foreign list response = %d body=%s", rec.Code, rec.Body.String())
	}

	deleteReq := httptest.NewRequest(http.MethodDelete, "/ai/knowledge-bases/"+strconv.FormatInt(int64(base.ID), 10), nil)
	deleteReq.Header.Set("Authorization", aiPlatformAuthHeader(t))
	deleteRec := httptest.NewRecorder()
	router.ServeHTTP(deleteRec, deleteReq)
	if deleteRec.Code != http.StatusOK || !strings.Contains(deleteRec.Body.String(), `"code":404`) {
		t.Fatalf("foreign delete response = %d body=%s", deleteRec.Code, deleteRec.Body.String())
	}
	var stored model.AIKnowledgeBase
	if err := db.First(&stored, base.ID).Error; err != nil {
		t.Fatalf("foreign knowledge base was deleted: %v", err)
	}
}

func TestReplaceAIAppKnowledgeBasesRejectsForeignKnowledgeBase(t *testing.T) {
	router, db := setupAIPlatformTestRouter(t)
	app := model.AIApp{UserID: 101, Type: aiAppTypeAgent, Name: "我的智能体"}
	if err := db.Create(&app).Error; err != nil {
		t.Fatalf("create app: %v", err)
	}
	foreignBase := model.AIKnowledgeBase{UserID: 202, Name: "他人的资料"}
	if err := db.Create(&foreignBase).Error; err != nil {
		t.Fatalf("create foreign knowledge base: %v", err)
	}
	body, _ := json.Marshal(map[string]any{"knowledgeBaseIds": []model.Int64String{foreignBase.ID}})
	req := httptest.NewRequest(http.MethodPut, "/ai/apps/"+strconv.FormatInt(int64(app.ID), 10)+"/knowledge-bases", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", aiPlatformAuthHeader(t))
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), `"code":400`) {
		t.Fatalf("foreign bind response = %d body=%s", rec.Code, rec.Body.String())
	}
	var count int64
	if err := db.Model(&model.AIAppKnowledgeBase{}).Where("app_id = ?", app.ID).Count(&count).Error; err != nil {
		t.Fatalf("count bindings: %v", err)
	}
	if count != 0 {
		t.Fatalf("foreign knowledge base was bound, count=%d", count)
	}
}

func TestSaveAIAppVersionUpdatesDraftVersionID(t *testing.T) {
	router, db := setupAIPlatformTestRouter(t)
	app := model.AIApp{UserID: 101, Type: aiAppTypeAgent, Name: "测试智能体"}
	if err := db.Create(&app).Error; err != nil {
		t.Fatalf("create app: %v", err)
	}
	body, _ := json.Marshal(map[string]any{"name": "测试智能体", "config": map[string]any{"systemPrompt": "你好"}})
	req := httptest.NewRequest(http.MethodPost, "/ai/apps/"+strconv.FormatInt(int64(app.ID), 10)+"/versions", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", aiPlatformAuthHeader(t))
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("save response = %d body=%s", rec.Code, rec.Body.String())
	}
	var stored model.AIApp
	if err := db.First(&stored, app.ID).Error; err != nil {
		t.Fatalf("load app: %v", err)
	}
	if stored.DraftVersionID == 0 {
		t.Fatal("expected saved version to become the draft version")
	}
	var version model.AIAppVersion
	if err := db.First(&version, stored.DraftVersionID).Error; err != nil {
		t.Fatalf("draft version not persisted: %v", err)
	}
}

func TestUpdateAIAppRetrievalConfigCreatesVersionedDraftSnapshot(t *testing.T) {
	router, db := setupAIPlatformTestRouter(t)
	app := model.AIApp{UserID: 101, Type: aiAppTypeAgent, Name: "检索配置测试"}
	if err := db.Create(&app).Error; err != nil {
		t.Fatalf("create app: %v", err)
	}
	first := model.AIAppVersion{AppID: app.ID, Number: 1, Config: `{"systemPrompt":"只依据资料回答"}`}
	if err := db.Create(&first).Error; err != nil {
		t.Fatalf("create first version: %v", err)
	}
	if err := db.Model(&app).Update("draft_version_id", first.ID).Error; err != nil {
		t.Fatalf("set draft version: %v", err)
	}

	body, _ := json.Marshal(map[string]any{"topK": 6, "minScore": 0.6, "citeSources": false})
	req := httptest.NewRequest(http.MethodPut, "/ai/apps/"+strconv.FormatInt(int64(app.ID), 10)+"/retrieval-config", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", aiPlatformAuthHeader(t))
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("update response = %d body=%s", rec.Code, rec.Body.String())
	}

	var stored model.AIApp
	if err := db.First(&stored, app.ID).Error; err != nil {
		t.Fatalf("load app: %v", err)
	}
	if stored.DraftVersionID == first.ID {
		t.Fatal("retrieval config update must create a new draft version")
	}
	var snapshot model.AIAppVersion
	if err := db.First(&snapshot, stored.DraftVersionID).Error; err != nil {
		t.Fatalf("load snapshot: %v", err)
	}
	if snapshot.Number != 2 || snapshot.Config != first.Config {
		t.Fatalf("unexpected copied config: %#v", snapshot)
	}
	var response struct {
		Data struct {
			RetrievalConfig struct {
				TopK        int     `json:"topK"`
				MinScore    float64 `json:"minScore"`
				CiteSources bool    `json:"citeSources"`
			} `json:"retrievalConfig"`
		} `json:"data"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &response); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if response.Data.RetrievalConfig.TopK != 6 || response.Data.RetrievalConfig.MinScore != 0.6 || response.Data.RetrievalConfig.CiteSources {
		t.Fatalf("retrieval snapshot was not returned: %s", rec.Body.String())
	}
}

func TestReplaceAIAppKnowledgeBasesKeepsPriorVersionSnapshot(t *testing.T) {
	router, db := setupAIPlatformTestRouter(t)
	app := model.AIApp{UserID: 101, Type: aiAppTypeAgent, Name: "资料库快照测试"}
	if err := db.Create(&app).Error; err != nil {
		t.Fatalf("create app: %v", err)
	}
	first := model.AIAppVersion{AppID: app.ID, Number: 1, Config: `{}`, RetrievalConfig: `{"topK":4,"minScore":0.45,"citeSources":true}`, KnowledgeBaseSnapshot: true}
	if err := db.Create(&first).Error; err != nil {
		t.Fatalf("create first version: %v", err)
	}
	firstBase := model.AIKnowledgeBase{UserID: 101, Name: "旧资料"}
	secondBase := model.AIKnowledgeBase{UserID: 101, Name: "新资料"}
	if err := db.Create(&firstBase).Error; err != nil {
		t.Fatalf("create first base: %v", err)
	}
	if err := db.Create(&secondBase).Error; err != nil {
		t.Fatalf("create second base: %v", err)
	}
	if err := db.Create(&model.AIAppVersionKnowledgeBase{AppVersionID: first.ID, KnowledgeBaseID: firstBase.ID}).Error; err != nil {
		t.Fatalf("create first snapshot binding: %v", err)
	}
	if err := db.Model(&app).Update("draft_version_id", first.ID).Error; err != nil {
		t.Fatalf("set draft version: %v", err)
	}

	body, _ := json.Marshal(map[string]any{"knowledgeBaseIds": []model.Int64String{secondBase.ID}})
	req := httptest.NewRequest(http.MethodPut, "/ai/apps/"+strconv.FormatInt(int64(app.ID), 10)+"/knowledge-bases", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", aiPlatformAuthHeader(t))
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("replace response = %d body=%s", rec.Code, rec.Body.String())
	}

	var stored model.AIApp
	if err := db.First(&stored, app.ID).Error; err != nil {
		t.Fatalf("load app: %v", err)
	}
	var oldBindings []model.AIAppVersionKnowledgeBase
	if err := db.Where("app_version_id = ?", first.ID).Find(&oldBindings).Error; err != nil {
		t.Fatalf("load old bindings: %v", err)
	}
	if len(oldBindings) != 1 || oldBindings[0].KnowledgeBaseID != firstBase.ID {
		t.Fatalf("old snapshot changed: %#v", oldBindings)
	}
	var newBindings []model.AIAppVersionKnowledgeBase
	if err := db.Where("app_version_id = ?", stored.DraftVersionID).Find(&newBindings).Error; err != nil {
		t.Fatalf("load new bindings: %v", err)
	}
	if stored.DraftVersionID == first.ID || len(newBindings) != 1 || newBindings[0].KnowledgeBaseID != secondBase.ID {
		t.Fatalf("new snapshot mismatch: draft=%d bindings=%#v", stored.DraftVersionID, newBindings)
	}
}

func TestRestoreAIAppVersionCreatesNewDraftWithoutChangingPublishedVersion(t *testing.T) {
	router, db := setupAIPlatformTestRouter(t)
	app := model.AIApp{UserID: 101, Type: aiAppTypeAgent, Name: "回滚测试"}
	if err := db.Create(&app).Error; err != nil {
		t.Fatalf("create app: %v", err)
	}
	first := model.AIAppVersion{AppID: app.ID, Number: 1, Config: `{"systemPrompt":"旧版本"}`}
	second := model.AIAppVersion{AppID: app.ID, Number: 2, Config: `{"systemPrompt":"新版本"}`}
	if err := db.Create(&first).Error; err != nil {
		t.Fatalf("create first version: %v", err)
	}
	if err := db.Create(&second).Error; err != nil {
		t.Fatalf("create second version: %v", err)
	}
	if err := db.Model(&app).Updates(map[string]any{"draft_version_id": second.ID, "published_version_id": first.ID, "status": "published"}).Error; err != nil {
		t.Fatalf("set app pointers: %v", err)
	}
	body, _ := json.Marshal(map[string]any{"versionId": first.ID})
	req := httptest.NewRequest(http.MethodPost, "/ai/apps/"+strconv.FormatInt(int64(app.ID), 10)+"/restore", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", aiPlatformAuthHeader(t))
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("restore response = %d body=%s", rec.Code, rec.Body.String())
	}
	var stored model.AIApp
	if err := db.First(&stored, app.ID).Error; err != nil {
		t.Fatalf("load app: %v", err)
	}
	if stored.PublishedVersionID != first.ID {
		t.Fatalf("published version changed to %d, want %d", stored.PublishedVersionID, first.ID)
	}
	if stored.DraftVersionID == first.ID || stored.DraftVersionID == second.ID {
		t.Fatalf("restore must create a new draft, got %d", stored.DraftVersionID)
	}
	var restored model.AIAppVersion
	if err := db.First(&restored, stored.DraftVersionID).Error; err != nil {
		t.Fatalf("load restored draft: %v", err)
	}
	if restored.Number != 3 || restored.Config != first.Config {
		t.Fatalf("restored version = %#v, want copy of v1 as v3", restored)
	}
}

func TestSyncWorkflowAIAppReusesSingleUnlinkedWorkflowApp(t *testing.T) {
	_, db := setupAIPlatformTestRouter(t)
	workflow := model.Workflow{UserID: 101, Name: "自动导入博客", Graph: `{"nodes":[],"edges":[]}`, Status: "draft"}
	if err := db.Create(&workflow).Error; err != nil {
		t.Fatalf("create workflow: %v", err)
	}
	legacyApp := model.AIApp{UserID: 101, Type: aiAppTypeWorkflow, Name: workflow.Name, Status: "draft"}
	if err := db.Create(&legacyApp).Error; err != nil {
		t.Fatalf("create unlinked app: %v", err)
	}
	var synced model.AIApp
	if err := db.Transaction(func(tx *gorm.DB) error {
		var syncErr error
		synced, _, syncErr = syncWorkflowAIApp(tx, workflow)
		return syncErr
	}); err != nil {
		t.Fatalf("sync workflow app: %v", err)
	}
	if synced.ID != legacyApp.ID || synced.WorkflowID == nil || *synced.WorkflowID != workflow.ID {
		t.Fatalf("workflow app was not safely linked: %#v", synced)
	}
	var count int64
	if err := db.Model(&model.AIApp{}).Where("user_id = ? AND type = ?", 101, aiAppTypeWorkflow).Count(&count).Error; err != nil {
		t.Fatalf("count workflow apps: %v", err)
	}
	if count != 1 {
		t.Fatalf("workflow app count = %d, want 1", count)
	}
}
