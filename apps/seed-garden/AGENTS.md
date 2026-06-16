# Seed Garden AGENTS

本文件只补充 `apps/seed-garden` 的局部协作规则。全局规则、skill 选择、Git 规则和完成标准继承根目录 `AGENTS.md`。

## 功能定位

- AI 驱动的网页放置挂机收集小游戏「语种园」。
- 用户输入概念词 → AI 生成「概念植物」→ 挂机生长 → 收获入图鉴。
- 视觉风格锁定 Nintendo / 动森 Q 版 plush 风，**植物图全部来自预生成图库**，运行时不调用图片生成 API。
- 后端入口：`server/internal/garden`，路由前缀 `/api/v1/garden`。

## 路由与代码入口

- 应用入口：`src/main.tsx`、`src/App.tsx`。
- API 封装：`src/api/{garden,plant,interaction,encyclopedia}.ts`。
- 状态：`src/stores/{useAuthStore,useGardenStore}.ts`。
- 资产：`public/assets/encyclopedia/{N,R,SR,SSR}/*.png` + `manifest.json`。
- 设计文档：`docs/superpowers/specs/2026-06-16-seed-garden-design.md`。
- 实施计划：`docs/superpowers/plans/2026-06-16-seed-garden-plan.md`。
- Prompt 模板：`docs/superpowers/specs/seed-garden-prompt-v3.2.md`。

## 视觉与产品规范

- 全屏暖黄→桃橙渐晕背景，无白底。
- 植物图保持 1024×1024 透明感，**前端代码画卡框**，AI 不画 UI。
- 稀有度卡框颜色见设计文档 §7.6。
- 不要把游戏改成扁平 SaaS 风。

## 常用命令

```bash
cd apps/seed-garden && pnpm dev
pnpm --filter @valley/seed-garden typecheck
pnpm --filter @valley/seed-garden check
pnpm --filter @valley/seed-garden test
pnpm --filter @valley/seed-garden build
```

## 校验要求

- 类型/逻辑改动：至少 `pnpm --filter @valley/seed-garden typecheck`。
- 样式/lint：`pnpm --filter @valley/seed-garden check`。
- 测试：`pnpm --filter @valley/seed-garden test`。
- 接口契约改动：同步检查 `server/internal/garden`。
