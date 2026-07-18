package handler

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	"valley-server/internal/aiclient"
	"valley-server/internal/config"
	"valley-server/internal/database"
	"valley-server/internal/logger"
	"valley-server/internal/middleware"
	"valley-server/internal/model"
	"valley-server/internal/utils"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/sirupsen/logrus"
	"gorm.io/gorm"
)

const aiPlatformTestSecret = "ai-platform-test-secret"

func setupAIPlatformTestRouter(t *testing.T) (*gin.Engine, *gorm.DB) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	if logger.Log == nil {
		logger.Log = logrus.New()
		logger.Log.SetOutput(io.Discard)
	}
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
		&model.AIAppVersionToolBinding{},
		&model.AIAppConversation{},
		&model.AIAppConversationMessage{},
		&model.AIAppConversationToolTrace{},
		&model.AIAppRun{},
		&model.AIAPIKey{},
		&model.AIAPIKeyAppBinding{},
		&model.AIAPIKeyDailyUsage{},
		&model.AIAppPublicInvocation{},
		&model.AIUsageLog{},
		&model.AIKnowledgeBase{},
		&model.AIKnowledgeDocument{},
		&model.AIKnowledgeChunk{},
		&model.AIAppKnowledgeBase{},
		&model.AIAppToolBinding{},
		&model.Post{},
		&model.Resource{},
		&model.AIWorkbenchCopilotSession{},
		&model.AIWorkbenchCopilotMessage{},
		&model.AIWorkbenchChangeProposal{},
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
	auth.POST("/apps", CreateAIApp)
	auth.POST("/app-assistant/proposals", CreateAIAppProposal)
	auth.GET("/workbench/copilot/session", GetWorkbenchCopilotSession)
	auth.GET("/workbench/copilot/sessions", ListWorkbenchCopilotSessions)
	auth.POST("/workbench/copilot/sessions", CreateWorkbenchCopilotSession)
	auth.PATCH("/workbench/copilot/proposals/:proposalId", UpdateWorkbenchCopilotProposal)
	auth.POST("/apps/:appId/versions", SaveAIAppVersion)
	auth.POST("/apps/:appId/restore", RestoreAIAppVersion)
	auth.POST("/apps/:appId/debug", DebugAIApp)
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
	auth.GET("/apps/:appId/conversations", ListAIAppConversations)
	auth.POST("/apps/:appId/conversations", CreateAIAppConversation)
	auth.GET("/apps/:appId/conversations/:conversationId", GetAIAppConversation)
	auth.DELETE("/apps/:appId/conversations/:conversationId", DeleteAIAppConversation)
	auth.POST("/apps/:appId/conversations/:conversationId/chat", ChatWithAIAppConversation)
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

	version := model.AIAppVersion{AppID: app.ID, Number: 1, Config: `{}`, ToolSnapshot: true}
	if err := db.Create(&version).Error; err != nil {
		t.Fatalf("create version: %v", err)
	}
	if err := db.Create(&model.AIAppVersionToolBinding{AppVersionID: version.ID, ToolName: "content.search"}).Error; err != nil {
		t.Fatalf("create tool binding: %v", err)
	}
	registry, names, err := resolveAIAppTools(db, app.ID, version)
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

func TestAppendContentSearchDateContext(t *testing.T) {
	now := time.Date(2026, time.July, 15, 16, 5, 6, 0, time.UTC)
	baseSystem := "仅根据私有资料回答。"

	got := appendContentSearchDateContext(baseSystem, []string{"content.search"}, now)
	want := baseSystem + "\n\n当前中国标准时间（CST，UTC+08:00）为 2026-07-16 00:05:06。调用 content.search 前，必须将用户的相对日期或未写年份、月份的日期换算为明确的 YYYY-MM-DD 日期范围后再调用工具。"
	if got != want {
		t.Fatalf("content.search system prompt = %q, want %q", got, want)
	}

	withoutSearch := appendContentSearchDateContext(baseSystem, []string{"blog.create_draft"}, now)
	if withoutSearch != baseSystem {
		t.Fatalf("system prompt without content.search = %q, want %q", withoutSearch, baseSystem)
	}
}

