# Server AGENTS

本文件只补充 `server` 的局部协作规则。全局规则、skill 选择、Git 规则和完成标准继承根目录 `AGENTS.md`。

## 功能定位

- `server` 是 Valley MAS 的 Go 服务端，提供用户认证、创作者空间、资源、博客/图文、留言、通知、下载记录、管理后台、AI 能力和 AI Mind Arena 接口。
- 技术栈为 Gin + GORM，入口在 `cmd/server/main.go`，启动组装在 `internal/bootstrap`，路由集中在 `internal/router/router.go`。
- 数据库支持 PostgreSQL/MySQL，配置来自环境变量和 `.env.example`。

## 路由与代码入口

- 服务入口：`cmd/server/main.go`。
- 本地辅助入口：`cmd/local/main.go`。
- 路由注册：`internal/router/router.go`。
- 配置读取：`internal/config/config.go`。
- 应用组装：`internal/bootstrap`。
- 数据库连接：`internal/database`。
- 中间件：`internal/middleware`。
- 日志：`internal/logger`。
- 业务 handler：`internal/handler`。
- 数据模型：`internal/model`。
- 通用工具：`internal/utils`。
- AI 能力：`internal/ai`。
- AI Mind Arena：`internal/mindarena`。
- 上传服务：`internal/service/upload_service.go`。

## 开发规范

- 新增或修改接口时，先定位 `internal/router/router.go` 的路由分组，再按 handler、model/service、middleware、前端 API 封装的顺序联动检查。
- 权限逻辑优先放在中间件或明确的服务端判断中，前端隐藏入口不能作为权限依据。
- GORM model 改动要考虑迁移、默认值、索引、生产 `DB_AUTO_MIGRATE=false` 的约束，以及现有数据兼容。
- AI/火山 ARK/多模态/模型配置/降级/响应解析相关改动必须启用 `ai-capability-orchestration`。
- Mind Arena 接口改动要同步检查前端 `apps/ai-mind-arena/lib/api.ts`、`lib/types.ts` 和 SSE 事件处理。
- 不在源码、日志、测试或示例配置中写真实密钥、真实 token、真实 SMTP 密码或云资源凭据。

## 环境变量提示

- 常规服务：`ENV`、`PORT`、`DB_*`、`JWT_SECRET`、`SMTP_*`。
- TOS 上传：`TOS_ACCESS_KEY`、`TOS_SECRET_KEY`、`TOS_BUCKET`、`TOS_ENDPOINT`、`TOS_REGION`。
- Valley AI Chat：`ARK_API_KEY`、`ARK_BASE_URL`、`ARK_TEXT_MODEL`、`ARK_VISION_MODEL`、`ARK_IMAGE_MODEL`。
- AI Mind Arena：`AI_PROVIDER`、`AI_BASE_URL`、`AI_API_KEY`、`AI_MODEL`；缺失或调用失败时应能回退 mock。

## 常用命令

```bash
cd server && go run ./cmd/server
cd server && go test ./...
cd server && go build ./cmd/server
cd server && air
```

## 校验要求

- Go 代码改动：运行 `cd server && go test ./...`。
- 路由、handler、模型、配置或中间件改动：检查对应前端 API 调用和 `.env.example` 是否需要同步。
- AI/Mind Arena 服务端改动：补充或运行相关 `internal/ai`、`internal/mindarena` 测试，并说明真实模型调用是否未验证。
- 仅改服务端协作文档时，至少运行根目录 encoding 检查；不需要跑 Go 编译时在最终回复说明原因。
