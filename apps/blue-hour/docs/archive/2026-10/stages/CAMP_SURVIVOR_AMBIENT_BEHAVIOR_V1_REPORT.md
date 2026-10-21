# CAMP Survivor Ambient Behavior V1 Report

## 交付范围

本轮为营地幸存者增加 POI 驱动的低频生活行为。系统只决定“何时移动、前往哪里、停留多久”，移动仍由现有 `CampActor` 和 `NavigationAgent3D` 执行。

未修改角色 GLB、Skeleton3D、AnimationPlayer、AnimationTree、Idle/Walk/Jog 动画资源、Root Motion、武器动作、CAMP HUD 2.0、CAMP Core Props、主建筑、蓝时号、Gameplay、今日行动或 DepartureController。

## 实现文件

- `camp/camp_ambient_behavior.gd`：独立 Ambient Director。
- `camp/camp_main.gd`：创建并接入 Director；出发前禁用 Ambient。
- `tests/camp_ambient_behavior.gd`：行为与出发覆盖的专项验证脚本。

## 状态机

`DISABLED → IDLE → SELECT_POI → MOVE_TO_POI → ARRIVE → POI_IDLE → RETURN_IDLE`。

当 `CampDepartureController` 进入非 IDLE 阶段时，所有未上车角色切换为 `DEPARTURE_OVERRIDE`，随后由现有集合、上车和离场流程接管。

## POI 与节奏

当前 POI：

- 维修棚
- 主营房入口
- 中央生活区
- 温室

每名幸存者独立计时并避免连续选择同一 POI。初始 idle 使用轻微错峰；到达后停留约 3–7 秒，再进入约 4–8 秒的 idle 间隔。系统不在 NavigationMesh 上随机漫游，也不生成新的场景道具。

## 接口边界

Ambient Director 只调用：

- `CampActor.move_to(point)`
- `CampActor.arrived()`
- `CampActor.moving`

它不直接设置动画状态、不操作骨骼、不加载动画资源，也不改变角色 Gameplay 数据。

## 验证

- Godot 4.7.2 编辑器解析 / 项目扫描：通过。
- 编码检查：通过。
- 代码接入检查：`CampMain` 创建 `CampAmbientBehavior`，`begin_departure()` 会先禁用 Ambient。
- `tests/camp_ambient_behavior.gd` 运行时验证未能完成：当前仓库已有角色骨骼初始化链错误（包括 locomotion layer / combat constraint 空引用及相关资源问题），导致场景角色初始化阶段中断。该阻断不由本轮 Ambient 代码引入，未将专项运行误报为通过。

## 当前限制

本轮沿用现有 CampActor 行走与动画表现。若后续动作线程提供正式 Camp Walk 映射，只需在既有角色表现层接入，不需要改动本 POI 状态机。

本轮完成后停止，等待视觉审核；不推进 Ambient Behavior V2、新玩法或新的环境资产。
