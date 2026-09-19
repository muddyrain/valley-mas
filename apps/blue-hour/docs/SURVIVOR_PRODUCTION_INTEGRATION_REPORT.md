# Xia / Su 165cm Production Replacement

> 后续状态：本报告保留初次生产替换的审计快照。2026-09-19 Ground Height Contract 已修复地表高度根因，双角色本轮地面门禁 PASS；最新测量、视频及既有导航限制见[地面合同报告](EXPEDITION_GROUND_CONTRACT_REPORT.md)。

2026-09-19。用户已确认 T-Pose Bind、Upper Body Skin Polish 和 canonical public locomotion PASS，本轮将该已验收内容提升到正式入口。模型与公共动画功能检查通过，但最终真实地表审计发现悬空：导航高度与渲染地面不一致，不能生产放行。此前相对 actor 基准的接地 PASS 已撤回；仓库总测试与旧文件清理也未全绿。

| 结论 | 状态 |
| --- | --- |
| Xia 165cm Production Replacement | FAIL：功能接入通过，真实道路接地失败 |
| Su 165cm Production Replacement | FAIL：功能接入通过，真实道路接地失败 |
| Unified Public Locomotion Production Integration | FAIL：共享动画合同通过，Gameplay 地面合同未通过 |
| 全部交付要求 | 未完成生产放行：地面合同失败、旧源二进制删除被工具审批拦截、总测试仍有失败 |

## 正式资源与冻结合同

| 角色 | 正式 GLB | 高度 | 顶点 / 三角形 |
| --- | --- | ---: | ---: |
| Xia | `assets/characters/xia_zhiyao/runtime/xia_zhiyao.glb` | 1.65m | 68,074 / 101,982 |
| Su | `assets/characters/su_wanxing/runtime/su_wanxing.glb` | 1.65m | 66,907 / 102,500 |

两份 GLB 与已验收 `survivor-upper-skin/candidates` 二进制逐字节一致，保留原正式导入 UID。每个模型包含一个 Mesh、一套 Skin、23 骨，无内嵌动画。LOD0 不减面，关闭这两个导入配置的自动 LOD 生成。稳定 Blender 制作源为 `art/blender/characters/{xia_zhiyao,su_wanxing}.blend`；已实际重新导出，两者均重现正式 GLB 哈希。

Skeleton 为冻结 `BH_Humanoid_Rig_v1`：名称、父子关系、Rest 矩阵、骨长、轴向及 Foot/Toe 基准一致。验证基准取冻结 canonical rig 导出矩阵，存放于 `tests/fixtures/canonical_survivor_rest.json`，不是旧参考场景的手臂 Rest。原有朝向旋转和地图地面高度保留，没有新增 Root / Model / VisualRoot 高度补偿，没有 Runtime Retarget 或 Locomotion IK。

两角色的 AnimationPlayer 引用同一个 `assets/animations/public_locomotion/public_locomotion.tres`，库内直接引用：

- `assets/animations/public_locomotion/public_idle.tres`：14s。
- `assets/animations/public_locomotion/public_walking.tres`：1.0416667s。
- `assets/animations/public_locomotion/public_running.tres`：0.6666667s。

公共动画未复制、改轨或修改 Keyframe。86 项 Standard 源、公共动作、冻结 Rig、武器与感染者文件哈希保持不变，见 [metrics.json](../test-output/survivor-production/metrics.json)。保留既有 Ready/Aim/Shoot 与武器握持约束，仅停用旧 Mission Jog 的 secondary gait 层；没有制作 Armed 动作。

## Gameplay 状态与速度

沿用 Survivor 外部控制接口及现有 Navigation / Command / 搜索 / Combat 逻辑，表现层直接驱动原生 Skeleton。身份、Profile、Portrait、Roster、HP、Stats、Collision、Interaction 数据没有因替换而重建。修复 Camp 点击选人时 HUD 缺少 `show_survivor` 接口及地面环未同步的问题，复用既有 M04 roster/detail 选中流程。

