package handler

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"slices"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"
	"valley-server/internal/aiclient"
	"valley-server/internal/aimodel"
	"valley-server/internal/database"
	"valley-server/internal/model"
	"valley-server/internal/service"
	"valley-server/internal/utils"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

const (
	maxAIImagePromptRunes         = service.MaxAIImagePromptRunes
	maxAIImageReferences          = service.MaxAIImageReferences
	maxAIImageReferenceBytes      = service.MaxAIImageReferenceBytes
	aiImageQuickSampleCount       = 3
	aiImageQuickSampleMaxExcluded = 12
)

type aiImagePreset = service.AIImageRecipe

var aiImagePresets = service.AIImageRecipes()

var aiImageSizes = service.AIImageSizes

type createAIImageGenerationRequest struct {
	ModelID               string   `json:"modelId"`
	RecipeID              string   `json:"recipeId"`
	StyleProfileID        string   `json:"styleProfileId"`
	Brief                 string   `json:"brief"`
	PresetID              string   `json:"presetId"` // Legacy request compatibility.
	SkillID               string   `json:"skillId"`  // Legacy request compatibility.
	Prompt                string   `json:"prompt"`   // Legacy request compatibility.
	AspectRatio           string   `json:"aspectRatio"`
	Quality               string   `json:"quality"`
	ReferenceRaw          []string `json:"references"`
	ReferenceGenerationID string   `json:"referenceGenerationId"`
}

func (payload createAIImageGenerationRequest) effectiveRecipeID() string {
	id := strings.TrimSpace(payload.RecipeID)
	if id == "" {
		id = strings.TrimSpace(payload.PresetID)
	}
	switch id {
	case "", "free":
		return "free"
	case "anime", "ip-wallpaper", "landscape":
		return "wallpaper"
	case "felt":
		return "free"
	default:
		return id
	}
}

func (payload createAIImageGenerationRequest) effectiveStyleProfileID() string {
	if id := strings.TrimSpace(payload.StyleProfileID); id != "" {
		return id
	}
	if id := strings.TrimSpace(payload.SkillID); id != "" {
		return "skill:" + id
	}
	switch strings.TrimSpace(payload.PresetID) {
	case "anime":
		return "builtin:anime"
	case "ip-wallpaper":
		return "builtin:animation-ip"
	case "landscape":
		return "builtin:cinematic"
	case "felt":
		return "builtin:felt"
	default:
		return ""
	}
}

func (payload createAIImageGenerationRequest) effectiveBrief() string {
	if brief := strings.TrimSpace(payload.Brief); brief != "" {
		return brief
	}
	return strings.TrimSpace(payload.Prompt)
}

type aiImageQuickSampleRequest struct {
	ExcludedPrompts []string `json:"excludedPrompts"`
}

func ListAIImageCreationOptions(c *gin.Context) {
	userID, ok := currentAIAppUser(c)
	if !ok {
		return
	}
	recipes, styles, err := service.NewAIImagePlanner(database.GetDB()).Catalog(c.Request.Context(), userID)
	if err != nil {
		ErrorWithDetail(c, http.StatusInternalServerError, "加载图片创作选项失败", err)
		return
	}
	Success(c, gin.H{
		"recipes":       recipes,
		"presets":       recipes,
		"styleProfiles": styles,
		"aspectRatios":  []string{"1:1", "4:3", "3:4", "16:9", "9:16"},
		"qualities":     []string{"1K", "2K"},
		"sizes":         aiImageSizes,
	})
}

// GenerateAIImageRecipeSamples rotates through a curated local pool. This is a
// lightweight inspiration interaction, so it must not block on a model call.
func GenerateAIImageRecipeSamples(c *gin.Context) {
	_, ok := currentAIAppUser(c)
	if !ok {
		return
	}
	var payload aiImageQuickSampleRequest
	if err := c.ShouldBindJSON(&payload); err != nil {
		Error(c, http.StatusBadRequest, "快速示例参数错误")
		return
	}
	recipeID := c.Param("recipeId")
	if recipeID == "" {
		recipeID = c.Param("presetId")
	}
	preset, ok := findAIImagePreset(recipeID)
	if !ok {
		Error(c, http.StatusNotFound, "创作类型不存在")
		return
	}

	excluded := normalizeAIImageQuickSamplePrompts(payload.ExcludedPrompts, aiImageQuickSampleMaxExcluded)
	samples := selectAIImageQuickSamples(preset, excluded, aiImageQuickSampleCount)
	Success(c, gin.H{"list": samples, "model": "local-curated"})
}

