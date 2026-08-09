package service

import (
	"bytes"
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"image"
	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"
	"io"
	"log"
	"net/http"
	"net/url"
	"slices"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"
	"unicode/utf8"
	"valley-server/internal/aiclient"
	"valley-server/internal/aimodel"
	"valley-server/internal/aiusage"
	"valley-server/internal/model"
	"valley-server/internal/utils"

	"gorm.io/gorm"
)

const (
	AIImageGenerationTimeout    = 240 * time.Second
	MinAIImageGenerationTimeout = time.Minute
	MaxAIImageGenerationTimeout = 10 * time.Minute
	MaxAIImagePromptRunes       = 48_000
	MaxAIImageReferences        = 3
	MaxAIImageReferenceBytes    = 5 << 20
	MaxGeneratedAIImageSizeMB   = 128
	MaxGeneratedAIImageBytes    = MaxGeneratedAIImageSizeMB << 20

	AIImageGenerationSourceStudio   = "studio"
	AIImageGenerationSourceWorkflow = "workflow"
	AIImageGenerationSourceAgent    = "agent"

	AIImageEditModeInpaint      = "inpaint"
	AIImageEditModeEraseReplace = "erase_replace"
	AIImageEditModeOutpaint     = "outpaint"
)

var AIImageSizes = map[string]map[string]string{
	"1:1":  {"1K": "1024x1024", "2K": "2048x2048", "3K": "3072x3072", "4K": "4096x4096"},
	"4:3":  {"1K": "1024x768", "2K": "2048x1536", "3K": "3072x2304", "4K": "4096x3072"},
	"3:4":  {"1K": "768x1024", "2K": "1536x2048", "3K": "2304x3072", "4K": "3072x4096"},
	"16:9": {"1K": "1280x720", "2K": "2048x1152", "3K": "3072x1728", "4K": "3840x2160"},
	"9:16": {"1K": "720x1280", "2K": "1152x2048", "3K": "1728x3072", "4K": "2304x4096"},
}

var seedream5TwoKSizes = map[string]string{
	"1:1":  "2048x2048",
	"4:3":  "2304x1728",
	"3:4":  "1728x2304",
	"16:9": "2560x1440",
	"9:16": "1440x2560",
}

func resolveAIImageRequestedSize(item model.AIModel, aspectRatio, quality string) string {
	size := AIImageSizes[strings.TrimSpace(aspectRatio)][strings.TrimSpace(quality)]
	if strings.TrimSpace(quality) != "2K" || aimodel.ImageGenerationMinimumPixels(item) == 0 {
		return size
	}
	if adjusted := seedream5TwoKSizes[strings.TrimSpace(aspectRatio)]; adjusted != "" {
		return adjusted
	}
	return size
}

var ErrAIImageStorageUnavailable = errors.New("图片存储服务未配置")

func aiImageGenerationTimeout(timeoutSeconds int) (time.Duration, error) {
	if timeoutSeconds == 0 {
		return AIImageGenerationTimeout, nil
	}
	if timeoutSeconds < int(MinAIImageGenerationTimeout/time.Second) || timeoutSeconds > int(MaxAIImageGenerationTimeout/time.Second) {
		return 0, &AIImageGenerationInputError{Message: "图片生成超时必须在 60 到 600 秒之间"}
	}
	return time.Duration(timeoutSeconds) * time.Second, nil
}

var activeAIImageGenerationCancels = struct {
	sync.Mutex
	items map[model.Int64String]context.CancelFunc
}{items: make(map[model.Int64String]context.CancelFunc)}

// CancelAIImageGeneration asks an active provider request to stop. Some image
// providers cannot resume an interrupted request, so callers must preserve the
// durable generation record as paused instead of treating it as a retry.
func CancelAIImageGeneration(id model.Int64String) bool {
	activeAIImageGenerationCancels.Lock()
	cancel, ok := activeAIImageGenerationCancels.items[id]
	activeAIImageGenerationCancels.Unlock()
	if ok {
		cancel()
	}
	return ok
}

func registerAIImageGenerationCancel(id model.Int64String, cancel context.CancelFunc) func() {
	activeAIImageGenerationCancels.Lock()
	activeAIImageGenerationCancels.items[id] = cancel
	activeAIImageGenerationCancels.Unlock()
	return func() {
		activeAIImageGenerationCancels.Lock()
		delete(activeAIImageGenerationCancels.items, id)
		activeAIImageGenerationCancels.Unlock()
	}
}

type AIImageGenerationInputError struct {
	Message string
}

func (e *AIImageGenerationInputError) Error() string {
	if e == nil {
		return ""
	}
	return e.Message
}

type AIImageGenerationInput struct {
	UserID                model.Int64String
	ModelID               string
	RecipeID              string
	StyleProfileID        string
	VariationMode         string
	Brief                 string
	SubjectContext        string
	AspectRatio           string
	Quality               string
	References            []string
	ReferenceGenerationID string
	EditMode              string
	EditImage             string
	EditMask              string
	Feature               string
	TimeoutSeconds        int
}

