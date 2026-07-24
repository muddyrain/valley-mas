> [!HISTORICAL] 该计划已迁移为历史参考，不作为当前可执行计划

# Server AI 基础整合：mindarena 包改名 + 通用 aiclient 包

> **For agentic workers:** REQUIRED SUB-SKILL：使用 `executing-plans` 或 `subagent-driven-development` 按 task 顺序推进。每个 step 都用 `- [ ]`，落地一项勾一项。
>
> **范围只覆盖前两步**：让 `internal/ai` 不再是 mindarena 专属，并把散落在 6+ 处的 ARK / OpenAI / Gemini 接入收敛到一个通用包。**不动**任何 handler 的业务逻辑，**不拆**任何巨型 handler 文件。后续 handler 迁移走另一份计划。

---

## Goal

让"再加一个 AI 功能"从"复制 60~100 行样板"变成"调一个统一入口"。验收标准：

1. `internal/ai` 这个名字不再存在，原内容全部归到 `internal/mindarena/ai`，循环依赖（`internal/ai` ↔ `internal/mindarena`）消失。
2. 新增 `internal/aiclient` 包，集中：
   - ARK / OpenAI 兼容 / Gemini 三个 provider 的 client 单例与配置读取；
   - 通用 SSE 流式 helper；
   - JSON 修剪（去 ```json fence、抓 `{...}`）、文本截断、normalize 工具；
   - `aiusage` 调用的薄封装（feature 名集中成常量）。
3. 至少一个旧 handler（建议 `handler/admin_ai_chat.go`）切到新的 aiclient，作为参考实现，证明新接口可用。
4. `cd server && go test ./...` 全绿。
5. 旧 handler **不强制**全部迁完；保留兼容 shim（旧函数名 → 转调 aiclient）让旧代码先放着，由后续计划继续迁。

---

## 非目标（明确不做）

- 不重构 `lifetrace/ai_handler.go` 的 3000 行；
- 不拆 `lifetrace/image_ai_handler.go` / `handler/blog_ai.go` / `handler/resource_tag.go`；
- 不动 `lifetrace/ai/PromptContract` 的形状（已经是好抽象）；
- 不改变任何对外接口路径、请求体、响应体；
- 不引入新依赖；
- 不动前端代码。

---

## Architecture

迁移后的依赖图：

```
internal/aiclient                ← 新建：纯基础，不依赖业务包
   ├── ark.go / openai.go / gemini.go   provider client + 配置读取
   ├── stream.go                        通用 SSE flusher 包装
   ├── jsonparse.go / textutil.go       工具
   └── usage.go                         aiusage 包装 + Feature 常量

internal/mindarena               ← 业务保留
   └── ai/                       ← 由原 internal/ai 重命名搬入
        service / openai_compatible / mock / fallback / personas / judge / ...

internal/lifetrace/ai            ← 保持，但 client.go 内部改为调用 aiclient
   ├── client.go                 改为薄壳：转调 aiclient，保留 PromptContract 等业务工具
   ├── config.go                 保留 lifetrace 专属环境变量入口
   └── prompts/                  不动

internal/handler                 ← 保持，但 ARK 直接接入逐步换成 aiclient
   ├── admin_ai_chat.go          作为试点最先迁
   └── 其他 ai_*.go              暂保持，旧函数名转调 aiclient（compat shim）
