# BLUE HOUR STARTER ENVIRONMENT KIT V1

## Survivor 当前冻结 Production Baseline（2026-09-19）

清理清单与验证结果见[生产收尾报告](../docs/SURVIVOR_PRODUCTION_FINALIZATION_REPORT.md)。

SUR_001～SUR_012 的 165cm 正式 Runtime、23 骨 `BH_Humanoid_Rig_v1`、canonical T-Pose Bind、Shared Skin Contract、Public Idle / Walking / Running、Expedition Walkable Ground Contract 均已通过验收。Expedition 基础速度为 **2.8m/s**。不生成 V2/V3 或角色专属 Locomotion。

未来 12 人统一流程：**Static GLB → 165cm Runtime Envelope → canonical T-Pose Alignment → BH_Humanoid_Rig_v1 → Skin QA → Public Locomotion → Gameplay**。角色资料身高不缩放 Runtime Rig；LOD0 目标约 100k tris。统一 Bone Length / Axis / Rest / Foot Ground / Socket，外观差异由 Mesh 和 Skin 承担。未来角色直接共享公共三动作，不制作独立 Idle / Walking / Running，不运行角色专属 Retarget。

正式角色入口统一为 `assets/characters/<character_id>/runtime/<character_id>.glb`。公共库：`assets/animations/public_locomotion/public_locomotion.tres`，引用同目录 `public_idle.tres`、`public_walking.tres`、`public_running.tres`。冻结基线哈希记录在 `tests/fixtures/survivor_production_baseline.json`。

当前 Skin / T-Pose / Canonical 转换与生产 QA 工具保留。`export_locomotion_retarget.gd` 仍被公共转换的 `canonical_locomotion/prepare.py` 调用，属于保留工具链，不是旧角色 Runtime。两份旧 source GLB 因先前工具策略阻止删除而列为待清理，已排除导出且无正式引用；本轮不绕过策略重试。

旧 Mission Jog、Start/Stop 资源及旧局部摆臂层已退出生产并清理，对应历史章节只保留开发记录，不再描述当前 Runtime。三人长途返回/让行停滞、旧 Camp HUD 断言作为独立已知问题保留，不计本轮失败；不开展 Combat/Armed、Turn/Start/Stop 或其余角色制作。

## Unified Survivor Runtime roster

SUR_001～SUR_012 均使用 1.65m Runtime Envelope、冻结的 23 骨 `BH_Humanoid_Rig_v1`、1 Skin 与同一套公共 Locomotion。SUR_003～SUR_012 源模型均为单 Mesh、单材质、三张 2048² 贴图的静态 A-Pose；生产导出无 embedded animation、无无权重顶点，最多 4 骨影响。完整 QA 见[批次接入报告](../docs/REMAINING_10_SURVIVOR_RUNTIME_INTEGRATION_REPORT.md)。

| Survivor | 正式 Runtime GLB | LOD0 tris | Definition | 状态 |
| --- | --- | ---: | --- | --- |
| SUR_001 夏知遥 | [xia_zhiyao.glb](../assets/characters/xia_zhiyao/runtime/xia_zhiyao.glb) | 101,982 | [xia_zhiyao.tres](../data/survivors/xia_zhiyao.tres) | Production |
| SUR_002 苏晚星 | [su_wanxing.glb](../assets/characters/su_wanxing/runtime/su_wanxing.glb) | 102,500 | [su_wanxing.tres](../data/survivors/su_wanxing.tres) | Production |
| SUR_003 林见月 | [lin_jianyue.glb](../assets/characters/lin_jianyue/runtime/lin_jianyue.glb) | 102,128 | [lin_jianyue.tres](../data/survivors/lin_jianyue.tres) | Production |
| SUR_004 陆清禾 | [lu_qinghe.glb](../assets/characters/lu_qinghe/runtime/lu_qinghe.glb) | 102,574 | [lu_qinghe.tres](../data/survivors/lu_qinghe.tres) | Production |
| SUR_005 沈砚川 | [shen_yanchuan.glb](../assets/characters/shen_yanchuan/runtime/shen_yanchuan.glb) | 102,444 | [shen_yanchuan.tres](../data/survivors/shen_yanchuan.tres) | Production |
| SUR_006 唐栀 | [tang_zhi.glb](../assets/characters/tang_zhi/runtime/tang_zhi.glb) | 101,562 | [tang_zhi.tres](../data/survivors/tang_zhi.tres) | Production |
| SUR_007 顾予安 | [gu_yuan.glb](../assets/characters/gu_yuan/runtime/gu_yuan.glb) | 102,366 | [gu_yuan.tres](../data/survivors/gu_yuan.tres) | Production |
| SUR_008 程茉 | [cheng_mo.glb](../assets/characters/cheng_mo/runtime/cheng_mo.glb) | 100,369 | [cheng_mo.tres](../data/survivors/cheng_mo.tres) | Production |
| SUR_009 周野 | [zhou_ye.glb](../assets/characters/zhou_ye/runtime/zhou_ye.glb) | 102,974 | [zhou_ye.tres](../data/survivors/zhou_ye.tres) | Production |
| SUR_010 许昭宁 | [xu_zhaoning.glb](../assets/characters/xu_zhaoning/runtime/xu_zhaoning.glb) | 95,814 | [xu_zhaoning.tres](../data/survivors/xu_zhaoning.tres) | Production |
| SUR_011 贺临川 | [he_linchuan.glb](../assets/characters/he_linchuan/runtime/he_linchuan.glb) | 102,750 | [he_linchuan.tres](../data/survivors/he_linchuan.tres) | Production |
| SUR_012 宋时雨 | [song_shiyu.glb](../assets/characters/song_shiyu/runtime/song_shiyu.glb) | 96,464 | [song_shiyu.tres](../data/survivors/song_shiyu.tres) | Production |

公共动作唯一入口为 [public_locomotion.tres](../assets/animations/public_locomotion/public_locomotion.tres)。角色目录不得增加 Idle / Walking / Running 副本。SUR_003～SUR_012 的 Trait 资源当前仅承载数据，Runtime 效果未实现。

12 名幸存者的头像与上表 Runtime 模型使用同一 `assets/characters/<character_id>/` 归属目录，统一入口为 `portrait/avatar_square.png`。具体角色绑定由上表的 Definition `portrait_path` 决定，UI 不从文件名或目录顺序推断身份。


## Standard Survivor Template 静态基线

2026-09-17：女性标准模板唯一入口为 [survivor_animation_template.tscn](../assets/characters/survivor_animation_template/survivor_animation_template.tscn)，实测 1.6499997m、28 骨、34,098 顶点、49,349 三角形。保留源 Rest Pose 和权重，不接入源 FBX 的动作；场景无 AnimationPlayer / AnimationTree，不接入正式角色或 gameplay。静态鞋底接地通过，左右 Toe_End 轴存在最大约 28.8° 镜像差，后续动作制作前须明确处理策略；本轮不修正。源哈希、完整层级、地面与蒙皮检查见 [静态基线报告](../docs/STANDARD_SURVIVOR_TEMPLATE_BASELINE.md)。此模板独立于下述环境套件统计。

