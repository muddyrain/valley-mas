# P1-C：最小营地整备与构建门禁验证

日期：2026-10-21。范围依据用户提供的《P1-C 最小整备与构建门禁》提示词及[玩法差距审计](deadly_days_core_gameplay_gap_audit_2026-10-21.md)。本文只记录本轮实际修改和验证，历史报告不计作当前通过证据。

## 1. 当前结果

已接回库存装备、成员间转交、卸下、固定日货单购买、食物训练，以及本轮已持有被动 / 能力的配装入口。营地新增“营地整备 [I]”；本轮成员详情中的装备 / 训练、左侧已装备能力和已开放道具槽也可进入同一页面。没有改动胜败、经济、冷却、XP、结算或存档 schema。

最小整备实现与定向验收通过：最终事务 59 / 0、原生完整路线 177 / 0；当前 Camp UI 在完整构建内 272 / 0，HUD 269 / 0。完整 Windows build **未通过**：989.325 秒、PowerShell exit1，随后旧 `camp_departure.gd` 的文字定位 / null 访问导致子检查 exit2。未生成当前源码新 EXE，不能宣称当前版本独立包已可交付。

## 2. 工作区与隔离环境

- 仓库：`D:/my-code/valley-mas`；分支 `master`，HEAD `865edec300e01d64d015924b3e6f391567ba46be`。未切分支、暂存、提交、推送、清理或发布。
- 起始工作区已有 P1-A / P1-B / 视觉精修、动画等大量修改与未跟踪文件。[起始 Git 状态](../../test-output/p1-c-preparation-20261021/git-before.txt)、[3214 文件原始哈希](../../test-output/p1-c-preparation-20261021/source-before.json)和源码副本均保留。
- 本轮任务差异按起始工作区比较，而非把全部 `git diff HEAD` 归为本轮成果。[独立差异](../../test-output/p1-c-preparation-20261021/task-only.diff)、[保护检查](../../test-output/p1-c-preparation-20261021/delivery-checks.json)可复核。
- 已读取根 CLAUDE、项目 AGENTS / PROJECT_CONTEXT、README、PLAN / VALIDATION、审计及 P1-A / P1-B / VISUAL 报告，核对开局、跨日、效果、武器和正式 UI 契约。当前没有可调用的 GitNexus 工具，已说明并采用原生 Git、rg 和调用链分析。
- Windows 11 Pro `10.0.26200`，Godot `4.7.2.stable.official.ed1daf0bf`，Compatibility / OpenGL 3.3，RTX 3060、NVIDIA 591.86；Git 2.39.1.windows.1。Node 26.4.0 / pnpm 11.21.0 已记录，Godot 验证不依赖 Node；没有把它们当作根项目要求的 Node 22 环境。
- 证据根目录：`test-output/p1-c-preparation-20261021/`。原生与完整构建在其中 `project/` 当前源码副本执行，避免旧脚本的固定截图路径覆盖历史证据。`override.cfg` 将 `user://` 指向独立 `BlueHourPreparation20261021`，保存使用 `test-runs/`；未读取或覆盖玩家真实存档。
- [实现清单](../../test-output/p1-c-preparation-20261021/implementation-manifest.json)和保护检查核对正式源码与验证副本；本轮新 `.gd.uid` 来自 Godot 导入生成，没有手写。
- macOS、手柄、低端 GPU及其他 Godot 版本未验证；没有新增跨平台兼容结论。

## 3. 根因分类与门禁处理

