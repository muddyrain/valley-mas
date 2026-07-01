package ai

import "errors"

// ErrAssistantToolUnsupported 表示上游拒绝 tool_calls 请求，需要降级到 JSON mode。
// 由 IsARKToolUnsupportedError / IsOpenAIToolUnsupported 触发。
var ErrAssistantToolUnsupported = errors.New("assistant tool calling unsupported")

// ErrAssistantToolInvalid 表示上游返回了 tool_calls 结构，但内容缺失或 arguments 解析失败。
// 上层通常会尝试 JSON mode 兜底。
var ErrAssistantToolInvalid = errors.New("assistant tool calling invalid")
