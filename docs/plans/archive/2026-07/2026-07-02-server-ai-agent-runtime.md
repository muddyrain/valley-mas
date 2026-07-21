> [!HISTORICAL] 该计划已迁移为历史参考，不作为当前可执行计划

# Server AI Agent Runtime（阶段 A：手写 tool loop）

> **For agentic workers:** REQUIRED SUB-SKILL：使用 `executing-plans` 或 `subagent-driven-development` 按 task 顺序推进。每个 step 都用 `- [ ]`，落地一项勾一项。落地过程中启用 `ai-capability-orchestration`、`karpathy-guidelines`、`test-driven-development`。
>
> **本计划只覆盖阶段 A**：从"prompt-as-a-function"演进到"tool loop 驱动的 agent"。**不引入外部框架**（不用 langchaingo、暂不引入 CloudWeGo eino）。落地范围先限定 Life Trace 生活助理一个入口，跑通闭环之后再横向铺 blog / creator / desktop-os。

---

## Why

现状（2026-07-02）：

- `internal/lifetrace/ai/prompts/*` 已经有十几个 `PromptContract`（image_analysis、pantry、recipe、outfit、weekly_review、today_advice、assistant…），全都是"组装数据 → 拼 prompt → 调一次模型 → 解析 JSON"。
- 唯一接近 agent 的是 [assistant_caller.go](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/ai/assistant_caller.go)，但它只允许挂一个 tool、且调完就结束，本质是"tool-call 结构化输出"。
- Handler 层直接决定"要查哪些数据、拼什么 prompt、调什么模型"，模型没有决策权，用户没法追问、没法自主查询。

痛点：

1. 加一个新 AI 场景就是复制一份 contract + 一份 handler + 一堆数据组装代码。
2. 模型拿不到工具，只能被动接受一次性上下文；上下文塞不下的信息只能牺牲。
3. 所有 prompt 都是一次调用一次终态，没有"追问 / 中间产物 / 多步推理"能力。

阶段 A 目标：**用最少代码把现有 prompt 契约升成 tool，让模型能在一个 loop 里自主决定调哪些 tool，直到给出最终回答或达到上限**。

---

## Goal

### 验收标准

1. 新增 `internal/ai/agent` 包，暴露 `AgentRuntime` 接口，隐藏 loop 实现。
2. 新增 `internal/ai/tools` 包（或子目录），提供 `Tool` 抽象与注册表。
3. Life Trace 助理（[assistant_handler.go](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/assistant_handler.go)）改为通过 `AgentRuntime.RunStream` 驱动，其余 handler 不动。
4. 至少落地 5 个 tool（见 §Tool 清单）；模型在合适场景下能自动调用其中至少 2 个（可通过日志或 test 观察 tool_call 事件）。
5. `AgentRuntime`、`Tool`、`Message`、`Result` 四个类型完全不依赖 ARK/OpenAI SDK 的类型（这是未来迁 eino/其他框架的核心保障）。
6. 现有 Life Trace 助理接口路径（`POST /api/life-trace/assistant/stream`）、请求体、响应字段（reply / action / done 语义）完全不变；前端零改动。
7. `cd server && go test ./...` 全绿；至少新增一份 `agent_loop_test.go` 覆盖多步 tool call、终止条件、超上限降级三条路径。
8. `docs/PROJECT_GUIDE.md` 与 `server/AGENTS.md` 同步补充"新增 AI 功能优先落成 tool"的引导。

### 非目标（明确不做）

- **不引入外部 AI 框架**（不引 langchaingo、eino、任何依赖）。
- **不拆** `assistant_handler.go` 的其他分支逻辑（fallback draft、SSE writer 等），只在最外层引入 loop。
- **不改**任何前端代码，也不改前端 SSE 事件字段。
- **不迁**其他 handler（blog / creator / desktop-os / admin），只准备好抽象。
- **不做**并行 tool call、子 agent、图状态、中断-恢复。这些是阶段 B（eino）之后的事。
- **不改**现有 `PromptContract` 类型形状；tool 内部调用现有 contract。
- **不动** [aiclient](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/aiclient) 已定型的 provider 抽象、SSE writer、tool_call 双轨 helper。

---

## Architecture

