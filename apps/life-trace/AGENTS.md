# Life Trace AGENTS

本文件只补充 `apps/life-trace` 的局部协作规则。全局规则、通用 skill、Git 规则和完成标准继承根目录 `AGENTS.md`。

## 功能定位

- `apps/life-trace` 是 Life Trace 用户端，负责 Today、计划、AI、踪迹、Pantry、提醒、家庭空间和个人设置。
- 技术栈为 React + Vite + TypeScript + Tailwind，状态管理以 Zustand 为主，服务端 API 位于 `server/internal/lifetrace`。
- 产品计划唯一入口是 `apps/life-trace/docs/PLAN.md`。

## 路由与代码入口

- 应用路由入口：`src/App.tsx`
- 页面目录：`src/pages`
- 共享组件：`src/components`
- API 封装：`src/api`
- 全局状态：`src/store`
- 产品文档：`docs/PLAN.md`

## 开发规范

- 任何 Life Trace 用户可见 UI、文案、设置项、按钮、说明语、空状态、Badge 改动，必须启用 `ui-copy-boundary-guard`。
- Life Trace 页面样式、loading、交互状态改动，优先对照现有组件和页面模式，不要把开发者分析、实现解释或“页面说明”写进用户界面。
- 设置页和概览页优先展示状态、摘要和动作，不写“这里会影响哪里”“这个入口已经被整理到哪里”这类元说明。
- Pantry、提醒、家庭空间、AI、Today 之间的依赖关系如果需要解释，写进最终回复、文档或注释，不写进界面。
- 前端改动不使用 Playwright 自动验收；最终回复说明需要用户手动看的关键路径。

## 常用命令

```bash
cd apps/life-trace && pnpm dev
pnpm --filter @valley/life-trace exec tsc --noEmit
pnpm --filter @valley/life-trace exec vitest run
```

## 校验要求

- 仅类型或逻辑改动：至少运行 `pnpm --filter @valley/life-trace exec tsc --noEmit`。
- 页面或文案改动：补充相关测试，并运行针对性 vitest。
- 中文文案、Markdown、协作规则或 skill 改动：运行 `encoding-guard`。
