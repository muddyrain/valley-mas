# Valley MAS 项目指南

本文件沉淀 Valley MAS 的项目级信息，供开发者和 AI 协作时快速理解项目边界。AI 协作规则仍以根目录 `AGENTS.md` 为入口。

## 项目定位

- Valley MAS 是一个面向个人内容展示、创作者空间与内容管理的全栈项目。
- 当前核心能力包括首页展示、创作者主页、资源库、博客/图文、留言、通知、AI 辅助生成与管理后台。
- 前台用户侧主要在 `apps/web`，管理后台在 `apps/admin`，服务端 API 在 `server`，共享类型/工具在 `packages`。
- UI 主题以暖金、奶油色、柔和纸感为主；紫色只作为少量功能点缀，不应把页面改成独立紫蓝橙粉色系。

## 技术栈地图

| 区域 | 路径 | 说明 |
| --- | --- | --- |
| Web 前台 | `apps/web` | React 19 + Vite 6 + React Router 7 + Tailwind 4，包含首页、创作者、资源、博客、我的空间等用户侧页面。 |
| Admin 后台 | `apps/admin` | React 19 + Vite 6 + Ant Design 6 + Pro Components，包含用户、创作者、资源、博客、记录与审核管理。 |
| Toy Climb Arena | `apps/toy-climb-arena` | Vite 6 + TypeScript + Three.js，玩具世界攀爬跳跃游戏，开发端口 5175。详见 `apps/toy-climb-arena/AGENTS.md`。 |
| Go 服务端 | `server` | Gin + GORM，入口在 `server/cmd/server`，路由集中在 `server/internal/router/router.go`。 |
| 共享包 | `packages/*` | `shared`、`shared-request`、`shared-router`、`shared-format`、`format-tools` 等 workspace 包。 |
| 文档 | `docs` | 沉淀长期有价值文档；普通问答、临时总结不要自动写入。 |
| Unity 实验 | `apps/unity-dungeon` | Unity 相关实验资产，除非任务明确涉及，不主动改动。 |

## 关键业务模块

- 首页与品牌入口：`apps/web/src/pages/Home`、`apps/web/src/layouts/Header.tsx`、`apps/web/src/components/page`。
- 创作者与创作空间：`apps/web/src/pages/Creator*`、`apps/web/src/pages/MySpace`、`apps/admin/src/pages/Creator*`、`server/internal/handler/creator*.go`。
- 资源库：`apps/web/src/pages/Resources`、`apps/web/src/pages/ResourceDetail`、`apps/web/src/components/ResourceCard.tsx`、`server/internal/handler/*resource*.go`。
- 博客与图文：`apps/web/src/pages/blog`、`apps/web/src/pages/BlogCreate`、`apps/web/src/components/blog`、`apps/admin/src/pages/Blog*`、`server/internal/handler/blog*.go`。
- AI 能力：`server/internal/handler/*ai*.go`、`apps/web/src/api/ai.ts`，当前主要接入火山 ARK 文本、视觉与图片模型。
- 登录与用户状态：`apps/web/src/stores/useAuthStore.ts`、`apps/*/src/utils/request.ts`、`server/internal/middleware`、`server/internal/utils/jwt.go`。

## 本地开发命令

```bash
# 安装依赖
pnpm install

# 启动全部前端任务
pnpm dev

# 启动 Web
cd apps/web && pnpm dev

# 启动 Admin
cd apps/admin && pnpm dev

# 启动 Toy Climb Arena（玩具世界攀爬游戏）
cd apps/toy-climb-arena && pnpm dev
# 或：pnpm --filter @valley/toy-climb-arena dev
# 访问 http://localhost:5175

# 启动 Go 服务
cd server && go run ./cmd/server
```

## 环境变量与外部服务

- Web/Admin API 地址读取 `VITE_API_BASE_URL`，示例分别在 `apps/web/.env.example` 与 `apps/admin/.env.example`。
- Server 示例配置在 `server/.env.example`，包括 `DB_*`、`JWT_SECRET`、`SMTP_*`、`TOS_*`、`ARK_*`。
- TOS 上传依赖 `TOS_ACCESS_KEY`、`TOS_SECRET_KEY`、`TOS_BUCKET`、`TOS_ENDPOINT`、`TOS_REGION`。
- AI 能力依赖 `ARK_API_KEY`、`ARK_BASE_URL`、`ARK_TEXT_MODEL`、`ARK_VISION_MODEL`、`ARK_IMAGE_MODEL`，模型接入点通常应为 `ep-` 开头。

## 常用定位入口

- Web 路由：`apps/web/src/App.tsx`。
- Admin 路由：`apps/admin/src/App.tsx`。
- 服务端路由：`server/internal/router/router.go`。
- 服务端配置：`server/internal/config/config.go`。
- 数据模型：`server/internal/model`。
- Web API 封装：`apps/web/src/api`。
- Admin API 封装：`apps/admin/src/api`。
