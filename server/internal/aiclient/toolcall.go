package aiclient

import (
	"net/http"
	"strings"

	arkmodel "github.com/volcengine/volcengine-go-sdk/service/arkruntime/model"
)

// NewARKChatRequestWithTools 构造带 tools / tool_choice 的 ARK 请求。
// 用于 function-calling 场景（例如 Life Trace 生活助理提交结构化动作）。
// 默认 MaxTokens=420, Temperature=0.2, ParallelToolCalls=false，可通过 opts 覆盖。
func NewARKChatRequestWithTools(
	modelID string,
	messages []*arkmodel.ChatCompletionMessage,
	tools []*arkmodel.Tool,
	toolChoice arkmodel.ToolChoice,
	opts ...ARKChatOption,
) arkmodel.CreateChatCompletionRequest {
	o := arkChatRequestOpts{maxTokens: 420, temperature: 0.2}
	for _, fn := range opts {
		fn(&o)
	}
	maxTokens := o.maxTokens
	temperature := o.temperature
	parallelToolCalls := false
	return arkmodel.CreateChatCompletionRequest{
		Model:             modelID,
		Messages:          messages,
		MaxTokens:         &maxTokens,
		Temperature:       &temperature,
		Tools:             tools,
		ToolChoice:        toolChoice,
		ParallelToolCalls: &parallelToolCalls,
	}
}

// IsARKToolUnsupportedError 判断 ARK SDK 返回的错误是否属于 "tools 不支持" 类别，
// 用于决定是否降级到 JSON mode。逐字节等价于 lifetrace 域的原始判定：
// 只要错误消息（小写）里包含 "tools" / "tool_choice" / "tool_calls" 任一即视为不支持。
func IsARKToolUnsupportedError(err error) bool {
	if err == nil {
		return false
	}
	lower := strings.ToLower(err.Error())
	return strings.Contains(lower, "tools") ||
		strings.Contains(lower, "tool_choice") ||
		strings.Contains(lower, "tool_calls")
}

// IsOpenAIToolUnsupported 判断 OpenAI 兼容上游 400 响应是否属于 "tools 不支持"，
// 与 lifetrace 域历史实现字节等价：statusCode 必须为 400，body（小写）同时命中
// tools/tool_choice/tool_calls 之一 与 not supported/invalid 之一。
func IsOpenAIToolUnsupported(statusCode int, respBody []byte) bool {
	if statusCode != http.StatusBadRequest {
		return false
	}
	body := strings.ToLower(string(respBody))
	if !(strings.Contains(body, "tools") || strings.Contains(body, "tool_choice") || strings.Contains(body, "tool_calls")) {
		return false
	}
	return strings.Contains(body, "not supported") || strings.Contains(body, "invalid")
}
