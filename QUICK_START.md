# QUICK START

本文档用于本地快速跑通 Valley MAS（不包含 TTS 组件）。

## 1. 环境要求

- Go 1.23+
- Node.js 18+
- pnpm 8+

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

## 5. 必要配置

在 `server/.env` 中确认数据库、JWT、邮箱、AI 相关配置。

## 6. 常用接口

- 健康检查：`GET /health`
- 用户登录：`POST /api/v1/login`
- 用户注册：`POST /api/v1/register`
- 资源列表：`GET /api/v1/public/resources`

## 7. 快速自检

```bash
# server
cd server
go build .

# web
cd ../apps/web
node ../../node_modules/typescript/bin/tsc -p tsconfig.json --noEmit
```