func CreateAIImageGeneration(c *gin.Context) {
	userID, ok := currentAIAppUser(c)
	if !ok {
		return
	}
	// Three 5MB binary references expand to roughly 20MB after base64 encoding.
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 22<<20)
	var payload createAIImageGenerationRequest
	if err := c.ShouldBindJSON(&payload); err != nil {
		Error(c, http.StatusBadRequest, "图片生成参数错误")
		return
	}
	_, _, references, err := validateAIImageGenerationRequest(payload, nil)
	if err != nil {
		Error(c, http.StatusBadRequest, err.Error())
		return
	}
	generation, err := service.NewAIImageGenerationService(database.GetDB()).Queue(
		c.Request.Context(),
		service.AIImageGenerationInput{
			UserID:                userID,
			ModelID:               payload.ModelID,
			RecipeID:              payload.effectiveRecipeID(),
			StyleProfileID:        payload.effectiveStyleProfileID(),
			Brief:                 payload.effectiveBrief(),
			AspectRatio:           payload.AspectRatio,
			Quality:               payload.Quality,
			References:            references,
			ReferenceGenerationID: payload.ReferenceGenerationID,
			Feature:               "ai-image-studio",
		},
	)
	if err != nil {
		var inputErr *service.AIImageGenerationInputError
		switch {
		case errors.As(err, &inputErr):
			Error(c, http.StatusBadRequest, inputErr.Error())
		case errors.Is(err, service.ErrAIImageStorageUnavailable):
			Error(c, http.StatusServiceUnavailable, err.Error())
		case errors.Is(err, aimodel.ErrModelNotAvailable),
			strings.Contains(err.Error(), "AI 服务未配置"),
			strings.Contains(err.Error(), "不支持的 AI Provider"):
			respondCatalogModelError(c, err)
		default:
			ErrorWithDetail(c, http.StatusInternalServerError, "创建图片生成任务失败", err)
		}
		return
	}
	Success(c, gin.H{"generation": generation})
}

func ListAIImageGenerations(c *gin.Context) {
	userID, ok := currentAIAppUser(c)
	if !ok {
		return
	}
	reconcileStaleAIImageGenerations(userID)
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "24"))
	if limit < 1 {
		limit = 24
	}
	if limit > 50 {
		limit = 50
	}
	var generations []model.AIImageGeneration
	if err := database.GetDB().Where("user_id = ?", userID).Order("created_at DESC").Limit(limit).Find(&generations).Error; err != nil {
		ErrorWithDetail(c, http.StatusInternalServerError, "读取图片生成记录失败", err)
		return
	}
	Success(c, gin.H{"list": generations})
}

func GetAIImageGeneration(c *gin.Context) {
	userID, ok := currentAIAppUser(c)
	if !ok {
		return
	}
	reconcileStaleAIImageGenerations(userID)
	generation, found := findAIImageGeneration(c, userID)
	if !found {
		return
	}
	Success(c, gin.H{"generation": generation})
}

type updateAIImageGenerationFavoriteRequest struct {
	Favorited *bool `json:"favorited"`
}

func UpdateAIImageGenerationFavorite(c *gin.Context) {
	userID, ok := currentAIAppUser(c)
	if !ok {
		return
	}
	var payload updateAIImageGenerationFavoriteRequest
	if err := c.ShouldBindJSON(&payload); err != nil || payload.Favorited == nil {
		Error(c, http.StatusBadRequest, "收藏参数错误")
		return
	}
	generation, found := findAIImageGeneration(c, userID)
	if !found {
		return
	}
	if err := database.GetDB().Model(&generation).Update("is_favorited", *payload.Favorited).Error; err != nil {
		ErrorWithDetail(c, http.StatusInternalServerError, "更新图片收藏失败", err)
		return
	}
	generation.IsFavorited = *payload.Favorited
	Success(c, gin.H{"generation": generation})
}

