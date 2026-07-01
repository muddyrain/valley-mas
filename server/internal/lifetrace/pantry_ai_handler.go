package lifetrace

import (
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"
	lifeai "valley-server/internal/lifetrace/ai"
	prompts "valley-server/internal/lifetrace/ai/prompts"
	"valley-server/internal/service"
	"valley-server/internal/utils"

	"github.com/gin-gonic/gin"
	arkmodel "github.com/volcengine/volcengine-go-sdk/service/arkruntime/model"
)

type pantryThumbnailRequest struct {
	Name     string `json:"name"`
	Category string `json:"category"`
	Location string `json:"location"`
	Note     string `json:"note"`
}

const pantryThumbnailTimeout = 20 * time.Second

type generatedPantryThumbnail struct {
	Bytes      []byte
	MIMEType   string
	ModelName  string
	UsedSize   string
	UsedFormat string
}

type pantryThumbnailUploadResult struct {
	URL string
	Key string
}

var uploadGeneratedPantryThumbnailToTOS = func(
	ctx context.Context,
	userID interface{ String() string },
	image generatedPantryThumbnail,
) (pantryThumbnailUploadResult, error) {
	uploader := utils.GetTOSUploader()
	if uploader == nil {
		return pantryThumbnailUploadResult{}, fmt.Errorf("图片上传服务未配置")
	}

	config := service.GetDefaultConfig(service.UploadTypeLifeTrace)
	config.CustomFolder = fmt.Sprintf("life-trace/%s/%s", userID.String(), time.Now().Format("20060102"))
	storagePath := service.NewUploadService().GenerateStoragePath(
		config,
		"pantry-thumbnail"+pantryThumbnailFileExtension(image.MIMEType),
	)

	url, err := uploader.UploadBytesWithPathContext(ctx, storagePath, image.Bytes)
	if err != nil {
		return pantryThumbnailUploadResult{}, err
	}

	return pantryThumbnailUploadResult{
		URL: url,
		Key: storagePath,
	}, nil
}

func (h *Handler) GeneratePantryThumbnail(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok || userID == 0 {
		c.JSON(http.StatusUnauthorized, apiResponse{Code: http.StatusUnauthorized, Message: "未登录"})
		return
	}

	var req pantryThumbnailRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, apiResponse{Code: http.StatusBadRequest, Message: "请求内容不正确"})
		return
	}

	cfg, errMsg := readLifeTracePantryThumbnailConfig()
	if errMsg != "" {
		c.JSON(http.StatusServiceUnavailable, apiResponse{Code: http.StatusServiceUnavailable, Message: errMsg})
		return
	}

	prompt := buildPantryThumbnailPrompt(req)
	aiCtx, cancel := context.WithTimeout(c.Request.Context(), pantryThumbnailTimeout)
	defer cancel()

	image, err := generatePantryThumbnail(aiCtx, cfg, prompt)
	if err != nil {
		c.JSON(http.StatusBadGateway, apiResponse{Code: http.StatusBadGateway, Message: "AI 缩略图生成失败：" + err.Error()})
		return
	}

	uploaded, uploadErr := uploadGeneratedPantryThumbnailToTOS(aiCtx, userID, image)
	if uploadErr != nil {
		status := http.StatusBadGateway
		if strings.Contains(uploadErr.Error(), "未配置") || strings.Contains(uploadErr.Error(), "not initialized") {
			status = http.StatusServiceUnavailable
		}
		c.JSON(status, apiResponse{Code: status, Message: "AI 缩略图上传失败：" + uploadErr.Error()})
		return
	}

	success(c, gin.H{
		"thumbnailUrl": uploaded.URL,
		"storageKey":   uploaded.Key,
		"prompt":       prompt,
		"source":       "ark",
		"model":        image.ModelName,
		"usedSize":     image.UsedSize,
		"usedFormat":   image.UsedFormat,
	})
}

type lifeTracePantryThumbnailConfig = lifeai.ThumbnailConfig

func readLifeTracePantryThumbnailConfig() (lifeTracePantryThumbnailConfig, string) {
	return lifeai.ReadThumbnailConfig()
}

func buildPantryThumbnailPrompt(req pantryThumbnailRequest) string {
	return prompts.BuildPantryThumbnailPrompt(prompts.PantryThumbnailInput{
		Name:     req.Name,
		Category: normalizePantryCategory(req.Category),
		Location: normalizePantryLocation(req.Location),
		Note:     req.Note,
	})
}