```
handler (assistant_handler.go)
   │  只调 AgentRuntime.RunStream(ctx, spec, msgs) → <-chan Event
   ▼
internal/ai/agent           ← 新建：领域中性接口 + 手写 loop
   ├── runtime.go           AgentRuntime 接口 / Spec / Message / Event / Result
   ├── loop.go              LocalLoop：think → act → observe 循环实现
   ├── loop_test.go         多步 tool call / 终止 / 超上限
   └── stream.go            Event 转 SSE 的 helper（可选）

internal/ai/tools           ← 新建：Tool 抽象 + 注册表
   ├── tool.go              Tool 接口、Registry、JSON schema 类型
   ├── registry.go          全局注册（包 init 期填充）
   └── lifetrace/           领域子包
        ├── query_traces.go       查最近踪迹
        ├── query_plans.go        查未完成计划
        ├── create_plan.go        创建计划（复用 assistant_handler 的 draft 落库）
        ├── create_pantry.go      入库
        └── create_ledger.go      记账

internal/lifetrace/ai/prompts/*   ← 不动，被 tool 内部调用
internal/aiclient                 ← 不动，被 agent/loop 内部调用
```

**关键原则**：

- `internal/ai/agent` 只依赖标准库 + `internal/aiclient`，**不 import** 任何业务包（不 import lifetrace / mindarena / handler / model）。
- `internal/ai/tools` 是分层的：根包只放接口和注册表（依赖同 agent），领域子包（如 `tools/lifetrace`）可以 import 业务包，通过 init 反向注册到根 registry。
- Handler 层通过 `AgentRuntime` + `Registry.Filter(scope)` 决定"某个入口能用哪些 tool"，避免所有入口都能调所有 tool。

### 领域中性类型定义（草案）

```go
// internal/ai/agent/runtime.go
package agent

type Role string

const (
    RoleSystem    Role = "system"
    RoleUser      Role = "user"
    RoleAssistant Role = "assistant"
    RoleTool      Role = "tool"
)

type Message struct {
    Role       Role
    Content    string
    ToolCalls  []ToolCall  // assistant 消息可能带
    ToolCallID string       // tool 消息必带
    ToolName   string       // tool 消息必带
}

type ToolCall struct {
    ID   string
    Name string
    Args json.RawMessage
}

type Spec struct {
    Provider   string   // "ark" | "openai" | ...
    Model      string
    System     string
    Tools      []string // Tool.Name 白名单
    MaxSteps   int      // 默认 6
    MaxTokens  int
    Temperature float32
}

type Event struct {
    Type       string // "delta" | "tool_call" | "tool_result" | "done" | "error"
    Delta      string
    ToolCall   *ToolCall
    ToolResult json.RawMessage
    Err        error
}

type Result struct {
    Reply string
    Steps int
    Model string
}

type AgentRuntime interface {
    Run(ctx context.Context, spec Spec, msgs []Message) (Result, error)
    RunStream(ctx context.Context, spec Spec, msgs []Message) (<-chan Event, error)
}
```

```go
// internal/ai/tools/tool.go
package tools

type Tool interface {
    Name() string
    Description() string
    Schema() map[string]any            // JSON schema
    Run(ctx context.Context, args json.RawMessage) (json.RawMessage, error)
    Scope() string                     // e.g. "life-trace"
}

type Registry struct { ... }
func (r *Registry) Register(t Tool)
func (r *Registry) Filter(scope string, names []string) []Tool
```

**注意**：`Tool.Run` 返回 `json.RawMessage`，而不是任何领域类型。这样 loop 完全不知道 tool 内部干了什么，只知道"执行完了、结果序列化过了"。

---

## Tool 清单（阶段 A 首批）

作用域 `life-trace`，全部由 `tools/lifetrace` 子包在 `init()` 里注册：

| Tool | 参数 | 内部调用 | 说明 |
|---|---|---|---|
| `query_recent_traces` | `days int` | GORM | 查用户最近若干天生活踪迹 |
| `query_pending_plans` | `limit int` | GORM | 查未完成计划 |
| `create_plan` | `title, type, scheduledDate, scheduledTime, timezone, notePrefix` | 复用 `createAssistantPlanFromDraft` | 创建计划（写库 + SSE action payload） |
| `create_pantry_item` | `name, category, quantity, unit, location, expiresAt, openedAt, note` | 复用 `createAssistantPantryItemFromDraft` | 入库 |
| `create_ledger_entry` | `amount, currency, direction, category, occurredAt, merchant, location, note` | 复用 `createAssistantLedgerEntryFromDraft` | 记账 |

