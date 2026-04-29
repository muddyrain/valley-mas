# AI Mind Arena - 开发任务清单

## 当前阶段
Phase 1：AI 接入与基础辩论流程

## 当前正在做
Task 4：实现 Round 1（立场表达）

---

## Phase 1：AI 接入

### [x] Task 1：接入真实模型（Doubao / OpenAI-compatible）
- 目标：在不改变 `/api/v1/mind-arena/...` API、SSE 事件协议和前端调用方式的前提下，使用 `.env` 中的 `AI_PROVIDER`、`AI_BASE_URL`、`AI_API_KEY`、`AI_MODEL` 接入真实 Doubao / OpenAI-compatible 模型。
- 涉及文件：`server/internal/ai/service.go`、`server/internal/ai/openai_compatible.go`、`server/internal/router/router.go`、`server/internal/mindarena/service.go`、`server/internal/mindarena/types.go`
- 输入：议题 `topic`、模式 `mode`、人格数量 `personaCount`、`.env` 中的模型配置
- 输出：真实模型可生成 personas、三轮辩论消息和 judge result，并继续通过 `POST /api/v1/mind-arena/debates`、`GET /api/v1/mind-arena/debates/:id`、`GET /api/v1/mind-arena/debates/:id/stream` 对外提供能力
- 依赖：现有 `OpenAICompatibleService`、`AI_PROVIDER=openai-compatible` 选择逻辑、现有 `mindarena` 路由与 `Service`

### [x] Task 2：模型配置与 fallback 完善
- 目标：完善 provider 配置、默认值、超时、错误信息和 mock fallback，确保未配置密钥、上游不可用或真实模型失败时仍可自动回退到 MockAIService。
- 涉及文件：`server/internal/ai/service.go`、`server/internal/ai/openai_compatible.go`、`server/internal/ai/mock.go`、`server/internal/mindarena/handler.go`、`server/internal/mindarena/service.go`
- 输入：`.env` 配置、AI provider 可用性、上游错误响应
- 输出：稳定的真实模型 / mock 双通路，明确的错误提示，以及不影响本地开发和演示的 fallback 行为
- 依赖：Task 1、现有 `MockAIService`、当前 `/api/v1/mind-arena/...` 接口契约

---

## Phase 2：AI 辩论核心

### [x] Task 3：定义 5 个 AI 人格
### [ ] Task 4：实现 Round 1（立场表达）
### [ ] Task 5：实现 Round 2（互相反驳）
### [ ] Task 6：实现 Round 3（总结建议）
### [ ] Task 7：生成裁判结果与分数

---

## Phase 3：SSE 流式输出

### [ ] Task 8：实现 message 流式推送
### [ ] Task 9：实现 judge / done / error 事件

---

## Phase 4：前端对接

### [ ] Task 10：前端创建辩论
### [ ] Task 11：前端监听 SSE
### [ ] Task 12：渲染多角色对话流
### [ ] Task 13：渲染裁判结果和分数面板

---

## Phase 5：体验优化

### [ ] Task 14：loading / empty / error 状态
### [ ] Task 15：支持率动态变化
### [ ] Task 16：分享能力

---

## 执行规则（必须遵守）

- 每完成一个 Task，必须把 [ ] 改为 [x]
- 必须更新“当前正在做”
- 不允许跳过任务
- 所有实现必须遵守 README.md 和 AGENTS.md
- 不允许破坏现有 API 和 UI 结构
