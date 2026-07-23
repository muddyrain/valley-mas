package handler

import (
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"path/filepath"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"
	"valley-server/internal/aiclient"
	"valley-server/internal/aimodel"
	"valley-server/internal/aiusage"
	"valley-server/internal/database"
	"valley-server/internal/model"
	"valley-server/internal/service"
	"valley-server/internal/utils"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const (
	aiImageGenerationTimeout = 240 * time.Second
	maxAIImagePromptRunes    = 2000
	maxAIImageReferences     = 3
	maxAIImageReferenceBytes = 5 << 20
	maxGeneratedImageBytes   = 30 << 20
)

type aiImagePreset struct {
	ID                string `json:"id"`
	Name              string `json:"name"`
	Description       string `json:"description"`
	PromptPrefix      string `json:"-"`
	RequiresReference bool   `json:"requiresReference"`
	RecommendedAspect string `json:"recommendedAspect"`
}

var aiImagePresets = []aiImagePreset{
	{ID: "free", Name: "自由创作", Description: "根据描述生成完整画面", PromptPrefix: "Create one polished, coherent image from the user's visual brief.", RecommendedAspect: "1:1"},
	{ID: "sketch", Name: "草图成图", Description: "保留构图，把线稿发展成完整画面", PromptPrefix: "Transform the reference sketch into a finished image. Preserve its main composition, subject placement and pose while adding coherent materials, lighting and detail.", RequiresReference: true, RecommendedAspect: "4:3"},
	{ID: "cover", Name: "文章封面", Description: "生成清晰、克制的主题封面", PromptPrefix: "Create a strong editorial cover image with one clear focal point, balanced negative space and no visible text.", RecommendedAspect: "16:9"},
	{ID: "product", Name: "产品展示", Description: "生成干净的产品视觉图", PromptPrefix: "Create a premium product presentation with accurate subject shape, controlled studio lighting, clean composition and no extra products.", RecommendedAspect: "4:3"},
	{ID: "avatar", Name: "角色头像", Description: "生成单角色方形头像", PromptPrefix: "Create a square, avatar-ready image with exactly one clear character, a simple background and a readable silhouette.", RecommendedAspect: "1:1"},
	{ID: "felt", Name: "毛毡玩具", Description: "转成柔软的手作毛毡质感", PromptPrefix: "Render the subject as a handcrafted felt toy scene with soft fibers, rounded forms, subtle stitching and warm studio lighting.", RecommendedAspect: "1:1"},
}

var aiImageSizes = map[string]map[string]string{
	"1:1":  {"1K": "1024x1024", "2K": "2048x2048"},
	"4:3":  {"1K": "1024x768", "2K": "2048x1536"},
	"3:4":  {"1K": "768x1024", "2K": "1536x2048"},
	"16:9": {"1K": "1280x720", "2K": "2048x1152"},
	"9:16": {"1K": "720x1280", "2K": "1152x2048"},
}

type createAIImageGenerationRequest struct {
	ModelID      string   `json:"modelId"`
	PresetID     string   `json:"presetId"`
	Prompt       string   `json:"prompt"`
	AspectRatio  string   `json:"aspectRatio"`
	Quality      string   `json:"quality"`
	ReferenceRaw []string `json:"references"`
}

func ListAIImagePresets(c *gin.Context) {
	Success(c, gin.H{
		"presets":      aiImagePresets,
		"aspectRatios": []string{"1:1", "4:3", "3:4", "16:9", "9:16"},
		"qualities":    []string{"1K", "2K"},
	})
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
	preset, size, references, err := validateAIImageGenerationRequest(payload)
	if err != nil {
		Error(c, http.StatusBadRequest, err.Error())
		return
	}
	invocation, err := aimodel.ResolveInvocation(database.GetDB(), payload.ModelID, "image_generation", aiImageGenerationTimeout)
	if err != nil {
		respondCatalogModelError(c, err)
		return
	}
	if len(references) > 0 {
		if !aimodel.HasCapabilities(invocation.Model, []string{"reference_image"}) {
			Error(c, http.StatusBadRequest, "所选图片模型不支持参考图")
			return
		}
	}
	if utils.GetTOSUploader() == nil {
		Error(c, http.StatusServiceUnavailable, "图片存储服务未配置")
		return
	}

	prompt := buildAIImagePrompt(preset, payload.Prompt, len(references) > 0)
	generation := model.AIImageGeneration{
		UserID:         userID,
		ModelCatalogID: invocation.Model.ID,
		Provider:       invocation.Provider.Provider,
		Model:          invocation.Model.ModelID,
		PresetID:       preset.ID,
		Prompt:         strings.TrimSpace(payload.Prompt),
		AspectRatio:    payload.AspectRatio,
		Quality:        payload.Quality,
		RequestedSize:  size,
		ReferenceCount: len(references),
		Status:         "queued",
		Stage:          "preparing",
	}
	if err := database.GetDB().Create(&generation).Error; err != nil {
		ErrorWithDetail(c, http.StatusInternalServerError, "创建图片生成任务失败", err)
		return
	}
	go executeAIImageGeneration(generation, invocation, prompt, references)
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
		Type  string `json:"type"`
		Title string `json:"title"`
	}
	if c.Request.ContentLength != 0 && c.ShouldBindJSON(&payload) != nil {
		Error(c, http.StatusBadRequest, "资源保存参数错误")
		return
	}
	if payload.Type == "" {
		payload.Type = "wallpaper"
	}
	if payload.Type != "wallpaper" && payload.Type != "avatar" {
		Error(c, http.StatusBadRequest, "资源类型仅支持壁纸或头像")
		return
	}

	var saved model.Resource
	err := database.GetDB().Transaction(func(tx *gorm.DB) error {
		var generation model.AIImageGeneration
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("id = ? AND user_id = ?", generationID, userID).
			First(&generation).Error; err != nil {
			return err
		}
		if generation.Status != "succeeded" || generation.ResultURL == "" {
			return errAIImageNotReady
		}
		if generation.ResourceID != nil && *generation.ResourceID != 0 {
			return errAIImageAlreadySaved
		}
		title := strings.TrimSpace(payload.Title)
		if title == "" {
			title = aiImageResourceTitle(generation.Prompt)
		}
		title = truncateRunes(title, 100)
		saved = model.Resource{
			UserID:      userID,
			Type:        payload.Type,
			Visibility:  "private",
			Title:       title,
			Description: "AI 图片创作",
			URL:         generation.ResultURL,
			StorageKey:  generation.ResultStorageKey,
			Width:       generation.ResultWidth,
			Height:      generation.ResultHeight,
			Size:        generation.ResultSize,
			Extension:   strings.TrimPrefix(filepath.Ext(generation.ResultStorageKey), "."),
			Tags:        model.StringList{},
		}
		if err := tx.Create(&saved).Error; err != nil {
			return err
		}
		return tx.Model(&generation).Update("resource_id", saved.ID).Error
	})
	if errors.Is(err, gorm.ErrRecordNotFound) {
		Error(c, http.StatusNotFound, "图片生成记录不存在")
		return
	}
	if errors.Is(err, errAIImageNotReady) {
		Error(c, http.StatusConflict, "图片尚未生成完成")
		return
	}
	if errors.Is(err, errAIImageAlreadySaved) {
		Error(c, http.StatusConflict, "图片已经保存到资源库")
		return
	}
	if err != nil {
		ErrorWithDetail(c, http.StatusInternalServerError, "保存到资源库失败", err)
		return
	}
	Success(c, gin.H{"resource": saved})
}