| 问题 | 分类与当前证据 | 本轮处理 / 边界 |
| --- | --- | --- |
| `member_buttons` | 测试依赖移除的内部结构；起始原生 `baseline-camp-ui` 再次访问不存在的字段。当前界面是 M04 名单、M05 详情，并非旧 CampScreen 按钮数组 | `camp_ui_runtime` 改验真实成员 ID、实际模型人数、当前详情按钮、原生整备入口、取消、输入隔离与持久化，没有补兼容假数组 |
| `PowerSlots` / “left edge” | 混合问题：旧节点定位失效；同时 M06 的本地展示信号没有玩家业务消费者。`CAMP_ACTION_RAIL_REPORT` 的旧范围只要求展示，不能据断言发明营地技能施放 | 读取实际装备能力，按治疗 / 增益决定入口可用性；打开持有能力的整备配装。真正施放仍在 Mission，沿用现有冷却；未装备治疗时医疗按钮禁用 |
| 库存 / 购买 / 训练无正式入口 | 正式玩家功能真实缺失；Campaign 和 Main 已有事务 API，但新 HUD 没有连接对应管理界面 | 新增独立原生整备面板，复用现有 API / Store；恢复完整玩家入口 |
| 旧 HUD “禁止美术” / 全部子节点恰好九个 | 测试契约与当前正式 UI 不一致。既有纸张、图标来自前阶段正式资源；新增整备入口是实际控件 | 仍逐项检查九个 M01–M09 模块及无遮挡、尺寸；额外检查真实整备入口；美术检查改为 TextureRect 不拦截交互 |
| HUD Escape / 出发检查 | 旧测试只发 physical_keycode、没有 release，也没等待今日行动开场动画；旧断言要求已不使用的 Camp 出发按钮锁定 | 使用完整键事件和动画等待；检查真实加载遮罩 / 世界锁定及最终 Mission。保留取消不改 Campaign、Camp 与相机不重建等行为断言 |
| `run.ps1` 指向 `tests/camp_hud_2.gd` | 运行器路径错误，当前仓库没有该脚本 | 改为现存 `camp_hud_skeleton_runtime.gd`；加入整备状态专项；不移除其他门禁、不关闭错误扫描 |
| 旧 `today_action` / `effect_runtime` | 源码复核仍访问旧 `screen.departure`、`effect_buttons`、F1 调试入口；旧审计失败是历史证据，本轮未单独复跑这两项 | 正式入口由新专项验证；未宣称两个旧脚本已修复。效果伤害、XP、旧地点和资源契约问题不能一律归为过期断言 |
| `camp_interaction` / `camp_clarity` / 旧物理出发专项 | 源码仍访问 `drawer`、`active_interactable`、`hud_root`、旧训练与效果面板；也混合设施与旧出发动画期望 | 不创建假设施或恢复已替换的物理出发流程来迎合旧断言；完整构建若在此阻断，按实际日志单列，不能视为全绿 |

旧 `camp_ui_runtime` 的身份、装备、资源、保存、队伍、输入和几何目标迁入当前可操作流程。旧私有卡片 / 弹窗字段与历史逐帧出发动画不再作为当前 UI 定位依据；没有添加空结构或测试专用生产节点。

## 4. 修改文件与实际数据流

| 文件 | 修改 |
| --- | --- |
| [core/main.gd](../../core/main.gd) | 整备生命周期 / 输入隔离 / I 与 ESC；确认状态校验；复用装备、卸下、购买、训练与效果替换事务；保存后原地刷新，保留营地与相机 |
| [ui/camp_preparation.gd](../../ui/camp_preparation.gd)（新增） | 原生 Control、Container、ScrollContainer、OptionButton、Button 与确认框；四页真实数据展示，稳定成员 ID / weapon UID；滚动跟随键盘焦点 |
| [ui/camp_hud/camp_hud_root.gd](../../ui/camp_hud/camp_hud_root.gd) | 真实整备入口；模板展示身份解析为本轮成员 ID；详情装备 / 训练接线；M07 被动槽显示实际装备与容量 |
| [ui/camp_hud/camp_action_rail.gd](../../ui/camp_hud/camp_action_rail.gd) | 左侧增益 / 医疗入口读取实际装备类型；未持有的能力不伪装可用 |
| [tests/camp_preparation.gd](../../tests/camp_preparation.gd)（新增） | 保存计数、失败注入、全状态及磁盘回滚、重复 / 无效输入、余额 / 等级边界、稳定 UID 所有权 |
| [tests/camp_preparation_runtime.gd](../../tests/camp_preparation_runtime.gd)（新增） | 原生输入交易、确认取消、错误反馈、两种窗口、续档、左侧能力配装、正式 Town 搜索至下一次外出的验收 |
| [tests/camp_ui_runtime.gd](../../tests/camp_ui_runtime.gd) | 当前 HUD 交互测试，1 / 2 / 4 人；共享原生整备验收，没有为旧字段增加兼容生产接口 |
| [tests/camp_hud_skeleton_runtime.gd](../../tests/camp_hud_skeleton_runtime.gd) | 当前 HUD 模块、窗口、输入与加载契约 |
| [run.ps1](../../run.ps1) | 接入状态专项，纠正不存在的测试路径 |
| 本报告、PLAN / VALIDATION | 新报告及仅追加本轮事实；保留原文与历史结论 |

