# Environment Asset Reuse Audit

2026-09-17。**Environment Asset Reuse Audit: COMPLETE**。本轮只审计，未执行 Runtime Integration Batch、Environment M01、模型生产或 Props Distribution。

结论：P0 长椅、托盘、木箱、金属箱都有合格的现有几何，优先补 wrapper 和轻量材质 / 碰撞调整。住宅低栏可以复用营地组合；开放入口由两段低栏留空实现。道路方向牌、普通售货机、营地花箱也有复用价值。专用停车牌与独立店外展示牌仍无合格现成候选。

18 个实物 / 组合候选：**REUSE_READY 1、REUSE_WITH_MINOR_FIX 11、REUSE_WITH_REWORK 1、REJECT 5**。另有 **MISSING 2 类需求**。唯一 READY 是已经接入 M00 的工业 Chainlink，不代表它可填补住宅低栏缺口。视觉判断来自独立 QA 图，最终风格选择仍由人工确认。

## 证据与范围

扫描了 `assets/`、`assets/generated/`、`scenes/camp/props/`、`scenes/world/`、Camp 装饰代码、旧展示与测试脚本。当前 Blue Hour 中没有独立 `legacy/` 目录。UI 的 board / crates 图片、工具工作台、建筑自身牌面不作为独立环境道具候选；未将无关 Camp Prop 塞入商业街。

独立审计入口：[environment_asset_reuse.gd](../tests/environment_asset_reuse.gd)。只加载现有 GLB / wrapper，或调用既有 `camp_dressing.gd` 的 `_boundary_fences` / `_planter` 组合函数。围栏仅提取原 4.5 米段，排除营地入口专属的两个琥珀反光片；开放入口是两份该段之间留 2 米空隙。没有导出新 GLB、生成贴图或修改源模型。

原生 Godot Compatibility / RTX 3060，1280×720。每个候选输出正面、3/4 和 1.70 米尺标参照图，共 **54 张原图 + 9 张总览图**。光照沿用 M00 日光参数；材质保持资产当前状态。Front 使用中性背景，3/4 与尺度图保留接地阴影。取景检查覆盖包围盒与尺标，非空检查对比同机位显示 / 隐藏资产后的像素差。

| 优先级 | Front | 3/4 View | Scale Reference |
| --- | --- | --- | --- |
| P0 | [正面](../test-output/environment-asset-reuse-audit/P0_front_sheet.png) | [3/4](../test-output/environment-asset-reuse-audit/P0_quarter_sheet.png) | [1.70m 尺标](../test-output/environment-asset-reuse-audit/P0_scale_sheet.png) |
| P1 | [正面](../test-output/environment-asset-reuse-audit/P1_front_sheet.png) | [3/4](../test-output/environment-asset-reuse-audit/P1_quarter_sheet.png) | [1.70m 尺标](../test-output/environment-asset-reuse-audit/P1_scale_sheet.png) |
| P2 | [正面](../test-output/environment-asset-reuse-audit/P2_front_sheet.png) | [3/4](../test-output/environment-asset-reuse-audit/P2_quarter_sheet.png) | [1.70m 尺标](../test-output/environment-asset-reuse-audit/P2_scale_sheet.png) |

每个候选原图在同目录，以 `<候选 ID>_front.png`、`_quarter.png`、`_scale.png` 命名。[完整测量 JSON](../test-output/environment-asset-reuse-audit/runtime-audit.json) 包含层级 Mesh、局部 Transform、Bounds、碰撞、Marker、Catalog、材质、贴图分辨率及逐图取景检查。

## 总表：P0

Size 为 Godot 宽 X × 高 Y × 深 Z，单位米。Runtime Ready 指能否直接走当前 World Catalog；所有列出的源件均已成功独立实例化。Minor Fix 是后续计划，本轮未执行。

