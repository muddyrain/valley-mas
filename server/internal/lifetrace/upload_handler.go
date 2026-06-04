package lifetrace

import (
	"fmt"
	"net/http"
	"strings"
	"time"
	"valley-server/internal/logger"
	"valley-server/internal/service"

	"github.com/gin-gonic/gin"
)

func (h *Handler) UploadImage(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		fail(c, http.StatusUnauthorized, "未登录")
		return
	}

	file, err := c.FormFile("file")
	if err != nil {
		fail(c, http.StatusBadRequest, "请上传图片")
		return
	}

	uploadService := service.NewUploadService()
	config := service.GetDefaultConfig(service.UploadTypeLifeTrace)
	config.UserID = int64(userID)
	config.CustomFolder = fmt.Sprintf("life-trace/%s/%s", userID.String(), time.Now().Format("20060102"))

	result, err := uploadService.UploadWithContext(c.Request.Context(), file, config)
	if err != nil {
		if logger.Log != nil {
			logger.Log.WithField("error", err).Warn("LifeTrace image upload failed")
		}
		fail(c, http.StatusBadRequest, publicLifeTraceUploadErrorMessage(err))
		return
	}

	success(c, gin.H{
		"url":         result.URL,
		"storageKey":  result.Key,
		"fileName":    result.FileName,
		"size":        result.Size,
		"width":       result.Width,
		"height":      result.Height,
		"extension":   result.Ext,
		"contentType": file.Header.Get("Content-Type"),
	})
}

func publicLifeTraceUploadErrorMessage(err error) string {
	if err == nil {
		return "图片上传失败，请稍后再试。"
	}

	message := strings.TrimSpace(err.Error())
	if message == "" {
		return "图片上传失败，请稍后再试。"
	}

	for _, safeFragment := range []string{
		"文件上传服务未配置",
		"不支持的文件类型",
		"文件过大",
	} {
		if strings.Contains(message, safeFragment) {
			return message
		}
	}

	lowerMessage := strings.ToLower(message)
	if strings.Contains(lowerMessage, "timeout") ||
		strings.Contains(lowerMessage, "i/o timeout") ||
		strings.Contains(lowerMessage, "deadline exceeded") ||
		strings.Contains(lowerMessage, "request error") ||
		strings.Contains(lowerMessage, "failed to upload to tos") ||
		strings.Contains(lowerMessage, "dial tcp") {
		return "图片上传失败，请检查网络后重试。"
	}

	return "图片上传失败，请稍后再试。"
}
