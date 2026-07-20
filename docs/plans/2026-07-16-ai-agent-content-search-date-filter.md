# AI Agent Content Search Date Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `content.search` reliably retrieve an owner's blogs by creation-date range when an AI workbench user asks a temporal question.

**Architecture:** The content tool validates normalized ISO date fields and builds an owner-scoped `created_at` range in China Standard Time. A small shared system-context helper adds the current CST date only to tool-enabled agent runs, so both draft debugging and private conversations provide the model enough context to construct those fields.

**Tech Stack:** Go, Gin, GORM, ARK Runtime SDK, existing local Agent runtime and SQLite-backed handler tests.

> 状态：已交付；自动化回归与真实浏览器日期检索均已确认，真实 ARK 的其他会话场景仍随 P8 验收推进。

---

### Task 1: Add the tool contract and date-query regression tests

**Files:**
- Modify: `server/internal/ai/tools/content/search_test.go`
- Modify: `server/internal/ai/tools/content/search.go`

- [x] **Step 1: Write the failing date-only query test**

Seed owner `101` posts created on `2026-07-01`, `2026-07-31`, and `2026-08-01`, plus an owner resource. Run the real tool with no keyword and this range:

```go
raw, err := tool.Run(ctx, json.RawMessage(`{"createdFrom":"2026-07-01","createdTo":"2026-07-31"}`))
if err != nil { t.Fatal(err) }
// Assert that exactly the two July blog IDs are returned.
```

- [ ] **Step 2: Run RED**

Run: `cd server && go test ./internal/ai/tools/content -run TestSearchToolFiltersBlogsByCreatedDateRange -count=1`

Expected: FAIL because the existing tool requires `query`.

- [x] **Step 3: Implement only the validated date contract**

Add optional `createdFrom` and `createdTo` fields to `searchArgs` and its JSON schema. Parse dates using `time.ParseInLocation("2006-01-02", value, time.FixedZone("CST", 8*60*60))`; reject empty complete input, invalid dates, and reversed bounds. When either date is present, query only owner posts with the inclusive/exclusive `created_at` predicates and optional keyword predicates.

- [x] **Step 4: Run GREEN and existing tool regressions**

Run: `cd server && go test ./internal/ai/tools/content -run TestSearchTool -count=1`

Expected: PASS.

### Task 2: Give tool-enabled agents the date needed to normalize natural language

**Files:**
- Modify: `server/internal/handler/ai_platform.go`
- Modify: `server/internal/handler/ai_app_conversations.go`
- Modify: `server/internal/handler/ai_platform_test.go`

- [x] **Step 1: Add fake ARK request-capture regression coverage**

Use the existing fake ARK SSE server to decode the first request. `TestAIAppContentSearchDateContextReachesARKOnlyWhenBound` asserts that its system message contains the current CST date instruction and `YYYY-MM-DD` when `content.search` is bound for both debug and private-conversation routes; an unbound debug request must retain its original system prompt.

- [x] **Step 2: Run RED for the pure helper**

The actual RED command covered the pure helper before it existed:

`cd server && go test ./internal/handler -run TestAppendContentSearchDateContext -count=1`

It failed before `appendContentSearchDateContext` was implemented. The fake ARK request capture is a post-integration regression test, not a retroactively claimed integration RED run.

- [x] **Step 3: Add one shared system-context helper**

Create a helper in the existing handler package that accepts the current system prompt and bound tool names. It must append the CST date and ISO-range instruction only when `content.search` is bound, then use it in both `DebugAIApp` and `ChatWithAIAppConversation` before creating `agent.Spec`.

- [x] **Step 4: Run GREEN and request-capture regression**

Run:

`cd server && go test ./internal/handler -run TestAIAppContentSearchDateContextReachesARKOnlyWhenBound -count=1`

Expected: PASS.

已通过。该回归实际捕获了绑定 `content.search` 的私有会话和调试请求，并验证两者 ARK system message 含当前中国标准时间及 `YYYY-MM-DD`；未绑定调试请求保持原始 prompt。`cd server && go test ./internal/handler -count=1` 也已通过。

### Task 3: Synchronize platform documentation and run focused verification

**Files:**
- Modify: `docs/specs/2026-07-14-ai-agent-content-search-design.md`
- Modify: `docs/plans/2026-07-14-ai-workbench-platform.md`
- Modify: `docs/specs/2026-07-16-ai-agent-content-search-date-filter-design.md`
- Modify: `docs/plans/2026-07-16-ai-agent-content-search-date-filter.md`

- [x] **Step 1: Mark completed implementation tasks truthfully**

Update the existing content-search design and P8 plan to state that `content.search` supports keyword and blog creation-date filtering, and mark only verified checklist items complete in this plan.

- [x] **Step 2: Run targeted and service checks**

Run:

```powershell
cd server
go test ./internal/ai/tools/content -count=1
go test ./internal/handler -run 'TestAIApp.*(DateContext|Tool)' -count=1
go test ./...
```

Expected: PASS.

- [x] **Step 3: Run encoding and harness checks**

Run:

```powershell
python .agents/skills/encoding-guard/scripts/check_mojibake.py <changed Go and Markdown files>
pnpm check:harness
```

编码检查已通过。Harness 仍受本机环境阻塞：

`pnpm check:harness` 以 exit 1 失败：其 WSL Bash 包装器在挂载 `ext4.vhdx` 时由 HCS 返回 `ERROR_PATH_NOT_FOUND`。本机 Git Bash 直接运行也未能形成可用替代：`python3` 指向 Windows Store 占位程序；显式映射已安装 Python 后，Harness 进一步发现 Git 的四个兼容符号链接在此 Windows checkout 被检出为普通文件。因此 Harness 未通过，属于环境阻塞，不能写作通过。

`python .agents/skills/encoding-guard/scripts/check_mojibake.py <changed Go and Markdown files>` 已通过；上述 Harness 环境阻塞已如实记录。后续已在真实浏览器确认“查询七月份写过什么博客”能返回该 owner 的日期范围结果；真实 ARK 的其他会话场景仍由 P8 验收项跟踪。
