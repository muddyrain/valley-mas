# Medium Town V1 Environment & Street Life M00

2026-09-17。本轮完成独立环境分布框架与现有资产第一轮填充，仅运行于 `medium_town_runtime_test.tscn`。不代表完整 Town 美术或正式 Expedition 已完成。

```text
Blueprint Alignment: CLOSED / STRUCTURE ACCEPTED
Town Structure: FROZEN / UNCHANGED
Environment & Street Life Pass M00: TECHNICALLY COMPLETE
Visual QA: PENDING HUMAN REVIEW
Windows Project Build: BLOCKED BY EXISTING CAMP UI TESTS
```

## Before / After 与五张截图

两张 Overview 使用相同 Seed 4101、1920×1080、正交 size=348、相机位置 `(0,480,130)`、相同光照。Blueprint 原证据未覆盖。其余四张使用正式 Expedition 相机参数 size=25、offset=`(34,42,43)`；商业和工业焦点依据实际灯具、院场、仓库选取，完整坐标见 capture-report。

| 对照 / 场景 | 原生 PNG | 检查重点 |
| --- | --- | --- |
| Before：Blueprint Closure | [冻结 Overview](../test-output/medium-town-blueprint/PROFILE_A_MAIN_STREET_4101_overview.png) | 结构基准 |
| After：Environment Overview | [M00 Overview](../test-output/medium-town-environment-m00/PROFILE_A_MAIN_STREET_4101_overview.png) | 绿带分布、密度差异、保留道路 |
| Commercial Core | [商业街](../test-output/medium-town-environment-m00/PROFILE_A_MAIN_STREET_4101_commercial_core.png) | 路灯、停车、店面入口 |
| Residential B | [住宅](../test-output/medium-town-environment-m00/PROFILE_A_MAIN_STREET_4101_residential.png) | 树、庭院、边缘车辆、入口 |
| Park / Open Space | [公园](../test-output/medium-town-environment-m00/PROFILE_A_MAIN_STREET_4101_park.png) | 绿化簇、路径灯具、开放中心 |
| Industrial / Service | [工业院场](../test-output/medium-town-environment-m00/PROFILE_A_MAIN_STREET_4101_industrial_service.png) | 仓库、Van、短围栏、垃圾桶 |

五张 M00 PNG 均关闭 Overlay。已逐张检查实际渲染内容；这不替代人工审美验收。

## 实现与冻结边界

- `maps/town/environment/town_environment_pass.gd` 消费 Town Result，使用独立 RNG，种子为 Town Seed XOR `0x454E564D`。输出实例、语义 Slot、净空区、拒绝原因、数量和 Land Use 汇总。
- `town_environment_rules.gd` 定义组合与密度，引用现有 Catalog ID；没有第二套路径 Registry。
- `environment_geometry.gd` 测量 wrapper 层级变换后的 Mesh 和实体碰撞包围盒。车辆 InteractionArea 不作为实体障碍物。
- `town_environment_view.gd` 只实例化 Catalog wrapper，复用既有材质风格，不改共享源资源。
- `town_environment_capture.gd` 为原测试场景提供 `--town-environment` 分支，强制使用独立 M00 输出目录。`town_urban_view.gd`、生成器与 `.tscn` 未改。
- `town_environment_overlay.gd` 提供 Slots / Categories / Clear Zones 三个可选开关；截图时隐藏。

支持全部 14 种 Slot：STREET_EDGE、SIDEWALK_EDGE、RESIDENTIAL_YARD、RESIDENTIAL_BUFFER、COMMERCIAL_FRONTAGE、COMMERCIAL_SIDE、PARK、COMMUNITY_GREEN、PARKING、SERVICE_YARD、LOADING_YARD、INDUSTRIAL_EDGE、GREEN_BUFFER、TOWN_EDGE。

Slot 由实际 block polygon、road edge、ground use 和 parcel 派生。同归属同用途的相邻铺地单元在环境层合并，16 米渲染裁剪边界不会直接变成围栏边界；合并产生孔洞时保留原分片。所有修改均限于新数据。无法摆放的候选记录拒绝原因，不改结构。

入口与实际 Entrance / Search / Front / RoadAnchor 至少保留 2 米；入口通道宽 2 米，沿路连续步行带宽 1.55 米；路缘另留 0.65 米家具带，路灯灯臂沿街向布置。Bus 使用实际外包围盒再扩大 4 米，POI 入口保护区为 8×8 米，三条探索路线两侧各预留 0.85 米。Park 保护现有十字路径及 12×12 米中心区域。模型完整水平包围盒参与排斥，树冠也不能伸入上述区域。

