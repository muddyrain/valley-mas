package handler

import (
	"bytes"
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"valley-server/internal/aiclient"
	"valley-server/internal/aimodel"
	"valley-server/internal/aiusage"
	"valley-server/internal/model"

	"github.com/ledongthuc/pdf"
	"gorm.io/gorm"
)

const (
	knowledgePDFMaxPages       = 12
	knowledgePDFMaxPageBytes   = 4 * 1024 * 1024
	knowledgePDFRenderTimeout  = 90 * time.Second
	knowledgePDFVisionTimeout  = 45 * time.Second
	knowledgePDFVisionMaxRunes = 8000
)

type aiKnowledgeParseError struct {
	code string
	err  error
}

func (e *aiKnowledgeParseError) Error() string { return e.code + ": " + e.err.Error() }
func (e *aiKnowledgeParseError) Unwrap() error { return e.err }

type aiKnowledgeSection struct {
	pageNumber int
	sourceType string
	content    string
}

var renderAIKnowledgePDFPages = renderAIKnowledgePDFPagesWithPoppler
var analyzeAIKnowledgePDFPage = analyzeAIKnowledgePDFPageWithVision

func aiKnowledgeDocumentParseErrorCode(err error) string {
	var parseErr *aiKnowledgeParseError
	if errors.As(err, &parseErr) {
		return parseErr.code
	}
	return "DOCUMENT_PARSE_FAILED"
}

// prepareAIKnowledgeDocumentChunks turns a rich PDF into owner-scoped chunks
// before the existing embedding job starts. Documents without retained source
// bytes still follow the legacy text upload path unchanged.
func prepareAIKnowledgeDocumentChunks(db *gorm.DB, documentID model.Int64String) error {
	var document model.AIKnowledgeDocument
	if err := db.Where("id = ?", documentID).First(&document).Error; err != nil {
		return err
	}
	if len(document.SourceContent) == 0 || document.ChunkCount > 0 {
		return nil
	}

	sections, err := extractAIKnowledgePDFTextSections(document.SourceContent)
	if err != nil {
		return &aiKnowledgeParseError{code: "DOCUMENT_PARSE_FAILED", err: err}
	}
	if strings.TrimSpace(document.VisionModelID) != "" {
		invocation, err := aimodel.ResolveInvocation(db, document.VisionModelID, "vision", knowledgePDFVisionTimeout)
		if err != nil {
			return &aiKnowledgeParseError{code: aiKnowledgeVisionModelErrorCode(err), err: err}
		}
		pages, err := renderAIKnowledgePDFPages(document.SourceContent)
		if err != nil {
			return err
		}
		for pageNumber, image := range pages {
			result, err := analyzeAIKnowledgePDFPage(invocation, document.UserID, pageNumber+1, image, pageTextAt(sections, pageNumber+1))
			if err != nil {
				return err
			}
			if strings.TrimSpace(result) != "" {
				sections = append(sections, aiKnowledgeSection{pageNumber: pageNumber + 1, sourceType: "visual", content: result})
			}
		}
	}

	chunks := splitAIKnowledgeSections(sections)
	if len(chunks) == 0 {
		return &aiKnowledgeParseError{code: "DOCUMENT_PARSE_FAILED", err: errors.New("PDF 未产生可索引内容")}
	}
	if len(chunks) > knowledgeChunkMaxCount {
		return &aiKnowledgeParseError{code: "DOCUMENT_CHUNK_LIMIT_EXCEEDED", err: errors.New("PDF 分段数量超出限制")}
	}

	parsedText := joinAIKnowledgeSections(sections)
	return db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("document_id = ?", document.ID).Delete(&model.AIKnowledgeChunk{}).Error; err != nil {
			return err
		}
		rows := make([]model.AIKnowledgeChunk, 0, len(chunks))
		for position, chunk := range chunks {
			rows = append(rows, model.AIKnowledgeChunk{
				DocumentID: document.ID,
				UserID:     document.UserID,
				Position:   position,
				Content:    chunk.content,
				TokenCount: len([]rune(chunk.content)),
				PageNumber: chunk.pageNumber,
				SourceType: chunk.sourceType,
			})
		}
		if err := tx.Create(&rows).Error; err != nil {
			return err
		}
		return tx.Model(&model.AIKnowledgeDocument{}).Where("id = ?", document.ID).Updates(map[string]any{
			"parsed_text":    parsedText,
			"chunk_count":    len(rows),
			"index_progress": 8,
		}).Error
	})
}

