package document

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"strings"
	"testing"
	"time"

	"valley-server/internal/ai/tools"
	"valley-server/internal/ai/tools/artifact"
	"valley-server/internal/model"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

type recordingWriter struct {
	file artifact.File
}

func (writer *recordingWriter) Write(_ context.Context, _ artifact.RequestContext, file artifact.File) (model.AIAppArtifact, error) {
	writer.file = file
	expiresAt := time.Now().Add(time.Hour)
	return model.AIAppArtifact{
		ID: 901, FileName: file.Name, ContentType: file.ContentType,
		Kind: file.Kind, SourceFormat: file.SourceFormat, TargetFormat: file.TargetFormat,
		SizeBytes: int64(len(file.Content)), ExpiresAt: &expiresAt,
	}, nil
}

func TestConvertToolContractUsesConversionCardWithoutConfirmation(t *testing.T) {
	contract := tools.ContractFor(NewConvertTool(nil))
	if contract.ResultCard != tools.ResultCardConversion || contract.Confirmation != tools.ConfirmationNever {
		t.Fatalf("unexpected contract: %#v", contract)
	}
}

func TestConvertPDFToDOCXKeepsTextAndPageBreak(t *testing.T) {
	docx, pages, err := convertPDFToDOCX(twoPageTextPDF("First page", "Second page"))
	if err != nil {
		t.Fatalf("convert pdf to docx: %v", err)
	}
	if pages != 2 {
		t.Fatalf("page count = %d, want 2", pages)
	}
	documentXML := readDOCXEntry(t, docx, "word/document.xml")
	for _, expected := range []string{"First page", "Second page", `w:type="page"`} {
		if !strings.Contains(documentXML, expected) {
			t.Fatalf("document.xml does not contain %q: %s", expected, documentXML)
		}
	}
}

func TestConvertPDFToDOCXRejectsUnreadablePDF(t *testing.T) {
	if _, _, err := convertPDFToDOCX([]byte("not a pdf")); err == nil {
		t.Fatal("expected malformed PDF to fail")
	}
}

func TestConvertToolWritesOwnerPDFAsConversionArtifact(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(&model.AIAppConversationAttachment{}); err != nil {
		t.Fatalf("migrate attachment: %v", err)
	}
	attachment := model.AIAppConversationAttachment{
		UserID: 101, AppID: 11, ConversationID: 12, Name: "report.pdf",
		MimeType: "application/pdf", SizeBytes: 100, SourceContent: twoPageTextPDF("First", "Second"),
	}
	if err := db.Create(&attachment).Error; err != nil {
		t.Fatalf("create attachment: %v", err)
	}
	writer := &recordingWriter{}
	tool := newConvertTool(db, writer)
	ctx := artifact.WithRequestContext(context.Background(), artifact.RequestContext{
		UserID: 101, AppID: 11, ConversationID: 12, RunID: 13,
		AttachmentIDs: []model.Int64String{attachment.ID},
	})
	result, err := tool.Run(ctx, json.RawMessage(`{"targetFormat":"docx"}`))
	if err != nil {
		t.Fatalf("run document conversion: %v", err)
	}
	if !strings.Contains(string(result), `"sourceFormat":"pdf"`) || !strings.Contains(string(result), `"targetFormat":"docx"`) {
		t.Fatalf("unexpected tool result: %s", result)
	}
	if writer.file.Name != "report.docx" || writer.file.Kind != "conversion" || writer.file.SourceFormat != "pdf" || writer.file.TargetFormat != "docx" {
		t.Fatalf("unexpected artifact file: %#v", writer.file)
	}
	if !bytes.HasPrefix(writer.file.Content, []byte("PK")) {
		t.Fatal("artifact content is not a DOCX zip")
	}
}

func readDOCXEntry(t *testing.T, data []byte, name string) string {
	t.Helper()
	reader, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		t.Fatalf("open docx: %v", err)
	}
	for _, file := range reader.File {
		if file.Name != name {
			continue
		}
		source, err := file.Open()
		if err != nil {
			t.Fatalf("open %s: %v", name, err)
		}
		defer source.Close()
		content, err := io.ReadAll(source)
		if err != nil {
			t.Fatalf("read %s: %v", name, err)
		}
		return string(content)
	}
	t.Fatalf("docx entry %s not found", name)
	return ""
}

func twoPageTextPDF(first, second string) []byte {
	firstStream := fmt.Sprintf("BT\n/F1 12 Tf\n72 720 Td\n(%s) Tj\nET\n", first)
	secondStream := fmt.Sprintf("BT\n/F1 12 Tf\n72 720 Td\n(%s) Tj\nET\n", second)
	objects := []string{
		"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
		"2 0 obj\n<< /Type /Pages /Kids [3 0 R 6 0 R] /Count 2 >>\nendobj\n",
		"3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>\nendobj\n",
		fmt.Sprintf("4 0 obj\n<< /Length %d >>\nstream\n%sendstream\nendobj\n", len(firstStream), firstStream),
		"5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
		"6 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 7 0 R >>\nendobj\n",
		fmt.Sprintf("7 0 obj\n<< /Length %d >>\nstream\n%sendstream\nendobj\n", len(secondStream), secondStream),
	}
	var document bytes.Buffer
	document.WriteString("%PDF-1.4\n")
	offsets := make([]int, 0, len(objects))
	for _, object := range objects {
		offsets = append(offsets, document.Len())
		document.WriteString(object)
	}
	xrefOffset := document.Len()
	fmt.Fprintf(&document, "xref\n0 %d\n0000000000 65535 f \n", len(objects)+1)
	for _, offset := range offsets {
		fmt.Fprintf(&document, "%010d 00000 n \n", offset)
	}
	fmt.Fprintf(&document, "trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n", len(objects)+1, xrefOffset)
	return document.Bytes()
}