type aiImageGenerationJob struct {
	generation model.AIImageGeneration
	invocation aimodel.Invocation
	prompt     string
	references []string
	mask       string
	feature    string
}

type AIImageGenerationService struct {
	db                *gorm.DB
	resolve           func(*gorm.DB, string, string, time.Duration) (aimodel.Invocation, error)
	generate          func(context.Context, aimodel.Invocation, aiclient.ImageGenerationRequest) (string, error)
	fetch             func(context.Context, string) ([]byte, string, error)
	upload            func(context.Context, model.Int64String, string, string, []byte) (*UploadResult, error)
	deleteStored      func(string) error
	skillReferenceURL func(string) (string, error)
	storageAvailable  func() bool
	recordUsage       func(aiusage.Entry)
	now               func() time.Time
	enqueue           func(func())
}

func AIImageGenerationSourceForFeature(feature string) string {
	switch strings.TrimSpace(feature) {
	case "workflow-image-generation":
		return AIImageGenerationSourceWorkflow
	case "ai-agent-image-generation":
		return AIImageGenerationSourceAgent
	default:
		return AIImageGenerationSourceStudio
	}
}

func IsAIImageGenerationSource(source string) bool {
	switch strings.TrimSpace(source) {
	case AIImageGenerationSourceStudio, AIImageGenerationSourceWorkflow, AIImageGenerationSourceAgent:
		return true
	default:
		return false
	}
}

func NewAIImageGenerationService(db *gorm.DB) *AIImageGenerationService {
	uploader := NewUploadService()
	return &AIImageGenerationService{
		db:      db,
		resolve: aimodel.ResolveInvocation,
		generate: func(ctx context.Context, invocation aimodel.Invocation, request aiclient.ImageGenerationRequest) (string, error) {
			return invocation.Client.GenerateImageWithRequest(ctx, request)
		},
		fetch: FetchAIImageSource,
		upload: func(ctx context.Context, userID model.Int64String, folder, filename string, content []byte) (*UploadResult, error) {
			config := GetDefaultConfig(UploadTypeWallpaper)
			config.UserID = int64(userID)
			config.CustomFolder = folder
			return NewUploadService().UploadBytesWithContext(ctx, filename, content, config)
		},
		deleteStored:      uploader.DeleteByKey,
		skillReferenceURL: uploader.PublicURL,
		storageAvailable:  func() bool { return utils.GetTOSUploader() != nil },
		recordUsage:       aiusage.Record,
		now:               time.Now,
		enqueue:           func(run func()) { go run() },
	}
}

// Queue creates a durable owner-scoped generation and runs it asynchronously.
// Reference image bytes remain request-scoped and are never persisted.
func (s *AIImageGenerationService) Queue(ctx context.Context, input AIImageGenerationInput) (model.AIImageGeneration, error) {
	timeout, err := aiImageGenerationTimeout(input.TimeoutSeconds)
	if err != nil {
		return model.AIImageGeneration{}, err
	}
	job, err := s.prepare(ctx, input, timeout)
	if err != nil {
		return model.AIImageGeneration{}, err
	}
	s.enqueue(func() {
		runCtx, cancel := context.WithTimeout(context.Background(), timeout)
		defer cancel()
		unregister := registerAIImageGenerationCancel(job.generation.ID, cancel)
		defer unregister()
		_, _ = s.run(runCtx, job)
	})
	return job.generation, nil
}

// Generate uses the same durable execution path as Queue but waits for the
// final stored result, which is the behavior workflow nodes require.
func (s *AIImageGenerationService) Generate(ctx context.Context, input AIImageGenerationInput) (model.AIImageGeneration, error) {
	timeout, err := aiImageGenerationTimeout(input.TimeoutSeconds)
	if err != nil {
		return model.AIImageGeneration{}, err
	}
	runCtx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()
	job, err := s.prepare(runCtx, input, timeout)
	if err != nil {
		return model.AIImageGeneration{}, err
	}
	return s.run(runCtx, job)
}

