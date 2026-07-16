# 工作流模板与编辑器体验 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development or executing-plans task-by-task.

**Goal:** 将预置模板变为只读详情和显式复制流程，并完成持久化编辑器的自动保存、稳定节点详情和可视化变量引用。

**Architecture:** `workflowTemplates.ts` 与 `workflowTemplateGraphs.ts` 是平台模板来源；新模板详情页只读渲染它们。只有详情页 Copy 调用既有 `createWorkflow` 创建用户实例，编辑器只加载 `?id=` 资源并承担保存、运行、版本与资料库绑定。

**Tech Stack:** React 19、React Router 7、TypeScript、React Flow、shadcn/ui、Sonner、既有 Go 工作流 API。

---

## 文件边界

| 路径 | 责任 |
| --- | --- |
| `apps/web/src/pages/workflowTemplates.ts` | 模板元数据、开放状态与查询。 |
| `apps/web/src/pages/workflowTemplateGraphs.ts` | 不可变来源图与克隆入口。 |
| `apps/web/src/pages/WorkflowTemplateDetail/index.tsx` | 只读详情、预览和复制状态。 |
| `apps/web/src/pages/Workbench/index.tsx` | 模板卡片进入详情，工作流列表只呈现实例。 |
| `apps/web/src/App.tsx` | 详情路由、路由标题和旧链接重定向。 |
| `apps/web/src/pages/WorkflowEditor/index.tsx` | 仅持久化编辑、自动保存与运行前 flush。 |
| `apps/web/src/components/workflow/*` | 固定节点、右侧运行详情、变量胶囊。 |

## Task 1: 收敛模板来源与只读详情

- [x] 提取两个开放模板的 Graph v2 快照并返回克隆。
- [x] 新增模板详情路由，读取 `templateId`、处理不存在和未开放模板、渲染只读节点图预览。
- [x] 使用现有 `Card`、`Badge`、`Button` 和主题 token；详情页不使用创建、保存、运行或编辑状态。
- [x] 工作台模板卡片仅导航至详情，禁用模板保持不可复制。

## Task 2: 在唯一复制点创建用户实例

- [x] 模板详情“复制到工作台”以模板名称和克隆图调用 `createWorkflow`，请求中禁用并避免重复提交。
- [x] 成功后用 `navigate('/workbench/edit?id=…', { replace: true })` 进入实例编辑器；失败后保留详情和重试入口。
- [x] 删除编辑器的模板自动创建逻辑；`?template=` 旧链接改为重定向模板详情，编辑器不再加载模板来源图。

## Task 3: 持久化实例的自动保存

- [x] 保留 700ms 防抖、revision 快照和串行补发，限定为已有工作流 ID。
- [x] 名称、节点、边和配置变更均标脏；手动保存和运行先 flush 最新快照，失败时不运行。
- [x] 路由切换、SSE、版本、资料库请求均按当前实例会话隔离，旧请求不得回写新页面。

## Task 4: 稳定画布与右侧运行详情

- [x] 移除节点折叠与节点内运行详情，右侧面板承载配置/本次运行。
- [x] 复核节点点击、失败自动定位与固定连线布局；补齐类型与静态回归检查。

## Task 5: 行内变量胶囊

- [x] 提取 Graph v2 上游变量与模板 token 纯工具。
- [x] 新增受控变量编辑器，渲染合法/非法 token、插入选择器和删除动作。
- [x] 接入 LLM 系统提示词、LLM 提示词与知识库查询；运行前校验只允许上游变量。

## Task 6: 验证与计划同步

- [x] 更新 `docs/superpowers/plans/2026-07-14-ai-workbench-platform.md` 的模板生命周期和编辑体验状态。
- [x] 运行 `pnpm --filter @valley/web exec tsc --noEmit`、定向 Biome、`pnpm --filter @valley/web build`、编码检查和工作流回归脚本；记录现有全量检查基线失败。
- [ ] 浏览器验收：模板详情不创建工作流、Copy 后出现一个实例、自动保存/运行、右侧节点详情与变量插入。
