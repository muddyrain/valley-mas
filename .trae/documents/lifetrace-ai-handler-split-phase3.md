# 第三刀 · `lifetrace/ai_client.go` 双轨收编 & OpenAI 兼容层下沉

> 状态：**规划中（草稿）**，等待 owner 审批后进入 Task 拆分。
> 上刀基础：第四刀已完成 prompt 域下沉（commit `be6506ea`），本刀开始处理"字符最多、耦合最深、双轨（ARK / OpenAI）分叉"的调用层。

---

## Context

`server/internal/lifetrace/ai_client.go` 是 lifetrace 里最重的一块基础设施（**841 行**），承担了 6 类角色，且**双轨（ARK / OpenAI-compatible）分叉重复实现**：

| 层 | 内容 | 行数占比 | 现状 |
|---|---|---|---|
| L1 · 配置读取 | `readLifeTraceAIConfig` / `readLifeTraceArkTextConfig` / `ensureLifeTraceArkClient` | ~20 行 | 已经是薄转调（转 `lifeai.ReadTextConfig` / `aiclient.ARKClient(35s)`），删掉零风险 |
| L2 · OpenAI 私有类型 | `lifeTraceOpenAIRequest` / `Message` / `Tool` / `FunctionDefinition` / `ToolChoice` / `ToolCall` / `FunctionCall` / `Response` / `StreamResponse` / `ResponseFormat` | ~60 行 | **被 `ai_handler_test.go` / `inbox_handler_test.go` 6 处直接断言字面量**，无法直接删；只能保留 alias |
| L3 · Assistant tool-call | `callLifeTraceAssistantStructuredResponse` + ARK/OpenAI 双轨 tool call + JSON 降级 + tool schema 构造 + toolCalls 解析 + `isLifeTraceAssistantToolUnsupported` 错误码识别 | ~300 行 | ARK / OpenAI 分叉实现同一逻辑；**未在 `aiclient` 中有对等实现** |
| L4 · SSE 流式 | `streamLifeTraceAssistantARK` / `streamLifeTraceAssistantOpenAI` + `beforeDone` 回调 + `prepareLifeTraceSSE`（在 `assistant_handler.go`） | ~200 行 | ARK 侧走 SDK stream / OpenAI 侧手写 `bufio.Scanner` 解析 SSE；**`aiclient` 只有 `SSEWriter`，无 chat stream 客户端** |
| L5 · 单轮文本 | `callLifeTraceTextAI` / `callLifeTraceTextAIWithMaxTokens` / `callLifeTraceAI` / `callLifeTraceAIWithMaxTokens` | ~80 行 | 前两个用于 `achievement_handler`，直接调 arkruntime；后两个已经是 `lifeai.NewClient().GenerateJSON` 转调 |
| L6 · aiusage 记录 | `recordLifeTraceAIUsage` | ~20 行 | 已被 `aiclient.RecordCallFromContext` / `lifeai.recordUsage` 完全覆盖 |

**`internal/aiclient` 现状**：
- ARK 侧齐全：`ARKClient(timeout)` 单例池 / `ReadARK*Config` / `NewARKChatRequest` / `ExtractARKContent` / `ARKChatOption` / SSE `SSEWriter`
- OpenAI 侧**只有** `ReadOpenAIConfig`（配置读取），**没有完整的请求/响应类型、tool_calls 支持、SSE 流式解析**
- Gemini 侧只服务 vision，与本刀无关

**`internal/lifetrace/ai/client.go` 现状**（第一刀产物）：
- `EnsureARKClient` shim → `aiclient.ARKClient(35s)`
- `openAIRequest` / `openAIMessage` / `openAIResponse` 简版类型（无 tools 字段）
- `generateOpenAIText` / `generateARKText`：基础 chat completion，**无 tool_calls / 无 streaming**
- `GenerateJSON` / `GenerateText` / `GenerateVisionJSON`

**核心矛盾**：`lifeai.openAIRequest` 和 `lifetrace.lifeTraceOpenAIRequest` **是同一 API 的两份实现**（前者只支 JSON mode，后者支 tools + streaming）；ARK 双轨同理（前者只支简单文本，后者支 tool_calls + streaming）。

