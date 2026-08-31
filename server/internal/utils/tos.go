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
	"github.com/volcengine/ve-tos-golang-sdk/v2/tos/enum"
)

type TOSUploader struct {
	client *tos.ClientV2
	bucket string
}

type TOSSignedURL struct {
	URL     string
	Headers map[string]string
}

type TOSObjectInfo struct {
	Size int64
	ETag string
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

	// 生成唯一文件名
	ext := filepath.Ext(file.Filename)
	fileName := fmt.Sprintf("%s/%d_%s%s", folder, time.Now().UnixNano(), GenerateRandomString(8), ext)

	return u.UploadFileWithPath(fileName, file)
}

// UploadFileWithPath 使用自定义路径上传文件到 TOS
// customPath: 完整的存储路径，如 "avatars/users/123/202603/123456.png"
// file: 上传的文件
// 返回: 文件URL和错误信息
func (u *TOSUploader) UploadFileWithPath(customPath string, file *multipart.FileHeader) (string, error) {
	return u.UploadFileWithPathContext(context.Background(), customPath, file)
}

// UploadFileWithPathContext 使用请求上下文上传文件到 TOS。
func (u *TOSUploader) UploadFileWithPathContext(
	ctx context.Context,
	customPath string,
	file *multipart.FileHeader,
) (string, error) {
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
	fileBytes, err := ReadAllWithContext(ctx, src)
	if err != nil {
		return "", fmt.Errorf("failed to read file: %w", err)
	}

	return u.UploadBytesWithPathContext(ctx, customPath, fileBytes)
}

// GetPublicURL 获取文件的公开访问 URL
func (u *TOSUploader) UploadBytesWithPath(customPath string, fileBytes []byte) (string, error) {
	return u.UploadBytesWithPathContext(context.Background(), customPath, fileBytes)
}

// UploadBytesWithPathContext 使用请求上下文上传字节数据到 TOS。
func (u *TOSUploader) UploadBytesWithPathContext(
	ctx context.Context,
	customPath string,
	fileBytes []byte,
) (string, error) {
	if u == nil || u.client == nil {
		return "", fmt.Errorf("TOS uploader not initialized")
	}

	input := &tos.PutObjectV2Input{
		PutObjectBasicInput: tos.PutObjectBasicInput{
			Bucket: u.bucket,
			Key:    customPath,
		},
		Content: bytes.NewReader(fileBytes),
	}

	_, err := u.client.PutObjectV2(ctx, input)
	if err != nil {
		return "", fmt.Errorf("failed to upload to TOS: %w", err)
	}

	return u.GetPublicURL(customPath), nil
}

func (u *TOSUploader) GetPublicURL(key string) string {
	// 火山引擎 TOS 公开访问 URL 格式
	// https://{bucket}.{endpoint}/{key}
	return fmt.Sprintf("https://%s.tos-cn-beijing.volces.com/%s", u.bucket, key)
}

// PresignPrivatePut creates a short-lived browser upload ticket. The caller
// must forward every returned header with the PUT request.
func (u *TOSUploader) PresignPrivatePut(key string, expires time.Duration) (TOSSignedURL, error) {
	if u == nil || u.client == nil {
		return TOSSignedURL{}, fmt.Errorf("TOS uploader not initialized")
	}
	headers := map[string]string{
		"Content-Type": "application/zip",
		"x-tos-acl":    string(enum.ACLPrivate),
	}
	output, err := u.client.PreSignedURL(&tos.PreSignedURLInput{
		HTTPMethod: enum.HttpMethodPut,
		Bucket:     u.bucket,
		Key:        key,
		Expires:    int64(expires.Seconds()),
		Header:     headers,
	})
	if err != nil {
		return TOSSignedURL{}, fmt.Errorf("sign private TOS upload: %w", err)
	}
	// The SDK also exposes its own User-Agent through SignedHeader. Browsers
	// forbid setting that header, and it is not part of the query signature.
	// Return only the two headers the browser must send.
	return TOSSignedURL{URL: output.SignedUrl, Headers: headers}, nil
}

