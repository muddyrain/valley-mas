# QUICK START

本文档用于本地快速跑通 Valley MAS + 本地 TTS（F5-TTS）。

## 1. 环境要求

- Go 1.23+
- Node.js 18+
- pnpm 8+
- Windows（如使用仓库内 `*.cmd` 脚本）

## 2. 安装依赖

```bash
pnpm install
```

## 3. 启动后端（Go）

```bash
cd server
go run main.go
```

默认监听：`http://127.0.0.1:8080`

## 4. 启动前端（Web）

```bash
cd apps/web
pnpm dev
```

## 5. 启动本地 TTS（可选）

```bash
cd apps/f5-tts
scripts\start_local_api.cmd
```

默认监听：`http://127.0.0.1:7860`

## 6. 必要配置

在 `server/.env` 中确认：

```env
TTS_BASE_URL=http://127.0.0.1:7860
TTS_UPSTREAM_PATH=/synthesize
TTS_TIMEOUT_SEC=600
```

## 7. TTS 路由

- 同步：`POST /api/v1/public/tts/synthesize`
- 异步：`POST /api/v1/public/tts/synthesize-async`
- 进度：`GET /api/v1/public/tts/progress/:taskId`
- SSE：`GET /api/v1/public/tts/progress/stream/:taskId`
- 音频：`GET /api/v1/public/tts/audio/:filename`

## 8. 快速自检

```bash
# server
cd server
go build .

# web
cd ../apps/web
node ../../node_modules/typescript/bin/tsc -p tsconfig.json --noEmit
```

## 9. 常见问题

1. `tts async submit failed: upstream error: {"detail":"Not Found"}`
- 原因：Python 本地 API 仍是旧版本
- 处理：重启 `apps/f5-tts/scripts/start_local_api.cmd`

2. 进度条不动
- 确认 Go 服务与 Python 服务都在运行
- 确认浏览器可访问 SSE 路由

3. 历史播放刷新后失效
- 已改为 IndexedDB 本地持久化；如果旧历史是老数据，建议清空一次历史后重新生成
