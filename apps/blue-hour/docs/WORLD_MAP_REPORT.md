# 正式外出地图系统

当前地图：东岸旧街，Seed **20260912**，160×120m。使用首批16项World资产，15栋建筑、12辆静态车辆，其中15栋建筑与3辆车可搜，共18处POI。三路口（2十字、1T口）、六个区域。视觉、运行录像、时间测量和最终构建见 [外出视觉报告](EXPEDITION_VISUAL_REPORT.md)。

## 正式流程与所有权

`project.godot` → `core/main.tscn` / `core/main.gd` → `ui/title_screen.gd` → `show_new_game()` → `ui/new_game_screen.gd` → `confirm_creation()` / 保存 → `ui/shelter_screen.gd` 与 `scenes/camp/camp_main.tscn` → `show_today_action()` / `ui/today_action_screen.gd` → `start_mission()` → 同一营地集结、上车、驶离 → 原 `missions/mission.gd`。

Mission 装配 `maps/city.gd`、原角色与输入、Camera 和时间；Main 的 CanvasLayer 装配 `ui/mission_hud.gd`。`time/mission_clock.gd` 持有 DAY/BLUE_HOUR/NIGHT；`blue_hour/atmosphere.gd` 只响应既有时段信号。没有第二套 GameState、时间、Camp 或控制。

返航沿用 `Mission.command_extract()` → 全员真实步行到 (-11,0,46) → 原准备时间与关门 → `_finish()` → `Main._mission_complete()` → `ui/settlement_screen.gd` → `return_to_shelter()` / 物资入账与保存 → Camp。

营地当前由同期任务统一为冻结 `camp_main.tscn` 实例；旧报告关于它不属于正式营地入口的描述已经失效。没有为了外出地图改 Main Scene 或绕过路线/营地。

## 资产与目录

源件、实际尺度、包围盒、朝向、Pivot修正、碰撞和全部16项接入状态以 [WORLD_ASSET_AUDIT](../art/WORLD_ASSET_AUDIT.md) 为准。所有源GLB未由本轮改写；Root identity、1Unit=1m、Y向上、建筑/车辆Front=-Z，纠正归各Wrapper的ModelRoot。

```text
assets/world/
  buildings/{commercial,residential,industrial,service}/
  vehicles/
  props/street/
  barriers/
  vegetation/
  materials/
scenes/world/        # 正式 Runtime Wrapper
  buildings/
  vehicles/
  props/
  barriers/
  vegetation/
data/world_assets/  # Resource数据与Wrapper引用
```

`data/world_asset_catalog.gd` 是16项唯一注册入口。定义持有 id、scene、category、footprint、bounding_size、poi_type、spawn_weight、allowed_district、parking_requirement、loot_profile、enemy_profile、road_offset、entrance_offset。Generator只实例化注册Wrapper，不加载原始GLB，不按资产ID硬编码朝向。

BAR_001 正式仍为 **4×1.8m规则几何标准段**，左右SnapAnchor、简单Box碰撞。源Meshy缺网版本仅保留审计/破损源，未用来拼标准围栏。当前网片以屏幕导数过滤的透明混合表现细网；柱/横杆保留实体阴影，32段共享材质。

## 生成职责

| 模块 | 当前职责 |
|---|---|
| `data/maps/east_quay.tres` | 固定Seed、160×120边界、道路线段、六个区域、地块、停车、灯/桶/围栏、植被和敌人入口 |
| `map_layout.gd` | 解析Plot与Vehicle数据，只将lootable车辆交给搜索/任务数据 |
| `map_generator.gd` | 一次调度Road/Block/Building/Vehicle/Prop/Vegetation |
| `road_generator.gd` | 8m占用格道路，连接关系决定路口与斑马线；2.4m步道求并为一个Mesh；路缘、中心线、停车线 |
| `block_generator.gd` | 建筑底板和与道路连接的入口步道，避免共面 |
| `plot_generator.gd` | Catalog查表、RoadAnchor位置/朝向、Entrance、POI/profile |
| `building_placer.gd` | Wrapper根绕Y朝道路，绑定原搜索地点 |
| `vehicle_spawner.gd` | 12辆静态车按停车数据朝向，只注册3辆可搜车 |
| `prop_spawner.gd` | 路侧灯/桶与成段围栏，复用原4灯预算 |
| `vegetation_spawner.gd` | 指定种植位置，Seed控制Y旋转与0.9–1.1比例；不是全图随机撒点 |
| `loot_spawner.gd` | 现有general、food_high/medium、medical_basic、materials_tools、fuel_vehicle、vehicle_parts_tools等profile，数值未改 |
| `enemy_spawner.gd` | 现有POI/profile与生成入口；Mission继续持有感染者、刷怪和战斗数值 |
| `navigation_builder.gd` | 从真实Wrapper简单碰撞一次投影到原AStarGrid2D |

源建筑使用原8种，住宅/超市/库房/修理处按街区需要重复。高价值超市/库房位于北侧；入口巴士在南缘停车区。正常车停在车位，只有少量倾斜弃置车；无驾驶系统。四条分段围栏留下通道，28处接缝匹配。

## 导航、碰撞与运行约束

- 1m AStar格覆盖 [-80,80]×[-60,60]，斜行禁止挤角；由Box碰撞加原有0.72m净空边距标记阻挡。
- 地面与2.1m以上的雨棚屋顶不会堵地面导航；建筑、车辆、树干、灯杆、桶和围栏用简单Box，不用渲染Trimesh。
- 全部18处精确入口从出生点可达并能返回；出生点、初始敌人点、每条道路分支检查；全部建筑包围盒两两不穿插。
- 地图只生成一次。模型、材质、道路资源复用；步道合并为一份Mesh，没有每帧重建或全图扫描。
- 街灯白天关闭，Blue Hour/Night暖光与发光开启，基础材质不烘焙蓝紫色。只调整阴影自遮挡和采样，不修改时钟。
- Gas Station源模型未拆雨棚。树冠与屋顶仍可能遮挡，暂未新增复杂Fade/室内系统。

## 验证与边界

`tests/world_assets.gd`、`tests/world_map.gd`、`tests/expedition_visual.gd`负责资源/尺寸/共享/导航/布局；`tests/expedition_visual_runtime.gd`走完整正式闭环并记录三分辨率、搜索、真实受控感染者战斗、Blue Hour和结算。`tests/expedition_motion.gd`记录原生20秒运动；`tests/expedition_travel.gd`测量未改数值的纯行走时间。

旧固定96×72布局已由当前地图直接替换；未保留兼容场景、旧Map ID fallback或存档迁移。原角色、武器、路线、今日行动和存档系统继续复用。没有开启大型城市、第二批资产、室内或下一阶段开发。
