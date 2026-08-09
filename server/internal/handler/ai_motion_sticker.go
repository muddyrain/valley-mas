package handler

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"valley-server/internal/aimodel"
	"valley-server/internal/database"
	"valley-server/internal/logger"
	"valley-server/internal/model"
	"valley-server/internal/service"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

const maxAIMotionStickerReferenceBytes = 5 << 20

var (
	aiMotionStickerWorkerOnce sync.Once
	aiMotionStickerWorkerWake = make(chan struct{}, 1)
)

type aiMotionStickerResponse struct {
	model.AIMotionStickerGeneration
	ReferencePreviewURL string `json:"referencePreviewUrl"`
	MP4URL              string `json:"mp4Url,omitempty"`
	GIFURL              string `json:"gifUrl,omitempty"`
}

func motionStickerResponse(generation model.AIMotionStickerGeneration) aiMotionStickerResponse {
	base := "/api/v1/ai/motion-stickers/" + generation.ID.String() + "/content"
	response := aiMotionStickerResponse{
		AIMotionStickerGeneration: generation,
		ReferencePreviewURL:       base + "?format=reference",
	}
	if generation.MP4StorageKey != "" {
		response.MP4URL = base + "?format=mp4"
	}
	if generation.GIFStorageKey != "" {
		response.GIFURL = base + "?format=gif"
	}
	return response
}

func StartAIMotionStickerWorker(ctx context.Context) {
	aiMotionStickerWorkerOnce.Do(func() {
		go func() {
			ticker := time.NewTicker(5 * time.Second)
			defer ticker.Stop()
			for {
				if db := database.GetDB(); db != nil {
					if err := service.NewAIMotionStickerService(db).ProcessPending(ctx); err != nil {
						logger.Log.Warnf("AI motion sticker worker tick failed: %v", err)
					}
				}
				select {
				case <-ctx.Done():
					return
				case <-aiMotionStickerWorkerWake:
				case <-ticker.C:
				}
			}
		}()
	})
}

func notifyAIMotionStickerWorker() {
	select {
	case aiMotionStickerWorkerWake <- struct{}{}:
	default:
	}
}

func ListAIMotionStickerOptions(c *gin.Context) {
	imageItems, err := aimodel.ListEnabledModels(database.GetDB(), "image_generation")
	if err != nil {
		Error(c, http.StatusInternalServerError, "读取生图模型失败")
		return
	}
	imageModels := make([]gin.H, 0, len(imageItems))
	for _, item := range imageItems {
		if !aimodel.HasCapabilities(item, []string{"reference_image"}) {
			continue
		}
		imageProtocol, protocolErr := service.ResolveAIMotionStickerImageProtocol(item)
		if protocolErr != nil {
			continue
		}
		imageModels = append(imageModels, gin.H{
			"id": item.ID.String(), "name": item.DisplayName, "provider": item.Provider,
			"model": item.ModelID, "imageProtocol": imageProtocol,
		})
	}
	videoItems, err := aimodel.ListEnabledModels(database.GetDB(), "video_generation")
	if err != nil {
		Error(c, http.StatusInternalServerError, "读取视频模型失败")
		return
	}
	videoModels := make([]gin.H, 0, len(videoItems))
	for _, item := range videoItems {
		if !aimodel.HasCapabilities(item, []string{"reference_image"}) {
			continue
		}
		videoProtocol, protocolErr := service.ResolveAIMotionStickerVideoProtocol(item)
		if protocolErr != nil {
			continue
		}
		videoModels = append(videoModels, gin.H{
			"id": item.ID.String(), "name": item.DisplayName, "provider": item.Provider,
			"model": item.ModelID, "videoProtocol": videoProtocol,
		})
	}
	Success(c, gin.H{
		"defaultMode": service.AIMotionStickerModeImage,
		"imageModels": imageModels,
		"videoModels": videoModels,
		"defaults": gin.H{
			"durationSeconds": service.AIMotionStickerDurationSeconds, "resolution": service.AIMotionStickerResolution,
			"aspectRatio": service.AIMotionStickerAspectRatio, "gifSize": 320, "frameCount": service.AIMotionStickerFrameCount,
		},
	})
}