| Category | Asset Path | Status | Size | Tris | Materials | Runtime Ready | Minor Fix | Visual Fit | Recommendation |
| --- | --- | --- | --- | ---: | ---: | --- | --- | --- | --- |
| Park Bench | [environment_bench_model.glb](../assets/generated/environment_bench_model.glb) | REUSE_WITH_MINOR_FIX | 1.800×0.887×0.619 | 676 | 2 | 否，缺 World wrapper | wrapper、前向、白色压亮 | 俯视轮廓清楚；白板偏亮，非过写实 | 优先复用，保留 1 倍尺度 |
| Pallet | [environment_pallet_model.glb](../assets/generated/environment_pallet_model.glb) | REUSE_WITH_MINOR_FIX | 1.200×0.168×0.950 | 352 | 2 | 否，缺 World wrapper | wrapper、板面暖灰参数 | 板条和支脚可读；当前更像白色塑料托盘 | 优先复用，可与箱体组合 |
| Wood Crate | [environment_wood_crate_model.glb](../assets/generated/environment_wood_crate_model.glb) | REUSE_WITH_MINOR_FIX | 0.945×0.850×0.934 | 476 | 3 | 否，缺 World wrapper | wrapper、降低橙色、校准碰撞高度 | 斜撑能识别木箱；高亮白橙与 Town 不完全一致 | 优先复用，不需要新增木纹贴图 |
| Metal Crate | [environment_metal_crate_model.glb](../assets/generated/environment_metal_crate_model.glb) | REUSE_WITH_MINOR_FIX | 0.955×0.935×0.930 | 440 | 4 | 否，缺 World wrapper | wrapper、原点微调、碰撞校准 | 蓝灰形体干净，和 Town 工业建筑较兼容 | 优先复用，可叠放 |
| Supply Crate 替代 | [environment_searchable_crate_model.glb](../assets/generated/environment_searchable_crate_model.glb) | REUSE_WITH_MINOR_FIX | 1.255×0.818×0.930 | 528 | 4 | 否；已有掉落视觉消费 | wrapper、黄色材质弱化 | 形体合适，黄色顶标与扣锁带搜索暗示 | 后备，不增加 Loot / Search 逻辑 |

## 总表：P1

REJECT 在这里指不用于本轮指定的住宅边界 / 标识缺口，不代表删除资产或否定原工业用途。

| Category | Asset Path | Status | Size | Tris | Materials | Runtime Ready | Minor Fix | Visual Fit | Recommendation |
| --- | --- | --- | --- | ---: | ---: | --- | --- | --- | --- |
| 旧完整铁栏 | [environment_fence_model.glb](../assets/generated/environment_fence_model.glb) | REJECT | 3.300×1.990×0.320 | 1092 | 3 | 仅旧 manifest | 不执行 | 高竖杆与黑色栏条偏封锁设施 | 不缩成住宅低栏 |
| 旧破损铁栏 | [environment_fence_broken_model.glb](../assets/generated/environment_fence_broken_model.glb) | REJECT | 3.300×1.990×0.606 | 1096 | 3 | 仅旧 manifest | 不执行 | 破口与倾斜杆强调灾后封锁 | 不当住宅开放入口 |
| Road Direction Sign | [environment_road_sign_model.glb](../assets/generated/environment_road_sign_model.glb) | REUSE_WITH_MINOR_FIX | 1.250×2.470×0.320 | 268 | 4 | 否，缺 World wrapper | wrapper、朝向 Marker | 低饱和绿、轮廓可读；仅固定方向箭头 | 可用于路口 / 商业 / Service 指向 |
| 混凝土路障 | [environment_barrier_concrete_model.glb](../assets/generated/environment_barrier_concrete_model.glb) | REJECT | 2.400×0.950×0.800 | 164 | 2 | 仅旧 manifest | 不执行 | 临时交通隔离语义，不是庭院边界 | 保留旧用途，不填住宅缺口 |
| 金属拒马 | [environment_barricade_metal_model.glb](../assets/generated/environment_barricade_metal_model.glb) | REJECT | 2.100×1.079×0.863 | 460 | 3 | 仅旧 manifest | 不执行 | 黄黑施工警戒语义强 | 不充当低栏、门或停车牌 |
| 工业 Chainlink 对照 | [barrier_chainlink.tscn](../scenes/world/barriers/barrier_chainlink.tscn) | REUSE_READY | 4.000×1.800×0.070 | 50 | 2 | 是，BAR_001 | 无 | 工业适合；住宅不合适 | 保留既有工业用途，不重复接入 |
| 破损 Chainlink | [barrier_chainlink_damaged.tscn](../scenes/world/barriers/barrier_chainlink_damaged.tscn) | REJECT | 3.484×1.800×0.093 | 8462 | 1 | 有 wrapper，无独立 Catalog 条目 | 不执行 | 细网、破损和 PBR 杂讯显著，远景收益低 | 不引入住宅；保留历史资源 |
| Residential Low Fence | [camp_dressing.gd::_boundary_fences](../camp/camp_dressing.gd:155) | REUSE_WITH_MINOR_FIX | 4.760×1.008×0.260 | 204 | 4 | 目前依赖 Camp 装配 | 提取既有段、独立碰撞和端点 Marker | 约 1 米高，宽横梁和少量钢带可读 | 住宅低栏首选；不是新建模型 |
| Residential Open Entry | [同一低栏组合](../camp/camp_dressing.gd:155) | REUSE_WITH_MINOR_FIX | 11.520×1.008×0.260 | 408 | 4 | QA 两段组合，非独立 Runtime | 两段低栏、2 米净空，分别碰撞 | 明确的开放入口；没有门扇 | 复用同一低栏 ID 两次，不新增门模型 |
| Parking Sign | 无合格独立牌候选 | MISSING | — | — | — | 否 | 不执行 | 方向箭头不具有停车 P 标识语义 | 仅记录缺口，后续决定改造还是制作 |

