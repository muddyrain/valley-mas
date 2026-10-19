# Blue Hour V0 — 正式游戏运行基线验证报告

日期：2026-10-19，Asia/Shanghai。平台：**[Windows] Windows environment required**。

**结论：P1-01～P1-05 均取得当前运行失败证据；正式 Medium Town 尚不能完成可信的归航闭环。** 导入、解析、主菜单、新游戏、今日行动、Town 加载、移动和一次建筑搜刮可运行。昼夜、暂停、撤离、营地操作、结束页及旧测试契约存在下述失败。

本次只验证；未修复、重构或修改正式游戏代码、资源、配置、Skills、历史 Plan。没有调用内部结算方法让流程继续。自然结算、下一天和正常五日通关保持 **BLOCKED**，不以规则测试或结束存档替代。

依据：[首次静态审计](./blue_hour_baseline_audit.md)、[G0 入口修复报告](./blue_hour_ai_entry_repair_report.md)。以下结论以本次实际运行及当前磁盘快照为准。

## 1. 快照、环境与隔离

### 1.1 当前工作区，而非旧 HEAD 副本

- Monorepo：`D:/my-code/valley-mas`；游戏：`apps/blue-hour`。
- HEAD：`8004ebabc6823c1c238045bf5406916879ed134b`，分支 `master`，跟踪 `origin/master`；未 fetch。
- 开始状态：`T  AGENTS.md`、`M  CLAUDE.md`，以及两份依据报告未跟踪。前两个条目为**已有暂存改动**，不是本轮暂存。本轮开始时根 AGENTS 索引已是 `100644`；这与 G0 历史报告中的“尚未转换索引”不同，不能继续沿用旧状态。
- 副本直接复制当前磁盘内容，共 **3,094 文件**，逐文件 SHA-256 核对。未用 `git archive HEAD`、旧 EXE 或旧 `.godot` 替代。根入口正文另保存快照与哈希。

工作区入口 SHA-256：

```text
AGENTS.md  c0355369857e63b06d1f0b575b323462063994b45ec7925f0804240e0cd4551e
CLAUDE.md  ffdab826287de89d0df748aeb6d10b99e641c6a61b9d5809a4363b290e4f11d2
```

本报告的证据根目录，下文简称 **E**：

`apps/blue-hour/test-output/v0-runtime-baseline/20261019-01/`

快照：[snapshot.json](../../test-output/v0-runtime-baseline/20261019-01/snapshot.json)、[source-manifest.json](../../test-output/v0-runtime-baseline/20261019-01/source-manifest.json)、`E/entry-snapshot/`。当前没有可调用的 GitNexus 工具，Git 检查采用原生命令；未重建索引。

### 1.2 实测环境

| 项目 | 实际值 |
|---|---|
| OS | Windows 11 专业版，10.0.26200，x64 |
| Godot | `4.7.2.stable.official.ed1daf0bf` |
| 引擎目录 | `C:/Users/A/Downloads/Godot_v4.7.2-stable_win64.exe/` |
| GPU / 驱动 | NVIDIA GeForce RTX 3060；Windows 驱动 `32.0.15.9186` |
| 原生渲染日志 | `OpenGL API 3.3.0 NVIDIA 591.86 - Compatibility` |
| 主流程截图 | 1600×900；旧营地 UI 脚本自行设为 1920×1080 |
| 音频 | Dummy；听觉验收 NOT_TESTED |
| Python / Node / Git | 3.13.5 / v26.4.0 / 2.39.1.windows.1 |
| 视频编码 | 现存 ffmpeg 8.1.1，H.264 MP4 |
| Blender | 未使用，PATH 未发现；开始及收尾均未发现 Blender 进程 |
| macOS | 无可访问环境，NOT_TESTED |

详细记录与引擎文件哈希：[environment.json](../../test-output/v0-runtime-baseline/20261019-01/environment.json)。Node 未用于执行 pnpm/构建门禁，本次不调整工具链。

### 1.3 隔离与输入方式

