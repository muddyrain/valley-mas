package aiclient

import (
	"encoding/base64"
	"testing"
)

func TestDecodeARKImageBase64SupportsDataURL(t *testing.T) {
	body := []byte("image-bytes")
	decoded, mimeType, err := decodeARKImageBase64("data:image/webp;base64," + base64.StdEncoding.EncodeToString(body))
	if err != nil {
		t.Fatalf("decodeARKImageBase64() error = %v", err)
	}
	if string(decoded) != string(body) || mimeType != "image/webp" {
		t.Fatalf("decoded = %q, mime = %q", decoded, mimeType)
	}
}

func TestDecodeImageDataURLSupportsGIF(t *testing.T) {
	content, err := base64.StdEncoding.DecodeString("R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==")
	if err != nil {
		t.Fatal(err)
	}
	decoded, mimeType, err := DecodeImageDataURL(
		"data:image/gif;base64,"+base64.StdEncoding.EncodeToString(content),
		128<<20,
	)
	if err != nil {
		t.Fatal(err)
	}
	if string(decoded) != string(content) || mimeType != "image/gif" {
		t.Fatalf("decoded = %q, mime = %q", decoded, mimeType)
	}
}

func TestDetectCompatibleImageMIMERecognizesAVIF(t *testing.T) {
	content := append([]byte{0, 0, 0, 24, 'f', 't', 'y', 'p', 'a', 'v', 'i', 'f'}, make([]byte, 12)...)
	if mimeType := DetectCompatibleImageMIME(content); mimeType != "image/avif" {
		t.Fatalf("mime type = %q", mimeType)
	}
}
