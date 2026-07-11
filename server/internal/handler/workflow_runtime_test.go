package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
	"time"

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
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(&model.User{}, &model.Workflow{}, &model.WorkflowRun{}, &model.WorkflowNodeRun{}); err != nil {
		t.Fatalf("migrate workflow runtime: %v", err)
	}
	if err := db.Create(&[]model.User{
		{ID: 101, Username: "workflow-owner", Role: "user", IsActive: true},
		{ID: 202, Username: "workflow-other", Role: "user", IsActive: true},
	}).Error; err != nil {
		t.Fatalf("seed users: %v", err)
	}
	workflow := model.Workflow{UserID: 101, Name: "运行测试", Graph: string(runtimeTestGraph())}
	if err := db.Create(&workflow).Error; err != nil {
		t.Fatalf("seed workflow: %v", err)
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
	cfg := &config.Config{JWT: config.JWTConfig{Secret: workflowRuntimeTestSecret}}
	router := gin.New()
	auth := router.Group("/workflows")
	auth.Use(middleware.Auth(cfg))
	auth.POST("/:id/run", AdminRunWorkflow)
	auth.GET("/:id/runs", AdminListWorkflowRuns)
	auth.GET("/:id/runs/:runId", AdminGetWorkflowRun)
	return router, workflow
}

func runtimeTestGraph() []byte {
	return []byte(`{"schemaVersion":1,"nodes":[{"id":"start","type":"start","config":{"inputs":{"title":{"type":"string","required":true}}}},{"id":"end","type":"end","config":{"outputs":{"title":"{{start.output.title}}"}}}],"edges":[{"source":"start","sourceHandle":"output","target":"end","targetHandle":"input"}]}`)
}

func TestDecodeWorkflowGraphUpgradesLegacyOutputReferences(t *testing.T) {
	graph, err := decodeWorkflowGraph(`{"schemaVersion":1,"nodes":[{"id":"start","type":"start","config":{"inputs":{"title":{"type":"string","required":true}}}},{"id":"end","type":"end","config":{"outputs":{"title":"{{start.title}}","literal":"{{unknown.title}}"}}}],"edges":[{"source":"start","target":"end"}]}`)
	if err != nil {
		t.Fatalf("decode workflow graph: %v", err)
	}
	config := string(graph.Nodes[1].Config)
	if !strings.Contains(config, `{{start.output.title}}`) || !strings.Contains(config, `{{unknown.title}}`) {
		t.Fatalf("legacy references were not migrated safely: %s", config)
	}
}

func workflowRuntimeAuthHeader(t *testing.T, userID string) string {
	t.Helper()
	token, err := utils.GenerateToken(userID, "workflow-tester", "user", workflowRuntimeTestSecret, 1)
	if err != nil {
		t.Fatalf("generate token: %v", err)
	}
	return "Bearer " + token
}

func workflowMultipartRequest(t *testing.T, path string, inputs string) *http.Request {
	t.Helper()
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	if err := writer.WriteField("inputs", inputs); err != nil {
		t.Fatalf("write inputs: %v", err)
	}
	if err := writer.Close(); err != nil {
		t.Fatalf("close multipart: %v", err)
	}
	req := httptest.NewRequest(http.MethodPost, path, &body)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	return req
}

func workflowMultipartFileRequest(t *testing.T, path string, inputs string, files map[string][]string) *http.Request {
	t.Helper()
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	if err := writer.WriteField("inputs", inputs); err != nil {
		t.Fatalf("write inputs: %v", err)
	}
	for field, values := range files {
		for _, value := range values {
			part, err := writer.CreateFormFile(field, field+".md")
			if err != nil {
				t.Fatalf("create file part: %v", err)
			}
			if _, err := part.Write([]byte(value)); err != nil {
				t.Fatalf("write file part: %v", err)
			}
		}
	}
	if err := writer.Close(); err != nil {
		t.Fatalf("close multipart: %v", err)
	}
	req := httptest.NewRequest(http.MethodPost, path, &body)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	return req
}