func extractAIKnowledgePDFTextSections(content []byte) ([]aiKnowledgeSection, error) {
	reader, err := pdf.NewReader(bytes.NewReader(content), int64(len(content)))
	if err != nil {
		return nil, err
	}
	if reader.NumPage() <= 0 {
		return nil, errors.New("PDF 不含页面")
	}
	if reader.NumPage() > knowledgePDFMaxPages {
		return nil, &aiKnowledgeParseError{code: "PDF_PAGE_LIMIT_EXCEEDED", err: fmt.Errorf("PDF 页数超过 %d 页", knowledgePDFMaxPages)}
	}
	fonts := make(map[string]*pdf.Font)
	sections := make([]aiKnowledgeSection, 0, reader.NumPage())
	for pageNumber := 1; pageNumber <= reader.NumPage(); pageNumber++ {
		page := reader.Page(pageNumber)
		for _, name := range page.Fonts() {
			if _, exists := fonts[name]; !exists {
				font := page.Font(name)
				fonts[name] = &font
			}
		}
		text, err := page.GetPlainText(fonts)
		if err != nil {
			return nil, err
		}
		if text = strings.TrimSpace(text); text != "" {
			sections = append(sections, aiKnowledgeSection{pageNumber: pageNumber, sourceType: "text", content: text})
		}
	}
	return sections, nil
}

func renderAIKnowledgePDFPagesWithPoppler(content []byte) ([][]byte, error) {
	binary, err := exec.LookPath("pdftocairo")
	if err != nil {
		return nil, &aiKnowledgeParseError{code: "PDF_RENDERER_UNAVAILABLE", err: errors.New("未找到 pdftocairo")}
	}
	dir, err := os.MkdirTemp("", "valley-pdf-*")
	if err != nil {
		return nil, &aiKnowledgeParseError{code: "PDF_RENDER_FAILED", err: err}
	}
	defer os.RemoveAll(dir)
	input := filepath.Join(dir, "source.pdf")
	if err := os.WriteFile(input, content, 0o600); err != nil {
		return nil, &aiKnowledgeParseError{code: "PDF_RENDER_FAILED", err: err}
	}
	prefix := filepath.Join(dir, "page")
	ctx, cancel := context.WithTimeout(context.Background(), knowledgePDFRenderTimeout)
	defer cancel()
	command := exec.CommandContext(ctx, binary, "-png", "-r", "144", "-scale-to", "1800", "-f", "1", "-l", fmt.Sprint(knowledgePDFMaxPages), input, prefix)
	if output, err := command.CombinedOutput(); err != nil {
		if ctx.Err() != nil {
			return nil, &aiKnowledgeParseError{code: "PDF_RENDER_FAILED", err: ctx.Err()}
		}
		return nil, &aiKnowledgeParseError{code: "PDF_RENDER_FAILED", err: fmt.Errorf("pdftocairo: %s", strings.TrimSpace(string(output)))}
	}
	pages := make([][]byte, 0, knowledgePDFMaxPages)
	for pageNumber := 1; pageNumber <= knowledgePDFMaxPages; pageNumber++ {
		path := fmt.Sprintf("%s-%d.png", prefix, pageNumber)
		info, err := os.Stat(path)
		if errors.Is(err, os.ErrNotExist) {
			break
		}
		if err != nil {
			return nil, &aiKnowledgeParseError{code: "PDF_RENDER_FAILED", err: err}
		}
		if info.Size() <= 0 || info.Size() > knowledgePDFMaxPageBytes {
			return nil, &aiKnowledgeParseError{code: "PDF_RENDER_FAILED", err: fmt.Errorf("第 %d 页渲染图像大小无效", pageNumber)}
		}
		page, err := os.ReadFile(path)
		if err != nil {
			return nil, &aiKnowledgeParseError{code: "PDF_RENDER_FAILED", err: err}
		}
		pages = append(pages, page)
	}
	if len(pages) == 0 {
		return nil, &aiKnowledgeParseError{code: "PDF_RENDER_FAILED", err: errors.New("未生成页面图像")}
	}
	return pages, nil
}

