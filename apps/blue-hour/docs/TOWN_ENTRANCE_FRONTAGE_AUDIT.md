# Medium Town Primary Entrance / Street Frontage 审计

日期：2026-09-19。范围：BLD_001～022，Medium Town `PROFILE_A_MAIN_STREET`；正式 Expedition 使用同一个 `TownUrbanView` 实例化入口。

## 结论与修复

错误建筑只有 **BLD_010_residence_d（住宅 D）**。修复前真实主入口与 assigned Street Frontage 相差 **180°**；修复后为 **0°**。其余 21 种建筑的指定入口面与街道一致。

根因是 BLD_010 的共享 wrapper 已把模型转为 -Z 朝前，Town 又对 BLD_009～022 统一叠加 PI，令 BLD_010 的入口背向街道。原检查只验证 FrontMarker，或使用同一套假设生成的 `audited_facade_local`，因此未发现可见模型反向。

生产修改仅为 [town_urban_view.gd](../maps/town/town_urban_view.gd) 中的朝向条件：BLD_010 不再接受第二次 PI 旋转。共享 wrapper、GLB、metadata 资源和生成器均未修改；其他建筑的模型变换保持原值。

![BLD_010 修复前后：相同的指定临街视角](../test-output/town-entrance-frontage/BLD_010-before-after.jpg)

## 全部建筑结果

下表的方向在 wrapper 坐标内表达（placement yaw 为 0）；分配街道在 -Z。实际主入口由原生四面渲染核对，不用 FrontMarker 推断。22 个源模型的指定入口面均为 ModelRoot-local +Z；wrapper 和 Town 的变换共同决定最终方向。

| 建筑 | 主入口辨识依据 | 修复前入口面 | 修复后偏差 |
| --- | --- | --- | ---: |
| BLD_001 超市 | 招牌下的玻璃正门 | -Z | 0° |
| BLD_002 住宅 A | 临街木门 | -Z | 0° |
| BLD_003 住宅 B | 正立面右侧木门 | -Z | 0° |
| BLD_004 药房 | 药房标志与玻璃正门 | -Z | 0° |
| BLD_005 餐馆 | 店招与顾客入口 | -Z | 0° |
| BLD_006 仓库 | 主卷帘门与人员入口 | -Z | 0° |
| BLD_007 加油站 | 临街店面入口；另有侧向入口 | -Z | 0° |
| BLD_008 修车厂 | 主卷帘门与临街人员入口；后门为辅助门 | -Z | 0° |
| BLD_009 住宅 C | 正立面木门 | -Z | 0° |
| **BLD_010 住宅 D** | **大窗旁木门与前庭；原临街面是背墙** | **+Z（错误）** | **0°（原 180°）** |
| BLD_011 住宅 E | 正立面木门 | -Z | 0° |
| BLD_012 双层住宅 | 一层木门；后方滑动窗不作为主门 | -Z | 0° |
| BLD_013 公寓 A | 临街外廊与住户门；多面均有住户入口 | -Z | 0° |
| BLD_014 公寓 B | 木饰条下入口 | -Z | 0° |
| BLD_015 便利店 | 24 招牌与玻璃门 | -Z | 0° |
| BLD_016 小商店 A | 绿篷下玻璃门 | -Z | 0° |
| BLD_017 小商店 B | 红篷下顾客入口；后门为辅助门 | -Z | 0° |
| BLD_018 咖啡店 | Coffee 招牌与店门 | -Z | 0° |
| BLD_019 洗衣店 | 可见洗衣机与玻璃门；后方重复招牌不作为入口 | -Z | 0° |
| BLD_020 五金店 | 店招、货架与顾客入口 | -Z | 0° |
| BLD_021 办公楼 | 门篷下玻璃正门 | -Z | 0° |
| BLD_022 废弃住宅 | 门廊与正门 | -Z | 0° |

## 错误实例列表

四个基准种子的错误实例全部属于 BLD_010；表中的方向来自 parcel 绑定的 block.street_edges，而非最近道路猜测。表中实例修复后均为 0°。