func TestWorkflowRunExecutesMultipartGraphAndPersistsSafeHistory(t *testing.T) {
	router, workflow := setupWorkflowRuntimeTestRouter(t)
	path := "/workflows/" + strconv.FormatInt(int64(workflow.ID), 10) + "/run"
	req := workflowMultipartRequest(t, path, `{"title":"工作流标题"}`)
	req.Header.Set("Authorization", workflowRuntimeAuthHeader(t, "101"))
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK || !strings.Contains(rec.Header().Get("Content-Type"), "text/event-stream") {
		t.Fatalf("run response = %d %q body=%s", rec.Code, rec.Header().Get("Content-Type"), rec.Body.String())
	}
	if !strings.Contains(rec.Body.String(), `"status":"success"`) || !strings.Contains(rec.Body.String(), `"status":"done"`) {
		t.Fatalf("expected SSE success and done events, got %s", rec.Body.String())
	}
	var run model.WorkflowRun
	if err := database.DB.Where("workflow_id = ?", workflow.ID).First(&run).Error; err != nil {
		t.Fatalf("load run: %v", err)
	}
	if run.Status != "success" || run.GraphSnapshot != string(runtimeTestGraph()) || strings.Contains(run.Inputs, "工作流标题") {
		t.Fatalf("unsafe or incomplete run persistence: %#v", run)
	}
	var nodeRuns []model.WorkflowNodeRun
	if err := database.DB.Where("workflow_run_id = ?", run.ID).Order("created_at ASC").Find(&nodeRuns).Error; err != nil {
		t.Fatalf("load node runs: %v", err)
	}
	if len(nodeRuns) != 2 || nodeRuns[0].Status != "success" || nodeRuns[1].Status != "success" {
		t.Fatalf("node run persistence = %#v", nodeRuns)
	}

	historyReq := httptest.NewRequest(http.MethodGet, "/workflows/"+strconv.FormatInt(int64(workflow.ID), 10)+"/runs", nil)
	historyReq.Header.Set("Authorization", workflowRuntimeAuthHeader(t, "101"))
	historyRec := httptest.NewRecorder()
	router.ServeHTTP(historyRec, historyReq)
	if historyRec.Code != http.StatusOK || !strings.Contains(historyRec.Body.String(), strconv.FormatInt(int64(run.ID), 10)) {
		t.Fatalf("history response = %d body=%s", historyRec.Code, historyRec.Body.String())
	}
}

func TestWorkflowRunHistoryIsOwnerScoped(t *testing.T) {
	router, workflow := setupWorkflowRuntimeTestRouter(t)
	path := "/workflows/" + strconv.FormatInt(int64(workflow.ID), 10) + "/run"
	runReq := workflowMultipartRequest(t, path, `{"title":"私有标题"}`)
	runReq.Header.Set("Authorization", workflowRuntimeAuthHeader(t, "101"))
	runRec := httptest.NewRecorder()
	router.ServeHTTP(runRec, runReq)
	var run model.WorkflowRun
	if err := database.DB.Where("workflow_id = ?", workflow.ID).First(&run).Error; err != nil {
		t.Fatalf("load run: %v", err)
	}
	foreignRunReq := workflowMultipartRequest(t, path, `{"title":"越权运行"}`)
	foreignRunReq.Header.Set("Authorization", workflowRuntimeAuthHeader(t, "202"))
	foreignRunRec := httptest.NewRecorder()
	router.ServeHTTP(foreignRunRec, foreignRunReq)
	var foreignRunResponse Response
	if err := json.Unmarshal(foreignRunRec.Body.Bytes(), &foreignRunResponse); err != nil {
		t.Fatalf("decode foreign run response: %v", err)
	}
	if foreignRunResponse.Code != http.StatusNotFound {
		t.Fatalf("foreign run response code = %d body=%s", foreignRunResponse.Code, foreignRunRec.Body.String())
	}

	for _, path := range []string{
		"/workflows/" + strconv.FormatInt(int64(workflow.ID), 10) + "/runs",
		"/workflows/" + strconv.FormatInt(int64(workflow.ID), 10) + "/runs/" + strconv.FormatInt(int64(run.ID), 10),
	} {
		req := httptest.NewRequest(http.MethodGet, path, nil)
		req.Header.Set("Authorization", workflowRuntimeAuthHeader(t, "202"))
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)
		var response Response
		if err := json.Unmarshal(rec.Body.Bytes(), &response); err != nil {
			t.Fatalf("decode owner scoped response: %v", err)
		}
		if response.Code != http.StatusNotFound {
			t.Fatalf("%s response code = %d body=%s", path, response.Code, rec.Body.String())
		}
	}
}

