# AI Agent Content Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a workbench agent privately call an owner-scoped, read-only `content.search` tool during draft debugging.

**Architecture:** A new `tools/content` package receives the owner ID through `context.Context`, queries only that owner's posts and resources, and returns at most five safe result summaries. The workbench handler reads `ai_app_tool_bindings`, passes the allowed tools into `agent.LocalLoop`, and maps tool-loop events to its existing SSE and run-summary contracts through an ARK-specific `agent.Backend` adapter.

**Tech Stack:** Go 1.25, Gin, GORM, ARK Runtime SDK, existing `server/internal/ai/agent` and `server/internal/ai/tools`.

---

### Task 1: Owner-scoped content search tool

**Files:**
- Create: `server/internal/ai/tools/content/search.go`
- Create: `server/internal/ai/tools/content/search_test.go`

- [ ] **Step 1: Write failing tool tests for allowed fields and owner isolation**

Create SQLite-backed posts and resources for owners `101` and `202`. Build a context using `WithOwner(context.Background(), 101)`, execute `SearchTool.Run` with `{"query":"设计"}`, and assert the JSON result contains only owner `101` records, has at most five items, and each item contains only `type`, `id`, `title`, `excerpt`, and `href`.

```go
raw, err := tool.Run(content.WithOwner(context.Background(), 101), json.RawMessage(`{"query":"设计"}`))
if err != nil { t.Fatal(err) }
if strings.Contains(string(raw), "other-owner-title") { t.Fatal("foreign content leaked") }
if !strings.Contains(string(raw), `"href":"/blog/`) { t.Fatal("missing blog link") }
```

- [ ] **Step 2: Run the tool test and confirm RED**

Run: `cd server && go test ./internal/ai/tools/content -run TestSearchTool -count=1`

Expected: FAIL because package `tools/content` does not exist.

- [ ] **Step 3: Implement the minimal tool and context boundary**

Define `WithOwner(ctx, userID)` and an unexported `ownerFromContext`. `SearchTool` must implement `tools.Tool` with name `content.search`, scope `workbench`, and schema requiring a string `query` with `minLength: 1` and `maxLength: 120`. Trim input, reject empty input, query `model.Post` with `author_id = ownerID` and `title OR excerpt LIKE %query%`, query `model.Resource` with `user_id = ownerID` and `title OR description LIKE %query%`, then return a combined, capped JSON list. Construct links as `/blog/<id>` and `/resource/<id>`.

```go
return json.Marshal(map[string]any{
  "ok": true,
  "query": query,
  "items": items[:min(len(items), 5)],
})
```

- [ ] **Step 4: Register the singleton only in the workbench bootstrap path**

Expose `content.NewSearchTool(db *gorm.DB)` and register it against a registry supplied by the caller; do not use package `init`, so tests and future workbench wiring control registration explicitly.

- [ ] **Step 5: Run the focused test and confirm GREEN**

Run: `cd server && go test ./internal/ai/tools/content -run TestSearchTool -count=1`

Expected: PASS.

### Task 2: ARK adapter and allowed-tool resolution

**Files:**
- Create: `server/internal/handler/ai_app_agent_backend.go`
- Create: `server/internal/handler/ai_app_agent_backend_test.go`
- Modify: `server/internal/handler/ai_platform.go`
- Modify: `server/internal/handler/ai_platform_test.go`

- [ ] **Step 1: Write failing backend conversion tests**

Use a fake `agent.Backend` seam or an extracted converter to assert an assistant ARK response with a function call becomes `agent.Message{Role: agent.RoleAssistant, ToolCalls: ...}`, and a tool message keeps `ToolCallID` when mapped back to ARK. Test an unknown application binding returns no descriptor rather than a callable tool.

- [ ] **Step 2: Run backend tests and confirm RED**

Run: `cd server && go test ./internal/handler -run 'TestAIAppAgentBackend|TestResolveAIAppTools' -count=1`

Expected: FAIL because the workbench backend and resolver do not exist.

- [ ] **Step 3: Implement the ARK-only `agent.Backend` adapter**

Use `aiclient.ReadARKTextConfig`, `aiclient.ARKClient(60*time.Second)`, `aiclient.NewARKChatRequestWithTools`, and `arkmodel.ToolChoiceStringTypeAuto`. Convert neutral messages/descriptors bidirectionally using the same tool-call fields as `lifetrace/agent_backend.go`. Return typed errors for ARK configuration, upstream errors, empty choices, and unsupported tool calling; do not add a new environment variable or an OpenAI fallback.

- [ ] **Step 4: Resolve bindings into a per-request registry**

In `ai_platform.go`, query `AIAppToolBinding` by `app_id`; accept only `content.search`; construct `content.NewSearchTool(database.GetDB())` in a new request-local registry; filter it with the binding names; and never read tools from a client payload during debug execution.

- [ ] **Step 5: Run backend and resolver tests and confirm GREEN**

Run: `cd server && go test ./internal/handler -run 'TestAIAppAgentBackend|TestResolveAIAppTools' -count=1`

Expected: PASS.

### Task 3: Debug runtime, SSE, and safe run summaries

**Files:**
- Modify: `server/internal/handler/ai_platform.go`
- Modify: `server/internal/handler/ai_platform_test.go`

- [ ] **Step 1: Write failing handler tests for binding and event behavior**

Seed an agent app, a draft version, and an `AIAppToolBinding{ToolName: "content.search"}`. Stub the ARK backend so the first response calls `content.search` and the second response replies. Assert the SSE body contains `tool_call`, `tool_result`, and `done`; assert the persisted `AIAppRun` does not contain a raw post/resource title from the tool result. Repeat without the binding and assert no tool descriptor reaches the backend.

- [ ] **Step 2: Run debug handler tests and confirm RED**

Run: `cd server && go test ./internal/handler -run 'TestDebugAIApp.*Tool' -count=1`

Expected: FAIL because `DebugAIApp` currently calls ARK directly and does not emit tool events.

- [ ] **Step 3: Route only bound-tool drafts through `agent.LocalLoop`**

Keep the existing direct chat path when no bindings are present. When bindings exist, create `agent.NewLocalLoop(aiAppAgentBackend, requestRegistry)`, attach the owner with `content.WithOwner`, set `Spec{Provider:"ark", Model: config.Model, Tools: boundNames, MaxSteps:6, MaxTokens:1200, Feature:"ai-workbench"}`, and consume `EventDelta`, `EventToolCall`, `EventToolResult`, `EventDone`, and `EventError`.

- [ ] **Step 4: Emit and persist summaries without raw results**

For streaming debug, send SSE objects with `type:"tool_call"` and `type:"tool_result"`; tool-result payload includes only the tool name, success flag, result item count, and error code. For non-streaming debug, keep the existing reply/run envelope and add a `toolTrace` summary array with the same safe fields. Persist only serialized summaries in `AIAppRun.References` or a dedicated existing-safe summary field; never persist raw tool JSON.

- [ ] **Step 5: Map agent failures explicitly**

Map missing ARK config to `503`, ARK tool unsupported/upstream failures to `502`, and `agent.ErrMaxStepsExceeded` to `502` with `AI_AGENT_MAX_STEPS_EXCEEDED`. Persist the matching error code before sending the response or SSE error event.

- [ ] **Step 6: Run handler tests and confirm GREEN**

Run: `cd server && go test ./internal/handler -run 'TestDebugAIApp.*Tool' -count=1`

Expected: PASS.

### Task 4: Documentation and regression verification

**Files:**
- Modify: `docs/superpowers/plans/2026-07-14-ai-workbench-platform.md`
- Modify: `docs/superpowers/specs/2026-07-14-ai-agent-content-search-design.md`

- [ ] **Step 1: Synchronize P3 status**

Mark P3 as partially complete, name `content.search` as the only released tool, and state that write tools, public invocation, quota, and full observability remain out of scope.

- [ ] **Step 2: Run service and harness checks**

Run: `cd server && go test ./... && cd .. && pnpm check:harness`

Expected: PASS.

- [ ] **Step 3: Run manual ARK acceptance**

At `/workbench/apps/:appId`, bind `content.search`, ask for an owner-created post or resource, and verify a tool trace is shown without raw result content. Repeat after removing the binding and verify no tool call occurs. Query a title belonging only to another owner and verify it is never returned.
