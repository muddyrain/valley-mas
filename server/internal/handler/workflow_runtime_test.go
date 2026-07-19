package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"valley-server/internal/config"
	"valley-server/internal/database"
	"valley-server/internal/logger"
	"valley-server/internal/middleware"
	"valley-server/internal/model"
	"valley-server/internal/utils"
	"valley-server/internal/workflow"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

const workflowRuntimeTestSecret = "workflow-runtime-test-secret"

func setupWorkflowRuntimeTestRouter(t *testing.T) (*gin.Engine, model.Workflow) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	t.Setenv("DISABLE_FILE_LOG", "1")
	logger.InitLogger()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(&model.User{}, &model.Workflow{}, &model.WorkflowRun{}, &model.WorkflowNodeRun{}, &model.WorkflowRunEvent{}, &model.WorkflowTestCase{}, &model.WorkflowTestResult{}, &model.AIApp{}, &model.AIAppVersion{}, &model.AIAppVersionKnowledgeBase{}, &model.AIAppVersionToolBinding{}, &model.AIAppKnowledgeBase{}, &model.AIAppRun{}, &model.Post{}); err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&[]model.User{{ID: 101, Username: "workflow-owner", Role: "user", IsActive: true}, {ID: 202, Username: "workflow-other", Role: "user", IsActive: true}}).Error; err != nil {
		t.Fatal(err)
	}
	definition := model.Workflow{UserID: 101, Name: "运行测试", Graph: runtimeTestGraph()}
	if err := db.Create(&definition).Error; err != nil {
		t.Fatal(err)
	}
	previous := database.DB
	database.DB = db
	t.Cleanup(func() {
		database.DB = previous
		if sqlDB, sqlErr := db.DB(); sqlErr == nil {
			_ = sqlDB.Close()
		}
	})
	router := gin.New()
	auth := router.Group("/workflows")
	auth.Use(middleware.Auth(&config.Config{JWT: config.JWTConfig{Secret: workflowRuntimeTestSecret}}))
	auth.POST("/:id/run", AdminRunWorkflow)
	auth.GET("/:id", AdminGetWorkflow)
	auth.GET("/:id/runs", AdminListWorkflowRuns)
	auth.GET("/:id/test-cases", ListWorkflowTestCases)
	auth.POST("/:id/test-cases", CreateWorkflowTestCase)
	auth.DELETE("/:id/test-cases/:testCaseId", DeleteWorkflowTestCase)
	auth.POST("/:id/test-cases/:testCaseId/run", RunWorkflowTestCase)
	auth.GET("/:id/runs/:runId", AdminGetWorkflowRun)
	auth.GET("/:id/runs/:runId/events", StreamWorkflowRunEvents)
	auth.POST("/:id/runs/:runId/cancel", CancelWorkflowRun)
	auth.POST("/:id/runs/:runId/retry", RetryWorkflowRun)
	auth.PUT("/:id", AdminUpdateWorkflow)
	auth.POST("/:id/publish", PublishWorkflowVersion)
	return router, definition
}

func runtimeTestGraph() string {
	return `{"schemaVersion":4,"nodes":[{"id":"start","type":"start","label":"开始","position":{"x":0,"y":0},"config":{"inputs":{"title":{"type":"string","required":true}}}},{"id":"end","type":"end","label":"结束","position":{"x":300,"y":0},"config":{"outputs":{"title":"{{start.output.title}}"}}}],"edges":[{"source":"start","sourceHandle":"output","target":"end","targetHandle":"input"}]}`
}

