package service

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"image"
	_ "image/gif"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"valley-server/internal/aiclient"
	"valley-server/internal/aimodel"
	"valley-server/internal/aiusage"
	"valley-server/internal/model"

	"gorm.io/gorm"
)

const (
	maxAIMotionStickerVideoBytes = 128 << 20
	aiMotionStickerJobTimeout    = 10 * time.Minute
	aiMotionStickerImageRetryAge = 5 * time.Minute
)

type motionStickerImageClient interface {
	GenerateImageResult(context.Context, aiclient.ImageGenerationRequest) (aiclient.ImageGenerationResult, error)
}

type motionStickerFrame struct {
	Content  []byte
	MIMEType string
}

type motionStickerVideoClient interface {
	CreateVideo(context.Context, aiclient.VideoGenerationRequest) (aiclient.VideoTask, error)
	GetVideoTask(context.Context, string) (aiclient.VideoTask, error)
	DownloadVideo(context.Context, string, int64) ([]byte, string, error)
}

func newMotionStickerImageClient(generation model.AIMotionStickerGeneration) (motionStickerImageClient, error) {
	provider, err := aimodel.ProviderFromEnv(generation.Provider)
	if err != nil {
		return nil, err
	}
	client := aiclient.NewProviderCompatibleClient(provider.Provider, provider.BaseURL, provider.APIKey, AIImageGenerationTimeout)
	client.ImageProtocol = generation.ImageProtocol
	return client, nil
}

func newMotionStickerVideoClient(generation model.AIMotionStickerGeneration) (motionStickerVideoClient, error) {
	provider, err := aimodel.ProviderFromEnv(generation.Provider)
	if err != nil {
		return nil, err
	}
	client := aiclient.NewProviderCompatibleClient(provider.Provider, provider.BaseURL, provider.APIKey, 90*time.Second)
	client.VideoProtocol = generation.VideoProtocol
	return client, nil
}

func uploadMotionStickerOutput(ctx context.Context, userID model.Int64String, filename string, content []byte) (*UploadResult, error) {
	config := GetDefaultConfig(UploadTypeWallpaper)
	config.UserID = int64(userID)
	config.MaxSize = 128
	config.AllowedExts = []string{strings.ToLower(filepath.Ext(filename))}
	config.CustomFolder = fmt.Sprintf("motion-stickers/%s/%s", userID.String(), time.Now().Format("20060102"))
	return NewUploadService().UploadBytesWithContext(ctx, filename, content, config)
}

// ProcessPending advances durable jobs by one provider state transition. It is
// safe to call repeatedly after process restarts.
func (service *AIMotionStickerService) ProcessPending(ctx context.Context) error {
	var generations []model.AIMotionStickerGeneration
	if err := service.db.WithContext(ctx).
		Where("status IN ?", []string{AIMotionStickerStatusQueued, AIMotionStickerStatusRunning}).
		Order("created_at ASC, id ASC").Limit(20).Find(&generations).Error; err != nil {
		return err
	}
	var firstErr error
	for _, generation := range generations {
		if err := service.ProcessOne(ctx, generation.ID); err != nil && firstErr == nil {
			firstErr = err
		}
	}
	return firstErr
}

func (service *AIMotionStickerService) ProcessOne(ctx context.Context, id model.Int64String) error {
	var generation model.AIMotionStickerGeneration
	if err := service.db.WithContext(ctx).First(&generation, id).Error; err != nil {
		return err
	}
	if generation.Status != AIMotionStickerStatusQueued && generation.Status != AIMotionStickerStatusRunning {
		return nil
	}
	if time.Since(generation.CreatedAt) > aiMotionStickerJobTimeout {
		return service.fail(ctx, &generation, "timeout", "动态表情生成超时")
	}
	if generation.GenerationMode == AIMotionStickerModeImage {
		return service.processImage(ctx, &generation)
	}
	client, err := service.videoClient(generation)
	if err != nil {
		return service.fail(ctx, &generation, "provider_config", err.Error())
	}
	if generation.ProviderTaskID == "" {
		if generation.Status == AIMotionStickerStatusRunning && generation.Stage == "submitting" {
			if time.Since(generation.UpdatedAt) < 2*time.Minute {
				return nil
			}
			reset := service.db.WithContext(ctx).Model(&generation).
				Where("status = ? AND stage = ? AND provider_task_id = ''", AIMotionStickerStatusRunning, "submitting").
				Updates(map[string]any{"status": AIMotionStickerStatusQueued, "stage": "queued"})
			if reset.Error != nil || reset.RowsAffected == 0 {
				return reset.Error
			}
			generation.Status = AIMotionStickerStatusQueued
			generation.Stage = "queued"
		}
		return service.submit(ctx, &generation, client)
	}
	return service.poll(ctx, &generation, client)
}