新增三个脚本各有引擎生成 `.gd.uid`。未修改 Campaign、SaveStore、RunLedger、Mission、武器定义、经济数据、地图、动画或角色资源。没有新增美术；纸张、按钮、字体与正式 Definition 头像均复用现有资源。

数据流：`Campaign.data` → HUD / 整备页面只读展示 → 确认框携带成员 ID、UID 与临时事务前快照 → Main 校验当前完整状态仍一致 → 既有 Campaign API → `_save(before)` → 刷新模型、名单、资源与当前整备页。临时快照用于确认及回滚，不是第二份资源数据所有者。

转交使用现有 `Campaign.equip`：原持有人解除装备，目标持有该 UID；不会暗中把目标原武器交换给另一人。卸下不销毁库存。相同型号不同 UID 各有独立操作行。满槽能力替换必须明确选择旧能力，不默认替掉第一个槽。

## 5. 事务与规则边界

装备、卸下、购买、训练分别注入 Store 写失败，验证一次写入尝试、完整 Campaign 字典与原磁盘文件不变、HUD 从回滚后的数据读取；成功分支每次只保存一次。过期确认再次提交被拒绝；确认框本身保留既有关闭防重入保护。

原生购买额外模拟同一按钮的两个不同回调，确认只扣一次、只入库一次、只保存一次；售罄后按钮不可再次购买。原生保存失败展示现有错误对话框，随后可正常重试。能力替换也覆盖失败恢复旧槽、无效替换不丢旧能力、成功只提交一次。

余额不足、无效请求、满级训练、取消与重复刷新不修改资源。价格、训练成本、Trait 成长、口粮与五日胜败规则均沿用原实现；未开放武器升级、道具升级、扩槽、奖励链、设施、营救或新角色池。

## 6. 测试方法与证据

引擎路径：`C:/Users/A/Downloads/Godot_v4.7.2-stable_win64.exe/Godot_v4.7.2-stable_win64_console.exe`。

以下 `$P` 指证据目录中的绝对 `project` 路径；所有真实参数、耗时、退出码与引擎错误扫描均保存在同名 `*.result.json`、`*.stdout.log`、`*.stderr.log`。运行器为[run-check.py](../../test-output/p1-c-preparation-20261021/run-check.py)，不把 exit0 且仍有 `SCRIPT ERROR/ERROR` 的结果判为通过。

```powershell
& $Godot --path $P --headless --script tests/camp_preparation.gd
& $Godot --path $P --position -3000,-3000 --audio-driver Dummy --script tests/camp_preparation_runtime.gd
& $Godot --path $P --position -3000,-3000 --audio-driver Dummy --script tests/camp_ui_runtime.gd
& $Godot --path $P --position -3000,-3000 --audio-driver Dummy --script tests/camp_hud_skeleton_runtime.gd
# 定向回归分别替换 --script；含渲染等待的脚本没有用 Headless 冒充原生结果。
pwsh -NoProfile -File "$P/run.ps1" -Mode build -GodotPath $Godot
```

| 检查 | 当前结果 / 证据 |
| --- | --- |
| 整备状态与失败回滚 | 最终 59 项 / 0 失败、exit0，20.381 秒：[final-transactions](../../test-output/p1-c-preparation-20261021/final-transactions.result.json)。在原 55 项基础上补充真实原持有人转交失败及未知商品 UID 检查 |
| P1-A 资源日期 | 62 项 / 0，另原生 186 项 / 0 已在本轮完整构建前段执行 |
| 名单 / 队伍 / 招募目录隔离 | camp_party 31 / 0；camp_roster_recruitment_integration 0 失败（该脚本不输出总检查数），均 exit0；见同目录 regression 结果 |
| 开局 / 跨日 / 存档目录兼容 / 结束数据 | new_run 40 / 0、day_loop 43 / 0、save_catalog_compatibility 9 / 0、run_end_state 138 / 0，均 exit0；不是旧报告复用 |
| 当前 HUD 几何与输入 | 269 项 / 0，exit0：[hud-input-final](../../test-output/p1-c-preparation-20261021/hud-input-final.result.json)；1600×900、1280×720、1024×640、1920×1080、2560×1080 |
| 原生整备及完整路线 | 最终 177 项 / 0 失败、exit0，226.845 秒：[preparation-final-derived](../../test-output/p1-c-preparation-20261021/preparation-final-derived.result.json)、[流程记录](../../test-output/p1-c-preparation-20261021/project/test-output/preparation-final-derived/runtime.json)。前一轮 176 / 0 的证据仍保留 |
| 当前 Camp UI + 整备路线 | 完整构建实际执行 272 项 / 0 失败；1 / 2 / 4 人的当前 HUD、公开入口及共享原生整备路线，无 member_buttons / PowerSlots 错误 |
| P1-B 原生与视觉 / 正式终态流程 | 本轮完整构建实际执行 138 / 500 / 366 / 133 项，均 0 失败；不以历史专项数替代 |
| 旧 Camp 出发专项 | 当前独立原生复跑 exit2，178.921 秒；两个 Visible input target 错误、随后第41行对 null 调用 get_global_rect，未完成后续演出检查：[departure-contract-current](../../test-output/p1-c-preparation-20261021/departure-contract-current.result.json) |
| 完整 Windows build | FAIL，989.325 秒，exit1；Camp UI 和 HUD 通过后被旧 camp_departure 子检查 exit2 阻断；[结果](../../test-output/p1-c-preparation-20261021/build.result.json)、[stdout](../../test-output/p1-c-preparation-20261021/build.stdout.log)、[stderr](../../test-output/p1-c-preparation-20261021/build.stderr.log) |

