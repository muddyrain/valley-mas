package workflow

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"valley-server/internal/aiclient"
)

const (
	llmOutputModeText = "text"
	llmOutputModeJSON = "json"
)

var ErrLLMStructuredOutputInvalid = errors.New("LLM_STRUCTURED_OUTPUT_INVALID")

func llmOutputFields(config map[string]any) (map[string]ValueType, error) {
	schema, structured, err := llmStructuredOutputSchema(config)
	if err != nil {
		return nil, err
	}
	if !structured {
		return fields(field("text", ValueTypeString), field("model", ValueTypeString), field("tokenUsage", ValueTypeNumber)), nil
	}
	result := make(map[string]ValueType, len(schema)+2)
	for name, valueType := range schema {
		result[name] = valueType
	}
	result["model"] = ValueTypeString
	result["tokenUsage"] = ValueTypeNumber
	return result, nil
}

func llmStructuredOutputSchema(config map[string]any) (map[string]ValueType, bool, error) {
	mode := strings.TrimSpace(stringFromValue(config["outputMode"]))
	if mode == "" || mode == llmOutputModeText {
		return nil, false, nil
	}
	if mode != llmOutputModeJSON {
		return nil, false, fmt.Errorf("大模型节点 outputMode 必须为 text 或 json")
	}
	raw, ok := config["outputSchema"].(map[string]any)
	if !ok || len(raw) == 0 {
		return nil, true, fmt.Errorf("大模型节点 JSON 输出必须声明字段")
	}
	schema := make(map[string]ValueType, len(raw))
	for name, rawType := range raw {
		valueType := ValueType(stringFromValue(rawType))
		if strings.TrimSpace(name) == "" || !validValueType(valueType) || valueType == ValueTypeFile {
			return nil, true, fmt.Errorf("大模型节点 JSON 输出字段 %s 类型无效", name)
		}
		if name == "model" || name == "tokenUsage" {
			return nil, true, fmt.Errorf("大模型节点 JSON 输出字段 %s 为保留名称", name)
		}
		schema[name] = valueType
	}
	return schema, true, nil
}

func structuredOutputPrompt(prompt string, schema map[string]ValueType) string {
	encoded, _ := json.Marshal(schema)
	return prompt + "\n\n请只返回一个 JSON 对象，不要使用 Markdown 代码块。字段和类型必须严格符合：" + string(encoded)
}

func parseStructuredLLMOutput(raw string, schema map[string]ValueType) (map[string]any, error) {
	var output map[string]any
	if err := json.Unmarshal([]byte(aiclient.ExtractJSONObject(raw)), &output); err != nil {
		return nil, fmt.Errorf("%w: 返回内容不是 JSON 对象", ErrLLMStructuredOutputInvalid)
	}
	for name, valueType := range schema {
		value, exists := output[name]
		if !exists || !matchesWorkflowValueType(value, valueType) {
			return nil, fmt.Errorf("%w: 字段 %s 不符合 %s", ErrLLMStructuredOutputInvalid, name, valueType)
		}
	}
	return output, nil
}

func matchesWorkflowValueType(value any, valueType ValueType) bool {
	switch valueType {
	case ValueTypeString:
		_, ok := value.(string)
		return ok
	case ValueTypeNumber:
		_, ok := value.(float64)
		return ok
	case ValueTypeBoolean:
		_, ok := value.(bool)
		return ok
	case ValueTypeObject:
		_, ok := value.(map[string]any)
		return ok
	case ValueTypeStringList:
		items, ok := value.([]any)
		return ok && allStrings(items)
	default:
		return false
	}
}

func allStrings(items []any) bool {
	for _, item := range items {
		if _, ok := item.(string); !ok {
			return false
		}
	}
	return true
}
