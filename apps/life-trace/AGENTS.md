# Life Trace 协作入口

## AI 任务最小上下文入口

- `CLAUDE.md` -> `apps/life-trace/AGENTS.md` -> `src/App.tsx` -> `src/api` -> `server/internal/lifetrace` -> `docs/PLAN.md`。

## 局部边界

- `docs/PLAN.md` 是 Life Trace 的长期产品计划入口；普通修复不更新计划。
- Today、Pantry、提醒、家庭空间与 AI 改动同时检查相关 API、状态流和跨页面可见结果；不得只修改单一入口造成状态不同步。
- 移动端布局、拍照、PWA 通知、真实模型输出或真机权限改动，在浏览器自动化无法代表真实设备能力时补充清晰的手工验收路径。
- 具体检查命令见 `docs/PROJECT_GUIDE.md`。
