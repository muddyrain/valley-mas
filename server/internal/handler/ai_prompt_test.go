package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
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
	}
	createRecorder := httptest.NewRecorder()
	router.ServeHTTP(createRecorder, aiPromptRequest(t, http.MethodPost, "/ai/prompts", "101", create))
	prompt := decodeAIPromptData[aiPromptView](t, createRecorder)
	if prompt.ID == 0 || prompt.Content != create.Content {
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