2026-09-17：源 Idle_4 的接地专项修正输出到模板专属 [animations/idle.tres](../assets/characters/survivor_animation_template/animations/idle.tres)，制作源为 [standard_survivor_idle.blend](blender/characters/standard_survivor_idle.blend)。14 秒，双腿/Foot/ToeBase 与必要骨盆高度修正已烘焙；原静态入口和正式角色不变，无 Runtime IK。接地测量、四视角和后跟残余蒙皮变化见 [接地验收报告](../docs/STANDARD_SURVIVOR_IDLE_FOOT_CONTACT.md)，未接入公共动画或 gameplay。

2026-09-17：Walking 接地/支撑速度/Loop 修正输出到模板专属 [animations/walking.tres](../assets/characters/survivor_animation_template/animations/walking.tres)，制作源 [standard_survivor_walking.blend](blender/characters/standard_survivor_walking.blend)。保持 1.0416667 秒、24 FPS 时间轴和原地形式，120Hz 子帧烘焙；支撑参考 1.425m/s，首尾闭合。四视角、接地与残余滑动对比见 [Walking 修正报告](../docs/STANDARD_SURVIVOR_WALKING_FOOT_CONTACT.md)。候选已交付，等待视觉验收；未修改静态模板、Idle、正式角色或 gameplay，不继续 Running。

2026-09-18：用户确认 Rest / Idle V1 / Walking V1 均 PASS，覆盖上段 Walking 待验收状态。源 Running 已完成独立原样验收，0.666667 秒、24 FPS、180 步/分钟；本轮没有正式 Running 动作导出或资源修改。支撑悬空、摆臂与 Loop 结果见 [Running 原样报告](../docs/STANDARD_SURVIVOR_RUNNING_REVIEW.md)，等待视觉验收，不自动推进修正。

2026-09-18：根据用户后续授权完成无武器持续 Run 重构候选，正式动作 [animations/running.tres](../assets/characters/survivor_animation_template/animations/running.tres)，制作源 [standard_survivor_running.blend](blender/characters/standard_survivor_running.blend)。0.666667 秒 / 180 步频保留，支撑与摆臂已重构、完整循环闭合；反推匹配速度约 2.57m/s，未写入 Gameplay。测量、四视频和后跟残差见 [重构报告](../docs/STANDARD_SURVIVOR_RUNNING_RECONSTRUCTION.md)。等待视觉验收，不推进 Combat Jog / Armed Run。

## Xia / Su 统一生产 Locomotion

2026-09-19：用户已验收 165cm T-Pose Bind + Skin Polish，两角色正式入口为 [Xia](../assets/characters/xia_zhiyao/runtime/xia_zhiyao.glb) 与 [Su](../assets/characters/su_wanxing/runtime/su_wanxing.glb)，LOD0 分别 101,982 / 102,500 tris。两者原生冻结 BH_Humanoid_Rig_v1 23 骨，直接引用唯一[公共动画库](../assets/animations/public_locomotion/public_locomotion.tres)，不再使用角色专属 Locomotion Retarget。Expedition 2.8m/s，Run reference 2.276231530m/s；Camp 原行为不变。

[生产接入报告](../docs/SURVIVOR_PRODUCTION_INTEGRATION_REPORT.md)记录视频、接地、武器和独立 EXE 证据。旧 Xia 专属三动作已删除；两份无引用旧 source GLB 因工具删除审批被拒绝暂留，不打入生产包。Standard 三动作制作源和 canonical 公共库继续保留。旧 [Retarget 报告](../docs/XIA_ZHIYAO_STANDARD_LOCOMOTION_RETARGET.md)仅为历史记录。

## 环境套件

2026-09-17 Medium Town M01 根据用户旧资产白名单接入 11 项 World wrapper：PRP_003 Bench、004 Pallet、005 WoodCrate、006 MetalCrate、008 DirectionSign、009 VendingMachine、011 可选 Planter，BAR_002 住宅低栏、003 混凝土路障、004 金属拒马、005 破损工业围网。直接引用旧 GLB 或序列化现有 Camp recipe，不新增模型或贴图。可搜索售货机 / 箱体与公告板不进入装饰随机池。源 ID、用途边界见 [白名单](../docs/MEDIUM_TOWN_ENVIRONMENT_REUSE_SELECTION.md)，Runtime 路径、验证与截图见 [M01 报告](../docs/MEDIUM_TOWN_ENVIRONMENT_M01_REPORT.md)。

当前 CAMP Composition 02B（2026-09-14）沿用下述 Pass 02 的 6 树 / 21 Bush，重组为六个树根主群与三个矮植被次群；树缩放 0.72/0.78，主群 Bush 为 1.00/0.84/0.68、次群为 0.62，草花群由 16 调为 30（含花箱）。围栏改为蓝灰柱 + 米灰旧木宽横梁 + 稀疏钢带，保留约 1.01m 高与原碰撞。无新 Blender/Meshy/GLB。当前构图、数量、性能与导航证据见 [02B 报告](../docs/CAMP_ENVIRONMENT_COMPOSITION_PASS_02B_REPORT.md)；以下 Pass 02 参数为改前记录。

2026-09-14 CAMP Environment Polish Pass 02 复用 `VEG_001_tree_broadleaf_a`（6 株，等比约 0.75–0.90）与 `VEG_002_bush_a`（7 组共 21 株，等比 0.52/0.70/0.88），仅营地实例移除碰撞并使用既有植被 Shader。原模型与 wrapper 不改。`camp/camp_dressing.gd` 组合 Godot 规则矮栏（高约 1.01m，原段长 4.5/5.5m）、柱脚/檐框/灯具与低矮草花，复用营地材质合批；无新 GLB 或 Blender 模块。证据与边界见 [环境第二轮报告](../docs/CAMP_ENVIRONMENT_POLISH_PASS_02_REPORT.md)。

正式营地主站使用用户原件 [CAMP_001_main_station.glb](../assets/world/buildings/CAMP_001_main_station.glb)，唯一 [wrapper](../scenes/camp/buildings/camp_main_station.tscn) 由冻结 Camp 实例化。当前为 4K 版本：BaseColor / Normal 4096²、MetallicRoughness 原始 2048²；27,592 tris、1 Mesh / 材质、内嵌 PBR。Visual 等比 1.097386，总包围盒宽 12.000 / 高 4.170 / 深 6.704m（含天线、雨棚和台阶），中央主体屋面约高 3.24m、中央屋顶设备约 3.58m；3 个 Box 简单碰撞。此项不进入旧 Blender 生成批次；接入与出发演出见 [Camp Departure V1](../docs/CAMP_DEPARTURE_V1.md)，当前导入与主 Viewport 验证见 [清晰度报告](../docs/CAMP_CLARITY_REPORT.md)。

