# P13.1：提示词库实施计划

## 状态

已完成。2026-07-19 已完成服务端回归与人工页面验收：个人提示词库可创建、编辑、归档，并可在大模型节点中搜索、预览和插入正文。

## 1. 领域模型与接口

影响范围：`server/internal/model`、`server/internal/database`、`server/internal/router`、`server/internal/handler`。

1. `AIPrompt` 只保存 owner、名称、描述、正文和归档时间。
2. 提供 owner 私有的创建、读取、更新、归档与列表接口。
3. 覆盖 owner 隔离、正文必填、更新和归档的服务端测试。

## 2. 资源中心

影响范围：`apps/web/src/api/aiWorkbench.ts`、`apps/web/src/pages/AIResources`。

1. 保留 `tab=prompts`，使用普通资源列表和编辑弹窗管理提示词库。
2. 编辑项只展示名称、描述、正文与归档操作；不展示草稿、发布、版本、变量或试验台。
3. AI 优化保持提案式写入：用户确认后才替换当前正文，保存仍需单独确认。

## 3. LLM 节点插入

影响范围：`apps/web/src/components/workflow/properties/LLMPropertyForm.tsx`、新增提示词库选择弹窗。

1. 系统指令旁提供“提示词库”按钮。
2. 弹窗支持搜索、列表、正文预览和确认插入。
3. 确认后把正文追加到当前系统提示词；不写入 `promptRef`，不改写节点输入或输出配置。

## 4. 验证与收尾

1. 运行 Web 类型检查、定向前端校验和 `cd server && go test ./...`。
2. 人工验收：创建提示词 → 保存 → 在大模型节点打开提示词库 → 预览并插入 → 保存/运行节点 → 修改词库正文后确认已有节点不变。
3. 根据真实验收结果更新 P13 路线图，不将实现完成误标为产品验收完成。
