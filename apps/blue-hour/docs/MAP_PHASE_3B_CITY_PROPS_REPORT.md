# Expedition Map Phase 3B: Blender City Props

## 交付范围

本阶段按附件生成了 10 个正式城市环境道具，并将它们加入既有 `WorldAssetCatalog` 和确定性 `UrbanDressingLayer`。城市、道路、建筑、POI、Search、幸存者、MiniMap、战斗、角色控制與摄像机生成均未修改。

用户指定的 Anime Stylized 环境方向作为资产硬约束：模型采用简化体块、清楚轮廓、共享低饱和大色块材质和克制的轻度旧化；没有照片级贴图、写实污渍或废墟堆砌。全部模型由 Blender 5.2.1 LTS 后台流程生成并真实导出，不使用 procedural fallback。每件资产有独立 `.blend` 源和 GLB，应用网格变换，使用米制单位与地面中心原点；导出统计取自 GLB。

## 资产

尺寸为宽 × 高 × 深，单位米。

| Asset | tris | 尺寸 | GLB |
|---|---:|---|---|
| `PRP_CITY_001_shop_sign` | 660 | 2.00 × 0.98 × 0.39 | `assets/world/props/city_props_v1/PRP_CITY_001_shop_sign.glb` |
| `PRP_CITY_002_ac_unit` | 756 | 1.09 × 0.75 × 0.54 | `assets/world/props/city_props_v1/PRP_CITY_002_ac_unit.glb` |
| `PRP_CITY_003_power_pole` | 848 | 0.73 × 6.11 × 0.40 | `assets/world/props/city_props_v1/PRP_CITY_003_power_pole.glb` |
| `PRP_CITY_004_power_wire_set` | 768 | 9.00 × 0.64 × 0.15 | `assets/world/props/city_props_v1/PRP_CITY_004_power_wire_set.glb` |
| `PRP_CITY_005_traffic_light` | 776 | 0.46 × 3.89 × 0.79 | `assets/world/props/city_props_v1/PRP_CITY_005_traffic_light.glb` |
| `PRP_CITY_006_bus_shelter` | 836 | 4.85 × 2.71 × 1.82 | `assets/world/props/city_props_v1/PRP_CITY_006_bus_shelter.glb` |
| `PRP_CITY_007_awning` | 596 | 3.40 × 0.66 × 1.27 | `assets/world/props/city_props_v1/PRP_CITY_007_awning.glb` |
| `PRP_CITY_008_cardboard_stack` | 396 | 1.31 × 1.14 × 0.68 | `assets/world/props/city_props_v1/PRP_CITY_008_cardboard_stack.glb` |
| `PRP_CITY_009_fire_hydrant` | 904 | 0.60 × 1.03 × 0.54 | `assets/world/props/city_props_v1/PRP_CITY_009_fire_hydrant.glb` |
| `PRP_CITY_010_broken_billboard` | 636 | 3.40 × 3.48 × 1.91 | `assets/world/props/city_props_v1/PRP_CITY_010_broken_billboard.glb` |

完整来源、材质和校验哈希见 [manifest](../assets/world/props/city_props_v1/manifest.json)；Blender 源位于 `art/blender/sources/PRP_CITY_*.blend`，运行时规格见 [MODEL_CATALOG](../art/MODEL_CATALOG.md)。

## 摆放

- 商业招牌、遮阳棚与住宅空调按既有建筑 frontage 和入口朝向挂载；工业纸箱及轻损广告牌放在工业 frontage。
- 电线杆、消防栓沿道路边缘摆放；红绿灯在道路交叉位置；电线由 Blender Curve 生成，并作为高空无阻挡装饰实例化。
- 继续使用 Seed 派生 RNG；每张地图最多 96 个装饰实例。装饰共享 Catalog 场景/导入 Mesh，不创建碰撞体、Search 对象或 Gameplay 权重。
- 五个固定 Seed 生成 79–89 个实例；道路道具、商业/住宅/工业分区及 Arrival 规则均保留。

## 验证

- Blender 5.2.1 LTS background export：10/10 GLB 和 10/10 `.blend` 成功；全部三角面数低于资产预算。
- Godot 4.7.2 headless import：成功；10 个资源定义能加载并实例化。
- Phase 3B/既有街道道具定向回归：27,687 项检查，0 failures。覆盖五 Seed 确定性、实例上限、区域占位、资产存在、Arrival 内容、道路/建筑净空，以及高空线缆和自身宿主立面的例外合同。
- Godot 原生 capture：30 张图，五个 Seed 各含总览、住宅、商业、工业、道路和 Arrival 镜头。文件位于 [capture directory](../test-output/town-phase-3a-capture/)；核心 Seed 4101： [商业](../test-output/town-phase-3a-capture/seed_4101_commercial.png)、[住宅](../test-output/town-phase-3a-capture/seed_4101_residential.png)、[工业](../test-output/town-phase-3a-capture/seed_4101_industrial.png)、[道路](../test-output/town-phase-3a-capture/seed_4101_road.png)、[出生区域](../test-output/town-phase-3a-capture/seed_4101_arrival.png)。
- `git diff --check` 通过。

## 验收状态

技术生成、资源导入、Catalog 登记和 Seed 摆放验收通过。截图为原生 Godot Town 场景捕获；住宅立面与工业街面物件在不同观察角度下的清晰度仍待人工美术确认，因此 Human Visual QA 保持 Pending。