| 项目 | 数值 |
| --- | ---: |
| Xia / Su 正常基础移动速度 | 2.8m/s |
| 稳定直线实际速度中位数（两者） | 2.799846m/s |
| Walking reference | 1.244857489m/s |
| Running reference | 2.276231530m/s |
| 理论 Run playback multiplier（2.8/reference） | 1.230103 |
| 实测稳定 Run playback multiplier | 1.230036 |
| 实际 Run cadence | 221.406 steps/min |
| Idle → 移动 / 移动 → Idle 阈值 | 0.08 / 0.035m/s |
| Walk → Run / Run → Walk 阈值 | 1.85 / 1.60m/s |
| Idle → Move / Move → Idle / Walk ↔ Run 混合 | 0.10 / 0.16 / 0.12s |

播放倍率严格取实际水平速度 / 对应公共 reference；Idle 为 1。Walk/Run 切换同步左右步态相位。低速 Walk 在独立测试中通过现有效果系统施加 0.45 倍移速验证，结束后移除，未增加正式慢走控制规则。保留 Walk 以支持减速状态。

Camp 原有移动速度 2.7m/s 和 Walk 语义保留，因此倍率约 2.169，节奏明显快于 Walk 原始参考。未调整 Camp 行为设计。Expedition 的 2.8m/s 本轮作为候选实机设置落入角色数据，未更改公共动画来适配速度。

## Foot 与视觉结果

以下高度**仅相对 actor Y 基准，不是实际地面距离**。水平漂移测量仍有效。

| 角色 / 状态 | Heel 相对 actor mm | Forefoot 相对 actor mm | 每支撑段水平漂移 mm |
| --- | ---: | ---: | ---: |
| Xia Idle | 1.63–4.11 | 2.46–3.21 | 2.60–3.04 |
| Xia Walk | 1.61–6.98 | 2.46–4.25 | 1.23–4.55 |
| Xia Run | 1.87–4.50 | 3.02–6.25 | 0.40–1.78 |
| Su Idle | 1.52–3.27 | 1.62–2.37 | 2.37–2.56 |
| Su Walk | 1.50–5.91 | 1.67–3.38 | 1.12–4.32 |
| Su Run | 1.76–4.17 | 2.12–5.27 | 0.35–1.64 |

测量来自真实导入 Skin 的最低 3mm 鞋底 Rest 顶点组，在 Skeleton modifier 完成后取得姿态，30Hz 采样。只统计稳定速度及 Foot Flat 阶段，剔除切换开始 0.35s；Run 每支撑段只有 3–4 个样本，不应解释为高精度全周期误差上限。高度相对既有 actor Y=0.08，未修改该数值。最终核对发现它并不是路线中实际渲染地面。水平漂移为支撑段世界 XZ 包围范围，Idle 为稳定静止段范围。

最终地表审计推翻了仅凭相对 actor 高度判定接地通过的结论。`maps/expedition/town_navigation.gd` 固定 FLOOR_Y=0.08，spawn 也使用该高度，Survivor 移动只更新 X/Z；`maps/town/town_urban_view.gd` 的道路却位于 Y=0.025，形成 55mm 固定差值。将录制的实际蒙皮鞋底投影到正式种子地图的世界空间地表三角形后，Xia Idle 鞋底离道路 56.63–59.11mm、Run 支撑 56.87–61.25mm；Su Idle 56.52–58.27mm、Run 支撑 56.76–60.27mm。低速 Walk 路线位于 Y=-0.07 的开放地表，Xia 鞋底离地 151.61–156.98mm，Su 151.50–155.91mm；actor 与该地表相差 150mm。投影排除透明 ReturnZone HUD 环，只计地表三角形。这些属于可测的整体悬空，不能称为 Foot Ground PASS。Loop 与小幅水平残差仍然成立。45° / 90° 转向及连续改向可见普通原地动作旋转时的脚部横移，不能用上表直线数据宣称急转弯无滑动。启停使用短混合，无明显瞬间整身跳姿；不包含专属 Turn/Start/Stop，后续若要求支撑脚转向锁定，需要独立设计并验收。

