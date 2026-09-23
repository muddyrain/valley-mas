# 蓝时归航：局部 AI 入口

## AI 任务最小上下文入口

- `CLAUDE.md` -> `apps/blue-hour/AGENTS.md` -> `apps/blue-hour/PROJECT_CONTEXT.md`

实现状态按需读取 `docs/PLAN.md`，操作与架构按需读取 `README.md`。

## 局部边界

- 所有新增或修改 3D/2D 美术资产前必须读取 `art/ART_BIBLE.md`、`art/ASSET_PIPELINE.md` 和 `art/MODEL_CATALOG.md`；优先复用与组合现有资产，只有不存在合适资产时才创建新模型。

- 原生 Godot 4.x + GDScript，Compatibility 渲染；工程入口 `project.godot`，场景装配 `core/main.gd`，行动逻辑 `missions/mission.gd`。
- 环境操作统一标注 `[Windows]` 或 `[macOS]`：`[Windows]` 负责 Godot 主运行测试、构建与独立程序、Blender、Meshy 和 GPU 渲染；`[macOS]` 负责代码、文档、Git、Codex、UI 与逻辑修改。路径不得跨系统直接复制，具体规范见 `README.md#development-environment`。
- 当前实现为第 32 节切片与第 33 节的局部五日版本：跨日基础见 `docs/DAY_LOOP_SPEC.md`，0.4.0 开局与成长见 `docs/NEW_RUN_SPEC.md`。新游戏先选专精、从现有角色池随机抽两人，基地可换装和食物训练；「整装出发」进入今日行动三选一，复用当前城区并配置不同物资与敌情，状态/存档契约见 `docs/TODAY_ACTION.md`。独立任务布局、通用治疗/区域支援、跨局解锁、基地房间及完整 Day Loop 仍在后续。
- 内容真源为 `data/` 下的 Resource 与 `.tres`；地图布局、时段和威胁参数同样数据驱动。修改数据字段时联查 `data/catalog.gd`、消费模块和 `tests/rules.gd`。
- 表现集中在 `maps/`、`vfx/`、`blue_hour/`，角色模型允许替换；战斗、导航、资源与结算不得依赖占位模型节点。
- 0.3.0 基础操作见 `docs/adr/0003-parallel-search-and-direct-controls.md`：左键点击/按住带队，Ctrl 停步指向射击，Space 战术暂停可下令，Esc 菜单，WASD 与右/中键拖动镜头。X 停止、F 锁定集火、R 全队集合、E 归航是本作补充；输入归 `missions/squad_input.gd`，松键、UI、Debug 和失焦必须正确释放持续输入。
- 每个地点持有独立 `missions/search_task.gd`，每名成员最多一项任务，允许三人全搜；任务字典归 `missions/mission.gd`，进度归地点。自动选最近可抵达空闲成员，单独取消/改派不能抢走其他任务成员。建筑由同一 SearchTask 驱动进入/隐藏搜索/退出，室内不作为外部目标；车辆保持遇险自卫，完成归队、阵亡只中止本人任务；指向射击仅控制掩护成员，消耗弹药并受射程/墙体约束。专项回归为 `tests/search_dispatch.gd`、`tests/parallel_commands.gd`、`tests/controls_runtime.gd`。武器不绑定职业。
- BLUE HOUR 是短暂预警，Night 的临时威胁随停留时间升级、每次出勤重置。
- 撤离必须等待所有存活成员抵达、巴士准备和关门；阵亡要明确结算，全灭丢失本次携带物资；结算只能入账一次。
- 跨日状态由 `core/campaign.gd` 持有，内容规则来自 `data/day_loop.tres` 与词条 Resource；使用成员 ID 和武器个体 ID，不能按内容目录复活成员或把同型号武器视为同一把。单人搜索、1/1 撤离和零人失败纳入 `tests/day_loop_flow.gd`。
- 开局选择只持有草稿，确认并成功保存后才创建 Run。v3 保留成员身份和局内等级，并保存道具/技能持有清单、装备槽、容量与一次升级状态；v1/v2 在读取验证入口兼容，首次保存保留对应原版本备份。起始池、训练成本与专精来自 `data/new_run.tres`、`data/specializations/`，14 项效果与图标来自 `data/effects/`。规则见 `docs/EFFECT_SYSTEM_SPEC.md`；统一 Modifier 与每日技能状态不得改共享模板或假定只有一个槽位。除开局三组验证外，扩充专项为 `tests/effect_system.gd` 与 `tests/effect_runtime.gd`。
- 安全屋保存与待结算结果保存在 `user://homeward/run.json`，保留有效备份；购买、换装和日结算保存成功后才推进，失败保留原状态。行动中退出重试当天且不重抽装备奖励。所有自动化与独立导出启动验证使用 `user://test-runs/`，不得覆盖玩家存档。
- 专项验收包括实际 Godot Headless 规则/行动测试、原生渲染启动、鼠标命令、搜索中断与恢复、武器自由分配、昼夜转换和完整撤离循环；命令见根 `docs/PROJECT_GUIDE.md` 的蓝时归航章节。
- 每次功能开发或修复交付前必须实际执行 Windows build，并验证导出的独立程序启动。交付 `build/BlueHourHomeward.exe` 的可点击路径，不能只提供源码、Godot 工程或构建命令；如构建失败必须明确报告失败原因。纯文档变更无需重复构建。
- 仅修改本项目及用户授权的仓库入口文档；不得修改其他 `apps/*` 的业务实现。运行日志、截图、导出物和 `.godot/` 不纳入版本控制。

