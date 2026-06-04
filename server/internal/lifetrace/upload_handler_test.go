package lifetrace

import (
	"bytes"
	"encoding/json"
	"errors"
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

func TestPublicLifeTraceUploadErrorMessageHidesTOSDetails(t *testing.T) {
	raw := `文件上传失败: failed to upload to TOS: tos: request error: Message=Put "https://valley-resources.tos-cn-beijing.volces.com/life-trace/101/20260604/photo.jpg": dial tcp 120.255.0.186:443: i/o timeout, RequestID=abc`
	message := publicLifeTraceUploadErrorMessage(errors.New(raw))

	if message != "图片上传失败，请检查网络后重试。" {
		t.Fatalf("unexpected public message: %s", message)
	}
	for _, leaked := range []string{"https://", "120.255.0.186", "RequestID", "tos-cn-beijing"} {
		if strings.Contains(message, leaked) {
			t.Fatalf("public message leaked internal detail %q: %s", leaked, message)
		}
	}
}

func TestPublicLifeTraceUploadErrorMessageKeepsValidationDetails(t *testing.T) {
	message := publicLifeTraceUploadErrorMessage(errors.New("文件过大，最大支持 10MB"))
	if message != "文件过大，最大支持 10MB" {
		t.Fatalf("expected validation message to pass through, got %s", message)
	}
}
