# 营地主站与出发演出 V1

本轮保留 Camp Layout V1.3 的世界布局与相机，把正式主站加入唯一营地，并将今日行动确认接到实体出发演出。

## Main Station

| 项目 | 交付结果 |
| --- | --- |
| 1. 正式 GLB | [assets/world/buildings/CAMP_001_main_station.glb](../assets/world/buildings/CAMP_001_main_station.glb) |
| 2. 唯一 wrapper | [scenes/camp/buildings/camp_main_station.tscn](../scenes/camp/buildings/camp_main_station.tscn) |
| 3. Scale / 对齐 | 根节点与 GLB 为 `(1,1,1)`；仅 Visual 等比 `1.097386`，偏移 `(0.007305,0,0.235)`，无旋转；源模型 Y Up、正面 +Z 朝营地中央 |
| 4. 实测尺寸 | Godot 总包围盒宽 **12.000000m**、深 **6.704319m**、高 **4.170067m**；包含雨棚 / 台阶 / 天线。主体墙及屋面进深约 5.2m，中央屋面约 3.24m，中央屋顶设备约 3.58m。按宽度对齐，保留原件比例，未把天线高度当作主体高度拉伸 |
| 5. 简单碰撞 | 3 个 Box：主体 `11.8×3.1×5.15`、入口 `2.7×2.65×0.5`、台阶 `3.3×0.32×1.3`，数值按 X/Y/Z。保留 `StaticBody3D/CollisionShape3D` 路径，未生成 Render Mesh 复杂碰撞 |
| 6. Navigation | 沿用原 NavigationRegion / 静态碰撞烘焙脚本；轮廓改变后更新同一 `camp_navigation_mesh.tres`，75 → 83 多边形。角色代理修正原网格高出可见地面 0.4m 的路径高度，身体正常接地 |

原 MainBuilding 是 `NavigationSource/MainBuilding` 下的六个白盒 Mesh，没有独立 wrapper、脚本、InteractionArea 或 Facility 逻辑。新 wrapper 保留该节点的世界位置 `(0,0,-6.75)`、零旋转及单位缩放。Workshop、Greenhouse、LivingArea、BlueHourBerth、PartyPoint、FacilitySlot、相机和道路布局均未移动。

首次接入的源 GLB 是 1 Mesh、1 材质、27,592 三角面，使用内嵌 PBR，当时下载原件 SHA-256 为 `912939B48FC24D51DA6389CA70881F905C575F90EB59E5F26314ED3757EE3EDC`。随后用户提供 4K 版本，现已在同一正式路径替换；当前 SHA-256 与纹理 / 主 Viewport 验证见 [清晰度报告](CAMP_CLARITY_REPORT.md)，几何尺寸、碰撞与出发路径未变。首次接入没有旧主站 GLB 待删除；只移除了已被替换的白盒子节点及其专用子资源。旧简化安全屋布局资源和其中的通用建筑资产继续保留于资源库，没有因换主站而删除。

## Departure

| 项目 | 交付结果 |
| --- | --- |
| 7. 原调用链 | `TodayAction.departure_confirmed(id)` → `main.start_mission(id)` → 保存 → 立即创建 Mission |
| 8. 新调用链 | 相同信号 → 保存并锁定任务 ID / 地图 Resource / 队伍 → UI 淡出 → 同一个 Camp 集结 / 上车 / 驶离 → 黑场 → 原 Mission 加载逻辑 |
| 9. Controller | [camp/camp_departure_controller.gd](../camp/camp_departure_controller.gd)，阶段为 IDLE / ASSEMBLING / BOARDING / VEHICLE_STARTING / DEPARTING / TRANSITIONING |
| 10. PartyPoint | 依 selected_party 顺序使用 `CampMain/PartyAssembly/PartyPoint01…04`，1 / 2 / 3 / 4 人依次取前 N 个；未出战 Camp 表现实例留在原位 |
| 11. 车辆入口 | 复用 `CampMain/NavigationSource/BlueHourBerth/VehicleEntryPoint`，来源是 [veh_blue_hour.tscn](../scenes/world/vehicles/veh_blue_hour.tscn)；原 VehicleExitPoint 同样保留 |
| 12. 上车 | [camp_actor.gd](../camp/camp_actor.gd) 以 NavigationAgent3D + CharacterBody3D 行走；排队到入口，面向 DoorMotion 门侧标记停 0.22 秒，隐藏 Visual、停用 Camp 碰撞 / 导航运动并标记 boarded。相邻成员间隔 0.3 秒；数据不销毁 |
| 13. 车辆运动 | Curve3D + PathFollow3D 驱动整个正式车辆 wrapper；第一秒加速，随后稳定驶离；角色全上车后静候 0.75 秒 |
| 14. DeparturePath | `CampMain/DeparturePath/PathFollow3D`，从原斜泊位沿车道向下，转入 z=11.75 道路后向 +X 驶离；固定相机不变 |
| 15. 时长 | 驶离 4.5 秒；UI 淡出 0.18 秒，最后黑场 0.5 秒。1 / 2 / 4 人完整确认至加载约 8.2 / 11.1 / 15.6 秒，随起点与帧率略变 |
| 16. 车轮 | VEH_BLUE_HOUR 四轮仍在单个 Mesh 内，本轮不支持独立轮胎旋转，也不重做车模；原车长 5.264315m、宽 2.289688m、高 2.75m、Scale=1 保持不变 |
| 17. 任务加载 | `main._load_selected_mission()` 继续使用原 `Mission.setup`、Campaign、Ledger 和 HUD；显式传入锁定队伍。第四位任务初始阵位补为独立位置，避免与第一位重叠。原无参数基准 / 冒烟入口保留 |
| 18. 1 / 2 / 4 人 | 全部通过实际 Godot 原生窗口与合成鼠标输入验证。验证正确任务、成员身份 / 顺序、数据保留、重复开始 / 营地交互拒绝、正常连续移动、碰撞、未出战留营及整车离开相机后才淡出 |
| 19. 超时回退 | 集结 9 秒、每人入口移动 6 秒，校正前查询简单碰撞；若候选点均不安全则保留当前安全位置完成视觉上车，输出 warning。车辆路径 / 相机不匹配另有 2 秒保护，避免存档后的流程卡死。故意禁用导航的测试可完成正确任务加载 |
| 20. 后续动画边界 | 车轮、乘员门、灯面未拆 Mesh；真实开门需拆门，轮转需拆轮，正式上车还需适配车门 / 座位动作与角色 IK。已有通用角色移动 / idle 可复用；不新增动作库、不实现返航 |

