# Survivor Animation Phase 2.1：Run / Death 定点修复

## Task Summary

正式 Medium Town / Expedition 镜头复核结果：普通 Run **PASS**，Death **PASS**。双臂不再持续抬到头侧；死亡动画完整播放、倒地并保持末帧，双腿在地面附近收拢。其余 9 段动画未变化。**Survivor Animation V1 的动画内容、macOS 正式运行时和视觉验收通过**，可作为其余幸存者动画复用的基线；Windows build、独立 EXE 启动及 Windows 原生画面仍待 Windows 环境验证，跨平台发布验收尚未完成。

全程使用 Blender background、Godot headless 或 `open -n -g -j` 后台隐藏的 Godot Movie Maker。原生采集期间 Godot 未成为前台应用，没有抢占桌面焦点。

## Changed Files

| 类型 | 文件 | 本阶段变更 |
| --- | --- | --- |
| 修改 | `art/blender/scripts/integrate_survivor_animations.py` | 增加 Run 双臂解算、Death 髋部位移和末段腿部收拢；导出时只合并指定通道。该文件中原有 Rifle 握持修正属于前阶段，本阶段未重烘 Rifle 动画。 |
| 新增 | `art/blender/scripts/merge_survivor_animation_channels.py` | 将候选烘焙曲线合并到旧 GLB，仅替换 Run 手臂和 Death 髋部/腿部通道。 |
| 修改 | `assets/characters/survivors/animations/locomotion/survivor_run.glb` | 更新左右肩、上臂、前臂、手的旋转曲线。 |
| 修改 | `assets/characters/survivors/animations/reaction/death.glb` | 更新髋部位移和双腿末段旋转曲线。 |
| 修改 | `assets/characters/survivors/animations/survivor_animations.tres` | 重新导入并构建 AnimationLibrary；仅 `survivor_run`、`death` 两个动画子资源变化。 |
| 新增 | `tests/survivor_run_death_capture.gd` | 使用正式 Expedition 流程采集 Run / Death，并检查跑动、末帧、落地和腿部间距。 |
| 修改 | `docs/PLAN.md` | 记录本阶段验收与 Windows 发布门槛。 |
| 新增 | 本报告 | 根因、修改范围、测试和画面证据。 |

本阶段没有新增动作或重新下载 Mixamo 文件。Character Mesh、`BH_Humanoid_Rig_v1`、骨骼层级、Rifle Idle/Run/Shoot、武器控制器、K9 正式模型与尺寸、移动速度、战斗数值、Gameplay、UI、Enemy 和其他幸存者均未作为本阶段修改目标。共享工作区里已有前阶段未提交改动，本表只列本阶段实际处理的文件。

## Implementation Details

### Run 根因与修复

源 `Jogging.fbx` 的手腕在肩部下方约 0.24–0.36 m；旧 `survivor_run.glb` 的手腕却高于肩部约 0.08–0.19 m。普通 Mixamo → 冻结 Rig 的 rest-pose 旋转映射把这段上肢动作抬高，并非正式 Rifle 握持或玩法移动速度造成。按源动画逐帧提取手腕与手肘相对上臂根部的方向、按目标臂长缩放，解算目标肩、上臂和前臂，保留原有前后摆动。合并后的 GLB 只替换双侧 `Shoulder`、`UpperArm`、`LowerArm`、`Hand` 旋转；根骨、髋、脊柱、头、双腿、脚和脚趾保持旧曲线。逐帧对比这些保护骨骼的最大旋转差为 **0°**。

### Death 根因与修复

源 `Death.fbx` 的髋部从约 0.99 m 下落到 0.155 m；旧烘焙 GLB 没有 Hips 位移轨，髋部停在约 0.86 m，导致身体悬空。源动作末段还带有横向大幅分腿。新增按源髋部轨迹和冻结 Rig 比例烘焙的 Hips 位移；仅在死亡进度 70% 后平滑混入腿部收拢姿势，90% 达到末帧姿势。前段倒地流程、死亡状态逻辑、末帧冻结和所有上半身旋转保留。逐帧对比根骨、髋部旋转、躯干、头、双臂和双手最大旋转差为 **0°**。

重新构建后的 AnimationLibrary 按动画子资源内容逐块校验：只有 `survivor_run` 和 `death` 改变，其余 9 段与本阶段前版本逐字节一致。没有更改正式动画的数据绑定：夏知遥仍通过 `SurvivorDefinition.survivor_id = SUR_001` 进入原有 Expedition 动画控制器和 AnimationLibrary；HUD 继续读取正式任务与角色状态。

