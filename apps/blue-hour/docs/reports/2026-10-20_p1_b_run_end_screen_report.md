# P1-B：Run 结束页与动态成员结果

## Task Summary

本次仅实施 P1-B：修复审计 F02 的终态空页，新增胜败共用的原生结束页、独立 `RunMemberResultCard`、按真实记录重建的成员列表，以及返回主菜单和重新出发入口。不实施 P1-C，不改资源经济、武器升级、设施、结算规则或存档结构。

交付范围是当前源码与专项验证；Windows 完整构建结果在下方单独记录。自然五日失败与受控胜利夹具严格区分，界面视觉仍需用户验收。

## 工作区与审计基线

- `[Windows]` 工程：`D:/my-code/valley-mas/apps/blue-hour`。
- 分支 `master`；HEAD `865edec300e01d64d015924b3e6f391567ba46be`；缓存远端关系 ahead 4 / behind 3，没有 fetch、切分支、暂存、提交、推送或清理。
- 开始时已有 30 项未提交修改 / 未跟踪成果，包括动画、指令线、P1-A、报告及运行脚本。起始 [Git 状态](../../test-output/p1-b-run-end-20261020/baseline-status.txt)、[文件哈希](../../test-output/p1-b-run-end-20261020/baseline-hashes.json) 和共享文件副本已保存。
- 阅读共享规则、项目 AGENTS / PROJECT_CONTEXT、游戏定位契约、PLAN / VALIDATION、审计 F02 / P1-B、README、UI 素材与美术规范，以及当前 Campaign / Store / 结算 / 开局 / 测试实现。
- 当前没有 GitNexus MCP 工具，使用原生 Git 和源码追踪。修改影响局限于 `show_shelter()` 的终态分支；其日常营地调用、`_refresh_screen()`、读档完成及日结算出口继续复用既有路径。Campaign / Store / Ledger 未修改。
- 修复前用 Campaign API 生成合法五日 won 夹具，正式 main.tscn 进入 `ended` 后 `screen=null`，exit 1：[F02 复现日志](../../test-output/p1-b-run-end-20261020/test-output_p1-b-run-end-20261020_baseline-headless.stdout.log)。这是终态装配复现，不是自然通关证据。

## Changed Files

| 类型 | 文件 | 本次职责 |
| --- | --- | --- |
| 修改 | [core/main.gd](../../core/main.gd) | 仅增加结束页预加载和 ended 分支装配 / 导航信号 |
| 新增 | [ui/run_end_summary.gd](../../ui/run_end_summary.gd) | 只读汇总终态、真实成员、损失原因与资源 |
| 新增 | [ui/run_end_screen.gd](../../ui/run_end_screen.gd) | 共用胜败布局、动态滚动网格和两项真实操作 |
| 新增 | [ui/run_member_result_card.gd](../../ui/run_member_result_card.gd) | 独立可复用 `RunMemberResultCard` |
| 新增 | [tests/run_end_fixtures.gd](../../tests/run_end_fixtures.gd) | 明确隔离的 Campaign API 人数 / 伤亡夹具 |
| 新增 | [tests/run_end_state.gd](../../tests/run_end_state.gd) | 身份、记录、原因、存档恢复与只读验证 |
| 新增 | [tests/run_end_runtime.gd](../../tests/run_end_runtime.gd) | 原生渲染、滚动、动态人数、边界和重复输入 |
| 新增 | [tests/run_end_flow.gd](../../tests/run_end_flow.gd) | 正式五日失败及受控胜利末次结算 / 恢复 / 重开 |
| 修改 | [run.ps1](../../run.ps1) | test 增加状态专项；capture / build 增加原生专项与流程门禁，共六条调用 |
| 修改 | [PLAN](../PLAN.md)、[VALIDATION](../VALIDATION.md) | 追加 P1-B 当前证据与构建边界，保留历史 |
| 新增 | 本报告及上述七个 GDScript 的 `.uid` | 交付记录与 Godot 身份文件 |

