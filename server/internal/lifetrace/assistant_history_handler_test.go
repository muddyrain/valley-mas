package lifetrace

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"
	"valley-server/internal/database"
	"valley-server/internal/model"
)

func TestAssistantConversationStoresMessagesForCurrentUser(t *testing.T) {
	router := setupTraceTestRouter(t, 101)

	createReq := httptest.NewRequest(
		http.MethodPost,
		"/api/v1/life-trace/ai/conversation/messages",
		bytes.NewBufferString(`{"role":"user","content":"明天中午吃饭"}`),
	)
	createReq.Header.Set("Content-Type", "application/json")
	createResp := httptest.NewRecorder()
	router.ServeHTTP(createResp, createReq)

	if createResp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", createResp.Code, createResp.Body.String())
	}
	created := decodeTracePayload(t, createResp)["data"].(map[string]interface{})
	if created["role"] != "user" || created["content"] != "明天中午吃饭" {
		t.Fatalf("unexpected created message: %+v", created)
	}

	listReq := httptest.NewRequest(http.MethodGet, "/api/v1/life-trace/ai/conversation", nil)
	listResp := httptest.NewRecorder()
	router.ServeHTTP(listResp, listReq)

	data := decodeTracePayload(t, listResp)["data"].(map[string]interface{})
	messages := data["messages"].([]interface{})
	if len(messages) != 1 {
		t.Fatalf("expected one message, got %+v", messages)
	}
	message := messages[0].(map[string]interface{})
	if message["content"] != "明天中午吃饭" {
		t.Fatalf("unexpected listed message: %+v", message)
	}
}

func TestAssistantConversationOnlyReturnsCurrentUserMessages(t *testing.T) {
	router := setupTraceTestRouter(t, 101)

	otherConversation := model.LifeTraceAIConversation{
		UserID: 202,
		Title:  "其他用户对话",
		Status: "active",
	}
	if err := database.GetDB().Create(&otherConversation).Error; err != nil {
		t.Fatalf("seed other conversation: %v", err)
	}
	if err := database.GetDB().Create(&model.LifeTraceAIMessage{
		UserID:         202,
		ConversationID: otherConversation.ID,
		Role:           "user",
		Content:        "不应该出现",
	}).Error; err != nil {
		t.Fatalf("seed other message: %v", err)
	}

	req := httptest.NewRequest(http.MethodGet, "/api/v1/life-trace/ai/conversation", nil)
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	data := decodeTracePayload(t, resp)["data"].(map[string]interface{})
	messages := data["messages"].([]interface{})
	if len(messages) != 0 {
		t.Fatalf("expected no messages for current user, got %+v", messages)
	}
}

func TestClearAssistantConversationDeletesOnlyCurrentUserMessages(t *testing.T) {
	router := setupTraceTestRouter(t, 101)

	currentConversation := model.LifeTraceAIConversation{UserID: 101, Status: "active"}
	otherConversation := model.LifeTraceAIConversation{UserID: 202, Status: "active"}
	if err := database.GetDB().Create(&currentConversation).Error; err != nil {
		t.Fatalf("seed current conversation: %v", err)
	}
	if err := database.GetDB().Create(&otherConversation).Error; err != nil {
		t.Fatalf("seed other conversation: %v", err)
	}
	if err := database.GetDB().Create(&[]model.LifeTraceAIMessage{
		{UserID: 101, ConversationID: currentConversation.ID, Role: "user", Content: "清空我"},
		{UserID: 202, ConversationID: otherConversation.ID, Role: "user", Content: "保留我"},
	}).Error; err != nil {
		t.Fatalf("seed messages: %v", err)
	}

	req := httptest.NewRequest(http.MethodDelete, "/api/v1/life-trace/ai/conversation", nil)
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)
	decodeTracePayload(t, resp)

	var currentCount int64
	if err := database.GetDB().
		Model(&model.LifeTraceAIMessage{}).
		Where("user_id = ? AND conversation_id = ?", 101, currentConversation.ID).
		Count(&currentCount).Error; err != nil {
		t.Fatalf("count current messages: %v", err)
	}
	if currentCount != 0 {
		t.Fatalf("expected current messages cleared, got %d", currentCount)
	}

	var otherCount int64
	if err := database.GetDB().
		Model(&model.LifeTraceAIMessage{}).
		Where("user_id = ? AND conversation_id = ?", 202, otherConversation.ID).
		Count(&otherCount).Error; err != nil {
		t.Fatalf("count other messages: %v", err)
	}
	if otherCount != 1 {
		t.Fatalf("expected other messages to remain, got %d", otherCount)
	}
}

