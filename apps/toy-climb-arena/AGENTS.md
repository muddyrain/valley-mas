# Toy Climb Arena 协作入口

适用于 `apps/toy-climb-arena`，Three.js 攀爬游戏。

## 按任务读取

| 任务 | 入口 |
|---|---|
| 当前任务或里程碑 | [任务文档职责](docs/TASK_DOCS_INDEX.md)，再读其中指定的当前清单 |
| 玩法或关卡 | [玩法](docs/GAME_DESIGN.md)、[关卡规则](docs/LEVEL_DESIGN_RULES.md)、[关卡数据](src/climberLevels.ts)、[关卡模块](src/levels)、[构建器](src/level/LevelBuilder.ts) |
| 资源 | [资源指南](docs/ASSET_GUIDE.md) |
| 应用与 HUD | [应用](src/main.tsx)，再读对应状态与 HUD |

## 关键约束

物理与关卡规则归玩法层，表现层消费结果。旧 ROADMAP 与总地图方案的历史定位以任务索引为准，不作为当前任务清单。

## 验证与文档

资源生成、物理与关卡变更取得实际游玩证据；命令见 [项目指南](../../docs/PROJECT_GUIDE.md)。按任务索引更新对应主清单或详细拆解，不并行维护多份总状态。