正式外出街区已使用首批16项World资产，完整目录、Wrapper、实测尺寸和接入状态见 [WORLD_ASSET_AUDIT](WORLD_ASSET_AUDIT.md)。下表旧Blender库中“东岸旧街”的摆放说明为历史位置，已由本批Wrapper替换；仍保留资产库、营地或展厅引用，不表示当前正式外出仍走旧模型。道路、围栏的当前规则实现见 [WORLD_MAP_REPORT](../docs/WORLD_MAP_REPORT.md)。

正式普通感染者的 Art Source 登记于 `assets/characters/infected_basic_a/model/source/ENM_001_infected_basic_a.glb`（81,874 tris，58,441 顶点，1.65 米）。正式行动只实例化 `assets/characters/infected_basic_a/runtime/ENM_001_infected_basic_a_30k.glb`；旧源已归档到 `legacy/`，下表 `BH_Infected_Basic_Placeholder` 仅保留于历史资产库和既有美术展厅，不进入刷怪池。

生成真源为 `blender/asset_specs.py` 与各类别生成器；数值从实际导出的 GLB 读取。其中 51 个资产为本项目原创 Blender 程序模型；蓝时号使用用户提供的 VEH_BLUE_HOUR GLB。先复用，再创建。

每项均展示于 `scenes/debug/art_showcase.tscn`。表中地点表示已接入的视觉位置，其余资产保存在展示场景供后续组合；不表示新增搜索对象或武器玩法。完整数据与哈希见 `assets/generated/manifest.json`。尺寸按 Godot X/Y/Z（宽/高/深，米）；面数只计渲染网格。

