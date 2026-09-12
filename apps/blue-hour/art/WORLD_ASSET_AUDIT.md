# 第一批 World Asset Audit

2026-09-12。基于用户实际文件、原始GLB数据及Godot四面渲染，不按文件名推测模型方向。配套[交付报告](../docs/WORLD_MAP_REPORT.md)与[精确数据](world_asset_audit.json)。

## 共同检查

16项全部存在。每份源GLB：Mesh=1、Material=1（双面PBR）、Texture=3（JPEG，2048×2048，底色/法线/金属度粗糙度）。源节点Scale=(1,1,1)、Rotation无额外变换、Up=+Y；源顶点底部在Y=0附近，最大误差约2.4e-7米。逐三角形检查无零面积退化三角形；这不等同于完整流形拓扑认证，明显破损另列。原始字节和SHA-256保留在JSON。

Runtime Root全部identity。下表Size为ModelRoot纠正后的X/Y/Z米；所有Wrapper缩放为(1,1,1)，仅街区植被实例使用固定Seed的0.9～1.1缩放。底部中心补偿数值只作用于ModelRoot，业务生成器不包含源件特例。

## 逐项接入与尺寸

| ID | 源Triangles | 源Size X/Y/Z(m) | Runtime Size X/Y/Z(m) | Scale | ModelRoot Y旋转 | ModelRoot Pivot平移(m) | Collision | 接入 / 问题 |
| --- | ---: | --- | --- | --- | ---: | --- | --- | --- |
| BLD_001_supermarket | 132,210 | 15.197 × 5.500 × 13.792 | 15.197 × 5.500 × 13.792 | 1,1,1 | 180° | (-0.040497, -0.000000, 0.232197) | 1 Box | 已接入；招牌/局部文字有生成式伪字；未发现阻断使用的明显破面 |
| BLD_002_house_small_a | 55,280 | 9.327 × 4.200 × 6.983 | 9.327 × 4.200 × 6.983 | 1,1,1 | 180° | (-0.005260, -0.000000, 0.016921) | 1 Box | 已接入；招牌/局部文字有生成式伪字；未发现阻断使用的明显破面 |
| BLD_003_house_small_b | 72,316 | 8.552 × 4.200 × 5.507 | 8.552 × 4.200 × 5.507 | 1,1,1 | 180° | (-0.000367, -0.000000, 0.013448) | 1 Box | 已接入；招牌/局部文字有生成式伪字；未发现阻断使用的明显破面 |
| BLD_004_pharmacy | 68,296 | 7.603 × 4.500 × 7.372 | 7.603 × 4.500 × 7.372 | 1,1,1 | 180° | (-0.002136, -0.000000, 0.034947) | 1 Box | 已接入；招牌/局部文字有生成式伪字；未发现阻断使用的明显破面 |
| BLD_005_restaurant_small | 77,544 | 8.325 × 4.800 × 5.622 | 8.325 × 4.800 × 5.622 | 1,1,1 | 180° | (-0.004187, -0.000000, 0.000803) | 1 Box | 已接入；招牌/局部文字有生成式伪字；未发现阻断使用的明显破面 |
| BLD_006_warehouse_small | 74,754 | 12.853 × 6.000 × 14.098 | 12.853 × 6.000 × 14.098 | 1,1,1 | 180° | (0.000282, -0.000000, -0.004564) | 1 Box | 已接入；招牌/局部文字有生成式伪字；未发现阻断使用的明显破面 |
| BLD_007_gas_station | 70,976 | 16.284 × 5.200 × 10.837 | 16.284 × 5.200 × 10.837 | 1,1,1 | 180° | (-0.040550, -0.000000, -0.019070) | 8 Box | 已接入；单一网格顶棚未拆分；8个Box保留柱间空间，顶棚淡出待验收 |
| BLD_008_auto_repair_shop | 71,350 | 10.955 × 5.200 × 9.714 | 10.955 × 5.200 × 9.714 | 1,1,1 | 180° | (-0.002712, -0.000000, -0.005356) | 1 Box | 已接入；招牌/局部文字有生成式伪字；未发现阻断使用的明显破面 |
| VEH_001_sedan_a | 29,888 | 4.694 × 1.500 × 2.089 | 2.089 × 1.500 × 4.694 | 1,1,1 | -90° | (-0.000595, -0.000000, 0.001121) | 1 Box | 已接入；四面视图未发现明显破面或材质丢失；未经最终美术精修 |
| VEH_002_suv | 28,962 | 4.677 × 1.700 × 2.067 | 2.067 × 1.700 × 4.677 | 1,1,1 | -90° | (-0.001799, -0.000000, 0.002114) | 1 Box | 已接入；四面视图未发现明显破面或材质丢失；未经最终美术精修 |
| VEH_003_van | 27,592 | 4.417 × 1.900 × 1.823 | 1.823 × 1.900 × 4.417 | 1,1,1 | -90° | (-0.001890, -0.000000, 0.002592) | 1 Box | 已接入；四面视图未发现明显破面或材质丢失；未经最终美术精修 |
| PRP_001_street_lamp | 9,548 | 1.743 × 4.200 × 0.489 | 0.489 × 4.200 × 1.743 | 1,1,1 | -90° | (-0.000019, 0.000000, -0.690000) | 1 Box | 已接入；四面视图未发现明显破面或材质丢失；未经最终美术精修 |
| PRP_002_trash_bin | 2,251 | 0.492 × 1.000 × 0.492 | 0.492 × 1.000 × 0.492 | 1,1,1 | 0° | (0.000320, -0.000000, 0.000113) | 1 Box | 已接入；四面视图未发现明显破面或材质丢失；未经最终美术精修 |
| BAR_001_chainlink_fence | 8,462 | 3.484 × 1.800 × 0.093 | 4.000 × 1.800 × 0.150 | 1,1,1 | 0° | (0.000000, 0.000000, 0.000000) | 1 Box | 已接入；源网丝缺损、非4m连续模块；正式使用规则版本，源件保留为破损变体 |
| VEG_001_tree_broadleaf_a | 47,272 | 4.768 × 6.000 × 3.674 | 4.768 × 6.000 × 3.674 | 1,1,1 | 0° | (-0.021271, 0.000000, 0.004024) | 1 Box | 已接入；树冠偏稀疏；保持47,272面，不再减面；未做遮挡淡出 |
| VEG_002_bush_a | 28,433 | 1.727 × 1.000 × 1.330 | 1.727 × 1.000 × 1.330 | 1,1,1 | 0° | (-0.002856, -0.000000, 0.021811) | 1 Box | 已接入；四面视图未发现明显破面或材质丢失；未经最终美术精修 |