func TestAssistantConversationsCanCreateSwitchAndDeleteTopics(t *testing.T) {
	router := setupTraceTestRouter(t, 101)

	createTopicReq := httptest.NewRequest(
		http.MethodPost,
		"/api/v1/life-trace/ai/conversations",
		bytes.NewBufferString(`{"title":"库存咨询"}`),
	)
	createTopicReq.Header.Set("Content-Type", "application/json")
	createTopicResp := httptest.NewRecorder()
	router.ServeHTTP(createTopicResp, createTopicReq)

	topic := decodeTracePayload(t, createTopicResp)["data"].(map[string]interface{})
	topicID := topic["id"].(string)
	if topic["title"] != "库存咨询" || topicID == "" {
		t.Fatalf("unexpected topic: %+v", topic)
	}

	createMessageReq := httptest.NewRequest(
		http.MethodPost,
		"/api/v1/life-trace/ai/conversations/"+topicID+"/messages",
		bytes.NewBufferString(`{"role":"user","content":"饼干保质期 7 天"}`),
	)
	createMessageReq.Header.Set("Content-Type", "application/json")
	createMessageResp := httptest.NewRecorder()
	router.ServeHTTP(createMessageResp, createMessageReq)
	createdMessage := decodeTracePayload(t, createMessageResp)["data"].(map[string]interface{})
	if createdMessage["conversationId"] != topicID {
		t.Fatalf("expected message in topic %s, got %+v", topicID, createdMessage)
	}

	getTopicReq := httptest.NewRequest(http.MethodGet, "/api/v1/life-trace/ai/conversations/"+topicID, nil)
	getTopicResp := httptest.NewRecorder()
	router.ServeHTTP(getTopicResp, getTopicReq)
	topicData := decodeTracePayload(t, getTopicResp)["data"].(map[string]interface{})
	messages := topicData["messages"].([]interface{})
	if len(messages) != 1 || messages[0].(map[string]interface{})["content"] != "饼干保质期 7 天" {
		t.Fatalf("unexpected topic messages: %+v", messages)
	}

	listReq := httptest.NewRequest(http.MethodGet, "/api/v1/life-trace/ai/conversations", nil)
	listResp := httptest.NewRecorder()
	router.ServeHTTP(listResp, listReq)
	listData := decodeTracePayload(t, listResp)["data"].(map[string]interface{})
	conversations := listData["list"].([]interface{})
	if len(conversations) == 0 {
		t.Fatalf("expected at least one conversation, got %+v", listData)
	}

	deleteReq := httptest.NewRequest(http.MethodDelete, "/api/v1/life-trace/ai/conversations/"+topicID, nil)
	deleteResp := httptest.NewRecorder()
	router.ServeHTTP(deleteResp, deleteReq)
	deleteData := decodeTracePayload(t, deleteResp)["data"].(map[string]interface{})
	if deleteData["deletedId"] != topicID || deleteData["nextConversationId"] == "" {
		t.Fatalf("unexpected delete payload: %+v", deleteData)
	}

	var messageCount int64
	if err := database.GetDB().
		Model(&model.LifeTraceAIMessage{}).
		Where("user_id = ? AND conversation_id = ?", model.Int64String(101), topicID).
		Count(&messageCount).Error; err != nil {
		t.Fatalf("count deleted topic messages: %v", err)
	}
	if messageCount != 0 {
		t.Fatalf("expected topic messages deleted, got %d", messageCount)
	}
}
