# Survivor Animation Phase 2 Final Visual QA

## 结论

**B. 存在阻断级视觉问题，Survivor Animation V1 暂不正式验收。** 正式 Expedition 画面中的普通 Run 双臂在跑动循环里持续抬至头侧，跑姿明显不自然；Death 最终倒地姿势一条腿高举、另一条腿横向伸展，俯视镜头下仍能看出扭曲。这两项需要定点校准和复核。Rifle Idle / Rifle Run 的双手握枪关系和 K9 正式尺寸在当前镜头下可接受，不建议重开 SMG 比例或全面精修。

## 真实画面采集

已使用正式 Medium Town / Expedition Mission、正式相机（`size=23`）、夏知遥 `SUR_001`、现有导航与移动、正式 K9 模型、自动攻击、伤害与死亡路径，以及正式 HUD。测试入口编排这些现有流程、锁定地图种子、延长各阶段停留时间并保存画面；没有建立替代场景，也没有更改正式玩法或武器配置。为观察持续自动攻击，测试脚本将本次生成的目标实例 HP 设为 `10000`；正式敌人资源与伤害数值未改。

通过 macOS `open -n -g -j` 在后台隐藏启动 Godot Movie Maker。采集期间用 `lsappinfo front` / `lsappinfo info` 检查，前台应用是用户正在使用的微信或飞书，Godot 没有成为前台应用。未启动 Blender，也未弹出调试窗口。

原生录像 `test-output/survivor-animation/expedition-runtime/expedition_visual_qa.avi` 为 1600×900、60 fps、1984 帧、33.07 秒；同目录已转码 `expedition_visual_qa.mp4`（H.264 / AAC，7.4 MB），`ffprobe` 校验通过。原生视口输出十张 1600×900 PNG：

| 阶段 | 截图 |
| --- | --- |
| Idle / Run | `expedition_idle.png`、`expedition_run.png` |
| Rifle Idle / Rifle Run | `expedition_rifle_idle.png`、`expedition_rifle_run.png` |
| 移动 / 静止射击 | `expedition_moving_shoot.png`、`expedition_shoot.png` |
| Hit / Death | `expedition_hit.png`、`expedition_death.png` |
| Knife Idle / Attack | `expedition_knife_idle.png`、`expedition_knife_attack.png` |

验收以未放大的正式相机画面与原始录像为准；只用局部放大检查细节，没有把放大图当作交付截图。后半段的路灯会遮住部分角色，但 Run 与 Death 的问题在原始画面中也能辨认。

## Runtime / Structural

| 检查 | 结果 |
| --- | --- |
| 原生 Expedition Movie Maker 专项 | PASS：53 checks / 0 failures；十张 PNG 均生成，34 次正式攻击事件 |
| `survivor_animation_pipeline.gd` | PASS：300 checks / 0 failures |
| `survivor_expedition_animation_runtime.gd` 默认 headless | PASS：33 checks / 0 failures |
| 同专项 `-- capture` headless 长时间轴演练 | PASS：33 checks / 0 failures |
| `expedition_integration_e00.gd` | PASS：58 checks / 0 failures |
| `weapon_visuals.gd` | PASS：1789 checks / 0 failures |
| `public_locomotion_production.gd` | PASS：495 checks / 0 failures |
| Windows build / EXE | NOT RUN：当前没有 Windows 环境或远端连接 |

原生采集日志没有脚本或资源错误。退出时 Godot 报 `2 ObjectDB instances were leaked at exit`，未影响测试、视频或截图；保留原始 stdout/stderr 供复查。

## Visual QA

| 项目 | 结论 | 正式镜头所见 |
| --- | --- | --- |
| Idle | PASS | 站姿落地，手臂自然下垂，没有明显 A/T Pose 或骨骼扭曲。 |
| Run | **FAIL** | 双臂在大部分循环里屈肘抬至头侧，明显不像自然奔跑；腿部仍有步幅变化，未见持续高抬腿。 |
| Rifle Idle | PASS WITH MINOR ISSUE | K9 靠近肩部，枪身未盖住脸，双手视觉上保持握持；枪口略偏高，但正式镜头下不妨碍角色轮廓。稳定段左手前握把误差约 1.2 mm。 |
| Rifle Run | PASS | 双手抱枪跑，枪体方向稳定，未见持续漂浮或左手明显脱离；稳定段左手误差低于 1 mm。 |
| Shoot | PASS WITH MINOR ISSUE | 静止与移动自动射击都触发，枪口大体向目标，射击后恢复；移动射击开始的 2 帧存在瞄准方向反向的数值瞬态，正常比例录像里未见持续反向/闪动。 |
| Hit | PASS WITH MINOR ISSUE | 受击时上半身有短促抖动，随后回到 Rifle Idle；路灯遮住部分动作，原生运行时记录 21 帧受击状态后恢复，没有连续循环。 |
| Death | **FAIL** | 动画完整播放且末帧保持，但倒地后上举一腿、另一腿横向伸展，轮廓扭曲，在俯视画面下不自然。 |
| Knife | PASS | 正式小刀路径能触发待机与攻击，挥砍弧线可见；未见状态卡住。 |

K9 正式原始尺寸在实际相机下没有压住上半身或遮脸，**不调整正式尺寸**；Phase 1.8 Debug Preview 的 `0.84` 缩放建议不作为本轮正式修改依据。

## 变更范围与后续

本轮修改 `tests/survivor_expedition_animation_runtime.gd`，增加可选的原生采集时间轴、截图与 HUD 装载；默认测试路径保持 33 项。更新本报告与 `docs/PLAN.md`。未改 Character Mesh、`BH_Humanoid_Rig_v1`、11 段动画、AnimationLibrary、Weapon Controller、K9 正式数据、Gameplay、地图或 HUD 源码。

下一步只需校准普通 Run 双臂与 Death 末帧，然后复用同一正式相机路径复核这两项。未通过前，不开始批量接入其他幸存者或 ENM_001 的下一阶段。复现原生采集命令（后台隐藏启动，不抢前台）：

```bash
open -n -g -j -W --stdout test-output/survivor-animation/expedition-runtime/native_capture_stdout.log --stderr test-output/survivor-animation/expedition-runtime/native_capture_stderr.log -a /Applications/Godot.app --args --path /Users/bytedance/Desktop/study/valley-mas/apps/blue-hour --resolution 1600x900 --fixed-fps 60 --write-movie test-output/survivor-animation/expedition-runtime/expedition_visual_qa.avi --script tests/survivor_expedition_animation_runtime.gd -- capture
```

GitNexus 对测试脚本方法的 impact 查询返回 `UNKNOWN / Target not found`，没有 HIGH/CRITICAL 结果；人工确认新增入口只在测试脚本内调用。变更检测显示没有被索引的生产执行流受影响；`git diff --check` 通过。
