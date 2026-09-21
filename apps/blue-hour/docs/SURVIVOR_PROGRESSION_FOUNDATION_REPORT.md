# Survivor Progression Foundation V1

日期：2026-09-21

## Architecture

- Progression 数据：`data/survivor_progression.gd`，保存 `survivor_id`、`current_level`、`current_xp`、`total_xp`、`xp_to_next_level`。
- Runtime 入口：`core/campaign.gd` 的 `add_xp()`、`record_xp_event()`、`get_level()`、`get_trait_level()`、`can_level_up()`、`apply_level_up()`。
- XP Event：`SEARCH_COMPLETE`、`KILL_ENEMY`、`MISSION_COMPLETE`、`EXTRACTION_SUCCESS`、`SPECIAL_EVENT`。默认每个事件 1 XP，调用方可传入明确数量。
- Trait 联动：`member_trait()` 只读取 Progression Level，再调用既有 `TraitData.at_level()`；不复制 Trait 数值。
- Save / Load：新存档为 v5；旧 v1～v4 保持读取兼容，首次恢复时补齐 Progression 字段。保存只写等级与 XP，不写最终 Trait 数值。

## Level Contract

Level 1 → 2、2 → 3、3 → 4、4 → 5 的 XP 阈值分别为 `2 / 3 / 5 / 8`。Level 5 继续获得 XP 时保留 `total_xp`，但不会超过 Level 5。

现有 Camp 食物训练仍保留为兼容入口，内部通过 Progression API 完成等级提升，不再直接修改 `roster.level`。

## Verification

- Progression：20 checks，0 failures。
- Trait Foundation：44 checks，0 failures；搜寻直觉、精打细算回归通过。
- New Run：40 checks，0 failures。
- Weapon System：428 checks，0 failures。
- Save Catalog Compatibility：9 checks，0 failures。
- Trait Gameplay：111 checks，0 failures。
- Godot Headless Import：PASS（Godot 4.7.2，`--headless --editor --import --quit`）。此前记录的 `town_runtime_adapter.gd:186` `arrival_exit` 解析错误在重跑时未复现，未修改该文件。
- Search / Command 运行时回归：受工作区既有 `weapons/weapon_combat_controller.gd` 未声明符号（`resolve`、`resolved`、`origin`、`mission`）阻断；该文件不属于本轮改动，未修改。

本轮没有制作 UI、升级动画、招募、受伤、Aura、疲劳、士气或关系系统，也没有接入新的 Gameplay XP 发放点；统一 Event 和 Campaign API 已建立，后续玩法可通过 API 接入。
