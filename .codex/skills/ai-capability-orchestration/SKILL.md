---
name: ai-capability-orchestration
description: 统一 Valley MAS 在 Go 服务中接入和维护火山引擎 ARK AI 能力的方法。适用于新增、重构、排查任何调用 github.com/volcengine/volcengine-go-sdk/service/arkruntime 的接口，包括模型与环境变量接线、提示词设计、多模态输入处理、响应解析、降级策略、超时配置与 API 错误码映射。
category: general
---

# AI 能力编排（火山 ARK + Go）

当任务涉及 Valley MAS 的 Go Handler 调用火山 ARK 模型时，使用本技能。

## 执行流程

1. 先定位现有 AI 入口，不要先写新实现。
- 从 `server/internal/handler` 开始查找。
- 优先复用现有模式，再考虑抽象。
- 先阅读 `references/ark-go-entrypoints.md` 的现有入口清单。

2. 及早校验运行时配置。
- 必须检查 `ARK_API_KEY`。
- `ARK_BASE_URL` 允许空值，但需回退到 `https://ark.cn-beijing.volces.com/api/v3`。
- 模型字段必须使用接入点 ID：`ARK_VISION_MODEL`、`ARK_TEXT_MODEL` 都应以 `ep-` 开头。
- 配置缺失或格式错误时返回明确 `503`。

3. 按输入形态选择模型，并显式降级。
- 请求含图片时，优先走视觉模型。
- 无图或视觉模型不可用时，回退到文本模型。
- 降级路径必须写在代码里，行为可预测。

4. 写可控提示词，而不是开放式对话词。
- 明确输出格式（逐行、JSON 风格等），避免自由散文。
- 提示词聚焦任务本身，保持简短。
- 标签、命名类任务优先加候选约束，降低漂移。

5. 规范化多模态输入。
- base64 图片如果没有 data URL 前缀，补成 `data:image/jpeg;base64,`。
- 不直接把格式不明的图片字符串传给 ARK。

6. 复用稳定客户端策略。
- 高频接口优先使用包级单例（`sync.Once` + `*arkruntime.Client`）。
- 根据业务时延目标配置显式超时（`arkruntime.WithTimeout(...)`）。

7. 防御式解析模型输出。
- 清理空白、编号符号、无效前后缀。
- 回包前强制执行数量和长度约束。
- 输出为空或不合法时走可恢复错误分支。

8. 明确错误码映射。
- `400`：用户输入无效。
- `503`：AI 配置缺失或不合法。
- `502`：上游 AI 调用失败或响应解析失败。
- 错误文案要让调用方知道下一步如何修复。

## 约束

- 不在 Go 源码中硬编码 API Key。
- 不在 `.env.example` 写真实凭据。
- 只要新增或修改 ARK 环境变量，同步更新 `server/.env.example`。
- 当 2 个及以上 Handler 出现重复 AI 调用流程时，优先抽取共享 helper。

## 校验

- 修改 Go AI 相关代码后，执行 `cd server && go test ./...`。
- 改动接口行为后，至少做对应路由的冒烟验证。
- 特别验证两条分支：视觉降级到文本、模型返回异常时的兜底分支。