func generatePantryThumbnail(
	ctx context.Context,
	cfg lifeTracePantryThumbnailConfig,
	prompt string,
) (generatedPantryThumbnail, error) {
	client := ensureLifeTraceArkClient(cfg.APIKey, cfg.BaseURL)
	sizeCandidates := []string{"1280x720", "1024x1024", "adaptive"}
	responseFormats := []string{
		arkmodel.GenerateImagesResponseFormatBase64,
		arkmodel.GenerateImagesResponseFormatURL,
	}
	watermark := false

	var lastUpstreamError string
	for _, modelID := range cfg.ModelIDs {
		for _, responseFormatCandidate := range responseFormats {
			for _, sizeCandidate := range sizeCandidates {
				size := sizeCandidate
				responseFormat := responseFormatCandidate
				res, reqErr := client.GenerateImages(ctx, arkmodel.GenerateImagesRequest{
					Model:          modelID,
					Prompt:         prompt,
					ResponseFormat: &responseFormat,
					Size:           &size,
					Watermark:      &watermark,
				})
				if reqErr != nil {
					lastUpstreamError = reqErr.Error()
					if lifeTraceImageModelCapabilityError(lastUpstreamError) {
						break
					}
					if lifeTraceImageResponseFormatUnsupportedError(lastUpstreamError) {
						break
					}
					if lifeTraceImageSizeUnsupportedError(lastUpstreamError) {
						continue
					}
					return generatedPantryThumbnail{}, reqErr
				}
				if res.Error != nil {
					lastUpstreamError = strings.TrimSpace(res.Error.Code + ": " + res.Error.Message)
					if lifeTraceImageModelCapabilityError(lastUpstreamError) {
						break
					}
					if lifeTraceImageResponseFormatUnsupportedError(lastUpstreamError) {
						break
					}
					if lifeTraceImageSizeUnsupportedError(lastUpstreamError) {
						continue
					}
					return generatedPantryThumbnail{}, errors.New(res.Error.Message)
				}
				if len(res.Data) == 0 || res.Data[0] == nil {
					lastUpstreamError = "empty image payload"
					continue
				}

				first := res.Data[0]
				if first.B64Json != nil && strings.TrimSpace(*first.B64Json) != "" {
					bytes, mimeType, decodeErr := decodeGeneratedPantryThumbnail(*first.B64Json)
					if decodeErr != nil {
						return generatedPantryThumbnail{}, decodeErr
					}
					return generatedPantryThumbnail{
						Bytes:      bytes,
						MIMEType:   mimeType,
						ModelName:  modelID,
						UsedSize:   sizeCandidate,
						UsedFormat: responseFormatCandidate,
					}, nil
				}
				if first.Url != nil && strings.TrimSpace(*first.Url) != "" {
					bytes, mimeType, fetchErr := fetchGeneratedPantryThumbnail(ctx, strings.TrimSpace(*first.Url))
					if fetchErr != nil {
						return generatedPantryThumbnail{}, fetchErr
					}
					return generatedPantryThumbnail{
						Bytes:      bytes,
						MIMEType:   mimeType,
						ModelName:  modelID,
						UsedSize:   sizeCandidate,
						UsedFormat: responseFormatCandidate,
					}, nil
				}
				lastUpstreamError = "AI returned no usable image"
			}
			if lifeTraceImageModelCapabilityError(lastUpstreamError) {
				break
			}
		}
	}

	if lifeTraceImageModelCapabilityError(lastUpstreamError) {
		return generatedPantryThumbnail{}, errors.New(lifeTraceImageModelMisconfiguredMessage(cfg.ModelIDs[0], lastUpstreamError))
	}
	if lifeTraceImageSizeUnsupportedError(lastUpstreamError) {
		return generatedPantryThumbnail{}, errors.New("no supported thumbnail image size")
	}
	if strings.TrimSpace(lastUpstreamError) == "" {
		lastUpstreamError = "AI returned no usable image"
	}
	return generatedPantryThumbnail{}, errors.New(lastUpstreamError)
}

