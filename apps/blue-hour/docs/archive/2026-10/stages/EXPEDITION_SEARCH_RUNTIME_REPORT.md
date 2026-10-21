# Expedition Integration E02 — Search / Loot Runtime

2026-09-19。E02 搜索接入 **TECHNICALLY COMPLETE**；**Human Runtime QA: PENDING**。E03 Enemy、E04 Full HUD / Minimap Polish、E05 Blue Hour / Extraction 均未开始。

Windows 完整构建实际执行，但被既有 Camp UI 测试阻断，未生成本轮独立 EXE；不能将源码专项通过理解为整包构建通过。

## 审计与复用决策

| 链路 | 分类 | 现有实现及本轮处理 |
| --- | --- | --- |
| Search interaction entry | ADAPTER_REQUIRED | `SquadInput.handle` 已通过射线命中 `site_id` 分派；为 Runtime 建筑增加独立交互代理，沿用输入代码。 |
| SearchTask / SearchState | REUSE_DIRECTLY | 沿用 `missions/search_task.gd`，任务归 Mission、进度归 `city.sites`；Registry 不维护第二套活动状态。 |
| Building registration | ADAPTER_REQUIRED | 消费 Adapter 的 `building_entries`、`building_search_points` 与已实例化 wrapper；交集还须通过 Definition 的 searchable/profile 校验。 |
| Vehicle registration | ADAPTER_REQUIRED | 复用车辆 Definition、EntranceAnchor 和现有 `lootable` 实例授权语义；缺少实例授权时拒绝注册。当前 M00–M03 环境车辆均属此情况。 |
| Search duration | REUSE_DIRECTLY | `LootSpawner.apply` 的 vehicle/residential/commercial/large 为 4/8/12/18 秒，仍应用角色天赋和 Modifier。 |
| Loot / reward source | REUSE_DIRECTLY | 沿用 Definition → Loot Profile → LootResolver；武器奖励仍走 `Mission.reward_for_site`。没有新增奖励表、掉率或固定地点奖励映射。 |
| Progress update | ADAPTER_REQUIRED | Town 分支原先只 tick Survivor 与 Exploration；现在按既有次序 prepare → 退出/归队 → 移动 → advance → prune → pickups。 |
| Cancellation | REUSE_DIRECTLY | Active Search Card → `command_recall` → task.release；即时解除 owner、关闭卡片，保留地点进度。 |
| Completion | REUSE_DIRECTLY | 剩余时长阈值同 tick 设置 searched/progress=1，结算仅一次；旧进入/退出淡出保留，Town 不再写入角色位置。 |
| Active search HUD card | REUSE_DIRECTLY | 原卡片和 0–100% 进度直接读取 `search_target_state`；未改美术、布局或动画。 |
| World search panel | REUSE_DIRECTLY | PoiContext、PoiEntry、WorldMarkers 均使用原 `city.sites`；HUD 创建前注册所有 site，避免异步列表漏项。 |
| Resource inventory handoff | REUSE_DIRECTLY | 完成后走 `drop_loot` → `_update_pickups` → `RunLedger.collect_resources/add_weapon`；沿用完成与拾取通知。 |
| Command interaction | REUSE_DIRECTLY | E01 的普通移动只替换尚未开始的任务；SEARCHING 保留。显式取消照常释放。短时指令线允许显示搜索接近阶段。 |
| Selected survivor | ADAPTER_REQUIRED | HUD 选择同步给 Mission；Town 只向所选空闲且可达的 Survivor 分派，不自动换人。Legacy 仍选择最近空闲成员。 |
| Fixed building / vehicle paths | FIXED_MAP_COUPLING | 旧 `MapData.buildings/vehicles` 和固定注册逻辑留给 Legacy；Town 按 runtime_id 映射运行时 wrapper，没有引用 corner/van_south 等固定地点。 |
| Fixed markers / coordinates | FIXED_MAP_COUPLING | 旧 `City.register_site` 会把 anchor 写入 wrapper；本轮代理、入口标记和 UI anchor 放在 Mission 的独立节点下，未修改源实例。 |
| Fixed loot / weapon site IDs | FIXED_MAP_COUPLING | 旧 day_rewards/weapon_sites 不复制到 Town；无对应既有奖励就返回空，不编造掉落。 |
| Discovery / minimap | REUSE_DIRECTLY | 原 Exploration 负责发现，E01.5 自带 discovered site marker 消费逻辑。仅测试预期由固定 5 个标记改成基础标记 + 已发现地点。Minimap 产品代码未改。 |
| Enemy / Full HUD / Blue Hour / Extraction | DEFERRED | Town 没有接入敌人生成、时钟推进、撤离结算或新 UI 系统。 |

