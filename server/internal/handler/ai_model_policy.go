package handler

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"image"
	"image/color"
	_ "image/jpeg"
	"image/png"
	"net/http"
	"slices"
	"sort"
	"strings"
	"time"
	"valley-server/internal/aiclient"
	"valley-server/internal/aimodel"
	"valley-server/internal/database"
	"valley-server/internal/model"
	"valley-server/internal/service"

	"github.com/gin-gonic/gin"
)

const (
	aiModelConnectionProbeTimeout      = 45 * time.Second
	aiImageModelConnectionProbeTimeout = 180 * time.Second
)

type adminAIModelRequest struct {
	Provider            string   `json:"provider"`
	ModelID             string   `json:"modelId"`
	DisplayName         string   `json:"displayName"`
	Capabilities        []string `json:"capabilities"`
	ImageProtocol       string   `json:"imageProtocol"`
	VideoProtocol       string   `json:"videoProtocol"`
	ContextWindowTokens int      `json:"contextWindowTokens"`
	MaxOutputTokens     int      `json:"maxOutputTokens"`
	EmbeddingDimension  int      `json:"embeddingDimension"`
	Enabled             bool     `json:"enabled"`
	SortOrder           int      `json:"sortOrder"`
}

type aiModelConnectionTestRequest struct {
	CatalogID     string   `json:"catalogId"`
	Provider      string   `json:"provider"`
	ModelID       string   `json:"modelId"`
	Capabilities  []string `json:"capabilities"`
	ImageProtocol string   `json:"imageProtocol"`
	VideoProtocol string   `json:"videoProtocol"`
}

type aiModelOption struct {
	ID                      string   `json:"id"`
	Provider                string   `json:"provider"`
	ModelID                 string   `json:"modelId"`
	DisplayName             string   `json:"displayName"`
	Capabilities            []string `json:"capabilities"`
	VerifiedCapabilities    []string `json:"verifiedCapabilities"`
	EmbeddingDimension      int      `json:"embeddingDimension,omitempty"`
	ImageQualities          []string `json:"imageQualities,omitempty"`
	ImageReferenceQualities []string `json:"imageReferenceQualities,omitempty"`
}

// Admin responses expose JSON fields as their semantic array types rather than
// the database's JSON-text storage representation.
type adminAIModelResponse struct {
	ID                   string     `json:"id"`
	Provider             string     `json:"provider"`
	ModelID              string     `json:"modelId"`
	DisplayName          string     `json:"displayName"`
	Capabilities         []string   `json:"capabilities"`
	ImageProtocol        string     `json:"imageProtocol"`
	VideoProtocol        string     `json:"videoProtocol"`
	VerifiedCapabilities []string   `json:"verifiedCapabilities"`
	VerificationStatus   string     `json:"verificationStatus"`
	VerificationMessage  string     `json:"verificationMessage"`
	LastVerifiedAt       *time.Time `json:"lastVerifiedAt,omitempty"`
	ContextWindowTokens  int        `json:"contextWindowTokens,omitempty"`
	MaxOutputTokens      int        `json:"maxOutputTokens,omitempty"`
	EmbeddingDimension   int        `json:"embeddingDimension,omitempty"`
	Enabled              bool       `json:"enabled"`
	SortOrder            int        `json:"sortOrder"`
	CreatedAt            time.Time  `json:"createdAt"`
	UpdatedAt            time.Time  `json:"updatedAt"`
}

func AdminListAIModels(c *gin.Context) {
	var models []model.AIModel
	query := database.GetDB().Model(&model.AIModel{})
	if provider := strings.TrimSpace(c.Query("provider")); provider != "" {
		query = query.Where("provider = ?", provider)
	}
	if err := query.Order("provider ASC, sort_order ASC, display_name ASC").Find(&models).Error; err != nil {
		Error(c, http.StatusInternalServerError, "查询 AI 模型失败")
		return
	}
	items := make([]adminAIModelResponse, 0, len(models))
	for _, item := range models {
		items = append(items, adminAIModelResponseFromModel(item))
	}
	Success(c, gin.H{"list": items})
}

