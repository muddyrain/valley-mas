# Environment Asset Batch 01 Runtime Integration

日期：2026-09-18。输入为用户补发的四个 `_texture.glb`；最初无材质的 `_generate.glb` 未接入。

```text
Environment Asset Batch 01 Runtime Integration:
TECHNICALLY COMPLETE

Asset QA:
PASS (HUMAN CONFIRMED 2026-09-18)

Town Placement:
M02 TECHNICALLY COMPLETE / HUMAN VISUAL QA PASS
```

## 接入范围

四个资产已进入既有 `assets/world/props/street/`、`scenes/world/props/street/`、`data/world_assets/` 与 `WorldAssetCatalog`。Root Transform 为 Identity，Root / ModelRoot Scale 均为 1；只在 ModelRoot 纠正方向及底部中心。GLB 原始字节与用户文件 SHA256 一致，无 Blender 重构、材质重做或新贴图生产。

全部 `searchable=false`、Loot / Enemy Profile 为空、`spawn_weight=0`、`allowed_district=[]`。Batch 01 接入阶段仅登记 `environment_tags`，未修改 Town、M00/M01/M01.1，也未开始分布。2026-09-18 用户确认四件人工 Asset QA = PASS，并授权后续独立 M02 Placement Pass 使用这些标签；结果见 [M02 报告](MEDIUM_TOWN_TARGETED_PROPS_REPORT.md)。本报告下方保留资产接入阶段的验证证据。

## 实测规格

尺寸为纠正朝向后的 Runtime X宽 × Y高 × Z深，单位 cm。三角面按全精度渲染网格统计，顶点含 UV / 法线拆分；碰撞代理不计入。

| Runtime Asset ID | tris | verts | 最终尺寸 cm | 简单 Collision 数量 |
|---|---:|---:|---|---:|
| PRP_Utility_Pole_A | 5,018 | 4,989 | 216.47 × 850.00 × 219.83 | 1 |
| PRP_Parking_Sign_A | 2,624 | 2,678 | 47.55 × 250.00 × 30.52 | 3 |
| PRP_Storefront_AFrame_Sign_A | 3,914 | 4,213 | 60.74 × 105.00 × 52.60 | 1 |
| PRP_Bicycle_A | 12,152 | 11,913 | 76.85 × 105.00 × 169.84 | 2 |

每件均为 1 个 Mesh、1 个源材质、3 张 2048×2048 PBR 贴图。采用既有内嵌 BasisU 导入与 `world_material_import.gd` 的 Mipmaps / 各向异性过滤；保留原贴图与材质通道。Godot 首次导入产生的本批外置贴图副本已移除，正式资源使用 GLB 内嵌贴图。

电线杆宽深包含顶部十字横担。A 字牌按黑板正面转正后宽 60.74、展开深 52.60，接近参考 65 / 55，但不是精确值。自行车长度 169.84，比参考 175 少 5.16cm（2.95%）；未拉伸或缩放以凑数。Scale Validation 的 PASS 指米制、单位缩放、源尺寸保真、Definition 对齐及记录中的尺寸容差，不代表自行车精确长 175cm。自行车测试采用参考长度 ±5%，其余高度误差小于 1cm。

完整原始包围盒、材质通道、贴图规格、源路径和哈希见 [源文件审计](../art/environment_street_sources.json)；纠正后的 Bounding Box、每个 Marker、碰撞类型及加载结果见 [原生 QA 数据](../test-output/environment-assets-batch01/qa_native.json)。

## 来源与正式入口

