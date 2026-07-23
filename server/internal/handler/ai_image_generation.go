package handler

import (
	"bytes"
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"image"
	_ "image/jpeg"
	_ "image/png"
	"io"
	"log"
	"net/http"
	"net/url"
	"slices"
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
	PromptContent     string `json:"promptContent"`
	RequiresReference bool   `json:"requiresReference"`
	RecommendedAspect string `json:"recommendedAspect"`
}

var aiImagePresets = []aiImagePreset{
	{ID: "free", Name: "自由创作", Description: "根据描述生成完整画面", PromptContent: "根据用户的画面描述，生成一张完整、精致且风格统一的图片。", RecommendedAspect: "1:1"},
	{ID: "sketch", Name: "草图成图", Description: "保留构图，把线稿发展成完整画面", PromptContent: "将参考草图发展为完整画面。保留主要构图、主体位置和姿态，同时补充连贯的材质、光线和细节。", RequiresReference: true, RecommendedAspect: "4:3"},
	{ID: "cover", Name: "文章封面", Description: "生成清晰、克制的主题封面", PromptContent: "生成一张清晰克制的主题封面，保留一个明确视觉焦点、均衡的留白，并且不要出现可见文字。", RecommendedAspect: "16:9"},
	{ID: "product", Name: "产品展示", Description: "生成干净的产品视觉图", PromptContent: "生成一张高品质的产品展示图，准确呈现主体形态，使用克制的棚拍光线与干净构图，不要添加额外产品。", RecommendedAspect: "4:3"},
	{ID: "avatar", Name: "角色头像", Description: "生成单角色方形头像", PromptContent: "生成一张适合头像使用的方形图片，只呈现一个清晰角色，使用简洁背景并保持容易辨识的轮廓。", RecommendedAspect: "1:1"},
	{ID: "felt", Name: "毛毡玩具", Description: "转成柔软的手作毛毡质感", PromptContent: "将主体渲染为手作毛毡玩具场景，呈现柔软纤维、圆润形体、细微缝线和温暖棚拍光线。", RecommendedAspect: "1:1"},
}

