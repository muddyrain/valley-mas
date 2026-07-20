# Web AI 工作台重设计 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 Valley Web 的 AI 工作台、智能体编辑器和工作流编辑器改造为画布优先、配置分层、运行反馈清晰的产品型创作工作台。

**Architecture:** 保留所有现有 API、状态管理、React Flow 运行模型和路由。以面向工作台的局部组件封装重复的标题栏、状态提示与配置区块，工作流页面继续由 `WorkflowEditorPage` 统筹状态，智能体编辑页拆出标签内容区和在线调试区。

**Tech Stack:** React 19、React Router 7、Tailwind 4、shadcn/ui、@xyflow/react、Zustand、Sonner。

---

## 目标文件

- 修改：`apps/web/src/pages/Workbench/index.tsx`，重组工作台首页的分区、创建入口和列表密度。
- 修改：`apps/web/src/components/workbench/AIAppsPanel.tsx`，让智能体列表与工作台视觉基线对齐。
- 修改：`apps/web/src/pages/AIAppEditor/index.tsx`，分离编辑、绑定、发布、调试和版本视图。
- 创建：`apps/web/src/components/ai-workbench/EditorPageHeader.tsx`，承载工作台编辑器共用的返回、标题、状态与操作区域。
- 创建：`apps/web/src/components/ai-workbench/EditorSection.tsx`，承载配置面板的一致分段标题、说明和内容容器。
- 修改：`apps/web/src/pages/WorkflowEditor/index.tsx`，重组工具栏、画布周边操作、右侧配置区与运行抽屉。
- 修改：`apps/web/src/components/workflow/NodePanel.tsx`，提供常用节点、可折叠类别和一致节点项。
- 修改：`apps/web/src/components/workflow/PropertyPanel.tsx` 与 `apps/web/src/components/workflow/properties/PropertyFormBase.tsx`，提供配置分段和未选中状态。
- 修改：`apps/web/src/components/workflow/WorkflowNode.tsx`，统一节点状态、摘要和句柄表现。
- 修改：`apps/web/src/components/workflow/RunPanel.tsx`，将其收敛为可折叠的底部运行结果面板。

### Task 1: 建立编辑器共享视觉原语

**Files:**

- Create: `apps/web/src/components/ai-workbench/EditorPageHeader.tsx`
- Create: `apps/web/src/components/ai-workbench/EditorSection.tsx`
- Test: `pnpm --filter @valley/web exec tsc --noEmit`

- [x] **Step 1: 创建受控的编辑器页面标题组件**

```tsx
export function EditorPageHeader({ backTo, title, status, actions }: EditorPageHeaderProps) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-card px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <Button asChild variant="ghost" size="icon" aria-label="返回工作台"><Link to={backTo}><ArrowLeft /></Link></Button>
        <div className="min-w-0"><h1>{title}</h1>{status}</div>
      </div>
      <div className="flex flex-wrap items-center gap-2">{actions}</div>
    </header>
  );
}
```

- [x] **Step 2: 创建配置分段组件**

```tsx
export function EditorSection({ title, description, children }: EditorSectionProps) {
  return <section className="space-y-3 rounded-lg border border-border bg-card p-4"><div><h2>{title}</h2>{description && <p>{description}</p>}</div>{children}</section>;
}
```

- [x] **Step 3: 运行类型检查**

Run: `pnpm --filter @valley/web exec tsc --noEmit`

Expected: exit 0.

### Task 2: 重组 AI 工作台首页

**Files:**

- Modify: `apps/web/src/pages/Workbench/index.tsx`
- Modify: `apps/web/src/components/workbench/AIAppsPanel.tsx`
- Test: `pnpm --filter @valley/web check`

- [x] **Step 1: 将工作台头部改为任务型工具区**

保留知识库和创建工作流操作，移除重复的营销式卡片结构。头部显示明确标题、简短当前状态和主操作，不新增 API 请求。

- [x] **Step 2: 将智能体、工作流和模板改成独立工作区块**

智能体区块显示 `AIAppsPanel`，工作流区块显示最近工作流与状态，模板作为低优先级快速开始区。保留现有删除确认、加载 skeleton、空状态和路由。

- [x] **Step 3: 运行 Biome 检查**

Run: `pnpm --filter @valley/web check`

Expected: exit 0.

### Task 3: 重构智能体编辑页的任务层级

**Files:**

- Modify: `apps/web/src/pages/AIAppEditor/index.tsx`
- Modify: `apps/web/src/components/ai-workbench/EditorPageHeader.tsx`
- Modify: `apps/web/src/components/ai-workbench/EditorSection.tsx`
- Test: `pnpm --filter @valley/web exec tsc --noEmit`

- [x] **Step 1: 用共享标题栏承载返回、草稿状态、版本、保存和发布动作**

保留既有 `saveAIAppVersion` 与 `publishAIApp` 调用、禁用条件和 toast。标题栏不改变路由或发布状态语义。

- [x] **Step 2: 使用 Tabs 拆分编排、知识库、工具和发布内容**

`编排` 保留名称、说明、系统提示词和开场白。`知识库` 只管理 `replaceAIAppKnowledgeBases`，`工具` 只管理 `replaceAIAppTools`，`发布` 承载 API Key 和公共调用记录。所有现有绑定状态与保存处理器继续由页面持有。

- [x] **Step 3: 保留并收紧右侧在线调试区**

右侧按“输入、响应、引用资料、最近运行”排列，继续使用 `streamDebugAIApp`、中止控制器和既有运行记录。版本历史改为由顶部入口控制的详情区域，不再固定堆在编辑页底部。

- [x] **Step 4: 运行类型检查**

Run: `pnpm --filter @valley/web exec tsc --noEmit`

Expected: exit 0.

