# Medium Town V1 Environment M01.1 Placement & Material Polish

日期：2026-09-18。代表 Seed：4101。

```text
Medium Town V1 Environment M01.1 Placement & Material Polish:
TECHNICALLY COMPLETE

Visual QA:
PENDING HUMAN REVIEW
```

此状态仅指独立 Town 环境阶段及专项验证。全项目 Windows 构建未通过，未交付新的独立 EXE，也未接入正式 Expedition。

## 范围与保留口径

M01 原始生成器与证据完整保留。新增 `town_environment_polish.gd` 在原样生成 M01 后调整实例，新增 `town_polish_view.gd` 负责本阶段材质覆盖与停车地面；`town_polish_capture.gd` 负责独立证据输出。运行参数为 `--town-environment-polish`，保留 `--town-street-life` 的 M01 入口。

按本轮确认的口径，M00 的 595 个实例作为原始基线保留可复现；M01.1 允许调整住宅车辆及移除低价值灌木，不能将当前实例数仍表述为完整保留 595。Seed 4101 的 M01 基线共 719 个：505 个位置及属性完全不变，100 个移动或转向，114 株灌木移除，最终 605 个。每项变更都在 `environment.txt` 和 `capture-report.json` 的 `preservation.changes` 中记录原值、终值与原因。

590 个冻结文件 SHA256 均未改变，覆盖冻结 Town、既有环境代码、源资产、World 资产接入和 Blueprint/M00/M01 证据。测试另外比较完整 Town、M00、M01 序列化快照。未新增模型或贴图，未修改 Seed、Road Graph、Land Use、Block、Parcel、Frontage、Building Pool、Building Placement、Arrival、POI 或路线。

## 实际结果

| 项目 | Seed 4101 结果 |
|---|---:|
| Total Environment Instances | 605 |
| Cargo Node Count | 20 |
| Average Cargo Node Members | 3.10 |
| 与 Van 装卸位置关联的 Cargo Node | 17 |
| 14m 内有既有 Fence / Barrier 的 Cargo Node | 11 |
| Residential Vehicles On Valid Surface | 23 / 23 |
| 接有人行道外缘连接面的 Driveway | 8 |
| 独立 Small Parking Pad | 15 |
| Bench Count / 材质覆盖实例 | 16 / 16 |
| Pallet Count / 材质覆盖实例 | 38 / 38 |
| Wood Crate Count / 材质覆盖实例 | 4 / 4 |
| Metal Crate Count / 材质覆盖实例 | 20 / 0 |
| Bush Removed / Retained | 114 / 224 |
| Park Rest Node | 15 |
| Park Entrance Node / Tree Cluster / Open Lawn | 3 / 19 / 2 |

货物节点保留原成员与数量，在合法位置优先组成 Van 后侧装卸组，失败时使用场地边缘；每组 1～3 个托盘，箱体位于托盘近旁。原有围栏及屏障保持原位置，报告记录邻接关系，没有凭元数据新增实体边界。

住宅车以既有 Sedan / SUV 为主，保留私家庭院原来的低概率单车规则及公共庭院车辆。尽可能移到同一合法 Slot 的道路侧并对齐车道，其余使用小型停车垫；不能连通时不强行穿过建筑或植被铺路。23 块停车垫均完整覆盖车辆实际包围盒，单块小于 40 平方米；8 条连接面均与停车垫相接且不与建筑或其他实例相交。15 块独立停车垫不宣称已具备完整驶入路线，车辆可达性不是本轮导航验证内容。

公园长椅面向路径，休息节点尝试组成 1～2 椅并与其他节点拉开距离。Seed 4101 共一组双椅、14 组单椅，最近树距离平均 5.71m、最大 8.97m；保留入口灯桶组合和两块 12×12m 中央净空。Tree Cluster 对现有 2～4 株近邻树木/灌木建立分组，不移动树木。灌木疏减优先移除远离树木且孤立的实例，保留较密核心。