func PauseAIImageGeneration(c *gin.Context) {
	userID, ok := currentAIAppUser(c)
	if !ok {
		return
	}
	generation, found := findAIImageGeneration(c, userID)
	if !found {
		return
	}
	if generation.Status != "queued" && generation.Status != "running" {
		Error(c, http.StatusConflict, "当前图片任务无法暂停")
		return
	}
	finished := time.Now()
	result := database.GetDB().Model(&model.AIImageGeneration{}).
		Where("id = ? AND user_id = ? AND status IN ?", generation.ID, userID, []string{"queued", "running"}).
		Updates(map[string]any{
			"status": "paused", "stage": "completed", "error_code": "GENERATION_PAUSED",
			"error_message": "已暂停生成", "finished_at": finished,
		})
	if result.Error != nil {
		ErrorWithDetail(c, http.StatusInternalServerError, "暂停图片生成失败", result.Error)
		return
	}
	if result.RowsAffected == 0 {
		Error(c, http.StatusConflict, "当前图片任务无法暂停")
		return
	}
	service.CancelAIImageGeneration(generation.ID)
	generation, found = findAIImageGeneration(c, userID)
	if !found {
		return
	}
	Success(c, gin.H{"generation": generation})
}

func DeleteAIImageGeneration(c *gin.Context) {
	userID, ok := currentAIAppUser(c)
	if !ok {
		return
	}
	generation, found := findAIImageGeneration(c, userID)
	if !found {
		return
	}
	if !isAIImageGenerationDeletable(generation.Status) {
		Error(c, http.StatusConflict, "图片正在生成，暂不能删除")
		return
	}
	if err := database.GetDB().Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&model.AIImageConversationMessage{}).
			Where("generation_id = ?", generation.ID).
			Update("generation_id", nil).Error; err != nil {
			return err
		}
		if err := tx.Model(&model.AIImageGeneration{}).
			Where("parent_generation_id = ?", generation.ID).
			Update("parent_generation_id", nil).Error; err != nil {
			return err
		}
		return tx.Delete(&generation).Error
	}); err != nil {
		ErrorWithDetail(c, http.StatusInternalServerError, "删除图片生成记录失败", err)
		return
	}
	deleteAIImageGenerationAssets(generation)
	Success(c, gin.H{"deleted": true})
}

func SaveAIImageGenerationResource(c *gin.Context) {
	userID, ok := currentAIAppUser(c)
	if !ok {
		return
	}
	generationID, valid := parsePositiveInt64(c.Param("generationId"))
	if !valid {
		Error(c, http.StatusBadRequest, "图片生成记录 ID 无效")
		return
	}
	var payload struct {
		Visibility string `json:"visibility"`
	}
	if c.Request.ContentLength != 0 && c.ShouldBindJSON(&payload) != nil {
		Error(c, http.StatusBadRequest, "资源保存参数错误")
		return
	}
	result, err := newAIImageResourceSaver().Save(c.Request.Context(), service.SaveAIImageGenerationResourceInput{
		UserID:       userID,
		GenerationID: model.Int64String(generationID),
		Visibility:   payload.Visibility,
	})
	if errors.Is(err, service.ErrAIImageGenerationNotFound) {
		Error(c, http.StatusNotFound, "图片生成记录不存在")
		return
	}
	if errors.Is(err, service.ErrAIImageGenerationNotReady) {
		Error(c, http.StatusConflict, "图片尚未生成完成")
		return
	}
	if errors.Is(err, service.ErrAIImageAlreadySaved) {
		Error(c, http.StatusConflict, "图片已经保存到资源库")
		return
	}
	if err != nil {
		if strings.Contains(err.Error(), "文件过大") {
			Error(c, http.StatusRequestEntityTooLarge, "生成图片文件过大，最大支持 30MB")
			return
		}
		if strings.Contains(err.Error(), "当前没有已验证的可用视觉模型") {
			Error(c, http.StatusServiceUnavailable, "当前没有已验证的可用视觉模型，无法自动识别图片标题和标签")
			return
		}
		if strings.Contains(err.Error(), "generate image metadata") {
			ErrorWithDetail(c, http.StatusBadGateway, "AI 自动识别图片标题和标签失败，请稍后重试", err)
			return
		}
		if strings.Contains(err.Error(), "fetch generated image") {
			ErrorWithDetail(c, http.StatusBadGateway, "读取历史图片失败，请稍后重试", err)
			return
		}
		ErrorWithDetail(c, http.StatusInternalServerError, "保存到资源库失败", err)
		return
	}
	if result.Resource.Visibility == "public" {
		invalidatePublicResourceListCache()
	}
	Success(c, gin.H{"resource": result.Resource, "metadataModel": result.MetadataModel})
}

