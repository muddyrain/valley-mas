package documenttext

import (
	"strings"
	"testing"
)

func TestExtractMarkdownReturnsNormalizedText(t *testing.T) {
	result, err := Extract(Input{
		Filename: "guide.md",
		Content:  []byte("# Valley\r\n\r\n工作流节点"),
	})
	if err != nil {
		t.Fatal(err)
	}
	if result.Format != "markdown" || result.Text != "# Valley\n\n工作流节点" ||
		result.PageCount != 1 || result.CharacterCount == 0 {
		t.Fatalf("unexpected extraction result: %+v", result)
	}
}

func TestExtractHTMLExcludesScriptContent(t *testing.T) {
	result, err := Extract(Input{
		Filename: "page.html",
		Content:  []byte(`<html><body><h1>标题</h1><p>正文</p><script>secret()</script></body></html>`),
	})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(result.Text, "标题") || !strings.Contains(result.Text, "正文") ||
		strings.Contains(result.Text, "secret") {
		t.Fatalf("unexpected HTML text: %q", result.Text)
	}
}

func TestExtractRejectsUnsupportedDocument(t *testing.T) {
	_, err := Extract(Input{Filename: "archive.zip", Content: []byte("data")})
	if err == nil || !strings.Contains(err.Error(), "仅支持") {
		t.Fatalf("expected unsupported document error, got %v", err)
	}
}