func (s *AIImageGenerationService) prepare(ctx context.Context, input AIImageGenerationInput, timeout time.Duration) (aiImageGenerationJob, error) {
	if s == nil || s.db == nil {
		return aiImageGenerationJob{}, errors.New("图片生成服务未配置")
	}
	if input.UserID <= 0 {
		return aiImageGenerationJob{}, &AIImageGenerationInputError{Message: "用户 ID 无效"}
	}
	brief := strings.TrimSpace(input.Brief)
	subjectContext := strings.TrimSpace(input.SubjectContext)
	if brief == "" && subjectContext == "" {
		return aiImageGenerationJob{}, &AIImageGenerationInputError{Message: "请输入画面描述"}
	}
	if utf8.RuneCountInString(brief) > MaxAIImagePromptRunes {
		return aiImageGenerationJob{}, &AIImageGenerationInputError{
			Message: fmt.Sprintf("画面描述不能超过 %d 个字符", MaxAIImagePromptRunes),
		}
	}
	if utf8.RuneCountInString(subjectContext) > MaxAIImagePromptRunes {
		return aiImageGenerationJob{}, &AIImageGenerationInputError{
			Message: fmt.Sprintf("主题上下文不能超过 %d 个字符", MaxAIImagePromptRunes),
		}
	}
	if utf8.RuneCountInString(brief)+utf8.RuneCountInString(subjectContext) > MaxAIImagePromptRunes {
		return aiImageGenerationJob{}, &AIImageGenerationInputError{
			Message: fmt.Sprintf("画面描述与主题上下文合计不能超过 %d 个字符", MaxAIImagePromptRunes),
		}
	}
	qualityMap, ok := AIImageSizes[strings.TrimSpace(input.AspectRatio)]
	if !ok {
		return aiImageGenerationJob{}, &AIImageGenerationInputError{Message: "请选择有效的画面比例"}
	}
	quality := strings.TrimSpace(input.Quality)
	size, ok := qualityMap[quality]
	if !ok {
		return aiImageGenerationJob{}, &AIImageGenerationInputError{Message: "请选择有效的目标分辨率"}
	}
	invocation, err := s.resolve(s.db, strings.TrimSpace(input.ModelID), "image_generation", timeout)
	if err != nil {
		return aiImageGenerationJob{}, err
	}
	size = resolveAIImageRequestedSize(invocation.Model, input.AspectRatio, quality)
	if !slices.Contains(aimodel.ImageGenerationQualities(invocation.Model), quality) {
		return aiImageGenerationJob{}, &AIImageGenerationInputError{Message: "所选图片模型不支持该目标分辨率"}
	}
	if !s.storageAvailable() {
		return aiImageGenerationJob{}, ErrAIImageStorageUnavailable
	}
	editMode := strings.TrimSpace(input.EditMode)
	if editMode != "" && !IsAIImageEditMode(editMode) {
		return aiImageGenerationJob{}, &AIImageGenerationInputError{Message: "图片编辑方式无效"}
	}

	references, err := s.resolveReferences(ctx, input)
	if err != nil {
		return aiImageGenerationJob{}, err
	}
	editMask := ""
	if editMode != "" {
		if !aimodel.HasCapabilities(invocation.Model, []string{"masked_edit"}) ||
			!aimodel.HasVerifiedCapabilities(invocation.Model, []string{"masked_edit"}) {
			return aiImageGenerationJob{}, &AIImageGenerationInputError{Message: "所选图片模型尚未验证蒙版编辑能力"}
		}
		if editMode == AIImageEditModeOutpaint &&
			(!aimodel.HasCapabilities(invocation.Model, []string{"outpainting"}) ||
				!aimodel.HasVerifiedCapabilities(invocation.Model, []string{"outpainting"})) {
			return aiImageGenerationJob{}, &AIImageGenerationInputError{Message: "所选图片模型尚未验证扩图能力"}
		}
		if len(references) != 1 {
			return aiImageGenerationJob{}, &AIImageGenerationInputError{Message: "局部编辑需要一张编辑画布"}
		}
		editMask, err = s.resolveEditMask(ctx, input.EditMask, references[0])
		if err != nil {
			return aiImageGenerationJob{}, err
		}
	}
	// A selected skill can carry durable visual references. They are resolved
	// server-side after ownership validation, so a browser never has to receive
	// the storage URL or manufacture an untrusted data URL.
	remainingReferences := MaxAIImageReferences - len(references)
	if editMode != "" {
		remainingReferences = 0
	}
	skillReferences, err := s.resolveSkillReferenceImages(ctx, input.UserID, input.StyleProfileID, remainingReferences)
	if err != nil {
		return aiImageGenerationJob{}, err
	}
	references = append(references, skillReferences...)
	var parentGenerationID *model.Int64String
	if rawParentID := strings.TrimSpace(input.ReferenceGenerationID); rawParentID != "" {
		parsedParentID, parseErr := strconv.ParseInt(rawParentID, 10, 64)
		if parseErr != nil || parsedParentID <= 0 {
			return aiImageGenerationJob{}, &AIImageGenerationInputError{Message: "参考图片记录 ID 无效"}
		}
		parentID := model.Int64String(parsedParentID)
		parentGenerationID = &parentID
	}
	if len(references) > 0 {
		if !aimodel.HasCapabilities(invocation.Model, []string{"reference_image"}) {
			return aiImageGenerationJob{}, &AIImageGenerationInputError{Message: "所选图片模型不支持参考图"}
		}
		if !slices.Contains(aimodel.ImageGenerationReferenceQualities(invocation.Model), quality) {
			return aiImageGenerationJob{}, &AIImageGenerationInputError{Message: "带参考图时当前模型不支持该分辨率"}
		}
	}

	plan, err := NewAIImagePlanner(s.db).Resolve(ctx, input.UserID, AIImagePlanIntent{
		RecipeID:       input.RecipeID,
		StyleProfileID: input.StyleProfileID,
		Brief:          brief,
		SubjectContext: subjectContext,
		HasReference:   len(references) > 0,
		VariationMode:  input.VariationMode,
	})
	if err != nil {
		return aiImageGenerationJob{}, &AIImageGenerationInputError{Message: err.Error()}
	}
	styleProfileID := ""
	styleProfileSource := ""
	styleProfileName := ""
	styleProfilePrompt := ""
	var styleSkillID *model.Int64String
	if plan.StyleProfile != nil {
		styleProfileID = plan.StyleProfile.ID
		styleProfileSource = plan.StyleProfile.Source
		styleProfileName = plan.StyleProfile.Name
		styleProfilePrompt = plan.StyleProfile.Instructions
		styleSkillID = plan.StyleProfile.SkillID
	}
	snapshot := aiImageCanvasSnapshot{}
	if len(references) > 0 {
		snapshot, err = s.storeSnapshot(ctx, input.UserID, references[0])
		if err != nil {
			log.Printf("[WARN] save AI image canvas snapshot failed: user=%s err=%v", input.UserID.String(), err)
			snapshot = aiImageCanvasSnapshot{}
		}
	}
	generation := model.AIImageGeneration{
		UserID:                   input.UserID,
		Source:                   AIImageGenerationSourceForFeature(input.Feature),
		ModelCatalogID:           invocation.Model.ID,
		Provider:                 invocation.Provider.Provider,
		Model:                    invocation.Model.ModelID,
		PresetID:                 plan.Recipe.ID,
		PresetName:               plan.Recipe.Name,
		PresetPrompt:             strings.TrimSpace(plan.Recipe.Instructions),
		SkillID:                  styleSkillID,
		SkillName:                styleProfileName,
		StyleProfileID:           styleProfileID,
		StyleProfileSource:       styleProfileSource,
		StyleProfilePrompt:       styleProfilePrompt,
		VariationMode:            plan.VariationMode,
		VariationSeed:            plan.VariationSeed,
		VariationPrompt:          plan.VariationPrompt,
		SubjectContext:           subjectContext,
		Prompt:                   brief,
		AspectRatio:              strings.TrimSpace(input.AspectRatio),
		Quality:                  quality,
		RequestedSize:            size,
		ReferenceCount:           len(references),
		ParentGenerationID:       parentGenerationID,
		EditMode:                 editMode,
		CanvasSnapshotURL:        snapshot.URL,
		CanvasSnapshotStorageKey: snapshot.StorageKey,
		CanvasSnapshotWidth:      snapshot.Width,
		CanvasSnapshotHeight:     snapshot.Height,
		Status:                   "queued",
		Stage:                    "preparing",
	}
	if err := s.db.WithContext(ctx).Create(&generation).Error; err != nil {
		if snapshot.StorageKey != "" {
			_ = s.deleteStored(snapshot.StorageKey)
		}
		return aiImageGenerationJob{}, fmt.Errorf("创建图片生成任务失败: %w", err)
	}
	return aiImageGenerationJob{
		generation: generation,
		invocation: invocation,
		prompt:     plan.Prompt,
		references: references,
		mask:       editMask,
		feature:    fallbackString(strings.TrimSpace(input.Feature), "ai-image-studio"),
	}, nil
}