func TestWorkflowRunRequiresAuthentication(t *testing.T) {
	router, workflow := setupWorkflowRuntimeTestRouter(t)
	req := workflowMultipartRequest(t, "/workflows/"+strconv.FormatInt(int64(workflow.ID), 10)+"/run", `{"title":"未登录"}`)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected unauthorized, got %d body=%s", rec.Code, rec.Body.String())
	}
}

func TestWorkflowRunRecordsARKConfigurationFailure(t *testing.T) {
	router, workflow := setupWorkflowRuntimeTestRouter(t)
	workflow.Graph = `{"schemaVersion":1,"nodes":[{"id":"start","type":"start","config":{"inputs":{"title":{"type":"string","required":true}}}},{"id":"summary","type":"llm.text","config":{"modelProfile":"ark-text-default","systemPrompt":"summarize","prompt":"{{start.output.title}}","temperature":0.2,"maxOutputTokens":120}},{"id":"end","type":"end","config":{"outputs":{"text":"{{summary.output.text}}"}}}],"edges":[{"source":"start","sourceHandle":"output","target":"summary","targetHandle":"input"},{"source":"summary","sourceHandle":"output","target":"end","targetHandle":"input"}]}`
	if err := database.DB.Save(&workflow).Error; err != nil {
		t.Fatalf("save llm workflow: %v", err)
	}
	t.Setenv("ARK_API_KEY", "")
	t.Setenv("ARK_TEXT_MODEL", "")
	req := workflowMultipartRequest(t, "/workflows/"+strconv.FormatInt(int64(workflow.ID), 10)+"/run", `{"title":"需要摘要"}`)
	req.Header.Set("Authorization", workflowRuntimeAuthHeader(t, "101"))
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	var response Response
	if err := json.Unmarshal(rec.Body.Bytes(), &response); err != nil {
		t.Fatalf("decode ARK config response: %v body=%s", err, rec.Body.String())
	}
	if response.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503 response code, got %d body=%s", response.Code, rec.Body.String())
	}
	var run model.WorkflowRun
	if err := database.DB.Where("workflow_id = ?", workflow.ID).First(&run).Error; err != nil {
		t.Fatalf("load config failure run: %v", err)
	}
	if run.Status != "error" || !strings.Contains(run.Result, "ARK_NOT_CONFIGURED") {
		t.Fatalf("config failure persistence = %#v", run)
	}
}

func TestWorkflowRunRejectsUndeclaredAndMultipleUploadFiles(t *testing.T) {
	router, workflow := setupWorkflowRuntimeTestRouter(t)
	workflow.Graph = `{"schemaVersion":1,"nodes":[{"id":"start","type":"start","config":{"inputs":{"markdownFile":{"type":"file","required":true}}}},{"id":"parse","type":"blog.parseMarkdown","config":{"fileInput":"markdownFile"}},{"id":"end","type":"end","config":{"outputs":{"title":"{{parse.output.title}}"}}}],"edges":[{"source":"start","sourceHandle":"output","target":"parse","targetHandle":"input"},{"source":"parse","sourceHandle":"output","target":"end","targetHandle":"input"}]}`
	if err := database.DB.Save(&workflow).Error; err != nil {
		t.Fatalf("save file workflow: %v", err)
	}
	for name, files := range map[string]map[string][]string{
		"undeclared": {"unexpectedFile": {"# title"}},
		"multiple":   {"markdownFile": {"# first", "# second"}},
	} {
		t.Run(name, func(t *testing.T) {
			req := workflowMultipartFileRequest(t, "/workflows/"+strconv.FormatInt(int64(workflow.ID), 10)+"/run", `{}`, files)
			req.Header.Set("Authorization", workflowRuntimeAuthHeader(t, "101"))
			rec := httptest.NewRecorder()
			router.ServeHTTP(rec, req)
			var response Response
			if err := json.Unmarshal(rec.Body.Bytes(), &response); err != nil {
				t.Fatalf("decode response: %v body=%s", err, rec.Body.String())
			}
			if response.Code != http.StatusBadRequest {
				t.Fatalf("response code = %d body=%s", response.Code, rec.Body.String())
			}
		})
	}
}

