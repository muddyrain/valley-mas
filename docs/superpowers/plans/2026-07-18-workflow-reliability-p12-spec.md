# P12：工作流运行可靠性与 AI 协作闭环规格

## 状态与前置条件

状态：已完成。2026-07-19 已在真实 ARK 环境验证立即停止后稳定进入 `cancelled` 终态。

P12 以 Graph v4 为唯一工作流协议，不恢复 Graph v2/v3 或旧业务节点。既有工作流数据保留，不以清理为前置条件；用户已在真实 ARK 环境验收封面节点新语义：默认直接生成一次，或按已有上游布尔变量在 false 时跳过、true 时仅生成一次。

## 目标

把当前“创建草稿—试运行—查看节点详情”的基础能力收敛为可信闭环：

1. 用户始终能知道当前运行或 AI 规划停在哪一步。
2. 每个失败都有稳定错误类别、可读原因和安全下一步。
3. 取消、重试、历史和 AI 修复不会重复触发写入副作用。
4. LLM 与 End 的输出契约能够表达文本、JSON、对象、数组和文件引用，并在保存前完成类型校验。
5. 一组固定用例可反复验证工作流或 AI 提案没有回归。

## 非目标

- 不新增循环、批处理、任意 HTTP、代码、SQL、数据库节点或外部凭据。
- 不引入团队协作、定时/Webhook 触发器或多环境发布。
- 不让 AI 直接保存、运行、发布、批准副作用或修改已发布版本。
- 不把完整原始输入、私有知识正文、密钥或内部提示词写入运行历史。

## 设计

### 1. 统一运行追踪

每次运行固定生成不可变 `runId`，并使用以下运行与节点状态：

- 运行：`queued`、`running`、`cancelling`、`cancelled`、`success`、`failed`。
- 节点：`queued`、`running`、`success`、`error`、`skipped`、`cancelled`。

运行事件按单调 `sequence` 写入并通过 SSE 转发，至少包含：运行开始、节点开始、节点成功/跳过/失败、运行完成。事件载荷只保存脱敏后的输入摘要、输出摘要、耗时、错误代码与可行动说明。

节点错误必须归类为：`GRAPH_INVALID`、`INPUT_INVALID`、`REFERENCE_TYPE_MISMATCH`、`MODEL_NOT_CONFIGURED`、`MODEL_UPSTREAM_FAILED`、`TOOL_FAILED`、`TIMEOUT`、`CANCELLED`、`BUDGET_EXCEEDED`。界面展示短原因和建议动作，原始诊断仅在 owner 可见的折叠详情中展示。

### 2. 取消与重试

- 新增 `POST /workflows/:workflowId/runs/:runId/cancel`；只允许 owner 取消仍在执行的运行，服务端上下文和 SSE 都必须结束为 `cancelled`。
- 重试始终创建新的运行，不修改旧运行。P12 只允许“重新运行整图”；从中间节点恢复、断点恢复和批量重试留待运行恢复专题。
- 图中包含 write 或 `model_and_storage` capability 时，重试前必须明确提示可能副作用；用户确认后才创建新运行。
- 运行历史抽屉按时间、状态和版本筛选；选择历史运行只加载只读 trace，不覆盖当前草稿。

### 3. 输出契约

- LLM 节点支持 `text`、受控 JSON Schema、对象、数组和文件引用输出声明；模型非结构化响应不满足 JSON Schema 时为节点错误，不静默降级为字符串。
- Tool capability 与 Subworkflow 的输出 Schema 必须转换为相同的字段契约。
- 子工作流引用锁定“曾发布”的不可变版本；子工作流发布新版本不得让已经保存的父工作流失效。
- End 输出映射必须选择字段、类型和值；固定值和变量引用使用统一编辑控件。
- 保存、AI 提案应用和运行前使用同一类型检查器，禁止只在前端提示而服务端可绕过。

### 4. AI 协作处理状态

AI 协作请求具有 `requestId` 和生命周期：`reading_context`、`planning`、`validating`、`proposed`、`clarifying`、`failed`、`cancelled`。SSE 每 5 秒至少发送一次真实心跳或阶段事件。

- 缺失 ARK 配置返回 `503 MODEL_NOT_CONFIGURED`。
- 上游失败或结构化响应无法修复返回 `502 MODEL_UPSTREAM_FAILED`。
- 草稿哈希冲突、非法操作或上下文无效返回 `400` 或 `409`，并保留用户消息。
- 停止按钮必须取消服务端上下文，而不是仅关闭浏览器连接。
- 失败运行被带入 AI 上下文时，仅提供裁剪后的节点状态、错误类别和安全摘要；AI 返回新 operations 提案，仍需用户确认应用和运行。

### 5. 测试用例与回归

新增 owner 私有的工作流测试用例：输入、可选文件元数据、预期输出规则、绑定版本和最近结果。首期规则只支持：字段存在、类型匹配、精确值、字符串包含、数值范围、JSON Schema。

- 运行测试用例必须创建独立测试运行，不能复用或篡改普通运行记录。
- 发布前可选择执行全部或选定测试；失败禁止提升版本，但允许保留草稿。
- 不实现自动评测、模型评分或 A/B 测试；它们需要独立的评估设计。

## 数据与接口

新增或扩展的数据边界：

- `WorkflowRun`：版本 ID、状态、开始/结束时间、取消信息、风险摘要。
- `WorkflowNodeRun`：顺序、状态、输入/输出安全摘要、错误分类、尝试次数、耗时、capability ID。
- `WorkflowRunEvent`：owner 私有的顺序事件；保留期和摘要大小由服务端限制。
- `WorkflowTestCase` 与 `WorkflowTestResult`：仅绑定 owner 的不可变工作流版本。
- `AIWorkbenchCopilotRequest`：请求 ID、处理状态、取消时间、非敏感失败类别；不保存完整内部提示词。

接口方向：

- `POST /workflows/:workflowId/runs/:runId/cancel`
- `GET /workflows/:workflowId/runs/:runId/trace`
- `GET|POST /workflows/:workflowId/test-cases`
- `POST /workflows/:workflowId/test-cases/:testCaseId/run`
- `POST /ai/workbench/copilot/requests/:requestId/cancel`

现有工作流运行、历史、SSE 与副驾驶路径保持兼容；新字段均可选，以保证旧运行记录可读取。

## 验收标准

- 取消 LLM 运行后，运行和当前节点都在可预期时间内显示 `cancelled`，SSE 完整结束。
- 模型缺配置、上游失败、超时、引用类型错误和能力预算超限都显示不同错误类别与操作建议。
- 运行详情能够在不移动主卡连线锚点的前提下查看；历史 trace 只读且不污染当前草稿。
- 结构化 LLM 输出、Tool 输出、Subworkflow 输出和 End 映射的类型检查在前后端结果一致。
- AI 协作在规划超时、客户端停止、服务端取消、草稿冲突和非法 operation 下均能保留会话并结束 loading。
- 覆盖“封面节点默认一次生成、绑定上游 false 时零生成调用、true 时仅一次调用”“失败后 AI 修复提案”“含写入节点的重试二次确认”等回归。

## 风险与决策

- 运行事件会扩大存储量；采用摘要、大小上限、保留期和 owner 隔离，而不是保存任意 JSON。
- 取消只能尽力中断已经调用的第三方模型；UI 必须区分“取消请求已发出”和“已确认取消”。
- 严格 JSON 输出会增加模型失败率；默认只为需要对象的任务开启，不强制所有 LLM 节点使用。
- 测试用例可能产生写入；首期仅允许无副作用图运行测试，含写入图必须使用显式安全测试目标或禁止执行。