func (s *AIImageGenerationService) resolveReferences(ctx context.Context, input AIImageGenerationInput) ([]string, error) {
	if len(input.References) > MaxAIImageReferences {
		return nil, &AIImageGenerationInputError{Message: fmt.Sprintf("最多支持 %d 张参考图", MaxAIImageReferences)}
	}
	references := make([]string, 0, len(input.References)+1)
	appendReference := func(source string, maxBytes int, oversizeMessage string) error {
		content, mimeType, err := s.fetch(ctx, source)
		if err != nil {
			return &AIImageGenerationInputError{Message: "参考图内容无效: " + err.Error()}
		}
		if len(content) > maxBytes {
			return &AIImageGenerationInputError{Message: oversizeMessage}
		}
		references = append(references, AIImageDataURL(content, mimeType))
		return nil
	}
	if strings.TrimSpace(input.EditMode) != "" && len(input.References) > 0 {
		return nil, &AIImageGenerationInputError{Message: "局部编辑不能同时添加额外参考图"}
	}
	for _, source := range input.References {
		if err := appendReference(source, MaxAIImageReferenceBytes, "单张上传参考图不能超过 5MB"); err != nil {
			return nil, err
		}
	}

	referenceGenerationID := strings.TrimSpace(input.ReferenceGenerationID)
	if referenceGenerationID != "" {
		if len(references) >= MaxAIImageReferences {
			return nil, &AIImageGenerationInputError{Message: fmt.Sprintf("最多支持 %d 张参考图", MaxAIImageReferences)}
		}
		var generation model.AIImageGeneration
		if err := s.db.WithContext(ctx).
			Where("id = ? AND user_id = ?", referenceGenerationID, input.UserID).
			First(&generation).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return nil, &AIImageGenerationInputError{Message: "上一张图片记录不存在"}
			}
			return nil, fmt.Errorf("读取上一张图片记录失败: %w", err)
		}
		if generation.Status != "succeeded" || strings.TrimSpace(generation.ResultURL) == "" {
			return nil, &AIImageGenerationInputError{Message: "上一张图片尚未生成完成"}
		}
		if strings.TrimSpace(input.EditMode) != "" {
			if strings.TrimSpace(input.EditImage) == "" {
				return nil, &AIImageGenerationInputError{Message: "编辑画布不能为空"}
			}
			if err := appendReference(input.EditImage, MaxGeneratedAIImageBytes, "编辑画布超过服务端参考图上限"); err != nil {
				return nil, err
			}
		} else if err := appendReference(
			generation.ResultURL,
			MaxGeneratedAIImageBytes,
			"上一张生成图片超过服务端参考图上限",
		); err != nil {
			return nil, err
		}
	}
	if strings.TrimSpace(input.EditMode) != "" && referenceGenerationID == "" {
		return nil, &AIImageGenerationInputError{Message: "请选择要编辑的历史图片"}
	}
	return references, nil
}

