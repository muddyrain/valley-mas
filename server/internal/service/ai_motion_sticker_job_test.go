package service

import (
	"context"
	"errors"
	"fmt"
	"testing"
	"time"

	"valley-server/internal/aiclient"
	"valley-server/internal/aimodel"
	"valley-server/internal/model"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

type fakeMotionStickerVideoClient struct {
	created bool
}

type fakeMotionStickerImageClient struct {
	request aiclient.ImageGenerationRequest
	result  aiclient.ImageGenerationResult
}

func (client *fakeMotionStickerImageClient) GenerateImageResult(
	_ context.Context,
	request aiclient.ImageGenerationRequest,
) (aiclient.ImageGenerationResult, error) {
	client.request = request
	return client.result, nil
}

func (client *fakeMotionStickerVideoClient) CreateVideo(context.Context, aiclient.VideoGenerationRequest) (aiclient.VideoTask, error) {
	client.created = true
	return aiclient.VideoTask{ID: "provider-task", Status: aiclient.VideoTaskQueued}, nil
}

func (client *fakeMotionStickerVideoClient) GetVideoTask(context.Context, string) (aiclient.VideoTask, error) {
	return aiclient.VideoTask{ID: "provider-task", Status: aiclient.VideoTaskSucceeded}, nil
}

func (client *fakeMotionStickerVideoClient) DownloadVideo(context.Context, string, int64) ([]byte, string, error) {
	return []byte("mp4"), "video/mp4", nil
}

func TestAIMotionStickerQueueAllowsOnlyOneActiveJobPerOwner(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(fmt.Sprintf("file:motion-sticker-%s?mode=memory&cache=shared", t.Name())), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(&model.User{}, &model.AIModel{}, &model.AIMotionStickerGeneration{}); err != nil {
		t.Fatal(err)
	}
	t.Setenv("AMUX_API_KEY", "test-key")
	t.Setenv("AMUX_BASE_URL", "https://api.amux.test/v1")

	firstOwner := model.User{ID: 101, Username: "motion-owner-1", OpenID: "motion-owner-1", IsActive: true}
	secondOwner := model.User{ID: 102, Username: "motion-owner-2", OpenID: "motion-owner-2", IsActive: true}
	if err := db.Create(&[]model.User{firstOwner, secondOwner}).Error; err != nil {
		t.Fatal(err)
	}
	videoModel := model.AIModel{
		ID: 201, Provider: "amux", ModelID: "doubao-seedance-2.0-fast", DisplayName: "Seedance Fast",
		Capabilities:  aimodel.EncodeStrings([]string{"video_generation", "reference_image"}),
		VideoProtocol: "auto", Enabled: true,
	}
	if err := db.Create(&videoModel).Error; err != nil {
		t.Fatal(err)
	}

	service := NewAIMotionStickerService(db)
	first, err := service.Queue(context.Background(), AIMotionStickerQueueInput{
		UserID: firstOwner.ID, ModelID: videoModel.ID.String(), Mode: AIMotionStickerModeVideo, Action: "跳一下",
		ReferenceURL: "https://cdn.test/one.png", ReferenceStorageKey: "motion/one.png",
	})
	if err != nil {
		t.Fatal(err)
	}
	if first.Status != AIMotionStickerStatusQueued || first.Provider != "amux" || first.VideoProtocol != "amux_video" {
		t.Fatalf("unexpected first job: %+v", first)
	}
	_, err = service.Queue(context.Background(), AIMotionStickerQueueInput{
		UserID: firstOwner.ID, ModelID: videoModel.ID.String(), Mode: AIMotionStickerModeVideo, Action: "挥手",
		ReferenceURL: "https://cdn.test/two.png", ReferenceStorageKey: "motion/two.png",
	})
	if !errors.Is(err, ErrAIMotionStickerBusy) {
		t.Fatalf("expected busy error, got %v", err)
	}
	if _, err := service.Queue(context.Background(), AIMotionStickerQueueInput{
		UserID: secondOwner.ID, ModelID: videoModel.ID.String(), Mode: AIMotionStickerModeVideo, Action: "点头",
		ReferenceURL: "https://cdn.test/three.png", ReferenceStorageKey: "motion/three.png",
	}); err != nil {
		t.Fatalf("different owner should be allowed: %v", err)
	}
}

func TestAIMotionStickerQueueRequiresReferenceCapableVideoModel(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(fmt.Sprintf("file:motion-sticker-model-%s?mode=memory&cache=shared", t.Name())), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(&model.User{}, &model.AIModel{}, &model.AIMotionStickerGeneration{}); err != nil {
		t.Fatal(err)
	}
	t.Setenv("AMUX_API_KEY", "test-key")
	owner := model.User{ID: 301, Username: "motion-owner", OpenID: "motion-owner", IsActive: true}
	if err := db.Create(&owner).Error; err != nil {
		t.Fatal(err)
	}
	staticModel := model.AIModel{
		ID: 302, Provider: "amux", ModelID: "gpt-image-2", DisplayName: "Static",
		Capabilities: aimodel.EncodeStrings([]string{"image_generation", "reference_image"}), Enabled: true,
	}
	if err := db.Create(&staticModel).Error; err != nil {
		t.Fatal(err)
	}
	_, err = NewAIMotionStickerService(db).Queue(context.Background(), AIMotionStickerQueueInput{
		UserID: owner.ID, ModelID: staticModel.ID.String(), Mode: AIMotionStickerModeVideo, Action: "跳一下",
		ReferenceURL: "https://cdn.test/ref.png", ReferenceStorageKey: "motion/ref.png",
	})
	if !errors.Is(err, aimodel.ErrModelNotAvailable) {
		t.Fatalf("expected model capability rejection, got %v", err)
	}
}

func TestAIMotionStickerQueueRejectsUnsupportedVideoProvider(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(fmt.Sprintf("file:motion-sticker-provider-%s?mode=memory&cache=shared", t.Name())), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(&model.User{}, &model.AIModel{}, &model.AIMotionStickerGeneration{}); err != nil {
		t.Fatal(err)
	}
	t.Setenv("SILICONFLOW_API_KEY", "test-key")
	owner := model.User{ID: 311, Username: "motion-provider-owner", OpenID: "motion-provider-owner", IsActive: true}
	if err := db.Create(&owner).Error; err != nil {
		t.Fatal(err)
	}
	unsupported := model.AIModel{
		ID: 312, Provider: "siliconflow", ModelID: "doubao-seedance-2.0-fast", DisplayName: "Wrong Seedance",
		Capabilities:  aimodel.EncodeStrings([]string{"video_generation", "reference_image"}),
		VideoProtocol: "auto", Enabled: true,
	}
	if err := db.Create(&unsupported).Error; err != nil {
		t.Fatal(err)
	}

	_, err = NewAIMotionStickerService(db).Queue(context.Background(), AIMotionStickerQueueInput{
		UserID: owner.ID, ModelID: unsupported.ID.String(), Mode: AIMotionStickerModeVideo, Action: "跳一下",
		ReferenceURL: "https://cdn.test/ref.png", ReferenceStorageKey: "motion/ref.png",
	})
	if !errors.Is(err, aimodel.ErrModelNotAvailable) {
		t.Fatalf("expected unsupported video provider rejection, got %v", err)
	}
}

func TestAIMotionStickerQueueDefaultsToReferenceCapableImageModel(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(fmt.Sprintf("file:motion-sticker-image-%s?mode=memory&cache=shared", t.Name())), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(&model.User{}, &model.AIModel{}, &model.AIMotionStickerGeneration{}); err != nil {
		t.Fatal(err)
	}
	t.Setenv("VOLCENGINE_API_KEY", "test-key")
	owner := model.User{ID: 321, Username: "motion-image-owner", OpenID: "motion-image-owner", IsActive: true}
	imageModel := model.AIModel{
		ID: 322, Provider: "volcengine", ModelID: "doubao-seedream-5-0-260128", DisplayName: "Seedream 5",
		Capabilities:  aimodel.EncodeStrings([]string{"image_generation", "reference_image"}),
		ImageProtocol: "auto", Enabled: true,
	}
	if err := db.Create(&owner).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&imageModel).Error; err != nil {
		t.Fatal(err)
	}

	generation, err := NewAIMotionStickerService(db).Queue(context.Background(), AIMotionStickerQueueInput{
		UserID: owner.ID, ModelID: imageModel.ID.String(), Action: "跳一下",
		ReferenceURL: "https://cdn.test/ref.png", ReferenceStorageKey: "motion/ref.png",
	})
	if err != nil {
		t.Fatal(err)
	}
	if generation.GenerationMode != AIMotionStickerModeImage || generation.ImageProtocol != "ark_images" || generation.FrameCount != AIMotionStickerFrameCount {
		t.Fatalf("unexpected image generation: %+v", generation)
	}
}

