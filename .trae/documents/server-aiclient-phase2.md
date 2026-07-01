# Phase 2 — 新建 internal/aiclient 包并完成首批迁移

> **状态：已落地**。Task 1-8 全部完成，`internal/aiclient` 包已建立并被后续第三刀（[lifetrace-ai-handler-split-phase3.md](file:///Users/bytedance/Desktop/study/valley-mas/.trae/documents/lifetrace-ai-handler-split-phase3.md)）扩容为通用 AI 基础层。收尾细节见 [server-aiclient-phase2-resume.md](file:///Users/bytedance/Desktop/study/valley-mas/.trae/documents/server-aiclient-phase2-resume.md)。
>
> Plan 文件，仅作记录与执行参考。本次执行严格限制在 Phase 2，不动任何旧 handler 的业务逻辑，不拆任何巨型文件。

---

## Context

`server` 当前 AI 接入散落在 3 棵子树（[internal/ai/](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/ai)、[internal/lifetrace/ai/](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/ai)、`internal/handler/*ai*.go`），重复出现：

- ARK client 单例 + `sync.Once` 至少 6 处（[handler/blog_ai.go#L154](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/handler/blog_ai.go#L154)、[handler/resource_tag.go#L427](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/handler/resource_tag.go#L427)、[handler/resource_tag_ai_description.go#L59](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/handler/resource_tag_ai_description.go#L59)、[handler/creator_ai_title.go#L64](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/handler/creator_ai_title.go#L64)、[handler/creator_ai_tags.go#L119](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/handler/creator_ai_tags.go#L119)、[lifetrace/ai/client.go#L54](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/ai/client.go#L54)），timeout 各自写死 25s/35s/60s/90s。
- 读 `ARK_API_KEY` / `ARK_BASE_URL` / `ARK_TEXT_MODEL` 等环境变量重复 4 份（[handler/blog_ai.go#L138](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/handler/blog_ai.go#L138)、[lifetrace/ai/config.go#L136](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/ai/config.go#L136) 等）。
- SSE 流式响应的 header + flusher + `data: ...\n\n` 复制 4 处（admin_ai_chat、ai_agent、blog_reader_ai、lifetrace/ai_handler）。
- JSON 修剪、文本截断、ARK content 提取在 3 个包重复实现。

本次（Phase 2）建立 `internal/aiclient` 通用基础包，把上述能力收敛到一处；并把 [handler/admin_ai_chat.go](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/handler/admin_ai_chat.go) 作为试点切到新包。其余旧 handler **保留不动**，仅 [handler/blog_ai.go](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/handler/blog_ai.go)、[lifetrace/ai/client.go](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/ai/client.go)、[lifetrace/ai/config.go](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/ai/config.go) 的内部实现下沉到 aiclient（保留原导出函数的签名作为 shim，避免雪球）。

预期效果：

- 新增 AI 功能时只需读 `internal/aiclient` 包，调用 1~2 个函数完成 ARK 接入。
- `os.Getenv("ARK_API_KEY")` 在 server 内的命中数减少（aiclient + 本次切换的 3 处不再直接读）。
- `cd server && go test ./...` 全绿；admin AI 聊天、blog ask、life-trace today advice 三处冒烟通过(owner 手动)。

非目标（明确不做）：拆 [lifetrace/ai_handler.go](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/ai_handler.go)（3156 行）、动 `creator_ai_*` / `resource_tag*` / `ai_agent.go` / `blog_reader_ai.go` 的 ARK 直连、改任何对外接口路径或响应体。

---

## Architecture

```
internal/aiclient/                ← 新建：纯基础，禁止 import 业务包
├── doc.go                        包级注释 + 设计原则
├── ark.go                        ARK client 池 + 配置读取（Text/Vision/Image）
├── openai.go                     OpenAI 兼容 client + 配置读取（带 env 前缀策略）
├── gemini.go                     Gemini Vision client + 配置读取
├── stream.go                     SSE writer（gin.Context 包装）
├── jsonparse.go                  JSON 修剪 / fence 去除 / object 抓取
├── textutil.go                   normalize、rune 截断、ARK message 文本提取
├── usage.go                      aiusage 薄封装 + Feature 常量
├── ark_test.go
├── jsonparse_test.go
├── textutil_test.go
├── stream_test.go
└── openai_test.go

internal/lifetrace/ai/client.go   保留：EnsureARKClient / ResetARKClientForTest
internal/lifetrace/ai/config.go   保留：ReadTextConfig/ReadImageConfig/...
internal/lifetrace/ai/contract.go 保留：extractJSONObject 内部转调 aiclient
   ↳ 三者内部全部转调 aiclient，对外签名不变。

internal/handler/blog_ai.go       readArkTextModelConfig / ensureSharedArkClient 改 shim
internal/handler/admin_ai_chat.go 试点：完整切到 aiclient
```

**关键约束**：[internal/aiclient/](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/aiclient) 只能 import 标准库 + `arkruntime` SDK + 第三方 HTTP/JSON 库 + `internal/aiusage`，禁止 import `mindarena` / `lifetrace` / `handler` / `model` / `database`，保持向上单向依赖。

---

## Files to Modify / Create

### 新建（已完成 Task 1-4）

- `server/internal/aiclient/doc.go`
- `server/internal/aiclient/ark.go`
- `server/internal/aiclient/openai.go`
- `server/internal/aiclient/gemini.go`
- `server/internal/aiclient/stream.go`
- `server/internal/aiclient/jsonparse.go`
- `server/internal/aiclient/textutil.go`
- `server/internal/aiclient/usage.go`
- `server/internal/aiclient/ark_test.go`
- `server/internal/aiclient/jsonparse_test.go`
- `server/internal/aiclient/textutil_test.go`
- `server/internal/aiclient/stream_test.go`
- `server/internal/aiclient/openai_test.go`

### 改动

- [server/internal/handler/admin_ai_chat.go](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/handler/admin_ai_chat.go) — 完整切到 aiclient（试点，**已完成 Task 5**）。
- [server/internal/handler/blog_ai.go](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/handler/blog_ai.go) — `readArkTextModelConfig` / `ensureSharedArkClient` 转 shim。**注意**：handler 包级 `arkClient`/`arkClientOnce` 实际声明在 [resource_tag.go#L28-L31](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/handler/resource_tag.go#L28-L31)，被 [resource_tag.go](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/handler/resource_tag.go) / [resource_tag_ai_description.go](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/handler/resource_tag_ai_description.go) / [creator_ai_tags.go](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/handler/creator_ai_tags.go) 三个未迁 handler 共享，**本 Phase 2 不删**。
- [server/internal/lifetrace/ai/client.go](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/ai/client.go) — `EnsureARKClient` / `ResetARKClientForTest` / `extractARKContent` / `trimRunes` / `recordUsage` / `NormalizeImageInput` 内部转调 aiclient，对外签名 1:1 兼容。
- [server/internal/lifetrace/ai/config.go](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/ai/config.go) — `ReadARKTextConfig` / `ReadImageConfig` / `readOpenAIConfig` / `readGeminiVisionConfig` 内部转调 aiclient，错误文案与对外行为完全不变。
- [server/internal/lifetrace/ai/contract.go](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/ai/contract.go) — `extractJSONObject` 转 1 行 shim 调 `aiclient.ExtractJSONObject`。
- [server/AGENTS.md](file:///Users/bytedance/Desktop/study/valley-mas/server/AGENTS.md) — 路由/代码入口段补 `internal/aiclient`；开发规范段加"新增 AI 接入应优先复用 internal/aiclient，禁止再 `os.Getenv("ARK_*")` 直接读"。

---

## 当前进度（Resume Point）

| Task | 状态 | 备注 |
|---|---|---|
| Task 1：搭骨架（textutil/jsonparse/usage/doc） | ✅ 完成 | 13 个文件落地，`go test ./internal/aiclient/...` 全绿 |
| Task 2：ARK client 池 + 配置读取（ark.go） | ✅ 完成 | `ARKClient(timeout)` 按 timeout 缓存；`ReadARKTextConfig/Vision/Image` 错误文案 1:1 |
| Task 3：OpenAI / Gemini 配置（openai.go / gemini.go） | ✅ 完成 | env 链路与原 lifetrace 完全一致 |
| Task 4：通用 SSE writer（stream.go） | ✅ 完成 | 4 个 header + flusher + `data: ...\n\n` |
| Task 5：试点切换 admin_ai_chat.go | ✅ 完成 | `go build ./...` + `go test ./internal/handler/...` 全绿；handler 包级 `arkChatRequest` shim 1 行兼容 [ai_agent.go#L625](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/handler/ai_agent.go#L625) |
| Task 6：blog_ai.go 转 shim | ⏳ 待执行 | 见下方修订步骤 |
| Task 7：lifetrace/ai/* 内部下沉 | ⏳ 待执行 | 见下方步骤 |
| Task 8：文档 + 最终校验 | ⏳ 待执行 | 见下方步骤 |

### Resume verification（Phase 1 重新探索结论 · 本次接续）

- aiclient 包 13 个文件均在位（`doc.go` / `ark.go` / `openai.go` / `gemini.go` / `stream.go` / `jsonparse.go` / `textutil.go` / `usage.go` + 五份 `_test.go`）。
- [aiclient/usage.go#L47](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/aiclient/usage.go#L47) `RecordCallFromContext(ctx, provider, model, prompt, response, latencyMs, callErr)` 与 lifetrace [client.go#L517](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/ai/client.go#L517) `recordUsage` 行为 1:1 等价（同一 `aiusage.Record(Entry{...})`），可直接 shim。
- [aiclient/jsonparse.go#L7](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/aiclient/jsonparse.go#L7) `ExtractJSONObject` 与 lifetrace [contract.go#L54](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/ai/contract.go#L54) `extractJSONObject` 完全等价（同样的 ` ``` ` 围栏处理、首尾大括号匹配、TrimSpace 行为）。
- [aiclient/textutil.go](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/aiclient/textutil.go) 的 `ExtractARKContent` / `NormalizeImageInput` / `TrimRunes` 与 lifetrace [client.go](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/ai/client.go) 三个旧函数实现完全一致。
- [aiclient/ark.go](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/aiclient/ark.go) 错误文案与 lifetrace [config.go](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/ai/config.go) 1:1 匹配，包含：
  - `"AI 未配置：缺少 ARK_API_KEY"`
  - `"AI 未配置：ARK_TEXT_MODEL 必须以 ep- 开头"`
  - `"AI 未配置：ARK_VISION_MODEL 或 ARK_TEXT_MODEL 必须以 ep- 开头"`
  - `"AI 未配置：缺少 ARK_IMAGE_MODEL"`
- [client.go#L45-L48](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/ai/client.go#L45-L48) 包级 `arkClientOnce`/`arkClient` 还在，35s 超时与 aiclient.ARKClient(35s) 一致；删除后由池接管。
- handler 包级 `arkClient`/`arkClientOnce` 仍声明在 [resource_tag.go#L28-L31](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/handler/resource_tag.go#L28-L31)，被 3 个未迁 handler 共享，本 Phase 不动（已写入"Assumptions & Decisions"）。
- 计划文件本身路径：[.trae/documents/server-aiclient-phase2.md](file:///Users/bytedance/Desktop/study/valley-mas/.trae/documents/server-aiclient-phase2.md)（未发现 Phase 2 范围内任何待澄清的歧义）。

---

## Tasks（剩余执行清单）

> Task 1-5 已完成，本节只列剩余任务的精确步骤。Task 1-4 与 Task 5 的历史步骤保留在文末"附录"用于审计。

### Task 6：[handler/blog_ai.go](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/handler/blog_ai.go) 转 shim

**关键修订**：原 plan 写的"删除 `arkClient`、`arkClientOnce` 包级变量"**不执行**——这两个变量声明在 [resource_tag.go#L28-L31](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/handler/resource_tag.go#L28-L31)，且被 [resource_tag.go](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/handler/resource_tag.go) / [resource_tag_ai_description.go](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/handler/resource_tag_ai_description.go) / [creator_ai_tags.go](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/handler/creator_ai_tags.go) 共享，本 Phase 2 不动这三个。

- [ ] **Step 1**：[blog_ai.go#L138-L152](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/handler/blog_ai.go#L138-L152) `readArkTextModelConfig` 改为：

  ```go
  func readArkTextModelConfig() (apiKey, arkBaseURL, textModel string, errMsg string) {
      cfg, msg := aiclient.ReadARKTextConfig()
      return cfg.APIKey, cfg.BaseURL, cfg.Model, msg
  }
  ```

  保持外部签名/语义 1:1 兼容（被 [ai_agent.go#L562](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/handler/ai_agent.go#L562)、[blog_reader_ai.go#L333,L409,L506](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/handler/blog_reader_ai.go#L333)、[creator_application_audit.go#L143](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/handler/creator_application_audit.go#L143) 共 5 处调用）。

- [ ] **Step 2**：[blog_ai.go#L154-L163](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/handler/blog_ai.go#L154-L163) `ensureSharedArkClient` 改为：

  ```go
  // shim: 历史调用点已传相同 env，参数留作兼容；底层走 aiclient.ARKClient(90s)。
  func ensureSharedArkClient(_, _ string) *arkruntime.Client {
      return aiclient.ARKClient(90 * time.Second)
  }
  ```

  保留参数和返回类型，9 处调用方零修改。

- [ ] **Step 3**：在 [blog_ai.go](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/handler/blog_ai.go) import 区加 `"valley-server/internal/aiclient"`；保留 `os` / `time` / `arkruntime` / `arkmodel`（仍被 `imageModelCandidates` / `ensureSharedArkClient` / 其余业务函数使用）。

- [ ] **Step 4**：保留 `imageModelCandidates`、`fetchRemoteImageAsBase64`、`normalizeAITextOutput`、`truncateAIText`、`isImageModelCapabilityError`、`isImageSizeUnsupportedError`、`isImageResponseFormatUnsupportedError`、`imageModelMisconfiguredMessage`、`normalizeCoverImageBytes` 等所有业务函数原样，不动。

- [ ] **Step 5**：`cd server && go build ./...` 通过；`cd server && go test ./internal/handler/...` 通过。

---

### Task 7：[lifetrace/ai/client.go](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/ai/client.go)、[config.go](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/ai/config.go)、[contract.go](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/ai/contract.go) 内部下沉

> **守护线**：Task 7 完成后 [lifetrace/ai/config_test.go](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/ai/config_test.go) 8 个测试用例（`TestReadTextConfigRequiresARKTextModel` / `TestReadImageConfigFallsBackToTextModel` / `TestReadPantryPhotoConfigPrefersGemini` / `TestReadPantryPhotoConfigFallsBackToARKImageConfig` / `TestReadPantryPhotoConfigCanForceARKProvider` / `TestReadPantryPhotoConfigForcedGeminiRequiresKey` / `TestReadTextConfigPrefersLifeTraceAIEnv` / `TestReadTextConfigKeepsLegacyOpenAIEnvFallback` / `TestPromptContractParseNormalizesOutput`）必须**全绿，不改任何断言**。

#### Step 1：[client.go](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/ai/client.go) ARK client 池下沉

- 删除 [client.go#L45-L48](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/ai/client.go#L45-L48) 包级 `arkClientOnce`/`arkClient` 变量。
- [client.go#L54-L63](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/ai/client.go#L54-L63) `EnsureARKClient(apiKey, baseURL string) *arkruntime.Client` 改 shim：

  ```go
  // EnsureARKClient 维持原签名以兼容外部调用；apiKey/baseURL 已统一从 env 读，参数忽略。
  func EnsureARKClient(_, _ string) *arkruntime.Client {
      return aiclient.ARKClient(35 * time.Second)
  }
  ```

- [client.go#L65-L68](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/ai/client.go#L65-L68) `ResetARKClientForTest` 改 1 行：

  ```go
  func ResetARKClientForTest() { aiclient.ResetForTest() }
  ```

- 删除已不再使用的 `sync` import（如果 client.go 没有别处用 `sync`）。

#### Step 2：[client.go](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/ai/client.go) 文本/图像工具下沉

- [client.go#L382-L407](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/ai/client.go#L382-L407) `extractARKContent(resp arkmodel.ChatCompletionResponse) (string, error)` 改 1 行：

  ```go
  func extractARKContent(resp arkmodel.ChatCompletionResponse) (string, error) {
      return aiclient.ExtractARKContent(resp)
  }
  ```

- [client.go#L506-L515](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/ai/client.go#L506-L515) `NormalizeImageInput(raw string) string` 改 1 行：

  ```go
  func NormalizeImageInput(raw string) string { return aiclient.NormalizeImageInput(raw) }
  ```

- [client.go#L538-L547](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/ai/client.go#L538-L547) `trimRunes(raw string, max int) string` 改 1 行：

  ```go
  func trimRunes(raw string, max int) string { return aiclient.TrimRunes(raw, max) }
  ```

#### Step 3：[client.go](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/ai/client.go) 用量记录下沉

- [client.go#L517-L536](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/ai/client.go#L517-L536) `recordUsage(ctx, provider, modelName, prompt, response, latencyMs, err)` 改 1 行：

  ```go
  func recordUsage(ctx context.Context, provider, modelName, prompt, response string, latencyMs int64, err error) {
      aiclient.RecordCallFromContext(ctx, provider, modelName, prompt, response, latencyMs, err)
  }
  ```

  > 前置确认：[aiclient/usage.go](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/aiclient/usage.go) 已导出 `RecordCallFromContext(ctx, ...)` 等价语义（从 `aiusage.FromContext(ctx)` 读 audit）。如果导出名称不同，按实际调整为 `RecordCall(audit, ...)` + 上层显式取 audit。

#### Step 4：[contract.go](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/ai/contract.go) extractJSONObject 转 shim

- [contract.go#L54-L67](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/ai/contract.go#L54-L67) 改 1 行：

  ```go
  func extractJSONObject(raw string) string { return aiclient.ExtractJSONObject(raw) }
  ```

#### Step 5：[config.go](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/ai/config.go) 配置读取下沉

> **错误文案 1:1 守护**：所有错误文案保持原状不变；测试断言不动。

- [config.go#L136-L150](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/ai/config.go#L136-L150) `ReadARKTextConfig()` 改：

  ```go
  func ReadARKTextConfig() (apiKey, baseURL, textModel string, errMsg string) {
      cfg, msg := aiclient.ReadARKTextConfig()
      return cfg.APIKey, cfg.BaseURL, cfg.Model, msg
  }
  ```

- [config.go#L57-L89](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/ai/config.go#L57-L89) `ReadImageConfig(defaultTimeout time.Duration) (ImageConfig, string)` 改：

  ```go
  func ReadImageConfig(defaultTimeout time.Duration) (ImageConfig, string) {
      result, msg := aiclient.ReadARKVisionConfig()
      if msg != "" {
          return ImageConfig{}, msg
      }
      return ImageConfig{
          Source:    "ark",
          APIKey:    result.Config.APIKey,
          BaseURL:   result.Config.BaseURL,
          Model:     result.Config.Model,
          Timeout:   defaultTimeout,
          UseVision: result.UseVision,
      }, ""
  }
  ```

- [config.go#L113-L134](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/ai/config.go#L113-L134) `ReadThumbnailConfig()` 改用 `aiclient.ReadARKImageConfig()` 并适配本包旧返回结构。

- [config.go#L152-L176](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/ai/config.go#L152-L176) `readOpenAIConfig(defaultTimeout)` 改用 `aiclient.ReadOpenAIConfig(opts)`：

  ```go
  func readOpenAIConfig(defaultTimeout time.Duration) (TextConfig, bool) {
      cfg, ok := aiclient.ReadOpenAIConfig(aiclient.OpenAIConfigOpts{
          APIKeyEnvs:     []string{"LIFE_TRACE_AI_API_KEY", "OPENAI_API_KEY"},
          BaseURLEnvs:    []string{"LIFE_TRACE_AI_BASE_URL", "OPENAI_API_BASE_URL"},
          ModelEnvs:      []string{"LIFE_TRACE_AI_MODEL", "OPENAI_API_MODEL"},
          TimeoutEnvs:    []string{"LIFE_TRACE_AI_TIMEOUT_SECONDS", "OPENAI_API_TIMEOUT"},
          DefaultBaseURL: "https://api.openai.com/v1",
          DefaultModel:   "gpt-5.4",
          DefaultTimeout: defaultTimeout,
      })
      if !ok {
          return TextConfig{}, false
      }
      return TextConfig{
          Source:  "openai",
          APIKey:  cfg.APIKey,
          BaseURL: cfg.BaseURL,
          Model:   cfg.Model,
          Timeout: cfg.Timeout,
      }, true
  }
  ```

- [config.go#L178-L201](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/ai/config.go#L178-L201) `readGeminiVisionConfig(defaultTimeout)` 改用 `aiclient.ReadGeminiVisionConfig(defaultTimeout, []string{"LIFE_TRACE_PANTRY_PHOTO_AI_TIMEOUT_SECONDS", "GEMINI_VISION_TIMEOUT_SECONDS"})`，并把结果适配回本包 `ImageConfig`（Source = "gemini"，UseVision = true）。

- [config.go#L203-L249](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/ai/config.go#L203-L249) 已下沉的私有 helper（`firstEnv` / `parseTimeoutSeconds` / `imageModelCandidates`）保留：`imageModelCandidates` 仍被本包内 `ReadThumbnailConfig` 走 aiclient 后可删，但 Phase 2 保守处理——若 ReadThumbnailConfig 转调 `aiclient.ReadARKImageConfig` 直接拿到候选数组，则可删；保留判断在执行时根据 ReadThumbnailConfig 的实际改动决定。

#### Step 6：跑测试

- `cd server && go build ./...`
- `cd server && go test ./internal/lifetrace/...`，重点 `./internal/lifetrace/ai/...` 必须全绿。
- `cd server && go test ./...` 整体回归。

---

### Task 8：文档 + 最终校验

- [ ] **Step 1**：修改 [server/AGENTS.md](file:///Users/bytedance/Desktop/study/valley-mas/server/AGENTS.md)：
  - "路由与代码入口"段加："通用 AI 客户端：`internal/aiclient`（封装 ARK/OpenAI/Gemini client、SSE、JSON/文本工具）。"
  - "开发规范"中 AI 段加："新增 AI 接入应优先复用 `internal/aiclient`；不再在 handler 里直接 `os.Getenv(\"ARK_*\")` 或 `arkruntime.NewClientWithApiKey`。"
- [ ] **Step 2**：`python3 .agents/skills/encoding-guard/scripts/check_mojibake.py server/AGENTS.md server/internal/aiclient/doc.go`。
- [ ] **Step 3**：`cd server && go build ./...`。
- [ ] **Step 4**：`cd server && go test ./...` 全绿。
- [ ] **Step 5**：grep 检查
  - `rg 'os.Getenv\("ARK_' server/internal | wc -l` 应**显著减少**（admin_ai_chat、blog_ai 直读消失，lifetrace/ai/config.go 的 4 处直读消失）。
  - `rg 'arkruntime.NewClientWithApiKey' server/internal | wc -l` 应剩 **5**（aiclient/ark.go 1 处 + 4 个未迁的 handler：creator_ai_title、creator_ai_tags、resource_tag、resource_tag_ai_description；lifetrace 已迁；blog_ai 已转 shim）。

---

## Verification

### 自动校验

1. `cd server && go build ./...`
2. `cd server && go test ./...`
3. 重点子集：`go test ./internal/aiclient/... ./internal/handler/... ./internal/lifetrace/ai/... ./internal/lifetrace/...`
4. encoding-guard：`python3 .agents/skills/encoding-guard/scripts/check_mojibake.py server/AGENTS.md server/internal/aiclient/doc.go`
5. grep 数字对比（详见 Task 8 Step 5）

### 手动冒烟（owner 触发，AI 不自动跑）

按 [server/AGENTS.md](file:///Users/bytedance/Desktop/study/valley-mas/server/AGENTS.md) "AI/Mind Arena 服务端改动：补充或运行相关测试，并说明真实模型调用是否未验证"，三处冒烟：

- `POST /api/ai/chat`（admin_ai_chat 试点）→ stream/非 stream 都验证。
- `POST /api/blog/posts/id/:id/ai/ask`（blog_ai shim 是否破坏）→ 仅看返回是否正常。
- `POST /api/life-trace/ai/today-advice`（lifetrace 配置下沉是否破坏）→ 看降级到 mock/正常返回。

### 风险路径专项

- `aiclient.ARKClient` 多 timeout map：本地用 `ResetForTest` + 多次调用验证不会泄漏 client。
- OpenAI 优先级链：依靠 [lifetrace/ai/config_test.go](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/ai/config_test.go) 全绿覆盖。
- Gemini 配置：依靠 `TestReadPantryPhotoConfigPrefersGemini` 等断言。

### 不在本计划覆盖（留给下一份计划）

- creator_ai_title / creator_ai_tags / resource_tag / resource_tag_ai_description 仍直连 ARK；
- ai_agent.go / blog_reader_ai.go / lifetrace/ai_handler.go 的 SSE 仍手写；
- lifetrace/ai_handler.go 3156 行未拆分；
- Feature 常量未在所有调用点强制收敛（aiclient 暴露常量但旧 handler 仍可传字符串）。

---

## Assumptions & Decisions

1. **handler 包级 arkClient/arkClientOnce 不删**：这两个变量的实际声明位置是 [resource_tag.go#L28-L31](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/handler/resource_tag.go#L28-L31)，与原 plan 描述不一致。它们被三个 Phase 2 不动的 handler（resource_tag/resource_tag_ai_description/creator_ai_tags）直接读写。删除会破坏未迁 handler，留待 Phase 3。
2. **blog_ai.go 的 shim 不接管这两个全局变量**：`ensureSharedArkClient` 转 shim 后，aiclient 内部用独立 `arkClientPool`，与 handler 包级 `arkClient` 单例并存。两个池没有共享状态，但都从 env 读相同 key，行为等价。
3. **Task 7 lifetrace 包级 arkClientOnce/arkClient 删除**：这两个是 lifetrace/ai 包内私有，跟 handler 包不冲突，删除后由 `aiclient.ARKClient(35s)` 接管。
4. **错误文案严格 1:1**：测试断言用了完整中文文案匹配，任何字符变化都会挂。
5. **OpenAI 默认 model 保持 `gpt-5.4`**：与现有 [config.go#L165](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/lifetrace/ai/config.go#L165) 一致，不动 product 决策。
6. **handler 包 `arkChatRequest` shim 保留**：1 行转调 `aiclient.NewARKChatRequest`，让 [ai_agent.go#L625](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/handler/ai_agent.go#L625) 等历史调用零修改。

---

## 计划文档同步

本计划完成后需要同步：

- [server/AGENTS.md](file:///Users/bytedance/Desktop/study/valley-mas/server/AGENTS.md)（已列在 Task 8 Step 1）。
- 不影响 [apps/life-trace/docs/PLAN.md](file:///Users/bytedance/Desktop/study/valley-mas/apps/life-trace/docs/PLAN.md) 等产品计划（纯后端基础设施，不改产品功能/接口/数据模型）。

---

## Skills used / will use

- `ai-capability-orchestration`（强制：所有 ARK 接入相关改动必须启用）
- `karpathy-coder`（B 档收尾自检）
- `task-completion-guard`（计划文档驱动 + 跨 8+ 文件 + 多轮实施，启用）
- `encoding-guard`（含 CJK 文档与注释）
- `conventional-commit-guard`（提交时启用，单行中文 conventional commit）
- `skill-usage-disclosure`（按规则披露）

---

## 附录：Task 1-5 历史步骤（已完成，留作审计）

### Task 1：搭骨架，纯工具先（已完成）
- doc.go、textutil.go、jsonparse.go、usage.go 创建
- textutil_test.go、jsonparse_test.go 测试通过

### Task 2：ARK client 池 + 配置读取（已完成）
- ark.go：`ARKClient(timeout)` 按 timeout 缓存；`ReadARKTextConfig` / `ReadARKVisionConfig` / `ReadARKImageConfig`；`NewARKChatRequest` 默认 `MaxTokens=900, Temperature=0.7`；`ResetForTest`
- ark_test.go 全绿

### Task 3：OpenAI / Gemini 配置（已完成）
- openai.go：`OpenAIConfig` + `OpenAIConfigOpts` + `ReadOpenAIConfig(opts)`
- gemini.go：默认 base `https://generativelanguage.googleapis.com/v1beta`、默认 model `gemini-2.5-flash`
- openai_test.go 全绿

### Task 4：通用 SSE writer（已完成）
- stream.go：`SSEWriter` + `NewSSEWriter(c)` + `Send(payload any) error`
- stream_test.go 全绿

### Task 5：试点切换 admin_ai_chat.go（已完成）
- `aiclient.ReadARKTextConfig()` 替代 `readArkTextModelConfig`
- `aiclient.ARKClient(90 * time.Second)` 替代 `ensureSharedArkClient`
- `aiclient.NewSSEWriter` 替代手写 header + flusher + send
- `aiclient.ExtractARKMessageText` 替代 `extractARKMessageText`
- `aiclient.NewARKChatRequest` 替代 `arkChatRequest`
- handler 包级 `arkChatRequest(modelID, messages)` 保留 1 行 shim 转调 `aiclient.NewARKChatRequest`，兼容 [ai_agent.go#L625](file:///Users/bytedance/Desktop/study/valley-mas/server/internal/handler/ai_agent.go#L625) 调用
- `recordValleyAIChatUsage` 内部聚合 history prompt chars，保留不变（不强制套 aiclient.RecordCall）
- `go build ./...` + `go test ./internal/handler/...` 全绿