| Asset | 用户源文件（Downloads） | GLB / Wrapper / Definition |
|---|---|---|
| Utility Pole | Meshy_AI_PRP_Utility_Pole_A_0918142959_texture.glb | [GLB](../assets/world/props/street/PRP_Utility_Pole_A.glb) · [Wrapper](../scenes/world/props/street/PRP_Utility_Pole_A.tscn) · [Definition](../data/world_assets/PRP_Utility_Pole_A.tres) |
| Parking Sign | Meshy_AI_PRP_Parking_Sign_A_0918143006_texture.glb | [GLB](../assets/world/props/street/PRP_Parking_Sign_A.glb) · [Wrapper](../scenes/world/props/street/PRP_Parking_Sign_A.tscn) · [Definition](../data/world_assets/PRP_Parking_Sign_A.tres) |
| A-Frame Sign | Meshy_AI_Wooden_A_Frame_Chalkb_0918142926_texture.glb | [GLB](../assets/world/props/street/PRP_Storefront_AFrame_Sign_A.glb) · [Wrapper](../scenes/world/props/street/PRP_Storefront_AFrame_Sign_A.tscn) · [Definition](../data/world_assets/PRP_Storefront_AFrame_Sign_A.tres) |
| Bicycle | Meshy_AI_PRP_Bicycle_A_0918142914_texture.glb | [GLB](../assets/world/props/street/PRP_Bicycle_A.glb) · [Wrapper](../scenes/world/props/street/PRP_Bicycle_A.tscn) · [Definition](../data/world_assets/PRP_Bicycle_A.tres) |

离线源复制/审计脚本为 `art/stage_environment_sources.py`，Wrapper/Definition 装配为 `tools/integrate_street_assets.gd`，专项验证为 `tests/environment_street_assets.gd`。源复制脚本拒绝覆盖内容不同的既有目标 GLB；装配脚本仅写本批四件 Wrapper/Definition。

## 朝向、Marker 与碰撞

全部 Marker 位于 `Anchors` 下，GroundAnchor=(0,0,0)，FrontMarker 朝 -Z。正面截图确认 Parking Sign 的 P 标识、A 字牌完整黑板、自行车车头均位于 FrontMarker 一侧。

| Asset | FrontMarker（m） | 其他 Marker（m） | Collision |
|---|---|---|---|
| Utility Pole | (0,0,-1.39917) | WireMarker_01=(-0.88,8.49,0)；02=(0,8.49,-0.88)；03=(0.88,8.49,0) | 半径0.15、高7.6的竖直 Cylinder；顶部横担不设碰撞 |
| Parking Sign | (0,0,-0.45261) | RoadAnchor=(0,0,-0.75) | Base 0.30×0.30×0.30；Post 0.10×2.45×0.10；Sign 0.48×0.85×0.16，均为 Box |
| A-Frame Sign | (0,0,-0.56300) | 无额外 Marker | 单 Box 0.60×1.05×0.52 |
| Bicycle | (0,0,-1.14919) | SideMarker=(0.68426,0,0) | 主体 Box 0.32×0.83×1.70；车把/车篮 Box 0.76×0.30×0.42 |

WireMarker 选择十字横担上三个现有绝缘子顶部；三点均在实际网格顶点 8cm 内，高度 8.49m。第四个绝缘子保留源几何，本轮按要求只建立三个连接 Marker。没有生成电线。

源 GLB 内无碰撞，Wrapper 共 7 个低成本 Shape。每个代理均通过原生物理射线命中验证；不对轮辐、篮筐格栅、螺栓建立碰撞。A 字牌四象限最低脚点相对地面约 0～0.059cm，四脚接地检查通过。自行车保留源脚撑、车轮与比例；脚撑细节和局部接触外观仍由人工判断。

建议用途标签分别为：Pole 的 RESIDENTIAL_A / RESIDENTIAL_B / COMMERCIAL_CORE / MIXED_TRANSITION / TOWN_EDGE；Parking Sign 的 PARKING / COMMERCIAL_CORE / SERVICE_AREA；A 字牌的 COMMERCIAL_FRONTAGE / CAFE / SMALL_SHOP；Bicycle 的 RESIDENTIAL / COMMERCIAL / PARK_EDGE。

## 原生截图

每件输出 FRONT、QUARTER、SCALE，并补充 SIDE / REAR，合计 20 张 1280×720 原图；SCALE 均包含 1.70m 标尺。另有 2560×1440 四模型 Contact Sheet。取景包围盒及模型相对空背景的像素差验证通过。

