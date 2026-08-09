package service

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"net/http"
	"strconv"
	"strings"

	"valley-server/internal/model"

	"gorm.io/gorm"
)

const (
	maxAICanvasDocumentBytes = 32 << 20
	maxAICanvasImageBytes    = 8 << 20
	maxAICanvasImageTotal    = 20 << 20
	maxAICanvasElements      = 1000
	maxAICanvasPoints        = 100000
)

var (
	ErrAICanvasDocumentConflict = errors.New("AI canvas document revision conflict")
	ErrAICanvasDocumentInvalid  = errors.New("AI canvas document invalid")
)

type AICanvasDocumentInput struct {
	UserID           model.Int64String
	ExpectedRevision int
	Document         json.RawMessage
}

type AICanvasDocumentMetadata struct {
	Version     int
	AspectRatio string
}

type AICanvasDocumentService struct {
	db *gorm.DB
}

type aiCanvasPoint struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
}

type aiCanvasElement struct {
	ID           string          `json:"id"`
	Type         string          `json:"type"`
	Mode         string          `json:"mode"`
	Name         string          `json:"name"`
	Color        string          `json:"color"`
	Fill         string          `json:"fill"`
	Stroke       string          `json:"stroke"`
	Texture      string          `json:"texture"`
	DataURL      string          `json:"dataUrl"`
	Points       []aiCanvasPoint `json:"points"`
	Width        float64         `json:"width"`
	Height       float64         `json:"height"`
	X            float64         `json:"x"`
	Y            float64         `json:"y"`
	SourceAspect float64         `json:"sourceAspect"`
	SourceGenID  string          `json:"sourceGenerationId"`
	StrokeWidth  float64         `json:"strokeWidth"`
	Opacity      float64         `json:"opacity"`
}

type aiCanvasDocumentPayload struct {
	Version          int               `json:"version"`
	AspectRatio      string            `json:"aspectRatio"`
	Background       string            `json:"background"`
	BaseGenerationID string            `json:"baseGenerationId"`
	Elements         []aiCanvasElement `json:"elements"`
}

func NewAICanvasDocumentService(db *gorm.DB) *AICanvasDocumentService {
	return &AICanvasDocumentService{db: db}
}

func ValidateAICanvasDocument(raw json.RawMessage) (AICanvasDocumentMetadata, error) {
	if len(raw) == 0 || len(raw) > maxAICanvasDocumentBytes {
		return AICanvasDocumentMetadata{}, errors.New("画布文档大小不合法")
	}
	var payload aiCanvasDocumentPayload
	if err := json.Unmarshal(raw, &payload); err != nil {
		return AICanvasDocumentMetadata{}, errors.New("画布文档格式错误")
	}
	if payload.Version != 1 {
		return AICanvasDocumentMetadata{}, errors.New("暂不支持该画布文档版本")
	}
	if !isAICanvasAspectRatio(payload.AspectRatio) {
		return AICanvasDocumentMetadata{}, errors.New("画布比例不合法")
	}
	if payload.Background == "" || len(payload.Background) > 32 {
		return AICanvasDocumentMetadata{}, errors.New("画布背景不合法")
	}
	if payload.BaseGenerationID != "" {
		if !isAICanvasGenerationID(payload.BaseGenerationID) {
			return AICanvasDocumentMetadata{}, errors.New("画布父生成记录不合法")
		}
	}
	if len(payload.Elements) > maxAICanvasElements {
		return AICanvasDocumentMetadata{}, errors.New("画布元素数量过多")
	}

	imageCount := 0
	imageBytes := 0
	pointCount := 0
	for _, element := range payload.Elements {
		if strings.TrimSpace(element.ID) == "" || len(element.ID) > 120 {
			return AICanvasDocumentMetadata{}, errors.New("画布元素标识不合法")
		}
		switch element.Type {
		case "stroke":
			if element.Mode != "draw" && element.Mode != "erase" {
				return AICanvasDocumentMetadata{}, errors.New("画布笔迹类型不合法")
			}
			if !isAICanvasNormalizedSize(element.Width) || len(element.Points) == 0 || !isAICanvasShortText(element.Color, 32) {
				return AICanvasDocumentMetadata{}, errors.New("画布笔迹数据不合法")
			}
		case "shape":
			if len(element.Points) < 3 || !isAICanvasNormalizedSize(element.StrokeWidth) || !isAICanvasOpacity(element.Opacity) ||
				!isAICanvasShortText(element.Name, 200) || !isAICanvasShortText(element.Fill, 32) || !isAICanvasShortText(element.Stroke, 32) {
				return AICanvasDocumentMetadata{}, errors.New("画布图形数据不合法")
			}
			if element.Texture != "solid" && element.Texture != "pencil" {
				return AICanvasDocumentMetadata{}, errors.New("画布图形纹理不合法")
			}
		case "image":
			imageCount++
			if imageCount > 3 || !isAICanvasNormalizedSize(element.Width) || !isAICanvasNormalizedSize(element.Height) ||
				!isAICanvasSourceAspect(element.SourceAspect) || !isAICanvasCoordinate(element.X) || !isAICanvasCoordinate(element.Y) ||
				!isAICanvasOpacity(element.Opacity) || !isAICanvasShortText(element.Name, 200) ||
				(element.SourceGenID != "" && !isAICanvasGenerationID(element.SourceGenID)) {
				return AICanvasDocumentMetadata{}, errors.New("画布图片图层不合法")
			}
			size, err := validateAICanvasImageDataURL(element.DataURL)
			if err != nil {
				return AICanvasDocumentMetadata{}, err
			}
			imageBytes += size
			if imageBytes > maxAICanvasImageTotal {
				return AICanvasDocumentMetadata{}, errors.New("画布图片素材总大小超过限制")
			}
		default:
			return AICanvasDocumentMetadata{}, errors.New("画布元素类型不合法")
		}
		pointCount += len(element.Points)
		if pointCount > maxAICanvasPoints {
			return AICanvasDocumentMetadata{}, errors.New("画布笔迹数据过多")
		}
		for _, point := range element.Points {
			if !isAICanvasCoordinate(point.X) || !isAICanvasCoordinate(point.Y) {
				return AICanvasDocumentMetadata{}, errors.New("画布坐标不合法")
			}
		}
	}
	return AICanvasDocumentMetadata{Version: payload.Version, AspectRatio: payload.AspectRatio}, nil
}