func CreateAIMotionStickerGeneration(c *gin.Context) {
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxAIMotionStickerReferenceBytes+(1<<20))
	userID := model.Int64String(GetCurrentUserID(c))
	mode := strings.TrimSpace(c.PostForm("mode"))
	modelID := strings.TrimSpace(c.PostForm("modelId"))
	action := strings.TrimSpace(c.PostForm("action"))
	if modelID == "" || action == "" {
		Error(c, http.StatusBadRequest, "请选择模型并填写动作描述")
		return
	}
	fileHeader, err := c.FormFile("reference")
	if err != nil || fileHeader.Size <= 0 || fileHeader.Size > maxAIMotionStickerReferenceBytes {
		Error(c, http.StatusBadRequest, "请上传不超过 5MB 的参考图片")
		return
	}
	file, err := fileHeader.Open()
	if err != nil {
		Error(c, http.StatusBadRequest, "无法读取参考图片")
		return
	}
	content, readErr := io.ReadAll(io.LimitReader(file, maxAIMotionStickerReferenceBytes+1))
	closeErr := file.Close()
	if readErr != nil || closeErr != nil || len(content) == 0 || len(content) > maxAIMotionStickerReferenceBytes {
		Error(c, http.StatusBadRequest, "参考图片内容无效")
		return
	}
	mimeType := http.DetectContentType(content)
	allowedExtension := map[string]string{"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}
	extension, ok := allowedExtension[mimeType]
	if !ok {
		Error(c, http.StatusBadRequest, "参考图片仅支持 JPG、PNG 或 WebP")
		return
	}

	uploadConfig := service.GetDefaultConfig(service.UploadTypeWallpaper)
	uploadConfig.UserID = int64(userID)
	uploadConfig.MaxSize = 5
	uploadConfig.AllowedExts = []string{".jpg", ".jpeg", ".png", ".webp"}
	uploadConfig.CustomFolder = fmt.Sprintf("motion-stickers/%s/references/%s", userID.String(), time.Now().Format("20060102"))
	stored, err := service.NewUploadService().UploadBytesWithContext(c.Request.Context(), "reference"+extension, content, uploadConfig)
	if err != nil {
		Error(c, http.StatusServiceUnavailable, "参考图片存储失败，请稍后重试")
		return
	}
	generation, err := service.NewAIMotionStickerService(database.GetDB()).Queue(c.Request.Context(), service.AIMotionStickerQueueInput{
		UserID: userID, ModelID: modelID, Mode: mode, Action: action, ReferenceURL: stored.URL, ReferenceStorageKey: stored.Key,
	})
	if err != nil {
		_ = service.NewUploadService().DeleteByKey(stored.Key)
		switch {
		case errors.Is(err, service.ErrAIMotionStickerBusy):
			Error(c, http.StatusConflict, err.Error())
		case errors.Is(err, aimodel.ErrModelNotAvailable):
			Error(c, http.StatusBadRequest, err.Error())
		default:
			Error(c, http.StatusBadRequest, err.Error())
		}
		return
	}
	notifyAIMotionStickerWorker()
	Success(c, motionStickerResponse(generation))
}

func ListAIMotionStickerGenerations(c *gin.Context) {
	userID := model.Int64String(GetCurrentUserID(c))
	var generations []model.AIMotionStickerGeneration
	if err := database.GetDB().Where("user_id = ?", userID).Order("created_at DESC, id DESC").Limit(50).Find(&generations).Error; err != nil {
		Error(c, http.StatusInternalServerError, "读取动态表情记录失败")
		return
	}
	items := make([]aiMotionStickerResponse, 0, len(generations))
	for _, generation := range generations {
		items = append(items, motionStickerResponse(generation))
	}
	Success(c, gin.H{"items": items})
}

