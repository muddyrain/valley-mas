# Shadcn 工作台布局收敛 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 AI 工作台和全站左侧导航收敛为紧凑、可访问且符合现有 shadcn/ui 基线的布局。

**Architecture:** 保持 `WorkbenchLayout` 的壳层职责、`Sidebar` 的导航和用户菜单职责，以及工作台与智能体面板的既有数据流。仅替换布局类、容器层级和展示密度；折叠状态继续由 `useLayoutStore` 持久化。

**Tech Stack:** React 19、React Router 7、Tailwind 4、shadcn/ui、Base UI、Zustand、Lucide。

---

## 文件边界

- `apps/web/src/layouts/Sidebar.tsx`：侧栏宽度、品牌栏内折叠按钮、紧凑导航和用户区。
- `apps/web/src/layouts/WorkbenchLayout.tsx`：主内容最小宽度和关闭 AI 面板后的紧凑入口。
- `apps/web/src/layouts/AIPanel.tsx`：窄屏下不占据主内容宽度。
- `apps/web/src/pages/Workbench/index.tsx`：页面标题、操作区、模板和工作流容器密度。
- `apps/web/src/components/workbench/AIAppsPanel.tsx`：智能体区的标题、空态、骨架和实体项密度。

## 测试策略

当前 `@valley/web` 未配置 React 组件测试运行器；新增测试依赖需要另行确认，且本次不改变业务逻辑、数据契约或状态 API。因此不新增脆弱的源码字符串测试。通过现有静态检查以及浏览器中的展开/折叠、导航、创建、删除和窄屏视觉验证覆盖改动风险。

### Task 1: 收紧侧栏与壳层

**Files:**

- Modify: `apps/web/src/layouts/Sidebar.tsx`
- Modify: `apps/web/src/layouts/WorkbenchLayout.tsx`
- Modify: `apps/web/src/layouts/AIPanel.tsx`
- Test: `pnpm --filter @valley/web exec tsc --noEmit`

- [x] **Step 1: 记录当前行为基线**

运行本地 Web 应用并确认 `sidebarCollapsed` 的展开、折叠、Tooltip、导航 Link 与用户菜单仍分别由 `Sidebar` 和 `useLayoutStore` 承担；不改动该 store 的字段或方法。

- [x] **Step 2: 将折叠控件收进品牌栏**

展开态在品牌栏右侧渲染既有 `toggle`；收起态将同一按钮定位在侧栏右边缘中部，使用已有 `Button`：

```tsx
<Button
  type="button"
  variant="ghost"
  size="icon-sm"
  onClick={toggle}
  aria-label={collapsed ? '展开侧栏' : '折叠侧栏'}
  className="ml-auto shrink-0"
>
  {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
</Button>
```

删除底部整行折叠按钮。展开栏宽保持 `w-56`，折叠栏为 `w-14`；所有导航项使用 `Button` 或可访问的 `Link` 渲染，折叠态保留 Tooltip。

- [x] **Step 3: 收紧壳层中非核心入口**

将关闭状态的 AI 面板入口改为既有 `Button` 的 `size="icon"`，移除手动 `h-12 w-12` 覆盖；主内容加 `min-w-0`。窄屏把侧栏固定为图标列，并只在 `md` 及以上展示 AI 面板与其唤起入口，避免两侧面板同时挤压主内容。

- [x] **Step 4: 运行类型检查**

Run: `pnpm --filter @valley/web exec tsc --noEmit`

Expected: exit 0。

### Task 2: 收敛工作台信息层级

**Files:**

- Modify: `apps/web/src/pages/Workbench/index.tsx`
- Modify: `apps/web/src/components/workbench/AIAppsPanel.tsx`
- Test: `pnpm --filter @valley/web check`

- [x] **Step 1: 收紧标题与操作区**

将工作台外层控制在 `max-w-7xl`，页头使用 `gap-4 border-b pb-6`，标题使用 `text-3xl font-semibold tracking-tight`；资料库保留 `variant="outline"`，新建工作流保持默认主按钮。窄屏下通过现有 `flex-wrap` 自然换行，不新增状态或路由。