func (u *TOSUploader) PresignPrivateGet(key string, expires time.Duration, disposition string) (string, error) {
	if u == nil || u.client == nil {
		return "", fmt.Errorf("TOS uploader not initialized")
	}
	query := map[string]string{"response-content-type": "application/zip"}
	if disposition != "" {
		query["response-content-disposition"] = disposition
	}
	output, err := u.client.PreSignedURL(&tos.PreSignedURLInput{
		HTTPMethod: enum.HttpMethodGet,
		Bucket:     u.bucket,
		Key:        key,
		Expires:    int64(expires.Seconds()),
		Query:      query,
	})
	if err != nil {
		return "", fmt.Errorf("sign private TOS download: %w", err)
	}
	return output.SignedUrl, nil
}

func (u *TOSUploader) HeadPrivateObject(ctx context.Context, key string) (TOSObjectInfo, error) {
	if u == nil || u.client == nil {
		return TOSObjectInfo{}, fmt.Errorf("TOS uploader not initialized")
	}
	output, err := u.client.HeadObjectV2(ctx, &tos.HeadObjectV2Input{Bucket: u.bucket, Key: key})
	if err != nil {
		return TOSObjectInfo{}, fmt.Errorf("head private TOS object: %w", err)
	}
	return TOSObjectInfo{Size: output.ContentLength, ETag: output.ETag}, nil
}

func (u *TOSUploader) ReadPrivateRange(ctx context.Context, key, etag string, start, end int64) ([]byte, error) {
	if u == nil || u.client == nil {
		return nil, fmt.Errorf("TOS uploader not initialized")
	}
	if start < 0 || end < start {
		return nil, fmt.Errorf("invalid TOS byte range")
	}
	output, err := u.client.GetObjectV2(ctx, &tos.GetObjectV2Input{
		Bucket: u.bucket, Key: key, IfMatch: etag, Range: fmt.Sprintf("bytes=%d-%d", start, end),
	})
	if err != nil {
		return nil, fmt.Errorf("read private TOS range: %w", err)
	}
	defer output.Content.Close()
	content, err := ReadAllWithContext(ctx, io.LimitReader(output.Content, end-start+2))
	if err != nil {
		return nil, fmt.Errorf("read private TOS range body: %w", err)
	}
	if int64(len(content)) != end-start+1 {
		return nil, fmt.Errorf("private TOS range length mismatch")
	}
	return content, nil
}

func (u *TOSUploader) CopyPrivateObject(ctx context.Context, sourceKey, destinationKey, etag string) (string, error) {
	if u == nil || u.client == nil {
		return "", fmt.Errorf("TOS uploader not initialized")
	}
	output, err := u.client.CopyObject(ctx, &tos.CopyObjectInput{
		Bucket: u.bucket, Key: destinationKey, SrcBucket: u.bucket, SrcKey: sourceKey,
		ACL: enum.ACLPrivate, CopySourceIfMatch: etag, ContentType: "application/zip",
	})
	if err != nil {
		return "", fmt.Errorf("copy private TOS object: %w", err)
	}
	return output.ETag, nil
}

// DeleteFile 删除 TOS 上的文件
func (u *TOSUploader) DeleteFile(key string) error {
	return u.DeleteFileWithContext(context.Background(), key)
}

// DeleteFileWithContext 使用指定上下文删除文件。
func (u *TOSUploader) DeleteFileWithContext(ctx context.Context, key string) error {
	if u == nil || u.client == nil {
		return fmt.Errorf("TOS uploader not initialized")
	}

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

// ReadAllWithContext 在读取完成前持续检查上下文，避免请求取消后继续消耗资源。
func ReadAllWithContext(ctx context.Context, reader io.Reader) ([]byte, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}

	buffer := bytes.NewBuffer(nil)
	chunk := make([]byte, 32*1024)
	for {
		if err := ctx.Err(); err != nil {
			return nil, err
		}

		n, err := reader.Read(chunk)
		if n > 0 {
			if _, writeErr := buffer.Write(chunk[:n]); writeErr != nil {
				return nil, writeErr
			}
		}
		if err == nil {
			continue
		}
		if err == io.EOF {
			return buffer.Bytes(), nil
		}
		return nil, err
	}
}
