# Standard Survivor Template 清理记录

日期：2026-09-17。旧 170cm 标准幸存者模板退出工程；后续动作制作基线为女性、165cm、新脚踝位置版本，等待用户提供。本轮没有接入新模板，没有制作 Idle / Walk / Run。

## 删除清单

以下路径均相对 `apps/blue-hour/`。

| 范围 | 已删除内容 |
| --- | --- |
| 模板目录 | `assets/characters/survivor_animation_template/` 全部：FBX、albedo、导入配置、基础与 SMG 预览场景、控制脚本及 UID |
| 骨架与动作 | FBX 内嵌的 28 骨 Skeleton / Skin / Rig、Idle_3 / Walking / Running 测试动作及 Godot 导入产物 |
| 临时修正 | 模板 `VisualRoot` 的 -0.0275m 偏移、`visual_offset_y`、`smg_low_ready_pose.gd` 及模板持枪附件代码 |
| 导入工具 | `art/prepare_survivor_animation_source.py`、`art/survivor_animation_import.gd` |
| 模板测试 | `tests/survivor_animation_template_import.gd`、`survivor_animation_template_sequence.gd`、`survivor_animation_template_capture.gd` 及对应 UID |
| 脚底测试 | `tests/survivor_ground_offset_capture.gd`、`survivor_ground_offset_feet_capture.gd` 及对应 UID |
| 持枪实验 | `tests/smg_armed_idle_capture.gd`、`smg_idle_audit.gd` 及对应 UID |
| 过期报告 | `docs/SURVIVOR_ANIMATION_TEMPLATE_LOCOMOTION_REPORT.md`、`docs/SMG_ARMED_LOCOMOTION_V1_REPORT.md` |
| 临时目录 | `test-output/` 下的 `survivor-animation-template/`、`survivor-animation-template-smg/`、`survivor-base-source/`、`survivor-ground-offset/`、`survivor-idle-ab/`、`smg-armed-idle/`，含录像、截图、A/B 工程、旧源件副本、测试 EXE |
| 零散输出 | `test-output/inspect_embedded_texture.py`、`survivor-base-import.log`；`survivor-source-refresh/` 下旧/新对比脚本、JSON 和报告 |
| 缓存 | 旧模板专属 `.godot/imported/` 文件及 `.godot/editor/`、`.godot/exported/` 中的独立模板场景缓存 |

删除前清单包含 173 个现存文件、1,717,873,524 字节；之后补删 5 个模板编辑器/导出缓存，共 178 个文件。逐文件路径、字节数与 SHA-256 基线见本地 `test-output/standard-survivor-cleanup/before.json`。

开始时已经缺失的 `art/blender/scripts/fix_survivor_template_jog_in_place.py`、旧 `_0.png` 及其 `.import` 保持删除状态，不计入本轮 178 个文件。没有新增 v2、fixed、old、backup 等模板正式资源。

未发现独立于上述链路的旧模板 Retarget 或 Foot Contact 实现。公共动画制作脚本中的脚踝、脚尖、支撑阶段处理服务于正式角色，因此保留。

## 保留清单

- 夏知遥：`assets/characters/xia_zhiyao/source/`、`runtime/`，模型与导入配置。
- 苏晚星：`assets/characters/su_wanxing/source/`、`runtime/`，模型与导入配置。
- 公共骨架与动画：`assets/characters/rigs/`、`assets/animations/humanoid/`，以及对应 Blender 源件和制作工具。
- 正式 Survivor Runtime、移动/战斗状态和 gameplay → animation 接口：`survivors/`、`missions/`、`core/`、`data/`。
- AnimationPlayer / AnimationTree / RetargetModifier3D 架构、`survivor_animation_controller.gd`、公共动画桥接与姿态处理。
- `weapons/` 全部及公共 `assets/generated/weapon_submachine_gun_model.glb`；删除的 SMG 代码仅属于旧模板实验。
- 正式角色、动画、战斗、武器检查脚本和既有 Debug 检查器。
- `test-output/survivor-source-refresh/Meshy_AI_survivor_animation_te_biped/` 中此前解压的 165cm 候选 FBX 与贴图原件，字节保留、未接入。它们不代表本轮接受了新版模板。
- 用户 Downloads 中的原始资料、本轮之外的工作区修改与其他任务日志。

正式资源中已有的版本名称不在本次模板清理范围内，尤其公共 Jog 动画仍被正式控制器引用，未重命名或删除。

## 依赖与验证

- 删除前按路径、脚本名及资源 UID 扫描，旧模板所有代码引用均来自本次删除集合；正式角色无入向依赖。
- 两名正式角色使用 23 骨公共骨架；旧模板为独立 28 骨链。模板对公共冲锋枪模型只有单向引用，删除模板无需改动武器资源。
- 删除后源码扫描未发现旧资源悬空引用，Godot 4.7.2 Headless 资源导入通过。
- 两名正式角色骨架检查通过；公共动画检查 908 项通过。
- 完整旧 `tests/humanoid_rig.gd` 检查为 453 项、1 项失败：感染者也被断言为 1.60m。逐角色诊断确认夏知遥、苏晚星均无失败；没有修改这项无关测试。首次执行还暴露输出目录未建立，建立 `test-output/rig/` 后完成检查。
- 战斗动画 3,443 项、武器规则 428 项、武器视觉 1,377 项、Survivor Locomotion 42 项、战斗动画 Mission 47 项全部通过；Expedition Headless 启动通过。
- Windows Release 已导出到 `build/BlueHourHomeward.exe`；复制到独立目录后，原生 OpenGL 营地和 Expedition 均启动并正常退出。Expedition 退出有 2 个 ObjectDB 实例泄漏警告，无脚本或资源错误；未在本轮排查这项警告。
- `build/BUILD-INFO.json` 记录此次实际定向检查与 EXE 哈希；没有宣称运行完整 `run.ps1 -Mode build` 套件。独立验证用 EXE 副本在验证后删除。
- 410 个受保护文件的 SHA-256 全部未变，覆盖角色、动画、Survivor、武器、Mission、Core、数据及 Blender 工具/源件；未发现误删正式角色依赖。
- 文档定向编码检查与 `git diff --check` 通过。具体日志在 `test-output/standard-survivor-cleanup/`。

本轮对删除以外的源文件建立了 1,934 项 SHA-256 基线。期间另有营地身份报告和 `maps/town/`、相应地图测试被并行任务修改，这些差异单独记录，不作为本轮修改，也不声称全工作区字节未变。精确检查结果保存在 `test-output/standard-survivor-cleanup/after.json`。

本次是独立实验资源退役，不新增运行行为单测；采用删除前引用闭包、删除后引用扫描、文件哈希及现有角色/动画回归验证。

## 停止点

计划已同步。等待用户提供女性 165cm、新脚踝位置版本，再开展新基线接入；本轮不继续动作制作、Retarget、脚底修正或正式角色替换。
