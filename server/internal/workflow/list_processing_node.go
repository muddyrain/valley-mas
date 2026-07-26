package workflow

import (
	"context"
	"encoding/json"
	"fmt"
	"reflect"
	"sort"
	"strconv"
	"strings"
)

const maxListProcessingItems = 10000

type ListProcessingCapabilityAdapter struct{}

func (ListProcessingCapabilityAdapter) Execute(
	ctx context.Context,
	_ RunContext,
	execution NodeExecution,
) (NodeResult, error) {
	if err := ctx.Err(); err != nil {
		return NodeResult{}, err
	}
	items, err := listItemsFromValue(execution.Input["items"])
	if err != nil {
		return NodeResult{}, err
	}
	if len(items) > maxListProcessingItems {
		return NodeResult{}, fmt.Errorf("列表处理最多支持 %d 项", maxListProcessingItems)
	}

	operation := stringFromValue(execution.Input["operation"])
	if operation == "" {
		operation = "filter"
	}
	field := stringFromValue(execution.Input["field"])
	if len(field) > 200 {
		return NodeResult{}, fmt.Errorf("列表处理字段路径不能超过 200 个字符")
	}

	var output []any
	switch operation {
	case "filter":
		output, err = filterListItems(items, field, stringFromValue(execution.Input["operator"]), execution.Input["value"])
	case "map":
		output = mapListItems(items, field)
	case "sort":
		output, err = sortListItems(items, field, stringFromValue(execution.Input["direction"]))
	case "dedupe":
		output = dedupeListItems(items, field)
	default:
		err = fmt.Errorf("列表处理操作无效")
	}
	if err != nil {
		return NodeResult{}, err
	}
	return NodeResult{Output: map[string]any{
		"items":         output,
		"count":         len(output),
		"originalCount": len(items),
	}}, nil
}

func listItemsFromValue(value any) ([]any, error) {
	if items, ok := value.([]any); ok {
		return append([]any(nil), items...), nil
	}
	reflected := reflect.ValueOf(value)
	if !reflected.IsValid() || (reflected.Kind() != reflect.Slice && reflected.Kind() != reflect.Array) {
		return nil, fmt.Errorf("列表处理输入必须是数组")
	}
	items := make([]any, reflected.Len())
	for index := range items {
		items[index] = reflected.Index(index).Interface()
	}
	return items, nil
}

func filterListItems(items []any, field, operator string, expected any) ([]any, error) {
	if operator == "" {
		operator = "equals"
	}
	allowed := map[string]bool{
		"equals": true, "notEquals": true, "contains": true,
		"greaterThan": true, "greaterOrEqual": true,
		"lessThan": true, "lessOrEqual": true,
		"isEmpty": true, "notEmpty": true,
	}
	if !allowed[operator] {
		return nil, fmt.Errorf("列表筛选操作符无效")
	}
	if strings.Contains(operator, "Than") || strings.Contains(operator, "OrEqual") {
		if _, ok := numericListValue(expected); !ok {
			return nil, fmt.Errorf("列表筛选比较值必须是数字")
		}
	}

	output := make([]any, 0, len(items))
	for _, item := range items {
		actual, found := listFieldValue(item, field)
		if !found {
			actual = nil
		}
		if listValueMatches(actual, operator, expected) {
			output = append(output, item)
		}
	}
	return output, nil
}

func mapListItems(items []any, field string) []any {
	output := make([]any, len(items))
	for index, item := range items {
		value, _ := listFieldValue(item, field)
		output[index] = value
	}
	return output
}

func sortListItems(items []any, field, direction string) ([]any, error) {
	if direction == "" {
		direction = "asc"
	}
	if direction != "asc" && direction != "desc" {
		return nil, fmt.Errorf("列表排序方向无效")
	}
	output := append([]any(nil), items...)
	sort.SliceStable(output, func(leftIndex, rightIndex int) bool {
		left, leftFound := listFieldValue(output[leftIndex], field)
		right, rightFound := listFieldValue(output[rightIndex], field)
		if !leftFound || left == nil {
			return false
		}
		if !rightFound || right == nil {
			return true
		}
		comparison := compareListValues(left, right)
		if direction == "desc" {
			return comparison > 0
		}
		return comparison < 0
	})
	return output, nil
}

func dedupeListItems(items []any, field string) []any {
	seen := make(map[string]bool, len(items))
	output := make([]any, 0, len(items))
	for _, item := range items {
		value, found := listFieldValue(item, field)
		key := "<missing>"
		if found {
			key = stableListValueKey(value)
		}
		if seen[key] {
			continue
		}
		seen[key] = true
		output = append(output, item)
	}
	return output
}

