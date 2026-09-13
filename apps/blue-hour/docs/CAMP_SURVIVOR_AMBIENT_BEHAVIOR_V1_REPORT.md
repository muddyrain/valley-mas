# CAMP Survivor Ambient Behavior V1 Report

## 实现

新增 `camp/camp_ambient_behavior.gd`，由营地根节点创建为 `CampAmbientBehavior`。它只管理 POI 选择、停留计时、状态转换和出发覆盖；移动通过现有 `CampActor.move_to()` / `arrived()` 薄接口完成，不触碰 locomotion、动画树、骨骼或资源。

状态：`DISABLED`、`IDLE`、`SELECT_POI`、`MOVE_TO_POI`、`ARRIVE`、`POI_IDLE`、`RETURN_IDLE`、`DEPARTURE_OVERRIDE`。

POI：维修棚、主营房入口、中央生活区、温室。每名幸存者独立计时，避免同步移动；每次选择会避开上一个 POI。停留与再次出发使用固定低频时间窗（4–8 秒 idle、3–7 秒 POI）。

## 出发边界

`camp_main.gd` 在 `begin_departure()` 前调用 `ambient_behavior.disable()`；现有 `CampDepartureController` 继续完全拥有集合、上车和离场流程。

## 验证

- Godot 4.7.2 headless editor parse/import：通过。
- 未修改角色 GLB、Skeleton3D、AnimationPlayer、AnimationTree、动画资源、武器动作、HUD、Core Props、蓝时号、主建筑、Gameplay 或 DepartureController。
- 现有角色移动仍经 `CampActor.move_to()` 与 `NavigationAgent3D`，Ambient 层不直接操作动画状态。
- `tests/camp_ambient_behavior.gd` 运行时专项受仓库现有角色骨骼初始化错误阻断，未将其误报为通过；错误来自现有 locomotion 资源加载链，与本轮脚本无关。
