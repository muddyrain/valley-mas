package handler

import (
	"bytes"
	"errors"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os/exec"
	"strconv"
	"strings"
	"testing"
	"time"

	"valley-server/internal/aiclient"
	"valley-server/internal/aimodel"
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
		&model.AIAppRun{},
		&model.AIImageGeneration{},
		&model.AIImageConversation{},
		&model.AIImageConversationMessage{},
		&model.AIModel{},
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
		&model.AIWorkbenchCopilotRun{},
		&model.AIWorkbenchCopilotRunEvent{},
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
	auth.POST("/prompt-assistant/suggestions", CreatePromptAssistantSuggestion)
	auth.GET("/workbench/copilot/session", GetWorkbenchCopilotSession)
	auth.GET("/workbench/copilot/sessions", ListWorkbenchCopilotSessions)
	auth.POST("/workbench/copilot/sessions", CreateWorkbenchCopilotSession)
	auth.POST("/workbench/copilot/messages/stream", StreamWorkbenchCopilotMessage)
	auth.GET("/workbench/copilot/runs/:runId/events", StreamWorkbenchCopilotRunEvents)
	auth.POST("/workbench/copilot/runs/:runId/cancel", CancelWorkbenchCopilotRun)
	auth.PATCH("/workbench/copilot/proposals/:proposalId", UpdateWorkbenchCopilotProposal)
	auth.GET("/knowledge-bases", ListAIKnowledgeBases)
	auth.GET("/knowledge-bases/:knowledgeBaseId/documents", ListAIKnowledgeDocuments)
	auth.GET("/knowledge-bases/:knowledgeBaseId/documents/:documentId/chunks", ListAIKnowledgeDocumentChunks)
	auth.POST("/knowledge-bases/:knowledgeBaseId/retrieval-tests", TestAIKnowledgeRetrieval)
	auth.POST("/knowledge-bases/:knowledgeBaseId/documents", UploadAIKnowledgeDocument)
	auth.DELETE("/knowledge-bases/:knowledgeBaseId/documents/:documentId", DeleteAIKnowledgeDocument)
	auth.DELETE("/knowledge-bases/:knowledgeBaseId", DeleteAIKnowledgeBase)
	auth.GET("/apps/:appId/knowledge-bases", ListAIAppKnowledgeBases)
	auth.PUT("/apps/:appId/knowledge-bases", ReplaceAIAppKnowledgeBases)
	auth.GET("/image-conversations", ListAIImageConversations)
	auth.GET("/image-conversations/current", GetCurrentAIImageConversation)
	auth.DELETE("/image-conversations/current", ClearCurrentAIImageConversation)
	auth.POST("/image-conversations", CreateAIImageConversation)
	auth.GET("/image-conversations/:conversationId", GetAIImageConversation)
	auth.DELETE("/image-conversations/:conversationId/messages", ClearAIImageConversation)
	auth.POST("/image-conversations/:conversationId/messages", AddAIImageConversationMessage)
	return router, db
}