func listFieldValue(value any, field string) (any, bool) {
	if field == "" {
		return value, true
	}
	current := reflect.ValueOf(value)
	for _, segment := range strings.Split(field, ".") {
		if segment == "" {
			return nil, false
		}
		for current.IsValid() && (current.Kind() == reflect.Pointer || current.Kind() == reflect.Interface) {
			if current.IsNil() {
				return nil, false
			}
			current = current.Elem()
		}
		if !current.IsValid() {
			return nil, false
		}
		switch current.Kind() {
		case reflect.Map:
			key := reflect.ValueOf(segment)
			if !key.Type().AssignableTo(current.Type().Key()) {
				return nil, false
			}
			current = current.MapIndex(key)
		case reflect.Struct:
			found := false
			for index := 0; index < current.NumField(); index++ {
				fieldInfo := current.Type().Field(index)
				jsonName := strings.Split(fieldInfo.Tag.Get("json"), ",")[0]
				if jsonName == segment || strings.EqualFold(fieldInfo.Name, segment) {
					current = current.Field(index)
					found = true
					break
				}
			}
			if !found {
				return nil, false
			}
		case reflect.Slice, reflect.Array:
			index, err := strconv.Atoi(segment)
			if err != nil || index < 0 || index >= current.Len() {
				return nil, false
			}
			current = current.Index(index)
		default:
			return nil, false
		}
	}
	if !current.IsValid() || !current.CanInterface() {
		return nil, false
	}
	return current.Interface(), true
}

func listValueMatches(actual any, operator string, expected any) bool {
	switch operator {
	case "equals":
		if left, leftOK := numericListValue(actual); leftOK {
			if right, rightOK := numericListValue(expected); rightOK {
				return left == right
			}
		}
		return fmt.Sprint(actual) == fmt.Sprint(expected)
	case "notEquals":
		return !listValueMatches(actual, "equals", expected)
	case "contains":
		return strings.Contains(fmt.Sprint(actual), fmt.Sprint(expected))
	case "isEmpty":
		return isEmptyListValue(actual)
	case "notEmpty":
		return !isEmptyListValue(actual)
	case "greaterThan", "greaterOrEqual", "lessThan", "lessOrEqual":
		left, leftOK := numericListValue(actual)
		right, rightOK := numericListValue(expected)
		if !leftOK || !rightOK {
			return false
		}
		switch operator {
		case "greaterThan":
			return left > right
		case "greaterOrEqual":
			return left >= right
		case "lessThan":
			return left < right
		default:
			return left <= right
		}
	default:
		return false
	}
}

func numericListValue(value any) (float64, bool) {
	switch typed := value.(type) {
	case json.Number:
		number, err := typed.Float64()
		return number, err == nil
	case float64:
		return typed, true
	case float32:
		return float64(typed), true
	case int:
		return float64(typed), true
	case int8:
		return float64(typed), true
	case int16:
		return float64(typed), true
	case int32:
		return float64(typed), true
	case int64:
		return float64(typed), true
	case uint:
		return float64(typed), true
	case uint8:
		return float64(typed), true
	case uint16:
		return float64(typed), true
	case uint32:
		return float64(typed), true
	case uint64:
		return float64(typed), true
	case string:
		number, err := strconv.ParseFloat(strings.TrimSpace(typed), 64)
		return number, err == nil
	default:
		return 0, false
	}
}

func compareListValues(left, right any) int {
	if leftNumber, leftOK := numericListValue(left); leftOK {
		if rightNumber, rightOK := numericListValue(right); rightOK {
			switch {
			case leftNumber < rightNumber:
				return -1
			case leftNumber > rightNumber:
				return 1
			default:
				return 0
			}
		}
	}
	return strings.Compare(strings.ToLower(fmt.Sprint(left)), strings.ToLower(fmt.Sprint(right)))
}

func isEmptyListValue(value any) bool {
	if value == nil {
		return true
	}
	reflected := reflect.ValueOf(value)
	switch reflected.Kind() {
	case reflect.String, reflect.Array, reflect.Slice, reflect.Map:
		return reflected.Len() == 0
	default:
		return false
	}
}

func stableListValueKey(value any) string {
	encoded, err := json.Marshal(value)
	if err == nil {
		return string(encoded)
	}
	return fmt.Sprintf("%T:%v", value, value)
}
