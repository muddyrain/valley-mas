# Runtime Baseline（治理前）

本报告记录 Project Structure Governance 1.5 清理前的运行证据。截图来自既有原生 Godot capture 输出；本轮未重做视觉设计。

## Main Menu

```text
PASS
Errors: 未发现本轮新增错误
Resources: title 与 create screenshots 已存在
Screenshot: test-output/menu/title-1919x1080.png
```

## Skill Selection

```text
PASS
证据：test-output/menu/create-1672x941-combat.png、create-1672x941-scavenge.png、create-1672x941-survey.png
```

## Loading

```text
PASS
证据：test-output/loading_v2/camp-first-frame.png；Godot headless import PASS
```

## Camp

```text
PASS
证据：test-output/camp-ui-review/01-camp-hud.png；tests/camp_party.gd：31 checks, 0 failures
```

## Mission Selection

```text
PASS
证据：test-output/camp-ui-review/06-today-action.png；tests/today_action.gd 已进入验证但本轮未完成完整运行链
```

## Expedition

```text
PASS
证据：test-output/expedition-ui-1-1/01_expedition_normal.png
```

## Survivor Models

```text
PASS
证据：tests/character_system_test.gd：所有测试通过；Xia/Su runtime GLB 存在
```

## Enemy Models

```text
PASS
正式 GLB：res://assets/characters/infected_basic_a/runtime/ENM_001_infected_basic_a_30k.glb
场景：res://scenes/enemies/enm_001_infected_basic_a.tscn
动画：场景内正式 runtime GLB 提供 Zombie_Idle/Zombie_Walk/Zombie_Chase
证据：tests/infected_basic.gd：62 checks, 0 failures；test-output/enm_001_runtime/expedition_10_idle.png
```

## Logs

```text
Missing Resource: 0 after stale .import cleanup and re-import
Invalid UID: 0 observed
Runtime Error: 0 observed in completed checks
```

## 未完成范围

完整 `run.ps1 -Mode test` 与六页面实时人工链路未在本轮全部跑完；以上 PASS 由已完成的 headless、smoke、专项测试和既有 capture 证据组成。
