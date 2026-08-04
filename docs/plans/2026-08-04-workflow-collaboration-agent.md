# 工作流专用协作智能体实施计划

> 状态：实施中（核心直接写入、后台任务与统一右栏已落地；风险确认和真实模型运行时验收待完成）
> 设计：[`../specs/2026-08-04-workflow-collaboration-agent-design.md`](../specs/2026-08-04-workflow-collaboration-agent-design.md)

## 目标

将工作流旧 `WorkbenchCopilot` 迁移为固定的工作流专用协作智能体：使用与智能体一致的对话、附件、后台任务、确认和执行反馈，服务端直接以可合并、可撤销的节点操作修改工作流草稿。

新工作流协作任务已切换到专用后台任务主路径；旧 `/ai/workbench/copilot/*`、旧会话和旧提案模型暂时保留兼容读取，不再由工作流编辑器创建新提案。

## 实施原则

- 行为改动严格先补测试、先看到失败，再修改实现。
- 先建立修订、操作和后台任务真源，再替换 UI；不先做无后端保障的视觉迁移。
- 共享 canonical task/message/UI 协议，AI App 与工作流保留领域适配器。
- 所有迁移先兼容读取，不删除旧会话、提案、接口或表。
- 不新增第三方依赖；如实施中发现确需新增依赖，单独说明取舍并取得确认。

## 阶段 0：锁定现状与契约

- [ ] 为 `apps/web/src/components/workbench/WorkbenchCopilot.tsx`、`apps/web/src/api/workbenchCopilot.ts` 和工作流右侧面板补齐现有行为测试，记录多会话、提案和浏览器内应用旧行为。
- [ ] 为 `server/internal/handler/ai_workbench_copilot.go` 补齐唯一时间线迁移、后台任务创建、冲突和撤销的失败测试入口。
- [ ] 为 `server/internal/workflow/operations.go` 增加节点字段、连线、删除目标和局部布局触及路径的测试矩阵。
- [ ] 记录 PostgreSQL/MySQL 现有协作会话数量、每目标重复会话和 pending 提案分布，迁移测试使用固定 fixture，不读取生产敏感内容。

验收：旧路径测试保持通过，新契约测试明确失败，失败原因分别落在缺失的任务、修订、变更和 UI 行为上。

## 阶段 1：抽取共享对话与任务呈现协议

- [ ] 从 `AIAppConversation` 页面中抽取最小 canonical message/task/approval/view model，不把 AI App DTO 扩散到共享组件。
- [ ] 让 `ConversationComposer`、`ConversationMessageBubble`、执行区和确认卡通过 props、callback 与 slot 注入领域行为。
- [ ] 保持智能体会话的排队、停止、部分回复、正式消息替换、附件和自动滚动行为不变。
- [ ] 增加共享组件测试，覆盖 `queued / running / waiting_approval / succeeded / failed / cancelled / conflicted`。

主要范围：

- `apps/web/src/components/ai/ConversationComposer.tsx`
- `apps/web/src/components/ai/ConversationMessageBubble.tsx`
- `apps/web/src/pages/AIAppConversation/AssistantExecution.tsx`
- `apps/web/src/pages/AIAppConversation/index.tsx`
- 新的共享 task/message adapter 或 hook，具体路径按现有 `components/ai` 边界就近确定

验收：智能体页面视觉和行为无回归；共享组件不直接 import AI App 或工作流 API。

## 阶段 2：建立工作流修订与可逆操作内核

- [x] 给工作流草稿增加单调修订号，PostgreSQL/MySQL 使用同版本迁移并同步数据库注册。
- [x] 扩展 `workflow.WorkflowOperation`，补齐配置字段前置条件、触及路径、局部位置变化和逆向操作生成。
- [x] 实现基线草稿、最新草稿和 AI 操作之间的确定性冲突判定；非冲突操作应用到最新草稿，冲突返回精确节点、字段或连线。
- [x] 把应用操作、Graph v4 校验、AI App 草稿同步、修订递增和变更记录写入同一事务。
- [x] 实现服务端原子撤销；任一触及路径已变化时拒绝整次撤销。
- [x] 所有手动与自动保存携带修订号；旧页面的保存冲突不得覆盖服务端最新草稿。

主要范围：