| ID / 中文用途 | 类别 | GLB / Blender 源 | Tris | 材质 | 简化碰撞 | 当前使用位置 | 程序生成 / Placeholder | 来源 |
| --- | --- | --- | ---: | --- | --- | --- | --- | --- |
| BH_AC_Outdoor<br>空调外机 | props | [GLB](../assets/generated/environment_air_conditioner_outdoor_model.glb) / [blend](blender/sources/BH_AC_Outdoor.blend) | 656 | BH_Metal_Dark, BH_Metal_Mid, BH_Plastic_Light | 1 Box→Convex | Art Showcase；店铺屋顶装饰 | 是 / 否 | Blender Generated |
| BH_AR_01<br>突击步枪 | weapons | [GLB](../assets/generated/weapon_assault_rifle_model.glb) / [blend](blender/sources/BH_AR_01.blend) | 1712 | BH_Metal_Dark, BH_Metal_Mid, BH_Plastic_Dark, BH_Safety_Yellow, BH_Warm_Orange | 0 Box→Convex；宿主提供 | Art Showcase；资产库待复用 | 是 / 否 | Blender Generated |
| BH_AbandonedCar_01<br>弃置轿车 | vehicles | [GLB](../assets/generated/vehicle_abandoned_sedan_model.glb) / [blend](blender/sources/BH_AbandonedCar_01.blend) | 3540 | BH_Concrete_Dark, BH_Emergency_Red, BH_Emission_Warm, BH_Glass, BH_Metal_Dark, BH_Metal_Mid, BH_Muted_Green, BH_Plastic_Dark, BH_Plastic_Light, BH_Safety_Yellow | 1 Box→Convex | Art Showcase；东岸旧街 car_west | 是 / 否 | Blender Generated |
| BH_Awning<br>雨棚 | modules | [GLB](../assets/generated/environment_awning_model.glb) / [blend](blender/sources/BH_Awning.blend) | 272 | BH_Metal_Dark, BH_Muted_Green | 1 Box→Convex | Art Showcase；资产库待复用 | 是 / 否 | Blender Generated |
| BH_Barricade_Metal<br>金属拒马 | props | [GLB](../assets/generated/environment_barricade_metal_model.glb) / [blend](blender/sources/BH_Barricade_Metal.blend) | 460 | BH_Metal_Dark, BH_Metal_Mid, BH_Safety_Yellow | 1 Box→Convex | Art Showcase；资产库待复用 | 是 / 否 | Blender Generated |
| BH_Barrier_Concrete<br>混凝土路障 | props | [GLB](../assets/generated/environment_barrier_concrete_model.glb) / [blend](blender/sources/BH_Barrier_Concrete.blend) | 164 | BH_Concrete_Light, BH_Safety_Yellow | 1 Box→Convex | Art Showcase；资产库待复用 | 是 / 否 | Blender Generated |
| BH_Bench_01<br>长椅 | props | [GLB](../assets/generated/environment_bench_model.glb) / [blend](blender/sources/BH_Bench_01.blend) | 676 | BH_Metal_Dark, BH_Plastic_Light | 1 Box→Convex | Art Showcase；资产库待复用 | 是 / 否 | Blender Generated |
| BH_Building_Pharmacy_01<br>药店 | buildings | [GLB](../assets/generated/environment_building_pharmacy_model.glb) / [blend](blender/sources/BH_Building_Pharmacy_01.blend) | 2640 | BH_Concrete_Dark, BH_Concrete_Light, BH_Emission_Warm, BH_Glass, BH_Metal_Dark, BH_Metal_Mid, BH_Muted_Green, BH_Plastic_Light, BH_Safety_Yellow | 6 Box→Convex | Art Showcase；东岸旧街 pharmacy | 是 / 否 | Blender Generated |
| BH_Building_Supermarket_01<br>超市 | buildings | [GLB](../assets/generated/environment_building_supermarket_model.glb) / [blend](blender/sources/BH_Building_Supermarket_01.blend) | 2836 | BH_Concrete_Dark, BH_Concrete_Light, BH_Emission_Warm, BH_Glass, BH_Metal_Dark, BH_Metal_Mid, BH_Muted_Green, BH_Plastic_Light, BH_Safety_Yellow | 6 Box→Convex | Art Showcase；东岸旧街 corner / market | 是 / 否 | Blender Generated |
| BH_Building_Warehouse_01<br>仓库 | buildings | [GLB](../assets/generated/environment_building_warehouse_model.glb) / [blend](blender/sources/BH_Building_Warehouse_01.blend) | 7656 | BH_Concrete_Dark, BH_Concrete_Light, BH_Glass, BH_Metal_Dark, BH_Metal_Mid, BH_Plastic_Light, BH_Safety_Yellow | 6 Box→Convex | Art Showcase；东岸旧街 garage / depot | 是 / 否 | Blender Generated |
| BH_Car_Hatchback_01<br>两厢车 | vehicles | [GLB](../assets/generated/vehicle_car_hatchback_model.glb) / [blend](blender/sources/BH_Car_Hatchback_01.blend) | 4004 | BH_Concrete_Dark, BH_Emergency_Red, BH_Emission_Warm, BH_Glass, BH_Metal_Dark, BH_Metal_Mid, BH_Plastic_Dark, BH_Plastic_Light | 1 Box→Convex | Art Showcase；资产库待复用 | 是 / 否 | Blender Generated |
| BH_Car_Sedan_01<br>轿车 | vehicles | [GLB](../assets/generated/vehicle_car_sedan_model.glb) / [blend](blender/sources/BH_Car_Sedan_01.blend) | 4004 | BH_Concrete_Dark, BH_Emergency_Red, BH_Emission_Warm, BH_Glass, BH_Metal_Dark, BH_Metal_Mid, BH_Muted_Green, BH_Plastic_Dark, BH_Plastic_Light | 1 Box→Convex | Art Showcase；资产库待复用 | 是 / 否 | Blender Generated |
| BH_Crosswalk<br>斑马线 | roads | [GLB](../assets/generated/environment_crosswalk_model.glb) / [blend](blender/sources/BH_Crosswalk.blend) | 72 | BH_Plastic_Light | 1 Box→Convex | Art Showcase；东岸旧街南侧斑马线 | 是 / 否 | Blender Generated |
| BH_Curb<br>路缘 | roads | [GLB](../assets/generated/environment_curb_model.glb) / [blend](blender/sources/BH_Curb.blend) | 12 | BH_Concrete_Light | 1 Box→Convex | Art Showcase；资产库待复用 | 是 / 否 | Blender Generated |
| BH_Door_Normal<br>普通门 | modules | [GLB](../assets/generated/environment_door_standard_model.glb) / [blend](blender/sources/BH_Door_Normal.blend) | 220 | BH_Metal_Dark, BH_Metal_Mid, BH_Plastic_Light | 1 Box→Convex | Art Showcase；资产库待复用 | 是 / 否 | Blender Generated |
| BH_Door_Shop<br>商店门 | modules | [GLB](../assets/generated/environment_door_shop_model.glb) / [blend](blender/sources/BH_Door_Shop.blend) | 320 | BH_Glass, BH_Metal_Dark, BH_Metal_Mid, BH_Plastic_Light, BH_Safety_Yellow | 1 Box→Convex | Art Showcase；资产库待复用 | 是 / 否 | Blender Generated |
| BH_EvacBus_01<br>蓝时号（兼容 ID） | vehicles | [GLB](../assets/world/vehicles/VEH_BLUE_HOUR.glb) / [Wrapper](../scenes/world/vehicles/veh_blue_hour.tscn) | 29712 | Material_0（源 PBR 贴图） | 1 Box | Camp；外出地图；整备界面；Art Showcase | 否 / 否 | 用户提供 Meshy GLB |
| BH_Fence<br>围栏 | props | [GLB](../assets/generated/environment_fence_model.glb) / [blend](blender/sources/BH_Fence.blend) | 1092 | BH_Concrete_Dark, BH_Metal_Dark, BH_Metal_Mid | 1 Box→Convex | Art Showcase；资产库待复用 | 是 / 否 | Blender Generated |
| BH_Fence_Broken<br>破损围栏 | props | [GLB](../assets/generated/environment_fence_broken_model.glb) / [blend](blender/sources/BH_Fence_Broken.blend) | 1096 | BH_Concrete_Dark, BH_Metal_Dark, BH_Metal_Mid | 2 Box→Convex | Art Showcase；资产库待复用 | 是 / 否 | Blender Generated |
| BH_GarbageBag_Set<br>垃圾袋组 | props | [GLB](../assets/generated/environment_garbage_bags_model.glb) / [blend](blender/sources/BH_GarbageBag_Set.blend) | 336 | BH_Plastic_Dark | 1 Box→Convex | Art Showcase；资产库待复用 | 是 / 否 | Blender Generated |
| BH_Infected_Basic_Placeholder<br>基础感染者占位 | characters | [GLB](../assets/generated/character_infected_basic_model.glb) / [blend](blender/sources/BH_Infected_Basic_Placeholder.blend) | 908 | BH_Concrete_Dark, BH_Concrete_Light, BH_Emergency_Red, BH_Metal_Mid, BH_Muted_Green, BH_Plastic_Dark | 0 Box→Convex；宿主提供 | Art Showcase；资产库待复用 | 是 / 是 | Blender Generated |
| BH_MetalCrate<br>金属箱 | props | [GLB](../assets/generated/environment_metal_crate_model.glb) / [blend](blender/sources/BH_MetalCrate.blend) | 440 | BH_Metal_Dark, BH_Metal_Mid, BH_Plastic_Dark, BH_Plastic_Light | 1 Box→Convex | Art Showcase；资产库待复用 | 是 / 否 | Blender Generated |
| BH_Pallet<br>木托盘 | props | [GLB](../assets/generated/environment_pallet_model.glb) / [blend](blender/sources/BH_Pallet.blend) | 352 | BH_Concrete_Dark, BH_Plastic_Light | 1 Box→Convex | Art Showcase；仓库装卸口装饰 | 是 / 否 | Blender Generated |
| BH_Pistol_01<br>手枪 | weapons | [GLB](../assets/generated/weapon_pistol_model.glb) / [blend](blender/sources/BH_Pistol_01.blend) | 1076 | BH_Metal_Dark, BH_Metal_Mid, BH_Plastic_Dark, BH_Safety_Yellow | 0 Box→Convex；宿主提供 | Art Showcase；幸存者 pistol 装备视觉 | 是 / 否 | Blender Generated |
| BH_RoadSign<br>道路标牌 | props | [GLB](../assets/generated/environment_road_sign_model.glb) / [blend](blender/sources/BH_RoadSign.blend) | 268 | BH_Concrete_Dark, BH_Metal_Mid, BH_Muted_Green, BH_Plastic_Light | 1 Box→Convex | Art Showcase；资产库待复用 | 是 / 否 | Blender Generated |
| BH_Road_Corner<br>转角道路 | roads | [GLB](../assets/generated/environment_road_corner_model.glb) / [blend](blender/sources/BH_Road_Corner.blend) | 132 | BH_Asphalt, BH_Concrete_Dark, BH_Plastic_Light | 1 Box→Convex | Art Showcase；资产库待复用 | 是 / 否 | Blender Generated |
| BH_Road_Cross<br>十字路口 | roads | [GLB](../assets/generated/environment_road_cross_model.glb) / [blend](blender/sources/BH_Road_Cross.blend) | 180 | BH_Asphalt, BH_Concrete_Dark, BH_Plastic_Light | 1 Box→Convex | Art Showcase；东岸旧街路口拼装 | 是 / 否 | Blender Generated |
| BH_Road_Straight<br>直路 | roads | [GLB](../assets/generated/environment_road_straight_model.glb) / [blend](blender/sources/BH_Road_Straight.blend) | 180 | BH_Asphalt, BH_Concrete_Dark, BH_Plastic_Light | 1 Box→Convex | Art Showcase；东岸旧街道路拼装 | 是 / 否 | Blender Generated |
| BH_Road_TJunction<br>丁字路口 | roads | [GLB](../assets/generated/environment_road_tjunction_model.glb) / [blend](blender/sources/BH_Road_TJunction.blend) | 156 | BH_Asphalt, BH_Concrete_Dark, BH_Plastic_Light | 1 Box→Convex | Art Showcase；资产库待复用 | 是 / 否 | Blender Generated |
| BH_Roller_Shutter<br>卷帘门 | modules | [GLB](../assets/generated/environment_roller_shutter_model.glb) / [blend](blender/sources/BH_Roller_Shutter.blend) | 836 | BH_Concrete_Dark, BH_Metal_Dark, BH_Metal_Mid, BH_Plastic_Light | 1 Box→Convex | Art Showcase；资产库待复用 | 是 / 否 | Blender Generated |
| BH_Roof_Edge<br>檐口 | modules | [GLB](../assets/generated/environment_roof_edge_model.glb) / [blend](blender/sources/BH_Roof_Edge.blend) | 88 | BH_Concrete_Light, BH_Metal_Mid | 1 Box→Convex | Art Showcase；资产库待复用 | 是 / 否 | Blender Generated |
| BH_Roof_Flat<br>平屋顶 | modules | [GLB](../assets/generated/environment_roof_flat_model.glb) / [blend](blender/sources/BH_Roof_Flat.blend) | 44 | BH_Concrete_Dark | 1 Box→Convex | Art Showcase；资产库待复用 | 是 / 否 | Blender Generated |
| BH_SMG_01<br>冲锋枪 | weapons | [GLB](../assets/generated/weapon_submachine_gun_model.glb) / [blend](blender/sources/BH_SMG_01.blend) | 1332 | BH_Metal_Dark, BH_Metal_Mid, BH_Plastic_Dark, BH_Safety_Yellow, BH_Warm_Orange | 0 Box→Convex；宿主提供 | Art Showcase；幸存者 smg 装备视觉 | 是 / 否 | Blender Generated |
| BH_Searchable_CarTrunk<br>可搜索后备厢 | searchable | [GLB](../assets/generated/environment_searchable_car_trunk_model.glb) / [blend](blender/sources/BH_Searchable_CarTrunk.blend) | 352 | BH_Emergency_Red, BH_Metal_Mid, BH_Plastic_Dark, BH_Safety_Yellow | 1 Box→Convex | Art Showcase；资产库待复用 | 是 / 否 | Blender Generated |
| BH_Searchable_Crate<br>可搜索物资箱 | searchable | [GLB](../assets/generated/environment_searchable_crate_model.glb) / [blend](blender/sources/BH_Searchable_Crate.blend) | 528 | BH_Metal_Dark, BH_Muted_Green, BH_Plastic_Dark, BH_Safety_Yellow | 1 Box→Convex | Art Showcase；行动物资掉落视觉 | 是 / 否 | Blender Generated |
| BH_Searchable_Dumpster<br>可搜索垃圾柜 | searchable | [GLB](../assets/generated/environment_searchable_dumpster_model.glb) / [blend](blender/sources/BH_Searchable_Dumpster.blend) | 772 | BH_Metal_Dark, BH_Muted_Green, BH_Plastic_Dark, BH_Plastic_Light, BH_Safety_Yellow | 1 Box→Convex | Art Showcase；资产库待复用 | 是 / 否 | Blender Generated |
| BH_Searchable_VendingMachine<br>可搜索售货机 | searchable | [GLB](../assets/generated/environment_searchable_vending_machine_model.glb) / [blend](blender/sources/BH_Searchable_VendingMachine.blend) | 1356 | BH_Glass, BH_Metal_Dark, BH_Metal_Mid, BH_Plastic_Dark, BH_Plastic_Light, BH_Safety_Yellow, BH_Warm_Orange | 1 Box→Convex | Art Showcase；资产库待复用 | 是 / 否 | Blender Generated |
| BH_Shotgun_01<br>霰弹枪 | weapons | [GLB](../assets/generated/weapon_shotgun_model.glb) / [blend](blender/sources/BH_Shotgun_01.blend) | 1540 | BH_Metal_Dark, BH_Metal_Mid, BH_Plastic_Dark, BH_Safety_Yellow, BH_Warm_Orange | 0 Box→Convex；宿主提供 | Art Showcase；幸存者 shotgun 装备视觉 | 是 / 否 | Blender Generated |
| BH_Sidewalk_Corner<br>转角人行道 | roads | [GLB](../assets/generated/environment_sidewalk_corner_model.glb) / [blend](blender/sources/BH_Sidewalk_Corner.blend) | 68 | BH_Concrete_Light | 4 Box→Convex | Art Showcase；资产库待复用 | 是 / 否 | Blender Generated |
| BH_Sidewalk_Straight<br>直人行道 | roads | [GLB](../assets/generated/environment_sidewalk_straight_model.glb) / [blend](blender/sources/BH_Sidewalk_Straight.blend) | 60 | BH_Concrete_Dark, BH_Concrete_Light | 1 Box→Convex | Art Showcase；东岸旧街临街步道 | 是 / 否 | Blender Generated |
| BH_Storefront_Frame<br>店面框架 | modules | [GLB](../assets/generated/environment_storefront_frame_model.glb) / [blend](blender/sources/BH_Storefront_Frame.blend) | 132 | BH_Concrete_Light | 3 Box→Convex | Art Showcase；资产库待复用 | 是 / 否 | Blender Generated |
| BH_StreetLamp_01<br>单臂路灯 | props | [GLB](../assets/generated/environment_street_lamp_single_arm_model.glb) / [blend](blender/sources/BH_StreetLamp_01.blend) | 456 | BH_Emission_Warm, BH_Metal_Dark, BH_Metal_Mid | 1 Box→Convex | Art Showcase；东岸旧街 12 处路灯 | 是 / 否 | Blender Generated |
| BH_StreetLamp_02<br>双臂路灯 | props | [GLB](../assets/generated/environment_street_lamp_double_arm_model.glb) / [blend](blender/sources/BH_StreetLamp_02.blend) | 728 | BH_Emission_Warm, BH_Metal_Dark, BH_Metal_Mid | 1 Box→Convex | Art Showcase；资产库待复用 | 是 / 否 | Blender Generated |
| BH_TrafficCone<br>交通锥 | props | [GLB](../assets/generated/environment_traffic_cone_model.glb) / [blend](blender/sources/BH_TrafficCone.blend) | 228 | BH_Plastic_Dark, BH_Plastic_Light, BH_Warm_Orange | 1 Box→Convex | Art Showcase；资产库待复用 | 是 / 否 | Blender Generated |
| BH_TrashBin_01<br>垃圾桶 | props | [GLB](../assets/generated/environment_trash_bin_model.glb) / [blend](blender/sources/BH_TrashBin_01.blend) | 320 | BH_Metal_Dark, BH_Muted_Green, BH_Plastic_Dark | 1 Box→Convex | Art Showcase；资产库待复用 | 是 / 否 | Blender Generated |
| BH_Van_01<br>面包车 | vehicles | [GLB](../assets/generated/vehicle_van_model.glb) / [blend](blender/sources/BH_Van_01.blend) | 3932 | BH_Emergency_Red, BH_Emission_Warm, BH_Glass, BH_Metal_Dark, BH_Metal_Mid, BH_Plastic_Dark, BH_Plastic_Light, BH_Warm_Orange | 1 Box→Convex | Art Showcase；东岸旧街 van_south / van_north | 是 / 否 | Blender Generated |
| BH_VendingMachine<br>售货机 | props | [GLB](../assets/generated/environment_vending_machine_model.glb) / [blend](blender/sources/BH_VendingMachine.blend) | 1268 | BH_Glass, BH_Metal_Dark, BH_Muted_Green, BH_Plastic_Dark, BH_Plastic_Light, BH_Warm_Orange | 1 Box→Convex | Art Showcase；资产库待复用 | 是 / 否 | Blender Generated |
| BH_Wall_Brick<br>砌块墙 | modules | [GLB](../assets/generated/environment_wall_brick_model.glb) / [blend](blender/sources/BH_Wall_Brick.blend) | 340 | BH_Concrete_Dark, BH_Metal_Mid | 1 Box→Convex | Art Showcase；资产库待复用 | 是 / 否 | Blender Generated |
| BH_Wall_Concrete<br>混凝土墙 | modules | [GLB](../assets/generated/environment_wall_concrete_model.glb) / [blend](blender/sources/BH_Wall_Concrete.blend) | 88 | BH_Concrete_Dark, BH_Concrete_Light | 1 Box→Convex | Art Showcase；资产库待复用 | 是 / 否 | Blender Generated |
| BH_Window_Large<br>大窗 | modules | [GLB](../assets/generated/environment_window_large_model.glb) / [blend](blender/sources/BH_Window_Large.blend) | 320 | BH_Concrete_Light, BH_Emission_Warm, BH_Glass, BH_Metal_Mid | 1 Box→Convex | Art Showcase；资产库待复用 | 是 / 否 | Blender Generated |
| BH_Window_Small<br>小窗 | modules | [GLB](../assets/generated/environment_window_small_model.glb) / [blend](blender/sources/BH_Window_Small.blend) | 320 | BH_Concrete_Light, BH_Emission_Warm, BH_Glass, BH_Metal_Mid | 1 Box→Convex | Art Showcase；资产库待复用 | 是 / 否 | Blender Generated |
| BH_WoodCrate<br>木箱 | props | [GLB](../assets/generated/environment_wood_crate_model.glb) / [blend](blender/sources/BH_WoodCrate.blend) | 476 | BH_Concrete_Dark, BH_Plastic_Light, BH_Warm_Orange | 1 Box→Convex | Art Showcase；仓库装卸口装饰 | 是 / 否 | Blender Generated |