## Validation

| 检查 | 结果 |
| --- | --- |
| `tests/survivor_animation_pipeline.gd` | **PASS：301 checks / 0 failures**；新增的 Death Hips 位移轨可正常导入。 |
| `tests/survivor_expedition_animation_runtime.gd` | **PASS：33 checks / 0 failures**。 |
| `tests/expedition_integration_e00.gd` | **PASS：58 checks / 0 failures**。 |
| `tests/survivor_run_death_capture.gd` headless | **PASS：12 checks / 0 failures**；Run 240 帧，手相对肩部的最大高度 `-0.159 m`。 |
| 正式 Godot Movie Maker | **PASS：15 checks / 0 failures**；两张 1600×900 原生 PNG 和 650 帧原生录像生成。采集后仅给专项增加一项双脚间距检查，未改动画或画面。 |
| Death 末帧数值 | 髋部高度 `0.134 m`；左右脚高度约 `0.104 m`；双脚水平间距 `0.314 m`。完整 Death 到末帧且状态保持 `DEATH`。 |
| 保护骨骼和冻结动画 | Run / Death 保护骨骼逐帧旋转差 `0°`；其余 9 段 AnimationLibrary 子资源逐字节相同。 |
| 资源及脚本 | Godot headless 导入、Blender background 烘焙、Python 编译检查、`git diff --check` 均通过；原生采集无脚本或资源错误。 |

正式画面使用 Medium Town / Expedition、夏知遥 `SUR_001`、原导航命令与移动路径、正式死亡伤害路径、HUD 和相机 `size=23`。测试入口先由 K9 loadout 建立角色，再解除装备进入普通 Run；没有修改正式武器资源或生成替代展示场景。视频覆盖连续 Run、完整 6.066 秒 Death 和末帧保持：

| 交付物 | 路径 / 规格 |
| --- | --- |
| Run 原生截图 | `test-output/survivor-animation/expedition-runtime/expedition_run_final.png`；1600×900 |
| Death 原生截图 | `test-output/survivor-animation/expedition-runtime/expedition_death_final.png`；1600×900 |
| 正式视频 | `test-output/survivor-animation/expedition-runtime/expedition_run_death_final.mp4`；H.264 / AAC，1600×900，60 fps，650 帧，10.83 秒 |
| 原始录像与日志 | 同目录 `expedition_run_death_final.avi`、`run_death_capture_stdout.log`、`run_death_capture_stderr.log` |

**Run Visual QA：PASS。** 正式相机下双臂沿跑动节奏自然前后摆，未持续抬到头侧，腿部原节奏保留，没有明显骨骼扭曲。**Death Visual QA：PASS。** 完整倒地后身体贴近地面，双腿没有旧版高举或横向夸张展开；正式俯视镜头中轮廓可读，末帧稳定保持。

## Known Issues

- `[Windows] Windows environment required`：当前没有 Windows 环境或可用远程连接，未执行 Windows build、`build/BlueHourHomeward.exe` 独立启动和 Windows 原生画面检查；因此不能宣称跨平台发布验收完成。本阶段的 V1 通过结论限定在动画内容、macOS 正式运行时及视觉 QA。
- Godot 原生采集退出时报告 `2 ObjectDB instances were leaked at exit`；专项检查、视频和截图均通过，日志留存于交付目录。

## Environment

| 环境 | Godot Editor / Runtime | Blender | Node | Git |
| --- | --- | --- | --- | --- |
| `[macOS] macOS compatible` | Godot 4.7.2；headless 和后台隐藏 Movie Maker 已运行；未前台打开 Editor | 5.2.1 LTS，background 烘焙 | 22.22.3；GitNexus 变更检测为 LOW，0 个受影响执行流程 | 2.55.0；`git diff --check` 通过 |
| `[Windows] Windows environment required` | Editor、build、独立 EXE 和原生画面均未运行 | 未使用 | 未使用 | 未使用 |

本阶段完成 Run / Death 阻断项后，不再继续 Phase 2.x 动画精修；其余幸存者可以复用这套已验收动画基线。批量接入与 ENM_001 是后续独立工作，执行前仍须满足项目的 Windows 构建与独立程序验证要求。
