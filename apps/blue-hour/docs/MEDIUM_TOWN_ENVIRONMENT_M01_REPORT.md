# Medium Town V1 Environment & Street Life M01

2026-09-17。白名单接入与 Town 分布已落地；原生视觉待人工审核。Windows 发布构建被既有 Camp UI 测试阻断，未交付新的独立 EXE。

## 已完成

以 [用户白名单](MEDIUM_TOWN_ENVIRONMENT_REUSE_SELECTION.md) 为选用基线，新增 11 项 World wrapper / Resource，Catalog 环境资产从 8 项扩展至 19 项。World Catalog 的建筑列表、建筑资源、Town Road Graph、Land Use、Parcel、Frontage 与 Building Pool 保持不变。原 GLB、源贴图、Camp 成品与 M00 截图未修改。

[town_street_life_pass.gd](../maps/town/environment/town_street_life_pass.gd) 先执行原 M00，再用独立 Seed 派生随机流增加白名单组合。[town_reuse_rules.gd](../maps/town/environment/town_reuse_rules.gd) 限定 Land Use 和 Slot；沿用 M00 对道路、连续步行带、建筑实体 / Marker、Arrival、POI、公园路径和三条探索路线的保护。M00 的 595 个实例保持原位置、旋转、缩放与 ID。

包装过程由 [integrate_environment_reuse.gd](../tools/integrate_environment_reuse.gd) 使用 Godot PackedScene / ResourceSaver 完成。普通旧资产的 wrapper 直接引用源 GLB，仅禁用导入碰撞代理，新增一个简单 Box，避免双重物理碰撞；ModelRoot 负责轴向和中心纠正，Root identity、Scale=1。低栏和可选花箱离线序列化现有 Camp recipe，保持相同几何，不在 Runtime 装配整套 Camp。重复实例共享网格与材质。

每个新条目为 `searchable=false`，并有 GroundAnchor / FrontMarker / RoadAnchor；低栏另有两端 Marker。破损 Chainlink 使用独立 BAR_005，不复用旧 wrapper 中的 BAR_001 身份。没有新增模型、贴图、门扇或 Gameplay。

## Seed 4101 结果

595 个 M00 实例 + 124 个 M01 新实例 = **719 个环境实例**。

| 新增类型 | 数量 | 分布说明 |
| --- | ---: | --- |
| Park Bench | 16 | OPEN_SPACE 路径两侧，面向路径 |
| Pallet | 38 | 20 组货物节点内，每组 1～3 个 |
| Metal Crate | 20 | 工业 / 混合服务区，每组一个主箱体 |
| Wood Crate | 4 | 同类货物组的低频补充 |
| Residential Low Fence | 30 | 住宅 A/B；其中 20 段构成 10 个开放入口 |
| Direction Sign | 6 | 商业 2、工业 3、混合 1；没有冒充专用停车牌 |
| Vending Machine | 3 | 商业 2、混合 1；建筑侧面 / 后部边缘 |
| Concrete Barrier | 4 | 工业服务区，未占用住宅和车位 |
| Metal Barricade | 2 | 工业少量使用 |
| Damaged Chainlink | 1 | 工业边界点缀 |
| Optional Planter | 0 | 已具备 Runtime 入口，低概率配件，不强行填满 |

各组合先检查所有成员占地，再一次性落位，避免失败后留下零散托盘。未加入箱体堆叠逻辑；现有低矮货物组已经表达装卸用途。入口组合分别碰撞，2.00m 通道不会被整体 AABB 封住。窄小场地允许拒绝摆放，不修改原地块。空停车位保留，M00 合法车位 10 个、停放 5 辆保持不变。

按 Land Use 明细、拒绝原因与八个种子统计见 [validation.json](../test-output/medium-town-environment-m01/validation.json)。

## 原生截图

1920×1080，Godot 4.7.2 Compatibility / RTX 3060。光照沿用 M00；总览与四张分区图无 Overlay。分区图使用当前 Expedition 相机 size=25、offset=(34,42,43)。商业细节图采用反向检查视角，用于看清被建筑遮住的售货机正面，不能当作固定游戏镜头的可见性证据。