func (s *AIImageGenerationService) resolveEditMask(ctx context.Context, rawMask, source string) (string, error) {
	content, mimeType, err := s.fetch(ctx, rawMask)
	if err != nil {
		return "", &AIImageGenerationInputError{Message: "编辑选区内容无效"}
	}
	if mimeType != "image/png" {
		return "", &AIImageGenerationInputError{Message: "编辑选区必须是 PNG 图片"}
	}
	maskConfig, _, err := image.DecodeConfig(bytes.NewReader(content))
	if err != nil || maskConfig.Width <= 0 || maskConfig.Height <= 0 {
		return "", &AIImageGenerationInputError{Message: "编辑选区尺寸无效"}
	}
	sourceContent, _, err := s.fetch(ctx, source)
	if err != nil {
		return "", &AIImageGenerationInputError{Message: "编辑画布内容无效"}
	}
	sourceConfig, _, err := image.DecodeConfig(bytes.NewReader(sourceContent))
	if err != nil || sourceConfig.Width != maskConfig.Width || sourceConfig.Height != maskConfig.Height {
		return "", &AIImageGenerationInputError{Message: "编辑选区必须与编辑画布尺寸一致"}
	}
	return AIImageDataURL(content, mimeType), nil
}

func IsAIImageEditMode(mode string) bool {
	switch strings.TrimSpace(mode) {
	case AIImageEditModeInpaint, AIImageEditModeEraseReplace, AIImageEditModeOutpaint:
		return true
	default:
		return false
	}
}

func (s *AIImageGenerationService) resolveSkillReferenceImages(
	ctx context.Context,
	userID model.Int64String,
	styleProfileID string,
	remaining int,
) ([]string, error) {
	if remaining <= 0 || s == nil || s.db == nil || !strings.HasPrefix(strings.TrimSpace(styleProfileID), "skill:") {
		return nil, nil
	}
	rawID := strings.TrimPrefix(strings.TrimSpace(styleProfileID), "skill:")
	skillID, err := strconv.ParseInt(rawID, 10, 64)
	if err != nil || skillID <= 0 {
		return nil, &AIImageGenerationInputError{Message: "请选择有效的视觉风格"}
	}
	var files []model.AISkillFile
	if err := s.db.WithContext(ctx).
		Where("skill_id = ? AND user_id = ? AND kind = ? AND storage_key <> ''", skillID, userID, "reference_image").
		Order("path ASC").
		Find(&files).Error; err != nil {
		return nil, fmt.Errorf("读取技能参考图片失败: %w", err)
	}
	if len(files) == 0 {
		return nil, nil
	}
	sort.SliceStable(files, func(i, j int) bool {
		leftRank := aiSkillReferenceImageRank(files[i].Path)
		rightRank := aiSkillReferenceImageRank(files[j].Path)
		return leftRank < rightRank
	})
	if len(files) > remaining {
		files = files[:remaining]
	}
	references := make([]string, 0, len(files))
	for _, file := range files {
		sourceURL, err := s.skillReferenceURL(file.StorageKey)
		if err != nil {
			return nil, ErrAIImageStorageUnavailable
		}
		content, mimeType, err := s.fetch(ctx, sourceURL)
		if err != nil {
			return nil, &AIImageGenerationInputError{Message: "技能参考图片读取失败: " + err.Error()}
		}
		if len(content) > MaxAIImageReferenceBytes {
			return nil, &AIImageGenerationInputError{Message: "技能参考图片超过 5MB"}
		}
		references = append(references, AIImageDataURL(content, mimeType))
	}
	return references, nil
}