func GetAIMotionStickerGeneration(c *gin.Context) {
	generation, err := ownedMotionStickerGeneration(c)
	if err != nil {
		Error(c, http.StatusNotFound, "动态表情不存在")
		return
	}
	Success(c, motionStickerResponse(generation))
}

func GetAIMotionStickerContent(c *gin.Context) {
	generation, err := ownedMotionStickerGeneration(c)
	if err != nil {
		Error(c, http.StatusNotFound, "动态表情不存在")
		return
	}
	format := strings.TrimSpace(c.Query("format"))
	url, contentType, filename := generation.ReferenceURL, "application/octet-stream", "reference"+filepath.Ext(generation.ReferenceStorageKey)
	switch format {
	case "reference":
		switch strings.ToLower(filepath.Ext(filename)) {
		case ".jpg", ".jpeg":
			contentType = "image/jpeg"
		case ".png":
			contentType = "image/png"
		case ".webp":
			contentType = "image/webp"
		}
	case "mp4":
		url, contentType, filename = generation.MP4URL, "video/mp4", generation.ID.String()+".mp4"
	case "gif":
		url, contentType, filename = generation.GIFURL, "image/gif", generation.ID.String()+".gif"
	default:
		Error(c, http.StatusBadRequest, "不支持的文件格式")
		return
	}
	if strings.TrimSpace(url) == "" {
		Error(c, http.StatusNotFound, "文件尚未生成")
		return
	}
	request, err := http.NewRequestWithContext(c.Request.Context(), http.MethodGet, url, nil)
	if err != nil {
		Error(c, http.StatusInternalServerError, "读取文件失败")
		return
	}
	response, err := (&http.Client{Timeout: 90 * time.Second}).Do(request)
	if err != nil || response.StatusCode < 200 || response.StatusCode >= 300 {
		if response != nil {
			response.Body.Close()
		}
		Error(c, http.StatusBadGateway, "读取文件失败")
		return
	}
	defer response.Body.Close()
	if response.ContentLength > 128<<20 {
		Error(c, http.StatusBadGateway, "文件超过读取上限")
		return
	}
	if c.Query("download") == "1" {
		c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=%q", filename))
	}
	c.DataFromReader(http.StatusOK, response.ContentLength, contentType, io.LimitReader(response.Body, 128<<20), nil)
}

func DeleteAIMotionStickerGeneration(c *gin.Context) {
	generation, err := ownedMotionStickerGeneration(c)
	if err != nil {
		Error(c, http.StatusNotFound, "动态表情不存在")
		return
	}
	if generation.Status == service.AIMotionStickerStatusQueued || generation.Status == service.AIMotionStickerStatusRunning {
		Error(c, http.StatusConflict, "生成中的任务不能删除")
		return
	}
	uploader := service.NewUploadService()
	for _, key := range []string{generation.ReferenceStorageKey, generation.MP4StorageKey, generation.GIFStorageKey} {
		if strings.TrimSpace(key) != "" {
			if err := uploader.DeleteByKey(key); err != nil {
				Error(c, http.StatusServiceUnavailable, "删除存储文件失败")
				return
			}
		}
	}
	if err := database.GetDB().Delete(&generation).Error; err != nil {
		Error(c, http.StatusInternalServerError, "删除动态表情失败")
		return
	}
	Success(c, gin.H{"deleted": true})
}

func ownedMotionStickerGeneration(c *gin.Context) (model.AIMotionStickerGeneration, error) {
	var generation model.AIMotionStickerGeneration
	err := database.GetDB().Where("id = ? AND user_id = ?", c.Param("generationId"), GetCurrentUserID(c)).First(&generation).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return model.AIMotionStickerGeneration{}, err
	}
	return generation, err
}
