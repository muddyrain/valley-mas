# 博客列表封面视觉多样化 —— 第一眼不撞脸的最小设计介入

> 关联 plan：`2026-07-01-blog-cover-ai-pick-and-external-images.md`（AI 选图 + 外部图源，负责"数据侧不撞脸"）
> 本 plan 只负责"设计侧不撞脸" —— 用最少的视觉工程给博客列表加"第一眼分类感"。

## Summary

用户诉求："我不太想每个博客的封面是同一张，第一眼看的时候博客都各有各的亮点封面，可以少量重复，但是第一眼不能在一页内很多相似的封面。"

用户在第二轮已经明确判定：
1. **不做无图态差异化**。项目会走 AI 选图 + 外部图源方向，博客几乎不会长期无封面。
2. **不改列表渲染**。三列 grid 的整齐感必须保住。
3. **选题决定第一眼**。用户明确表示"其实我的封面做一做二次元、风景、游戏那种壁纸就行了，很适合当壁纸。"
4. **只勾了 B 方向：分类色标胶囊**。

所以本轮的设计动作就一个：**在博客卡片图片区左上角新增分类胶囊**，让"第一眼色相"由 `category` 决定，不完全依赖图片本身。图片、blur 背景、无图 fallback、卡片外壳、排版一律不动。

## Current State Analysis

