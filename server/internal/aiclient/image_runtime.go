package aiclient

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/textproto"
	"strings"
)

const (
	// A 128MiB image encoded as Base64 needs roughly 171MiB before JSON framing.
	maxCompatibleImageResponseBytes = 176 << 20
	maxCompatibleGeneratedImageSize = 128 << 20
	// Browser-uploaded references are capped at 5MB by the handler. The larger
	// limit is for an already-generated 4K image reused by conversation editing.
	maxCompatibleReferenceSize = 128 << 20
)

// ImageGenerationRequest is the provider-neutral image generation interface.
// Provider adapters own endpoint, field-name and response-format differences.
type ImageGenerationRequest struct {
	Provider string
	Protocol string
	ModelID  string
	Prompt   string
	Size     string
	Images   []string
	// OutputCount requests a related image set. Adapters translate this into
	// either the provider's sequential-image contract or the common n field.
	OutputCount int
	// Mask is a same-sized PNG that constrains an image edit. It is intentionally
	// separate from Images so provider adapters cannot silently treat a mask as
	// another visual reference.
	Mask string
}

type CompatibleImageUsage struct {
	TotalTokens  int `json:"total_tokens"`
	InputTokens  int `json:"input_tokens"`
	OutputTokens int `json:"output_tokens"`
}

type ImageGenerationResult struct {
	Source         string
	Sources        []string
	ResponseFormat string
	Usage          CompatibleImageUsage
}

type compatibleImageData struct {
	URL           string `json:"url"`
	B64JSON       string `json:"b64_json"`
	RevisedPrompt string `json:"revised_prompt"`
}

type compatibleImageResponse struct {
	Images []compatibleImageData `json:"images"`
	Data   []compatibleImageData `json:"data"`
	Usage  CompatibleImageUsage  `json:"usage"`
}

type imageProviderAdapter interface {
	Generate(context.Context, *CompatibleClient, ImageGenerationRequest) (ImageGenerationResult, error)
}

type siliconFlowImageAdapter struct{}
type openAIImagesAdapter struct{}
type arkImageAdapter struct{}

func (c *CompatibleClient) GenerateImage(ctx context.Context, modelID, prompt, imageSize string) (string, error) {
	return c.GenerateImageWithRequest(ctx, ImageGenerationRequest{
		ModelID: modelID,
		Prompt:  prompt,
		Size:    imageSize,
	})
}

func (c *CompatibleClient) GenerateImageWithRequest(
	ctx context.Context,
	request ImageGenerationRequest,
) (string, error) {
	result, err := c.GenerateImageResult(ctx, request)
	if err != nil {
		return "", err
	}
	return result.Source, nil
}

func (c *CompatibleClient) GenerateImageResult(
	ctx context.Context,
	request ImageGenerationRequest,
) (ImageGenerationResult, error) {
	provider := strings.TrimSpace(request.Provider)
	if provider == "" && c != nil {
		provider = strings.TrimSpace(c.Provider)
	}
	request.Provider = provider
	protocol := strings.TrimSpace(request.Protocol)
	if protocol == "" && c != nil {
		protocol = strings.TrimSpace(c.ImageProtocol)
	}
	adapter, err := imageAdapterFor(provider, protocol)
	if err != nil {
		return ImageGenerationResult{}, err
	}
	return adapter.Generate(ctx, c, request)
}

func imageAdapterFor(provider, protocol string) (imageProviderAdapter, error) {
	provider = strings.TrimSpace(provider)
	protocol = strings.TrimSpace(protocol)
	if protocol == "" || protocol == "auto" {
		switch provider {
		case "siliconflow":
			protocol = "siliconflow_images"
		case "amux", "pipixia":
			protocol = "openai_images"
		case "volcengine", "ark":
			protocol = "ark_images"
		}
	}
	switch protocol {
	case "siliconflow_images":
		return siliconFlowImageAdapter{}, nil
	case "openai_images":
		return openAIImagesAdapter{}, nil
	case "ark_images":
		return arkImageAdapter{}, nil
	default:
		return nil, fmt.Errorf("当前模型未配置可用的图片协议适配器：%s/%s", provider, protocol)
	}
}