func AdminCreateAIModel(c *gin.Context) {
	var req adminAIModelRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		Error(c, http.StatusBadRequest, "模型参数错误")
		return
	}
	item, err := newAIModel(req)
	if err != nil {
		Error(c, http.StatusBadRequest, err.Error())
		return
	}
	if err := database.GetDB().Create(&item).Error; err != nil {
		Error(c, http.StatusConflict, "创建 AI 模型失败，模型可能已存在")
		return
	}
	Success(c, adminAIModelResponseFromModel(item))
}

func AdminUpdateAIModel(c *gin.Context) {
	var req adminAIModelRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		Error(c, http.StatusBadRequest, "模型参数错误")
		return
	}
	item, err := newAIModel(req)
	if err != nil {
		Error(c, http.StatusBadRequest, err.Error())
		return
	}
	modelID, ok := parseModelID(c.Param("id"))
	if !ok {
		Error(c, http.StatusBadRequest, "模型 ID 无效")
		return
	}
	var existing model.AIModel
	if err := database.GetDB().Where("id = ?", modelID).First(&existing).Error; err != nil {
		Error(c, http.StatusNotFound, "AI 模型不存在")
		return
	}
	updates := map[string]any{
		"provider": item.Provider, "model_id": item.ModelID, "display_name": item.DisplayName,
		"capabilities": item.Capabilities, "image_protocol": item.ImageProtocol, "video_protocol": item.VideoProtocol,
		"context_window_tokens": item.ContextWindowTokens, "max_output_tokens": item.MaxOutputTokens,
		"embedding_dimension": item.EmbeddingDimension,
		"enabled":             item.Enabled, "sort_order": item.SortOrder,
	}
	if existing.Provider != item.Provider ||
		existing.ModelID != item.ModelID ||
		existing.Capabilities != item.Capabilities ||
		existing.ImageProtocol != item.ImageProtocol ||
		existing.VideoProtocol != item.VideoProtocol ||
		existing.EmbeddingDimension != item.EmbeddingDimension {
		updates["verified_capabilities"] = "[]"
		updates["verification_status"] = "unverified"
		updates["verification_message"] = ""
		updates["last_verified_at"] = nil
	}
	if err := database.GetDB().Model(&existing).Updates(updates).Error; err != nil {
		Error(c, http.StatusBadRequest, "更新 AI 模型失败")
		return
	}
	if err := database.GetDB().Where("id = ?", existing.ID).First(&existing).Error; err != nil {
		Error(c, http.StatusInternalServerError, "读取 AI 模型失败")
		return
	}
	Success(c, adminAIModelResponseFromModel(existing))
}

// AdminTestAIModelConnection verifies an exact model with a minimal real
// inference request. Listing a model does not prove that it can serve traffic.
func AdminTestAIModelConnection(c *gin.Context) {
	var req aiModelConnectionTestRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		Error(c, http.StatusBadRequest, "连接检测参数错误")
		return
	}
	provider := strings.TrimSpace(req.Provider)
	modelID := strings.TrimSpace(req.ModelID)
	if modelID == "" {
		Error(c, http.StatusBadRequest, "模型 ID 不能为空")
		return
	}
	profile := resolveAIModelProbeProfile(
		req.CatalogID,
		provider,
		modelID,
		req.Capabilities,
		req.ImageProtocol,
		req.VideoProtocol,
	)
	capabilities := profile.Capabilities
	config, err := aimodel.ProviderFromEnv(provider)
	if err != nil {
		recordAIModelVerification(req.CatalogID, provider, modelID, "failed", nil, err.Error())
		Error(c, http.StatusServiceUnavailable, err.Error())
		return
	}
	probeTimeout := aiModelConnectionProbeTimeout
	if slices.Contains(aimodel.DecodeStrings(mustEncodeStringSlice(capabilities)), "image_generation") {
		probeTimeout = aiImageModelConnectionProbeTimeout
	}
	contextWithTimeout, cancel := context.WithTimeout(c.Request.Context(), probeTimeout)
	defer cancel()
	probeClient := aiclient.NewProviderCompatibleClient(
		config.Provider,
		config.BaseURL,
		config.APIKey,
		probeTimeout,
	)
	probeClient.ImageProtocol = profile.ImageProtocol
	probeClient.VideoProtocol = profile.VideoProtocol
	probe, err := probeAIModel(
		contextWithTimeout,
		probeClient,
		modelID,
		capabilities,
	)
	if err != nil {
		recordAIModelVerification(req.CatalogID, provider, modelID, "failed", nil, err.Error())
		if errors.Is(err, context.DeadlineExceeded) || errors.Is(contextWithTimeout.Err(), context.DeadlineExceeded) {
			Error(c, http.StatusGatewayTimeout, "模型响应超时，请稍后重试或更换模型")
			return
		}
		Error(c, http.StatusBadGateway, "模型调用检测失败："+err.Error())
		return
	}
	if profile.EmbeddingDimension > 0 && probe.EmbeddingDimension != profile.EmbeddingDimension {
		message := fmt.Sprintf(
			"向量维度不匹配：配置为 %d 维，模型实际返回 %d 维",
			profile.EmbeddingDimension,
			probe.EmbeddingDimension,
		)
		recordAIModelVerification(req.CatalogID, provider, modelID, "failed", nil, message)
		Error(c, http.StatusBadGateway, message)
		return
	}
	status := aiModelVerificationStatus(capabilities, probe.VerifiedCapabilities)
	verifiedAt := time.Now()
	recordAIModelVerification(
		req.CatalogID,
		provider,
		modelID,
		status,
		probe.VerifiedCapabilities,
		"",
	)
	Success(c, gin.H{
		"provider": provider, "modelId": modelID, "available": true,
		"latencyMs": probe.Latency.Milliseconds(), "verificationStatus": status,
		"verifiedCapabilities": probe.VerifiedCapabilities, "verifiedAt": verifiedAt,
	})
}