| Seed | 实例 / Parcel | Assigned Frontage | Street |
| --- | --- | --- | --- |
| 4101 | A00_P01 | west | MainStreet |
| 4101 | A03_P23 | south | NorthResidential_0 |
| 4101 | A07_P40 | north | WestResidential_2 |
| 4101 | A13_P53 | south | WestResidential_2 |
| 4102 | A05_P33 | south | EastResidential_0 |
| 4102 | A07_P39 | south | WestResidential_2 |
| 4102 | A12_P51 | south | WestResidential_0 |
| 4102 | A13_P54 | north | WestResidential_2 |
| 4103 | A00_P04 | south | MainStreet |
| 4103 | A04_P26 | north | NorthLink |
| 4103 | A06_P36 | east | WestResidential_0 |
| 4103 | A13_P53 | east | WestResidential_2 |
| 4104 | A00_P02 | south | MainStreet |
| 4104 | A08_P44 | south | ServiceBranch_1 |
| 4104 | A13_P52 | east | WestResidential_2 |
| 4104 | A13_P54 | east | WestResidential_2 |

扩展样本为 seeds 4101～4104 与 0～23，共 28 个 Town、1,540 个建筑实例；其中 101 个 BLD_010 实例修复前反向。[全部错误实例 CSV](../test-output/town-entrance-frontage/incorrect-instances-before.csv) 包含 seed、实例、建筑 ID、frontage、road 与角度。

## 验证与冻结边界

- [独立入口测试](../tests/town_entrance_frontage.gd)：22 种建筑 × 4 个朝向，加上 1,540 个实际实例，共 1,628 次朝向核对。生成样本覆盖 21 种建筑；BLD_001 未在这些种子中抽到，但已完成四面渲染和四方位实例验证，不为补覆盖改变 Building Pool 或 Parcel。
- 修复前：11,162 项检查，105 项失败，均为 BLD_010（101 个 Town 实例 + 4 个单体方位）。修复后含冻结快照比较：**12,820 项，0 失败**；所有入口角度为 0°。
- 前后比较 1,656 个快照：28 份完整 Town 生成数据及 1,628 份实例变换记录。Road Graph、Parcel、建筑位置/yaw、入口/搜索/道路锚点、碰撞体、SpawnPoints 和其他 21 种模型变换完全一致。
- 本轮开始时记录的 143 个源文件中，仅 `maps/town/town_urban_view.gd` 改变；另外 142 个文件（包括 Town 生成、Expedition adapter、Search Registry、missions、建筑资源及 wrappers）SHA-256 不变。Search 系统未作修改。
- Town Urban Fabric 回归：**143,924 项，0 失败**，包括实际变换后 mesh 边界、建筑/道路交叠与地块包含关系。
- E02 Search 回归：**1,206 项，0 失败**。
- 原生 Compatibility 修复前后各 88 张四面截图；像素比较仅 BLD_010 的四张改变，其余 84 张完全相同。BLD_010 修复后临街面可见木门和前庭。

可复跑命令（从仓库根目录执行）：

```powershell
godot --headless --path apps/blue-hour --script tests/town_entrance_frontage.gd
godot --headless --path apps/blue-hour --script tests/town_urban_fabric.gd
godot --headless --path apps/blue-hour --script tests/expedition_search.gd
```

朝向测试支持 `-- --snapshot=before` 与 `-- --snapshot=after --compare=before`，用于变更前后冻结数据比较。JSON、CSV、日志与截图位于被 Git 忽略的 `test-output/town-entrance-frontage/`。

Windows build：已实际执行 `run.ps1 -Mode build`，exit 1。导入及 Search Gameplay 72 / HUD Phase2 258 / Survivor Command 45 / Search Active Card 157 / Settings 14 项通过；随后被既有 Camp 回归阻断：`tests/camp_ui_runtime.gd:114` 读取缺失的 `member_buttons`，并报 `Camp exposes active abilities on its left edge`。未改 Camp、未跳过测试、未产出本轮独立 EXE，独立程序启动未验证。完整日志：[windows-build.log](../test-output/town-entrance-frontage/windows-build.log)。

这是局部朝向修复，不改变 E02 或其他阶段状态；不改 PLAN。历史 [Urban Fabric 报告](MEDIUM_TOWN_URBAN_FABRIC_REPORT.md) 的整批 +Z 表述已纠正。本轮未提交 Git；人工运行时验收状态不由自动化测试代替。
