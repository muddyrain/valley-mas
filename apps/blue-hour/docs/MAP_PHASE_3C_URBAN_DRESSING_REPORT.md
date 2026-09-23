# Expedition Map Phase 3C：Anime Stylized Urban Dressing Expansion

## 交付范围

本阶段新增城市环境装饰，并升级确定性摆放密度。没有修改战斗、UI 布局、角色控制、摄像机系统、MiniMap 绘制、道路/街区/建筑生成、POI、搜索和返航规则。MiniMap 与 Expedition UI 只用于验收截图。

Blender 5.2.1 LTS 在本机真实生成 24 件新模型，每件独立 `.blend` 源和 GLB，统一使用 BLUE HOUR ART_BIBLE V1 简化几何和共享大色块材质，无照片贴图、碰撞代理或玩法数据。实测 124–916 tris/件，总计 10,340 tris。完整 hash、尺寸、类别、标签和材质见 [manifest](../assets/world/props/city_props_v2/manifest.json)；模型/源文件目录见 [MODEL_CATALOG](../art/MODEL_CATALOG.md)。

| Asset ID 后缀 | 用途 | tris | 区域/随机摆放 |
|---|---|---:|---|
| `011_planter_box_pair` | 花箱、庭院绿化 | 424 | 住宅：成组 |
| `012_neighborhood_notice_board` | 社区告示板 | 352 | 住宅：成组 |
| `013_recycling_bin_pair` | 分类垃圾桶 | 264 | 住宅/商业：成组 |
| `014_delivery_lockbox` | 包裹柜 | 292 | 住宅：成组 |
| `015_garden_tool_cart` | 庭院工具车 | 592 | 住宅：成组 |
| `016_storefront_menu_stand` | 店前菜单牌 | 448 | 商业：成组 |
| `017_beverage_crate_stack` | 饮料周转箱 | 528 | 商业：成组 |
| `018_delivery_handcart` | 配送手推车 | 548 | 商业/工业：成组 |
| `019_sidewalk_banner_stand` | 人行道立牌 | 356 | 商业：成组 |
| `020_storefront_flag_pair` | 店招旗 | 404 | 商业：成组 |
| `021_street_bollard_set` | 路桩组 | 828 | 路边：抽样摆放 |
| `022_utility_cabinet` | 路侧设施箱 | 308 | 路边：抽样摆放 |
| `023_guardrail_segment` | 护栏节段 | 264 | 路边：抽样摆放 |
| `024_bicycle_parking_rack` | 自行车架 | 916 | 住宅/路边：抽样摆放 |
| `025_bus_stop_post` | 站牌 | 220 | 道路及 Arrival |
| `026_fallen_market_sign` | 倒伏店牌 | 316 | 轻灾后商业组 |
| `027_cloth_tarp_bundle` | 防水布包 | 264 | 轻灾后工业组 |
| `028_scattered_box_debris` | 少量纸箱遗留 | 308 | 轻灾后工业组 |
| `029_broken_fence_section` | 局部破损围栏 | 352 | 轻灾后住宅组 |
| `030_roadside_grass_patch` | 路缘草丛 | 504 | 道路及绿化组 |
| `031_small_bush_cluster` | 小灌木组 | 124 | 住宅/路边绿化组 |
| `032_neglected_planter` | 疏于照料的花盆 | 536 | 住宅绿化组 |
| `033_small_vine_patch` | 小片爬藤 | 604 | 墙边绿化类别；当前保留 Catalog 供规则扩展 |
| `034_umbrella_stand` | 雨伞收纳架 | 588 | 住宅/商业组 |

所有条目均为本轮真新增模型，并注册进 `WorldAssetCatalog`。旧资产没有算作新增数量：Phase 3A 的垃圾桶、邮箱、自行车、花盆、围栏、路灯、锥桶、长椅和自动贩卖机，以及 Phase 3B 的招牌、空调、电杆、电线、信号灯、候车亭、遮阳棚、纸箱、消防栓与破损广告牌继续复用并参与同一个 Urban Dressing 实例上限。

## 摆放规则

- Residential 以住宅入口内侧、远离道路的一侧选点，每四个地块尝试两件小物组合，优先花箱、公告板、垃圾桶、包裹柜、工具车、灌木、花盆或伞架。
- Commercial 每三个地块尝试两件店前组合，使用菜单牌、饮料箱、手推车、立牌、店招旗、垃圾桶或伞架。
- Industrial 街区确定性尝试轻灾后两件组合，使用倒伏店牌、防水布、纸箱遗留和破损围栏。五个验收 Seed 均实际放置至少两件轻灾后新资产。
- Roadside 基础设施降频：电杆按四段道路抽样、消防栓按八段道路抽样；剩余路段按六段道路抽样加入路桩、设施箱、护栏、自行车架、站牌或绿化。既有交叉口信号灯、有限高空电线和商业候车亭保留。
- 成组物件使用 Seed RNG 挑选互补变体，在同一建筑入口外侧的分离位置依次试放；Arrival 额外搜索站牌候选点。失败时保留空位，不越过道路、建筑和既有装饰占位约束。
- 实例总上限仍是每图 96；所有装饰 `collision=false`、`searchable=false`、`spawn_weight=0`。不新增 Navigation/战斗碰撞体，不注册 POI 或 Search。

