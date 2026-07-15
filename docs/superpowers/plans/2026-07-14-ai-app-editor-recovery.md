# AI App Editor Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复草稿版本丢失导致的调试失败，并将智能体编辑页改为轻量 shadcn/ui 双栏界面。

**Architecture:** 前端将请求错误保留为可展示的服务端消息；调试前检测 `draftVersionId`，缺失时复用版本保存接口生成草稿后再运行。编辑页使用 shadcn/ui 语义 token 和基础控件，但移除 Card 堆叠，以单一标准内容容器承载编辑与调试区域。

**Tech Stack:** React 19、React Router、Tailwind 4、shadcn Button/Input/Textarea、Gin/GORM。

---

### Task 1: 恢复草稿版本并透传调试错误

**Files:**
- Modify: `apps/web/src/api/aiWorkbench.ts`
- Modify: `apps/web/src/pages/AIAppEditor/index.tsx`

- [x] **Step 1: 定义 API 错误提取函数**

在 `aiWorkbench.ts` 导出 `getAPIErrorMessage`，从 Axios 风格 `response.data.message`、普通 `Error.message` 读取文案，回退调用方传入的默认值。

```ts
export function getAPIErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error && 'response' in error) {
    const message = (error as { response?: { data?: { message?: unknown } } }).response?.data?.message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return error instanceof Error && error.message.trim() ? error.message : fallback;
}
```

- [x] **Step 2: 在调试前确保草稿版本存在**

在编辑页提取 `ensureDraftVersion`：若 `app.draftVersionId` 存在则直接返回；否则调用 `saveAIAppVersion`，把新版本插入历史、更新本地 `draftVersionId` 并返回新版本 ID。保存失败时抛出真实服务端错误，不再调用调试接口。

- [x] **Step 3: 用真实错误替换泛化 toast**

调试请求的 `catch` 使用 `getAPIErrorMessage(error, '调试运行失败')`。保存、发布、加载同样保留对应的业务回退文案。

- [x] **Step 4: 运行类型检查**

Run: `pnpm --filter @valley/web exec tsc --noEmit`

Expected: exit 0。

### Task 2: 重组智能体编辑页

**Files:**
- Modify: `apps/web/src/pages/AIAppEditor/index.tsx`

- [x] **Step 1: 建立单一标准编辑容器**

保留顶部返回、状态、保存、发布操作；以单一 `Card` 内容容器承载编辑与调试区域，不覆盖其默认视觉 token。桌面使用 `lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,.9fr)]`，窄屏自动退化为单列。

- [x] **Step 2: 左侧放置配置字段**

将名称、简介、系统提示词、开场白放入左侧，使用细分隔线和小型标签替代嵌套 Card。保持 `Input`、`Textarea`、`Button` 组件，不自定义主按钮色。

- [x] **Step 3: 右侧放置调试与运行摘要**

右侧先展示在线调试输入、运行按钮与回复，再展示最近运行；空运行显示短状态文案，失败项显示服务端错误码。版本历史改为主容器底部的紧凑列表。

- [x] **Step 4: 定向格式与编码检查**

Run: `pnpm --filter @valley/web exec biome check src/pages/AIAppEditor/index.tsx src/api/aiWorkbench.ts`

Run: `python3 .agents/skills/encoding-guard/scripts/check_mojibake.py apps/web/src/pages/AIAppEditor/index.tsx apps/web/src/api/aiWorkbench.ts`

Expected: exit 0。

### Task 3: 回归验证与文档状态

**Files:**
- Modify: `docs/superpowers/specs/2026-07-14-ai-app-editor-recovery-design.md`

- [x] **Step 1: 将设计状态标记为已实施**

在验证完成后把状态更新为“已实施，待真实 ARK 环境验收”。

- [ ] **Step 2: 执行回归命令**

Run: `pnpm --filter @valley/web exec tsc --noEmit && pnpm check:harness && cd server && go test ./...`

Expected: 全部 exit 0。

- [ ] **Step 3: 人工验收**

在 `/workbench/apps/:appId`：打开一个缺少草稿版本的旧应用，输入调试消息，确认先生成版本；在缺少 ARK 配置时确认页面显示服务端返回的配置错误，而非固定泛化提示。
