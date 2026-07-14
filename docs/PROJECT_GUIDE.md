# Valley MAS 项目指南

本文件沉淀 Valley MAS 的项目级信息，供开发者和 AI 协作时快速理解项目边界。AI 协作规则仍以根目录 `AGENTS.md` 为入口；AI coding Harness Engineering 约定见 `docs/HARNESS_ENGINEERING.md`。

## 项目定位

- Valley MAS 是一个包含个人内容展示、创作者空间、内容管理、生活记录、AI 辅助能力、毛毡桌面壳层和实验应用的 monorepo。
- 用户侧主站在 `apps/web`，管理后台在 `apps/admin`，Go API 服务在 `server`。
- Life Trace、AI Mind Arena、Desktop OS、WorldSim、Toy Climb Arena、Scratch Legend 是当前仓库内的独立产品或实验应用。
- 共享类型、请求、路由和格式化能力放在 `packages/*`。

## 技术栈地图

| 区域 | 路径 | 说明 |
| --- | --- | --- |
| Web 前台 | `apps/web` | React 19 + Vite 6 + React Router 7 + Tailwind 4，用户侧内容站点。 |
| Admin 后台 | `apps/admin` | React 19 + Vite 6 + Ant Design 6 + Pro Components，覆盖用户、内容、资源、互动、Life Trace 和审计的运营管理后台。 |
| Life Trace | `apps/life-trace` | React 19 + Vite 6 + Tailwind 4，生活计划、踪迹、提醒和 PWA 能力。 |
| Desktop OS | `apps/desktop-os` | React 19 + Vite 6 + Tailwind 4 + shadcn/`@base-ui/react` + zustand + `motion` + `overlayscrollbars`，毛毡 macOS 风桌面壳层，承载 Finder、Safari、Mail、Blog、Music、AI Command Center 与 Mini Apps；3D 骰盅使用 `three` + `@react-three/fiber`。 |
| AI Mind Arena | `apps/ai-mind-arena` | Next.js 15 + React 19 + Tailwind 3，多人格辩论决策应用，默认端口 5175。 |
| Scratch Legend | `apps/scratch-legend` | Next.js + React，刮刮卡增量游戏实验，默认端口 5176。 |
| Toy Climb Arena | `apps/toy-climb-arena` | Vite 6 + TypeScript + Three.js，玩具世界攀爬游戏，默认端口 5175。 |
| WorldSim | `apps/world-sim` | React 19 + Vite 6 + TypeScript + Pixi.js + Zustand，沙盒文明模拟游戏。 |
| Go 服务端 | `server` | Gin + GORM，入口在 `server/cmd/server`，路由集中在 `server/internal/router/router.go`。 |
| 共享包 | `packages/*` | `shared`、`shared-request`、`shared-router`、`shared-format`、`format-tools`、`browser-media`、`mini-games` 等 workspace 包。 |
| 文档 | `docs` | 长期项目文档；临时分析不要自动沉淀到这里。 |

`apps/ai-mind-arena` 和 `apps/toy-climb-arena` 都使用 `5175` 作为默认开发端口，不能同时用默认端口启动。

## 关键业务模块

- 首页与品牌入口：`apps/web/src/pages/Home`、`apps/web/src/layouts/Header.tsx`、`apps/web/src/components/page`。
- 创作者与创作空间：`apps/web/src/pages/Creator*`、`apps/web/src/pages/MySpace`、`apps/admin/src/pages/Creator*`、`server/internal/handler/creator*.go`。
- 资源库：`apps/web/src/pages/Resources`、`apps/web/src/pages/ResourceDetail`、`apps/web/src/components/ResourceCard.tsx`、`apps/admin/src/pages/admin-ops/ResourceTags.tsx`、`server/internal/handler/*resource*.go`。
- 博客与图文：`apps/web/src/pages/blog`、`apps/web/src/pages/BlogCreate`、`apps/web/src/components/blog`、`apps/admin/src/pages/Blog*`、`apps/admin/src/pages/admin-ops/BlogTaxonomy.tsx`、`apps/admin/src/pages/admin-ops/BlogComments.tsx`、`server/internal/handler/blog*.go`。
- 后台运营与审计：`apps/admin/src/pages/admin-ops`、`apps/admin/src/api/operations.ts`、`server/internal/handler/admin_operations.go`，包括 AI 调用审计和存储资产只读治理。
- Life Trace：`apps/life-trace/src`、`server/internal/lifetrace`。
- AI Mind Arena：`apps/ai-mind-arena`、`apps/admin/src/pages/admin-ops/MindArenaDebates.tsx`、`server/internal/mindarena`、`server/internal/model/mind_arena.go`、`server/internal/ai`。
- AI 能力：`server/internal/ai`、`server/internal/aiusage`、`server/internal/handler/*ai*.go`、`apps/web/src/api/ai.ts`；Admin 可审计 Valley AI Chat 与 Life Trace AI 的调用、失败和耗时。
- AI 工作台平台基线：Web `/workbench` 将智能体与工作流分区展示；智能体编辑页支持不可变版本保存、历史版本恢复为新草稿、发布及当前草稿版本的 ARK 私有 SSE 调试、停止和最近运行摘要，也可绑定私有资料库。`/workbench/knowledge` 支持 Markdown/TXT 上传、异步切块与向量化状态、失败重试；在 PostgreSQL 安装 `pgvector` 且配置 `ARK_EMBEDDING_MODEL` 后，已索引资料会在智能体调试中检索并返回引用摘要。服务端 `/ai/apps` 提供 owner 隔离的应用、版本、发布状态、统一运行摘要、受控工具目录与 API Key 基础资产；旧工作流会映射为 workflow 应用，仍通过 `/workflows/*` 维持图编辑和节点级运行历史兼容。PDF 摄取、真实 Agent 工具执行、工具级 trace 和已发布应用的公共调用 API 仍待后续阶段实现，不能视为已开放能力。
- AI Agent 运行时：`server/internal/ai/agent`（领域中性 tool loop 抽象，未来可无痛迁 CloudWeGo eino）+ `server/internal/ai/tools`（Tool 接口与 Registry），首批被 Life Trace 生活助理经 `LIFE_TRACE_ASSISTANT_USE_AGENT` 灰度使用。
- 登录与用户状态：`apps/web/src/stores/useAuthStore.ts`、`apps/*/src/utils/request.ts`、`server/internal/middleware`、`server/internal/utils/jwt.go`。

