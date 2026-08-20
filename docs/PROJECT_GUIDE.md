# Valley MAS 项目指南

本页只记录可由仓库配置和目录验证的事实。协作规则见 `CLAUDE.md`，产品语义和交付状态按需读取目标子项目文档与 `docs/plans/README.md`。

## 仓库地图

| 范围 | 路径 | 技术或职责 |
| --- | --- | --- |
| Web 前台 | `apps/web` | React、Vite、React Router、Tailwind |
| Admin 后台 | `apps/admin` | React、Vite、Ant Design |
| Life Trace | `apps/life-trace` | React、Vite、Tailwind |
| Electron 应用 | `apps/screen-recorder`、`apps/port-warden` | Electron、React、Vite、TypeScript |
| Next.js 实验 | `apps/ai-mind-arena`、`apps/scratch-legend` | Next.js、React |
| 游戏/场景实验 | `apps/world-sim`、`apps/eon-vale`、`apps/toy-climb-arena`、`apps/ambient-forge` | Vite、TypeScript、Pixi.js 或 Three.js |
| API | `server` | Go、Gin、GORM |
| 共享能力 | `packages/*` | 类型、请求、路由、格式化、浏览器媒体与小游戏包 |

各产品的入口、不可替代约束和专项验收由对应 `AGENTS.md` 定义。`apps/ai-mind-arena` 与 `apps/toy-climb-arena` 都默认使用端口 `5175`，不能同时以默认配置启动。

## 开发与环境

```bash
# 安装与全量前端开发
pnpm install
pnpm dev

# 定向启动
pnpm --filter @valley/web dev
pnpm --filter @valley/admin dev
pnpm --filter @valley/life-trace dev
pnpm --filter @valley/screen-recorder dev
pnpm --filter @valley/port-warden dev
pnpm --filter @valley/ai-mind-arena dev
pnpm --filter @valley/scratch-legend dev
pnpm --filter @valley/toy-climb-arena dev
pnpm --filter @valley/world-sim dev
pnpm --filter @valley/ambient-forge dev
pnpm --filter @valley/eon-vale dev

# Go 服务与迁移
cd server && go run ./cmd/server
cd server && air
cd server && go run ./cmd/migrate status
cd server && go run ./cmd/migrate up
```

| 服务 | 默认端口 |
| --- | --- |
| Go API | 8080 |
| Web / Admin / Life Trace | 5000 / 3000 / 5178 |
| Screen Recorder / Port Warden | 5179 / 5182 |
| AI Mind Arena / Toy Climb Arena / Scratch Legend | 5175 / 5175 / 5176 |
| Ambient Forge / Eon Vale | 5181 / 5184（预览 4184） |

环境变量以相应示例文件为唯一真源：`apps/*/.env.example`、`server/.env.example`。模型能力、Provider 配置和密钥不得在文档中复制；服务端读取逻辑从 `server/internal/config/config.go` 和模型目录实现定位。

## 常用定位入口

| 目标 | 入口 |
| --- | --- |
| Web/Admin/Life Trace 路由 | `apps/{web,admin,life-trace}/src/App.tsx` |
| Web/Admin API 封装 | `apps/web/src/api`、`apps/admin/src/api` |
| Electron 主进程 | 各应用的 `electron/main.ts`、`electron/preload.ts` |
| Go 路由与配置 | `server/internal/router/router.go`、`server/internal/config/config.go` |
| Go 模型与服务 | `server/internal/model`、`server/internal/service` |

## 常用校验

命令实现以根 `package.json#scripts`、各应用 `package.json#scripts` 与 Go 工具链为唯一真源；本页提供可复用的调用矩阵。

```bash
# 文档与 Harness
pnpm check:harness
pnpm check:harness:test
pnpm check:agents-context
pnpm check:agents-context:test
pnpm check:docs-links
pnpm check:plans-index

# 工具链与全仓
pnpm check:toolchain
pnpm check:toolchain:test
pnpm check
pnpm build

# Go
cd server && go test ./...
cd server && go build ./cmd/server ./cmd/migrate

# 非 ASCII 文本、Markdown、skill 或配置示例
python3 .agents/skills/encoding-guard/scripts/check_mojibake.py <相关文件>
```

| 范围 | 静态/类型 | 行为与专项验证 |
| --- | --- | --- |
| Web | `pnpm --filter @valley/web check`、`pnpm --filter @valley/web exec tsc --noEmit` | `pnpm --filter @valley/web test`；高风险补 `test:cov` 与浏览器验证 |
| Admin | `pnpm --filter @valley/admin check`、`pnpm --filter @valley/admin exec tsc --noEmit` | `pnpm --filter @valley/admin test` |
| Life Trace | `pnpm --filter @valley/life-trace check`、`pnpm --filter @valley/life-trace exec tsc --noEmit` | `pnpm --filter @valley/life-trace exec vitest run` |
| AI Mind Arena | `pnpm --filter @valley/ai-mind-arena check`、`pnpm --filter @valley/ai-mind-arena typecheck` | SSE 或服务端联动改动补运行时验证 |
| Scratch Legend | `pnpm --filter @valley/scratch-legend check`、`pnpm --filter @valley/scratch-legend typecheck` | `pnpm --filter @valley/scratch-legend exec vitest run`（存在受影响测试时） |
| Screen Recorder | `pnpm --filter @valley/screen-recorder typecheck`、`pnpm --filter @valley/screen-recorder check` | `test`；平台改动补 renderer/Electron build、打包或目标机验收 |
| Port Warden | `pnpm --filter @valley/port-warden typecheck`、`pnpm --filter @valley/port-warden check` | `pnpm --filter @valley/port-warden test`；平台改动补 build 与目标机验收 |
| Eon Vale | `pnpm --filter @valley/eon-vale check`、`pnpm --filter @valley/eon-vale typecheck` | `test`；渲染/交互补 `test:e2e`，热路径补 `benchmark` |
| WorldSim | `pnpm --filter @valley/world-sim check`、`pnpm --filter @valley/world-sim typecheck` | `pnpm --filter @valley/world-sim exec vitest run`；地图/模拟补 `test:balance`、`test:stability` 或 `test:longrun` |
| Toy Climb Arena | `pnpm --filter @valley/toy-climb-arena check`、`pnpm --filter @valley/toy-climb-arena typecheck` | 受影响 Vitest 与实际物理/关卡验收 |
| Ambient Forge | `pnpm --filter @valley/ambient-forge check`、`pnpm --filter @valley/ambient-forge typecheck` | `pnpm --filter @valley/ambient-forge test`；视觉/声音改动补浏览器验收 |

共享包改动运行对应包的 `typecheck`、`test` 或 `build`。无法运行必要验证时，交付说明原因、影响范围与剩余风险。

## CI 质量门禁

`.github/workflows/quality.yml` 在 push 和 pull request 中运行 Harness、context、workspace check/build 与 Go 测试。Node 与 pnpm 版本以根 `package.json#engines` 和 `package.json#packageManager` 为唯一真源；部署迁移与重启顺序见 `.github/workflows/deploy-server.yml`。
