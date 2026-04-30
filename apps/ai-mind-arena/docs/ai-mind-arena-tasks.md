# AI Mind Arena - 开发任务清单

## 当前阶段
Phase 6：流式体验优化

## 当前正在做
Task 1：逐个生成嘉宾并实时推送到前端

---

## Phase 6：流式体验优化

### [ ] Task 1：逐个生成嘉宾并实时推送到前端
- 目标：辩论页默认没有嘉宾；后端开始执行后，生成完第 1 位嘉宾就立刻通过 SSE 推给前端，随后第 2、3、4、5 位依次入场，避免等待 5 位全部生成完才展示。
- 涉及文件：`server/internal/mindarena/service.go`、`server/internal/ai/openai_compatible.go`、`server/internal/ai/fallback.go`、`server/internal/ai/mock.go`、`server/internal/mindarena/service_test.go`
- 输入：议题 `topic`、模式 `mode`、目标人格数量 `personaCount`、固定人格模板 `PersonaTargets(count)`。
- 输出：`personas` SSE 事件可多次发送，每次包含当前已生成的人格列表和 `personaCount`，前端可展示 `1/5`、`2/5` 等渐进入场状态。
- 依赖：现有 `GeneratePersona`、`PERSONA_SINGLE_GENERATOR_PROMPT`、`buildSinglePersonaPromptInput`、`UpdatePersonas`、前端 `personas` SSE 监听逻辑。
- 验收：
  - `StreamDebate` 不再等待 `GeneratePersonas` 一次性返回全部人格后才发送首个 `personas` 事件。
  - 每生成 1 位人格后，先保存到 store，再发送一次 `personas` SSE。
  - 任意一位人格生成失败时，按当前错误事件协议发送 `error`，并将 session 标记为 `failed`。
  - 现有 `GET /api/v1/mind-arena/debates/:id` 仍能返回已生成的人格列表。
  - `server/internal/mindarena` 相关测试覆盖逐个入场顺序和事件数量。

### [ ] Task 2：评估是否逐个生成辩论发言
- 目标：确认是否也要把每轮批量 `GenerateDebateRound` 改成逐人格 `GenerateDebateMessage`，让发言从“等整轮生成完再播放”变成“某个人格生成完就立刻发言”。
- 涉及文件：`server/internal/mindarena/service.go`、`server/internal/ai/debate_messages.go`、`server/internal/mindarena/service_test.go`
- 输入：三轮辩论规则、`history`、当前人格、当前轮次。
- 输出：一份明确取舍结论；若执行实现，则每条 `message` SSE 来自单次人格发言生成。
- 依赖：Task 1 完成后的流式体验基线。
- 验收：
  - 明确记录“继续批量生成整轮”或“改为逐个发言”的理由。
  - 若改为逐个发言，必须保证 `history` 在每条发言保存后立即更新。
  - Round 2 仍能基于已有 Round 1 内容形成反驳关系。
  - Round 3 仍能基于前两轮内容形成总结建议。

### [ ] Task 3：加强人格发言强度和长度
- 目标：解决人格发言偏短、人格味道不够强的问题，让理性派、毒舌派、赌徒派、父母派、摆烂派在同一议题下有更明显的表达差异。
- 涉及文件：`server/internal/ai/prompts.go`、`server/internal/ai/debate_messages.go`、`server/internal/mindarena/personas.go`、`server/internal/ai/debate_messages_test.go`
- 输入：固定人格设定、辩论模式、轮次规则、历史消息。
- 输出：更有冲突感的人格发言；长度限制与 prompt 约束保持一致。
- 依赖：Task 1 的流式入场不被破坏。
- 验收：
  - `DEBATE_ROUND_PROMPT` 和 `maxDebateMessageRunes` 的长度约束一致。
  - 每个人格的 `Personality`、`Style` 能明确影响模型输出。
  - Round 2 的反驳更直接，但不辱骂用户。
  - mock / fallback 文案同步保持人格差异。

---

## 执行规则（必须遵守）

- 每完成一个 Task，必须把 `[ ]` 改为 `[x]`。
- 必须更新“当前正在做”。
- 不允许跳过任务。
- 所有实现必须遵守 `README.md` 和 `AGENTS.md`。
- 不允许破坏现有 `/api/v1/mind-arena/...` API 和 SSE 事件协议。
- 修改 Go 后端后必须运行 `cd server && go test ./internal/mindarena ./internal/ai`。
- 修改中文 Markdown 后必须运行 `python3 .codex/skills/encoding-guard/scripts/check_mojibake.py apps/ai-mind-arena/docs/ai-mind-arena-tasks.md`。
