package aiclient

// OpenAI 兼容接口的请求/响应/工具调用类型定义。
// 与 OpenAI Chat Completions API 字段 1:1 对齐，字段命名和 JSON tag
// 保持与 lifetrace 域历史实现字节等价，便于其他包按名字直接构造。

// OpenAIRequest 是 chat/completions 请求 body。
type OpenAIRequest struct {
	Model             string          `json:"model"`
	Messages          []OpenAIMessage `json:"messages"`
	Temperature       float64         `json:"temperature,omitempty"`
	MaxTokens         int             `json:"max_tokens,omitempty"`
	ResponseFormat    *OpenAIResponseFormat `json:"response_format,omitempty"`
	Stream            bool            `json:"stream,omitempty"`
	Tools             []OpenAITool    `json:"tools,omitempty"`
	ToolChoice        interface{}     `json:"tool_choice,omitempty"`
	ParallelToolCalls *bool           `json:"parallel_tool_calls,omitempty"`
}

// OpenAIMessage 表示一条对话消息，兼容 request/response/stream delta 三种场景。
type OpenAIMessage struct {
	Role      string             `json:"role"`
	Content   string             `json:"content"`
	ToolCalls []OpenAIToolCall   `json:"tool_calls,omitempty"`
}

// OpenAITool 描述 tools 数组中的单个工具定义。
type OpenAITool struct {
	Type     string                     `json:"type"`
	Function *OpenAIFunctionDefinition  `json:"function,omitempty"`
}

// OpenAIFunctionDefinition 是 function-calling 工具的 schema。
type OpenAIFunctionDefinition struct {
	Name        string      `json:"name"`
	Description string      `json:"description,omitempty"`
	Parameters  interface{} `json:"parameters"`
}

// OpenAIToolChoice 描述强制调用某个 function 的 tool_choice payload。
type OpenAIToolChoice struct {
	Type     string                    `json:"type"`
	Function OpenAIToolChoiceFunction  `json:"function"`
}

// OpenAIToolChoiceFunction 是 tool_choice.function 子字段。
type OpenAIToolChoiceFunction struct {
	Name string `json:"name"`
}

// OpenAIToolCall 是响应里的 tool_calls 元素。
type OpenAIToolCall struct {
	ID       string                 `json:"id,omitempty"`
	Type     string                 `json:"type,omitempty"`
	Function OpenAIFunctionCall     `json:"function"`
}

// OpenAIFunctionCall 携带 tool_call 的函数名与 JSON 编码的参数字符串。
type OpenAIFunctionCall struct {
	Name      string `json:"name,omitempty"`
	Arguments string `json:"arguments,omitempty"`
}

// OpenAIResponseFormat 用于 response_format 字段（JSON mode 等）。
type OpenAIResponseFormat struct {
	Type string `json:"type"`
}

// OpenAIResponse 是 chat/completions 非流式响应 body。
type OpenAIResponse struct {
	Model   string `json:"model"`
	Choices []struct {
		Message OpenAIMessage `json:"message"`
	} `json:"choices"`
}

// OpenAIStreamResponse 是 SSE 流每帧的 body 结构。
type OpenAIStreamResponse struct {
	Model   string `json:"model"`
	Choices []struct {
		Delta        OpenAIMessage `json:"delta"`
		FinishReason string        `json:"finish_reason"`
	} `json:"choices"`
}
