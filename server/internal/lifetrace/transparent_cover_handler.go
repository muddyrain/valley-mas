package lifetrace

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

const (
	removeBGDefaultAPIURL = "https://api.remove.bg/v1.0/removebg"
	removeBGTimeout       = 15 * time.Second
)

type transparentCoverRequest struct {
	ImageURL string `json:"imageUrl"`
}

type removeBGConfig struct {
	APIKey string
	APIURL string
	Size   string
}

func (h *Handler) GenerateTransparentCover(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok || userID == 0 {
		c.JSON(http.StatusUnauthorized, apiResponse{Code: http.StatusUnauthorized, Message: "未登录"})
		return
	}

	var req transparentCoverRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, apiResponse{Code: http.StatusBadRequest, Message: "请求内容不正确"})
		return
	}

	imageURL := strings.TrimSpace(req.ImageURL)
	if imageURL == "" {
		c.JSON(http.StatusBadRequest, apiResponse{Code: http.StatusBadRequest, Message: "缺少商品图片"})
		return
	}

	cfg, errMsg := readRemoveBGConfig()
	if errMsg != "" {
		c.JSON(http.StatusServiceUnavailable, apiResponse{Code: http.StatusServiceUnavailable, Message: errMsg})
		return
	}

	removeCtx, cancel := context.WithTimeout(c.Request.Context(), removeBGTimeout)
	defer cancel()

	image, err := generateTransparentCoverWithRemoveBG(removeCtx, cfg, imageURL)
	if err != nil {
		c.JSON(http.StatusBadGateway, apiResponse{Code: http.StatusBadGateway, Message: "透明封面生成失败：" + err.Error()})
		return
	}

	uploaded, uploadErr := uploadGeneratedPantryThumbnailToTOS(removeCtx, userID, image)
	if uploadErr != nil {
		status := http.StatusBadGateway
		if strings.Contains(uploadErr.Error(), "未配置") || strings.Contains(uploadErr.Error(), "not initialized") {
			status = http.StatusServiceUnavailable
		}
		c.JSON(status, apiResponse{Code: status, Message: "透明封面上传失败：" + uploadErr.Error()})
		return
	}

	success(c, gin.H{
		"thumbnailUrl": uploaded.URL,
		"storageKey":   uploaded.Key,
		"source":       "remove-bg",
		"tool":         "remove.bg",
		"size":         cfg.Size,
		"format":       "png",
	})
}

func readRemoveBGConfig() (removeBGConfig, string) {
	apiKey := strings.TrimSpace(os.Getenv("REMOVE_BG_API_KEY"))
	if apiKey == "" {
		return removeBGConfig{}, "透明封面未配置：缺少 REMOVE_BG_API_KEY"
	}

	apiURL := strings.TrimSpace(os.Getenv("REMOVE_BG_API_URL"))
	if apiURL == "" {
		apiURL = removeBGDefaultAPIURL
	}

	size := strings.TrimSpace(os.Getenv("REMOVE_BG_SIZE"))
	if size == "" {
		size = "preview"
	}

	return removeBGConfig{APIKey: apiKey, APIURL: apiURL, Size: size}, ""
}

func generateTransparentCoverWithRemoveBG(
	ctx context.Context,
	cfg removeBGConfig,
	imageURL string,
) (generatedPantryThumbnail, error) {
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	if err := writer.WriteField("image_url", imageURL); err != nil {
		return generatedPantryThumbnail{}, err
	}
	if err := writer.WriteField("size", cfg.Size); err != nil {
		return generatedPantryThumbnail{}, err
	}
	if err := writer.WriteField("format", "png"); err != nil {
		return generatedPantryThumbnail{}, err
	}
	if err := writer.Close(); err != nil {
		return generatedPantryThumbnail{}, err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, cfg.APIURL, &body)
	if err != nil {
		return generatedPantryThumbnail{}, err
	}
	req.Header.Set("X-Api-Key", cfg.APIKey)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	req.Header.Set("Accept", "image/png")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return generatedPantryThumbnail{}, err
	}
	defer resp.Body.Close()

	data, err := io.ReadAll(io.LimitReader(resp.Body, 12<<20))
	if err != nil {
		return generatedPantryThumbnail{}, err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return generatedPantryThumbnail{}, fmt.Errorf("remove.bg 返回状态 %d", resp.StatusCode)
	}
	if len(data) == 0 {
		return generatedPantryThumbnail{}, fmt.Errorf("remove.bg 返回空图片")
	}

	return generatedPantryThumbnail{
		Bytes:     data,
		MIMEType:  "image/png",
		ModelName: "remove.bg",
	}, nil
}
