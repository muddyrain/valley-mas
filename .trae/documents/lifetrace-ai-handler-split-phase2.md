# 第二刀 · lifetrace prompt 下沉到 `lifetrace/ai/prompts/`

> 状态：**已落地（Task 1-10 全部完成）**。基于 [第一刀完成结果](file:///Users/bytedance/Desktop/study/valley-mas/.trae/documents/lifetrace-ai-handler-split-phase1.md)（ai_handler.go 3156 → 105 行 + 9 个域文件）后自然延伸。owner 已批准：**覆盖 3 个核心 handler + 走 PromptContract 三段式 + types 一并迁并保留 alias**。

---

## Context

第一刀已经按域把巨型 `ai_handler.go` 切成同包 9 文件，但 today_advice / weekly_review / assistant 三域的 **prompt 字面量、JSON 解析、字段归一化** 仍然嵌在 handler 里，与 Gin/DB/流控逻辑混杂。已有 [inbox](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/ai/prompts/inbox.go)、[image_analysis](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/ai/prompts/image_analysis.go)、[media_diary](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/ai/prompts/media_diary.go) 三个 domain 走通了 [`PromptContract[I, O]`](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/ai/contract.go#L11-L54) 范式，第二刀就是把 today/weekly/assistant 三域也对齐这条范式。

第二刀目标：**把 3 个核心 handler 的 prompt / parse / normalize 全部下沉到 `internal/lifetrace/ai/prompts/`，用 PromptContract 三段式重构；handler 只剩 HTTP + DB + 流编排。**

**严格约束**：
- 只碰 today_advice_handler.go / weekly_review_handler.go / assistant_handler.go 与 prompts 包新文件，不动其他 handler、不动 aiclient、不动 aiusage、不动 `ai/client.go`。
- prompt 字面量 1:1 搬运（含标点、换行、CJK），**行为零变化**；不改文案不改字段顺序不改 fallback 值。
- 所有 handler 里对 prompt/parse/normalize 的调用替换成 `prompts.BuildXxx / prompts.ParseXxx`；原函数不留残根。
- 原 `ai_handler.go` 类型定义保留 `type xxx = prompts.Xxx` alias，避免 `_test.go` 和其他 handler 断言批量重写。
- 不下沉不属于 3 个核心域的 prompt（closet / pantry / recipe / image / media_diary 已经在 prompts 或留给独立 plan）。

**范围外（本刀不做）**：
- OpenAI 双轨切到 aiclient（留给第三刀）。
- closet / pantry / recipe / image 的 build*Prompt 下沉（留给独立小 plan）。
- 测试文件按域拆分（沿用第一刀 Task 9 决定）。

**预期效果**：
- `today_advice_handler.go`：266 → ~150 行（去 prompt 字面量 + parse + normalize）。
- `weekly_review_handler.go`：341 → ~200 行。
- `assistant_handler.go`：452 → ~330 行（system prompt + user prompt + structured prompt + parse 全出走）。
- prompts 包新增 3 个文件：`today_advice.go` / `weekly_review.go` / `assistant.go`，每个文件 domain 内闭合，未来做 A/B 提示词、加多语言、加模型切换都只改这里。

---

## Architecture

### 目标文件结构

```
internal/lifetrace/ai/prompts/
├── helpers.go           保留 — TrimRunes / ExtractJSONObject / NormalizeTextList
├── inbox.go             保留 — InboxOrganizeContract
├── image_analysis.go    保留 — ImageAnalysisContract
├── media_diary.go       保留 — MediaDiarySuggestContract
├── today_advice.go      新建 — TodayAdviceContract
├── weekly_review.go     新建 — WeeklyReviewContract
├── assistant.go         新建 — AssistantSystemPrompt + AssistantContextContract + AssistantStructuredContract
└── prompts_test.go      修改 — 追加 3 个 domain 的 fallback / normalize 断言

internal/lifetrace/
├── ai_handler.go              修改 — 6 个 types 改成 alias 到 prompts
├── today_advice_handler.go    修改 — 删 buildTodayAdvicePrompt / parseTodayAdviceAIResponse / normalizeTodayAdviceItems / adviceDefaults / adviceOrder / validAdviceTones
├── weekly_review_handler.go   修改 — 删 buildWeeklyReviewPrompt / parseWeeklyReviewAIResponse / normalizeWeeklyReviewList
└── assistant_handler.go       修改 — 删 lifeTraceAssistantSystemPrompt / buildLifeTraceAssistantPrompt / buildLifeTraceAssistantStructuredPrompt / parseLifeTraceAssistantStructuredResponse
```

### Contract 设计（3 个 domain）

#### Today Advice

```go
// prompts/today_advice.go
package prompts

const TodayAdviceMaxTokens = 0 // handler 自己控制 MaxTokens，本 domain 用默认

type TodayAdvicePlanLine struct { Title, Type, TimeLabel string }
type TodayAdviceWeather struct {
    Text, High, Low, FeelsLike, Humidity, WindScale, Precip, UVIndex, AirQuality string
}
type TodayAdviceInput struct {
    City, WorkStart, WorkEnd, CommuteMethod string
    Weather TodayAdviceWeather
    Plans   []TodayAdvicePlanLine
}
type TodayAdviceItem struct {
    ID     string `json:"id"`
    Title  string `json:"title"`
    Detail string `json:"detail"`
    Tone   string `json:"tone"`
}
type TodayAdviceOutput struct {
    Summary string            `json:"summary"`
    Items   []TodayAdviceItem `json:"items"`
}

var TodayAdviceContract = ai.PromptContract[TodayAdviceInput, TodayAdviceOutput]{
    Name: "life-trace-today-advice",
    Version: "v1",
    AuditScene: "life-trace-today-advice",
    BuildPrompt: BuildTodayAdvicePrompt,
}

func BuildTodayAdvicePrompt(input TodayAdviceInput) string { /* 原 buildTodayAdvicePrompt 字面量搬运 */ }
func ParseTodayAdviceOutput(raw string) (TodayAdviceOutput, error) { /* 原 parseTodayAdviceAIResponse */ }
func NormalizeTodayAdviceItems(items []TodayAdviceItem) ([]TodayAdviceItem, error) { /* 原 normalizeTodayAdviceItems */ }
```

adviceDefaults / adviceOrder / validAdviceTones 一并迁到 today_advice.go（`NormalizeTodayAdviceItems` 的依赖）。

#### Weekly Review

```go
// prompts/weekly_review.go
const WeeklyReviewMaxTokens = 520 // 从 lifeTraceWeeklyReviewMaxTokens 迁移

type WeeklyReviewPlanLine struct { Title, Type, TimeLabel string; Completed bool }
type WeeklyReviewTraceLine struct { Title, Mood, TimeLabel, Source string; Tags []string }
type WeeklyReviewInput struct {
    City, WorkStart, WorkEnd, CommuteMethod string
    WeekStart, WeekEnd time.Time
    CompletedPlans, OpenPlans []WeeklyReviewPlanLine
    Traces []WeeklyReviewTraceLine
}
type WeeklyReviewOutput struct {
    Summary     string   `json:"summary"`
    Wins        []string `json:"wins"`
    Delays      []string `json:"delays"`
    Insights    []string `json:"insights"`
    NextActions []string `json:"nextActions"`
}

var WeeklyReviewContract = ai.PromptContract[WeeklyReviewInput, WeeklyReviewOutput]{
    Name: "life-trace-weekly-review",
    Version: "v1",
    AuditScene: "life-trace-weekly-review",
    MaxTokens: WeeklyReviewMaxTokens,
    BuildPrompt: BuildWeeklyReviewPrompt,
}

func BuildWeeklyReviewPrompt(input WeeklyReviewInput) string { /* 搬运 */ }
func ParseWeeklyReviewOutput(raw string) (WeeklyReviewOutput, error) { /* 搬运 */ }
func normalizeWeeklyReviewList(items []string, fallback string, maxItems, maxRunes int) []string { /* 内部 helper */ }
```

#### Assistant

Assistant 域 prompt 分两层：

- **AssistantSystemPrompt**：常量字符串，直接暴露为 `func AssistantSystemPrompt() string`（保留函数而非 var，方便未来加分支）。
- **AssistantContextContract**：`buildLifeTraceAssistantPrompt` 对应的上下文 prompt（非结构化，无 output type，用于 non-structured fallback；暂用普通 build 函数不建 Contract）。
- **AssistantStructuredContract**：`buildLifeTraceAssistantStructuredPrompt` + `parseLifeTraceAssistantStructuredResponse`，走 Contract。

```go
// prompts/assistant.go
type AssistantMessage struct { Role, Content string }
type AssistantWeather = TodayAdviceWeather                     // reuse
type AssistantPlanLine struct { Title, Type, TimeLabel string; Reminder bool }
type AssistantTraceLine struct { Title, Mood, TimeLabel string }
type AssistantContextInput struct {
    City, WorkStart, WorkEnd, CommuteMethod string
    Weather AssistantWeather
    Plans   []AssistantPlanLine
    Traces  []AssistantTraceLine
    History []AssistantMessage
    UserMessage string
}
type AssistantStructuredInput struct {
    Context  AssistantContextInput
    ToolName string
    Now      time.Time
}

type AssistantPlanDraft struct {
    Title, Type, ScheduledDate, ScheduledTime, Timezone, NotePrefix string
}
type AssistantPantryDraft struct { /* 8 字段 */ }
type AssistantLedgerDraft struct  { /* 8 字段 */ }
type AssistantStructuredAction struct {
    Type               string                `json:"type"`
    Message            string                `json:"message"`
    NeedMoreInfoFields []string              `json:"needMoreInfoFields,omitempty"`
    Plan               *AssistantPlanDraft   `json:"plan,omitempty"`
    Pantry             *AssistantPantryDraft `json:"pantry,omitempty"`
    Ledger             *AssistantLedgerDraft `json:"ledger,omitempty"`
}
type AssistantStructuredOutput struct {
    Reply  string                     `json:"reply"`
    Action *AssistantStructuredAction `json:"action,omitempty"`
}

const AssistantToolName = "submit_life_trace_response"

func AssistantSystemPrompt() string
func BuildAssistantContextPrompt(input AssistantContextInput) string
func BuildAssistantStructuredPrompt(input AssistantStructuredInput) string
func ParseAssistantStructuredOutput(raw string) (AssistantStructuredOutput, error)
```

Assistant 域 draft 类型（PlanDraft / PantryDraft / LedgerDraft）**同时**存在于 lifetrace 包（第一刀已定义在 [ai_handler.go L61-L91](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/ai_handler.go#L61-L91)）和 prompts 包。因为 lifetrace 包的 draft 类型有非 JSON 字段（`RelativeSchedule bool`）和被 pantry/ledger/plan draft 域大量 build/infer/merge/createFromDraft 使用，**不适合迁走**。

**方案：prompts 包重新定义一次结构（仅含 JSON 字段），parse 函数 return prompts 类型；handler 层再做一次 struct→struct 转换。** 详细在 Task 6。

**关于 `lifeTraceAssistantToolName`**：这个常量当前定义在 [assistant_common.go L14](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/assistant_common.go#L14)，并被 ai_client.go 里的 tool schema 构造函数用到。第二刀**保留原位**，同时在 prompts 包定义 `AssistantToolName` 并让 lifetrace 包用 `lifeTraceAssistantToolName = prompts.AssistantToolName` 的方式做 alias 参数化。避免多包定义同一 tool name 分叉。

### Types alias 映射

| 原 lifetrace 包 type | 新 prompts 包 type | 迁移策略 |
|---|---|---|
| `lifeTraceAIAdvice` | `prompts.TodayAdviceItem` | alias `type lifeTraceAIAdvice = prompts.TodayAdviceItem` |
| `todayAdviceAIResponse` | `prompts.TodayAdviceOutput` | alias |
| `weeklyReviewAIResponse` | `prompts.WeeklyReviewOutput` | alias |
| `lifeTraceAssistantStructuredAction` | `prompts.AssistantStructuredAction` | alias |
| `lifeTraceAssistantStructuredResponse` | `prompts.AssistantStructuredOutput` | alias |

保留 alias 的原因：`ai_handler_test.go` 有 1700+ 行断言直接用 lifetrace 包内类型名（如 `parseTodayAdviceAIResponse` 返回值 destructure、`weeklyReviewAIResponse{}` 字面量），批量重命名风险大且第一刀 Task 9 已决定"测试不拆"。alias 让测试文件零改动。

**不迁**的类型（继续留在 lifetrace 包）：
- `lifeTraceAssistantMessage` / `lifeTraceAssistantRequest` / `lifeTraceAssistantStreamChunk`：HTTP 请求/SSE chunk，不属 prompt 域。
- `lifeTraceAssistantPlanDraft` / `PantryDraft` / `LedgerDraft`：draft 域自有 build/infer/merge/createFromDraft 流水线大量依赖，含非 JSON 字段（RelativeSchedule）。
- `lifeTraceAssistantActionPayload`：HTTP 响应层，含 `*model.LifeTracePlan` 等业务模型。

---

## Files to Modify / Create

### 创建

- [`server/internal/lifetrace/ai/prompts/today_advice.go`](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/ai/prompts/today_advice.go) — TodayAdviceContract + build/parse/normalize + adviceDefaults/Order/validTones
- [`server/internal/lifetrace/ai/prompts/weekly_review.go`](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/ai/prompts/weekly_review.go) — WeeklyReviewContract + build/parse + normalizeWeeklyReviewList
- [`server/internal/lifetrace/ai/prompts/assistant.go`](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/ai/prompts/assistant.go) — SystemPrompt / ContextPrompt / StructuredContract + parse

### 修改

- [`server/internal/lifetrace/ai_handler.go`](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/ai_handler.go) — 6 个 types 改 alias；import 增补 prompts 包
- [`server/internal/lifetrace/today_advice_handler.go`](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/today_advice_handler.go) — 删 build/parse/normalize 及 3 个 var；handler 内调用改成 `prompts.Build/Parse`
- [`server/internal/lifetrace/weekly_review_handler.go`](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/weekly_review_handler.go) — 同上；`lifeTraceWeeklyReviewMaxTokens` 用 `prompts.WeeklyReviewMaxTokens` 替代
- [`server/internal/lifetrace/assistant_handler.go`](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/assistant_handler.go) — 删 system/context/structured/parse；handler 组装 Input 并调用 prompts.\*
- [`server/internal/lifetrace/assistant_common.go`](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/assistant_common.go) — `lifeTraceAssistantToolName` 改成 `= prompts.AssistantToolName`（保留 lifetrace 侧 identifier 减少 ai_client.go / _test.go 变动）
- [`server/internal/lifetrace/ai/prompts/prompts_test.go`](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/ai/prompts/prompts_test.go) — 追加 3 个 fallback / normalize 断言

### 删除

无。原有函数被搬迁而非彻底删除。

---

## Tasks

> 每个 Task 独立执行 + `go build ./...` + `go test ./internal/lifetrace/...` + `go test ./internal/lifetrace/ai/prompts/...` 三重验证。任何一步 fail 必须回滚该 Task 再复盘，不批量粘贴。

### Task 1 · 新建 `prompts/today_advice.go`

- 复制 [today_advice_handler.go L138-L172 var 块](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/today_advice_handler.go)（adviceDefaults / adviceOrder / validAdviceTones）到新文件，改成 export：`TodayAdviceDefaults` / `TodayAdviceOrder` / `TodayAdviceValidTones`（这三个 var 仅 NormalizeTodayAdviceItems 使用，理论可 unexport；本刀 export 便于未来测试直接引）。
- 新增 `TodayAdviceItem` / `TodayAdviceOutput` type（字段与 lifeTraceAIAdvice / todayAdviceAIResponse 完全一致含 JSON tag）。
- 新增 `TodayAdvicePlanLine` / `TodayAdviceWeather` / `TodayAdviceInput` type。
- 新增 `TodayAdviceContract` var（Name/Version/AuditScene/BuildPrompt 四字段；MaxTokens 留 0 —— today handler 自己传超时，不通过 Contract.Generate 生成）。
- 新增 `BuildTodayAdvicePrompt(input TodayAdviceInput) string`：从原 [buildTodayAdvicePrompt](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/today_advice_handler.go#L174-L203) **1:1 复制字面量**，参数改成 Input 结构；fmt.Sprintf 的字段引用改成 input.City / input.Weather.Text / ...
- 新增 `ParseTodayAdviceOutput(raw string) (TodayAdviceOutput, error)`：从原 [parseTodayAdviceAIResponse](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/today_advice_handler.go#L205-L229) 1:1 复制；`trimRunes` 替换成 `TrimRunes`；`normalizeTodayAdviceItems` 替换成 `NormalizeTodayAdviceItems`。
- 新增 `NormalizeTodayAdviceItems(items []TodayAdviceItem) ([]TodayAdviceItem, error)`：从原 [normalizeTodayAdviceItems](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/today_advice_handler.go#L231-L266) 1:1 复制；`adviceDefaults` 用 `TodayAdviceDefaults`；`validAdviceTones` 用 `TodayAdviceValidTones`；`adviceOrder` 用 `TodayAdviceOrder`。
- import：`"strings"` / `"fmt"` / `"encoding/json"` / `"errors"` / `"valley-server/internal/lifetrace/ai"`
- 验证：`cd server && go build ./...` + `go test ./internal/lifetrace/ai/prompts/...`（新增文件此时还没被 lifetrace 主包引用，只做单元编译校验）。

### Task 2 · 改造 `today_advice_handler.go` 用 prompts

- 在 [handler 里 `GenerateTodayAdvice`](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/today_advice_handler.go) 里：
  - 组装 `prompts.TodayAdviceInput`：从 settings/weather/plans map 到 Input 字段。
  - `buildTodayAdvicePrompt(settings, weather, plans)` → `prompts.BuildTodayAdvicePrompt(input)`。
  - `parseTodayAdviceAIResponse(raw)` → `prompts.ParseTodayAdviceOutput(raw)`。
- 删除 [today_advice_handler.go](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/today_advice_handler.go) 内：
  - `adviceDefaults` / `adviceOrder` / `validAdviceTones` 三个 var（L138-L172）
  - `buildTodayAdvicePrompt` / `parseTodayAdviceAIResponse` / `normalizeTodayAdviceItems` 三个函数
- ai_handler.go：`lifeTraceAIAdvice` 与 `todayAdviceAIResponse` 改成 alias 到 prompts 包。
- import 增补：`prompts "valley-server/internal/lifetrace/ai/prompts"`；清理不再使用的 import（`errors` / `fmt` 大概率还留着）。
- 关键校验：
  - `ai_handler_test.go` 里 [L988-L1004 TestBuildTodayAdvicePromptAsksForSlimItems](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/ai_handler_test.go#L988-L1004) 用了 `buildTodayAdvicePrompt(settings, weather, plans)`。**保留一个 lifetrace 包内 shim**：`func buildTodayAdvicePrompt(s model.LifeTraceSettings, w WeatherResponse, p []model.LifeTracePlan) string { return prompts.BuildTodayAdvicePrompt(...) }`，避免测试改动。
  - `parseTodayAdviceAIResponse` 同样保留 shim。
  - `normalizeTodayAdviceItems` 只被 handler 内部用，不需要 shim。
- 验证：`go build ./... && go test ./internal/lifetrace/...`。**必须字面量一致**：跑 `TestBuildTodayAdvicePromptAsksForSlimItems`（断言 prompt 包含 `"必须严格包含 6 项"`）+ `TestParseTodayAdviceAIResponseAcceptsFullShape`（如果存在）。

### Task 3 · 新建 `prompts/weekly_review.go`

- 新增 const `WeeklyReviewMaxTokens = 520`。
- 新增 `WeeklyReviewPlanLine` / `WeeklyReviewTraceLine` / `WeeklyReviewInput` / `WeeklyReviewOutput` type（JSON tag 与原 `weeklyReviewAIResponse` 一致）。
- 新增 `WeeklyReviewContract`（Name/Version/AuditScene/MaxTokens/BuildPrompt）。
- 新增 `BuildWeeklyReviewPrompt(input WeeklyReviewInput) string`：从原 [buildWeeklyReviewPrompt](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/weekly_review_handler.go#L154-L195) 搬字面量；`buildWeeklyPlanLines` 逻辑内联进 Build 函数（原 helper 只被此处用）或作为 prompts 包 unexported 函数。
- 新增 `ParseWeeklyReviewOutput(raw string) (WeeklyReviewOutput, error)`：从原 [parseWeeklyReviewAIResponse](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/weekly_review_handler.go#L299-L321) 搬字面量；`normalizeWeeklyReviewList` 用 prompts 包内 unexported 版本。
- import：`"strings"` / `"fmt"` / `"encoding/json"` / `"errors"` / `"time"` / `"valley-server/internal/lifetrace/ai"`
- 验证：`go test ./internal/lifetrace/ai/prompts/...`。

### Task 4 · 改造 `weekly_review_handler.go` 用 prompts

- handler 里组装 `prompts.WeeklyReviewInput`（`completedPlans/openPlans` map 到 `WeeklyReviewPlanLine`；`traces` map 到 `WeeklyReviewTraceLine`）。
- `buildWeeklyReviewPrompt(...)` → `prompts.BuildWeeklyReviewPrompt(input)`。
- `parseWeeklyReviewAIResponse(raw)` → `prompts.ParseWeeklyReviewOutput(raw)`。
- `lifeTraceWeeklyReviewMaxTokens` 常量替换为 `prompts.WeeklyReviewMaxTokens` 或删掉直接用 prompts 常量。
- 删除函数：`buildWeeklyReviewPrompt` / `buildWeeklyPlanLines` / `parseWeeklyReviewAIResponse` / `normalizeWeeklyReviewList`。
- ai_handler.go：`weeklyReviewAIResponse` 改 alias。
- **不需要 shim**：查过 ai_handler_test.go 只有 L910 用了 `parseWeeklyReviewAIResponse(raw)`，但只是 `parsed, err := parseWeeklyReviewAIResponse(raw)`——保留 shim `func parseWeeklyReviewAIResponse(raw string) (weeklyReviewAIResponse, error) { return prompts.ParseWeeklyReviewOutput(raw) }`（`weeklyReviewAIResponse` 已是 alias）。
- import 清理。
- 验证：`go build ./... && go test ./internal/lifetrace/...`。

### Task 5 · 新建 `prompts/assistant.go` — SystemPrompt + ContextPrompt

- 新增 const `AssistantToolName = "submit_life_trace_response"`。
- 新增 `AssistantMessage` / `AssistantPlanLine` / `AssistantTraceLine` / `AssistantContextInput` type。
- 新增 `func AssistantSystemPrompt() string`：从 [lifeTraceAssistantSystemPrompt](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/assistant_handler.go#L129-L143) 1:1 搬字面量。
- 新增 `func BuildAssistantContextPrompt(input AssistantContextInput) string`：从 [buildLifeTraceAssistantPrompt](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/assistant_handler.go#L145-L218) 1:1 搬字面量；`trimRunes` → `TrimRunes`。
- import：`"strings"` / `"fmt"`
- 验证：`go test ./internal/lifetrace/ai/prompts/...`。

### Task 6 · 追加 `prompts/assistant.go` — StructuredContract + parse

- 新增 draft type（**注意：与 lifetrace 包内 `lifeTraceAssistantPlanDraft` 等分离，仅含 JSON 字段**）：
  - `AssistantPlanDraft`（8 字段，JSON tag 与 [ai_handler.go L61-L69](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/ai_handler.go#L61-L69) 完全一致，但**去掉 `RelativeSchedule bool `json:"-"``**——这是非 JSON 字段，不属 prompt output）。
  - `AssistantPantryDraft`（8 字段，与 [L71-L80](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/ai_handler.go#L71-L80) 一致）。
  - `AssistantLedgerDraft`（8 字段，与 [L82-L91](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/ai_handler.go#L82-L91) 一致）。
  - `AssistantStructuredAction` / `AssistantStructuredOutput`。
- 新增 `AssistantStructuredInput { Context AssistantContextInput; ToolName string; Now time.Time }`。
- 新增 `AssistantStructuredContract`（Name/Version/AuditScene/BuildPrompt；MaxTokens 留 0 —— 由 handler 控制超时）。
- 新增 `BuildAssistantStructuredPrompt(input AssistantStructuredInput) string`：从 [buildLifeTraceAssistantStructuredPrompt](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/assistant_handler.go#L220-L250) 1:1 搬字面量；`lifeTraceAssistantToolName` → `input.ToolName` 或 `AssistantToolName`；`buildLifeTraceAssistantPrompt(...)` → `BuildAssistantContextPrompt(input.Context)`。
- 新增 `ParseAssistantStructuredOutput(raw string) (AssistantStructuredOutput, error)`：从 [parseLifeTraceAssistantStructuredResponse](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/assistant_handler.go#L252-L287) 1:1 搬字面量；`trimRunes` → `TrimRunes`；`normalizeAssistantNeedMoreInfoFields` **注意**：这是 lifetrace 包内的 helper（在 [assistant_common.go](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/assistant_common.go)）——**在 prompts 包重新写一份 unexported `normalizeAssistantNeedMoreInfoFields`**（12 行代码，1:1 复制）。lifetrace 包内的原版继续存在，被 lifetrace 侧的其他 helper 用（例如 buildAssistantNeedMoreInfoPayload）。避免 prompts→lifetrace 反向依赖。
- import 增补：`"encoding/json"` / `"errors"` / `"time"`
- 验证：`go test ./internal/lifetrace/ai/prompts/...`。

### Task 7 · 改造 `assistant_handler.go` 用 prompts

- handler 内组装 `prompts.AssistantContextInput`（settings/weather/plans/traces/req 字段展开映射）。
- `lifeTraceAssistantSystemPrompt()` → `prompts.AssistantSystemPrompt()`。
- `buildLifeTraceAssistantPrompt(...)` → `prompts.BuildAssistantContextPrompt(input)`。
- `buildLifeTraceAssistantStructuredPrompt(...)` → `prompts.BuildAssistantStructuredPrompt(prompts.AssistantStructuredInput{Context: ctx, ToolName: lifeTraceAssistantToolName, Now: now})`。
- `parseLifeTraceAssistantStructuredResponse(raw)` → 需要类型转换：`out, err := prompts.ParseAssistantStructuredOutput(raw)` 然后 map 回 `lifeTraceAssistantStructuredResponse`。此处**在 lifetrace 侧保留 shim** `func parseLifeTraceAssistantStructuredResponse(raw string) (lifeTraceAssistantStructuredResponse, error)`，里面负责 `prompts.AssistantStructuredOutput` → `lifeTraceAssistantStructuredResponse` 的字段转换。因为：
  - `lifeTraceAssistantStructuredAction.Plan/Pantry/Ledger` 字段是 `*lifeTraceAssistantPlanDraft` 等 lifetrace 侧类型（含 `RelativeSchedule` 等 lifetrace 独有字段），不能直接 `type X = prompts.Y` alias。
  - `ai_handler_test.go` L1355 用 `parseLifeTraceAssistantStructuredResponse(raw)` 拿返回值断言，不改。
  - shim 内做手动 struct copy，8+8+8 字段（Plan / Pantry / Ledger），~30 行。清晰。
- 删除 4 个函数：`lifeTraceAssistantSystemPrompt` / `buildLifeTraceAssistantPrompt` / `buildLifeTraceAssistantStructuredPrompt`；`parseLifeTraceAssistantStructuredResponse` 改成 shim。
- ai_handler.go：`lifeTraceAssistantStructuredResponse` 与 `lifeTraceAssistantStructuredAction` **不做 alias**（因为 Plan/Pantry/Ledger 字段类型不同），保持原样。测试断言不受影响。
- assistant_common.go：`lifeTraceAssistantToolName` 改成 `= prompts.AssistantToolName`。
- 验证：
  - `go build ./...`
  - `go test ./internal/lifetrace/...`（关键：TestLifeTraceAssistantSystemPromptIsNotGenericChat / assistant structured parse tests）
  - 手动 grep 确认 `strings.Join(...)` 字面量在新旧文件字符级一致。

### Task 8 · prompts_test.go 追加断言

在 [prompts_test.go](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/ai/prompts/prompts_test.go) 追加 3 个测试：

```go
func TestTodayAdviceContractParseFallsBackOnEmptySummary(t *testing.T) {
    parsed, err := ParseTodayAdviceOutput(`{"summary":"","items":[{"id":"wear","detail":""}]}`)
    // 断言 summary fallback + items 补齐 6 项
}
func TestWeeklyReviewContractParseFillsFallbackList(t *testing.T) {
    parsed, err := ParseWeeklyReviewOutput(`{"summary":""}`)
    // 断言 wins/delays/insights/nextActions 都补 fallback
}
func TestAssistantStructuredContractParseRejectsUnsupportedAction(t *testing.T) {
    _, err := ParseAssistantStructuredOutput(`{"reply":"ok","action":{"type":"delete_all"}}`)
    // 断言返回 unsupported error
}
```

**不做**：不覆盖 ai_handler_test.go 已经覆盖的 case（避免重复）。

- 验证：`go test ./internal/lifetrace/ai/prompts/...`。

### Task 9 · 编码 + 收尾校验

- `cd server && go build ./...`
- `cd server && go test ./...`
- encoding-guard：
  ```bash
  python3 .agents/skills/encoding-guard/scripts/check_mojibake.py \
    server/internal/lifetrace/ai/prompts/today_advice.go \
    server/internal/lifetrace/ai/prompts/weekly_review.go \
    server/internal/lifetrace/ai/prompts/assistant.go \
    server/internal/lifetrace/today_advice_handler.go \
    server/internal/lifetrace/weekly_review_handler.go \
    server/internal/lifetrace/assistant_handler.go \
    server/internal/lifetrace/ai_handler.go
  ```
- diff stat 抽样：
  - `ai_handler.go` 只有 6 个 type 定义变 alias，行数几乎不变。
  - `today_advice_handler.go` 减 ~120 行。
  - `weekly_review_handler.go` 减 ~140 行。
  - `assistant_handler.go` 减 ~120 行（保留 shim 后）。
  - prompts 包新增 3 个文件总计 ~400 行。
- 抽样手动 diff 3 处，确认 prompt 字面量字符级一致：
  1. today_advice.go `"你是 Life Trace 的生活计划 AI"` 起 6 行 = 原 today_advice_handler.go L188-L193。
  2. weekly_review.go `"你是 Life Trace 的复盘 Agent"` 起 5 行 = 原 L174-L178。
  3. assistant.go structured prompt `"如果当前模型支持工具调用"` 起 15 行 = 原 L230-L245。

### Task 10 · Karpathy 自检

- **Surface assumptions**：本刀假设 3 个 domain 的 prompt 字面量、字段顺序、fallback 值、maxRunes 界限**必须严格 1:1**——通过手动 diff + 已有 _test.go 全绿双重保证。
- **Keep it simple**：不做多 provider 抽象、不做 prompt 版本化、不做 A/B、不重命名字段。仅"物理搬 + 加 Contract 壳"。
- **Surgical changes**：每个 Task 单独 build+test；shim 只在测试引用点保留（3 处），不做大范围签名变更。
- **Verifiable goals**：3 个 build*Prompt / 3 个 parse 全部有对应测试（原 _test.go + 新增 3 个 prompts_test.go 断言）。

---

## Verification

| 步骤 | 命令 | 预期 |
|---|---|---|
| 编译 | `cd server && go build ./...` | 零输出 |
| lifetrace 测试 | `cd server && go test ./internal/lifetrace/...` | 全绿（含 subpkg） |
| prompts 单包测试 | `cd server && go test ./internal/lifetrace/ai/prompts/` | 全绿，含 3 个新增断言 |
| 全量测试 | `cd server && go test ./...` | 全绿 |
| encoding-guard | 上面命令 | PASS |
| diff stat | `git diff --stat server/internal/lifetrace/` | 3 个 handler 减少，prompts 新增 |
| 字面量抽样 | 手动 diff 3 处 prompt 关键行 | 字符级一致 |

---

## Risks / Fallbacks

**风险 1：字面量搬错**（改一个字都会让原 _test.go fail）
- Mitigation：**每个 Build*Prompt 函数写完立即跑对应 _test.go**（Task 2/4/7 里覆盖）；Task 9 手动 diff 抽样。

**风险 2：Assistant Structured parse 的类型转换 shim 漏字段**
- Mitigation：Task 7 shim 里逐字段显式赋值（Plan 6 + Pantry 8 + Ledger 8 字段），不用反射；配合 `TestParseLifeTraceAssistantStructuredResponse*` 断言全绿。

**风险 3：Contract 泛型引起 lifetrace 包 import cycle**
- Mitigation：prompts 包**只** import `valley-server/internal/lifetrace/ai`（Contract 定义在此），不 import lifetrace 主包；lifetrace 主包正向 import prompts。已验证：现有 [inbox.go](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/ai/prompts/inbox.go) 已是这个依赖方向。

**Fallback**（任何 Task fail 且原因不明）：
- 该 Task 内改动完整 revert（git checkout），不影响下一 Task。
- 若 Task 7 assistant structured 转换特别复杂，可**先只搬 SystemPrompt + ContextPrompt**（Task 5 内容），Structured + parse 留独立 mini-plan——不阻塞第二刀主要收益。

---

## Non-Goals

- 不在本刀改任何 prompt 文案内容 / 字段 / 排序。
- 不在本刀切 OpenAI 到 aiclient（第三刀）。
- 不在本刀改 ai_handler_test.go 断言。
- 不在本刀下沉 closet/pantry/recipe/image 的 prompt。
- 不在本刀引入 prompt 版本化 / A/B / 多语言机制。

---

## Estimated Impact

- 修改文件：4（3 handler + assistant_common.go）+ ai_handler.go type alias。
- 新建文件：3（prompts 包）。
- 新建测试：3 断言（追加到 prompts_test.go）。
- 净删代码：~380 行（3 handler 内 prompt 字面量 + parse + normalize）。
- 净增代码：~450 行（prompts 包三段式 + Contract + Input types）。
- 净差：**约 +70 行**（Contract 壳 + Input struct + shim 的必要开销）。
- 语义收益：prompt 字面量与业务流控完全解耦，未来做多语言 / A/B / 版本化只需改 prompts 包；handler 更聚焦 HTTP+DB+流编排。

---

## 落地状态（Task 1-10）

| Task | 内容 | 状态 | 关键产物 |
|---|---|---|---|
| 1 | prompts/today_advice.go 三段式落地 | ✅ | TodayAdviceContract + Build/Parse/Normalize + Defaults/Order/ValidTones 迁出 |
| 2 | today_advice_handler.go 瘦身 | ✅ | 266→189 行；buildTodayAdvicePrompt/parseTodayAdviceAIResponse 保留 shim |
| 3 | prompts/weekly_review.go 三段式落地 | ✅ | WeeklyReviewContract + MaxTokens=520 常量迁出 |
| 4 | weekly_review_handler.go 瘦身 | ✅ | 新增 mapWeeklyReviewPlanLines/mapWeeklyReviewTraceLines helper；shim 保留 |
| 5+6 | prompts/assistant.go 三段式落地（合并） | ✅ | AssistantSystemPrompt/BuildContext/BuildStructured/ParseStructured 一次落地 |
| 7 | assistant_handler.go 瘦身 | ✅ | 4 shim（system/context/structured build + structured parse）；parse shim 内手动 22 字段 struct copy |
| 8 | prompts_test.go 追加 3 断言 | ✅ | TodayAdvice fallback / WeeklyReview fallback list / Assistant unsupported action |
| 9 | 收尾校验 | ✅ | `go build ./...` 零输出、`go test ./...` 全绿、encoding-guard PASS、字面量抽样字符级一致 |
| 10 | Karpathy 自检 | ✅ | 见下方 4 原则 |

### Karpathy 4 原则自检

- **Surface assumptions**：prompt 字面量、字段顺序、fallback 值、maxRunes 必须严格 1:1——通过 handler 层原 `ai_handler_test.go`（1700+ 行、含 `TestBuildTodayAdvicePromptAsksForSlimItems` / `TestBuildLifeTraceAssistantPromptKeepsLifeContext` / `TestParseLifeTraceAssistantStructuredResponseSupportsNeedMoreInfo` 等）零改动通过 + prompts_test.go 3 断言双重保证。
- **Keep it simple**：不做多 provider 抽象、prompt 版本化、A/B、字段重命名。只做"字面量搬迁 + Contract 壳 + Input struct + shim"。
- **Surgical changes**：每 Task 独立 build+test；shim 只在 3 处测试引用点保留，签名 100% 保持；Assistant Structured parse shim 内 22 字段手动赋值，不用反射。
- **Verifiable goals**：3 个 build\*Prompt / 3 个 parse 全部有测试覆盖；`go test ./...` 全绿；`git diff --stat` 显示 ai_handler.go 净减 3069 行（累计第一刀+第二刀）。

### 校验结果快照

```
go build ./...                                    # 零输出
go test ./...                                     # 全绿（含 lifetrace / lifetrace/ai / lifetrace/ai/prompts / lifetrace/agent）
python3 .agents/skills/encoding-guard/... x9     # PASS: no suspicious encoding or text-loss issues detected.
```

字面量 anchor 抽样确认（`grep`）：
- `"你是 Life Trace 的生活计划 AI"` 只在 `prompts/today_advice.go` + `ai/client.go`（原有 default system，非本刀）。
- `"你是 Life Trace 的复盘 Agent"` 只在 `prompts/weekly_review.go`。
- `"如果当前模型支持工具调用"` 只在 `prompts/assistant.go`。
- `"你是 Life Trace 的生活助理"` 只在 `prompts/assistant.go`。

3 个核心 handler 已完全去 prompt 字面量。
