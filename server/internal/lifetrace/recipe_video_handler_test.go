package lifetrace

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestRenderRecipeVideoValidatesRecipeId(t *testing.T) {
	router := setupTraceTestRouter(t, 101)

	originalUpload := uploadRecipeVideoToTOS
	uploadRecipeVideoToTOS = func(
		_ context.Context,
		userID string,
		recipeID string,
		videoBytes []byte,
	) (string, error) {
		return "", fmt.Errorf("should not be called with invalid recipe ID")
	}
	defer func() { uploadRecipeVideoToTOS = originalUpload }()

	// Missing recipeId
	req := httptest.NewRequest(http.MethodPost, "/api/v1/life-trace/ai/recipes/render-video",
		strings.NewReader(`{}`))
	req.Header.Set("Content-Type", "application/json")
	resp := httptest.NewRecorder()

	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for missing recipeId, got %d: %s", resp.Code, resp.Body.String())
	}
}

func TestRenderRecipeVideoCallsAIAndUploadsToTOS(t *testing.T) {
	// Mock AI server
	var capturedPrompt string
	aiServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var req map[string]any
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			t.Fatalf("decode AI request: %v", err)
		}

		messages := req["messages"].([]any)
		if len(messages) > 0 {
			lastMsg := messages[len(messages)-1].(map[string]any)
			capturedPrompt = lastMsg["content"].(string)
		}

		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{
			"id": "chatcmpl-123",
			"choices": [{
				"message": {
					"content": "<!DOCTYPE html><html><body><h1>Recipe Video</h1></body></html>"
				}
			}],
			"model": "gpt-recipe-video"
		}`))
	}))
	defer aiServer.Close()

	t.Setenv("OPENAI_API_KEY", "test-openai-key")
	t.Setenv("OPENAI_API_BASE_URL", aiServer.URL)
	t.Setenv("OPENAI_API_MODEL", "gpt-recipe-video")
	t.Setenv("ARK_API_KEY", "")
	t.Setenv("ARK_TEXT_MODEL", "")

	router := setupTraceTestRouter(t, 101)

	// Track TOS upload
	var uploadedVideoBytes []byte
	var uploadedPath string
	var uploadCalled bool

	originalUpload := uploadRecipeVideoToTOS
	uploadRecipeVideoToTOS = func(
		_ context.Context,
		userID string,
		recipeID string,
		videoBytes []byte,
	) (string, error) {
		uploadCalled = true
		uploadedVideoBytes = videoBytes
		uploadedPath = recipeID

		if userID != "101" {
			return "", fmt.Errorf("unexpected userID: %s", userID)
		}
		if recipeID != "recipe-1" {
			return "", fmt.Errorf("unexpected recipeID: %s", recipeID)
		}
		if len(videoBytes) == 0 {
			return "", fmt.Errorf("video bytes should not be empty")
		}

		return fmt.Sprintf("https://valley-resources.tos-cn-beijing.volces.com/life-trace/%s/recipe-videos/%s_20260625.mp4", userID, recipeID), nil
	}
	defer func() { uploadRecipeVideoToTOS = originalUpload }()

	// Mock render function
	originalRender := renderRecipeVideoMP4
	renderRecipeVideoMP4 = func(ctx context.Context, html string) ([]byte, error) {
		if !strings.Contains(html, "Recipe Video") {
			return nil, fmt.Errorf("unexpected HTML content: %s", html)
		}
		return []byte("mock-mp4-video-data"), nil
	}
	defer func() { renderRecipeVideoMP4 = originalRender }()

	// Execute request
	req := httptest.NewRequest(http.MethodPost, "/api/v1/life-trace/ai/recipes/render-video",
		strings.NewReader(`{"recipeId":"recipe-1"}`))
	req.Header.Set("Content-Type", "application/json")
	resp := httptest.NewRecorder()

	router.ServeHTTP(resp, req)

	// Verify response
	if resp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", resp.Code, resp.Body.String())
	}

	var result map[string]any
	if err := json.Unmarshal(resp.Body.Bytes(), &result); err != nil {
		t.Fatalf("decode response: %v", err)
	}

	if result["code"].(float64) != 0 {
		t.Fatalf("expected success code 0, got %v", result["code"])
	}

	data := result["data"].(map[string]any)
	if data["url"] == nil {
		t.Fatal("expected url in response")
	}
	if !strings.Contains(data["url"].(string), "recipe-videos/recipe-1_") {
		t.Fatalf("expected recipe video URL, got %s", data["url"])
	}
	if data["expiresAt"] == nil {
		t.Fatal("expected expiresAt in response")
	}

	// Verify TOS upload was called
	if !uploadCalled {
		t.Fatal("expected uploadRecipeVideoToTOS to be called")
	}
	if uploadedPath != "recipe-1" {
		t.Fatalf("expected recipeID recipe-1, got %s", uploadedPath)
	}
	if string(uploadedVideoBytes) != "mock-mp4-video-data" {
		t.Fatalf("expected video data to match, got %s", string(uploadedVideoBytes))
	}

	// Verify AI was called with correct prompt
	if capturedPrompt == "" {
		t.Fatal("expected AI prompt to be captured")
	}
	if !strings.Contains(capturedPrompt, "HyperFrames") {
		t.Fatalf("expected prompt to contain HyperFrames, got: %s", capturedPrompt)
	}
}

func TestRenderRecipeVideoHandlesRenderFailure(t *testing.T) {
	aiServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{
			"id": "chatcmpl-123",
			"choices": [{"message": {"content": "<html>test</html>"}}],
			"model": "gpt-recipe-video"
		}`))
	}))
	defer aiServer.Close()

	t.Setenv("OPENAI_API_KEY", "test-openai-key")
	t.Setenv("OPENAI_API_BASE_URL", aiServer.URL)
	t.Setenv("OPENAI_API_MODEL", "gpt-recipe-video")
	t.Setenv("ARK_API_KEY", "")
	t.Setenv("ARK_TEXT_MODEL", "")

	router := setupTraceTestRouter(t, 101)

	originalUpload := uploadRecipeVideoToTOS
	uploadRecipeVideoToTOS = func(
		_ context.Context,
		userID string,
		recipeID string,
		videoBytes []byte,
	) (string, error) {
		return "", fmt.Errorf("should not be called on render failure")
	}
	defer func() { uploadRecipeVideoToTOS = originalUpload }()

	originalRender := renderRecipeVideoMP4
	renderRecipeVideoMP4 = func(ctx context.Context, html string) ([]byte, error) {
		return nil, fmt.Errorf("render failed: invalid HTML structure")
	}
	defer func() { renderRecipeVideoMP4 = originalRender }()

	req := httptest.NewRequest(http.MethodPost, "/api/v1/life-trace/ai/recipes/render-video",
		strings.NewReader(`{"recipeId":"recipe-1"}`))
	req.Header.Set("Content-Type", "application/json")
	resp := httptest.NewRecorder()

	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusBadGateway {
		t.Fatalf("expected 502 on render failure, got %d: %s", resp.Code, resp.Body.String())
	}
	if !strings.Contains(resp.Body.String(), "视频渲染失败") {
		t.Fatalf("expected render failure message, got %s", resp.Body.String())
	}
}