func createAIPlatformCatalogModel(t *testing.T, db *gorm.DB, capabilities ...string) model.AIModel {
	t.Helper()
	item := model.AIModel{
		Provider:     "siliconflow",
		ModelID:      "ep-test",
		DisplayName:  "Catalog test model",
		Capabilities: aimodel.EncodeStrings(capabilities),
		Enabled:      true,
	}
	if err := db.Create(&item).Error; err != nil {
		t.Fatalf("seed catalog model: %v", err)
	}
	return item
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


func TestCreateAIKnowledgeTextDocumentSharesWorkflowIngestionContract(t *testing.T) {
	_, db := setupAIPlatformTestRouter(t)
	base := model.AIKnowledgeBase{UserID: 101, Name: "工作流资料"}
	if err := db.Create(&base).Error; err != nil {
		t.Fatal(err)
	}
	content := "第一段内容。\n\n第二段内容。"
	document, err := createAIKnowledgeTextDocument(
		db,
		101,
		base.ID,
		"自动生成总结",
		content,
		"text/plain; charset=utf-8",
		int64(len(content)),
	)
	if err != nil {
		t.Fatal(err)
	}
	if document.Status != "pending_embedding" || document.ChunkCount == 0 {
		t.Fatalf("document=%+v", document)
	}
	var chunks []model.AIKnowledgeChunk
	if err := db.Where("document_id = ?", document.ID).Find(&chunks).Error; err != nil || len(chunks) != document.ChunkCount {
		t.Fatalf("chunks=%d err=%v", len(chunks), err)
	}
	if _, err := createAIKnowledgeTextDocument(db, 202, base.ID, "越权", "不应写入", "text/plain", 12); !errors.Is(err, gorm.ErrRecordNotFound) {
		t.Fatalf("cross-owner err=%v", err)
	}
}



func TestCancelWorkbenchCopilotRunRequiresOwnerAndSignalsActiveRun(t *testing.T) {
	router, db := setupAIPlatformTestRouter(t)
	run := model.AIWorkbenchCopilotRun{SessionID: 1, UserID: 101, Scope: "workbench", Status: "running"}
	if err := db.Create(&run).Error; err != nil {
		t.Fatal(err)
	}
	context, release := activeCopilotRuns.Start(run.ID.String(), time.Second)
	defer release()

	other := httptest.NewRequest(http.MethodPost, "/ai/workbench/copilot/runs/"+run.ID.String()+"/cancel", nil)
	other.Header.Set("Authorization", aiPlatformAuthHeaderFor(t, "202", "other-user"))
	otherRecorder := httptest.NewRecorder()
	router.ServeHTTP(otherRecorder, other)
	if responseCode(otherRecorder) != http.StatusNotFound {
		t.Fatalf("other owner response=%s", otherRecorder.Body.String())
	}

	request := httptest.NewRequest(http.MethodPost, "/ai/workbench/copilot/runs/"+run.ID.String()+"/cancel", nil)
	request.Header.Set("Authorization", aiPlatformAuthHeader(t))
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, request)
	if responseCode(recorder) != 0 || !strings.Contains(recorder.Body.String(), "cancelling") {
		t.Fatalf("response=%s", recorder.Body.String())
	}
	select {
	case <-context.Done():
	case <-time.After(time.Second):
		t.Fatal("copilot run context was not cancelled")
	}
}



func TestStreamWorkbenchCopilotRunEventsReplaysMissingOwnerEvents(t *testing.T) {
	router, db := setupAIPlatformTestRouter(t)
	run := model.AIWorkbenchCopilotRun{SessionID: 1, UserID: 101, Scope: "workbench", Status: "completed"}
	if err := db.Create(&run).Error; err != nil {
		t.Fatal(err)
	}
	for _, event := range []model.AIWorkbenchCopilotRunEvent{
		{RunID: run.ID, Sequence: 1, EventType: "stage", Stage: copilotStageReadingContext, Message: "正在读取当前草稿与可用能力"},
		{RunID: run.ID, Sequence: 2, EventType: "terminal", Stage: copilotStageCompleted},
	} {
		if err := db.Create(&event).Error; err != nil {
			t.Fatal(err)
		}
	}

	request := httptest.NewRequest(http.MethodGet, "/ai/workbench/copilot/runs/"+run.ID.String()+"/events", nil)
	request.Header.Set("Authorization", aiPlatformAuthHeader(t))
	request.Header.Set("Last-Event-ID", "1")
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, request)
	if recorder.Code != http.StatusOK {
		t.Fatalf("response=%s", recorder.Body.String())
	}
	body := recorder.Body.String()
	if !strings.Contains(body, "id: 2") || strings.Contains(body, "id: 1") || !strings.Contains(body, `"type":"done"`) {
		t.Fatalf("stream=%s", body)
	}

	other := httptest.NewRequest(http.MethodGet, "/ai/workbench/copilot/runs/"+run.ID.String()+"/events", nil)
	other.Header.Set("Authorization", aiPlatformAuthHeaderFor(t, "202", "other-user"))
	otherRecorder := httptest.NewRecorder()
	router.ServeHTTP(otherRecorder, other)
	if responseCode(otherRecorder) != http.StatusNotFound {
		t.Fatalf("other owner response=%s", otherRecorder.Body.String())
	}
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