func (siliconFlowImageAdapter) Generate(
	ctx context.Context,
	client *CompatibleClient,
	request ImageGenerationRequest,
) (ImageGenerationResult, error) {
	if strings.TrimSpace(request.Mask) != "" {
		return ImageGenerationResult{}, errors.New("SiliconFlow 当前图片协议不支持蒙版编辑")
	}
	if len(request.Images) > 0 {
		return ImageGenerationResult{}, errors.New("SiliconFlow 当前图片协议不支持参考图输入")
	}
	payload := baseImageJSONPayload(request)
	if size := strings.TrimSpace(request.Size); size != "" {
		payload["image_size"] = size
	}
	return generateImageJSON(ctx, client, payload)
}

func (openAIImagesAdapter) Generate(
	ctx context.Context,
	client *CompatibleClient,
	request ImageGenerationRequest,
) (ImageGenerationResult, error) {
	if strings.TrimSpace(request.Mask) != "" {
		if len(request.Images) != 1 {
			return ImageGenerationResult{}, errors.New("蒙版编辑需要且只能使用一张源图")
		}
		return generateOpenAIImageEdit(ctx, client, request)
	}
	if len(request.Images) > 0 {
		return generateOpenAIImageEdit(ctx, client, request)
	}
	payload := baseImageJSONPayload(request)
	if size := strings.TrimSpace(request.Size); size != "" {
		payload["size"] = size
	}
	return generateImageJSON(ctx, client, payload)
}

func (arkImageAdapter) Generate(
	ctx context.Context,
	client *CompatibleClient,
	request ImageGenerationRequest,
) (ImageGenerationResult, error) {
	if strings.TrimSpace(request.Mask) != "" {
		return ImageGenerationResult{}, errors.New("ARK 当前图片协议不支持蒙版编辑")
	}
	payload := baseImageJSONPayload(request)
	// ARK controls related output count through its sequential-image fields.
	// Sending the OpenAI-compatible n field alongside them is undocumented and
	// can make gateways select the wrong generation path.
	delete(payload, "n")
	if size := strings.TrimSpace(request.Size); size != "" {
		payload["size"] = size
	}
	if len(request.Images) > 0 {
		payload["image"] = request.Images
		payload["guidance_scale"] = 8.0
	}
	if request.OutputCount > 1 {
		payload["sequential_image_generation"] = "auto"
		payload["sequential_image_generation_options"] = map[string]any{"max_images": request.OutputCount}
		payload["stream"] = false
	}
	return generateImageJSON(ctx, client, payload)
}

func baseImageJSONPayload(request ImageGenerationRequest) map[string]any {
	count := request.OutputCount
	if count <= 0 {
		count = 1
	}
	return map[string]any{
		"model":  strings.TrimSpace(request.ModelID),
		"prompt": strings.TrimSpace(request.Prompt),
		"n":      count,
	}
}

func generateImageJSON(
	ctx context.Context,
	client *CompatibleClient,
	payload map[string]any,
) (ImageGenerationResult, error) {
	var response compatibleImageResponse
	if err := client.doJSONWithLimit(
		ctx,
		http.MethodPost,
		"/images/generations",
		payload,
		&response,
		maxCompatibleImageResponseBytes,
	); err != nil {
		return ImageGenerationResult{}, err
	}
	return normalizeCompatibleImageResponse(response)
}

