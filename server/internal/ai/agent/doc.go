// Package agent 提供 Valley MAS 的通用 AI Agent 运行时。
//
// 设计约束（阶段 A · 手写 tool loop）：
//
//   - 领域中性：Message / ToolCall / Event / Result / Spec 不使用任何上游
//     SDK 类型（ARK arkmodel.* / OpenAI openai.* / eino schema.* 等）。
//     这是为了在阶段 B 引入 CloudWeGo eino 时，只替换 loop 实现即可，
//     handler 与 tool 层零改动。
//   - 单向依赖：本包只 import 标准库、internal/aiclient、internal/aiusage、
//     internal/ai/tools。禁止 import 任何业务包（lifetrace / mindarena /
//     handler / model / database）。
//   - 只做串行 loop：每一步等前一步 tool 全部执行完再进入下一轮。并行
//     tool_call、子 agent、图状态机、中断-恢复均属于阶段 B。
//
// 未来迁 eino 时的替换点：
//
//   - agent/runtime.go 的接口和类型：保留不动。
//   - agent/loop.go 的 LocalLoop：整体替换为基于 eino compose 的实现。
//   - agent/backend.go 的 Backend 接口：保留，作为 aiclient 与 loop 之间的中性适配层。
//   - internal/ai/tools / handler：完全不动。
package agent