func decodeGeneratedPantryThumbnail(raw string) ([]byte, string, error) {
	value := strings.TrimSpace(raw)
	mimeType := "image/jpeg"
	if strings.HasPrefix(strings.ToLower(value), "data:") {
		header, payload, ok := strings.Cut(value, ",")
		if !ok {
			return nil, "", errors.New("invalid AI image data url")
		}
		if strings.HasPrefix(strings.ToLower(header), "data:image/") {
			mimeType = strings.TrimSuffix(strings.TrimPrefix(strings.Split(header, ";")[0], "data:"), "")
		}
		value = payload
	}

	decoded, err := base64.StdEncoding.DecodeString(value)
	if err != nil {
		return nil, "", errors.New("invalid AI image base64")
	}
	return decoded, pantryThumbnailMimeType(decoded, mimeType), nil
}

func fetchGeneratedPantryThumbnail(ctx context.Context, imageURL string) ([]byte, string, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, imageURL, nil)
	if err != nil {
		return nil, "", err
	}

	resp, err := (&http.Client{Timeout: pantryThumbnailTimeout}).Do(req)
	if err != nil {
		return nil, "", fmt.Errorf("failed to download AI image")
	}
	defer resp.Body.Close()

	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		return nil, "", fmt.Errorf("AI image download returned %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, "", err
	}
	if len(body) == 0 {
		return nil, "", errors.New("empty AI image body")
	}

	return body, pantryThumbnailMimeType(body, resp.Header.Get("Content-Type")), nil
}

func pantryThumbnailMimeType(body []byte, fallback string) string {
	contentType := strings.TrimSpace(fallback)
	if contentType == "" || !strings.HasPrefix(strings.ToLower(contentType), "image/") {
		contentType = http.DetectContentType(body)
	}
	if !strings.HasPrefix(strings.ToLower(contentType), "image/") {
		return "image/jpeg"
	}
	return contentType
}

func pantryThumbnailFileExtension(mimeType string) string {
	switch strings.ToLower(strings.TrimSpace(mimeType)) {
	case "image/png":
		return ".png"
	case "image/webp":
		return ".webp"
	default:
		return ".jpg"
	}
}

func lifeTraceImageModelCandidates(primary string) []string {
	seen := make(map[string]struct{}, 4)
	models := make([]string, 0, 4)
	add := func(raw string) {
		value := strings.TrimSpace(raw)
		if value == "" {
			return
		}
		if _, exists := seen[value]; exists {
			return
		}
		seen[value] = struct{}{}
		models = append(models, value)
	}

	add(primary)
	for _, item := range strings.Split(os.Getenv("ARK_IMAGE_MODEL_FALLBACK"), ",") {
		add(item)
	}
	return models
}

func lifeTraceImageModelCapabilityError(raw string) bool {
	lower := strings.ToLower(strings.TrimSpace(raw))
	if lower == "" {
		return false
	}
	if strings.Contains(lower, "image generation is only supported by certain models") {
		return true
	}
	return strings.Contains(lower, "invalidparameter") && strings.Contains(lower, "parameter `model`")
}

func lifeTraceImageSizeUnsupportedError(raw string) bool {
	lower := strings.ToLower(strings.TrimSpace(raw))
	if lower == "" {
		return false
	}
	if strings.Contains(lower, "parameter `size`") && strings.Contains(lower, "not supported") {
		return true
	}
	if strings.Contains(lower, "parameter `size`") && strings.Contains(lower, "not valid") {
		return true
	}
	if strings.Contains(lower, "image size must be at least") {
		return true
	}
	return strings.Contains(lower, "invalid size")
}

func lifeTraceImageResponseFormatUnsupportedError(raw string) bool {
	lower := strings.ToLower(strings.TrimSpace(raw))
	if lower == "" {
		return false
	}
	if strings.Contains(lower, "response_format") && strings.Contains(lower, "not supported") {
		return true
	}
	if strings.Contains(lower, "response_format") && strings.Contains(lower, "invalid") {
		return true
	}
	return strings.Contains(lower, "b64_json") && strings.Contains(lower, "not supported")
}

func lifeTraceImageModelMisconfiguredMessage(model, upstream string) string {
	msg := fmt.Sprintf("ARK_IMAGE_MODEL=%s 不是可用的生图接入点。", model)
	if trimmed := strings.TrimSpace(upstream); trimmed != "" {
		msg += " 上游返回：" + trimRunes(trimmed, 220)
	}
	return msg
}
