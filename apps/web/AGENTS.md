# Web 前台协作入口

## AI 任务最小上下文入口

- `CLAUDE.md` -> `apps/web/AGENTS.md` -> `src/App.tsx` -> `src/stores/useAuthStore.ts`。
- 跨接口改动再读 `server/internal/router/router.go`。

## 局部边界

- 保持既有主题 token、布局和 loading 组件；列表的搜索、筛选、分页必须与 URL 刷新和浏览器回退一致。
- UI 模式先查 `src/components/ui/`；确需生成 shadcn 组件时使用仓库已安装版本，并在新增依赖前取得确认。
- 认证、路由、上传下载和公开/私有内容改动补浏览器关键路径证据；具体检查命令见 `docs/PROJECT_GUIDE.md`。