源Front：BLD_001～008均+Z，车辆001～003与路灯为-X；纠正后Front统一-Z。垃圾桶、树、灌木无强制正面，Y可旋转。围栏沿X延伸、法线Z，标准模块朝向由连续拼接控制。路灯按灯杆脚底定位，而非不对称灯臂的整体包围盒中心。

树碰撞只覆盖0.65×2.8×0.65m树干；灌木1.35×0.8×1m；灯杆0.3×4×0.3m。其他精确Box位置/大小见JSON的collision_boxes。加油站8Box分别为主建筑、顶棚、4柱、2泵；导航忽略悬空顶棚。标准围栏视觉宽4m高1.8m，简化碰撞厚0.15m。

## 原始来源 → Runtime Source → Wrapper

以下Source文件均来自 `C:/Users/A/Downloads/蓝时归航_游戏地图模型/`；精确绝对路径逐项记录在JSON。

### BLD_001_supermarket

- 实际File Path：`C:\Users\A\Downloads\蓝时归航_游戏地图模型\Meshy_AI_001_超市_0911151928_texture.glb`
- 项目Source：[GLB](../assets/world/buildings/commercial/building_supermarket_model.glb)
- Runtime Scene：[scenes/world/buildings/commercial/building_supermarket.tscn](../scenes/world/buildings/commercial/building_supermarket.tscn)
- 原始SHA-256：`6e873c842b1bdbc22cd9920088ed51b093c33454767b9b670b12cbaf4694cec5`

### BLD_002_house_small_a

- 实际File Path：`C:\Users\A\Downloads\蓝时归航_游戏地图模型\Meshy_AI_002_住宅_A_0911151911_texture.glb`
- 项目Source：[GLB](../assets/world/buildings/residential/building_house_small_a_model.glb)
- Runtime Scene：[scenes/world/buildings/residential/building_house_small_a.tscn](../scenes/world/buildings/residential/building_house_small_a.tscn)
- 原始SHA-256：`c33a499f9bbdab7d1d2579de2d0c7733c7ec66e09a83f26b6ec2c0b7a53d3b36`

### BLD_003_house_small_b

- 实际File Path：`C:\Users\A\Downloads\蓝时归航_游戏地图模型\Meshy_AI_003_住宅_B_0911151741_texture.glb`
- 项目Source：[GLB](../assets/world/buildings/residential/building_house_small_b_model.glb)
- Runtime Scene：[scenes/world/buildings/residential/building_house_small_b.tscn](../scenes/world/buildings/residential/building_house_small_b.tscn)
- 原始SHA-256：`be5b6af053fb4d0c9d524b7792e0a48e8572484f3332058072a0460e8614eb30`