方向牌是一个 Render Mesh 内的杆、箭头面和装饰横条；不是多块牌可拆换的模块。源正面朝 +Z，箭头几何指向本地 +X；整体转向会同时改变读牌方向和箭头方向。不能把任意旋转或翻面当作独立左右箭头变体，更不能直接充当 Parking Sign。

低栏的 4.760 米外包围宽包含柱脚，原水平梁长 4.5 米。QA 入口两段中心距 6.760 米，净空 2 米。该组合用于验证复用可能，不表示所有住宅都需要 11.52 米总宽。正式采用时应先按可用边界选段；窄地块无法容纳就跳过，不改变 Parcel，也不横向压缩源件。

## 总表：P2

| Category | Asset Path | Status | Size | Tris | Materials | Runtime Ready | Minor Fix | Visual Fit | Recommendation |
| --- | --- | --- | --- | ---: | ---: | --- | --- | --- | --- |
| Commercial Vending | [environment_vending_machine_model.glb](../assets/generated/environment_vending_machine_model.glb) | REUSE_WITH_MINOR_FIX | 0.980×1.840×0.812 | 1268 | 6 | 否，缺 World wrapper | wrapper、弱化白色面 | 独立售货机可辨，风格简洁；不是无关 Camp 工具 | 商业侧面少量使用 |
| Vending 替代 | [environment_searchable_vending_machine_model.glb](../assets/generated/environment_searchable_vending_machine_model.glb) | REUSE_WITH_MINOR_FIX | 0.985×1.840×0.812 | 1356 | 7 | 否，缺 World wrapper | wrapper、黄色扣锁调色 | 与普通版近似，黄色部件暗示搜索 | 后备，首批权重 0，不重复扩种 |
| Camp Notice Board | [CAMP_PROP_003_notice_board.tscn](../scenes/camp/props/CAMP_PROP_003_notice_board.tscn) | REUSE_WITH_REWORK | 1.800×1.950×0.350 | 7272 | 1 | Camp 可用，World 未登记 | 不是 minor：需替换地图 / 文案贴图 | 战术地图、密集纸面和细节属于营地信息设施 | 不冒充店外牌；本轮不改贴图 |
| Commercial Planter | [camp_dressing.gd::_planter](../camp/camp_dressing.gd:149) | REUSE_WITH_MINOR_FIX | 0.845×0.596×0.507 | 396 | 5 | 当前仅 Camp 组合 | 提取原组合、容器碰撞、材质压亮 | 小型木箱花草可辨；叶片较几何化，适合小剂量 | 可补商业门侧，不把它当大花坛 |
| 店外牌 / 小展示牌 | 无合格独立候选 | MISSING | — | — | — | 否 | 不执行 | 营地地图板和固定箭头牌均不等价 | 记录为可选缺口，不因缺少而扩大生产 |