func TestRenderRecipeVideoHandlesUploadFailure(t *testing.T) {
	aiServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{
			"id": "chatcmpl-123",
			"choices": [{"message": {"content": "<html>test</html>"}}],
			"model": "gpt-recipe-video"
		}`))
	}))
	defer aiServer.Close()

	t.Setenv("OPENAI_API_KEY", "test-openai-key")
	t.Setenv("OPENAI_API_BASE_URL", aiServer.URL)
	t.Setenv("OPENAI_API_MODEL", "gpt-recipe-video")
	t.Setenv("ARK_API_KEY", "")
	t.Setenv("ARK_TEXT_MODEL", "")

	router := setupTraceTestRouter(t, 101)

	originalUpload := uploadRecipeVideoToTOS
	uploadRecipeVideoToTOS = func(
		_ context.Context,
		userID string,
		recipeID string,
		videoBytes []byte,
	) (string, error) {
		return "", fmt.Errorf("TOS connection timeout")
	}
	defer func() { uploadRecipeVideoToTOS = originalUpload }()

	originalRender := renderRecipeVideoMP4
	renderRecipeVideoMP4 = func(ctx context.Context, html string) ([]byte, error) {
		return []byte("mock-video"), nil
	}
	defer func() { renderRecipeVideoMP4 = originalRender }()

	req := httptest.NewRequest(http.MethodPost, "/api/v1/life-trace/ai/recipes/render-video",
		strings.NewReader(`{"recipeId":"recipe-1"}`))
	req.Header.Set("Content-Type", "application/json")
	resp := httptest.NewRecorder()

	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusBadGateway {
		t.Fatalf("expected 502 on upload failure, got %d: %s", resp.Code, resp.Body.String())
	}
	if !strings.Contains(resp.Body.String(), "视频上传失败") {
		t.Fatalf("expected upload failure message, got %s", resp.Body.String())
	}
}

func TestRenderRecipeVideoPathContainsUserID(t *testing.T) {
	aiServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{
			"id": "chatcmpl-123",
			"choices": [{"message": {"content": "<html>test</html>"}}],
			"model": "gpt-recipe-video"
		}`))
	}))
	defer aiServer.Close()

	t.Setenv("OPENAI_API_KEY", "test-openai-key")
	t.Setenv("OPENAI_API_BASE_URL", aiServer.URL)
	t.Setenv("OPENAI_API_MODEL", "gpt-recipe-video")
	t.Setenv("ARK_API_KEY", "")
	t.Setenv("ARK_TEXT_MODEL", "")

	router := setupTraceTestRouter(t, 42)

	var capturedPath string
	originalUpload := uploadRecipeVideoToTOS
	uploadRecipeVideoToTOS = func(
		_ context.Context,
		userID string,
		recipeID string,
		videoBytes []byte,
	) (string, error) {
		capturedPath = userID
		if userID != "42" {
			return "", fmt.Errorf("expected userID 42, got %s", userID)
		}
		return "https://example.com/video.mp4", nil
	}
	defer func() { uploadRecipeVideoToTOS = originalUpload }()

	originalRender := renderRecipeVideoMP4
	renderRecipeVideoMP4 = func(ctx context.Context, html string) ([]byte, error) {
		return []byte("video"), nil
	}
	defer func() { renderRecipeVideoMP4 = originalRender }()

	req := httptest.NewRequest(http.MethodPost, "/api/v1/life-trace/ai/recipes/render-video",
		strings.NewReader(`{"recipeId":"recipe-99"}`))
	req.Header.Set("Content-Type", "application/json")
	resp := httptest.NewRecorder()

	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", resp.Code, resp.Body.String())
	}
	if capturedPath != "42" {
		t.Fatalf("expected captured userID 42, got %s", capturedPath)
	}
}

