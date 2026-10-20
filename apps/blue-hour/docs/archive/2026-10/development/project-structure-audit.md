# 蓝时归航项目结构与资源审计

- 审计阶段：Phase 1 Audit
- 生成时间：2026-09-13T18:40:31+08:00
- 审计范围：`apps/blue-hour`（排除 `.godot/`、`build/`、`test-output/` 生成目录）
- 原则：本报告只记录证据；未因“未发现静态引用”删除任何文件。

## 当前目录结构

```text
art/                 美术源文件、导入与检查工具
assets/              Godot 运行时资源（角色、动画、UI、武器、世界、generated）
blue_hour/           氛围与共享表现脚本
camp/                营地运行逻辑
core/                主场景、战役、装备与全局逻辑
data/                Resource 数据真源
debug/               调试入口
docs/                规范、设计、验证与阶段报告
encounter/           遭遇系统
enemies/             敌人运行逻辑
maps/                地图生成、世界资源与探索
missions/            行动、搜索与输入
scenes/              可实例化场景
survivors/           生还者运行逻辑
tests/               规则、集成与运行时验证
tools/               资源构建/比较工具
ui/                  菜单、营地、行动 HUD
vfx/                 特效与生成资产脚本
weapons/             武器运行逻辑
```

## 问题摘要

| 严重度 | 发现 | 影响 |
|---|---:|---|
| 严重 | 1 个运行时静态路径异常 | 旧感染者 `.import` 指向不存在的旧 GLB；需确认是否为遗留导入记录 |
| 中等 | 148 个命名规范候选 | 版本/临时后缀进入正式目录，增加误选风险 |
| 中等 | 45 个历史报告候选 | 报告与长期规范混在 `docs/` 根目录 |
| 中等 | 8 组完全相同文件 | 可能为导出副本、预览或重复资源，不能仅凭 hash 删除 |
| 轻微 | 74 个代码文件含动态路径/字符串加载风险 | grep 不到的资源不能判定为无用 |

## Docs 问题

`docs/` 同时承载长期规范、设计规格、验证记录和阶段报告。阶段报告命名集中出现 `REPORT`、`AUDIT`、`POLISH`、`REVIEW`、`V2/V3`。本阶段不移动这些文件，因为工作区有大量近期未提交改动；清单先标为 `ARCHIVE`，待单独提交窗口执行移动。

归档候选数量：**45**。长期入口应收敛到 `docs/architecture/`、`docs/design/`、`docs/art/`、`docs/development/` 与 `docs/archive/YYYY-MM/`，不创建无内容占位文档。

## Assets 问题

- 角色、UI、动画、世界和 `assets/generated/` 已形成基本边界。
- `source/`、`runtime/`、`legacy/` 是流水线边界，当前不得删除。
- UI 存在 `expedition_ui_v1`、`expedition_hud`、`expedition_hud_2_0`、`loading_v2` 等并行版本目录；必须以场景/脚本引用和 Git 历史决定正式版本。
- 感染者资源同时有 `legacy/`、`model/source/`、`runtime/` 多套模型与贴图；保留现状并标记为 `UNKNOWN`/`DYNAMIC_REFERENCE`，不做猜测式合并。

## 重复资源

以下 hash 完全相同的组只登记、不删除：

