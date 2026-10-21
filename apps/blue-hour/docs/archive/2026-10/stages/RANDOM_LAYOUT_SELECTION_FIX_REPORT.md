# Random Layout Selection Fix Report

日期：2026-09-16
项目：蓝时归航（Blue Hour）
范围：正式 Random Expedition Layout 固定为 `LAYOUT_MEDIUM_3X4` 的问题

## 结论

已修复正式 Today Action → Loading → Expedition 流程中 Layout 被固定为 `LAYOUT_MEDIUM_3X4` 的问题。

正式 Mission 配置不再预先指定 Layout，而是将空 Layout 传给 `RandomMapGenerator`。Generator 使用当前 Mission Seed 从现有三种 Layout 中进行确定性选择：

```text
LAYOUT_SMALL_3X3
LAYOUT_MEDIUM_3X4
LAYOUT_MEDIUM_4X4
```

本轮未新增 Layout、未修改 UI、未扩展 Random Map V1.1。

## 根因

`apps/blue-hour/core/main.gd::_mission_config()` 原先按任务类型直接指定 Layout，导致同一 Mission 类型始终使用相同 Slot 结构。虽然 Seed 和 Building Pool 会变化，但地图外形和 Slot 数量保持不变，视觉上仍像同一张地图。

## 修复内容

`_mission_config()` 现在使用 `layout = ""`。任务类型映射仍然保留：

- 默认 → `supply_search`
- `commercial` → `food_supply`
- `airdrop` → `rescue`

`RandomMapGenerator.generate()` 使用当前 Seed 选择 Layout：

```gdscript
var chosen := layout if not layout.is_empty() else Layouts.IDS[rng.randi_range(0, 2)]
```

同一 Seed 可复现，不同 Seed 可产生不同 Layout。

## 六次验证结果

验证脚本：`apps/blue-hour/tests/random_formal_runs.gd`

| Run | Seed | Layout | 建筑数量 |
|---|---:|---|---:|
| 1 | 105501 | `LAYOUT_SMALL_3X3` | 7 |
| 2 | 210230 | `LAYOUT_MEDIUM_3X4` | 10 |
| 3 | 314959 | `LAYOUT_MEDIUM_3X4` | 10 |
| 4 | 419688 | `LAYOUT_MEDIUM_3X4` | 10 |
| 5 | 524417 | `LAYOUT_MEDIUM_3X4` | 10 |
| 6 | 629146 | `LAYOUT_MEDIUM_4X4` | 12 |

六次运行覆盖了全部三种既有 Layout，并且每次建筑组合均由当前 Seed 重新抽取。

## 验证命令

```powershell
Godot_v4.7.2-stable_win64_console.exe --headless --path apps/blue-hour --editor --import --quit
Godot_v4.7.2-stable_win64_console.exe --headless --path apps/blue-hour --script tests/random_map_generation_test.gd --quit-after 120
Godot_v4.7.2-stable_win64_console.exe --headless --path apps/blue-hour --script tests/random_formal_runs.gd --quit-after 60
```

结果：Godot Import PASS；Random Map Generation PASS（9 cases，0 failures）；Seed 驱动 Layout Selection PASS；三种 Layout 覆盖 PASS。

## 影响范围

修改：`apps/blue-hour/core/main.gd`、`apps/blue-hour/tests/random_formal_runs.gd`。

未修改 Layout 定义、Mission 类型集合、UI/HUD、Expedition 主流程、Building Asset 或 Random Map V1.1 功能。

## 状态

Random Layout Selection Fix：**PASS**

本报告只记录 Layout Selection 修复，不将整个 Random Expedition Map V1 标记为 COMPLETE。
