package handler

import (
	"context"
	"encoding/base64"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"
	"valley-server/internal/service"

	"github.com/gin-gonic/gin"
	"github.com/volcengine/volcengine-go-sdk/service/arkruntime"
	arkmodel "github.com/volcengine/volcengine-go-sdk/service/arkruntime/model"
)

type blogAIExcerptRequest struct {
	Title   string `json:"title"`
	Content string `json:"content" binding:"required"`
}

type blogAICoverRequest struct {
	Title   string `json:"title"`
	Excerpt string `json:"excerpt"`
	Content string `json:"content" binding:"required"`
}

func normalizeAITextOutput(raw string) string {
	text := strings.TrimSpace(raw)
	for _, prefix := range []string{"Summary:", "summary:", "Cover prompt:", "cover prompt:"} {
		text = strings.TrimPrefix(text, prefix)
	}
	text = strings.ReplaceAll(text, "\n", " ")
	text = strings.Join(strings.Fields(text), " ")
	text = strings.Trim(text, "\"' ")
	return text
}

func truncateAIText(text string, max int) string {
	if max <= 0 {
		return ""
	}
	runes := []rune(strings.TrimSpace(text))
	if len(runes) <= max {
		return string(runes)
	}
	return string(runes[:max])
}

func isImageModelCapabilityError(raw string) bool {
	lower := strings.ToLower(strings.TrimSpace(raw))
	if lower == "" {
		return false
	}
	if strings.Contains(lower, "image generation is only supported by certain models") {
		return true
	}
	if strings.Contains(lower, "invalidparameter") && strings.Contains(lower, "parameter `model`") {
		return true
	}
	return false
}

func isImageSizeUnsupportedError(raw string) bool {
	lower := strings.ToLower(strings.TrimSpace(raw))
	if lower == "" {
		return false
	}
	if strings.Contains(lower, "parameter `size`") && strings.Contains(lower, "not supported") {
		return true
	}
	if strings.Contains(lower, "invalid size") {
		return true
	}
	return false
}

func imageModelMisconfiguredMessage(model, upstream string) string {
	msg := fmt.Sprintf(
		"AI image model misconfigured: ARK_IMAGE_MODEL=%s is not a valid image generation endpoint.",
		model,
	)
	if trimmed := strings.TrimSpace(upstream); trimmed != "" {
		msg += " Upstream: " + truncateAIText(trimmed, 220)
	}
	return msg
}

func imageModelCandidates(primary string) []string {
	seen := make(map[string]struct{}, 4)
	models := make([]string, 0, 4)
	add := func(raw string) {
		m := strings.TrimSpace(raw)
		if m == "" {
			return
		}
		if _, exists := seen[m]; exists {
			return
		}
		seen[m] = struct{}{}
		models = append(models, m)
	}

	add(primary)
	for _, item := range strings.Split(os.Getenv("ARK_IMAGE_MODEL_FALLBACK"), ",") {
		add(item)
	}
	return models
}

func readArkTextModelConfig() (apiKey, arkBaseURL, textModel string, errMsg string) {
	apiKey = strings.TrimSpace(os.Getenv("ARK_API_KEY"))
	textModel = strings.TrimSpace(os.Getenv("ARK_TEXT_MODEL"))
	arkBaseURL = strings.TrimSpace(os.Getenv("ARK_BASE_URL"))
	if arkBaseURL == "" {
		arkBaseURL = "https://ark.cn-beijing.volces.com/api/v3"
	}
	if apiKey == "" {
		return "", "", "", "AI is not configured: missing ARK_API_KEY"
	}
	if !strings.HasPrefix(textModel, "ep-") {
		return "", "", "", "AI is not configured: ARK_TEXT_MODEL must start with ep-"
	}
	return apiKey, arkBaseURL, textModel, ""
}

func ensureSharedArkClient(apiKey, arkBaseURL string) *arkruntime.Client {
	arkClientOnce.Do(func() {
		arkClient = arkruntime.NewClientWithApiKey(
			apiKey,
			arkruntime.WithBaseUrl(arkBaseURL),
			arkruntime.WithTimeout(90*time.Second),
		)
	})
	return arkClient
}

func fetchRemoteImageAsBase64(imageURL string, maxBytes int64) (base64Image string, mimeType string, err error) {
	parsed, parseErr := url.Parse(strings.TrimSpace(imageURL))
	if parseErr != nil || parsed == nil || parsed.Scheme != "https" || parsed.Host == "" {
		return "", "", fmt.Errorf("invalid image URL returned by AI")
	}
	if !isAllowedRemoteCoverHost(parsed.Hostname()) {
		return "", "", fmt.Errorf("AI image host is not allowed")
	}

	httpClient := &http.Client{Timeout: 45 * time.Second}
	resp, reqErr := httpClient.Get(parsed.String())
	if reqErr != nil {
		return "", "", fmt.Errorf("failed to download AI image")
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", "", fmt.Errorf("AI image URL is not accessible")
	}

	mimeType = strings.ToLower(strings.TrimSpace(strings.Split(resp.Header.Get("Content-Type"), ";")[0]))
	if !strings.HasPrefix(mimeType, "image/") {
		return "", "", fmt.Errorf("AI response is not an image")
	}

	body, readErr := io.ReadAll(io.LimitReader(resp.Body, maxBytes+1))
	if readErr != nil {
		return "", "", fmt.Errorf("failed to read AI image content")
	}
	if int64(len(body)) > maxBytes {
		return "", "", fmt.Errorf("AI image exceeds the size limit")
	}

	return base64.StdEncoding.EncodeToString(body), mimeType, nil
}

