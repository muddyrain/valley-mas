# Aeon Vale 协作入口

适用于 `apps/aeon-vale`，原生 Godot / GDScript 造世游戏。

## 按任务读取

| 任务 | 入口 |
|---|---|
| 产品、领域术语或当前范围 | [上下文](CONTEXT.md)、[计划](docs/PLAN.md) |
| 运行与验收 | [说明](README.md)、[验证入口](docs/VALIDATION.md)、[工程](project.godot) |
| 地形、生态、植物或灾难 | [世界数据](scripts/world_data.gd)、[自然力](scripts/natural_forces.gd)、[笔刷](scripts/brush_mask.gd) |
| 存档、编号或时间单位 | [保存](scripts/save_store.gd)，联查数据、笔刷与旧档迁移 |
| 植被或地表表现 | [物种](scripts/plant_catalog.gd)、[资源读取](scripts/flora_sprites.gd)、[图集](scripts/pixel_flora.gd)、[土地](scripts/ground_art.gd)、[视图](scripts/world_view.gd)、[概览](scripts/overview_layer.gd) |

## 关键约束

- 原生 Godot，Compatibility 渲染；引擎版本与命令查运行入口。地图生成线程只处理数据，主线程经互斥保护的进度观察并接管结果。
- 编号、日历与生命阶段变化保留旧档语义；生态位置缓存包含玩家播种个体，预览与笔刷共用 `tool_affects`。
- 植被 PNG 使用 `assets/vegetation`，概览与精细树形使用同一世界坐标；分区与完整地图一致，生态更新不依赖镜头。
- WorldBox 仅作体验参考；新增图像记录来源和用途，资源复用沿现有流水线，不恢复废弃版本或旧几何回退。

## 验证与文档

实际检查远中近景、地表隐藏植被、加载响应、连续笔刷和生长枯萎；无头导入不能证明美术通过。命令见 [项目指南](../../docs/PROJECT_GUIDE.md)。术语变化更新 CONTEXT，规则决策更新对应 ADR，范围与状态更新计划，验收基线更新验证文档。
