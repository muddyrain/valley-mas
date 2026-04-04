package service

import (
	"fmt"
	"image"
	_ "image/jpeg"
	_ "image/png"
	"mime/multipart"
	"path/filepath"
	"strings"
	"time"
	"valley-server/internal/utils"
)

// UploadType 上传类型
type UploadType string

const (
	UploadTypeUserAvatar UploadType = "user_avatar" // 用户个人头像（存 avatars/ 目录）
	UploadTypeAvatar     UploadType = "avatar"      // 资源素材 - 头像类型（存 resources/ 目录）
	UploadTypeWallpaper  UploadType = "wallpaper"   // 资源素材 - 壁纸类型（存 resources/ 目录）
	UploadTypeCover      UploadType = "cover"       // 封面图（存 resources/ 目录）
	UploadTypeImageText  UploadType = "image_text"  // 图文生成图（存 image-text/ 目录）
)

// UploadConfig 上传配置
type UploadConfig struct {
	Type         UploadType // 上传类型
	UserID       int64      // 用户ID
	MaxSize      int64      // 最大文件大小(MB)
	AllowedExts  []string   // 允许的文件扩展名
	CustomFolder string     // 自定义文件夹（可选）
}

// UploadResult 上传结果
type UploadResult struct {
	URL      string `json:"url"`      // 文件URL
	Key      string `json:"key"`      // 对象存储键名
	FileName string `json:"fileName"` // 原始文件名
	Size     int64  `json:"size"`     // 文件大小
	Ext      string `json:"ext"`      // 文件扩展名
	Width    int    `json:"width"`    // 图片宽度（px）
	Height   int    `json:"height"`   // 图片高度（px）
}

// UploadService 上传服务
type UploadService struct {
	uploader *utils.TOSUploader
}

// NewUploadService 创建上传服务
func NewUploadService() *UploadService {
	return &UploadService{
		uploader: utils.GetTOSUploader(),
	}
}

// GetDefaultConfig 获取默认配置
func GetDefaultConfig(uploadType UploadType) UploadConfig {
	configs := map[UploadType]UploadConfig{
		UploadTypeUserAvatar: {
			Type:        UploadTypeUserAvatar,
			MaxSize:     2, // 2MB
			AllowedExts: []string{".jpg", ".jpeg", ".png", ".webp"},
		},
		UploadTypeAvatar: {
			Type:        UploadTypeAvatar,
			MaxSize:     5, // 5MB
			AllowedExts: []string{".jpg", ".jpeg", ".png", ".webp"},
		},
		UploadTypeWallpaper: {
			Type:        UploadTypeWallpaper,
			MaxSize:     5, // 5MB
			AllowedExts: []string{".jpg", ".jpeg", ".png", ".webp"},
		},
		UploadTypeCover: {
			Type:        UploadTypeCover,
			MaxSize:     3, // 3MB
			AllowedExts: []string{".jpg", ".jpeg", ".png", ".webp"},
		},
		UploadTypeImageText: {
			Type:        UploadTypeImageText,
			MaxSize:     8, // 8MB
			AllowedExts: []string{".jpg", ".jpeg", ".png", ".webp"},
		},
	}

	config, exists := configs[uploadType]
	if !exists {
		// 默认配置 - 统一按日期分类
		return UploadConfig{
			Type:        uploadType,
			MaxSize:     5,
			AllowedExts: []string{".jpg", ".jpeg", ".png"},
		}
	}

	return config
}