func (service *AIMotionStickerService) processImage(ctx context.Context, generation *model.AIMotionStickerGeneration) error {
	if generation.Status == AIMotionStickerStatusRunning {
		if time.Since(generation.UpdatedAt) < aiMotionStickerImageRetryAge {
			return nil
		}
		return service.fail(
			ctx,
			generation,
			"generation_state_lost",
			"服务中断后无法确认生图请求是否已计费，为避免重复扣费未自动重试，请重新提交",
		)
	}

	now := time.Now()
	claim := service.db.WithContext(ctx).Model(generation).
		Where("status = ?", AIMotionStickerStatusQueued).
		Updates(map[string]any{"status": AIMotionStickerStatusRunning, "stage": "generating_frames", "started_at": &now})
	if claim.Error != nil {
		return claim.Error
	}
	if claim.RowsAffected == 0 {
		return nil
	}
	generation.Status = AIMotionStickerStatusRunning
	generation.Stage = "generating_frames"

	client, err := service.imageClient(*generation)
	if err != nil {
		return service.fail(ctx, generation, "provider_config", err.Error())
	}
	referenceContent, referenceMIME, err := service.fetchImage(ctx, generation.ReferenceURL)
	if err != nil {
		return service.fail(ctx, generation, "reference_download", err.Error())
	}
	frameCount := generation.FrameCount
	if frameCount <= 0 {
		frameCount = AIMotionStickerFrameCount
	}
	result, err := client.GenerateImageResult(ctx, aiclient.ImageGenerationRequest{
		Provider: generation.Provider, Protocol: generation.ImageProtocol, ModelID: generation.Model,
		Prompt: generation.Prompt, Size: resolveAIImageRequestedSize(model.AIModel{ModelID: generation.Model}, AIMotionStickerAspectRatio, "2K"),
		Images: []string{AIImageDataURL(referenceContent, referenceMIME)}, OutputCount: frameCount,
	})
	if err != nil {
		return service.fail(ctx, generation, "provider_generate", err.Error())
	}
	sources := result.Sources
	if len(sources) == 0 && strings.TrimSpace(result.Source) != "" {
		sources = []string{result.Source}
	}
	if len(sources) < 2 {
		return service.fail(ctx, generation, "insufficient_frames", "生图模型返回的连贯帧不足，请重试或切换模型")
	}
	if err := service.db.WithContext(ctx).Model(generation).Update("stage", "encoding_gif").Error; err != nil {
		return err
	}
	frames := make([]motionStickerFrame, 0, len(sources))
	for _, source := range sources {
		content, mimeType, fetchErr := service.fetchImage(ctx, source)
		if fetchErr != nil {
			return service.fail(ctx, generation, "frame_download", fetchErr.Error())
		}
		frames = append(frames, motionStickerFrame{Content: content, MIMEType: mimeType})
	}
	gifContent, width, height, err := service.encodeFrames(ctx, frames)
	if err != nil {
		return service.fail(ctx, generation, "encode_gif", err.Error())
	}
	storedGIF, err := service.upload(ctx, generation.UserID, generation.ID.String()+".gif", gifContent)
	if err != nil {
		return service.fail(ctx, generation, "storage_gif", err.Error())
	}
	finishedAt := time.Now()
	if err := service.db.WithContext(ctx).Model(generation).Updates(map[string]any{
		"status": AIMotionStickerStatusSucceeded, "stage": "completed",
		"gif_url": storedGIF.URL, "gif_storage_key": storedGIF.Key, "gif_size": storedGIF.Size,
		"gif_width": width, "gif_height": height, "finished_at": &finishedAt,
		"error_code": "", "error_message": "",
	}).Error; err != nil {
		return err
	}
	service.db.WithContext(ctx).First(generation, generation.ID)
	service.recordImageUsage(*generation, result, aiusage.StatusSuccess, "")
	service.notify(*generation)
	return nil
}