type aiModelProbeClient interface {
	Chat(context.Context, aiclient.CompatibleChatRequest) (aiclient.CompatibleChatResponse, error)
	Embeddings(context.Context, string, []string) (aiclient.CompatibleEmbeddingResponse, error)
	GenerateImageWithRequest(context.Context, aiclient.ImageGenerationRequest) (string, error)
}

type aiModelProbeResult struct {
	Latency              time.Duration
	VerifiedCapabilities []string
	EmbeddingDimension   int
}

type aiModelProbeProfile struct {
	Capabilities       []string
	ImageProtocol      string
	VideoProtocol      string
	EmbeddingDimension int
}

func probeAIModel(
	ctx context.Context,
	client aiModelProbeClient,
	modelID string,
	capabilities []string,
) (aiModelProbeResult, error) {
	startedAt := time.Now()
	item := model.AIModel{Capabilities: aimodel.EncodeStrings(capabilities)}
	verified := make([]string, 0, len(capabilities))
	embeddingDimension := 0
	if aimodel.HasCapabilities(item, []string{"image_generation"}) {
		request := aiclient.ImageGenerationRequest{
			ModelID: modelID,
			Prompt:  "Reproduce the attached reference image exactly. Preserve every color, position, boundary, and quadrant. Do not add, remove, or reinterpret anything.",
			Size:    aimodel.ImageGenerationProbeSize(modelID),
		}
		imageVerified := []string{"image_generation"}
		if aimodel.HasCapabilities(item, []string{"reference_image"}) {
			reference, err := buildAIModelProbeReference()
			if err != nil {
				return aiModelProbeResult{}, err
			}
			request.Images = []string{reference}
			imageVerified = append(imageVerified, "reference_image")
		}
		if aimodel.HasCapabilities(item, []string{"masked_edit"}) {
			reference, err := buildAIModelProbeReference()
			if err != nil {
				return aiModelProbeResult{}, err
			}
			mask, err := buildAIModelProbeMask()
			if err != nil {
				return aiModelProbeResult{}, err
			}
			request.Images = []string{reference}
			request.Mask = mask
			imageVerified = append(imageVerified, "reference_image", "masked_edit")
			if aimodel.HasCapabilities(item, []string{"outpainting"}) {
				imageVerified = append(imageVerified, "outpainting")
			}
		}
		source, err := client.GenerateImageWithRequest(ctx, request)
		if err != nil {
			return aiModelProbeResult{Latency: time.Since(startedAt), VerifiedCapabilities: verified}, err
		}
		if aimodel.HasCapabilities(item, []string{"reference_image"}) {
			if err := validateAIModelReferenceProbeOutput(ctx, source); err != nil {
				return aiModelProbeResult{Latency: time.Since(startedAt), VerifiedCapabilities: verified}, err
			}
		}
		verified = append(verified, aimodel.DecodeStrings(mustEncodeStringSlice(imageVerified))...)
	}
	if aimodel.HasCapabilities(item, []string{"embedding"}) {
		response, err := client.Embeddings(ctx, modelID, []string{"ping"})
		if err != nil {
			return aiModelProbeResult{Latency: time.Since(startedAt), VerifiedCapabilities: verified}, err
		}
		if len(response.Data) == 0 || len(response.Data[0].Embedding) == 0 {
			return aiModelProbeResult{Latency: time.Since(startedAt), VerifiedCapabilities: verified},
				errors.New("向量模型返回了空向量")
		}
		verified = append(verified, "embedding")
		embeddingDimension = len(response.Data[0].Embedding)
	}
	if aimodel.HasCapabilities(item, []string{"vision"}) {
		imageURL, err := buildAIModelVisionProbeReference()
		if err != nil {
			return aiModelProbeResult{Latency: time.Since(startedAt), VerifiedCapabilities: verified}, err
		}
		temperature := 0.0
		maxTokens := 16
		response, err := client.Chat(ctx, aiclient.CompatibleChatRequest{
			Model: modelID,
			Messages: []aiclient.CompatibleMessage{{
				Role: "user",
				Content: []map[string]any{
					{"type": "image_url", "image_url": map[string]string{"url": imageURL}},
					{"type": "text", "text": "Inspect the attached image. Reply with the four quadrant colors in reading order, using only uppercase English color names separated by commas."},
				},
			}},
			Temperature: &temperature,
			MaxTokens:   &maxTokens,
		})
		if err != nil {
			return aiModelProbeResult{Latency: time.Since(startedAt), VerifiedCapabilities: verified}, err
		}
		if len(response.Choices) == 0 || !isValidVisionProbeAnswer(compatibleMessageText(response.Choices[0].Message.Content)) {
			return aiModelProbeResult{Latency: time.Since(startedAt), VerifiedCapabilities: verified}, errors.New("视觉模型未正确识别测试图片")
		}
		verified = append(verified, "vision")
		if aimodel.HasCapabilities(item, []string{"text"}) {
			verified = append(verified, "text")
		}
	} else if aimodel.HasCapabilities(item, []string{"text"}) {
		temperature := 0.0
		maxTokens := 1
		_, err := client.Chat(ctx, aiclient.CompatibleChatRequest{
			Model:       modelID,
			Messages:    []aiclient.CompatibleMessage{{Role: "user", Content: "ping"}},
			Temperature: &temperature,
			MaxTokens:   &maxTokens,
		})
		if err != nil {
			return aiModelProbeResult{Latency: time.Since(startedAt), VerifiedCapabilities: verified}, err
		}
		verified = append(verified, "text")
	}
	return aiModelProbeResult{
		Latency: time.Since(startedAt), VerifiedCapabilities: verified,
		EmbeddingDimension: embeddingDimension,
	}, nil
}