未新增、修改或裁切运行时 PNG，不删除文件。测试日志、截图、临时验证器和构建产物留在忽略提交的 `test-output/` / `build/`。

## Implementation Details

### 根因与数据所有权

`core/main.gd:show_shelter()` 原先只设置 `state="ended"`，随后仅为 `shelter` 分支创建控件。现在终态分支清理行动表现并创建同一结束页，胜败只改变标题、色调、原因和文案。

数据链为：

```text
Campaign.data（唯一 Run 状态）
  → RunEndSummary.from_campaign（只读投影）
    → RunEndScreen（摘要与成员网格）
      → RunMemberResultCard.setup（成员展示数据）
```

| 展示项 | 实际来源及约束 |
| --- | --- |
| 胜败 | `Campaign.data.status` 的 `won/lost`；不通过日期猜测胜败 |
| 天数 / 目标 | `data.day` / `catalog.loop.end_day`；提前失败显示真实结束日 |
| 食物 / 废料 | 已提交的 `data.food` / `data.scrap`；不把 pending 或 history 奖励再加一次 |
| 幸存人数 | `data.members.size()`；与本轮历史成员卡数量分别显示 |
| 本轮实际成员 | 所有 history 的 `returned_ids/lost_ids/starved_ids/stayed_ids` 与当前 `members` 的 ID 去重并集 |
| 生还 | ID 仍在当前 `members` |
| 战斗阵亡 | history 的 `lost_ids`，来源是 Mission 的死亡成员列表 |
| 缺粮损失 | `commit_day()` 记录的 `starved_ids`，沿用首次缺粮宽限、连续缺粮减员规则 |
| 姓名 / 正式头像 | 稳定 Run `member_id` → `Campaign.member_template(id)` → `SurvivorDefinition.survivor_id` / `display_name` / `portrait_path` |
| 失败原因 | 最后一次真实结算的战斗 / 缺粮损失；支持同时发生；证据缺失时显示原因记录不详 |

不遍历 `catalog.survivors`、解锁目录、`survivor_states` 或全部 `data.roster` 生成名单。`member_id` 是 Run 内身份，`survivor_id` 是正式角色内容身份，二者均不由数组位置或名字推导。

### 历史数据缺口与最小处理

当前 v5 正常终态的历史足以还原成员与既有两种损失原因，无需新增字段。现有 `roster` 保留死亡角色，但 v1 迁移会把**整个角色目录**填入 roster，不能把它作为“参加过本轮”的名单。专项覆盖了真正的 v1 迁移并证实不会生成目录中的虚假成员。

如果旧档既没有相关历史，也没有当前存活 ID，现有数据无法证明遗失成员是谁；页面不猜测、不补齐角色。历史出现过但没有可证明损失原因的成员标为“记录不详”。完全没有成员证据且无人存活时显示“无人生还”，不生成空卡。不能借本次 UI 修复补造旧档伤亡历史。

最小方案是维持存档协议，按已有证据展示。未来真正的营救补员需要先设计 Campaign 所有的 Run 成员登记和原因枚举，再评估迁移；本次不修改这项长期规则。当前角色目录中的“已招募”状态不等同于该角色实际加入本轮。

### 成员卡片与布局

- `RunMemberResultCard` 独立于 Campaign / Store，输入只有单个成员的 ID、内容身份、姓名、正式头像路径和已证实状态，可被其他结果界面复用。
- 原生 `VBoxContainer → PanelContainer → ScrollContainer → GridContainer → RunMemberResultCard`。标题、摘要、结语和底部操作位于成员滚动区之外。
- 单成员一列；多成员在可用逻辑宽度 ≥570 时两列，否则一列；行数由数据自然增长，没有人数截断或占位成员。
- 8 / 12 人继续内部滚动，页面和操作栏高度不随人数增长。滚动到最后一张后检查底部位置不变并实际点击菜单按钮。
- 1600×900 为主布局；1024×640 为 project.godot 的最小窗口。窄窗口按比例调整纸张区域与整体字号，只有成员区滚动。最小窗口的失败页允许卡片在成员区域内部滚动查看。
- 长姓名省略并保留完整姓名 tooltip；头像不存在时显示中性 `?`，不以另一角色头像替代；损失卡使用对应状态颜色并降低头像亮度。