func TestWorkflowTestCaseRunsLockedVersionAndKeepsRunHistorySeparate(t *testing.T) {
	router, definition := setupWorkflowRuntimeTestRouter(t)
	var version model.AIAppVersion
	if err := database.DB.Transaction(func(tx *gorm.DB) error {
		_, createdVersion, err := syncWorkflowAIApp(tx, definition)
		version = createdVersion
		return err
	}); err != nil {
		t.Fatal(err)
	}
	createBody, _ := json.Marshal(map[string]any{
		"name":      "标题透传",
		"versionId": version.ID.String(),
		"inputs":    map[string]any{"title": "Valley"},
		"assertions": []map[string]any{
			{"field": "title", "operator": "equals", "value": "Valley"},
			{"field": "title", "operator": "type", "value": "string"},
		},
	})
	createRequest := httptest.NewRequest(http.MethodPost, "/workflows/"+definition.ID.String()+"/test-cases", bytes.NewReader(createBody))
	createRequest.Header.Set("Content-Type", "application/json")
	createRequest.Header.Set("Authorization", workflowRuntimeAuthHeader(t, "101"))
	createRecorder := httptest.NewRecorder()
	router.ServeHTTP(createRecorder, createRequest)
	if responseCode(createRecorder) != 0 {
		t.Fatalf("create test case: %s", createRecorder.Body.String())
	}
	var createResponse struct {
		Data json.RawMessage `json:"data"`
	}
	if err := json.Unmarshal(createRecorder.Body.Bytes(), &createResponse); err != nil {
		t.Fatal(err)
	}
	var testCase model.WorkflowTestCase
	if err := json.Unmarshal(createResponse.Data, &testCase); err != nil {
		t.Fatal(err)
	}
	runRequest := httptest.NewRequest(http.MethodPost, "/workflows/"+definition.ID.String()+"/test-cases/"+testCase.ID.String()+"/run", nil)
	runRequest.Header.Set("Authorization", workflowRuntimeAuthHeader(t, "101"))
	runRecorder := httptest.NewRecorder()
	router.ServeHTTP(runRecorder, runRequest)
	if responseCode(runRecorder) != 0 || !strings.Contains(runRecorder.Body.String(), `"status":"passed"`) {
		t.Fatalf("run test case: %s", runRecorder.Body.String())
	}
	var stored model.WorkflowTestResult
	if err := database.DB.Where("workflow_test_case_id = ?", testCase.ID).First(&stored).Error; err != nil {
		t.Fatal(err)
	}
	if stored.WorkflowRunID == nil || stored.Status != workflowTestStatusPassed {
		t.Fatalf("stored result=%+v", stored)
	}
	historyRequest := httptest.NewRequest(http.MethodGet, "/workflows/"+definition.ID.String()+"/runs", nil)
	historyRequest.Header.Set("Authorization", workflowRuntimeAuthHeader(t, "101"))
	historyRecorder := httptest.NewRecorder()
	router.ServeHTTP(historyRecorder, historyRequest)
	if responseCode(historyRecorder) != 0 || strings.Contains(historyRecorder.Body.String(), stored.WorkflowRunID.String()) {
		t.Fatalf("test run must stay out of ordinary history: %s", historyRecorder.Body.String())
	}
}

func TestWorkflowTestCaseIsOwnerScoped(t *testing.T) {
	router, definition := setupWorkflowRuntimeTestRouter(t)
	var version model.AIAppVersion
	if err := database.DB.Transaction(func(tx *gorm.DB) error {
		_, createdVersion, err := syncWorkflowAIApp(tx, definition)
		version = createdVersion
		return err
	}); err != nil {
		t.Fatal(err)
	}
	testCase := model.WorkflowTestCase{WorkflowID: definition.ID, UserID: 101, VersionID: version.ID, Name: "私有测试", Inputs: `{"title":"Valley"}`, Assertions: `[{"field":"title","operator":"exists"}]`}
	if err := database.DB.Create(&testCase).Error; err != nil {
		t.Fatal(err)
	}
	request := httptest.NewRequest(http.MethodPost, "/workflows/"+definition.ID.String()+"/test-cases/"+testCase.ID.String()+"/run", nil)
	request.Header.Set("Authorization", workflowRuntimeAuthHeader(t, "202"))
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, request)
	if responseCode(recorder) != http.StatusNotFound {
		t.Fatalf("owner isolation: %s", recorder.Body.String())
	}
}

func TestWorkflowTestCaseRejectsSideEffectGraph(t *testing.T) {
	_, definition := setupWorkflowRuntimeTestRouter(t)
	definition.Graph = `{"schemaVersion":4,"nodes":[{"id":"start","type":"start","label":"开始","position":{"x":0,"y":0},"config":{"inputs":{"title":{"type":"string","required":true}}}},{"id":"cover","type":"tool","label":"生成封面","position":{"x":260,"y":0},"config":{"capabilityId":"image.generateCover","inputs":{"title":"{{start.output.title}}"}}},{"id":"end","type":"end","label":"结束","position":{"x":520,"y":0},"config":{"outputs":{"url":"{{cover.output.url}}"}}}],"edges":[{"source":"start","target":"cover"},{"source":"cover","target":"end"}]}`
	if err := database.DB.Model(&model.Workflow{}).Where("id = ?", definition.ID).Update("graph", definition.Graph).Error; err != nil {
		t.Fatal(err)
	}
	var version model.AIAppVersion
	if err := database.DB.Transaction(func(tx *gorm.DB) error {
		_, createdVersion, err := syncWorkflowAIApp(tx, definition)
		version = createdVersion
		return err
	}); err != nil {
		t.Fatal(err)
	}
	testCase := model.WorkflowTestCase{WorkflowID: definition.ID, UserID: 101, VersionID: version.ID, Name: "禁止副作用", Inputs: `{"title":"Valley"}`, Assertions: `[{"field":"url","operator":"exists"}]`}
	if err := database.DB.Create(&testCase).Error; err != nil {
		t.Fatal(err)
	}
	result, err := executeWorkflowTestCase(context.Background(), testCase, "user")
	if err != nil {
		t.Fatal(err)
	}
	if result.Status != workflowTestStatusRejected || result.ErrorCode != "TEST_SIDE_EFFECT_FORBIDDEN" || result.WorkflowRunID != nil {
		t.Fatalf("result=%+v", result)
	}
}