func isValidVisionProbeAnswer(value string) bool {
	normalized := strings.ToUpper(strings.ReplaceAll(strings.TrimSpace(value), "，", ","))
	normalized = strings.Join(strings.Fields(normalized), "")
	return normalized == "RED,BLUE,GREEN,YELLOW"
}

func adminAIModelResponseFromModel(item model.AIModel) adminAIModelResponse {
	return adminAIModelResponse{
		ID: item.ID.String(), Provider: item.Provider, ModelID: item.ModelID, DisplayName: item.DisplayName,
		Capabilities: aimodel.DecodeStrings(item.Capabilities), ImageProtocol: item.ImageProtocol, VideoProtocol: item.VideoProtocol,
		VerifiedCapabilities: aimodel.DecodeStrings(item.VerifiedCapabilities),
		VerificationStatus:   item.VerificationStatus, VerificationMessage: item.VerificationMessage,
		LastVerifiedAt:      item.LastVerifiedAt,
		ContextWindowTokens: item.ContextWindowTokens, MaxOutputTokens: item.MaxOutputTokens,
		EmbeddingDimension: item.EmbeddingDimension,
		Enabled:            item.Enabled, SortOrder: item.SortOrder,
		CreatedAt: item.CreatedAt, UpdatedAt: item.UpdatedAt,
	}
}

