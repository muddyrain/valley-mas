# 蓝时归航 P1-A 营地资源与日期真实绑定报告

日期：2026-10-20，Asia/Shanghai。基准 HEAD：`865edec300e01d64d015924b3e6f391567ba46be`。本轮只实施 P1-A，未实施 P1-B、整备入口恢复、武器升级或基地设施。

## Task Summary

已将营地食物、废料、双语日期和口粮状态绑定到当前 Campaign。正常空手归航后，正式 HUD 显示 Day 2、Food 4、Scrap 0，与 Campaign 和保存记录一致；继续游戏、再次归航、新开局替换和重复刷新已取得专项证据。

运行代码的改动集中在营地 HUD 根节点和两个模块的默认文案，没有修改 `core/main.gd`、`core/campaign.gd`、`save_store.gd`、行动逻辑或经济规则，也没有修改布局、图标、字体、材质和角色资产。

P1-A 源码和专项验收完成，Windows 整包交付仍为 BLOCKED：完整 build 在既有 Camp UI 门禁停止，未生成新 EXE。具体结果见 Validation。

## Changed Files

### 修改

| 文件 | 修改内容 |
| --- | --- |
| [ui/camp_hud/camp_hud_root.gd](../../ui/camp_hud/camp_hud_root.gd) | 绑定当前 Campaign 对象；增加只读刷新；在配置、名单刷新和恢复可见时同步资源、日期、口粮状态 |
| [ui/camp_hud/resource_bar.tscn](../../ui/camp_hud/resource_bar.tscn) | 未绑定时的资源值改为中性占位，移除 10/60/3 示例余额 |
| [ui/camp_hud/camp_identity.tscn](../../ui/camp_hud/camp_identity.tscn) | 日期和状态默认值改为中性占位，运行时绑定真实数据 |
| [tests/camp_resource_bar_runtime.gd](../../tests/camp_resource_bar_runtime.gd) | 将新开局数值期望改为当前正式 6/0/—；保留所有结构、贴图、几何、尺寸与副作用断言 |
| [tests/camp_identity_runtime.gd](../../tests/camp_identity_runtime.gd) | 将介绍文案期望更新为当前口粮状态；保留全部布局和文字几何断言 |
| [run.ps1](../../run.ps1) | 在原有用户修改基础上追加四条调用：test 的状态专项、capture 的原生专项、build 的两组专项 |
| [docs/PLAN.md](../PLAN.md) | 追加本轮 P1-A 状态，保留既有未提交计划内容 |
| [docs/VALIDATION.md](../VALIDATION.md) | 追加当前验证结果和边界，保留历史记录 |

### 新增

- [tests/camp_campaign_state.gd](../../tests/camp_campaign_state.gd) 及对应 `.gd.uid`。
- [tests/camp_campaign_runtime.gd](../../tests/camp_campaign_runtime.gd) 及对应 `.gd.uid`。
- 本报告。

### 删除

无。没有删除或跳过失败断言，没有提交或推送。

日志、截图、起始快照和一次性运行器位于忽略目录 [test-output/p1-a-camp-state-20261020](../../test-output/p1-a-camp-state-20261020/)。原有 `run.ps1`、`PLAN.md` 的改动保留，其余原有修改按起始哈希复核。

## Implementation Details

### 根因与修复前证据

[审计 F01](2026-10-20_project_audit_and_next_phase_plan_report.md) 在本轮起点仍成立：`Main.show_shelter()` 实例化 `CampHUDRoot` 后只调用 `configure_roster(catalog, campaign)`。该入口原先只配置成员列表，没有配置 M01 日期和 M03 资源值。

资源场景仍写着食物 10、废料 60、情报 3，身份模块仍写着 DAY 01 和第 1 天。因此结算数据虽已正确推进，显示仍停留在示例状态。

先新增同一份状态专项，在生产改动前实际得到 **62 checks / 39 failures，exit 1**；失败包括新开局资源、跨日日期、缺粮状态和重新绑定后的显示。[修复前结果](../../test-output/p1-a-camp-state-20261020/before/state-report.json)、[修复前执行元数据](../../test-output/p1-a-camp-state-20261020/before/camp_campaign_state-headless.result.json)。

### 数据所有权与绑定链

```text
Main 持有 Campaign
  → show_shelter 创建 HUD
  → configure_roster(catalog, campaign) 绑定同一 Campaign 对象
  → refresh_campaign_state 每次读取当前 campaign.data
  → M03 食物、废料；M01 双语日期、口粮状态
```

HUD 只持有 Campaign 对象引用，没有持久复制余额或日期。局部 `state` 在每次调用时重新读取；`Campaign.data` 因载入、重新开局或失败回滚而整体替换后，刷新仍读取新字典。

