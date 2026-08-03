# WorldSim AGENTS

## AI 任务最小上下文入口（本文件）

- `AGENTS.md` -> `apps/world-sim/AGENTS.md` -> `apps/world-sim/src/App.tsx` -> `apps/world-sim/src/ui/layout/AppLayout.tsx` -> `apps/world-sim/docs/TDD.md`
- 文档治理/约束变更任务：补读 `docs/README.md` -> `docs/PROJECT_GUIDE.md` -> `docs/HARNESS_ENGINEERING.md`。


本文件只补充 `apps/world-sim` 的局部协作规则。全局规则、skill 选择、Git 规则和完成标准继承根目录 `AGENTS.md`。

## 功能定位

- `apps/world-sim` 是沙盒文明模拟游戏实验，聚焦随机地图、三国地图模式、势力扩张、地形战斗、前线压力、编辑模式和回放系统。
- 当前实现使用 React 19 + Vite + TypeScript + Pixi.js + Zustand，UI 使用 CSS Modules 与少量 shadcn/radix 底层组件。
- 游戏长期设计文档优先看 `docs/TDD.md`；平衡专项记录看 `docs/BALANCE_FIX_PLAN.md`。

## 路由与代码入口

- 应用入口：`src/App.tsx`。
- 页面布局：`src/ui/layout/AppLayout.tsx`。
- 地图渲染：`src/ui/canvas/MapCanvas.tsx`，底层渲染与前线工具看 `src/game`。
- 地图生成：`src/core/map`，地图模式注册表在 `src/core/map/sources.ts`。
- 模拟核心：`src/core/sim`。
- 剧本系统：`src/core/scenario`。
- 全局状态：`src/state/store.ts` 与 `src/state/slices/*`。
- UI 面板：`src/ui/sidebar`、`src/ui/topbar`、`src/ui/logpanel`、`src/ui/replaybar`。

## 开发规范

- 修改玩法、地图、模拟参数、剧本、编辑模式、回放或架构时，按影响范围同步 `docs/TDD.md` 或相关设计文档；普通局部修复不制造无关文档更新。
- 当前运行时地图来源只保留 `random` 与 `three-kingdoms` 两种模式；不要重新引入 GeoJSON、外部地图数据或 `/public/geo` 资源，除非任务明确要求恢复该能力并同步设计文档。
- 新增地图模式先改 `src/core/map/sources.ts`，再检查 `mapSlice`、Sidebar、Replay meta、测试和 TDD 描述。
- 模拟逻辑优先保持纯函数和可测试入口，避免把规则写进 UI 组件或 Pixi 渲染层。
- UI 文案、操作入口和快捷键变更要同步检查 `src/ui` 相关面板，确保 HUD、Sidebar 和 ReplayBar 状态一致。
- 不修改 `dist`、`.turbo`、`tsconfig.tsbuildinfo`、`node_modules` 等生成或依赖目录。

## AI Coding 约束（行为改动默认顺序）

- 行为改动（地图生成、模拟参数、前线判定、回放序列、编辑器规则）默认按以下顺序执行：
  1. 先补齐或更新测试。
  2. 先跑受影响测试，确认先有失败。
  3. 实现改动。
  4. 再跑受影响测试并确认通过。
- 行为问题涉及共享文档或平衡链路时，优先补充最小复现回归用例。

## 本地 Preflight 约束（AI Coding 默认前置）

- 行为任务在实现前先跑：
  1. `pnpm --filter @valley/world-sim check`。
  2. `pnpm --filter @valley/world-sim typecheck`。
  3. `pnpm --filter @valley/world-sim exec vitest run`（先做受影响范围）。
- 涉及 map/sim/战斗路径改动再补 `pnpm --filter @valley/world-sim test:stability`。

## 常用命令

```bash
pnpm --filter @valley/world-sim dev
pnpm --filter @valley/world-sim typecheck
pnpm --filter @valley/world-sim check
pnpm --filter @valley/world-sim exec vitest run
pnpm --filter @valley/world-sim test:balance
pnpm --filter @valley/world-sim test:stability
pnpm --filter @valley/world-sim test:longrun
```

## 校验要求

- 类型或状态层改动：至少运行 `pnpm --filter @valley/world-sim typecheck`。
- UI、样式或 lint 相关改动：运行 `pnpm --filter @valley/world-sim check`。
- 地图、模拟、前线、回放或平衡逻辑改动：运行相关 vitest；范围不确定时跑 `pnpm --filter @valley/world-sim exec vitest run`。
- 仅改协作文档或设计文档且包含中文时，运行 encoding 定向检查；无需跑应用级编译时在最终回复说明原因。
- 行为类高风险提测前最小门禁：
  1. `pnpm --filter @valley/world-sim check`。
  2. `pnpm --filter @valley/world-sim typecheck`。
  3. `pnpm --filter @valley/world-sim exec vitest run`（最小受影响）。
  4. 地图/模拟/稳定性改动再补 `pnpm --filter @valley/world-sim test:balance` 或 `pnpm --filter @valley/world-sim test:stability`。
