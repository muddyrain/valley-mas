# Server 开发指南

`server` 是 Valley MAS 的 Go API 服务，技术栈为 Gin + GORM。服务入口在 `cmd/server/main.go`，本地辅助入口在 `cmd/local/main.go`，路由集中在 `internal/router/router.go`。

## 环境配置

复制或参考 `server/.env.example` 配置本地环境变量。

常用配置：

- `PORT`：默认 `8080`。
- `DB_DRIVER`、`DB_DSN`、`DB_HOST`、`DB_PORT`、`DB_USER`、`DB_PASSWORD`、`DB_NAME`：数据库配置。
- `JWT_SECRET`、`SMTP_*`、`TOS_*`、`VOLCENGINE_*`、`AI_*`、`QWEATHER_*`、`WEB_PUSH_*`：业务能力配置。
- `WEB_PUSH_WORKER_ENABLED`：是否启动服务进程内置 Web Push 扫描 worker。当前服务按长驻服务器部署，本地或生产默认可保留 `true`；若另接外部 Cron 扫描，再按需设为 `false` 避免重复扫描。

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

`.air.toml` 构建 `./cmd/local`。本地入口会在 worker 和 HTTP 服务启动前，只查询并执行 `internal/dbmigration` 中尚未应用的版本化迁移；没有待执行迁移时只做轻量版本检查，不再全量扫描所有 GORM model。

```bash
cd server && air
```

全新的空开发库需要显式初始化一次。该命令会执行一次完整 GORM bootstrap，再接入版本化迁移历史；非空数据库和生产环境都会拒绝执行：

```bash
cd server && go run ./cmd/migrate bootstrap --apply
```

生产风格入口 `go run ./cmd/server` 不执行任何隐式 DDL。部署流程会在重启服务前运行 `go run ./cmd/migrate up --allow-production` 对应的迁移二进制，迁移失败则不重启。

常用迁移命令：

```bash
cd server
go run ./cmd/migrate status
go run ./cmd/migrate version
go run ./cmd/migrate up
```

### 修改 model 字段时

修改字段、字段类型或 GORM tag 时，不要运行 `bootstrap --apply`。正确流程是：

1. 修改 `internal/model` 中的 GORM model。
2. 在 `internal/dbmigration/postgres` 和 `internal/dbmigration/mysql` 中新增同版本的迁移 SQL。
3. 正常运行 `air`，本地入口会自动执行尚未应用的迁移；也可以手动运行 `go run ./cmd/migrate up`。

只修改 model 不会自动改变数据库结构。`go run ./cmd/migrate bootstrap --apply` 仅用于第一次初始化全新的空开发库，已有数据库会拒绝执行。

迁移版本一旦在任一本地、测试或生产持久数据库中显示为 `applied`，对应 SQL 就不能再修改。即使后来向同一文件追加字段，`air` 和 `go run ./cmd/migrate up` 也只会读取版本记录，不会重新执行该版本。遗漏字段或修正 SQL 时，必须在两个方言目录新增更高版本的修复迁移；不要删除 `schema_migrations` 记录，也不要靠重跑旧迁移修复结构漂移。

迁移完成不能只看版本状态，还应验证目标字段、索引或最小业务写入链路。建议顺序：

```bash
cd server
go run ./cmd/migrate status   # 新版本应先显示 pending
go run ./cmd/migrate up       # 也可重启 air 自动应用 pending 版本
go run ./cmd/migrate status   # 确认新版本已 applied
```

## 知识库 PDF 解析环境

知识库的基础 PDF 文本提取不依赖系统工具；用户选择视觉模型上传 PDF 时，服务会调用 Poppler 的 `pdftocairo` 把页面渲染为图片，用于扫描件 OCR、表格 Markdown 化和图片说明。开发机、测试机与线上服务必须安装同一项依赖。

```bash
# macOS 本地开发
brew install poppler

# Debian / Ubuntu 服务器
sudo apt-get update && sudo apt-get install -y poppler-utils

# Rocky / AlmaLinux / CentOS 服务器
sudo dnf install -y poppler-utils
```

安装或发布前验证：

```bash
command -v pdftocairo
pdftocairo -v
```

没有该命令时，普通文本 PDF 仍按原有方式处理；选择视觉模型的 PDF 会标记为“PDF 解析组件未安装”，可在安装完成后从知识库重试。服务会把渲染页写入受限临时目录，任务结束立即清理；不要把用户 PDF 放入长期共享临时目录。

## AI 动态表情转码环境

动态表情 worker 需要 `ffprobe` 校验视频流，并调用 `ffmpeg` 将视频派生为循环 GIF。开发机、测试机和线上服务必须安装同一版本族的 FFmpeg，并确保服务账号可从 `PATH` 找到两个命令。

