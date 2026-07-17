package aiclient

import (
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	arkmodel "github.com/volcengine/volcengine-go-sdk/service/arkruntime/model"
)

const maxGeneratedImageBytes = 12 << 20

type GeneratedImage struct {
	Bytes          []byte
	MIMEType       string
	Model          string
	Size           string
	ResponseFormat string
}

// GenerateARKImage centralizes model fallback, base64/URL parsing and bounded
// downloads for all new ARK image capabilities.
func GenerateARKImage(ctx context.Context, prompt string, sizeCandidates ...string) (GeneratedImage, error) {
	_, models, configErr := ReadARKImageConfig()
	if configErr != "" {
		return GeneratedImage{}, errors.New(configErr)
	}
	client := ARKClient(90 * time.Second)
	if client == nil {
		return GeneratedImage{}, errors.New("AI 未配置：缺少 ARK_API_KEY")
	}
	if len(sizeCandidates) == 0 {
		sizeCandidates = []string{"1024x1024", "adaptive"}
	}
	formats := []string{arkmodel.GenerateImagesResponseFormatBase64, arkmodel.GenerateImagesResponseFormatURL}
	watermark := false
	var lastErr error
	for _, modelID := range models {
		for _, formatValue := range formats {
			for _, sizeValue := range sizeCandidates {
				format := formatValue
				size := sizeValue
				response, err := client.GenerateImages(ctx, arkmodel.GenerateImagesRequest{
					Model: modelID, Prompt: prompt, ResponseFormat: &format, Size: &size, Watermark: &watermark,
				})
				if err != nil {
					lastErr = err
					continue
				}
				if response.Error != nil {
					lastErr = fmt.Errorf("%s: %s", response.Error.Code, response.Error.Message)
					continue
				}
				if len(response.Data) == 0 || response.Data[0] == nil {
					lastErr = errors.New("ARK image returned empty data")
					continue
				}
				data := response.Data[0]
				var body []byte
				var mimeType string
				if data.B64Json != nil && strings.TrimSpace(*data.B64Json) != "" {
					body, mimeType, err = decodeARKImageBase64(*data.B64Json)
				} else if data.Url != nil && strings.TrimSpace(*data.Url) != "" {
					body, mimeType, err = downloadARKImage(ctx, strings.TrimSpace(*data.Url))
				} else {
					err = errors.New("ARK image returned no usable payload")
				}
				if err != nil {
					lastErr = err
					continue
				}
				return GeneratedImage{Bytes: body, MIMEType: mimeType, Model: modelID, Size: sizeValue, ResponseFormat: formatValue}, nil
			}
		}
	}
	if lastErr == nil {
		lastErr = errors.New("ARK image returned no usable payload")
	}
	return GeneratedImage{}, lastErr
}

func decodeARKImageBase64(raw string) ([]byte, string, error) {
	value := strings.TrimSpace(raw)
	mimeType := "image/png"
	if strings.HasPrefix(strings.ToLower(value), "data:") {
		header, payload, ok := strings.Cut(value, ",")
		if !ok {
			return nil, "", errors.New("invalid ARK image data URL")
		}
		value = payload
		mediaType := strings.TrimPrefix(strings.Split(header, ";")[0], "data:")
		if strings.HasPrefix(mediaType, "image/") {
			mimeType = mediaType
		}
	}
	body, err := base64.StdEncoding.DecodeString(value)
	if err != nil || len(body) == 0 || len(body) > maxGeneratedImageBytes {
		return nil, "", errors.New("invalid ARK image base64")
	}
	return body, mimeType, nil
}

func downloadARKImage(ctx context.Context, imageURL string) ([]byte, string, error) {
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, imageURL, nil)
	if err != nil {
		return nil, "", err
	}
	response, err := (&http.Client{Timeout: 45 * time.Second}).Do(request)
	if err != nil {
		return nil, "", fmt.Errorf("download ARK image: %w", err)
	}
	defer response.Body.Close()
	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		return nil, "", fmt.Errorf("download ARK image returned %d", response.StatusCode)
	}
	body, err := io.ReadAll(io.LimitReader(response.Body, maxGeneratedImageBytes+1))
	if err != nil || len(body) == 0 || len(body) > maxGeneratedImageBytes {
		return nil, "", errors.New("downloaded ARK image is empty or too large")
	}
	mimeType := strings.TrimSpace(strings.Split(response.Header.Get("Content-Type"), ";")[0])
	if !strings.HasPrefix(mimeType, "image/") {
		mimeType = http.DetectContentType(body)
	}
	return body, mimeType, nil
}