## 实测 Geometry / Transform / Runtime

下表数字来自 Godot 实际导入后的 Render Mesh，排除碰撞代理；Vertex 是 surface 顶点数组长度，包含 UV / 法线拆分。Materials 是实际使用的唯一材质资源数量，不沿用旧清单中可能包含未使用材质的数量。

| 候选 ID | Vertices | Meshes | Textures / Resolution | 现有碰撞 | Marker |
| --- | ---: | ---: | --- | --- | ---: |
| BH_Bench_01 | 1446 | 1 | 0，纯色共享材质 | 1 Convex | 0 |
| BH_Pallet | 768 | 1 | 0 | 1 Convex | 0 |
| BH_WoodCrate | 1012 | 1 | 0 | 1 Convex，高约 0.95m，超过视觉顶面 | 0 |
| BH_MetalCrate | 960 | 1 | 0 | 1 Convex | 0 |
| BH_Searchable_Crate | 1152 | 1 | 0 | 1 Convex | 0 |
| BH_Fence | 2328 | 1 | 0 | 1 Convex | 0 |
| BH_Fence_Broken | 2461 | 1 | 0 | 2 Convex | 0 |
| BH_RoadSign | 542 | 1 | 0 | 1 Convex，杆体代理 | 0 |
| BH_Barrier_Concrete | 344 | 1 | 0 | 1 Convex | 0 |
| BH_Barricade_Metal | 968 | 1 | 0 | 1 Convex | 0 |
| BAR_001_chainlink_fence | 100 | 5 | 0，网面 Shader | 1 Box | 7 |
| chainlink_damaged | 15799 | 1 | 3×2048² | 1 Box | 5 |
| camp_low_fence | 408 | 4 | 0 | 视觉组合无自有碰撞 | 0 |
| camp_open_entry | 816 | 8 | 0 | 两段视觉组合无自有碰撞 | 0 |
| BH_VendingMachine | 2688 | 1 | 0 | 1 Convex | 0 |
| BH_Searchable_VendingMachine | 2880 | 1 | 0 | 1 Convex | 0 |
| CAMP_PROP_003_notice_board | 7085 | 1 | 3×2048² | wrapper 1 Box | 0 |
| camp_planter | 464 | 5 | 0 | 视觉组合无自有碰撞 | 0 |

所有实例根为 identity、Scale=(1,1,1)，导入后 +Y 向上。生成套件有正面语义的长椅、箱扣、售货机和箭头牌均通过正视图确认源 +Z 为正面；托盘和双面栏没有必须使用的正面。World wrapper 契约使用 -Z，未来旋转只施加在 ModelRoot；现有工业 Chainlink 保留当前契约。

各候选底面接近 y=0；金属拒马视觉最低点约 +0.02m，是旧几何脚端倒角留下的微小离地，不借此修模。部分几何中心与源 pivot 有数厘米差异：Bench Z=-0.0445、Wood Crate Z=+0.0100、Metal / Supply Crate Z=+0.0175、RoadSign X=+0.0250、Vending Z=+0.0460。均可在 wrapper 中以完整 Bounds 做水平居中，详见 JSON 精确值。

Camp Notice Board 的根是 identity，但内部 Model 已非等比缩放 `(0.9012,1,0.4032)`；这是现有 wrapper 的状态，不是本次纠正。Camp Low Fence 的原宿主碰撞来自 `camp_main.tscn` 的 4.5×0.45×0.35m BoundaryBlockout，并不覆盖 1.008m 的完整视觉高度；独立化时必须重新明确碰撞归属。花箱目前没有独立碰撞。审核脚本未把宿主碰撞伪装成独立资源已就绪。