**说明**：`create_*` 三个 tool 的 schema 直接复用现有 `AssistantPlanDraft` / `AssistantPantryDraft` / `AssistantLedgerDraft` 的 JSON tag，避免重造。执行结果序列化成 `{"ok":true,"id":"...","message":"..."}`，或 `{"ok":false,"needMoreInfo":["expiresAt"],"message":"..."}`。

---

## Phase 1 — 抽象层落地（无功能改动）

> 只加代码，不改任何行为。做完这一阶段，`assistant_handler.go` 不知道 `agent` 包的存在。

### Task 1.1：`internal/ai/agent` 包骨架

**Files:**
- New: `server/internal/ai/agent/runtime.go`
- New: `server/internal/ai/agent/loop.go`
- New: `server/internal/ai/agent/stream.go`

**Steps:**
- [ ] **Step 1**：写 `runtime.go`，定义 §Architecture 的 6 个类型 + `AgentRuntime` 接口。
- [ ] **Step 2**：写 `loop.go` 的 `LocalLoop` 实现：
  - 构造函数 `NewLocalLoop(client aiclient.LLM, reg *tools.Registry)`；
  - `Run` 内部循环：调 aiclient 传 tools → 若无 tool_call 则终止 → 否则并发/串行执行 tool → append tool 消息 → 再调 → 直到达到 `MaxSteps`；
  - **阶段 A 只做串行**，并发放阶段 B。
- [ ] **Step 3**：写 `stream.go`，`RunStream` 用 goroutine + channel 分发 Event；上层可以逐条转 SSE。
- [ ] **Step 4**：agent 包不能 import 业务包；用 `go list -deps ./internal/ai/agent | grep valley-server/internal | sort -u` 检查（应只有 aiclient 和 aiusage）。

### Task 1.2：`internal/ai/tools` 包骨架

**Files:**
- New: `server/internal/ai/tools/tool.go`
- New: `server/internal/ai/tools/registry.go`

**Steps:**
- [ ] **Step 1**：定义 `Tool` 接口、`Registry` 类型。
- [ ] **Step 2**：Registry 支持按 `scope` 和 `name` 白名单过滤。
- [ ] **Step 3**：暴露 `DefaultRegistry`（包级变量），领域子包在自己的 `init()` 里向 `DefaultRegistry` 注册。
- [ ] **Step 4**：写 `tool_test.go` 覆盖注册 / 冲突 / 过滤三个用例。

### Task 1.3：LocalLoop 单测

**Files:**
- New: `server/internal/ai/agent/loop_test.go`

**Steps:**
- [ ] **Step 1**：写 `fakeLLM`（实现 aiclient 需要的最小接口），可脚本化返回 tool_call 序列或 final content。
- [ ] **Step 2**：写 `fakeTool`，记录被调用次数和参数。
- [ ] **Step 3**：三个用例：
  - Case A：LLM 直接返回 final content → loop 一步终止，Result.Steps=1。
  - Case B：LLM 先返回 tool_call `query_traces`，第二次返回 final → loop 两步，tool 被调 1 次。
  - Case C：LLM 每次都返回 tool_call，`MaxSteps=3` → 达到上限时 loop 返回带 truncation 的错误 / 兜底文本，不 panic。
- [ ] **Step 4**：`cd server && go test ./internal/ai/agent` 全绿。

---

## Phase 2 — Life Trace tool 实现

> 领域子包实现 tool，仍不改 handler。

### Task 2.1：`tools/lifetrace` 子包

**Files:**
- New: `server/internal/ai/tools/lifetrace/tools.go`
- New: `server/internal/ai/tools/lifetrace/query_traces.go`
- New: `server/internal/ai/tools/lifetrace/query_plans.go`
- New: `server/internal/ai/tools/lifetrace/create_plan.go`
- New: `server/internal/ai/tools/lifetrace/create_pantry.go`
- New: `server/internal/ai/tools/lifetrace/create_ledger.go`

