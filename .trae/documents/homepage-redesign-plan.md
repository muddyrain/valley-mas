# 首页 shadcn 默认风格重设计

## Context

当前首页有大量自定义渐变、光晕、3D 粒子动画、复杂阴影和装饰性 backdrop-blur，严重偏离 shadcn 默认风格。用户要求：
1. 简化为 shadcn 默认风格
2. 移除 HomeAICoreDialog 入口
3. 保留 HomeAuthorProfileCard（清理样式）

## 实施步骤

### Phase 1: 删除文件与清理导入

**Step 1**: 删除 3 个组件文件
- `HomeEnergyCore.tsx` — 包装层（HeroImmersiveShowcase + HomeAICoreDialog）
- `HeroImmersiveShowcase.tsx` — Canvas 粒子 + 3D tilt
- `HomeAICoreDialog.tsx` — AI 对话弹窗

清理 `index.tsx` 中对应 import 和调用。

**Step 2**: 从 `HomeSectionBlocks.tsx` 删除 `QuickEntryCard`（含自定义渐变背景、光晕、高光线），清理 `index.tsx` 中对应 import 和调用。

### Phase 2: 清理 HomeSectionBlocks.tsx 组件样式

**Step 3**: SectionHeading — 移除 `shadow-sm backdrop-blur`，统一 tracking，badge 改为 `bg-accent`

**Step 4**: HeroStat — 去除 `rounded-[26px]`→`rounded-xl`，`border-border/50`→`border-border`，移除 `backdrop-blur-md`、`hover:-translate-y-1.5`、`hover:shadow-md`，移除 accent prop（统一 `bg-primary`）

**Step 5**: HeroRibbon — 统一 `rounded-full`，移除 `backdrop-blur-md`、`hover:-translate-y-0.5`、`hover:shadow-md`，`border-border/50`→`border-border`

**Step 6**: EmptyPanel — `rounded-[32px]`→`rounded-xl`，`bg-card/70`→`bg-card`，移除 `backdrop-blur`

**Step 7**: ResourceFavoriteButton — `bg-[hsl(var(--color-background)/0.22)]`→`bg-muted`，移除 `backdrop-blur`，`border-card/70`→`border-border`

### Phase 3: 重写 HomeLabSection.tsx

**Step 8**: 删除 colorMap，LabCard 内直接用 shadcn 语义 token（bg-card, bg-accent, text-primary 等）

**Step 9**: LabCard — `rounded-[28px]`→`rounded-xl`，移除所有 shadow-[...]、glow、高光线、扫光层，`hover:-translate-y-1.5`→`hover:bg-accent hover:shadow`

**Step 10**: 外层容器 — `rounded-[30px]`→`rounded-xl`，移除背景光晕装饰层，`shadow-[0_28px_72px...]`→`shadow-sm`，`border-border/12`→`border-border`

### Phase 4: 清理 HomeAuthorProfileCard.tsx

**Step 11**: `border-border/50`→`border-border`，`bg-accent/50`→`bg-accent`，`bg-card/86`→`bg-card`，嵌套 Card `border-border/50`→`border-border`

### Phase 5: 重写 Home/index.tsx 主页面

**Step 12**: 移除 Hero 装饰 — 两个旋转渐变圆、HomeEnergyCore、信号总览嵌套网格、快速通道 QuickEntryCard

**Step 13**: Hero 重构 — 从单个大 Card 改为 `<section>`，用 `<h1>` + `<p>` 替代 EnergyCore 展示舱，保留 CTA 按钮、搜索框、HeroStat、AuthorProfileCard

**Step 14**: 资源区域 — `border-border/50`→`border-border`，`bg-card/90`→`bg-card`，`hover:-translate-y-1 hover:shadow-lg`→`hover:shadow`，图片遮罩渐变改用 `from-background/80 to-transparent`，`bg-accent/50`→`bg-accent`，`bg-accent/30`→`bg-muted`

**Step 15**: 博客区域 — `border-border/50`→`border-border`，`bg-card/68`→`bg-card`

**Step 16**: 底部 CTA 重写 — 用 shadcn Card 替代自定义按钮卡片，移除 `hover:-translate-y-1 hover:shadow-lg`、`bg-accent/50` 图标圆

### Phase 6: 校验

**Step 17**: 全局搜索残留非 shadcn 模式（rounded-[2-3]0px, shadow-[, bg-[radial/linear-gradient, backdrop-blur, animate-[spin, hover:-translate-y-, [perspective:, border-border/\d, bg-accent/\d）

**Step 18**: TypeScript 编译 — `pnpm --filter @valley/web exec tsc --noEmit`

## 关键文件

| 文件 | 操作 |
|---|---|
| `apps/web/src/pages/Home/index.tsx` | 重写 Hero + 清理全页样式 |
| `apps/web/src/pages/Home/components/HomeSectionBlocks.tsx` | 删 QuickEntryCard + 清理 5 个组件样式 |
| `apps/web/src/pages/Home/components/HomeLabSection.tsx` | 删 colorMap + 重写 LabCard + 清理外层 |
| `apps/web/src/pages/Home/components/HomeAuthorProfileCard.tsx` | 清理 border/bg 透明度 |
| `apps/web/src/pages/Home/components/HomeEnergyCore.tsx` | 删除 |
| `apps/web/src/pages/Home/components/HeroImmersiveShowcase.tsx` | 删除 |
| `apps/web/src/pages/Home/components/HomeAICoreDialog.tsx` | 删除 |

## 复用现有组件

- `Card`, `CardContent`, `CardHeader`, `CardTitle`, `CardDescription` — shadcn Card 组件
- `Badge` — shadcn Badge 组件（替代自定义 rounded-full badge）
- `Button` — shadcn Button（CTA 按钮保持不变）
- `Input` — shadcn Input（搜索框保持不变）
- `BlogFeedCard` — 博客卡片组件（保持不变）

## 计划文档同步

需检查并更新首页相关功能描述（移除 AI 中枢入口是功能状态变化）。如无首页专项计划文档，在最终回复中说明无需同步的原因。
