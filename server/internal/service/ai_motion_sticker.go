package service

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"valley-server/internal/aimodel"
	"valley-server/internal/model"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const (
	AIMotionStickerDurationSeconds = 5
	AIMotionStickerResolution      = "720p"
	AIMotionStickerAspectRatio     = "1:1"
	AIMotionStickerFrameCount      = 6

	AIMotionStickerModeImage = "image"
	AIMotionStickerModeVideo = "video"

	AIMotionStickerStatusQueued    = "queued"
	AIMotionStickerStatusRunning   = "running"
	AIMotionStickerStatusSucceeded = "succeeded"
	AIMotionStickerStatusFailed    = "failed"
)

var ErrAIMotionStickerBusy = errors.New("当前已有动态表情生成任务，请等待完成后再试")

type AIMotionStickerQueueInput struct {
	UserID              model.Int64String
	ModelID             string
	Mode                string
	Action              string
	ReferenceURL        string
	ReferenceStorageKey string
}

type AIMotionStickerService struct {
	db           *gorm.DB
	imageClient  func(model.AIMotionStickerGeneration) (motionStickerImageClient, error)
	videoClient  func(model.AIMotionStickerGeneration) (motionStickerVideoClient, error)
	fetchImage   func(context.Context, string) ([]byte, string, error)
	encodeFrames func(context.Context, []motionStickerFrame) ([]byte, int, int, error)
	upload       func(context.Context, model.Int64String, string, []byte) (*UploadResult, error)
	transcode    func(context.Context, []byte) ([]byte, int, int, error)
	notify       func(model.AIMotionStickerGeneration)
}

func NewAIMotionStickerService(db *gorm.DB) *AIMotionStickerService {
	service := &AIMotionStickerService{db: db}
	service.imageClient = newMotionStickerImageClient
	service.videoClient = newMotionStickerVideoClient
	service.fetchImage = FetchAIImageSource
	service.encodeFrames = encodeMotionStickerFrames
	service.upload = uploadMotionStickerOutput
	service.transcode = transcodeMotionSticker
	service.notify = func(generation model.AIMotionStickerGeneration) {
		createAIMotionStickerNotification(db, generation)
	}
	return service
}

func (service *AIMotionStickerService) Queue(ctx context.Context, input AIMotionStickerQueueInput) (model.AIMotionStickerGeneration, error) {
	action := strings.TrimSpace(input.Action)
	if action == "" || len([]rune(action)) > 500 {
		return model.AIMotionStickerGeneration{}, errors.New("动作描述不能为空且不能超过 500 个字符")
	}
	if strings.TrimSpace(input.ReferenceURL) == "" || strings.TrimSpace(input.ReferenceStorageKey) == "" {
		return model.AIMotionStickerGeneration{}, errors.New("参考图片不能为空")
	}

	mode := strings.ToLower(strings.TrimSpace(input.Mode))
	if mode == "" {
		mode = AIMotionStickerModeImage
	}
	if mode != AIMotionStickerModeImage && mode != AIMotionStickerModeVideo {
		return model.AIMotionStickerGeneration{}, errors.New("请选择有效的动态表情生成方式")
	}
	capability := "image_generation"
	if mode == AIMotionStickerModeVideo {
		capability = "video_generation"
	}
	selected, err := aimodel.FindEnabledModel(service.db.WithContext(ctx), input.ModelID, capability)
	if err != nil {
		return model.AIMotionStickerGeneration{}, err
	}
	if !aimodel.HasCapabilities(selected, []string{"reference_image"}) {
		return model.AIMotionStickerGeneration{}, aimodel.ErrModelNotAvailable
	}
	imageProtocol, videoProtocol, frameCount := "auto", "auto", 0
	prompt := CompileAIMotionStickerPrompt(action)
	if mode == AIMotionStickerModeImage {
		imageProtocol, err = ResolveAIMotionStickerImageProtocol(selected)
		frameCount = AIMotionStickerFrameCount
		prompt = CompileAIMotionStickerImagePrompt(action, frameCount)
	} else {
		videoProtocol, err = ResolveAIMotionStickerVideoProtocol(selected)
	}
	if err != nil {
		return model.AIMotionStickerGeneration{}, err
	}
	if _, err := aimodel.ProviderFromEnv(selected.Provider); err != nil {
		return model.AIMotionStickerGeneration{}, err
	}

	generation := model.AIMotionStickerGeneration{
		UserID:              input.UserID,
		ModelCatalogID:      selected.ID,
		Provider:            selected.Provider,
		Model:               selected.ModelID,
		GenerationMode:      mode,
		ImageProtocol:       imageProtocol,
		VideoProtocol:       videoProtocol,
		FrameCount:          frameCount,
		Action:              action,
		Prompt:              prompt,
		AspectRatio:         AIMotionStickerAspectRatio,
		DurationSeconds:     AIMotionStickerDurationSeconds,
		Resolution:          AIMotionStickerResolution,
		ReferenceURL:        strings.TrimSpace(input.ReferenceURL),
		ReferenceStorageKey: strings.TrimSpace(input.ReferenceStorageKey),
		Status:              AIMotionStickerStatusQueued,
		Stage:               "queued",
	}

	err = service.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var owner model.User
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Select("id").First(&owner, input.UserID).Error; err != nil {
			return fmt.Errorf("load motion sticker owner: %w", err)
		}
		var active int64
		if err := tx.Model(&model.AIMotionStickerGeneration{}).
			Where("user_id = ? AND status IN ?", input.UserID, []string{AIMotionStickerStatusQueued, AIMotionStickerStatusRunning}).
			Count(&active).Error; err != nil {
			return err
		}
		if active > 0 {
			return ErrAIMotionStickerBusy
		}
		return tx.Create(&generation).Error
	})
	if err != nil {
		return model.AIMotionStickerGeneration{}, err
	}
	return generation, nil
}

