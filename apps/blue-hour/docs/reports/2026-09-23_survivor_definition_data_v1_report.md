# Survivor Definition 数据化 V1 报告

## Summary

正式 `SurvivorDefinition` 现持有角色静态身份、基础属性、初始 Trait 和初始装备引用。Campaign 开始新 Run 时按 Definition 的装备引用创建武器实例；Profile 仍是叙事资料，等级、经验、生命和招募状态仍属于运行时 Campaign 状态。本轮没有修改战斗或武器数值规则。

## Data Structure

- 身份与呈现：继承既有 `id` / `display_name` / `model_path` / `portrait_path`，并以唯一 `survivor_id` 连接 Profile、Roster 和运行时成员。
- 角色定位：`role_tags` 使用 `explorer`、`combat`、`support`、`scavenger`、`medic`、`leader` 等内部 ID。现有 Camp 视图适配器在边界处提供中文标签。
- 基础属性：`base_stats` 只含 `survival`、`combat`、`search`、`mobility` 四项，目录校验与专项测试限制在 1–100。
- 初始 Trait：`starting_trait` 引用正式 `TraitData`；既有 `trait_definition` 作为只读兼容属性映射到同一引用，资源不再保存重复 Trait 引用。
- 初始装备：`starting_equipment` 引用目录中的 `WeaponDefinition`。`new_run.tres` 中重复的武器映射已移除，Campaign 从 Definition 读取武器 ID，然后按既有 WeaponInstance 流程创建实例。
- ID 数据链：Catalog 依显式注册的 Definition 建立内容目录；`SUR_001`–`SUR_012` 各自通过 `survivor_id` 对应 Portrait、TraitData 与 Profile。测试验证每项引用存在且匹配。

## Survivor List

| SUR ID | 姓名 | Role Tags | 初始装备 |
| --- | --- | --- | --- |
| SUR_001 | 夏知遥 | explorer, scavenger | WPN_002_P9_PISTOL |
| SUR_002 | 苏晚星 | support, scavenger | WPN_001_SURVIVAL_KNIFE |
| SUR_003 | 林见月 | combat | WPN_005_S12_SHOTGUN |
| SUR_004 | 陆清禾 | medic, support | WPN_002_P9_PISTOL |
| SUR_005 | 沈砚川 | support, combat | WPN_006_A21_ASSAULT_RIFLE |
| SUR_006 | 唐栀 | leader, support | WPN_004_K9_SMG |
| SUR_007 | 顾予安 | combat, explorer | WPN_007_H7_HUNTER_RIFLE |
| SUR_008 | 程茉 | support, leader | WPN_006_A21_ASSAULT_RIFLE |
| SUR_009 | 周野 | combat | WPN_005_S12_SHOTGUN |
| SUR_010 | 许昭宁 | scavenger, explorer | WPN_002_P9_PISTOL |
| SUR_011 | 贺临川 | leader, combat | WPN_006_A21_ASSAULT_RIFLE |
| SUR_012 | 宋时雨 | support, leader | WPN_002_P9_PISTOL |

四维基础属性已逐人写入对应 `.tres`；未在报告中复制整组数值，以定义资源为数据来源。

## Modified Files

修改：

- `data/survivor_definition.gd`
- `data/survivors/xia_zhiyao.tres`、`su_wanxing.tres`、`lin_jianyue.tres`、`lu_qinghe.tres`、`shen_yanchuan.tres`、`tang_zhi.tres`、`gu_yuan.tres`、`cheng_mo.tres`、`zhou_ye.tres`、`xu_zhaoning.tres`、`he_linchuan.tres`、`song_shiyu.tres`
- `data/new_run_rules.gd`、`data/new_run.tres`
- `data/catalog.gd`
- `core/campaign.gd`
- `ui/camp_hud/survivor_roster_adapter.gd`
- `run.ps1`

新增：

- `tests/survivor_definition_data.gd`
- `docs/reports/2026-09-23_survivor_definition_data_v1_report.md`

计划同步：

- `docs/PLAN.md`

本轮没有删除文件。工作区其余已有改动未纳入本任务。

## Validation