## Runtime 接口和边界

新增 `maps/expedition/town_search_registry.gd`，由 Mission 持有。`building_searchables` / `vehicle_searchables` 保存 `city.sites` 的 ID；`snapshot(id)` 返回 runtime_id、source_definition_id、search_type、world_position、interaction_point、entrance_point、search_duration、loot_profile、is_available、is_active、is_completed、assigned_survivor_id、status、state。活动、完成和归属每次都由原 SearchTask/site 状态推导。

本轮生产改动限于上述 Registry、`missions/mission.gd` 的搜索接入、`missions/search_task.gd` 的 Town 无瞬移入口/退出、`missions/world_interaction_vfx.gd` 的短时搜索指令线，以及 `ui/mission_hud.gd` 的两处选择同步。另有两份新专项测试和原 Minimap 测试的地点标记预期更新。工作区已有的 Mission Profile / 今日行动、Camp、角色美术等并行改动保留；它们不属于本轮实现。

建筑优先使用 Adapter 的真实入口，在其 2 m 范围内通过冻结导航找到合法栅格点；从实际 Arrival 出车点验证连通性，再从所选 Survivor 的真实位置检查派遣路径。Arrival 巴士中心本身是碰撞体，不能用作导航起点。不可达返回 `SEARCH_REJECTED_UNREACHABLE`；没有 profile 返回 `MISSING_PROFILE`，不调用原 LootSpawner 的未知 profile 默认回退。

交互代理复制源碰撞形状用于射线拾取，位于 Mission 的 `ExpeditionSearchables` 层，仅为 Area，不参与 Town 静态导航。源建筑/车辆位置、旋转、缩放、子节点和元数据均不改。角色以实际路径到入口，搜索与退出不 teleport。

完整流程保持：选中成员 → 点击模型 → 接近入口 → ENTERING → SEARCHING → COMPLETE → 原有拾取入账。完成判定与生成奖励同 tick；建筑角色沿用约 0.3 秒退出表现，资源在现有拾取半径规则满足时入账，不等待 HUD 动画。

## 四种子结果

| Seed | 注册建筑 / 可达建筑 | 可搜索车辆 | 保持装饰属性的车辆 |
| --- | ---: | ---: | ---: |
| 4101 | 55 / 55 | 0 | 47 |
| 4102 | 55 / 55 | 0 | 41 |
| 4103 | 55 / 55 | 0 | 45 |
| 4104 | 55 / 55 | 0 | 45 |

车辆资源虽然拥有 vehicle loot profile 和入口锚点，但冻结环境 Runtime 没有实例级 `lootable` 授权，不能因资源默认 searchable=true 就把停车装饰改成容器。本轮没有新增、移动或强制启用车辆。Registry 支持显式授权的车辆；Medium Town 的车辆搜索人工验收和截图 07–09 标记 **N/A: no authorized searchable vehicles**。旧地图车辆的正式搜索流程继续通过回归。

## 验证

正式 App fixture 使用 `user://test-runs/` 独立存档与真实 Survivor，覆盖 4101–4104：

- Definition/profile 有效性、唯一 ID、重新创建同 seed 的 Registry 一致性，以及导航解析幂等性。
- 每个入口可导航、可从出车点抵达；每帧实际移动线段避开膨胀碰撞边界，进入/退出没有位置跳变。
- 三名成员都可成为明确选择的搜索者；重复点击同一目标不会更换 owner 或重复发任务。
- 普通移动保留已开始的搜索；已接受的普通移动可替换接近阶段。
- 真实取消按钮信号即时释放并关闭卡片，取消不给奖励；不同所选成员可续搜。
- 精确剩余时长同 tick 完成，无 99% 停滞；完成事件、拾取事件及资源入账仅一次，完成地点不可再领。
- 不可达负例仅将测试 site 的目标改为真实建筑碰撞中心，确认派遣拒绝且角色位置不变；不改物理场景或导航。
- 每个 seed 搜索前后源实例签名一致；新 Mission 的 seed 4101 重建结果一致。
- 完成后重新规划到正在移动的队伍，抵达后清除归队状态；补接原 0.6 秒 refresh_regroup 调度，四种子测试先复现缺失调度造成的归队状态残留，再验证修复。

