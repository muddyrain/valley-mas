package agent

import (
	"context"
	"encoding/json"
	"errors"
)

// Role 是消息发送方的角色。
type Role string

const (
	RoleSystem    Role = "system"
	RoleUser      Role = "user"
	RoleAssistant Role = "assistant"
	RoleTool      Role = "tool"
)

// Message 是 loop 与 backend 之间流转的中性对话消息。
// 语义参照 OpenAI Chat Completions，但不使用任何上游 SDK 类型。
//
//   - assistant 消息可能带 ToolCalls（表示模型请求调用工具）。
//   - tool 消息必须带 ToolCallID 与 ToolName（表示对应 tool 的执行结果）。
//   - system/user 消息只使用 Content。
type Message struct {
	Role       Role
	Content    string
	ToolCalls  []ToolCall
	ToolCallID string
	ToolName   string
}

// ToolCall 表示模型请求调用一次工具。
// Args 是工具的原始 JSON 参数字节，未做解析或校验。
type ToolCall struct {
	ID   string
	Name string
	Args json.RawMessage
}

// ToolDescriptor 是 backend 需要的工具元数据。
// 与 tools.Tool 语义一致，但避免 agent 直接依赖 tools 包类型（loop 层
// 内部把 tools.Tool 转成 ToolDescriptor 后再传给 backend）。
type ToolDescriptor struct {
	Name        string
	Description string
	Schema      map[string]any
}

// Spec 描述一次 agent 会话的运行时配置。
type Spec struct {
	// Provider 目前支持 "ark" | "openai"，与 aiclient 的双轨保持一致。
	Provider string
	// Model 是模型接入点或名称，直接透传给 backend。
	Model string
	// System 是本轮 agent 的 system prompt。
	System string
	// Tools 是本轮允许模型调用的 tool 名称白名单。
	// 空数组表示不允许调用工具（等价于普通 chat）。
	Tools []string
	// MaxSteps 限制 loop 最多迭代多少轮，避免死循环。默认 6。
	MaxSteps int
	// MaxTokens / Temperature 直接透传给 backend；<=0 时使用 backend 默认值。
	MaxTokens   int
	Temperature float32
	// Feature 用于 aiusage 打点归类，例如 "life-trace-assistant"。
	Feature string
}

// EventType 是 RunStream 分发的事件类型。
type EventType string

const (
	EventDelta      EventType = "delta"
	EventToolCall   EventType = "tool_call"
	EventToolResult EventType = "tool_result"
	EventDone       EventType = "done"
	EventError      EventType = "error"
)

// Event 是 RunStream 通过 channel 分发的中间事件。
// 上层 handler 负责把 Event 映射为具体协议（SSE / WebSocket）。
type Event struct {
	Type           EventType
	Delta          string
	ToolCall       *ToolCall
	ToolName       string
	ToolResult     json.RawMessage
	ToolDurationMs int64
	Result         *Result
	Err            error
}

// Result 是 Run 的最终返回值。
type Result struct {
	Reply string
	Steps int
	Model string
}

// AgentRuntime 是 agent loop 的对外接口。
// handler 只依赖此接口，具体实现（LocalLoop / eino-based）可以互换。
type AgentRuntime interface {
	Run(ctx context.Context, spec Spec, msgs []Message) (Result, error)
	RunStream(ctx context.Context, spec Spec, msgs []Message) (<-chan Event, error)
}

// ErrMaxStepsExceeded 表示 loop 达到 Spec.MaxSteps 上限仍未收敛。
// 上层可以选择返回最后一次 assistant 消息作为兜底文本。
var ErrMaxStepsExceeded = errors.New("agent: max steps exceeded")
