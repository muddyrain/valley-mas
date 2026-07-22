package handler

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"sort"
	"strings"
	"time"
	"valley-server/internal/aiclient"
	"valley-server/internal/aimodel"
	"valley-server/internal/database"
	"valley-server/internal/model"

	"github.com/gin-gonic/gin"
)

const aiModelConnectionProbeTimeout = 45 * time.Second

type adminAIModelRequest struct {
	Provider     string   `json:"provider"`
	ModelID      string   `json:"modelId"`
	DisplayName  string   `json:"displayName"`
	Capabilities []string `json:"capabilities"`
	Enabled      bool     `json:"enabled"`
	SortOrder    int      `json:"sortOrder"`
}

type aiModelConnectionTestRequest struct {
	Provider     string   `json:"provider"`
	ModelID      string   `json:"modelId"`
	Capabilities []string `json:"capabilities"`
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
	ID           string    `json:"id"`
	Provider     string    `json:"provider"`
	ModelID      string    `json:"modelId"`
	DisplayName  string    `json:"displayName"`
	Capabilities []string  `json:"capabilities"`
	Enabled      bool      `json:"enabled"`
	SortOrder    int       `json:"sortOrder"`
	CreatedAt    time.Time `json:"createdAt"`
	UpdatedAt    time.Time `json:"updatedAt"`
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
	if err := database.GetDB().Model(&existing).Updates(map[string]any{
		"provider": item.Provider, "model_id": item.ModelID, "display_name": item.DisplayName,
		"capabilities": item.Capabilities, "enabled": item.Enabled, "sort_order": item.SortOrder,
	}).Error; err != nil {
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
	config, err := aimodel.ProviderFromEnv(provider)
	if err != nil {
		Error(c, http.StatusServiceUnavailable, err.Error())
		return
	}
	contextWithTimeout, cancel := context.WithTimeout(c.Request.Context(), aiModelConnectionProbeTimeout)
	defer cancel()
	latency, err := probeAIModel(
		contextWithTimeout,
		aiclient.NewCompatibleClient(config.BaseURL, config.APIKey, aiModelConnectionProbeTimeout),
		modelID,
		req.Capabilities,
	)
	if err != nil {
		if errors.Is(err, context.DeadlineExceeded) || errors.Is(contextWithTimeout.Err(), context.DeadlineExceeded) {
			Error(c, http.StatusGatewayTimeout, "模型响应超时，请稍后重试或更换模型")
			return
		}
		Error(c, http.StatusBadGateway, "模型调用检测失败："+err.Error())
		return
	}
	Success(c, gin.H{
		"provider": provider, "modelId": modelID, "available": true, "latencyMs": latency.Milliseconds(),
	})
}

type aiModelProbeClient interface {
	Chat(context.Context, aiclient.CompatibleChatRequest) (aiclient.CompatibleChatResponse, error)
	Embeddings(context.Context, string, []string) (aiclient.CompatibleEmbeddingResponse, error)
	GenerateImage(context.Context, string, string, string) (string, error)
}

func probeAIModel(ctx context.Context, client aiModelProbeClient, modelID string, capabilities []string) (time.Duration, error) {
	startedAt := time.Now()
	if aimodel.HasCapabilities(model.AIModel{Capabilities: aimodel.EncodeStrings(capabilities)}, []string{"image_generation"}) {
		_, err := client.GenerateImage(ctx, modelID, "A small blue circle on a white background.", "1024x1024")
		return time.Since(startedAt), err
	}
	if aimodel.HasCapabilities(model.AIModel{Capabilities: aimodel.EncodeStrings(capabilities)}, []string{"embedding"}) {
		_, err := client.Embeddings(ctx, modelID, []string{"ping"})
		return time.Since(startedAt), err
	}
	temperature := 0.0
	maxTokens := 1
	_, err := client.Chat(ctx, aiclient.CompatibleChatRequest{
		Model:       modelID,
		Messages:    []aiclient.CompatibleMessage{{Role: "user", Content: "ping"}},
		Temperature: &temperature,
		MaxTokens:   &maxTokens,
	})
	return time.Since(startedAt), err
}

func adminAIModelResponseFromModel(item model.AIModel) adminAIModelResponse {
	return adminAIModelResponse{
		ID: item.ID.String(), Provider: item.Provider, ModelID: item.ModelID, DisplayName: item.DisplayName,
		Capabilities: aimodel.DecodeStrings(item.Capabilities), Enabled: item.Enabled, SortOrder: item.SortOrder,
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
	models, err := aiclient.NewCompatibleClient(config.BaseURL, config.APIKey, 20*time.Second).ListModels(c.Request.Context())
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
	displayName := strings.TrimSpace(req.DisplayName)
	if displayName == "" {
		displayName = modelID
	}
	return model.AIModel{Provider: provider, ModelID: modelID, DisplayName: displayName, Capabilities: aimodel.EncodeStrings(capabilities), Enabled: req.Enabled, SortOrder: req.SortOrder}, nil
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
