# Remaining 10 Survivors Unified Runtime Batch Integration

SUR_003～SUR_012 已进入与夏知遥、苏晚星相同的 165cm Unified Survivor Runtime。所有新增角色使用冻结的 `BH_Humanoid_Rig_v1` 和唯一公共 Locomotion；本轮没有实现十项 Trait Runtime、LOD、Combat Jog 或 Armed Locomotion。

## 生产合同

- 模型入口：`assets/characters/<character_id>/runtime/<character_id>.glb`
- 数据入口：`data/survivors/<character_id>.tres`
- Rig：`BH_Humanoid_Rig_v1`，23 bones，统一 names / hierarchy / rest / lengths / axes
- Skin：1 Skin，0 无权重顶点，最多 4 influences，最大权重和误差 `4.94e-8`
- Locomotion：`assets/animations/public_locomotion/public_locomotion.tres`
- Gameplay：2.8m/s；Run reference 2.276231530m/s，playback multiplier 1.230103337
- Weapon Socket：`WeaponSocket_R` 绑定 `RightHand`；辅助握持参考为 `LeftHand`
- Trait：SUR_003～SUR_012 仅录入数据，`runtime_status = data_only`

源 GLB 审计结果一致：单 Mesh、单 Material、三张 2048² 贴图、约 1.65m、对象 Scale 1 / Location 0 且无异常 Transform，静态 A-Pose，无 Skeleton、Skin 或 Animation。批处理先将几何对齐 canonical T-Pose，再绑定冻结骨架；没有通过对象变换、VisualRoot、Runtime Retarget 或 IK 适配。

## 角色结果

| Survivor | 正式 Runtime GLB | Height / tris | Skeleton / Skin | Idle shoe-ground | Public locomotion | Weapon | Definition / Gameplay / Visual | 结论 |
| --- | --- | ---: | --- | ---: | --- | --- | --- | --- |
| SUR_003 林见月 | `assets/characters/lin_jianyue/runtime/lin_jianyue.glb` | 1.650m / 102,128 | 23 / 1 | 1.50～2.09mm | Shared | PASS | PASS / PASS / PASS | PASS |
| SUR_004 陆清禾 | `assets/characters/lu_qinghe/runtime/lu_qinghe.glb` | 1.650m / 102,574 | 23 / 1 | 1.50～3.04mm | Shared | PASS | PASS / PASS / PASS | PASS |
| SUR_005 沈砚川 | `assets/characters/shen_yanchuan/runtime/shen_yanchuan.glb` | 1.650m / 102,444 | 23 / 1 | 1.44～2.95mm | Shared | PASS | PASS / PASS / PASS | PASS |
| SUR_006 唐栀 | `assets/characters/tang_zhi/runtime/tang_zhi.glb` | 1.650m / 101,562 | 23 / 1 | 1.57～2.98mm | Shared | PASS | PASS / PASS / PASS | PASS |
| SUR_007 顾予安 | `assets/characters/gu_yuan/runtime/gu_yuan.glb` | 1.650m / 102,366 | 23 / 1 | 1.45～2.48mm | Shared | PASS | PASS / PASS / PASS | PASS |
| SUR_008 程茉 | `assets/characters/cheng_mo/runtime/cheng_mo.glb` | 1.650m / 100,369 | 23 / 1 | 1.50～2.96mm | Shared | PASS | PASS / PASS / PASS | PASS |
| SUR_009 周野 | `assets/characters/zhou_ye/runtime/zhou_ye.glb` | 1.650m / 102,974 | 23 / 1 | 1.58～2.68mm | Shared | PASS | PASS / PASS / PASS | PASS |
| SUR_010 许昭宁 | `assets/characters/xu_zhaoning/runtime/xu_zhaoning.glb` | 1.650m / 95,814 | 23 / 1 | 1.48～3.40mm | Shared | PASS | PASS / PASS / PASS | PASS |
| SUR_011 贺临川 | `assets/characters/he_linchuan/runtime/he_linchuan.glb` | 1.650m / 102,750 | 23 / 1 | 1.84～2.58mm | Shared | PASS | PASS / PASS / PASS | PASS |
| SUR_012 宋时雨 | `assets/characters/song_shiyu/runtime/song_shiyu.glb` | 1.650m / 96,464 | 23 / 1 | 1.50～2.18mm | Shared | PASS | PASS / PASS / PASS | PASS |

