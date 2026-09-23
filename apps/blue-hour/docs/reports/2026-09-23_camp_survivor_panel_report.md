# Task Report

## 1. Task Summary

将 Camp Survivor Panel 的 M04 Roster 与 M05 Detail 从功能版列表和深色信息面板改为角色展示卡。保留按 `survivor_id` 查询的正式 Survivor 数据与头像链路，不改招募、Trait、Progression、装备或 Camp 其他模块。

## 2. Changed Files

修改：

- `ui/camp_hud/portrait_slot.tscn`、`ui/camp_hud/portrait_slot.gd`：竖向头像卡、简化文字、选中与未选中视觉。
- `ui/camp_hud/survivor_roster.tscn`、`ui/camp_hud/survivor_roster.gd`：列表轨道、轻量滚动、按成员数量收紧高度。
- `ui/camp_hud/survivor_detail.tscn`、`ui/camp_hud/survivor_detail.gd`：角色展示卡结构、可选字段显示、装备/战力/属性/Trait/按钮样式。
- `ui/camp_hud/camp_hud_root.tscn`、`ui/camp_hud/camp_hud_root.gd`：详情面板位置与尺寸、Roster 高度布局。
- `tests/camp_roster_recruitment_integration.gd`、`tests/m05_selected_survivor_detail_data.gd`：更新结构断言、滚动验收与截图输出。
- `docs/PLAN.md`：记录展示版进度、验证与 Windows 待办。

新增：

- `docs/reports/2026-09-23_camp_survivor_panel_report.md`（本报告）。

删除：无。本轮未修改项目 `AGENTS.md`，其“每次项目修改必须输出报告”的约束继续执行。

## 3. Implementation Details

### Roster

单卡由 94×94 的文字覆盖头像，改为 100×110 的竖向角色卡。90×90 头像为主体，底部只显示正式姓名与 Lv. 等级；英文名、Trait 文本和状态点退出卡片可见区。选中卡使用既有蓝色选中框并提亮头像，未选中卡降低亮度。标题只显示“营地成员”和已招募数，不显示角色池分母。两名成员时轨道收紧至 272 px，四名及以上限制在 500 px；成员超过可见区后启用细滚动条。

### Detail Panel

面板从 354×452 调整为 378×500。上部采用深蓝角色展示区，右侧使用同一正式方形头像进行等比居中裁切；左侧显示姓名、SUR ID、等级、HP、现有角色标签、Profile 职业与短描述。下部改成浅色卡片，依次呈现装备与突出战力、四条属性进度条、Trait 能力卡、三个统一样式按钮。按钮有 normal、hover、pressed、disabled 样式；当前是否可用仍由既有 `action_states` 决定。

可选的角色标签、职业、短描述和 Trait 缺失时隐藏对应展示位；属性数组缺项时显示 0，避免索引错误。短描述先取 view data 中的 `quote`，否则从 SurvivorProfile 描述截取首句；未写入角色专属假台词。

### 数据流与图片来源

数据流保持为 `SurvivorRosterManager.get_recruited_survivors() → SurvivorDefinition / SurvivorProfile → SurvivorRosterAdapter → 同一 survivor_id 的 roster 与 detail`。M04 和 M05 复用同一 `portrait` 纹理，来源为 Definition 的 `portrait_path`，不按姓名、数组顺序或文件编号绑定。

| 绑定 ID | 正式资源来源 | 使用位置 |
| --- | --- | --- |
| SUR_001 | `res://assets/characters/xia_zhiyao/portrait/avatar_square.png` | Roster 卡与 Detail 大图 |
| SUR_002 | `res://assets/characters/su_wanxing/portrait/avatar_square.png` | Roster 卡与 Detail 大图 |
| 其余已招募成员 | 各自 Definition 指定的 `res://assets/characters/<character_id>/portrait/avatar_square.png` | Roster 卡与 Detail 大图 |
| 全部卡片的装饰框 | `res://assets/ui/camp/m04/m04_portrait_frame_normal.png`、`m04_portrait_frame_selected.png` | Roster normal / selected 边框；不参与角色身份绑定 |

没有从已弃用的 `assets/ui/camp/survivor_avatars/` 读取头像，也没有新增 GLB 截图或 portrait fixture。

## 4. Validation

| 检查 | 结果 |
| --- | --- |
| Godot 4.7.2 Headless Editor 导入 | PASS |
| Camp Roster 集成，含 2/12 人显示、招募刷新、存档恢复、12 人滚动 | PASS，0 failures |
| M05 详情数据与不同角色切换 | PASS，0 failures |
| 头像来源、roster/detail 同纹理、hover | PASS，0 failures |
| Godot 原生 Compatibility 渲染 1600×900 | PASS；Apple M3 Pro / OpenGL 4.1 Metal |
| 默认状态无详情面板 | PASS |
| SUR_001 / SUR_002 名称、头像、详情联动 | PASS |
| `git diff --check` 与中文编码检查 | PASS |
| Windows build 与独立 EXE 启动 | 未执行；当前无已授权的 Windows 设备 |

截图均为本机 Godot 原生渲染，分辨率 1600×900：

- [默认状态，无详情面板](../../test-output/camp-survivor-panel/camp-default-1600x900.png)
- [SUR_001 夏知遥选中](../../test-output/camp-survivor-panel/camp-sur001-1600x900.png)
- [SUR_002 苏晚星选中](../../test-output/camp-survivor-panel/camp-sur002-1600x900.png)
- [SUR_012 宋时雨切换详情](../../test-output/camp-survivor-panel/sur012-detail-1600x900.png)

## 5. Known Issues

- 现有 `SurvivorRosterAdapter` 的四维属性仍以当前 HP 比例生成相同数值；本轮只改变显示结构，未扩展属性数据层。
- 三个按钮的实际可用状态仍由现有 `action_states` 给出，当前均为 disabled；本轮只提供交互视觉状态，未接入新的操作逻辑。
- Windows 发布构建和独立程序启动仍待可访问的 Windows 环境。用户此前选择先交付 macOS 验证结果。

## 6. Environment

| 工具 | macOS environment | Windows environment |
| --- | --- | --- |
| Godot Editor | 4.7.2，已用于导入及原生渲染验收 | 无可访问设备，未运行 |
| Blender | 已安装，本轮未使用 | 无可访问设备，未运行 |
| Node | v22.22.3，已用于 GitNexus 影响检查 | 无可访问设备，未运行 |
| Git | 2.55.0，已用于变更检查 | 无可访问设备，未运行 |

[macOS] macOS compatible：代码、导入、运行截图和专项验证通过。

[Windows] Windows environment required：正式 build 与独立程序启动未验收。