func TestWorkflowGraphV4RejectsLegacySchema(t *testing.T) {
	router, definition := setupWorkflowRuntimeTestRouter(t)
	legacy := strings.Replace(definition.Graph, `"schemaVersion":4`, `"schemaVersion":3`, 1)
	body, _ := json.Marshal(map[string]string{"graph": legacy, "baseHash": workflowGraphHash(definition.Graph)})
	req := httptest.NewRequest(http.MethodPut, "/workflows/"+definition.ID.String(), bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", workflowRuntimeAuthHeader(t, "101"))
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)
	if responseCode(recorder) != http.StatusBadRequest || !strings.Contains(recorder.Body.String(), "GRAPH_VERSION_UNSUPPORTED") {
		t.Fatalf("body=%s", recorder.Body.String())
	}
}

func TestWorkflowSaveRejectsForgedSubworkflowContract(t *testing.T) {
	_, _ = setupWorkflowRuntimeTestRouter(t)
	childGraph := `{"schemaVersion":4,"nodes":[{"id":"start","type":"start","label":"开始","config":{"inputs":{"topic":{"type":"string","required":true}}}},{"id":"end","type":"end","label":"结束","config":{"outputs":{"title":"{{start.output.topic}}"},"outputTypes":{"title":"string"}}}],"edges":[{"source":"start","target":"end"}]}`
	child := model.Workflow{UserID: 101, Name: "子工作流", Graph: childGraph}
	if err := database.DB.Create(&child).Error; err != nil {
		t.Fatal(err)
	}
	app := model.AIApp{UserID: 101, Type: aiAppTypeWorkflow, WorkflowID: &child.ID, Name: "子工作流", Status: "published"}
	if err := database.DB.Create(&app).Error; err != nil {
		t.Fatal(err)
	}
	version := model.AIAppVersion{AppID: app.ID, Number: 1, Config: childGraph}
	if err := database.DB.Create(&version).Error; err != nil {
		t.Fatal(err)
	}
	if err := database.DB.Model(&app).Update("published_version_id", version.ID).Error; err != nil {
		t.Fatal(err)
	}

	parentGraph := fmt.Sprintf(`{"schemaVersion":4,"nodes":[{"id":"start","type":"start","label":"开始","config":{"inputs":{"topic":{"type":"string","required":true}}}},{"id":"child","type":"subworkflow","label":"子工作流","config":{"workflowId":"%s","versionId":"%s","inputs":{"topic":"{{start.output.topic}}"},"inputSchema":{"topic":"string"},"outputSchema":{"title":"number"}}},{"id":"end","type":"end","label":"结束","config":{"outputs":{"title":"{{child.output.title}}"},"outputTypes":{"title":"number"}}}],"edges":[{"source":"start","target":"child"},{"source":"child","target":"end"}]}`,
		child.ID.String(), version.ID.String())
	err := validateWorkflowDraftForSave(database.DB, parentGraph, 101, 0)
	if err == nil || !strings.Contains(err.Error(), "字段契约与锁定版本不一致") {
		t.Fatalf("err=%v", err)
	}
}