var (
	errAIImageNotReady     = errors.New("AI image generation is not ready")
	errAIImageAlreadySaved = errors.New("AI image generation is already saved")
)

func validateAIImageGenerationRequest(
	payload createAIImageGenerationRequest,
) (aiImagePreset, string, []string, error) {
	preset, ok := findAIImagePreset(payload.PresetID)
	if !ok {
		return aiImagePreset{}, "", nil, errors.New("请选择有效的提示词模板")
	}
	prompt := strings.TrimSpace(payload.Prompt)
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
		return aiImagePreset{}, "", nil, errors.New("请选择有效的清晰度")
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
	if preset.RequiresReference && len(references) == 0 {
		return aiImagePreset{}, "", nil, errors.New("当前模板需要先绘制草图或添加参考素材")
	}
	return preset, size, references, nil
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

func buildAIImagePrompt(preset aiImagePreset, userPrompt string, hasReference bool) string {
	referenceContract := ""
	if hasReference {
		referenceContract = "The attached canvas is the primary structural source of truth. Preserve its subject count, silhouette, pose, framing, spatial layout and relative proportions. Do not crop, reframe, replace or redesign the composition. Interpret the text and template only as appearance, material and rendering guidance. If any style-template instruction conflicts with the canvas structure, the canvas must win."
	}
	return fmt.Sprintf(
		"%s %s Follow this visual brief: %s. Produce exactly one image. Keep the composition coherent and intentional. Do not add a watermark, logo, border, interface chrome or unrequested visible text.",
		referenceContract,
		preset.PromptPrefix,
		strings.TrimSpace(userPrompt),
	)
}

func executeAIImageGeneration(
	generation model.AIImageGeneration,
	invocation aimodel.Invocation,
	prompt string,
	references []string,
) {
	started := time.Now()
	ctx, cancel := context.WithTimeout(context.Background(), aiImageGenerationTimeout)
	defer cancel()
	updateAIImageGeneration(generation.ID, map[string]any{
		"status": "running", "stage": "generating", "started_at": started,
	})
	generatedURL, err := invocation.Client.GenerateImageWithRequest(ctx, aiclient.ImageGenerationRequest{
		Provider: invocation.Provider.Provider,
		Protocol: invocation.Model.ImageProtocol,
		ModelID:  invocation.Model.ModelID,
		Prompt:   prompt,
		Size:     generation.RequestedSize,
		Images:   references,
	})
	if err != nil {
		failAIImageGeneration(generation, invocation, started, "IMAGE_GENERATION_FAILED", "图片生成失败，请稍后重试或切换模型", err)
		return
	}
	updateAIImageGeneration(generation.ID, map[string]any{"stage": "storing"})
	content, mimeType, err := fetchGeneratedAIImage(ctx, generatedURL)
	if err != nil {
		failAIImageGeneration(generation, invocation, started, "IMAGE_DOWNLOAD_FAILED", "生成图片读取失败，请稍后重试", err)
		return
	}
	uploadConfig := service.GetDefaultConfig(service.UploadTypeWallpaper)
	uploadConfig.UserID = int64(generation.UserID)
	uploadConfig.CustomFolder = fmt.Sprintf("ai-images/%s/%s", generation.UserID.String(), time.Now().Format("20060102"))
	stored, err := service.NewUploadService().UploadBytesWithContext(
		ctx,
		"generated"+aiImageExtension(mimeType),
		content,
		uploadConfig,
	)
	if err != nil {
		failAIImageGeneration(generation, invocation, started, "IMAGE_STORAGE_FAILED", "生成图片转存失败，请检查存储服务", err)
		return
	}
	finished := time.Now()
	updateAIImageGeneration(generation.ID, map[string]any{
		"status": "succeeded", "stage": "completed", "result_url": stored.URL,
		"result_storage_key": stored.Key, "result_width": stored.Width, "result_height": stored.Height,
		"result_size": stored.Size, "finished_at": finished, "error_code": "", "error_message": "",
	})
	aiusage.Record(aiusage.Entry{
		Feature: "ai-image-studio", Provider: invocation.Provider.Provider, Model: invocation.Model.ModelID,
		UserID: generation.UserID.String(), Status: aiusage.StatusSuccess, PromptChars: aiusage.CharCount(prompt),
		ResponseChars: aiusage.CharCount(stored.URL), LatencyMs: time.Since(started).Milliseconds(),
	})
}

func failAIImageGeneration(
	generation model.AIImageGeneration,
	invocation aimodel.Invocation,
	started time.Time,
	code string,
	message string,
	cause error,
) {
	finished := time.Now()
	safeCause := summarizeAIImageError(cause)
	updateAIImageGeneration(generation.ID, map[string]any{
		"status": "failed", "stage": "completed", "error_code": code,
		"error_message": message, "finished_at": finished,
	})
	aiusage.Record(aiusage.Entry{
		Feature: "ai-image-studio", Provider: invocation.Provider.Provider, Model: invocation.Model.ModelID,
		UserID: generation.UserID.String(), Status: aiusage.StatusFailed, PromptChars: aiusage.CharCount(generation.Prompt),
		LatencyMs: time.Since(started).Milliseconds(), ErrorMessage: safeCause,
	})
	log.Printf("[WARN] AI image generation failed: id=%s code=%s err=%s", generation.ID.String(), code, safeCause)
}

func summarizeAIImageError(cause error) string {
	if cause == nil {
		return ""
	}
	message := strings.TrimSpace(cause.Error())
	if index := strings.Index(strings.ToLower(message), "data:image/"); index >= 0 {
		message = strings.TrimSpace(message[:index]) + " [reference omitted]"
	}
	return truncateRunes(message, 500)
}

func fetchGeneratedAIImage(ctx context.Context, source string) ([]byte, string, error) {
	source = strings.TrimSpace(source)
	if strings.HasPrefix(source, "data:image/") {
		normalized, err := normalizeGeneratedAIImageDataURL(source)
		if err != nil {
			return nil, "", err
		}
		return normalized.content, normalized.mimeType, nil
	}
	parsed, err := url.Parse(source)
	if err != nil || parsed.Scheme != "https" || parsed.Host == "" {
		return nil, "", errors.New("AI 返回的图片地址无效")
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, parsed.String(), nil)
	if err != nil {
		return nil, "", err
	}
	response, err := (&http.Client{Timeout: 45 * time.Second}).Do(request)
	if err != nil {
		return nil, "", err
	}
	defer response.Body.Close()
	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		return nil, "", fmt.Errorf("图片下载返回 HTTP %d", response.StatusCode)
	}
	content, err := io.ReadAll(io.LimitReader(response.Body, maxGeneratedImageBytes+1))
	if err != nil || len(content) == 0 || len(content) > maxGeneratedImageBytes {
		return nil, "", errors.New("AI 返回的图片内容无效或过大")
	}
	mimeType := http.DetectContentType(content)
	if !supportedAIImageMIME(mimeType) {
		return nil, "", errors.New("AI 返回了不支持的图片格式")
	}
	return content, mimeType, nil
}