func TestUploadAIKnowledgeDocumentQueuesPDFVisionParsing(t *testing.T) {
	router, db := setupAIPlatformTestRouter(t)
	previousSchedule := scheduleAIKnowledgeDocumentIndexing
	scheduleAIKnowledgeDocumentIndexing = func(model.Int64String) {}
	t.Cleanup(func() { scheduleAIKnowledgeDocumentIndexing = previousSchedule })
	t.Setenv("ARK_API_KEY", "test-key")
	base := model.AIKnowledgeBase{UserID: 101, Name: "视觉 PDF 资料"}
	vision := model.AIModel{Provider: "ark", ModelID: "vision-test", DisplayName: "视觉测试模型", Capabilities: aimodel.EncodeStrings([]string{"vision"}), VerifiedCapabilities: aimodel.EncodeStrings([]string{"vision"}), Enabled: true}
	if err := db.Create(&base).Error; err != nil {
		t.Fatalf("create knowledge base: %v", err)
	}
	if err := db.Create(&vision).Error; err != nil {
		t.Fatalf("create vision model: %v", err)
	}

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	if err := writer.WriteField("visionModelId", vision.ID.String()); err != nil {
		t.Fatalf("write vision model: %v", err)
	}
	part, err := writer.CreateFormFile("file", "scan.pdf")
	if err != nil {
		t.Fatalf("create multipart file: %v", err)
	}
	content := plainTextPDF("visual PDF knowledge content")
	if _, err := part.Write(content); err != nil {
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
	if document.Status != "pending_parse" || document.VisionModelID != vision.ID.String() || !bytes.Equal(document.SourceContent, content) {
		t.Fatalf("unexpected document = %#v", document)
	}
}



func TestSplitAIKnowledgeSectionsPreservesPageAndSource(t *testing.T) {
	chunks := splitAIKnowledgeSections([]aiKnowledgeSection{
		{pageNumber: 2, sourceType: "text", content: "第一段\n\n第二段"},
		{pageNumber: 3, sourceType: "visual", content: "| 名称 | 数量 |\n| --- | --- |\n| 苹果 | 2 |"},
	})
	if len(chunks) != 2 {
		t.Fatalf("chunk count = %d, want 2", len(chunks))
	}
	if chunks[0].pageNumber != 2 || chunks[0].sourceType != "text" || !strings.HasPrefix(chunks[0].content, "第 2 页\n") {
		t.Fatalf("unexpected text chunk = %#v", chunks[0])
	}
	if chunks[1].pageNumber != 3 || chunks[1].sourceType != "visual" || !strings.Contains(chunks[1].content, "| --- | --- |\n| 苹果 | 2 |") {
		t.Fatalf("unexpected visual chunk = %#v", chunks[1])
	}
}



func TestPrepareAIKnowledgeDocumentChunksAddsVisualPageMetadata(t *testing.T) {
	_, db := setupAIPlatformTestRouter(t)
	t.Setenv("ARK_API_KEY", "test-key")
	previousRender := renderAIKnowledgePDFPages
	previousAnalyze := analyzeAIKnowledgePDFPage
	renderAIKnowledgePDFPages = func([]byte) ([][]byte, error) {
		return [][]byte{[]byte("rendered page")}, nil
	}
	analyzeAIKnowledgePDFPage = func(_ aimodel.Invocation, _ model.Int64String, pageNumber int, _ []byte, nativeText string) (string, error) {
		if pageNumber != 1 || !strings.Contains(nativeText, "PDF knowledge content") {
			t.Fatalf("unexpected visual input page=%d text=%q", pageNumber, nativeText)
		}
		return "| 项目 | 数量 |\n| --- | --- |\n| 苹果 | 2 |", nil
	}
	t.Cleanup(func() {
		renderAIKnowledgePDFPages = previousRender
		analyzeAIKnowledgePDFPage = previousAnalyze
	})
	base := model.AIKnowledgeBase{UserID: 101, Name: "多模态资料"}
	vision := model.AIModel{Provider: "ark", ModelID: "vision-test", DisplayName: "视觉测试模型", Capabilities: aimodel.EncodeStrings([]string{"vision"}), VerifiedCapabilities: aimodel.EncodeStrings([]string{"vision"}), Enabled: true}
	if err := db.Create(&base).Error; err != nil {
		t.Fatalf("create base: %v", err)
	}
	if err := db.Create(&vision).Error; err != nil {
		t.Fatalf("create vision model: %v", err)
	}
	document := model.AIKnowledgeDocument{
		KnowledgeBaseID: base.ID,
		UserID:          101,
		Name:            "report.pdf",
		Status:          "pending_parse",
		VisionModelID:   vision.ID.String(),
		SourceContent:   plainTextPDF("PDF knowledge content"),
	}
	if err := db.Create(&document).Error; err != nil {
		t.Fatalf("create document: %v", err)
	}
	if err := prepareAIKnowledgeDocumentChunks(db, document.ID); err != nil {
		t.Fatalf("prepare PDF chunks: %v", err)
	}
	var chunks []model.AIKnowledgeChunk
	if err := db.Where("document_id = ?", document.ID).Order("position ASC").Find(&chunks).Error; err != nil {
		t.Fatalf("load chunks: %v", err)
	}
	if len(chunks) != 2 {
		t.Fatalf("chunk count = %d, want 2", len(chunks))
	}
	if chunks[0].PageNumber != 1 || chunks[0].SourceType != "text" {
		t.Fatalf("unexpected native chunk = %#v", chunks[0])
	}
	if chunks[1].PageNumber != 1 || chunks[1].SourceType != "visual" || !strings.Contains(chunks[1].Content, "苹果") {
		t.Fatalf("unexpected visual chunk = %#v", chunks[1])
	}
}



func TestRenderAIKnowledgePDFPagesWithInstalledPoppler(t *testing.T) {
	if _, err := exec.LookPath("pdftocairo"); err != nil {
		t.Skip("pdftocairo 未安装；部署环境安装 Poppler 后执行真实渲染验证")
	}
	pages, err := renderAIKnowledgePDFPagesWithPoppler(plainTextPDF("rendered PDF knowledge content"))
	if err != nil {
		t.Fatalf("render PDF pages: %v", err)
	}
	if len(pages) != 1 || len(pages[0]) == 0 {
		t.Fatalf("pages = %d, want one non-empty page", len(pages))
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



func TestCreateAIAppVersionSnapshotCopiesToolAllowlist(t *testing.T) {
	_, db := setupAIPlatformTestRouter(t)
	app := model.AIApp{UserID: 101, Type: aiAppTypeWorkflow, Name: "版本助手"}
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



func TestReplaceAIAppKnowledgeBasesPreservesDraftToolBindings(t *testing.T) {
	router, db := setupAIPlatformTestRouter(t)
	app := model.AIApp{UserID: 101, Type: aiAppTypeWorkflow, Name: "创作助手"}
	if err := db.Create(&app).Error; err != nil {
		t.Fatalf("create app: %v", err)
	}
	source := model.AIAppVersion{
		AppID: app.ID, Number: 1, Config: `{}`, RetrievalConfig: `{}`,
		KnowledgeBaseSnapshot: true, ToolSnapshot: true,
	}
	if err := db.Create(&source).Error; err != nil {
		t.Fatalf("create source version: %v", err)
	}
	if err := db.Create(&model.AIAppVersionToolBinding{AppVersionID: source.ID, ToolName: "image.convert", ApprovalMode: "auto"}).Error; err != nil {
		t.Fatalf("create source tool binding: %v", err)
	}
	knowledgeBase := model.AIKnowledgeBase{UserID: 101, Name: "创作资料"}
	if err := db.Create(&knowledgeBase).Error; err != nil {
		t.Fatalf("create knowledge base: %v", err)
	}
	if err := db.Model(&app).Update("draft_version_id", source.ID).Error; err != nil {
		t.Fatalf("set draft version: %v", err)
	}

	request := httptest.NewRequest(
		http.MethodPut,
		"/ai/apps/"+app.ID.String()+"/knowledge-bases",
		strings.NewReader(`{"knowledgeBaseIds":["`+knowledgeBase.ID.String()+`"]}`),
	)
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Authorization", aiPlatformAuthHeader(t))
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, request)
	if recorder.Code != http.StatusOK {
		t.Fatalf("replace knowledge bases = %d body=%s", recorder.Code, recorder.Body.String())
	}
	if err := db.First(&app, app.ID).Error; err != nil {
		t.Fatalf("reload app: %v", err)
	}
	var bindings []model.AIAppVersionToolBinding
	if err := db.Where("app_version_id = ?", app.DraftVersionID).Find(&bindings).Error; err != nil {
		t.Fatalf("load copied tool bindings: %v", err)
	}
	if len(bindings) != 1 || bindings[0].ToolName != "image.convert" || bindings[0].ApprovalMode != "auto" {
		t.Fatalf("tool bindings were lost: %#v", bindings)
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
		{aimodel.ErrEmbeddingModelUnavailable, "RAG_EMBEDDING_MODEL_UNAVAILABLE"},
		{aimodel.ErrEmbeddingMetadataUnavailable, "RAG_EMBEDDING_REINDEX_REQUIRED"},
		{aimodel.ErrEmbeddingIdentityMismatch, "RAG_EMBEDDING_MODEL_MISMATCH"},
		{fmt.Errorf("%w: missing provider key", aimodel.ErrEmbeddingProviderUnavailable), "RAG_EMBEDDING_PROVIDER_UNAVAILABLE"},
		{fmt.Errorf("%w: provider timeout", aimodel.ErrEmbeddingRequestFailed), "RAG_EMBEDDING_FAILED"},
		{fmt.Errorf("%w: stored=1024", aimodel.ErrEmbeddingDimensionUnavailable), "RAG_VECTOR_DIMENSION_MISMATCH"},
		{errors.New("AI 未配置：ARK_EMBEDDING_MODEL 必须以 ep- 开头"), "ARK_EMBEDDING_NOT_CONFIGURED"},
		{errors.New(aiclient.LegacyARKModelUnavailableMessage), "ARK_EMBEDDING_NOT_CONFIGURED"},
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



func TestCurrentAIKnowledgeEmbeddingIdentityRequiresOneKnownModel(t *testing.T) {
	t.Setenv("SILICONFLOW_API_KEY", "test-key")
	_, db := setupAIPlatformTestRouter(t)
	embeddingModel := model.AIModel{
		ID: 22, Provider: "siliconflow", ModelID: "stored-model", DisplayName: "Stored model",
		Capabilities: aimodel.EncodeStrings([]string{"embedding"}), VerifiedCapabilities: aimodel.EncodeStrings([]string{"embedding"}),
		EmbeddingDimension: 1024, Enabled: true,
	}
	if err := db.Create(&embeddingModel).Error; err != nil {
		t.Fatal(err)
	}
	base := model.AIKnowledgeBase{UserID: 101, Name: "Identity base"}
	if err := db.Create(&base).Error; err != nil {
		t.Fatal(err)
	}
	documents := []model.AIKnowledgeDocument{
		{KnowledgeBaseID: base.ID, UserID: 101, Name: "one.md", Status: "ready", EmbeddingModelID: 22, EmbeddingDimension: 1024},
		{KnowledgeBaseID: base.ID, UserID: 101, Name: "two.md", Status: "ready", EmbeddingModelID: 22, EmbeddingDimension: 1024},
	}
	if err := db.Create(&documents).Error; err != nil {
		t.Fatal(err)
	}

	modelID, dimension, err := currentAIKnowledgeEmbeddingIdentity(db, 101, []model.Int64String{base.ID})
	if err != nil || modelID != 22 || dimension != 1024 {
		t.Fatalf("identity = model %s dimension %d err=%v", modelID, dimension, err)
	}
	pendingDocument := model.AIKnowledgeDocument{KnowledgeBaseID: base.ID, UserID: 101, Name: "new.md", Status: "pending_embedding"}
	invocation, err := resolveAIKnowledgeIndexInvocation(db, pendingDocument)
	if err != nil || invocation.Model.ID != 22 {
		t.Fatalf("index invocation = model %s err=%v", invocation.Model.ID, err)
	}

	if err := db.Model(&documents[1]).Updates(map[string]any{"embedding_model_id": 23, "embedding_dimension": 1024}).Error; err != nil {
		t.Fatal(err)
	}
	if _, _, err := currentAIKnowledgeEmbeddingIdentity(db, 101, []model.Int64String{base.ID}); !errors.Is(err, aimodel.ErrEmbeddingIdentityMismatch) {
		t.Fatalf("mixed model identity error = %v", err)
	}

	if err := db.Model(&documents[1]).Updates(map[string]any{"embedding_model_id": 0, "embedding_dimension": 0}).Error; err != nil {
		t.Fatal(err)
	}
	if _, _, err := currentAIKnowledgeEmbeddingIdentity(db, 101, []model.Int64String{base.ID}); !errors.Is(err, aimodel.ErrEmbeddingMetadataUnavailable) {
		t.Fatalf("missing model identity error = %v", err)
	}
}



func TestAIKnowledgeSearchQueryExcludesSoftDeletedRows(t *testing.T) {
	for _, scope := range []string{
		"chunks.deleted_at IS NULL",
		"documents.deleted_at IS NULL",
		"knowledge_bases.deleted_at IS NULL",
	} {
		if !strings.Contains(aiKnowledgeSearchQuery, scope) {
			t.Fatalf("knowledge search query is missing owner-visible scope %q", scope)
		}
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



func TestListAIKnowledgeDocumentChunksReturnsOrderedSafePreviews(t *testing.T) {
	router, db := setupAIPlatformTestRouter(t)
	base := model.AIKnowledgeBase{UserID: 101, Name: "创作资料"}
	if err := db.Create(&base).Error; err != nil {
		t.Fatalf("create knowledge base: %v", err)
	}
	document := model.AIKnowledgeDocument{KnowledgeBaseID: base.ID, UserID: 101, Name: "notes.md", Status: "ready", IndexProgress: 100}
	if err := db.Create(&document).Error; err != nil {
		t.Fatalf("create document: %v", err)
	}
	first := model.AIKnowledgeChunk{DocumentID: document.ID, UserID: 101, Position: 0, Content: strings.Repeat("甲", 900), TokenCount: 900}
	second := model.AIKnowledgeChunk{DocumentID: document.ID, UserID: 101, Position: 1, Content: "第二段", TokenCount: 3}
	if err := db.Create(&[]model.AIKnowledgeChunk{first, second}).Error; err != nil {
		t.Fatalf("create chunks: %v", err)
	}
	req := httptest.NewRequest(http.MethodGet, "/ai/knowledge-bases/"+strconv.FormatInt(int64(base.ID), 10)+"/documents/"+strconv.FormatInt(int64(document.ID), 10)+"/chunks", nil)
	req.Header.Set("Authorization", aiPlatformAuthHeader(t))
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("list previews response = %d body=%s", rec.Code, rec.Body.String())
	}
	var response struct {
		Code int `json:"code"`
		Data struct {
			Document struct {
				Source string `json:"source"`
			} `json:"document"`
			List []struct {
				Position int    `json:"position"`
				Content  string `json:"content"`
			} `json:"list"`
		} `json:"data"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &response); err != nil {
		t.Fatalf("decode preview response: %v", err)
	}
	if response.Data.Document.Source != "upload" {
		t.Fatalf("source = %q, want upload", response.Data.Document.Source)
	}
	if len(response.Data.List) != 2 || response.Data.List[0].Position != 0 || response.Data.List[1].Position != 1 {
		t.Fatalf("previews not ordered: %#v", response.Data.List)
	}
	if got := len([]rune(response.Data.List[0].Content)); got != 800 {
		t.Fatalf("preview runes = %d, want 800", got)
	}
}



func TestListAIKnowledgeDocumentChunksRejectsForeignDocument(t *testing.T) {
	router, db := setupAIPlatformTestRouter(t)
	base := model.AIKnowledgeBase{UserID: 202, Name: "他人的资料"}
	if err := db.Create(&base).Error; err != nil {
		t.Fatalf("create foreign base: %v", err)
	}
	document := model.AIKnowledgeDocument{KnowledgeBaseID: base.ID, UserID: 202, Name: "private.md"}
	if err := db.Create(&document).Error; err != nil {
		t.Fatalf("create foreign document: %v", err)
	}
	req := httptest.NewRequest(http.MethodGet, "/ai/knowledge-bases/"+strconv.FormatInt(int64(base.ID), 10)+"/documents/"+strconv.FormatInt(int64(document.ID), 10)+"/chunks", nil)
	req.Header.Set("Authorization", aiPlatformAuthHeader(t))
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), `"code":404`) {
		t.Fatalf("foreign preview response = %d body=%s", rec.Code, rec.Body.String())
	}
}



func TestListAIKnowledgeBasesIncludesOwnedDocumentCount(t *testing.T) {
	router, db := setupAIPlatformTestRouter(t)
	base := model.AIKnowledgeBase{UserID: 101, Name: "创作资料"}
	emptyBase := model.AIKnowledgeBase{UserID: 101, Name: "空知识库"}
	foreignBase := model.AIKnowledgeBase{UserID: 202, Name: "他人的资料"}
	for _, item := range []*model.AIKnowledgeBase{&base, &emptyBase, &foreignBase} {
		if err := db.Create(item).Error; err != nil {
			t.Fatalf("create knowledge base: %v", err)
		}
	}
	if err := db.Create(&[]model.AIKnowledgeDocument{
		{KnowledgeBaseID: base.ID, UserID: 101, Name: "one.md"},
		{KnowledgeBaseID: base.ID, UserID: 101, Name: "two.md"},
		{KnowledgeBaseID: foreignBase.ID, UserID: 202, Name: "private.md"},
	}).Error; err != nil {
		t.Fatalf("create documents: %v", err)
	}

	req := httptest.NewRequest(http.MethodGet, "/ai/knowledge-bases", nil)
	req.Header.Set("Authorization", aiPlatformAuthHeader(t))
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("list knowledge bases response = %d body=%s", rec.Code, rec.Body.String())
	}
	var response struct {
		Data struct {
			List []struct {
				ID            model.Int64String `json:"id"`
				DocumentCount int               `json:"documentCount"`
			} `json:"list"`
		} `json:"data"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &response); err != nil {
		t.Fatalf("decode knowledge base response: %v", err)
	}
	counts := make(map[model.Int64String]int, len(response.Data.List))
	for _, item := range response.Data.List {
		counts[item.ID] = item.DocumentCount
	}
	if len(counts) != 2 || counts[base.ID] != 2 || counts[emptyBase.ID] != 0 {
		t.Fatalf("unexpected document counts: %#v", counts)
	}
}



func TestAIKnowledgeRetrievalTestRequiresOwnedKnowledgeBaseAndReportsUnavailableStore(t *testing.T) {
	router, db := setupAIPlatformTestRouter(t)
	base := model.AIKnowledgeBase{UserID: 101, Name: "创作资料"}
	if err := db.Create(&base).Error; err != nil {
		t.Fatalf("create knowledge base: %v", err)
	}

	emptyRequest := httptest.NewRequest(http.MethodPost, "/ai/knowledge-bases/"+strconv.FormatInt(int64(base.ID), 10)+"/retrieval-tests", strings.NewReader(`{"query":"   "}`))
	emptyRequest.Header.Set("Content-Type", "application/json")
	emptyRequest.Header.Set("Authorization", aiPlatformAuthHeader(t))
	emptyRecorder := httptest.NewRecorder()
	router.ServeHTTP(emptyRecorder, emptyRequest)
	if emptyRecorder.Code != http.StatusOK || !strings.Contains(emptyRecorder.Body.String(), `"code":400`) {
		t.Fatalf("empty retrieval query response = %d body=%s", emptyRecorder.Code, emptyRecorder.Body.String())
	}

	request := httptest.NewRequest(http.MethodPost, "/ai/knowledge-bases/"+strconv.FormatInt(int64(base.ID), 10)+"/retrieval-tests", strings.NewReader(`{"query":"如何安排选题"}`))
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Authorization", aiPlatformAuthHeader(t))
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, request)
	if recorder.Code != http.StatusOK || !strings.Contains(recorder.Body.String(), `"code":503`) || !strings.Contains(recorder.Body.String(), "知识库检索需要 PostgreSQL 数据库") {
		t.Fatalf("unavailable retrieval response = %d body=%s", recorder.Code, recorder.Body.String())
	}

	foreign := model.AIKnowledgeBase{UserID: 202, Name: "他人的资料"}
	if err := db.Create(&foreign).Error; err != nil {
		t.Fatalf("create foreign knowledge base: %v", err)
	}
	foreignRequest := httptest.NewRequest(http.MethodPost, "/ai/knowledge-bases/"+strconv.FormatInt(int64(foreign.ID), 10)+"/retrieval-tests", strings.NewReader(`{"query":"私有内容"}`))
	foreignRequest.Header.Set("Content-Type", "application/json")
	foreignRequest.Header.Set("Authorization", aiPlatformAuthHeader(t))
	foreignRecorder := httptest.NewRecorder()
	router.ServeHTTP(foreignRecorder, foreignRequest)
	if foreignRecorder.Code != http.StatusOK || !strings.Contains(foreignRecorder.Body.String(), `"code":404`) {
		t.Fatalf("foreign retrieval response = %d body=%s", foreignRecorder.Code, foreignRecorder.Body.String())
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
	app := model.AIApp{UserID: 101, Type: aiAppTypeWorkflow, Name: "我的智能体"}
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



func TestReplaceAIAppKnowledgeBasesKeepsPriorVersionSnapshot(t *testing.T) {
	router, db := setupAIPlatformTestRouter(t)
	app := model.AIApp{UserID: 101, Type: aiAppTypeWorkflow, Name: "资料库快照测试"}
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



