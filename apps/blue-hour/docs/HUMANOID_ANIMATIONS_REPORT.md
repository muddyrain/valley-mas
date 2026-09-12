# 幸存者公共移动动画

状态：一份公共 Idle、Walk、Run 及 Godot 接入已实现；本次 A-Pose 模型替换只做兼容验收，没有重做或增加动作。当前角色资源和交付以 [角色替换报告](CHARACTER_REPLACEMENT_REPORT.md) 为准。

## 已实现

- BH_Humanoid_Rig_v1 的 23 个固定骨名与父级由冻结契约校验；两角色按自身比例拟合。
- Blender 公共源为 art/blender/animations/BH_Humanoid_Animations_v1.blend，独立参考骨架不属于任一角色。
- 一份 AnimationLibrary 位于 assets/animations/humanoid/locomotion/bh_humanoid_animations_v1.tres，仅有 Idle、Walk、Run。角色 GLB 本身均为零动画。
- survivor_animation_controller.gd 使用 Blender 导出的参考骨架与 Godot RetargetModifier3D。两角色共享同一 AnimationLibrary，各自保留播放状态。
- AnimationTree 的 Idle/Walk/Run 过渡为 0.18 秒。状态读取真实移动量，播放速度参考动作标称速度和角色比例；Root/Hips 不提供水平根运动。
- 用户已确认恢复约 1.6 米角色原比例。原 Demo 整模 bob 与攻击缩放已移除，路径、真实速度、导航不变。
- 同一 Inspector 支持双角色、静态姿势与三个已有公共动作。

## 当前验证

A-Pose 新模型合入主地图工作区后，共享资源、循环端点、原地骨骼轨道、独立播放、状态切换和有限骨姿共 908 项通过；真实 Survivor 移动 42 项、视觉稳定 15 项、实际 Mission 渲染和移动 102 项通过。后者使用主地图当前 33 米默认正交镜头及测试专用近景镜头，不修改地图或摄像机实现。

## 边界

这是第一版公共移动库。本次模型替换没有制作角色专属动作，没有新增 Shoot、Reload、Search、Hit、Death，没有实现 Foot IK 或枪械握持层。动作质量仍可在后续用户确认后单独调整；不能把资源兼容检查等同于所有速度和地形下完全无滑步。

Windows 游戏与公共 Inspector 构建、最终路径和剩余模型问题统一记录在角色替换报告中。
