# 夏知遥 Locomotion Gameplay Integration V1

2026-09-18。夏知遥无武器正式 Expedition 移动已接入三份既有 Retarget 资源：`assets/characters/xia_zhiyao/animations/idle.tres`、`walking.tres`、`running.tres`。Standard 动作、夏知遥 Mesh / Skeleton / Skin、苏晚星、武器和移动状态机没有被改写。

## 接入

`survivor_animation_controller.gd` 按模型路径只为夏知遥创建 `XiaLocomotion` 层。该层直接驱动夏知遥现有 23 骨 Skeleton，旧 Retarget / Mission Locomotion 仍保留为武器和基地模式的所有者。无武器且处于 Expedition 时才启用；装备武器、基地模式、停用和预览会恢复旧管线。

状态阈值（角色局部水平速度）：Idle 进入移动 `0.08 m/s`，停止 `0.035 m/s`；Walk 进入 Run `1.85 m/s`，Run 回到 Walk `1.60 m/s`。过渡为 Idle 0.16s、Idle 进入移动 0.10s、Walk / Run 0.12s，并在 Walk / Run 间对齐左右脚相位。没有 Root Motion、Y 偏移、Runtime IK 或动作 Key 修改。

## 速度

| 状态 | 参考速度 | 实机倍率（记录） |
| --- | ---: | ---: |
| Walking | 1.262257 m/s | 真实速度 / 1.262257 |
| Running | 2.306552 m/s | 真实速度 / 2.306552 |
| Expedition 当前基础速度 | 4.2 m/s | Running 约 1.821 |

真实 Mission 物理 Harness 记录到 4.20 m/s 的 Run、加速期间 Walk、到达停止后的 Idle，以及 45° / 90° 路径转向。根节点位置由 Mission 移动，动画层只改变骨骼姿态。

## 验证结果

- 控制器回归：102 项，0 failures。覆盖 Idle / Walk / Run、直接切换、阈值迟滞、播放倍率、相位切换、禁用/启用、装备恢复旧 Combat Jog、Camp 旧管线和苏晚星隔离。
- 实际 Mission 记录：540 个 30 FPS 样本；Idle 5 秒、短距、长距、到达停止、90°、45°、停止回 Idle。
- 实际样本中的状态：Idle、Walk、Run 均出现；4.2 m/s 时倍率为 1.821；无 Root Motion。
- 当前未做脚底顶点级自动滑步估计；视觉视频用于验收转向和支撑脚表现。现有 Retarget 报告中的静态接地数据仍适用于三份动作源。

## 视频

- [Gameplay 主相机](../test-output/xia-locomotion-gameplay/xia-gameplay.mp4)
- [角色近景裁切](../test-output/xia-locomotion-gameplay/xia-close.mp4)
- [脚部近景裁切](../test-output/xia-locomotion-gameplay/xia-feet.mp4)

## 结论

接入逻辑和正式角色隔离检查通过。4.2 m/s 对 Running 产生约 1.82 倍播放倍率，建议先完成视频视觉验收；本轮不调整 Gameplay speed。若视频确认转向时支撑脚仍滑动，后续应制作 Turn / Start / Stop 资源，而不是修改三份 Retarget 动作。

## Gameplay Movement Speed A/B/C

本轮只覆盖测试实例的基础移动速度，正式默认值仍为 4.2 m/s。

| 档位 | 实际 Run 速度 | Running 倍率 | cadence | 固定 8m 换算时间 |
| --- | ---: | ---: | ---: | ---: |
| A | 2.59998 m/s | 1.12722 | 202.90 spm | 3.0769 s |
| B | 2.80003 m/s | 1.21394 | 218.51 spm | 2.8571 s |
| C | 2.99995 m/s | 1.30062 | 234.11 spm | 2.6667 s |

三档使用同一 Expedition 路线，均记录长直线、45° / 90° 转向、连续点击、Run → Stop → Idle。路线导航目标在测试上限内未全部收敛，因此报告同时保留实际推进轨迹和固定 8m 的可比时间换算，没有把测试上限冒充到达耗时。

| 档位 | Gameplay | 角色近景 | 数据 |
| --- | --- | --- | --- |
| A | [视频](../test-output/xia-locomotion-speed-abc/speed-A-gameplay.mp4) | [视频](../test-output/xia-locomotion-speed-abc/speed-A-close.mp4) | [JSON](../test-output/xia-locomotion-speed-abc/speed-2.6.json) |
| B | [视频](../test-output/xia-locomotion-speed-abc/speed-B-gameplay.mp4) | [视频](../test-output/xia-locomotion-speed-abc/speed-B-close.mp4) | [JSON](../test-output/xia-locomotion-speed-abc/speed-2.8.json) |
| C | [视频](../test-output/xia-locomotion-speed-abc/speed-C-gameplay.mp4) | [视频](../test-output/xia-locomotion-speed-abc/speed-C-close.mp4) | [JSON](../test-output/xia-locomotion-speed-abc/speed-3.0.json) |

本轮不选择最终速度，等待视觉验收。