### 素材盘点与使用

| 既有资源 | 使用位置 / 绑定 |
| --- | --- |
| `assets/ui/common/backgrounds/ui_common_background.png` | 两种终态的背景氛围；失败降低亮度，不承载交互 |
| `assets/ui/common/branding/ui_common_logo_tagline.png` | 通过已有 `MenuArt.logo()` 的品牌区域显示 Logo |
| `assets/ui/common/panels/ui_common_paper_panel.png` | 复用 `MenuArt.dialog_paper()`，摘要主纸张 |
| `assets/ui/common/cards/ui_common_card_paper.png` | 每名成员的空白纸卡，原生文字叠加 |
| `assets/ui/route_selection/route_selection_tab_tape.png` | 成员卡片胶带装饰 |
| `assets/ui/common/buttons/ui_common_blue_button_normal.png` | 返回主菜单按钮 |
| `assets/ui/today_action/today_action_button_green.png` | 重新出发按钮底图，文字与点击为原生 Button |
| 各 `SurvivorDefinition.portrait_path` | 正式 `assets/characters/<character_id>/portrait/avatar_square.png`，按身份绑定 |
| `MenuArt.theme()` / `NewRunArt.body_font()` / `title_font()` | 沿用已有字体策略；中文与英文标签均为原生 Label / Button |

没有把三张参考图放入运行资源，没有用设计图固定文字、数值或按钮替代交互。现有背景足以承载本阶段氛围，但胜败使用同一张既有单角色背景；没有两名角色分别对应胜败的新专属插画，也没有参考图的大字书法切图。没有必要素材缺口，因此未增加新资产。

### 入口与事务边界

1. 正常最后一日或全灭：现有 Settlement 确认 → Campaign.commit_day → 原 Store 成功写入 → `_refresh_screen()` → 共用结束页。
2. 终态继续：既有标题菜单“继续” → 原读档 / loading → `show_shelter()` → 相同结束页；不重跑日结算。
3. 返回主菜单：结束页发信号 → 原 `show_main_menu()`；保留终态存档供继续查看。
4. 重新出发：发信号 → 原 `confirm_new_run()/show_new_game()`，进入专精草稿。取消保持终态存档；确认后走原 `create_run()` 保存事务，恢复 Day1 / Food6 / Scrap0、两名实际开局成员及空历史。
5. 结束页导航有一次性操作锁，同一控件被重复点击只发出一次动作。展示、重新进入、滚动均不调用扣粮、结算或保存。

本次不显示“查看本轮记录”：没有接入新的记录浏览页面，不用空按钮或推测出来的战斗日志充数；已有 daily history 仅作为成员与原因的证据来源。

## Validation

### 可复制命令

从仓库根目录执行，`[Windows]`：

```powershell
$engine = 'C:/Users/A/Downloads/Godot_v4.7.2-stable_win64.exe/Godot_v4.7.2-stable_win64_console.exe'
& $engine --headless --path apps/blue-hour --editor --import --quit
& $engine --headless --path apps/blue-hour --script tests/run_end_state.gd
& $engine --path apps/blue-hour --position -3000,-3000 --resolution 1600x900 --audio-driver Dummy --script tests/run_end_runtime.gd
& $engine --path apps/blue-hour --position -3000,-3000 --resolution 1600x900 --audio-driver Dummy --script tests/run_end_flow.gd
& $engine --headless --path apps/blue-hour --script tests/rules.gd
& $engine --headless --path apps/blue-hour --script tests/day_loop.gd
& $engine --headless --path apps/blue-hour --script tests/new_run.gd
& $engine --headless --path apps/blue-hour --script tests/save_catalog_compatibility.gd
& $engine --headless --path apps/blue-hour --script tests/camp_campaign_state.gd
./apps/blue-hour/run.ps1 -Mode build -GodotPath $engine
```