Residential A 较多灌木，B 较多树；车辆优先庭院边缘。商业低植被，灯具沿街分布。公园树木成簇，灯与桶只跟随真实 Block Park Path。工业优先 Van、短围栏和低植被；围栏沿院场多边形边缘摆放，不闭合院场。Arrival 巴士由原 View 生成一次，环境层没有 Bus 实例。

## Environment Asset Audit

[可执行审计结果](../test-output/medium-town-environment-m00/asset-audit.json)：八项全部通过。Runtime Scene、统一 identity root、地面 pivot、实测尺寸、简单实体碰撞、Catalog 注册及安全实例化均可用，不需要新增 wrapper 或模型。

| Catalog ID | 实测 Mesh 宽×高×深（米） | 朝向 / 摆放依据 |
| --- | --- | --- |
| VEH_001_sedan_a | 2.089×1.500×4.694 | wrapper 已做源朝向修正，沿世界道路轴 / 标线车位 |
| VEH_002_suv | 2.067×1.700×4.677 | 同上 |
| VEH_003_van | 1.823×1.900×4.417 | 同上 |
| VEG_001_tree_broadleaf_a | 4.768×6.000×3.674 | 地面中心，确定性旋转与等比尺寸变化 |
| VEG_002_bush_a | 1.727×1.000×1.330 | 地面中心，确定性旋转与等比尺寸变化 |
| PRP_001_street_lamp | 0.489×4.200×1.743 | 灯臂局部 -Z，沿道路切线 |
| PRP_002_trash_bin | 0.492×1.000×0.492 | 地面中心，侧面 / 院场 / 路径节点 |
| BAR_001_chainlink_fence | 4.000×1.800×0.070 | 长边局部 X；实体碰撞厚 0.15 米 |

## 实例统计

Seed 4101 合计 **595**。以下是结果，不是数量验收门槛；既有巴士不计入。

| Land Use | Trees | Bushes | Lamps | Bins | Sedans | SUVs | Vans | Fences |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| COMMERCIAL_CORE | 0 | 3 | 6 | 9 | 2 | 1 | 2 | 0 |
| RESIDENTIAL_A | 36 | 230 | 6 | 2 | 9 | 4 | 0 | 0 |
| RESIDENTIAL_B | 55 | 65 | 2 | 2 | 4 | 6 | 0 | 0 |
| OPEN_SPACE | 28 | 37 | 5 | 3 | 0 | 0 | 0 | 0 |
| MIXED_TRANSITION | 0 | 0 | 2 | 7 | 0 | 0 | 5 | 6 |
| INDUSTRIAL_SERVICE | 4 | 3 | 4 | 22 | 0 | 4 | 10 | 11 |
| **合计** | **123** | **338** | **25** | **45** | **15** | **15** | **17** | **17** |

Parking：现有标线、完整车位尺寸及全部净空约束下，10 个合法车位中占用 5 个，**50%**。其余车辆位于 Yard / Loading / Service Slots。标线是冻结视图的世界坐标 3 米间距、5 米长、11 米排距；不对标线系统做重构。

其他四个测试 Seed（4102–4105）在完整净空与标线对齐条件下没有合法车位，记录 0/0、占用率不适用，不强塞车辆；其车辆仍使用合法院场。此限制留给后续人工判断，不改冻结 Town。

## 验证

| 项目 | 实际结果 / 证据 |
| --- | --- |
| Frozen Source / Evidence | [94 个文件 SHA-256 全部不变](../test-output/medium-town-environment-m00/frozen-verification.json)；含 Blueprint 全部原证据、Town 结构代码、资产 Catalog / wrapper |
| Frozen Town Data | Seed 4101 的完整 `var_to_str(town)` 与冻结 generated-town.txt 完全一致；环境生成前后输入也一致 |
| Seed / Environment Determinism | 八个 Seed 重复生成一致，不同 Seed 环境签名不同，覆盖四种旋转 |
| 几何专项 | [5,546,594 checks，0 failures](../test-output/medium-town-environment-m00/validation.json) |
| 重叠 / 净空 | 环境互相重叠、建筑碰撞、道路碰撞、入口阻塞、Arrival 阻塞、POI 阻塞、三条探索路线阻塞均为 0；使用实际资源重新测量，另从原 Town 直接验证道路、步行带、入口与路线 |
| Runtime Asset Load | 八项资产审计通过；595 个 wrapper 已实际渲染 |
| Native Capture | [5 张 PNG / Debug OFF / 三个开关检查通过](../test-output/medium-town-environment-m00/capture-report.json)，Compatibility / RTX 3060 / 1920×1080 |
| Godot Import | PASS，[日志](../test-output/medium-town-environment-m00/import.log) |
| Project Smoke | PASS，[日志](../test-output/medium-town-environment-m00/smoke.log) |
| M00 Runtime Error | 0，[原生日志](../test-output/medium-town-environment-m00/native.log)；不包括下面的既有全项目构建失败 |
| Windows Build | **失败**，[日志](../test-output/medium-town-environment-m00/build.log)：`tests/camp_ui_runtime.gd:114` 访问 `camp_hud_root.gd` 不存在的 `member_buttons`；另有 `Camp exposes active abilities on its left edge` 断言失败。本轮未生成或验证新的独立 exe |