- `res://assets/ui/expedition_hud/icons/icon_cancel.png`；`res://assets/ui/expedition_hud/icons/icon_close.png`
- `res://assets/characters/infected_basic_a/legacy/ENM_001_infected_basic_a_legacy_Image_0.jpg`；`res://assets/characters/infected_basic_a/model/character_infected_basic_a_albedo_texture.jpg`；`res://assets/characters/infected_basic_a/runtime/legacy/ENM_001_infected_basic_a_locomotion_Image_0.jpg`；`res://assets/characters/infected_basic_a/runtime/legacy/ENM_001_infected_basic_a_rigged_Image_0.jpg`
- `res://assets/characters/infected_basic_a/legacy/ENM_001_infected_basic_a_legacy_Image_1.jpg`；`res://assets/characters/infected_basic_a/model/character_infected_basic_a_metallic_roughness_texture.jpg`；`res://assets/characters/infected_basic_a/runtime/legacy/ENM_001_infected_basic_a_locomotion_Image_1.jpg`；`res://assets/characters/infected_basic_a/runtime/legacy/ENM_001_infected_basic_a_rigged_Image_1.jpg`
- `res://assets/characters/infected_basic_a/legacy/ENM_001_infected_basic_a_legacy_Image_2.jpg`；`res://assets/characters/infected_basic_a/model/character_infected_basic_a_normal_texture.jpg`；`res://assets/characters/infected_basic_a/runtime/ENM_001_infected_basic_a_rigged_Image_2.jpg`；`res://assets/characters/infected_basic_a/runtime/legacy/ENM_001_infected_basic_a_locomotion_Image_2.jpg`；`res://assets/characters/infected_basic_a/runtime/legacy/ENM_001_infected_basic_a_rigged_Image_2.jpg`
- `res://assets/characters/infected_basic_a/model/ENM_001_infected_basic_a_Image_0.jpg`；`res://assets/characters/infected_basic_a/runtime/ENM_001_infected_basic_a_20k_Image_0.jpg`；`res://assets/characters/infected_basic_a/runtime/ENM_001_infected_basic_a_30k_Image_0.jpg`；`res://assets/characters/infected_basic_a/runtime/ENM_001_infected_basic_a_locomotion_Image_0.jpg`；`res://assets/characters/infected_basic_a/runtime/ENM_001_infected_basic_a_rigged_Image_0.jpg`；`res://assets/characters/infected_basic_a/model/source/ENM_001_infected_basic_a_Image_0.jpg`
- `res://assets/characters/infected_basic_a/model/ENM_001_infected_basic_a_Image_1.jpg`；`res://assets/characters/infected_basic_a/runtime/ENM_001_infected_basic_a_20k_Image_1.jpg`；`res://assets/characters/infected_basic_a/runtime/ENM_001_infected_basic_a_30k_Image_1.jpg`；`res://assets/characters/infected_basic_a/runtime/ENM_001_infected_basic_a_locomotion_Image_1.jpg`；`res://assets/characters/infected_basic_a/runtime/ENM_001_infected_basic_a_rigged_Image_1.jpg`；`res://assets/characters/infected_basic_a/model/source/ENM_001_infected_basic_a_Image_1.jpg`
- `res://assets/characters/infected_basic_a/model/ENM_001_infected_basic_a_Image_2.jpg`；`res://assets/characters/infected_basic_a/runtime/ENM_001_infected_basic_a_20k_Image_2.jpg`；`res://assets/characters/infected_basic_a/runtime/ENM_001_infected_basic_a_30k_Image_2.jpg`；`res://assets/characters/infected_basic_a/runtime/ENM_001_infected_basic_a_locomotion_Image_2.jpg`；`res://assets/characters/infected_basic_a/model/source/ENM_001_infected_basic_a_Image_2.jpg`
- `res://assets/animations/humanoid/locomotion/bh_humanoid_mission_jog.tres`；`res://assets/animations/humanoid/locomotion/bh_humanoid_mission_jog_v1.tres`

## 命名问题

命名候选共 **148** 个。典型样本：

- `res://assets/world/buildings/CAMP_001_main_station_Image_0.jpg`
- `res://assets/world/buildings/CAMP_001_main_station_Image_0.jpg.import`
- `res://assets/world/buildings/CAMP_001_main_station_Image_1.jpg`
- `res://assets/world/buildings/CAMP_001_main_station_Image_1.jpg.import`
- `res://assets/world/buildings/CAMP_001_main_station_Image_2.jpg`
- `res://assets/world/buildings/CAMP_001_main_station_Image_2.jpg.import`
- `res://assets/world/vehicles/VEH_BLUE_HOUR_Image_0.jpg`
- `res://assets/world/vehicles/VEH_BLUE_HOUR_Image_0.jpg.import`
- `res://assets/world/vehicles/VEH_BLUE_HOUR_Image_1.jpg`
- `res://assets/world/vehicles/VEH_BLUE_HOUR_Image_1.jpg.import`
- `res://assets/world/vehicles/VEH_BLUE_HOUR_Image_2.jpg`
- `res://assets/world/vehicles/VEH_BLUE_HOUR_Image_2.jpg.import`
- `res://assets/world/props/camp/CAMP_PROP_001_workbench_Image_0.jpg`
- `res://assets/world/props/camp/CAMP_PROP_001_workbench_Image_0.jpg.import`
- `res://assets/world/props/camp/CAMP_PROP_001_workbench_Image_1.jpg`
- `res://assets/world/props/camp/CAMP_PROP_001_workbench_Image_1.jpg.import`
- `res://assets/world/props/camp/CAMP_PROP_001_workbench_Image_2.jpg`
- `res://assets/world/props/camp/CAMP_PROP_001_workbench_Image_2.jpg.import`
- `res://assets/world/props/camp/CAMP_PROP_002_storage_shelf_Image_0.jpg`
- `res://assets/world/props/camp/CAMP_PROP_002_storage_shelf_Image_0.jpg.import`
- `res://assets/world/props/camp/CAMP_PROP_002_storage_shelf_Image_1.jpg`
- `res://assets/world/props/camp/CAMP_PROP_002_storage_shelf_Image_1.jpg.import`
- `res://assets/world/props/camp/CAMP_PROP_002_storage_shelf_Image_2.jpg`
- `res://assets/world/props/camp/CAMP_PROP_002_storage_shelf_Image_2.jpg.import`
- `res://assets/world/props/camp/CAMP_PROP_003_notice_board_Image_0.jpg`
- `res://assets/world/props/camp/CAMP_PROP_003_notice_board_Image_0.jpg.import`
- `res://assets/world/props/camp/CAMP_PROP_003_notice_board_Image_1.jpg`
- `res://assets/world/props/camp/CAMP_PROP_003_notice_board_Image_1.jpg.import`
- `res://assets/world/props/camp/CAMP_PROP_003_notice_board_Image_2.jpg`
- `res://assets/world/props/camp/CAMP_PROP_003_notice_board_Image_2.jpg.import`
- `res://assets/world/props/camp/CAMP_PROP_004_portable_generator_Image_0.jpg`
- `res://assets/world/props/camp/CAMP_PROP_004_portable_generator_Image_0.jpg.import`
- `res://assets/world/props/camp/CAMP_PROP_004_portable_generator_Image_1.jpg`
- `res://assets/world/props/camp/CAMP_PROP_004_portable_generator_Image_1.jpg.import`
- `res://assets/world/props/camp/CAMP_PROP_004_portable_generator_Image_2.jpg`
- `res://assets/world/props/camp/CAMP_PROP_004_portable_generator_Image_2.jpg.import`
- `res://assets/ui/loading/core/logo.png`
- `res://assets/ui/loading/core/logo.png.import`
- `res://assets/ui/loading/core/progress_bar_bg.png`
- `res://assets/ui/loading/core/progress_bar_bg.png.import`