```

**关键原则**：`internal/aiclient` 不能 import 任何业务包（mindarena / lifetrace / handler / model），保持向上单向依赖。

---

## Phase 1 — `internal/ai` → `internal/mindarena/ai` 改名

> 纯搬运 + 改 import。**没有逻辑变更**。先做这一步是因为它最安全，且做完之后 "ai" 这个名字就只剩一个候选位置，不会和 Phase 2 的 `aiclient` 在心智上打架。

### Task 1.1：物理搬运 `internal/ai` 到 `internal/mindarena/ai`

**Files:**
- Move: `server/internal/ai/*.go` → `server/internal/mindarena/ai/*.go`（共 13 个文件，含 test）
- Modify: 13 个被搬运文件顶部的 `package ai` 保留不变（包名仍叫 `ai`，但路径变了）

**Steps:**
- [ ] **Step 1：用 git 单独提交"搬运"**
  - 用 `git mv` 把 [server/internal/ai](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/ai) 整个移动到 `server/internal/mindarena/ai`，让 git 把它识别成 rename。
- [ ] **Step 2：清理被搬运文件内部 import**
  - 打开搬入的每个文件，把 `import "valley-server/internal/mindarena"` 改成相对包内访问。
  - 由于现在 `internal/mindarena/ai` 在 `internal/mindarena` 子目录下，可以让 `ai` 包反向 import `mindarena` 的方式仍合法（子包 → 父包），但**循环已被打破**：原来的循环来自 `mindarena.Service` 想用 `ai.AIService`，现在 `ai` 是 `mindarena` 的子包，依赖单向 `mindarena → mindarena/ai`，再无成环。
  - 验证 [server/internal/ai/service.go#L7](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/ai/service.go#L7) 等处的反向引用都改干净。
- [ ] **Step 3：修改 mindarena 包内对 `ai` 的引用**
  - [server/internal/mindarena/service.go](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/mindarena/service.go) 等如有 `valley-server/internal/ai`，改为 `valley-server/internal/mindarena/ai`。
- [ ] **Step 4：修改 router 引用**
  - [server/internal/router/router.go#L4](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/router/router.go#L4)：`"valley-server/internal/ai"` → `"valley-server/internal/mindarena/ai"`。
  - [server/internal/router/router.go#L37](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/router/router.go#L37)：`ai.NewServiceFromEnv()` 仍然能调到，仅 import 路径改变。
- [ ] **Step 5：搜剩余引用兜底**
  - `rg 'valley-server/internal/ai\b' server` 必须无结果。
  - `rg '"valley-server/internal/mindarena/ai"' server` 至少 1 处（router）。

### Task 1.2：编译与测试

- [ ] **Step 1：`cd server && go build ./...` 通过**
- [ ] **Step 2：`cd server && go test ./...` 全绿**
  - 重点关注 [server/internal/mindarena/ai/service_test.go](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/mindarena/ai/service_test.go)、`fallback_test.go`、`judge_test.go` 等。
- [ ] **Step 3：grep 心智检查**
  - `rg 'package ai' server`：确认仍叫 `package ai`，避免误改包名引发隐式破坏。
  - `rg 'NewServiceFromEnv' server`：唯一调用点是 router，签名未变。

### Task 1.3：文档同步

- [ ] **Step 1：更新 [server/AGENTS.md](file:///Users/bytedance/Desktop/study/valley-mas/server/AGENTS.md)**
  - 把"AI 能力：`internal/ai`"改为"Mind Arena AI：`internal/mindarena/ai`（仅服务 Mind Arena）"。
  - 在路由入口段落加一句"通用 AI 接入见 `internal/aiclient`（Phase 2 引入）"占位，提醒读者后续会有第二个根。
- [ ] **Step 2：encoding-guard 定向检查**
  - `python3 .agents/skills/encoding-guard/scripts/check_mojibake.py server/AGENTS.md`

---

## Phase 2 — 新建 `internal/aiclient` 通用包

> 把散落 6 处的 ARK client 单例、4 份环境变量读取、4 处 SSE 流式、3 处 JSON 修剪/截断都抽到一个根。**不删旧代码**：旧函数继续存在，但内部转调 aiclient，避免一次性大爆炸。

### Task 2.1：建立 `internal/aiclient` 骨架

**Files:**
- Create: `server/internal/aiclient/doc.go`（包注释 + 设计原则：不 import 业务包）
- Create: `server/internal/aiclient/ark.go`
- Create: `server/internal/aiclient/openai.go`
- Create: `server/internal/aiclient/gemini.go`
- Create: `server/internal/aiclient/stream.go`
- Create: `server/internal/aiclient/jsonparse.go`
- Create: `server/internal/aiclient/textutil.go`
- Create: `server/internal/aiclient/usage.go`

**Steps:**
- [ ] **Step 1：`ark.go` — ARK client 单例 + 配置读取**
  - 抽自 [handler/blog_ai.go#L138-L163](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/handler/blog_ai.go#L138-L163) 与 [lifetrace/ai/client.go#L54-L68](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/ai/client.go#L54-L68)。
  - 暴露 `func ARKClient(timeout time.Duration) (*arkruntime.Client, ARKConfig, error)`，内部 `sync.Once`，但允许传不同 timeout（`map[time.Duration]*arkruntime.Client` 复用）。
  - 暴露 `func ReadARKTextConfig() (ARKConfig, error)`、`ReadARKVisionConfig`、`ReadARKImageConfig`（替代 [lifetrace/ai/config.go#L57-L134](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/ai/config.go#L57-L134) 与 handler 内重复版）。
  - 错误返回 `error`，不返回 string，调用方决定包装成什么 HTTP 文案。
- [ ] **Step 2：`openai.go` — OpenAI 兼容 client + 配置**
  - 抽自 [lifetrace/ai/config.go#L152-L176](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/ai/config.go#L152-L176)。
  - 支持环境变量优先级链：`LIFE_TRACE_AI_API_KEY` → `OPENAI_API_KEY`（并通过参数让上层选）。
  - 暴露 `ReadOpenAIConfig(opts OpenAIConfigOpts) (OpenAIConfig, bool)`，让 lifetrace / mindarena 各自传不同 env 名前缀。
- [ ] **Step 3：`gemini.go` — Gemini Vision client + 配置**
  - 抽自 [lifetrace/ai/config.go#L178-L201](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/ai/config.go#L178-L201)（先只搬 Vision，Text 没人用）。
- [ ] **Step 4：`stream.go` — 通用 SSE helper**
  - 抽自 [handler/admin_ai_chat.go#L214-L300](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/handler/admin_ai_chat.go) 的流式骨架。
  - API 草案：
    ```go
    type SSEWriter struct { /* gin.Context + flusher */ }
    func NewSSEWriter(c *gin.Context) (*SSEWriter, error)
    func (w *SSEWriter) Send(payload any) error
    func (w *SSEWriter) Done()
    ```
  - **不**写"如何消费 ARK stream"，只写"如何把任意 payload 推到客户端"。具体的 `for stream.Recv()` 循环留在调用方，因为不同 provider 不一样。
- [ ] **Step 5：`jsonparse.go` / `textutil.go`**
  - 把 [lifetrace/ai/contract.go#L54-L67](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/ai/contract.go#L54-L67) 的 `extractJSONObject` 搬过来；
  - 把 [handler/blog_ai.go#L38-L58](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/handler/blog_ai.go#L38-L58) 的 `normalizeAITextOutput` / `truncateAIText` 搬过来；
  - 把 `extractARKMessageText`（[admin_ai_chat.go#L79-L98](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/handler/admin_ai_chat.go#L79-L98)）搬过来。
- [ ] **Step 6：`usage.go` — aiusage 薄封装**
  - 暴露 `RecordSuccess(feature, model, ...)` / `RecordError(feature, model, err)` / 常量 `FeatureValleyAIChat = "valley-ai-chat"` 等。
  - Feature 字符串现状散落（`"desktop-ai-agent-chat"`、`"valley-ai-chat"`、各 lifetrace feature），先把已有的列举成常量，新功能必须用常量。
- [ ] **Step 7：单测**
  - `aiclient/jsonparse_test.go`：覆盖 ```json fence、纯 `{...}`、嵌套对象、文本前缀。
  - `aiclient/textutil_test.go`：覆盖 normalize 多空白、rune 截断（中文）。
  - `aiclient/ark_test.go`：覆盖 timeout 复用、缺 API key 错误、`ep-` 前缀校验。
  - 不写需要真实模型 key 的集成测试；带 `t.Skip` 提示。