// GetAIImageGenerationImageData proxies an owned generated image as a data URL.
// Generated-image providers frequently omit browser CORS headers, while the
// resource metadata flow needs a browser-readable image input for vision APIs.
func GetAIImageGenerationImageData(c *gin.Context) {
	userID, ok := currentAIAppUser(c)
	if !ok {
		return
	}
	generationID, valid := parsePositiveInt64(c.Param("generationId"))
	if !valid {
		Error(c, http.StatusBadRequest, "图片生成记录 ID 无效")
		return
	}
	var generation model.AIImageGeneration
	if err := database.GetDB().Where("id = ? AND user_id = ?", generationID, userID).First(&generation).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			Error(c, http.StatusNotFound, "图片生成记录不存在")
			return
		}
		ErrorWithDetail(c, http.StatusInternalServerError, "读取图片生成记录失败", err)
		return
	}
	if generation.Status != "succeeded" || generation.ResultURL == "" {
		Error(c, http.StatusConflict, "图片尚未生成完成")
		return
	}
	content, mimeType, err := fetchAIImageGenerationContent(c.Request.Context(), generation)
	if err != nil {
		ErrorWithDetail(c, http.StatusBadGateway, "读取历史图片失败，请稍后重试", err)
		return
	}
	Success(c, gin.H{"imageBase64": aiImageReferenceDataURL(content, mimeType)})
}

func normalizeAIImageResourceVisibility(value string) string {
	if strings.EqualFold(strings.TrimSpace(value), "public") {
		return "public"
	}
	return "private"
}

func newAIImageResourceSaver() service.AIImageResourceSaver {
	return service.AIImageResourceSaver{
		DB:         database.GetDB(),
		FetchImage: fetchGeneratedAIImage,
		GenerateMetadata: func(ctx context.Context, generation model.AIImageGeneration, content []byte, mimeType, resourceType string) (service.AIImageResourceMetadata, error) {
			models, err := aimodel.ListEnabledModels(database.GetDB(), "vision")
			if err != nil {
				return service.AIImageResourceMetadata{}, err
			}
			if len(models) == 0 {
				return service.AIImageResourceMetadata{}, errors.New("当前没有已验证的可用视觉模型，无法自动识别图片标题和标签")
			}
			modelID := models[0].ID.String()
			invocation, err := aimodel.ResolveInvocation(database.GetDB(), modelID, "vision", 60*time.Second)
			if err != nil {
				return service.AIImageResourceMetadata{}, err
			}
			typeName := "壁纸"
			if resourceType == "avatar" {
				typeName = "头像"
			}
			prompt := fmt.Sprintf("看图后完成资源整理。先为这张%s生成一个准确自然的中文标题（不超过20字），再生成5到8个中文标签（每个不超过6字）。标题必须反映画面的主体、场景或可识别角色；标签覆盖主题、风格、色彩或画面元素。严格只输出 JSON：{\"title\":\"...\",\"tags\":[\"...\"]}。", typeName)
			imageURL := aiImageReferenceDataURL(content, mimeType)
			response, err := invocation.Client.Chat(ctx, aiclient.CompatibleChatRequest{Model: invocation.Model.ModelID, Messages: []aiclient.CompatibleMessage{{
				Role: "user",
				Content: []map[string]any{
					{"type": "image_url", "image_url": map[string]string{"url": imageURL}},
					{"type": "text", "text": prompt},
				},
			}}})
			if err != nil {
				return service.AIImageResourceMetadata{}, err
			}
			if len(response.Choices) == 0 {
				return service.AIImageResourceMetadata{}, errors.New("视觉模型未返回识别结果")
			}
			raw := compatibleMessageText(response.Choices[0].Message.Content)
			var parsed struct {
				Title string   `json:"title"`
				Tags  []string `json:"tags"`
			}
			if err := json.Unmarshal([]byte(aiclient.ExtractJSONObject(raw)), &parsed); err != nil {
				return service.AIImageResourceMetadata{}, errors.New("视觉模型未返回有效的标题和标签")
			}
			title := strings.TrimSpace(parsed.Title)
			tags := normalizeResourceTagNames(parsed.Tags)
			if title == "" || len(tags) == 0 {
				return service.AIImageResourceMetadata{}, errors.New("视觉模型未返回有效的标题和标签")
			}
			return service.AIImageResourceMetadata{
				Title: title,
				Tags:  tags,
				Model: modelNameOrFallback(response.Model, invocation.Model.ModelID),
			}, nil
		},
	}
}