func TestAdminUpdateWorkflowRejectsStaleBaseHash(t *testing.T) {
	router, definition := setupWorkflowRuntimeTestRouter(t)
	baseHash := workflowGraphHash(definition.Graph)
	updated := strings.Replace(definition.Graph, `"title":"{{start.output.title}}"`, `"renamed":"{{start.output.title}}"`, 1)
	request := func(graph string) *httptest.ResponseRecorder {
		body, _ := json.Marshal(map[string]string{"graph": graph, "baseHash": baseHash})
		req := httptest.NewRequest(http.MethodPut, "/workflows/"+definition.ID.String(), bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", workflowRuntimeAuthHeader(t, "101"))
		recorder := httptest.NewRecorder()
		router.ServeHTTP(recorder, req)
		return recorder
	}
	if response := request(updated); responseCode(response) != 0 {
		t.Fatalf("first save: %s", response.Body.String())
	}
	if response := request(definition.Graph); responseCode(response) != http.StatusConflict {
		t.Fatalf("stale save: %s", response.Body.String())
	}
}

func TestAdminUpdateWorkflowRecordsHistoryOnlyWhenRequested(t *testing.T) {
	router, definition := setupWorkflowRuntimeTestRouter(t)
	baseHash := workflowGraphHash(definition.Graph)
	first := strings.Replace(definition.Graph, `"title":"{{start.output.title}}"`, `"first":"{{start.output.title}}"`, 1)
	second := strings.Replace(first, `"first":"{{start.output.title}}"`, `"second":"{{start.output.title}}"`, 1)
	request := func(graph, hash string, recordHistory bool) *httptest.ResponseRecorder {
		body, _ := json.Marshal(map[string]any{"graph": graph, "baseHash": hash, "recordHistory": recordHistory})
		req := httptest.NewRequest(http.MethodPut, "/workflows/"+definition.ID.String(), bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", workflowRuntimeAuthHeader(t, "101"))
		recorder := httptest.NewRecorder()
		router.ServeHTTP(recorder, req)
		return recorder
	}
	if response := request(first, baseHash, false); responseCode(response) != 0 {
		t.Fatalf("autosave: %s", response.Body.String())
	}
	var app model.AIApp
	if err := database.DB.Where("workflow_id = ?", definition.ID).First(&app).Error; err != nil {
		t.Fatal(err)
	}
	var versions []model.AIAppVersion
	if err := database.DB.Where("app_id = ?", app.ID).Find(&versions).Error; err != nil || len(versions) != 1 {
		t.Fatalf("initial versions=%d err=%v", len(versions), err)
	}
	if response := request(second, workflowGraphHash(first), false); responseCode(response) != 0 {
		t.Fatalf("second autosave: %s", response.Body.String())
	}
	if err := database.DB.Where("app_id = ?", app.ID).Find(&versions).Error; err != nil || len(versions) != 1 {
		t.Fatalf("autosave must not add history: versions=%d err=%v", len(versions), err)
	}
	if response := request(second, workflowGraphHash(second), true); responseCode(response) != 0 {
		t.Fatalf("manual save: %s", response.Body.String())
	}
	if err := database.DB.Where("app_id = ?", app.ID).Find(&versions).Error; err != nil || len(versions) != 2 {
		t.Fatalf("manual save must add history: versions=%d err=%v", len(versions), err)
	}
}

func TestPublishedWorkflowSaveKeepsPublishedVersionUntilExplicitPublish(t *testing.T) {
	router, definition := setupWorkflowRuntimeTestRouter(t)
	update := func(graph, hash string) *httptest.ResponseRecorder {
		body, _ := json.Marshal(map[string]any{
			"graph":         graph,
			"baseHash":      hash,
			"recordHistory": true,
		})
		req := httptest.NewRequest(http.MethodPut, "/workflows/"+definition.ID.String(), bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", workflowRuntimeAuthHeader(t, "101"))
		recorder := httptest.NewRecorder()
		router.ServeHTTP(recorder, req)
		return recorder
	}
	publish := func() *httptest.ResponseRecorder {
		req := httptest.NewRequest(http.MethodPost, "/workflows/"+definition.ID.String()+"/publish", nil)
		req.Header.Set("Authorization", workflowRuntimeAuthHeader(t, "101"))
		recorder := httptest.NewRecorder()
		router.ServeHTTP(recorder, req)
		return recorder
	}

	if response := update(definition.Graph, workflowGraphHash(definition.Graph)); responseCode(response) != 0 {
		t.Fatalf("initial save: %s", response.Body.String())
	}
	if response := publish(); responseCode(response) != 0 {
		t.Fatalf("initial publish: %s", response.Body.String())
	}

	var published model.AIApp
	if err := database.DB.Where("workflow_id = ?", definition.ID).First(&published).Error; err != nil {
		t.Fatal(err)
	}
	if published.DraftVersionID == 0 || published.PublishedVersionID != published.DraftVersionID {
		t.Fatalf("initial published pointers=%+v", published)
	}
	var initialPublishedVersion model.AIAppVersion
	if err := database.DB.First(&initialPublishedVersion, published.PublishedVersionID).Error; err != nil || initialPublishedVersion.PublishedAt == nil {
		t.Fatalf("initial published version=%+v err=%v", initialPublishedVersion, err)
	}
	initialPublishedVersionID := published.PublishedVersionID

	updatedGraph := strings.Replace(definition.Graph, `"title":"{{start.output.title}}"`, `"renamed":"{{start.output.title}}"`, 1)
	if response := update(updatedGraph, workflowGraphHash(definition.Graph)); responseCode(response) != 0 {
		t.Fatalf("save after publish: %s", response.Body.String())
	}
	var saved model.AIApp
	if err := database.DB.Where("workflow_id = ?", definition.ID).First(&saved).Error; err != nil {
		t.Fatal(err)
	}
	if saved.DraftVersionID == saved.PublishedVersionID || saved.PublishedVersionID != initialPublishedVersionID {
		t.Fatalf("save must keep published pointer while advancing draft: %+v", saved)
	}
	var savedDraftVersion model.AIAppVersion
	if err := database.DB.First(&savedDraftVersion, saved.DraftVersionID).Error; err != nil || savedDraftVersion.PublishedAt != nil {
		t.Fatalf("saved draft version=%+v err=%v", savedDraftVersion, err)
	}

	if response := publish(); responseCode(response) != 0 {
		t.Fatalf("republish: %s", response.Body.String())
	}
	var republished model.AIApp
	if err := database.DB.Where("workflow_id = ?", definition.ID).First(&republished).Error; err != nil {
		t.Fatal(err)
	}
	if republished.PublishedVersionID != saved.DraftVersionID {
		t.Fatalf("republish must advance published pointer: published=%s draft=%s", republished.PublishedVersionID, saved.DraftVersionID)
	}
}

func TestAdminGetWorkflowReturnsSavedDraftAfterPublish(t *testing.T) {
	router, definition := setupWorkflowRuntimeTestRouter(t)
	update := func(graph, hash string) *httptest.ResponseRecorder {
		body, _ := json.Marshal(map[string]any{"graph": graph, "baseHash": hash, "recordHistory": true})
		req := httptest.NewRequest(http.MethodPut, "/workflows/"+definition.ID.String(), bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", workflowRuntimeAuthHeader(t, "101"))
		recorder := httptest.NewRecorder()
		router.ServeHTTP(recorder, req)
		return recorder
	}
	publish := httptest.NewRequest(http.MethodPost, "/workflows/"+definition.ID.String()+"/publish", nil)
	publish.Header.Set("Authorization", workflowRuntimeAuthHeader(t, "101"))
	if response := update(definition.Graph, workflowGraphHash(definition.Graph)); responseCode(response) != 0 {
		t.Fatalf("initial save: %s", response.Body.String())
	}
	publishRecorder := httptest.NewRecorder()
	router.ServeHTTP(publishRecorder, publish)
	if responseCode(publishRecorder) != 0 {
		t.Fatalf("publish: %s", publishRecorder.Body.String())
	}
	draftGraph := strings.Replace(definition.Graph, `"title":"{{start.output.title}}"`, `"draftTitle":"{{start.output.title}}"`, 1)
	if response := update(draftGraph, workflowGraphHash(definition.Graph)); responseCode(response) != 0 {
		t.Fatalf("save draft: %s", response.Body.String())
	}
	request := httptest.NewRequest(http.MethodGet, "/workflows/"+definition.ID.String(), nil)
	request.Header.Set("Authorization", workflowRuntimeAuthHeader(t, "101"))
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, request)
	if responseCode(recorder) != 0 || recorder.Header().Get("Cache-Control") != "private, no-store" {
		t.Fatalf("get draft: %s headers=%v", recorder.Body.String(), recorder.Header())
	}
	var response struct {
		Data model.Workflow `json:"data"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatal(err)
	}
	if response.Data.Graph != draftGraph {
		t.Fatalf("editor must receive saved draft, got=%s", response.Data.Graph)
	}
}

func TestAdminGetWorkflowRestoresNewerDraftVersionInsteadOfPublishedGraph(t *testing.T) {
	router, definition := setupWorkflowRuntimeTestRouter(t)
	publishedGraph := definition.Graph
	draftGraph := strings.Replace(publishedGraph, `"title":"{{start.output.title}}"`, `"draftTitle":"{{start.output.title}}"`, 1)
	publishedAt := time.Now().Add(-time.Minute)
	draftCreatedAt := time.Now()

	app := model.AIApp{UserID: 101, Type: aiAppTypeWorkflow, WorkflowID: &definition.ID, Name: definition.Name, Status: "published"}
	if err := database.DB.Create(&app).Error; err != nil {
		t.Fatal(err)
	}
	published := model.AIAppVersion{AppID: app.ID, Number: 1, Config: publishedGraph, PublishedAt: &publishedAt}
	draft := model.AIAppVersion{AppID: app.ID, Number: 2, Config: draftGraph, CreatedAt: draftCreatedAt}
	if err := database.DB.Create(&published).Error; err != nil {
		t.Fatal(err)
	}
	if err := database.DB.Create(&draft).Error; err != nil {
		t.Fatal(err)
	}
	if err := database.DB.Model(&app).Updates(map[string]any{"published_version_id": published.ID, "draft_version_id": draft.ID}).Error; err != nil {
		t.Fatal(err)
	}
	// Simulate legacy data: the workflow table still points at the old published
	// canvas while the explicit draft pointer already has the user's save.
	if err := database.DB.Model(&model.Workflow{}).Where("id = ?", definition.ID).Updates(map[string]any{"graph": publishedGraph, "updated_at": publishedAt}).Error; err != nil {
		t.Fatal(err)
	}

	req := httptest.NewRequest(http.MethodGet, "/workflows/"+definition.ID.String(), nil)
	req.Header.Set("Authorization", workflowRuntimeAuthHeader(t, "101"))
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)
	if responseCode(recorder) != 0 {
		t.Fatalf("get draft: %s", recorder.Body.String())
	}
	var response struct {
		Data model.Workflow `json:"data"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatal(err)
	}
	if response.Data.Graph != draftGraph {
		t.Fatalf("editor graph=%s, want saved draft=%s", response.Data.Graph, draftGraph)
	}
	var repaired model.Workflow
	if err := database.DB.First(&repaired, definition.ID).Error; err != nil {
		t.Fatal(err)
	}
	if repaired.Graph != draftGraph {
		t.Fatalf("workflow graph was not repaired: %s", repaired.Graph)
	}
}

func TestPreviouslyPublishedSubworkflowVersionRemainsValidAfterNewerPublish(t *testing.T) {
	_, _ = setupWorkflowRuntimeTestRouter(t)
	childV1Graph := `{"schemaVersion":4,"nodes":[{"id":"start","type":"start","label":"开始","config":{"inputs":{}}},{"id":"end","type":"end","label":"结束","config":{"outputs":{"title":"static"},"outputTypes":{"title":"string"}}}],"edges":[{"source":"start","target":"end"}]}`
	childV2Graph := `{"schemaVersion":4,"nodes":[{"id":"start","type":"start","label":"开始","config":{"inputs":{}}},{"id":"end","type":"end","label":"结束","config":{"outputs":{"title":"static","tags":"static"},"outputTypes":{"title":"string","tags":"string[]"}}}],"edges":[{"source":"start","target":"end"}]}`
	child := model.Workflow{UserID: 101, Name: "稳定子工作流", Graph: childV2Graph, Status: "published"}
	if err := database.DB.Create(&child).Error; err != nil {
		t.Fatal(err)
	}
	publishedAt := time.Now()
	app := model.AIApp{UserID: 101, Type: aiAppTypeWorkflow, WorkflowID: &child.ID, Name: child.Name, Status: "published"}
	if err := database.DB.Create(&app).Error; err != nil {
		t.Fatal(err)
	}
	v1 := model.AIAppVersion{AppID: app.ID, Number: 1, Config: childV1Graph, PublishedAt: &publishedAt}
	v2 := model.AIAppVersion{AppID: app.ID, Number: 2, Config: childV2Graph, PublishedAt: &publishedAt}
	if err := database.DB.Create(&v1).Error; err != nil {
		t.Fatal(err)
	}
	if err := database.DB.Create(&v2).Error; err != nil {
		t.Fatal(err)
	}
	if err := database.DB.Model(&app).Updates(map[string]any{"draft_version_id": v2.ID, "published_version_id": v2.ID}).Error; err != nil {
		t.Fatal(err)
	}

	parentGraph := fmt.Sprintf(`{"schemaVersion":4,"nodes":[{"id":"start","type":"start","label":"开始","config":{"inputs":{}}},{"id":"child","type":"subworkflow","label":"稳定子工作流","config":{"workflowId":"%s","versionId":"%s","inputs":{},"inputSchema":{},"outputSchema":{"title":"string"}}},{"id":"end","type":"end","label":"结束","config":{"outputs":{"result":"{{child.output.title}}"},"outputTypes":{"result":"string"}}}],"edges":[{"source":"start","target":"child"},{"source":"child","target":"end"}]}`,
		child.ID.String(), v1.ID.String())
	if err := validateWorkflowDraftForSave(database.DB, parentGraph, 101, 0); err != nil {
		t.Fatalf("previously published child version must remain valid: %v", err)
	}
}

func TestWorkflowRunPersistsGraphV4NodeTypes(t *testing.T) {
	router, definition := setupWorkflowRuntimeTestRouter(t)
	req := workflowMultipartRequest(t, "/workflows/"+definition.ID.String()+"/run", `{"title":"Graph v4"}`)
	req.Header.Set("Authorization", workflowRuntimeAuthHeader(t, "101"))
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)
	if !strings.Contains(recorder.Header().Get("Content-Type"), "text/event-stream") || !strings.Contains(recorder.Body.String(), `"status":"done"`) || !strings.Contains(recorder.Body.String(), "id: 5") {
		t.Fatalf("body=%s", recorder.Body.String())
	}
	var rows []model.WorkflowNodeRun
	if err := database.DB.Order("created_at ASC").Find(&rows).Error; err != nil || len(rows) != 2 {
		t.Fatalf("rows=%v err=%v", rows, err)
	}
	if rows[0].NodeType != "start" || rows[1].NodeType != "end" {
		t.Fatalf("rows=%v", rows)
	}
	var events []model.WorkflowRunEvent
	if err := database.DB.Order("sequence ASC").Find(&events).Error; err != nil || len(events) != 5 {
		t.Fatalf("events=%v err=%v", events, err)
	}
	for index, event := range events {
		if event.Sequence != int64(index+1) {
			t.Fatalf("event sequence=%d index=%d", event.Sequence, index)
		}
	}
	if events[4].Status != string(workflow.StatusSucceeded) || events[4].NodeID != "" {
		t.Fatalf("terminal event=%+v", events[4])
	}
}

func TestWorkflowRunReturnsActionableLLMConfigurationError(t *testing.T) {
	router, definition := setupWorkflowRuntimeTestRouter(t)
	t.Setenv("ARK_API_KEY", "")
	t.Setenv("ARK_TEXT_MODEL", "")
	definition.Graph = `{"schemaVersion":4,"nodes":[{"id":"start","type":"start","label":"开始","config":{"inputs":{}}},{"id":"writer","type":"llm","label":"大模型","config":{"modelProfile":"ark-text-default","prompt":"写一段文字","maxOutputTokens":64}},{"id":"end","type":"end","label":"结束","config":{"outputs":{"text":"{{writer.output.text}}"},"outputTypes":{"text":"string"}}}],"edges":[{"source":"start","target":"writer"},{"source":"writer","target":"end"}]}`
	if err := database.DB.Save(&definition).Error; err != nil {
		t.Fatal(err)
	}
	req := workflowMultipartRequest(t, "/workflows/"+definition.ID.String()+"/run", `{}`)
	req.Header.Set("Authorization", workflowRuntimeAuthHeader(t, "101"))
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)
	body := recorder.Body.String()
	if responseCode(recorder) != http.StatusServiceUnavailable || !strings.Contains(body, "ARK_API_KEY") || !strings.Contains(body, "ARK_TEXT_MODEL") {
		t.Fatalf("body=%s", body)
	}
	var run model.WorkflowRun
	if err := database.DB.Where("workflow_id = ?", definition.ID).First(&run).Error; err != nil {
		t.Fatal(err)
	}
	if run.Status != "error" || !strings.Contains(run.Result, "ARK_NOT_CONFIGURED") {
		t.Fatalf("run=%+v", run)
	}
}

func TestWorkflowRunSkipsInactiveWriteTool(t *testing.T) {
	router, definition := setupWorkflowRuntimeTestRouter(t)
	definition.Graph = `{"schemaVersion":4,"nodes":[{"id":"start","type":"start","label":"开始","config":{"inputs":{"score":{"type":"number","required":true},"title":{"type":"string"},"content":{"type":"string"},"tagIds":{"type":"string[]"},"visibility":{"type":"string"}}}},{"id":"condition","type":"condition","label":"条件","config":{"left":"{{start.output.score}}","operator":"greaterThan","right":10}},{"id":"selected","type":"variable","label":"选中","config":{"assignments":[{"name":"result","type":"string","value":"selected"}]}},{"id":"draft","type":"tool","label":"草稿","config":{"capabilityId":"blog.createDraft","inputs":{"title":"{{start.output.title}}","content":"{{start.output.content}}","tags":"{{start.output.tagIds}}","tagMode":"merge","visibility":"{{start.output.visibility}}"}}},{"id":"merge","type":"merge","label":"合并","config":{"fields":[{"name":"result","type":"string","sources":["{{selected.output.result}}","{{draft.output.postId}}"]}]}},{"id":"end","type":"end","label":"结束","config":{"outputs":{"result":"{{merge.output.result}}"}}}],"edges":[{"source":"start","target":"condition"},{"source":"condition","sourceHandle":"true","target":"selected"},{"source":"condition","sourceHandle":"false","target":"draft"},{"source":"selected","target":"merge"},{"source":"draft","target":"merge"},{"source":"merge","target":"end"}]}`
	if err := database.DB.Save(&definition).Error; err != nil {
		t.Fatal(err)
	}
	req := workflowMultipartRequest(t, "/workflows/"+definition.ID.String()+"/run", `{"score":20,"title":"unsafe","content":"must not persist","tagIds":[],"visibility":"private"}`)
	req.Header.Set("Authorization", workflowRuntimeAuthHeader(t, "101"))
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)
	if !strings.Contains(recorder.Body.String(), `"status":"skipped"`) {
		t.Fatalf("body=%s", recorder.Body.String())
	}
	var posts int64
	_ = database.DB.Model(&model.Post{}).Count(&posts).Error
	if posts != 0 {
		t.Fatalf("post count=%d", posts)
	}
	var skipped model.WorkflowNodeRun
	if err := database.DB.Where("node_id = ? AND status = ?", "draft", "skipped").First(&skipped).Error; err != nil {
		t.Fatal(err)
	}
	if skipped.CapabilityID != "blog.createDraft" {
		t.Fatalf("capability=%s", skipped.CapabilityID)
	}
}