func TestWorkflowRunRejectsMultipartBodyOverTotalLimit(t *testing.T) {
	router, workflow := setupWorkflowRuntimeTestRouter(t)
	workflow.Graph = `{"schemaVersion":1,"nodes":[{"id":"start","type":"start","config":{"inputs":{"markdownFile":{"type":"file","required":true}}}},{"id":"parse","type":"blog.parseMarkdown","config":{"fileInput":"markdownFile"}},{"id":"end","type":"end","config":{"outputs":{"title":"{{parse.output.title}}"}}}],"edges":[{"source":"start","sourceHandle":"output","target":"parse","targetHandle":"input"},{"source":"parse","sourceHandle":"output","target":"end","targetHandle":"input"}]}`
	if err := database.DB.Save(&workflow).Error; err != nil {
		t.Fatalf("save file workflow: %v", err)
	}
	largeFile := strings.Repeat("x", 4*1024*1024)
	req := workflowMultipartFileRequest(t, "/workflows/"+strconv.FormatInt(int64(workflow.ID), 10)+"/run", `{}`, map[string][]string{"markdownFile": {largeFile, largeFile}})
	req.Header.Set("Authorization", workflowRuntimeAuthHeader(t, "101"))
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	var response Response
	if err := json.Unmarshal(rec.Body.Bytes(), &response); err != nil {
		t.Fatalf("decode response: %v body=%s", err, rec.Body.String())
	}
	if response.Code != http.StatusBadRequest {
		t.Fatalf("response code = %d body=%s", response.Code, rec.Body.String())
	}
}

func TestWorkflowRunUsesRequestCancellationAndDoesNotAdvanceToLaterNodes(t *testing.T) {
	router, workflow := setupWorkflowRuntimeTestRouter(t)
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	req := workflowMultipartRequest(t, "/workflows/"+strconv.FormatInt(int64(workflow.ID), 10)+"/run", `{"title":"已取消"}`).WithContext(ctx)
	req.Header.Set("Authorization", workflowRuntimeAuthHeader(t, "101"))
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	if strings.Contains(rec.Body.String(), `"step":"end"`) || !strings.Contains(rec.Body.String(), `"status":"error"`) {
		t.Fatalf("canceled execution advanced unexpectedly: %s", rec.Body.String())
	}
	var run model.WorkflowRun
	if err := database.DB.Where("workflow_id = ?", workflow.ID).First(&run).Error; err != nil {
		t.Fatalf("load canceled run: %v", err)
	}
	if run.Status != "error" || !strings.Contains(run.Result, "WORKFLOW_NODE_FAILED") {
		t.Fatalf("canceled run persistence = %#v", run)
	}
}