func TestAIAppContentSearchDateContextReachesARKOnlyWhenBound(t *testing.T) {
	router, db := setupAIPlatformTestRouter(t)
	var (
		requestMu sync.Mutex
		systems   []string
	)
	arkServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var payload struct {
			Messages []struct {
				Role    string `json:"role"`
				Content string `json:"content"`
			} `json:"messages"`
			Stream bool `json:"stream"`
		}
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			t.Errorf("decode ARK request: %v", err)
			http.Error(w, "invalid request", http.StatusBadRequest)
			return
		}
		for _, message := range payload.Messages {
			if message.Role == "system" {
				requestMu.Lock()
				systems = append(systems, message.Content)
				requestMu.Unlock()
				break
			}
		}
		if payload.Stream {
			w.Header().Set("Content-Type", "text/event-stream")
			_, _ = w.Write([]byte("data: {\"model\":\"ep-test\",\"choices\":[{\"delta\":{\"content\":\"integration reply\"}}]}\n\n"))
			_, _ = w.Write([]byte("data: [DONE]\n\n"))
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"model":"ep-test","choices":[{"message":{"role":"assistant","content":"integration reply"}}]}`))
	}))
	defer arkServer.Close()
	t.Setenv("ARK_API_KEY", "test-ark-key")
	t.Setenv("ARK_BASE_URL", arkServer.URL)
	t.Setenv("ARK_TEXT_MODEL", "ep-test")
	aiclient.ResetForTest()
	t.Cleanup(aiclient.ResetForTest)

	createAppVersion := func(name, system string, bindContentSearch bool) (model.AIApp, model.AIAppVersion) {
		t.Helper()
		app := model.AIApp{UserID: 101, Type: aiAppTypeAgent, Name: name}
		if err := db.Create(&app).Error; err != nil {
			t.Fatalf("create app: %v", err)
		}
		config, err := json.Marshal(map[string]string{"systemPrompt": system})
		if err != nil {
			t.Fatalf("marshal app config: %v", err)
		}
		version := model.AIAppVersion{AppID: app.ID, Number: 1, Config: string(config), ToolSnapshot: true, KnowledgeBaseSnapshot: true}
		if err := db.Create(&version).Error; err != nil {
			t.Fatalf("create version: %v", err)
		}
		if bindContentSearch {
			if err := db.Create(&model.AIAppVersionToolBinding{AppVersionID: version.ID, ToolName: "content.search"}).Error; err != nil {
				t.Fatalf("bind content.search: %v", err)
			}
		}
		if err := db.Model(&app).Update("draft_version_id", version.ID).Error; err != nil {
			t.Fatalf("set draft version: %v", err)
		}
		return app, version
	}
	lastSystem := func() string {
		t.Helper()
		requestMu.Lock()
		defer requestMu.Unlock()
		if len(systems) == 0 {
			t.Fatal("ARK request did not contain a system message")
		}
		return systems[len(systems)-1]
	}
	assertDateContext := func(system string) {
		t.Helper()
		if !strings.Contains(system, "当前中国标准时间") || !strings.Contains(system, "YYYY-MM-DD") {
			t.Fatalf("system message missing content.search date context: %q", system)
		}
	}

	conversationApp, _ := createAppVersion("私有会话日期助手", "private-conversation-system", true)
	createRequest := httptest.NewRequest(http.MethodPost, "/ai/apps/"+conversationApp.ID.String()+"/conversations", strings.NewReader(`{}`))
	createRequest.Header.Set("Content-Type", "application/json")
	createRequest.Header.Set("Authorization", aiPlatformAuthHeader(t))
	createRecorder := httptest.NewRecorder()
	router.ServeHTTP(createRecorder, createRequest)
	if createRecorder.Code != http.StatusOK {
		t.Fatalf("create conversation = %d body=%s", createRecorder.Code, createRecorder.Body.String())
	}
	var createPayload struct {
		Data struct {
			Conversation model.AIAppConversation `json:"conversation"`
		} `json:"data"`
	}
	if err := json.Unmarshal(createRecorder.Body.Bytes(), &createPayload); err != nil {
		t.Fatalf("decode conversation: %v", err)
	}
	chatRequest := httptest.NewRequest(http.MethodPost, "/ai/apps/"+conversationApp.ID.String()+"/conversations/"+createPayload.Data.Conversation.ID.String()+"/chat", strings.NewReader(`{"message":"今天发布了什么？"}`))
	chatRequest.Header.Set("Content-Type", "application/json")
	chatRequest.Header.Set("Authorization", aiPlatformAuthHeader(t))
	chatRecorder := httptest.NewRecorder()
	router.ServeHTTP(chatRecorder, chatRequest)
	if chatRecorder.Code != http.StatusOK {
		t.Fatalf("chat response = %d body=%s", chatRecorder.Code, chatRecorder.Body.String())
	}
	assertDateContext(lastSystem())

	debugApp, _ := createAppVersion("调试日期助手", "debug-system", true)
	debugRequest := httptest.NewRequest(http.MethodPost, "/ai/apps/"+debugApp.ID.String()+"/debug", strings.NewReader(`{"message":"昨天写了什么？"}`))
	debugRequest.Header.Set("Content-Type", "application/json")
	debugRequest.Header.Set("Authorization", aiPlatformAuthHeader(t))
	debugRecorder := httptest.NewRecorder()
	router.ServeHTTP(debugRecorder, debugRequest)
	if debugRecorder.Code != http.StatusOK {
		t.Fatalf("debug response = %d body=%s", debugRecorder.Code, debugRecorder.Body.String())
	}
	assertDateContext(lastSystem())

	unboundApp, _ := createAppVersion("无工具日期助手", "unbound-system", false)
	unboundRequest := httptest.NewRequest(http.MethodPost, "/ai/apps/"+unboundApp.ID.String()+"/debug", strings.NewReader(`{"message":"今天发布了什么？"}`))
	unboundRequest.Header.Set("Content-Type", "application/json")
	unboundRequest.Header.Set("Authorization", aiPlatformAuthHeader(t))
	unboundRecorder := httptest.NewRecorder()
	router.ServeHTTP(unboundRecorder, unboundRequest)
	if unboundRecorder.Code != http.StatusOK {
		t.Fatalf("unbound debug response = %d body=%s", unboundRecorder.Code, unboundRecorder.Body.String())
	}
	if system := lastSystem(); system != "unbound-system" {
		t.Fatalf("unbound system message = %q, want %q", system, "unbound-system")
	}
}

func TestCreateAIAppVersionSnapshotCopiesToolAllowlist(t *testing.T) {
	_, db := setupAIPlatformTestRouter(t)
	app := model.AIApp{UserID: 101, Type: aiAppTypeAgent, Name: "版本助手"}
	if err := db.Create(&app).Error; err != nil {
		t.Fatalf("create app: %v", err)
	}
	source := model.AIAppVersion{AppID: app.ID, Number: 1, Config: `{}`, RetrievalConfig: `{}`, KnowledgeBaseSnapshot: true, ToolSnapshot: true}
	if err := db.Create(&source).Error; err != nil {
		t.Fatalf("create source version: %v", err)
	}
	if err := db.Create(&model.AIAppVersionToolBinding{AppVersionID: source.ID, ToolName: "content.search"}).Error; err != nil {
		t.Fatalf("create source tool binding: %v", err)
	}
	var target model.AIAppVersion
	if err := db.Transaction(func(tx *gorm.DB) error {
		var err error
		target, err = createAIAppVersionSnapshot(tx, app, source.Config, defaultAIAppRetrievalConfig(), source)
		return err
	}); err != nil {
		t.Fatalf("create target version: %v", err)
	}
	var bindings []model.AIAppVersionToolBinding
	if err := db.Where("app_version_id = ?", target.ID).Find(&bindings).Error; err != nil {
		t.Fatalf("load target tool bindings: %v", err)
	}
	if !target.ToolSnapshot || len(bindings) != 1 || bindings[0].ToolName != "content.search" {
		t.Fatalf("unexpected target tool snapshot: %#v %#v", target, bindings)
	}
}

func TestAIAppConversationIsOwnerScopedAndRetainsUserMessageOnConfigFailure(t *testing.T) {
	router, db := setupAIPlatformTestRouter(t)
	t.Setenv("ARK_API_KEY", "")
	t.Setenv("ARK_TEXT_MODEL", "")
	app := model.AIApp{UserID: 101, Type: aiAppTypeAgent, Name: "私有助手"}
	if err := db.Create(&app).Error; err != nil {
		t.Fatalf("create app: %v", err)
	}
	version := model.AIAppVersion{AppID: app.ID, Number: 1, Config: `{"systemPrompt":"test"}`, ToolSnapshot: true, KnowledgeBaseSnapshot: true}
	if err := db.Create(&version).Error; err != nil {
		t.Fatalf("create version: %v", err)
	}
	if err := db.Model(&app).Update("draft_version_id", version.ID).Error; err != nil {
		t.Fatalf("set draft version: %v", err)
	}

	createRequest := httptest.NewRequest(http.MethodPost, "/ai/apps/"+app.ID.String()+"/conversations", strings.NewReader(`{}`))
	createRequest.Header.Set("Content-Type", "application/json")
	createRequest.Header.Set("Authorization", aiPlatformAuthHeader(t))
	createRecorder := httptest.NewRecorder()
	router.ServeHTTP(createRecorder, createRequest)
	if createRecorder.Code != http.StatusOK {
		t.Fatalf("create conversation = %d body=%s", createRecorder.Code, createRecorder.Body.String())
	}
	var createPayload struct {
		Data struct {
			Conversation model.AIAppConversation `json:"conversation"`
		} `json:"data"`
	}
	if err := json.Unmarshal(createRecorder.Body.Bytes(), &createPayload); err != nil {
		t.Fatalf("decode conversation: %v", err)
	}
	conversation := createPayload.Data.Conversation
	if conversation.VersionID != version.ID {
		t.Fatalf("conversation version = %d, want %d", conversation.VersionID, version.ID)
	}

	foreignRequest := httptest.NewRequest(http.MethodGet, "/ai/apps/"+app.ID.String()+"/conversations/"+conversation.ID.String(), nil)
	foreignRequest.Header.Set("Authorization", aiPlatformAuthHeaderFor(t, "202", "other-user"))
	foreignRecorder := httptest.NewRecorder()
	router.ServeHTTP(foreignRecorder, foreignRequest)
	if foreignRecorder.Code != http.StatusOK || !strings.Contains(foreignRecorder.Body.String(), `"code":404`) {
		t.Fatalf("foreign conversation read = %d body=%s", foreignRecorder.Code, foreignRecorder.Body.String())
	}

	chatRequest := httptest.NewRequest(http.MethodPost, "/ai/apps/"+app.ID.String()+"/conversations/"+conversation.ID.String()+"/chat", strings.NewReader(`{"message":"你好"}`))
	chatRequest.Header.Set("Content-Type", "application/json")
	chatRequest.Header.Set("Authorization", aiPlatformAuthHeader(t))
	chatRecorder := httptest.NewRecorder()
	router.ServeHTTP(chatRecorder, chatRequest)
	if chatRecorder.Code != http.StatusServiceUnavailable || !strings.Contains(chatRecorder.Body.String(), `"code":503`) || !strings.Contains(chatRecorder.Body.String(), `"errorCode":"ARK_NOT_CONFIGURED"`) {
		t.Fatalf("chat config failure = %d body=%s", chatRecorder.Code, chatRecorder.Body.String())
	}
	var messages []model.AIAppConversationMessage
	if err := db.Where("conversation_id = ?", conversation.ID).Find(&messages).Error; err != nil {
		t.Fatalf("load messages: %v", err)
	}
	if len(messages) != 1 || messages[0].Role != "user" || messages[0].Content != "你好" || messages[0].RunID == nil {
		t.Fatalf("unexpected messages: %#v", messages)
	}

	historyRequest := httptest.NewRequest(http.MethodGet, "/ai/apps/"+app.ID.String()+"/conversations/"+conversation.ID.String(), nil)
	historyRequest.Header.Set("Authorization", aiPlatformAuthHeader(t))
	historyRecorder := httptest.NewRecorder()
	router.ServeHTTP(historyRecorder, historyRequest)
	if historyRecorder.Code != http.StatusOK || !strings.Contains(historyRecorder.Body.String(), `"errorCode":"ARK_NOT_CONFIGURED"`) {
		t.Fatalf("conversation history = %d body=%s", historyRecorder.Code, historyRecorder.Body.String())
	}
}

func TestAIKnowledgeRetrievalFailureUsesStablePublicCodes(t *testing.T) {
	tests := []struct {
		err  error
		code string
	}{
		{errors.New("RAG requires PostgreSQL"), "RAG_POSTGRES_REQUIRED"},
		{errors.New("pgvector extension is not installed"), "RAG_PGVECTOR_UNAVAILABLE"},
		{errors.New("ERROR: different vector dimensions 1024 and 2048 (SQLSTATE 22000)"), "RAG_VECTOR_DIMENSION_MISMATCH"},
		{errors.New("ERROR: operator does not exist: vector <=> vector (SQLSTATE 42883)"), "RAG_VECTOR_OPERATOR_UNAVAILABLE"},
		{errors.New("ERROR: relation \"ai_knowledge_chunks\" does not exist (SQLSTATE 42P01)"), "RAG_SCHEMA_OUTDATED"},
		{errors.New("failed to connect to database"), "RAG_DATABASE_UNAVAILABLE"},
		{errors.New("AI 未配置：ARK_EMBEDDING_MODEL 必须以 ep- 开头"), "ARK_EMBEDDING_NOT_CONFIGURED"},
		{errors.New("ARK embedding 调用失败: upstream"), "ARK_EMBEDDING_FAILED"},
		{errors.New("unexpected database error"), "RAG_QUERY_FAILED"},
	}

	for _, test := range tests {
		code, message := aiKnowledgeRetrievalFailure(test.err)
		if code != test.code || message == "" {
			t.Fatalf("retrieval error %q = (%q, %q)", test.err, code, message)
		}
	}
}

func TestAIAppConversationStreamsOwnerScopedToolTraceWithoutRawResults(t *testing.T) {
	router, db := setupAIPlatformTestRouter(t)
	var requestCount int
	arkServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		requestCount++
		w.Header().Set("Content-Type", "text/event-stream")
		if requestCount == 1 {
			_, _ = w.Write([]byte("data: {\"model\":\"ep-test\",\"choices\":[{\"delta\":{\"tool_calls\":[{\"index\":0,\"id\":\"call-1\",\"type\":\"function\",\"function\":{\"name\":\"content.search\",\"arguments\":\"{\\\"query\\\":\\\"P8\\\"}\"}}]}}]}\n\n"))
			_, _ = w.Write([]byte("data: [DONE]\n\n"))
			return
		}
		_, _ = w.Write([]byte("data: {\"model\":\"ep-test\",\"choices\":[{\"delta\":{\"content\":\"已找到私有资料。\"}}]}\n\n"))
		_, _ = w.Write([]byte("data: [DONE]\n\n"))
	}))
	defer arkServer.Close()
	t.Setenv("ARK_API_KEY", "test-ark-key")
	t.Setenv("ARK_BASE_URL", arkServer.URL)
	t.Setenv("ARK_TEXT_MODEL", "ep-test")
	aiclient.ResetForTest()
	t.Cleanup(aiclient.ResetForTest)

	app := model.AIApp{UserID: 101, Type: aiAppTypeAgent, Name: "私有检索助手"}
	if err := db.Create(&app).Error; err != nil {
		t.Fatalf("create app: %v", err)
	}
	version := model.AIAppVersion{AppID: app.ID, Number: 1, Config: `{"systemPrompt":"仅回答自己的内容"}`, ToolSnapshot: true, KnowledgeBaseSnapshot: true}
	if err := db.Create(&version).Error; err != nil {
		t.Fatalf("create version: %v", err)
	}
	if err := db.Create(&model.AIAppVersionToolBinding{AppVersionID: version.ID, ToolName: "content.search"}).Error; err != nil {
		t.Fatalf("create tool binding: %v", err)
	}
	if err := db.Model(&app).Update("draft_version_id", version.ID).Error; err != nil {
		t.Fatalf("set draft version: %v", err)
	}
	if err := db.Create(&[]model.Post{
		{AuthorID: 101, Title: "P8 私有资料", Slug: "owner-p8", Excerpt: "仅 owner 可见", Content: "P8 已完成"},
		{AuthorID: 202, Title: "P8 他人资料", Slug: "foreign-p8", Excerpt: "不得泄露", Content: "secret"},
	}).Error; err != nil {
		t.Fatalf("seed posts: %v", err)
	}

	createRequest := httptest.NewRequest(http.MethodPost, "/ai/apps/"+app.ID.String()+"/conversations", strings.NewReader(`{}`))
	createRequest.Header.Set("Content-Type", "application/json")
	createRequest.Header.Set("Authorization", aiPlatformAuthHeader(t))
	createRecorder := httptest.NewRecorder()
	router.ServeHTTP(createRecorder, createRequest)
	if createRecorder.Code != http.StatusOK {
		t.Fatalf("create conversation = %d body=%s", createRecorder.Code, createRecorder.Body.String())
	}
	var createPayload struct {
		Data struct {
			Conversation model.AIAppConversation `json:"conversation"`
		} `json:"data"`
	}
	if err := json.Unmarshal(createRecorder.Body.Bytes(), &createPayload); err != nil {
		t.Fatalf("decode conversation: %v", err)
	}
	conversation := createPayload.Data.Conversation

	chatRequest := httptest.NewRequest(http.MethodPost, "/ai/apps/"+app.ID.String()+"/conversations/"+conversation.ID.String()+"/chat", strings.NewReader(`{"message":"P8","stream":true}`))
	chatRequest.Header.Set("Content-Type", "application/json")
	chatRequest.Header.Set("Authorization", aiPlatformAuthHeader(t))
	chatRecorder := httptest.NewRecorder()
	router.ServeHTTP(chatRecorder, chatRequest)
	if chatRecorder.Code != http.StatusOK {
		t.Fatalf("chat response = %d body=%s", chatRecorder.Code, chatRecorder.Body.String())
	}
	if !strings.Contains(chatRecorder.Body.String(), `"type":"done"`) {
		t.Fatalf("expected SSE done event, got %s", chatRecorder.Body.String())
	}
	if strings.Contains(chatRecorder.Body.String(), "不得泄露") || strings.Contains(chatRecorder.Body.String(), "secret") {
		t.Fatalf("SSE leaked foreign tool result: %s", chatRecorder.Body.String())
	}
	var traces []model.AIAppConversationToolTrace
	if err := db.Where("conversation_id = ?", conversation.ID).Find(&traces).Error; err != nil {
		t.Fatalf("load traces: %v", err)
	}
	if len(traces) != 1 || traces[0].ToolName != "content.search" || traces[0].Status != "succeeded" {
		t.Fatalf("unexpected safe tool trace: %#v", traces)
	}
	if requestCount != 2 {
		t.Fatalf("ARK request count = %d, want 2", requestCount)
	}
}

func TestAIAppConversationStreamsUpstreamFailureWithoutAssistantMessage(t *testing.T) {
	router, db := setupAIPlatformTestRouter(t)
	arkServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		http.Error(w, "upstream unavailable", http.StatusBadGateway)
	}))
	defer arkServer.Close()
	t.Setenv("ARK_API_KEY", "test-ark-key")
	t.Setenv("ARK_BASE_URL", arkServer.URL)
	t.Setenv("ARK_TEXT_MODEL", "ep-test")
	aiclient.ResetForTest()
	t.Cleanup(aiclient.ResetForTest)

	app := model.AIApp{UserID: 101, Type: aiAppTypeAgent, Name: "失败路径助手"}
	if err := db.Create(&app).Error; err != nil {
		t.Fatalf("create app: %v", err)
	}
	version := model.AIAppVersion{AppID: app.ID, Number: 1, Config: `{"systemPrompt":"test"}`, ToolSnapshot: true, KnowledgeBaseSnapshot: true}
	if err := db.Create(&version).Error; err != nil {
		t.Fatalf("create version: %v", err)
	}
	if err := db.Model(&app).Update("draft_version_id", version.ID).Error; err != nil {
		t.Fatalf("set draft version: %v", err)
	}
	conversation := model.AIAppConversation{UserID: 101, AppID: app.ID, VersionID: version.ID}
	if err := db.Create(&conversation).Error; err != nil {
		t.Fatalf("create conversation: %v", err)
	}

	request := httptest.NewRequest(http.MethodPost, "/ai/apps/"+app.ID.String()+"/conversations/"+conversation.ID.String()+"/chat", strings.NewReader(`{"message":"测试失败","stream":true}`))
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Authorization", aiPlatformAuthHeader(t))
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, request)
	if recorder.Code != http.StatusOK || !strings.Contains(recorder.Body.String(), `"type":"error"`) {
		t.Fatalf("expected SSE error event, got code=%d body=%s", recorder.Code, recorder.Body.String())
	}
	var run model.AIAppRun
	if err := db.Where("conversation_id = ?", conversation.ID).First(&run).Error; err != nil {
		t.Fatalf("load run: %v", err)
	}
	if run.Status != "failed" || run.ErrorCode != "AI_AGENT_RUN_FAILED" {
		t.Fatalf("unexpected upstream failure run: %#v", run)
	}
	var messages []model.AIAppConversationMessage
	if err := db.Where("conversation_id = ?", conversation.ID).Find(&messages).Error; err != nil {
		t.Fatalf("load messages: %v", err)
	}
	if len(messages) != 1 || messages[0].Role != "user" {
		t.Fatalf("upstream failure must retain only user message: %#v", messages)
	}
}

func TestAIAppConversationCancellationWritesCancelledRunWithoutAssistantMessage(t *testing.T) {
	router, db := setupAIPlatformTestRouter(t)
	t.Setenv("ARK_API_KEY", "test-ark-key")
	t.Setenv("ARK_TEXT_MODEL", "ep-test")
	aiclient.ResetForTest()
	t.Cleanup(aiclient.ResetForTest)

	app := model.AIApp{UserID: 101, Type: aiAppTypeAgent, Name: "取消路径助手"}
	if err := db.Create(&app).Error; err != nil {
		t.Fatalf("create app: %v", err)
	}
	version := model.AIAppVersion{AppID: app.ID, Number: 1, Config: `{"systemPrompt":"test"}`, ToolSnapshot: true, KnowledgeBaseSnapshot: true}
	if err := db.Create(&version).Error; err != nil {
		t.Fatalf("create version: %v", err)
	}
	if err := db.Model(&app).Update("draft_version_id", version.ID).Error; err != nil {
		t.Fatalf("set draft version: %v", err)
	}
	conversation := model.AIAppConversation{UserID: 101, AppID: app.ID, VersionID: version.ID}
	if err := db.Create(&conversation).Error; err != nil {
		t.Fatalf("create conversation: %v", err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	request := httptest.NewRequest(http.MethodPost, "/ai/apps/"+app.ID.String()+"/conversations/"+conversation.ID.String()+"/chat", strings.NewReader(`{"message":"测试取消","stream":true}`)).WithContext(ctx)
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Authorization", aiPlatformAuthHeader(t))
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, request)
	if recorder.Code != http.StatusOK || !strings.Contains(recorder.Body.String(), "会话生成已停止") {
		t.Fatalf("expected cancelled SSE error event, got code=%d body=%s", recorder.Code, recorder.Body.String())
	}
	var run model.AIAppRun
	if err := db.Where("conversation_id = ?", conversation.ID).First(&run).Error; err != nil {
		t.Fatalf("load run: %v", err)
	}
	if run.Status != "cancelled" || run.ErrorCode != "RUN_CANCELLED" {
		t.Fatalf("unexpected cancelled run: %#v", run)
	}
	var messages []model.AIAppConversationMessage
	if err := db.Where("conversation_id = ?", conversation.ID).Find(&messages).Error; err != nil {
		t.Fatalf("load messages: %v", err)
	}
	if len(messages) != 1 || messages[0].Role != "user" {
		t.Fatalf("cancellation must retain only user message: %#v", messages)
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
