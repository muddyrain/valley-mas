# Valley MAS Web -- AI-Native Workbench 全量重构计划

## Context

当前 apps/web 是传统内容展示站：顶部导航 + 全宽单栏 + ShadcnUI风格。用户希望将其重构为 AI-Native 工作台——类似 Coze/Dify 的智能体驱动体验，核心诉求：

1. 整体布局和画风需体现"智能体项目"特征，而非传统博客站
2. 所有功能尽量以智能体自动化方式呈现，带可交互的工作流节点详情
3. 全站使用 shadcn 组件体系重构 UI
4. 移除 creator 角色门控，所有登录用户均可创作

## 一、新布局架构

### Sidebar + Main + AI Panel 三栏布局

```
+------------------+--------------------------------+-------------------+
|  Sidebar (nav)   |     Main Content Area          |   AI Assistant    |
|  (collapsible)   |     (workbench panels)         |   Panel           |
|                  |                                |   (resizable)     |
+------------------+--------------------------------+-------------------+
```

### 关键新增文件

| 文件 | 用途 |
|------|------|
| `src/layouts/WorkbenchLayout.tsx` | 新布局容器，替代 Layout.tsx |
| `src/layouts/Sidebar.tsx` | 可折叠侧边栏 |
| `src/layouts/AIPanel.tsx` | 持久 AI 面板（chat / workflow-detail / agent-config 三种模式） |
| `src/layouts/CommandPalette.tsx` | Cmd+K 命令面板 |
| `src/stores/useLayoutStore.ts` | 侧边栏折叠 + AI 面板开关 + 面板宽度 |

### 侧边栏导航

| 导航项 | 路径 | 说明 |
|--------|------|------|
| Home | `/` | AI 仪表盘首页 |
| Workbench | `/workbench` | 工作台（工作流模板 + Agent 管理） |
| Blog | `/blog` | 博客列表 |
| Resources | `/resources` | 资源库 |
| Guestbook | `/guestbook` | 留言墙 |
| Labs | `/labs` | 实验室 |

### AI 面板

- 从弹窗式 `HomeAICoreDialog` 演进为持久右侧面板
- 三种模式：chat（对话）、workflow-detail（点击工作流节点后展示步骤详情）、agent-config（Agent 配置）
- 移动端用 shadcn Sheet 从右侧滑入
- 宽度持久化，默认 380px

### 命令面板 (Cmd+K)

- shadcn Command + Dialog 实现
- 搜索：页面导航、最近博客/资源、AI 快捷指令

## 二、视觉设计系统

### 暗色优先策略

- 默认暗色 + 亮色可选双模
- 新增 `neon` 色调（紫蓝渐变微光）作为 AI-Native 默认，替代 rose 预设

### 主题系统演进

```typescript
// 从 ThemePreset 演进为
type ThemeMode = 'dark' | 'light';
type ThemeAccent = 'neon' | 'amber' | 'ocean' | 'forest';
```

### 核心暗色变量（新增到 index.css）

```
:root[data-accent="neon"][data-mode="dark"] {
  --theme-primary: #8b7cf6;
  --theme-primary-soft: rgba(139, 124, 246, 0.12);
  --theme-page-start: #0c0e1a;
  --theme-glow: rgba(139, 124, 246, 0.25);
  --background: #0c0e1a;
  --card: #161830;
  --border: #1e2044;
}
```

为每个现有 accent（amber/ocean/forest）也新增暗色变体。

### 面板组件模式

| 组件 | 用途 | 视觉特征 |
|------|------|----------|
| WorkbenchPanel | 主内容区容器 | 暗色 `bg-card` + 微弱 `ring-glow` |
| WorkflowNodeCard | 工作流节点卡片 | 可展开详情，状态色边框 |
| AIPanelCard | AI 面板消息/步骤卡片 | 半透明背景 + 微光渐变 |

## 三、通用工作流引擎

### 目录结构