// aiSkillReferenceImageRank makes multi-view/model-sheet references win the
// provider's small reference-image budget, then scene images, then crops.
// Path ordering remains deterministic within the same category.
func aiSkillReferenceImageRank(path string) int {
	name := strings.ToLower(path)
	if strings.Contains(name, "model-sheet") || strings.Contains(name, "model_sheet") || strings.Contains(name, "turnaround") {
		return 0
	}
	if strings.Contains(name, "face") || strings.Contains(name, "crop") || strings.Contains(name, "closeup") {
		return 2
	}
	return 1
}

func (s *AIImageGenerationService) run(ctx context.Context, job aiImageGenerationJob) (model.AIImageGeneration, error) {
	started := s.now()
	if !s.markRunning(job.generation.ID, started) {
		return s.reload(job.generation.ID)
	}
	generatedURL, err := s.generate(ctx, job.invocation, aiclient.ImageGenerationRequest{
		Provider: job.invocation.Provider.Provider,
		Protocol: job.invocation.Model.ImageProtocol,
		ModelID:  job.invocation.Model.ModelID,
		Prompt:   job.prompt,
		Size:     job.generation.RequestedSize,
		Images:   job.references,
		Mask:     job.mask,
	})
	if err != nil {
		if s.isPaused(job.generation.ID) {
			return s.reload(job.generation.ID)
		}
		return s.fail(job, started, "IMAGE_GENERATION_FAILED", "图片生成失败，请稍后重试或切换模型", err)
	}
	if s.isPaused(job.generation.ID) {
		return s.reload(job.generation.ID)
	}
	if !s.markStoring(job.generation.ID) {
		return s.reload(job.generation.ID)
	}
	content, mimeType, err := s.fetch(ctx, generatedURL)
	if err != nil {
		if s.isPaused(job.generation.ID) {
			return s.reload(job.generation.ID)
		}
		return s.fail(job, started, "IMAGE_DOWNLOAD_FAILED", "生成图片读取失败，请稍后重试", err)
	}
	width, height, dimensionErr := GeneratedAIImageDimensions(content, mimeType)
	if dimensionErr != nil {
		log.Printf("[WARN] AI image dimensions unavailable; preserving valid result: id=%s err=%v", job.generation.ID.String(), dimensionErr)
	}
	if err := validateAIImageOutputDimensions(job.generation.RequestedSize, job.generation.Quality, width, height, dimensionErr); err != nil {
		return s.fail(
			job,
			started,
			"IMAGE_DIMENSIONS_TOO_SMALL",
			"图片服务返回的图片尺寸过小，请稍后重试或切换模型",
			err,
		)
	}
	if expectedWidth, expectedHeight, ok := parseAIImageSize(job.generation.RequestedSize); ok &&
		dimensionErr == nil &&
		(width != expectedWidth || height != expectedHeight) {
		log.Printf(
			"[WARN] AI image dimensions differ from requested target; accepting usable result: id=%s requested=%dx%d actual=%dx%d",
			job.generation.ID.String(),
			expectedWidth,
			expectedHeight,
			width,
			height,
		)
	}
	if s.isPaused(job.generation.ID) {
		return s.reload(job.generation.ID)
	}
	folder := fmt.Sprintf("ai-images/%s/%s", job.generation.UserID.String(), s.now().Format("20060102"))
	stored, err := s.upload(ctx, job.generation.UserID, folder, "generated"+AIImageExtension(mimeType), content)
	if err != nil {
		if s.isPaused(job.generation.ID) {
			return s.reload(job.generation.ID)
		}
		return s.fail(job, started, "IMAGE_STORAGE_FAILED", "生成图片转存失败，请检查存储服务", err)
	}
	if s.isPaused(job.generation.ID) {
		if stored.Key != "" {
			_ = s.deleteStored(stored.Key)
		}
		return s.reload(job.generation.ID)
	}
	finished := s.now()
	completed, err := s.markSucceeded(job.generation.ID, map[string]any{
		"status": "succeeded", "stage": "completed", "result_url": stored.URL,
		"result_storage_key": stored.Key, "result_width": width, "result_height": height,
		"result_size": stored.Size, "finished_at": finished, "error_code": "", "error_message": "",
	})
	if err != nil {
		return s.fail(job, started, "IMAGE_STORAGE_FAILED", "生成结果保存失败，请稍后重试", err)
	}
	if !completed {
		if stored.Key != "" {
			_ = s.deleteStored(stored.Key)
		}
		return s.reload(job.generation.ID)
	}
	s.recordUsage(aiusage.Entry{
		Feature:       job.feature,
		Provider:      job.invocation.Provider.Provider,
		Model:         job.invocation.Model.ModelID,
		UserID:        job.generation.UserID.String(),
		Status:        aiusage.StatusSuccess,
		PromptChars:   aiusage.CharCount(job.prompt),
		ResponseChars: aiusage.CharCount(stored.URL),
		LatencyMs:     s.now().Sub(started).Milliseconds(),
	})
	return s.reload(job.generation.ID)
}