| 显示目标 | 正式数据源 | 绑定方式 |
| --- | --- | --- |
| `M03_ResourceBar/ResourceFood/Value` | `Campaign.data.food` | 直接显示当前值 |
| `M03_ResourceBar/ResourceScrap/Value` | `Campaign.data.scrap` | 直接显示当前值 |
| `M01_CampIdentity/CampInfoPanel/DayEn` | `Campaign.data.day` | `DAY %02d` |
| `M01_CampIdentity/CampInfoPanel/DayCn` | `Campaign.data.day` | `第 %d 天` |
| 口粮储备状态 | `food`、`members.size()`、`catalog.loop.food_per_member` | 按所有当前成员计算今晚需要量，不按内容目录或出勤人数计算 |
| 已生效缺粮状态 | `Campaign.data.hunger`、`Campaign.health_multiplier()` | 区分库存不足与既有缺粮影响，显示规则计算的生命上限 |
| 情报槽位 | 当前 Campaign 没有情报货币字段 | 保留槽位和图标，显示“—”，不引入新经济字段 |

有缺粮影响时，即使库存改变，也不会提前宣称惩罚解除；惩罚是否解除仍由正式结算和现有规则决定。显示层不处理扣粮、减员、日期推进或存档。

### 刷新入口

| 场景 | 既有路径与刷新行为 |
| --- | --- |
| 新开局 | `create_run` 成功保存后调用 `show_shelter`，新 HUD 配置时读取当前 Campaign |
| 继续游戏 | 主场景读取并恢复 Campaign，通过继续按钮的既有加载流程进入营地，再配置 HUD |
| 归航结算 | `return_to_shelter` 仍负责保存、提交和保存下一日；随后既有 `_refresh_screen → show_shelter` 创建并配置 HUD |
| 重新进入营地 | `show_shelter → configure_roster` 同步当前状态 |
| 名单刷新 | `refresh_roster` 额外调用只读状态刷新 |
| 取消今日行动 | 既有 `_close_today_action → set_hud_visible(true)` 恢复同一营地 HUD，并重新读取状态 |
| 单独重复刷新 | `refresh_campaign_state` 只改 Label；不调用 Campaign 事务或 SaveStore |

不新增逐帧余额轮询或第二份资源状态，不改变 Main 和 Campaign 的事务顺序。

### UI 与资产边界

保持现有九模块结构、尺寸、位置和缩放规则。使用身份卡原有两行描述呈现口粮状态，没有新建弹窗或增加功能入口。今日行动仍由原出发按钮打开、原取消按钮或 Esc 关闭；本轮原生验证使用实际按钮操作。

既有 UI 图片继续由场景的显式资源路径绑定：M01 为 `assets/ui/camp/m01/camp_logo_main.png`、`camp_identity_panel_bg.png`；M03 为 `assets/ui/camp/m03/m03_resource_chip_bg.png`、`m03_icon_food.png`、`m03_icon_scrap.png`、`m03_icon_intel.png` 和既有菜单素材。没有扫描目录、按数组顺序重新绑定图片或把截图作为运行资源。Survivor、Portrait 和模型绑定未改变。

## Validation

### 方法和命令

所有命令从仓库根目录执行，使用 `[Windows]` Godot 4.7.2 Console。主场景测试存档位于 `user://test-runs/`，不读取或覆盖玩家 Run。

```powershell
$p1aGodot = 'C:/Users/A/Downloads/Godot_v4.7.2-stable_win64.exe/Godot_v4.7.2-stable_win64_console.exe'
& $p1aGodot --headless --path apps/blue-hour --editor --import --quit
& $p1aGodot --headless --path apps/blue-hour --script tests/camp_campaign_state.gd
& $p1aGodot --path apps/blue-hour --position -3000,-3000 --resolution 1600x900 --audio-driver Dummy --script tests/camp_campaign_runtime.gd
& $p1aGodot --path apps/blue-hour --position -3000,-3000 --resolution 1600x900 --audio-driver Dummy --script tests/camp_resource_bar_runtime.gd
& $p1aGodot --path apps/blue-hour --position -3000,-3000 --resolution 1600x900 --audio-driver Dummy --script tests/camp_identity_runtime.gd
./apps/blue-hour/run.ps1 -Mode build -GodotPath $p1aGodot
```

定向 Headless 回归逐项执行 `rules.gd`、`day_loop.gd`、`new_run.gd`、`save_catalog_compatibility.gd`、`mission_dayloop.gd`、`camp_roster_recruitment_integration.gd` 和 `camp_party.gd`。

实际执行还传入各自的 `--log-file`。精确命令、起止时间、退出码和错误扫描结果保存在证据目录每个 `*.result.json`，同时保留 stdout、stderr 和 Godot 日志。[运行器](../../test-output/p1-a-camp-state-20261020/run-validation.ps1)。