合计：86 个模型，98,272 个渲染三角形。几何预算为上限，简单模块不会为填满预算而增加面数。

## Expedition City Props V1（2026-09-23）

Phase 3B 使用本机 Blender 5.2.1 LTS 真实生成，每项有独立 GLB 与可编辑 `.blend` 源。资产统一使用 `ART_BIBLE` 共享低饱和色板、简化轮廓和克制细节；没有照片贴图。道具不带碰撞、搜索或玩法权重，由 Urban Dressing 宿主负责摆放。实际几何与尺寸来自导出 GLB 统计，尺寸按宽 × 高 × 深（米）。

| Runtime Asset ID | GLB | Blender 源 | tris | 尺寸 | 使用区域 |
|---|---|---|---:|---|---|
| PRP_CITY_001_shop_sign | [GLB](../assets/world/props/city_props_v1/PRP_CITY_001_shop_sign.glb) | [blend](blender/sources/PRP_CITY_001_shop_sign.blend) | 660 | 2.00 × 0.98 × 0.39 | 商业 |
| PRP_CITY_002_ac_unit | [GLB](../assets/world/props/city_props_v1/PRP_CITY_002_ac_unit.glb) | [blend](blender/sources/PRP_CITY_002_ac_unit.blend) | 756 | 1.09 × 0.75 × 0.54 | 住宅/商业立面 |
| PRP_CITY_003_power_pole | [GLB](../assets/world/props/city_props_v1/PRP_CITY_003_power_pole.glb) | [blend](blender/sources/PRP_CITY_003_power_pole.blend) | 848 | 0.73 × 6.11 × 0.40 | 道路 |
| PRP_CITY_004_power_wire_set | [GLB](../assets/world/props/city_props_v1/PRP_CITY_004_power_wire_set.glb) | [blend](blender/sources/PRP_CITY_004_power_wire_set.blend) | 768 | 9.00 × 0.64 × 0.15 | 道路上方 |
| PRP_CITY_005_traffic_light | [GLB](../assets/world/props/city_props_v1/PRP_CITY_005_traffic_light.glb) | [blend](blender/sources/PRP_CITY_005_traffic_light.blend) | 776 | 0.46 × 3.89 × 0.79 | 道路路口 |
| PRP_CITY_006_bus_shelter | [GLB](../assets/world/props/city_props_v1/PRP_CITY_006_bus_shelter.glb) | [blend](blender/sources/PRP_CITY_006_bus_shelter.blend) | 836 | 4.85 × 2.71 × 1.82 | 商业街/路边 |
| PRP_CITY_007_awning | [GLB](../assets/world/props/city_props_v1/PRP_CITY_007_awning.glb) | [blend](blender/sources/PRP_CITY_007_awning.blend) | 596 | 3.40 × 0.66 × 1.27 | 商业立面 |
| PRP_CITY_008_cardboard_stack | [GLB](../assets/world/props/city_props_v1/PRP_CITY_008_cardboard_stack.glb) | [blend](blender/sources/PRP_CITY_008_cardboard_stack.blend) | 396 | 1.31 × 1.14 × 0.68 | 工业街面 |
| PRP_CITY_009_fire_hydrant | [GLB](../assets/world/props/city_props_v1/PRP_CITY_009_fire_hydrant.glb) | [blend](blender/sources/PRP_CITY_009_fire_hydrant.blend) | 904 | 0.60 × 1.03 × 0.54 | 道路边缘 |
| PRP_CITY_010_broken_billboard | [GLB](../assets/world/props/city_props_v1/PRP_CITY_010_broken_billboard.glb) | [blend](blender/sources/PRP_CITY_010_broken_billboard.blend) | 636 | 3.40 × 3.48 × 1.91 | 工业区/路边 |

