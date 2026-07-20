# P13.3.2：选择器（Switch）节点实施计划

> 前置规格：[选择器（Switch）节点设计规格](../specs/2026-07-20-p13-switch-node-design.md)。代码已实现，待浏览器运行时验收；未把该验收误标为完成。

## Task 1：Graph 合约、校验与执行器

影响：`server/internal/workflow/types.go`、`registry.go`、`validate.go`、`execute.go`，新增或扩展 workflow 单元测试。

1. [x] 增加 `NodeTypeSwitch`、动态输出 handles、严格配置解析与纯执行器。
2. [x] 复用 condition / intent 的单分支调度，不复制执行引擎。
3. [x] 覆盖 string 的完整 Graph case/default 命中与未选分支跳过，以及 number/boolean 的执行器严格匹配；配置、类型和所有出口连线由统一 Graph 校验覆盖。

完成条件：Switch 不产生模型或写入调用，且每次恰好选中一个出口。

## Task 2：服务端运行与 AI 边界

影响：`server/internal/handler/workflow*.go`、`workflow_ai.go`、`ai_workbench_copilot.go` 及相关回归。

1. [x] 把 Switch 输出契约、动态 handle 与运行详情接入工作流保存、运行和历史。
2. [x] 更新 AI 规划与 operations 边界：只有显式枚举字段才可建议 Switch；自由文本继续建议 Intent。
3. [x] Graph v4 与全量 Go 回归覆盖现有运行 trace、owner 隔离和工具安全边界；AI 真实模型提案留待浏览器验收。

完成条件：AI 不会用 Switch 冒充文本分类，运行历史能说明命中的出口。

## Task 3：Web 编辑器

影响：`apps/web/src/api/workflow.ts`、`apps/web/src/components/workflow/` 下的节点选择、节点卡、配置表单、校验与变量输出定义。

1. [x] 新增“选择器”节点与属性表单，复用 `Button`、`Input`、变量选择器和现有动态 handle 模式。
2. [x] 支持新增、删除、编辑 case 与值类型；默认出口始终展示但不可删除。
3. [x] 更新保存前预检、变量 Token 选择、运行节点详情和错误状态。
4. [x] 完成 Web 类型检查与本次文件的 Biome 校验；不新增依赖或自定义组件体系。

完成条件：用户能在桌面和移动选择器中配置 2 至 8 条分支，界面不允许产生缺失默认出口的可运行图。

## Task 4：验证与验收

1. [x] 定向 Go 测试、`cd server && go test ./...`、Web 类型检查与本次文件的 Biome 校验通过。全量 Web check 被既有文件 lint/换行问题阻断。
2. [x] 变更文件编码检查通过；`pnpm check:harness` 因本机 WSL2 的 ext4.vhdx 路径丢失而无法启动，非代码失败。
3. [ ] 浏览器验收：本地 Web 已启动，但未登录访问会重定向到登录页；仍需在可用账号下创建 `contentType` 输入 → 配置文章/资源/default 三路 → 各运行一次 → 查看其他路径为 skipped → 保存、刷新与重试后保持相同行为。
4. [x] 更新 P13.3 状态与项目指南的 Graph v4 节点清单；真实运行未验收，路线图保持“进行中”。
