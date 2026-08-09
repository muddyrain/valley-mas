package image

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	stdimage "image"
	"image/color"
	"image/draw"
	"image/jpeg"
	"image/png"
	"path/filepath"
	"strings"

	"valley-server/internal/ai/tools"
	"valley-server/internal/ai/tools/artifact"

	"github.com/deepteams/webp"
	"gorm.io/gorm"
)

const ConvertToolName = "image.convert"

type ConvertTool struct {
	db     *gorm.DB
	writer artifact.Writer
}

type convertArgs struct {
	AttachmentID string `json:"attachmentId"`
	TargetFormat string `json:"targetFormat"`
	Quality      int    `json:"quality"`
}

func NewConvertTool(db *gorm.DB) *ConvertTool {
	return newConvertTool(db, artifact.NewStore(db))
}

func newConvertTool(db *gorm.DB, writer artifact.Writer) *ConvertTool {
	return &ConvertTool{db: db, writer: writer}
}

func (tool *ConvertTool) Name() string  { return ConvertToolName }
func (tool *ConvertTool) Scope() string { return toolScope }
func (tool *ConvertTool) Description() string {
	return "把本轮用户上传的 WebP、JPG 或 PNG 图片转换为 WebP、JPG 或 PNG，并返回可下载文件。"
}

func (tool *ConvertTool) Schema() map[string]any {
	return map[string]any{
		"type":     "object",
		"required": []string{"targetFormat"},
		"properties": map[string]any{
			"attachmentId": map[string]any{"type": "string", "description": "源附件 ID；本轮只有一个附件时可省略。"},
			"targetFormat": map[string]any{"type": "string", "enum": []string{"webp", "jpg", "png"}},
			"quality":      map[string]any{"type": "integer", "minimum": 1, "maximum": 100, "description": "JPG 或有损 WebP 质量，默认 90。"},
		},
	}
}

func (tool *ConvertTool) ToolContract() tools.Contract {
	return tools.Contract{
		OutputSchema: map[string]any{
			"type": "object", "required": []string{"artifactId", "fileName", "sourceFormat", "targetFormat", "expiresAt"},
		},
		RiskLevel: tools.RiskLow, Confirmation: tools.ConfirmationNever,
		ResultCard: tools.ResultCardConversion,
	}
}

func (tool *ConvertTool) Run(ctx context.Context, raw json.RawMessage) (json.RawMessage, error) {
	if tool == nil || tool.db == nil || tool.writer == nil {
		return nil, errors.New("image.convert: service unavailable")
	}
	input, err := artifact.RequestFromContext(ctx)
	if err != nil {
		return nil, fmt.Errorf("image.convert: %w", err)
	}
	var args convertArgs
	if json.Unmarshal(raw, &args) != nil {
		return nil, errors.New("image.convert: invalid arguments")
	}
	attachmentID, err := artifact.ResolveAttachmentID(input, args.AttachmentID)
	if err != nil {
		return nil, fmt.Errorf("image.convert: %w", err)
	}
	attachment, err := artifact.LoadAttachment(ctx, tool.db, input, attachmentID)
	if err != nil {
		return nil, fmt.Errorf("image.convert: %w", err)
	}
	sourceFormat := normalizeImageFormat(filepath.Ext(attachment.Name))
	if sourceFormat == "" {
		sourceFormat = normalizeImageFormat(attachment.MimeType)
	}
	targetFormat := normalizeImageFormat(args.TargetFormat)
	if sourceFormat == "" || targetFormat == "" {
		return nil, errors.New("image.convert: only WebP, JPG and PNG are supported")
	}
	if sourceFormat == targetFormat {
		return nil, errors.New("image.convert: source and target formats are identical")
	}
	content, contentType, err := convertImageBytes(attachment.SourceContent, sourceFormat, targetFormat, args.Quality)
	if err != nil {
		return nil, fmt.Errorf("image.convert: %w", err)
	}
	extension := "." + targetFormat
	name := strings.TrimSuffix(filepath.Base(attachment.Name), filepath.Ext(attachment.Name)) + extension
	stored, err := tool.writer.Write(ctx, input, artifact.File{
		Name: name, ContentType: contentType, Content: content, Description: "智能体图片转换结果",
		Kind: "conversion", SourceFormat: sourceFormat, TargetFormat: targetFormat,
	})
	if err != nil {
		return nil, fmt.Errorf("image.convert: %w", err)
	}
	return json.Marshal(map[string]any{
		"ok": true, "artifactId": stored.ID.String(), "fileName": stored.FileName,
		"contentType": stored.ContentType, "size": stored.SizeBytes, "url": stored.URL,
		"sourceFormat": sourceFormat, "targetFormat": targetFormat, "expiresAt": stored.ExpiresAt,
	})
}

func normalizeImageFormat(value string) string {
	value = strings.TrimPrefix(strings.ToLower(strings.TrimSpace(value)), ".")
	switch value {
	case "image/jpeg", "jpeg", "jpg":
		return "jpg"
	case "image/png", "png":
		return "png"
	case "image/webp", "webp":
		return "webp"
	default:
		return ""
	}
}

func convertImageBytes(input []byte, sourceFormat, targetFormat string, quality int) ([]byte, string, error) {
	if len(input) == 0 {
		return nil, "", errors.New("source image is empty")
	}
	decoded, detected, err := stdimage.Decode(bytes.NewReader(input))
	if err != nil {
		return nil, "", errors.New("source image cannot be decoded")
	}
	if normalizedDetected := normalizeImageFormat(detected); normalizedDetected != "" && normalizedDetected != normalizeImageFormat(sourceFormat) {
		return nil, "", errors.New("source image format does not match its file name")
	}
	if quality <= 0 {
		quality = 90
	}
	quality = min(100, max(1, quality))
	var output bytes.Buffer
	switch normalizeImageFormat(targetFormat) {
	case "png":
		if err := png.Encode(&output, decoded); err != nil {
			return nil, "", err
		}
		return output.Bytes(), "image/png", nil
	case "jpg":
		bounds := decoded.Bounds()
		flattened := stdimage.NewRGBA(bounds)
		draw.Draw(flattened, bounds, &stdimage.Uniform{C: color.White}, stdimage.Point{}, draw.Src)
		draw.Draw(flattened, bounds, decoded, bounds.Min, draw.Over)
		if err := jpeg.Encode(&output, flattened, &jpeg.Options{Quality: quality}); err != nil {
			return nil, "", err
		}
		return output.Bytes(), "image/jpeg", nil
	case "webp":
		if err := webp.Encode(&output, decoded, &webp.EncoderOptions{Quality: float32(quality), Method: 4}); err != nil {
			return nil, "", err
		}
		return output.Bytes(), "image/webp", nil
	default:
		return nil, "", errors.New("unsupported target image format")
	}
}

var _ tools.Tool = (*ConvertTool)(nil)
