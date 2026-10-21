# Expedition Search Gameplay V2

## 实施范围

建筑、车辆继续共用既有 SearchTask。`Mission.search_target_state()` 只读映射 `AVAILABLE → ASSIGNED → APPROACHING → SEARCHING → COMPLETED`；取消为 `CANCELLED`，保留进度、释放占用，允许再次派遣。任务归属仍是 `search_tasks[id].worker`，进度/完成仍是地点的 `progress` / `searched`。没有建立第二套可写状态机。ASSIGNED 是下发路径前的同步阶段；自卫暂停仍属于已开始搜索，但 progressing=false，普通 Move 不能覆盖。

## 原有问题

- 原耗时约 1～75 秒；维修店共用了车辆 profile 的 1.2 秒，分类不正确。
- Dictionary 掉落表只过滤 weight>0，每个有效项必掉，没有真正的概率。Resource 加权单选 API 保持原语义。
- 原完成 notice 被拾取 notice 覆盖，且 HUD 每帧隐藏 Toast，执行者、目标、数量无法形成可读反馈。
- 没有发现额外的完成等待计时器；本轮补上浮点边界容差，避免 99% 多等一帧，并以完成/取消事件立即刷新卡片。
- 正式资源只有食物、废料、已有武器个体，没有独立医疗、燃料、零件。

## 分类与基础时长

| 类别 | 基础耗时 | 固定城区可搜索目标 |
| --- | ---: | --- |
| 小型车辆 | 4 秒 | 配送面包车、废弃轿车、弃置 SUV |
| 住宅 | 8 秒 | 林荫住宅 A/B、西街住宅、巷口住宅、站西住宅、花园住宅、站前小屋、站前住宅 |
| 商店/药店 | 12 秒 | 北街超市、北岸食集、北街药房、旧日药房、北街食堂、街角餐厅 |
| 大型/工业 | 18 秒 | 北街货站、货运库房、修车铺、东岸加油站、南街修理处 |

固定城区 27 栋建筑中 19 栋可搜，12 辆停靠车中 3 辆可搜；装饰物不新增交互。现有随机 Mission 也经过同一配置入口，原有 category / loot_tags 参与分类；小型五金店仍是 12 秒，维修店是 18 秒，生成器未改。

时长集中在 `maps/generation/loot_spawner.gd::SEARCH_SECONDS`，不含移动、自卫等待和建筑 0.3 秒进出过渡。天赋与 search_time 效果继续走 `EffectModifiers.search_seconds()`。

## 基础 Loot Table

每种资源独立判定概率，命中后在区间内等概率取整数。下表保留原 profile ID；界面只显示真实资源名称。

| 目标/profile | 食物：概率 × 数量 | 废料：概率 × 数量 |
| --- | --- | --- |
| 住宅/普通 general | 80% × 2～3 | 100% × 1～3 |
| 超市 food_high | 100% × 4～7 | 65% × 1～3 |
| 餐厅/食品商店 food_medium | 100% × 3～5 | 60% × 1～2 |
| 药店 medical_basic | 25% × 1～2 | 100% × 3～5 |
| 仓库/五金材料 materials_tools | 20% × 1～2 | 100% × 6～10 |
| 加油站 fuel_vehicle | 30% × 1～2 | 100% × 4～6 |
| 维修店 vehicle_parts_tools | 15% × 1 | 100% × 4～7 |
| 配送面包车 vehicle_supply | 60% × 1～2 | 100% × 2～4 |
| 废弃轿车 vehicle_salvage | 20% × 1 | 100% × 1～3 |
| 弃置 SUV vehicle_food | 100% × 2～3 | 70% × 1～3 |

药店暂时只有不同的既有资源分布，没有实现医疗资源。加油站、车辆不虚构燃料或零件。今日行动继续调整奖励数量区间；拾取时 resource_yield 和小数余量沿用 Ledger；武器继续走每日固定装备奖励入口。

## 完成与反馈

精确时长边界到达 100% 后，标记目标完成、产生既有地面掉落、释放本人任务，并立即隐藏卡片。完成事件只触发一次，已完成地点不能重复派遣和刷奖励。取消只释放本人，其他并行任务继续推进。

复用现有 Toast 显示「某人完成搜索：某目标 / 找到：物资与数量」。角色靠近拾取后，同一提示更新为「获得」及实际入账数量。并行结果依次显示，每条约 0.9 秒，普通 notice 不覆盖当前搜索结果。没有新增 PNG 或大型结果弹窗。

## 实际修改文件

- `maps/generation/loot_spawner.gd`：集中时长、分类与掉落表。
- `core/loot_resolver.gd`、`data/catalog.gd`：概率与数据校验。
- `missions/mission.gd`、`missions/search_task.gd`：只读目标状态、完成边界、取消/完成/拾取事件、掉落来源。
- `ui/expedition/search_card.gd`、`poi_context.gd`、`poi_entry.gd`：读取真实状态、立即清理、区分赶路与搜索。
- `ui/mission_hud.gd`：复用 Toast 显示结果。
- `tests/search_gameplay.gd`（及 Godot UID）、`run.ps1`：新增专项，纳入 test/capture/build。
- 本报告、README、PLAN：同步交付状态。

未修改角色模型、骨骼、动画、地图生成器、SearchCard 素材/布局或 Command Line 实现。本轮不自动提交。

## 验收结果

- 最新专项 Headless 67 项、原生 72 项零失败：住宅和车辆实际派遣、正式耗时从零推进、精确 100% 边界、立即隐藏、取消/续搜、重复奖励保护、并行隔离、实际拾取、概率分布、今日行动倍率、随机目标配置。
- Command V1 原生 45 项、搜索卡原生 157 项、Expedition HUD 原生 258 项通过；搜索派遣 56 项、室内搜索 13 项、并行命令 36 项、规则 19 项、旧 Loot Table 兼容检查通过。
- 专项原生截图在 `test-output/search-gameplay/`，属于生产场景自动化证据，未代替玩家手动试玩。
- 本轮专项/原生 Expedition 日志无 Runtime Error / Missing Resource / Invalid Node；旧搜索卡测试退出时仍有 2 个 ObjectDB 实例泄漏警告。
- 完整 `run.ps1 -Mode build` 已执行，在旧 Camp `member_buttons` 缺失/左侧能力栏断言处失败。单独 Release 导出与验证另行记录，不等于完整 build 通过。
- 单独 Release 首次临时文件重命名失败，重新检查正式 EXE 无占用后重试成功，输出 `build/BlueHourHomeward.exe`。复制到独立目录后 Headless/原生 Expedition 均退出 0；从该 EXE 挂载内嵌资源的双模式探针验证了住宅/车辆正式耗时、Move 保护、自然完成、卡片隐藏、实际拾取与重复奖励保护，均零失败。原生普通启动仍报告同样的 2 个 ObjectDB 退出警告。
- 扩展回归失败项：`mission_flow` / `effect_system` 在随机地图上硬编码 `corner`；`today_action` 访问已移除的 Camp `departure`；`world_map` 对本轮未改的街道道具报 4 项错误。未扩展修改 Camp、地图或这些无关夹具。

## 尚未处理的缺口

医疗、燃料、独立零件资源仍缺失；不扩展大型背包/经济系统。基础时长是初始调参，仍需结合夜间风险、全图收益与多人并行试玩平衡。遇险自卫暂停、进出建筑过渡、附近拾取规则保留。