完整机器清单见 [city_props_v1 manifest](../assets/world/props/city_props_v1/manifest.json)。

## Expedition City Props V2（2026-09-23，Phase 3C）

Blender 5.2.1 LTS 新增 24 个独立低模，每件有可编辑 `.blend` 源和正式 GLB。共享 ART_BIBLE V1 大色块材质，无贴图、碰撞代理、Search 或玩法权重。单件 124–916 tris，合计 10,340 tris；尺寸为导出 GLB 实测宽 × 高 × 深（米）。

| Runtime Asset ID | GLB | Blender 源 | tris | 尺寸 | 区域 |
|---|---|---|---:|---|---|
| PRP_CITY_011_planter_box_pair | [GLB](../assets/world/props/city_props_v2/PRP_CITY_011_planter_box_pair.glb) | [blend](blender/sources/PRP_CITY_011_planter_box_pair.blend) | 424 | 1.52 × 0.89 × 0.50 | 住宅/庭院 |
| PRP_CITY_012_neighborhood_notice_board | [GLB](../assets/world/props/city_props_v2/PRP_CITY_012_neighborhood_notice_board.glb) | [blend](blender/sources/PRP_CITY_012_neighborhood_notice_board.blend) | 352 | 1.22 × 1.68 × 0.24 | 住宅 |
| PRP_CITY_013_recycling_bin_pair | [GLB](../assets/world/props/city_props_v2/PRP_CITY_013_recycling_bin_pair.glb) | [blend](blender/sources/PRP_CITY_013_recycling_bin_pair.blend) | 264 | 1.04 × 0.84 × 0.60 | 住宅/商业 |
| PRP_CITY_014_delivery_lockbox | [GLB](../assets/world/props/city_props_v2/PRP_CITY_014_delivery_lockbox.glb) | [blend](blender/sources/PRP_CITY_014_delivery_lockbox.blend) | 292 | 0.67 × 0.82 × 0.58 | 住宅 |
| PRP_CITY_015_garden_tool_cart | [GLB](../assets/world/props/city_props_v2/PRP_CITY_015_garden_tool_cart.glb) | [blend](blender/sources/PRP_CITY_015_garden_tool_cart.blend) | 592 | 1.04 × 0.86 × 0.70 | 住宅/庭院 |
| PRP_CITY_016_storefront_menu_stand | [GLB](../assets/world/props/city_props_v2/PRP_CITY_016_storefront_menu_stand.glb) | [blend](blender/sources/PRP_CITY_016_storefront_menu_stand.blend) | 448 | 0.58 × 1.02 × 0.32 | 商业店前 |
| PRP_CITY_017_beverage_crate_stack | [GLB](../assets/world/props/city_props_v2/PRP_CITY_017_beverage_crate_stack.glb) | [blend](blender/sources/PRP_CITY_017_beverage_crate_stack.blend) | 528 | 1.04 × 0.84 × 0.53 | 商业店前 |
| PRP_CITY_018_delivery_handcart | [GLB](../assets/world/props/city_props_v2/PRP_CITY_018_delivery_handcart.glb) | [blend](blender/sources/PRP_CITY_018_delivery_handcart.blend) | 548 | 0.86 × 0.97 × 0.78 | 商业/工业 |
| PRP_CITY_019_sidewalk_banner_stand | [GLB](../assets/world/props/city_props_v2/PRP_CITY_019_sidewalk_banner_stand.glb) | [blend](blender/sources/PRP_CITY_019_sidewalk_banner_stand.blend) | 356 | 0.86 × 1.78 × 0.50 | 商业店前 |
| PRP_CITY_020_storefront_flag_pair | [GLB](../assets/world/props/city_props_v2/PRP_CITY_020_storefront_flag_pair.glb) | [blend](blender/sources/PRP_CITY_020_storefront_flag_pair.blend) | 404 | 1.10 × 1.16 × 0.20 | 商业立面 |
| PRP_CITY_021_street_bollard_set | [GLB](../assets/world/props/city_props_v2/PRP_CITY_021_street_bollard_set.glb) | [blend](blender/sources/PRP_CITY_021_street_bollard_set.blend) | 828 | 1.08 × 0.71 × 0.34 | 道路边缘 |
| PRP_CITY_022_utility_cabinet | [GLB](../assets/world/props/city_props_v2/PRP_CITY_022_utility_cabinet.glb) | [blend](blender/sources/PRP_CITY_022_utility_cabinet.blend) | 308 | 0.68 × 1.03 × 0.58 | 道路边缘 |
| PRP_CITY_023_guardrail_segment | [GLB](../assets/world/props/city_props_v2/PRP_CITY_023_guardrail_segment.glb) | [blend](blender/sources/PRP_CITY_023_guardrail_segment.blend) | 264 | 2.35 × 0.80 × 0.22 | 道路边缘 |
| PRP_CITY_024_bicycle_parking_rack | [GLB](../assets/world/props/city_props_v2/PRP_CITY_024_bicycle_parking_rack.glb) | [blend](blender/sources/PRP_CITY_024_bicycle_parking_rack.blend) | 916 | 1.48 × 0.61 × 0.30 | 道路/住宅 |
| PRP_CITY_025_bus_stop_post | [GLB](../assets/world/props/city_props_v2/PRP_CITY_025_bus_stop_post.glb) | [blend](blender/sources/PRP_CITY_025_bus_stop_post.blend) | 220 | 0.44 × 2.08 × 0.30 | 道路/Arrival |
| PRP_CITY_026_fallen_market_sign | [GLB](../assets/world/props/city_props_v2/PRP_CITY_026_fallen_market_sign.glb) | [blend](blender/sources/PRP_CITY_026_fallen_market_sign.blend) | 316 | 1.25 × 0.82 × 0.66 | 轻灾后/商业 |
| PRP_CITY_027_cloth_tarp_bundle | [GLB](../assets/world/props/city_props_v2/PRP_CITY_027_cloth_tarp_bundle.glb) | [blend](blender/sources/PRP_CITY_027_cloth_tarp_bundle.blend) | 264 | 1.18 × 0.48 × 0.92 | 轻灾后/工业 |
| PRP_CITY_028_scattered_box_debris | [GLB](../assets/world/props/city_props_v2/PRP_CITY_028_scattered_box_debris.glb) | [blend](blender/sources/PRP_CITY_028_scattered_box_debris.blend) | 308 | 1.04 × 0.28 × 0.68 | 轻灾后/工业 |
| PRP_CITY_029_broken_fence_section | [GLB](../assets/world/props/city_props_v2/PRP_CITY_029_broken_fence_section.glb) | [blend](blender/sources/PRP_CITY_029_broken_fence_section.blend) | 352 | 1.95 × 1.02 × 0.20 | 轻灾后/住宅 |
| PRP_CITY_030_roadside_grass_patch | [GLB](../assets/world/props/city_props_v2/PRP_CITY_030_roadside_grass_patch.glb) | [blend](blender/sources/PRP_CITY_030_roadside_grass_patch.blend) | 504 | 1.34 × 0.37 × 0.94 | 植被/道路边缘 |
| PRP_CITY_031_small_bush_cluster | [GLB](../assets/world/props/city_props_v2/PRP_CITY_031_small_bush_cluster.glb) | [blend](blender/sources/PRP_CITY_031_small_bush_cluster.blend) | 124 | 1.43 × 0.94 × 0.91 | 植被/住宅 |
| PRP_CITY_032_neglected_planter | [GLB](../assets/world/props/city_props_v2/PRP_CITY_032_neglected_planter.glb) | [blend](blender/sources/PRP_CITY_032_neglected_planter.blend) | 536 | 1.07 × 0.87 × 0.71 | 植被/住宅 |
| PRP_CITY_033_small_vine_patch | [GLB](../assets/world/props/city_props_v2/PRP_CITY_033_small_vine_patch.glb) | [blend](blender/sources/PRP_CITY_033_small_vine_patch.blend) | 604 | 1.00 × 0.98 × 0.17 | 植被/立面 |
| PRP_CITY_034_umbrella_stand | [GLB](../assets/world/props/city_props_v2/PRP_CITY_034_umbrella_stand.glb) | [blend](blender/sources/PRP_CITY_034_umbrella_stand.blend) | 588 | 0.62 × 1.46 × 0.62 | 住宅/商业 |