func isAIImageGenerationDeletable(status string) bool {
	return status != "queued" && status != "running"
}

func deleteAIImageGenerationAssets(generation model.AIImageGeneration) {
	uploader := service.NewUploadService()
	for _, key := range []string{generation.ResultStorageKey, generation.CanvasSnapshotStorageKey} {
		if key == "" {
			continue
		}
		if err := uploader.DeleteByKey(key); err != nil {
			log.Printf("[WARN] clean up AI image generation asset failed: id=%s key=%s err=%v", generation.ID.String(), key, err)
		}
	}
}

func validateAIImageGenerationRequest(
	payload createAIImageGenerationRequest,
	availableQualities []string,
) (aiImagePreset, string, []string, error) {
	preset, ok := findAIImagePreset(payload.effectiveRecipeID())
	if !ok {
		return aiImagePreset{}, "", nil, errors.New("请选择有效的创作类型")
	}
	prompt := payload.effectiveBrief()
	if prompt == "" {
		return aiImagePreset{}, "", nil, errors.New("请输入画面描述")
	}
	if utf8.RuneCountInString(prompt) > maxAIImagePromptRunes {
		return aiImagePreset{}, "", nil, fmt.Errorf("画面描述不能超过 %d 个字符", maxAIImagePromptRunes)
	}
	qualityMap, ok := aiImageSizes[payload.AspectRatio]
	if !ok {
		return aiImagePreset{}, "", nil, errors.New("请选择有效的画面比例")
	}
	size, ok := qualityMap[payload.Quality]
	if !ok {
		return aiImagePreset{}, "", nil, errors.New("请选择有效的目标分辨率")
	}
	if len(availableQualities) > 0 && !slices.Contains(availableQualities, payload.Quality) {
		return aiImagePreset{}, "", nil, errors.New("所选图片模型不支持该目标分辨率")
	}
	if len(payload.ReferenceRaw) > maxAIImageReferences {
		return aiImagePreset{}, "", nil, fmt.Errorf("最多支持 %d 张参考图", maxAIImageReferences)
	}
	references := make([]string, 0, len(payload.ReferenceRaw))
	for _, raw := range payload.ReferenceRaw {
		normalized, err := normalizeAIImageReference(raw)
		if err != nil {
			return aiImagePreset{}, "", nil, err
		}
		references = append(references, normalized)
	}
	if preset.RequiresReference && len(references) == 0 && strings.TrimSpace(payload.ReferenceGenerationID) == "" {
		return aiImagePreset{}, "", nil, errors.New("当前创作类型需要先绘制草图或添加参考素材")
	}
	return preset, size, references, nil
}

func selectAIImageQuickSamples(preset aiImagePreset, excluded []string, count int) []string {
	if count <= 0 {
		return nil
	}
	pool := append(append([]string(nil), preset.SamplePrompts...), preset.QuickSamplePrompts...)
	excludedSet := make(map[string]struct{}, len(excluded))
	for _, value := range excluded {
		excludedSet[normalizeAIImageQuickSamplePrompt(value)] = struct{}{}
	}
	result := make([]string, 0, count)
	selected := make(map[string]struct{}, count)
	appendCandidate := func(value string, blocked map[string]struct{}) {
		value = strings.TrimSpace(value)
		key := normalizeAIImageQuickSamplePrompt(value)
		if len(result) >= count || key == "" || utf8.RuneCountInString(value) > maxAIImagePromptRunes {
			return
		}
		if _, ok := blocked[key]; ok {
			return
		}
		if _, ok := selected[key]; ok {
			return
		}
		selected[key] = struct{}{}
		result = append(result, value)
	}
	for _, value := range pool {
		appendCandidate(value, excludedSet)
	}
	if len(result) == count {
		return result
	}

	// Once every curated prompt has been seen, only exclude the currently
	// displayed batch (sent first by the web client) so rotation can continue
	// without immediately returning the same three prompts.
	currentSet := make(map[string]struct{}, min(count, len(excluded)))
	for _, value := range excluded[:min(count, len(excluded))] {
		currentSet[normalizeAIImageQuickSamplePrompt(value)] = struct{}{}
	}
	for _, value := range pool {
		appendCandidate(value, currentSet)
	}
	return result
}