---

## 目标（本刀 vs 遗留）

### 本刀目标

**把 `ai_client.go` 从 841 行降到 ≤ 100 行的薄兼容层，实现分为三档**：

1. **上收到 `internal/aiclient`**：与业务无关的能力（OpenAI 请求/响应类型、tool_calls 结构、`isARKToolUnsupported` 错误码识别、`ARKStream` / `OpenAIStream` 客户端）。
2. **下沉到 `internal/lifetrace/ai`（lifeai 包）**：仍与 lifetrace 域耦合的调用胶水（assistant tool schema、structured JSON 解析回调、`AssistantARKCaller` / `AssistantOpenAICaller` 具体调用函数）。
3. **保留在 `ai_client.go`**：只留 `type xxx = lifeai.Xxx` type alias 和薄函数 shim（供 handler 与测试文件继续用旧名，行为零变化）。

### 范围外（下一刀）

- `ai_handler_test.go` / `inbox_handler_test.go` 用私有类型断言的 6 处，本刀**只保留 alias 使其编译通过**，不重写测试。
- `achievement_handler.go` 直接调 `arkruntime.Client` 的两处（`callLifeTraceTextAIWithMaxTokens`），本刀留原地。
- `pantry_ai_handler.go` / `image_ai_handler.go` 里其他直接 `ensureLifeTraceArkClient(...)` 调用点，本刀只做名字迁移（改成 `lifeai.EnsureARKClient`），不重构调用姿势。

---

## Architecture

### 目标文件结构

```
internal/aiclient/
├── ark.go                保留 — 加 3 个导出：ExtractARKMessageText / IsARKToolUnsupported / NewARKChatRequestWithTools
├── openai.go             扩容 — 新增 OpenAI 请求/响应/tool 完整类型 + 便捷构造函数
├── stream.go             扩容 — 加 ARKStreamClient + OpenAIStreamClient（消费上游 SSE，暴露 Recv() 迭代器）
├── openai_toolcall.go    新增 — OpenAI tool_calls 请求发送 + 响应解析
├── ark_toolcall.go       新增 — ARK tool_calls 请求发送 + 响应解析
├── doc.go                更新 — 新增章节说明 tool_calls / stream 用法
└── (existing tests)      新增 — openai_toolcall_test.go / ark_toolcall_test.go

internal/lifetrace/ai/    (lifeai)
├── client.go             扩容 — 新增 assistant 域方法：CallAssistantTool / CallAssistantStructuredJSON / StreamAssistant
├── assistant_caller.go   新增 — assistant 域双轨编排（tool → JSON 降级）
├── stream.go             新增 — SSE 送出胶水（把 aiclient 的 stream Recv 转换为 lifeTraceAssistantStreamChunk）
└── (existing files)      不动

internal/lifetrace/
├── ai_client.go          瘦身 841 → ~80 行 — 只留 type alias + 3 个 shim 函数
├── assistant_handler.go  修改 — prepareLifeTraceSSE 移到 lifeai，本文件只调 lifeai.StreamAssistant
├── ai_handler_test.go    不动（走 alias 保护）
├── inbox_handler_test.go 不动
└── achievement_handler.go 修改 — ensureLifeTraceArkClient → lifeai.EnsureARKClient；不改调用姿势
```

### 分层责任划分

```
handler
  ↓
lifeai (domain-specific caller)
  ├── AssistantARKCaller       — 组装 tool schema、调 aiclient.ARKToolCall、解析 tool_calls
  ├── AssistantOpenAICaller    — 同上但走 OpenAI 双轨
  ├── AssistantStreamerARK     — 组装 stream 请求、调 aiclient.ARKStream、封 SSE chunk
  ├── AssistantStreamerOpenAI  — 同上但走 OpenAI SSE
  ↓
aiclient (provider-agnostic transport)
  ├── ARKClient / OpenAI HTTP 客户端
  ├── ARK/OpenAI tool_calls 编解码
  ├── ARK/OpenAI SSE 流式消费
  └── 错误码识别 / usage 记录 / TrimRunes / SSEWriter
  ↓
external SDK / HTTP
  └── volcengine-go-sdk / net/http
```