完整来源、SHA-256、尺寸和材质清单见 [Phase 3C manifest](../assets/world/props/city_props_v2/manifest.json)。

## 0.4 基地复用

`data/shelter_layout.tres` 组合既有仓库、归航巴士、金属箱、托盘、单臂路灯与交通锥；`ui/shelter_view.gd` 采用原尺寸实例化，未新建或重新导出 GLB。角色仍沿用当前占位表现与已有装备模型。基地为独立准备场景，点选对应本轮成员，不参与城区导航和搜索规则。

## 正式蓝时号

Camp Visual Polish Pass 02 通过 `camp/camp_dressing.gd` 额外复用 `BH_Bench_01`（2 张，等比 0.72）、`BH_WoodCrate`（生活区 0.68 / 外围 0.72）、`BH_MetalCrate`（工坊 0.72 / 生活区 0.64 / 外围 0.48）与 `BH_Pallet`（生活区 0.68）。这些是原模型的营地装配缩放，不改 GLB 和源比例；不新增模型种类。实例只贡献静态视觉，碰撞与交互继续由既有营地根持有；渲染网格按营地共享色板合并。棚架、窗框与桌面是原场景的轻量规则几何补足。详见 [Pass 02 报告](../docs/CAMP_VISUAL_POLISH_PASS_02_REPORT.md)。

