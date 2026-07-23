# 数据库迁移说明

本目录保存服务端数据库结构变更的 SQL 记录。当前仓库没有统一的迁移执行器脚本，不能再按旧文档里的单次 PowerShell 流程或固定 `002` 迁移流程操作。

## 当前原则

- GORM model 改动必须同时考虑迁移 SQL、默认值、索引、已有数据兼容和生产 `DB_AUTO_MIGRATE=false` 的约束。
- 本地开发可以临时开启 `DB_AUTO_MIGRATE=true` 或使用 `air db=true` 快速验证模型变化。
- 生产或共享环境不要依赖 AutoMigrate 隐式改结构，应使用明确、可审查、可回滚的 SQL 迁移。
- 新增迁移文件时沿用三位递增编号，例如 `035_add_xxx.sql`。
- 破坏性迁移必须写清楚数据影响和回滚方式。

## 新增迁移检查清单

- [ ] 迁移编号没有与现有文件冲突。
- [ ] SQL 与当前支持的数据库驱动匹配。
- [ ] model、handler、service 和前端 API 需要的字段已同步。
- [ ] 对已有数据有兼容策略，例如默认值、回填或分阶段上线。
- [ ] 需要回滚时提供 down SQL 或明确人工回退步骤。
- [ ] 已在本地或测试库验证迁移效果。
- [ ] 改动 Go 模型后运行 `cd server && go test ./...`。

## 本地验证建议

直接跑服务端测试：

```bash
cd server && go test ./...
```

一次性补齐当前 GORM model 对应的缺失表和字段。优先指定具体 model，避免远程 PostgreSQL 上全量 schema introspection 过慢：

```bash
cd server && go run ./cmd/sync-schema --apply --models places,ledger,closet
```

如需同步其他范围，可显式传入 `--scope lifetrace`、`--scope core`、`--scope content` 或 `--scope all`。`--scope all` 保留历史全量 AutoMigrate 行为，可能在远程库上很慢。带 `--apply` 时必须指定 `--models` 或 `--scope`，避免误跑大范围同步。

`sync-schema` 是开发和共享测试环境的应急同步命令，不是完整迁移执行器。它不会记录 SQL 文件是否已执行，也不会替代生产环境的审查、回滚和分阶段发布流程。新增字段或生产变更仍优先写明确 SQL 迁移。

使用本地自动迁移验证模型：

```bash
cd server && air db=true
```

或在 `.env` 中临时配置：

```env
DB_AUTO_MIGRATE=true
```

验证结束后不要把本地 `.env` 提交到仓库。

## 历史迁移

目录中保留了从 `001` 到当前最新的 `071` 迁移，其中部分早期迁移只适用于当时的 SQLite/本地开发阶段。查看旧迁移时，应以当前 `server/.env.example`、`internal/model` 和目标数据库为准，不要直接照搬旧文档里的单次迁移步骤。