- 独立工程：`E/sandbox/project/`。排除原 `.godot`、`.import` 缓存目录、`build`、`exports`、`test-output`、Git 元数据、临时文件及 `export_credentials.cfg`；保留正式资源和资源 `.import` 描述文件。
- 子进程的 APPDATA、LOCALAPPDATA、TEMP、TMP 均指向 `E/profile/`。旧测试另按运行名隔离 profile，避免同名测试存档相互覆盖。
- 启动探针实际确认 `OS.get_user_data_dir()` 落在本次 `E/profile/...`。正式 App 使用 `user://test-runs/v0-*.json`；未读写真实玩家存档。
- 原生窗口位于 `(-3000,-3000)`，不可聚焦；启动使用隐藏子进程。只向测试进程的 Godot Viewport 推送 device 42 输入，没有激活桌面窗口、注入系统键鼠、接管或结束用户 Godot/Blender。
- 测试驱动实例化正式 **`res://core/main.tscn`**，由其原有 `_ready`、UI 信号、加载门禁和物理调度推进；没有修改正式脚本或手动 tick Mission。
- `--test-menu` 抑制 `--test-save` 默认三人 fixture，首次新局由菜单确认创建，实际为两人。Debug 接敌及结束存档场景在后文明确单列。

## 2. 安全执行与基础检查

已审阅 `run.ps1`、SaveStore、Settings、主入口、两个 EditorScenePostImport 脚本，以及所执行旧测试的继承链和输出路径。导入脚本只处理导入对象；所有缓存均在副本生成。

没有执行 `run.ps1 -Mode test/capture/build`，也没有通配执行 `tests/*.gd`。动画资源生成、导航烘焙等写正式资源的工具未运行。旧 `day_loop_runtime.gd` 包含直接 `_finish(false)` 的流程，本次没有运行其 `run()`，更没有把这种 fixture 当成正式闭环通过。

所有准确参数、耗时和退出码保存在 `E/logs/*.result.json`，并有对应 `.stdout.log`、`.stderr.log`、`.engine.log`。

| 检查 | 结果 | 证据 |
|---|---|---|
| 全新副本 `--headless --editor --import --quit` | PASS，exit 0，208.266s；无 SCRIPT ERROR / ERROR | `logs/import.*` |
| 隔离用户目录探针 | PASS，exit 0 | `logs/legacy-environment.*` |
| `--headless --check-only --script res://core/main.gd` | PASS，exit 0；无脚本错误 | `logs/parse-main.*` |
| 正式主场景 Headless 启动 120 帧，`--test-save=v0-smoke.json --test-menu` | PASS，exit 0 | `logs/smoke.*` |
| 正式场景原生渲染与后续操作 | 已运行 663.086s；退出 0，仅表示测试进程正常关闭，**不代表玩法通过** | `logs/main.*`、`trace.json` |

## 3. 正式流程验证矩阵

PASS 只表示该行所列范围；FAIL 是实际观察到的偏差；BLOCKED 是前置流程失败后无法正常到达；NOT_TESTED 表示本次没有有效完成验收。

