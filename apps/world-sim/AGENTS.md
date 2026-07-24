# WorldSim AGENTS

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
