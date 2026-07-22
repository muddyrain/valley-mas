# 维护命令

本目录只放不参与服务启动、也不由 HTTP 路由调用的运维命令。执行前先确认目标环境与数据范围，默认不应在生产环境直接运行。

| 命令 | 用途 | 保留条件 |
| --- | --- | --- |
| `backfill-download-user-ids` | 修复 Creator 移除期间遗留的下载记录 `user_id` | 确认历史库没有待修复记录后可删除 |
| `purge-legacy-workflows` | 清理工作流升级前的旧工作流及关联数据 | 确认开发库不再需要旧数据后可删除 |
| `bootstrap-admin` | 创建或重置管理员账号 | 需要显式传入 `--password`，不会输出密码 |

示例：

```bash
cd server
go run ./cmd/maintenance/bootstrap-admin --username admin --password '<strong-password>'
go run ./cmd/maintenance/backfill-download-user-ids --apply
go run ./cmd/maintenance/purge-legacy-workflows --dry-run
```