Definition 按相同 ID 位于 `data/survivors/<id>.tres`。Vertices 依次为 67,056、69,681、64,346、72,940、69,029、70,359、69,116、69,224、65,607、96,283。Skin 权重、T-Pose Rest 和导出数据来自 `test-output/survivor-batch-integration/bind-summary.json`；没有失败角色。

## Locomotion 与视觉 QA

十名角色直接挂载同一个 AnimationLibrary 对象。没有角色专属 Idle / Walking / Running 资源，也没有复制公共 Keyframe。公共动作保持：Idle 14s、Walking 1.0416667s、Running 0.6666667s，三者 intrinsic loop；公共生产回归为 495 checks / 0 failures。

批次结构与动作检查为 337 checks / 0 failures。T-Pose、Idle 与 Running 视觉总览：

- [T-Pose overview](../test-output/survivor-batch-integration/contact-sheets/t_pose_overview.jpg)
- [Idle overview](../test-output/survivor-batch-integration/contact-sheets/idle_overview.jpg)
- [Run overview](../test-output/survivor-batch-integration/contact-sheets/run_overview.jpg)

逐角色图包含 T-Pose Front / Three-quarter、Idle Front、Run Side / Three-quarter。检查未发现 mesh explosion、肢体反折、肩部塌陷、膝盖反向或脚踝塌陷。长发、裙摆和外套当前没有 secondary motion，但未发现会阻断本轮接入的权重污染；这不等同于已实现布料或发骨。

## Gameplay Candidate QA

每名角色在正式 Camp 与 Expedition 流程执行 29 项检查，共 290 项、0 失败，覆盖：

- Camp / Expedition Spawn
- Idle / Walking / Running 与 Run → Stop → Idle
- 2.8m/s 长短距离移动、45° / 90° 转向、连续移动命令
- Selection Ring、搜索、取消搜索和移动中断
- `RightHand` 武器挂载、武器不落世界原点、自动攻击
- 真实道路 Ground Contract 下的鞋底接地

Idle 五秒内十名角色最低鞋底到道路地表的范围为 1.44～3.40mm，处于视觉接地容差内。每人 9 次自动攻击采样均完成，Runtime Error 为 0。

## 数据与边界

Catalog 当前包含 12 个 SurvivorDefinition 和 12 个 TraitData。SUR_003～SUR_012 的身份、背景、Trait 五级数值和推荐武器标签来自《蓝时归航》Survivor V1 数据表；推荐武器没有 Buff 或装备限制。SUR_001 搜寻直觉和 SUR_002 精打细算的既有 Trait Runtime 回归继续通过。

旧存档的 `lin`、`qiao`、`yan` 仅在存档迁移入口映射到正式 roster ID；它们不是新的生产角色。批次没有修改 Xia / Su GLB、公共动作、冻结 Rig、Ground Contract、2.8m/s、武器系统或 Camp / Expedition UI。

## 验证结果

- Godot 4.7.2 headless import：PASS
- Batch structure / shared locomotion：337 / 337
- Capture variant：367 / 367
- Public Locomotion production regression：495 / 495
- Gameplay candidate：290 / 290
- Trait foundation / gameplay / Town regression：44 / 44、111 / 111、13 / 13
- Camp party / New Run / Save compatibility / Day loop：31 / 31、40 / 40、9 / 9、43 / 43
- Missing Resource：0
- Invalid UID：0
- Scoped Runtime Error：0
- Windows build：已执行；Search Gameplay 72 / 72、Phase2 258 / 258、Survivor Command 45 / 45、Search Active Card 157 / 157、Settings 14 / 14、Camp Menu Overlay 30 / 30 通过后，被既有 `tests/camp_ui_runtime.gd:114` 对 `member_buttons` 的访问和旧左侧能力栏断言阻断，未进入 Windows export

`new_run_flow.gd`、`day_loop_flow.gd` 和 `effect_system.gd` 仍有本批之前已存在的 Town / Search 路线与旧时序断言失败，不由新增角色、Rig、Definition 或公共 Locomotion 引入。`survivor_production_pack.gd` 仍只报告已知的 Xia / Su 旧 source GLB 待清理项。

## 结论

`Remaining 10 Survivor Runtime Integration：PASS`

`12 Survivor Definition Roster：PASS`

SUR_003～SUR_012 Trait Runtime：未开始，符合本轮范围。