// AdminAIGenerateBlogExcerpt generates summary from blog content.
// POST /admin/blog/ai/excerpt
func AdminAIGenerateBlogExcerpt(c *gin.Context) {
	_, role, ok := currentUser(c)
	if !ok {
		Error(c, http.StatusUnauthorized, "unauthorized")
		return
	}
	if role != "admin" && role != "creator" {
		Error(c, http.StatusForbidden, "creator required")
		return
	}

	var req blogAIExcerptRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		Error(c, http.StatusBadRequest, "invalid request: "+err.Error())
		return
	}

	content := strings.TrimSpace(req.Content)
	if content == "" {
		Error(c, http.StatusBadRequest, "content cannot be empty")
		return
	}

	apiKey, arkBaseURL, textModel, errMsg := readArkTextModelConfig()
	if errMsg != "" {
		Error(c, http.StatusServiceUnavailable, errMsg)
		return
	}
	client := ensureSharedArkClient(apiKey, arkBaseURL)

	title := truncateAIText(req.Title, 80)
	content = truncateAIText(content, 3500)
	prompt := fmt.Sprintf(
		"Generate a concise Chinese summary for the blog below. Requirements:\n"+
			"1) 30-120 Chinese characters;\n"+
			"2) accurate and neutral;\n"+
			"3) output summary text only, no quote marks.\n\n"+
			"Title: %s\nContent: %s",
		title,
		content,
	)

	raw, err := callChatStream(client, textModel, "", prompt, false)
	if err != nil {
		Error(c, http.StatusBadGateway, "AI request failed: "+err.Error())
		return
	}

	excerpt := normalizeAITextOutput(raw)
	excerpt = truncateAIText(excerpt, 180)
	if excerpt == "" {
		Error(c, http.StatusBadGateway, "AI returned empty summary")
		return
	}

	Success(c, gin.H{
		"excerpt": excerpt,
		"model":   textModel,
	})
}

func buildCoverPromptByTextModel(client *arkruntime.Client, textModel string, req blogAICoverRequest) string {
	baseTitle := truncateAIText(req.Title, 80)
	baseExcerpt := truncateAIText(req.Excerpt, 180)
	baseContent := truncateAIText(req.Content, 2000)

	if textModel == "" || !strings.HasPrefix(textModel, "ep-") {
		topic := baseTitle
		if topic == "" {
			topic = baseExcerpt
		}
		if topic == "" {
			topic = truncateAIText(baseContent, 40)
		}
		return "Wide blog cover image (21:9), theme: " + topic + ", clear subject, layered composition, supports anime or illustration style, no watermark."
	}

	prompt := fmt.Sprintf(
		"Create one image-generation prompt for a blog cover.\n"+
			"Requirements:\n"+
			"1) output one line only;\n"+
			"2) wide cover layout (21:9 or close to 5:2);\n"+
			"3) visual theme must match title;\n"+
			"4) style can be anime illustration, commercial illustration, or cinematic realism;\n"+
			"5) may include concise Chinese title text in image;\n"+
			"6) no watermark or platform logo.\n\n"+
			"Title: %s\nExcerpt: %s\nContent: %s",
		baseTitle,
		baseExcerpt,
		baseContent,
	)
	raw, err := callChatStream(client, textModel, "", prompt, false)
	if err != nil {
		return ""
	}
	return normalizeAITextOutput(raw)
}

