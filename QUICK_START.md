# Quick Start

本文档用于快速跑通 Valley MAS 的常用本地开发链路。更完整的模块地图、环境变量和校验命令见 [docs/PROJECT_GUIDE.md](./docs/PROJECT_GUIDE.md)。

## 1. 环境要求

- Go：以 `server/go.mod` 为准。
- Node.js：`>=20.0.0`。
- pnpm：`>=9.0.0`，当前项目锁定 `pnpm@9.15.0`。

## 2. 安装依赖

```bash
pnpm install
```

## 3. 启动后端

```bash
cd server && go run ./cmd/server
```

默认监听 `http://127.0.0.1:8080`，端口可通过 `PORT` 覆盖。后端配置示例见 `server/.env.example`。

## 4. 启动前端

常用入口：

```bash
pnpm --filter @valley/web dev
pnpm --filter @valley/admin dev
pnpm --filter @valley/life-trace dev
```

独立实验应用：

```bash
pnpm --filter @valley/ai-mind-arena dev
pnpm --filter @valley/scratch-legend dev
pnpm --filter @valley/toy-climb-arena dev
pnpm --filter @valley/world-sim dev
```

注意：`apps/ai-mind-arena` 和 `apps/toy-climb-arena` 当前都使用 `5175` 端口，不能同时用默认端口启动。

## 5. 必要配置

- Web/Admin API 地址：`apps/web/.env.example`、`apps/admin/.env.example`。
- Life Trace API 地址：`apps/life-trace/.env.example`。
- AI Mind Arena API 地址：`apps/ai-mind-arena/.env.example`。
- Go 服务：`server/.env.example`。

本地 Vite 应用通常通过 `/api` 代理访问 `http://localhost:8080`。

## 6. 快速自检

```bash
pnpm --filter @valley/web exec tsc --noEmit
pnpm --filter @valley/admin exec tsc --noEmit
pnpm --filter @valley/life-trace check
cd server && go test ./...
```

只改某个子项目时，优先运行对应子项目 `AGENTS.md` 中列出的校验命令。