### Task 2.2：迁移试点 `handler/admin_ai_chat.go`

> 选这一处是因为：1）业务最简单（无 DB、无 history 持久化），2）已经包含完整的 stream / 非 stream 双路径，能验证 stream.go 设计。

**Files:**
- Modify: `server/internal/handler/admin_ai_chat.go`
- Modify: `server/internal/handler/blog_ai.go`（删掉 `readArkTextModelConfig` / `ensureSharedArkClient` 旧实现，转调 aiclient；保留旧函数名作 shim 给 `ai_agent.go` / `blog_reader_ai.go` 用）

**Steps:**
- [ ] **Step 1：让 admin_ai_chat 调 aiclient**
  - `readArkTextModelConfig` → `aiclient.ReadARKTextConfig`
  - `ensureSharedArkClient(apiKey, baseURL)` → `aiclient.ARKClient(90 * time.Second)`
  - SSE 头与 flusher → `aiclient.NewSSEWriter`
  - `extractARKMessageText` → `aiclient.ExtractARKMessageText`
  - `recordValleyAIChatUsage` 内部改用 `aiclient.RecordError/Success`，外层签名保持不变。
- [ ] **Step 2：blog_ai.go 中的两个共享函数转 shim**
  - `readArkTextModelConfig` 改为内部调 `aiclient.ReadARKTextConfig` 后转换错误格式（保持原有 `errMsg string` 返回，避免 `ai_agent.go` / `blog_reader_ai.go` 一起改）。
  - `ensureSharedArkClient` 改为转调 `aiclient.ARKClient(90s)`。
  - 这一步保证旧 handler 行为不变，只是底层改了。
