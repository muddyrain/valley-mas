package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"valley-server/internal/config"
	"valley-server/internal/database"
	"valley-server/internal/logger"
	"valley-server/internal/middleware"
	"valley-server/internal/model"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func setupAIPromptTestRouter(t *testing.T) *gin.Engine {
	t.Helper()
	gin.SetMode(gin.TestMode)
	t.Setenv("DISABLE_FILE_LOG", "1")
	logger.InitLogger()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(&model.User{}, &model.AIPrompt{}); err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&[]model.User{{ID: 101, Username: "prompt-owner", Role: "user", IsActive: true}, {ID: 202, Username: "prompt-other", Role: "user", IsActive: true}}).Error; err != nil {
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
	auth := router.Group("/ai")
	auth.Use(middleware.Auth(&config.Config{JWT: config.JWTConfig{Secret: workflowRuntimeTestSecret}}))
	auth.GET("/prompts", ListAIPrompts)
	auth.POST("/prompts", CreateAIPrompt)
	auth.POST("/prompts/import-preview", PreviewAIPromptImport)
	auth.POST("/prompts/import", CreateImportedAIPrompt)
	auth.GET("/prompts/:promptId", GetAIPrompt)
	auth.PATCH("/prompts/:promptId", UpdateAIPrompt)
	auth.DELETE("/prompts/:promptId", ArchiveAIPrompt)
	return router
}

func aiPromptRequest(t *testing.T, method, path, userID string, body any) *http.Request {
	t.Helper()
	var payload []byte
	if body != nil {
		var err error
		payload, err = json.Marshal(body)
		if err != nil {
			t.Fatal(err)
		}
	}
	req := httptest.NewRequest(method, path, bytes.NewReader(payload))
	req.Header.Set("Authorization", workflowRuntimeAuthHeader(t, userID))
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	return req
}