func TestWorkflowRunHistoryIsOwnerScoped(t *testing.T) {
	router, definition := setupWorkflowRuntimeTestRouter(t)
	req := workflowMultipartRequest(t, "/workflows/"+definition.ID.String()+"/run", `{"title":"private"}`)
	req.Header.Set("Authorization", workflowRuntimeAuthHeader(t, "101"))
	router.ServeHTTP(httptest.NewRecorder(), req)
	list := httptest.NewRequest(http.MethodGet, "/workflows/"+definition.ID.String()+"/runs", nil)
	list.Header.Set("Authorization", workflowRuntimeAuthHeader(t, "202"))
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, list)
	if responseCode(recorder) != http.StatusNotFound {
		t.Fatalf("body=%s", recorder.Body.String())
	}
}

func TestWorkflowRunTraceReturnsOrderedEvents(t *testing.T) {
	router, definition := setupWorkflowRuntimeTestRouter(t)
	runRequest := workflowMultipartRequest(t, "/workflows/"+definition.ID.String()+"/run", `{"title":"trace"}`)
	runRequest.Header.Set("Authorization", workflowRuntimeAuthHeader(t, "101"))
	router.ServeHTTP(httptest.NewRecorder(), runRequest)

	var run model.WorkflowRun
	if err := database.DB.Where("workflow_id = ?", definition.ID).First(&run).Error; err != nil {
		t.Fatal(err)
	}
	request := httptest.NewRequest(http.MethodGet, "/workflows/"+definition.ID.String()+"/runs/"+run.ID.String(), nil)
	request.Header.Set("Authorization", workflowRuntimeAuthHeader(t, "101"))
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, request)
	if responseCode(recorder) != 0 {
		t.Fatalf("body=%s", recorder.Body.String())
	}
	var response struct {
		Data struct {
			Events []model.WorkflowRunEvent `json:"events"`
		} `json:"data"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatal(err)
	}
	if len(response.Data.Events) != 5 {
		t.Fatalf("events=%+v", response.Data.Events)
	}
	for index, event := range response.Data.Events {
		if event.Sequence != int64(index+1) {
			t.Fatalf("event sequence=%d index=%d", event.Sequence, index)
		}
	}
	streamRequest := httptest.NewRequest(http.MethodGet, "/workflows/"+definition.ID.String()+"/runs/"+run.ID.String()+"/events", nil)
	streamRequest.Header.Set("Authorization", workflowRuntimeAuthHeader(t, "101"))
	streamRequest.Header.Set("Last-Event-ID", "2")
	streamRecorder := httptest.NewRecorder()
	router.ServeHTTP(streamRecorder, streamRequest)
	streamBody := streamRecorder.Body.String()
	if !strings.Contains(streamBody, "id: 3") || !strings.Contains(streamBody, "id: 5") || strings.Contains(streamBody, "id: 2") || !strings.Contains(streamBody, `"status":"done"`) {
		t.Fatalf("stream=%s", streamBody)
	}
}

func TestCancelWorkflowRunCancelsActiveOwnerRun(t *testing.T) {
	router, definition := setupWorkflowRuntimeTestRouter(t)
	run := model.WorkflowRun{
		WorkflowID:    definition.ID,
		UserID:        101,
		Status:        "running",
		GraphSnapshot: definition.Graph,
		StartedAt:     time.Now(),
	}
	if err := database.DB.Create(&run).Error; err != nil {
		t.Fatal(err)
	}
	ctx, release := activeWorkflowRuns.Start(run.ID.String(), time.Minute)
	defer release()
	request := httptest.NewRequest(http.MethodPost, "/workflows/"+definition.ID.String()+"/runs/"+run.ID.String()+"/cancel", nil)
	request.Header.Set("Authorization", workflowRuntimeAuthHeader(t, "101"))
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, request)
	if responseCode(recorder) != 0 {
		t.Fatalf("body=%s", recorder.Body.String())
	}
	select {
	case <-ctx.Done():
	case <-time.After(time.Second):
		t.Fatal("run context was not cancelled")
	}
	if err := database.DB.First(&run, run.ID).Error; err != nil || run.Status != "cancelling" {
		t.Fatalf("run=%+v err=%v", run, err)
	}
}

func TestRetryWorkflowRunCreatesNewRunFromSnapshot(t *testing.T) {
	router, definition := setupWorkflowRuntimeTestRouter(t)
	firstRequest := workflowMultipartRequest(t, "/workflows/"+definition.ID.String()+"/run", `{"title":"first"}`)
	firstRequest.Header.Set("Authorization", workflowRuntimeAuthHeader(t, "101"))
	firstRecorder := httptest.NewRecorder()
	router.ServeHTTP(firstRecorder, firstRequest)
	if responseCode(firstRecorder) != 0 {
		t.Fatalf("first run: %s", firstRecorder.Body.String())
	}
	var source model.WorkflowRun
	if err := database.DB.Where("workflow_id = ?", definition.ID).First(&source).Error; err != nil {
		t.Fatal(err)
	}
	retryRequest := workflowMultipartRequest(t, "/workflows/"+definition.ID.String()+"/runs/"+source.ID.String()+"/retry", `{"title":"second"}`)
	retryRequest.Header.Set("Authorization", workflowRuntimeAuthHeader(t, "101"))
	retryRecorder := httptest.NewRecorder()
	router.ServeHTTP(retryRecorder, retryRequest)
	if responseCode(retryRecorder) != 0 {
		t.Fatalf("retry: %s", retryRecorder.Body.String())
	}
	var runs []model.WorkflowRun
	if err := database.DB.Where("workflow_id = ?", definition.ID).Order("created_at ASC").Find(&runs).Error; err != nil {
		t.Fatal(err)
	}
	if len(runs) != 2 || runs[1].SourceRunID == nil || *runs[1].SourceRunID != source.ID {
		t.Fatalf("runs=%+v", runs)
	}
	if runs[1].GraphSnapshot != source.GraphSnapshot {
		t.Fatalf("retry must preserve graph snapshot: source=%s retry=%s", source.GraphSnapshot, runs[1].GraphSnapshot)
	}
}

func workflowRuntimeAuthHeader(t *testing.T, userID string) string {
	t.Helper()
	token, err := utils.GenerateToken(userID, "workflow-tester", "user", workflowRuntimeTestSecret, 1)
	if err != nil {
		t.Fatal(err)
	}
	return "Bearer " + token
}
func workflowMultipartRequest(t *testing.T, path, inputs string) *http.Request {
	t.Helper()
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	if err := writer.WriteField("inputs", inputs); err != nil {
		t.Fatal(err)
	}
	if err := writer.Close(); err != nil {
		t.Fatal(err)
	}
	req := httptest.NewRequest(http.MethodPost, path, &body)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	return req
}
