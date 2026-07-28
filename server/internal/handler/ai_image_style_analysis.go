package handler

import (
	"errors"
	"io"
	"net/http"
	"strings"

	"valley-server/internal/aimodel"
	"valley-server/internal/database"
	"valley-server/internal/service"

	"github.com/gin-gonic/gin"
)

func CreateAIImageStyleAnalysis(c *gin.Context) {
	userID, ok := currentAIAppUser(c)
	if !ok {
		return
	}
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, service.MaxAIImageStyleAnalysisRequestBytes)
	if err := c.Request.ParseMultipartForm(2 << 20); err != nil {
		Error(c, http.StatusBadRequest, "图片上传无效或总大小超过限制")
		return
	}
	if c.Request.MultipartForm != nil {
		defer c.Request.MultipartForm.RemoveAll()
	} else {
		Error(c, http.StatusBadRequest, "请选择图片")
		return
	}
	modelID := strings.TrimSpace(c.PostForm("modelId"))
	if modelID == "" {
		Error(c, http.StatusBadRequest, "请选择图片理解模型")
		return
	}
	files := c.Request.MultipartForm.File["images"]
	if len(files) == 0 || len(files) > service.MaxAIImageStyleAnalysisImages {
		Error(c, http.StatusBadRequest, "请选择 1-9 张图片")
		return
	}
	images := make([]service.AIImageStyleAnalysisImage, 0, len(files))
	for _, fileHeader := range files {
		if fileHeader.Size <= 0 || fileHeader.Size > service.MaxAIImageStyleAnalysisImageBytes {
			Error(c, http.StatusBadRequest, "单张图片不能超过 20MB")
			return
		}
		file, err := fileHeader.Open()
		if err != nil {
			Error(c, http.StatusBadRequest, "读取图片失败")
			return
		}
		content, readErr := io.ReadAll(io.LimitReader(file, service.MaxAIImageStyleAnalysisImageBytes+1))
		closeErr := file.Close()
		if readErr != nil || closeErr != nil || len(content) == 0 || len(content) > service.MaxAIImageStyleAnalysisImageBytes {
			Error(c, http.StatusBadRequest, "读取图片失败")
			return
		}
		mimeType := http.DetectContentType(content)
		if !service.SupportedAIImageMIME(mimeType) {
			Error(c, http.StatusBadRequest, "图片格式必须是 JPG、PNG 或 WebP")
			return
		}
		images = append(images, service.AIImageStyleAnalysisImage{Content: content, MIMEType: mimeType})
	}
	result, err := service.NewAIImageStyleAnalysisService(database.GetDB()).Analyze(c.Request.Context(), service.AIImageStyleAnalysisInput{
		UserID:  userID,
		ModelID: modelID,
		Images:  images,
		Hint:    c.PostForm("hint"),
	})
	if err != nil {
		var inputErr *service.AIImageStyleAnalysisInputError
		switch {
		case errors.As(err, &inputErr):
			Error(c, http.StatusBadRequest, inputErr.Error())
		case errors.Is(err, aimodel.ErrModelNotAvailable):
			Error(c, http.StatusBadRequest, "所选模型不可用或不支持图片理解")
		case strings.Contains(err.Error(), "未配置"):
			Error(c, http.StatusServiceUnavailable, err.Error())
		default:
			Error(c, http.StatusBadGateway, "图片风格识别失败，请稍后重试")
		}
		return
	}
	Success(c, result)
}