## 验证与证据

- Blender 5.2.1 background export：24/24 GLB 与独立 `.blend` 成功；124–916 tris/件，合计 10,340 tris，无碰撞代理。
- Godot 4.7.2 Editor import：24/24 GLB 导入；资源定义可加载，Catalog 查找与 PackedScene 实例化通过。
- 五个固定 Seed `4101–4105`：`682 checks / 0 failures`；摆放确定性一致，五个 Seed 均实际覆盖住宅、商业、路边、轻灾后和 Arrival 新道具，实例数低于 96。每图 93–94 个装饰实例，其中 13–19 个属于 V2 新资产。
- Phase 3A 回归：最新规则下 `29,486 checks / 0 failures`；旧资产、到达区基础装饰、建筑/道路净空合同通过。
- 原生 Godot 场景截图 11 张，包含五 Seed 总览、住宅/商业/道路/灾后、疏/密点位；正式 Expedition/HUD 另有 MiniMap 正式 UI 与幸存者移动截图。它们分别来自 Town 原生渲染视图与真实 Expedition 场景，见下表。

| 验收画面 | 截图 |
|---|---|
| MiniMap 正式 UI | [正式 Expedition HUD](../test-output/town-phase-3c-capture/01_official_minimap_ui.png) |
| 街区整体 | [Seed 4101 总览](../test-output/town-phase-3c-capture/02_seed_4101_town_overview.png) |
| 住宅街边 | [住宅道具](../test-output/town-phase-3c-capture/03_residential.png) |
| 商业店前 | [商业道具](../test-output/town-phase-3c-capture/03_commercial.png) |
| 道路边缘 | [道路设施](../test-output/town-phase-3c-capture/03_roadside.png) |
| 轻灾后痕迹 | [工业/灾后点缀](../test-output/town-phase-3c-capture/03_aftermath.png) |
| 疏密对比 | [稀疏点位](../test-output/town-phase-3c-capture/06_sparse_dressing.png) / [密集点位](../test-output/town-phase-3c-capture/07_dense_dressing.png) |
| 角色移动 | [实时 Expedition 截图](../test-output/town-phase-3c-capture/09_survivor_moving_in_live_expedition.png) |
| 其他随机 Seed | [4102](../test-output/town-phase-3c-capture/seed_4102_town_overview.png)、[4103](../test-output/town-phase-3c-capture/seed_4103_town_overview.png)、[4104](../test-output/town-phase-3c-capture/seed_4104_town_overview.png)、[4105](../test-output/town-phase-3c-capture/seed_4105_town_overview.png) |

## 影响与验收结论

从“随机孤立道具”向按建筑区块和路段成组摆放推进；规则保持确定性 Seed、冻结 Town geometry 与最大 96 实例约束。总环境装饰数量没有增加，路侧基础设施从每图 33–41 项降到 26–30 项，再把容量用于地块组合，因此没有提高实例上限或单件网格预算。没有运行性能 profiler；结论限于静态网格、复用导入资源、实例数持平/上限不变和无碰撞。

阶段目标的技术门禁与截图产出通过：街区有更多生活物件，Seed 随机性、道路/建筑净空和 Expedition HUD 均保留。项目开发目标为 Anime Stylized；本轮用共享色板和简化造型约束模型。跨全部截图的人工美术审阅仍为 Pending，不把原生自动截图误写为人工 Visual QA。

GitNexus CLI 可用且索引显示 up-to-date，但对于当前工作树 GDScript 方法 `generate`、`_place`、`_add_arrival`、`_add_near_site`、`_clear_of_town` 的 impact 查询均返回 `UNKNOWN / Target not found`。源码核对到 `town_urban_dressing_layer.gd` 同时由 Expedition runtime adapter、Camp、环境复用工具及定向测试调用；本轮没有改函数签名，以上定向回归覆盖该共享规则层。

Phase 1.2 MiniMap 兼容专项运行到 `897 checks / 1 failure`：失败断言要求源码不含 `display_name`，但当前并行工作区中的 MiniMap 发现提示新增读取该字段。本阶段未修改 MiniMap；该失败独立于 Urban Dressing 代码。

工作区整体 `git diff --check` 另报告 `maps/exploration.gd:95` 的尾随空白；该文件为本轮之外的并行修改。本轮涉及的 Catalog、摆放层、run 脚本、PLAN 和 MODEL_CATALOG 定向 diff whitespace 检查通过。没有执行完整 Windows Release build。