本轮运行由保存的 [专项驱动](../../test-output/p1-b-run-end-20261020/run-validation.ps1) / [构建驱动](../../test-output/p1-b-run-end-20261020/run-build.ps1) 调用上述引擎与参数。每个 `*.result.json` 保存精确命令、时间、耗时、退出码及日志错误检查；原生窗口位于屏幕外并使用合成输入，截图来自实际 Godot Viewport。不是浏览器重绘或人工游玩记录。

### 实际结果

| 验证 | 结果 | 证据 |
| --- | --- | --- |
| 修复前 F02 | FAIL，won / ended / screen null，exit1 | `test-output_p1-b-run-end-20261020_baseline-headless.*` |
| Godot editor import | PASS，exit0，无脚本 / 引擎 ERROR | `import-headless.*` 及完整构建日志 |
| Run 结果数据 | PASS，138 项 / 0 失败 | `run_end_state-headless.*`；完整构建复跑 |
| 原生成员 / 布局 / 输入 | PASS，500 项 / 0 失败 | [人数验证 JSON](../../test-output/p1-b-run-end-20261020/population-runtime.json)、`run_end_runtime-native.*`；完整构建复跑 |
| 正式终态流程 | PASS，133 项 / 0 失败，完整构建链内完成 | [流程 JSON](../../test-output/p1-b-run-end-20261020/flow-runtime.json)、完整构建 stdout 第152行；旧单独运行的中断日志不作为本次通过证据 |
| rules / day_loop / new_run | PASS，19 / 43 / 40 项，均 0 失败 | 同名 `*-headless.*` |
| save_catalog_compatibility / camp_campaign_state | PASS，9 / 62 项，均 0 失败 | 同名 `*-headless.*` |
| 完整 Windows build | FAIL / BLOCKED，427.489秒、exit1，既有 Camp UI 门禁阻断 | [build.result.json](../../test-output/p1-b-run-end-20261020/build.result.json)、[stdout](../../test-output/p1-b-run-end-20261020/build.stdout.log)、[stderr](../../test-output/p1-b-run-end-20261020/build.stderr.log) |

所有上述日志位于 `test-output/p1-b-run-end-20261020/`。没有删除断言、跳过失败来完成导出。

### 真实流程与夹具的边界

`run_end_flow.gd` 的失败段从正式 main.tscn 的标题菜单新建，连续五日选择住宅区、真实集结 / 上车 / 外出、按 E 真实撤离、确认结算；开启正常伤害和刷怪，无注入食物，无调用内部强制结束方法。前四日余粮 4、2、0、0，第五日连续缺粮使实际两名成员损失并进入失败页。

胜利段明确使用 Campaign API 创建四次已结算记录及第五日 pending 夹具，写入隔离存档后重建主场景，实际点击继续 / 最后确认，验证 won 装配、资源显示、唯一历史及终态再次恢复。它不证明自然搜刮五日通关的平衡或完整胜利路线。所有人数和状态扩展图都是隔离夹具，未改正式开局人数与角色池。

### 原生截图

人数图均为 Campaign API 隔离夹具。8 / 12 人截图已滚动到列表末尾，底部按钮仍位于窗口内。

| 实际夹具卡数 | 1600×900 | 1024×640 |
| --- | --- | --- |
| 1 | [单卡](../../test-output/p1-b-run-end-20261020/fixture-won-1-1600x900.png) | [单卡最小窗](../../test-output/p1-b-run-end-20261020/fixture-won-1-1024x640.png) |
| 2 | [两卡](../../test-output/p1-b-run-end-20261020/fixture-won-2-1600x900.png) | [两卡最小窗](../../test-output/p1-b-run-end-20261020/fixture-won-2-1024x640.png) |
| 3 | [三卡](../../test-output/p1-b-run-end-20261020/fixture-won-3-1600x900.png) | [三卡最小窗](../../test-output/p1-b-run-end-20261020/fixture-won-3-1024x640.png) |
| 4 | [四卡](../../test-output/p1-b-run-end-20261020/fixture-won-4-1600x900.png) | [四卡最小窗](../../test-output/p1-b-run-end-20261020/fixture-won-4-1024x640.png) |
| 8 | [八卡滚动](../../test-output/p1-b-run-end-20261020/fixture-won-8-1600x900.png) | [八卡最小窗](../../test-output/p1-b-run-end-20261020/fixture-won-8-1024x640.png) |
| 12 | [超过八人](../../test-output/p1-b-run-end-20261020/fixture-won-12-1600x900.png) | [十二卡最小窗](../../test-output/p1-b-run-end-20261020/fixture-won-12-1024x640.png) |