**边界约束**：
- `aiclient` 不 import `lifetrace/*`（doc.go 已声明）。
- `lifeai`（`internal/lifetrace/ai/`）不 import `lifetrace/*`（避免循环依赖）。
- `lifetrace` 只 import `lifeai` + `aiclient`（后者已在部分文件中被间接引用）。

### Tool schema 归属

`buildLifeTraceAssistantToolSchema` 依赖 `lifeTraceAssistantActionRegistry.Types()`（lifetrace 域业务枚举），**不能上收到 aiclient**。搬到 lifeai 也不行，因为 registry 定义在 lifetrace 包。

**方案**：保留 `buildLifeTraceAssistantToolSchema` 在 `assistant_common.go`；`AssistantARKCaller` / `AssistantOpenAICaller` 通过参数注入 schema。lifeai 层暴露 `AssistantCallOptions{Schema map[string]any, ToolName string, MaxTokens int}`，handler 侧把 lifetrace 的 registry 转成 schema 后传入。

### Type alias 保护

`ai_handler_test.go` L131/450/665/1455/1526、`inbox_handler_test.go` L308 均用 `var captured lifeTraceOpenAIRequest`，`json.Unmarshal(body, &captured)`。这些**必须保留 lifetrace 包内符号**。

**做法**：
```go
// ai_client.go (瘦身后)
type lifeTraceOpenAIRequest = aiclient.OpenAIRequest
type lifeTraceOpenAIMessage = aiclient.OpenAIMessage
type lifeTraceOpenAIResponse = aiclient.OpenAIResponse
type lifeTraceOpenAITool = aiclient.OpenAITool
type lifeTraceOpenAIFunctionDefinition = aiclient.OpenAIFunctionDefinition
type lifeTraceOpenAIToolChoice = aiclient.OpenAIToolChoice
type lifeTraceOpenAIToolChoiceFunction = aiclient.OpenAIToolChoiceFunction
type lifeTraceOpenAIToolCall = aiclient.OpenAIToolCall
type lifeTraceOpenAIFunctionCall = aiclient.OpenAIFunctionCall
type lifeTraceResponseFormat = aiclient.OpenAIResponseFormat
type lifeTraceOpenAIStreamResponse = aiclient.OpenAIStreamResponse
```

**注意**：`lifeai` 里已存在同名的**私有** `openAIRequest` / `openAIMessage` / `openAIResponse`。本刀先把 aiclient 里的 **导出** OpenAI 类型建好，让 lifeai 私有版本也切成 alias，避免重复定义。

---

## Files to Modify / Create

### 新建（aiclient 侧）

- `server/internal/aiclient/openai_types.go` — OpenAI 完整请求/响应/tool_calls 类型（导出）
- `server/internal/aiclient/openai_toolcall.go` — `NewOpenAIToolCallRequest` / `SendOpenAIRequest` / `ExtractOpenAIToolCalls` / `IsOpenAIToolUnsupported`
- `server/internal/aiclient/ark_toolcall.go` — `NewARKToolCallRequest` / `ExtractARKToolCalls` / `IsARKToolUnsupported`
- `server/internal/aiclient/openai_stream.go` — `OpenAIStreamClient` 消费 SSE
- `server/internal/aiclient/ark_stream.go` — 已由 arkruntime SDK 覆盖，加 shim 便利函数即可

### 新建（lifeai 侧）

- `server/internal/lifetrace/ai/assistant_caller.go` — `AssistantARKCaller` / `AssistantOpenAICaller` / `AssistantStructuredResponse` 编排
- `server/internal/lifetrace/ai/stream.go` — `AssistantStreamer` 双轨（把 aiclient stream 转 lifetrace 的 chunk 类型）

### 修改

