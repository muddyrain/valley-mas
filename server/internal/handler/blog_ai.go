package handler

import (
	"bytes"
	"context"
	"encoding/base64"
	"fmt"
	"image"
	"image/color"
	"image/draw"
	"image/jpeg"
	_ "image/png"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"
	"unicode"
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

func isImageResponseFormatUnsupportedError(raw string) bool {
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
	if strings.Contains(lower, "b64_json") && strings.Contains(lower, "not supported") {
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

func normalizeCoverImageBytes(raw []byte) ([]byte, string, error) {
	img, _, err := image.Decode(bytes.NewReader(raw))
	if err != nil {
		return nil, "", fmt.Errorf("failed to decode AI image")
	}

	bounds := trimDarkLetterboxBounds(img, img.Bounds())
	w := bounds.Dx()
	h := bounds.Dy()
	if w <= 1 || h <= 1 {
		return nil, "", fmt.Errorf("AI image size is invalid")
	}

	targetNum := int64(16)
	targetDen := int64(9)
	cropRect := bounds
	if int64(w)*targetDen > int64(h)*targetNum {
		targetW := int(int64(h) * targetNum / targetDen)
		x0 := bounds.Min.X + (w-targetW)/2
		cropRect = image.Rect(x0, bounds.Min.Y, x0+targetW, bounds.Max.Y)
	} else if int64(w)*targetDen < int64(h)*targetNum {
		targetH := int(int64(w) * targetDen / targetNum)
		y0 := bounds.Min.Y + (h-targetH)/2
		cropRect = image.Rect(bounds.Min.X, y0, bounds.Max.X, y0+targetH)
	}

	dst := image.NewRGBA(image.Rect(0, 0, cropRect.Dx(), cropRect.Dy()))
	draw.Draw(dst, dst.Bounds(), img, cropRect.Min, draw.Src)

	var out bytes.Buffer
	if err := jpeg.Encode(&out, dst, &jpeg.Options{Quality: 95}); err != nil {
		return nil, "", fmt.Errorf("failed to encode normalized cover")
	}
	return out.Bytes(), "image/jpeg", nil
}

func isDarkColor(c color.Color) bool {
	r, g, b, _ := c.RGBA()
	rr := uint8(r >> 8)
	gg := uint8(g >> 8)
	bb := uint8(b >> 8)
	return rr < 16 && gg < 16 && bb < 16
}

func mostlyDarkRow(img image.Image, y int, threshold float64) bool {
	b := img.Bounds()
	total := b.Dx()
	if total <= 0 {
		return false
	}
	dark := 0
	for x := b.Min.X; x < b.Max.X; x++ {
		if isDarkColor(img.At(x, y)) {
			dark++
		}
	}
	return float64(dark)/float64(total) >= threshold
}

func mostlyDarkCol(img image.Image, x int, threshold float64) bool {
	b := img.Bounds()
	total := b.Dy()
	if total <= 0 {
		return false
	}
	dark := 0
	for y := b.Min.Y; y < b.Max.Y; y++ {
		if isDarkColor(img.At(x, y)) {
			dark++
		}
	}
	return float64(dark)/float64(total) >= threshold
}

func trimDarkLetterboxBounds(img image.Image, origin image.Rectangle) image.Rectangle {
	b := origin
	if b.Dx() < 8 || b.Dy() < 8 {
		return b
	}
	const darkRatio = 0.98

	top := b.Min.Y
	for top < b.Max.Y-2 && mostlyDarkRow(img, top, darkRatio) {
		top++
	}
	bottom := b.Max.Y - 1
	for bottom > top+1 && mostlyDarkRow(img, bottom, darkRatio) {
		bottom--
	}
	left := b.Min.X
	for left < b.Max.X-2 && mostlyDarkCol(img, left, darkRatio) {
		left++
	}
	right := b.Max.X - 1
	for right > left+1 && mostlyDarkCol(img, right, darkRatio) {
		right--
	}

	trimmed := image.Rect(left, top, right+1, bottom+1)
	if trimmed.Dx() < b.Dx()/2 || trimmed.Dy() < b.Dy()/2 {
		return b
	}
	return trimmed
}

func normalizeCoverBase64Image(base64Image string) (normalizedBase64 string, mimeType string, err error) {
	decoded, decodeErr := base64.StdEncoding.DecodeString(strings.TrimSpace(base64Image))
	if decodeErr != nil {
		return "", "", fmt.Errorf("invalid AI image base64")
	}
	normalizedBytes, normalizedMime, normalizeErr := normalizeCoverImageBytes(decoded)
	if normalizeErr != nil {
		return "", "", normalizeErr
	}
	return base64.StdEncoding.EncodeToString(normalizedBytes), normalizedMime, nil
}

func detectCoverLanguage(title, excerpt, content string) string {
	text := title + " " + excerpt + " " + content
	hanCount := 0
	latinCount := 0
	for _, r := range text {
		switch {
		case unicode.Is(unicode.Han, r):
			hanCount++
		case unicode.IsLetter(r) && r <= unicode.MaxASCII:
			latinCount++
		}
	}
	if hanCount >= latinCount {
		return "zh"
	}
	return "en"
}

func trimForPrompt(text string, max int) string {
	return truncateAIText(strings.TrimSpace(strings.ReplaceAll(text, "\n", " ")), max)
}

func buildThemeStyleHint(title, excerpt, content string) string {
	source := strings.ToLower(title + " " + excerpt + " " + content)
	hasAny := func(keywords ...string) bool {
		for _, kw := range keywords {
			if strings.Contains(source, kw) {
				return true
			}
		}
		return false
	}
	switch {
	case hasAny(
		"travel", "trip", "journey", "citywalk", "landscape",
		"\u65c5\u884c", "\u98ce\u666f", "\u57ce\u5e02\u6563\u6b65", "\u516c\u8def", "\u5c71\u6c34",
	):
		return "cinematic landscape scene with atmosphere and depth"
	case hasAny(
		"anime", "manga", "illustration", "character",
		"\u4e8c\u6b21\u5143", "\u63d2\u753b", "\u5c11\u5973", "\u52a8\u6f2b", "\u89d2\u8272",
	):
		return "high-quality anime illustration scene with rich details"
	case hasAny(
		"design", "ui", "ux", "color",
		"\u8bbe\u8ba1", "\u89c6\u89c9", "\u914d\u8272", "\u6392\u7248", "\u54c1\u724c",
	):
		return "stylized editorial illustration with refined visual rhythm"
	case hasAny(
		"code", "programming", "frontend", "backend",
		"\u4ee3\u7801", "\u7f16\u7a0b", "\u524d\u7aef", "\u540e\u7aef", "\u5f00\u53d1",
	):
		return "clean modern workspace scene with subtle tech atmosphere"
	default:
		return "theme-matched visual scene with layered storytelling and memorable atmosphere"
	}
}

func buildDeterministicCoverPrompt(req blogAICoverRequest) string {
	title := trimForPrompt(req.Title, 48)
	excerpt := trimForPrompt(req.Excerpt, 120)
	content := trimForPrompt(req.Content, 220)
	_ = detectCoverLanguage(title, excerpt, content)

	topic := title
	if topic == "" {
		topic = excerpt
	}
	if topic == "" {
		topic = trimForPrompt(content, 48)
	}

	styleHint := buildThemeStyleHint(title, excerpt, content)
	baseVisual := "clean editorial cover, balanced composition, visually rich, high detail, sharp focus, directly related to the blog topic, foreground-middle-background layering, cinematic light and shadow, textured details, avoid empty/plain background, full-bleed edge-to-edge scene, no matte border, no frame, no padding margin, include scene details that express topic mood naturally, keep meaningful visual elements inside a safe area"
	return fmt.Sprintf(
		"Blog cover banner 16:9, theme: %s, style direction: %s, %s, choose the most suitable visual language for the topic (such as landscape, anime illustration, or cinematic still life), avoid abstract empty background, absolutely do not render any text, Chinese characters, English letters, numbers, watermark, logo, UI labels, signboard text, subtitle, title-like glyphs, or pseudo text; avoid unrelated objects.",
		topic,
		styleHint,
		baseVisual,
	)
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
	_ = client
	_ = textModel
	return buildDeterministicCoverPrompt(req)
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
		coverPrompt = buildDeterministicCoverPrompt(req)
	}
	coverPrompt = truncateAIText(coverPrompt, 320)

	watermark := false
	sizeCandidates := []string{
		"3072x1536",
		"2560x1280",
		"2304x1152",
		"2048x1024",
		"1792x1024",
		"1536x768",
		"2K",
		"adaptive",
	}
	responseFormatCandidates := []string{
		arkmodel.GenerateImagesResponseFormatBase64,
		arkmodel.GenerateImagesResponseFormatURL,
	}

	var (
		res               arkmodel.ImagesResponse
		success           bool
		err               error
		usedImageModel    string
		usedSize          string
		usedResponseFmt   string
		lastUpstreamError string
	)

	for _, modelCandidate := range candidateModels {
		for _, formatCandidate := range responseFormatCandidates {
			for _, sizeCandidate := range sizeCandidates {
				size := sizeCandidate
				responseFormat := formatCandidate
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
					if isImageResponseFormatUnsupportedError(lastUpstreamError) {
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
					if isImageResponseFormatUnsupportedError(lastUpstreamError) {
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
					usedResponseFmt = formatCandidate
					break
				}
				lastUpstreamError = "empty image payload"
			}
			if success {
				break
			}
			if isImageModelCapabilityError(lastUpstreamError) {
				break
			}
			if isImageResponseFormatUnsupportedError(lastUpstreamError) {
				continue
			}
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

	if imageBase64 != "" {
		normalizedBase64, normalizedMime, normalizeErr := normalizeCoverBase64Image(imageBase64)
		if normalizeErr != nil {
			Error(c, http.StatusBadGateway, "AI image normalize failed: "+normalizeErr.Error())
			return
		}
		imageBase64 = normalizedBase64
		mimeType = normalizedMime
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
		"usedFormat":  usedResponseFmt,
	})
}