## 本地开发命令

```bash
# 安装依赖
pnpm install

# 启动全部前端任务
pnpm dev

# 启动 Web / Admin / Life Trace
pnpm --filter @valley/web dev
pnpm --filter @valley/admin dev
pnpm --filter @valley/life-trace dev

# 启动 Desktop OS
pnpm --filter @valley/desktop-os dev

# 启动 AI Mind Arena / Scratch Legend
pnpm --filter @valley/ai-mind-arena dev
pnpm --filter @valley/scratch-legend dev

# 启动 Toy Climb Arena / WorldSim
pnpm --filter @valley/toy-climb-arena dev
pnpm --filter @valley/world-sim dev

# 启动 Go 服务
cd server && go run ./cmd/server
```

## 端口速查

| 服务 | 默认端口 |
| --- | --- |
| Go API | 8080 |
| Web | 5174 |
| Admin | 3000 |
| Life Trace | 5178 |
| Life Trace preview | 4178 |
| Desktop OS | 5177 |
| AI Mind Arena | 5175 |
| Toy Climb Arena | 5175 |
| Scratch Legend | 5176 |

Go API 启动时会优先使用 `PORT`（默认 `8080`）。如果该端口已被占用，服务端会自动顺延尝试后续端口，并在启动日志里打印实际端口。前端本地 Vite 代理默认仍指向 `http://localhost:8080`；如果 Go API 顺延到了 `8081` 等端口，需要同步调整前端 API 代理或 `VITE_API_BASE_URL`，避免继续请求旧分支服务。

## 环境变量与外部服务