- [ ] **Step 3：handler 内重复的 `arkClient`/`arkClientOnce` 全局变量清理**
  - 仅在 `blog_ai.go` 保留转 shim 用的变量；`creator_ai_*.go` / `resource_tag*.go` 的 `arkClientOnce` 是各自独立的，不在本 phase 删（属下一份计划），但要在文件顶部加 `// TODO(aiclient-migration): 迁到 aiclient.ARKClient` 注释。

### Task 2.3：lifetrace/ai 内部下沉

**Files:**
- Modify: `server/internal/lifetrace/ai/client.go`
- Modify: `server/internal/lifetrace/ai/config.go`

**Steps:**
- [ ] **Step 1：`lifeai.EnsureARKClient` 改成转调 `aiclient.ARKClient(35s)`**
  - 保留 `ResetARKClientForTest` 的语义（让 aiclient 暴露 `ResetForTest()`）。
- [ ] **Step 2：config.go 中的 ARK 配置读取改成调用 `aiclient.ReadARKTextConfig` 等**
  - lifetrace 专属字段（`UseVision`、`Timeout`）继续在 lifetrace/ai/config.go 包装。
  - Gemini 配置仍走 `aiclient.ReadGeminiVisionConfig`。
  - OpenAI 兼容配置走 `aiclient.ReadOpenAIConfig(opts)`，opts 指定 `LIFE_TRACE_AI_*` 优先 `OPENAI_API_*`。
- [ ] **Step 3：保留 `extractJSONObject` 在 contract.go**
  - 改为转调 `aiclient.ExtractJSONObject`，内部 1 行包装。

### Task 2.4：编译、测试与回归

- [ ] **Step 1：`cd server && go build ./...`**
- [ ] **Step 2：`cd server && go test ./...`**
  - 重点跑：`internal/aiclient/...`、`internal/lifetrace/ai/...`、`internal/handler/...`、`internal/mindarena/...`。
- [ ] **Step 3：`rg 'os.Getenv\("ARK_' server/internal | wc -l`**
  - 记录数字。本 phase 结束后该数字应该比开始时少（aiclient + 试点迁移收敛了一部分），但**不要求归零**——剩余的属于下一份 handler 迁移计划。
