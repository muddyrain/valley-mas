# Survivor Animation Phase 3 — Batch Reuse

## Task Summary

**Survivor Animation V1 batch integration PASS.** `SUR_002`～`SUR_012` 已按正式 `SurvivorDefinition` 接入与夏知遥相同的 Expedition 动画控制器和 11 段 AnimationLibrary。逐角色结构、状态、接地、握持与批量画面检查通过。没有重新烘焙或修改已验收动画，也没有修改 `BH_Humanoid_Rig_v1`、角色模型、武器数值、Gameplay、UI、地图或敌人系统。没有开始 ENM_001。

## Changed Files

| 类型 | 文件 | 作用 |
| --- | --- | --- |
| 修改 | `survivors/survivor.gd` | 所有正式 `SurvivorDefinition` 在模型加载后选用既有 Expedition 控制器；非正式旧数据仍走旧路径。 |
| 新增 | `tests/survivor_animation_batch.gd`、`.gd.uid` | 12 人共同基线、11 段播放、角色状态、K9 握持与九组 1600×900 对比图。 |
| 修改 | `tests/combat_animation_mission.gd`、`tests/mission_locomotion_style.gd`、`tests/locomotion_polish.gd`、`tests/survivor_locomotion.gd`、`tests/public_locomotion_production.gd`、`tests/remaining_survivor_batch.gd`、`tests/survivor_production_pack.gd`、`tests/weapon_visuals.gd` | 将旧控制器的状态与速度预期对齐已验收的 Expedition 图；保留原 Gameplay、武器与公共资源检查。 |
| 修改 | `run.ps1`、`art/verify_export.ps1` | 用正式批量专项替换不再适用于正式角色的旧 Public/Combat 图专项，并纳入 test、capture、build 与内嵌包验证。 |
| 修改 / 新增 | `docs/PLAN.md`、本报告 | 同步阶段状态与验证边界。 |

源码中的 11 段 GLB、`survivor_animations.tres`、角色 Runtime GLB、冻结 Rig 和武器 Resource 均未进入本次差异。

## Implementation Details

`Catalog.survivors` 提供 12 份正式 Definition；各 Definition 的 `survivor_id` 确定身份，`model_path` 确定角色 Runtime GLB。`Survivor.setup` 加载该模型后，为正式 Definition 创建同一个 `survivor_expedition_animation_controller.gd`。控制器继续调用 `survivor_animation_pipeline.gd`，直接引用 `survivor_animations.tres`；武器仍通过现有 `RightHand` Socket、Grip Modifier 和武器模型标记装配。没有按中文名、文件顺序或角色目录复制动画。

批量测试将夏知遥作为对照，逐人比对 23 骨名称、父级、Rest Pose、模型缩放与脚底位置；十一人均与基线一致，因此无需角色专属 retarget 或 attachment offset。测试对每人逐段启动 11 个动画，随后走真实控制器状态、装备、`combat.fired`、`take_damage` 和死亡末态。截图是同一原生 Godot 场景中的 12 人 4×3 对比，画面下方标有 `SUR_ID`；它用于识别角色差异，正式 Expedition 事件回归另由 Mission 专项覆盖。

## Per-Survivor Acceptance

| ID | 角色 | 骨骼 / 接地 / Run | Rifle / Knife / Hit / Death | 结论 | 阻断问题 |
| --- | --- | --- | --- | --- | --- |
| SUR_002 | 苏晚星 | PASS | PASS | **PASS** | 无 |
| SUR_003 | 林见月 | PASS | PASS | **PASS** | 无 |
| SUR_004 | 陆清禾 | PASS | PASS | **PASS** | 无 |
| SUR_005 | 沈砚川 | PASS | PASS | **PASS** | 无 |
| SUR_006 | 唐栀 | PASS | PASS | **PASS** | 无 |
| SUR_007 | 顾予安 | PASS | PASS | **PASS** | 无 |
| SUR_008 | 程茉 | PASS | PASS | **PASS** | 无 |
| SUR_009 | 周野 | PASS | PASS | **PASS** | 无 |
| SUR_010 | 许昭宁 | PASS | PASS | **PASS** | 无 |
| SUR_011 | 贺临川 | PASS | PASS | **PASS** | 无 |
| SUR_012 | 宋时雨 | PASS | PASS | **PASS** | 无 |

