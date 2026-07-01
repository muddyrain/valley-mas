# Phase 2 收尾 — aiclient 迁移最后两步

> **状态：已落地**。Task 7 Step 6 + Task 8 均已完成；`internal/aiclient` 后续被第三刀（[phase3.md](file:///Users/bytedance/Desktop/study/valley-mas/.trae/documents/lifetrace-ai-handler-split-phase3.md)）继续扩容出 OpenAI 完整类型 + tool_calls + SSE 写入器。
>
> 接续 [server-aiclient-phase2.md](file:///Users/bytedance/Desktop/study/valley-mas/.trae/documents/server-aiclient-phase2.md)。原 plan 描述完整 8-Task 设计与上下文，本文件只列**仍需执行**的两段：Task 7 Step 6 测试验证 + Task 8 文档同步与最终校验。所有代码改动已落地，剩余只跑命令、改 1 个文档、做 grep 比对。

---

## Resume Context（已核实）

| 项 | 状态 | 证据 |
|---|---|---|
| aiclient 包 13 文件 | ✅ | doc/ark/openai/gemini/stream/jsonparse/textutil/usage + 5 个 `_test.go` 都在位 |
| Task 5：admin_ai_chat | ✅ | 切到 aiclient，handler 包级 `arkChatRequest` 1 行 shim 兼容 [ai_agent.go#L625](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/handler/ai_agent.go#L625) |
| Task 6：blog_ai shim | ✅ | [blog_ai.go#L139-L147](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/handler/blog_ai.go#L139-L147) `readArkTextModelConfig`/`ensureSharedArkClient` 转 shim |
| Task 7 Step 1-3：client.go | ✅ | [client.go#L50-L54](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/ai/client.go#L50-L54) `EnsureARKClient`/`ResetARKClientForTest`、[client.go#L368-L370](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/ai/client.go#L368-L370) `extractARKContent`、[client.go#L469-L475](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/ai/client.go#L469-L475) `NormalizeImageInput`/`recordUsage`/`trimRunes` 全部转 1 行 shim；包级 `arkClientOnce`/`arkClient` 已删；`sync` import 已删 |
| Task 7 Step 4：contract.go | ✅ | [contract.go#L56](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/ai/contract.go#L56) `extractJSONObject` 转 1 行 shim |
| Task 7 Step 5：config.go | ✅ | [config.go](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/ai/config.go) 全部 ReadXxxConfig 转调 aiclient；dead helper（`firstEnv`/`parseTimeoutSeconds`/`parseOpenAITimeout`/`imageModelCandidates`）已删；4 个错误文案 1:1 保持 |
| `go build ./...` | ✅ | 刚刚 Phase 1 重新跑过，零输出（无未使用 import、无引用 dead helper） |
| ARK_* 直读残留 | ✅ 已清零 | `rg 'os.Getenv\("ARK_' server/internal` 0 命中 |
| `arkruntime.NewClientWithApiKey` 残留 | ✅ 5 处（与计划一致） | aiclient/ark.go:51 + handler/{resource_tag.go:427, resource_tag_ai_description.go:59, creator_ai_title.go:64, creator_ai_tags.go:119} |

**handler 包级 `arkClient`/`arkClientOnce`** 仍声明在 [resource_tag.go#L28-L31](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/handler/resource_tag.go#L28-L31)，被 3 个未迁 handler 共享，本 Phase 不动（已写入原 plan "Assumptions & Decisions"）。

---

## 剩余执行步骤

### 1. Task 7 Step 6：lifetrace 测试 + 整体回归

- [ ] **1.1** `cd server && go build ./...`
   - 期待：零输出。
- [ ] **1.2** `cd server && go test ./internal/lifetrace/...`
   - 重点 `./internal/lifetrace/ai/...` 8+1 个测试用例必须全绿，**不动任何断言**：
     - `TestReadTextConfigRequiresARKTextModel`
     - `TestReadImageConfigFallsBackToTextModel`
     - `TestReadPantryPhotoConfigPrefersGemini`
     - `TestReadPantryPhotoConfigFallsBackToARKImageConfig`
     - `TestReadPantryPhotoConfigCanForceARKProvider`
     - `TestReadPantryPhotoConfigForcedGeminiRequiresKey`
     - `TestReadTextConfigPrefersLifeTraceAIEnv`
     - `TestReadTextConfigKeepsLegacyOpenAIEnvFallback`
     - `TestPromptContractParseNormalizesOutput`
- [ ] **1.3** `cd server && go test ./...`
   - 期待：整体回归全绿。如出现任何断言挂掉，先比对错误文案/返回结构是否与原 lifetrace 1:1，否则修补 aiclient 适配层（不能动测试断言）。
- [ ] **1.4** 完成则 `TaskUpdate` Task 7 → completed。

### 2. Task 8：[server/AGENTS.md](file:///Users/bytedance/Desktop/study/valley-mas/server/AGENTS.md) 文档同步

> 改动范围：在"路由与代码入口"段加 `internal/aiclient` 入口；"开发规范"AI 段加禁止直读 `ARK_*` env / 禁止直接 `arkruntime.NewClientWithApiKey`。措辞要简洁，不堆栈。

- [ ] **2.1** 编辑 [server/AGENTS.md](file:///Users/bytedance/Desktop/study/valley-mas/server/AGENTS.md)：
  - "路由与代码入口"段（约 [L11-L26](file:///Users/bytedance/Desktop/study/valley-mas/server/AGENTS.md#L11-L26)）在"AI 能力：`internal/ai`"上方插入：
    `- 通用 AI 客户端：`internal/aiclient`（封装 ARK / OpenAI / Gemini client、SSE writer、JSON / 文本工具）。`
  - "开发规范"段（约 [L33](file:///Users/bytedance/Desktop/study/valley-mas/server/AGENTS.md#L33)）在 ai-capability-orchestration 那条之后追加：
    `- 新增 AI 接入应优先复用 `internal/aiclient`；不在 handler 里直接 `os.Getenv("ARK_*")` 或 `arkruntime.NewClientWithApiKey(...)`。`

- [ ] **2.2** encoding-guard（CJK 检查）：
  ```bash
  python3 .agents/skills/encoding-guard/scripts/check_mojibake.py \
      server/AGENTS.md \
      server/internal/aiclient/doc.go
  ```
  期待：无 mojibake 报错。

- [ ] **2.3** `cd server && go build ./...`（防御性回归）。

- [ ] **2.4** `cd server && go test ./...`（最终回归全绿）。

- [ ] **2.5** grep 校验数字（写入收尾汇报）：
  ```bash
  rg 'os.Getenv\("ARK_' server/internal
  rg 'arkruntime.NewClientWithApiKey' server/internal
  ```
  - 第 1 行期待：**0 命中**（aiclient/ark.go 内部读 env 用的是 `os.Getenv("ARK_API_KEY")` 等，但放在 aiclient 内是允许的，不算 handler 直读）。**实际验证已 0 命中**。
  - 第 2 行期待：**5 命中**（aiclient/ark.go + 4 个未迁 handler）。

- [ ] **2.6** 完成则 `TaskUpdate` Task 8 → completed，并按 `delivery-reporting` 给最终汇报。

---

## Verification（与原 plan 一致，不再展开）

- 自动校验：`go build ./...` + `go test ./...` 全绿；encoding-guard 通过；grep 数字命中。
- 手动冒烟（owner 触发，AI 不跑）：admin AI 聊天、blog ask、life-trace today advice 三处。
- 风险路径已在原 plan 列出，本次执行不引入新风险。

---

## Out of Scope（保留给下一份计划）

- creator_ai_title / creator_ai_tags / resource_tag / resource_tag_ai_description 仍直连 ARK；
- ai_agent.go / blog_reader_ai.go / lifetrace/ai_handler.go 的 SSE 仍手写；
- lifetrace/ai_handler.go 3156 行未拆分；
- mindarena 改名（属于 Phase 2 同批的"另一项"，本份 plan 不动，留给独立 plan 触发）。

---

## Skills used

- `ai-capability-orchestration`（强制：所有 ARK 接入相关改动）
- `task-completion-guard`（计划文档驱动 + 多轮实施）
- `encoding-guard`（含 CJK 文档与注释，Task 8 强制跑）
- `delivery-reporting`（最终汇报）
- `karpathy-coder`（B 档收尾自检——本份只跑测试 + 改 1 个文档，不写新逻辑，自检结论为"无新增复杂度"）
- `skill-usage-disclosure`（按规则披露）

---

## 计划文档同步

- [server/AGENTS.md](file:///Users/bytedance/Desktop/study/valley-mas/server/AGENTS.md) 在 Task 8 内同步。
- 不影响 [apps/life-trace/docs/PLAN.md](file:///Users/bytedance/Desktop/study/valley-mas/apps/life-trace/docs/PLAN.md) 等产品计划（纯后端基础设施，不改产品功能/接口/数据模型）。
- 本 resume plan 与原 [server-aiclient-phase2.md](file:///Users/bytedance/Desktop/study/valley-mas/.trae/documents/server-aiclient-phase2.md) 共存：原文件用于完整设计审计，resume 文件用于本次接续执行打卡。任务关闭后由 owner 决定是否清理 `.trae/documents/server-aiclient-phase2*.md` 这两份临时产物。