func TestAIMotionStickerImageProcessPersistsGIFWithoutMP4(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(fmt.Sprintf("file:motion-sticker-image-process-%s?mode=memory&cache=shared", t.Name())), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(&model.AIMotionStickerGeneration{}); err != nil {
		t.Fatal(err)
	}
	generation := model.AIMotionStickerGeneration{
		UserID: 331, ModelCatalogID: 332, Provider: "volcengine", Model: "doubao-seedream-5-0-260128",
		GenerationMode: AIMotionStickerModeImage, ImageProtocol: "ark_images", FrameCount: 3,
		Action: "跳一下", Prompt: CompileAIMotionStickerImagePrompt("跳一下", 3), ReferenceURL: "https://cdn.test/ref.png", ReferenceStorageKey: "motion/ref.png",
	}
	if err := db.Create(&generation).Error; err != nil {
		t.Fatal(err)
	}
	client := &fakeMotionStickerImageClient{result: aiclient.ImageGenerationResult{Sources: []string{"frame-1", "frame-2", "frame-3"}}}
	service := NewAIMotionStickerService(db)
	service.imageClient = func(model.AIMotionStickerGeneration) (motionStickerImageClient, error) { return client, nil }
	service.fetchImage = func(_ context.Context, source string) ([]byte, string, error) {
		return []byte(source), "image/png", nil
	}
	service.validateFrames = func(motionStickerFrame, []motionStickerFrame) error { return nil }
	service.encodeFrames = func(_ context.Context, frames []motionStickerFrame) ([]byte, int, int, error) {
		if len(frames) != 3 {
			t.Fatalf("frames = %d", len(frames))
		}
		return []byte("gif"), 320, 320, nil
	}
	service.upload = func(_ context.Context, _ model.Int64String, filename string, content []byte) (*UploadResult, error) {
		return &UploadResult{URL: "https://cdn.test/" + filename, Key: "motion/" + filename, Size: int64(len(content))}, nil
	}
	service.notify = func(model.AIMotionStickerGeneration) {}

	if err := service.ProcessOne(context.Background(), generation.ID); err != nil {
		t.Fatal(err)
	}
	if err := db.First(&generation, generation.ID).Error; err != nil {
		t.Fatal(err)
	}
	if generation.Status != AIMotionStickerStatusSucceeded || generation.GIFStorageKey == "" || generation.MP4StorageKey != "" {
		t.Fatalf("unexpected image result: %+v", generation)
	}
	if client.request.OutputCount != 3 || len(client.request.Images) != 1 {
		t.Fatalf("unexpected image request: %+v", client.request)
	}
}

