# AI 应用公共 API P4 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让已发布 AI 应用通过显式绑定的 API Key 对外提供 JSON/SSE 调用，并以每日 100 次配额和无正文元数据观测保护 owner。

**Architecture:** 在 `AIAPIKey` 之外新增绑定、每日计数和公共调用元数据模型。公共路由在验证 Bearer Key、Key-应用绑定和发布版本后，原子消耗当日配额，再复用现有 ARK/Agent 执行边界；外部调用绝不创建带输入输出的 `AIAppRun`。工作台继续走 JWT 管理 Key 绑定和观测数据。

**Tech Stack:** Go 1.25、Gin、GORM、PostgreSQL、ARK Runtime SDK、React、TypeScript、现有 SSE writer。

---

### Task 1: 公共调用数据模型与配额事务

**Files:**
- Modify: `server/internal/model/ai_platform.go`
- Modify: `server/internal/database/*` 中的 AI 平台迁移入口
- Create: `server/migrations/*ai_app_public_api*.sql`
- Test: `server/internal/handler/ai_platform_test.go`

- [ ] **Step 1: 写失败测试**

测试同一个 Key 可绑定多个 owner 自己的应用，不能绑定其他 owner 的应用；测试同一 Key 当天第 100 次配额消费成功，第 101 次返回配额耗尽；测试调用元数据不含 input、output、tool result 字段。

- [ ] **Step 2: 运行 RED**

Run: `cd server && go test ./internal/handler -run 'TestAIAPIKeyBinding|TestAIAPIKeyDailyUsage' -count=1`

Expected: FAIL，因为绑定、每日计数和元数据模型尚不存在。

- [ ] **Step 3: 实现最小模型与事务 helper**

新增 `AIAPIKeyAppBinding`、`AIAPIKeyDailyUsage`、`AIAppPublicInvocation`。为每日用量建立 `(api_key_id, usage_date)` 唯一索引，并在事务内以 `request_count < 100` 的条件更新；只有成功预留次数时才执行模型调用。调用元数据仅包含 owner、app、version、key、status、duration、stream、error code 和 created time。

- [ ] **Step 4: 运行 GREEN**

Run: `cd server && go test ./internal/handler -run 'TestAIAPIKeyBinding|TestAIAPIKeyDailyUsage' -count=1`

Expected: PASS.

### Task 2: Bearer Key 公共 JSON/SSE 调用

**Files:**
- Create: `server/internal/handler/ai_app_public.go`
- Modify: `server/internal/handler/ai_platform.go`
- Modify: `server/internal/router/router.go`
- Test: `server/internal/handler/ai_platform_test.go`

- [ ] **Step 1: 写失败的路由测试**

覆盖 `POST /api/v1/public/ai/apps/:appId/chat`：无效或撤销 Key 返回 `401`，未绑定或未发布应用返回 `403`，空消息返回 `400`，配额耗尽返回 `429`。对合法绑定的已发布智能体，非流式响应返回 `reply`、`model`、`versionId`、`requestId` 和 `remaining`；`stream:true` 返回 SSE `meta/delta/done`，并且 `done` 不含正文或工具原始结果。

- [ ] **Step 2: 运行 RED**

Run: `cd server && go test ./internal/handler -run TestPublicAIAppChat -count=1`

Expected: FAIL，因为公共路由与 handler 尚不存在。

- [ ] **Step 3: 实现授权和发布版本执行器**

从 `Authorization: Bearer` 提取 Key，复用 `VerifyAIAPIKey` 验证摘要和状态，校验 Key-应用绑定与 `published_version_id`。公共调用只加载发布版本，RAG 与工具调用使用应用 owner 作为上下文。复用 ARK 配置、错误码和 SSE writer；`stream:false` 返回 JSON，`stream:true` 逐段发 `delta`。在成功、上游失败和取消时只写公共元数据记录。

- [ ] **Step 4: 运行 GREEN**

Run: `cd server && go test ./internal/handler -run TestPublicAIAppChat -count=1`

Expected: PASS.

### Task 3: Key 绑定、用量和观测管理接口

**Files:**
- Modify: `server/internal/handler/ai_platform.go`
- Modify: `server/internal/router/router.go`
- Test: `server/internal/handler/ai_platform_test.go`

- [ ] **Step 1: 写失败测试**

测试 owner 可替换某 Key 的应用绑定，只能选择自己的已发布应用；测试读取 Key 今日 `used/limit/remaining`；测试观测列表按应用、Key 和日期读取，且响应结构没有请求或回复字段。

- [ ] **Step 2: 运行 RED**

Run: `cd server && go test ./internal/handler -run 'TestReplaceAIAPIKeyBindings|TestListAIAPIUsage' -count=1`

Expected: FAIL，因为管理接口尚不存在。

- [ ] **Step 3: 实现 JWT owner 管理接口**

增加 Key 绑定读取/替换、今日用量读取和公共调用元数据列表接口。替换绑定必须在事务内验证 Key owner 与所有目标应用 owner/published 状态；观测 DTO 只序列化 spec 指定的元数据字段。

- [ ] **Step 4: 运行 GREEN**

Run: `cd server && go test ./internal/handler -run 'TestReplaceAIAPIKeyBindings|TestListAIAPIUsage' -count=1`

Expected: PASS.

### Task 4: 工作台 API 访问与观测界面

**Files:**
- Modify: `apps/web/src/api/aiWorkbench.ts`
- Modify: `apps/web/src/pages/AIAppEditor/index.tsx`
- Test: `apps/web` TypeScript build

- [ ] **Step 1: 声明管理 DTO 与请求函数**

添加 Key、绑定、今日用量和公共调用元数据的 TypeScript 类型；封装读取与替换绑定、读取用量和观测列表的 API 函数。

- [ ] **Step 2: 实现编辑页 API 访问区域**

复用现有 Card、Checkbox、Button 和运行记录样式，展示 Key 对当前已发布应用的绑定、`已用 / 100`、剩余次数及最近元数据。只显示 Key 名称/前缀、时间、状态、耗时和流式标记；加载、空态和失败沿用现有页面模式。

- [ ] **Step 3: 运行类型检查**

Run: `pnpm --filter @valley/web exec tsc --noEmit`

Expected: PASS.

### Task 5: 回归、文档和真实验收

**Files:**
- Modify: `docs/superpowers/plans/2026-07-14-ai-workbench-platform.md`
- Modify: `docs/superpowers/specs/2026-07-14-ai-app-public-api-design.md`（仅实现与设计不一致时）

- [ ] **Step 1: 运行完整回归**

Run: `cd server && go test ./... && cd .. && pnpm --filter @valley/web exec tsc --noEmit && pnpm check:harness`

Expected: Go 与 TypeScript 通过；Harness 若受 WSL 环境阻塞，记录环境错误而不误报为代码失败。

- [ ] **Step 2: 真实验收**

创建 Key 并只绑定一个已发布应用；用 curl 分别验证 JSON 与 SSE；重复调用至第 101 次验证 `429`；撤销或解绑后验证 `401/403`；确认工作台观测没有请求和回复正文。

- [ ] **Step 3: 同步阶段状态**

只有所有自动和真实验收通过后，将主计划 P4 标为完成；否则保持进行中并记录未验证项。