| 状态 / 来源 | 1600×900 | 1024×640 |
| --- | --- | --- |
| 正式自然五日缺粮失败 | [失败页](../../test-output/p1-b-run-end-20261020/actual-five-day-loss-1600x900.png) | [最小窗](../../test-output/p1-b-run-end-20261020/actual-five-day-loss-1024x640.png) |
| 受控 pending 胜利后的真实末次确认 | [胜利页](../../test-output/p1-b-run-end-20261020/controlled-final-victory-1600x900.png) | 人数表两卡图覆盖最小窗布局，属于另一夹具 |
| 全员战斗损失夹具 | [战斗失败](../../test-output/p1-b-run-end-20261020/fixture-combat-2-1600x900.png) | [最小窗](../../test-output/p1-b-run-end-20261020/fixture-combat-2-1024x640.png) |
| 无人生还、保留历史卡片的缺粮夹具 | [缺粮失败](../../test-output/p1-b-run-end-20261020/fixture-starved-2-1600x900.png) | [最小窗](../../test-output/p1-b-run-end-20261020/fixture-starved-2-1024x640.png) |
| 一生还、一战死、两缺粮损失夹具 | [混合状态](../../test-output/p1-b-run-end-20261020/fixture-mixed-4-1600x900.png) | [最小窗](../../test-output/p1-b-run-end-20261020/fixture-mixed-4-1024x640.png) |
| 明确替换单卡输入的长姓名 / 缺失头像夹具 | [长姓名与中性占位](../../test-output/p1-b-run-end-20261020/fixture-long-name-missing-portrait-1600x900.png) | [最小窗](../../test-output/p1-b-run-end-20261020/fixture-long-name-missing-portrait-1024x640.png) |
| 零个可证明的历史成员 | 不作为正常 v5 完整流程证据 | [零记录夹具](../../test-output/p1-b-run-end-20261020/fixture-zero-recorded-members-1024x640.png) |

### 失败与修正记录

- 首轮原生布局 488 项 / 6 失败：失败原因 Label 首次换行时扩大 VBox 的最小高度，后续没有重新约束列尺寸，导致按钮超出窗口。修复 minimum_size_changed 后同组 488 / 0；初始日志和截图保留于 `first-layout-failure/`。
- 增加“滚动后点击”断言时发现合成输入没有完整释放滚轮和移动鼠标；补全真实输入顺序后 500 / 0。初始 500 项 / 4 失败保留于 `input-harness-failure/`，没有改生产按钮来规避检查。
- 流程驱动首次直接比较 JSON 读档与内存 Variant，因序列化类型转换失败；改为比较**全量 JSON 表示**，并保留原有内存和存档字节完全不变断言。其后合成设备 42 与项目 ui_cancel 设备映射不匹配，测试改走实际取消按钮；进一步核对按钮文本后消除了按数组末位误点确认的问题。失败及中断日志在 `first-flow-failure/`、`second-flow-failure/`、`third-flow-interrupted/`。这些不作为流程通过证据，最终结果只看修正后的完整运行。

## Known Issues / 未覆盖边界

