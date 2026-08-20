# WorldSim 协作入口

## AI 任务最小上下文入口

- `CLAUDE.md` -> `apps/world-sim/AGENTS.md` -> `docs/TDD.md` -> `src/App.tsx` -> `src/ui/layout/AppLayout.tsx`。

## 局部边界

- 地图、模拟、剧本、状态与渲染分别从 `src/core/map`、`src/core/sim`、`src/core/scenario`、`src/state`、`src/ui/canvas/MapCanvas.tsx` 进入。
- 当前地图来源只保留 `random` 与 `three-kingdoms`；新增模式先改 `src/core/map/sources.ts`，再检查状态、UI、回放、测试和 `docs/TDD.md`。
- 地图、模拟、前线、回放或平衡改动补受影响 Vitest；稳定性或平衡改动补专项测试。具体命令见 `docs/PROJECT_GUIDE.md`。
