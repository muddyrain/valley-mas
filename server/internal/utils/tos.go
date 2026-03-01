package utils

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"mime/multipart"
	"path/filepath"
	"strings"
	"time"

	"valley-server/internal/config"

	"github.com/volcengine/ve-tos-golang-sdk/v2/tos"
)

type TOSUploader struct {
	client *tos.ClientV2
	bucket string
}

var tosUploader *TOSUploader

// InitTOS 初始化 TOS 客户端
func InitTOS(cfg *config.TOSConfig) error {
	if cfg.AccessKey == "" || cfg.SecretKey == "" {
		return fmt.Errorf("TOS credentials not configured")
	}

	client, err := tos.NewClientV2(cfg.Endpoint, tos.WithRegion(cfg.Region),
		tos.WithCredentials(tos.NewStaticCredentials(cfg.AccessKey, cfg.SecretKey)))
	if err != nil {
		return fmt.Errorf("failed to create TOS client: %w", err)
	}

	tosUploader = &TOSUploader{
		client: client,
		bucket: cfg.Bucket,
	}

	return nil
}

// GetTOSUploader 获取 TOS 上传器实例
func GetTOSUploader() *TOSUploader {
	return tosUploader
}

// UploadFile 上传文件到 TOS
// folder: 文件夹路径，如 "avatars", "wallpapers"
// file: 上传的文件
// 返回: 文件URL和错误信息
func (u *TOSUploader) UploadFile(folder string, file *multipart.FileHeader) (string, error) {
	if u == nil || u.client == nil {
		return "", fmt.Errorf("TOS uploader not initialized")
	}

	// 打开文件
	src, err := file.Open()
	if err != nil {
		return "", fmt.Errorf("failed to open file: %w", err)
	}
	defer src.Close()

	// 读取文件内容
	fileBytes, err := io.ReadAll(src)
	if err != nil {
		return "", fmt.Errorf("failed to read file: %w", err)
	}

	// 生成唯一文件名
	ext := filepath.Ext(file.Filename)
	fileName := fmt.Sprintf("%s/%d_%s%s", folder, time.Now().UnixNano(), GenerateRandomString(8), ext)

	// 上传到 TOS
	ctx := context.Background()
	input := &tos.PutObjectV2Input{
		PutObjectBasicInput: tos.PutObjectBasicInput{
			Bucket: u.bucket,
			Key:    fileName,
		},
		Content: bytes.NewReader(fileBytes),
	}

	_, err = u.client.PutObjectV2(ctx, input)
	if err != nil {
		return "", fmt.Errorf("failed to upload to TOS: %w", err)
	}

	// 生成公开访问 URL
	// 格式: https://{bucket}.{endpoint}/{key}
	url := u.GetPublicURL(fileName)

	return url, nil
}

// GetPublicURL 获取文件的公开访问 URL
func (u *TOSUploader) GetPublicURL(key string) string {
	// 火山引擎 TOS 公开访问 URL 格式
	// https://{bucket}.{endpoint}/{key}
	return fmt.Sprintf("https://%s.tos-cn-beijing.volces.com/%s", u.bucket, key)
}

// DeleteFile 删除 TOS 上的文件
func (u *TOSUploader) DeleteFile(key string) error {
	if u == nil || u.client == nil {
		return fmt.Errorf("TOS uploader not initialized")
	}

	ctx := context.Background()
	input := &tos.DeleteObjectV2Input{
		Bucket: u.bucket,
		Key:    key,
	}

	_, err := u.client.DeleteObjectV2(ctx, input)
	if err != nil {
		return fmt.Errorf("failed to delete from TOS: %w", err)
	}

	return nil
}

// ExtractKeyFromURL 从完整 URL 中提取文件 key
// 例如: https://bucket.tos-cn-beijing.volces.com/avatars/123.png -> avatars/123.png
func (u *TOSUploader) ExtractKeyFromURL(url string) string {
	prefix := fmt.Sprintf("https://%s.tos-cn-beijing.volces.com/", u.bucket)
	return strings.TrimPrefix(url, prefix)
}

// ValidateFileType 验证文件类型
func ValidateFileType(filename string, allowedTypes []string) bool {
	ext := strings.ToLower(filepath.Ext(filename))
	for _, allowed := range allowedTypes {
		if ext == allowed {
			return true
		}
	}
	return false
}

// ValidateFileSize 验证文件大小（单位：MB）
func ValidateFileSize(size int64, maxSizeMB int64) bool {
	maxBytes := maxSizeMB * 1024 * 1024
	return size <= maxBytes
}
