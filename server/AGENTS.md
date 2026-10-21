# Server 协作入口

适用于 `server`，负责 API、权限、持久化与服务端 AI 调用。

## 按任务读取

| 任务 | 入口 |
|---|---|
| API 或权限 | [路由](internal/router/router.go)，再读对应 handler、middleware、service/model 和调用方 |
| 配置或环境 | [配置](internal/config/config.go)、[环境示例](.env.example) |
| 数据库变化 | [迁移约定](migrations/README.md)、[服务说明](README.md) |
| AI 调用或工具循环 | [模型解析](internal/aimodel)、[AI 客户端](internal/aiclient)、[工具](internal/ai/tools)、[运行时](internal/ai/agent) |

## 关键约束

- 权限由中间件或服务端执行；用户主动 AI 调用经 `aimodel.ResolveInvocation`，handler 不直接读取 Provider 密钥。
- GORM model 变化增加 PostgreSQL/MySQL 版本化迁移。已应用版本保持不变，修正新增版本，并核对实际字段、索引和写入链路。

## 验证与文档

验证受影响 Go 测试、权限分支和迁移；命令见 [项目指南](../docs/PROJECT_GUIDE.md)。接口、配置或迁移操作变化更新相应契约与 README。
