# Web 前台 AGENTS

本文件只补充 `apps/web` 的局部协作规则。全局规则、skill 选择、Git 规则和完成标准继承根目录 `AGENTS.md`。

## 功能定位

- `apps/web` 是 Valley MAS 的用户侧前台，负责首页展示、创作者空间、资源库、博客/图文、访客留言、个人空间、收藏关注、下载记录、通知、个人资料和登录注册。
- 技术栈为 React 19 + Vite 6 + React Router 7 + Tailwind 4，并复用 workspace 包如 `@valley/shared-request`、`@valley/shared-router`、`@valley/shared-format`。
- Web/Admin API 地址来自 `VITE_API_BASE_URL`，示例见 `.env.example`。

## 路由与代码入口

- 应用路由入口：`src/App.tsx`。
- 页面目录：`src/pages`；博客相关页面集中在 `src/pages/blog`。
- 布局入口：`src/layouts/Layout.tsx`、`src/layouts/Header.tsx`。
- API 封装：`src/api`；请求工具：`src/utils/request.ts`。
- 登录状态：`src/stores/useAuthStore.ts`；主题状态：`src/stores/useThemeStore.ts`。
- 常用复用组件：`src/components`、`src/components/ui`、`src/components/blog`、`src/components/page`。

## 开发规范

- Web UI、主题、loading、列表分页、搜索、URL query 或浏览器回退行为发生变化时，必须启用 `web-ui-consistency-guard`。
- 新增页面前先检查 `src/App.tsx`、相邻 `src/pages/*`、`src/components/*` 和现有 hooks，优先复用已有布局、卡片、弹窗、上传、分页和 API 模式。
- 用户侧视觉采用纯 shadcn/ui 产品界面风格：以语义 token、默认组件变体和中性层级组织界面；不引入暖金、奶油色、纸感、装饰性渐变或单页独立色系。品牌表达仅可通过现有 Logo、内容资产与低频语义强调呈现。
- 路由标题由 `RouteTitle` 维护；新增前台路由时同步考虑页面标题。
- 需要权限的创作者/个人空间能力优先复用已有守卫、状态和请求封装，不绕过统一 request 层。
- 不在源码或示例配置中写真实密钥、真实 token 或个人账号凭据。

### shadcn 组件优先

UI 组件优先使用 `src/components/ui/` 下的 shadcn 组件；当现有组件语义不匹配、第三方接口要求原生元素或需要专用交互时，可以在遵守 token 和可访问性的前提下使用更合适的实现：

- **交互控件**：使用 `Button`（variant/default/outline/ghost 等）、`Select`、`Checkbox`、`Input`、`Textarea`、`Tabs`/`TabsList`/`TabsTrigger`/`TabsContent`
- **状态反馈**：使用 `Skeleton` 替代自定义 loading 动画、`Badge` 替代自定义标签、`toast` 替代自定义错误提示
- **布局容器**：使用 `Card`/`CardHeader`/`CardContent`、`ScrollArea`、`Separator`
- **视觉基线**：优先沿用 shadcn 的默认圆角、间距、阴影、边框和语义色；页面骨架使用熟悉的应用栏、侧边栏、Tabs、表单和列表模式，不额外叠加纸张纹理、玻璃拟态、渐变背景或装饰性大色块。
- **使用边界**：
  - 常规动作优先使用 `Button`；无障碍语义、第三方 render prop 或特殊画布交互确实需要时可使用原生 `<button>`，但需复用现有焦点、禁用态和 token。
  - 紧凑尺寸优先使用组件已有 `size`；确需新尺寸时增加命名 variant，不在业务页面散落临时高度覆盖。
  - 内容占位优先使用 `Skeleton`；按钮提交、后台任务等需要表达进行中状态时可使用 spinner 或进度反馈。
  - 离散状态标签优先使用 `Badge`；说明性状态文本不必强行包装成 Badge。
  - 真正的标签页切换使用 `Tabs`；筛选、分段控制或工具栏动作按其交互语义选择 Toggle、Select 或 Button group。
  - 需要新的 UI 模式时先检查 `src/components/ui/`。确需从 shadcn 生成组件时，使用仓库已安装版本执行 `pnpm --filter @valley/web exec shadcn add <组件名>`，检查生成 diff；若会新增依赖，按根规则先取得确认。不要使用 `npx shadcn@latest`。

## 常用命令

```bash
cd apps/web && pnpm dev
pnpm --filter @valley/web exec tsc --noEmit
pnpm --filter @valley/web check
pnpm --filter @valley/web build
```

## 校验要求

- 仅类型或逻辑改动：至少运行 `pnpm --filter @valley/web exec tsc --noEmit`。
- 样式、格式、lint 相关改动：运行 `pnpm --filter @valley/web check`。
- 页面交互、路由、登录态或上传下载链路改动：结合本地浏览器手动验证关键路径，并在最终回复说明验证范围。
