package aiclient

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"mime"
	"mime/multipart"
	"net/http"
	"strings"
	"testing"
	"time"
)

const compatibleOnePixelPNGBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="

func TestGenerateImageWithRequestUsesARKImageContract(t *testing.T) {
	var payload map[string]any
	client := NewCompatibleClient("https://provider.test/v1", "test-key", time.Second)
	client.Client.Transport = roundTripperFunc(func(request *http.Request) (*http.Response, error) {
		if err := json.NewDecoder(request.Body).Decode(&payload); err != nil {
			t.Fatal(err)
		}
		return &http.Response{
			StatusCode: http.StatusOK,
			Header:     http.Header{"Content-Type": []string{"application/json"}},
			Body:       io.NopCloser(bytes.NewBufferString(`{"data":[{"url":"https://example.com/result.png"}]}`)),
			Request:    request,
		}, nil
	})
	result, err := client.GenerateImageWithRequest(context.Background(), ImageGenerationRequest{
		Provider: "ark",
		ModelID:  "seedream-test",
		Prompt:   "draw a cat",
		Size:     "1024x1024",
		Images:   []string{"data:image/png;base64,AA=="},
	})
	if err != nil {
		t.Fatal(err)
	}
	if result != "https://example.com/result.png" {
		t.Fatalf("unexpected result: %s", result)
	}
	if payload["size"] != "1024x1024" || payload["image_size"] != nil {
		t.Fatalf("ARK payload must use size: %#v", payload)
	}
	images, ok := payload["image"].([]any)
	if !ok || len(images) != 1 {
		t.Fatalf("ARK payload must include reference images: %#v", payload)
	}
}

type roundTripperFunc func(*http.Request) (*http.Response, error)

func (function roundTripperFunc) RoundTrip(request *http.Request) (*http.Response, error) {
	return function(request)
}

func TestGenerateImageWithRequestRejectsReferenceImagesForGenericProvider(t *testing.T) {
	client := NewCompatibleClient("https://provider.test/v1", "test-key", time.Second)
	_, err := client.GenerateImageWithRequest(context.Background(), ImageGenerationRequest{
		Provider: "siliconflow",
		ModelID:  "image-model",
		Prompt:   "draw a cat",
		Images:   []string{"data:image/png;base64,AA=="},
	})
	if err == nil {
		t.Fatal("expected generic provider reference image rejection")
	}
}

func TestAmuxImageAdapterUsesSizeAndAcceptsBase64Result(t *testing.T) {
	var payload map[string]any
	client := NewProviderCompatibleClient("amux", "https://provider.test/v1", "test-key", time.Second)
	client.Client.Transport = roundTripperFunc(func(request *http.Request) (*http.Response, error) {
		if err := json.NewDecoder(request.Body).Decode(&payload); err != nil {
			t.Fatal(err)
		}
		return &http.Response{
			StatusCode: http.StatusOK,
			Header:     http.Header{"Content-Type": []string{"application/json"}},
			Body: io.NopCloser(strings.NewReader(
				`{"data":[{"b64_json":"` + compatibleOnePixelPNGBase64 + `"}],"usage":{"total_tokens":10}}`,
			)),
			Request: request,
		}, nil
	})
	result, err := client.GenerateImageResult(context.Background(), ImageGenerationRequest{
		ModelID: "gpt-image-2",
		Prompt:  "draw a cat",
		Size:    "1024x1024",
	})
	if err != nil {
		t.Fatal(err)
	}
	if payload["size"] != "1024x1024" || payload["image_size"] != nil {
		t.Fatalf("Amux payload must use size: %#v", payload)
	}
	if result.ResponseFormat != "b64_json" ||
		!strings.HasPrefix(result.Source, "data:image/png;base64,") ||
		result.Usage.TotalTokens != 10 {
		t.Fatalf("unexpected normalized result: %+v", result)
	}
}

func TestImageProtocolOverrideSelectsConfiguredAdapter(t *testing.T) {
	var payload map[string]any
	client := NewProviderCompatibleClient("amux", "https://provider.test/v1", "test-key", time.Second)
	client.ImageProtocol = "siliconflow_images"
	client.Client.Transport = roundTripperFunc(func(request *http.Request) (*http.Response, error) {
		if err := json.NewDecoder(request.Body).Decode(&payload); err != nil {
			t.Fatal(err)
		}
		return &http.Response{
			StatusCode: http.StatusOK,
			Header:     http.Header{"Content-Type": []string{"application/json"}},
			Body: io.NopCloser(strings.NewReader(
				`{"images":[{"url":"https://example.com/generated.png"}]}`,
			)),
			Request: request,
		}, nil
	})
	_, err := client.GenerateImageWithRequest(context.Background(), ImageGenerationRequest{
		ModelID: "gateway-image-model",
		Prompt:  "draw a cat",
		Size:    "1024x1024",
	})
	if err != nil {
		t.Fatal(err)
	}
	if payload["image_size"] != "1024x1024" || payload["size"] != nil {
		t.Fatalf("configured protocol was not used: %#v", payload)
	}
}

func TestAmuxImageAdapterUsesMultipartEditForReferences(t *testing.T) {
	client := NewProviderCompatibleClient("amux", "https://provider.test/v1", "test-key", time.Second)
	client.Client.Transport = roundTripperFunc(func(request *http.Request) (*http.Response, error) {
		if request.URL.Path != "/v1/images/edits" {
			t.Fatalf("path = %q", request.URL.Path)
		}
		mediaType, parameters, err := mime.ParseMediaType(request.Header.Get("Content-Type"))
		if err != nil || mediaType != "multipart/form-data" {
			t.Fatalf("content type = %q, err = %v", mediaType, err)
		}
		reader := multipart.NewReader(request.Body, parameters["boundary"])
		form, err := reader.ReadForm(6 << 20)
		if err != nil {
			t.Fatal(err)
		}
		defer form.RemoveAll()
		if form.Value["model"][0] != "gpt-image-2" || form.Value["size"][0] != "1024x1024" {
			t.Fatalf("form values = %+v", form.Value)
		}
		if len(form.File["image"]) != 1 {
			t.Fatalf("image files = %+v", form.File)
		}
		return &http.Response{
			StatusCode: http.StatusOK,
			Header:     http.Header{"Content-Type": []string{"application/json"}},
			Body: io.NopCloser(strings.NewReader(
				`{"data":[{"url":"https://example.com/edited.png"}]}`,
			)),
			Request: request,
		}, nil
	})
	source, err := client.GenerateImageWithRequest(context.Background(), ImageGenerationRequest{
		ModelID: "gpt-image-2",
		Prompt:  "finish the sketch",
		Size:    "1024x1024",
		Images:  []string{"data:image/png;base64," + compatibleOnePixelPNGBase64},
	})
	if err != nil {
		t.Fatal(err)
	}
	if source != "https://example.com/edited.png" {
		t.Fatalf("source = %q", source)
	}
}