## 来源、引用与注册

| 候选 | Source Category | Used Anywhere? | Current Runtime Wrapper? | Current Catalog Registration? |
| --- | --- | --- | --- | --- |
| Bench / Pallet / WoodCrate / MetalCrate | 本项目旧 Blender 程序套件 | `camp_dressing.gd` 实际调用；Pallet / MetalCrate 还用于 `shelter_layout.tres`；旧展厅动态载入 | 无专用 World wrapper，旧 `GeneratedAssets.spawn` 可加载 | 旧 manifest 有，World Catalog 无 |
| Searchable_Crate | 同上 | `vfx/visuals.gd` 的掉落视觉；旧展厅 | 无专用 World wrapper | 旧 manifest 有，World 无 |
| Fence / Fence_Broken / RoadSign / Barrier_Concrete / Barricade_Metal | 同上 | 当前可确认旧 Art Showcase / 资产测试动态遍历；没有找到现行 Town 分布调用 | 无专用 World wrapper | 旧 manifest 有，World 无 |
| VendingMachine / Searchable_VendingMachine | 同上 | 旧 Art Showcase / 资产测试；没有找到正式 Town 摆放 | 无专用 World wrapper | 旧 manifest 有，World 无 |
| 工业 Chainlink | 当前 World 规则 Mesh | M00 与 World 场景 | `scenes/world/barriers/barrier_chainlink.tscn` | World `BAR_001_chainlink_fence` |
| 破损 Chainlink | 保留的用户来源 GLB | 保留 wrapper；未发现当前 Catalog 消费 | `barrier_chainlink_damaged.tscn` 引用 `assets/world/barriers/barrier_chainlink_source_model.glb` | 无独立条目；wrapper 内仍声明 BAR_001，不能不检查就注册为另一资产 |
| Camp Low Fence | 现有 Godot 规则组合 | `camp_dressing.gd::_boundary_fences` | 无独立 scene，依赖 Camp 原边界 | 无独立 Catalog |
| Camp Open Entry | 已有低栏的两段组合 | Camp 边界保留缺口；本轮 QA 显式展示 2m 开口 | 无独立 gate scene / 门扇 | 无；建议仍引用 Low Fence 两次 |
| Camp Planter | 现有 Godot 规则组合 | `camp_dressing.gd::_main_entry` 调用 `_planter` | 无独立 scene | 无独立 Catalog |
| Camp Notice Board | 用户提供的 Camp GLB | `camp_dressing.gd::_main_entry` | 已有 Camp wrapper，原 GLB 位于 `assets/world/props/camp/` | 旧 manifest 的 CAMP_PROP_003 条目有，World 无 |

没有把历史 manifest 的 `used_in` 文案等同于现行地图引用。脚本、GLB 和 wrapper 的实际引用均已交叉核对。

## 最小 Runtime Integration Plan（未执行）

下面编号已核对当前 World Catalog：PRP 仅有 001 路灯、002 垃圾桶；BAR 仅有 001 Chainlink。拟用编号尚未注册、也未预留；实施前仍需再核对并行改动。路径是计划路径，不是本轮已创建文件。

所有新 wrapper Root 保持 identity。下表 Scale / Rotation 指 ModelRoot；有正面的旧套件建议 Y=180° 转为 World -Z，实际 scene 再用 FrontMarker 验收；方向中性的对象为 0°。所有纯装饰条目 `searchable=false`，不新增拾取、敌人、Loot 或搜索系统。Spawn Weight 只表达同类别相对权重，不是数量目标或本轮已启用概率。

