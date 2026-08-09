package document

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/json"
	"strings"
	"testing"

	"valley-server/internal/ai/tools"
	"valley-server/internal/ai/tools/artifact"
)

func TestExportToolContractAndFormats(t *testing.T) {
	contract := tools.ContractFor(NewExportTool(nil))
	if contract.Name != ExportToolName || contract.Confirmation != tools.ConfirmationNever || contract.ResultCard != tools.ResultCardFile {
		t.Fatalf("contract = %#v", contract)
	}

	for _, format := range []string{"markdown", "docx", "pdf"} {
		t.Run(format, func(t *testing.T) {
			writer := &recordingWriter{}
			tool := newExportTool(nil, writer)
			ctx := artifact.WithRequestContext(context.Background(), artifact.RequestContext{UserID: 101, AppID: 11, ConversationID: 12, RunID: 13})
			raw, err := tool.Run(ctx, json.RawMessage(`{"fileName":"创作报告","format":"`+format+`","content":"# 标题\n\n正文内容"}`))
			if err != nil {
				t.Fatal(err)
			}
			var result map[string]any
			if err := json.Unmarshal(raw, &result); err != nil || result["artifactId"] != "901" {
				t.Fatalf("result = %s err=%v", raw, err)
			}
			if writer.file.Name == "" || len(writer.file.Content) == 0 {
				t.Fatalf("file = %#v", writer.file)
			}
			switch format {
			case "markdown":
				if string(writer.file.Content) != "# 标题\n\n正文内容" || !strings.HasSuffix(writer.file.Name, ".md") {
					t.Fatalf("markdown = %q %q", writer.file.Name, writer.file.Content)
				}
			case "docx":
				archive, err := zip.NewReader(bytes.NewReader(writer.file.Content), int64(len(writer.file.Content)))
				if err != nil || len(archive.File) == 0 {
					t.Fatalf("docx invalid: %v", err)
				}
			case "pdf":
				if !bytes.HasPrefix(writer.file.Content, []byte("%PDF-")) || !strings.HasSuffix(writer.file.Name, ".pdf") {
					t.Fatalf("pdf = %q %q", writer.file.Name, writer.file.Content[:min(8, len(writer.file.Content))])
				}
			}
		})
	}
}

func TestExportToolRejectsUnsupportedFormat(t *testing.T) {
	tool := newExportTool(nil, &recordingWriter{})
	ctx := artifact.WithRequestContext(context.Background(), artifact.RequestContext{UserID: 101, AppID: 11, ConversationID: 12, RunID: 13})
	if _, err := tool.Run(ctx, json.RawMessage(`{"fileName":"x","format":"html","content":"body"}`)); err == nil {
		t.Fatal("expected unsupported format error")
	}
}
