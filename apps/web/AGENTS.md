# Web 前台 AGENTS

本文件只补充 `apps/web` 的局部协作规则。全局规则、skill 选择、Git 规则和完成标准继承根目录 `AGENTS.md`。

## 功能定位

- `apps/web` 是 Valley MAS 的用户侧前台，负责首页展示、创作者空间、资源库、博客/图文、访客留言、个人空间、收藏关注、下载记录、通知、个人资料和登录注册。
- 技术栈为 React 19 + Vite 6 + React Router 7 + Tailwind 4，并复用 workspace 包如 `@valley/shared`、`@valley/shared-request`、`@valley/shared-router`、`@valley/shared-format`。
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
- 用户侧视觉应延续项目暖金、奶油色、纸感和少量功能点缀的风格；不要把全站改成独立的紫蓝、橙粉或纯暗色主题。
- 路由标题由 `RouteTitle` 维护；新增前台路由时同步考虑页面标题。
- 需要权限的创作者/个人空间能力优先复用已有守卫、状态和请求封装，不绕过统一 request 层。
- 不在源码或示例配置中写真实密钥、真实 token 或个人账号凭据。

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
