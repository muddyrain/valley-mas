# AI Mind Arena - 开发任务清单

## 当前阶段
Phase 9：动态裁判与加时赛机制

## 当前正在做
Phase 9 已完成，等待下一项任务

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

### [x] Task 1：每轮结束加入用户站队，并把结果带入下一轮争论
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

## Phase 8：支持率与裁判评分重构

### [x] Task 1：引入中立裁判评分，并让用户站队真实影响支持热度
- 目标：解决当前“支持热度像假的、谁先发言谁更占优、理性派经常莫名第一”的问题。把右侧“当前战况”从单纯内容测算改成“双来源计分”：
  一部分来自中立裁判根据每条发言实时打分，另一部分来自用户每轮站队给出的真实支持分，让用户点击站队不只是交互，而是真能改变战况。
- 涉及文件：`apps/ai-mind-arena/components/debate/ScorePanel.tsx`、`apps/ai-mind-arena/components/debate/DebateRoom.tsx`、`apps/ai-mind-arena/lib/debateScores.ts`、`apps/ai-mind-arena/lib/types.ts`、`server/internal/mindarena/types.go`、`server/internal/mindarena/service.go`、`server/internal/ai/debate_messages.go`、`server/internal/ai/prompts.go`、`server/internal/ai/mock.go`、`server/internal/mindarena/service_test.go`
- 输入：人格发言内容、当前轮次 `round`、中立裁判对每条发言的评分结果、用户每轮站队记录 `supportHistory`。
- 输出：
  - 右侧战况面板新增“中立裁判”角色或裁判区块，明确展示这轮是谁在打分；
  - 每条发言生成后，中立裁判会基于内容给出分数判断，而不是只按先后顺序推高热度；
  - 用户站队会给对应人格注入明确分数支持，真实影响总热度；
  - 支持率结果可解释，至少能区分“裁判评分”和“用户加分”两部分来源。
- 依赖：Phase 7 的回合站队机制已经存在，支持历史可复用。
- 验收：
  - 同一轮内，支持热度不再因为发言先后顺序天然偏向前面的人格。
  - 理性派不应因为默认权重而稳定第一；最终高低必须由“当轮发言质量 + 用户站队”共同决定。
  - 右侧 UI 能看出中立裁判这一评分来源，而不是只有五个人格的支持条。
  - 用户在 Round 1 / Round 2 的站队会实际影响后续热度数值，且影响可在 session 或 score 数据结构中追踪。
  - mock / 测试覆盖裁判评分与用户加分叠加后的排序变化。

### [x] Task 2：把口头禅改成出场口号，不再绑死后续发言风格
- 目标：修正当前人格发言“总像在反复念口头禅”的问题。`catchphrase` 不再被当成后续每轮发言都要强行复现的表达约束，而是改成“出场口号 / 开场标语”，只在角色卡、嘉宾登场或人格介绍时使用；后续辩论发言应主要根据当轮场上局势、历史内容、用户站队和对手观点动态生成。
- 涉及文件：`server/internal/ai/prompts.go`、`server/internal/ai/debate_messages.go`、`server/internal/mindarena/personas.go`、`server/internal/ai/mock.go`、`apps/ai-mind-arena/components/debate/PersonaCard.tsx`、`apps/ai-mind-arena/lib/types.ts`
- 输入：人格基础设定、出场口号、历史发言、当前轮次、用户偏好、对手观点。
- 输出：
  - 文档和类型层面把 `catchphrase` 的产品语义调整成“出场口号”；
  - prompt 不再要求模型每轮都把口号气场硬塞进发言；
  - 人格后续发言更强调临场反应，而不是围绕固定口号复读。
- 依赖：当前人格卡和人格生成链路。
- 验收：
  - 角色卡、嘉宾介绍等静态展示仍可保留出场口号。
  - Round 2 / Round 3 发言不再强制重复或贴近口号原句。
  - prompt 约束改成“保留人格性格与表达方式”，而不是“必须带出口号句式”。
- mock / fallback 文案同步调整，避免所有人格发言都像自我介绍。

---

## Phase 9：动态裁判与加时赛机制

### [x] Task 1：Round 2 支持“拆招”也支持“结盟借力”
- 目标：避免第二轮所有人格都只会互怼。Round 2 除了直接反驳，也允许人格承认对手某一点合理，再顺势把优势拉回自己这边，让讨论更像真实辩论而不是纯吵架。
- 涉及文件：`server/internal/ai/debate_messages.go`、`server/internal/ai/prompts.go`、`server/internal/ai/mock.go`、`server/internal/mindarena/scoring.go`
- 验收：
  - Round 2 prompt 明确允许“部分赞同 + 转向自己结论”的打法。
  - mock / fallback 文案里能看到不只一种交锋方式。
  - 裁判评分会识别“借力打力”的发言，而不只奖励纯反驳。

### [x] Task 2：让中立裁判按辩论风格动态打分
- 目标：解决裁判长期偏向理性派或父母派的问题。裁判不再只按固定关键词打分，而是结合当前 `mode` 评估：严肃模式更看重条件与落地，锋芒模式更看重拆解，情绪模式更看重情绪识别与承接。
- 涉及文件：`server/internal/mindarena/scoring.go`、`apps/ai-mind-arena/components/debate/ScorePanel.tsx`
- 验收：
  - 裁判焦点文案能看出当前辩论风格。
  - 不同 `mode` 的发言会因为风格差异得到不同加权。
  - 右侧裁判区的文案能解释“为什么这轮这么判”。

### [x] Task 3：Round 3 同分后进入加时赛，直到分出领先者
- 目标：如果 Round 3 结束后出现并列最高分，不要直接硬判胜者，而是进入加时赛。只有并列领先的人格继续对决；若加时后仍然同分，就继续下一轮，直到分出唯一领先者。
- 涉及文件：`server/internal/mindarena/types.go`、`server/internal/mindarena/store.go`、`server/internal/mindarena/service.go`、`server/internal/mindarena/service_test.go`、`apps/ai-mind-arena/components/debate/DebateRoom.tsx`、`apps/ai-mind-arena/components/debate/ScorePanel.tsx`、`apps/ai-mind-arena/lib/types.ts`、`apps/ai-mind-arena/lib/api.ts`
- 验收：
  - Round 3 打平后自动进入加时赛，而不是直接亮最终结果。
  - 加时赛只展示并列领先人格继续辩论，用户站队也只在这些人格里选。
  - 右侧和中间主舞台都能正确显示加时赛轮次。
  - 一旦加时赛分出唯一领先者，再进入最终裁判结果。

---

## 执行规则（必须遵守）

- 每完成一个 Task，必须把 `[ ]` 改为 `[x]`。
- 必须更新“当前正在做”。
- 不允许跳过任务。
- 所有实现必须遵守 `README.md` 和 `AGENTS.md`。
- 不允许破坏现有 `/api/v1/mind-arena/...` API 和 SSE 事件协议。
- 修改 Go 后端后必须运行 `cd server && go test ./internal/mindarena ./internal/ai`。
- 修改中文 Markdown 后必须运行 `python3 .codex/skills/encoding-guard/scripts/check_mojibake.py apps/ai-mind-arena/docs/ai-mind-arena-tasks.md`。
