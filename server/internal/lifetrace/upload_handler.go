package lifetrace

import (
	"fmt"
	"net/http"
	"time"
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
		fail(c, http.StatusBadRequest, err.Error())
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