**Steps:**
- [ ] **Step 1**：写 `tools.go`，`init()` 里注册 5 个 tool 到 `tools.DefaultRegistry`，scope=`life-trace`。
- [ ] **Step 2**：`query_recent_traces` 用 `database.GetDB()` 直查 `LifeTraceTrace`，参数 `days`（默认 7，上限 30）。返回 `{"traces":[{"title":..., "mood":..., "timeLabel":...}]}`。
- [ ] **Step 3**：`query_pending_plans` 类似，参数 `limit`（默认 8，上限 20）。
- [ ] **Step 4**：`create_plan` / `create_pantry_item` / `create_ledger_entry`：
  - **不重写落库逻辑**；调用现有 `Handler.createAssistantPlanFromDraft` 等公开方法。这要求把它们提到公开可见（首字母大写）或提供包外访问入口。
  - 阻塞点：这三个方法目前需要 `Handler` 实例（含 weather / db 依赖）。方案是引入 `type Deps struct{ Handler *lifetrace.Handler }`，通过 `RegisterWithDeps` 注入，避免 tool 直接依赖单例。
- [ ] **Step 5**：为每个 tool 写至少 1 个 golden case 测试。

### Task 2.2：Tool 与 Handler 的依赖注入

**Files:**
- Modify: `server/internal/lifetrace/handler.go`（若已存在 handler struct 则加一个 `RegisterAgentTools()` 方法）
- Modify: `server/internal/bootstrap/*.go`（在服务启动时调用注册）

**Steps:**
- [ ] **Step 1**：给 `lifetrace.Handler` 增加 `RegisterAgentTools(reg *tools.Registry)` 方法，把 `Handler` 引用注入到 `tools/lifetrace` 子包。
- [ ] **Step 2**：在 bootstrap 里，构造 lifetrace.Handler 之后调用 `handler.RegisterAgentTools(tools.DefaultRegistry)`。
- [ ] **Step 3**：`go test ./internal/ai/tools/lifetrace` 全绿。

---

## Phase 3 — 接入 Life Trace 助理

> 真正把 loop 用起来。

### Task 3.1：改造 `StreamAssistant`

**Files:**
- Modify: `server/internal/lifetrace/assistant_handler.go`

**Steps:**
- [x] **Step 1**：在 handler 里增加"是否走 agent loop"的 feature flag 环境变量 `LIFE_TRACE_ASSISTANT_USE_AGENT`（默认 false，先不切）。
- [x] **Step 2**：flag 为 true 时：
  - 构造 `agent.Spec{Provider: aiCfg.Source, Model: aiCfg.Model, System: prompts.AssistantSystemPrompt(), Tools: []string{"query_recent_traces","query_pending_plans","create_plan","create_pantry_item","create_ledger_entry"}, MaxSteps: 6}`；
  - 把 `req.History + req.Message` 转成 `[]agent.Message`；
  - 调 `runtime.RunStream(ctx, spec, msgs)`，把 Event 逐条映射为现有的 `lifeTraceAssistantStreamChunk`（`delta` → Chunk / `tool_result` 中若含 action payload → Action / `done` → Done）；
  - **不改** SSE 事件字段名和顺序，前端零感知。
- [x] **Step 3**：flag 为 false 时走原有分支（结构化 tool-call 单次调用 + fallback），保证回滚路径。
- [ ] **Step 4**：本地手工验证两条路径都能跑；agent 模式跑至少两轮追问式对话。（**用户手动验收**）

### Task 3.2：日志与 usage 记录

**Files:**
- Modify: `server/internal/ai/agent/loop.go`

**Steps:**
- [x] **Step 1**：每一步 tool_call 通过 `aiusage.Record` 落一条 `Feature=life-trace-assistant-tool` 的记录，包含 tool 名、耗时、成功/失败。（feature 命名与 spec 微调:实现里为 `<feature>-tool`，即 `life-trace-assistant-tool`）
- [x] **Step 2**：整轮结束落一条 `Feature=life-trace-assistant-run`，记录 total steps、model、latency、error。
- [ ] **Step 3**：Admin AI usage 页面能看到新的 feature（不改前端，只依赖数据落进去）。（**用户手动验收**）

---

## Phase 4 — 文档与收尾

### Task 4.1：文档同步

**Files:**
- Modify: `docs/PROJECT_GUIDE.md`（AI 能力章节增补"agent runtime"入口说明）
- Modify: `server/AGENTS.md`（新增"新增 AI 功能优先落成 tool"引导，指向 `internal/ai/agent` / `internal/ai/tools`）
- Modify: `server/.env.example`（加 `LIFE_TRACE_ASSISTANT_USE_AGENT=false`）
- New: `server/internal/ai/agent/doc.go`（写清楚设计约束和"未来迁 eino 时哪几段替换"）

