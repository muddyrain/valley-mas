package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
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

const aiAgentTestSecret = "ai-agent-test-secret"

func setupAIAgentTestRouter(t *testing.T) *gin.Engine {
	t.Helper()
	gin.SetMode(gin.TestMode)

	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(&model.User{}, &model.AIAgent{}, &model.AIConversation{}, &model.AIMessage{}); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	if err := db.Create(&[]model.User{
		{ID: 101, Username: "agent-user", Role: "user", IsActive: true},
		{ID: 202, Username: "other-user", Role: "user", IsActive: true},
	}).Error; err != nil {
		t.Fatalf("seed users: %v", err)
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

	cfg := &config.Config{JWT: config.JWTConfig{Secret: aiAgentTestSecret}}
	router := gin.New()
	auth := router.Group("/ai")
	auth.Use(middleware.Auth(cfg))
	auth.GET("/agents", ListAIAgents)
	auth.POST("/agents", CreateAIAgent)
	auth.GET("/agents/:agentId", GetAIAgent)
	auth.PATCH("/agents/:agentId", UpdateAIAgent)
	auth.DELETE("/agents/:agentId", DeleteAIAgent)
	auth.GET("/agents/:agentId/conversations", ListAIConversations)
	auth.POST("/agents/:agentId/conversations", CreateAIConversation)
	auth.GET("/agents/:agentId/conversations/:conversationId", GetAIConversation)
	auth.DELETE("/agents/:agentId/conversations/:conversationId", DeleteAIConversation)
	auth.POST("/agents/:agentId/conversations/:conversationId/chat", ChatWithAIAgent)
	return router
}

func aiAgentAuthHeader(t *testing.T, userID string) string {
	t.Helper()
	token, err := utils.GenerateToken(userID, "tester", "user", aiAgentTestSecret, 1)
	if err != nil {
		t.Fatalf("generate token: %v", err)
	}
	return "Bearer " + token
}

func decodeAIAgentData(t *testing.T, rec *httptest.ResponseRecorder) map[string]interface{} {
	t.Helper()
	var body struct {
		Code int                    `json:"code"`
		Data map[string]interface{} `json:"data"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode response: %v\n%s", err, rec.Body.String())
	}
	if body.Code != 0 {
		t.Fatalf("unexpected response code %d body=%s", body.Code, rec.Body.String())
	}
	return body.Data
}

func requestAIAgent(t *testing.T, router *gin.Engine, method string, path string, userID string, body string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(method, path, bytes.NewBufferString(body))
	if userID != "" {
		req.Header.Set("Authorization", aiAgentAuthHeader(t, userID))
	}
	if body != "" {
		req.Header.Set("Content-Type", "application/json")
	}
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	return rec
}

func TestAIAgentsRequireAuth(t *testing.T) {
	router := setupAIAgentTestRouter(t)

	rec := requestAIAgent(t, router, http.MethodGet, "/ai/agents", "", "")

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected unauthorized, got %d body=%s", rec.Code, rec.Body.String())
	}
}

func TestAIAgentCreateListUpdateDeleteForCurrentUser(t *testing.T) {
	router := setupAIAgentTestRouter(t)

	createResp := requestAIAgent(t, router, http.MethodPost, "/ai/agents", "101", `{
		"name":"写作助手",
		"description":"帮我润色文案",
		"avatarColor":"#8fb4ff",
		"avatarIcon":"pen",
		"systemPrompt":"你是一名中文写作助手。",
		"openingMessage":"把草稿发给我。",
		"exampleQuestions":["帮我改写这段话"]
	}`)
	if createResp.Code != http.StatusOK {
		t.Fatalf("expected create 200, got %d body=%s", createResp.Code, createResp.Body.String())
	}
	agent := decodeAIAgentData(t, createResp)["agent"].(map[string]interface{})
	agentID := agent["id"].(string)
	if agent["name"] != "写作助手" || agent["status"] != "active" {
		t.Fatalf("unexpected agent: %+v", agent)
	}

	updateResp := requestAIAgent(t, router, http.MethodPatch, "/ai/agents/"+agentID, "101", `{"name":"改写助手","systemPrompt":"你只负责改写。"}`)
	updated := decodeAIAgentData(t, updateResp)["agent"].(map[string]interface{})
	if updated["name"] != "改写助手" || updated["systemPrompt"] != "你只负责改写。" {
		t.Fatalf("unexpected updated agent: %+v", updated)
	}

	listResp := requestAIAgent(t, router, http.MethodGet, "/ai/agents", "101", "")
	listData := decodeAIAgentData(t, listResp)
	agents := listData["agents"].([]interface{})
	if len(agents) != 1 || agents[0].(map[string]interface{})["id"] != agentID {
		t.Fatalf("unexpected agents: %+v", listData)
	}

	deleteResp := requestAIAgent(t, router, http.MethodDelete, "/ai/agents/"+agentID, "101", "")
	deleteData := decodeAIAgentData(t, deleteResp)
	if deleteData["deletedId"] != agentID || deleteData["nextAgentId"] == "" {
		t.Fatalf("unexpected delete payload: %+v", deleteData)
	}
}

func TestAIAgentDataIsIsolatedByUser(t *testing.T) {
	router := setupAIAgentTestRouter(t)

	createResp := requestAIAgent(t, router, http.MethodPost, "/ai/agents", "202", `{"name":"其他用户助手","systemPrompt":"private"}`)
	agentID := decodeAIAgentData(t, createResp)["agent"].(map[string]interface{})["id"].(string)

	getResp := requestAIAgent(t, router, http.MethodGet, "/ai/agents/"+agentID, "101", "")
	if getResp.Code != http.StatusNotFound {
		t.Fatalf("expected current user cannot read other user's agent, got %d body=%s", getResp.Code, getResp.Body.String())
	}
}

func TestAIAgentConversationStoresMessagesAndConfigFailureDoesNotSaveAssistant(t *testing.T) {
	router := setupAIAgentTestRouter(t)
	t.Setenv("ARK_API_KEY", "")
	t.Setenv("ARK_TEXT_MODEL", "")

	createResp := requestAIAgent(t, router, http.MethodPost, "/ai/agents", "101", `{"name":"默认助手","systemPrompt":"你是测试助手。"}`)
	agentID := decodeAIAgentData(t, createResp)["agent"].(map[string]interface{})["id"].(string)
	conversationResp := requestAIAgent(t, router, http.MethodPost, "/ai/agents/"+agentID+"/conversations", "101", `{"title":"测试对话"}`)
	conversationID := decodeAIAgentData(t, conversationResp)["conversation"].(map[string]interface{})["id"].(string)

	chatResp := requestAIAgent(t, router, http.MethodPost, "/ai/agents/"+agentID+"/conversations/"+conversationID+"/chat", "101", `{"message":"你好"}`)
	if chatResp.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503 when ARK is not configured, got %d body=%s", chatResp.Code, chatResp.Body.String())
	}

	var messages []model.AIMessage
	if err := database.GetDB().
		Where("user_id = ? AND agent_id = ? AND conversation_id = ?", model.Int64String(101), agentID, conversationID).
		Order("created_at ASC").
		Find(&messages).Error; err != nil {
		t.Fatalf("list messages: %v", err)
	}
	if len(messages) != 1 || messages[0].Role != "user" || messages[0].Content != "你好" {
		t.Fatalf("expected only user message persisted on config failure, got %+v", messages)
	}
}