- 博客列表卡片入口：[BlogFeedCard.tsx](file:///Users/bytedance/Desktop/study/valley-mas/apps/web/src/components/blog/BlogFeedCard.tsx#L9-L14) 按 `postType` 分流到 [BlogPostCard.tsx](file:///Users/bytedance/Desktop/study/valley-mas/apps/web/src/components/blog/BlogPostCard.tsx) 或 [ImageTextPostCard.tsx](file:///Users/bytedance/Desktop/study/valley-mas/apps/web/src/components/blog/ImageTextPostCard.tsx)。
- 展示位置：[BlogList index.tsx:661](file:///Users/bytedance/Desktop/study/valley-mas/apps/web/src/pages/blog/BlogList/index.tsx#L661)、[Home index.tsx:811](file:///Users/bytedance/Desktop/study/valley-mas/apps/web/src/pages/Home/index.tsx#L811)、[MyPosts index.tsx:775](file:///Users/bytedance/Desktop/study/valley-mas/apps/web/src/pages/MyPosts/index.tsx#L775)、[MySpace index.tsx:416](file:///Users/bytedance/Desktop/study/valley-mas/apps/web/src/pages/MySpace/index.tsx#L416)。
- 现有胶囊（[BlogPostCard.tsx:108-137](file:///Users/bytedance/Desktop/study/valley-mas/apps/web/src/components/blog/BlogPostCard.tsx#L108-L137)）：
  - 左上：type 胶囊（"博客" / "图文"）`bg-black/45 backdrop-blur`
  - 左上第二个：**group 胶囊**（仅 public 模式）`bg-white/90 text-theme-primary`（读的是 `post.group.name`）
  - 右上：可见性胶囊 / 状态胶囊（creator / self 模式）
- Post 数据：[blog.ts:57-87](file:///Users/bytedance/Desktop/study/valley-mas/apps/web/src/api/blog.ts#L57-L87) 已经有 `category?: PostCategory` 字段（`{id, name, slug}`），后端已返回，前端此前未消费。
- 主题 token：`--color-theme-primary`、`--color-theme-primary-soft`、`--color-theme-soft`、`--theme-primary-rgb` 已支持 `data-theme` 切换（`rose / amber / ocean / forest`），[index.css:34-49](file:///Users/bytedance/Desktop/study/valley-mas/apps/web/src/index.css#L34-L49)。
- ImageTextPostCard 的封面区在 [ImageTextPostCard.tsx:71-108](file:///Users/bytedance/Desktop/study/valley-mas/apps/web/src/components/blog/ImageTextPostCard.tsx#L71-L108) 的 `PreviewSheet` 内，目前**没有任何胶囊**（因为是双列版式），本轮也在其左上加同款分类胶囊，保持视觉一致。

## Proposed Changes

### 1. BlogPostCard 新增 category 胶囊

**文件**：[apps/web/src/components/blog/BlogPostCard.tsx](file:///Users/bytedance/Desktop/study/valley-mas/apps/web/src/components/blog/BlogPostCard.tsx)

**位置**：图片左上角胶囊组，紧贴在现有 group 胶囊右侧（同一 `flex gap-1.5` 容器内）。

**样式**（复用 `theme-primary` 而不是新增 token）：
```
inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium
bg-theme-primary text-white shadow-[0_2px_8px_rgba(var(--theme-primary-rgb),0.25)]
```
和 group 胶囊 `bg-white/90 text-theme-primary` 形成"实心 / 空心"对比，让 category 更抢眼但仍在主题色范围内 —— 不引入新色板，切主题时自动跟随。

**展示条件**：
- `mode === 'public'` 时显示（和 group 胶囊同步）。
- `post.category?.name` 非空时才 render。
- 保留现有 group 胶囊；两者可同时存在（group 是"哪个博客组"，category 是"什么分类"，语义正交）。

**图标**：可选加一个 `Tag` lucide icon（12×12）作视觉锚点，与 group 胶囊的 `Bookmark` 图标区分。

### 2. ImageTextPostCard 新增同款胶囊

**文件**：[apps/web/src/components/blog/ImageTextPostCard.tsx](file:///Users/bytedance/Desktop/study/valley-mas/apps/web/src/components/blog/ImageTextPostCard.tsx)

**位置**：`PreviewSheet` 内绝对定位左上角，样式与 BlogPostCard 里的 category 胶囊完全一致。

**展示条件**：同上，`mode === 'public'` 且有 `category.name`。

### 3. 不做的事（防止范围扩张）

- **不改** [DefaultBlogCover.tsx](file:///Users/bytedance/Desktop/study/valley-mas/apps/web/src/pages/blog/components/DefaultBlogCover.tsx)。无图态占比低，且 AI 选图 + 外部图源上线后无图会更少。
- **不改** [BlogCoverMedia.tsx](file:///Users/bytedance/Desktop/study/valley-mas/apps/web/src/components/blog/BlogCoverMedia.tsx) 的 blur 背景层。用户已明确"改列表渲染会乱不拉几"。
- **不新增** hash-to-color 工具、不引入 `GRADIENTS` 数组、不写 `hashSeed`。
- **不新增** 后端字段（`coverColor` / `coverBackgroundColor` 都不做）。
- **不改** Post 数据结构、不改接口、不动 [blog.ts](file:///Users/bytedance/Desktop/study/valley-mas/apps/web/src/api/blog.ts)。
- **不做** 分类 → 固定色映射表。色相跟 `--theme-primary` 走全局主题，避免维护色板。
- **不做** 卡片间的 stagger 动画、不做主题色 hue-rotate、不改分页节奏。

### 4. 关于"选题决定第一眼"（不落到代码）

用户已经用需求 1（AI 选图）+ 需求 3（外部图源 Unsplash/Pexels）解决数据侧撞脸；同时明确偏好"二次元 / 风景 / 游戏壁纸"这类壁纸感封面。

**建议但本 plan 不实施**：在关联 plan 的 `CoverPickerDialog` 的搜索框里，把"anime / landscape / game wallpaper"作为默认候选关键词或最近搜索的种子，让用户第一次打开外部图源时就有明确起点。如需实施，走关联 plan 的迭代，不在本 plan 范围内。

## Assumptions & Decisions

- **决策 1**：视觉多样化的最大杠杆是"内容选题 + 分类识别"，而不是"色板抽奖"。理由：色板抽奖在 4-5 张一屏时反而会显得花哨、消耗品牌一致性，而分类胶囊是可读的信号，能让用户 300ms 内判断"这是本目录里我关心的类别"。
- **决策 2**：胶囊色不做分类 → 独立色映射。若给分类固定色（如"技术=蓝、生活=橙"），会和 `data-theme` 冲突（切了 rose 主题后蓝色分类胶囊就变异色）。全部用 `--color-theme-primary` 让主题切换保持自洽。
- **决策 3**：public 模式才显示 category 胶囊。creator / self 模式已有可见性、状态胶囊，再堆一个会拥挤；且创作者自己看自己的博客不需要"这属于哪个分类"的即时提示。
- **决策 4**：不动 ImageTextPostCard 的双列版式，只在其 PreviewSheet 加同款胶囊即可。

## Verification

前端类型检查与样式校验：
- [ ] `pnpm --filter @valley/web exec tsc --noEmit`
- [ ] `pnpm --filter @valley/web check`

手动验收（三处列表页 + 一个空态）：
- [ ] `/blog` 列表页：`BlogList` 三列网格，卡片左上出现 category 胶囊，颜色跟随当前 `data-theme`。
- [ ] `/`（首页）"最新动态"区：`Home` 三列网格同样显示。
- [ ] `/space/:code`（创作者空间 MySpace）：public 模式下显示 category 胶囊；自己看时不显示。
- [ ] 有 category 但无 group 的博客：只显示 type + category，不出现空胶囊。
- [ ] 无 category 的博客：只显示 type（+ group）；不出现"undefined"或空块。
- [ ] 切换 `data-theme` 到 rose / amber / ocean / forest：胶囊色跟随变化。
- [ ] 图文类博客（ImageTextPostCard）：PreviewSheet 左上出现同款胶囊。

编码校验：本次改动只涉及 tsx，不含新增 CJK 文案；无需 `encoding-guard`。

## 计划文档同步

- 本文件本身即计划产物，作为 C 档临时工作产物存放在 `.trae/documents/`，任务关闭后可由 owner 决定清理。
- 不影响任何长期功能状态、接口路径、数据模型或产品方向 —— category 字段和 group 胶囊模式已经存在，本轮只是把 category 从"接口已有 / 前端未消费"变成"前端消费"，不算新增能力。
- 无需更新 `docs/PROJECT_GUIDE.md`、`apps/web` 下的任何长期文档或子项目 PLAN.md。