```bash
# macOS
brew install ffmpeg

# Debian / Ubuntu
sudo apt-get update && sudo apt-get install -y ffmpeg

# Rocky / AlmaLinux / CentOS
sudo dnf install -y ffmpeg
```

发布前验证：

```bash
command -v ffmpeg
command -v ffprobe
ffmpeg -version
ffprobe -version
```

缺少命令时，视频模型任务仍可能完成并保存 MP4，但 GIF 派生会进入失败状态并在历史中保留错误信息。部署前还需应用 `202608080005_add_ai_motion_stickers` 迁移，并在 Admin 模型目录为 AMUX Seedance 模型启用 `video_generation`、`reference_image` 和 `amux_video`。

## 国内服务器自动部署

当前推荐用于国内云服务器的部署链路：

```text
本地 git push -> 同时 push GitHub 和 Gitee -> GitHub Actions 触发 ->
SSH 登录服务器 -> 服务器从 Gitee pull 最新代码 -> go test ->
构建服务与迁移程序 -> 应用待执行迁移 -> systemctl restart valley-server
```

这样可以避免服务器直连 GitHub 或 GitHub Actions 直接跨境上传大体积二进制过慢的问题。

### 服务器侧约定

- 代码目录：`/opt/valley-mas`
- 二进制输出：`/opt/valley/bin/valley-server`
- 环境变量文件：`/opt/valley/config/server.env`
- systemd 服务：`valley-server.service`
- PDF 视觉解析：已安装 `poppler-utils`，且 `pdftocairo` 可被 `valley` 用户在 `PATH` 中找到。
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

首次发布多模态 PDF 能力时，先安装并验证 Poppler，再推送服务端代码。部署工作流会在构建前检查该命令，避免发布后才发现扫描件和表格无法处理。

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

默认不加 `--apply` 时只打印目标库和同步目标，不会连接或修改数据库。带 `--apply` 时必须显式传入 `--models` 或 `--scope`，避免误跑大范围 AutoMigrate。`ENV=production` 时还必须额外传入 `--allow-production`；生产变更必须写入 `internal/dbmigration` 的可审查版本化迁移。

`--scope all` 保留历史全量 AutoMigrate 行为，因此除了补齐字段，也会执行当前 AutoMigrate 后置的资源外键修复和默认博客分类初始化。其他范围或 `--models` 只同步对应 model，不执行内容库的后置修复。

## 一次性维护命令

不参与服务启动的修复、清理与账号初始化命令集中在 [`cmd/maintenance`](cmd/maintenance/README.md)。这类命令可能读取或修改历史数据，执行前先确认环境与参数；创建或重置管理员账号必须显式传入 `--password`，命令不会输出密码。

## 常见问题

- 端口被占用：检查是否已有服务监听 `:8080`，或通过 `PORT` 改端口。
- 环境变量缺失：对照 `server/.env.example` 补齐本地 `.env`。
- 数据库结构不一致：先运行 `go run ./cmd/migrate status` 查看版本；已有开发库运行 `go run ./cmd/migrate up`，空开发库运行一次 `go run ./cmd/migrate bootstrap --apply`。`sync-schema` 仅保留作定向应急修复，不属于日常启动或生产发布流程。
- 日志报 `column ... does not exist`，但对应迁移已是 `applied`：通常是已执行的迁移文件后来又被修改。单纯重启 `air` 无效；应保留旧版本不动，新增更高版本的幂等修复迁移，执行 `go run ./cmd/migrate up` 后再验证实际字段或最小写入链路。
- AI 调用失败：模型目录中的火山引擎模型检查 `VOLCENGINE_API_KEY`、`VOLCENGINE_BASE_URL` 与目录模型 ID；不再配置 `ARK_TEXT_MODEL`、`ARK_VISION_MODEL`、`ARK_IMAGE_MODEL` 或 `ARK_EMBEDDING_MODEL`。知识库索引自动使用已启用且验证通过的 Embedding 目录模型；升级前生成的旧向量需在知识库页面重新索引一次。尚未迁移的其他旧直连入口会提示功能正在迁移。Life Trace 自有兼容配置看 `LIFE_TRACE_AI_*`；AI Mind Arena 需要完整的 `MIND_ARENA_AI_*`，缺失或上游失败时回退 mock，旧 `OPENAI_API_*` 和 `AI_*` 仅作兼容。

## 相关入口

- 协作规则：`server/AGENTS.md`。
- 路由注册：`internal/router/router.go`。
- 配置读取：`internal/config/config.go`。
- 迁移说明：`migrations/README.md`。