func TestWorkflowRunHistoryPaginatesWithBoundedPageSize(t *testing.T) {
	router, workflow := setupWorkflowRuntimeTestRouter(t)
	for _, title := range []string{"one", "two", "three"} {
		req := workflowMultipartRequest(t, "/workflows/"+strconv.FormatInt(int64(workflow.ID), 10)+"/run", `{"title":"`+title+`"}`)
		req.Header.Set("Authorization", workflowRuntimeAuthHeader(t, "101"))
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)
	}
	req := httptest.NewRequest(http.MethodGet, "/workflows/"+strconv.FormatInt(int64(workflow.ID), 10)+"/runs?page=2&pageSize=1", nil)
	req.Header.Set("Authorization", workflowRuntimeAuthHeader(t, "101"))
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	var response struct {
		Code int `json:"code"`
		Data struct {
			List     []model.WorkflowRun `json:"list"`
			Total    int64               `json:"total"`
			Page     int                 `json:"page"`
			PageSize int                 `json:"pageSize"`
		} `json:"data"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &response); err != nil {
		t.Fatalf("decode history: %v body=%s", err, rec.Body.String())
	}
	if response.Code != 0 || response.Data.Total != 3 || response.Data.Page != 2 || response.Data.PageSize != 1 || len(response.Data.List) != 1 {
		t.Fatalf("unexpected paginated history: %#v", response)
	}
}

func TestWorkflowRunHistoryUsesIDTieBreakerForEqualStartTimes(t *testing.T) {
	router, workflow := setupWorkflowRuntimeTestRouter(t)
	startedAt := time.Date(2026, time.July, 11, 16, 15, 0, 0, time.UTC)
	for _, id := range []model.Int64String{11, 22, 33} {
		if err := database.DB.Create(&model.WorkflowRun{ID: id, WorkflowID: workflow.ID, UserID: workflow.UserID, Status: "success", GraphSnapshot: workflow.Graph, StartedAt: startedAt}).Error; err != nil {
			t.Fatalf("seed run %d: %v", id, err)
		}
	}
	loadPage := func(page int) []model.WorkflowRun {
		req := httptest.NewRequest(http.MethodGet, "/workflows/"+strconv.FormatInt(int64(workflow.ID), 10)+"/runs?page="+strconv.Itoa(page)+"&pageSize=1", nil)
		req.Header.Set("Authorization", workflowRuntimeAuthHeader(t, "101"))
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)
		var response struct {
			Data struct {
				List []model.WorkflowRun `json:"list"`
			} `json:"data"`
		}
		if err := json.Unmarshal(rec.Body.Bytes(), &response); err != nil {
			t.Fatalf("decode page %d: %v", page, err)
		}
		return response.Data.List
	}
	first, second, third := loadPage(1), loadPage(2), loadPage(3)
	if len(first) != 1 || len(second) != 1 || len(third) != 1 || first[0].ID != 33 || second[0].ID != 22 || third[0].ID != 11 {
		t.Fatalf("unstable pages for equal timestamps: %v %v %v", first, second, third)
	}
}

func TestWorkflowRunMarksFailureWhenFinalSuccessPersistenceFails(t *testing.T) {
	router, workflow := setupWorkflowRuntimeTestRouter(t)
	callbackName := "workflow_runtime_fail_success_finish"
	if err := database.DB.Callback().Update().Before("gorm:update").Register(callbackName, func(tx *gorm.DB) {
		if _, ok := tx.Statement.Model.(*model.WorkflowRun); !ok {
			return
		}
		updates, ok := tx.Statement.Dest.(map[string]any)
		if ok && updates["status"] == "success" {
			tx.AddError(errors.New("simulated final run persistence failure"))
		}
	}); err != nil {
		t.Fatalf("register update callback: %v", err)
	}
	defer database.DB.Callback().Update().Remove(callbackName)
	req := workflowMultipartRequest(t, "/workflows/"+strconv.FormatInt(int64(workflow.ID), 10)+"/run", `{"title":"持久化失败"}`)
	req.Header.Set("Authorization", workflowRuntimeAuthHeader(t, "101"))
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	if !strings.Contains(rec.Body.String(), "RUN_PERSISTENCE_FAILED") {
		t.Fatalf("missing safe persistence error code: %s", rec.Body.String())
	}
	var run model.WorkflowRun
	if err := database.DB.Where("workflow_id = ?", workflow.ID).First(&run).Error; err != nil {
		t.Fatalf("load failed final run: %v", err)
	}
	if run.Status != "error" || !strings.Contains(run.Result, "RUN_PERSISTENCE_FAILED") {
		t.Fatalf("final persistence failure did not downgrade run: %#v", run)
	}
}