func (s *AICanvasDocumentService) Get(ctx context.Context, userID model.Int64String) (model.AICanvasDocument, bool, error) {
	if s == nil || s.db == nil {
		return model.AICanvasDocument{}, false, errors.New("database unavailable")
	}
	var document model.AICanvasDocument
	err := s.db.WithContext(ctx).Where("user_id = ?", userID).First(&document).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return model.AICanvasDocument{}, false, nil
	}
	return document, err == nil, err
}

func (s *AICanvasDocumentService) Save(ctx context.Context, input AICanvasDocumentInput) (model.AICanvasDocument, error) {
	if s == nil || s.db == nil {
		return model.AICanvasDocument{}, errors.New("database unavailable")
	}
	metadata, err := ValidateAICanvasDocument(input.Document)
	if err != nil {
		return model.AICanvasDocument{}, fmt.Errorf("%w: %v", ErrAICanvasDocumentInvalid, err)
	}
	if input.ExpectedRevision < 0 {
		return model.AICanvasDocument{}, ErrAICanvasDocumentConflict
	}

	if input.ExpectedRevision == 0 {
		document := model.AICanvasDocument{
			UserID: input.UserID, Version: metadata.Version, AspectRatio: metadata.AspectRatio,
			DocumentJSON: string(input.Document), Revision: 1,
		}
		if err := s.db.WithContext(ctx).Create(&document).Error; err != nil {
			if _, found, lookupErr := s.Get(ctx, input.UserID); lookupErr == nil && found {
				return model.AICanvasDocument{}, ErrAICanvasDocumentConflict
			}
			return model.AICanvasDocument{}, fmt.Errorf("create AI canvas document: %w", err)
		}
		return document, nil
	}

	result := s.db.WithContext(ctx).Model(&model.AICanvasDocument{}).
		Where("user_id = ? AND revision = ?", input.UserID, input.ExpectedRevision).
		Updates(map[string]any{
			"version": metadata.Version, "aspect_ratio": metadata.AspectRatio,
			"document_json": string(input.Document), "revision": gorm.Expr("revision + 1"),
		})
	if result.Error != nil {
		return model.AICanvasDocument{}, fmt.Errorf("update AI canvas document: %w", result.Error)
	}
	if result.RowsAffected == 0 {
		return model.AICanvasDocument{}, ErrAICanvasDocumentConflict
	}
	document, found, err := s.Get(ctx, input.UserID)
	if err != nil || !found {
		return model.AICanvasDocument{}, fmt.Errorf("reload AI canvas document: %w", err)
	}
	return document, nil
}

func isAICanvasAspectRatio(value string) bool {
	switch value {
	case "1:1", "4:3", "3:4", "16:9", "9:16":
		return true
	default:
		return false
	}
}

func isAICanvasNormalizedSize(value float64) bool {
	return !math.IsNaN(value) && !math.IsInf(value, 0) && value > 0 && value <= 2
}

func isAICanvasSourceAspect(value float64) bool {
	return !math.IsNaN(value) && !math.IsInf(value, 0) && value > 0 && value <= 100
}

func isAICanvasOpacity(value float64) bool {
	return !math.IsNaN(value) && !math.IsInf(value, 0) && value >= 0 && value <= 1
}

func isAICanvasShortText(value string, maxLength int) bool {
	length := len(strings.TrimSpace(value))
	return length > 0 && length <= maxLength
}

func isAICanvasGenerationID(value string) bool {
	id, err := strconv.ParseInt(value, 10, 64)
	return err == nil && id > 0
}

func isAICanvasCoordinate(value float64) bool {
	return !math.IsNaN(value) && !math.IsInf(value, 0) && value >= 0 && value <= 1
}

func validateAICanvasImageDataURL(value string) (int, error) {
	header, encoded, found := strings.Cut(value, ",")
	if !found || !strings.HasSuffix(header, ";base64") {
		return 0, errors.New("画布图片素材格式错误")
	}
	mimeType := strings.TrimSuffix(strings.TrimPrefix(header, "data:"), ";base64")
	allowed := map[string]string{
		"image/jpeg": "image/jpeg", "image/png": "image/png", "image/webp": "image/webp",
		"image/gif": "image/gif", "image/bmp": "image/bmp", "image/avif": "image/avif",
	}
	if _, ok := allowed[mimeType]; !ok {
		return 0, errors.New("画布图片素材类型不支持")
	}
	content, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil || len(content) == 0 || len(content) > maxAICanvasImageBytes {
		return 0, errors.New("画布图片素材大小不合法")
	}
	detected := http.DetectContentType(content)
	if mimeType != detected && !(mimeType == "image/avif" && strings.Contains(detected, "octet-stream")) {
		return 0, errors.New("画布图片素材内容不匹配")
	}
	return len(content), nil
}