func (s *AIImageGenerationService) fail(
	job aiImageGenerationJob,
	started time.Time,
	code string,
	message string,
	cause error,
) (model.AIImageGeneration, error) {
	if s.isPaused(job.generation.ID) {
		return s.reload(job.generation.ID)
	}
	safeCause := SummarizeAIImageError(cause)
	displayMessage := message
	if safeCause != "" {
		displayMessage = fmt.Sprintf("%s（%s）", message, safeCause)
	}
	finished := s.now()
	result := s.db.Model(&model.AIImageGeneration{}).
		Where("id = ? AND status IN ?", job.generation.ID, []string{"queued", "running"}).
		Updates(map[string]any{
			"status": "failed", "stage": "completed", "error_code": code,
			"error_message": displayMessage, "finished_at": finished,
		})
	if result.Error != nil {
		log.Printf("[WARN] mark AI image generation failed: id=%s err=%v", job.generation.ID.String(), result.Error)
	}
	s.recordUsage(aiusage.Entry{
		Feature:      job.feature,
		Provider:     job.invocation.Provider.Provider,
		Model:        job.invocation.Model.ModelID,
		UserID:       job.generation.UserID.String(),
		Status:       aiusage.StatusFailed,
		PromptChars:  aiusage.CharCount(job.generation.Prompt),
		LatencyMs:    s.now().Sub(started).Milliseconds(),
		ErrorMessage: safeCause,
	})
	log.Printf("[WARN] AI image generation failed: id=%s code=%s err=%s", job.generation.ID.String(), code, safeCause)
	failed, reloadErr := s.reload(job.generation.ID)
	if reloadErr != nil {
		return model.AIImageGeneration{}, errors.New(displayMessage)
	}
	return failed, errors.New(displayMessage)
}

func (s *AIImageGenerationService) markRunning(id model.Int64String, started time.Time) bool {
	result := s.db.Model(&model.AIImageGeneration{}).
		Where("id = ? AND status = ?", id, "queued").
		Updates(map[string]any{"status": "running", "stage": "generating", "started_at": started})
	if result.Error != nil {
		log.Printf("[WARN] mark AI image generation running: id=%s err=%v", id.String(), result.Error)
		return false
	}
	return result.RowsAffected > 0
}

func (s *AIImageGenerationService) markSucceeded(id model.Int64String, values map[string]any) (bool, error) {
	result := s.db.Model(&model.AIImageGeneration{}).Where("id = ? AND status = ?", id, "running").Updates(values)
	if result.Error != nil {
		return false, result.Error
	}
	return result.RowsAffected > 0, nil
}

func (s *AIImageGenerationService) markStoring(id model.Int64String) bool {
	result := s.db.Model(&model.AIImageGeneration{}).
		Where("id = ? AND status = ?", id, "running").
		Update("stage", "storing")
	if result.Error != nil {
		log.Printf("[WARN] mark AI image generation storing: id=%s err=%v", id.String(), result.Error)
		return false
	}
	return result.RowsAffected > 0
}

func (s *AIImageGenerationService) isPaused(id model.Int64String) bool {
	var generation model.AIImageGeneration
	if err := s.db.Select("status").Where("id = ?", id).First(&generation).Error; err != nil {
		return false
	}
	return generation.Status == "paused"
}

func (s *AIImageGenerationService) update(id model.Int64String, values map[string]any) {
	if err := s.db.Model(&model.AIImageGeneration{}).Where("id = ?", id).Updates(values).Error; err != nil {
		log.Printf("[WARN] update AI image generation failed: id=%s err=%v", id.String(), err)
	}
}

func (s *AIImageGenerationService) reload(id model.Int64String) (model.AIImageGeneration, error) {
	var generation model.AIImageGeneration
	if err := s.db.Where("id = ?", id).First(&generation).Error; err != nil {
		return model.AIImageGeneration{}, err
	}
	return generation, nil
}

type aiImageCanvasSnapshot struct {
	URL        string
	StorageKey string
	Width      int
	Height     int
}

func (s *AIImageGenerationService) storeSnapshot(ctx context.Context, userID model.Int64String, reference string) (aiImageCanvasSnapshot, error) {
	content, mimeType, err := s.fetch(ctx, reference)
	if err != nil {
		return aiImageCanvasSnapshot{}, err
	}
	width, height, err := GeneratedAIImageDimensions(content, mimeType)
	if err != nil {
		return aiImageCanvasSnapshot{}, err
	}
	folder := fmt.Sprintf("ai-image-snapshots/%s/%s", userID.String(), s.now().Format("20060102"))
	stored, err := s.upload(ctx, userID, folder, "canvas"+AIImageExtension(mimeType), content)
	if err != nil {
		return aiImageCanvasSnapshot{}, err
	}
	return aiImageCanvasSnapshot{URL: stored.URL, StorageKey: stored.Key, Width: width, Height: height}, nil
}