近景抽帧显示 Shoulder/Sleeve/Elbow 保持已验收 Skin Polish 状态，没有因生产路径替换新增躯干、裙摆或头发权重变化。长发仍为原 Skin，无布料动态。此结论不等于重新宣布所有服装变形绝对无瑕疵。最终转向观感、Camp 快速 Walk 及持枪姿态仍供用户视频验收。地面问题应从导航/生成点/渲染地表的共同高度契约修复，不能修改公共 Keyframe 或给 Xia/Su 下移 Model/VisualRoot。本轮没有扩展修改地图或导航高度系统。

## 验收视频与 Socket

视频均由原生 Godot 正式 App + Expedition 实际 Navigation / Command API 驱动，使用隔离存档和固定种子 4101；按 60Hz 模拟、30fps 采集。测试关闭敌人导演并启用测试无敌，以隔离移动验收；最后生成现有感染者验证自动攻击。它们是自动化实机证据，不是用户手工鼠标操作录像。

| 角色 | 正常 Gameplay（1600×900） | 近景（1280×720） | Run → Stop → Idle | Weapon Socket |
| --- | --- | --- | --- | --- |
| Xia | [39.63s](../test-output/survivor-production/xia_zhiyao/gameplay.mp4) | [39.63s](../test-output/survivor-production/xia_zhiyao/close.mp4) | [3.4s](../test-output/survivor-production/xia_zhiyao/run-stop-idle.mp4) | [截图](../test-output/survivor-production/xia_zhiyao/close/weapon-socket.png) |
| Su | [39.63s](../test-output/survivor-production/su_wanxing/gameplay.mp4) | [39.63s](../test-output/survivor-production/su_wanxing/close.mp4) | [3.4s](../test-output/survivor-production/su_wanxing/run-stop-idle.mp4) | [截图](../test-output/survivor-production/su_wanxing/close/weapon-socket.png) |

完整录像时间点：0s Idle；5s 短移；6.37s 长直线；10.50s 45°；13.07s 90°；15.67s 连续改向；17.47s 停止；18.97s 低速 Walk；21.23s 接近建筑；33.23s 搜索；35.23s 搜索中移动指令；35.73s 取消；36.53s 武器挂载；37.13s 自动攻击。

`WeaponSocket_R` 跟随 RightHand 最终骨骼姿态，LeftHand 保留辅助握持参考，MuzzlePoint 由武器 Scene 提供。两角色分别完成 9 次射击，目标 HP 与弹药变化正常；没有 Missing Bone/Socket 或武器落在世界原点。既有战斗姿态仅做兼容回归，未重做公共 Armed Locomotion。

## 验证范围及未全绿项

| 检查 | 结果 |
| --- | --- |
| Godot Headless Import | PASS，无错误 |
| canonical / 公共资源 / 状态 / Loop / Socket 合同 | 495 checks PASS，不含真实地表高度断言 |
| 实际渲染地表投影 | FAIL：道路鞋底约 57–61mm；Walk 所在开放地表约 152–157mm |
| Xia/Su × 正常/近景 Expedition | 各 27 checks PASS |
| Main Menu → Skill → Loading → Camp → Mission Selection → Expedition | 28 checks PASS，实际原生界面输入及截图 |
| Camp Idle/Walk、POI、避让 | 60s 稳定性 PASS；Camp locomotion 171 checks PASS |
| 生产资源依赖、UID、关键 Scene Load | 501 资源，Missing Resource=0、Invalid UID=0、旧生产引用=0 |
| 武器视觉 / 战斗动画 / Mission Combat | 1377 / 3443 / 47 checks PASS |
| Humanoid / Locomotion Polish / Survivor Locomotion | 305 / 109 / 42 checks PASS |
| Mission Locomotion / Weapon System / Rules / Parallel Commands | 151 / 428 / 19 / 36 checks PASS |
| Windows release 直接导出 | PASS，`build/BlueHourHomeward.exe` |
| 隔离目录 EXE 原生启动 | Menu、Camp、Expedition、Mission Selection、Weapons 均 exit 0，无 ERROR |
| 导出包双角色公共资源检查 | 14 checks PASS，旧源 GLB 与专属 Idle 未打包 |