- [ ] **Step 4：手动接口冒烟（由 owner 验收，AI 不自动跑）**
  - `POST /api/ai/chat`（admin_ai_chat 试点）
  - `POST /api/blog/posts/id/:id/ai/ask`（验证 shim 没坏）
  - `POST /api/life-trace/ai/today-advice`（验证 lifetrace 配置下沉）
  - 由 owner 在最终回复后自行触发；plan 不提自动 e2e。

### Task 2.5：文档同步

- [ ] **Step 1：更新 [server/AGENTS.md](file:///Users/bytedance/Desktop/study/valley-mas/server/AGENTS.md)**
- "路由与代码入口"段落新增：`通用 AI 客户端：internal/aiclient`。
- "开发规范"补充：新增用户主动发起的 AI 接入应通过模型目录解析能力并复用 `internal/aiclient`，禁止再由 handler 直接 `os.Getenv("ARK_*")` 读取配置。
- [ ] **Step 2：在 `internal/aiclient/doc.go` 写包级注释**
  - 简述：(1) 设计原则不依赖业务包；(2) 三个 provider 的 env 来源；(3) 新增 AI 功能的接入路径。
- [ ] **Step 3：encoding-guard**
  - `python3 .agents/skills/encoding-guard/scripts/check_mojibake.py server/AGENTS.md server/internal/aiclient/doc.go`

---

## 风险与缓解

| 风险 | 缓解 |
|---|---|
| `git mv` 后 IDE 历史失效，diff 巨大难 review | Phase 1 单独一个 commit，commit message 注明 "纯搬运 + import 改名，无逻辑变更"；reviewer 用 `git log --follow` 看历史 |
| `internal/mindarena/ai` 与 `internal/mindarena` 父子包仍可能形成隐式耦合 | 父包 `mindarena` 单向 import 子包 `mindarena/ai`，禁止反向；CI 可加 `import-restrictions` 检查（本计划不做） |
| aiclient 的 `ARKClient(timeout)` 多 client 实例 | 现状各 handler 写死不同 timeout（25s/35s/60s/90s），aiclient 用 `map[duration]*client` + `sync.Mutex` 复用，避免 N 个 client；不强求收敛 timeout 值 |
| shim 长期不清理变成新一层垃圾 | 在 `blog_ai.go` 等保留 shim 的位置统一加 `// TODO(aiclient-migration)`，附 issue 链接（owner 创建后回填） |
| 旧 env 变量优先级链改动导致现网行为变化 | aiclient 的 `ReadOpenAIConfig` 必须 1:1 复刻 [lifetrace/ai/config.go#L152-L176](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/ai/config.go#L152-L176) 的优先级；写表格驱动测试覆盖每条 env 链路 |

---

## 验收清单（owner 收尾时核对）

- [ ] `rg 'valley-server/internal/ai\b' server` 无结果
- [ ] `rg 'valley-server/internal/aiclient' server | wc -l` ≥ 4（router 之外至少 admin_ai_chat、blog_ai shim、lifetrace/ai/client、lifetrace/ai/config）
- [ ] `cd server && go test ./...` 全绿
- [ ] [server/AGENTS.md](file:///Users/bytedance/Desktop/study/valley-mas/server/AGENTS.md) 已同步
- [ ] 手动接口冒烟通过（admin AI 聊天、blog ask、life-trace today advice）
- [ ] 后续 handler 迁移单独立计划，不混入本计划

---

## 后续（不在本计划范围）

> 本计划落地后，再开新计划处理：

1. `creator_ai_title.go` / `creator_ai_tags.go` / `resource_tag.go` / `resource_tag_ai_description.go` 切到 aiclient（4 处冗余 ARK client 收敛）。
2. `handler/ai_agent.go` 与 `blog_reader_ai.go` 的 SSE 路径切到 `aiclient.NewSSEWriter`。
3. `lifetrace/ai_handler.go`（3156 行）按用例拆分。
4. `lifetrace/image_ai_handler.go` / `handler/blog_ai.go` 拆分。
5. Feature 常量统一收口审计（aiusage Feature 枚举化）。
