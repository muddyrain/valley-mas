package document

import (
	"bytes"
	"context"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"path/filepath"
	"strings"
	"unicode/utf16"

	"valley-server/internal/ai/tools"
	"valley-server/internal/ai/tools/artifact"

	"gorm.io/gorm"
)

const (
	ExportToolName       = "document.export"
	maxExportContentSize = 2 * 1024 * 1024
)

type ExportTool struct {
	writer artifact.Writer
}

type exportArgs struct {
	FileName string `json:"fileName"`
	Format   string `json:"format"`
	Content  string `json:"content"`
}

func NewExportTool(db *gorm.DB) *ExportTool { return newExportTool(db, artifact.NewStore(db)) }

func newExportTool(_ *gorm.DB, writer artifact.Writer) *ExportTool {
	return &ExportTool{writer: writer}
}

func (tool *ExportTool) Name() string  { return ExportToolName }
func (tool *ExportTool) Scope() string { return toolScope }
func (tool *ExportTool) Description() string {
	return "把文本内容确定性导出为 Markdown、PDF 或 DOCX，并返回可下载的临时文件。"
}

func (tool *ExportTool) Schema() map[string]any {
	return map[string]any{
		"type": "object", "required": []string{"fileName", "format", "content"},
		"properties": map[string]any{
			"fileName": map[string]any{"type": "string", "minLength": 1, "maxLength": 120},
			"format":   map[string]any{"type": "string", "enum": []string{"markdown", "pdf", "docx"}},
			"content":  map[string]any{"type": "string", "minLength": 1, "maxLength": maxExportContentSize},
		},
	}
}

func (tool *ExportTool) ToolContract() tools.Contract {
	return tools.Contract{
		OutputSchema: map[string]any{"type": "object", "required": []string{"artifactId", "fileName", "contentType", "size", "expiresAt"}},
		RiskLevel:    tools.RiskLow, Confirmation: tools.ConfirmationNever, ResultCard: tools.ResultCardFile,
	}
}

func (tool *ExportTool) Run(ctx context.Context, raw json.RawMessage) (json.RawMessage, error) {
	if tool == nil || tool.writer == nil {
		return nil, errors.New("document.export: service unavailable")
	}
	request, err := artifact.RequestFromContext(ctx)
	if err != nil {
		return nil, fmt.Errorf("document.export: %w", err)
	}
	var args exportArgs
	if json.Unmarshal(raw, &args) != nil {
		return nil, errors.New("document.export: invalid arguments")
	}
	name, contentType, content, err := buildExport(args)
	if err != nil {
		return nil, err
	}
	stored, err := tool.writer.Write(ctx, request, artifact.File{
		Name: name, ContentType: contentType, Content: content,
		Description: "智能体文档导出结果", Kind: "export", TargetFormat: strings.TrimPrefix(filepath.Ext(name), "."),
	})
	if err != nil {
		return nil, fmt.Errorf("document.export: %w", err)
	}
	return json.Marshal(map[string]any{
		"ok": true, "artifactId": stored.ID.String(), "resourceId": stored.ResourceID.String(),
		"fileName": stored.FileName, "contentType": stored.ContentType, "size": stored.SizeBytes,
		"targetFormat": stored.TargetFormat, "expiresAt": stored.ExpiresAt,
	})
}

func buildExport(args exportArgs) (string, string, []byte, error) {
	content := strings.TrimSpace(args.Content)
	if content == "" || len([]byte(content)) > maxExportContentSize {
		return "", "", nil, errors.New("document.export: 文档内容为空或超过 2MB")
	}
	base := strings.Trim(strings.TrimSpace(filepath.Base(args.FileName)), ".")
	if base == "" {
		return "", "", nil, errors.New("document.export: 文件名不能为空")
	}
	base = strings.TrimSuffix(base, filepath.Ext(base))
	switch strings.ToLower(strings.TrimSpace(args.Format)) {
	case "markdown":
		return base + ".md", "text/markdown; charset=utf-8", []byte(content), nil
	case "docx":
		data, err := buildDOCX([]string{content})
		return base + ".docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", data, err
	case "pdf":
		data, err := buildTextPDF(content)
		return base + ".pdf", "application/pdf", data, err
	default:
		return "", "", nil, errors.New("document.export: 仅支持 markdown、pdf 或 docx")
	}
}

