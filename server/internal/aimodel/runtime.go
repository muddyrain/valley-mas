// Package aimodel owns the database-backed AI model catalog, scene policy and
// user override resolution. Provider tokens stay in process environment.
package aimodel

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"slices"
	"sort"
	"strings"
	"valley-server/internal/model"

	"gorm.io/gorm"
)

var (
	ErrModelNotAvailable = errors.New("AI 模型不存在、已停用或不支持当前能力")
)

type ProviderConfig struct {
	Provider string
	APIKey   string
	BaseURL  string
}

func ProviderFromEnv(provider string) (ProviderConfig, error) {
	switch strings.TrimSpace(provider) {
	case "siliconflow":
		key := strings.TrimSpace(os.Getenv("SILICONFLOW_API_KEY"))
		if key == "" {
			return ProviderConfig{}, errors.New("AI 服务未配置：缺少 SILICONFLOW_API_KEY")
		}
		baseURL := strings.TrimRight(strings.TrimSpace(os.Getenv("SILICONFLOW_BASE_URL")), "/")
		if baseURL == "" {
			baseURL = "https://api.siliconflow.cn/v1"
		}
		return ProviderConfig{Provider: "siliconflow", APIKey: key, BaseURL: baseURL}, nil
	case "amux":
		key := strings.TrimSpace(os.Getenv("AMUX_API_KEY"))
		if key == "" {
			return ProviderConfig{}, errors.New("AI 服务未配置：缺少 AMUX_API_KEY")
		}
		baseURL := strings.TrimRight(strings.TrimSpace(os.Getenv("AMUX_BASE_URL")), "/")
		if baseURL == "" {
			baseURL = "https://api.amux.ai/v1"
		}
		return ProviderConfig{Provider: "amux", APIKey: key, BaseURL: baseURL}, nil
	case "ark":
		key := strings.TrimSpace(os.Getenv("ARK_API_KEY"))
		if key == "" {
			return ProviderConfig{}, errors.New("AI 服务未配置：缺少 ARK_API_KEY")
		}
		baseURL := strings.TrimRight(strings.TrimSpace(os.Getenv("ARK_BASE_URL")), "/")
		if baseURL == "" {
			baseURL = "https://ark.cn-beijing.volces.com/api/v3"
		}
		return ProviderConfig{Provider: "ark", APIKey: key, BaseURL: baseURL}, nil
	default:
		return ProviderConfig{}, fmt.Errorf("不支持的 AI Provider：%s", provider)
	}
}

func DecodeStrings(raw string) []string {
	var values []string
	if json.Unmarshal([]byte(raw), &values) != nil {
		return nil
	}
	result := make([]string, 0, len(values))
	seen := make(map[string]struct{}, len(values))
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value == "image_edit" {
			value = "reference_image"
		}
		if value == "" {
			continue
		}
		if _, ok := seen[value]; ok {
			continue
		}
		seen[value] = struct{}{}
		result = append(result, value)
	}
	return result
}

func EncodeStrings(values []string) string {
	normalized := DecodeStrings(mustJSON(values))
	encoded, _ := json.Marshal(normalized)
	return string(encoded)
}

func mustJSON(value any) string {
	encoded, _ := json.Marshal(value)
	return string(encoded)
}

func HasCapabilities(item model.AIModel, required []string) bool {
	available := make(map[string]struct{})
	for _, capability := range DecodeStrings(item.Capabilities) {
		available[capability] = struct{}{}
	}
	for _, capability := range required {
		if _, ok := available[capability]; !ok {
			return false
		}
	}
	return true
}

// ImageGenerationQualities returns declared target tiers for known models.
// Provider selection only controls transport; capability belongs to the model
// itself. The image studio records returned pixels after storing the result,
// so a declared target is never treated as a fixed-pixel promise.
func ImageGenerationQualities(item model.AIModel) []string {
	modelID := strings.ToLower(strings.TrimSpace(item.ModelID))
	switch {
	case strings.HasPrefix(modelID, "doubao-seedream-4-0"):
		return []string{"1K", "2K", "3K", "4K"}
	case modelID == "gpt-image-2":
		return []string{"1K", "2K", "4K"}
	}
	return []string{"1K", "2K"}
}

func imageGenerationDefaultPriority(item model.AIModel) int {
	if !HasCapabilities(item, []string{"image_generation"}) {
		return 0
	}
	if HasCapabilities(item, []string{"reference_image"}) &&
		slices.Contains(ImageGenerationQualities(item), "4K") {
		return 2
	}
	if HasCapabilities(item, []string{"reference_image"}) {
		return 1
	}
	return 0
}

func ListEnabledModels(db *gorm.DB, capability string) ([]model.AIModel, error) {
	var items []model.AIModel
	if err := db.Where("enabled = ?", true).Order("sort_order ASC, display_name ASC").Find(&items).Error; err != nil {
		return nil, err
	}
	result := make([]model.AIModel, 0, len(items))
	for _, item := range items {
		if capability == "" || HasCapabilities(item, []string{capability}) {
			result = append(result, item)
		}
	}
	if capability == "image_generation" {
		sort.SliceStable(result, func(i, j int) bool {
			return imageGenerationDefaultPriority(result[i]) > imageGenerationDefaultPriority(result[j])
		})
	}
	return result, nil
}

func FindEnabledModel(db *gorm.DB, rawID, capability string) (model.AIModel, error) {
	var id int64
	if _, err := fmt.Sscan(strings.TrimSpace(rawID), &id); err != nil || id <= 0 {
		return model.AIModel{}, ErrModelNotAvailable
	}
	var item model.AIModel
	if err := db.Where("id = ? AND enabled = ?", id, true).First(&item).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return model.AIModel{}, ErrModelNotAvailable
		}
		return model.AIModel{}, err
	}
	if capability != "" && !HasCapabilities(item, []string{capability}) {
		return model.AIModel{}, ErrModelNotAvailable
	}
	return item, nil
}
