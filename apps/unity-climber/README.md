# Unity Climber

## 目标

`apps/unity-climber` 是 Unity 主线项目。当前采用“Scene 直接建模与保存”的工作流：

- 场景对象直接保存在 `SampleScene.scene`
- 打开场景即可在 Hierarchy 看到地面、台阶、玩家、终点
- 第三人称跟随相机
- 基础移动与跳跃
- 到达终点触发完成日志

## 快速启动

1. 用 Unity Hub 打开 `apps/unity-climber`（版本建议 `2022.3.62f7`）。
2. 打开 `Assets/Scenes/SampleScene.scene`。
3. 点 `Play`，并先点击一次 `Game` 视图让输入焦点进入游戏。
4. 键位：`WASD` 移动，`Space` 跳跃。

> 现在不使用“脚本在 Play 时生成场景对象”的方式。

## 常见问题

- 场景看起来还是空白：
  - 你可能打开了错误场景；请确认是 `Assets/Scenes/SampleScene.scene`。
- `W/S/A/D` 像在转场景视角，不像控制角色：
  - 当前输入焦点还在 `Scene` 视图；请点击 `Game` 视图后再操作。

## 目录约定（当前）

- `Assets/Scenes/`：场景文件
- `Assets/Scripts/Gameplay/`：玩法脚本（控制、相机、终点）
- `ASSET_PIPELINE.md`：P4 资产规范与下载清单

## Git 提交边界

推荐提交：

- `Assets/**`
- `Packages/**`
- `ProjectSettings/**`
- 所有 `.meta` 文件

不要提交：

- `Library/`
- `Temp/`
- `Logs/`
- `Obj/`
- `UserSettings/`

## 当前脚本

- `Assets/Scripts/Gameplay/ClimberPlayerController.cs`
- `Assets/Scripts/Gameplay/ClimberFollowCamera.cs`
- `Assets/Scripts/Gameplay/ClimberFinishTrigger.cs`
