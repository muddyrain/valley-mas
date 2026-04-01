package handler

import (
	"fmt"
	"net/http"
	"time"
	"valley-server/internal/service"

	"github.com/gin-gonic/gin"
)

// AdminUploadBlogCover 上传博客封面（仅上传文件，不写 resources 表）
func AdminUploadBlogCover(c *gin.Context) {
	userID, role, ok := currentUser(c)
	if !ok {
		Error(c, http.StatusUnauthorized, "unauthorized")
		return
	}
	if role != "admin" && role != "creator" {
		Error(c, http.StatusForbidden, "creator required")
		return
	}

	file, err := c.FormFile("file")
	if err != nil {
		Error(c, http.StatusBadRequest, "请上传封面图片")
		return
	}

	uploadService := service.NewUploadService()
	config := service.GetDefaultConfig(service.UploadTypeCover)
	config.UserID = userID
	config.CustomFolder = fmt.Sprintf("blog-covers/%d/%s", userID, time.Now().Format("20060102"))

	result, err := uploadService.Upload(file, config)
	if err != nil {
		Error(c, http.StatusBadRequest, err.Error())
		return
	}

	Success(c, gin.H{
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