`SUR_001` 夏知遥是对照角色；原有控制器选择与动画内容未改。九张原生 PNG 均为 1600×900，位于 `test-output/survivor-animation/batch/`：`idle.png`、`run.png`、`rifle_idle.png`、`rifle_run.png`、`rifle_shoot.png`、`knife_idle.png`、`knife_attack.png`、`hit.png`、`death.png`。逐图检查未发现新增角色相对夏知遥的骨骼错位、明显穿模或武器漂浮；K9 支持手与握把距离在稳定 Rifle Idle/Run/Shoot 状态均小于 3 cm。测试 JSON 为同目录 `batch-qa.json`，逐角色标记 PASS / FAIL。

## Validation

| 检查 | 结果 |
| --- | --- |
| Windows Godot 4.7.2 导入 | PASS，Headless 无脚本或资源错误。 |
| `survivor_animation_batch.gd` | PASS，headless 1408 checks / 0 failures；后台隐藏原生渲染 1417 checks / 0 failures，九张 PNG。 |
| `survivor_animation_pipeline.gd`、`survivor_expedition_animation_runtime.gd`、`survivor_run_death_capture.gd` | PASS，分别 301 / 33 / 12 checks，均 0 failures。 |
| `combat_animation_mission.gd`、`mission_locomotion_style.gd`、`expedition_integration_e00.gd` | PASS，分别 26 / 138 / 58 checks，均 0 failures。 |
| `weapon_visuals.gd`、`public_locomotion_production.gd`、`locomotion_polish.gd`、`survivor_locomotion.gd` | PASS，分别 1789 / 495 / 109 / 21 checks，均 0 failures。 |
| `camp_locomotion_style.gd`、`locomotion_mission.gd` | PASS，分别 171 / 16275 checks，均 0 failures。 |
| Windows headless release 导出 | PASS，输出 `build/BlueHourHomeward.exe`。 |
| 隔离 EXE 启动 | PASS，菜单 / Expedition × Headless / 后台隐藏 Native，四种模式均退出码 0，日志无 `SCRIPT ERROR` 或 `ERROR`。 |
| 内嵌包与美术验证 | PASS，Art Showcase 两种模式各 56 项资产；Weapon Visuals 与批量动画各经 Headless / 后台隐藏 Native 内嵌包运行。 |
| 全量 `run.ps1 -Mode test` | **FAIL**：运行到 `camp_departure.gd` 时，Headless UI 的“今日行动”“商业街”目标不可见，后续“确认出发”节点为空并超时；该失败位于动画专项之外。 |
| `pnpm check:docs-links` | 未运行完成：本机 `bash` 指向不可用的 WSL，返回 `ERROR_PATH_NOT_FOUND`；Phase 3 报告链接已单独核对存在。 |

原生渲染、隔离 EXE 和内嵌包 Native 检查均用 `Start-Process -WindowStyle Hidden`，窗口位置设在屏幕外；未前台打开 Godot Editor 或 Blender。生成的截图、日志、EXE 与测试 JSON 位于忽略目录，不纳入 Git。

## Known Issues

- 全量 Headless 测试在 `camp_departure.gd` 的 UI 输入阶段失败，不能声明全仓测试通过；Phase 3 定向验收和 Windows 导出 / 独立程序检查均通过。
- 文档链接检查器受本机 WSL / `bash` 配置阻断；没有据此声明全仓文档链接通过。
- 旧 `remaining_survivor_batch.gd` 仍有一项 `cheng_mo Phase B Trait remains data-only` 断言失败，与本次动画接入无关；本轮不修改 Trait 数据。
- `mission_locomotion_style.gd` 的旧跨状态握枪距离采样会在刚装备、Rifle Idle 尚未稳定的一帧读到 0.58 m；现有稳定 Rifle Run 检查、正式 Mission 和 12 人 K9 检查均通过。未改共享动画或控制器来处理这一瞬态。

## Environment

| 环境 | Godot | Blender | Node | Git |
| --- | --- | --- | --- | --- |
| `[Windows]` | 4.7.2 stable；Headless 导入 / 测试 / 导出、隐藏 Native 截图、隔离 EXE 和内嵌包检查 | 未使用；PATH 未找到 | 26.4.0 | 2.39.1.windows.1 |
| `[macOS]` | 未使用 | 未使用 | 未使用 | 未使用 |

本阶段代码可以提交；应随提交保留上述全量 Headless UI 测试失败记录。GitNexus CLI 已刷新索引，但 GDScript 目标符号的 impact 查询返回 `UNKNOWN / Target not found`，没有可用调用图；实际变更范围由调用点、Godot 定向测试和 Windows 导出验证。未执行 Git commit。
