# AI Agent Content Search Design

> 状态：核心实现完成；日期筛选、CST 上下文 fake ARK 请求捕获与全量 Go 回归已完成，待浏览器与真实 ARK 调用验收

## 目标

让 AI 工作台中的私有智能体能够按需检索当前 owner 自己创建的博客和资源，并通过既有 Agent runtime 把结果交给模型生成回答。

## 范围

- 工具名固定为 `content.search`。
- 仅搜索 `user_id` 等于当前应用 owner 的博客和资源。
- 输入支持可选关键词 `query`，以及可独立提供的 `createdFrom` / `createdTo`（CST `YYYY-MM-DD`）；三者至少提供一项，服务端去除关键词空白并限制长度。
- 提供任一日期端点时，只按当前 owner 的博客 `CreatedAt` 检索；`createdFrom` 包含当天起点，`createdTo` 以次日 00:00 为排他上限，按 `created_at DESC` 最多返回 5 条。纯关键词检索仍搜索博客和资源。
- 每次最多返回 5 条，字段仅包含类型、ID、标题、摘要和站内链接。
- 仅调试运行使用当前草稿版本和该应用已绑定的工具；不新增公共调用 API。

## 边界

- 不搜索其他用户的公开内容、私信、评论、下载/收藏记录或知识库原文。
- 不创建、更新或删除任何内容。
- 没有绑定 `content.search` 的应用不会向模型暴露该工具。
- 模型提出未绑定、未知或格式错误的工具调用时，运行记录为失败并返回明确错误，不降级为任意数据库查询。

## 架构

1. 在 `server/internal/ai/tools/content` 实现 `content.search`；`resolveAIAppTools` 为每次运行创建 Registry 并注册 `SearchTool`，schema 描述可选 `query`、`createdFrom` 与 `createdTo` 参数。
2. 工具创建时持有 owner ID；纯关键词时在博客和资源表使用 owner 过滤、关键词匹配与固定 limit 查询；有日期端点时仅在博客表按 CST 创建时间范围、可选关键词和固定 limit 查询，返回安全的 JSON 结果。
3. `DebugAIApp` 和私有会话读取版本化工具绑定，仅将该应用绑定且在 Registry 中存在的工具传给 Agent runtime；若绑定 `content.search`，system prompt 会附加当前 CST 与相对日期、未写年份月份须先标准化为 ISO 日期范围的指令。
4. Agent runtime 产生的 `tool_call` 与 `tool_result` 事件通过现有 SSE 协议输出；持久化运行记录只存工具名、参数长度、结果数量和错误码摘要。
5. 无工具调用时保持现有普通 ARK 调试路径的行为与 SSE 响应兼容。

## 错误与限制

- 空条件、超过上限、非法日期或反转日期范围：工具返回结构化输入错误，不查询数据库。
- 查询失败：工具返回受控失败结果，不暴露数据库错误。
- 未绑定/未注册工具：返回 `AI_TOOL_NOT_ALLOWED`。
- Agent loop 达到最大步数：返回 `AI_AGENT_MAX_STEPS_EXCEEDED`，保留已有输出摘要。

## 验收

- 绑定 `content.search` 的 owner 智能体能在调试或私有会话中调用它并得到自己的博客/资源结果。
- 同一关键词或日期范围不会返回其他 owner 的内容；日期范围不会返回资源，且结果按创建时间倒序、至多 5 条。
- `createdFrom` 与 `createdTo` 可分别独立使用，日期上限的当天内容包含在结果中；空条件、错误日期和倒置范围不查询数据库。
- 未绑定工具时模型不可调用该工具。
- SSE 能看到工具调用和结果摘要；运行历史不保存完整搜索结果。
- fake ARK 捕获的绑定 `content.search` 调试和私有会话 system message 都带当前 CST 及日期归一化指令，未绑定调试请求保持原始 prompt；无工具调用的现有调试、知识库引用和 ARK 配置错误分支保持兼容。