### Task 4: 重构工作流编辑器工作区

**Files:**

- Modify: `apps/web/src/pages/WorkflowEditor/index.tsx`
- Modify: `apps/web/src/components/workflow/NodePanel.tsx`
- Modify: `apps/web/src/components/workflow/RunPanel.tsx`
- Test: `pnpm --filter @valley/web check`

- [x] **Step 1: 将工作流顶部操作收敛到共享标题栏和次级工具栏**

保留工作流名称编辑、撤销、重做、保存、试运行、停止、版本、运行记录、资料库和上下文菜单功能。主操作只保留运行和保存，其他操作使用图标按钮或菜单承载。

- [x] **Step 2: 将节点库调整为常用节点加折叠类别**

保持搜索、拖拽和点击添加。常用节点来自现有 `NODE_CONFIGS`，类别仍由 `NODE_CATEGORIES` 生成，禁用节点保持不可添加且显示计划中状态。

- [x] **Step 3: 让运行结果以画布底部可展开面板呈现**

复用 `RunPanel` 和既有 `runSession`，默认折叠，运行中自动展开，结束后保留结果。画布尺寸与现有 React Flow 初始化、缩放和快捷键逻辑不变。

- [x] **Step 4: 运行 Biome 检查**

Run: `pnpm --filter @valley/web check`

Expected: exit 0.

### Task 5: 统一节点与属性配置体验

**Files:**

- Modify: `apps/web/src/components/workflow/WorkflowNode.tsx`
- Modify: `apps/web/src/components/workflow/PropertyPanel.tsx`
- Modify: `apps/web/src/components/workflow/properties/PropertyFormBase.tsx`
- Modify: `apps/web/src/components/workflow/properties/LLMPropertyForm.tsx`
- Modify: `apps/web/src/components/workflow/properties/StartPropertyForm.tsx`
- Modify: `apps/web/src/components/workflow/properties/KnowledgePropertyForm.tsx`
- Test: `pnpm --filter @valley/web exec tsc --noEmit`

- [x] **Step 1: 用语义 token 统一节点状态和选中效果**

将 `WorkflowNode` 中的硬编码状态颜色替换为当前主题 token 或有限的语义状态 class。保持节点类型、配置摘要、复制、删除、运行状态和 React Flow handles 的现有行为。

- [x] **Step 2: 为属性面板加入一致的未选中、分段和高级配置结构**

`PropertyPanel` 在无选中节点时提供简短任务提示。`PropertyFormBase` 提供节点标题、关闭动作、基础设置、输入输出和高级设置容器。各具体表单继续接收相同 `config` 与 `onUpdateConfig` 接口。

- [x] **Step 3: 先应用到三个高频表单并验证数据契约**

为 `LLMPropertyForm`、`StartPropertyForm` 和 `KnowledgePropertyForm` 使用新的分段容器，字段 key、类型、校验和变量引用不变。其他表单由同一 `PropertyFormBase` 获得基础视觉升级。

- [x] **Step 4: 运行类型检查**

Run: `pnpm --filter @valley/web exec tsc --noEmit`

Expected: exit 0.

### Task 6: 端到端静态与运行时验证

**Files:**

- Modify: `docs/plans/2026-07-15-web-ai-workbench-redesign.md`，勾选实际完成项。
- Test: `pnpm --filter @valley/web check`
- Test: `pnpm --filter @valley/web exec tsc --noEmit`
- Test: `pnpm check:harness`

- [x] **Step 1: 运行全部静态验证**

Run: `pnpm --filter @valley/web check && pnpm --filter @valley/web exec tsc --noEmit && pnpm check:harness`

Expected: exit 0.

- [x] **Step 2: 使用本地浏览器验证关键交互**

验证 `/workbench`、`/workbench/apps/:appId`、`/workbench/create` 与 `/workbench/edit?id=:id`：创建、节点添加、节点选择、属性更新、保存、试运行、停止、版本入口和资料库入口均可见且可操作。

- [x] **Step 3: 检查浅色、深色和窄屏布局**

验证主要文本、按钮、输入控件、节点状态和右侧面板在两种主题下可读；验证窄屏时节点库与属性面板不会遮挡画布或丢失入口。

## 覆盖自检

- 工作台首页由 Task 2 覆盖。
- 智能体编辑、知识库、工具、发布、在线调试和版本入口由 Task 3 覆盖。
- 工作流工具栏、节点库、画布和运行面板由 Task 4 覆盖。
- 节点视觉和高频属性表单由 Task 5 覆盖。
- 静态与运行时证据由 Task 6 覆盖。

未包含占位任务、接口变更、依赖升级或未确认的移动端拖拽承诺。

## 验证记录（2026-07-15）

- 已通过：本次修改文件的 Biome 定向检查、`pnpm --filter @valley/web exec tsc --noEmit`、`pnpm check:harness`。
- 已通过但有既有告警：`pnpm --filter @valley/web check` 保留 ImagePreviewDialog、CoverCropDialog、MarkdownContent、sidebar、useWorkflowHistory、index.css、Follows 等无关告警，本次未扩大范围修复。
- Owner 于 2026-07-15 确认：已在登录态、已配置 ARK/pgvector 的环境完成关键交互、主题与窄屏验收；`pnpm check:harness` 已在可用环境通过。

## 跟进打磨（2026-07-15）

- [x] 智能体编辑页 Tab 改为紧凑的分段控件，移除等宽导航和重复内容卡片。
- [x] 版本历史复用 `ScrollArea`，固定弹窗标题与说明，仅让历史列表滚动。
- [x] 智能体列表骨架改为与实体项同构的占位结构，并对齐最小高度以减少加载跳动。
- [x] 修复公共 `Tabs` 的横向布局契约，避免 `TabsContent` 被横向挤压为窄列。