| 项目 | 状态 | 复现与实际结果 | E 内证据 |
|---|---|---|---|
| 主菜单 → 开始游戏 → 确认创建 | PASS | 默认搜集专精创建 Run，day=1、两人、food=6、scrap=0，进入营地 | `screenshots/00-title.png`、`01-new-game.png`、`02-camp.png` |
| 营地头像与详情 | PASS | 点击头像显示对应幸存者详情；可见按钮状态另见 P1-03 | `screenshots/03-camp-survivor-disabled.png` |
| 今日行动 → 商业街 → 确认出发 | PASS | 正式 UI 完成选图与加载；未直接调用 start_mission | `screenshots/08-today-action.png`、`09-commercial-selected.png` |
| 默认 Medium Town | PASS | `MEDIUM_TOWN_V1`；全部 Ready Gate 为 true；两轮正式行动 seed 为 37729972、37834701 | `logs/main.stdout.log` 的 EXP_LOAD；`screenshots/10-medium-town.png` |
| 小队移动 | PASS | 点击道路后两人从巴士附近移动到新阵位并发现建筑 | `screenshots/13-movement.png`；`trace.json` 中坐标 |
| 建筑搜刮及拾取 | PASS，单点范围 | 点击“住宅 B”，A00_P00 最终 searched=true；搜索任务释放，账本新增 food=2、scrap=3 | `screenshots/14-poi-detail.png`、`15-search-progress.png` |
| 战斗、扣血、死亡、击杀 | PASS，Debug 接敌限定 | 通过可见 Debug“普通感染者”生成接敌；实际敌人攻击、队员死亡，恢复运行后击杀计数增加；未开无敌 | `screenshots/19-debug-spawn-paused.png`～`30-unpaused-wipe-still-active.png`；`videos/pause-combat.mp4` |
| 自然遭遇完整战斗路线 | NOT_TESTED | 自然敌人已在正式场景生成并移动；本次伤害/击杀证据来自 Debug 接敌，不能扩大为自然遭遇平衡通过 | `trace.json` |
| 昼夜自然推进 | FAIL | 首次 Space 前连续运行约 233.198s，day=150s、blue=18s，clock 仍为 0，画面维持白昼 02:30 | P1-01 |
| Space / Esc / 设置 / Debug 暂停 | FAIL | time_scale=0 时敌人继续移动；Space 与 Debug 接敌还实际扣血、死亡 | P1-02 |
| ×2 / ×4 倍速 | NOT_TESTED | 两次合成输入尝试均未成功选择 OptionButton 弹出菜单，time_scale 未取得 2/4；是自动化限制，不能据此判倍速功能失败 | `screenshots/35-speed-options.png`、`36-speed-x2-clock-stuck.png`；`extra/trace.json` |
| 撤离 | FAIL | 第二轮出生点 2/2 已在巴士范围，按 E 后等待仍为准备 8.0s，无关门/结果 | P1-01；`screenshots/32-all-at-bus-stuck.png`、`33-all-at-bus-still-stuck.png` |
| 撤离结算 → 下一天 | BLOCKED | 正式撤离未完成，不能验证自然日结算、一次入账或跨日保存 | 无伪造结算画面 |
| 全灭 → 失败结算 | FAIL | living=0；解除暂停后 active=true、state=mission，未进入结果 | `screenshots/29-space-all-dead-no-result.png`、`30-unpaused-wipe-still-active.png` |
| 营地装备、训练、效果操作 | FAIL | 装备/升级禁用；点击 M06/M07 没有业务界面或事务变化 | P1-03 |
| 正常五日通关 / 自然失败后的结束页 | BLOCKED | 正式任务结束链路阻断，未到达正常 won/lost | 未调用内部结算方法 |
| 读取 won / lost 后的结束页 | FAIL，存档入口限定 | 两种隔离存档被正式入口接受；点击继续后 ended，空画面、无按钮，Esc 无返回 | P1-04 |

主 Run seed 为 **37617324**。完整输入操作、节点路径、按钮几何、状态、坐标、生命值、随机地图及保存数据在 [trace.json](../../test-output/v0-runtime-baseline/20261019-01/trace.json)；定量摘要在 [runtime-summary.json](../../test-output/v0-runtime-baseline/20261019-01/runtime-summary.json)。部分采集文件名是执行前标签，例如 `27-wiped-still-mission` 当时仍有一名活人、`36-speed-x2-clock-stuck` 并未成功切到 ×2；以 JSON 和实际画面为准，不按文件名宣称结果。

## 4. P1 风险逐项结果

### P1-01 — FAIL：正式 Town 的时钟、全灭和撤离没有进入终局

复现：正常新局 → 商业街 → Town → 点击地面移动、点击“住宅 B”搜索 → 等待 → E 归航。第一轮归航时为 0/2，不能仅凭这轮判断“全到位仍不撤离”。随后通过 Esc 返回主菜单、继续同一天，再正常选行动；**第二轮出生点已经 2/2**，直接按 E，无其他战斗或 Debug 条件。

实际结果：

- 首次 Space 之前约 233.198s 持续正常运行，超过 150s 白天及 18s 蓝时配置，`clock.elapsed=0.0`、phase=DAY。首次 Town 至解除全灭暂停的总观察跨度为 408.196s，其中后段含暂停；不把这个总跨度写成连续未暂停时长。
- 第二轮从出生快照至再次检查为 17.830s，`time_scale=1`、living=2、board_count=2、extraction=true，`extraction_left=8.0`、`closing_left=-1`、active=true。后续录制时仍不推进。
- 真实攻击造成 living=0 后，解除 Space 暂停再等待，仍 `mission / active=true / time_scale=1`，没有全灭结算。

