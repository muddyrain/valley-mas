package agent

import (
	"context"
)

// Backend 是 agent loop 与具体上游 LLM Provider 之间的中性适配层。
//
// 一次 Chat 调用输入 messages + tools，输出模型的下一条 assistant 消息。
// 若返回的消息带 ToolCalls，loop 负责执行 tool 并把结果 append 后再次调用；
// 否则视为终态，loop 退出。
//
// Backend 由具体实现（例如 aiclient 之上的 arkBackend / openaiBackend）
// 完成 Message ↔ 上游 SDK 类型的双向转换。loop 层完全不感知上游 SDK。
type Backend interface {
	Chat(ctx context.Context, spec Spec, msgs []Message, tools []ToolDescriptor) (BackendResponse, error)
}

// StreamingBackend 是可选扩展。支持它的上游会在生成时通过 emit 推送文本增量，
// 同时仍返回完整消息，以便 LocalLoop 统一处理 tool call 和最终结果。
type StreamingBackend interface {
	Backend
	ChatStream(ctx context.Context, spec Spec, msgs []Message, tools []ToolDescriptor, emit func(string)) (BackendResponse, error)
}

// BackendResponse 是一次 Chat 的返回值。
// Message 一定是 RoleAssistant。若 ToolCalls 非空表示模型请求调用工具。
type BackendResponse struct {
	Message Message
	Model   string
}