- [四模型 Contact Sheet](../test-output/environment-assets-batch01/contact_sheet.png)
- Utility Pole：[FRONT](../test-output/environment-assets-batch01/PRP_Utility_Pole_A_front.png) · [QUARTER](../test-output/environment-assets-batch01/PRP_Utility_Pole_A_quarter.png) · [SCALE](../test-output/environment-assets-batch01/PRP_Utility_Pole_A_scale.png)
- Parking Sign：[FRONT](../test-output/environment-assets-batch01/PRP_Parking_Sign_A_front.png) · [QUARTER](../test-output/environment-assets-batch01/PRP_Parking_Sign_A_quarter.png) · [SCALE](../test-output/environment-assets-batch01/PRP_Parking_Sign_A_scale.png)
- A-Frame Sign：[FRONT](../test-output/environment-assets-batch01/PRP_Storefront_AFrame_Sign_A_front.png) · [QUARTER](../test-output/environment-assets-batch01/PRP_Storefront_AFrame_Sign_A_quarter.png) · [SCALE](../test-output/environment-assets-batch01/PRP_Storefront_AFrame_Sign_A_scale.png)
- Bicycle：[FRONT](../test-output/environment-assets-batch01/PRP_Bicycle_A_front.png) · [QUARTER](../test-output/environment-assets-batch01/PRP_Bicycle_A_quarter.png) · [SCALE](../test-output/environment-assets-batch01/PRP_Bicycle_A_scale.png) · [SIDE](../test-output/environment-assets-batch01/PRP_Bicycle_A_side.png)

原生图确认模型可见、方向明确、主要部件存在；未将图片检查写成美术通过。人工重点检查电线杆横担、停车箭头牌、黑板完整性，以及自行车车轮圆度、粗化轮辐、篮筐、挡泥板、后货架和脚撑。源模型的小范围变形或贴图瑕疵没有在本轮重构。

## 验证结果与边界

| 检查 | 结果 |
|---|---|
| Godot Import | PASS，最终 Windows build 的 Import 阶段通过 |
| Runtime Asset Load | 四件 PASS |
| Missing Resource / Invalid UID / Runtime Error | 本批最终原生与 Headless 日志均为 0 |
| Scale / Grounding / Marker / Collision Validation | PASS，尺寸口径与容差见上文 |
| Native QA | 171 项，0失败 |
| Headless QA | 110 项，0失败 |
| 冻结代码/建筑 | 62文件 SHA256 不变 |
| 原 Blueprint / M00 / M01 证据 | 复核既有 M01.1 preflight 清单中的51文件，SHA256不变 |
| Seed4101 Town、M00、M01、M01.1 | 完整序列化快照相同，未写回原证据 |

证据：[Headless JSON](../test-output/environment-assets-batch01/qa_headless.json)、[Native JSON](../test-output/environment-assets-batch01/qa_native.json)、[Runtime log](../test-output/environment-assets-batch01/runtime.log)、[冻结文件](../test-output/environment-assets-batch01/frozen-verification.json)、[历史证据](../test-output/environment-assets-batch01/evidence-verification.json)。

全 Catalog 回归为367项、4失败：全部是既有 BLD_013、014、021、022 的贴图宽度固定2048断言，与实际4096不符。本批四件未触发失败；见 [world-assets.log](../test-output/environment-assets-batch01/world-assets.log)。

已执行 `run.ps1 -Mode build`：Import、Expedition HUD 258项、Search Active Card 157项、Settings 14项通过；随后仍被既有 Camp UI `member_buttons` 缺失与左侧能力区断言阻断，见 [build.log](../test-output/environment-assets-batch01/build.log)。未修改无关 Camp UI，未绕过构建门禁，未交付新 EXE。早期单独 Import 期间曾出现正在变化的 Camp survivor_detail 资源缺失；保留原日志，最终 build 的 Import 已通过，不将早期失败抹除。

本报告与 MODEL_CATALOG、PLAN 已同步。用户已确认四件人工 Asset QA = PASS，并于 2026-09-19 确认 M02 Human Visual QA = PASS。M03 的道路基础设施视觉层另有独立报告。