### BLD_004_pharmacy

- 实际File Path：`C:\Users\A\Downloads\蓝时归航_游戏地图模型\Meshy_AI_004_药店_0911151833_texture.glb`
- 项目Source：[GLB](../assets/world/buildings/commercial/building_pharmacy_model.glb)
- Runtime Scene：[scenes/world/buildings/commercial/building_pharmacy.tscn](../scenes/world/buildings/commercial/building_pharmacy.tscn)
- 原始SHA-256：`8def3bb3ca66be9da2d1fbf8db629b835f87f6863658e53a18cf60f32a1170ab`

### BLD_005_restaurant_small

- 实际File Path：`C:\Users\A\Downloads\蓝时归航_游戏地图模型\Meshy_AI_005_小型餐厅_0911154142_texture.glb`
- 项目Source：[GLB](../assets/world/buildings/commercial/building_restaurant_small_model.glb)
- Runtime Scene：[scenes/world/buildings/commercial/building_restaurant_small.tscn](../scenes/world/buildings/commercial/building_restaurant_small.tscn)
- 原始SHA-256：`d19df1632f4b0571742bc78b9a86eebd54070e633e37b74743c5c069319f157e`

### BLD_006_warehouse_small

- 实际File Path：`C:\Users\A\Downloads\蓝时归航_游戏地图模型\Meshy_AI_006_仓库_0911154812_texture.glb`
- 项目Source：[GLB](../assets/world/buildings/industrial/building_warehouse_small_model.glb)
- Runtime Scene：[scenes/world/buildings/industrial/building_warehouse_small.tscn](../scenes/world/buildings/industrial/building_warehouse_small.tscn)
- 原始SHA-256：`4a465a54e70e4fb887b75da02aea9b248eea324f8097dcd25d2f9433467080bc`

### BLD_007_gas_station

- 实际File Path：`C:\Users\A\Downloads\蓝时归航_游戏地图模型\Meshy_AI_007_加油站_0911161205_texture.glb`
- 项目Source：[GLB](../assets/world/buildings/service/building_gas_station_model.glb)
- Runtime Scene：[scenes/world/buildings/service/building_gas_station.tscn](../scenes/world/buildings/service/building_gas_station.tscn)
- 原始SHA-256：`92aaf9c24b303886f4bac288b9f68bd220b7ad7b0aa6e29034eb7f5bbf253f4d`

### BLD_008_auto_repair_shop

- 实际File Path：`C:\Users\A\Downloads\蓝时归航_游戏地图模型\Meshy_AI_008_小型汽车维修_0911162225_texture.glb`
- 项目Source：[GLB](../assets/world/buildings/service/building_auto_repair_shop_model.glb)
- Runtime Scene：[scenes/world/buildings/service/building_auto_repair_shop.tscn](../scenes/world/buildings/service/building_auto_repair_shop.tscn)
- 原始SHA-256：`4d8a954dbd18562a0ece9f497a54c2e57f0a660a6a7dde90547d4956ff422423`

### VEH_001_sedan_a

- 实际File Path：`C:\Users\A\Downloads\蓝时归航_游戏地图模型\Meshy_AI_VEH_001_sedan_a_0911173804_texture.glb`
- 项目Source：[GLB](../assets/world/vehicles/vehicle_sedan_a_model.glb)
- Runtime Scene：[scenes/world/vehicles/vehicle_sedan_a.tscn](../scenes/world/vehicles/vehicle_sedan_a.tscn)
- 原始SHA-256：`6313c5b88ca6179f8eecc8478a4edaf7bf258cf4b89782ec25d868672d3641f1`

### VEH_002_suv

- 实际File Path：`C:\Users\A\Downloads\蓝时归航_游戏地图模型\Meshy_AI_Silver_Urban_SUV_0911174654_texture.glb`
- 项目Source：[GLB](../assets/world/vehicles/vehicle_suv_model.glb)
- Runtime Scene：[scenes/world/vehicles/vehicle_suv.tscn](../scenes/world/vehicles/vehicle_suv.tscn)
- 原始SHA-256：`f46fb609c01365f0838bd720f64b00f071fcf470e05001959e49983896e4d952`

### VEH_003_van

- 实际File Path：`C:\Users\A\Downloads\蓝时归航_游戏地图模型\Meshy_AI_White_Cargo_Van_0911180605_texture.glb`
- 项目Source：[GLB](../assets/world/vehicles/vehicle_van_model.glb)
- Runtime Scene：[scenes/world/vehicles/vehicle_van.tscn](../scenes/world/vehicles/vehicle_van.tscn)
- 原始SHA-256：`2af2d7d84c078d66786d813d40b71cca3a835f46ac09b6910667b405f287acd4`

