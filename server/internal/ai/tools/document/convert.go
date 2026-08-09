// Package document exposes bounded document conversion to internal agents.
package document

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/json"
	"encoding/xml"
	"errors"
	"fmt"
	"path/filepath"
	"strings"

	"valley-server/internal/ai/tools"
	"valley-server/internal/ai/tools/artifact"

	"github.com/ledongthuc/pdf"
	"gorm.io/gorm"
)

const (
	ToolName  = "document.convert"
	toolScope = "workbench"
)

type ConvertTool struct {
	db     *gorm.DB
	writer artifact.Writer
}

type convertArgs struct {
	AttachmentID string `json:"attachmentId"`
	TargetFormat string `json:"targetFormat"`
}

func NewConvertTool(db *gorm.DB) *ConvertTool {
	return newConvertTool(db, artifact.NewStore(db))
}

func newConvertTool(db *gorm.DB, writer artifact.Writer) *ConvertTool {
	return &ConvertTool{db: db, writer: writer}
}

func (tool *ConvertTool) Name() string  { return ToolName }
func (tool *ConvertTool) Scope() string { return toolScope }
func (tool *ConvertTool) Description() string {
	return "把本轮用户上传的文本型 PDF 尽力转换为 DOCX，保留主要文字、段落和分页，并返回可下载文件。"
}

func (tool *ConvertTool) Schema() map[string]any {
	return map[string]any{
		"type":     "object",
		"required": []string{"targetFormat"},
		"properties": map[string]any{
			"attachmentId": map[string]any{"type": "string", "description": "源 PDF 附件 ID；本轮只有一个附件时可省略。"},
			"targetFormat": map[string]any{"type": "string", "enum": []string{"docx"}},
		},
	}
}

func (tool *ConvertTool) ToolContract() tools.Contract {
	return tools.Contract{
		OutputSchema: map[string]any{
			"type": "object", "required": []string{"artifactId", "fileName", "sourceFormat", "targetFormat", "pageCount", "expiresAt"},
		},
		RiskLevel: tools.RiskLow, Confirmation: tools.ConfirmationNever,
		ResultCard: tools.ResultCardConversion,
	}
}

func (tool *ConvertTool) Run(ctx context.Context, raw json.RawMessage) (json.RawMessage, error) {
	if tool == nil || tool.db == nil || tool.writer == nil {
		return nil, errors.New("document.convert: service unavailable")
	}
	input, err := artifact.RequestFromContext(ctx)
	if err != nil {
		return nil, fmt.Errorf("document.convert: %w", err)
	}
	var args convertArgs
	if json.Unmarshal(raw, &args) != nil || strings.ToLower(strings.TrimSpace(args.TargetFormat)) != "docx" {
		return nil, errors.New("document.convert: only PDF to DOCX is supported")
	}
	attachmentID, err := artifact.ResolveAttachmentID(input, args.AttachmentID)
	if err != nil {
		return nil, fmt.Errorf("document.convert: %w", err)
	}
	attachment, err := artifact.LoadAttachment(ctx, tool.db, input, attachmentID)
	if err != nil {
		return nil, fmt.Errorf("document.convert: %w", err)
	}
	if strings.ToLower(filepath.Ext(attachment.Name)) != ".pdf" {
		return nil, errors.New("document.convert: source file must be PDF")
	}
	content, pageCount, err := convertPDFToDOCX(attachment.SourceContent)
	if err != nil {
		return nil, fmt.Errorf("document.convert: %w", err)
	}
	name := strings.TrimSuffix(filepath.Base(attachment.Name), filepath.Ext(attachment.Name)) + ".docx"
	stored, err := tool.writer.Write(ctx, input, artifact.File{
		Name: name, ContentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
		Content: content, Description: "智能体文档转换结果",
		Kind: "conversion", SourceFormat: "pdf", TargetFormat: "docx",
	})
	if err != nil {
		return nil, fmt.Errorf("document.convert: %w", err)
	}
	return json.Marshal(map[string]any{
		"ok": true, "artifactId": stored.ID.String(), "fileName": stored.FileName,
		"contentType": stored.ContentType, "size": stored.SizeBytes, "url": stored.URL,
		"sourceFormat": "pdf", "targetFormat": "docx", "pageCount": pageCount,
		"expiresAt": stored.ExpiresAt,
	})
}

func convertPDFToDOCX(input []byte) ([]byte, int, error) {
	if len(input) == 0 {
		return nil, 0, errors.New("source PDF is empty")
	}
	reader, err := pdf.NewReader(bytes.NewReader(input), int64(len(input)))
	if err != nil {
		return nil, 0, errors.New("source PDF cannot be read")
	}
	pageCount := reader.NumPage()
	if pageCount <= 0 {
		return nil, 0, errors.New("source PDF has no pages")
	}
	pages := make([]string, 0, pageCount)
	hasText := false
	for pageNumber := 1; pageNumber <= pageCount; pageNumber++ {
		text, textErr := reader.Page(pageNumber).GetPlainText(nil)
		if textErr != nil {
			return nil, 0, fmt.Errorf("read page %d: %w", pageNumber, textErr)
		}
		text = strings.TrimSpace(text)
		hasText = hasText || text != ""
		pages = append(pages, text)
	}
	if !hasText {
		return nil, 0, errors.New("source PDF has no extractable text")
	}
	docx, err := buildDOCX(pages)
	return docx, pageCount, err
}

func buildDOCX(pages []string) ([]byte, error) {
	var document strings.Builder
	document.WriteString(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>`)
	for pageIndex, page := range pages {
		if pageIndex > 0 {
			document.WriteString(`<w:p><w:r><w:br w:type="page"/></w:r></w:p>`)
		}
		lines := strings.Split(strings.ReplaceAll(page, "\r\n", "\n"), "\n")
		for _, line := range lines {
			if line == "" {
				document.WriteString(`<w:p/>`)
				continue
			}
			document.WriteString(`<w:p><w:r><w:t xml:space="preserve">`)
			var escaped bytes.Buffer
			if err := xml.EscapeText(&escaped, []byte(line)); err != nil {
				return nil, err
			}
			document.WriteString(escaped.String())
			document.WriteString(`</w:t></w:r></w:p>`)
		}
	}
	document.WriteString(`<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body></w:document>`)

	entries := map[string]string{
		"[Content_Types].xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`,
		"_rels/.rels":         `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`,
		"word/document.xml":   document.String(),
	}
	var output bytes.Buffer
	archive := zip.NewWriter(&output)
	for _, name := range []string{"[Content_Types].xml", "_rels/.rels", "word/document.xml"} {
		writer, err := archive.Create(name)
		if err != nil {
			return nil, err
		}
		if _, err := writer.Write([]byte(entries[name])); err != nil {
			return nil, err
		}
	}
	if err := archive.Close(); err != nil {
		return nil, err
	}
	return output.Bytes(), nil
}

var _ tools.Tool = (*ConvertTool)(nil)