### 定向结果

| 验证 | 实际结果 | 边界 |
| --- | --- | --- |
| 修复前状态专项 | FAIL，62 checks / 39 failures，exit 1 | 先复现 F01 |
| 修复后状态专项 | PASS，62 checks / 0 failures，exit 0 | 真 HUD 和 Campaign；规则结算为受控输入，不冒充真实出勤 |
| 正式原生流程 | PASS，186 checks / 0 failures，exit 0 | 真实 Main 场景、合成输入、两次真实空手出勤、归航、结算、继续和替换新开局 |
| Headless Import | PASS，exit 0，无匹配的脚本错误 | 当前源文件导入 |
| rules | PASS，19 / 0 | 基础规则 |
| day_loop | PASS，43 / 0 | 跨日、口粮、保存失败等规则 |
| new_run | PASS，40 / 0 | 开局和旧版本迁移规则 |
| save_catalog_compatibility | PASS，9 / 0 | 旧目录/存档兼容 |
| mission_dayloop | PASS，26 / 0 | Town/City 归航和唯一结果边界 |
| camp_roster_recruitment_integration | PASS，0 failures | 原名单、选择和恢复集成 |
| camp_party | PASS，31 / 0 | 成员与出勤规则 |
| camp_resource_bar_runtime | FAIL，525 checks / 12 failures，exit 1 | 全部失败来自继承的 M07/M08/M09“无美术”断言 |
| camp_identity_runtime | FAIL，392 checks / 12 failures，exit 1 | 同一组 M07/M08/M09“无美术”断言 |

两个旧视觉专项仍调用 `camp_hud_skeleton_runtime.verify_layout()`，其中要求 M07_LoadoutPanel、M08_DepartAction、M09_Utility 没有 TextureRect；当前这些模块已有美术，每个模块在四种窗口中触发一次失败。本轮未修改这三个模块或父测试，也未删除断言。失败日志没有资源值、日期值、文字截断或越界断言失败。

[资源栏 stderr](../../test-output/p1-a-camp-state-20261020/camp_resource_bar_runtime-native.stderr.log)、[身份模块 stderr](../../test-output/p1-a-camp-state-20261020/camp_identity_runtime-native.stderr.log)。此结论限于已读取的失败列表，不表述为整个旧专项通过。

### 验收标准对应

| 用户验收 | 本轮证据 |
| --- | --- |
| 新开局 Day1 / Food6 / Scrap0 | 原生正式新游戏、状态专项及新开局截图 |
| 空手归航 Day2 / Food4，匹配存档 | 原生通过 E 等待正常上车和关门，再点击确认结算；同检查点核对 HUD、Campaign、SaveStore |
| 新开局、继续和连续跨日不残留 | 重新实例化 Main 读取同一测试档后点击继续；第二次真实出勤达 Day3 / Food2；从菜单确认替换旧 Run 后恢复 Day1 / Food6 / Scrap0 |
| 缺粮规则一致 | 状态专项覆盖库存为零但 hunger=0、首次缺粮 hunger=1；原生另用明确标注的 hunger fixture 取得两档截图 |
| 今日行动打开和取消不变值 | 真实按钮选商业街后取消，保持同一 Camp、完整 Campaign 数据和存档字节 |
| 重复刷新无副作用 | 状态专项 30 次、原生专项 20 次刷新/隐藏/恢复，完整 Run 与存档字节不变，结算历史不增加 |
| 定向测试 | 见上表，分别说明通过和失败 |
| 正常与最小窗口截图 | 1600×900、1024×640；日期、资源、状态几何与文字尺寸断言通过，截图已目视检查 |
| 构建门禁 | 完整 build 实际执行并失败，257.890 秒、exit 1；未绕过既有 Camp UI 失败 |

继续游戏证据是重新实例化正式 Main 场景、从磁盘载入同一隔离存档并通过继续按钮进入营地，不宣称已完成新独立 EXE 的重启验收。原生两次出勤保持正常伤害和正式导演，不强制结束、不注入奖励、不移动成员位置。缺粮截图使用独立注明的状态夹具，不冒充自然饥饿路线。

### 当前源码原生截图

| 截图 | 分辨率与状态 |
| --- | --- |
| [new-run-1600x900.png](../../test-output/p1-a-camp-state-20261020/new-run-1600x900.png) | 正式新开局 Day1 / Food6 / Scrap0 |
| [day-two-1600x900.png](../../test-output/p1-a-camp-state-20261020/day-two-1600x900.png) | 实际空手归航 Day2 / Food4 / Scrap0 |
| [day-two-1024x640.png](../../test-output/p1-a-camp-state-20261020/day-two-1024x640.png) | 同一真实 Day2 的最小窗口 |
| [continued-1600x900.png](../../test-output/p1-a-camp-state-20261020/continued-1600x900.png) | 从测试存档继续后的 Day2 |
| [hunger-1600x900.png](../../test-output/p1-a-camp-state-20261020/hunger-1600x900.png) | 明确标注的缺粮夹具，Day4 / Food0 / Scrap27 / HP80% |
| [hunger-1024x640.png](../../test-output/p1-a-camp-state-20261020/hunger-1024x640.png) | 同一缺粮夹具的最小窗口 |

