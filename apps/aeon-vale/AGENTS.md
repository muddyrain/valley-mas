# Aeon Vale 局部入口

## AI 任务最小上下文入口

- `CLAUDE.md` -> `apps/aeon-vale/AGENTS.md` -> `apps/aeon-vale/project.godot`

范围和状态见 [产品计划](./docs/PLAN.md)。

## 局部边界

- 原生 Godot 4.7 / GDScript / Compatibility 渲染；当前范围为地图造世、植物生态及六种天象与灾难神力，气温、生物和文明另按阶段推进。
- 地形、生态、植物生命、地表物件和持续灾难状态由 `scripts/world_data.gd` 持有；`scripts/natural_forces.gd` 推进灾难，`scripts/brush_mask.gd` 统一四种笔刷范围。改编号或时间单位必须联查 `scripts/save_store.gd` 的版本校验、笔刷及旧存档迁移，保留旧年份与生命阶段；生态位置缓存必须覆盖玩家播种的个体，预览和笔刷共用 `tool_affects` 判断实际可作用地块。
- WorldBox 只作实机体验参照；新增图像记录来源和使用方式，不提取参考游戏资源。物种目录见 `scripts/plant_catalog.gd`，植物与地表分别由 `scripts/pixel_flora.gd`、`scripts/ground_art.gd` 绘制；`scripts/world_view.gd` 在同一世界坐标上切换概览色点与精细树形。
- 地图生成线程不访问场景节点；主线程只通过互斥保护的进度字段观察生成状态，完成后接管结果。
- 实机验收同时检查远中近景、地表隐藏植被、加载中的响应、连续笔刷与完整生长和枯萎过程；生态更新不得依赖镜头位置。只通过无头导入不能宣称美术完成。运行命令见根项目指南。