发动阶段提供 `engine_start_requested(vehicle)` 信号，并识别未来的 `Audio/EngineStart` 节点；目前没有正式发动音频，不生成临时音效。Fake Boarding、车辆路径和加载分别由独立方法承接，后续可替换表现而保持任务数据与加载接口。

## 验收与产物

- `tests/camp_departure.gd`：**89 项通过**，包含 1 / 2 / 4 人及主动导航失败；正常流程无 fallback warning。故障注入场景仅输出预期的集结 / 上车两条 warning。
- `tests/camp_runtime.gd`：**107 项通过**，包含正式主站尺寸、接地、简单碰撞、冻结布局、固定相机与导航连通性。
- `tests/camp_navigation.gd`：**5 条实际身体行走路线通过**，覆盖主入口前场、Workshop、LivingArea、Greenhouse 和车门；未使用瞬移或安全校正。
- `tests/blue_hour_vehicle_runtime.gd`：**36 项通过**，复验同一蓝时号 wrapper、Camp、外出地图、比例及碰撞。
- `run.ps1 -Mode build`：全量构建通过，包括今日行动流程 51 项、原生选择页 68 项、外出原生闭环、武器、规则、任务、导航、五日与效果系统；独立 EXE 菜单 / Camp / 外出 / 今日行动 / 武器 / 展厅共 12 个启动检查通过。
- 未发现 Missing Resource 或 Parse Error。全量既有回归中部分测试退出时仍输出 ObjectDB 临时实例泄漏 warning，未将其记作“零警告”；本轮不扩大修改这些测试的清理逻辑。

产物统一在忽略目录 `test-output/camp-departure/`：`01-main-station-camp.png`、`02-party-assembly.png`、`03-boarding.png`、`04-leaving-berth.png`、`05-on-road.png`、`06-leaving-camp.png`，均为 **1280×720 实际运行截图**。四人验证使用现有夏知遥 / 苏晚星和两个历史角色模板，后两者仍用其既有占位 Visual；没有为测试伪造四份正式角色数据。

最新源码验证日志为 `native-final.log`、`station.log`、`navigation.log`、`vehicle.log`；结构化过程数据为 `runtime.json`，完整构建为 `build.log`。最终导出与独立运行记录为 `final-export.log`；可运行文件在 `build/BlueHourHomeward.exe`，实际时间、大小和 SHA-256 见 `build/BUILD-INFO.json`。

最终交付包于 **2026-09-12 15:31:41 +08:00** 完成导出与独立启动验证，419,954,832 字节，SHA-256 `A60D6F8DDA22F4F0CAEA4E8AEA3FD0FD7603EFCCAD410D2D872CB7F0A2ED8E10`。计划、今日行动契约、美术目录与资源归属已同步；定向编码和文档链接检查通过。

这些是独立测试存档与原生渲染证据，未操作玩家存档；未提交 Git、未新增长期录像目录、未人工整理 `.godot/imported/`。后续人工试玩可评估节奏与镜头观感，正式开门 / 上下车 / 返航仍属后续范围。
