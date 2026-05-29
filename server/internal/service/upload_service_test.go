package service

import (
	"mime/multipart"
	"strings"
	"testing"
)

func TestLifeTraceUploadConfigAndStoragePath(t *testing.T) {
	config := GetDefaultConfig(UploadTypeLifeTrace)
	if config.Type != UploadTypeLifeTrace {
		t.Fatalf("expected life trace upload type, got %s", config.Type)
	}
	if config.MaxSize != 10 {
		t.Fatalf("expected 10MB life trace max size, got %d", config.MaxSize)
	}
	if len(config.AllowedExts) != 4 || config.AllowedExts[0] != ".jpg" || config.AllowedExts[3] != ".webp" {
		t.Fatalf("unexpected life trace allowed extensions: %+v", config.AllowedExts)
	}

	config.UserID = 101
	config.CustomFolder = "life-trace/101/20260529"
	path := (&UploadService{}).GenerateStoragePath(config, "Dinner.JPG")
	if !strings.HasPrefix(path, "life-trace/101/20260529/") {
		t.Fatalf("expected custom life trace folder, got %s", path)
	}
	if !strings.HasSuffix(path, ".jpg") {
		t.Fatalf("expected lowercase extension, got %s", path)
	}
}

func TestValidateLifeTraceUploadFile(t *testing.T) {
	service := &UploadService{}
	config := GetDefaultConfig(UploadTypeLifeTrace)

	if err := service.ValidateFile(&multipart.FileHeader{
		Filename: "photo.webp",
		Size:     10 * 1024 * 1024,
	}, config); err != nil {
		t.Fatalf("expected max-size webp to pass validation: %v", err)
	}

	if err := service.ValidateFile(&multipart.FileHeader{
		Filename: "photo.gif",
		Size:     1024,
	}, config); err == nil || !strings.Contains(err.Error(), "不支持的文件类型") {
		t.Fatalf("expected unsupported extension error, got %v", err)
	}

	if err := service.ValidateFile(&multipart.FileHeader{
		Filename: "photo.png",
		Size:     10*1024*1024 + 1,
	}, config); err == nil || !strings.Contains(err.Error(), "文件过大") {
		t.Fatalf("expected size limit error, got %v", err)
	}
}
