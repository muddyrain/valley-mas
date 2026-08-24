# Valley MAS

Valley MAS 是一个 monorepo，包含个人内容展示站点、管理后台、Go API 服务、Life Trace 生活记录 PWA，以及几个独立实验应用。

## 目录地图

| 路径 | 说明 |
| --- | --- |
| `apps/web` | 用户侧前台，包含首页、创作者空间、资源库、博客/图文、留言和个人空间。 |
| `apps/admin` | 管理后台，包含用户、创作者、资源、博客、审核与记录管理。 |
| `apps/life-trace` | Life Trace 生活计划与踪迹记录 PWA。 |
| `apps/world-sim` | React + Pixi.js + TypeScript 沙盒文明模拟游戏。 |
| `apps/toy-climb-arena` | Three.js 玩具世界攀爬游戏。 |
| `apps/scratch-legend` | Next.js 刮刮卡增量游戏实验。 |
| `server` | Gin + GORM Go 服务端。 |
| `packages` | workspace 共享类型、请求、路由和格式化工具。 |
| `docs` | 长期项目文档。 |

## 环境要求

- Go：以 `server/go.mod` 为准。
- Node.js：`>=22.13.0 <23`。
- pnpm：`pnpm@11.21.0`。

## 快速启动

```bash
pnpm install
```

启动 Go 服务：

```bash
cd server && go run ./cmd/server
```

启动常用前端：

```bash
pnpm --filter @valley/web dev
pnpm --filter @valley/admin dev
pnpm --filter @valley/life-trace dev
```

更多启动方式见 [项目指南](./docs/PROJECT_GUIDE.md)。

## 常用校验

```bash
pnpm --filter @valley/web exec tsc --noEmit
pnpm --filter @valley/admin exec tsc --noEmit
pnpm --filter @valley/life-trace check
cd server && go test ./...
```

## 文档入口

- [项目文档索引](./docs/README.md)
- [项目指南](./docs/PROJECT_GUIDE.md)
- [AI 协作约定](./CLAUDE.md)
