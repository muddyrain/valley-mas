开发者快速指南 — server

目的：提供本地开发时的热重载（类似 Node 的 nodemon）配置与启动说明。

1) 安装 air（推荐）

- 推荐（使用 go install，Go 1.17+）：

```powershell
Set-Location d:\my-code\valley-mas\server
go install github.com/cosmtrek/air@latest
```

注：确保 `$(go env GOPATH)\bin` 或 `%USERPROFILE%\go\bin` 在你的 PATH 中，这样能直接运行 `air`。

在 Windows 上也可以使用 Scoop/Chocolatey 安装（可选）：
- scoop: `scoop install air`
- choco: `choco install air`

2) 启动项目（开发）

在 `server` 目录下运行：

```powershell
Set-Location d:\my-code\valley-mas\server
air
```

air 会监听你配置的文件扩展（默认包含 `.go`），发生改动会自动重新编译并重启服务。

3) 直接运行（不使用热重载）

也可以用 `go run`：

```powershell
Set-Location d:\my-code\valley-mas\server
go run .\main.go
```

注意 `go run` 不会监听文件变化，也不会自动重启。

4) 常见启动失败排查（Exit Code 1）

- 端口被占用：确认没有其他程序（或上一次的服务）占用 `:8080`。
- 环境配置缺失：检查 `internal/config` 是否需要环境变量或 `.env`；参考项目根目录是否提供 `.env.example`。
- 编译错误：查看终端输出的具体错误并修复代码中的语法或 import 问题。

5) 我已经为你添加了 `.air.toml`（位于本目录），推荐直接使用 `air` 运行以获得自动重启体验。

如果你愿意，我可以接着为你添加一个 PowerShell 启动脚本（例如 `dev.ps1`），方便一键启动。


## ssh 连接 google-cloud

```powershell
gcloud compute ssh "instance-20251220-041132" --zone "us-west1-b" --project "alert-synapse-481804-j8"
```
## 部署发布至google-cloud

```powershell
gcloud compute scp ./valley-server-linux instance-20251220-041132:/opt/go-project/ --zone "us-west1-b" --project "alert-synapse-481804-j8"
```