| 候选 | Target Catalog ID | Runtime Scene Path（res://） | Wrapper Needed? | Collision Needed? | Scale / Y Rotation | Placement Category | Allowed Land Use | Spawn Weight |
| --- | --- | --- | --- | --- | --- | --- | --- | ---: |
| Bench | PRP_003_park_bench | scenes/world/props/park/park_bench.tscn | 是 | 保留单简单代理，避免双碰撞 | 1 / 180° | PARK / COMMUNITY_GREEN | OPEN_SPACE | 1.0 |
| Pallet | PRP_004_pallet | scenes/world/props/industrial/pallet.tscn | 是 | 单 Box，高度按实测约 0.168m | 1 / 0° | LOADING_YARD / SERVICE_YARD | INDUSTRIAL_SERVICE / MIXED_TRANSITION | 1.0 |
| WoodCrate | PRP_005_wood_crate | scenes/world/props/industrial/wood_crate.tscn | 是 | 将旧代理校准为视觉实体，尤其高度 | 1 / 180° | LOADING_YARD / SERVICE_YARD | INDUSTRIAL_SERVICE / MIXED_TRANSITION | 1.0 |
| MetalCrate | PRP_006_metal_crate | scenes/world/props/industrial/metal_crate.tscn | 是 | 一个简单 Box / Convex | 1 / 180° | LOADING_YARD / SERVICE_YARD | INDUSTRIAL_SERVICE / MIXED_TRANSITION | 0.8 |
| SupplyCrate 替代 | PRP_007_supply_crate | scenes/world/props/industrial/supply_crate.tscn | 是 | 一个简单 Box / Convex | 1 / 180° | SERVICE_YARD | INDUSTRIAL_SERVICE / MIXED_TRANSITION | 0.15，后备 |
| DirectionSign | PRP_008_direction_sign | scenes/world/props/street/direction_sign.tscn | 是 | 保留杆体代理，显示包围盒仍覆盖牌面 | 1 / 180° | STREET_EDGE / COMMERCIAL_SIDE | COMMERCIAL_CORE / INDUSTRIAL_SERVICE / MIXED_TRANSITION | 0.5 |
| LowFence | BAR_002_residential_low_fence | scenes/world/barriers/residential_low_fence.tscn | 是，提取原组合 | 每段一个约 4.76×1.01×0.26m Box | 1 / 0° | RESIDENTIAL_YARD / RESIDENTIAL_BUFFER | RESIDENTIAL_A / RESIDENTIAL_B | 0.6 |
| OpenEntry | 复用 BAR_002 两次，不增 ID | 同 residential_low_fence.tscn ×2 | 不增 gate wrapper | 两段各自碰撞；中间 2m 不设碰撞 | 1 / 0°，随边界整体转向 | RESIDENTIAL_YARD | RESIDENTIAL_A / RESIDENTIAL_B | 0.3 组合权重 |
| VendingMachine | PRP_009_vending_machine | scenes/world/props/street/vending_machine.tscn | 是 | 复用单代理 | 1 / 180° | COMMERCIAL_SIDE | COMMERCIAL_CORE / MIXED_TRANSITION | 0.25 |
| Vending 替代 | PRP_010_vending_machine_service | scenes/world/props/street/vending_machine_service.tscn | 是 | 复用单代理 | 1 / 180° | COMMERCIAL_SIDE | COMMERCIAL_CORE / MIXED_TRANSITION | 0，暂不启用 |
| Planter | PRP_011_planter | scenes/world/props/street/planter.tscn | 是，提取原组合 | 容器约 0.695×0.396×0.42m Box，叶片计入摆放 Bounds | 1 / 0° | COMMERCIAL_FRONTAGE / COMMERCIAL_SIDE | COMMERCIAL_CORE / MIXED_TRANSITION | 0.5 |
| 既有 Chainlink | BAR_001_chainlink_fence | scenes/world/barriers/barrier_chainlink.tscn | 否 | 已有 4×1.8×0.15m Box | 1 / 0° | LOADING_YARD / INDUSTRIAL_EDGE | INDUSTRIAL_SERVICE / MIXED_TRANSITION | 保持现行规则 |