- `server/internal/aiclient/openai.go` — 保留现有 `OpenAIConfig` / `ReadOpenAIConfig` / `firstEnv` / `parseTimeoutSeconds`；新类型放独立文件
- `server/internal/aiclient/doc.go` — 补章节说明 tool_calls / stream
- `server/internal/lifetrace/ai/client.go` — 内部 `openAIRequest` / `openAIMessage` / `openAIResponse` 切成 alias 到 aiclient 类型；`generateOpenAIText` 用 aiclient 底层辅助函数
- `server/internal/lifetrace/ai_client.go` — 从 841 行瘦到 ~80 行；只留 type alias + 3 个 shim（`callLifeTraceAssistantStructuredResponse` / `streamLifeTraceAssistantARK` / `streamLifeTraceAssistantOpenAI`）→ 全部转调 lifeai
- `server/internal/lifetrace/assistant_handler.go` — `prepareLifeTraceSSE` 内联到 `streamLifeTraceAssistantARK/OpenAI` 的 shim 中（本文件不再引用）
- `server/internal/lifetrace/achievement_handler.go` — `ensureLifeTraceArkClient` → `lifeai.EnsureARKClient`；`callLifeTraceTextAIWithMaxTokens` 保持原地
- `server/internal/lifetrace/pantry_ai_handler.go` / `image_ai_handler.go` — `ensureLifeTraceArkClient` → `lifeai.EnsureARKClient`（可选，Task 6 顺手做）

### 删除

**无**——所有搬走的函数在 `ai_client.go` 里都留 shim；测试文件零改动。

---

## Tasks

> 每个 Task 独立执行 + `cd server && go build ./... && go test ./...` 三重验证。任何一步 fail 必须回滚该 Task 再复盘，不批量粘贴。

### Task 1 · aiclient 补 OpenAI 类型

**目标**：把 `lifeTraceOpenAIRequest` 等 10 个私有类型上收到 `aiclient/openai_types.go`（导出），字段与现有版本 1:1 对齐，JSON tag 逐字节等价。

**验证**：`go build ./...` 通过；`grep -r "lifeTraceOpenAI"` 结果不变（下一 Task 才切 alias）。

**独立可测试**：新加的类型无引用，只验证 aiclient 单独编译。

### Task 2 · lifetrace 侧类型切 alias

**目标**：`ai_client.go` L663-L729 的 10 个 type 定义改成 `type xxx = aiclient.Xxx`；`lifeai` 里 `openAIRequest` / `openAIMessage` / `openAIResponse` 3 个私有类型也改成 alias。

**验证**：`go build ./...` + `go test ./internal/lifetrace/...` 全绿；测试断言 `var captured lifeTraceOpenAIRequest` 保持工作。

**风险**：alias 不允许在类型上加新字段。检查 aiclient 类型字段是否**完全覆盖** lifetrace 私有版本，否则退回 `type xxx aiclient.Xxx`（named type，允许方法但不允许字段扩展）。

### Task 3 · aiclient 补 tool_calls / 错误码识别

**目标**：
- 在 `aiclient/openai_toolcall.go` 加 `SendOpenAIRequest(ctx, cfg, req) (body []byte, statusCode int, err)`（低层裸 HTTP 发送，返回 raw body 让上层解析）
- 加 `IsOpenAIToolUnsupported(statusCode, body) bool`（把 `isLifeTraceAssistantToolUnsupported` 1:1 搬）
- 在 `aiclient/ark_toolcall.go` 加 `IsARKToolUnsupportedError(err) bool`（把 `strings.Contains(lower, "tools" ...)` 提炼）
- 加 `NewARKChatRequestWithTools(model, messages, tools, toolChoice, ...opts)` 便利构造

**验证**：`go build ./...`；给 `openai_toolcall_test.go` / `ark_toolcall_test.go` 各写 3 条断言（错误码识别 / body 解析）。

### Task 4 · lifeai 补 AssistantCaller

**目标**：在 `internal/lifetrace/ai/assistant_caller.go` 加：

```go
type AssistantCallOptions struct {
    ToolName    string
    ToolSchema  map[string]any
    MaxTokens   int          // 默认 420
    Temperature float32       // 默认 0.2
}
type AssistantStructuredResponse = /* lifetrace 侧 alias 转发到 prompts.AssistantStructuredOutput */

// 高层 API：外部只调这一个
func (Client) CallAssistantStructured(ctx, cfg TextConfig, systemPrompt, structuredPrompt string, opts AssistantCallOptions) (AssistantStructuredResponse, string, error)
```

