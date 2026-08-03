package workflow

import (
	"context"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"io"
	"strings"
)

const maxWorkflowOutputFileNameRunes = 90

var workflowOutputFileFormats = map[string]struct {
	extension   string
	contentType string
}{
	"markdown": {extension: ".md", contentType: "text/markdown; charset=utf-8"},
	"json":     {extension: ".json", contentType: "application/json; charset=utf-8"},
	"csv":      {extension: ".csv", contentType: "text/csv; charset=utf-8"},
}

// FileCreateCapabilityAdapter validates a small, deterministic set of text
// formats and delegates persistence to the application boundary.
type FileCreateCapabilityAdapter struct{}

func (FileCreateCapabilityAdapter) Execute(ctx context.Context, run RunContext, execution NodeExecution) (NodeResult, error) {
	if run.FileWriter == nil {
		return NodeResult{}, fmt.Errorf("文件产出未配置")
	}
	format := strings.ToLower(strings.TrimSpace(stringFromValue(execution.Input["format"])))
	definition, exists := workflowOutputFileFormats[format]
	if !exists {
		return NodeResult{}, fmt.Errorf("文件格式仅支持 markdown、json 或 csv")
	}
	content := stringFromValue(execution.Input["content"])
	if strings.TrimSpace(content) == "" {
		return NodeResult{}, fmt.Errorf("文件内容不能为空")
	}
	if err := validateWorkflowOutputFileContent(format, content); err != nil {
		return NodeResult{}, err
	}
	name := normalizeWorkflowOutputFileName(stringFromValue(execution.Input["fileName"]), definition.extension)
	if name == "" {
		return NodeResult{}, fmt.Errorf("文件名不能为空")
	}
	result, err := run.FileWriter.WriteFile(ctx, run.Actor.UserID, FileWriteRequest{FileName: name, Format: format, Content: content})
	if err != nil {
		return NodeResult{}, err
	}
	return NodeResult{Output: map[string]any{"resourceId": result.ResourceID, "fileName": result.FileName, "url": result.URL, "contentType": result.ContentType, "size": result.Size}}, nil
}

func validateWorkflowOutputFileContent(format, content string) error {
	switch format {
	case "json":
		if !json.Valid([]byte(content)) {
			return fmt.Errorf("JSON 文件内容不是有效 JSON")
		}
	case "csv":
		reader := csv.NewReader(strings.NewReader(content))
		if _, err := reader.ReadAll(); err != nil && err != io.EOF {
			return fmt.Errorf("CSV 文件内容无效：%w", err)
		}
	}
	return nil
}

func normalizeWorkflowOutputFileName(value, extension string) string {
	name := strings.Trim(strings.TrimSpace(value), ".")
	if name == "" {
		return ""
	}
	name = strings.NewReplacer("/", "-", "\\", "-", "\x00", "").Replace(name)
	runes := []rune(name)
	if len(runes) > maxWorkflowOutputFileNameRunes {
		name = string(runes[:maxWorkflowOutputFileNameRunes])
	}
	if strings.HasSuffix(strings.ToLower(name), extension) {
		return name
	}
	return name + extension
}
