package handler

import (
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
	"time"

	"valley-server/internal/model"
)

func TestValidateAIImageConversationMessage(t *testing.T) {
	role, content, err := validateAIImageConversationMessage(createAIImageConversationMessageRequest{
		Role:    " assistant ",
		Content: "  生成一张夜景图  ",
	})
	if err != nil {
		t.Fatalf("expected valid message, got %v", err)
	}
	if role != "assistant" || content != "生成一张夜景图" {
		t.Fatalf("unexpected normalized message: role=%q content=%q", role, content)
	}

	for _, testCase := range []struct {
		name    string
		payload createAIImageConversationMessageRequest
	}{
		{name: "invalid role", payload: createAIImageConversationMessageRequest{Role: "system", Content: "hello"}},
		{name: "empty content", payload: createAIImageConversationMessageRequest{Role: "user"}},
		{name: "content too long", payload: createAIImageConversationMessageRequest{Role: "user", Content: string(make([]rune, maxAIImageConversationMessageRunes+1))}},
	} {
		t.Run(testCase.name, func(t *testing.T) {
			if _, _, err := validateAIImageConversationMessage(testCase.payload); err == nil {
				t.Fatal("expected validation error")
			}
		})
	}
}

func TestAIImageConversationHistoryEndpointsAreOwnerScoped(t *testing.T) {
	router, db := setupAIPlatformTestRouter(t)
	now := time.Now()
	older := model.AIImageConversation{
		UserID:    101,
		Title:     "旧对话",
		UpdatedAt: now.Add(-time.Hour),
	}
	newer := model.AIImageConversation{
		UserID:    101,
		Title:     "新对话",
		UpdatedAt: now,
	}
	foreign := model.AIImageConversation{
		UserID:    202,
		Title:     "他人的对话",
		UpdatedAt: now.Add(time.Hour),
	}
	for _, conversation := range []*model.AIImageConversation{&older, &newer, &foreign} {
		if err := db.Create(conversation).Error; err != nil {
			t.Fatalf("create conversation: %v", err)
		}
	}
	message := model.AIImageConversationMessage{
		UserID:         101,
		ConversationID: older.ID,
		Role:           "user",
		Content:        "继续修改旧图片",
	}
	if err := db.Create(&message).Error; err != nil {
		t.Fatalf("create conversation message: %v", err)
	}

	listRequest := httptest.NewRequest(http.MethodGet, "/ai/image-conversations", nil)
	listRequest.Header.Set("Authorization", aiPlatformAuthHeader(t))
	listRecorder := httptest.NewRecorder()
	router.ServeHTTP(listRecorder, listRequest)
	listBody := listRecorder.Body.String()
	if listRecorder.Code != http.StatusOK ||
		!strings.Contains(listBody, "新对话") ||
		!strings.Contains(listBody, "旧对话") ||
		strings.Contains(listBody, "他人的对话") ||
		strings.Index(listBody, "新对话") > strings.Index(listBody, "旧对话") {
		t.Fatalf("unexpected conversation list response: %d body=%s", listRecorder.Code, listBody)
	}

	detailPath := "/ai/image-conversations/" + strconv.FormatInt(int64(older.ID), 10)
	detailRequest := httptest.NewRequest(http.MethodGet, detailPath, nil)
	detailRequest.Header.Set("Authorization", aiPlatformAuthHeader(t))
	detailRecorder := httptest.NewRecorder()
	router.ServeHTTP(detailRecorder, detailRequest)
	if detailRecorder.Code != http.StatusOK ||
		!strings.Contains(detailRecorder.Body.String(), "继续修改旧图片") {
		t.Fatalf(
			"unexpected conversation detail response: %d body=%s",
			detailRecorder.Code,
			detailRecorder.Body.String(),
		)
	}

	foreignPath := "/ai/image-conversations/" + strconv.FormatInt(int64(foreign.ID), 10)
	foreignRequest := httptest.NewRequest(http.MethodGet, foreignPath, nil)
	foreignRequest.Header.Set("Authorization", aiPlatformAuthHeader(t))
	foreignRecorder := httptest.NewRecorder()
	router.ServeHTTP(foreignRecorder, foreignRequest)
	if foreignRecorder.Code != http.StatusOK ||
		!strings.Contains(foreignRecorder.Body.String(), `"code":404`) {
		t.Fatalf(
			"foreign conversation response: %d body=%s",
			foreignRecorder.Code,
			foreignRecorder.Body.String(),
		)
	}

	clearRequest := httptest.NewRequest(http.MethodDelete, detailPath+"/messages", nil)
	clearRequest.Header.Set("Authorization", aiPlatformAuthHeader(t))
	clearRecorder := httptest.NewRecorder()
	router.ServeHTTP(clearRecorder, clearRequest)
	if clearRecorder.Code != http.StatusOK {
		t.Fatalf(
			"clear conversation response: %d body=%s",
			clearRecorder.Code,
			clearRecorder.Body.String(),
		)
	}
	var messageCount int64
	if err := db.Model(&model.AIImageConversationMessage{}).
		Where("conversation_id = ?", older.ID).
		Count(&messageCount).Error; err != nil {
		t.Fatalf("count cleared messages: %v", err)
	}
	if messageCount != 0 {
		t.Fatalf("expected cleared conversation messages, got %d", messageCount)
	}

	untitled := model.AIImageConversation{UserID: 101, Title: "新图片对话"}
	if err := db.Create(&untitled).Error; err != nil {
		t.Fatalf("create untitled conversation: %v", err)
	}
	addMessagePath := "/ai/image-conversations/" +
		strconv.FormatInt(int64(untitled.ID), 10) +
		"/messages"
	addMessageRequest := httptest.NewRequest(
		http.MethodPost,
		addMessagePath,
		strings.NewReader(`{"role":"user","content":"生成一张森林里的玻璃小屋"}`),
	)
	addMessageRequest.Header.Set("Authorization", aiPlatformAuthHeader(t))
	addMessageRequest.Header.Set("Content-Type", "application/json")
	addMessageRecorder := httptest.NewRecorder()
	router.ServeHTTP(addMessageRecorder, addMessageRequest)
	if addMessageRecorder.Code != http.StatusOK ||
		!strings.Contains(addMessageRecorder.Body.String(), `"title":"生成一张森林里的玻璃小屋"`) {
		t.Fatalf(
			"conversation title response: %d body=%s",
			addMessageRecorder.Code,
			addMessageRecorder.Body.String(),
		)
	}
}