内部走：`if cfg.Source == "openai" { OpenAI tool call → if unsupported { OpenAI JSON } } else { ARK tool call → if unsupported { ARK JSON } }`。JSON 降级用现有 `Client.GenerateJSON`。

**注意 tool schema 传参**：lifeai 不导入 lifetrace 包，所以 tool schema 只能通过参数注入。`AssistantStructuredResponse` 是 alias 到 `prompts.AssistantStructuredOutput`（第一刀已完成）。

**验证**：`go build ./...`；写 3 条 mock roundtripper 单测（tool 成功 / tool 400 触发降级 / JSON 成功）。

### Task 5 · lifeai 补 AssistantStreamer

**目标**：在 `internal/lifetrace/ai/stream.go` 加：

```go
type StreamChunk struct {
    Source string
    Model  string
    Chunk  string
    Error  string
    Done   bool
    Extra  any  // 供 lifetrace 挂 Action payload
}
type StreamHandler func(chunk StreamChunk)

func (Client) StreamAssistantARK(ctx, w *aiclient.SSEWriter, modelID, sysPrompt, userPrompt string, beforeDone func(StreamHandler)) error
func (Client) StreamAssistantOpenAI(ctx, w *aiclient.SSEWriter, cfg TextConfig, sysPrompt, userPrompt string, beforeDone func(StreamHandler)) error
```

内部：ARK 走 arkruntime SDK stream；OpenAI 走 `aiclient.OpenAIStreamClient`（Task 3 附赠）。ARK 侧 stream 的错误 chunk 格式与原实现字节等价。

**验证**：`go build ./...`；写 2 条 mock stream 单测。

### Task 6 · ai_client.go 瘦身

**目标**：
- 删除 L47-L560 的 assistant tool / stream 实现，改成 shim：

```go
func callLifeTraceAssistantStructuredResponse(ctx, cfg, sys, prompt string) (lifeTraceAssistantStructuredResponse, string, error) {
    schema := buildLifeTraceAssistantToolSchema()
    parsed, model, err := lifeai.NewClient().CallAssistantStructured(ctx, cfg, sys, prompt, lifeai.AssistantCallOptions{
        ToolName:   lifeTraceAssistantToolName,
        ToolSchema: schema,
        MaxTokens:  420,
    })
    return parsed, model, err
}

func streamLifeTraceAssistantARK(c *gin.Context, ctx context.Context, client *arkruntime.Client, model, sys, user string, beforeDone func(func(lifeTraceAssistantStreamChunk))) error {
    w, err := aiclient.NewSSEWriter(c)
    if err != nil {
        return err
    }
    return lifeai.NewClient().StreamAssistantARK(ctx, w, model, sys, user, adaptBeforeDone(beforeDone))
}
```

- 删除 L563-L648 的 `callLifeTraceTextAI` / `callLifeTraceTextAIWithMaxTokens` / `recordLifeTraceAIUsage`；**保留** `callLifeTraceTextAIWithMaxTokens` 作为 `achievement_handler.go` 的调用点（本刀不重构）
- 删除 L23-L45 的配置薄封装 → `readLifeTraceAIConfig` 保留 shim（handler 大量使用）；`ensureLifeTraceArkClient` 删除，全部改成 `lifeai.EnsureARKClient`
- 保留 L663-L729 的 alias（Task 2 完成）

**预期行数**：841 → ~80。

**验证**：`go build ./...` + `go test ./internal/lifetrace/...` 全绿。

### Task 7 · 全域 build/test/回归

**目标**：整个 server 编译测试全绿；手动 diff 一遍 ai_client.go 的 8 行调用（`callLifeTraceAssistantStructuredResponse` 等）在 handler 里的行为，确认参数完全等价。

**验证**：
- `cd server && go build ./...`
- `cd server && go test ./...`
- `python3 .agents/skills/encoding-guard/scripts/check_mojibake.py server/internal/lifetrace/ai_client.go server/internal/lifetrace/ai/assistant_caller.go server/internal/lifetrace/ai/stream.go server/internal/aiclient/*.go`
- **karpathy-coder 自检**：4 原则（surface assumptions / keep it simple / surgical changes / verifiable goals）

---

## 风险评估

### 高风险点

