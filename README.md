# Valley MAS

面向创作者内容分发与管理的平台，包含 Go 服务端、Web 端、Admin 端和本地 F5-TTS 能力。

## 当前重点功能

- 统一账号与权限（admin / creator / user）
- 创作者空间与资源管理
- 公开资源访问与下载链路
- 本地 TTS（F5-TTS）
  - 同步合成：`POST /api/v1/public/tts/synthesize`
  - 异步提交：`POST /api/v1/public/tts/synthesize-async`
  - 进度查询：`GET /api/v1/public/tts/progress/:taskId`
  - SSE 进度流：`GET /api/v1/public/tts/progress/stream/:taskId`
  - 音频访问：`GET /api/v1/public/tts/audio/:filename`
- TTS Web 页面已支持
  - 实时进度条（SSE）
  - 生成历史列表
  - 历史音频本地持久化（IndexedDB）

## 目录结构

```text
valley-mas/
├─ apps/
│  ├─ web/
│  ├─ admin/
│  ├─ mini-app/
│  └─ f5-tts/
├─ server/
├─ packages/
├─ docs/
├─ README.md
└─ QUICK_START.md
```

## 快速开始

详细步骤见 [QUICK_START.md](./QUICK_START.md)。

最短路径：

1. 安装依赖

```bash
pnpm install
```

2. 启动服务端

```bash
cd server
go run main.go
```

3. 启动 Web

```bash
cd apps/web
pnpm dev
```

4. 启动本地 TTS（可选）

```bash
cd apps/f5-tts
scripts\start_local_api.cmd
```

## TTS 说明

- Go 已改为路由模块化注册（不在 `main.go` 里直接堆路由）
- 音频访问采用 Go 代理流式转发优先，减少重复落盘
- Python 侧输出目录支持自动清理，避免磁盘无限增长
- `apps/f5-tts/outputs/` 已加入忽略，不应提交到 git

## 开发校验

```bash
# server
cd server
go build .

# web
after cd apps/web
node ../../node_modules/typescript/bin/tsc -p tsconfig.json --noEmit
```

## 文档

- [docs/INDEX.md](./docs/INDEX.md)
- [apps/f5-tts/LOCAL_API_CN.md](./apps/f5-tts/LOCAL_API_CN.md)
