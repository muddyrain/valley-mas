# Survivor XP Gameplay Integration V1

日期：2026-09-21

## XP Event

- 统一 XP 数值配置：`data/survivor_progression.gd` 的 `XP_EVENT_VALUES`。
- `SEARCH_COMPLETE`：1 XP，由 `missions/search_task.gd` 的搜索成功完成点发放给执行者。
- `KILL_ENEMY`：1 XP，由 `enemies/enemy.gd` 保留最终 `HitEvent.source`，再由 `missions/mission.gd::_retire_enemy()` 发放给最终击杀者。
- `MISSION_COMPLETE`：5 XP，由 `core/campaign.gd::stage_result()` 发放给 `selected_party`。
- `EXTRACTION_SUCCESS`：3 XP，由同一结算入口发放给 `returned_ids`；失败或全灭没有成功撤离 XP。
- `SPECIAL_EVENT`：保留统一 `record_xp_event()` API，当前不接入具体剧情事件。

## Duplicate Protection

- Search / kill 使用 Mission 级事件键；搜索站点完成状态和敌人回收状态不会重复发放。
- 敌人对象池重新生成时清除旧实例键，避免复用对象被错误跳过。
- Mission / extraction 结算受 `Campaign.data.status == "mission"` 保护，重复 `stage_result()` 不会重复发放。

## Verification

- `survivor_progression.gd`：29 checks，0 failures。
- `survivor_xp_gameplay.gd`：6 checks，0 failures。
- 覆盖搜索完成、搜索重复、最终击杀归属、重复敌人回收、任务参与者范围、成功撤离、失败不发放、Save / Load 和 Level / Trait Level 联动。
- Godot Headless Import：PASS（Godot 4.7.2）。
- Weapon System：428 checks，0 failures。
- `search_dispatch.gd`：56 checks，2 个工作区既有时序断言失败；未涉及 XP 断言，未修改其失败相关逻辑。

本轮没有修改模型、动画、Trait 数值、Trait Runtime、HUD、武器动画、Ground Contract、Aura、治疗、暴击、招募、受伤、疲劳、士气或关系系统。