| 视图 | 截图 |
| --- | --- |
| 同机位 Before，隐藏 M01 层 | [Before](../test-output/medium-town-environment-m01/PROFILE_A_MAIN_STREET_4101_before_m01.png) |
| M01 总览 | [Overview](../test-output/medium-town-environment-m01/PROFILE_A_MAIN_STREET_4101_overview.png) |
| 商业区固定游戏镜头 | [Commercial](../test-output/medium-town-environment-m01/PROFILE_A_MAIN_STREET_4101_commercial_core.png) |
| 住宅区 | [Residential](../test-output/medium-town-environment-m01/PROFILE_A_MAIN_STREET_4101_residential.png) |
| 公园 | [Park](../test-output/medium-town-environment-m01/PROFILE_A_MAIN_STREET_4101_park.png) |
| 工业服务区 | [Industrial](../test-output/medium-town-environment-m01/PROFILE_A_MAIN_STREET_4101_industrial_service.png) |
| 售货机正面检查镜头 | [Commercial Detail](../test-output/medium-town-environment-m01/PROFILE_A_MAIN_STREET_4101_commercial_detail.png) |
| 两段低栏与开放入口 | [Open Entry](../test-output/medium-town-environment-m01/PROFILE_A_MAIN_STREET_4101_residential_entry.png) |

截图路径、统计和 Before/After 像素差见 [capture-report.json](../test-output/medium-town-environment-m01/capture-report.json)。原 M00、Blueprint 和独立 Reuse Audit 证据保留在各自目录。

## 验证与限制

- Godot Import 通过；19 项环境资产实例化、尺寸、接地与简单碰撞检查通过。新资产同时验证唯一活动碰撞、共享网格 / 材质、可用纹理、Catalog ID 与非搜索用途，见 [asset-audit.json](../test-output/medium-town-environment-m01/asset-audit.json)。
- 八个种子 4101/4102/4103/4104/4105/4106/4110/4201，覆盖四种地图朝向，共 7,163,925 项检查、0 failures；Seed 确定性、原 Town 输入不变、原 M00 实例保留、真实 wrapper 占地、两两重叠、入口 / 路线净空、白名单用途、货物分组与开放入口验证通过。
- Seed 4101 与冻结 Blueprint Town 快照逐字比较；M00 环境完整结果也与旧快照比较。冻结源件 / 结构 / 既有证据共 471 个文件，见 [基线](../test-output/medium-town-environment-m01/frozen-baseline.json) 和 [复核](../test-output/medium-town-environment-m01/frozen-verification.json)。
- 原生 Runtime 截图完成非空、总览取景、Before/After 新资产像素差检查；风格、重复密度和构图仍待人工审核。
- 实际执行 `run.ps1 -Mode build`，Expedition HUD 258 项、Search Active Card 157 项、Settings 14 项先通过；随后 `tests/camp_ui_runtime.gd:114` 访问新版 `camp_hud_root.gd` 不存在的 `member_buttons`，且旧左侧能力区断言失败，构建停止，见 [构建记录](../test-output/medium-town-environment-m01/build-result.json)。没有绕过验证导出，也没有修改正在并行调整的 Camp UI。
- 扩展执行 `tests/world_assets.gd` 后，336 项检查中 4 个既有建筑断言失败：BLD_013/014/021/022 的源贴图为 4096，而旧测试固定要求 2048。新增复用资产没有该失败；见 [world-assets.log](../test-output/medium-town-environment-m01/world-assets.log)。因此不宣称全项目回归通过。
- 当前仍是独立 Medium Town Runtime，未接入正式 Expedition、角色导航实玩、敌人、Loot、Fog 或 Blue Hour。几何通道检查不能代替角色实玩。

## Asset Gap Final Review

这次截图已能用已有资源表达公园停留、工业装卸、住宅低边界与商业售货节点；这些类别不再需要立即生产新模型。住宅低栏在比例上明显区别于工业围网，但颜色和重复频率仍由人工决定。

售货机靠建筑摆放更有场景关系，但固定相机下部分节点会被建筑遮挡。这首先是摆放与视角问题，不是缺模型。长椅 / 托盘白色偏亮、木箱橙色突出，保留用户选用结论，后续可评估实例材质参数，无需重做源件。

专用 P 停车牌、独立店外展示牌仍没有相应现成视觉。商业花箱、工业杂物变体、自行车、电线杆、第二种树和住宅低栏新变体仍属 `PENDING M01 VISUAL QA`；当前证据没有自动批准任何 Meshy / Blender 新模型。

## 复现与停止点

在仓库根目录使用本机 Godot console：

```powershell
godot --headless --path apps/blue-hour --script tests/town_environment_assets.gd -- --street-life
godot --headless --path apps/blue-hour --script tests/town_environment.gd -- --street-life
godot --path apps/blue-hour --resolution 1920x1080 --audio-driver Dummy -- --town-street-life
```

`--town-street-life --town-inspect` 可保留原生窗口进行检查；入口在玩家存档加载前跳转。构建未通过，当前不提供更新 EXE。PLAN 与模型目录已同步。本轮停在 M01 人工视觉审核，不继续资产生产。