func analyzeAIKnowledgePDFPageWithVision(invocation aimodel.Invocation, userID model.Int64String, pageNumber int, image []byte, nativeText string) (string, error) {
	prompt := fmt.Sprintf("你在处理知识库 PDF 的第 %d 页。输出可被检索的 Markdown：保留扫描文字；将表格还原为 Markdown 表格；描述有信息价值的图片、图表与公式。原生文本如下，已存在的普通段落不要重复，只补全缺失内容或恢复结构：\n%s\n只输出资料内容，不要说明处理过程。", pageNumber, aiclient.TrimRunes(strings.TrimSpace(nativeText), 6000))
	dataURL := "data:image/png;base64," + base64.StdEncoding.EncodeToString(image)
	startedAt := time.Now()
	response, err := invocation.Client.Chat(context.Background(), aiclient.CompatibleChatRequest{
		Model: invocation.Model.ModelID,
		Messages: []aiclient.CompatibleMessage{{
			Role: "user",
			Content: []map[string]any{
				{"type": "image_url", "image_url": map[string]string{"url": dataURL}},
				{"type": "text", "text": prompt},
			},
		}},
	})
	if err != nil {
		recordAIKnowledgePDFVisionUsage(invocation, userID, prompt, "", aiclient.CompatibleUsage{}, startedAt, err)
		return "", &aiKnowledgeParseError{code: "PDF_VISION_ANALYSIS_FAILED", err: err}
	}
	if len(response.Choices) == 0 {
		err := errors.New("视觉模型返回为空")
		recordAIKnowledgePDFVisionUsage(invocation, userID, prompt, "", response.Usage, startedAt, err)
		return "", &aiKnowledgeParseError{code: "PDF_VISION_ANALYSIS_FAILED", err: err}
	}
	result := aiclient.TrimRunes(strings.TrimSpace(compatibleMessageText(response.Choices[0].Message.Content)), knowledgePDFVisionMaxRunes)
	if result == "" {
		err := errors.New("视觉模型未返回可用内容")
		recordAIKnowledgePDFVisionUsage(invocation, userID, prompt, result, response.Usage, startedAt, err)
		return "", &aiKnowledgeParseError{code: "PDF_VISION_ANALYSIS_FAILED", err: err}
	}
	recordAIKnowledgePDFVisionUsage(invocation, userID, prompt, result, response.Usage, startedAt, nil)
	return result, nil
}

func recordAIKnowledgePDFVisionUsage(invocation aimodel.Invocation, userID model.Int64String, prompt, result string, usage aiclient.CompatibleUsage, startedAt time.Time, callErr error) {
	status := aiusage.StatusSuccess
	errMessage := ""
	if callErr != nil {
		status = aiusage.StatusFailed
		errMessage = callErr.Error()
	}
	aiusage.Record(aiusage.Entry{
		Feature: aiclient.FeatureKnowledgePDFVision, Provider: invocation.Provider.Provider, Model: invocation.Model.ModelID,
		UserID: userID.String(), Status: status, PromptChars: aiusage.CharCount(prompt), ResponseChars: aiusage.CharCount(result),
		PromptTokens: usage.PromptTokens, CompletionTokens: usage.CompletionTokens, TotalTokens: usage.TotalTokens,
		LatencyMs: aiusage.Since(startedAt), ErrorMessage: errMessage,
	})
}

func aiKnowledgeVisionModelErrorCode(err error) string {
	if errors.Is(err, aimodel.ErrModelNotAvailable) {
		return "PDF_VISION_MODEL_UNAVAILABLE"
	}
	return "PDF_VISION_PROVIDER_UNAVAILABLE"
}

