# Valley MAS

一个以个人内容展示与日常工具为主的网站项目，当前包含博客、图文、资源、AI Chat、TTS 等能力。

项目采用：

- `apps/web`：前台 Web 站点
- `apps/admin`：后台管理端
- `server`：Go 服务端
- `apps/f5-tts`：本地 F5-TTS 能力

当前线上发布方式是：

- `Vercel` 部署
- 包含 `Go server`

## 当前主要功能

- 内容主页展示
- 博客与图文内容发布
- 资源上传、展示与下载
- 创作空间管理
- AI Chat 页面
- TTS 页面与本地 F5-TTS 联动

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

## 本地开发

1. 安装依赖

```bash
pnpm install
```

2. 启动 Go 服务端

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
scripts\\start_local_api.cmd
```

## 常用校验

```bash
# web
node node_modules/typescript/bin/tsc -p apps/web/tsconfig.json --noEmit

# server
cd server
go build ./cmd/server
```

## 文档

- [QUICK_START.md](./QUICK_START.md)
- [docs/INDEX.md](./docs/INDEX.md)
- [apps/f5-tts/LOCAL_API_CN.md](./apps/f5-tts/LOCAL_API_CN.md)