func normalizeAIImageQuickSamplePrompts(values []string, limit int) []string {
	result := make([]string, 0, min(len(values), limit))
	seen := make(map[string]struct{}, len(values))
	for _, value := range values {
		value = strings.TrimSpace(value)
		key := normalizeAIImageQuickSamplePrompt(value)
		if key == "" || utf8.RuneCountInString(value) > maxAIImagePromptRunes {
			continue
		}
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}
		result = append(result, value)
		if len(result) == limit {
			break
		}
	}
	return result
}

func normalizeAIImageQuickSamplePrompt(value string) string {
	return strings.Join(strings.Fields(strings.TrimSpace(value)), " ")
}

func normalizeAIImageReference(raw string) (string, error) {
	raw = strings.TrimSpace(raw)
	header, encoded, ok := strings.Cut(raw, ",")
	if !ok || !strings.HasPrefix(header, "data:image/") || !strings.HasSuffix(strings.ToLower(header), ";base64") {
		return "", errors.New("参考图必须是 JPG、PNG 或 WebP")
	}
	mimeType := strings.TrimSuffix(strings.TrimPrefix(strings.ToLower(header), "data:"), ";base64")
	switch mimeType {
	case "image/jpeg", "image/png", "image/webp":
	default:
		return "", errors.New("参考图必须是 JPG、PNG 或 WebP")
	}
	content, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil || len(content) == 0 {
		return "", errors.New("参考图内容无效")
	}
	if len(content) > maxAIImageReferenceBytes {
		return "", errors.New("单张参考图不能超过 5MB")
	}
	if detected := http.DetectContentType(content); detected != mimeType {
		return "", errors.New("参考图格式与内容不一致")
	}
	return "data:" + mimeType + ";base64," + base64.StdEncoding.EncodeToString(content), nil
}

func aiImageReferenceDataURL(content []byte, mimeType string) string {
	return "data:" + mimeType + ";base64," + base64.StdEncoding.EncodeToString(content)
}

func buildAIImagePrompt(preset aiImagePreset, userPrompt string, hasReference bool) string {
	return service.CompileAIImagePrompt(service.AIImageGenerationPlan{
		Recipe: preset,
		Brief:  userPrompt,
	}, hasReference)
}

func summarizeAIImageError(cause error) string {
	return service.SummarizeAIImageError(cause)
}

func fetchGeneratedAIImage(ctx context.Context, source string) ([]byte, string, error) {
	return service.FetchAIImageSource(ctx, source)
}

// fetchAIImageGenerationContent keeps history usable across the OSS -> TOS
// migration. Older rows can still point at the legacy OSS URL while carrying
// the original storage key; newer rows use the current TOS URL directly.
// When the legacy object is still readable, re-home a copy to TOS and repair
// the row so subsequent browser requests no longer depend on the old domain.
func fetchAIImageGenerationContent(ctx context.Context, generation model.AIImageGeneration) ([]byte, string, error) {
	legacyURL := strings.TrimSpace(generation.ResultURL)
	candidates := make([]string, 0, 2)
	if generation.ResultStorageKey != "" {
		if uploader := utils.GetTOSUploader(); uploader != nil {
			candidates = append(candidates, uploader.GetPublicURL(generation.ResultStorageKey))
		}
	}
	if legacyURL != "" {
		candidates = append(candidates, legacyURL)
	}

	var lastErr error
	seen := make(map[string]struct{}, len(candidates))
	for _, source := range candidates {
		if source == "" {
			continue
		}
		if _, exists := seen[source]; exists {
			continue
		}
		seen[source] = struct{}{}
		content, mimeType, err := fetchGeneratedAIImage(ctx, source)
		if err != nil {
			lastErr = err
			continue
		}

		if source != legacyURL {
			repairAIImageGenerationURL(generation, source)
		} else if !isCurrentAIImageStorageURL(source) {
			if repairedURL := rehomeAIImageGeneration(ctx, generation, content, mimeType); repairedURL != "" {
				source = repairedURL
			}
		}
		return content, mimeType, nil
	}
	if lastErr == nil {
		lastErr = errors.New("AI 鍥剧墖鍦板潃涓虹┖")
	}
	return nil, "", lastErr
}