type generatedAIImageData struct {
	content  []byte
	mimeType string
}

func normalizeGeneratedAIImageDataURL(raw string) (generatedAIImageData, error) {
	header, encoded, ok := strings.Cut(raw, ",")
	if !ok || !strings.HasSuffix(strings.ToLower(header), ";base64") {
		return generatedAIImageData{}, errors.New("AI 返回的图片内容无效")
	}
	mimeType := strings.TrimSuffix(strings.TrimPrefix(strings.ToLower(header), "data:"), ";base64")
	content, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil || len(content) == 0 || len(content) > maxGeneratedImageBytes {
		return generatedAIImageData{}, errors.New("AI 返回的图片内容无效或过大")
	}
	if !supportedAIImageMIME(mimeType) || http.DetectContentType(content) != mimeType {
		return generatedAIImageData{}, errors.New("AI 返回了不支持的图片格式")
	}
	return generatedAIImageData{content: content, mimeType: mimeType}, nil
}

func supportedAIImageMIME(value string) bool {
	return value == "image/jpeg" || value == "image/png" || value == "image/webp"
}

func aiImageExtension(mimeType string) string {
	switch mimeType {
	case "image/jpeg":
		return ".jpg"
	case "image/webp":
		return ".webp"
	default:
		return ".png"
	}
}

func updateAIImageGeneration(id model.Int64String, values map[string]any) {
	if err := database.GetDB().Model(&model.AIImageGeneration{}).Where("id = ?", id).Updates(values).Error; err != nil {
		log.Printf("[WARN] update AI image generation failed: id=%s err=%v", id.String(), err)
	}
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
