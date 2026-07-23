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

	"github.com/gin-gonic/gin"
)

const (
	aiModelConnectionProbeTimeout      = 45 * time.Second
	aiImageModelConnectionProbeTimeout = 180 * time.Second
)

type adminAIModelRequest struct {
	Provider      string   `json:"provider"`
	ModelID       string   `json:"modelId"`
	DisplayName   string   `json:"displayName"`
	Capabilities  []string `json:"capabilities"`
	ImageProtocol string   `json:"imageProtocol"`
	Enabled       bool     `json:"enabled"`
	SortOrder     int      `json:"sortOrder"`
}

type aiModelConnectionTestRequest struct {
	CatalogID     string   `json:"catalogId"`
	Provider      string   `json:"provider"`
	ModelID       string   `json:"modelId"`
	Capabilities  []string `json:"capabilities"`
	ImageProtocol string   `json:"imageProtocol"`
}

type aiModelOption struct {
	ID           string   `json:"id"`
	Provider     string   `json:"provider"`
	ModelID      string   `json:"modelId"`
	DisplayName  string   `json:"displayName"`
	Capabilities []string `json:"capabilities"`
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
	VerifiedCapabilities []string   `json:"verifiedCapabilities"`
	VerificationStatus   string     `json:"verificationStatus"`
	VerificationMessage  string     `json:"verificationMessage"`
	LastVerifiedAt       *time.Time `json:"lastVerifiedAt,omitempty"`
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
		"capabilities": item.Capabilities, "image_protocol": item.ImageProtocol,
		"enabled": item.Enabled, "sort_order": item.SortOrder,
	}
	if existing.Provider != item.Provider ||
		existing.ModelID != item.ModelID ||
		existing.Capabilities != item.Capabilities ||
		existing.ImageProtocol != item.ImageProtocol {
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
}

type aiModelProbeProfile struct {
	Capabilities  []string
	ImageProtocol string
}

func probeAIModel(
	ctx context.Context,
	client aiModelProbeClient,
	modelID string,
	capabilities []string,
) (aiModelProbeResult, error) {
	startedAt := time.Now()
	item := model.AIModel{Capabilities: aimodel.EncodeStrings(capabilities)}
	if aimodel.HasCapabilities(item, []string{"image_generation"}) {
		request := aiclient.ImageGenerationRequest{
			ModelID: modelID,
			Prompt:  "A small blue circle on a white background.",
			Size:    "1024x1024",
		}
		verified := []string{"image_generation"}
		if aimodel.HasCapabilities(item, []string{"reference_image"}) {
			reference, err := buildAIModelProbeReference()
			if err != nil {
				return aiModelProbeResult{}, err
			}
			request.Images = []string{reference}
			verified = append(verified, "reference_image")
		}
		_, err := client.GenerateImageWithRequest(ctx, request)
		return aiModelProbeResult{
			Latency: time.Since(startedAt), VerifiedCapabilities: verified,
		}, err
	}
	if aimodel.HasCapabilities(item, []string{"embedding"}) {
		_, err := client.Embeddings(ctx, modelID, []string{"ping"})
		return aiModelProbeResult{
			Latency: time.Since(startedAt), VerifiedCapabilities: []string{"embedding"},
		}, err
	}
	temperature := 0.0
	maxTokens := 1
	_, err := client.Chat(ctx, aiclient.CompatibleChatRequest{
		Model:       modelID,
		Messages:    []aiclient.CompatibleMessage{{Role: "user", Content: "ping"}},
		Temperature: &temperature,
		MaxTokens:   &maxTokens,
	})
	verified := []string{}
	if aimodel.HasCapabilities(item, []string{"text"}) {
		verified = append(verified, "text")
	}
	return aiModelProbeResult{
		Latency: time.Since(startedAt), VerifiedCapabilities: verified,
	}, err
}

func adminAIModelResponseFromModel(item model.AIModel) adminAIModelResponse {
	return adminAIModelResponse{
		ID: item.ID.String(), Provider: item.Provider, ModelID: item.ModelID, DisplayName: item.DisplayName,
		Capabilities: aimodel.DecodeStrings(item.Capabilities), ImageProtocol: item.ImageProtocol,
		VerifiedCapabilities: aimodel.DecodeStrings(item.VerifiedCapabilities),
		VerificationStatus:   item.VerificationStatus, VerificationMessage: item.VerificationMessage,
		LastVerifiedAt: item.LastVerifiedAt, Enabled: item.Enabled, SortOrder: item.SortOrder,
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
		options = append(options, aiModelOption{ID: item.ID.String(), Provider: item.Provider, ModelID: item.ModelID, DisplayName: item.DisplayName, Capabilities: aimodel.DecodeStrings(item.Capabilities)})
	}
	Success(c, gin.H{"list": options})
}

func newAIModel(req adminAIModelRequest) (model.AIModel, error) {
	provider := strings.TrimSpace(req.Provider)
	if provider != "siliconflow" && provider != "amux" && provider != "ark" {
		return model.AIModel{}, errors.New("Provider 仅支持 siliconflow、amux 或兼容期 ark")
	}
	modelID := strings.TrimSpace(req.ModelID)
	if modelID == "" {
		return model.AIModel{}, errors.New("模型 ID 不能为空")
	}
	capabilities := aimodel.DecodeStrings(mustEncodeStringSlice(req.Capabilities))
	if len(capabilities) == 0 {
		return model.AIModel{}, errors.New("请至少配置一种模型能力")
	}
	if slices.Contains(capabilities, "reference_image") && !slices.Contains(capabilities, "image_generation") {
		return model.AIModel{}, errors.New("支持参考图需要同时启用生图能力")
	}
	displayName := strings.TrimSpace(req.DisplayName)
	if displayName == "" {
		displayName = modelID
	}
	imageProtocol := normalizeImageProtocol(req.ImageProtocol)
	if !slices.Contains(
		[]string{"auto", "siliconflow_images", "openai_images", "ark_images"},
		imageProtocol,
	) {
		return model.AIModel{}, errors.New("请选择有效的图片协议")
	}
	return model.AIModel{
		Provider: provider, ModelID: modelID, DisplayName: displayName,
		Capabilities: aimodel.EncodeStrings(capabilities), ImageProtocol: imageProtocol,
		Enabled: req.Enabled, SortOrder: req.SortOrder,
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

func buildAIModelProbeReference() (string, error) {
	canvas := image.NewRGBA(image.Rect(0, 0, 64, 64))
	for y := 0; y < 64; y++ {
		for x := 0; x < 64; x++ {
			canvas.Set(x, y, color.RGBA{R: 255, G: 255, B: 255, A: 255})
		}
	}
	for y := 18; y < 46; y++ {
		for x := 18; x < 46; x++ {
			canvas.Set(x, y, color.RGBA{R: 37, G: 99, B: 235, A: 255})
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
) aiModelProbeProfile {
	fallback := aiModelProbeProfile{
		Capabilities:  aimodel.DecodeStrings(mustEncodeStringSlice(requested)),
		ImageProtocol: normalizeImageProtocol(requestedImageProtocol),
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
		Capabilities:  aimodel.DecodeStrings(item.Capabilities),
		ImageProtocol: normalizeImageProtocol(item.ImageProtocol),
	}
}