func FetchAIImageSource(ctx context.Context, source string) ([]byte, string, error) {
	source = strings.TrimSpace(source)
	if strings.HasPrefix(strings.ToLower(source), "data:image/") {
		content, mimeType, err := aiclient.DecodeImageDataURL(source, MaxGeneratedAIImageBytes)
		if err != nil {
			return nil, "", err
		}
		if !SupportedAIImageMIME(mimeType) {
			return nil, "", errors.New("图片格式必须是 JPG、PNG、WebP、GIF、AVIF 或 BMP")
		}
		return content, mimeType, nil
	}
	parsed, err := url.Parse(source)
	if err != nil || parsed.Scheme != "https" || parsed.Host == "" {
		return nil, "", errors.New("图片地址无效")
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
	content, err := io.ReadAll(io.LimitReader(response.Body, MaxGeneratedAIImageBytes+1))
	if err != nil || len(content) == 0 || len(content) > MaxGeneratedAIImageBytes {
		return nil, "", errors.New("图片内容无效或过大")
	}
	mimeType := aiclient.DetectCompatibleImageMIME(content)
	if !SupportedAIImageMIME(mimeType) {
		return nil, "", errors.New("图片格式必须是 JPG、PNG、WebP、GIF、AVIF 或 BMP")
	}
	return content, mimeType, nil
}

func AIImageDataURL(content []byte, mimeType string) string {
	return "data:" + mimeType + ";base64," + base64.StdEncoding.EncodeToString(content)
}

func SupportedAIImageMIME(value string) bool {
	return aiclient.IsCompatibleImageMIME(value)
}

func AIImageStorageExtensions() []string {
	return []string{".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif", ".bmp"}
}

func AIImageExtension(mimeType string) string {
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

func GeneratedAIImageDimensions(content []byte, mimeType string) (int, int, error) {
	if mimeType == "image/webp" {
		return webPImageDimensions(content)
	}
	config, _, err := image.DecodeConfig(bytes.NewReader(content))
	if err != nil || config.Width <= 0 || config.Height <= 0 {
		return 0, 0, errors.New("无法读取图片像素尺寸")
	}
	return config.Width, config.Height, nil
}

func validateAIImageOutputDimensions(
	requestedSize, quality string,
	width, height int,
	dimensionErr error,
) error {
	if strings.TrimSpace(quality) != "4K" || dimensionErr != nil {
		return nil
	}
	minimumWidth, minimumHeight, ok := minimumAcceptedAIImageDimensions(requestedSize)
	if !ok {
		return nil
	}
	if width < minimumWidth || height < minimumHeight {
		return fmt.Errorf(
			"4K 请求的最低可用尺寸为 %dx%d，图片服务返回 %dx%d",
			minimumWidth,
			minimumHeight,
			width,
			height,
		)
	}
	return nil
}

func minimumAcceptedAIImageDimensions(requestedSize string) (int, int, bool) {
	requestedSize = strings.TrimSpace(requestedSize)
	for _, sizes := range AIImageSizes {
		if strings.TrimSpace(sizes["4K"]) != requestedSize {
			continue
		}
		return parseAIImageSize(sizes["1K"])
	}
	return 0, 0, false
}

func parseAIImageSize(value string) (int, int, bool) {
	widthRaw, heightRaw, found := strings.Cut(strings.TrimSpace(value), "x")
	if !found {
		return 0, 0, false
	}
	width, widthErr := strconv.Atoi(widthRaw)
	height, heightErr := strconv.Atoi(heightRaw)
	return width, height, widthErr == nil && heightErr == nil && width > 0 && height > 0
}

func webPImageDimensions(content []byte) (int, int, error) {
	if len(content) < 20 || string(content[:4]) != "RIFF" || string(content[8:12]) != "WEBP" {
		return 0, 0, errors.New("无法读取图片像素尺寸")
	}
	for offset := 12; offset+8 <= len(content); {
		chunkType := string(content[offset : offset+4])
		chunkSize := int(content[offset+4]) |
			int(content[offset+5])<<8 |
			int(content[offset+6])<<16 |
			int(content[offset+7])<<24
		dataOffset := offset + 8
		if chunkSize < 0 || chunkSize > len(content)-dataOffset {
			return 0, 0, errors.New("无法读取图片像素尺寸")
		}
		chunk := content[dataOffset : dataOffset+chunkSize]
		if width, height, ok := webPChunkDimensions(chunkType, chunk); ok {
			return width, height, nil
		}
		offset = dataOffset + chunkSize
		if chunkSize%2 != 0 {
			offset++
		}
	}
	return 0, 0, errors.New("无法读取图片像素尺寸")
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

func SummarizeAIImageError(cause error) string {
	if cause == nil {
		return ""
	}
	message := strings.TrimSpace(cause.Error())
	if index := strings.Index(strings.ToLower(message), "data:image/"); index >= 0 {
		message = strings.TrimSpace(message[:index]) + " [reference omitted]"
	}
	runes := []rune(message)
	if len(runes) > 500 {
		message = string(runes[:500])
	}
	return message
}

func fallbackString(value, fallback string) string {
	if value != "" {
		return value
	}
	return fallback
}