func generateOpenAIImageEdit(
	ctx context.Context,
	client *CompatibleClient,
	request ImageGenerationRequest,
) (ImageGenerationResult, error) {
	if strings.TrimSpace(request.Mask) != "" && len(request.Images) != 1 {
		return ImageGenerationResult{}, errors.New("蒙版编辑需要且只能使用一张源图")
	}
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	fields := map[string]string{
		"model":  strings.TrimSpace(request.ModelID),
		"prompt": strings.TrimSpace(request.Prompt),
	}
	if request.OutputCount > 1 {
		fields["n"] = fmt.Sprintf("%d", request.OutputCount)
	}
	if size := strings.TrimSpace(request.Size); size != "" {
		fields["size"] = size
	}
	for name, value := range fields {
		if err := writer.WriteField(name, value); err != nil {
			return ImageGenerationResult{}, err
		}
	}
	fieldName := "image"
	if len(request.Images) > 1 {
		fieldName = "image[]"
	}
	for index, raw := range request.Images {
		content, mimeType, err := decodeCompatibleReference(raw)
		if err != nil {
			return ImageGenerationResult{}, err
		}
		part, err := writer.CreateFormFile(
			fieldName,
			fmt.Sprintf("reference-%d%s", index+1, extensionForImageMIME(mimeType)),
		)
		if err != nil {
			return ImageGenerationResult{}, err
		}
		if _, err := part.Write(content); err != nil {
			return ImageGenerationResult{}, err
		}
	}
	if rawMask := strings.TrimSpace(request.Mask); rawMask != "" {
		content, mimeType, err := decodeCompatibleReference(rawMask)
		if err != nil {
			return ImageGenerationResult{}, fmt.Errorf("蒙版内容无效: %w", err)
		}
		if mimeType != "image/png" {
			return ImageGenerationResult{}, errors.New("蒙版必须是 PNG 图片")
		}
		header := make(textproto.MIMEHeader)
		header.Set("Content-Disposition", `form-data; name="mask"; filename="mask.png"`)
		header.Set("Content-Type", "image/png")
		part, err := writer.CreatePart(header)
		if err != nil {
			return ImageGenerationResult{}, err
		}
		if _, err := part.Write(content); err != nil {
			return ImageGenerationResult{}, err
		}
	}
	if err := writer.Close(); err != nil {
		return ImageGenerationResult{}, err
	}

	var response compatibleImageResponse
	if err := client.doMultipart(
		ctx,
		"/images/edits",
		writer.FormDataContentType(),
		&body,
		&response,
	); err != nil {
		return ImageGenerationResult{}, err
	}
	return normalizeCompatibleImageResponse(response)
}

func (c *CompatibleClient) doMultipart(
	ctx context.Context,
	path string,
	contentType string,
	body io.Reader,
	destination any,
) error {
	if c == nil || c.BaseURL == "" || c.APIKey == "" {
		return errors.New("AI compatible client 未配置")
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, c.BaseURL+path, body)
	if err != nil {
		return err
	}
	request.Header.Set("Authorization", "Bearer "+c.APIKey)
	request.Header.Set("Accept", "application/json")
	request.Header.Set("Content-Type", contentType)
	response, err := c.Client.Do(request)
	if err != nil {
		return fmt.Errorf("AI 上游请求失败: %w", err)
	}
	defer response.Body.Close()
	data, err := io.ReadAll(io.LimitReader(response.Body, maxCompatibleImageResponseBytes+1))
	if err != nil {
		return err
	}
	if len(data) > maxCompatibleImageResponseBytes {
		return errors.New("AI 上游图片响应过大")
	}
	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		return fmt.Errorf("AI 上游返回 %d: %s", response.StatusCode, strings.TrimSpace(string(data)))
	}
	if err := json.Unmarshal(data, destination); err != nil {
		return fmt.Errorf("解析 AI 图片响应失败: %w", err)
	}
	return nil
}

func normalizeCompatibleImageResponse(response compatibleImageResponse) (ImageGenerationResult, error) {
	items := append(append([]compatibleImageData{}, response.Images...), response.Data...)
	sources := make([]string, 0, len(items))
	responseFormat := ""
	for _, item := range items {
		if source := strings.TrimSpace(item.URL); source != "" {
			sources = append(sources, source)
			if responseFormat == "" {
				responseFormat = "url"
			}
			continue
		}
		if encoded := strings.TrimSpace(item.B64JSON); encoded != "" {
			source, err := normalizeCompatibleImageBase64(encoded)
			if err != nil {
				return ImageGenerationResult{}, err
			}
			sources = append(sources, source)
			if responseFormat == "" {
				responseFormat = "b64_json"
			}
		}
	}
	if len(sources) > 0 {
		return ImageGenerationResult{
			Source: sources[0], Sources: sources, ResponseFormat: responseFormat, Usage: response.Usage,
		}, nil
	}
	return ImageGenerationResult{}, errors.New("AI 生图返回空图片结果")
}