### PRP_001_street_lamp

- 实际File Path：`C:\Users\A\Downloads\蓝时归航_游戏地图模型\Meshy_AI_PRP_001_street_lamp_0912020245_texture.glb`
- 项目Source：[GLB](../assets/world/props/street/prop_street_lamp_model.glb)
- Runtime Scene：[scenes/world/props/street/prop_street_lamp.tscn](../scenes/world/props/street/prop_street_lamp.tscn)
- 原始SHA-256：`663d83e465463af9d292b74e67b93886f3cb37e4478b6d57a89bfe3d535fec3a`

### PRP_002_trash_bin

- 实际File Path：`C:\Users\A\Downloads\蓝时归航_游戏地图模型\Meshy_AI_PRP_002_trash_bin_0912020907_texture.glb`
- 项目Source：[GLB](../assets/world/props/street/prop_trash_bin_model.glb)
- Runtime Scene：[scenes/world/props/street/prop_trash_bin.tscn](../scenes/world/props/street/prop_trash_bin.tscn)
- 原始SHA-256：`e92748db4e9ea62d5096fc93d87cf708aadc098111354fd70458e409ed4ff130`

### BAR_001_chainlink_fence

- 实际File Path：`C:\Users\A\Downloads\蓝时归航_游戏地图模型\Meshy_AI_VEG_001_tree_broadlea_0912032355_texture.glb`
- 项目Source：[GLB](../assets/world/barriers/barrier_chainlink_source_model.glb)
- Runtime Scene：[scenes/world/barriers/barrier_chainlink.tscn](../scenes/world/barriers/barrier_chainlink.tscn)
- 原始SHA-256：`8aaab6bc9a886b72c7c119fd7dc1b9d0a7ea9abcd0b4ebd95fd2e320e7fc1d17`

### VEG_001_tree_broadleaf_a

- 实际File Path：`C:\Users\A\Downloads\蓝时归航_游戏地图模型\Meshy_AI_VEG_001_tree_broadlea_0912032102_texture.glb`
- 项目Source：[GLB](../assets/world/vegetation/vegetation_tree_broadleaf_a_model.glb)
- Runtime Scene：[scenes/world/vegetation/vegetation_tree_broadleaf_a.tscn](../scenes/world/vegetation/vegetation_tree_broadleaf_a.tscn)
- 原始SHA-256：`92d53d509e391256c062a1be62b08dec11e896a15c97d643299855a3620b57b0`

### VEG_002_bush_a

- 实际File Path：`C:\Users\A\Downloads\蓝时归航_游戏地图模型\Meshy_AI_VEG_002_bush_a_0912030329_texture.glb`
- 项目Source：[GLB](../assets/world/vegetation/vegetation_bush_a_model.glb)
- Runtime Scene：[scenes/world/vegetation/vegetation_bush_a.tscn](../scenes/world/vegetation/vegetation_bush_a.tscn)
- 原始SHA-256：`688efe305d134e24a751602de3f9f00661897557cba3d18fd5e0f13bb9391830`

## BAR_001源件取舍

源文件名 `Meshy_AI_VEG_001_tree_broadlea_0912032355_texture.glb` 实为围栏；真正树模型是另一份0912032102文件。围栏存在大面积破网，长度仅约3.484m，不能当连续4m标准段。正式采用规则 Geometry 柱/横杆与按像素覆盖率过滤的 Alpha Blend 网片；源 GLB 和[破损 Wrapper](../scenes/world/barriers/barrier_chainlink_damaged.tscn)保留，不放进当前地图。旧硬 Alpha Cutout 会在运动中产生网纹密度跳变，当前处理及实机对比见[外出视觉报告](../docs/EXPEDITION_VISUAL_REPORT.md)。

## 视觉证据与可复现工作流

`tests/world_source_views.gd` 产生 `test-output/world-audit/<ID>.png`：每张依次从-Z、+X、+Z、-X观察。`tests/world_assets.gd` 核验Godot导入后Mesh/材质复用、贴图尺寸、底部、包围盒和碰撞类型；导入实测记录为 `test-output/world-imported-audit.json`。

离线复现：先运行 `python art/audit_world_sources.py`，再运行 `python art/build_world_wrappers.py`，最后通过项目 `run.ps1 -Mode import` / `-Mode test`。前者保留实际来源记录，后者集中存放人工四面审计后的朝向与碰撞选择；不要在Gameplay中修源件。源GLB未重贴图、重减面或修改高度。
