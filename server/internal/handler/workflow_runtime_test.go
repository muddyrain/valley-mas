package handler

import (
	"bytes"
	"encoding/json"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"valley-server/internal/config"
	"valley-server/internal/database"
	"valley-server/internal/logger"
	"valley-server/internal/middleware"
	"valley-server/internal/model"
	"valley-server/internal/utils"

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
	if err := db.AutoMigrate(&model.User{}, &model.Workflow{}, &model.WorkflowRun{}, &model.WorkflowNodeRun{}, &model.AIApp{}, &model.AIAppVersion{}, &model.AIAppVersionKnowledgeBase{}, &model.AIAppVersionToolBinding{}, &model.AIAppKnowledgeBase{}, &model.AIAppRun{}, &model.Post{}); err != nil {
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
	auth.GET("/:id/runs", AdminListWorkflowRuns)
	auth.GET("/:id/runs/:runId", AdminGetWorkflowRun)
	auth.PUT("/:id", AdminUpdateWorkflow)
	return router, definition
}

func runtimeTestGraph() string {
	return `{"schemaVersion":4,"nodes":[{"id":"start","type":"start","label":"开始","position":{"x":0,"y":0},"config":{"inputs":{"title":{"type":"string","required":true}}}},{"id":"end","type":"end","label":"结束","position":{"x":300,"y":0},"config":{"outputs":{"title":"{{start.output.title}}"}}}],"edges":[{"source":"start","sourceHandle":"output","target":"end","targetHandle":"input"}]}`
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

func TestWorkflowRunPersistsGraphV4NodeTypes(t *testing.T) {
	router, definition := setupWorkflowRuntimeTestRouter(t)
	req := workflowMultipartRequest(t, "/workflows/"+definition.ID.String()+"/run", `{"title":"Graph v4"}`)
	req.Header.Set("Authorization", workflowRuntimeAuthHeader(t, "101"))
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)
	if !strings.Contains(recorder.Header().Get("Content-Type"), "text/event-stream") || !strings.Contains(recorder.Body.String(), `"status":"done"`) {
		t.Fatalf("body=%s", recorder.Body.String())
	}
	var rows []model.WorkflowNodeRun
	if err := database.DB.Order("created_at ASC").Find(&rows).Error; err != nil || len(rows) != 2 {
		t.Fatalf("rows=%v err=%v", rows, err)
	}
	if rows[0].NodeType != "start" || rows[1].NodeType != "end" {
		t.Fatalf("rows=%v", rows)
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