- 未自然游玩胜利路线，也未在该自然路线中收集资源直到第五日胜利；受控 won 数据与末次实际确认已明确标识。
- 最小窗口下成员区域可能只显示部分卡片，需要内部滚动；标题、摘要与底部按钮不随名单滚动。
- 人数原生验证到 12；实现没有人数上限，但未对几十或数百成员进行性能压力测试。
- 历史已丢失的成员与原因无法从角色目录恢复；没有发明“失联”或设计稿示例台词。未来额外损失类别需要其真实记录支持。
- SystemFont 的字体可用性依赖平台；本轮没有 macOS、手柄、超宽屏或低端 GPU 结论。
- 用户视觉与手感验收独立于原生自动化。没有新配音、新专属胜败插画或完整本轮记录浏览功能。
- 完整构建与当前源码独立程序交付状态必须以下方收尾记录为准。

## Environment

| 平台 | 实际环境 |
| --- | --- |
| `[Windows] Windows environment required` | Windows 11 专业版 10.0.26200；i5-12400F；RTX 3060；Godot 4.7.2.stable.official.ed1daf0bf；Compatibility / OpenGL；匹配 Windows x64 导出模板存在 |
| Windows Godot Editor | 同一 Console 引擎执行 headless editor import 与原生运行 |
| Windows Blender | 本轮未使用；PATH 未找到，不据此断言未安装 |
| Windows Node / Git | Node26.4.0、pnpm11.21.0、Git2.39.1.windows.1；context:recent 有 Node engine 范围 warning，Godot 项目独立运行 |
| `[macOS] macOS compatible` | 未访问；Godot Editor、Blender、Node、Git 与 UI 实际运行均未验证 |

## 收尾记录

### Windows 构建与独立程序

2026-10-20 22:49:16 至 22:56:23（+08:00）实际执行 `run.ps1 -Mode build`，427.489秒，exit1。导入、P1-A 状态62 / 原生186、本轮状态138 / 原生500 / 流程133，以及搜索72、外出HUD265、指令45、指令线554、搜索卡157、设置14、营地菜单30均通过。

随后原有 [tests/camp_ui_runtime.gd](../../tests/camp_ui_runtime.gd) 第114行访问当前 HUD 不存在的 `member_buttons`，第23行“Camp exposes active abilities on its left edge”断言失败，构建停止。该脚本与 Camp HUD 在本次开始前已有不一致；未修改它们或删除断言，未绕过门禁另行导出。

没有当前 P1-B 源码的新 Windows 包，因未导出，当前新包的独立程序启动**未验证**。现有 [build/BlueHourHomeward.exe](../../build/BlueHourHomeward.exe) 仍为2026-09-24旧产物，1,730,183,136 bytes；SHA-256 前后均为 `E194539E347E5B2757B4C61107E2EBBAD98352DC44AE43FE7A40D0E26951B627`，见 [构建前](../../test-output/p1-b-run-end-20261020/exe-before.json) / [构建后](../../test-output/p1-b-run-end-20261020/exe-after.json)。`BUILD-INFO.json` 仍描述旧产物，不能作为 P1-B 发布验收。

### 交付保护与停止边界

- 已追加 PLAN / VALIDATION 的 P1-B 当前状态，保留 P1-A 及历史审计原文，不把旧“未开始”历史记录改成当时已经完成。
- 本轮原生26张截图已生成，目视检查自然失败、受控胜利、多成员滚动、缺粮最小窗及长姓名 / 缺失头像；几何和点击验证见人数 JSON。没有用设计图或浏览器截图替代 Godot 原生渲染。
- PASS：[交付核对 JSON](../../test-output/p1-b-run-end-20261020/delivery-checks.json) 确认起始27个其他修改 / 未跟踪文件哈希不变；移除本轮新增章节和六条门禁调用后，PLAN / VALIDATION / run.ps1 与起始副本一致；构建清单771个源码 / 配置文件到收尾时哈希不变，截图对应当前实现。报告本地链接均存在，定向 encoding-guard 与 `git diff --check` 通过。
- 本轮启动的 Godot 进程均已退出，没有新增长驻服务；没有 Git 暂存、提交或推送。
- 本阶段到此停止；P1-C、自然胜利完整试玩、构建阻断修复和其他后续任务均不自动开始。用户仍需验收视觉与手感。
