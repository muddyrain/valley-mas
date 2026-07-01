# 第一刀 · lifetrace/ai_handler.go 同包物理拆分 + dead code 清理

> 状态：**待批准实施**。基于 [lifetrace-ai-handler-split-plan-draft.md](file:///Users/bytedance/Desktop/study/valley-mas/.trae/documents/lifetrace-ai-handler-split-plan-draft.md) 草稿第二节"第一刀"展开。owner 已批准推荐方案：**先做第一刀物理拆分，同时清理 dead code**。

---

## Context

`server/internal/lifetrace/ai_handler.go` 当前 **3156 行**，[function 清单](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/ai_handler.go) 共 98 个 `func`，混杂 5 套 HTTP handler、3 套 draft（plan/pantry/ledger）流水线、ARK + 手写 OpenAI 双轨调用、SSE 流编排、JSON parse/normalize、缓存、共享 helper。Phase 2 已建立 [internal/aiclient](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/aiclient) 通用包，但本文件仍是后续 AI 功能扩展的最大障碍。

第一刀目标：**纯物理拆分**，把 3156 行按 11 个职责域拆到 10 个同包文件，同步清理 1 处确认的 dead code。

**严格约束**：
- 保留 `package lifetrace` 不变；不新建子包；不动 `lifetrace/ai/`、`lifetrace/agent/`。
- 所有 top-level 标识符**保持小写**（package-private），签名 1:1 不变。
- 所有 `(*Handler)` 方法保留 receiver。
- 所有 `_test.go` 断言不动；测试文件按 _handler.go ↔ _test.go 一一对应同步拆分。
- 行为零变化（除 dead code 清理外）。

**预期效果**：
- 单文件最大行数从 3156 降到 ~1100（`ai_client.go`，集中 ARK/OpenAI 双轨调用）。
- 后续第二刀（prompt 下沉到 `prompts/`）和第三刀（OpenAI 切到 aiclient）可以按域独立推进。
- 新增 AI 功能的 reviewer 不再需要扫 3156 行的巨型文件。

---

## Architecture

### 目标文件结构（package lifetrace 同包内）

```
internal/lifetrace/
├── ai_handler.go               保留 — 类型定义 + 包级状态首段（~210 行）
├── today_advice_handler.go     新建 — Today Advice 域
├── weekly_review_handler.go    新建 — Weekly Review 域（3 个 handler 集中）
├── assistant_handler.go        新建 — Assistant SSE 流编排
├── assistant_plan_draft.go     新建 — Plan draft 域
├── assistant_pantry_draft.go   新建 — Pantry draft 域
├── assistant_ledger_draft.go   新建 — Ledger draft 域
├── assistant_common.go         新建 — 三域共享 helper + 14 个正则
├── ai_client.go                新建 — ARK/OpenAI 双轨调用（最大单文件 ~1100 行）
└── text_util.go                新建 — `trimRunes`（共享给整个 lifetrace 包）

internal/lifetrace/
├── ai_handler_test.go          保留 — 现有断言不动；按域同步拆分
├── today_advice_handler_test.go    新建 — 从 ai_handler_test.go 拆出
├── weekly_review_handler_test.go   新建 — 从 ai_handler_test.go 拆出
├── assistant_handler_test.go       新建 — 从 ai_handler_test.go 拆出
└── ai_client_test.go               新建 — 从 ai_handler_test.go 拆出（仅 ARK/OpenAI 调用相关）
```

> 测试文件拆分映射在 Task 8 详述；如果按域拆分代价过高（单条 helper 跨多域），允许只在第一刀里拆 `ai_handler.go` 主体，`ai_handler_test.go` 暂不拆，留独立后续 plan。建议先按"主体拆 + 测试不拆"执行（更保守），实际编辑时再视复杂度评估。

### 包级状态归属

| 状态 | 当前行 | 目标位置 | 备注 |
|---|---|---|---|
| `lifeTraceAssistantActionRegistry` | [L129-L151](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/ai_handler.go#L129-L151) | `assistant_common.go` | 三域 draft 公用 |
| `errLifeTraceAssistantTool*` | L153-L156 | `ai_client.go` | 仅 ARK/OpenAI 调用使用 |
| `lifeTraceTodayAdviceDefaultTimeout` / `lifeTraceTodayAdviceCacheTTL` | L158-L159 | `today_advice_handler.go` | today advice 专属 |
| `lifeTraceWeeklyReviewMaxTokens` | L160 | `weekly_review_handler.go` | weekly review 专属 |
| `lifeTraceAssistantToolName` | L161 | `assistant_common.go` | tool calling + 测试引用 |
| 14 个 `assistant*Pattern` regex | [L163-L183](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/ai_handler.go#L163-L183) | `assistant_common.go` | plan/pantry/ledger 三域共用 |
| `lifeTraceTodayAdviceCache` + `todayAdviceCacheEntry` | [L185-L197](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/ai_handler.go#L185-L197) | `today_advice_handler.go` | 仅 today advice 使用 |
| `adviceDefaults` / `adviceOrder` / `validAdviceTones` | [L199-L217](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/ai_handler.go#L199-L217) | `today_advice_handler.go` | `normalizeTodayAdviceItems` 读 |
| 类型定义 L31-L127 | L31-L127 | **保留在 `ai_handler.go`** | 跨域共用；不拆，保持 import 简单 |

**保留在 `ai_handler.go` 的内容（~210 行）**：package 头、import、L31-L127 全部类型定义（`lifeTraceAIAdvice`、`todayAdviceAIResponse`、`weeklyReviewAIResponse`、`lifeTraceAssistant*` 系列、`lifeTraceAIConfig` alias、3 个 draft 类型、2 个 ActionPayload 类型、`lifeTraceAssistantStructuredAction/Response`）。

> 类型定义保留在 `ai_handler.go` 的理由：跨多个新文件共用，集中放主文件可避免逐域内推（例如 `lifeTraceAssistantPlanDraft` 同时被 plan_draft / pantry_draft / ledger_draft / assistant_handler / ai_client 5 个文件用到）；只拆函数不拆类型，diff 最干净。

---

## Files to Modify / Create

### 创建

- `server/internal/lifetrace/today_advice_handler.go`
- `server/internal/lifetrace/weekly_review_handler.go`
- `server/internal/lifetrace/assistant_handler.go`
- `server/internal/lifetrace/assistant_plan_draft.go`
- `server/internal/lifetrace/assistant_pantry_draft.go`
- `server/internal/lifetrace/assistant_ledger_draft.go`
- `server/internal/lifetrace/assistant_common.go`
- `server/internal/lifetrace/ai_client.go`
- `server/internal/lifetrace/text_util.go`

### 修改

- `server/internal/lifetrace/ai_handler.go` — 仅保留类型定义、import、文件 doc；其余全部 cut/paste 到新文件。
- `server/internal/lifetrace/ai_handler_test.go` — 默认 **不拆**（保守路径）；如 Task 8 评估代价低则按域拆分（详见 Task 8）。

### 删除（dead code）

- [server/internal/lifetrace/ai_handler.go](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/ai_handler.go) 的 **L2831-L2905** 共 75 行：
  - `callLifeTraceOpenAI` (L2831-L2833)
  - `callLifeTraceOpenAIWithMaxTokens` (L2835-L2905)
  - **dead code grep 证据**：整个 server 范围内仅 1 处定义、0 处外部调用；`callLifeTraceOpenAI` 仅被自己同位置的 `callLifeTraceOpenAIWithMaxTokens` 间接引用 1 次。
  - **不可删的 OpenAI 相关代码**（保留搬到 `ai_client.go`）：
    - L2763-L2829 OpenAI 自定义 type（`lifeTraceOpenAIRequest/Response/StreamResponse/Tool/ToolCall/Message/...`）—— 被 `callLifeTraceAssistantToolOpenAI`、`callLifeTraceAssistantStructuredOpenAI`、`streamLifeTraceAssistantOpenAI` 三处使用，且 `_test.go` 多处引用。
    - L2907 起的 `streamLifeTraceAssistantOpenAI` 不属于 dead code，必须保留。

---

## Tasks

> 每个 Task 单独执行 + 单独 `go build` 验证。**不要批量复制粘贴所有文件后才编译**——会让 lint/typo/import 错误难以定位。

### Task 1 · 删除 dead code（最先做，缩小后续搬运量）

- 删除 [ai_handler.go#L2831-L2905](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/ai_handler.go#L2831-L2905)（75 行）。
- 不动 L2763-L2829 OpenAI type 定义、L2907 `streamLifeTraceAssistantOpenAI`。
- 验证：`cd server && go build ./...`、`go test ./internal/lifetrace/...`。

### Task 2 · 抽 `text_util.go`（最简单，先建立编辑节奏）

- 新建 [server/internal/lifetrace/text_util.go](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/text_util.go)，搬入 `trimRunes`（原 L3146-L3156）。
- 删除 ai_handler.go 中对应行。
- 验证：`go build ./...`。

### Task 3 · 抽 `assistant_common.go`（解锁后续 plan/pantry/ledger 拆分）

- 新建文件，搬入：
  - `lifeTraceAssistantActionRegistry`（L129-L151）
  - `lifeTraceAssistantToolName`（L161）
  - 14 个 `assistant*Pattern` 正则（L163-L183）
  - 三域共享 helper（L1237-L1305）：
    - `normalizeAssistantDate`、`normalizeAssistantNeedMoreInfoFields`
    - `buildAssistantPantryNeedMoreInfoMessage`、`buildAssistantLedgerNeedMoreInfoMessage`
    - `assistantPantryNeedsProductionDate`、`buildAssistantNeedMoreInfoPayload`
- 删除 ai_handler.go 中对应行。
- 验证：`go build ./...` + `go test ./internal/lifetrace/...`。

### Task 4 · 抽 `ai_client.go`（最大块，~1100 行）

- 新建文件，搬入（按当前文件顺序）：
  - `errLifeTraceAssistantTool{Unsupported,Invalid}`（L153-L156）
  - `readLifeTraceAIConfig`（L1604）、`readLifeTraceArkTextConfig`（L1608）
  - `ensureLifeTraceArkClient`（L1662）
  - `callLifeTraceAssistantStructuredResponse`（L2147）
  - `shouldFallbackToStructuredJSON`（L2183）
  - `callLifeTraceAssistantToolResponse`（L2187）
  - `buildLifeTraceAssistantToolSchema`（L2199）、`buildLifeTraceAssistantARKTools`（L2271）、`buildLifeTraceAssistantOpenAITools`（L2284）
  - `parseLifeTraceAssistantToolArguments`（L2297）、`parseLifeTraceAssistantARKToolCalls`（L2301）、`parseLifeTraceAssistantOpenAIToolCalls`（L2318）
  - `isLifeTraceAssistantToolUnsupported`（L2332）
  - `callLifeTraceAssistantToolARK`（L2343）、`callLifeTraceAssistantToolOpenAI`（L2395）
  - `callLifeTraceAssistantStructuredARK`（L2458）、`callLifeTraceAssistantStructuredOpenAI`（L2514）
  - `streamLifeTraceAssistantARK`（L2574）
  - `callLifeTraceTextAI`（L2663）、`callLifeTraceTextAIWithMaxTokens`（L2672）
  - `recordLifeTraceAIUsage`（L2729）
  - `callLifeTraceAI`（L2750）、`callLifeTraceAIWithMaxTokens`（L2754）
  - **OpenAI 自定义 type 定义**（L2763-L2829，保留，dead code 已 Task 1 清理）
  - `streamLifeTraceAssistantOpenAI`（L2907-L3017）
- 删除 ai_handler.go 对应区块。
- 验证：`go build ./...` + `go test ./internal/lifetrace/...`。

> ⚠️ 行号会因 Task 1-3 删除而前移；执行时按**函数名**搜索 + 复制，不要硬编码行号。

### Task 5 · 抽 `assistant_plan_draft.go`

- 搬入：
  - `buildLifeTraceAssistantPlanDraft`（L541）
  - `inferLifeTraceAssistantPlanType`（L570）
  - `buildLifeTraceAssistantPlanTitle`（L587）
  - `inferLifeTraceAssistantPlanTime`（L609）
  - `inferLifeTraceAssistantRelativeSchedule`（L642）
  - `inferLifeTraceAssistantPlanDate`（L686）
  - `extractAssistantStandaloneDate`（L703）
  - `lifeTraceAssistantLocalDate`（L710）
  - `daysUntilWeekday`（L719）
  - `formatLifeTraceAssistantPlanTimeLabel`（L723）
  - `assistantPlanMarker`（L727）
  - `missingAssistantPlanFields`（L731）
  - `buildAssistantPlanNeedMoreInfoMessage`（L742）
  - `(h *Handler) createAssistantPlanFromDraft`（L775）
  - `buildLifeTraceAssistantPlanFollowUpDraft`（L889）
  - `findRecentAssistantPlanDraft`（L1052）
  - `mergeAssistantPlanDraft`（L1353）
- 验证同上。

### Task 6 · 抽 `assistant_pantry_draft.go`

- 搬入：
  - `buildLifeTraceAssistantPantryDraft`（L841）
  - `inferLifeTraceAssistantPantryName`（L942）
  - `cleanLifeTraceAssistantPantryName`（L971）
  - `buildLifeTraceAssistantPantryFollowUpDraft`（L977）
  - `findRecentAssistantPantryDraft`（L1065）
  - `inferLifeTraceAssistantProductionDate`（L1137）
  - `inferLifeTraceAssistantExpiryDate`（L1144）
  - `inferLifeTraceAssistantShelfLife`（L1168）
  - `inferLifeTraceAssistantOpenedDate`（L1190）
  - `inferLifeTraceAssistantPantryQuantity`（L1197）
  - `inferLifeTraceAssistantPantryCategory`（L1207）
  - `inferLifeTraceAssistantPantryLocation`（L1220）
  - `mergeAssistantPantryDraft`（L1399）
  - `(h *Handler) createAssistantPantryItemFromDraft`（L1451）
- 验证同上。

### Task 7 · 抽 `assistant_ledger_draft.go`

- 搬入：
  - `buildLifeTraceAssistantLedgerDraft`（L872）
  - `inferLifeTraceAssistantLedgerAmount`（L1078）
  - `inferLifeTraceAssistantLedgerDirection`（L1094）
  - `inferLifeTraceAssistantLedgerCategory`（L1107）
  - `inferLifeTraceAssistantLedgerMerchant`（L1130）
  - `mergeAssistantLedgerDraft`（L1307）
  - `(h *Handler) createAssistantLedgerEntryFromDraft`（L1555）
- 验证同上。

### Task 8 · 抽 `today_advice_handler.go` / `weekly_review_handler.go` / `assistant_handler.go`

按域并列搬入（顺序按 cache var → const → handler → prompt → parse / normalize）：

**today_advice_handler.go**：
- `lifeTraceTodayAdviceDefaultTimeout` / `lifeTraceTodayAdviceCacheTTL`（L158-L159）
- `todayAdviceCacheEntry`（L185-L190）
- `lifeTraceTodayAdviceCache`（L192-L197）
- `adviceDefaults` / `adviceOrder` / `validAdviceTones`（L199-L217）
- `(h *Handler) GenerateTodayAdvice`（L219-L296）
- `buildTodayAdviceCacheKey`（L1624）、`getCachedTodayAdvice`（L1634）、`setCachedTodayAdvice`（L1650）、`clearCachedTodayAdvice`（L1656）
- `buildTodayAdvicePrompt`（L1666）
- `parseTodayAdviceAIResponse`（L3039）、`normalizeTodayAdviceItems`（L3065）

**weekly_review_handler.go**：
- `lifeTraceWeeklyReviewMaxTokens`（L160）
- `(h *Handler) GenerateWeeklyReview`（L298-L378）
- `(h *Handler) ListWeeklyReviews`（L380-L402）
- `(h *Handler) DeleteWeeklyReview`（L404-L428）
- `buildWeeklyReviewPrompt`（L1697）
- `currentWeeklyReviewRange`（L1740）、`buildWeeklyPlanLines`（L1746）
- `saveWeeklyReview`（L1761）、`weeklyReviewSaveErrorMessage`（L1815）、`weeklyReviewPayload`（L1825）
- `parseWeeklyReviewAIResponse`（L3102）、`normalizeWeeklyReviewList`（L3126）

**assistant_handler.go**：
- `(h *Handler) StreamAssistant`（L430-L539）
- `lifeTraceAssistantSystemPrompt`（L1842）
- `buildLifeTraceAssistantPrompt`（L1858）
- `buildLifeTraceAssistantStructuredPrompt`（L1933）
- `parseLifeTraceAssistantStructuredResponse`（L1965）
- `(h *Handler) streamLifeTraceAssistantStructured`（L2002）
- `(h *Handler) resolveLifeTraceAssistantStructuredAction`（L2048）
- `prepareLifeTraceSSE`（L3019）

验证：`go build ./...` + `go test ./internal/lifetrace/...`。

### Task 9 · 测试文件处理（评估后选一）

**默认（保守路径）**：`ai_handler_test.go` 1700+ 行**不拆**，保持单文件。理由：
- 同包测试文件可以引用任意私有符号，物理位置不影响编译。
- 第一刀核心目标是"主体可读"，测试拆分收益小、风险大（断言序号 / fixture 函数错位）。
- 后续可独立写一份"测试文件按域拆分"的小 plan。

**激进路径**（仅在 Task 1-8 顺利且 owner 要求时）：按域拆 5 个文件：
- `today_advice_handler_test.go` ← 涉及 `clearCachedTodayAdvice` / today advice 流程的用例
- `weekly_review_handler_test.go` ← 涉及 weekly review 的用例
- `assistant_handler_test.go` ← 涉及 `lifeTraceAssistantToolName` / `lifeTraceAssistantSystemPrompt` / structured/tool calling 的用例
- `ai_client_test.go` ← 涉及 `readLifeTraceArkTextConfig` / `lifeTraceOpenAIRequest` capture 的用例
- `ai_handler_test.go` 保留 ← 公用 fixture / setup helper

**推荐先走默认路径**，第一刀 PR 落地后再视代价决定是否做激进路径。

### Task 10 · 收尾校验

- `cd server && go build ./...`
- `cd server && go test ./...`
- `git diff --stat` 检查：所有新文件 = 净增加；`ai_handler.go` 净减少 ~2940 行；`_test.go` 不变（默认路径）或同步拆分（激进路径）。
- 抽样手动 diff 检查 3 处：
  - `ai_client.go` 的 OpenAI type 定义与原 L2763-L2829 完全一致。
  - `assistant_common.go` 14 个正则 raw string 完全一致（CJK 编码极易出错）。
  - `today_advice_handler.go` 包级 var 初始化顺序与原文件一致。
- 运行 encoding-guard 定向脚本：
  ```
  python3 .agents/skills/encoding-guard/scripts/check_mojibake.py \
    server/internal/lifetrace/assistant_common.go \
    server/internal/lifetrace/today_advice_handler.go \
    server/internal/lifetrace/weekly_review_handler.go \
    server/internal/lifetrace/assistant_handler.go \
    server/internal/lifetrace/assistant_plan_draft.go \
    server/internal/lifetrace/assistant_pantry_draft.go \
    server/internal/lifetrace/assistant_ledger_draft.go \
    server/internal/lifetrace/ai_client.go
  ```

---

## Verification

| 步骤 | 命令 | 预期 |
|---|---|---|
| 编译 | `cd server && go build ./...` | 零输出 |
| 单包测试 | `cd server && go test ./internal/lifetrace/...` | 全绿，断言数与原一致 |
| 全量测试 | `cd server && go test ./...` | 全绿 |
| diff stat | `git diff --stat server/internal/lifetrace/` | `ai_handler.go` 减少 ~2940 行；9 个新文件总增加 ≈ ai_handler.go 减少 - 75（dead code） |
| go vet（可选） | `cd server && go vet ./internal/lifetrace/...` | 零警告 |
| encoding | encoding-guard 脚本 | 8 个新文件零 mojibake |
| 手动冒烟（owner） | `POST /api/life-trace/ai/today-advice`、`POST /api/life-trace/ai/weekly-review`、`POST /api/life-trace/ai/assistant/stream` | 行为 1:1 |

**Karpathy 自检**（B 档收尾）：
1. **Surface assumptions**：默认路径假设"测试不拆"成本最低——此假设建立在"单包同位置访问私有符号"之上，已验证。
2. **Keep it simple**：第一刀只剪切粘贴 + 删 75 行 dead code，零业务逻辑改动。
3. **Surgical changes**：所有改动收敛在 [server/internal/lifetrace/](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace) 目录；不动 routes.go / ai/ 子包 / handler / model。
4. **Verifiable goals**：`go test ./...` 全绿是唯一硬性指标；diff stat 是辅助证据。

---

## Out of Scope

- **第二刀**（prompt 字符串下沉到 [lifetrace/ai/prompts/](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/ai/prompts)） — 独立 plan，第一刀完成后启动。
- **第三刀**（手写 OpenAI 双轨切到 `internal/aiclient`） — 决策点 4 标记为"暂缓"。
- 把 inbox / pantry_description / recipe_video / assistant_history 一起迁到 `lifetrace/ai/` 子包 — 不是本拆分目标。
- `ai_handler_test.go` 测试用例本身的修订（如发现冗余）— 默认不拆；如拆，单独 plan。
- mindarena 改名 — 独立 plan。
- creator_ai_* / resource_tag* 直连 ARK — 独立 plan（参见 Phase 2 Out of Scope）。
- routes.go 的路由路径调整 — 第一刀不动路由。

---

## Assumptions & Decisions

| # | 决策 | 选择 | 理由 |
|---|---|---|---|
| 1 | dead code 范围 | 仅 L2831-L2905（75 行） | grep 证据：整个 server 内 0 外部调用；OpenAI type 定义和 stream 函数仍在用，**不可删** |
| 2 | 类型定义（L31-L127）是否随域拆 | 不拆，保留在 ai_handler.go | 跨多个新文件共用；拆掉会导致循环依赖或大量重复定义 |
| 3 | 测试文件是否一并拆 | 默认不拆（Task 9 默认路径） | 同包测试可访问私有符号；测试拆分收益低、风险高 |
| 4 | 14 个正则归属 | 全部放 `assistant_common.go` | grep 证据：所有正则均仅在本文件内被 plan/pantry/ledger 三域引用；集中放共享文件最干净 |
| 5 | `trimRunes` 归属 | 独立 `text_util.go` | 被 4+ 个 lifetrace 包文件复用（pantry_description / recipe_video / inbox / assistant_history / closet 等）；放独立文件比塞进 ai_client.go 语义更准 |
| 6 | dead code 删除时机 | Task 1（最先做） | 减少后续 Task 4 搬运体积，避免"先搬到 ai_client.go 再删"做无用功 |
| 7 | 编辑顺序 | text_util → assistant_common → ai_client → 三个 draft → 三个 handler | 先抽**最少依赖**的 leaf（util/regex），再抽**最多被依赖**的（client），最后抽 handler；每步 `go build` 立即验证 |
| 8 | 行号引用方式 | 文档列原行号；执行时按函数名搜 | 行号会因前序 Task 删除而前移；硬编码行号会引入错位风险 |

---

## Skills used

- `writing-plans`（C 档结构化计划，本文档）
- `task-completion-guard`（防止误报"已完成"）
- 实施阶段会启用：`executing-plans` 或 `subagent-driven-development`、`encoding-guard`（CJK 正则与 prompt 大量存在）、`karpathy-coder`（每个 Task 4 原则收尾）、`verification-before-completion`（最终 Task 10）、`delivery-reporting`（多文件改动）、`skill-usage-disclosure`、`conventional-commit-guard`（如 owner 要求提交）

---

## 计划文档同步

- 本计划与 [apps/life-trace/docs/PLAN.md](file:///Users/bytedance/Desktop/study/valley-mas/apps/life-trace/docs/PLAN.md) 无关 — 纯后端结构拆分，不改产品功能 / 接口路径 / 数据模型 / 验收标准。
- 与 [server/AGENTS.md](file:///Users/bytedance/Desktop/study/valley-mas/server/AGENTS.md) 无需更新 — 不改路由、配置或 AI 接入规范。
- 临时产物：本文件位于 [.trae/documents/](file:///Users/bytedance/Desktop/study/valley-mas/.trae/documents)，第一刀完成后由 owner 决定是否清理。