func TestAIMotionStickerImageProcessRejectsIdentityMismatchBeforeEncoding(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(fmt.Sprintf("file:motion-sticker-identity-%s?mode=memory&cache=shared", t.Name())), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(&model.AIMotionStickerGeneration{}); err != nil {
		t.Fatal(err)
	}
	generation := model.AIMotionStickerGeneration{
		UserID: 351, ModelCatalogID: 352, Provider: "volcengine", Model: "doubao-seedream-5-0-260128",
		GenerationMode: AIMotionStickerModeImage, ImageProtocol: "ark_images", FrameCount: 3,
		Action: "坐在沙发上玩手机", Prompt: CompileAIMotionStickerImagePrompt("坐在沙发上玩手机", 3),
		ReferenceURL: "https://cdn.test/ref.png", ReferenceStorageKey: "motion/ref.png",
	}
	if err := db.Create(&generation).Error; err != nil {
		t.Fatal(err)
	}
	client := &fakeMotionStickerImageClient{result: aiclient.ImageGenerationResult{Sources: []string{"frame-1", "frame-2", "frame-3"}}}
	service := NewAIMotionStickerService(db)
	service.imageClient = func(model.AIMotionStickerGeneration) (motionStickerImageClient, error) { return client, nil }
	service.fetchImage = func(_ context.Context, source string) ([]byte, string, error) {
		return []byte(source), "image/png", nil
	}
	service.validateFrames = func(motionStickerFrame, []motionStickerFrame) error {
		return errors.New("生成结果中的角色与参考图不一致")
	}
	service.encodeFrames = func(context.Context, []motionStickerFrame) ([]byte, int, int, error) {
		t.Fatal("identity mismatch must stop before GIF encoding")
		return nil, 0, 0, nil
	}
	service.notify = func(model.AIMotionStickerGeneration) {}

	if err := service.ProcessOne(context.Background(), generation.ID); err == nil {
		t.Fatal("identity mismatch must fail the generation")
	}
	if err := db.First(&generation, generation.ID).Error; err != nil {
		t.Fatal(err)
	}
	if generation.Status != AIMotionStickerStatusFailed || generation.ErrorCode != "identity_mismatch" {
		t.Fatalf("unexpected identity mismatch result: %+v", generation)
	}
}