| 检查 | 结果 |
| --- | --- |
| E02 四种子与重建专项 | 1,206 checks，0 failures，详见 `report.json` |
| Seed 4101 原生鼠标流程 | 14 checks，0 failures |
| E00 Runtime Bridge | 58 checks，0 failures |
| E01 Navigation | 240 checks，0 failures |
| E01.5 Local Follow | 1,892 checks，0 failures |
| E01.5 Runtime Bridge | 1,441 checks，0 failures |
| Legacy Search Dispatch | 56 checks，0 failures |
| Legacy Interior Search | 13 checks，0 failures |
| Legacy Active Card headless | 137 checks，0 failures |
| Windows build 前置原生检查 | Search Gameplay 72、HUD 258、Survivor Command 45、Active Card 157、Settings 14 全通过 |
| 冻结文件 | 本轮 511、E01 基线 633、M03 基线 622，逐文件 SHA-256 均不变；集合有重叠，不相加 |
| Mission 的 E01 移动函数 | move_command_members / command_move / _move_members / _town_formation_slots / movement_speed / formation 原文不变 |
| E02 与上述通过专项的资源、UID、脚本错误 | 0；完整 build 的 Camp 失败单独列示 |
| UTF-8 检查 | PASS |

## 原生截图与视频

目录：`test-output/expedition-integration-e02/`。使用正式 MEDIUM_TOWN_V1 Expedition、Seed 4101、真实角色和鼠标输入。没有移动源实例或伪造搜索进度；使用固定 30 fps 推进和原生 Compatibility 渲染。

- `01_searchable_building_detected.png`
- `02_survivor_move_to_building.png`
- `03_building_search_active.png`
- `04_ground_click_during_search.png`
- `05_building_search_complete.png`
- `06_search_cancelled.png`
- `10_search_reward_result.png`
- `building_search_full_flow.mp4`：780 帧，26 秒。
- `search_cancel_and_reassign.mp4`：680 帧，22.667 秒。

截图、视频、逐秒样本和事件断言见 `capture-manifest.json`。03/06 截图已查看：搜索卡显示进度并保留取消按钮，取消后卡片消失，三人及局部小地图保持原布局。车辆 07–09 与车辆视频不制作虚假成功证据。

## 性能口径

`report.json` 记录每 seed 的 registration_ms、navigation_resolve_ms、build_ms、resolve_mean_ms、building_count、vehicle_count。计时包含原 E01 AStar 的真实连通性查询，不把它混同为仅创建 Dictionary 的成本。

| Seed | 完整 Registry 构建 ms | 单入口解析均值 ms | 稳定 SearchTask 更新均值 μs |
| --- | ---: | ---: | ---: |
| 4101 | 1274.680 | 23.032 | 2.090 |
| 4102 | 1168.404 | 21.101 | 1.980 |
| 4103 | 1161.191 | 20.978 | 1.990 |
| 4104 | 1174.680 | 21.229 | 1.985 |

最终专项注册本身约 7–8 ms，完整构建约 1.16–1.27 s。过程中一轮并行负载下 Seed 4101 曾达到 5.23 s，绝对耗时会受并行测试影响。单个运行中的 SearchTask prepare+advance 使用 200 次零步长抽样，只衡量稳定搜索更新，不包含完成时奖励/节点创建的尖峰。1,812 次正式世界推进均值为 232.49 μs。没有增加每帧 Registry 重建。

## 构建限制与交付状态

实际执行 `./apps/blue-hour/run.ps1 -Mode build`，Import 和上述 Expedition 前置测试通过。随后失败于既有 Camp：

- `tests/camp_ui_runtime.gd:114` 访问 `camp_hud_root.gd` 已不存在的 `member_buttons`。
- 同测试的旧能力栏断言 `Camp exposes active abilities on its left edge` 失败。

build 返回 exit 1；完整日志在 `windows-build.log`。未修改并行 Camp 工作、未跳过此门槛，也未把已有 `build/BlueHourHomeward.exe` 当成本轮产物。当前可通过 Godot 工程人工运行 E02；没有新的独立 EXE 可交付。

最后一次完整构建的 Legacy Active Card 原生检查虽通过，退出时仍报告 2 个 ObjectDB 实例泄漏警告；本轮 E02 专项与原生流程日志没有该警告。未扩大到旧 UI 退出清理修复。

本轮代码、测试与报告留在工作区，未提交。`docs/PLAN.md` 已同步。下一步仅等待人工检查搜索体验；**Human Runtime QA: PENDING**。E03 / E04 / E05 **NOT STARTED**。
