# Life Trace 协作入口

适用于 `apps/life-trace`，生活记录与计划 PWA。

## 按任务读取

| 任务 | 入口 |
|---|---|
| 产品范围、状态或优先级 | [说明](README.md)、[产品计划](docs/PLAN.md) |
| 页面与请求状态 | [应用](src/App.tsx)、[请求层](src/api/request.ts) |
| Today、Pantry、提醒、家庭空间或 AI | 对应页面与状态流，联查 [服务端路由](../../server/internal/lifetrace/routes.go) |

## 关键约束

跨页面可见的数据与相关 API 一起核对，避免只更新单一入口。家庭空间和提醒权限由服务端与设备能力共同验证。

## 验证与文档

移动布局、拍照、PWA 通知、真实模型输出或真机权限需对应运行时证据；自动化不能代表设备能力时写明手工验收路径。命令见 [项目指南](../../docs/PROJECT_GUIDE.md)。长期范围和状态变化更新计划，普通修复无需更新计划。
