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

## 国内服务器自动部署

当前推荐用于国内云服务器的部署链路：

```text
本地 git push -> 同时 push GitHub 和 Gitee -> GitHub Actions 触发 ->
SSH 登录服务器 -> 服务器从 Gitee pull 最新代码 -> 本机 go build ->
systemctl restart valley-server
```

这样可以避免服务器直连 GitHub 或 GitHub Actions 直接跨境上传大体积二进制过慢的问题。

### 服务器侧约定

- 代码目录：`/opt/valley-mas`
- 二进制输出：`/opt/valley/bin/valley-server`
- 环境变量文件：`/opt/valley/config/server.env`
- systemd 服务：`valley-server.service`
- 仓库 `origin` 指向 Gitee，例如：

```bash
cd /opt/valley-mas
git remote set-url origin https://gitee.com/muddyrain/valley-mas.git
```

国内服务器建议预先配置 Go 模块代理：

```bash
/usr/local/go/bin/go env -w GOPROXY=https://goproxy.cn,direct
/usr/local/go/bin/go env -w GOSUMDB=sum.golang.google.cn
```

### 本地双 push 配置

双 push 配置写在当前 clone 的 `.git/config`，不会自动跟随仓库传播；换一台电脑或重新 clone 后，需要重新执行一次。

推荐保留 GitHub 作为 `fetch` 源，只给 `push` 增加 Gitee：

```bash
git remote set-url --add --push origin git@github.com:muddyrain/valley-mas.git
git remote set-url --add --push origin git@gitee.com:muddyrain/valley-mas.git
git remote -v
```

预期输出类似：

```text
origin  git@github.com:muddyrain/valley-mas.git (fetch)
origin  git@github.com:muddyrain/valley-mas.git (push)
origin  git@gitee.com:muddyrain/valley-mas.git (push)
```

之后执行一次：

```bash
git push origin master
```

会同时推送到 GitHub 和 Gitee。

### 服务重启权限

自动部署依赖 `valley` 用户无密码重启服务，建议单独放在 `/etc/sudoers.d/valley-server`：

```text
valley ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart valley-server
```

可用下面命令验证：

```bash
sudo -n /usr/bin/systemctl restart valley-server
```

如果需要检查服务状态，可直接执行：

```bash
/usr/bin/systemctl status valley-server --no-pager | head -n 20
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

如果本地或共享测试库因为历史迁移遗漏字段，出现类似“保存偏好失败”“字段不存在”的问题，可以单独运行一次 schema sync 命令，让 GORM 按指定 model 补齐缺失表和字段。日常优先指定具体 model，避免全量扫描远程 PostgreSQL 元数据：

```bash
cd server && go run ./cmd/sync-schema --apply --models places,ledger,closet
```

常用 Life Trace model alias：

```bash
cd server && go run ./cmd/sync-schema --apply --models places
cd server && go run ./cmd/sync-schema --apply --models ledger
cd server && go run ./cmd/sync-schema --apply --models closet,outfits
cd server && go run ./cmd/sync-schema --apply --models media_diary,inbox,traces,plans
```

如果确实需要按范围同步，可显式使用：

```bash
cd server && go run ./cmd/sync-schema --apply --scope lifetrace
cd server && go run ./cmd/sync-schema --apply --scope content
cd server && go run ./cmd/sync-schema --apply --scope core
cd server && go run ./cmd/sync-schema --apply --scope all
```

默认不加 `--apply` 时只打印目标库和同步目标，不会连接或修改数据库。带 `--apply` 时必须显式传入 `--models` 或 `--scope`，避免误跑大范围 AutoMigrate。`ENV=production` 时还必须额外传入 `--allow-production`，生产环境仍建议优先使用 `migrations/` 下可审查的 SQL 迁移。

`--scope all` 保留历史全量 AutoMigrate 行为，因此除了补齐字段，也会执行当前 AutoMigrate 后置的资源外键修复和默认博客分类初始化。其他范围或 `--models` 只同步对应 model，不执行内容库的后置修复。

## 常见问题

- 端口被占用：检查是否已有服务监听 `:8080`，或通过 `PORT` 改端口。
- 环境变量缺失：对照 `server/.env.example` 补齐本地 `.env`。
- 数据库结构不一致：本地可使用 `go run ./cmd/sync-schema --apply --models places,ledger` 等精确命令，或确认当前环境是否允许 `DB_AUTO_MIGRATE=true`；生产环境应使用明确的迁移流程。
- AI 调用失败：先确认功能归属。Valley/Blog/Creator 默认看 `ARK_*`；Life Trace 文本 AI 若配置了 `LIFE_TRACE_AI_*` 会优先使用它，否则回退 `ARK_TEXT_MODEL`；AI Mind Arena 看 `MIND_ARENA_AI_*`，默认复用 `ARK_TEXT_MODEL`，只有单独切模型时才配置 `MIND_ARENA_AI_MODEL`。配置缺失或上游失败时应回退 mock，旧 `OPENAI_API_*` 和 `AI_*` 仅作兼容。

## 相关入口

- 协作规则：`server/AGENTS.md`。
- 路由注册：`internal/router/router.go`。
- 配置读取：`internal/config/config.go`。
- 迁移说明：`migrations/README.md`。