// ResolveAIMotionStickerImageProtocol keeps catalog visibility and queue
// validation aligned with reference-image transports implemented by the image client.
func ResolveAIMotionStickerImageProtocol(item model.AIModel) (string, error) {
	protocol := strings.ToLower(strings.TrimSpace(item.ImageProtocol))
	if protocol == "" || protocol == "auto" {
		switch strings.ToLower(strings.TrimSpace(item.Provider)) {
		case "amux", "pipixia":
			return "openai_images", nil
		case "volcengine", "ark":
			return "ark_images", nil
		default:
			return "", aimodel.ErrModelNotAvailable
		}
	}
	if protocol != "openai_images" && protocol != "ark_images" {
		return "", aimodel.ErrModelNotAvailable
	}
	return protocol, nil
}

// ResolveAIMotionStickerVideoProtocol keeps catalog visibility and queue
// validation aligned with the video transports implemented by this service.
func ResolveAIMotionStickerVideoProtocol(item model.AIModel) (string, error) {
	provider := strings.ToLower(strings.TrimSpace(item.Provider))
	protocol := strings.ToLower(strings.TrimSpace(item.VideoProtocol))
	if provider != "amux" {
		return "", aimodel.ErrModelNotAvailable
	}
	if protocol == "" || protocol == "auto" {
		return "amux_video", nil
	}
	if protocol != "amux_video" {
		return "", aimodel.ErrModelNotAvailable
	}
	return protocol, nil
}

func CompileAIMotionStickerPrompt(action string) string {
	action = strings.TrimSpace(action)
	return strings.Join([]string{
		"根据首尾参考图制作一段短循环动画。",
		"角色动作：" + action + "。",
		"严格保持角色一致，包括脸型、五官比例、线条粗细、主色、服饰和标志性配件。",
		"动作自然清晰，固定镜头；完成动作后回到初始姿势，使首尾可以无缝循环。",
		"用户未明确背景时使用简洁纯色背景，只加入完成动作必需的最少道具。",
		"不要添加文字、字幕、水印、额外角色或无关物体。",
	}, "\n")
}

func CompileAIMotionStickerImagePrompt(action string, frameCount int) string {
	action = strings.TrimSpace(action)
	if frameCount <= 0 {
		frameCount = AIMotionStickerFrameCount
	}
	return strings.Join([]string{
		fmt.Sprintf("参考输入角色，生成按动作时间顺序排列的 %d 张独立正方形动画帧。", frameCount),
		"角色动作：" + action + "。",
		"严格保持每一张中的角色一致，包括脸型、五官比例、身体比例、线条粗细、主色、服饰和标志性配件。",
		"固定镜头、构图和背景；每张只推进少量动作，动作阶段连续清晰。",
		"第一张从自然初始姿势开始，最后一张回到与第一张接近的姿势，便于默认无缝循环。",
		"用户未明确背景时使用简洁纯色背景，只加入完成动作必需的少量道具。",
		"每张都是单独完整画面，不要拼贴、网格、分镜框或编号；不要添加文字、字幕、水印、额外角色或无关物体。",
	}, "\n")
}

func motionStickerFFmpegArgs(inputPath, outputPath string) []string {
	filter := "fps=12,scale=320:320:force_original_aspect_ratio=decrease,pad=320:320:(ow-iw)/2:(oh-ih)/2:color=white,split[s0][s1];[s0]palettegen=max_colors=128[p];[s1][p]paletteuse=dither=sierra2_4a"
	return []string{
		"-hide_banner", "-loglevel", "error", "-n", "-i", inputPath,
		"-filter_complex", filter, "-loop", "0", outputPath,
	}
}

func motionStickerFrameFFmpegArgs(inputPath, outputPath string) []string {
	filter := "scale=320:320:force_original_aspect_ratio=decrease,pad=320:320:(ow-iw)/2:(oh-ih)/2:color=white,split[s0][s1];[s0]palettegen=max_colors=128[p];[s1][p]paletteuse=dither=sierra2_4a"
	return []string{
		"-hide_banner", "-loglevel", "error", "-n", "-f", "concat", "-safe", "0", "-i", inputPath,
		"-filter_complex", filter, "-loop", "0", outputPath,
	}
}