代码对应：`core/main.gd:683` 选择正式 provider；`missions/mission.gd:337–359` Town 分支提前返回；后续时钟、living 空判定及 `_update_extraction` 位于旧分支。`command_extract:1131` 设状态，完成逻辑在 `1150–1174`。这解释了本次现象，但运行结论来自上述场景状态，并非只凭静态推断。

证据：[全员在车旁画面](../../test-output/v0-runtime-baseline/20261019-01/screenshots/33-all-at-bus-still-stuck.png)、[11 秒实录](../../test-output/v0-runtime-baseline/20261019-01/videos/all-boarded.mp4)、[解除暂停后的全灭画面](../../test-output/v0-runtime-baseline/20261019-01/screenshots/30-unpaused-wipe-still-active.png)、`trace.json`、`logs/main.*`。影响：结算、扣粮、下一天及正常通关链路全部 BLOCKED。

### P1-02 — FAIL：暂停只冻结 Mission，敌人仍推进

复现：正式 Town 中按 Space；分别用 Esc、设置和 F1 打开暂停界面，读取同一批真实敌人前后坐标。近距离伤害场景额外通过游戏自带 Debug 按钮生成普通感染者；未改 HP、位置或无敌标志。

| 暂停入口 | 实际观察跨度 | 结果 |
|---|---:|---|
| Space | 5.416s | scale=0；8 名已有敌人都移动，最大 4.756m，Ambient 更新 12959→13276 |
| Esc 菜单 | 3.233s | scale=0；8 名已有敌人移动，最大 2.835m |
| 设置 | 6.356s | scale=0；8 名已有敌人移动，最大 5.329m；本段未观察到额外扣血 |
| Debug，普通感染者接敌 | 20.887s 墙钟时间 | scale=0；生命值 [100,100]→[84,100]，敌人到达并攻击；后续持续暂停中发生死亡 |
| Space，近距离接敌 | 15.415s | scale=0；[0,28]→[0,0]，最后一名幸存者死亡 |

采集会改变帧耗时，墙钟时间不等同于测试请求的 timer 时长；这些不是性能测量。Esc/设置只确认位置未冻结，没有把静态攻击可能性写成这两个入口都已实际扣血。

代码对应：`ui/mission_hud.gd:859–863` 设置 Mission.time_scale；`missions/mission.gd:323–325` 停止推进；`encounter/ambient_threat_runtime.gd:36–52` 仍使用原始 delta 更新敌人，未检查该时间倍率。

证据：[暂停前后画面](../../test-output/v0-runtime-baseline/20261019-01/screenshots/20-debug-paused-damage.png)、[暂停战斗实录](../../test-output/v0-runtime-baseline/20261019-01/videos/pause-combat.mp4)、`screenshots/16`～`29` 对应文件、`runtime-summary.json`。倍速选择未成功，**敌人在 ×2/×4 下的速率比尚未验证**。

### P1-03 — FAIL：正式营地未提供可用的装备和相关操作

复现：新局营地点击 SUR_001 头像 → 点击“装备”“升级幸存者” → 点击左侧临时增益、底部空装备槽。

实际结果：三个详情动作均 disabled=true、pressed 业务连接数为 0；点击禁用按钮无变化。M06/M07 可见交互没有打开业务界面；Campaign 的装备、等级、资源及效果状态未因此改变。没有通过内部旧入口强行触发缺失方法错误，购买/转交/效果替换的底层事务也没有被本次验证为通过。

代码对应：`core/main.gd:279–285` 只配置 roster 和三个信号；`ui/camp_hud/survivor_roster_adapter.gd:115` 明确返回禁用动作；`survivor_detail.gd:221–224` 消费这些状态；`camp_action_rail.gd` 和 `loadout_panel.gd` 仅发本地请求。设施点击和营地出发表现的全部分支本次未覆盖。