func AdminPreviewAIProviderModels(c *gin.Context) {
	provider := strings.TrimSpace(c.Param("provider"))
	config, err := aimodel.ProviderFromEnv(provider)
	if err != nil {
		Error(c, http.StatusServiceUnavailable, err.Error())
		return
	}
	models, err := aiclient.NewProviderCompatibleClient(
		config.Provider,
		config.BaseURL,
		config.APIKey,
		20*time.Second,
	).ListModels(c.Request.Context())
	if err != nil {
		Error(c, http.StatusBadGateway, "读取 Provider 模型列表失败："+err.Error())
		return
	}
	sort.Strings(models)
	Success(c, gin.H{"provider": provider, "models": models})
}

func ListAvailableAIModels(c *gin.Context) {
	capability := strings.TrimSpace(c.Query("capability"))
	items, err := aimodel.ListEnabledModels(database.GetDB(), capability)
	if err != nil {
		Error(c, http.StatusInternalServerError, "读取可用 AI 模型失败")
		return
	}
	options := make([]aiModelOption, 0, len(items))
	for _, item := range items {
		option := aiModelOption{
			ID: item.ID.String(), Provider: item.Provider, ModelID: item.ModelID,
			DisplayName: item.DisplayName, Capabilities: aimodel.DecodeStrings(item.Capabilities),
			VerifiedCapabilities: aimodel.DecodeStrings(item.VerifiedCapabilities),
			EmbeddingDimension:   item.EmbeddingDimension,
		}
		if aimodel.HasCapabilities(item, []string{"image_generation"}) {
			option.ImageQualities = aimodel.ImageGenerationQualities(item)
			if aimodel.HasCapabilities(item, []string{"reference_image"}) {
				option.ImageReferenceQualities = aimodel.ImageGenerationReferenceQualities(item)
			}
		}
		options = append(options, option)
	}
	Success(c, gin.H{"list": options})
}

func newAIModel(req adminAIModelRequest) (model.AIModel, error) {
	provider := strings.TrimSpace(req.Provider)
	if provider != "siliconflow" && provider != "amux" && provider != "pipixia" && provider != "volcengine" {
		return model.AIModel{}, errors.New("Provider 仅支持 siliconflow、amux、pipixia 或 volcengine")
	}
	modelID := strings.TrimSpace(req.ModelID)
	if modelID == "" {
		return model.AIModel{}, errors.New("模型 ID 不能为空")
	}
	capabilities := aimodel.DecodeStrings(mustEncodeStringSlice(req.Capabilities))
	if len(capabilities) == 0 {
		return model.AIModel{}, errors.New("请至少配置一种模型能力")
	}
	if slices.Contains(capabilities, "reference_image") &&
		!slices.Contains(capabilities, "image_generation") && !slices.Contains(capabilities, "video_generation") {
		return model.AIModel{}, errors.New("参考图能力需要同时启用生图或视频生成能力")
	}
	for _, capability := range []string{"masked_edit", "outpainting"} {
		if slices.Contains(capabilities, capability) && !slices.Contains(capabilities, "image_generation") {
			return model.AIModel{}, errors.New("图片编辑能力需要同时启用生图能力")
		}
	}
	if slices.Contains(capabilities, "masked_edit") && !slices.Contains(capabilities, "reference_image") {
		return model.AIModel{}, errors.New("蒙版编辑需要同时启用参考图能力")
	}
	if slices.Contains(capabilities, "outpainting") && !slices.Contains(capabilities, "masked_edit") {
		return model.AIModel{}, errors.New("扩图需要同时启用蒙版编辑能力")
	}
	displayName := strings.TrimSpace(req.DisplayName)
	if displayName == "" {
		displayName = modelID
	}
	imageProtocol := normalizeImageProtocol(req.ImageProtocol)
	videoProtocol := normalizeVideoProtocol(req.VideoProtocol)
	if !slices.Contains(
		[]string{"auto", "siliconflow_images", "openai_images", "ark_images"},
		imageProtocol,
	) {
		return model.AIModel{}, errors.New("请选择有效的图片协议")
	}
	if !slices.Contains([]string{"auto", "amux_video"}, videoProtocol) {
		return model.AIModel{}, errors.New("请选择有效的视频协议")
	}
	if req.ContextWindowTokens < 0 || req.MaxOutputTokens < 0 {
		return model.AIModel{}, errors.New("模型规格不能小于 0")
	}
	if slices.Contains(capabilities, "embedding") && req.EmbeddingDimension <= 0 {
		return model.AIModel{}, errors.New("向量模型必须填写大于 0 的向量维度")
	}
	embeddingDimension := req.EmbeddingDimension
	if !slices.Contains(capabilities, "embedding") {
		embeddingDimension = 0
	}
	return model.AIModel{
		Provider: provider, ModelID: modelID, DisplayName: displayName,
		Capabilities: aimodel.EncodeStrings(capabilities), ImageProtocol: imageProtocol, VideoProtocol: videoProtocol,
		ContextWindowTokens: req.ContextWindowTokens, MaxOutputTokens: req.MaxOutputTokens,
		EmbeddingDimension: embeddingDimension,
		Enabled:            req.Enabled, SortOrder: req.SortOrder,
	}, nil
}

