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

### 交付前置约束（AI Coding 默认执行顺序）

- 行为改动（尤其涉及状态流、提醒触发、AI 产出、时间/列表筛选、表单提交、权限判断）默认执行：
  1. 先补齐/更新对应测试；
  2. 先跑受影响测试并确认；
  3. 再改实现；
  4. 再跑受影响测试兜底。
- 不能跳过测试步骤，除非改动仅为文案/样式且无可观测行为边界。

- 任何 Life Trace 用户可见 UI、文案、设置项、按钮、说明语、空状态、Badge 改动，必须启用 `ui-copy-boundary-guard`。
- Life Trace 页面样式、loading、交互状态改动，优先对照现有组件和页面模式，不要把开发者分析、实现解释或“页面说明”写进用户界面。
- 设置页和概览页优先展示状态、摘要和动作，不写“这里会影响哪里”“这个入口已经被整理到哪里”这类元说明。
- Pantry、提醒、家庭空间、AI、Today 之间的依赖关系如果需要解释，写进最终回复、文档或注释，不写进界面。
- 前端运行时验证优先复用用户当前 Chrome 会话；不可用时可使用仓库已有的自动化或当前环境提供的 headless 工具。不要仅为一次验收新增 Playwright 等浏览器依赖；仍无法验证时再说明人工验收关键路径。

## 常用命令

```bash
cd apps/life-trace && pnpm dev
pnpm --filter @valley/life-trace exec tsc --noEmit
pnpm --filter @valley/life-trace check
pnpm --filter @valley/life-trace exec vitest run
```

## 本地 Preflight 约束（AI Coding 默认前置）

- 约定行为改动任务在进入实现前先跑：
  1. `pnpm --filter @valley/life-trace check`（静态检查）。
  2. `pnpm --filter @valley/life-trace exec tsc --noEmit`（类型基础线）。
  3. 受影响行为测试：先跑定向 `pnpm --filter @valley/life-trace exec vitest run`，确保先有可观测失败。
- 触及 `src` 共享边界（store/api/lib）后，补跑一次更大范围测试集合。

## 校验要求

- AI Coding 约束：实现前必须先有“相关测试文件变更”，实现后至少跑一轮受影响测试。
- 以 `pnpm --filter @valley/life-trace exec vitest run` 作为行为改动的基本验证入口；高风险改动跑更大范围。
- 行为类高风险改动提测前最小门禁：`pnpm --filter @valley/life-trace check` + `pnpm --filter @valley/life-trace exec tsc --noEmit` + `pnpm --filter @valley/life-trace exec vitest run`（或与改动等价的最小受影响范围）。

- 仅类型或逻辑改动：至少运行 `pnpm --filter @valley/life-trace exec tsc --noEmit`。
- 页面交互、状态或业务行为变化：补充与风险相称的测试，并运行针对性 vitest。
- 纯文案、纯样式或无行为的布局微调不强制新增单测；运行类型、lint 或浏览器验证中与改动相符的部分，并说明未覆盖的运行时风险。
- 实际修改 CJK/非 ASCII 文案、Markdown、协作规则或 skill 时：运行定向 `encoding-guard`。