证据：[禁用详情按钮](../../test-output/v0-runtime-baseline/20261019-01/screenshots/03-camp-survivor-disabled.png)、`screenshots/04`～`07` 对应文件、[营地操作实录](../../test-output/v0-runtime-baseline/20261019-01/videos/camp-interactions.mp4)、`trace.json`。另观察到营地显示食物10/废料60，而实际新局为6/0，符合审计 P2-01；本轮未扩展修复。

### P1-04 — FAIL：继续结束存档后没有结束界面

由于 P1-01 阻断自然结束，本项采用**隔离存档 fixture**：从本次正常创建后保存的营地状态复制，仅调整 won/day5，或 lost/空存活名单、装备与出战名单，并清空 pending/selected_action。由正式 SaveStore 与 Campaign 验证读取，未直接调用 stage_result、settle、_finish 或 show_shelter。

操作：各自启动正式 main.tscn → 点击“继续” → 等待加载 → Esc。

实际结果：won 和 lost 均被接受并进入 `ended`；画面仅有清屏背景，没有结束按钮，Esc 后仍为 ended。原生进程均正常退出 0；这是功能失败、不是引擎崩溃。**不能据此宣称五日路线或失败结算已通过。**

代码对应：`core/main.gd:266–286` 对 won/lost 清场并设 ended，仅 shelter 分支创建 UI；`151–175` 没有 ended 的返回入口。

证据：[won 空画面](../../test-output/v0-runtime-baseline/20261019-01/ended-won/screenshots/01-continued-ended.png)、[lost 空画面](../../test-output/v0-runtime-baseline/20261019-01/ended-lost/screenshots/01-continued-ended.png)、`ended-{won,lost}/fixture.json`、各自 `trace.json` 和 `logs/ended-*.log`。

### P1-05 — FAIL：旧测试断言与当前 UI / Trait 契约失配

以下均先审阅后在副本定向执行；没有批跑或修改测试断言。不是正式游戏闭环的替代证据。

| 脚本与模式 | 当前实际结果 | 判断 |
|---|---|---|
| `camp_departure.gd`，Headless | exit 2；两次 `Visible input target` 错误；41 行 null.get_global_rect；脚本自身 150s timeout，含启动共167.061s | “今日行动/商业街/确认出发”的旧目标查找与现 UI 失配，未完成出发断言 |
| `camp_ui_runtime.gd`，Headless | exit 2，137.435s；停在第二组人口截图等待，未获得 member_buttons 运行断言 | BLOCKED：Headless 不能完成该原生采集等待，不能把它算作属性失败 |
| 同脚本，屏幕外原生 | exit 1，22.058s；114 行实际访问不存在的 `member_buttons`；23 行 `Camp exposes active abilities on its left edge` 断言失败 | FAIL：确认旧 UI 契约失配 |
| `remaining_survivor_batch.gd`，Headless、未传 capture | exit 1，337 checks、1 failure：`cheng_mo Phase B Trait remains data-only` | FAIL：旧 data-only 断言仍失败；当前 `morale_boost.tres:11` 为 periodic_effect，不应因旧断言撤回现功能 |

后者只写副本 `test-output/.../runtime-qa.json`，未生成或改写正式动画资源。日志中的个别 `BATCH QA PASS` 打印不能覆盖最终 failure 清单。

证据：`logs/legacy-camp-departure.*`、`logs/legacy-camp-ui.*`、[原生 UI 错误日志](../../test-output/v0-runtime-baseline/20261019-01/logs/legacy-native-camp-ui.stderr.log)、[旧断言前的真实营地截图](../../test-output/v0-runtime-baseline/20261019-01/screenshots/37-legacy-camp-ui-before-error.png)、`logs/legacy-survivor-batch.*`、`sandbox/project/test-output/survivor-batch-integration/runtime-qa/runtime-qa.json`。

原有 `build/BUILD-INFO.json` 的 fullBuildPassed=false 只是历史背景；本轮未启动旧 EXE、未重新导出，未把任何旧产物当本次通过证据。

## 5. 证据采集、复现与限制

