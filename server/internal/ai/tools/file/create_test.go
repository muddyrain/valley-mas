package file

import (
	"testing"

	"valley-server/internal/ai/tools"
)

func TestCreateToolContractUsesPrivateFileCard(t *testing.T) {
	contract := tools.ContractFor(NewCreateTool(nil))
	if contract.ResultCard != tools.ResultCardFile || contract.RiskLevel != tools.RiskLow {
		t.Fatalf("unexpected contract: %#v", contract)
	}
	if contract.Confirmation != tools.ConfirmationNever {
		t.Fatalf("file generation must not require confirmation: %#v", contract)
	}
}

func TestNormalizeFile(t *testing.T) {
	tests := []struct {
		name        string
		fileName    string
		format      string
		content     string
		wantName    string
		wantType    string
		wantFailure bool
	}{
		{name: "markdown adds extension", fileName: "summary", format: "markdown", content: "# 结论", wantName: "summary.md", wantType: "text/markdown; charset=utf-8"},
		{name: "json validates content", fileName: "data.json", format: "json", content: `{"ok":true}`, wantName: "data.json", wantType: "application/json; charset=utf-8"},
		{name: "rejects invalid json", fileName: "data", format: "json", content: `{`, wantFailure: true},
		{name: "strips path", fileName: "../report", format: "csv", content: "name,value\na,1", wantName: "report.csv", wantType: "text/csv; charset=utf-8"},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			name, contentType, err := normalizeFile(test.fileName, test.format, test.content)
			if test.wantFailure {
				if err == nil {
					t.Fatal("expected an error")
				}
				return
			}
			if err != nil {
				t.Fatalf("normalizeFile: %v", err)
			}
			if name != test.wantName || contentType != test.wantType {
				t.Fatalf("got (%q, %q), want (%q, %q)", name, contentType, test.wantName, test.wantType)
			}
		})
	}
}