func parseModelID(raw string) (model.Int64String, bool) {
	var value int64
	if _, err := fmt.Sscan(strings.TrimSpace(raw), &value); err != nil || value <= 0 {
		return 0, false
	}
	return model.Int64String(value), true
}

func mustEncodeStringSlice(values []string) string {
	encoded, _ := json.Marshal(values)
	return string(encoded)
}

func normalizeImageProtocol(value string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return "auto"
	}
	return value
}

func normalizeVideoProtocol(value string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return "auto"
	}
	return value
}

func buildAIModelProbeReference() (string, error) {
	canvas := image.NewRGBA(image.Rect(0, 0, 256, 256))
	quadrants := [4]color.RGBA{
		{R: 220, G: 50, B: 50, A: 255},
		{R: 50, G: 100, B: 220, A: 255},
		{R: 50, G: 180, B: 90, A: 255},
		{R: 230, G: 200, B: 50, A: 255},
	}
	for y := 0; y < 256; y++ {
		for x := 0; x < 256; x++ {
			quadrant := 0
			if x >= 128 {
				quadrant++
			}
			if y >= 128 {
				quadrant += 2
			}
			canvas.SetRGBA(x, y, quadrants[quadrant])
		}
	}
	var output bytes.Buffer
	if err := png.Encode(&output, canvas); err != nil {
		return "", err
	}
	return "data:image/png;base64," + base64.StdEncoding.EncodeToString(output.Bytes()), nil
}

func validateAIModelReferenceProbeOutput(ctx context.Context, source string) error {
	content, _, err := service.FetchAIImageSource(ctx, source)
	if err != nil {
		return fmt.Errorf("参考图能力检测无法读取生成结果: %w", err)
	}
	decoded, _, err := image.Decode(bytes.NewReader(content))
	if err != nil {
		return fmt.Errorf("参考图能力检测无法解析生成结果: %w", err)
	}
	bounds := decoded.Bounds()
	if bounds.Dx() < 8 || bounds.Dy() < 8 {
		return errors.New("参考图能力检测结果尺寸异常")
	}
	colors := [4]color.RGBA{
		averageProbePatch(decoded, 1, 1),
		averageProbePatch(decoded, 3, 1),
		averageProbePatch(decoded, 1, 3),
		averageProbePatch(decoded, 3, 3),
	}
	if !isProbeRed(colors[0]) || !isProbeBlue(colors[1]) ||
		!isProbeGreen(colors[2]) || !isProbeYellow(colors[3]) {
		return errors.New("模型返回了图片，但没有保留参考图内容")
	}
	return nil
}

func averageProbePatch(source image.Image, xQuarter, yQuarter int) color.RGBA {
	bounds := source.Bounds()
	centerX := bounds.Min.X + bounds.Dx()*xQuarter/4
	centerY := bounds.Min.Y + bounds.Dy()*yQuarter/4
	radiusX := max(1, bounds.Dx()/16)
	radiusY := max(1, bounds.Dy()/16)
	var red, green, blue, count uint64
	for y := max(bounds.Min.Y, centerY-radiusY); y < min(bounds.Max.Y, centerY+radiusY); y++ {
		for x := max(bounds.Min.X, centerX-radiusX); x < min(bounds.Max.X, centerX+radiusX); x++ {
			r, g, b, _ := source.At(x, y).RGBA()
			red += uint64(r >> 8)
			green += uint64(g >> 8)
			blue += uint64(b >> 8)
			count++
		}
	}
	if count == 0 {
		return color.RGBA{}
	}
	return color.RGBA{R: uint8(red / count), G: uint8(green / count), B: uint8(blue / count), A: 255}
}

