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
- 通用 AI 客户端：`internal/aiclient`（封装 ARK / OpenAI / Gemini client、SSE writer、JSON / 文本工具）。
- AI 能力：`internal/ai`。
- AI Mind Arena：`internal/mindarena`。
- 上传服务：`internal/service/upload_service.go`。

## 开发规范

- 新增或修改接口时，先定位 `internal/router/router.go` 的路由分组，再按 handler、model/service、middleware、前端 API 封装的顺序联动检查。
- 权限逻辑优先放在中间件或明确的服务端判断中，前端隐藏入口不能作为权限依据。
- GORM model 改动要考虑迁移、默认值、索引、生产 `DB_AUTO_MIGRATE=false` 的约束，以及现有数据兼容。
- AI/火山 ARK/多模态/模型配置/降级/响应解析相关改动必须启用 `ai-capability-orchestration`。
- 新增 AI 接入应优先复用 `internal/aiclient`；不在 handler 里直接 `os.Getenv("ARK_*")` 或 `arkruntime.NewClientWithApiKey(...)`。
- Mind Arena 接口改动要同步检查前端 `apps/ai-mind-arena/lib/api.ts`、`lib/types.ts` 和 SSE 事件处理。
- 不在源码、日志、测试或示例配置中写真实密钥、真实 token、真实 SMTP 密码或云资源凭据。

## 环境变量提示

- 常规服务：`ENV`、`PORT`、`DB_*`、`JWT_SECRET`、`SMTP_*`。
- TOS 上传：`TOS_ACCESS_KEY`、`TOS_SECRET_KEY`、`TOS_BUCKET`、`TOS_ENDPOINT`、`TOS_REGION`。
- Valley/Blog/Creator 默认 ARK 能力：`ARK_API_KEY`、`ARK_BASE_URL`、`ARK_TEXT_MODEL`、`ARK_VISION_MODEL`、`ARK_IMAGE_MODEL`。
- Life Trace Pantry AI 拍照分析优先使用 Gemini：`GEMINI_API_KEY`、`GEMINI_API_BASE_URL`、`GEMINI_VISION_MODEL`、`LIFE_TRACE_PANTRY_PHOTO_AI_PROVIDER`、`LIFE_TRACE_PANTRY_PHOTO_AI_TIMEOUT_SECONDS`；未配置时回退 ARK 图片/文本模型。
- Life Trace 文本 AI 可选覆盖：`LIFE_TRACE_AI_API_KEY`、`LIFE_TRACE_AI_BASE_URL`、`LIFE_TRACE_AI_MODEL`、`LIFE_TRACE_AI_TIMEOUT_SECONDS`；配置后优先于 `ARK_TEXT_MODEL`，旧 `OPENAI_API_*` 仅作兼容。
- AI Mind Arena：`MIND_ARENA_AI_PROVIDER`、`MIND_ARENA_AI_BASE_URL`、`MIND_ARENA_AI_API_KEY`；默认复用 `ARK_TEXT_MODEL`，只有需要单独切换脑内会议室模型时才配置 `MIND_ARENA_AI_MODEL`。缺失或调用失败时应能回退 mock，旧 `AI_*` 仅作兼容。

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
- 仅改服务端协作文档且包含 CJK/非 ASCII 文本时，运行定向 encoding 检查；不需要跑 Go 编译时在最终回复说明原因。
