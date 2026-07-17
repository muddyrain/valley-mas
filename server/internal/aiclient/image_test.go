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
