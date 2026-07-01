# lifetrace/ai_handler.go 拆分计划 · 现状速览 + 草案

> 状态：**草稿**。基于 Explore agent 对 [server/internal/lifetrace/ai_handler.go](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/ai_handler.go) 的完整扫描，由你 review 后再决定是否进入实施。本草稿仅做现状速览 + 拆分方向，不固化具体步骤。

---

## 一、现状速览

### 1.1 文件概况

- **位置**：[server/internal/lifetrace/ai_handler.go](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/ai_handler.go)
- **总行数**：3156，**package**：`lifetrace`（与同目录 inbox/pantry/recipe 等 handler 共享包）
- **顶部无 doc**，import 含标准库 + `aiusage` / `database` / `lifetrace/agent` / `lifetrace/ai` / `model` + `gin` + `arkruntime` + `arkmodel` + `gorm`
- **功能域**：5 个 HTTP handler 入口（today advice / weekly review × 3 / assistant SSE）+ 三套 draft 流水线（plan/pantry/ledger）+ ARK/OpenAI 工具调用 + 结构化 JSON fallback + SSE 流编排

### 1.2 函数清单（按职责域）

| 域 | 行号区间 | 主要函数 | 大致占比 |
|---|---|---|---|
| HTTP handler 入口 | [L219-L539](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/ai_handler.go#L219-L539) | `GenerateTodayAdvice`、`GenerateWeeklyReview`、`ListWeeklyReviews`、`DeleteWeeklyReview`、`StreamAssistant` | ~10% |
| Today advice prompt + cache + parse | [L1624-L1695](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/ai_handler.go#L1624-L1695) + [L3039-L3100](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/ai_handler.go#L3039-L3100) | `buildTodayAdvicePrompt`、`parseTodayAdviceAIResponse`、`normalizeTodayAdviceItems`、4 个 cache helper | ~5% |
| Weekly review prompt + DB + parse | [L1697-L1840](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/ai_handler.go#L1697-L1840) + [L3102-L3144](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/ai_handler.go#L3102-L3144) | `buildWeeklyReviewPrompt`、`saveWeeklyReview`、`parseWeeklyReviewAIResponse`、`normalizeWeeklyReviewList` | ~6% |
| Assistant prompt + 结构化解析 | [L1842-L2000](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/ai_handler.go#L1842-L2000) | `lifeTraceAssistantSystemPrompt`、`buildLifeTraceAssistantPrompt`、`buildLifeTraceAssistantStructuredPrompt`、`parseLifeTraceAssistantStructuredResponse` | ~5% |
| Assistant 流编排 / 动作路由 | [L2002-L2145](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/ai_handler.go#L2002-L2145) + [L3019-L3037](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/ai_handler.go#L3019-L3037) | `streamLifeTraceAssistantStructured`、`resolveLifeTraceAssistantStructuredAction`、`prepareLifeTraceSSE` | ~5% |
| Plan draft（plan 域） | [L541-L839](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/ai_handler.go#L541-L839) + L889-L940 + L1052-L1063 + L1353-L1397 | 14 个 build/infer/merge/createFromDraft | ~10% |
| Pantry draft（pantry 域） | [L841-L870](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/ai_handler.go#L841-L870) + L942-L1050 + L1065-L1076 + L1137-L1235 + L1399-L1553 | 17+ 函数 | ~15% |
| Ledger draft（ledger 域） | [L872-L887](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/ai_handler.go#L872-L887) + L1078-L1135 + L1307-L1351 + L1555-L1602 | 9+ 函数 | ~7% |
| 三域共享 helper | [L1237-L1305](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/ai_handler.go#L1237-L1305) | `normalizeAssistantDate`、`normalizeAssistantNeedMoreInfoFields`、`buildAssistantNeedMoreInfoPayload` 等 | ~2% |
| ARK/OpenAI client + tool calling 双链路 | [L1604-L1664](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/ai_handler.go#L1604-L1664) + [L2147-L3017](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/ai_handler.go#L2147-L3017) | 14 个调用包装 + 1 组 OpenAI 自定义 type | **~32%** |
| 通用工具 | [L3146-L3156](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/ai_handler.go#L3146-L3156) | `trimRunes` | <1% |

**最大块**：ARK/OpenAI 双轨调用占 ~32%（约 1000 行），其次 pantry draft（~15%），其次 plan draft + ARK/OpenAI 配置入口（~10%）。

### 1.3 包级 / 文件级共享状态

| 名称 | 行 | 类型 | 跨文件读写 |
|---|---|---|---|
| `lifeTraceAssistantActionRegistry` | [L129-L151](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/ai_handler.go#L129-L151) | `lifeagent.Registry` | 仅本文件 |
| `errLifeTraceAssistantTool{Unsupported,Invalid}` | L153-L156 | error | 跨 tool / structured 流程 |
| 4 个常量 (`lifeTraceTodayAdviceDefaultTimeout` 等) | L158-L161 | const | `lifeTraceAssistantToolName` 还被 `ai_handler_test.go` 引用 |
| 14 个 `assistant*Pattern` regex | [L163-L183](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/ai_handler.go#L163-L183) | `*regexp.Regexp` | plan / pantry / ledger 三域共用 |
| `lifeTraceTodayAdviceCache` | [L192-L197](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/ai_handler.go#L192-L197) | `struct{ sync.RWMutex; items map }` | get/set/clear + 测试 `clearCachedTodayAdvice` 用 |
| `adviceDefaults` / `adviceOrder` / `validAdviceTones` | [L199-L217](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/ai_handler.go#L199-L217) | map / slice | `normalizeTodayAdviceItems` 读 |

### 1.4 路由注册点

注册集中在 [routes.go](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/routes.go)（不是 router/router.go，后者只调 `lifetrace.RegisterRoutes`）。

| 路径 | 方法 | 路由行 | handler 行 |
|---|---|---|---|
| `POST /api/life-trace/ai/today-advice` | `GenerateTodayAdvice` | [routes.go#L25](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/routes.go#L25) | [L219](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/ai_handler.go#L219) |
| `POST /api/life-trace/ai/weekly-review` | `GenerateWeeklyReview` | [routes.go#L26](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/routes.go#L26) | [L298](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/ai_handler.go#L298) |
| `POST /api/life-trace/ai/assistant/stream` | `StreamAssistant` | [routes.go#L38](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/routes.go#L38) | [L430](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/ai_handler.go#L430) |
| `GET /api/life-trace/weekly-reviews` | `ListWeeklyReviews` | [routes.go#L197](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/routes.go#L197) | [L380](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/ai_handler.go#L380) |
| `DELETE /api/life-trace/weekly-reviews/:id` | `DeleteWeeklyReview` | [routes.go#L198](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/routes.go#L198) | [L404](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/ai_handler.go#L404) |

### 1.5 跨包 / 跨文件依赖（拆分必须保留的入口）

- **导出符号外部引用**：0（所有 top-level 标识符首字母均小写）。
- **同包跨文件复用**：
  - `readLifeTraceAIConfig` + `callLifeTraceAIWithMaxTokens`：被 `pantry_description_handler.go`、`recipe_video_handler.go`、`inbox_handler.go` 共 6 处复用。
  - `trimRunes`：被 `inbox_handler.go`、`assistant_history_handler.go` 等多文件共 ~6 处复用。
  - `ai_handler_test.go`（1700+ 行）：引用 `clearCachedTodayAdvice`、`lifeTraceAssistantToolName`、`lifeTraceAssistantSystemPrompt`、`readLifeTraceAIConfig`、`readLifeTraceArkTextConfig`。
- **半下沉先例**：[lifetrace/ai/prompts/](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/ai/prompts) 已有 `helpers.go` / `image_analysis.go` / `inbox.go` / `media_diary.go` / `prompts_test.go`——today-advice / weekly-review / assistant 三套 prompt 仍 100% 留在本文件，**可对齐先例下沉**。

### 1.6 拆分难点（Explore 报告原话核心 5 条）

1. **today-advice 缓存与默认值是包级 var** —— 测试依赖 `clearCachedTodayAdvice`，迁子包要重新设计 cache 注入。
2. **共享 AI 调用入口被 4 个 handler 复用** —— `readLifeTraceAIConfig` / `callLifeTraceAIWithMaxTokens` / `trimRunes` 必须保留在 `package lifetrace` 或同步迁出且改 6+ 处调用。
3. **SSE writer + 助理流编排耦合度高** —— `prepareLifeTraceSSE` / `streamLifeTraceAssistant{Structured,ARK,OpenAI}` 共享闭包并直接调 `h.createAssistant{Plan,Pantry,Ledger}FromDraft` 落库。
4. **assistant 三组 draft 共享 14 个正则 + normalize/needMoreInfo helper** —— 必须先抽 `assistant_common.go` 才能按 plan / pantry / ledger 拆，否则诱发循环引用。
5. **OpenAI 自定义 type 与 ARK 双轨残留** —— [L2763-L2829](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/ai_handler.go#L2763-L2829) 手写 `lifeTraceOpenAIRequest/Response/Stream*` 与 `internal/aiclient` 已有的封装重复，是先拆还是先合并要决定。

### 1.7 灰色地带（Explore 自我评估列出）

- `parseTodayAdviceAIResponse` / `parseWeeklyReviewAIResponse` 物理上在文件最末（L3039、L3102），紧贴 `prepareLifeTraceSSE` —— **按行号分块容易切错，必须按函数名分组**。
- `trimRunes` 是留在 lifetrace 还是迁到 `internal/aiclient` —— 取决于是否打算把 inbox/pantry_description/recipe_video 一起切到子包。
- `callLifeTraceOpenAI` / `callLifeTraceOpenAIWithMaxTokens`（[L2831-L2905](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/ai_handler.go#L2831-L2905)）疑似 dead code（`callLifeTraceAIWithMaxTokens` 已改走 `lifeai.NewClient`），**拆分前先 grep 确认能否直接删除**。
- `lifeTraceAIConfig = lifeai.TextConfig` 是类型别名 —— 拆出本包要同步切换签名。

---

## 二、拆分草案（三刀，由保守到激进）

> 三刀**不必一次完成**，建议每刀单独立 plan + 单独 commit + 单独 owner 验收。每刀完成后行为零变化（除 dead code 清理外），测试断言不动。

### 第一刀：同包多文件物理拆分（保守 · 推荐起点）

**目标**：把 3156 行拆到 ~9 个文件，**仍保留 `package lifetrace`**，零跨包改动，零行为变化。所有 `(*Handler)` 方法保留 receiver，所有跨文件共享 helper（`readLifeTraceAIConfig` / `callLifeTraceAIWithMaxTokens` / `trimRunes`）保留在新位置但仍是 package-private。

**拆分映射（建议）**：

| 新文件 | 内容 | 来源行 |
|---|---|---|
| `ai_handler.go`（保留） | 文件级 const / regex / cache var / `Handler` 方法定义集合首段（仅占位 + 包级状态） | L1-L217 |
| `today_advice_handler.go` | `GenerateTodayAdvice` + cache helper + prompt + parse + normalize | L219-L296 + L1624-L1695 + L3039-L3100 |
| `weekly_review_handler.go` | `GenerateWeeklyReview` / `ListWeeklyReviews` / `DeleteWeeklyReview` + prompt + saveWeeklyReview + parse | L298-L428 + L1697-L1840 + L3102-L3144 |
| `assistant_handler.go` | `StreamAssistant` + `streamLifeTraceAssistantStructured` + `resolveLifeTraceAssistantStructuredAction` + `prepareLifeTraceSSE` + assistant prompt + 解析 | L430-L539 + L1842-L2145 + L3019-L3037 |
| `assistant_plan_draft.go` | plan 域所有 build/infer/merge/createFromDraft + plan-only helper | L541-L839 + L889-L940 + L1052-L1063 + L1353-L1397 |
| `assistant_pantry_draft.go` | pantry 域所有函数 | L841-L870 + L942-L1050 + L1065-L1076 + L1137-L1235 + L1399-L1553 |
| `assistant_ledger_draft.go` | ledger 域所有函数 | L872-L887 + L1078-L1135 + L1307-L1351 + L1555-L1602 |
| `assistant_common.go` | 三域共享 helper（`normalizeAssistantDate` / `normalizeAssistantNeedMoreInfoFields` / `buildAssistantNeedMoreInfoPayload` 等）+ 14 个正则常量定义 | L163-L183 + L1237-L1305 |
| `ai_client.go` | `readLifeTraceAIConfig` / `readLifeTraceArkTextConfig` / `ensureLifeTraceArkClient` / `callLifeTraceAI*` / `callLifeTraceTextAI*` / `recordLifeTraceAIUsage` / `streamLifeTraceAssistantARK` / `streamLifeTraceAssistantOpenAI` / `callLifeTraceAssistantTool*` / `callLifeTraceAssistantStructured*` / `buildLifeTraceAssistantToolSchema` + OpenAI 自定义 type | L1604-L1664 + L2147-L3017 |
| `text_util.go` | `trimRunes` | L3146-L3156 |
| `ai_handler_test.go` 拆分 | 按上述域同步拆成 today/weekly/assistant_*/ai_client 几个 _test.go 文件 | 1700+ 行 |

**前置必做**：
- grep 确认 [L2831-L2905](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/ai_handler.go#L2831-L2905) `callLifeTraceOpenAI` / `callLifeTraceOpenAIWithMaxTokens` 是否 dead code。如确认无引用 → 直接删除（不进入第一刀的迁移）。

**风险**：
- 14 个正则与 cache 是包级 var，多文件拆完后仍是 package-private，零问题；但要确保正则定义只放在 `assistant_common.go`，避免 plan/pantry/ledger 三文件之间互相 import 同包 var 出现"循环初始化"歧义。
- `(*Handler)` 方法 receiver 跨文件分布是 Go 合法行为，无问题。
- 测试文件拆分时容易把 `clearCachedTodayAdvice` 等私有符号留错位置；建议按 _handler.go ↔ _handler_test.go 一一对应。

**验证标准**：`go build ./...` + `go test ./internal/lifetrace/...` + `go test ./...` 全绿；diff 应该几乎全是"剪切粘贴"，零业务逻辑变化。

### 第二刀：prompt 字符串下沉到 `lifetrace/ai/prompts/`（中等）

**前提**：第一刀已落地。

**目标**：复用已有先例（`prompts/image_analysis.go` / `inbox.go` / `media_diary.go`），把 today-advice / weekly-review / assistant 三套 prompt + 解析迁到 `prompts/{today_advice,weekly_review,assistant}.go`，主包只剩 handler + draft 流水线。

**改动范围**：
- 新建 `prompts/today_advice.go`、`prompts/weekly_review.go`、`prompts/assistant.go`（参考 `prompts/inbox.go` 的 `PromptContract` 风格）。
- 主包 `today_advice_handler.go` / `weekly_review_handler.go` / `assistant_handler.go` 只剩调用 `prompts.TodayAdvice.Build(...)` 等。
- `ai_handler_test.go` 中对 `lifeTraceAssistantSystemPrompt` 的引用要决策：
  - 选项 A：把符号导出（`prompts.AssistantSystemPrompt`）→ 测试改 import；
  - 选项 B：在主包保留 1 行常量 alias → 测试零修改。**推荐 B**（与 Phase 2 shim 风格一致）。

**风险**：
- `parseTodayAdviceAIResponse` / `parseWeeklyReviewAIResponse` 的 normalize 默认值（`adviceDefaults` / `adviceOrder` / `validAdviceTones`）也要随 prompt 一起迁，否则 `normalize` 在主包、`parse` 在子包，跨包私有访问失败。
- prompts 子包不能 import 回 `lifetrace` 主包，否则循环依赖。

### 第三刀：把手写 OpenAI 双轨切到 `internal/aiclient`（激进 · 收益最大但风险最高）

**前提**：第一、二刀已落地。

**目标**：删除 [L2763-L2829](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/ai_handler.go#L2763-L2829) 手写 `lifeTraceOpenAIRequest/Response/StreamResponse/Tool/ToolCall` 等本地 type；`callLifeTraceAssistantStructuredOpenAI` / `callLifeTraceAssistantToolOpenAI` / `streamLifeTraceAssistantOpenAI` 三处压缩到 `internal/aiclient` 已有的封装。

**改动范围**：
- `internal/aiclient/openai.go` 可能要扩展 tool calling / structured response 能力（当前只有配置读取）。
- `internal/aiclient/stream.go` 已有 SSE writer，但要扩展 OpenAI 流式拉取 + chunk 转发能力。
- `ai_client.go`（第一刀产出）三处函数压成各 ~10 行 shim。

**风险**：
- 这一刀是**真正的行为重构**，不是物理拆分。任何 chunk 边界、retry 行为、超时差异都可能导致 SSE 用户体验回归。
- 必须**在 aiclient 层补足够的 tool calling / structured response 测试**（当前 aiclient 只有配置 + 文本 client 测试）。
- 决定要不要做的关键判断：是否还有 Phase 5+ 需要新增 OpenAI 工具调用功能？如果只是历史包袱、未来不会再加，留着双轨成本更低。

---

## 三、决策点（需要 owner 拍板才能进入实施）

| # | 决策点 | 推荐 | 理由 |
|---|---|---|---|
| 1 | 是否分三刀依次推进，每刀独立 plan + 独立 PR | ✅ 是 | 单刀风险小、回滚易；3156 行一次拆完容易切错共享状态 |
| 2 | 第一刀是否同时清理 `callLifeTraceOpenAI` 疑似 dead code | ✅ 是（前提：grep 确认 0 引用） | 不清理就要原样搬到 `ai_client.go`，污染新文件 |
| 3 | 第二刀 `lifeTraceAssistantSystemPrompt` 测试访问 → A 导出 / B alias | B alias | 与 Phase 2 shim 风格一致，测试零修改 |
| 4 | 第三刀（OpenAI 双轨切到 aiclient）是否做 | ⏸ 暂缓 | 收益高但风险也高，先看第一二刀完成后是否还有新 OpenAI 功能需求 |
| 5 | `trimRunes` 留在 lifetrace 主包还是迁到 aiclient | 留主包 | 4 个 handler 复用，迁出要改 6 处；与 Phase 2 "保留对外 shim 避免雪球" 思路一致 |
| 6 | 第一刀拆出来的 `ai_client.go` 是否再细分为 `ai_client_ark.go` / `ai_client_openai.go` | 视长度 | 拆完如果 `ai_client.go` 仍 >800 行可再细分；<800 行不细分 |

---

## 四、Verification 思路（适用于三刀任一）

- `go build ./...`：零输出。
- `go test ./internal/lifetrace/...`：全绿，断言零修改（特别是 `ai_handler_test.go` 1700+ 行）。
- `go test ./...`：整体回归全绿。
- `git diff --stat`：第一刀应几乎全是 0 净增删（剪切粘贴）；第二刀有 prompts 子包新增；第三刀有真实代码变化。
- 手动冒烟（owner）：`POST /api/life-trace/ai/today-advice` / `POST /api/life-trace/ai/weekly-review` / `POST /api/life-trace/ai/assistant/stream` 三处。

---

## 五、Out of Scope

- mindarena 改名（独立 plan）。
- creator_ai_* / resource_tag* 直连 ARK（独立 plan，参见 Phase 2 Out of Scope）。
- 把 inbox / pantry_description / recipe_video / assistant_history 一起迁到 lifetrace/ai 子包（不是本拆分目标，第一刀只动 ai_handler.go 的物理切分）。
- ai_handler_test.go 内具体测试的修订（第一刀只做物理拆分，断言不动；如发现冗余测试用例，留独立 plan 清理）。

---

## 六、下一步建议

1. **owner 决定第三节 6 个决策点**（特别是第 1、2、4 项）。
2. 决策完成后，**先针对"第一刀"单独写一份完整 plan**（含每个新文件的精确函数清单 + 行号区间 + 编辑顺序），由 EnterPlanMode 进入 plan mode 走完整 4 阶段流程。
3. 第一刀落地后再视情况进入第二、三刀。

---

## 七、Skills used

- `Explore` agent（仓库结构扫描，已用）
- `task-completion-guard`（草稿阶段，避免误报"已完成"）
- 实施阶段会再启用：`writing-plans`（写 C 档结构化计划）、`executing-plans` 或 `subagent-driven-development`（多文件迁移）、`encoding-guard`（含 CJK prompt 字符串）、`karpathy-coder`（每刀收尾自检）、`verification-before-completion`、`delivery-reporting`、`skill-usage-disclosure`。

---

## 八、计划文档同步

- 本草稿不影响 [apps/life-trace/docs/PLAN.md](file:///Users/bytedance/Desktop/study/valley-mas/apps/life-trace/docs/PLAN.md)（纯后端结构调整，不改产品功能 / 接口路径 / 数据模型 / 验收标准）。
- 临时产物：本文件与未来三刀对应的实施 plan 都写到 `.trae/documents/`，任务关闭后由 owner 决定清理。