```
src/workflows/
  types.ts              -- WorkflowStep, WorkflowRun, WorkflowTemplate 类型
  engine.ts             -- WorkflowEngine：接收模板，驱动 SSE，发出事件
  store.ts              -- useWorkflowStore (zustand)：运行时状态 + 历史记录
  templates/
    blog-publish.ts     -- 博客发布工作流模板
    resource-process.ts -- 资源处理工作流
    content-analysis.ts -- 内容分析工作流
  components/
    WorkflowCanvas.tsx       -- 通用工作流画布（ReactFlow + dagre）
    WorkflowNodeDetail.tsx   -- 节点详情面板（输入/输出/日志/计时）
    WorkflowStepper.tsx      -- 非画布模式线性步骤展示
    WorkflowStatusBadge.tsx  -- 步骤状态标识
```

### 关键类型

```typescript
interface WorkflowStep {
  id: string;
  label: string;
  icon: string;
  status: 'pending' | 'running' | 'success' | 'skipped' | 'error';
  message?: string;
  startedAt?: string;
  finishedAt?: string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  logs?: WorkflowLog[];
}

interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  steps: WorkflowStepDef[];
  sseEndpoint: string;
}
```

### 节点详情面板（核心需求）

点击任意工作流节点后，在 AI Panel 中展示：
1. **输入参数** — 本步骤接收的数据
2. **输出结果** — 本步骤的产出
3. **执行日志** — 逐步输出，含时间戳和级别
4. **计时信息** — 开始/结束/耗时
5. **操作按钮** — error 状态可重试，可选跳过

### 工作流模板

| 模板 | 步骤 | 端点 |
|------|------|------|
| 博客发布 | 解析MD → AI摘要 → AI封面 → AI标签 → 创建草稿 → 发布 | 已有 `/admin/blog/workflow/import` |
| 资源处理 | 上传图片 → AI命名 → AI标签 → AI分类 → 入库 | 新增 `/workflow/resource-process` |
| 内容分析 | 选择内容 → AI阅读指南 → AI关键点 → AI推荐 → 生成报告 | 新增 `/workflow/content-analysis` |

### 现有功能转工作流

- **BlogCreate** → `blog-publish` 模板驱动，手动编辑保留为高级选项
- **UploadResourceDialog** → `resource-process` 模板驱动
- **BlogWorkflowDialog** → 保留为快捷入口，底层改用通用引擎

## 四、创作者角色移除

### 前端变更

| 文件 | 变更 |
|------|------|
| `src/pages/ApplyCreator/index.tsx` | 删除 |
| `src/components/ApplyCreatorBanner.tsx` | 删除 |
| `src/pages/MySpace/index.tsx` | 移除 `usePageRoleGuard`，改 `isAuthenticated` |
| `src/pages/MyPosts/index.tsx` | 同上 |
| `src/pages/MyResources/index.tsx` | 同上 |
| `src/pages/BlogGroupManage/index.tsx` | 同上 |
| `src/pages/BlogCreate/index.tsx` | 移除 `isCreator` 判断 |
| `src/layouts/Header.tsx` | "创作空间"入口对所有登录用户可见 |
| `src/pages/Home/index.tsx` | 移除 `isCreator` 条件 |
| `src/App.tsx` | 移除 `/apply-creator` 路由 |

### 服务端变更

| 文件 | 变更 |
|------|------|
| `server/internal/middleware/middleware.go` | `CreatorOrAdmin()` 改为 `Auth()` |
| `server/internal/router/router.go` | `/creator/*` 路由移入 auth 组 |
| `server/internal/handler/creator.go` | 新增 `/creator/auto-register` 自动注册 |
| `server/internal/handler/creator_application.go` | 标记废弃 |
| `server/internal/handler/creator_application_audit.go` | 标记废弃 |

## 五、shadcn 组件补齐

| 优先级 | 组件 | 用途 |
|--------|------|------|
| P0 | Command, Sheet, Tooltip, Popover, ScrollArea | 命令面板、移动端侧边栏/AI面板、侧边栏提示、节点弹出、消息滚动 |
| P1 | Select, Separator, Progress | 表单选择器、面板分隔、工作流进度 |
| P2 | Accordion, Collapsible | 节点详情折叠、侧边栏折叠 |

添加方式：`npx shadcn@latest add command sheet tooltip popover scroll-area select separator progress accordion collapsible`

## 六、实施阶段

### Phase 1：基础架构 + 暗色主题