新版蓝时号唯一入口为 `scenes/world/vehicles/veh_blue_hour.tscn`，旧 `BH_EvacBus_01` 仅保留为兼容资源 ID。源 GLB 字节、原始比例和 Scale=1 保持不变；Visual 内绕 Y 旋转 +90°，将源 -X 车头对齐项目 +Z，平移至地面投影中心。车轮、车门与灯面合并在一个 Mesh 中；后续物理动画需要拆分。旧 Blender 源和生成函数只作历史来源保留，常规车辆批次不再生成旧蓝时号。详见[替换验收报告](../docs/BLUE_HOUR_VEHICLE_REPORT.md)。


## 正式装备武器（Phase 2A）

这三把独立于旧 generated 展示库，运行时来自 WeaponDefinition.model_path，跟随双角色 RightHand；无碰撞，比例为 1 米制。详见 [武器模型报告](../docs/WEAPON_VISUALS.md)。

| 对象 | 正式 GLB | Blender 源 | tris |
| --- | --- | --- | ---: |
| 拓荒短刀 | [GLB](../assets/weapons/models/wpn_001_survival_knife.glb) | [blend](blender/weapons/wpn_001_survival_knife.blend) | 848 |
| P9 | [GLB](../assets/weapons/models/wpn_002_p9_pistol.glb) | [blend](blender/weapons/wpn_002_p9_pistol.blend) | 1,520 |
| A21 | [GLB](../assets/weapons/models/wpn_006_a21_assault_rifle.glb) | [blend](blender/weapons/wpn_006_a21_assault_rifle.blend) | 2,524 |

## Environment Asset Batch 01（2026-09-18）

用户提供的四件带贴图 Meshy GLB 已进入 World Runtime；源字节不变，单位缩放、简单碰撞及 Marker 齐全，全部不可搜索。2026-09-18 用户确认四件人工 Asset QA = PASS；2026-09-19 用户确认 M02 Human Visual QA = PASS。独立 M02 Placement Pass 已在冻结 M01.1 之后按用途标签摆放，未改变通用生成权重、资产或既有生成器。规格与源路径见 [接入报告](../docs/ENVIRONMENT_STREET_ASSET_REPORT.md)，分布、验证和截图见 [M02 报告](../docs/MEDIUM_TOWN_TARGETED_PROPS_REPORT.md)。

| Runtime Asset ID | tris / verts | Runtime 尺寸 cm（宽×高×深） | Wrapper |
|---|---:|---|---|
| PRP_Utility_Pole_A | 5,018 / 4,989 | 216.47×850×219.83 | [Scene](../scenes/world/props/street/PRP_Utility_Pole_A.tscn) |
| PRP_Parking_Sign_A | 2,624 / 2,678 | 47.55×250×30.52 | [Scene](../scenes/world/props/street/PRP_Parking_Sign_A.tscn) |
| PRP_Storefront_AFrame_Sign_A | 3,914 / 4,213 | 60.74×105×52.60 | [Scene](../scenes/world/props/street/PRP_Storefront_AFrame_Sign_A.tscn) |
| PRP_Bicycle_A | 12,152 / 11,913 | 76.85×105×169.84 | [Scene](../scenes/world/props/street/PRP_Bicycle_A.tscn) |

2026-09-19 后续 Ground Contract 修复：双角色地面门禁 PASS。Actor World Y 与 Ground VFX 共用正式地表三角形查询；静态鞋底误差约 1.5–4.1mm。模型、Rig、Skin、公共动画未变。此前固定导航高度造成的 FAIL 已关闭，三人长途让行的既有失败另行记录，见[地面合同报告](../docs/EXPEDITION_GROUND_CONTRACT_REPORT.md)。