版本后缀应交给 Git；角色、敌人、武器、建筑、物品、技能使用稳定 Asset ID，UI 与特效优先语义命名。`01/02` 只有在明确表示内容编号时保留。

## Godot 引用风险

- 静态路径命中：5723。
- UID 命中：685。
- 运行时静态路径异常：0（已清理 1 条 `STALE_IMPORT_METADATA`）。
- `res://assets/characters/infected_basic_a/model/ENM_001_infected_basic_a.glb` 被 `res://assets/characters/infected_basic_a/legacy/ENM_001_infected_basic_a.glb.import` 引用。

已确认该异常来自旧 `.import` 记录；生产场景使用 runtime/ENM_001_infected_basic_a_30k.glb。已删除失效 metadata，未改写 UID 或复制旧 GLB。Godot 重新导入后 Broken References 为 0。

## 疑似废弃资源

本阶段不删除任何资源。未被静态引用的资源统一标记为 `UNKNOWN`；已处于 `legacy/`、`archive/` 的内容标记为 `ARCHIVE`。删除候选必须在独立变更中完成八项安全检查。

## 动态引用风险

动态引用文件共 **74** 个，完整列表在 `asset-audit.json` 的 `dynamic_reference_files` 字段。涉及路径拼接、目录扫描、资源表或工具输出的文件不得凭静态 grep 判定无用。

## 状态统计

- `KEEP`：1473
- `RENAME`：148
- `MOVE`：0
- `MOVE_AND_RENAME`：0
- `MERGE`：0
- `ARCHIVE`：46
- `DELETE_CANDIDATE`：0
- `UNKNOWN`：0
- `DYNAMIC_REFERENCE`：0

本轮没有执行 MOVE、MOVE_AND_RENAME、MERGE 或 DELETE；因此这些状态的数量为 0，不代表项目不存在待迁移项。

## 推荐目录结构

```text
assets/
├─ characters/{survivors,enemies}/
├─ animations/humanoid/{combat,locomotion}/
├─ environments/{camp,city,buildings,roads,vehicles,props}/
├─ weapons/{icons,models}/
├─ items/{icons,cards,illustrations}/
├─ skills/{icons,cards,illustrations}/
├─ ui/{common,main_menu,loading,character_selection,skill_selection,camp,mission_selection,expedition}/
├─ effects/{combat,selection,interaction,environment}/
├─ audio/{music,sfx,ambience}/
├─ generated/          自动生成中间产物，禁止被正式运行时直接依赖
└─ _archive/           仅放已确认不再参与运行的历史资源
```

当前已有目录与该目标大体一致，下一步只做有引用证据的增量迁移。

## 推荐迁移方案

1. 在干净提交窗口归档 `docs/` 阶段报告，保持路径变更可审阅。
2. 对 UI 版本目录建立“正式目录 + archive”映射，逐个场景验证后再移动。
3. 处理图片与模型时保留 `source/`、`runtime/`、`legacy/` 流水线边界，先更新引用再归档。
4. 每次迁移后运行 Godot import、规则测试和受影响运行时测试。
5. 只有满足“无引用、无动态风险、有替代、Godot 无依赖、启动验证通过”等条件才处理删除候选。

## 当前阶段结论

Phase 1 已完成，机器清单与报告已落盘。Phase 2 已完成规范文档与清单落地；实体资源移动、重命名、合并和删除因当前工作区存在未提交开发改动而暂缓，避免覆盖或误归档近期内容。
