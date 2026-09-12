# 正式蓝时号替换验收

2026-09-12。范围为 Visual / GLB 与必要的共享场景边界；营地布局、角色、存档、搜索、撤离准备和结算规则保留。工作区已有的外出地图改动继续保留。

## 现状与落地

替换前没有统一车辆 wrapper。`scenes/camp/camp_main.tscn` 的 `NavigationSource/BlueHourBerth` 直接引用 `assets/generated/vehicle_evacuation_bus_model.glb`。`maps/city.gd`、`data/shelter_layout.tres` 和资产展示通过 `BH_EvacBus_01` 加载同一裸 GLB，没有发现第二份旧版运行 GLB、FBX 或独立 Mesh 文件。旧 GLB 是 7,120 三角面的 Blender 程序模型，带独立车门、灯面和导入碰撞；其源文件为 `art/blender/sources/BH_EvacBus_01.blend`。

| 项目 | 结果 |
| --- | --- |
| 正式 GLB | [VEH_BLUE_HOUR.glb](../assets/world/vehicles/VEH_BLUE_HOUR.glb) |
| 唯一 wrapper | [veh_blue_hour.tscn](../scenes/world/vehicles/veh_blue_hour.tscn) |
| 来源 | 用户提供的 `Meshy_AI_VEH_BLUE_HOUR_0912034339_texture.glb`，8,764,952 字节 |
| SHA-256 | `5928e697d86cd9b6592658f63e01ff953675902094804a5ac1a328a071ace67d` |
| 尺寸（长 × 宽 × 高） | Godot 实测 **5.264315 × 2.289689 × 2.750000m** |
| 原始单位 | glTF Y 向上；无节点缩放，最低点 Y 为 -0.000000119m，仅浮点误差 |
| 比例决定 | 源长度小于约 6.2m 的设计目标；宽高匹配，单位正常。用户确认保留原始比例，不拉伸车身 |
| 最终 Scale | Wrapper、Visual、GLB 节点均为 **(1,1,1)**；导入 root_scale=1 |
| 方向与 Pivot | 源车头 -X；Visual 绕 Y +90°，车头变为项目 +Z。Visual 位移 `(-0.009515, 0, -0.011862)`，中心落在地面投影中心 |
| 碰撞 | 单个 Box，X/Y/Z 为 **2.15 × 2.35 × 5.10m**，中心 `(0,1.3,0)`；不使用渲染网格碰撞 |
| 场景入口 | 营地 `camp_main.tscn`、正式外出 `maps/city.gd`、整备 `ui/shelter_view.gd`、展示 `scenes/debug/art_showcase.tscn` |
| 兼容 ID | `BH_EvacBus_01` 保留业务 ID，manifest 路径已指向唯一 wrapper；它不再表示旧模型 |

正式 GLB 原始字节不变。Godot 自动提取三张内嵌 JPG，保留源 PBR 材质，不套用旧程序资产的共享色板。总计一个 Mesh、一个材质 Surface、29,712 三角面；本轮不减面、不重做模型。

## 布局、角色与游戏逻辑

`camp_main.tscn` 只有一行资源路径变化。泊位位置 `(-6.9,0,3.05)`、Y 旋转 -10°、MainBuilding、Workshop、PartyAssembly、车道、相机和烘焙导航文件不变。现有项目标记为 Camp V1.3，本轮沿用其冻结值。

四个当前真实角色 GLB 均实测高 1.6m，车辆高度为角色的 1.71875 倍；MainBuilding 为 12×3.8×4.5m，Workshop 占地 5×3.5m。实际营地截图中车体完全位于泊位，未被建筑挡住，未覆盖角色和右侧集合空间。右侧乘员入口 marker 的垂直物理射线无遮挡；未来出入口 marker 位于 wrapper，不改变既有 PartyPoint 或外出 boarding point。

外出保持原车辆世界位置、朝向、登车半径、准备时间、关门计时、暖光与 Audio 控制。原车门是直接被 Mission tween 的 Mesh；新版无可独立运动的车门，因此用不可见 `DoorMotion` 标记承接同一 tween。没有移动整个车身冒充开门，也没有删除关门计时或结算逻辑。地图导航从 wrapper 的同一个简单 Box 投影，不再维护第二个旧车尺寸的碰撞体。营地已有导航保留原有较大的保守避让范围。

## 未来动画兼容性