// GenerateStoragePath 生成存储路径
// 路径格式：
// - 用户头像：avatars/{userId}/{YYYYMMDD}/{filename}
// - 用户资源：resources/{userId}/{YYYYMMDD}/{filename}
// - 匿名用户：anonymous/{YYYYMMDD}/{filename}
// - 自定义路径：{customFolder}/{filename}
// 注意：资源路径不包含 type 目录，避免修改资源类型后路径与存储不一致
func (s *UploadService) GenerateStoragePath(config UploadConfig, fileName string) string {
	ext := strings.ToLower(filepath.Ext(fileName))
	timestamp := time.Now().UnixNano()
	newFileName := fmt.Sprintf("%d%s", timestamp, ext)

	// 自定义文件夹（优先级最高）
	if config.CustomFolder != "" {
		return fmt.Sprintf("%s/%s", config.CustomFolder, newFileName)
	}

	// 日期文件夹（统一按年月日分类）
	dateFolder := time.Now().Format("20060102") // YYYYMMDD

	// 匿名用户（理论上不会出现，因为上传需要登录）
	if config.UserID <= 0 {
		return fmt.Sprintf("anonymous/%s/%s", dateFolder, newFileName)
	}

	// 用户个人头像单独存储：avatars/{userId}/{YYYYMMDD}/{filename}
	if config.Type == UploadTypeUserAvatar {
		return fmt.Sprintf("avatars/%d/%s/%s",
			config.UserID,
			dateFolder,
			newFileName,
		)
	}

	// 所有资源素材（wallpaper/avatar 类型等）：resources/{userId}/{YYYYMMDD}/{filename}
	// 不含 type 目录，避免后台修改类型后存储路径与实际类型不一致
	return fmt.Sprintf("resources/%d/%s/%s",
		config.UserID,
		dateFolder,
		newFileName,
	)
}

// ValidateFile 验证文件
func (s *UploadService) ValidateFile(file *multipart.FileHeader, config UploadConfig) error {
	// 验证文件扩展名
	if !utils.ValidateFileType(file.Filename, config.AllowedExts) {
		return fmt.Errorf("不支持的文件类型，仅支持：%s", strings.Join(config.AllowedExts, ", "))
	}

	// 验证文件大小
	if !utils.ValidateFileSize(file.Size, config.MaxSize) {
		return fmt.Errorf("文件过大，最大支持 %dMB", config.MaxSize)
	}

	return nil
}

// Upload 上传文件
func (s *UploadService) Upload(file *multipart.FileHeader, config UploadConfig) (*UploadResult, error) {
	if s.uploader == nil {
		return nil, fmt.Errorf("文件上传服务未配置")
	}

	// 验证文件
	if err := s.ValidateFile(file, config); err != nil {
		return nil, err
	}

	// 尝试读取图片尺寸（仅对 jpg/png 有效）
	width, height := 0, 0
	ext := strings.ToLower(filepath.Ext(file.Filename))
	if ext == ".jpg" || ext == ".jpeg" || ext == ".png" {
		if f, err := file.Open(); err == nil {
			if cfg, _, err := image.DecodeConfig(f); err == nil {
				width = cfg.Width
				height = cfg.Height
			}
			f.Close()
		}
	}

	// 生成存储路径
	storagePath := s.GenerateStoragePath(config, file.Filename)

	// 上传到 TOS（使用自定义路径）
	url, err := s.uploader.UploadFileWithPath(storagePath, file)
	if err != nil {
		return nil, fmt.Errorf("文件上传失败: %w", err)
	}

	return &UploadResult{
		URL:      url,
		Key:      storagePath,
		FileName: file.Filename,
		Size:     file.Size,
		Ext:      filepath.Ext(file.Filename),
		Width:    width,
		Height:   height,
	}, nil
}

// Delete 删除文件
func (s *UploadService) Delete(url string) error {
	if s.uploader == nil {
		return fmt.Errorf("文件上传服务未配置")
	}

	key := s.uploader.ExtractKeyFromURL(url)
	return s.uploader.DeleteFile(key)
}

// DeleteByKey 通过键名删除文件
func (s *UploadService) DeleteByKey(key string) error {
	if s.uploader == nil {
		return fmt.Errorf("文件上传服务未配置")
	}

	return s.uploader.DeleteFile(key)
}
