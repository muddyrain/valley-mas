# World Sim 协作入口

适用于 `apps/world-sim`，文明模拟实验。

## 按任务读取

| 任务 | 入口 |
|---|---|
| 玩法、参数或产品边界 | [当前设计](docs/TDD.md)；[旧平衡方案](docs/BALANCE_FIX_PLAN.md)只作历史参考 |
| 地图来源 | [来源定义](src/core/map/sources.ts)、[地图模块](src/core/map) |
| 模拟、剧本或状态 | [模拟](src/core/sim)、[剧本](src/core/scenario)、[状态](src/state) |
| 页面或渲染 | [应用](src/App.tsx)、[布局](src/ui/layout/AppLayout.tsx)、[Canvas](src/ui/canvas/MapCanvas.tsx) |

## 关键约束

地图来源当前为 `random` 与 `three-kingdoms`；新增来源同时核对状态、UI、回放、测试和设计。地图、模拟和表现分层，平衡规则留在模拟层。

## 验证与文档

地图、模拟、前线、回放与平衡变更执行受影响 Vitest，稳定性和平衡补专项验证；命令见 [项目指南](../../docs/PROJECT_GUIDE.md)。当前规则变化只更新 TDD，不向旧方案追加状态。
