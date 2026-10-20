# Task Report

## Summary

将 12 名 Survivor 的正式头像从 UI 目录迁入各自角色目录，统一命名为 `portrait/avatar_square.png`，并更新 `SurvivorDefinition.portrait_path`。Camp M04 roster、M05 detail 和 Expedition 队员卡继续从 Survivor 数据取同一角色的头像；不修改数值、Trait 设计、招募流程或 UI 布局。

## Modified Files

### 迁移资源

下表列出 12 个绑定 ID、原 PNG 和目标 PNG。每张图移动前后 SHA-256 一致，迁移没有重绘或重压；哈希前 12 位用于快速核对。对应 12 个旧 `.png.import` 已移除，新路径下的 `.png.import` 由 Godot 重新生成。

| `survivor_id` | 原 PNG（`assets/ui/camp/survivor_avatars/`） | 新 PNG（`assets/characters/`） | SHA-256 前 12 位 |
| --- | --- | --- | --- |
| SUR_001 | `SUR_001_Xia_Zhiyao_avatar.png` | `xia_zhiyao/portrait/avatar_square.png` | `2ef497702278` |
| SUR_002 | `SUR_002_Su_Wanxing_avatar.png` | `su_wanxing/portrait/avatar_square.png` | `26baa8cf8208` |
| SUR_003 | `SUR_003_Lin_Jianyue_avatar.png` | `lin_jianyue/portrait/avatar_square.png` | `3892b3630fcc` |
| SUR_004 | `SUR_004_Lu_Qinghe_avatar.png` | `lu_qinghe/portrait/avatar_square.png` | `f67717956be7` |
| SUR_005 | `SUR_005_Shen_Yanchuan_avatar.png` | `shen_yanchuan/portrait/avatar_square.png` | `ac32269040b5` |
| SUR_006 | `SUR_006_Tang_Zhi_avatar.png` | `tang_zhi/portrait/avatar_square.png` | `c31e2fd764e1` |
| SUR_007 | `SUR_007_Gu_YuAn_avatar.png` | `gu_yuan/portrait/avatar_square.png` | `4ddbc3ff9ec9` |
| SUR_008 | `SUR_008_Cheng_Mo_avatar.png` | `cheng_mo/portrait/avatar_square.png` | `97781a3a76e2` |
| SUR_009 | `SUR_009_Zhou_Ye_avatar.png` | `zhou_ye/portrait/avatar_square.png` | `4bfdc852757c` |
| SUR_010 | `SUR_010_Xu_Zhaoning_avatar.png` | `xu_zhaoning/portrait/avatar_square.png` | `b6d1c41bd4f3` |
| SUR_011 | `SUR_011_He_Linchuan_avatar.png` | `he_linchuan/portrait/avatar_square.png` | `e9898d702359` |
| SUR_012 | `SUR_012_Song_Shiyu_avatar.png` | `song_shiyu/portrait/avatar_square.png` | `8e0d7a450fe7` |

### 修改文件

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
- `data/survivors/zhou_ye.tres`：以上 12 个 Definition 的 `portrait_path` 改为角色目录。
- `tests/m05_avatar_binding.gd`：校验头像和模型的目录归属、12 个导入资源、roster/detail 同源、真实鼠标悬停及选中。
- `tests/camp_roster_recruitment_integration.gd`：更新 SUR_001 / SUR_002 资源路径断言，采集 Camp 截图。
- `AGENTS.md`：加入 Survivor Resource Binding Rule 和环境验收标签。
- `art/ASSET_PIPELINE.md`、`art/MODEL_CATALOG.md`、`art/UI_ASSETS.md`、`docs/PLAN.md`：更新当前头像归属和历史资源说明。
- `docs/reports/2026-09-23_camp_survivor_portrait_fix_report.md`：标注其中的旧 UI 路径已被本次迁移替代，保留历史验收记录。

### 新增文件

- `assets/ui/camp/survivor_avatars/README.md`：Deprecated 说明。
- `docs/reports/2026-09-23_survivor_portrait_migration_report.md`：本报告。

### 删除文件

- 旧 UI 目录中的 12 张 `SUR_*_avatar.png` 及各自的 `.png.import`；对应头像已经迁入上表的新位置。

## Implementation Details

迁移前检查了 `SurvivorRosterAdapter`、`PortraitSlot`、`SurvivorDetail` 和 Expedition 队员卡。Camp 当前只显示 `SurvivorRosterManager.get_recruited_survivors()`，Adapter 读取对应 Definition 的 `portrait`，roster 与 detail 消费同一个 view model 的纹理。运行时代码不需要改动，迁移只更新 Definition 的资源引用和测试断言。