func decodeAIPromptData[T any](t *testing.T, recorder *httptest.ResponseRecorder) T {
	t.Helper()
	if responseCode(recorder) != 0 {
		t.Fatalf("response: %s", recorder.Body.String())
	}
	var response struct {
		Data T `json:"data"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatal(err)
	}
	return response.Data
}

func TestAIPromptStoresSimpleLibraryEntryAndArchivesPerOwner(t *testing.T) {
	router := setupAIPromptTestRouter(t)
	create := aiPromptPayload{
		Name:        "内容摘要",
		Description: "生成简明摘要",
		Content:     "你是一名编辑，请用三点概括输入内容。",
		Tags:        []string{"通用", "写作", "通用"},
	}
	createRecorder := httptest.NewRecorder()
	router.ServeHTTP(createRecorder, aiPromptRequest(t, http.MethodPost, "/ai/prompts", "101", create))
	prompt := decodeAIPromptData[aiPromptView](t, createRecorder)
	if prompt.ID == 0 || prompt.Content != create.Content ||
		len(prompt.Tags) != 2 || prompt.Tags[0] != "通用" || prompt.SourceURL != "" || prompt.ImportedAt != nil {
		t.Fatalf("created prompt=%+v", prompt)
	}

	create.Content = "请将输入内容压缩为一句话摘要。"
	updateRecorder := httptest.NewRecorder()
	router.ServeHTTP(updateRecorder, aiPromptRequest(t, http.MethodPatch, "/ai/prompts/"+prompt.ID.String(), "101", create))
	updated := decodeAIPromptData[aiPromptView](t, updateRecorder)
	if updated.Content != create.Content || updated.Description != create.Description {
		t.Fatalf("updated prompt=%+v", updated)
	}

	otherRecorder := httptest.NewRecorder()
	router.ServeHTTP(otherRecorder, aiPromptRequest(t, http.MethodGet, "/ai/prompts/"+prompt.ID.String(), "202", nil))
	var otherResponse struct {
		Code int `json:"code"`
	}
	if err := json.Unmarshal(otherRecorder.Body.Bytes(), &otherResponse); err != nil {
		t.Fatal(err)
	}
	if otherResponse.Code != http.StatusNotFound {
		t.Fatalf("other owner code=%d body=%s", otherResponse.Code, otherRecorder.Body.String())
	}

	archiveRecorder := httptest.NewRecorder()
	router.ServeHTTP(archiveRecorder, aiPromptRequest(t, http.MethodDelete, "/ai/prompts/"+prompt.ID.String(), "101", nil))
	decodeAIPromptData[any](t, archiveRecorder)
	listRecorder := httptest.NewRecorder()
	router.ServeHTTP(listRecorder, aiPromptRequest(t, http.MethodGet, "/ai/prompts", "101", nil))
	list := decodeAIPromptData[struct {
		List []aiPromptView `json:"list"`
	}](t, listRecorder).List
	if len(list) != 0 {
		t.Fatalf("archived prompt must not be in default list: %+v", list)
	}
}

func TestAIPromptImportPreviewsAndStoresRawSkill(t *testing.T) {
	router := setupAIPromptTestRouter(t)
	previousFetch := fetchAIPromptImportSource
	skillContent := strings.TrimSpace(
		"# Minimal Zine\n\n" + strings.Repeat("Preserve the complete visual rule set.\n", 100),
	)
	fetchAIPromptImportSource = func(context.Context, string) (aiPromptImportSource, error) {
		return aiPromptImportSource{
			Name: "minimal-zine", Content: skillContent,
			URL: "https://github.com/example/minimal-zine", Author: "example",
		}, nil
	}
	t.Cleanup(func() {
		fetchAIPromptImportSource = previousFetch
	})

	previewRecorder := httptest.NewRecorder()
	router.ServeHTTP(previewRecorder, aiPromptRequest(t, http.MethodPost, "/ai/prompts/import-preview", "101", aiPromptImportPreviewRequest{
		URL: "https://github.com/example/minimal-zine",
	}))
	preview := decodeAIPromptData[aiPromptImportDraft](t, previewRecorder)
	if preview.Name != "minimal-zine" || preview.Content != skillContent ||
		preview.Description != "" || len(preview.Tags) != 0 ||
		preview.SourceAuthor != "example" || preview.SourceLicense != "" {
		t.Fatalf("preview=%+v", preview)
	}

	importRecorder := httptest.NewRecorder()
	router.ServeHTTP(importRecorder, aiPromptRequest(t, http.MethodPost, "/ai/prompts/import", "101", aiPromptImportPayload{
		Name: preview.Name, Description: preview.Description, Content: preview.Content, Tags: preview.Tags,
		SourceURL: preview.SourceURL, SourceAuthor: preview.SourceAuthor, SourceLicense: preview.SourceLicense,
	}))
	prompt := decodeAIPromptData[aiPromptView](t, importRecorder)
	if prompt.SourceURL != preview.SourceURL || prompt.SourceAuthor != "example" ||
		prompt.Content != skillContent || prompt.SourceLicense != "" || prompt.ImportedAt == nil {
		t.Fatalf("imported prompt=%+v", prompt)
	}
}

func TestNormalizeGitHubRepositoryURLRejectsOtherHosts(t *testing.T) {
	if _, _, _, err := normalizeGitHubRepositoryURL("https://example.com/owner/repo"); err == nil {
		t.Fatal("expected non-GitHub URL to be rejected")
	}
	canonical, owner, repository, err := normalizeGitHubRepositoryURL("https://github.com/owner/repo/tree/main")
	if err != nil || canonical != "https://github.com/owner/repo" || owner != "owner" || repository != "repo" {
		t.Fatalf("normalized=%q owner=%q repository=%q err=%v", canonical, owner, repository, err)
	}
}

type aiPromptImportRoundTripFunc func(*http.Request) (*http.Response, error)

func (roundTrip aiPromptImportRoundTripFunc) RoundTrip(request *http.Request) (*http.Response, error) {
	return roundTrip(request)
}

func TestFetchGitHubAIPromptImportSourceReadsOnlyRawHeadSkill(t *testing.T) {
	previousClient := promptImportHTTPClient
	requestCount := 0
	promptImportHTTPClient = &http.Client{Transport: aiPromptImportRoundTripFunc(func(request *http.Request) (*http.Response, error) {
		requestCount++
		status := http.StatusTeapot
		body := "unexpected request"
		if request.URL.Host == "raw.githubusercontent.com" &&
			request.URL.Path == "/owner/minimal-zine/HEAD/SKILL.md" {
			status = http.StatusOK
			body = "# Minimal Zine\nGenerate a sparse paper poster."
		}
		return &http.Response{
			StatusCode: status,
			Body:       io.NopCloser(strings.NewReader(body)),
			Header:     make(http.Header),
		}, nil
	})}
	t.Cleanup(func() {
		promptImportHTTPClient = previousClient
	})

	source, err := fetchGitHubAIPromptImportSource(context.Background(), "https://github.com/owner/minimal-zine")
	if err != nil {
		t.Fatal(err)
	}
	if requestCount != 1 || source.Name != "minimal-zine" || source.Author != "owner" ||
		source.URL != "https://github.com/owner/minimal-zine" ||
		!strings.Contains(source.Content, "Generate a sparse paper poster.") {
		t.Fatalf("source=%+v", source)
	}
}

func TestFetchGitHubAIPromptImportSourceReportsMissingRootSkill(t *testing.T) {
	previousClient := promptImportHTTPClient
	promptImportHTTPClient = &http.Client{Transport: aiPromptImportRoundTripFunc(func(request *http.Request) (*http.Response, error) {
		return &http.Response{
			StatusCode: http.StatusNotFound,
			Body:       io.NopCloser(strings.NewReader(`{"message":"Not Found"}`)),
			Header:     make(http.Header),
		}, nil
	})}
	t.Cleanup(func() {
		promptImportHTTPClient = previousClient
	})

	_, err := fetchGitHubAIPromptImportSource(context.Background(), "https://github.com/owner/minimal-zine")
	if err == nil || !strings.Contains(err.Error(), "仓库根目录的 SKILL.md") {
		t.Fatalf("err=%v", err)
	}
}

func TestAIPromptRejectsEmptyLibraryContent(t *testing.T) {
	router := setupAIPromptTestRouter(t)
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, aiPromptRequest(t, http.MethodPost, "/ai/prompts", "101", aiPromptPayload{Name: "空内容"}))
	var response Response
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatal(err)
	}
	if response.Code != http.StatusBadRequest || response.Message != "提示词不能为空" {
		t.Fatalf("unexpected response: %s", recorder.Body.String())
	}
}
