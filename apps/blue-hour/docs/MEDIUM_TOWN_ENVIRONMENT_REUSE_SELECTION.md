# Medium Town V1 旧环境资产复用白名单

2026-09-17。依据用户提供的《蓝时归航_Medium_Town_V1_旧环境资产复用白名单.md》执行。

本文件记录美术选用与用途边界，优先于上一轮 [Reuse Audit](ENVIRONMENT_ASSET_REUSE_AUDIT.md) 的选用建议。审计中的尺寸、几何、源件与原始 Runtime 状态仍然有效；用户的 REUSE_READY 不代表原来已经存在 World wrapper。本轮已补齐下列 11 项 wrapper 和 Catalog 定义。

## 白名单映射

| 原资产 | 用户选用结论 | World ID / 当前执行 |
| --- | --- | --- |
| BH_Bench_01 | REUSE_READY | PRP_003_park_bench；公园、绿地路径附近 |
| BH_Pallet | REUSE_READY / MINOR_MATERIAL_CHECK | PRP_004_pallet；工业 / 过渡服务场地，1～3 个成组 |
| BH_MetalCrate | REUSE_READY | PRP_006_metal_crate；货物组的主力箱体 |
| BH_WoodCrate | REUSE_READY_WITH_LIMIT | PRP_005_wood_crate；货物组 0.2 概率补充，不作主力 |
| BH_VendingMachine | REUSE_READY | PRP_009_vending_machine；商业 / 过渡建筑边侧，每个 Block 最多一个 |
| BH_Searchable_VendingMachine | REUSE_READY_GAMEPLAY_PROP | 仅未来 Gameplay，未注册装饰条目、未分布 |
| BH_RoadSign | REUSE_READY | PRP_008_direction_sign；低频功能区边缘方向提示 |
| BH_Barrier_Concrete | REUSE_READY | BAR_003_concrete_barrier；服务 / 工业边界，非住宅 |
| BH_Barricade_Metal | REUSE_READY_WITH_LIMIT | BAR_004_metal_barricade；工业服务区少量点缀 |
| BAR_001_chainlink_fence | REUSE_READY | 保持 M00 的工业 / 服务用途 |
| chainlink_damaged | REUSE_READY_WITH_LIMIT | BAR_005_chainlink_damaged；独立 ID，工业低频 |
| camp_low_fence | REUSE_WITH_MINOR_FIX | BAR_002_residential_low_fence；复用原 Camp 段，住宅边界 |
| camp_open_entry | REUSE_WITH_MINOR_FIX | 同一 BAR_002 两次；两个碰撞体，中间保留通道，不新增门模型 |
| CAMP_PROP_003_notice_board | SPECIAL_USE_ONLY | 保留 Camp / 特殊公告用途，不进入随机池 |
| BH_Searchable_Crate | GAMEPLAY_PROP_ONLY | 保留 Loot / Search 用途，不作为普通装饰箱 |
| camp_planter | OPTIONAL / LOW_PRIORITY | PRP_011_planter；可选售货节点配件，允许某种子为零 |
| BH_Fence / BH_Fence_Broken | LOW_PRIORITY / CASE_BY_CASE | 未进入本轮随机池，保留旧资源 |

Runtime scenes 由 [World Catalog](../data/world_asset_catalog.gd) 的 Resource 引用持有；场景位置与尺寸见 [M01 资产验证](../test-output/medium-town-environment-m01/asset-audit.json)。Gameplay 不直接引用原始 GLB。

## 落地约束

- 工业 Chainlink、破损 Chainlink、混凝土路障、金属拒马均不进入普通住宅院落。
- 可搜索箱体 / 可搜索售货机 / 公告板不作为随机环境点缀；本轮没有新增交互点或 Loot 系统。
- 方向牌仍是单一固定箭头，摆放不会把它变成带 P 字的专用停车牌。当前只用作方向提示；具体目的地语义和标识变体待后续确认。
- M01 优先安排建筑边侧售货节点；保留所有停车地表与空车位，未使用停车槽放新道具。白名单允许的位置不等于每种位置必须出现。
- 低栏宽 4.760m、高 1.0075m，保持 Scale=1。配对段净距 2.02m，预留 2.00m 通道，余下 2cm 为数值边界余量。空间不足跳过组合或仅放单段，不改变地块。
- 材质保留源件参数。托盘、长椅的白色和木箱橙色在当前光照中较亮，进入实际 Town 图后由人工审阅，不擅自推翻用户对风格的认可。

## 后续缺口

住宅低栏正式变体、商业花箱 / 店外牌、工业杂物变体、自行车、电线杆、停车 / 道路标识变体、第二种树木均为 `PENDING M01 VISUAL QA`。仅在实际截图仍表现出必要缺口时，再决定资产生产。

执行结果和截图见 [M01 报告](MEDIUM_TOWN_ENVIRONMENT_M01_REPORT.md)。不因白名单中的未来用途自动接入正式 Expedition 或新 Gameplay。