- 截图直接来自真实 Godot Window/Viewport 的渲染纹理；没有重绘、拼装或用旧图替代。主流程截图1600×900，已查看关键菜单、营地、Town、暂停与空结束画面。
- 视频为 Godot 连续 PNG 采样后用 ffmpeg 编码，保留原画面；按帧文件写入时间构造变帧率时间线。没有插值生成中间画面。约11s、36s、53s、62s，详细信息见 `E/videos/metadata.json`；原始帧在 `E/frames/`。采样和 I/O 会影响运行节奏，不能用于 FPS、延迟或性能结论。
- 完整工具：`E/tools/snapshot.py`、`launch.py`、`scenario.py`、`ended_fixtures.py`、`media.py`、`summarize.py`；观察驱动在 `E/sandbox/project/validation/driver.gd`。驱动后续仅补了独立会话输出和倍速弹出菜单输入尝试；正式源文件始终未改。
- 命令行与保存路径由每次 `logs/*.result.json` 记录。顺序为导入 → 隔离探针 → 解析/基础启动 → 正式场景交互 → 结束存档入口 → 定向旧断言；后段允许独立旧测试与入口验证并行，不据此评估性能。
- 本轮没有验证完整存档迁移/损坏恢复、保存失败回滚、全部角色和武器表现、多 seed 地图稳定性、自然遭遇平衡、听觉、独立 EXE 或 macOS。没有以历史 PASS 补足这些缺口。

待人工验收：用可交互的隔离运行完成 ×2/×4 选择并对照角色、敌人、搜索和技能计时；自然遭遇的战斗与控制手感、音频；P1-01 修复后再完成日夜、归航、结算、下一天和五日结束全链。当前无法到达的结算和结束画面不补造截图。

## 6. 下一阶段修复顺序

| 顺序 | 范围 | 下一轮验收门槛 |
|---|---|---|
| 1 | P1-01：将通用时钟、全灭、撤离与完成推进接入正式 Town | 正常入口自然昼夜；0/2→2/2→准备→关门→唯一结果；全灭有失败结果；结果后可正常跨日 |
| 2 | P1-02：统一 Mission 与 AmbientThreat 的暂停/倍速时间契约 | 四种暂停中位置、攻击、HP、计时冻结；恢复连续；×1/×2/×4 下各系统一致 |
| 3 | P1-04：补齐 won/lost 结束装配和退出入口 | 正常五日/自然失败与读取结束存档都显示结果，并能返回/新开 |
| 4 | P1-03：按当前营地 HUD 接回装备、训练、交易及效果请求 | 可见入口触发业务；显示、Campaign 与保存一致；失败回滚；覆盖新旧 UI 的明确产品取舍 |
| 5 | P1-05：更新场景级回归契约并分离原生采集、规则和生成工具 | 删除失效断言前明确新契约；增加正式 main→Town 跨系统门禁，保留新失败证据；全量回归后再谈构建通过 |

以上只是后续顺序，**本轮没有授权或执行修复**。旧测试失败应在对应修复时同步纠正，不能最后绕过门禁直接导出。

## 7. 保全与交付检查

- 唯一新增正式文档：本报告。证据、测试副本、独立 profile 和工具全部在用户指定 `test-output/v0-runtime-baseline/` 下。
- 原3,094文件的 SHA-256 核对无变更；原缓存、构建及既有测试产物的 **19,715 项文件大小/mtime** 核对无变化。此处缓存证明是元数据对比，没有夸称逐字节哈希验证。
- 根 G0 文件哈希、HEAD 及已有暂存区记录保持；两份依据报告原样保留。未 add、commit、push、reset、stash、切换分支或清理。
- 所有本轮启动的 Godot 进程已退出，未留下运行服务；未操作用户原有 Godot/Blender。
- 保全结果见 [preservation-verification.json](../../test-output/v0-runtime-baseline/20261019-01/preservation-verification.json)。本报告 encoding-guard：PASS；20 个本地链接：PASS，无缺失；Git 空白检查：PASS。完整收尾结果见 [final-checks.json](../../test-output/v0-runtime-baseline/20261019-01/final-checks.json)。
- 不同步历史 Plan：本轮仅建立运行基线，用户明确禁止修改历史 Plan；未改变游戏实现状态，也未继续旧计划。