早期失败全部保留：起始缺整备 API 的红测试、旧 member_buttons / PowerSlots；初轮购买测试给购买操作错误传入成员 ID；原生双重连接同一 Callable 的测试错误；形成路径验证传入未类型化空数组；HUD 不完整键事件 / 动画等待；实地路线最初搜索被随后移动取消、未揭示建筑、以及 60 秒搜索 / 返程时限不足。对应 `baseline-*`、`preparation-*`、`current-*`、`hud-*` 日志未删除，失败不计为通过。最终有效结果另列；没有通过清敌、无敌、注入掉落、强制结算或删断言完成路线。

### 正式搜索 → 下一日装备路线的证据边界

初始 seed 772、30 食物 / 100 废料、同型号第二实例与额外治疗能力均为明确的隔离夹具；不宣称自然赚取这些资产。页面的购买、训练、装备、保存与续档是真实事务。成员下拉测试使用 OptionButton 的元数据及原生选择信号，不能冒充全部由物理鼠标选择条目完成。

随后通过 M08 / 今日行动卡片进入正式 `MEDIUM_TOWN_V1`（map seed 113420、正常伤害、存活 director、1×时间）。测试通过当前确定性奖励函数选择真实武器来源 `A09_P46`，属于脚本已知路线，不能当作盲玩探索或随机掉落统计。全队移动与搜索走真实路径；约 212 米后在现场实际拾取 `mission-loot:1:airdrop:A09_P46`，K9 / rarity 2 / `RELOAD_SPEED_UP` + `RANGE_UP`。日志记录拾取时游戏钟约 95.53 秒，两人当时均 100 HP。

按 E 步行返车、真实上车 → 正常结果页确认 → 回营库存出现该 UID → 正式整备确认装备 → 再次选择行动并出发。下一次 Mission 的实际成员 combat.weapon_uid、伤害、射程和换弹时间与 Campaign 同实例一致，最终日志为 damage 7、range 13.44、reload_time 1.476，断言在最终 177 / 0 中执行。搜索与归航等待分别保留 140 / 150 秒有界期限，没有缩短路程或修改移动 / 搜索 / 结算规则。这只证明本条受控路线闭环，不证明自然第五日胜利或整体平衡。

## 7. 原生截图与视觉检查

当前原生截图位于 `test-output/p1-c-preparation-20261021/project/test-output/preparation-final-derived/`：

- [库存 1600×900](../../test-output/p1-c-preparation-20261021/project/test-output/preparation-final-derived/inventory-1600x900.png)、[库存 1024×640](../../test-output/p1-c-preparation-20261021/project/test-output/preparation-final-derived/inventory-1024x640.png)。
- [货单 1600×900](../../test-output/p1-c-preparation-20261021/project/test-output/preparation-final-derived/shop-1600x900.png)、[货单 1024×640](../../test-output/p1-c-preparation-20261021/project/test-output/preparation-final-derived/shop-1024x640.png)。
- [训练 1600×900](../../test-output/p1-c-preparation-20261021/project/test-output/preparation-final-derived/training-1600x900.png)、[最小窗口键盘聚焦训练](../../test-output/p1-c-preparation-20261021/project/test-output/preparation-final-derived/training-keyboard-1024x640.png)。
- [能力 1600×900](../../test-output/p1-c-preparation-20261021/project/test-output/preparation-final-derived/powers-1600x900.png)、[能力 1024×640](../../test-output/p1-c-preparation-20261021/project/test-output/preparation-final-derived/powers-1024x640.png)。
- [购买失败后的回滚界面](../../test-output/p1-c-preparation-20261021/project/test-output/preparation-final-derived/purchase-write-failure-1600x900.png)。截图在错误对话框隐藏后取得；对话框可见性由原生断言验证，没有把隐藏后的图片当作弹窗证据。

