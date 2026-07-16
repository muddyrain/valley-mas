# AI App 私有会话与受控工具（P8）Implementation Plan

> 状态：实施中；服务端、Web 与自动化回归已完成，`content.search` 日期检索已在真实浏览器确认，待真实 ARK 的其余场景验收
> 设计：[P8 设计](../specs/2026-07-16-ai-app-private-conversations-design.md)

## Task 1：版本化工具快照与会话数据模型

- [x] 新增 `AIAppVersionToolBinding`、`AIAppConversation`、`AIAppConversationMessage` 与 `AIAppConversationToolTrace` 模型；为 owner/app/version/conversation 查询添加必要索引。
- [x] 新增向前兼容的 PostgreSQL 迁移 `054_add_ai_app_private_conversations.sql`，补 `AIAppRun.ConversationID` 并创建上述表；GORM AutoMigrate 同步纳入模型。
- [x] 把工具绑定从运行时 app 级查询收敛到 version 快照：创建、保存、恢复和工作流镜像版本均复制前一版本的工具快照；旧版本从现有 `ai_app_tool_bindings` 回填一次。
- [x] 为模型、迁移和版本快照补 SQLite 回归测试。

## Task 2：抽取版本固定的私有 Agent 会话运行时

- [x] 复用既有版本配置、RAG、工具注册、ARK 客户端和安全运行摘要边界，在会话运行时保持与单轮调试一致的约束。
- [x] 实现会话 CRUD 和 owner/agent/version 校验；创建会话时固定草稿版本，删除操作级联软删除消息、运行和工具轨迹。
- [x] 实现历史裁剪、用户消息先写入、成功后写助手消息、失败/取消只写运行摘要的状态机。
- [x] 让 Agent loop 将安全工具轨迹回调给会话运行时；只记录名称、状态和耗时，不记录参数或原始结果。
- [x] 新增 JSON/SSE 聊天 API，并验证 ARK 配置缺失为 `503`；上游/agent 失败与取消待真实 ARK 验收。

## Task 3：服务端测试与安全回归

- [x] 覆盖跨用户隔离、会话版本固定、工具快照固定，以及配置缺失时只保留用户消息。
- [x] 覆盖 `content.search` 的 owner 传递、工具轨迹脱敏、SSE 正常完成、取消和上游失败；使用本地假 ARK 流，验证不泄露原始工具结果。
- [x] 完整 Go 回归确认公开 API 与旧 `/ai/agents/*` 行为未回归；公开 API 未新增私有会话访问路径。

## Task 4：Web 会话入口与流式体验

- [x] 扩展 `apps/web/src/api/aiWorkbench.ts` 的会话类型、CRUD 请求和 SSE 解析；使用 `AbortController` 隔离会话请求。
- [x] 新增会话页和路由，并在 AI App 编辑页提供明确入口；复用既有工作台布局与 shadcn 组件。
- [x] 实现会话列表、新建、删除、消息回放、引用摘要、工具状态、流式回答、停止与错误恢复；URL 与会话身份保持同步。
- [x] 采用已选定的阅读式工作台视觉方向，统一私有会话和智能体编辑页；工具执行摘要与参考来源抽为共享 shadcn/ui 展示组件，并将工具调用收敛为轻量状态条。
- [x] 私有会话独占 AI App 工作区：全站快速助手在工作区外提供智能体选择器，选择后创建并进入对应专属会话；会话画布改为全高布局，并收敛到统一边框 token。
- [x] 为纯数据转换和 SSE 状态收敛增加前端测试：末尾未带空行的 EOF SSE 事件仍须交付；保留浏览器验证用于真实流式、路由和布局。

## Task 5：验证与文档同步

- [x] 已通过 Web SSE 回归、类型检查、生产构建及完整 Go 测试；全量 Web check 仍有既有 Biome 问题。Harness 受本机环境阻塞：`pnpm` 的 WSL 包装器挂载失败，Git Bash 又受 Windows Store `python3` 占位程序和兼容符号链接被检出为普通文件影响。
- [x] 对新增 Markdown、Go 和 Web CJK 文本运行 encoding 检查；运行 `git diff --check`。
- [ ] 已在真实浏览器确认 `content.search` 可按日期检索 owner 博客；仍需在已配置 ARK 的环境手动验证多轮、RAG、版本固定、取消及跨用户隔离，并记录无法自动化的真实模型分支。
- [x] 已更新 [AI 工作台实施清单](2026-07-14-ai-workbench-platform.md) 的 P8 当前状态、入口、接口和自动验收证据；完成状态仍等待真实验收。