- Web/Admin API 地址读取 `VITE_API_BASE_URL`，示例分别在 `apps/web/.env.example` 与 `apps/admin/.env.example`。
- Life Trace 本地默认通过 Vite `/api` 代理访问 Go 服务，示例见 `apps/life-trace/.env.example`。
- AI Mind Arena 前端读取 `NEXT_PUBLIC_API_BASE_URL`，示例见 `apps/ai-mind-arena/.env.example`。
- Server 示例配置在 `server/.env.example`，包括 `DB_*`、`JWT_SECRET`、`SMTP_*`、`MAIL_*`、`GMAIL_*`、`TOS_*`、`ARK_*`、`GEMINI_*`、`LIFE_TRACE_AI_*`、`MIND_ARENA_AI_*`、`QWEATHER_*`、`WEB_PUSH_*`、`UNSPLASH_ACCESS_KEY`、`PEXELS_API_KEY`、`EXTERNAL_IMAGES_TIMEOUT_SECONDS`。
- TOS 上传依赖 `TOS_ACCESS_KEY`、`TOS_SECRET_KEY`、`TOS_BUCKET`、`TOS_ENDPOINT`、`TOS_REGION`。
- Valley/Blog/Creator 默认 ARK 能力依赖 `ARK_API_KEY`、`ARK_BASE_URL`、`ARK_TEXT_MODEL`、`ARK_VISION_MODEL`、`ARK_IMAGE_MODEL`。
- Life Trace Pantry AI 拍照分析优先使用 `GEMINI_API_KEY`、`GEMINI_API_BASE_URL`、`GEMINI_VISION_MODEL`，可用 `LIFE_TRACE_PANTRY_PHOTO_AI_PROVIDER` 强制切换 `auto` / `gemini` / `ark`，可用 `LIFE_TRACE_PANTRY_PHOTO_AI_TIMEOUT_SECONDS` 单独调整超时；未配置 Gemini 时回退 `ARK_VISION_MODEL`，再回退 `ARK_TEXT_MODEL`。
- Life Trace 文本 AI 可用 `LIFE_TRACE_AI_*` 覆盖，未配置时回退 `ARK_TEXT_MODEL`；旧 `OPENAI_API_*` 仍兼容但不建议新增使用。
- Life Trace 生活助理 Agent 灰度：`LIFE_TRACE_ASSISTANT_USE_AGENT`（默认 false）。设为 `true`/`1`/`yes`/`on` 时走 `server/internal/ai/agent` 的手写 tool loop（可自主调用 5 个 life-trace tool）;其他值一律回退旧的结构化 tool-call 单次调用 + fallback 路径。
- AI Mind Arena 后端依赖 `MIND_ARENA_AI_PROVIDER`、`MIND_ARENA_AI_BASE_URL`、`MIND_ARENA_AI_API_KEY`，默认复用 `ARK_TEXT_MODEL`；只有需要单独切换脑内会议室模型时才配置 `MIND_ARENA_AI_MODEL`。配置不完整或上游失败时应回退 mock；旧 `AI_*` 仍兼容但不建议新增使用。
- 博客封面外部图源代理依赖 `UNSPLASH_ACCESS_KEY`、`PEXELS_API_KEY`，超时使用 `EXTERNAL_IMAGES_TIMEOUT_SECONDS`（默认 8 秒）；未配置对应 Key 时该 provider 返回 503，仓库不写入真实 Key。
- Desktop OS Mail v1 后端依赖 `MAIL_SECRET_KEY` 加密外部邮箱凭据；Gmail 绑定依赖 `GMAIL_CLIENT_ID`、`GMAIL_CLIENT_SECRET`、`GMAIL_REDIRECT_URL`，QQ 邮箱使用用户授权码经 IMAP 只读同步。
- Desktop OS 前端环境变量示例见 `apps/desktop-os/.env.example`：`VITE_API_BASE_URL` 指向 Go API；Audius 公共音乐源通过 `VITE_AUDIUS_API_BASE_URL` 与 `VITE_AUDIUS_API_BEARER_TOKEN` 注入，因 Vite 前端环境变量会暴露到浏览器，生产环境如需保护 token 应改为 server 代理，仓库内不写入真实 token。

## 常用定位入口

- Web 路由：`apps/web/src/App.tsx`。
- Admin 路由：`apps/admin/src/App.tsx`。
- Life Trace 路由：`apps/life-trace/src/App.tsx`。
- Desktop OS 入口：`apps/desktop-os/src/App.tsx`；窗口编排和应用清单看 `apps/desktop-os/src/apps/desktopApps.ts` 与 `apps/desktop-os/src/store/windowStore.ts`；公共 UI 在 `apps/desktop-os/src/ui/PlushPrimitives.tsx`。
- AI Mind Arena 页面：`apps/ai-mind-arena/app`。
- 服务端路由：`server/internal/router/router.go`。
- 服务端配置：`server/internal/config/config.go`。
- 数据模型：`server/internal/model`。
- Web API 封装：`apps/web/src/api`。
- Admin API 封装：`apps/admin/src/api`。
- Desktop OS API 封装：`apps/desktop-os/src/api`。

## 常用校验

本节是仓库验证命令的唯一完整真源。根 `AGENTS.md`、Harness 文档和子项目规则只维护路由或局部补充，不复制整张命令表。

```bash
# Harness 配置与 fixture
pnpm check:harness
pnpm check:harness:test

# 全 workspace 静态检查与构建
pnpm check
pnpm build

# 前端应用定向检查
pnpm --filter @valley/web exec tsc --noEmit
pnpm --filter @valley/admin exec tsc --noEmit
pnpm --filter @valley/life-trace check
pnpm --filter @valley/desktop-os typecheck
pnpm --filter @valley/desktop-os check
pnpm --filter @valley/desktop-os exec vitest run
pnpm --filter @valley/ai-mind-arena typecheck
pnpm --filter @valley/scratch-legend typecheck
pnpm --filter @valley/world-sim typecheck
pnpm --filter @valley/toy-climb-arena typecheck

# Go 服务
cd server && go test ./...

# 非 ASCII 文本、Markdown、skill 或配置示例
python3 .agents/skills/encoding-guard/scripts/check_mojibake.py <相关文件>
```

共享包改动运行对应包的 `typecheck`、`test` 或 `build`。无法运行必要验证时，最终回复必须说明原因、影响范围和剩余风险。

## CI 质量门禁

- `.github/workflows/quality.yml` 在 push 和 pull request 上执行 Harness 检查、workspace check/build 和 Go 测试。
- `.github/workflows/deploy-server.yml` 只处理服务端部署，并在远端 build/restart 之前运行 `go test ./...`。
- 当前不使用 changed-files 第三方 action；优先保证完整验证，后续根据 CI 耗时再评估增量矩阵。
