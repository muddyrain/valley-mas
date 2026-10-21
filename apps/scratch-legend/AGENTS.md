# Scratch Legend 协作入口

适用于 `apps/scratch-legend`，刮卡增量游戏。

## 按任务读取

| 任务 | 入口 |
|---|---|
| 玩法、数值、概率、奖励、解锁或 Prestige | [设计](docs/scratch-legend-design.md) |
| 优先级或里程碑状态 | [当前任务](docs/scratch-legend-task.md) |
| 配置、状态或存档 | [配置](lib/game-config.ts)、[存档](lib/game-save.ts)、[状态](lib/game-store.ts) |

## 关键约束

规则以设计与数据配置共同核对。存档变化保留迁移和旧数据恢复路径，不以初始化覆盖有效进度。

## 验证与文档

刮卡、解锁、动画、响应式与本地持久化验证对应运行时行为；命令见 [项目指南](../../docs/PROJECT_GUIDE.md)。玩法变化更新设计，阶段变化更新任务，普通修复不制造计划更新。