- [x] **Step 2: 使用小尺寸 Card 减少重复边框**

模板和工作流使用 `Card size="sm"`，标题通过 `CardHeader` 的分隔线表达区块边界。模板、工作流与智能体项目继续使用清晰的焦点、悬停和点击入口；保留加载 Skeleton、空状态、删除确认、`getNodeCount` 与所有现有导航地址。

- [x] **Step 3: 收紧智能体列表**

将 `AIAppsPanel` 的分区标题与主操作对齐；实体项和骨架项使用同一最小高度及 `rounded-lg border bg-background px-3 py-3`，状态继续用 `Badge`。保留 `createAgent`、错误 toast、创建禁用态与进入编辑器的路由。

- [x] **Step 4: 运行格式与静态检查**

Run: `pnpm --filter @valley/web check`

Expected: 本次涉及文件无新增 Biome 问题；如仓库有既存无关问题，记录其文件和规则，不扩大修复范围。

### Task 3: 运行时验证与交付检查

**Files:**

- Modify: `docs/superpowers/plans/2026-07-15-shadcn-workbench-layout.md`
- Test: `pnpm --filter @valley/web exec tsc --noEmit`
- Test: `pnpm --filter @valley/web check`
- Test: `pnpm check:harness`

- [ ] **Step 1: 浏览器验证工作台布局与交互**

在 `/workbench` 验证展开/折叠侧栏、折叠态 Tooltip、导航跳转、智能体创建入口、资料库入口、工作流编辑入口和删除确认；在约 390px 宽度确认侧栏、页头操作、智能体项和双列内容无横向溢出。

- [ ] **Step 2: 运行静态检查**

Run: `pnpm --filter @valley/web exec tsc --noEmit; pnpm --filter @valley/web check; pnpm check:harness`

Expected: 命令结果可追溯；未通过项必须区分为本次引入或已有问题。

- [ ] **Step 3: 更新执行状态并检查编码**

将实际完成的步骤标为 `[x]`，然后运行：

```bash
python .agents/skills/encoding-guard/scripts/check_mojibake.py \
  apps/web/src/layouts/Sidebar.tsx \
  apps/web/src/layouts/WorkbenchLayout.tsx \
  apps/web/src/pages/Workbench/index.tsx \
  apps/web/src/components/workbench/AIAppsPanel.tsx \
  docs/superpowers/plans/2026-07-15-shadcn-workbench-layout.md
```

Expected: `PASS: no suspicious encoding or text-loss issues detected.`

## 覆盖自检

- 设计说明中的紧凑侧栏、品牌栏图标折叠入口与 Tooltip 由 Task 1 覆盖。
- 工作台标题、操作聚合、卡片密度和智能体列表由 Task 2 覆盖。
- 响应式、关键交互、静态检查与编码安全由 Task 3 覆盖。
- 不包含 API、路由、数据模型、依赖或 AI 面板内容变更。

## 验证记录（2026-07-15）

- 已通过：相关 5 个文件的 Biome 检查、`pnpm --filter @valley/web exec tsc --noEmit`，以及桌面端侧栏的展开/折叠与恢复；390px 宽度下首页主内容不再被侧栏和 AI 面板挤出视口，导航链接仍有唯一可访问名称。
- 已通过但有既有告警：`pnpm --filter @valley/web check` 以退出码 0 完成，报告 34 条既有告警，涉及 `ImagePreviewDialog`、`CoverCropDialog`、`MarkdownContent`、共享 `ui/sidebar`、`useWorkflowHistory`、`index.css` 与 `Downloads` 等，不属于本次改动文件。
- 未完成：`/workbench` 受登录守卫保护，当前浏览器无登录会话，无法验证真实智能体、模板和工作流数据状态。
- 未通过：`pnpm check:harness` 被本机 WSL 挂载错误阻断；直接执行同一 Python 校验又因 Windows 环境不识别 4 个兼容 skill 入口为符号链接而失败。