八个 Seed：4101、4102、4103、4104、4105、4106、4110、4201。最终原生环境生成耗时约 303 ms；这是单次测量，不是性能基准。未进行角色导航实玩、正式 Expedition 接入或 GPU 性能验收。几何可通行不等于完整角色导航验收。

## Asset Gap Audit

依据上面五张实际截图列出以下五项，不新增模型。P0 = 缺少时场景仍明显不完整；P1 = 显著改善；P2 = 可选增强。建议数量指资产类型 / 变体，不是全图实例数。

| Missing Asset Category | Why Needed / 截图依据 | Which Land Use | Priority | Suggested Count | 现有库存与建议 |
| --- | --- | --- | --- | --- | --- |
| 公园长椅 / 停留设施 | Park 已有路径、树和灯，但没有可识别的停留用途 | OPEN_SPACE | P0 | 1 种长椅，先评估复用 | 已有 `assets/generated/environment_bench_model.glb`；未在当前 World Catalog 批准接入，属于复用审计缺口 |
| 工业托盘与货箱组合 | Industrial 截图仍主要是空硬地、同款 Van 和桶，缺少装卸活动线索 | INDUSTRIAL_SERVICE / MIXED_TRANSITION | P0 | 托盘 1、货箱 1–2 | 已有 pallet / wood_crate / metal_crate 旧 GLB；优先检验材质、比例与 wrapper，不应直接新建一批模型 |
| 住宅低矮边界 | Residential 截图能读出房屋和树，但庭院仍连成整片，私有边界不明确 | RESIDENTIAL_A / B | P1 | 低栏直段 1、开放入口段 1 | 旧 generated fence 与营地矮栏组合存在；需审计能否复用，不能用大量 Chainlink 代替 |
| 小型道路 / 停车标识 | 商业街与 Overview 的路口、停车出入口缺少方向和用途线索 | COMMERCIAL_CORE / PARKING | P1 | 1–2 种 | 已有 `environment_road_sign_model.glb`；可先审计复用，最终斑马线与标线美术属于后续地面表现工作 |
| 商业门外小型独立道具 | 商业截图的入口虽清晰，街道身份主要依靠建筑自带门面；缺少店外生活节点 | COMMERCIAL_CORE | P2 | 独立店外牌或花箱 1–2 | 建筑自带招牌不是独立道具；当前八项环境 Catalog 无此类，待人工决定是否需要新模型 |

白色人行带偏亮、大片地面材质单一、树种重复与缺少最终灯光层次也可在截图中看到。前三者不应自动转换成几十项模型需求；地面材质 / 曝光需要单独评估，树种变化可留到现有资产充分验收后。M00 未改冻结 View 或原模型。

## 复现与停止点

在仓库根执行；`$engine` 指向当前 Godot console exe：

```powershell
$engine = 'C:/Users/A/Downloads/Godot_v4.7.2-stable_win64.exe/Godot_v4.7.2-stable_win64_console.exe'
& $engine --path apps/blue-hour --headless --script tests/town_environment_assets.gd
& $engine --path apps/blue-hour --headless --script tests/town_environment.gd
& $engine --path apps/blue-hour --resolution 1920x1080 --audio-driver Dummy res://scenes/debug/medium_town_runtime_test.tscn -- --town-environment --town-seed=4101
```

加 `--town-inspect` 可查看三种环境 Overlay。M00 证据在 `test-output/medium-town-environment-m00/`，原 Blueprint 目录保持只读基准。自动化进程均已退出；没有修改玩家存档、自动提交或开启常驻服务。

人工待判断：Town 是否明显脱离纯白盒、绿带是否有层次、住宅 / 商业 / 公园 / 工业是否可辨、是否拥挤或遮挡入口路线，以及哪些缺口值得优先补足。**Visual QA 保持 PENDING HUMAN REVIEW**。在人工查看五张 PNG 与本表前停止，不进入 M01、新模型生产或玩法接入。
