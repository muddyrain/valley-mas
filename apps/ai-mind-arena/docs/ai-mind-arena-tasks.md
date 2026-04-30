# AI Mind Arena - 开发任务清单

## 当前阶段
Phase 7：回合互动与争宠机制

## 当前正在做
Task 1：每轮结束加入用户站队，并把结果带入下一轮争论

---

## Phase 6：流式体验优化

### [x] Task 1：逐个生成嘉宾并实时推送到前端
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

### [x] Task 2：评估是否逐个生成辩论发言
- 目标：确认是否也要把每轮批量 `GenerateDebateRound` 改成逐人格 `GenerateDebateMessage`，让发言从“等整轮生成完再播放”变成“某个人格生成完就立刻发言”。
- 涉及文件：`server/internal/mindarena/service.go`、`server/internal/ai/debate_messages.go`、`server/internal/mindarena/service_test.go`
- 输入：三轮辩论规则、`history`、当前人格、当前轮次。
- 输出：一份明确取舍结论；若执行实现，则每条 `message` SSE 来自单次人格发言生成。
- 结论：改为逐个发言。原因：现有 `GenerateDebateMessage`、单人格 prompt 和 `history` 构造已具备逐条生成条件，且“生成 1 条 -> 落库 1 条 -> 推送 1 条”可以保证后续人格和后续轮次都读取到最新上下文，流式体感更好。
- 依赖：Task 1 完成后的流式体验基线。
- 验收：
  - 明确记录“继续批量生成整轮”或“改为逐个发言”的理由。
  - 若改为逐个发言，必须保证 `history` 在每条发言保存后立即更新。
  - Round 2 仍能基于已有 Round 1 内容形成反驳关系。
  - Round 3 仍能基于前两轮内容形成总结建议。

### [x] Task 3：加强人格发言强度和长度
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

## Phase 7：回合互动与争宠机制

### [ ] Task 1：每轮结束加入用户站队，并把结果带入下一轮争论
- 目标：每轮发言结束后，不直接无缝进入下一轮，而是弹出一个“这一轮你更支持谁”的交互，让用户临时站队；下一轮生成时，把“用户刚支持了 xxx 派”作为额外上下文喂给各人格，让他们围绕用户偏好继续争论、争宠、拉票。
- 涉及文件：`apps/ai-mind-arena/components/debate/DebateRoom.tsx`、`apps/ai-mind-arena/components/debate/ScorePanel.tsx`、`apps/ai-mind-arena/lib/types.ts`、`apps/ai-mind-arena/lib/debateEvents.ts`、`server/internal/mindarena/service.go`、`server/internal/mindarena/types.go`、`server/internal/ai/debate_messages.go`、`server/internal/ai/prompts.go`、`server/internal/ai/mock.go`、`server/internal/mindarena/service_test.go`
- 输入：当前轮次 `round`、本轮已完成的发言、用户本轮选择支持的人格 `supportedPersonaId`、历史用户站队记录。
- 输出：
  - 前端在 Round 1、Round 2 结束后弹出站队选择；
  - 用户选择后才继续生成下一轮；
  - 下一轮每个人格生成时都知道“用户上一轮更支持谁”以及自己是否被支持；
  - UI 明确展示“上一轮用户支持了谁”，让争宠感可见。
- 依赖：现有三轮辩论结构、逐人格流式发言链路、当前支持率与战况面板。
- 验收：
  - Round 1 全部发言结束后，必须先出现站队交互，再进入 Round 2。
  - Round 2 全部发言结束后，必须再次出现站队交互，再进入 Round 3。
  - 若用户支持了某人格，下一轮其他人格的发言会明确回应这一偏好，表现出争宠、拉票或不服气。
  - 若用户暂不选择，需要有明确兜底策略：
    可以是“跳过本站队并继续下一轮”，但必须在产品和实现里统一。
  - 不能破坏现有 SSE 主链路，也不能让页面刷新后丢失已完成的用户站队结果。
  - `server/internal/mindarena` 与前端交互相关测试覆盖：
    回合暂停、用户选择后恢复、下一轮提示词已带上用户支持信息。

---

## 执行规则（必须遵守）

- 每完成一个 Task，必须把 `[ ]` 改为 `[x]`。
- 必须更新“当前正在做”。
- 不允许跳过任务。
- 所有实现必须遵守 `README.md` 和 `AGENTS.md`。
- 不允许破坏现有 `/api/v1/mind-arena/...` API 和 SSE 事件协议。
- 修改 Go 后端后必须运行 `cd server && go test ./internal/mindarena ./internal/ai`。
- 修改中文 Markdown 后必须运行 `python3 .codex/skills/encoding-guard/scripts/check_mojibake.py apps/ai-mind-arena/docs/ai-mind-arena-tasks.md`。