| 目标 | 当前资源 | 后续需要 |
| --- | --- | --- |
| 四轮旋转 | 四轮合在 Mesh_0 中，没有独立 wheel node | 拆分四轮，设置轮轴 pivot；不能直接转动现有单一 Mesh |
| 开关车门 | 门与车身合并，没有独立 door node | 拆门、建立铰链或滑轨及门洞；当前仅保留逻辑计时 |
| 角色上下车 | wrapper 有入口/出口 marker，原集合与撤离逻辑有效 | 还需要独立车门、车内落点/座位和角色动作；本轮不宣称已实现 |
| 灯具控制 | 灯面没有独立 Mesh 或材质槽 | 精确控制灯面需拆分灯面或提供发光遮罩；既有 OmniLight 的昼夜控制仍可运行 |

## 旧资源与验证

原 Blender `.blend` 和 `generate_vehicles.py` 中的 `bus()` 作为历史可编辑来源保留，列为需要人工确认的旧来源。常规生成批次对 `procedural=false` 的正式车辆跳过生成，避免恢复旧视觉。

旧运行源 `assets/generated/vehicle_evacuation_bus_model.glb` 及相邻 `.glb.import` 已安全删除。删除前营地和外出完整运行均通过，旧路径在 `.tscn`、`.tres`、`.gd`、JSON/CFG/Godot/Python/PowerShell 等配置与加载入口中为零引用；删除后再次核对为零。没有删除历史 `.blend` 或生成函数，没有人工整理、迁移或删除 `.godot/imported/`。历史报告中的旧路径记录保留，兼容 ID 的命中不等于旧模型引用。

| 验证 | 实际结果 |
| --- | --- |
| Godot 原生编辑器打开工程与 Camp | 已执行；最终重新导入没有资源缺失或脚本解析错误 |
| `tests/camp_runtime.gd` | 102 项，0 失败；泊位、建筑、相机、75 个原导航多边形和路径均保留 |
| `tests/blue_hour_vehicle_runtime.gd` | 36 项，0 失败；删除旧资源后复跑通过；营地、真实整备、真实外出、尺寸、角色与物理碰撞 |
| `tests/world_map_runtime.gd` | 41 项，0 失败；最新代码再次原生执行，菜单→路线→整备→外出→真实搜索→昼夜→行走返航→准备/关门计时→结算→回营 |
| `tests/art_assets.gd` | 52 个登记资产，0 失败；包括正式车辆 wrapper 的实际尺寸、材质和简单碰撞 |
| `tests/art_integration.gd` | 187 项，0 失败；统一车辆、所有入口与回程路径 |
| Python 资产校验 | 52 个登记资产，0 失败；正式 GLB 哈希与用户原件一致 |
| 最终源引用审计 | 旧源引用 0；直接引用新 GLB 的 `.tscn` 只有唯一 wrapper |
| 编码和文档链接 | 定向编码检查通过；变更资产文档无失效链接；仓库链接检查用本机 Git Bash 执行通过，绕开机器上失效的 WSL 启动器 |
| Windows 全量构建 | **未通过，未交付新 EXE**；不是车辆资源或 Parse Error，详见下文 |

所有原生截图来自 Compatibility / OpenGL、NVIDIA RTX 3060 的实际渲染；运行验证使用独立 `user://test-runs/` 存档，不覆盖玩家存档。当前 Camp 仍是现有白盒建筑及固定测试角色场景；没有把它伪称为已接通主菜单的完整新营地玩法。主菜单进入的整备界面也已验证使用相同 wrapper。

Windows 构建实际尝试了三次。前两次遇到另一批正在写入的敌人配置字段与模型导入状态变化；最新一次已经通过世界资产 131 项、地图 760 项、美术模型 52 个、集成 187 项、规则 19 项、敌人专项 74 项、行动 47 项，随后 `tests/search_dispatch.gd:98` 的 **The worker actually retaliates and can take damage** 断言失败（45 项中 1 项）。构建脚本因此在导出前停止。没有跳过失败门禁、覆盖其它任务的敌人实现，或把旧 `build/BlueHourHomeward.exe` 标为本轮新交付；独立 EXE 启动验证未执行。当前仍需相关敌人任务修复这项回归后完成整包构建与独立启动。敌人专项另有 8 个 ObjectDB 退出释放警告；最终车辆原生专项无此警告。

证据文件：[最终车辆原生日志](../test-output/blue-hour-vehicle/final-runtime.log)、[最终完整外出日志](../test-output/blue-hour-vehicle/full-flow-final.log)、[尺寸与物理报告](../test-output/blue-hour-vehicle/runtime.json)、[旧资源审计](../test-output/blue-hour-vehicle/final-audit.json)、[最终构建日志](../test-output/blue-hour-vehicle/build-final.log)。本轮启动的验证进程已退出，没有保留新的常驻服务；未提交 Git。

原生截图：[Camp 16:9](../test-output/blue-hour-vehicle/camp-16x9.png)、[外出 16:9](../test-output/blue-hour-vehicle/expedition-16x9.png)。截图直接来自 Godot 1280×720 渲染视口，没有图像生成或后期合成。