func buildTextPDF(content string) ([]byte, error) {
	lines := wrapPDFLines(content, 46)
	if len(lines) == 0 {
		lines = []string{" "}
	}
	const linesPerPage = 40
	pageCount := (len(lines) + linesPerPage - 1) / linesPerPage
	objects := make([][]byte, 4+pageCount*2)
	objects[0] = []byte("<< /Type /Catalog /Pages 2 0 R >>")
	kids := make([]string, 0, pageCount)
	for index := 0; index < pageCount; index++ {
		kids = append(kids, fmt.Sprintf("%d 0 R", 5+index*2))
	}
	objects[1] = []byte(fmt.Sprintf("<< /Type /Pages /Kids [%s] /Count %d >>", strings.Join(kids, " "), pageCount))
	objects[2] = []byte("<< /Type /Font /Subtype /Type0 /BaseFont /STSong-Light /Encoding /UniGB-UCS2-H /DescendantFonts [4 0 R] >>")
	objects[3] = []byte("<< /Type /Font /Subtype /CIDFontType0 /BaseFont /STSong-Light /CIDSystemInfo << /Registry (Adobe) /Ordering (GB1) /Supplement 4 >> >>")
	for pageIndex := 0; pageIndex < pageCount; pageIndex++ {
		pageObject := 5 + pageIndex*2
		contentObject := pageObject + 1
		objects[pageObject-1] = []byte(fmt.Sprintf("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents %d 0 R >>", contentObject))
		start := pageIndex * linesPerPage
		end := min(start+linesPerPage, len(lines))
		var stream strings.Builder
		stream.WriteString("BT /F1 12 Tf 54 790 Td 18 TL\n")
		for _, line := range lines[start:end] {
			stream.WriteString("<")
			stream.WriteString(pdfUTF16Hex(line))
			stream.WriteString("> Tj T*\n")
		}
		stream.WriteString("ET")
		data := stream.String()
		objects[contentObject-1] = []byte(fmt.Sprintf("<< /Length %d >>\nstream\n%s\nendstream", len(data), data))
	}

	var output bytes.Buffer
	output.WriteString("%PDF-1.7\n%\xE2\xE3\xCF\xD3\n")
	offsets := make([]int, len(objects)+1)
	for index, object := range objects {
		offsets[index+1] = output.Len()
		fmt.Fprintf(&output, "%d 0 obj\n", index+1)
		output.Write(object)
		output.WriteString("\nendobj\n")
	}
	xref := output.Len()
	fmt.Fprintf(&output, "xref\n0 %d\n0000000000 65535 f \n", len(objects)+1)
	for index := 1; index <= len(objects); index++ {
		fmt.Fprintf(&output, "%010d 00000 n \n", offsets[index])
	}
	fmt.Fprintf(&output, "trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n", len(objects)+1, xref)
	return output.Bytes(), nil
}

func wrapPDFLines(content string, maxRunes int) []string {
	result := make([]string, 0)
	for _, rawLine := range strings.Split(strings.ReplaceAll(content, "\r\n", "\n"), "\n") {
		runes := []rune(rawLine)
		if len(runes) == 0 {
			result = append(result, " ")
			continue
		}
		for len(runes) > maxRunes {
			result = append(result, string(runes[:maxRunes]))
			runes = runes[maxRunes:]
		}
		result = append(result, string(runes))
	}
	return result
}

func pdfUTF16Hex(value string) string {
	units := append([]uint16{0xfeff}, utf16.Encode([]rune(value))...)
	data := make([]byte, len(units)*2)
	for index, unit := range units {
		data[index*2] = byte(unit >> 8)
		data[index*2+1] = byte(unit)
	}
	return strings.ToUpper(hex.EncodeToString(data))
}

var _ tools.Tool = (*ExportTool)(nil)