Bench 使用低饱和灰蓝 `#89999b`；Pallet 为灰旧木色 `#968a72`、底部 `#665f54`；Wood Crate 为 `#9c9380`、框架 `#81715b`。指定表面粗糙度 0.9、关闭镜面高光。覆盖只作用于 M01.1 实例，源材质与几何不变，Metal Crate 不调整。

商业区 3 台售货机保留，2 台在合法建筑侧面微调。固定 Expedition 镜头下仍有建筑遮挡，不能把商业区整张画面的像素差当成售货机已清晰可见的证明。未为展示正面而移至不合理位置。

## 原生截图

证据目录：[medium-town-environment-m01-1](../test-output/medium-town-environment-m01-1/)。所有对比图左侧为本次原样重建的 M01，右侧为 M01.1；同组共用机位、日光与渲染设置，旧 M01 截图未覆盖。

| 内容 | 同机位 Before / After |
|---|---|
| Overview | [对比图](../test-output/medium-town-environment-m01-1/overview_comparison.png) |
| Industrial Cargo Detail | [对比图](../test-output/medium-town-environment-m01-1/industrial_cargo_comparison.png) |
| Residential Driveway | [对比图](../test-output/medium-town-environment-m01-1/residential_driveway_comparison.png) |
| Park | [对比图](../test-output/medium-town-environment-m01-1/park_comparison.png) |
| Commercial Core | [对比图](../test-output/medium-town-environment-m01-1/commercial_core_comparison.png) |
| Bench / Pallet / Wood Crate / Metal Crate | [材质对比图](../test-output/medium-town-environment-m01-1/materials_comparison.png) |

12 张 1600×900 原图的绝对路径及正式镜头目标见 [capture-report.json](../test-output/medium-town-environment-m01-1/capture-report.json)。6 张拼接图为 3200×900。Overview 使用 348m 正交范围，四张局部使用正式 Expedition Camera 的 size 25 / offset (34,42,43)；材质图是独立中性地面上的同几何比较，不能替代场景验收。所有截图无 Overlay，像素多样性与六组 Before/After 差异检查通过。

## 验证

- [validation.json](../test-output/medium-town-environment-m01-1/validation.json)：8 个 Seed（4101～4106、4110、4201）、4 种朝向、5,828,254 项检查，零失败。
- 覆盖确定性、输入结构不变、M00/M01 基线可复现、白名单实例资产/尺度保留、逐项修改记录、实际 Mesh/Collision 包围盒、Slot 包含、两两重叠、道路与人行道、建筑入口、Arrival/POI/路线净空、住宅地面与连接面、货物紧凑分组、长椅朝向、材质副本隔离。
- [frozen-verification.json](../test-output/medium-town-environment-m01-1/frozen-verification.json)：590 / 590 冻结文件哈希不变。
- Godot 4.7.2 Import 通过；原生 Compatibility 渲染完成，最终 [runtime.log](../test-output/medium-town-environment-m01-1/runtime.log) 中 Runtime Error = 0。
- 已实际执行 `run.ps1 -Mode build`。Import、Expedition HUD 258 项、Search Active Card 157 项、Settings 14 项通过，之后被既有 Camp UI 阻断：`tests/camp_ui_runtime.gd:114` 访问不存在的 `member_buttons`，并失败于左侧能力区断言。详情见 [build.log](../test-output/medium-town-environment-m01-1/build.log)。未跳过门禁，未生成或验证新的独立 EXE。
- 编码检查通过。文档链接脚本经 Git Bash 执行通过；新报告链接均可解析。额外检查整个 PLAN 时发现两个既有失效链接：`ENM_001_PHASE_2A_0B_1_RUNTIME_INTEGRATION_GATE_REPORT.md`、`CAMP_CORE_PROPS_PLACEMENT_CORRECTION_PASS_01A.md`，不属于本轮修改。

几何自动检查不等同于角色导航实玩。人工仍需判断工业组合、独立停车垫的场景合理性、长椅与箱体颜色、公园组织、灌木密度和遮挡；视觉状态保持 `PENDING HUMAN REVIEW`。本阶段到此停止，不进入 M02、新模型生产或正式 Expedition。
