package handler

import (
	"bytes"
	"fmt"
	"image"
	_ "image/jpeg"
	_ "image/png"
	"io"
	"net/http"
	"net/url"
	"path"
	"strings"
	"time"
	"valley-server/internal/service"
	"valley-server/internal/utils"

	"github.com/gin-gonic/gin"
)

// AdminUploadBlogCover uploads blog cover file directly.
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
		Error(c, http.StatusBadRequest, "please upload a cover image")
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

type uploadBlogCoverByURLRequest struct {
	URL string `json:"url" binding:"required"`
}

func isAllowedRemoteCoverHost(host string) bool {
	host = strings.ToLower(strings.TrimSpace(host))
	if host == "" {
		return false
	}
	return strings.HasSuffix(host, ".volces.com") || strings.HasSuffix(host, ".volces.com.cn")
}

func pickImageExt(contentType, remotePath string) string {
	ct := strings.ToLower(strings.TrimSpace(strings.Split(contentType, ";")[0]))
	switch ct {
	case "image/jpeg":
		return ".jpg"
	case "image/png":
		return ".png"
	case "image/webp":
		return ".webp"
	}

	ext := strings.ToLower(path.Ext(remotePath))
	switch ext {
	case ".jpg", ".jpeg", ".png", ".webp":
		if ext == ".jpeg" {
			return ".jpg"
		}
		return ext
	default:
		return ".jpg"
	}
}

// AdminUploadBlogCoverByURL downloads a remote image on backend and uploads to TOS.
// POST /admin/blog/cover/upload-by-url
func AdminUploadBlogCoverByURL(c *gin.Context) {
	userID, role, ok := currentUser(c)
	if !ok {
		Error(c, http.StatusUnauthorized, "unauthorized")
		return
	}
	if role != "admin" && role != "creator" {
		Error(c, http.StatusForbidden, "creator required")
		return
	}

	var req uploadBlogCoverByURLRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		Error(c, http.StatusBadRequest, "invalid request: "+err.Error())
		return
	}

	remoteURL := strings.TrimSpace(req.URL)
	parsedURL, err := url.Parse(remoteURL)
	if err != nil || parsedURL == nil || parsedURL.Scheme != "https" || parsedURL.Host == "" {
		Error(c, http.StatusBadRequest, "invalid cover URL: only https is supported")
		return
	}
	if !isAllowedRemoteCoverHost(parsedURL.Hostname()) {
		Error(c, http.StatusBadRequest, "cover URL host is not allowed")
		return
	}

	uploadConfig := service.GetDefaultConfig(service.UploadTypeCover)
	maxBytes := uploadConfig.MaxSize * 1024 * 1024

	httpClient := &http.Client{Timeout: 45 * time.Second}
	resp, err := httpClient.Get(remoteURL)
	if err != nil {
		Error(c, http.StatusBadGateway, "failed to download remote cover")
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		Error(c, http.StatusBadGateway, "remote cover is not accessible")
		return
	}

	contentType := resp.Header.Get("Content-Type")
	if !strings.HasPrefix(strings.ToLower(strings.TrimSpace(contentType)), "image/") {
		Error(c, http.StatusBadRequest, "remote resource is not an image")
		return
	}

	limited := io.LimitReader(resp.Body, maxBytes+1)
	fileBytes, err := io.ReadAll(limited)
	if err != nil {
		Error(c, http.StatusBadGateway, "failed to read remote cover")
		return
	}
	if int64(len(fileBytes)) > maxBytes {
		Error(c, http.StatusBadRequest, fmt.Sprintf("cover is too large, max %dMB", uploadConfig.MaxSize))
		return
	}

	ext := pickImageExt(contentType, parsedURL.Path)
	virtualFileName := "ai-cover" + ext
	if !utils.ValidateFileType(virtualFileName, uploadConfig.AllowedExts) {
		Error(c, http.StatusBadRequest, "unsupported cover image type")
		return
	}

	uploadConfig.UserID = userID
	uploadConfig.CustomFolder = fmt.Sprintf("blog-covers/%d/%s", userID, time.Now().Format("20060102"))
	uploadService := service.NewUploadService()
	storagePath := uploadService.GenerateStoragePath(uploadConfig, virtualFileName)

	uploader := utils.GetTOSUploader()
	if uploader == nil {
		Error(c, http.StatusServiceUnavailable, "upload service is not initialized")
		return
	}

	uploadedURL, err := uploader.UploadBytesWithPath(storagePath, fileBytes)
	if err != nil {
		Error(c, http.StatusBadGateway, "failed to upload cover to storage")
		return
	}

	width, height := 0, 0
	if cfg, _, err := image.DecodeConfig(bytes.NewReader(fileBytes)); err == nil {
		width = cfg.Width
		height = cfg.Height
	}

	Success(c, gin.H{
		"url":         uploadedURL,
		"storageKey":  storagePath,
		"fileName":    virtualFileName,
		"size":        len(fileBytes),
		"width":       width,
		"height":      height,
		"extension":   ext,
		"contentType": contentType,
	})
}