func pageTextAt(sections []aiKnowledgeSection, pageNumber int) string {
	for _, section := range sections {
		if section.pageNumber == pageNumber && section.sourceType == "text" {
			return section.content
		}
	}
	return ""
}

func joinAIKnowledgeSections(sections []aiKnowledgeSection) string {
	var builder strings.Builder
	for _, section := range sections {
		if strings.TrimSpace(section.content) == "" {
			continue
		}
		fmt.Fprintf(&builder, "\n\n## 第 %d 页 · %s\n%s", section.pageNumber, section.sourceType, strings.TrimSpace(section.content))
	}
	return strings.TrimSpace(builder.String())
}

func splitAIKnowledgeSections(sections []aiKnowledgeSection) []aiKnowledgeSection {
	chunks := make([]aiKnowledgeSection, 0)
	for _, section := range sections {
		content := strings.TrimSpace(section.content)
		if content == "" {
			continue
		}
		prefix := fmt.Sprintf("第 %d 页\n", section.pageNumber)
		limit := knowledgeChunkSize - len([]rune(prefix))
		if limit <= knowledgeChunkOverlap {
			continue
		}
		for _, value := range splitAIKnowledgeTextByParagraph(content, limit) {
			chunks = append(chunks, aiKnowledgeSection{pageNumber: section.pageNumber, sourceType: section.sourceType, content: prefix + value})
		}
	}
	return chunks
}

func splitAIKnowledgeTextByParagraph(text string, limit int) []string {
	paragraphs := splitAIKnowledgeParagraphs(text)
	chunks := make([]string, 0, len(paragraphs))
	current := ""
	flush := func() {
		if strings.TrimSpace(current) == "" {
			return
		}
		chunks = append(chunks, strings.TrimSpace(current))
		current = tailRunes(current, knowledgeChunkOverlap)
	}
	for _, paragraph := range paragraphs {
		paragraph = strings.TrimSpace(paragraph)
		if paragraph == "" {
			continue
		}
		if len([]rune(paragraph)) > limit {
			flush()
			for _, part := range splitRunesWithOverlap(paragraph, limit, knowledgeChunkOverlap) {
				chunks = append(chunks, part)
			}
			current = ""
			continue
		}
		candidate := paragraph
		if current != "" {
			candidate = current + "\n\n" + paragraph
		}
		if len([]rune(candidate)) > limit {
			flush()
			current = paragraph
			continue
		}
		current = candidate
	}
	if strings.TrimSpace(current) != "" {
		chunks = append(chunks, strings.TrimSpace(current))
	}
	return chunks
}

// A single newline is meaningful inside Markdown tables and lists. Split only
// on blank lines so visual-model table output remains valid Markdown inside a
// chunk instead of being flattened into separate paragraphs.
func splitAIKnowledgeParagraphs(text string) []string {
	lines := strings.Split(strings.ReplaceAll(text, "\r\n", "\n"), "\n")
	paragraphs := make([]string, 0, len(lines))
	current := make([]string, 0)
	flush := func() {
		value := strings.TrimSpace(strings.Join(current, "\n"))
		if value != "" {
			paragraphs = append(paragraphs, value)
		}
		current = current[:0]
	}
	for _, line := range lines {
		if strings.TrimSpace(line) == "" {
			flush()
			continue
		}
		current = append(current, line)
	}
	flush()
	return paragraphs
}

func splitRunesWithOverlap(text string, limit, overlap int) []string {
	runes := []rune(text)
	chunks := make([]string, 0, len(runes)/limit+1)
	for start := 0; start < len(runes); {
		end := start + limit
		if end > len(runes) {
			end = len(runes)
		}
		chunks = append(chunks, string(runes[start:end]))
		if end == len(runes) {
			break
		}
		start = end - overlap
	}
	return chunks
}

func tailRunes(value string, count int) string {
	runes := []rune(strings.TrimSpace(value))
	if len(runes) <= count {
		return string(runes)
	}
	return string(runes[len(runes)-count:])
}
