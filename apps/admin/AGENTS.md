# Admin 后台协作入口

## AI 任务最小上下文入口

- `CLAUDE.md` -> `apps/admin/AGENTS.md` -> `src/App.tsx` -> `src/layouts/Layout.tsx`。
- 接口改动再读 `server/internal/router/router.go` 与对应 `src/api/`。

## 局部边界

- 保持 Ant Design 既有模式；审核、批量操作、导入导出和权限入口必须同时核对服务端 handler 与请求参数。
- 运营页面入口位于 `src/pages/admin-ops`；复用现有列表、筛选、表单和反馈组件，不为单页重建通用模式。
- 具体检查命令见 `docs/PROJECT_GUIDE.md`；路由、权限或提交链路改动补调用方联调证据。