Runtime Error=0 仅指上述通过的专项及独立启动日志，不代表全仓所有测试日志均为零错误。

总入口 `run.ps1 -Mode build` 已实际尝试，但被旧 `camp_ui_runtime` 对 `member_buttons` / `PowerSlots` 的断言阻塞，不能宣布总构建测试全绿。补跑 `camp_survivor_roster_runtime` 为 469 项 / 8 失败（包含旧 HUD 结构断言）；`new_run_runtime` 在菜单过渡中访问旧时机的 tabs 并超时。`new_run_flow` 118 项 / 32 失败、`day_loop_flow` 79 项 / 21 失败，脚本先 command_search 再立即 command_move，与当前待搜索任务取消语义冲突。未修改 Gameplay 来迁就这些脚本，也未完成其全部失败的独立根因复核。

独立 Camp 第一次 45s 启动验证超时且无错误输出，随后单独以 120s 上限、45 帧启动复核正常退出；不掩盖首次超时，不据此提供启动性能保证。Rig Inspector 打包脚本已迁移到最小依赖集，实际完成导出及 headless/native 独立启动，均 PASS；正式游戏 EXE 也已验证。

## 清理与修改清单

正式模型接入、双角色功能专项通过后，扫描生产引用并清理；随后更严格的真实地表审计发现 FAIL，停止继续清理。此前功能专项未覆盖渲染地表差值，不能替代完整生产 PASS。已删除 40 个旧专属文本资源：Xia 三动作、Xia 专属播放控制器、旧 Retarget 配置/转换工具、仅旧角色使用的 QA 场景和脚本、过时骨架 fit/build/pose 报告以及被公共动作替代的旧 Jog Runtime 测试。Su 原本没有专属三动作文件。逐文件状态见 [cleanup-plan.json](../test-output/survivor-production/cleanup-plan.json)。

以下两份旧源 GLB 删除被自动审批拒绝，原 `.import` 随之保留：

- `assets/characters/xia_zhiyao/source/xia_zhiyao.glb`
- `assets/characters/su_wanxing/source/su_wanxing.glb`

拒绝信息只有 `blocked by policy`，未给出具体原因；未换工具绕过。两份无正式引用，并从 Windows export 显式排除，**清理仍未完成**。没有新建 backup/legacy 副本。Standard 三动作源、canonical 公共库、冻结 Rig 与当前 T-Pose/Skin 工具链保留；`export_locomotion_retarget.gd` 虽带旧名称，仍是 canonical prepare 的采样模板，不能误删。

本轮修改入口：

- 两份正式 runtime GLB / `.import`、两份稳定 Blender 文件、`art/blender/scripts/build_character_rig.py`。
- `survivors/survivor_animation_controller.gd`、`data/survivors/{xia_zhiyao,su_wanxing}.tres`。
- `core/main.gd` 一处 Camp selection 调用、`ui/camp_hud/camp_hud_root.gd` 对应选择接口。
- `debug/humanoid_catalog.gd`、`art/build_humanoid_review.ps1`、`export_presets.cfg`、`run.ps1`。
- 新增 `tests/public_locomotion_production.gd`、`survivor_production_gameplay.gd`、`survivor_production_flow.gd`、`survivor_production_resources.gd`、`survivor_production_pack.gd`、`survivor_production_ground.gd` 和冻结 Rest fixture。
- 迁移 `tests/combat_animations.gd`、`combat_animation_mission.gd`、`mission_locomotion_style.gd`、`humanoid_animations.gd`、`locomotion_polish.gd`、`camp_ambient_runtime.gd` 的旧实现断言。
- `art/analyze_survivor_production.py`、本报告、`docs/PLAN.md`、`art/ASSET_PIPELINE.md`、`art/MODEL_CATALOG.md`。

工作树中的地图、Mission、搜索、M09 与其他 UI 改动由并行任务留下，不计入本轮变更。未提交 Git。本轮停止于地面合同 FAIL，视频可用于检查问题，等待下一步指令；不开展 Combat Jog、Armed Locomotion 或其余 Survivor。