func isProbeRed(value color.RGBA) bool {
	return int(value.R) > int(value.G)+50 && int(value.R) > int(value.B)+50
}

func isProbeBlue(value color.RGBA) bool {
	return int(value.B) > int(value.R)+50 && int(value.B) > int(value.G)+30
}

func isProbeGreen(value color.RGBA) bool {
	return int(value.G) > int(value.R)+40 && int(value.G) > int(value.B)+20
}

func isProbeYellow(value color.RGBA) bool {
	return value.R > 150 && value.G > 130 && int(value.B)+60 < min(int(value.R), int(value.G))
}

func buildAIModelProbeMask() (string, error) {
	canvas := image.NewRGBA(image.Rect(0, 0, 256, 256))
	for y := 0; y < 256; y++ {
		for x := 0; x < 256; x++ {
			canvas.Set(x, y, color.RGBA{A: 255})
		}
	}
	for y := 96; y < 160; y++ {
		for x := 96; x < 160; x++ {
			canvas.Set(x, y, color.RGBA{})
		}
	}
	var output bytes.Buffer
	if err := png.Encode(&output, canvas); err != nil {
		return "", err
	}
	return "data:image/png;base64," + base64.StdEncoding.EncodeToString(output.Bytes()), nil
}

func buildAIModelVisionProbeReference() (string, error) {
	canvas := image.NewRGBA(image.Rect(0, 0, 64, 64))
	colors := [4]color.RGBA{
		{R: 255, A: 255},
		{B: 255, A: 255},
		{G: 192, A: 255},
		{R: 255, G: 255, A: 255},
	}
	for y := 0; y < 64; y++ {
		for x := 0; x < 64; x++ {
			quadrant := 0
			if x >= 32 {
				quadrant++
			}
			if y >= 32 {
				quadrant += 2
			}
			canvas.Set(x, y, colors[quadrant])
		}
	}
	var output bytes.Buffer
	if err := png.Encode(&output, canvas); err != nil {
		return "", err
	}
	return "data:image/png;base64," + base64.StdEncoding.EncodeToString(output.Bytes()), nil
}

func aiModelVerificationStatus(declared, verified []string) string {
	declaredSet := make(map[string]struct{})
	for _, capability := range aimodel.DecodeStrings(mustEncodeStringSlice(declared)) {
		declaredSet[capability] = struct{}{}
	}
	for _, capability := range verified {
		delete(declaredSet, capability)
	}
	if len(declaredSet) == 0 {
		return "verified"
	}
	return "partial"
}

func recordAIModelVerification(
	rawCatalogID string,
	provider string,
	modelID string,
	status string,
	verifiedCapabilities []string,
	message string,
) {
	catalogID, ok := parseModelID(rawCatalogID)
	if !ok {
		return
	}
	now := time.Now()
	_ = database.GetDB().Model(&model.AIModel{}).
		Where("id = ? AND provider = ? AND model_id = ?", catalogID, provider, modelID).
		Updates(map[string]any{
			"verified_capabilities": aimodel.EncodeStrings(verifiedCapabilities),
			"verification_status":   status,
			"verification_message":  truncateRunes(strings.TrimSpace(message), 500),
			"last_verified_at":      now,
		}).Error
}

func resolveAIModelProbeProfile(
	rawCatalogID string,
	provider string,
	modelID string,
	requested []string,
	requestedImageProtocol string,
	requestedVideoProtocol string,
) aiModelProbeProfile {
	fallback := aiModelProbeProfile{
		Capabilities:  aimodel.DecodeStrings(mustEncodeStringSlice(requested)),
		ImageProtocol: normalizeImageProtocol(requestedImageProtocol),
		VideoProtocol: normalizeVideoProtocol(requestedVideoProtocol),
	}
	catalogID, ok := parseModelID(rawCatalogID)
	if !ok {
		return fallback
	}
	var item model.AIModel
	if database.GetDB().
		Where("id = ? AND provider = ? AND model_id = ?", catalogID, provider, modelID).
		First(&item).Error != nil {
		return fallback
	}
	return aiModelProbeProfile{
		Capabilities:       aimodel.DecodeStrings(item.Capabilities),
		ImageProtocol:      normalizeImageProtocol(item.ImageProtocol),
		VideoProtocol:      normalizeVideoProtocol(item.VideoProtocol),
		EmbeddingDimension: item.EmbeddingDimension,
	}
}