func normalizeCompatibleImageBase64(encoded string) (string, error) {
	if strings.HasPrefix(strings.ToLower(encoded), "data:image/") {
		content, mimeType, err := DecodeImageDataURL(encoded, maxCompatibleGeneratedImageSize)
		if err != nil {
			return "", err
		}
		return "data:" + mimeType + ";base64," + base64.StdEncoding.EncodeToString(content), nil
	}
	content, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		content, err = base64.RawStdEncoding.DecodeString(encoded)
	}
	if err != nil || len(content) == 0 || len(content) > maxCompatibleGeneratedImageSize {
		return "", errors.New("AI 生图返回的 Base64 图片无效或过大")
	}
	mimeType := DetectCompatibleImageMIME(content)
	if mimeType == "" {
		return "", errors.New("AI 生图返回了不支持的图片格式")
	}
	return "data:" + mimeType + ";base64," + base64.StdEncoding.EncodeToString(content), nil
}

func decodeCompatibleReference(raw string) ([]byte, string, error) {
	return DecodeImageDataURL(raw, maxCompatibleReferenceSize)
}

// DecodeImageDataURL validates and decodes a supported image data URL without
// exposing provider response details to callers that need to persist bytes.
func DecodeImageDataURL(raw string, maxBytes int64) ([]byte, string, error) {
	header, encoded, ok := strings.Cut(strings.TrimSpace(raw), ",")
	if !ok || !strings.HasPrefix(strings.ToLower(header), "data:image/") ||
		!strings.HasSuffix(strings.ToLower(header), ";base64") {
		return nil, "", errors.New("图片必须是 Base64 data URL")
	}
	mimeType := NormalizeCompatibleImageMIME(strings.TrimSuffix(strings.TrimPrefix(strings.ToLower(header), "data:"), ";base64"))
	if mimeType == "" {
		return nil, "", errors.New("图片仅支持 JPG、PNG、WebP、GIF、AVIF 或 BMP")
	}
	content, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil || len(content) == 0 || (maxBytes > 0 && int64(len(content)) > maxBytes) {
		return nil, "", errors.New("图片内容无效或过大")
	}
	if DetectCompatibleImageMIME(content) != mimeType {
		return nil, "", errors.New("图片格式与内容不一致")
	}
	return content, mimeType, nil
}

func NormalizeCompatibleImageMIME(value string) string {
	normalized := strings.ToLower(strings.TrimSpace(value))
	switch normalized {
	case "image/jpeg", "image/jpg":
		return "image/jpeg"
	case "image/png", "image/webp", "image/gif", "image/avif", "image/bmp", "image/x-ms-bmp":
		if normalized == "image/x-ms-bmp" {
			return "image/bmp"
		}
		return normalized
	default:
		return ""
	}
}

func IsCompatibleImageMIME(value string) bool {
	return NormalizeCompatibleImageMIME(value) != ""
}

// DetectCompatibleImageMIME identifies safe raster formats that modern
// browsers can render. SVG is intentionally excluded because it can contain
// executable markup when served directly from object storage.
func DetectCompatibleImageMIME(content []byte) string {
	if mimeType := NormalizeCompatibleImageMIME(http.DetectContentType(content)); mimeType != "" {
		return mimeType
	}
	if len(content) >= 12 && string(content[4:8]) == "ftyp" {
		switch string(content[8:12]) {
		case "avif", "avis":
			return "image/avif"
		}
	}
	return ""
}

func extensionForImageMIME(mimeType string) string {
	switch mimeType {
	case "image/jpeg":
		return ".jpg"
	case "image/webp":
		return ".webp"
	case "image/gif":
		return ".gif"
	case "image/avif":
		return ".avif"
	case "image/bmp":
		return ".bmp"
	default:
		return ".png"
	}
}