- `server/internal/workflow/operations.go`
- `server/internal/handler/workflow.go`
- `server/internal/model/ai_platform.go` 或工作流模型文件
- `server/internal/dbmigration/{postgres,mysql}`
- `apps/web/src/api/workflow.ts`
- `apps/web/src/pages/WorkflowEditor/index.tsx`
- `apps/web/src/components/workflow/useWorkflowHistory.ts`

验收：并发手动修改与 AI 操作的非冲突合并、冲突拒绝、事务回滚、跨刷新撤销和 owner 隔离均有自动化覆盖。

## 阶段 3：迁移为持久工作流协作任务

- [ ] 从 AI App worker 中抽取通用状态、领取、并发上限、取消、部分输出和恢复协调接口；AI App 通过现有领域 adapter 保持行为。
- [x] 为工作流协作增加持久任务、附件、风险确认和已应用变更模型。
- [ ] 同一工作流严格串行；不同工作流可并行；owner 的 AI App 与工作流任务共享 3 个运行、20 个未完成任务上限。
- [x] 服务启动时恢复可安全重跑的工作流协作任务；已进入写入事务的任务通过幂等键避免重复应用。
- [x] 任务执行使用固定工作流系统指令、当前能力目录、受控只读工具和 Graph operation 工具。
- [x] 附件复用智能体文件类型、大小、解析、owner 隔离和单轮注入规则。
- [ ] 单次技能只注入本任务；绑定工作流节点必须来自用户明确意图和可审计操作。

主要范围：

- `server/internal/handler/ai_app_tasks.go`
- `server/internal/handler/ai_workbench_copilot.go` 或拆分后的工作流协作 handler/service
- `server/internal/ai/agent`
- `server/internal/ai/tools` 下的工作流只读与修改工具
- `server/internal/model/ai_platform.go`
- `server/internal/database/database.go`
- `server/internal/dbmigration/{postgres,mysql}`
- `server/internal/router/router.go`

验收：离开页面和服务重启后任务继续；同工作流不并发写入；任务终态、部分回复、停止和冲突均可重放。

## 阶段 4：权限、试运行、通知与唯一时间线

- [x] 新增唯一工作流协作读取、任务、取消、附件、上下文重置和变更撤销接口；风险确认决策接口待接入实际试运行动作。
- [ ] 草稿修改和静态校验直接执行；有副作用试运行、发布和触发器变更创建 owner 私有确认。
- [ ] 确认参数只保存在服务端，页面读取风险摘要和指纹；批准只对当前任务的同一调用有效。
- [x] 为成功、失败和冲突创建幂等站内通知；等待确认通知与工作流列表状态待补。
- [x] 迁移旧多会话：最近会话成为 canonical，上下文重置使用边界标记，旧会话和 pending 提案只读保留。
- [ ] 保留旧 `/ai/workbench/copilot/*` 只读兼容；新功能开关关闭时不领取新任务。

验收：发布、触发器和风险试运行无法绕过确认；旧数据不丢失；重复 worker 终态处理不产生重复通知。

## 阶段 5：工作流编辑器接入统一体验

- [x] 用共享 `ConversationComposer`、`ConversationMessageBubble` 和任务状态替换 `WorkbenchCopilot` 的独立消息、输入和提案 UI。
- [x] 移除新建会话、历史会话、接受/拒绝提案和候选 JSON；加入上下文重置。
- [ ] 在右侧“AI 协作”Tab 展示任务、未读、确认、冲突和完成状态；切换到节点信息不影响任务。
- [x] 增加工作流结果卡：变更摘要、节点定位、风险、查看画布和撤销。
- [x] AI 更新到达时在不抢焦点的前提下同步画布；整次修改映射为一个浏览器撤销项。
- [ ] 节点信息增加“询问 AI”，发送时冻结节点上下文；结果卡节点反向定位节点信息。
- [x] 接入模型、图片/PDF/Markdown/TXT/JSON/CSV 附件和停止按钮；单次技能选择待补。
- [ ] 保持桌面单右栏与移动端全高 Sheet；任务完成不强制切回 AI Tab。

主要范围：

- `apps/web/src/components/workbench/WorkbenchCopilot.tsx`（迁移后删除或收敛为领域装配层）
- `apps/web/src/components/workflow/WorkflowWorkspacePanel.tsx`
- `apps/web/src/pages/WorkflowEditor/index.tsx`
- `apps/web/src/api/workbenchCopilot.ts`（迁移或替换为工作流协作 API）
- `apps/web/src/components/ai/*`