## 任务交付报告

- 每次项目修改任务都在项目 `docs/reports/` 新增 `YYYY-MM-DD_<feature_name>_report.md`；没有报告即视为未完成。报告包含 Task Summary、Changed Files（修改 / 新增 / 删除）、Implementation Details（原因、方式、数据流）、Validation（测试、Godot 运行、UI 截图路径与 PASS / FAIL）、Known Issues 和 Environment。
- Environment 分别记录 Windows 与 macOS 的 Godot Editor、Blender、Node、Git；未安装、未使用或无法访问时如实标注。涉及 UI、HUD、Scene 或 Model 时提供 1600×900 截图；环境差异与未完成的跨平台验证必须写明。
- 涉及 UI 交互时，报告写明触发入口、状态变化与关闭方式，并附截图或录屏路径；截图需覆盖可见的关键状态，动画改动还应验证中断与连续操作。
- 修改已有系统前核对数据来源、绑定方式和当前测试结果；不得用临时 fallback 覆盖正式数据，也不得按数组索引、角色名字或文件编号绑定资源。所有 UI 图片注明来源路径、使用位置和绑定 ID；不得用截图或旧版本资源代替正式资源，也不得以旧资源作为 fallback。
- 涉及数据绑定时，报告明确数据来源、从 ID 到 UI 的绑定链路，以及本次修改是否影响旧逻辑。
- Survivor 系统以 `survivor_id` 为唯一索引；Portrait、Model、Trait、Profile 的来源必须追溯到 `SurvivorDefinition`，不得按名字或数组顺序匹配。

## Survivor Resource Binding Rule

- `survivor_id` 是唯一身份键；不得按文件名、中文名、文件夹顺序或创建顺序绑定角色资源。
- 角色的 Model、Portrait、Animation、Data 关系由 `SurvivorDefinition` 确定。正式 Model 与 Portrait 归属 `assets/characters/<character_id>/`；头像统一为该角色目录下的 `portrait/avatar_square.png`，由 Definition 的 `portrait_path` 显式引用。公共 Locomotion 动画继续复用 `assets/animations/public_locomotion/`，不得在角色目录复制公共动作。
- 所有 UI 只消费 Survivor 数据及 `survivor_id` 关联的 view model，不直接扫描角色或 UI 资源目录。`assets/ui/camp/survivor_avatars/` 已弃用，不得新增幸存者头像。
- 环境结论标注 `[Windows] Windows environment required`（正式 Godot 运行、构建、独立程序、Blender / Meshy 资源处理和性能验收）或 `[macOS] macOS compatible`（代码、文档、Git、Codex 与可用的本机兼容性检查）。macOS 的 Godot 检查不能替代 Windows 发布验收。

## 文件命名卫生

- 正式代码、场景和 Runtime Asset 不得新增开发历史后缀或纯排序前缀：`_v1`、`_v2`、`_v3`、`_final`、`_final2`、`_new`、`_old`、`_copy`、`_temp`、`_tmp`、`01_`、`02_`、`03_`。
- 文件历史由 Git 管理；使用有业务语义的稳定名称。
- 允许业务编号和规格编号：`ENM_001_*`、`CHR_001_*`、`CAMP_001_*`、`ITEM_001_*`、`SKILL_001_*`、`camp_ui_030_*`、`20k`、`30k` 及明确的 LOD/Asset ID。
- 提交前由 Lefthook 运行 `scripts/check-blue-hour-naming.js`。