func TestRenderRecipeVideoResponseHasExpiration(t *testing.T) {
	aiServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{
			"id": "chatcmpl-123",
			"choices": [{"message": {"content": "<html>test</html>"}}],
			"model": "gpt-recipe-video"
		}`))
	}))
	defer aiServer.Close()

	t.Setenv("OPENAI_API_KEY", "test-openai-key")
	t.Setenv("OPENAI_API_BASE_URL", aiServer.URL)
	t.Setenv("OPENAI_API_MODEL", "gpt-recipe-video")
	t.Setenv("ARK_API_KEY", "")
	t.Setenv("ARK_TEXT_MODEL", "")

	router := setupTraceTestRouter(t, 101)

	originalUpload := uploadRecipeVideoToTOS
	uploadRecipeVideoToTOS = func(
		_ context.Context,
		userID string,
		recipeID string,
		videoBytes []byte,
	) (string, error) {
		return "https://example.com/video.mp4", nil
	}
	defer func() { uploadRecipeVideoToTOS = originalUpload }()

	originalRender := renderRecipeVideoMP4
	renderRecipeVideoMP4 = func(ctx context.Context, html string) ([]byte, error) {
		return []byte("video"), nil
	}
	defer func() { renderRecipeVideoMP4 = originalRender }()

	req := httptest.NewRequest(http.MethodPost, "/api/v1/life-trace/ai/recipes/render-video",
		strings.NewReader(`{"recipeId":"recipe-1"}`))
	req.Header.Set("Content-Type", "application/json")
	resp := httptest.NewRecorder()

	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", resp.Code, resp.Body.String())
	}

	var result map[string]any
	if err := json.Unmarshal(resp.Body.Bytes(), &result); err != nil {
		t.Fatalf("decode response: %v", err)
	}

	data := result["data"].(map[string]any)
	expiresAt := data["expiresAt"].(string)

	// Verify expiration is set (RFC3339 format)
	if expiresAt == "" {
		t.Fatal("expected expiresAt to be set")
	}

	// Should be roughly 7 days from now (allow 1 minute tolerance)
	if !strings.Contains(expiresAt, "2026-07-02") {
		t.Fatalf("expected expiration around 7 days from now (2026-07-02), got %s", expiresAt)
	}
}
