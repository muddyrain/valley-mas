# Survivor Unified Runtime Production Finalization

2026-09-19。仅冻结生产基线、清理已退出生产的旧资源并检查引用，不修改动作表现。

## 冻结基线

- 165cm Runtime Envelope；23 骨 `art/blender/rigs/BH_Humanoid_Rig_v1.blend`。
- canonical T-Pose Alignment、`art/blender/rigs/survivor_skin_contract.json`、当前 Skin Polish / QA 工具链。
- Xia：`assets/characters/xia_zhiyao/runtime/xia_zhiyao.glb`。
- Su：`assets/characters/su_wanxing/runtime/su_wanxing.glb`。
- 唯一公共库：`assets/animations/public_locomotion/public_locomotion.tres`。
- 公共动作：同目录 `public_idle.tres`、`public_walking.tres`、`public_running.tres`。
- Expedition Walkable Ground Contract；基础移动速度 **2.8m/s**。

冻结资源 SHA-256 清单：[survivor_production_baseline.json](../tests/fixtures/survivor_production_baseline.json)。本轮 109 项保护文件哈希未变，未生成 V2/V3。

## 清理

本轮实际删除 **24 个文件**：10 个旧 Jog / Locomotion 资源、旧 SkeletonModifier 表现层、2 个过时测试、8 个旧生成/导入脚本及 3 个 UID。`run.ps1` 移除已删除的旧上半身测试入口，保留公共 Locomotion 生产检查。

- `assets/animations/humanoid/locomotion/bh_humanoid_animations_v1.tres`
- `assets/animations/humanoid/locomotion/bh_humanoid_jog_transitions.tres`
- `assets/animations/humanoid/locomotion/bh_humanoid_jog_transitions_v2_2.tres`
- `assets/animations/humanoid/locomotion/bh_humanoid_locomotion_tree.tres`
- `assets/animations/humanoid/locomotion/bh_humanoid_mission_jog.tres`
- `assets/animations/humanoid/locomotion/bh_humanoid_mission_jog_v1.tres`
- `assets/animations/humanoid/locomotion/bh_humanoid_mission_jog_v2.tres`
- `assets/animations/humanoid/locomotion/bh_humanoid_mission_jog_v2_0.tres`
- `assets/animations/humanoid/locomotion/bh_humanoid_mission_jog_v2_2.tres`
- `assets/animations/humanoid/locomotion/bh_humanoid_unarmed_arms_v2.tres`
- `survivors/survivor_locomotion_layer.gd`
- `tests/upper_body_phase_2e.gd`
- `tests/locomotion_runtime.gd`
- `art/blender/scripts/create_mission_jog.gd`
- `art/blender/scripts/create_mission_jog_v2.gd`
- `art/blender/scripts/create_mission_jog_v2_2.gd`
- `art/blender/scripts/archive/create_mission_jog_v2_0.gd`
- `art/blender/scripts/create_jog_transitions.gd`
- `art/blender/scripts/create_unarmed_arms_v2.gd`
- `art/blender/scripts/create_humanoid_animations.py`
- `art/blender/scripts/import_humanoid_animations.gd`
- `survivors/survivor_locomotion_layer.gd.uid`
- `tests/upper_body_phase_2e.gd.uid`
- `tests/locomotion_runtime.gd.uid`

前轮已删除、此次确认仍保持删除的旧专属 Retarget / 配置 / QA 共 **40** 项（不是本轮重复删除）：

