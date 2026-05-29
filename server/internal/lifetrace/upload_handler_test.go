package lifetrace

import (
	"bytes"
	"encoding/json"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestUploadImageRequiresFile(t *testing.T) {
	router := setupTraceTestRouter(t, 101)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/life-trace/uploads/image", nil)
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.Code)
	}

	var payload map[string]interface{}
	if err := json.Unmarshal(resp.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode response: %v\nbody: %s", err, resp.Body.String())
	}
	if payload["code"].(float64) == 0 {
		t.Fatalf("expected missing file validation failure, got %+v", payload)
	}
	if payload["message"] != "请上传图片" {
		t.Fatalf("unexpected message: %+v", payload)
	}
}

func TestUploadImageReportsUnconfiguredStorage(t *testing.T) {
	router := setupTraceTestRouter(t, 101)
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	part, err := writer.CreateFormFile("file", "dinner.png")
	if err != nil {
		t.Fatalf("create multipart file: %v", err)
	}
	if _, err := part.Write([]byte("not-a-real-image-but-valid-upload-body")); err != nil {
		t.Fatalf("write multipart file: %v", err)
	}
	if err := writer.Close(); err != nil {
		t.Fatalf("close multipart writer: %v", err)
	}

	req := httptest.NewRequest(http.MethodPost, "/api/v1/life-trace/uploads/image", body)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.Code)
	}
	var payload map[string]interface{}
	if err := json.Unmarshal(resp.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode response: %v\nbody: %s", err, resp.Body.String())
	}
	if payload["code"].(float64) == 0 {
		t.Fatalf("expected upload failure without configured TOS, got %+v", payload)
	}
	if !strings.Contains(payload["message"].(string), "文件上传服务未配置") {
		t.Fatalf("expected actionable TOS config failure, got %+v", payload)
	}
}