[原生断言和状态记录](../../test-output/p1-a-camp-state-20261020/runtime-report.json)、[状态规则记录](../../test-output/p1-a-camp-state-20261020/state-report.json)。这些截图来自当前 Godot 原生帧缓冲，不是 UI 拼图或旧版本资源。

### Windows 完整构建

实际执行 `run.ps1 -Mode build`：开始于 2026-10-20 21:52:35（+08:00），耗时 **257.890 秒，exit 1，无外层超时**。新增 Headless 状态专项 62 / 0、Native 原生专项 186 / 0 已在 build 前段通过。后续搜索 72 / 0、外出 HUD 265 / 0、Survivor Command 45 / 0、指令线 554 / 0、搜索卡 157 / 0、设置 14 / 0、营地菜单 30 / 0 通过。

随后在 `tests/camp_ui_runtime.gd:114` 访问当前 CampHUDRoot 不存在的 `member_buttons`，并触发 `Camp exposes active abilities on its left edge` 断言失败。该组旧契约及对应整备入口缺口在 F01 修复前的审计中已经记录，本轮没有扩修或删除断言。构建未执行到导出，没有 P1-A 新 EXE 或新包独立启动证据。

规范 [build/BlueHourHomeward.exe](../../build/BlueHourHomeward.exe) 仍为原旧包，SHA-256 保持 `E194539E347E5B2757B4C61107E2EBBAD98352DC44AE43FE7A40D0E26951B627`，不能把它作为本轮修复的可执行交付物。

[构建结果](../../test-output/p1-a-camp-state-20261020/build.result.json)、[构建 stdout](../../test-output/p1-a-camp-state-20261020/build.stdout.log)、[构建 stderr](../../test-output/p1-a-camp-state-20261020/build.stderr.log)、[对应源码清单](../../test-output/p1-a-camp-state-20261020/build-source-manifest.json)。

## Known Issues

- 既有 Camp UI 的 member_buttons / PowerSlots 契约及整备功能未在本轮修复；P1-A 不等于完整营地交互闭合。
- 两个旧视觉专项的“无美术”断言失败保留。
- 营地原有时钟、波次和蓝时倒计时展示未纳入 P1-A；当前修改绑定的是资源、双语日期和口粮状态，不扩展新的营地时间系统。
- Run 结束空页仍属于 P1-B，没有改动。
- 武器升级、设施、经济参数、招募和正常奖励链未扩展。
- 没有新的跨平台或性能压力验收结论。完整构建若未通过，则没有当前修复的新 EXE 独立启动证据。

## 文档与工作区交付检查

- PASS：定向 encoding-guard 没有发现可疑编码或文本丢失；`git diff --check` 无新增空白错误。
- PASS：本报告正文的 30 个本地链接目标均存在；外部资源未在本轮重新联网验证。
- PASS：剔除本轮追加章节后，PLAN 与起始快照一致；剔除四条新增专项调用后，run.ps1 与起始快照一致。已有用户修改未覆盖。
- PASS：其他 17 个原有修改或未跟踪文件哈希不变；构建源码清单中九个文件在 build 后哈希一致，截图与测试对应本轮源码。
- 本轮测试进程均已退出，无新增长驻服务。未提交 Git。

## Environment

| 平台 | 实际环境 |
| --- | --- |
| `[Windows] Windows environment required` | Windows 11 专业版 10.0.26200；i5-12400F；RTX 3060；OpenGL Compatibility；Godot 4.7.2.stable.official.ed1daf0bf；存在匹配 4.7.2.stable 导出模板 |
| Windows Godot Editor | 通过 Console 的 headless editor import 执行资源导入；原生脚本通过同一引擎运行 |
| Windows Blender | 未使用，PATH 未找到，不据此断言未安装 |
| Windows Node / Git | Node 26.4.0、pnpm 11.21.0、Git 2.39.1.windows.1；context:recent 的 Node 范围 warning 已记录，Godot 工程独立运行 |
| `[macOS] macOS compatible` | 本轮未访问；Godot Editor、Blender、Node、Git 未验证，不能代替 Windows 发布验收 |

## 计划同步与停止边界

本轮状态同步到 PLAN 和 VALIDATION 的新增章节，旧审计报告保留为修复前历史事实。最终交付仅对应 P1-A，完成后停止，P1-B 及其他路线图任务不自动开始。