func (service *AIMotionStickerService) submit(ctx context.Context, generation *model.AIMotionStickerGeneration, client motionStickerVideoClient) error {
	now := time.Now()
	claim := service.db.WithContext(ctx).Model(generation).
		Where("status = ? AND provider_task_id = ''", AIMotionStickerStatusQueued).
		Updates(map[string]any{
			"status": AIMotionStickerStatusRunning, "stage": "submitting", "started_at": &now,
		})
	if claim.Error != nil {
		return claim.Error
	}
	if claim.RowsAffected == 0 {
		return nil
	}
	task, err := client.CreateVideo(ctx, aiclient.VideoGenerationRequest{
		Protocol: generation.VideoProtocol, ModelID: generation.Model, Prompt: generation.Prompt,
		ReferenceImageURL: generation.ReferenceURL, Ratio: generation.AspectRatio,
		DurationSeconds: generation.DurationSeconds, Resolution: generation.Resolution,
	})
	if err != nil {
		return service.fail(ctx, generation, "provider_submit", err.Error())
	}
	generation.ProviderTaskID = task.ID
	generation.Status = AIMotionStickerStatusRunning
	generation.Stage = "generating"
	return service.db.WithContext(ctx).Model(generation).Updates(map[string]any{
		"provider_task_id": task.ID, "status": generation.Status, "stage": generation.Stage,
	}).Error
}

func (service *AIMotionStickerService) poll(ctx context.Context, generation *model.AIMotionStickerGeneration, client motionStickerVideoClient) error {
	task, err := client.GetVideoTask(ctx, generation.ProviderTaskID)
	if err != nil {
		return err
	}
	switch task.Status {
	case aiclient.VideoTaskQueued, aiclient.VideoTaskRunning:
		return service.db.WithContext(ctx).Model(generation).Update("stage", "generating").Error
	case aiclient.VideoTaskFailed:
		message := strings.TrimSpace(task.ErrorMessage)
		if message == "" {
			message = "视频模型生成失败"
		}
		return service.fail(ctx, generation, strings.TrimSpace(task.ErrorCode), message)
	case aiclient.VideoTaskSucceeded:
		return service.persistOutputs(ctx, generation, client, task)
	default:
		return service.fail(ctx, generation, "unknown_status", "视频模型返回未知任务状态")
	}
}

func (service *AIMotionStickerService) persistOutputs(ctx context.Context, generation *model.AIMotionStickerGeneration, client motionStickerVideoClient, task aiclient.VideoTask) error {
	if err := service.db.WithContext(ctx).Model(generation).Update("stage", "downloading").Error; err != nil {
		return err
	}
	mp4, _, err := client.DownloadVideo(ctx, generation.ProviderTaskID, maxAIMotionStickerVideoBytes)
	if err != nil {
		return service.fail(ctx, generation, "download", err.Error())
	}
	storedMP4, err := service.upload(ctx, generation.UserID, generation.ID.String()+".mp4", mp4)
	if err != nil {
		return service.fail(ctx, generation, "storage_mp4", err.Error())
	}
	if err := service.db.WithContext(ctx).Model(generation).Updates(map[string]any{
		"stage": "transcoding", "mp4_url": storedMP4.URL, "mp4_storage_key": storedMP4.Key, "mp4_size": storedMP4.Size,
	}).Error; err != nil {
		return err
	}
	gifContent, width, height, err := service.transcode(ctx, mp4)
	if err != nil {
		return service.fail(ctx, generation, "transcode", err.Error())
	}
	storedGIF, err := service.upload(ctx, generation.UserID, generation.ID.String()+".gif", gifContent)
	if err != nil {
		return service.fail(ctx, generation, "storage_gif", err.Error())
	}
	finishedAt := time.Now()
	updates := map[string]any{
		"status": AIMotionStickerStatusSucceeded, "stage": "completed",
		"gif_url": storedGIF.URL, "gif_storage_key": storedGIF.Key, "gif_size": storedGIF.Size,
		"gif_width": width, "gif_height": height, "finished_at": &finishedAt,
		"error_code": "", "error_message": "",
	}
	if err := service.db.WithContext(ctx).Model(generation).Updates(updates).Error; err != nil {
		return err
	}
	service.db.WithContext(ctx).First(generation, generation.ID)
	service.recordUsage(*generation, task, aiusage.StatusSuccess, "")
	service.notify(*generation)
	return nil
}

