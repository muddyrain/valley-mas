# Valley MAS

Valley MAS 是一个以个人内容展示与创作管理为核心的网站项目，当前包含博客、图文、资源、AI Chat 等能力。

## 项目结构

- `apps/web`：前台 Web 站点
- `apps/admin`：管理端
- `server`：Go 服务端
- `packages`：共享包
- `docs`：项目文档

## 本地开发

1. 安装依赖

```bash
pnpm install
```

2. 启动 Go 服务

```bash
cd server
go run main.go
```

3. 启动 Web

```bash
cd apps/web
pnpm dev
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