1. **Tool 不支持错误码识别**：`isLifeTraceAssistantToolUnsupported` 与 ARK SDK 错误信息识别是双通道降级的关键判定。**必须逐字节等价搬运**（`strings.Contains(body, "tools") ...`），否则降级路径会失效，用户可能看到 "AI 服务请求失败" 而不是回退到 JSON。
2. **SSE 流式的 `beforeDone` 回调**：这是 assistant 域插入 action payload 的钩子。`streamLifeTraceAssistantARK` 内的三个 `beforeDone(send)` 触发时机（EOF / stream error / done 信号）必须严格 1:1，否则 SSE 尾部消息会丢失。
3. **`bufio.Scanner` 的 buffer size**：L788 `scanner.Buffer(make([]byte, 0, 64*1024), 1024*1024)` 是防止长行截断的关键；aiclient 侧 stream 客户端要保留同规格。
4. **type alias vs named type**：如果 aiclient 侧新类型字段比 lifetrace 私有版本多（比如加了 `Stop` / `TopP`），alias 会因为 JSON tag 冲突让测试 `json.Unmarshal(&captured)` 失败——必须比对每个字段。

### 中风险点

5. **ARK arkmodel 的 `ChatCompletionMessage.Content` 是指针**：所有 `systemContent := strings.TrimSpace(sysPrompt); ... StringValue: &systemContent` 需要保留局部变量以避免闭包捕获问题。
6. **JSON body 序列化顺序**：`ai_handler_test.go` 里如果有对 request body 完整字符串（非结构体）断言，切 alias 后字段顺序改变可能失败——需要提前 grep 确认没有 raw JSON 断言。

### 低风险点

7. **单元测试基本用 mock roundtripper**：不需要真调 ARK / OpenAI。
8. **配置读取薄封装删除**：`readLifeTraceAIConfig` 已经是 `lifeai.ReadTextConfig` 转调，删掉零副作用。

### 已知不影响本刀

- `achievement_handler.go` 里 `callLifeTraceTextAIWithMaxTokens(ctx, client, textModel, prompt, 80)` 直接传 `*arkruntime.Client`。本刀保留函数原地，不改调用姿势。这条线未来可以单独一刀重构成 `lifeai.NewClient().CallTextARK(cfg, prompt, 80)`。

---

## 完成标准

- [ ] `ai_client.go` 从 841 行降到 ≤ 100 行，只留 type alias + shim
- [ ] `internal/aiclient` 新增 OpenAI 完整类型 + tool_calls + stream 客户端（导出，加文档）
- [ ] `internal/lifetrace/ai/` 新增 `AssistantCaller` / `AssistantStreamer` 双轨编排
- [ ] `cd server && go build ./...` 通过
- [ ] `cd server && go test ./...` 全绿
- [ ] `python3 .agents/skills/encoding-guard/scripts/check_mojibake.py <所有改动文件>` PASS
- [ ] `ai_handler_test.go` / `inbox_handler_test.go` 零改动仍能编译通过
- [ ] 无残留 `lifetrace.lifeTraceOpenAI*` 私有类型定义（都成为 aiclient 类型的 alias）
- [ ] Karpathy 4 原则自检结论写入最终回复
- [ ] 本 md 状态从"规划中"更新为"已落地"
- [ ] AGENTS.md / project_memory.md 无需更新（本刀是内部收编，无接口/依赖/产品状态变化）

---

## 依赖 & 前置

- 依赖：第四刀已落地（commit `be6506ea`），prompts 包稳定
- 无新增第三方依赖
- 无环境变量变化
- 无接口/路由变化
- 无数据模型变化
- 无产品能力变化

## 交付节奏建议

- Task 1-2 一起做（类型上收 + alias），单 commit
- Task 3 独立 commit（aiclient 补 tool 能力）
- Task 4 独立 commit（AssistantCaller）
- Task 5 独立 commit（AssistantStreamer）
- Task 6 独立 commit（ai_client.go 瘦身，最重的一步）
- Task 7 独立 commit（回归验证 + 编码扫描 + karpathy 自检）

**估计 6-7 个 commit，全部单向前进，任何一步 fail 可精确回滚。**
