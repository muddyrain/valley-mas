# Server 开发指南

`server` 是 Valley MAS 的 Go API 服务，技术栈为 Gin + GORM。服务入口在 `cmd/server/main.go`，本地辅助入口在 `cmd/local/main.go`，路由集中在 `internal/router/router.go`。

## 环境配置

复制或参考 `server/.env.example` 配置本地环境变量。

常用配置：

- `PORT`：默认 `8080`。
- `DB_DRIVER`、`DB_DSN`、`DB_HOST`、`DB_PORT`、`DB_USER`、`DB_PASSWORD`、`DB_NAME`：数据库配置。
- `DB_AUTO_MIGRATE`：是否启用 GORM AutoMigrate，本地按需开启，生产默认应保持关闭。
- `JWT_SECRET`、`SMTP_*`、`TOS_*`、`ARK_*`、`AI_*`、`QWEATHER_*`、`WEB_PUSH_*`：业务能力配置。
- `WEB_PUSH_WORKER_ENABLED`：是否启动服务进程内置 Web Push 扫描 worker。Vercel + 外部 Cron 场景建议设为 `false`，避免冷启动 worker 和 cron-job.org 重复扫描；长驻服务器或本地开发可保留 `true`。

不要在文档、示例、日志或测试中写入真实密钥、真实 token、真实云资源标识或个人账号凭据。

## 启动服务

直接启动：

```bash
cd server && go run ./cmd/server
```

热重载启动：

```bash
cd server && air
```

`.air.toml` 当前会构建 `./cmd/local`，用于本地开发时读取额外启动参数。例如临时开启自动迁移：

```bash
cd server && air db=true
```

## 常用校验

```bash
cd server && go test ./...
cd server && go build ./cmd/server
```

只改 AI Mind Arena 服务端逻辑时，可先跑相关包：

```bash
cd server && go test ./internal/mindarena ./internal/ai
```

只改 Life Trace 服务端逻辑时，可先跑：

```bash
cd server && go test ./internal/lifetrace
```

## 数据库结构同步

如果本地或共享测试库因为历史迁移遗漏字段，出现类似“保存偏好失败”“字段不存在”的问题，可以单独运行一次 schema sync 命令，让 GORM 按当前 model 补齐缺失表和字段：

```bash
cd server && go run ./cmd/sync-schema --apply
```

默认不加 `--apply` 时只打印目标库信息，不会连接或修改数据库。`ENV=production` 时还必须额外传入 `--allow-production`，生产环境仍建议优先使用 `migrations/` 下可审查的 SQL 迁移。

该命令复用 `database.Init` 的 AutoMigrate 路径，因此除了补齐字段，也会执行当前 AutoMigrate 后置的资源外键修复和默认博客分类初始化。

## 常见问题

- 端口被占用：检查是否已有服务监听 `:8080`，或通过 `PORT` 改端口。
- 环境变量缺失：对照 `server/.env.example` 补齐本地 `.env`。
- 数据库结构不一致：本地可使用 `go run ./cmd/sync-schema --apply` 或确认当前环境是否允许 `DB_AUTO_MIGRATE=true`，生产环境应使用明确的迁移流程。
- AI 调用失败：确认 `ARK_*` 或 `AI_*` 配置；AI Mind Arena 配置缺失或上游失败时应回退 mock。

## 相关入口

- 协作规则：`server/AGENTS.md`。
- 路由注册：`internal/router/router.go`。
- 配置读取：`internal/config/config.go`。
- 迁移说明：`migrations/README.md`。
