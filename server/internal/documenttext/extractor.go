package documenttext

import (
	"bytes"
	"errors"
	"fmt"
	"path/filepath"
	"strings"
	"unicode/utf8"

	"github.com/ledongthuc/pdf"
	"golang.org/x/net/html"
)

const (
	MaxDocumentBytes = 10 << 20
	MaxDocumentRunes = 200_000
	MaxPDFPages      = 50
)

type Input struct {
	Filename    string
	ContentType string
	Content     []byte
}

type Page struct {
	Number int    `json:"number"`
	Text   string `json:"text"`
}

type Result struct {
	Text           string `json:"text"`
	Pages          []Page `json:"pages"`
	Format         string `json:"format"`
	PageCount      int    `json:"pageCount"`
	CharacterCount int    `json:"characterCount"`
}

func Extract(input Input) (Result, error) {
	if len(input.Content) == 0 {
		return Result{}, errors.New("文档内容为空")
	}
	if len(input.Content) > MaxDocumentBytes {
		return Result{}, fmt.Errorf("文档不能超过 %dMB", MaxDocumentBytes>>20)
	}
	format := detectFormat(input.Filename, input.ContentType)
	switch format {
	case "pdf":
		return extractPDF(input.Content)
	case "html":
		return extractHTML(input.Content)
	case "text", "markdown", "json", "csv", "yaml", "xml":
		return extractPlainText(input.Content, format)
	default:
		return Result{}, errors.New("仅支持 PDF、TXT、Markdown、HTML、JSON、CSV、YAML 和 XML 文档")
	}
}

func extractPlainText(content []byte, format string) (Result, error) {
	if !utf8.Valid(content) {
		return Result{}, errors.New("文档不是有效的 UTF-8 文本")
	}
	text, err := normalizeText(string(content))
	if err != nil {
		return Result{}, err
	}
	return Result{
		Text: text, Format: format, PageCount: 1,
		Pages: []Page{{Number: 1, Text: text}}, CharacterCount: utf8.RuneCountInString(text),
	}, nil
}

func extractHTML(content []byte) (Result, error) {
	document, err := html.Parse(bytes.NewReader(content))
	if err != nil {
		return Result{}, fmt.Errorf("HTML 解析失败: %w", err)
	}
	var lines []string
	var visit func(*html.Node)
	visit = func(node *html.Node) {
		if node.Type == html.ElementNode && (node.Data == "script" || node.Data == "style") {
			return
		}
		if node.Type == html.TextNode {
			if text := strings.Join(strings.Fields(node.Data), " "); text != "" {
				lines = append(lines, text)
			}
		}
		for child := node.FirstChild; child != nil; child = child.NextSibling {
			visit(child)
		}
	}
	visit(document)
	text, err := normalizeText(strings.Join(lines, "\n"))
	if err != nil {
		return Result{}, err
	}
	return Result{
		Text: text, Format: "html", PageCount: 1,
		Pages: []Page{{Number: 1, Text: text}}, CharacterCount: utf8.RuneCountInString(text),
	}, nil
}

func extractPDF(content []byte) (Result, error) {
	reader, err := pdf.NewReader(bytes.NewReader(content), int64(len(content)))
	if err != nil {
		return Result{}, fmt.Errorf("PDF 解析失败: %w", err)
	}
	if reader.NumPage() <= 0 {
		return Result{}, errors.New("PDF 不含页面")
	}
	if reader.NumPage() > MaxPDFPages {
		return Result{}, fmt.Errorf("PDF 页数不能超过 %d 页", MaxPDFPages)
	}
	fonts := make(map[string]*pdf.Font)
	pages := make([]Page, 0, reader.NumPage())
	for pageNumber := 1; pageNumber <= reader.NumPage(); pageNumber++ {
		page := reader.Page(pageNumber)
		for _, name := range page.Fonts() {
			if _, exists := fonts[name]; exists {
				continue
			}
			font := page.Font(name)
			fonts[name] = &font
		}
		text, err := page.GetPlainText(fonts)
		if err != nil {
			return Result{}, fmt.Errorf("PDF 第 %d 页解析失败: %w", pageNumber, err)
		}
		text = strings.TrimSpace(text)
		if text != "" {
			pages = append(pages, Page{Number: pageNumber, Text: text})
		}
	}
	if len(pages) == 0 {
		return Result{}, errors.New("PDF 没有可提取文本；扫描件请先经过图片理解或知识库 OCR")
	}
	parts := make([]string, len(pages))
	for index, page := range pages {
		parts[index] = page.Text
	}
	text, err := normalizeText(strings.Join(parts, "\n\n"))
	if err != nil {
		return Result{}, err
	}
	return Result{
		Text: text, Pages: pages, Format: "pdf", PageCount: reader.NumPage(),
		CharacterCount: utf8.RuneCountInString(text),
	}, nil
}

func normalizeText(value string) (string, error) {
	value = strings.TrimSpace(strings.ReplaceAll(value, "\r\n", "\n"))
	if value == "" {
		return "", errors.New("文档没有可提取文本")
	}
	if utf8.RuneCountInString(value) > MaxDocumentRunes {
		return "", fmt.Errorf("文档文本不能超过 %d 个字符", MaxDocumentRunes)
	}
	return value, nil
}

func detectFormat(filename, contentType string) string {
	extension := strings.ToLower(filepath.Ext(strings.TrimSpace(filename)))
	switch extension {
	case ".pdf":
		return "pdf"
	case ".md", ".markdown":
		return "markdown"
	case ".html", ".htm":
		return "html"
	case ".json":
		return "json"
	case ".csv":
		return "csv"
	case ".yaml", ".yml":
		return "yaml"
	case ".xml":
		return "xml"
	case ".txt":
		return "text"
	}
	contentType = strings.ToLower(strings.TrimSpace(strings.Split(contentType, ";")[0]))
	switch contentType {
	case "application/pdf":
		return "pdf"
	case "text/markdown":
		return "markdown"
	case "text/html":
		return "html"
	case "application/json":
		return "json"
	case "text/csv":
		return "csv"
	case "application/yaml", "text/yaml":
		return "yaml"
	case "application/xml", "text/xml":
		return "xml"
	case "text/plain":
		return "text"
	default:
		return ""
	}
}
