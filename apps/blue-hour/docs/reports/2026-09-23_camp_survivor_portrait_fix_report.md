# Task Report

> 后续资源迁移已将本报告中的 `assets/ui/camp/survivor_avatars/` 历史路径替换为角色目录。当前路径和验收结果见 [Survivor Portrait Migration 报告](2026-09-23_survivor_portrait_migration_report.md)。本报告保留当时的验证记录。

## 1. Task Summary

将 Blue Hour 幸存者头像收敛到 `SurvivorDefinition.portrait`。SUR_001 夏知遥、SUR_002 苏晚星以及其余 10 名正式幸存者均使用最新 Camp PNG；Camp roster 和 detail 显示同一个 view model 中的同一纹理。同步落实本项目后续任务的报告和验收规则。

## 2. Changed Files

### 修改文件

- `AGENTS.md`：增加任务报告、资源来源、`survivor_id` 绑定和截图验收规则。
- `data/survivors/cheng_mo.tres`
- `data/survivors/gu_yuan.tres`
- `data/survivors/he_linchuan.tres`
- `data/survivors/lin_jianyue.tres`
- `data/survivors/lu_qinghe.tres`
- `data/survivors/shen_yanchuan.tres`
- `data/survivors/song_shiyu.tres`
- `data/survivors/su_wanxing.tres`
- `data/survivors/tang_zhi.tres`
- `data/survivors/xia_zhiyao.tres`
- `data/survivors/xu_zhaoning.tres`
- `data/survivors/zhou_ye.tres`：以上 12 个 Definition 设置正式头像路径。
- `ui/camp_hud/survivor_roster_adapter.gd`：从 Definition 读取头像，移除独立 Camp 头像表。
- `ui/camp_style.gd`：旧 Camp helper 从 Definition 读取头像。
- `ui/expedition/squad_card.gd`：移除旧截图头像 fallback，继续读取角色 Definition 的 `portrait_path`。
- `tests/m05_avatar_binding.gd`：检查 12 个 Definition 的正式资源、卡片与详情的路径和纹理一致性。
- `tests/camp_roster_recruitment_integration.gd`：验证 SUR_001 / SUR_002 头像并采集两张 Camp 截图。
- `docs/PLAN.md`：同步头像数据源和验收状态。

### 新增文件

- `docs/reports/2026-09-23_camp_survivor_portrait_fix_report.md`：本报告。

### 删除文件

- 无。旧 PNG 文件尚保留在资源库，但当前 Camp 和 Expedition 头像绑定不再引用它们。

## 3. Implementation Details

此前 Camp 通过独立 `survivor_id → PNG` 表取头像，而 SUR_001 / SUR_002 的 Definition 仍指向旧 Expedition 截图。两套路径使 Definition 无法成为唯一资源来源。现在 12 个 Definition 的 `portrait_path` 直接记录正式 PNG，数据链为：

`Survivor Instance → survivor_id → SurvivorDefinition.portrait → SurvivorRosterAdapter view.portrait → roster avatar / detail avatar`

Expedition 队员卡读取同一个 Definition 的 `portrait_path`，不再按旧模板 ID 回退到截图资源。Camp 的 `PortraitSlot` 和 `SurvivorDetail` 继续消费同一个 view model 的纹理；名称、等级、Trait、HP 和招募逻辑未在本轮重写。

头像来源目录：`res://assets/ui/camp/survivor_avatars/`。使用位置：Camp M04 roster、M05 detail，以及 Expedition 队员卡。下表以 `survivor_id` 为唯一绑定 ID：

| 绑定 ID | Definition 中的正式头像路径 |
| --- | --- |
| SUR_001 | `res://assets/ui/camp/survivor_avatars/SUR_001_Xia_Zhiyao_avatar.png` |
| SUR_002 | `res://assets/ui/camp/survivor_avatars/SUR_002_Su_Wanxing_avatar.png` |
| SUR_003 | `res://assets/ui/camp/survivor_avatars/SUR_003_Lin_Jianyue_avatar.png` |
| SUR_004 | `res://assets/ui/camp/survivor_avatars/SUR_004_Lu_Qinghe_avatar.png` |
| SUR_005 | `res://assets/ui/camp/survivor_avatars/SUR_005_Shen_Yanchuan_avatar.png` |
| SUR_006 | `res://assets/ui/camp/survivor_avatars/SUR_006_Tang_Zhi_avatar.png` |
| SUR_007 | `res://assets/ui/camp/survivor_avatars/SUR_007_Gu_YuAn_avatar.png` |
| SUR_008 | `res://assets/ui/camp/survivor_avatars/SUR_008_Cheng_Mo_avatar.png` |
| SUR_009 | `res://assets/ui/camp/survivor_avatars/SUR_009_Zhou_Ye_avatar.png` |
| SUR_010 | `res://assets/ui/camp/survivor_avatars/SUR_010_Xu_Zhaoning_avatar.png` |
| SUR_011 | `res://assets/ui/camp/survivor_avatars/SUR_011_He_Linchuan_avatar.png` |
| SUR_012 | `res://assets/ui/camp/survivor_avatars/SUR_012_Song_Shiyu_avatar.png` |

## 4. Validation

- `[macOS]` Godot Editor 资源导入：PASS，退出码 0。
- `[macOS]` 原生 Compatibility 渲染 Camp roster 集成：PASS，0 failures。
- `[macOS]` 原生 Compatibility 渲染 M05 avatar binding：PASS，0 failures；12 个 Definition 的头像资源均可加载。
- `[macOS]` Expedition HUD 回归：PASS，248 checks / 0 failures。
- `[macOS]` roster avatar：PASS；detail avatar：PASS；当前头像绑定中的旧截图引用移除：PASS。
- `[macOS]` 编码检查与 `git diff --check`：PASS。
- `[macOS]` 1600×900 截图：
  - SUR_001 选中：`test-output/camp-survivor-binding/camp-1600x900.png`
  - SUR_002 选中：`test-output/camp-survivor-binding/camp-sur002-1600x900.png`

以上截图为项目内运行产物，不纳入版本控制。路径相对于 `apps/blue-hour/`。

## 5. Known Issues

- `[Windows]` 当前没有已授权的 Windows 设备或远程连接；Windows Godot 主运行、构建与独立程序启动未验证。用户此前明确要求先交付 macOS 验证结果。
- `SurvivorProfile` 仍由现有 `catalog.profiles` 通过 `survivor_id` 关联，尚不是 `SurvivorDefinition` 的直接字段。本轮仅收敛 Portrait 数据源；Profile 数据模型需另行处理，不能把当前状态记为完全符合新增的 Profile 规则。
- 旧 Expedition 截图 PNG 仍留在资源库，当前头像绑定代码和 12 个 Definition 均无其引用；删除资产前需另行核对历史内容依赖。

## 6. Environment

| 平台 | Godot Editor | Blender | Node | Git |
| --- | --- | --- | --- | --- |
| Windows | 未连接设备，未验证 | 未验证 | 未验证 | 未验证 |
| macOS（Apple M3 Pro） | 4.7.2 stable，已用于导入与原生 Compatibility 验证 | 5.2.1 LTS，已安装，本轮未使用 | v22.22.3，已用于本地分析工具 | 2.55.0，已用于变更检查 |

环境差异：macOS 截图和逻辑回归只能证明本机运行结果，不能代替项目要求的 Windows build 与 `.exe` 启动验收。