var aiImageSizes = map[string]map[string]string{
	"1:1":  {"1K": "1024x1024", "2K": "2048x2048", "3K": "3072x3072", "4K": "4096x4096"},
	"4:3":  {"1K": "1024x768", "2K": "2048x1536", "3K": "3072x2304", "4K": "4096x3072"},
	"3:4":  {"1K": "768x1024", "2K": "1536x2048", "3K": "2304x3072", "4K": "3072x4096"},
	"16:9": {"1K": "1280x720", "2K": "2048x1152", "3K": "3072x1728", "4K": "4096x2304"},
	"9:16": {"1K": "720x1280", "2K": "1152x2048", "3K": "1728x3072", "4K": "2304x4096"},
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
		"sizes":        aiImageSizes,
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
	invocation, err := aimodel.ResolveInvocation(database.GetDB(), payload.ModelID, "image_generation", aiImageGenerationTimeout)
	if err != nil {
		respondCatalogModelError(c, err)
		return
	}
	preset, size, references, err := validateAIImageGenerationRequest(
		payload,
		aimodel.ImageGenerationQualities(invocation.Model),
	)
	if err != nil {
		Error(c, http.StatusBadRequest, err.Error())
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
	canvasSnapshot, err := storeAIImageCanvasSnapshot(c.Request.Context(), userID, references)
	if err != nil {
		ErrorWithDetail(c, http.StatusInternalServerError, "画布快照保存失败，请稍后重试", err)
		return
	}

	prompt := buildAIImagePrompt(preset, payload.Prompt, len(references) > 0)
	generation := model.AIImageGeneration{
		UserID:                   userID,
		ModelCatalogID:           invocation.Model.ID,
		Provider:                 invocation.Provider.Provider,
		Model:                    invocation.Model.ModelID,
		PresetID:                 preset.ID,
		PresetName:               preset.Name,
		PresetPrompt:             preset.PromptContent,
		Prompt:                   strings.TrimSpace(payload.Prompt),
		AspectRatio:              payload.AspectRatio,
		Quality:                  payload.Quality,
		RequestedSize:            size,
		ReferenceCount:           len(references),
		CanvasSnapshotURL:        canvasSnapshot.URL,
		CanvasSnapshotStorageKey: canvasSnapshot.StorageKey,
		CanvasSnapshotWidth:      canvasSnapshot.Width,
		CanvasSnapshotHeight:     canvasSnapshot.Height,
		Status:                   "queued",
		Stage:                    "preparing",
	}
	if err := database.GetDB().Create(&generation).Error; err != nil {
		deleteAIImageCanvasSnapshot(canvasSnapshot)
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

	if utils.GetTOSUploader() == nil {
		Error(c, http.StatusServiceUnavailable, "图片存储服务未配置")
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
	if generation.ResourceID != nil && *generation.ResourceID != 0 {
		Error(c, http.StatusConflict, "图片已经保存到资源库")
		return
	}

	content, mimeType, err := fetchGeneratedAIImage(c.Request.Context(), generation.ResultURL)
	if err != nil {
		ErrorWithDetail(c, http.StatusBadGateway, "读取历史图片失败，请稍后重试", err)
		return
	}
	uploadConfig := service.GetDefaultConfig(service.UploadType(payload.Type))
	uploadConfig.UserID = int64(userID)
	stored, err := service.NewUploadService().UploadBytesWithContext(
		c.Request.Context(),
		"saved-ai-image"+aiImageExtension(mimeType),
		content,
		uploadConfig,
	)
	if err != nil {
		ErrorWithDetail(c, http.StatusInternalServerError, "保存到资源库失败", err)
		return
	}

	var saved model.Resource
	err = database.GetDB().Transaction(func(tx *gorm.DB) error {
		var locked model.AIImageGeneration
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("id = ? AND user_id = ?", generationID, userID).
			First(&locked).Error; err != nil {
			return err
		}
		if locked.Status != "succeeded" || locked.ResultURL == "" {
			return errAIImageNotReady
		}
		if locked.ResourceID != nil && *locked.ResourceID != 0 {
			return errAIImageAlreadySaved
		}
		title := strings.TrimSpace(payload.Title)
		if title == "" {
			title = aiImageResourceTitle(locked.Prompt)
		}
		title = truncateRunes(title, 100)
		saved = model.Resource{
			UserID:      userID,
			Type:        payload.Type,
			Visibility:  "private",
			Title:       title,
			Description: "AI 图片创作",
			URL:         stored.URL,
			StorageKey:  stored.Key,
			Width:       locked.ResultWidth,
			Height:      locked.ResultHeight,
			Size:        stored.Size,
			Extension:   strings.TrimPrefix(stored.Ext, "."),
			Tags:        model.StringList{},
		}
		if err := tx.Create(&saved).Error; err != nil {
			return err
		}
		return tx.Model(&locked).Update("resource_id", saved.ID).Error
	})
	if err != nil {
		_ = service.NewUploadService().DeleteByKey(stored.Key)
	}
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

type aiImageCanvasSnapshot struct {
	URL        string
	StorageKey string
	Width      int
	Height     int
}

func storeAIImageCanvasSnapshot(
	ctx context.Context,
	userID model.Int64String,
	references []string,
) (aiImageCanvasSnapshot, error) {
	if len(references) == 0 {
		return aiImageCanvasSnapshot{}, nil
	}
	content, mimeType, err := aiclient.DecodeImageDataURL(references[0], maxAIImageReferenceBytes)
	if err != nil {
		return aiImageCanvasSnapshot{}, err
	}
	width, height, err := generatedAIImageDimensions(content, mimeType)
	if err != nil {
		return aiImageCanvasSnapshot{}, err
	}
	uploadConfig := service.GetDefaultConfig(service.UploadTypeWallpaper)
	uploadConfig.UserID = int64(userID)
	uploadConfig.CustomFolder = fmt.Sprintf("ai-image-snapshots/%s/%s", userID.String(), time.Now().Format("20060102"))
	stored, err := service.NewUploadService().UploadBytesWithContext(
		ctx,
		"canvas"+aiImageExtension(mimeType),
		content,
		uploadConfig,
	)
	if err != nil {
		return aiImageCanvasSnapshot{}, err
	}
	return aiImageCanvasSnapshot{
		URL: stored.URL, StorageKey: stored.Key, Width: width, Height: height,
	}, nil
}

func deleteAIImageCanvasSnapshot(snapshot aiImageCanvasSnapshot) {
	if snapshot.StorageKey == "" {
		return
	}
	if err := service.NewUploadService().DeleteByKey(snapshot.StorageKey); err != nil {
		log.Printf("[WARN] clean up AI image canvas snapshot failed: key=%s err=%v", snapshot.StorageKey, err)
	}
}

var (
	errAIImageNotReady     = errors.New("AI image generation is not ready")
	errAIImageAlreadySaved = errors.New("AI image generation is already saved")
)

func validateAIImageGenerationRequest(
	payload createAIImageGenerationRequest,
	availableQualities []string,
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
		return aiImagePreset{}, "", nil, errors.New("请选择有效的目标分辨率")
	}
	if !slices.Contains(availableQualities, payload.Quality) {
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
		preset.PromptContent,
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
	resultWidth, resultHeight, dimensionErr := generatedAIImageDimensions(content, mimeType)
	if dimensionErr != nil {
		log.Printf(
			"[WARN] AI image dimensions unavailable; preserving valid result: id=%s err=%v",
			generation.ID.String(),
			dimensionErr,
		)
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
		"result_storage_key": stored.Key, "result_width": resultWidth, "result_height": resultHeight,
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

func generatedAIImageDimensions(content []byte, mimeType string) (int, int, error) {
	if mimeType == "image/webp" {
		return webPImageDimensions(content)
	}
	config, _, err := image.DecodeConfig(bytes.NewReader(content))
	if err != nil || config.Width <= 0 || config.Height <= 0 {
		return 0, 0, errors.New("无法读取 AI 返回图片的像素尺寸")
	}
	return config.Width, config.Height, nil
}

func webPImageDimensions(content []byte) (int, int, error) {
	if len(content) < 20 || string(content[:4]) != "RIFF" || string(content[8:12]) != "WEBP" {
		return 0, 0, errors.New("无法读取 AI 返回图片的像素尺寸")
	}
	for offset := 12; offset+8 <= len(content); {
		chunkType := string(content[offset : offset+4])
		chunkSize := int(content[offset+4]) |
			int(content[offset+5])<<8 |
			int(content[offset+6])<<16 |
			int(content[offset+7])<<24
		dataOffset := offset + 8
		if chunkSize < 0 || chunkSize > len(content)-dataOffset {
			return 0, 0, errors.New("无法读取 AI 返回图片的像素尺寸")
		}
		chunk := content[dataOffset : dataOffset+chunkSize]
		width, height, ok := webPChunkDimensions(chunkType, chunk)
		if ok {
			return width, height, nil
		}
		offset = dataOffset + chunkSize
		if chunkSize%2 != 0 {
			offset++
		}
	}
	return 0, 0, errors.New("无法读取 AI 返回图片的像素尺寸")
}

func webPChunkDimensions(chunkType string, chunk []byte) (int, int, bool) {
	switch chunkType {
	case "VP8X":
		if len(chunk) < 10 {
			return 0, 0, false
		}
		width := 1 + int(chunk[4]) + int(chunk[5])<<8 + int(chunk[6])<<16
		height := 1 + int(chunk[7]) + int(chunk[8])<<8 + int(chunk[9])<<16
		return width, height, true
	case "VP8 ":
		if len(chunk) < 10 || chunk[3] != 0x9d || chunk[4] != 0x01 || chunk[5] != 0x2a {
			return 0, 0, false
		}
		width := int(chunk[6]) + int(chunk[7]&0x3f)<<8
		height := int(chunk[8]) + int(chunk[9]&0x3f)<<8
		return width, height, width > 0 && height > 0
	case "VP8L":
		if len(chunk) < 5 || chunk[0] != 0x2f {
			return 0, 0, false
		}
		bits := uint32(chunk[1]) | uint32(chunk[2])<<8 | uint32(chunk[3])<<16 | uint32(chunk[4])<<24
		width := 1 + int(bits&0x3fff)
		height := 1 + int((bits>>14)&0x3fff)
		return width, height, true
	default:
		return 0, 0, false
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