func (service *AIMotionStickerService) fail(ctx context.Context, generation *model.AIMotionStickerGeneration, code, message string) error {
	finishedAt := time.Now()
	message = truncateMotionStickerError(message)
	err := service.db.WithContext(ctx).Model(generation).Updates(map[string]any{
		"status": AIMotionStickerStatusFailed, "stage": "failed", "error_code": code,
		"error_message": message, "finished_at": &finishedAt,
	}).Error
	if err == nil {
		service.db.WithContext(ctx).First(generation, generation.ID)
		service.recordUsage(*generation, aiclient.VideoTask{}, aiusage.StatusFailed, message)
		service.notify(*generation)
	}
	if message == "" {
		message = "动态表情生成失败"
	}
	return errors.New(message)
}

func (service *AIMotionStickerService) recordUsage(generation model.AIMotionStickerGeneration, task aiclient.VideoTask, status, errorMessage string) {
	aiusage.Record(aiusage.Entry{
		Feature: "ai-motion-sticker", Provider: generation.Provider, Model: generation.Model,
		UserID: generation.UserID.String(), Status: status, PromptChars: aiusage.CharCount(generation.Prompt),
		CompletionTokens: task.CompletionTokens, TotalTokens: task.TotalTokens, ErrorMessage: errorMessage,
	})
}

func (service *AIMotionStickerService) recordImageUsage(generation model.AIMotionStickerGeneration, result aiclient.ImageGenerationResult, status, errorMessage string) {
	aiusage.Record(aiusage.Entry{
		Feature: "ai-motion-sticker", Provider: generation.Provider, Model: generation.Model,
		UserID: generation.UserID.String(), Status: status, PromptChars: aiusage.CharCount(generation.Prompt),
		CompletionTokens: result.Usage.OutputTokens, TotalTokens: result.Usage.TotalTokens, ErrorMessage: errorMessage,
	})
}

func createAIMotionStickerNotification(db *gorm.DB, generation model.AIMotionStickerGeneration) {
	if db == nil {
		return
	}
	title, content := "动态表情已生成", "你的动态表情已经可以预览和下载。"
	if generation.Status == AIMotionStickerStatusFailed {
		title, content = "动态表情生成失败", generation.ErrorMessage
	}
	extra, _ := json.Marshal(map[string]any{"generationId": generation.ID, "status": generation.Status})
	_ = db.Create(&model.UserNotification{
		UserID: generation.UserID, Type: "ai_motion_sticker", Title: title, Content: content, ExtraData: string(extra),
	}).Error
}

func transcodeMotionSticker(ctx context.Context, mp4 []byte) ([]byte, int, int, error) {
	directory, err := os.MkdirTemp("", "valley-motion-sticker-")
	if err != nil {
		return nil, 0, 0, err
	}
	defer os.RemoveAll(directory)
	inputPath := filepath.Join(directory, "input.mp4")
	outputPath := filepath.Join(directory, "output.gif")
	if err := os.WriteFile(inputPath, mp4, 0o600); err != nil {
		return nil, 0, 0, err
	}
	if err := validateMotionStickerVideo(ctx, inputPath); err != nil {
		return nil, 0, 0, err
	}
	command := exec.CommandContext(ctx, "ffmpeg", motionStickerFFmpegArgs(inputPath, outputPath)...)
	if output, err := command.CombinedOutput(); err != nil {
		return nil, 0, 0, fmt.Errorf("FFmpeg 转码失败: %w: %s", err, strings.TrimSpace(string(output)))
	}
	gifContent, err := os.ReadFile(outputPath)
	if err != nil {
		return nil, 0, 0, err
	}
	config, _, err := image.DecodeConfig(bytes.NewReader(gifContent))
	if err != nil {
		return nil, 0, 0, fmt.Errorf("读取 GIF 尺寸失败: %w", err)
	}
	return gifContent, config.Width, config.Height, nil
}