**Steps:**
- [x] **Step 1**：写 doc.go，明确:
  - 只依赖 aiclient / aiusage / 标准库；
  - Message/Tool/Event 类型故意不用 SDK 类型，是为了未来无痛替换 loop 实现；
  - 迁 eino 时只需要重写 loop.go，其余不动。
- [x] **Step 2**：`docs/PROJECT_GUIDE.md` 章节按现有风格补一段。
- [x] **Step 3**：`server/AGENTS.md` 加一条到"开发规范":
  > 新增 AI 场景优先考虑落成 `internal/ai/tools/<domain>/*` 下的 tool，通过 `AgentRuntime` 驱动；只有确定单次 prompt 就能解决的场景（如摘要、翻译、单图分析）才继续用 `PromptContract` 直调。

### Task 4.2：验证与关灯

**Steps:**
- [x] **Step 1**：`cd server && go test ./...` 全绿。
- [x] **Step 2**：`cd server && go vet ./...` 无 warning。
- [ ] **Step 3**：本地手工场景（flag=true）:（**用户手动验收**）
  - "帮我记一下今天买了 30 元的咖啡" → 期望调 `create_ledger_entry`。
  - "我最近踪迹里心情怎么样" → 期望调 `query_recent_traces` + 生成回答。
  - "把周六下午三点看电影加到计划" → 期望调 `create_plan`。
- [ ] **Step 4**：flag=false 手工验证一遍，确认回滚路径无回归。（**用户手动验收**）
- [ ] **Step 5**：把 flag 默认值改 true 之前，先做一次真人自测两天再切；本 plan 只落到 flag=false 已上线可用为止，切换默认值走另一次小改动。（**留待后续**）

---

## 未来迁 eino 时的替换点（阶段 B 参考）

阶段 B 引入 `github.com/cloudwego/eino` 时，改动限定在下面几处：

| 组件 | 阶段 A | 阶段 B（迁 eino） |
|---|---|---|
| `agent/runtime.go` 的接口 | 保留 | 保留 |
| `agent/loop.go` 的 `LocalLoop` | 手写 300 行 | 替换为基于 `eino.compose` 的实现 |
| `tools/tool.go` | 中性 Tool 接口 | 加一个 shim，把中性 Tool 转成 `eino/schema.Tool` |
| `handler` 层 | 只依赖 `AgentRuntime` | 完全不动 |
| `PromptContract` | 不动 | 不动 |
| `aiclient` | 不动 | 不动，作为 eino ChatModel 的底层 provider |

如果阶段 A 严格遵守"handler 只依赖接口 / tool 不用 SDK 类型 / message 中性化"三条，迁 eino 就是 1-2 天的活。

---

## Risks & Mitigation

| 风险 | 影响 | 缓解 |
|---|---|---|
| `create_*` tool 需要 handler 实例，形成隐式依赖 | 可能循环 import | 用 `RegisterWithDeps` 显式注入，tool 子包只在 handler 构造后被拉起 |
| tool_call 双轨（ARK / OpenAI）在 loop 里混用容易走岔 | 上游报错难查 | 复用现有 [assistant_caller.go](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/ai/assistant_caller.go) 的双轨 helper，不重造 |
| 模型可能反复调 tool 触发死循环 | 空转 / 高成本 | `MaxSteps=6` 硬上限；超上限 fallback 到"直接输出 model 最后一次 assistant 内容" |
| feature flag 遗留 | 分支膨胀 | 阶段 A 结束后 30 天内切默认值 true 并做移除计划 |
| tool 内部错误反噬 loop | 用户看到英文错误 | tool 错误统一序列化为 `{"ok":false,"error":"..."}`，模型能识别并解释 |

---

## Out of Scope（延后事项）

- Blog / Creator / Desktop-OS / Admin 场景的 agent 化 → 阶段 A 完成后再单独立计划。
- 并行 tool_call、子 agent、图状态机 → 阶段 B（迁 eino 时一并规划）。
- 用户可视化配置 tool / 权限模型 → 阶段 C（Coze 级平台能力，暂无立项）。
- 外部 Coze / Dify bot 接入 → 独立正交话题，阶段 A 完全不涉及。