当前数据链：`Survivor Instance → survivor_id → SurvivorDefinition.portrait_path → Texture2D → Camp roster / detail`。Expedition 队员卡也读取该 Definition 的 `portrait_path`。`SurvivorDefinition` 已从 `SurvivorData` 继承 `portrait_path`；`SurvivorProfile` 是叙事数据，没有另建一份头像字段，以免产生双重真源。模型仍指向各角色 `runtime/`，Trait 和数值未改；公共 Locomotion 动画继续共享。

开始迁移时，源目录中有 11 张 PNG 已存在未提交的本地改动。本任务迁移的是这些当前文件；逐张核对移动前后 SHA-256，保留了改动后的原始字节。12 张新图哈希互不相同，旧 UI 目录无 PNG 或 `.png.import`。没有通过文件名、中文名或数组顺序做运行时绑定。

资源使用位置与 ID：上表每个 `survivor_id` 的新 PNG 同时用于 Camp M04 卡片、M05 详情和 Expedition 队员卡。SUR_001 最终路径为 `res://assets/characters/xia_zhiyao/portrait/avatar_square.png`；SUR_002 最终路径为 `res://assets/characters/su_wanxing/portrait/avatar_square.png`。

## Validation

- `[macOS] macOS compatible` Godot 4.7.2 Editor 重新导入：PASS，12 个新 `.png.import` 的 `source_file` 与 Definition 路径一致。
- `[macOS] macOS compatible` 资源审计：PASS，12 个不同 SHA-256、12 个路径可用、旧 UI 目录无 PNG / `.png.import`，活跃 GDScript / `.tres` / `.tscn` 无旧目录引用。
- `[macOS] macOS compatible` 原生 Compatibility 1600×900 `m05_avatar_binding.gd`：PASS，0 failures；覆盖 SUR_001、SUR_002、抽样 SUR_012 的详情选中和真实鼠标悬停。
- `[macOS] macOS compatible` 原生 Compatibility 1600×900 `camp_roster_recruitment_integration.gd`：PASS，0 failures；roster、detail、名称、Trait、招募和选中链路通过。
- `[macOS] macOS compatible` 人工查看新截图：PASS，SUR_001 / SUR_002 的 roster 与 detail 分别显示同一张对应头像，悬停未替换纹理，Camp 布局未改变。
- `[macOS] macOS compatible` Expedition HUD：PASS，248 checks / 0 failures。
- `[macOS] macOS compatible` Trait Foundation：PASS，44 checks / 0 failures；Rules：PASS，19 checks / 0 failures。
- `[macOS] macOS compatible` 文件命名检查、编码检查及 `git diff --check`：PASS。
- `[macOS] macOS compatible` 1600×900 截图（路径相对于 `apps/blue-hour/`，运行产物不纳入版本控制）：
  - SUR_001 选中：`test-output/camp-survivor-binding/camp-1600x900.png`
  - SUR_002 选中：`test-output/camp-survivor-binding/camp-sur002-1600x900.png`
  - SUR_002 悬停：`test-output/camp-avatar-integration/camp-avatar-hover-1600x900.png`

## Known Issues

- `[Windows] Windows environment required`：没有已授权的 Windows 设备或远程连接；Windows Godot 主运行、构建和独立程序启动尚未完成。用户此前明确要求先交付 macOS 验证结果。
- `assets/ui/expedition/portraits/` 中的历史 GLB 截图仍保留作历史资产，但当前 Camp、Expedition 头像绑定和 12 个正式 Definition 不引用它们。
- `SurvivorProfile` 当前仍由 catalog 按 `survivor_id` 关联，不是 Definition 的直接字段；本任务没有调整 Profile 数据模型。

## Environment

| 平台 | Godot Editor | Blender | Node | Git |
| --- | --- | --- | --- | --- |
| Windows | 无可访问设备，未验证 | 未验证 | 未验证 | 未验证 |
| macOS（Apple M3 Pro） | 4.7.2 stable；重新导入及 Compatibility 原生运行 | 5.2.1 LTS；已安装，本任务未使用 | v22.22.3；用于本地代码分析 | 2.55.0；用于变更检查 |

macOS 的资源导入、运行和截图结果不代替 Windows build 与 `.exe` 启动验收。