func encodeMotionStickerFrames(ctx context.Context, frames []motionStickerFrame) ([]byte, int, int, error) {
	if len(frames) < 2 || len(frames) > 15 {
		return nil, 0, 0, fmt.Errorf("动态表情帧数不合法: %d", len(frames))
	}
	directory, err := os.MkdirTemp("", "valley-motion-sticker-frames-")
	if err != nil {
		return nil, 0, 0, err
	}
	defer os.RemoveAll(directory)

	filenames := make([]string, 0, len(frames))
	for index, frame := range frames {
		if len(frame.Content) == 0 || !SupportedAIImageMIME(frame.MIMEType) {
			return nil, 0, 0, fmt.Errorf("第 %d 帧格式无效", index+1)
		}
		filename := fmt.Sprintf("frame-%03d%s", index+1, AIImageExtension(frame.MIMEType))
		if err := os.WriteFile(filepath.Join(directory, filename), frame.Content, 0o600); err != nil {
			return nil, 0, 0, err
		}
		filenames = append(filenames, filename)
	}
	var manifest strings.Builder
	for _, filename := range append(filenames, filenames[0]) {
		fmt.Fprintf(&manifest, "file '%s'\nduration 0.18\n", filename)
	}
	manifestPath := filepath.Join(directory, "frames.txt")
	outputPath := filepath.Join(directory, "output.gif")
	if err := os.WriteFile(manifestPath, []byte(manifest.String()), 0o600); err != nil {
		return nil, 0, 0, err
	}
	command := exec.CommandContext(ctx, "ffmpeg", motionStickerFrameFFmpegArgs(manifestPath, outputPath)...)
	if output, err := command.CombinedOutput(); err != nil {
		return nil, 0, 0, fmt.Errorf("FFmpeg 帧序列编码失败: %w: %s", err, strings.TrimSpace(string(output)))
	}
	gifContent, err := os.ReadFile(outputPath)
	if err != nil {
		return nil, 0, 0, err
	}
	config, _, err := image.DecodeConfig(bytes.NewReader(gifContent))
	if err != nil {
		return nil, 0, 0, fmt.Errorf("读取 GIF 尺寸失败: %w", err)
	}
	return gifContent, config.Width, config.Height, nil
}

func validateMotionStickerVideo(ctx context.Context, inputPath string) error {
	command := exec.CommandContext(ctx, "ffprobe", "-v", "error", "-show_entries", "format=duration", "-show_entries", "stream=codec_type,width,height", "-of", "json", inputPath)
	output, err := command.Output()
	if err != nil {
		return fmt.Errorf("FFprobe 校验失败，请确认已安装 FFmpeg: %w", err)
	}
	var probe struct {
		Streams []struct {
			CodecType string `json:"codec_type"`
			Width     int    `json:"width"`
			Height    int    `json:"height"`
		} `json:"streams"`
		Format struct {
			Duration string `json:"duration"`
		} `json:"format"`
	}
	if err := json.Unmarshal(output, &probe); err != nil {
		return fmt.Errorf("解析 FFprobe 输出失败: %w", err)
	}
	duration, _ := strconv.ParseFloat(probe.Format.Duration, 64)
	if duration <= 0 || duration > 15 {
		return fmt.Errorf("视频时长不合法: %.2f 秒", duration)
	}
	for _, stream := range probe.Streams {
		if stream.CodecType == "video" && stream.Width > 0 && stream.Height > 0 && stream.Width <= 4096 && stream.Height <= 4096 {
			return nil
		}
	}
	return errors.New("视频缺少可用的视频流或尺寸过大")
}

func truncateMotionStickerError(message string) string {
	runes := []rune(strings.TrimSpace(message))
	if len(runes) > 500 {
		runes = runes[:500]
	}
	return string(runes)
}