验收：桌面与移动端均可提交附件任务、离开再返回、查看后台状态、定位节点、处理确认和跨刷新撤销；画布宽度和节点配置交互无回归。

## 阶段 6：迁移、验证与文档同步

- [ ] 运行 PostgreSQL/MySQL 迁移与重复执行测试，核对旧会话、旧消息和 pending 提案数量。
- [ ] Web 运行类型、静态、定向测试、全量测试与覆盖率门禁。
- [ ] Server 运行受影响包测试、全量 `go test ./...` 和构建。
- [ ] 使用用户当前 Chrome 会话验证桌面与移动端关键路径、附件、后台完成、确认、冲突、撤销、通知和控制台。
- [ ] 使用可用模型至少跑通一次“附件生成工作流 → 后台直接修改 → 离开返回 → 撤销”。
- [ ] 同步 `docs/PROJECT_GUIDE.md` 中多会话、提案和交互描述；更新或归档旧上下文副驾驶文档引用。
- [ ] 完成验收后把本计划标记完成并移入 `docs/plans/archive/2026-08/`。

## 测试矩阵

### Server

- 唯一时间线 owner 隔离、旧多会话确定性迁移和上下文重置。
- 同工作流 FIFO、跨工作流并行、跨 AI App/工作流 owner 并发上限。
- queued/running/waiting_approval 取消和服务重启恢复。
- 附件类型、大小、数量、纯附件消息、跨 owner 拒绝和单轮上下文。
- 非冲突节点/字段/连线合并；同字段、删除目标、结构前置条件冲突。
- Graph 校验失败零写入；事务失败不递增修订、不保存变更。
- 正向与逆向操作、跨刷新撤销、后续修改导致整次撤销拒绝。
- 风险试运行、发布、触发器确认的批准、拒绝、指纹与参数隐藏。
- 终态通知幂等和旧 pending 提案不应用。

### Web

- 单时间线加载、上下文重置、旧记录折叠和无会话切换入口。
- 输入、模型、技能、附件、发送、排队、停止和任务正式消息替换。
- Tab 状态、未读标记、输入与滚动保持；节点双向定位。
- 结果卡摘要、风险、撤销成功、撤销冲突和不展示候选 JSON。
- 服务端 AI 更新与本地画布同步为单个撤销项；旧修订保存冲突不覆盖。
- 桌面右栏和移动全高 Sheet 的 loading、失败、确认与冲突状态。

### 运行时验收

1. 打开工作流，附加 PDF 并要求新增流程；消息入队后离开页面。
2. 后台完成并产生站内通知；返回后画布显示局部布局的新节点。
3. 在 AI 执行期间修改无关节点，确认双方改动都保留。
4. 修改 AI 同时触及的字段，确认 AI 进入冲突且不覆盖用户内容。
5. 撤销无冲突 AI 变更；再制造后续相关编辑，确认整次撤销被拒绝。
6. 请求运行含写入或非幂等 HTTP 的工作流，确认必须批准后才执行。

## 最小验证命令

实现阶段按真实改动范围先定向、再扩大：

```bash
pnpm --filter @valley/web exec tsc --noEmit
pnpm --filter @valley/web check
pnpm --filter @valley/web test
pnpm --filter @valley/web test:cov
cd server && go test ./...
cd server && go build ./cmd/server ./cmd/migrate
pnpm check:docs-links
pnpm check:plans-index
```

涉及 CJK 文案、迁移说明和 Markdown 时，对改动文件运行 `encoding-guard`；最终补 `git diff --check`。

## 完成定义

- 规格中的 12 条验收标准全部有自动化或明确运行时证据。
- 工作流 AI 新任务不再创建多会话或 pending 提案，不再由浏览器应用候选整图。
- 智能体既有后台任务、附件、确认和会话体验无回归。
- 旧协作数据可读、可审计且未被误应用。
- 文档与实际接口、模型、功能开关和完成状态一致。

## 当前状态

- [x] 产品决策与设计规格已形成。
- [x] 分阶段实施、测试矩阵与完成定义已形成。
- [x] 核心业务代码、数据库迁移、直接写入、后台队列、附件、唯一时间线和统一右栏已落地。
- [ ] 风险试运行/发布/触发器确认、单次技能、工作流列表状态和真实模型浏览器验收待完成。
- [ ] 浏览器与真实模型验收尚未开始。