func isCurrentAIImageStorageURL(source string) bool {
	uploader := utils.GetTOSUploader()
	if uploader == nil {
		return false
	}
	return strings.HasPrefix(strings.TrimSpace(source), uploader.GetPublicURL(""))
}

func repairAIImageGenerationURL(generation model.AIImageGeneration, source string) {
	if source == "" || source == generation.ResultURL {
		return
	}
	_ = database.GetDB().Model(&model.AIImageGeneration{}).
		Where("id = ? AND user_id = ? AND result_url = ?", generation.ID, generation.UserID, generation.ResultURL).
		Updates(map[string]any{"result_url": source}).Error
}

func rehomeAIImageGeneration(ctx context.Context, generation model.AIImageGeneration, content []byte, mimeType string) string {
	uploader := service.NewUploadService()
	config := service.GetDefaultConfig(service.UploadTypeWallpaper)
	config.UserID = int64(generation.UserID)
	config.CustomFolder = fmt.Sprintf("ai-images/%s/%s", generation.UserID.String(), time.Now().Format("20060102"))
	stored, err := uploader.UploadBytesWithContext(ctx, "recovered"+service.AIImageExtension(mimeType), content, config)
	if err != nil {
		log.Printf("[WARN] recover AI image generation asset failed: id=%s err=%v", generation.ID.String(), err)
		return ""
	}
	if err := database.GetDB().Model(&model.AIImageGeneration{}).
		Where("id = ? AND user_id = ? AND result_url = ?", generation.ID, generation.UserID, generation.ResultURL).
		Updates(map[string]any{
			"result_url": stored.URL, "result_storage_key": stored.Key, "result_size": stored.Size,
		}).Error; err != nil {
		log.Printf("[WARN] repair AI image generation record failed: id=%s err=%v", generation.ID.String(), err)
	}
	return stored.URL
}

func generatedAIImageDimensions(content []byte, mimeType string) (int, int, error) {
	return service.GeneratedAIImageDimensions(content, mimeType)
}

func reconcileStaleAIImageGenerations(userID model.Int64String) {
	cutoff := time.Now().Add(-10 * time.Minute)
	finished := time.Now()
	_ = database.GetDB().Model(&model.AIImageGeneration{}).
		Where("user_id = ? AND status IN ? AND updated_at < ?", userID, []string{"queued", "running"}, cutoff).
		Updates(map[string]any{
			"status": "failed", "stage": "completed", "error_code": "GENERATION_INTERRUPTED",
			"error_message": "生成任务已中断，请重新生成", "finished_at": finished,
		}).Error
}

func findAIImageGeneration(c *gin.Context, userID model.Int64String) (model.AIImageGeneration, bool) {
	generationID, ok := parsePositiveInt64(c.Param("generationId"))
	if !ok {
		Error(c, http.StatusBadRequest, "图片生成记录 ID 无效")
		return model.AIImageGeneration{}, false
	}
	var generation model.AIImageGeneration
	if err := database.GetDB().Where("id = ? AND user_id = ?", generationID, userID).First(&generation).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			Error(c, http.StatusNotFound, "图片生成记录不存在")
		} else {
			ErrorWithDetail(c, http.StatusInternalServerError, "读取图片生成记录失败", err)
		}
		return model.AIImageGeneration{}, false
	}
	return generation, true
}

func findAIImagePreset(id string) (aiImagePreset, bool) {
	for _, preset := range aiImagePresets {
		if preset.ID == strings.TrimSpace(id) {
			return preset, true
		}
	}
	return aiImagePreset{}, false
}

func parsePositiveInt64(raw string) (int64, bool) {
	value, err := strconv.ParseInt(strings.TrimSpace(raw), 10, 64)
	return value, err == nil && value > 0
}

func aiImageResourceTitle(prompt string) string {
	prompt = strings.Join(strings.Fields(prompt), " ")
	if utf8.RuneCountInString(prompt) <= 40 {
		return prompt
	}
	return string([]rune(prompt)[:40])
}