func TestAIMotionStickerImageProcessDoesNotRebillStaleRunningJob(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(fmt.Sprintf("file:motion-sticker-image-stale-%s?mode=memory&cache=shared", t.Name())), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(&model.AIMotionStickerGeneration{}); err != nil {
		t.Fatal(err)
	}
	generation := model.AIMotionStickerGeneration{
		UserID: 341, ModelCatalogID: 342, Provider: "volcengine", Model: "doubao-seedream-5-0-260128",
		GenerationMode: AIMotionStickerModeImage, ImageProtocol: "ark_images", FrameCount: 3,
		Action: "跳一下", Prompt: "prompt", ReferenceURL: "https://cdn.test/ref.png", ReferenceStorageKey: "motion/ref.png",
		Status: AIMotionStickerStatusRunning, Stage: "generating_frames",
	}
	if err := db.Create(&generation).Error; err != nil {
		t.Fatal(err)
	}
	staleAt := time.Now().Add(-aiMotionStickerImageRetryAge - time.Minute)
	if err := db.Model(&generation).UpdateColumn("updated_at", staleAt).Error; err != nil {
		t.Fatal(err)
	}
	clientCreated := false
	service := NewAIMotionStickerService(db)
	service.imageClient = func(model.AIMotionStickerGeneration) (motionStickerImageClient, error) {
		clientCreated = true
		return &fakeMotionStickerImageClient{}, nil
	}
	service.notify = func(model.AIMotionStickerGeneration) {}

	err = service.ProcessOne(context.Background(), generation.ID)
	if err == nil {
		t.Fatal("stale image generation must surface an uncertain-state failure")
	}
	if clientCreated {
		t.Fatal("stale image generation must not call the billable provider again")
	}
	if err := db.First(&generation, generation.ID).Error; err != nil {
		t.Fatal(err)
	}
	if generation.Status != AIMotionStickerStatusFailed || generation.ErrorCode != "generation_state_lost" {
		t.Fatalf("unexpected stale image result: %+v", generation)
	}
}

func TestAIMotionStickerProcessPersistsMP4AndGIF(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(fmt.Sprintf("file:motion-sticker-process-%s?mode=memory&cache=shared", t.Name())), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(&model.AIMotionStickerGeneration{}); err != nil {
		t.Fatal(err)
	}
	generation := model.AIMotionStickerGeneration{
		UserID: 401, ModelCatalogID: 402, Provider: "amux", Model: "doubao-seedance-2.0-fast", VideoProtocol: "amux_video",
		Action: "跳一下", Prompt: CompileAIMotionStickerPrompt("跳一下"), ReferenceURL: "https://cdn.test/ref.png", ReferenceStorageKey: "motion/ref.png",
	}
	if err := db.Create(&generation).Error; err != nil {
		t.Fatal(err)
	}
	client := &fakeMotionStickerVideoClient{}
	service := NewAIMotionStickerService(db)
	service.videoClient = func(model.AIMotionStickerGeneration) (motionStickerVideoClient, error) { return client, nil }
	service.transcode = func(context.Context, []byte) ([]byte, int, int, error) { return []byte("gif"), 320, 320, nil }
	service.upload = func(_ context.Context, _ model.Int64String, filename string, content []byte) (*UploadResult, error) {
		return &UploadResult{URL: "https://cdn.test/" + filename, Key: "motion/" + filename, Size: int64(len(content))}, nil
	}
	service.notify = func(model.AIMotionStickerGeneration) {}

	if err := service.ProcessOne(context.Background(), generation.ID); err != nil {
		t.Fatal(err)
	}
	if err := service.ProcessOne(context.Background(), generation.ID); err != nil {
		t.Fatal(err)
	}
	if err := db.First(&generation, generation.ID).Error; err != nil {
		t.Fatal(err)
	}
	if !client.created || generation.Status != AIMotionStickerStatusSucceeded || generation.MP4StorageKey == "" || generation.GIFStorageKey == "" {
		t.Fatalf("unexpected processed generation: %+v", generation)
	}
}

func TestAIMotionStickerProcessDoesNotDuplicateRecentSubmission(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(fmt.Sprintf("file:motion-sticker-claim-%s?mode=memory&cache=shared", t.Name())), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(&model.AIMotionStickerGeneration{}); err != nil {
		t.Fatal(err)
	}
	generation := model.AIMotionStickerGeneration{
		UserID: 501, ModelCatalogID: 502, Provider: "amux", Model: "seedance", VideoProtocol: "amux_video",
		Action: "跳一下", Prompt: "prompt", ReferenceURL: "https://cdn.test/ref.png", ReferenceStorageKey: "ref",
		Status: AIMotionStickerStatusRunning, Stage: "submitting",
	}
	if err := db.Create(&generation).Error; err != nil {
		t.Fatal(err)
	}
	client := &fakeMotionStickerVideoClient{}
	service := NewAIMotionStickerService(db)
	service.videoClient = func(model.AIMotionStickerGeneration) (motionStickerVideoClient, error) { return client, nil }
	if err := service.ProcessOne(context.Background(), generation.ID); err != nil {
		t.Fatal(err)
	}
	if client.created {
		t.Fatal("recent submitting job must not be submitted twice")
	}
}
