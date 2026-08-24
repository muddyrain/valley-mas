# Server 协作入口

## AI 任务最小上下文入口

- `CLAUDE.md` -> `server/AGENTS.md` -> `internal/router/router.go` -> `internal/config/config.go` -> `.env.example`。

## 服务边界

- 接口改动按 router、handler、model/service、middleware、调用方顺序核对；权限必须由中间件或服务端判断执行。
- GORM model 改动新增 PostgreSQL/MySQL 版本化迁移。已应用版本不可改写；修正必须新增更高版本，并验证实际字段、索引或写入链路。
- 用户主动发起的 AI 调用从 `aimodel.ResolveInvocation` 和 `internal/aiclient` 进入；多轮、查询型场景使用 `internal/ai/tools/<domain>` 与 `internal/ai/agent.AgentRuntime`，不在 handler 直读 Provider 密钥。
