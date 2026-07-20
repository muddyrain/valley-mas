package workflow

import (
	"context"
	"encoding/json"
	"fmt"
	"regexp"
	"strings"
)

var switchCaseIDPattern = regexp.MustCompile(`^[a-z][a-z0-9_-]{0,39}$`)

type switchCase struct {
	ID    string `json:"id"`
	Label string `json:"label"`
	Value any    `json:"value"`
}

type switchNodeConfig struct {
	Value     any          `json:"value"`
	ValueType ValueType    `json:"valueType"`
	Cases     []switchCase `json:"cases"`
}

type SwitchExecutor struct{}

func (SwitchExecutor) Type() NodeType { return NodeTypeSwitch }

func (SwitchExecutor) Execute(_ context.Context, _ RunContext, execution NodeExecution) (NodeResult, error) {
	config, err := switchConfigFromMap(execution.Input)
	if err != nil {
		return NodeResult{}, err
	}
	for _, item := range config.Cases {
		if switchValuesEqual(config.ValueType, config.Value, item.Value) {
			return NodeResult{Output: map[string]any{"matchedCaseId": item.ID, "matchedLabel": item.Label, "matchedValue": config.Value}}, nil
		}
	}
	return NodeResult{Output: map[string]any{"matchedCaseId": "default", "matchedLabel": "默认", "matchedValue": config.Value}}, nil
}

func validateSwitchConfig(nodeID string, config map[string]any) []string {
	parsed, err := switchConfigFromMap(config)
	if err == nil {
		if parsed.Value == nil {
			err = fmt.Errorf("value 不能为空")
		} else if actual, ok := literalValueType(parsed.Value); ok && actual != parsed.ValueType && !isSwitchReference(parsed.Value) {
			err = fmt.Errorf("value 类型必须为 %s", parsed.ValueType)
		}
	}
	if err == nil {
		return nil
	}
	return []string{fmt.Sprintf("选择器节点 %s 配置无效：%v", nodeID, err)}
}

func switchBranchHandles(config map[string]any) []string {
	parsed, err := switchConfigFromMap(config)
	if err != nil {
		return nil
	}
	handles := make([]string, 0, len(parsed.Cases)+1)
	for _, item := range parsed.Cases {
		handles = append(handles, "case:"+item.ID)
	}
	return append(handles, "default")
}

func switchConfigFromMap(config map[string]any) (switchNodeConfig, error) {
	encoded, err := json.Marshal(config)
	if err != nil {
		return switchNodeConfig{}, err
	}
	var parsed switchNodeConfig
	if err := json.Unmarshal(encoded, &parsed); err != nil {
		return switchNodeConfig{}, err
	}
	if parsed.ValueType != ValueTypeString && parsed.ValueType != ValueTypeNumber && parsed.ValueType != ValueTypeBoolean {
		return switchNodeConfig{}, fmt.Errorf("valueType 必须为 string、number 或 boolean")
	}
	if len(parsed.Cases) < 2 || len(parsed.Cases) > 8 {
		return switchNodeConfig{}, fmt.Errorf("case 数量必须为 2 到 8 个")
	}
	seenIDs := map[string]bool{}
	seenValues := map[string]bool{}
	for index := range parsed.Cases {
		item := &parsed.Cases[index]
		item.ID = strings.TrimSpace(item.ID)
		item.Label = strings.TrimSpace(item.Label)
		if !switchCaseIDPattern.MatchString(item.ID) || item.ID == "default" || seenIDs[item.ID] {
			return switchNodeConfig{}, fmt.Errorf("第 %d 个 case ID 无效或重复", index+1)
		}
		if item.Label == "" || len([]rune(item.Label)) > 80 {
			return switchNodeConfig{}, fmt.Errorf("第 %d 个 case 名称无效", index+1)
		}
		actual, ok := literalValueType(item.Value)
		if !ok || actual != parsed.ValueType {
			return switchNodeConfig{}, fmt.Errorf("第 %d 个 case 值类型必须为 %s", index+1, parsed.ValueType)
		}
		key := fmt.Sprintf("%T:%v", item.Value, item.Value)
		if seenValues[key] {
			return switchNodeConfig{}, fmt.Errorf("第 %d 个 case 值重复", index+1)
		}
		seenIDs[item.ID] = true
		seenValues[key] = true
	}
	return parsed, nil
}

func isSwitchReference(value any) bool {
	text, ok := value.(string)
	if !ok {
		return false
	}
	trimmed := strings.TrimSpace(text)
	return strings.HasPrefix(trimmed, "{{") && strings.HasSuffix(trimmed, "}}")
}

func literalValueType(value any) (ValueType, bool) {
	switch value.(type) {
	case string:
		return ValueTypeString, true
	case bool:
		return ValueTypeBoolean, true
	case float64, float32, int, int32, int64, uint, uint32, uint64:
		return ValueTypeNumber, true
	default:
		return "", false
	}
}

func switchValuesEqual(valueType ValueType, left, right any) bool {
	switch valueType {
	case ValueTypeString:
		leftValue, leftOK := left.(string)
		rightValue, rightOK := right.(string)
		return leftOK && rightOK && leftValue == rightValue
	case ValueTypeBoolean:
		leftValue, leftOK := left.(bool)
		rightValue, rightOK := right.(bool)
		return leftOK && rightOK && leftValue == rightValue
	case ValueTypeNumber:
		return numberFromValue(left) == numberFromValue(right)
	default:
		return false
	}
}