- PASS：`tests/survivor_definition_data.gd`，195 checks / 0 failures；涵盖 12 个 SUR ID、Definition、Portrait、TraitData、Profile、role tag、四项属性范围、武器引用和 Campaign 开局装备读取。
- PASS：`tests/trait_foundation.gd`，44 checks / 0 failures。
- PASS：`tests/survivor_profile_data.gd`，91 checks / 0 failures。
- PASS：`tests/survivor_recruitment_roster.gd`，17 checks / 0 failures。
- PASS：`tests/camp_roster_recruitment_integration.gd`，0 failures；`tests/m05_selected_survivor_detail_data.gd`，0 failures。
- PASS：`tests/new_run.gd`，40 checks / 0 failures；`tests/rules.gd`，19 checks / 0 failures。
- PASS：原生 Camp Roster 截图生成，1600×900：`test-output/camp-survivor-panel/camp-default-1600x900.png`、`camp-hover-1600x900.png`、`camp-sur001-1600x900.png`、`camp-sur002-1600x900.png`。本轮选中详情图已人工查看。
- WARN：Camp 原生启动期间，既有 `maps/town/environment/town_urban_dressing_layer.gd` 报 `_add_district_cluster()` / `_add_arrival_stop()` 缺失方法；截图测试本身结束为 0 failures，但该脚本错误需单独修复。
- FAIL：Windows `run.ps1 -Mode build` 在 `tests/camp_ui_runtime.gd` 停止：`member_buttons` 属性无效，另有既有“Camp exposes active abilities on its left edge”断言失败。未继续导出，不能声称本轮 EXE 构建或独立启动通过；没有把旧 EXE 当作新产物。
- FAIL：`tests/new_run_flow.gd` 观察到两人队伍未完成 `corner` / `van_south` 搜索、训练经验未跨行动保存及五日专精流程断言失败。该集成流程在当前工作区地图运行中耗时过长，随后中止，具体成因未在本轮追查。
- NOT RUN：`tests/m05_avatar_binding.gd` 在无头模式长时间无输出后停止；Portrait 文件存在性和 SUR_ID 映射已由新数据专项覆盖。
- GitNexus：仓库索引状态为最新；本次 GDScript 符号未被索引，`SurvivorDefinition`、`Campaign.new_run`、`Catalog.validate` 的 impact 均返回 not found。最终 `detect_changes --scope all` 报 39 个工作区文件、35 个符号、0 个受影响流程、low 风险；结果包含本任务以外的既有工作区改动。
- PASS：`git diff --check`。
- PASS：编辑前、后均运行 `check_mojibake.py` 定向检查，未发现编码或文本丢失问题。

## Environment

- `[Windows]` Godot 4.7.2 stable，可访问并执行专项测试、原生 1600×900 截图和完整 build 门禁；build 被上述现存测试错误阻断。Blender 命令未安装/未使用。Node v26.4.0；Git 2.39.1.windows.1。
- `[macOS]` 当前会话未连接 macOS 环境；Godot Editor、Blender、Node、Git 状态均无法核验。本次 Windows Godot 验证不能替代 macOS 验收。

## Known Issues

- Windows 完整 build 与独立 EXE 启动尚未完成，必须先修正 Camp UI 门禁中的旧属性引用/能力栏断言，再重跑完整流程。
- 当前工作区的 Town Urban Dressing 脚本解析错误会污染 Camp 原生运行日志，应修复后重跑原生场景和构建。
- `new_run_flow` 的搜索、训练持久化及五日流程失败尚未定位；需在稳定地图环境单独复现。
- 本阶段定义了四维属性，但现有战斗、搜索、移动与生命公式尚未消费这些基础值；按附件边界本轮不改战斗/升级系统。数值落地应由后续规则任务负责。
- M05 Avatar Binding 无头专项未完成；建议在 Town 解析修复后复跑。

## Next Phase Suggestions

1. 修复并复验 Camp UI 与 Town Urban Dressing 门禁，产出并独立启动新的 Windows EXE。
2. 在独立玩法任务中设计并测试 `base_stats` 对生命、输出、搜索和移动的明确公式，避免只保存但不消费。
3. 复跑 `new_run_flow` 与 M05 Avatar Binding，再确认旧存档和正式 Survivor Catalog 的兼容性。
