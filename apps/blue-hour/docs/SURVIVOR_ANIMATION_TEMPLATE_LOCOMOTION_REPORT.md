# Survivor Animation Template Locomotion Report

## Source

输入来源为 `C:\Users\A\Downloads\Meshy_AI_survivor_animation_te_biped (1).zip`。该压缩包包含一个合并 FBX：

- `Meshy_AI_survivor_animation_te_biped_Animation_Idle_3_withSkin.fbx`
- `Meshy_AI_survivor_animation_te_biped_Animation_Walking_withSkin.fbx`
- `Meshy_AI_survivor_animation_te_biped_Animation_Running_withSkin.fbx`
- `Meshy_AI_survivor_animation_te_biped_Animation_01a0a570-436a-7724-86d1-22c27d156833_withSkin.fbx`

`Meshy_AI_survivor_animation_te_biped_Meshy_AI_Meshy_Merged_Animations.fbx`

## Asset Check

已使用 Blender 5.2.1 LTS 对合并 FBX 做只读导入检查。文件只有一个 Mesh、一个 Skeleton `Armature`、28 根骨骼、Root 为 `Hips`，主网格为 49,341 三角形、1 个材质槽、单位缩放。四个 Action 全部挂在同一 `Armature` 上，骨骼数量一致；未再出现不同的 28-bone `target_character` 骨架。Blender 导入结果为 24 FPS，而不是用户声明的 30 FPS，需在 Godot/导出设置中进一步确认实际采样率。

## Animation Clips

| Final Name | Source Clip | Duration | FPS | Loop | Root Motion |
|---|---|---:|---:|---|---|
| idle_relaxed | `Armature\|Idle_3` | 9.958 s | 24 | 待确认 | 待检查 |
| walk_forward | `Armature\|Walking` | 0.958 s | 24 | 待确认 | 待检查 |
| jog_forward | `Armature\|01a0a570-436a-7724-86d1-22c27d156833` | 1.958 s | 24 | 待确认 | 待检查 |
| run_forward | `Armature\|Running` | 0.625 s | 24 | 待确认 | 待检查 |

## Root Motion

Blender 首末帧采样结果（单位为导入场景单位）：四个 Action 的 Armature Root 位移均为 `[0, 0, 0]`，未发现整体 Root Translation。Idle / Walk / Run 的 Hips 首末帧变化接近零；Jog 的 Hips 变化约为 `[0.162, -5.759, 0.015]`，这属于 Hips 局部姿态/重心数据，不能直接全部清零。由于 Root 已经 In-Place，当前不执行额外 Root Motion 删除。

## Godot Import

- Skeleton3D: Godot 4.7.2 导入通过；独立模板场景可加载 Skeleton3D
- AnimationLibrary: 导入通过；默认库包含 4 个正式动画名
- Missing Resource: 0（模板专项）
- Runtime Error: 0（模板专项；项目主场景仍有既有 `missions/mission.gd` 解析错误）

## Locomotion State

已新增独立 `survivor_animation_template` 场景与脚本，状态为 `Idle / Walk / Jog / Run`，正式动画名为 `idle_relaxed / walk_forward / jog_forward / run_forward`，速度阈值仅用于模板预览：Walk `>0.08`、Jog `>=2.8`、Run `>=5.0`。状态切换使用 0.18 秒 Cross Fade，并避免每帧重启同一动作。

## QA Status

- Loop 接缝：四个动作均保留完整导入区间，未做破坏性裁剪；模板脚本将四个正式动作设为 Loop。首尾视觉接缝仍需窗口化人工复核。
- Foot Sliding：未完成画面级判断；Root Motion 为零，脚滑风险只剩动画步频与外部速度匹配。
- Rig QA（肩、肘、腕、膝、脚踝）：未完成画面级判断。
- 连续状态序列：Godot 4.7.2 Headless 已验证 `Idle → Walk → Jog → Run → Jog → Idle` 六段均可播放，Cross Fade 参数为 0.18 秒。
- 验收视频：未生成；当前仅完成 Headless 运行证据，未完成带相机的屏幕录制。

## Native Visual Evidence

### Jog In-Place 修复

原生复核确认 Jog 的 Hips Y 曲线包含累计前向轨迹。已仅对 Jog 的 Hips Y 做线性去趋势，保留 Hips 其余轴、起伏、旋转及全部四肢关键帧；Idle / Walk / Run 未修改。修复后 FBX 已重新导入 Godot，正式动画名和 Headless 连续状态验证再次通过。

Godot 4.7.2 原生 Compatibility 窗口已成功渲染模板角色并输出帧序列，随后编码为 MP4：

- 连续序列：[locomotion_sequence.mp4](../test-output/survivor-animation-template/locomotion_sequence.mp4)
- Walk：[walk_side.mp4](../test-output/survivor-animation-template/walk_side.mp4)
- Jog：[jog_side.mp4](../test-output/survivor-animation-template/jog_side.mp4)
- Run：[run_side.mp4](../test-output/survivor-animation-template/run_side.mp4)

当前画面证据显示 Mesh 可见、四肢和鞋网格正常渲染；未观察到明显肩塌、肘反折、腕断裂、膝反折或脚踝断裂。由于当前相机为三分之四固定机位，且未做逐帧足底标记，Foot Sliding 与 Loop 接缝只能记录为 **未判定**，不能据此宣称无脚滑。0.18 秒切换已录入连续视频，视觉自然度仍需人工逐段复核。

## Result

**PARTIAL**

资产结构和 Godot 导入阻断已解除：单文件、单骨架、四个 Action、28 骨一致；正式名称、循环设置、模板状态序列均已落地并通过 Headless 检查。画面级脚滑、Rig 变形和验收视频仍需原生窗口证据，不能仅由 Headless 结果替代。

## Next Required Input

下一步可在确认 24/30 FPS 取舍后继续 Root Motion / In-Place、正式命名和 Godot 导入；本轮暂不修改正式幸存者系统。