- `art/blender/rigs/source_glb_audit.json`
- `art/blender/rigs/su_wanxing_build_report.json`
- `art/blender/rigs/su_wanxing_fit.json`
- `art/blender/rigs/su_wanxing_pose_report.json`
- `art/blender/rigs/su_wanxing_preservation_report.json`
- `art/blender/rigs/xia_zhiyao_build_report.json`
- `art/blender/rigs/xia_zhiyao_fit.json`
- `art/blender/rigs/xia_zhiyao_locomotion.json`
- `art/blender/rigs/xia_zhiyao_pose_report.json`
- `art/blender/rigs/xia_zhiyao_preservation_report.json`
- `art/blender/rigs/xia_zhiyao_sleeve_report.json`
- `art/blender/scripts/analyze_locomotion_retarget.py`
- `art/blender/scripts/import_locomotion_retarget.gd`
- `art/blender/scripts/locomotion_protection.py`
- `art/blender/scripts/retarget_standard_locomotion.py`
- `art/build_xia_locomotion_review.ps1`
- `assets/characters/xia_zhiyao/animations/idle.tres`
- `assets/characters/xia_zhiyao/animations/running.tres`
- `assets/characters/xia_zhiyao/animations/walking.tres`
- `debug/xia_zhiyao_locomotion_review.gd`
- `debug/xia_zhiyao_locomotion_review.gd.uid`
- `scenes/debug/xia_zhiyao_locomotion_review.tscn`
- `survivors/xia_locomotion_player.gd`
- `survivors/xia_locomotion_player.gd.uid`
- `tests/combat_jog_phase_2e.gd`
- `tests/combat_jog_phase_2e.gd.uid`
- `tests/mission_jog_v2.gd`
- `tests/mission_jog_v2.gd.uid`
- `tests/mission_jog_v2_2.gd`
- `tests/mission_jog_v2_2.gd.uid`
- `tests/mission_locomotion_phase_2d.gd`
- `tests/mission_locomotion_phase_2d.gd.uid`
- `tests/xia_locomotion_gameplay.gd`
- `tests/xia_locomotion_gameplay.gd.uid`
- `tests/xia_locomotion_integration.gd`
- `tests/xia_locomotion_integration.gd.uid`
- `tests/xia_locomotion_speed_abc.gd`
- `tests/xia_locomotion_speed_abc.gd.uid`
- `tests/xia_zhiyao_locomotion.gd`
- `tests/xia_zhiyao_locomotion.gd.uid`

保留 Standard 动作源、Canonical 公共转换、Skin / T-Pose、当前生产 QA 与共用 reference skeleton。`export_locomotion_retarget.gd` 虽有历史命名，仍是 `canonical_locomotion/prepare.py` 的采样依赖，不能按名称误删。历史审计文档里的旧文件名不是运行时引用。

待清理：`assets/characters/xia_zhiyao/source/xia_zhiyao.glb`、`assets/characters/su_wanxing/source/su_wanxing.glb`。此前自动审批拒绝删除（blocked by policy），本轮遵照用户要求仅记录、不重试、不绕过、不制作 backup/legacy。两目录已排除正式导出；其 import/贴图伴随文件暂随源保留。

## 正式引用与验证

- Godot Headless Import：PASS。
- 公共 Locomotion 生产测试：495 项通过，包含同库身份、23 骨 Rest、速度匹配、Socket 与 Camp 上下文。
- Godot 资源依赖检查：493 项，Missing Resource=0、Invalid UID=0、旧生产引用=0。
- 补充 351 个生产目录文本文件扫描：未发现旧模型、专属动作、候选资源、旧 runtime retarget 的加载依赖。8 处 `test-output` 字符串属于地图 QA 的输出路径，不是正式游戏资源来源。
- Windows 重新导出：PASS。复制到隔离目录后原生独立启动 exit 0，stderr 为空；最终 EXE 哈希见 `test-output/survivor-finalization/build-info.json`。
- Runtime Error=0：限定本轮生产测试、资源检查与独立启动日志；不声明全项目测试全绿。

证据目录：`test-output/survivor-finalization/`，含 `resources.json`、`finalization-audit.json`、`production.log`、`import.log`、`export.log`、`standalone/`。

## 后续生产流程

**Static GLB → 165cm Runtime Envelope → canonical T-Pose Alignment → BH_Humanoid_Rig_v1 → Skin QA → Public Locomotion → Gameplay**。

12 人规模，LOD0 约 100k tris。Lore 身高不驱动 Runtime Scale。骨长、轴向、Rest、地面基准和 Weapon Socket 合同保持一致；未来角色直接共享公共 Idle / Walking / Running，不再生成独立动作或角色专属 Locomotion Retarget。

`docs/PLAN.md`、`art/ASSET_PIPELINE.md`、`art/MODEL_CATALOG.md` 已同步当前冻结规则。旧章节仅作开发历史，不覆盖本次生产基线。

三人长途 Navigation/Avoidance 停滞、旧 Camp HUD 断言保留为独立已知问题，不计本轮失败，也未尝试修复。未开展 Combat Jog、Armed、Turn/Start/Stop 或其余 10 个 Survivor。完成后停止。