**目标**：新布局骨架可运行，暗色主题可用，现有页面不中断。

**交付物**：
1. WorkbenchLayout / Sidebar / AIPanel / useLayoutStore
2. 暗色主题 CSS 变量（所有 accent 的暗色变体）
3. useThemeStore 升级为 ThemeMode + ThemeAccent
4. 补齐 P0 shadcn 组件

**验证**：切换明暗模式无视觉异常；侧边栏折叠/展开流畅；AI 面板聊天可用；现有页面正常渲染

### Phase 2：创作者角色移除 + Workbench 核心

**目标**：移除创作者门控，上线 Workbench 主页和 Agent 对话。

**交付物**：
1. 前端移除所有 creator 门控
2. 服务端路由和中间件调整
3. Workbench 主页（工作流模板 + 最近执行）
4. Agent API 封装 + AgentList + AgentChat
5. CommandPalette (Cmd+K)

**验证**：所有登录用户可创作；Agent CRUD 端到端可用；Cmd+K 搜索正常；无 403 回归

### Phase 3：通用工作流引擎 + 节点详情

**目标**：工作流引擎通用化，节点可点击查看详情。

**交付物**：
1. src/workflows/ 目录（类型/引擎/store/模板/组件）
2. WorkflowCanvas + WorkflowNodeDetail
3. blog-publish 模板（从 BlogWorkflowDialog 迁移）
4. resource-process 模板 + 服务端 SSE 端点
5. BlogWorkflowDialog 改用通用引擎

**验证**：博客发布工作流正常；点击节点查看详情；资源处理端到端可用；执行历史可查看

### Phase 4：页面视觉重设计

**目标**：全站统一 AI-Native 视觉语言。

**交付物**：
1. 新首页 Dashboard（替代原首页，原内容移到 /explore）
2. MySpace → /workbench/content
3. BlogList / BlogPost / Resources 视觉刷新
4. 其余页面视觉同步
5. 补齐 P1/P2 shadcn 组件
6. 移动端适配

**验证**：全站暗色模式无异常；移动端适配；tsc + check 通过

### Phase 5：打磨与优化

**目标**：性能优化、交互打磨。

**交付物**：
1. AI Panel 虚拟滚动
2. 工作流画布交互优化（拖拽/缩放/小地图）
3. 命令面板扩展
4. 文档同步（AGENTS.md / PROJECT_GUIDE.md）
5. 遗留代码清理

## 七、关键文件

| 文件 | 角色 |
|------|------|
| `apps/web/src/App.tsx` | 路由重组入口 |
| `apps/web/src/index.css` | 主题系统核心（暗色变量 + glow 系统） |
| `apps/web/src/components/blog/BlogWorkflowDialog.tsx` | 现有工作流，通用引擎从中提取核心逻辑 |
| `apps/web/src/stores/useThemeStore.ts` | 主题状态，单维→双维演进 |
| `apps/web/src/layouts/Layout.tsx` | 当前布局，将被 WorkbenchLayout 替代 |
| `apps/web/src/layouts/Header.tsx` | 当前导航，将被 Sidebar 替代 |
| `server/internal/router/router.go` | 服务端路由，创作者门控移除 |
| `server/internal/middleware/middleware.go` | CreatorOrAdmin 中间件改造 |
| `server/internal/handler/blog_workflow.go` | 已有的工作流 SSE 端点 |

## 八、风险与缓解

| 风险 | 缓解 |
|------|------|
| 暗色主题下现有页面视觉混乱 | Phase 1 只做骨架暗色，现有页面保持亮色；Phase 4 逐页迁移 |
| 工作流引擎过度抽象 | 引擎只做 SSE 事件分发和状态管理，业务逻辑留在模板和 API 层 |
| 移除创作者门控后权限漏洞 | 先改中间件为 Auth()，资源级权限通过 userId 校验 |
| 移动端三栏布局复杂 | 侧边栏和 AI 面板都用 Sheet，不同时显示 |

## 九、文档同步判断

需同步：`apps/web/AGENTS.md`（路由+布局）、`docs/PROJECT_GUIDE.md`（Web 技术描述）、`server/AGENTS.md`（路由变更）。无需同步 Life Trace PLAN.md。