已目视检查库存正常窗口与训练最小窗口、键盘滚动后状态。纸张、标题、四页入口、成员选择和返回按钮保持在窗口内；最小窗口内容内部滚动，头像可随内容移出视口，成本与训练按钮能够通过聚焦滚入。保留现有视觉结构，没有全局重设计。视觉等待用户验收，测试通过不能替代视觉判断。

## 8. 完整构建、新 EXE 与剩余事项

完整调用未跳过任何原有门禁，结果为 **FAIL**，989.325 秒、exit1。按执行顺序通过导入、P1-A 62 / 186、整备 55、P1-B 138 / 500 / 366 / 133、搜索72、外出 HUD265、指令45、指令线554、搜索卡157、设置14、营地菜单30、当前 Camp UI272、HUD269，随后到旧 `tests/camp_departure.gd`：

- 第34 / 35行仍用旧“今日行动”“商业街”按钮文字定位，两个 Visible input target 失败；第41行对空按钮调用 get_global_rect，后续演出断言没有执行；脚本计时退出2，PowerShell正常拒绝继续。
- 当前生产入口为 M08 / TodayAction 卡片和确认按钮。`Main.start_mission` 使用现存 RuntimeLoadingOverlay；[加载契约报告](../archive/2026-10/stages/EXPEDITION_RUNTIME_LOADING_REPORT.md)明确该入口已替换先走 Camp 登车演出再淡黑的流程。本轮 177 项与构建内272项已通过真实选择、加载、到场和后续 Mission，不能把旧测试定位失败说成正式出发完全不可用。
- 属于旧定位（分类2）及后续历史演出预期（分类3）的混合脚本。没有在这轮恢复旧动画 / 设施，也没有删其断言或绕过它导出。后续 Camp / World / 武器等完整门禁和导出没有执行；不能推断它们会通过。
- 完整链中整备55项、原生共享路线176项执行后，额外补充了转交回滚 / 未知商品及射程 / 换弹验证；最终59 / 177在独立组重新通过。构建内 Camp UI总272是当时版本，不能混写为273。生产实现与最终验证副本字节一致，补充测试没有更改规则或生产行为。

**新 Windows EXE：未生成。新 EXE 独立启动：未运行 / 未验证。** 没有失败后手工导出。现有 canonical EXE仍为2026-09-24旧产物，1,730,183,136 bytes，SHA-256 `E194539E347E5B2757B4C61107E2EBBAD98352DC44AE43FE7A40D0E26951B627`；[本轮复核](../../test-output/p1-c-preparation-20261021/exe-after.json)确认没有被替换。不能用该旧包验收本轮 UI。

保护核对：起始3214个文件无缺失、无额外越界变化；6个既有实现 / 运行器文件及2个计划记录文件属于授权修改，其余3206个原文件哈希不变。新增实现、元数据与本报告另计。PLAN / VALIDATION仅在标题之后追加本轮事实，原正文保留；定向 encoding-guard、git diff --check和报告本地链接核对结果随交付检查保存。

仍需另行授权处理：历史 Camp / 效果 / 设施与出发动画专项的契约迁移，以及审计中的独立战斗 / XP / 资源规则失败。不能以本轮整备接线通过宣布这些问题已解决。自然胜利路线、真实游玩平衡和奖励链也不由受控资源夹具证明。

建议首先完成旧 Camp 出发门禁的契约迁移：以当前真实控件定位、选择锁定、加载遮罩输入隔离、Ready Gate和 Mission 身份为验收目标；旧物理登车演出应按已替换的产品契约单独归档，不补假节点。然后重新从头跑完整 build，再逐项分类后续失败。`Main.set_effect_equipped / debug_effects` 的旧 show_effects 消费者及 F1 测试路径没有恢复为正式入口；本轮玩家配装走新确认事务，不授予免费能力或升级。

本任务不自动进入下一阶段。
