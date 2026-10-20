# Admin 协作入口

适用于 `apps/admin`，负责管理与运营界面。

## 按任务读取

| 任务 | 入口 |
|---|---|
| 页面、导航或布局 | [路由](src/App.tsx)、[布局](src/layouts/Layout.tsx) |
| 运营功能 | [运营页面](src/pages/admin-ops)及相邻组件 |
| 审核、权限、批量操作或导入导出 | [请求层](src/api)、[服务端路由](../../server/internal/router/router.go)，再读对应 handler |

## 关键约束

复用 Ant Design 与现有列表、筛选、表单和反馈模式。审核、批量写入和权限同时核对请求参数与服务端执行，不能只隐藏前端入口。

## 验证与文档

路由、权限和提交链路验证调用方联调及错误反馈；命令见 [项目指南](../../docs/PROJECT_GUIDE.md)。接口变化同步服务端契约，普通页面维护无需新建产品文档。
