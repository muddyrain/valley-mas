# 数据库迁移说明

本目录是历史 SQL 档案，不再作为自动执行入口。早期文件存在重复版本号和混合数据库方言，不能安全地从头重放。

可执行迁移的唯一真源是：

- `internal/dbmigration/postgres/*.sql`
- `internal/dbmigration/mysql/*.sql`

迁移文件编译进 `cmd/migrate`，执行状态记录在目标数据库的 `schema_migrations` 表中。

## 当前原则

- GORM model 改动必须同时新增 PostgreSQL 与 MySQL 的同版本迁移，并考虑默认值、索引和已有数据兼容。
- 迁移使用唯一时间戳版本，例如 `202607260010_add_xxx.sql`；两个方言目录的版本集合必须一致。
- 迁移版本一旦在任一持久数据库中记录为 `applied` 就不可变；不得在同版本文件中追加或改写 SQL。遗漏和修正必须新增更高版本的双方言修复迁移。
- 本地 `air` 只执行待处理迁移；普通热重载只查询版本表，不做全量 GORM schema introspection。
- 生产服务进程不隐式修改结构；部署在服务重启前显式执行迁移，失败即停止发布。
- MySQL 的 managed baseline 会创建 `valley_managed_add_column_if_missing` 与 `valley_managed_add_index_if_missing` 两个受控 helper；后续 MySQL 迁移用它们兼容已由 GORM 建好的旧库。
- 迁移账号必须具备目标结构所需的 DDL 权限；MySQL 首次接入还需要 `CREATE ROUTINE`，PostgreSQL 仅在尚未安装 pgvector 时需要创建扩展的权限。
- 破坏性迁移必须写清楚数据影响和回滚方式。

## 新增迁移检查清单

- [ ] 时间戳版本唯一，PostgreSQL 与 MySQL 文件版本一致。
- [ ] 本次只新增高于当前版本的新文件，没有修改任何已应用版本的 SQL。
- [ ] SQL 使用 Goose `-- +goose Up` 注解，并与目标数据库方言匹配。
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

查看并应用版本化迁移：

```bash
cd server
go run ./cmd/migrate status
go run ./cmd/migrate up
go run ./cmd/migrate version
```

全新的空开发库显式初始化一次：

```bash
cd server && go run ./cmd/migrate bootstrap --apply
```

`bootstrap` 会执行一次完整 GORM AutoMigrate，因此仍可能较慢，并且拒绝非空数据库与生产环境。已有数据库通过首个 managed baseline 接入，不重放本目录的历史 SQL。

`sync-schema` 只保留作开发/共享测试环境的定向应急修复。例如：

```bash
cd server && go run ./cmd/sync-schema --apply --models places,ledger,closet
```

它不会写入迁移版本历史，不能代替正式迁移。

## 已应用版本与实际结构不一致

如果业务日志出现 `column ... does not exist`，但 `go run ./cmd/migrate status` 显示相关版本已经 `applied`，先检查该迁移文件是否在应用时间之后又被修改。版本表只记录版本号和应用时间，不会因为文件内容变化而重跑旧版本，因此重启 `air` 不能修复这种漂移。

处理步骤：

1. 保留已经应用的旧迁移文件和 `schema_migrations` 记录，不删除、不回写。
2. 在 PostgreSQL/MySQL 目录新增同版本号的下一条幂等修复迁移，补齐遗漏字段、索引或约束。
3. 运行 `go run ./cmd/migrate status`，确认修复版本为 pending。
4. 运行 `go run ./cmd/migrate up`，或重启本地 `air` 自动应用 pending 版本。
5. 再次检查迁移状态，并验证实际字段/索引或最小业务写入链路；不能只以 `applied` 作为结构正确的证据。

## 历史迁移

目录中保留了从 `001` 到当前最新编号的历史迁移，其中部分早期迁移只适用于当时的 SQLite/本地开发阶段。查看旧迁移时，应以当前 `server/.env.example`、`internal/model`、managed migrations 和目标数据库为准，不要直接执行整个目录。