// AdminAIGenerateBlogCover generates cover image from blog content.
// POST /admin/blog/ai/cover
func AdminAIGenerateBlogCover(c *gin.Context) {
	_, role, ok := currentUser(c)
	if !ok {
		Error(c, http.StatusUnauthorized, "unauthorized")
		return
	}
	if role != "admin" && role != "creator" {
		Error(c, http.StatusForbidden, "creator required")
		return
	}

	var req blogAICoverRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		Error(c, http.StatusBadRequest, "invalid request: "+err.Error())
		return
	}

	content := strings.TrimSpace(req.Content)
	if content == "" {
		Error(c, http.StatusBadRequest, "content cannot be empty")
		return
	}
	req.Content = content

	apiKey := strings.TrimSpace(os.Getenv("ARK_API_KEY"))
	imageModel := strings.TrimSpace(os.Getenv("ARK_IMAGE_MODEL"))
	textModel := strings.TrimSpace(os.Getenv("ARK_TEXT_MODEL"))
	arkBaseURL := strings.TrimSpace(os.Getenv("ARK_BASE_URL"))
	if arkBaseURL == "" {
		arkBaseURL = "https://ark.cn-beijing.volces.com/api/v3"
	}
	if apiKey == "" {
		Error(c, http.StatusServiceUnavailable, "AI is not configured: missing ARK_API_KEY")
		return
	}

	candidateModels := imageModelCandidates(imageModel)
	if len(candidateModels) == 0 {
		Error(c, http.StatusServiceUnavailable, "AI is not configured: missing ARK_IMAGE_MODEL")
		return
	}

	client := ensureSharedArkClient(apiKey, arkBaseURL)

	coverPrompt := buildCoverPromptByTextModel(client, textModel, req)
	if coverPrompt == "" {
		coverPrompt = "Wide blog cover image (21:9), clear subject, layered composition, supports anime or illustration style, no watermark."
	}
	coverPrompt = truncateAIText(coverPrompt, 320)

	responseFormat := arkmodel.GenerateImagesResponseFormatURL
	watermark := false
	sizeCandidates := []string{"2048x1024", "1792x1024", "1536x768", "2K", "adaptive"}

	var (
		res               arkmodel.ImagesResponse
		success           bool
		err               error
		usedImageModel    string
		usedSize          string
		lastUpstreamError string
	)

	for _, modelCandidate := range candidateModels {
		for _, sizeCandidate := range sizeCandidates {
			size := sizeCandidate
			res, err = client.GenerateImages(
				context.Background(),
				arkmodel.GenerateImagesRequest{
					Model:          modelCandidate,
					Prompt:         coverPrompt,
					ResponseFormat: &responseFormat,
					Size:           &size,
					Watermark:      &watermark,
				},
			)
			if err != nil {
				lastUpstreamError = err.Error()
				if isImageModelCapabilityError(lastUpstreamError) {
					break
				}
				if isImageSizeUnsupportedError(lastUpstreamError) {
					continue
				}
				Error(c, http.StatusBadGateway, "AI image generation failed: "+lastUpstreamError)
				return
			}

			if res.Error != nil {
				lastUpstreamError = strings.TrimSpace(res.Error.Code + ": " + res.Error.Message)
				if isImageModelCapabilityError(lastUpstreamError) {
					break
				}
				if isImageSizeUnsupportedError(lastUpstreamError) {
					continue
				}
				Error(c, http.StatusBadGateway, "AI image generation failed: "+res.Error.Message)
				return
			}

			if len(res.Data) > 0 && res.Data[0] != nil {
				success = true
				usedImageModel = modelCandidate
				usedSize = sizeCandidate
				break
			}
			lastUpstreamError = "empty image payload"
		}
		if success {
			break
		}
		if isImageModelCapabilityError(lastUpstreamError) {
			continue
		}
	}

	if !success || len(res.Data) == 0 || res.Data[0] == nil {
		if isImageModelCapabilityError(lastUpstreamError) {
			Error(c, http.StatusServiceUnavailable, imageModelMisconfiguredMessage(imageModel, lastUpstreamError))
			return
		}
		if isImageSizeUnsupportedError(lastUpstreamError) {
			Error(c, http.StatusBadGateway, "AI image generation failed: no supported wide image size")
			return
		}
		Error(c, http.StatusBadGateway, "AI returned no image")
		return
	}

	first := res.Data[0]
	imageBase64 := ""
	if first.B64Json != nil {
		imageBase64 = strings.TrimSpace(*first.B64Json)
	}
	imageURL := ""
	if first.Url != nil {
		imageURL = strings.TrimSpace(*first.Url)
	}
	mimeType := "image/jpeg"

	// CORS-safe fallback: convert remote URL to base64 on backend so frontend never fetches third-party URL.
	if imageBase64 == "" && imageURL != "" {
		uploadConfig := service.GetDefaultConfig(service.UploadTypeCover)
		maxBytes := uploadConfig.MaxSize * 1024 * 1024
		downloadedBase64, downloadedMime, downloadErr := fetchRemoteImageAsBase64(imageURL, maxBytes)
		if downloadErr != nil {
			Error(c, http.StatusBadGateway, "AI image download failed: "+downloadErr.Error())
			return
		}
		imageBase64 = downloadedBase64
		if strings.HasPrefix(strings.ToLower(downloadedMime), "image/") {
			mimeType = downloadedMime
		}
		imageURL = ""
	}

	if imageBase64 == "" && imageURL == "" {
		Error(c, http.StatusBadGateway, "AI returned no usable image")
		return
	}

	Success(c, gin.H{
		"prompt":      coverPrompt,
		"imageBase64": imageBase64,
		"imageUrl":    imageURL,
		"mimeType":    mimeType,
		"size":        first.Size,
		"model":       usedImageModel,
		"usedSize":    usedSize,
	})
}
