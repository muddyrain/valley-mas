# Random Map Runtime Variation Fix Report

日期：2026-09-16
范围：正式 Today Action → Loading → Expedition 随机地图重复问题

## 结论

已修复正式 Runtime 下同一 Mission 重复进入时 Seed 不变化的问题。正式任务配置现在为每次进入生成新的运行时 Seed；Mission 实例在进入前清理并重新创建，RandomMapGenerator 使用当前 Mission Seed 重新生成地图。

三次连续生成的 Seed 与 Building 组合均不同，未扩展 Layout、未修改 UI、未引入 V1.1 功能。

## 根因

正式入口 `apps/blue-hour/core/main.gd` 的 `_mission_config()` 原先只使用 `campaign.data.seed + campaign.data.day * 7919`。同一存档、同一天、同一 Mission 连续进入时，该值不变，因此 RandomMapGenerator 收到相同 Seed，建筑抽样和布局结果也会重复。

此前日志没有同时记录 Mission 实例、建筑 ID 和 Slot，无法直接确认是 Seed 重复、生成结果缓存，还是画面仍显示旧世界。

## 修复内容

- 正式 `_mission_config()` 增加 `random_mission_counter` 与 `Time.get_ticks_usec()` nonce，形成每次进入唯一的 `runtime_seed`。
- `Mission.setup()` 开始时清空 `generated_map`，记录真实 `get_instance_id()`。
- 正式入口继续通过 `_clear_mission()` 移除旧 Mission，再创建新的 Mission Node。
- 新 Mission 重新调用 `RandomMapGenerator.generate()`。
- 增加 Mission type、`use_random_map`、Seed、Layout、Instance ID、Building IDs、Building Slots、POI、Spawn、Extraction 日志。
- 显式传入的测试 Seed 保持不变，因此确定性测试不受影响。

## 正式路由

```text
Today Action
→ start_mission(action_id)
→ _mission_config(action_id)
→ departure/loading transition
→ _load_selected_mission()
→ Mission.setup(..., selected_mission_config)
→ RandomMapGenerator.generate(mission_type, runtime_seed, layout)
→ _apply_generated_map(catalog.map, generated)
→ City.build(catalog.map)
→ Expedition
```

旧固定地图仍作为 `use_random_map=false` 或生成失败时的 fallback。

## 三次连续结果

### Run 1

```text
Seed: 105501
Layout: LAYOUT_MEDIUM_3X4
Buildings: BLD_001_supermarket, BLD_005_restaurant_small, BLD_005_restaurant_small, BLD_002_house_small_a, BLD_011_residence_e, BLD_010_residence_d, BLD_010_residence_d, BLD_007_gas_station, BLD_021_small_office_a, BLD_014_small_apartment_b
Slots: block_0_slot_0, block_0_slot_1, block_0_slot_2, block_1_slot_0, block_1_slot_1, block_1_slot_2, block_1_slot_3, block_2_slot_0, block_2_slot_1, block_2_slot_2
Instance: generated-105501
```

### Run 2

```text
Seed: 210230
Layout: LAYOUT_MEDIUM_3X4
Buildings: BLD_004_pharmacy, BLD_001_supermarket, BLD_018_cafe_a, BLD_014_small_apartment_b, BLD_014_small_apartment_b, BLD_013_small_apartment_a, BLD_012_two_story_house_a, BLD_009_residence_c, BLD_009_residence_c, BLD_021_small_office_a
Slots: block_0_slot_0, block_0_slot_1, block_0_slot_2, block_1_slot_0, block_1_slot_1, block_1_slot_2, block_1_slot_3, block_2_slot_0, block_2_slot_1, block_2_slot_2
Instance: generated-210230
```

### Run 3

```text
Seed: 314959
Layout: LAYOUT_MEDIUM_3X4
Buildings: BLD_017_small_shop_b, BLD_005_restaurant_small, BLD_004_pharmacy, BLD_010_residence_d, BLD_011_residence_e, BLD_002_house_small_a, BLD_010_residence_d, BLD_008_auto_repair_shop, BLD_012_two_story_house_a, BLD_012_two_story_house_a
Slots: block_0_slot_0, block_0_slot_1, block_0_slot_2, block_1_slot_0, block_1_slot_1, block_1_slot_2, block_1_slot_3, block_2_slot_0, block_2_slot_1, block_2_slot_2
Instance: generated-314959
```

## 验证

已运行：

```powershell
Godot_v4.7.2-stable_win64_console.exe --headless --path apps/blue-hour --editor --import --quit
Godot_v4.7.2-stable_win64_console.exe --headless --path apps/blue-hour --script tests/random_map_generation_test.gd --quit-after 120
Godot_v4.7.2-stable_win64_console.exe --headless --path apps/blue-hour --script tests/building_runtime_test.gd --quit-after 120
./apps/blue-hour/run.ps1 -Mode smoke
Godot_v4.7.2-stable_win64_console.exe --headless --path apps/blue-hour --script tests/random_formal_runs.gd --quit-after 60
```

结果：

- Godot Import：PASS（导入完成；项目仍有既有 FBX/资源警告）
- Random Map Generation：PASS，9 cases，0 failures
- Building Runtime：PASS，22 definitions
- Smoke：命令完成，Ambient Bake 输出 PASS
- 三次 Seed/Building Variation：PASS
- 旧地图清理与新 Mission 创建：代码路径确认

## 影响范围

修改：`apps/blue-hour/core/main.gd`、`apps/blue-hour/missions/mission.gd`。新增验证脚本：`apps/blue-hour/tests/random_formal_runs.gd`。

未修改 UI、Layout 定义、Mission 类型集合、Expedition 主流程规则或 Random Map V1.1 功能。

## 计划文档同步

本次是既有 Random Expedition Map V1 正式路由的缺陷修复，未改变产品范围或新增验收目标；原 V1 报告仍保留此前最终验收状态，本报告不虚报 `COMPLETE`。

## 后续人工验收

建议在 Windows Godot 编辑器中从 Camp 的 Today Action 连续点击同一任务三次，观察 `[Mission]` 与 `[RandomMap]` 日志中的 Seed、Instance、IDs 和 Slots，并确认画面对应 GeneratedWorld。
