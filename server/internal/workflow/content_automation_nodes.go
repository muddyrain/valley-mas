package workflow

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"strings"
	"unicode/utf8"

	"valley-server/internal/documenttext"
)

const (
	maxStructuredExtractionRunes = 200_000
	maxStructuredSchemaFields    = 20
	maxJSONInputBytes            = 1 << 20
	maxBatchItems                = 10_000
	maxBatchSize                 = 100
)

// DocumentExtractCapabilityAdapter converts an uploaded document into stable,
// page-aware plain text without calling a model.
type DocumentExtractCapabilityAdapter struct{}

func (DocumentExtractCapabilityAdapter) Execute(_ context.Context, _ RunContext, execution NodeExecution) (NodeResult, error) {
	file, err := documentFileFromValue(execution.Input["fileInput"])
	if err != nil {
		return NodeResult{}, err
	}
	result, err := documenttext.Extract(documenttext.Input{
		Filename: file.Filename, ContentType: file.ContentType, Content: file.Content,
	})
	if err != nil {
		return NodeResult{}, err
	}
	return NodeResult{Output: map[string]any{
		"text":           result.Text,
		"pages":          result.Pages,
		"format":         result.Format,
		"pageCount":      result.PageCount,
		"characterCount": result.CharacterCount,
	}}, nil
}

func documentFileFromValue(value any) (FileInput, error) {
	switch typed := value.(type) {
	case FileInput:
		return typed, nil
	case *FileInput:
		if typed != nil {
			return *typed, nil
		}
	}
	return FileInput{}, errors.New("文档文件不存在")
}

// StructuredExtractCapabilityAdapter uses the selected text model to extract
// one JSON object, then rejects outputs that do not match the declared schema.
type StructuredExtractCapabilityAdapter struct {
	Generator TextGenerator
}

func (adapter StructuredExtractCapabilityAdapter) Execute(ctx context.Context, _ RunContext, execution NodeExecution) (NodeResult, error) {
	text := strings.TrimSpace(stringFromValue(execution.Input["text"]))
	if text == "" {
		return NodeResult{}, errors.New("结构化提取文本不能为空")
	}
	if utf8.RuneCountInString(text) > maxStructuredExtractionRunes {
		return NodeResult{}, fmt.Errorf("结构化提取文本不能超过 %d 个字符", maxStructuredExtractionRunes)
	}
	schema, err := structuredExtractionSchema(execution.Input["schema"])
	if err != nil {
		return NodeResult{}, err
	}
	modelID := stringFromValue(execution.Input["modelId"])
	generator := adapter.Generator
	if generator == nil {
		if modelID == "" {
			return NodeResult{}, errors.New("请选择一个文本模型")
		}
		generator = CatalogTextGenerator{}
	}
	instruction := stringFromValue(execution.Input["instruction"])
	if instruction == "" {
		instruction = "从待提取文本中提取声明字段；没有依据时不要编造。"
	}
	prompt := structuredOutputPrompt(
		instruction+"\n\n待提取文本：\n"+text,
		schema,
	)
	result, err := generator.Generate(ctx, TextGenerationRequest{
		ModelID:         modelID,
		SystemPrompt:    "你是结构化信息提取器。只依据用户提供的文本返回结果。",
		Prompt:          prompt,
		Temperature:     0,
		MaxOutputTokens: 2048,
	})
	if err != nil {
		return NodeResult{}, err
	}
	data, err := parseStructuredLLMOutput(result.Text, schema)
	if err != nil {
		return NodeResult{}, err
	}
	return NodeResult{Output: map[string]any{
		"data":       data,
		"model":      result.Model,
		"tokenUsage": result.TokenUsage,
	}}, nil
}

func structuredExtractionSchema(value any) (map[string]ValueType, error) {
	raw, ok := value.(map[string]any)
	if !ok || len(raw) == 0 {
		return nil, errors.New("结构化提取必须声明字段")
	}
	if len(raw) > maxStructuredSchemaFields {
		return nil, fmt.Errorf("结构化提取字段不能超过 %d 个", maxStructuredSchemaFields)
	}
	schema := make(map[string]ValueType, len(raw))
	for rawName, rawType := range raw {
		name := strings.TrimSpace(rawName)
		valueType := ValueType(stringFromValue(rawType))
		if name == "" || !validValueType(valueType) || valueType == ValueTypeFile {
			return nil, fmt.Errorf("结构化提取字段 %q 类型无效", rawName)
		}
		schema[name] = valueType
	}
	return schema, nil
}

// JSONParseCapabilityAdapter validates JSON and exposes a root object for
// downstream typed bindings.
type JSONParseCapabilityAdapter struct{}

func (JSONParseCapabilityAdapter) Execute(_ context.Context, _ RunContext, execution NodeExecution) (NodeResult, error) {
	text := strings.TrimSpace(stringFromValue(execution.Input["text"]))
	if text == "" {
		return NodeResult{}, errors.New("JSON 文本不能为空")
	}
	if len(text) > maxJSONInputBytes {
		return NodeResult{}, fmt.Errorf("JSON 文本不能超过 %dMB", maxJSONInputBytes>>20)
	}
	decoder := json.NewDecoder(strings.NewReader(text))
	var value map[string]any
	if err := decoder.Decode(&value); err != nil {
		return NodeResult{}, fmt.Errorf("JSON 解析失败: %w", err)
	}
	if err := rejectTrailingJSON(decoder); err != nil {
		return NodeResult{}, err
	}
	if value == nil {
		return NodeResult{}, errors.New("JSON 根值必须是对象")
	}
	return NodeResult{Output: map[string]any{"value": value}}, nil
}

func rejectTrailingJSON(decoder *json.Decoder) error {
	var trailing any
	if err := decoder.Decode(&trailing); err == io.EOF {
		return nil
	} else if err != nil {
		return fmt.Errorf("JSON 解析失败: %w", err)
	}
	return errors.New("JSON 文本只能包含一个根对象")
}

// ChunkListCapabilityAdapter prepares batches. Loop remains the single runtime
// primitive responsible for iterating those batches.
type ChunkListCapabilityAdapter struct{}

func (ChunkListCapabilityAdapter) Execute(_ context.Context, _ RunContext, execution NodeExecution) (NodeResult, error) {
	items, err := arrayFromValue(execution.Input["items"])
	if err != nil {
		return NodeResult{}, err
	}
	if len(items) > maxBatchItems {
		return NodeResult{}, fmt.Errorf("批处理项目不能超过 %d 项", maxBatchItems)
	}
	sizeValue := numberFromValue(execution.Input["batchSize"])
	if sizeValue < 1 || sizeValue > maxBatchSize || math.Trunc(sizeValue) != sizeValue {
		return NodeResult{}, fmt.Errorf("每批数量必须是 1 到 %d 的整数", maxBatchSize)
	}
	batchSize := int(sizeValue)
	batches := make([]any, 0, (len(items)+batchSize-1)/batchSize)
	for start := 0; start < len(items); start += batchSize {
		end := min(start+batchSize, len(items))
		batches = append(batches, append([]any(nil), items[start:end]...))
	}
	return NodeResult{Output: map[string]any{
		"batches":    batches,
		"batchCount": len(batches),
		"itemCount":  len(items),
	}}, nil
}

func arrayFromValue(value any) ([]any, error) {
	switch typed := value.(type) {
	case []any:
		return append([]any(nil), typed...), nil
	case []string:
		result := make([]any, len(typed))
		for index, item := range typed {
			result[index] = item
		}
		return result, nil
	default:
		return nil, errors.New("批处理项目必须是数组")
	}
}
