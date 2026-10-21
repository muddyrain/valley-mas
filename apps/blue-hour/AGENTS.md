# Blue Hour 协作入口

适用于 `apps/blue-hour`，原生 Godot / GDScript 小队生存游戏。

分析或修改前必须读取 [PROJECT_CONTEXT](PROJECT_CONTEXT.md)；涉及玩法、战斗、角色控制、时间、搜刮、营地或 UI 设计时必须读取[游戏定位与核心体验](docs/design/game-design.md#游戏定位与核心体验)，未经明确授权不得改变已确认玩法。

## 按任务读取

| 任务 | 入口 |
|---|---|
| 产品边界、术语或当前工作 | [术语](CONTEXT.md)、[文档职责](docs/README.md)、[当前计划](docs/PLAN.md) |
| 营地、开局、跨日或保存 | [玩法](docs/design/game-design.md)、[营地](docs/design/camp.md)、[跨日契约](docs/design/day-loop.md)、[开局契约](docs/design/new-run.md) |
| 搜索、输入或撤离 | [行动](docs/design/expedition.md)、[搜索与输入契约](docs/architecture/search-and-input.md)，再进入 `missions/` |
| 武器、道具或角色 | [战斗](docs/design/combat.md)、[效果](docs/design/effects.md)、[角色](docs/design/characters.md) |
| UI、模型、动画或资源 | [美术基线](art/ART_BIBLE.md)、[资源流水线](art/ASSET_PIPELINE.md)、[资源目录](art/MODEL_CATALOG.md)、[资源身份](docs/architecture/resource-binding.md) |
| 运行、构建或验证 | [说明](README.md)、[验证入口](docs/VALIDATION.md)、[项目结构](docs/architecture/project-structure.md) |

## 关键约束

- 内容来自 `data/` Resource；成员与武器个体用稳定 ID。Campaign 持有跨日状态，表现不承担战斗、导航、资源或结算真源。
- 保存、购买、换装和结算使用一次事务，保存失败保留旧状态；玩家 `user://homeward/run.json` 与自动化 `user://test-runs/` 隔离，保留有效备份和旧档迁移。
- Survivor 的模型、头像、动画和数据经 `survivor_id` 与 Definition 关联；详细路径和公共动画规则见资源身份文档。
- 修改资产先复用现有资源；替换模型不改变玩法依赖。代码、场景和运行资源使用稳定业务名，版本历史交给 Git；命名门禁为 `scripts/check-blue-hour-naming.js`。

## 验证与文档

- 日常迭代使用当前可用环境验证受影响的逻辑、UI 和资源，记录环境与未覆盖的平台。Windows 包、目标平台性能和独立程序在 Windows 验收；本机专项不等同于发布验收。
- 交付 Windows 试玩包、发布，或修改导出配置/平台集成时，执行 Windows build 并验证独立 `build/BlueHourHomeward.exe`。日常源码迭代无需等待 Windows 构建；不得将未构建结果称为可发布。
- UI/HUD/Scene/Model 变更取得 1600×900 原生截图；交互覆盖入口、状态、关闭和连续操作，动画覆盖中断。命令见 [项目指南](../../docs/PROJECT_GUIDE.md)。
- 普通任务在交付回复中报告变更、验证和限制；临时证据进入 `test-output/` 或仓库 `.tmp/`。只将当前契约、决策和剩余工作写回对应文档，不逐次新增长期执行报告。
- 仅修改本项目及任务授权的仓库公共文件；日志、截图、构建和 `.godot/` 留在版本控制之外。