最短实施顺序：先只包装四项 P0 并在独立 Asset QA 中验收尺寸、接地、堆叠与材质，再决定低栏与其余 P1/P2。低栏 / 花箱将既有 recipe 提取为可重用 builder 或场景，不复制整套 Camp，不修改 Camp 现行成品；如果无法做到等价提取，则另行评估，不在本次审计中预先实施。

需要注意的具体修正：

- Bench / Pallet 的亮板、WoodCrate 的橙色斜撑在 M00 光照下偏抢眼。只建议实例材质参数向现有低饱和木色 / 暖灰收敛，保留源材质；参数修正后的效果尚未渲染验收。
- 箱体可几何叠放，但必须采用实际顶面高度，避免旧碰撞代理造成悬空。托盘 0.168m、木箱 0.850m、金属箱 0.935m；本轮没有新增物理堆叠逻辑。
- 新条目应补 FrontMarker / GroundAnchor，低栏补 SegmentStart / SegmentEnd，入口组合补逻辑通道中心。装饰资产不应为了凑统一节点而新增无用途的 SearchMarker。
- 开放入口不能用组合整体 AABB 作为实体或导航障碍，否则会封住开口。若后续消费者只接受单矩形，应直接消费两个低栏实例；本轮没有改变 M00 消费契约。
- 普通售货机优先于黄色扣锁替代版；Camp Notice Board 不在轻量接入批次，改变其战术地图内容属于贴图级重做。

## 最终决策

### Can Reuse Now

现有 `BAR_001_chainlink_fence` 已是完整 World Runtime 资产，继续用于工业。没有新增的 P0 / 住宅 / 商业缺口资产达到“无需 wrapper 或参数调整即可直接进入当前 World Catalog”的状态。

### Needs Minor Fix

11 个候选：Bench、Pallet、WoodCrate、MetalCrate、SupplyCrate 替代、DirectionSign、Camp LowFence、OpenEntry 组合、普通 Vending、Vending 替代、Camp Planter。优先四项 P0，其余不是本次自动开工清单。

### Do Not Reuse

住宅边界不采用旧完整铁栏、旧破损铁栏、混凝土路障、金属拒马、破损 Chainlink，合计 5 项 REJECT。Camp Notice Board 为 REUSE_WITH_REWORK，不直接当店外展示牌。全部保留原资源。

### Truly Missing

1. 专用停车标识：没有合格的现成 P 标识独立牌；已有方向牌只能作为后续改造候选。
2. 独立店外展示牌 / A-frame：没有合格的现成独立商用牌。普通售货机与花箱已能填补部分 Commercial Street Prop 需求，此项属于 P2，不必立即生产。

住宅“开放入口”不缺新模型，现有低栏留空即可；若未来需要可开合门扇，那是尚未提出的新需求。只有上述缺失项或被拒绝但人工仍确认必要的类别，才值得讨论新模型生产。

## 验证与停止点

- Godot Import：PASS，[日志](../test-output/environment-asset-reuse-audit/import.log)。
- 18 个候选独立实例化、54 张原图的取景 / 像素差检查：PASS，0 failures；[原生日志](../test-output/environment-asset-reuse-audit/native.log)。
- 源模型、wrapper、Catalog、Town 代码与 Blueprint / M00 证据均纳入 [271 文件只读基线](../test-output/environment-asset-reuse-audit/source-baseline.json)，结果见 [冻结复核](../test-output/environment-asset-reuse-audit/source-verification.json)。
- 本轮只新增审计脚本和文档，未修改运行时业务、模型或环境规则，不重跑 Windows 游戏发布构建，也不交付新 exe；上一轮全项目 Build 的 Camp UI 失败不属于此次审计结论。
- PLAN 已同步审计完成状态。没有推进 M01、注册新 Catalog 条目、创建正式 Runtime wrapper、调用 Meshy / Blender 生产或删除资源。

复现：在项目根用当前 Godot console 执行 `--path apps/blue-hour --resolution 1280x720 --audio-driver Dummy --script tests/environment_asset_reuse.gd`，输出只写入独立 `test-output/environment-asset-reuse-audit/`。人工确认本报告和 QA 图后再决定接入批次。
