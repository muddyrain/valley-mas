package aiclient

import "strings"

// ExtractJSONObject 从原始字符串中抽取 JSON 对象主体：
// 去掉 ```json / ``` 围栏、TrimSpace，定位首尾大括号；找不到时退回 TrimSpace 后的原文。
func ExtractJSONObject(raw string) string {
	text := strings.TrimSpace(raw)
	if strings.HasPrefix(text, "```") {
		text = strings.TrimPrefix(text, "```json")
		text = strings.TrimPrefix(text, "```")
		text = strings.TrimSuffix(text, "```")
		text = strings.TrimSpace(text)
	}
	start := strings.Index(text, "{")
	end := strings.LastIndex(text, "}")
	if start >= 0 && end >= start {
		return text[start : end+1]
	}
	return text
}
