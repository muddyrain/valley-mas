# BLUE HOUR Gameplay Audit V1

审计日期：2026-09-19。对象：当前工作树中的 Godot 工程，不限于已提交版本。路径以 `apps/blue-hour/` 为根。

本轮仅阅读代码、Scene、Resource、调用链及已有测试产物，只新增本报告；未修改游戏、资源、场景或测试，未重新构建、未重新跑完整 Run。已有测试结果属于历史自动化证据，不等于本轮玩家实机验收，也不能保证与所有未提交文件完全同步。文档、计划和资源文件名不作为完成依据。

## 结论

当前最完整的玩法是 **小队出勤 → 探索随机街区 → 自动战斗与并行搜索 → 拾取 → 主动归航 → 日结算**。Survivor Command V1 和 Search Gameplay V2 已在 Mission 主链接入。

但不能把当前版本描述成完整的营地经营或完整 Roguelite：新 Camp HUD 大量模块是展示 fixture，原有训练、商店、换装、效果管理接口没有对应的新 HUD 入口；结束状态有数据判定，但当前主流程没有创建胜负结束界面。随机地图与旧奖励配置也存在断层。

特别需要区分以下计数：

- 3 个任务选项、3 个生成参数类型，但目前只有 1 套完整任务目标机制：搜刮后撤离。
- 2 种真实持久资源货币：Food、Scrap；情报是 Camp 显示占位。
- 1 种正式感染者。
- 8 把武器定义进入战斗系统；正常新游戏确定装备其中 2 把，不能声称玩家正常能获得并切换全部 8 把。
- 8 个 Passive、6 个 Power 有数值消费实现；正常开局选择可达的是其中 3 个 Passive 和 3 个 Power，每局各装备 1 个。其余获取/管理入口不完整。
- 5 个 Survivor 模板在 Catalog；正式起始池只有夏知遥、苏晚星两人，抽取数量也是 2。

## 证据口径与状态

| Status | 本报告含义 |
|---|---|
| DONE | 正常流程接入，具备所述功能的基础生命周期；不代表成品质量或全局无 Bug |
| PARTIAL | 已接入但只覆盖部分玩法、呈现或获取链路 |
| STUB | UI、字段、场景或临时表现存在，未形成该玩法 |
| BROKEN | 现有实现存在可定位的流程断点，所述功能不能按预期完成 |
| UNUSED | 实现存在，但没有正常流程调用/入口；测试和 Debug 不算正常入口 |
| NOT IMPLEMENTED | 检查范围内未找到实际实现 |

不确定的观察标为 `UNKNOWN / NEEDS RUNTIME VERIFICATION`，这是证据限定，不是第七种完成状态。静态调用链能证明接线与必经断点，不能代替所有种子、相机与显示条件下的实机验证。

主要证据索引：

| 编号 | 代码 / Scene / Resource | 调用链证据 |
|---|---|---|
| E01 | `project.godot`、`core/main.gd`、`ui/title_screen.gd`、`ui/new_game_screen.gd` | 主入口、菜单、新建、续玩与页面切换 |
| E02 | `core/campaign.gd`、`core/save_store.gd`、`core/run_ledger.gd`、`data/day_loop.tres`、`data/new_run.tres` | Run、成员身份、物资、日结算和存档 |
| E03 | `ui/camp_hud/camp_hud_root.tscn`、同名 `.gd`、`ui/shelter_view.gd`、`scenes/camp/camp_main.tscn` | `show_shelter()` 实例化当前 Camp；只连接出发/菜单 |
| E04 | `ui/today_action_screen.gd`、`data/today_action_data.gd`、`data/today_actions/*.tres` | 今日行动选择、选队、`make_map()` 和出发 |
| E05 | `missions/mission.gd`、`missions/squad_input.gd`、`missions/world_interaction_vfx.gd` | Expedition 实例、命令分发、反馈、完成与撤离 |
| E06 | `missions/search_task.gd`、`maps/generation/loot_spawner.gd`、`ui/expedition/poi_context.gd`、`search_card.gd`、`poi_entry.gd` | 目标、占用者、真实进度、取消/完成和搜索卡 |
| E07 | `survivors/survivor.gd`、`survivors/aim_fire.gd`、`weapons/weapon_combat_controller.gd`、`weapons/weapon_visual_controller.gd` | 自动攻击、武器数值、弹匣、命中和表现 |
| E08 | `enemies/enemy.gd`、`encounter/encounter_director.gd`、`data/enemies/enm_001_infected_basic_a.tres`、`data/expedition_encounter.tres` | 敌人 AI、初始/动态生成、噪音调查和伤害 |
| E09 | `time/mission_clock.gd`、`data/maps/east_quay.tres`、`data/expedition_encounter_config.gd`、`blue_hour/` | 昼夜转换、预警、敌人倍率与夜间压力 |
| E10 | `maps/random/random_map_generator.gd`、`maps/random/district_layout.gd`、`maps/city.gd`、`maps/exploration.gd` | 正式随机地图、道路/建筑、导航、探索可见性 |
| E11 | `data/catalog.gd`、`data/weapon_registry.gd`、`data/weapons/*.tres`、`data/survivors/*.tres` | 正式内容集合，区别于单纯图片/模型资产 |
| E12 | `core/effect_modifiers.gd`、`missions/special_power.gd`、`data/effects/*.tres`、`data/specializations/*.tres` | 数值效果、每日技能、开局获取与槽位 |
| E13 | `ui/mission_hud.gd`、`ui/expedition/`、`ui/settlement_screen.gd` | Expedition 信息/命令、真实搜索反馈、结算确认 |

## 1. 主流程

| 节点 | 状态 | 真实可达 / 玩法 | 主文件与缺口 |
|---|---|---|---|
| Main Menu | DONE | 新游戏、继续入口可达 | E01；不是玩法本体 |
| Skill Selection | DONE | 三种开局专精；确认保存后创建 Run | `ui/new_game_screen.gd`、`data/specializations/`；不是自由技能树 |
| Loading | DONE | 新建/续玩场景准备与过渡 | `scenes/loading/LoadingScreenV2.tscn`、E01；无独立玩法 |
| Camp | PARTIAL | 真实角色场景、闲逛、出发；HUD 多处 fixture | E03；管理入口断开，详见下节 |
| Mission Selection | PARTIAL | 固定三选一、选择出勤成员、生成配置 | E04；任务目标机制未分化 |
| Departure → Expedition | DONE | 出发角色行为后装配 Mission/HUD | `camp/camp_departure_controller.gd`、E05 |
| Return / Result | DONE | 等待存活出勤成员、准备/关门、结果、口粮分配与一次结算 | E02、E05、E13 |
| Result → 下一日 Camp | DONE | 非结束日 `commit_day()` 后重新展示 Camp | E01/E02；Camp 展示数字不因此自动成为真数据 |
| Run End 界面 | BROKEN | `won/lost` 判定可达，但没有结束页面装配 | `main.show_shelter()` 清页面并设 `state=ended`，只有 `state=shelter` 时实例化 UI；`_refresh_screen()` 无额外结束分支。最终画面需原生复现 |

## 2. Camp

| 功能 | 状态 | 实际情况 / 证据 |
|---|---|---|
| 幸存者场景展示 | DONE | `camp_main.configure()` 按 Campaign members 创建 Actor，删除作者放置的占位角色；E03 |
| HUD 幸存者展示/选择/详情 | STUB | `survivor_roster.gd`、`survivor_detail_fixtures.gd`、`camp_hud_root._select_survivor()` 读取固定资料，不修改 Campaign |
| 点击场景人物进入真实管理 | BROKEN | ShelterView 发 `member_selected`，Main 的 `select_member()` 因新 HUD 没有 `show_survivor` 而直接返回 |
| 生活行为 / POI | PARTIAL | `camp_ambient_behavior.gd`、`camp_actor.gd` 有闲逛/活动点/出发接管；没有生产、需求满足或居民经济循环 |
| Camp HUD | PARTIAL | 分模块布局已运行；出发/菜单接入，不等于每个模块有玩法 |
| 资源展示 | STUB | `resource_bar.tscn` 固定食物 10、废料 60、情报 3；无 Campaign 更新脚本接线 |
| 角色管理 / 训练成长入口 | UNUSED | `Campaign.train()`、`main.train_member()` 存在；当前 HUD 不调用。不能把食物训练算作正常可点击功能 |
| 装备 / 武器管理 | UNUSED | `equip_member/unequip_member/buy_weapon`、`ui/weapon_browser.gd` 存在；当前根 HUD 未装配浏览器，M07 为 Slot 01/02 占位 |
| 技能管理 | UNUSED | Campaign 有装备、卸下、扩槽、升级接口；当前 HUD 未接线，旧回调仍调用 `show_effects/close_context` 等不存在的方法 |
| 建筑功能 / Workshop / Greenhouse / Main Station | STUB | `camp_interactable.gd`、Camp Scene、`camp_dressing.gd` 有实体、描述与拾取信号；Main 未连接 `facility_selected` 到经营功能 |
| Camp Upgrade / Craft | NOT IMPLEMENTED | 没有营地升级成本→扣款→建筑效果或合成配方→材料消耗→产物链 |
| Food Consumption | DONE | 日结算按所有存活营地成员扣口粮，含未出勤成员；E02 |
| Healing | PARTIAL | Expedition `aid` 技能真实治疗；营地医疗设施/医疗资源消费未实现 |
| Survivor Recovery | PARTIAL | 下一次 Mission 按角色模板/饥饿倍率初始化 HP；非持续伤势治疗模拟 |
| Character Recruitment | NOT IMPLEMENTED | 无正式招募来源、价格或加入交互；模板池不等于招募 |
| Character Death | DONE | 战斗阵亡/持续缺粮移出本 Run 成员；E02 |
| Vehicle | PARTIAL | 巴士参与出发/归航；未实现维修、燃料、载具升级经营 |
| 出发 / 返回 / 日循环 / 天数推进 | DONE | 正常日可循环，五日数据终点；结束界面断点另列 E01/E02 |

## 3. Mission Selection / 今日行动

| 功能 | 状态 | 实际情况 / 证据 |
|---|---|---|
| 任务选择、缩略图、Hover / Selection | DONE | `today_action_screen.gd` 消费三个 Action Resource；出发确认送入 `main.start_mission()` |
| 固定任务选项 | DONE | `residential`、`commercial`、`airdrop` 三张卡来自 Catalog 固定集合 |
| 每日随机任务 / 今日刷新 | PARTIAL | 日数据、商店/奖励种子会变；选项仍是固定三种，不是每日随机任务池 |
| 地图选择 / Mission Seed | DONE | Main 正式传 `use_random_map=true`；seed 含 Run seed、day、mission counter、runtime nonce。生成器同 seed 可复现，不代表重试当天必然同图 |
| Mission Type | PARTIAL | 三个字符串：`supply_search`、`food_supply`、`rescue`；不同 POI 偏好，共用搜索/撤离目标 |
| Mission Reward / Modifier | PARTIAL | Action 先在旧地图乘 Food/Scrap 区间；随后随机建筑替换，建筑重新用 profile 配 loot，先前建筑乘数未重放；保留的车辆另论 |
| Mission Threat / 难度 | PARTIAL | spawn interval modifier 保留；`initial_enemy_fraction` 调好的初始上限被 `_apply_generated_map()` 按生成点数量覆盖；没有完整独立难度模式 |
| 不同任务影响 Runtime | PARTIAL | 不是纯 UI：生成建筑/POI、动态生成间隔改变；但宣称的全部奖励/初始威胁差异并未完整传到随机图 |
| Food Mission | PARTIAL | `commercial → food_supply`，偏向食物 POI；无独立目标计数/完成条件 |
| Material Mission | PARTIAL | 通用搜刮获得 Scrap；没有单独材料任务生命周期 |
| Weapon Mission | STUB | Action 的 weapon_sites 存在，仍依赖旧地点 ID；没有独立武器任务目标 |
| Rescue Mission | STUB | `airdrop → rescue` 只改变目标建筑选择；无待救 Survivor、交互、护送或入队 |
| Special Mission | NOT IMPLEMENTED | 无独立特殊规则目标链 |

关键代码顺序：`action.make_map(base_map)` → `Mission.setup()` → `RandomMapGenerator.generate()` → `_apply_generated_map()`。必须审计最终快照，不能只看 Action Resource 的倍率。

## 4. Expedition 操作

| 功能 | 状态 | 实际情况 / 证据 |
|---|---|---|
| 小队移动 / Survivor Selection / 多人控制 | DONE | `squad_input.gd` → Mission 成员过滤/路径命令；HUD 角色卡与场景选择接入 |
| Command Resolver / Survivor Task Lock | DONE | `move_command_members()` 过滤已开始搜索者；前往搜索点阶段可改派；普通 Move 不取消正在 SEARCHING 的任务 |
| Command Line / 点击落点 VFX / 选中环 | DONE | `world_interaction_vfx.gd` 和 Survivor visual 接入有效移动命令；历史原生截图/测试见第 16 节 |
| 集合 / 定位 / 停止 | DONE | Mission 命令与 HUD/输入接线；集合、停止等明确命令须与普通地面移动区分 |
| 撤退 / 上车 / Extraction / Return Vehicle | DONE | `command_extract()` 明确释放任务，全体存活出勤成员返回巴士，等待准备/关门后结束 |
| Pathfinding / Navigation | DONE | `city.gd` AStarGrid2D、碰撞派生阻挡与 `line_clear()`；不是依赖角色模型实现寻路 |
| 建筑遮挡 | PARTIAL | 视线/射击有静态阻挡；视觉遮挡与卡片避让存在，所有随机朝向的视觉完美性未重新验收 |

Survivor Command V1 的核心规则已接入。这里的“明确取消才中断”针对普通 Move：死亡、任务结束以及玩家明确撤离等流程仍会清理任务，不应被误解成 SEARCHING 永远不可清理。

## 5. Search / Loot

| 功能 | 状态 | 实际情况 / 证据 |
|---|---|---|
| 建筑搜索 / 车辆搜索 / SearchTask | DONE | 同一 `SearchTask`，目标各有任务与 worker；车辆必须是 `lootable`，装饰车辆不是搜索点 |
| Search Lifecycle | DONE | 任务态含 ASSIGNED、MOVING_TO_ENTRANCE、ENTERING、SEARCHING_INSIDE/OUTSIDE、DEFEND、EXITING、COMPLETE、CANCELLED；`search_target_state()` 提供目标只读映射 |
| Cancel Search / UI 清理 | DONE | 明确取消清 worker/目标任务；卡片按真实搜索态显示，无人搜索不应保留取消入口；历史专项通过 |
| Search Progress / 100% | DONE | site.progress 连续更新并 clamp 到 1.0，完成即释放搜索状态；不是显示百分比单独计时 |
| Search Resume | DONE | 地点持有进度，取消后可再次指派未完成目标；完成目标不可再次刷奖励 |
| Combat Pause / Self Defense / Resume | DONE | 外部搜索遇险 DEFEND、安全后继续；室内隐藏搜索者不成为外部敌人目标，不能一概说所有搜索都会被战斗打断 |
| 多幸存者并行 | DONE | `search_tasks[id]` 独立 worker；清理一个任务不应清其他任务 |
| Loot Table / Food / Scrap | DONE | `LootSpawner.PROFILES` → `resolve_site_loot()` → ground pickup → Ledger；不同 profile 独立概率 |
| Weapon Loot | PARTIAL | 数据/落地/入账实现存在；`reward_for_site()` 只认 Action weapon_sites 和 Campaign day_rewards 的旧 ID。随机建筑 slot_id 不匹配 garage/depot；保留旧车辆 car_west 的分支仍可能有效 |
| Medical / Fuel / Parts | NOT IMPLEMENTED | `medical_basic/fuel_vehicle/vehicle_parts_tools` 是倾向名称，实际仍只产 Food/Scrap |
| Rare Loot | PARTIAL | 武器实例存在稀有度/词条；不存在通用稀有物品搜刮系统，且武器获取受上述接线限制 |
| Ground Pickup / 自动拾取 | DONE | 搜索先掉地上，附近存活且不在建筑内的成员拾取才入 Ledger；不是完成时直接加到账户 |
| Search Result Toast | DONE | `search_completed/search_loot_collected` → Mission HUD 排队短提示；区分找到与实际拾取，包含人物、目标及数量 |
| 防重复奖励 | DONE | `searched`、完成任务释放、武器 uid 已入库存检查共同约束 |

基础时间集中在 `maps/generation/loot_spawner.gd`：车辆 4 秒、住宅 8 秒、商业/药店 12 秒、大型/工业 18 秒；实际时间还经过 Trait 与 EffectModifiers。当前随机建筑基本标记 searchable，固定街区则由可搜索布置筛选。

| Loot profile | Food：概率 × 数量 | Scrap：概率 × 数量 |
|---|---|---|
| general | 80% × 2–3 | 100% × 1–3 |
| food_high | 100% × 4–7 | 65% × 1–3 |
| food_medium | 100% × 3–5 | 60% × 1–2 |
| medical_basic | 25% × 1–2 | 100% × 3–5 |
| materials_tools | 20% × 1–2 | 100% × 6–10 |
| fuel_vehicle | 30% × 1–2 | 100% × 4–6 |
| vehicle_parts_tools | 15% × 1 | 100% × 4–7 |
| vehicle_supply | 60% × 1–2 | 100% × 2–4 |
| vehicle_salvage | 20% × 1 | 100% × 1–3 |
| vehicle_food | 100% × 2–3 | 70% × 1–3 |

V2 的搜索状态、进度、取消与并行主链为 DONE；跨随机地图的武器奖励与任务倍率衔接为 PARTIAL，不能由 Search fixture 测试通过推断全部奖励来源可达。

## 6. Combat

| 功能 | 状态 | 实际玩家链路 / 限制 |
|---|---|---|
| Auto Attack / Target Acquisition | DONE | Survivor tick → WeaponCombatController，筛存活目标、射程/视线；不是仅测试调用 |
| Attack Range / Fire Rate / Damage / Weapon Damage | DONE | WeaponInstance 数值、Trait、EffectModifiers 进入冷却与伤害计算 |
| Ammo / Magazine / Reload | DONE | 按弹匣消耗，空弹匣自动装填；装填回满，无持久备用弹药库存经济 |
| Melee / Ranged | DONE | 近战不扣弹，远程散射/弹丸数/穿透按武器配置 |
| Projectile / Hitscan | PARTIAL | 即时射线/几何命中解析与 tracer 表现；不等于独立飞行弹丸物理系统 |
| MuzzlePoint | DONE | WeaponVisual 查找枪口；战斗 tracer 使用 muzzle.global_position，缺失时回退角色位置 |
| Muzzle Flash | PARTIAL | VisualController 只给 LONG_GUN 且有 MuzzlePoint 的分支创建闪光；不能说开局 P9 同样已具备 |
| Bullet / Tracer | DONE | `Visuals.tracer()` 在每次射击解析中调用 |
| Hit Feedback | PARTIAL | HP 条、命中表现/击退数值已接入；不同武器的完整可见反馈未逐把本轮验证 |
| Damage Number | NOT IMPLEMENTED | 未发现正式伤害飘字系统 |
| Enemy Hit Reaction | PARTIAL | 伤害/击退与 HP 更新存在；`enemy.take_damage()` 不触发独立受击动画 |
| Enemy Death | PARTIAL | HP 为零 → DEAD、隐藏、碰撞关闭、回收；生命流程完整，死亡动画/尸体表现不完整 |
| Survivor Damage / Survivor Death | DONE | 敌人前摇后验证距离/墙体，扣血/死亡；任务与结算移除成员 |
| Friendly Fire | NOT IMPLEMENTED | 当前攻击解析筛敌方目标，无友军伤害规则；不是现有玩法 Bug |
| Combat Movement / 直接指向射击 | DONE | 小队移动时战斗，AimFire 支持指向射击，受弹匣/墙体约束 |
| Search Self Defense / Pause / Resume | DONE | SearchTask 的 DEFEND 与恢复分支，室内与室外有差别 |
| Weapon Switching | PARTIAL | 换装数据与重新装配战斗有效，当前营地正常入口断开；无战斗中自由轮换背包武器入口 |
| Weapon Type / Stats | DONE | 8 定义共用实例/控制器；详见第 11 节，定义存在不等于全部可获得 |

## 7. Enemy / Infection / Horde

| 功能 | 状态 | 实际情况 / 证据 |
|---|---|---|
| ENM_001 infected_basic_a | DONE | Catalog 唯一敌人 Resource；EncounterDirector 生成同 ID |
| Initial Spawn / Enemy Spawn | DONE | 到达区、街道、小群、建筑入口和远处生成；位置验证可行走、距离、可达性 |
| Runtime Spawn / Spawn Distance | DONE | 白天补最低人口，非白天按批次边缘生成；排除可见/屏幕内与安全距离、受人口上限约束 |
| AI / Idle / Wander / Detection / Chase / Attack | DONE | `enemy.gd` 状态机，有 FOV、墙体视线、记忆、路径追击、攻击前摇与伤害结算 |
| Noise / Target Selection / Navigation | DONE | 噪音调查、最近可见合法目标、AStar 路径；室内/上车/死亡者排除 |
| Damage / Death / 回收 | DONE | HP、DEAD、碰撞关闭；Mission 对象池回收复用。死亡视觉单列为 PARTIAL |
| 距离 Despawn | PARTIAL | 远处降低思考/寻路频率不等于距离删除；未确认完整远离淘汰策略 |
| Enemy Density | DONE | 人口上限、初始范围、生成批量与间隔数据驱动；正式随机图覆盖初始范围，不能直接引用固定图 18–30 为每局数量 |
| Enemy Scaling / Blue Hour Scaling | DONE | phase/threat 更新血量、伤害、速度、感知；保留受伤比例，不重置满血 |
| Day Scaling | PARTIAL | 跨日数据循环与局内昼夜难度存在；未发现完整按 Campaign day 分层敌种/关卡难度曲线 |
| Horde / Horde Spawn / Night Horde | PARTIAL | 有实际运行的非白天群体压力生成与追踪目标，但没有完整尸潮模式 |
| Wave | NOT IMPLEMENTED | 无正式波次开始/清完/奖励/下一波生命周期 |
| Special Infected / Elite / Boss | NOT IMPLEMENTED | 无正式特殊感染者、精英、Boss 内容与流程 |

**当前有基础尸潮压力，没有完整 Horde Gameplay。** `Mission` 推进 `EncounterDirector.advance()`；`clock.phase != DAY` 后用 `blue_hour_spawn_batch`，在地图边缘尝试成组生成，标记 `encounter_origin=horde`。敌人调查近期大噪音位置，否则队伍附近或小概率巴士附近。间隔随停留时间缩短，人口上限限制实际数量，安全/可见性/路径检查可能使本次生成失败。它不是 Debug 专属，也不能因大量 spawn 就标成完整尸潮 DONE。

## 8. 时间 / Blue Hour

| 功能 | 状态 | 实际情况 |
|---|---|---|
| Day Timer / Countdown / 白昼 | DONE | `Mission._advance_world()` → `clock.advance()`；基础白昼 150 秒，可被开局道具延长 |
| 黄昏 / 蓝时 / Trigger | DONE | 正式阶段 DAY → BLUE_HOUR → NIGHT；预警是 DAY 内区段，不是第四个独立黄昏阶段；蓝时基础 18 秒 |
| 时间 UI / Blue Hour Visual | DONE | HUD phase/remaining 与昼夜表现消费真实 Clock，不是独立模拟时间 |
| 时间暂停 | DONE | 战术暂停控制世界推进；`dusk_delay` 只冻结非 NIGHT 的 Clock，不应冻结角色行动 |
| 时间延长技能 | PARTIAL | `early_start` 正常开局可得，`dusk_delay` 有实现但常规获取入口未接通；已有 freeze 测试失败需复验 |
| Enemy Changes / Spawn Changes / Difficulty | DONE | 感知、听觉、速度、HP/伤害倍率、生成间隔/批量和 Night threat 实际变化 |
| Blue Hour Horde | PARTIAL | 上节群体生成压力分支，无独立波次结算 |
| 超时 / 强制撤离 | PARTIAL | 白昼超时进入蓝时再入夜；不强制撤离、不直接判负；可以继续探索，但压力持续增加 |
| 失败条件 | DONE | 出勤全灭结束本次行动；Run 是否失败由营地剩余成员/日结算决定。计时到零不是 Game Over |

蓝时不是纯滤镜。`MissionClock` 的 `perception_multiplier/movement_multiplier/hp_multiplier/damage_multiplier/spawn_interval` 被敌人和生成器实际消费。Night threat 每 25 秒增加；非白天压力间隔还通过 encounter 配置继续缩短。当前标准 encounter 基础批量为 4、基础蓝时间隔 25 秒、pressure 周期 30 秒、最低间隔 4 秒，实际间隔再经过倍率和 Action 配置。

## 9. 地图

| 功能 | 状态 | 实际情况 / 限制 |
|---|---|---|
| 固定 Expedition Map | PARTIAL | `east_quay.tres` 是基础配置/固定布局/测试输入；正常新出勤会覆盖建筑与道路，不能称当前正式地图固定 |
| Random Map / Procedural Generation / Seed | DONE | Main 正式启用 `maps/random`；在 SMALL_3X3、MEDIUM_3X4、MEDIUM_4X4 模板内随机挑建筑、布局和目标，不是无限制城市生成 |
| Road Generation / Building Placement | DONE | 模板道路、frontage 槽位、尺寸校验、旋转/入口与搜索点映射；正式 Mission 消费结果 |
| District / Residential / Commercial / Industrial | PARTIAL | 分类影响建筑抽样；生成后 map.districts 被清空，没有完整区域玩法/经营分区 |
| POI / Mission POI | PARTIAL | 有保留目标槽位和类别偏好；无独立救援目标/完成约束，Main required_poi_tags 为空 |
| Arrival / Extraction | PARTIAL | 实际上车撤离用 `map.bus_position`；generator 输出 extraction 另存 `generated_extraction`，不能据此认定独立撤离点已接入 |
| Spawn Zone / Horde Entry | PARTIAL | 安全距离、边缘与出生区域有效；没有独立可交互/可封堵尸潮入口 |
| Decoration | PARTIAL | City 可构造环境；随机适配清空旧 props/vegetation/parking 等，其他 town 展示不能当正式图装饰 |
| Vehicle Placement / Searchable Placement | PARTIAL | 可搜索建筑是真实生成；随机替换没有重新生成 vehicles，也未清除旧 map.vehicles，存在沿用基础图车辆坐标的混合链路；碰撞适配需逐 seed 验证 |
| Navigation Baking | PARTIAL | 正式 Expedition 使用碰撞派生 AStarGrid，不是完整运行时 NavigationMesh baking；基础路径可玩 |
| Minimap Generation | DONE | Mission HUD 根据实际地图/探索数据绘制 |
| Fog of War / Visibility / Exploration Discovery | DONE | `maps/exploration.gd` 与 HUD、目标/拾取可见性接线 |
| Hazard / World Event | NOT IMPLEMENTED | 未发现独立危险区、世界事件触发/状态/奖励循环 |
| maps/town 生成/环境系统 | UNUSED | `--town-*` 参数和 debug Scene 可达，非正常 Mission Selection→Expedition 地图链 |

注意：generator 的 `zombie_spawns` 在 Mission 中用来算初始数量，实际位置仍由 EncounterDirector 选择；`loot_spawns` 也不等于独立地面随机物品事件。不能只看返回字段便认定全部被使用。

## 10. Survivor

| 功能 | 状态 | 实际情况 |
|---|---|---|
| 正式模板数量 / Character Data | DONE | Catalog 5 个：lin、qiao、yan、xia_zhiyao、su_wanxing；starter_pool 2 个，starting_count=2 |
| HP / Move Speed / Attack / Weapon | DONE | SurvivorData、Trait、武器实例、Mission/伤害链实际消费 |
| Trait | PARTIAL | 五份 Trait 均有绑定；steady/scavenger/resilient 的伤害、搜索速度、承伤倍率有消费者。route_intuition 的 detection_bonus 与 resource_efficiency 的 bonus_chance 只在参数缩放/说明中读取，未接搜索发现/掉落计算；不能把两位起始角色天赋说明当成已生效 |
| Profession | STUB | SurvivorData 有 profession_id/name，`data/professions/` 两资源；未发现职业独立数值/成长消费链，不能把 Trait 等同职业系统 |
| Passive / Skill | PARTIAL | 队伍 Run 槽位与 Power 实现，非每角色专属技能树；详见下一节 |
| Level / Growth | PARTIAL | Campaign 等级/食物训练有数值路径；新营地 UI 无训练入口 |
| XP | NOT IMPLEMENTED | 未找到通过战斗/搜索累计 XP 并自动升级的链路 |
| Injury | PARTIAL | 单次行动扣 HP 与饥饿降上限；无长期伤病类型/治疗时间 |
| Death / Permanent Death | DONE | 死亡者在日结算移出本 Run，装备有遗失处理；新 Run 重新创建，不是跨存档永久删角色 |
| Hunger | DONE | 缺粮计数、下次生命倍率、连续缺粮供养选择/减员；E02 |
| Mood | NOT IMPLEMENTED | 无正式心情驱动玩法；显示文案不算数值系统 |
| Recruitment / Rescue | NOT IMPLEMENTED | 没有正常增加新成员的救援/招募循环 |
| Camp Behaviour | PARTIAL | 真实 Actor/活动点演出，不消费生产/情绪经济 |
| Expedition Behaviour / Animation State | DONE | 移动、搜索、攻击、死亡、上车及动画桥已消费真实状态；个别角色/武器动作质量不等于全覆盖 |

## 11. 武器

注册与消费：`WeaponRegistry.definitions()` → Catalog → Campaign WeaponInstance/装备 → Survivor → WeaponCombatController。类型、damage、rate、range、magazine、reload、accuracy、pellets、spread、penetration、knockback、animation_profile 均为正式数据，不是按图片计数。

| 正式 ID / 名称 | 战斗实现状态 | 正式模型配置 | 正常新开局可达性 |
|---|---|---|---|
| WPN_001_SURVIVAL_KNIFE / 拓荒短刀 | DONE | 有 GLB | 苏晚星起始装备 |
| WPN_002_P9_PISTOL / P9 制式手枪 | DONE | 有 GLB | 夏知遥起始装备 |
| WPN_003_R6_REVOLVER / R6 左轮手枪 | PARTIAL | model_path 空 | 有商店/奖励池定义；获取→换装受入口限制 |
| WPN_004_K9_SMG / K9 冲锋枪 | PARTIAL | model_path 空 | 同上；qiao 模板起始武器不代表 qiao 正常开局入队 |
| WPN_005_S12_SHOTGUN / S12 泵动霰弹枪 | PARTIAL | model_path 空 | 同上 |
| WPN_006_A21_ASSAULT_RIFLE / A21 突击步枪 | PARTIAL | 有 GLB | 战斗/动画可装配；正常玩家获取与换装链不完整 |
| WPN_007_H7_HUNTER_RIFLE / H7 猎手步枪 | PARTIAL | model_path 空 | 有参数/注册，无完整正常获取换装入口 |
| WPN_008_L56_LMG / L56 轻机枪 | PARTIAL | model_path 空 | 同上 |

这里 PARTIAL 不是说控制器不认识该武器，而是“正式武器从获取到玩家使用”的完整链路未闭合。`WeaponVisualController.attach_weapon_visual()` 遇到空 model_path 直接返回，不创建手持模型；战斗数值仍独立运行。

| 审计项 | 状态 | 说明 |
|---|---|---|
| Weapon Data / Category / Damage / Fire Rate / Range / Magazine / Reload / Ammo | DONE | 8 个定义注册、实例计算并被战斗控制器消费；弹药不是持久资源 |
| Weapon Loot / Equip | PARTIAL | 底层和旧地点有效，新 Camp UI / 随机建筑奖励断层 |
| Runtime Model / Icon / Combat Animation | PARTIAL | 三把配置正式模型，图标/动画 profile 和视觉控制器存在；不能推出 8 把在当前流程完整呈现 |
| Random Stats | PARTIAL | Equipment/WeaponInstance 的随机稀有度、词条与最终数值实现；获取入口限制同上 |
| Upgrade / Craft | NOT IMPLEMENTED | 未发现正常武器升级扣款或配方制作循环；Passive 升级不是武器升级 |

## 12. Item / Passive / Skill / Buff

所有下表数据来自 `data/effects/<id>.tres`。UI 的“正常可得”指新开局三专精选项，不包括 Debug 手动授予、测试直接装槽、旧存档已有物品。Mission HUD 仅为已装备 Power 创建实际按钮与数字快捷键。

| 类别 / ID | 基础效果 / 消费方 | 状态 | 正常可得 |
|---|---|---|---|
| Passive shooting_target | 远程伤害 ×1.25；Mission.damage_to | DONE | combat |
| Passive replicator | 每日 40% 复制库存武器；Campaign._copy_reward | DONE | scavenge |
| Passive early_start | 白昼 +20s；Mission 初始化 Clock | DONE | survey |
| Passive spare_magazine | 远程攻速 ×1.18，实际不是增加弹匣；EffectModifiers.attack_interval | UNUSED | 无普通获取入口 |
| Passive armor_plate | 承伤 ×0.82；incoming_damage | UNUSED | 同上 |
| Passive tool_belt | 搜索时间 ×0.7；search_seconds | UNUSED | 同上 |
| Passive folding_cart | 资源 ×1.35、速度 ×0.92；拾取与移动 | UNUSED | 同上 |
| Passive old_watch | 提前预警 30s、归航速度 ×1.12；Clock UI/移动 | UNUSED | 同上 |
| Power rage | 伤害 ×2；限时 Modifier | DONE | combat |
| Power sprint | 速度 ×1.5；限时 Modifier | DONE | scavenge |
| Power aid | 全队治疗 max HP 的 40%；activate() | DONE | survey |
| Power focus_fire | 优先目标伤害 ×1.5；ThreatSelector/damage_to | UNUSED | 无普通获取入口 |
| Power scavenge_frenzy | 搜索时间 ×0.3；限时 Modifier | UNUSED | 同上 |
| Power dusk_delay | 暂停非夜间 Clock；角色行动应继续 | UNUSED | 同上；历史 freeze 断言失败需复验 |
| Character Skill | 独立个人主动技能 | NOT IMPLEMENTED | 当前 Power 属于 Run 装备槽 |
| Buff | 上述限时增益、持续时间、每日一次与清除 | DONE | SpecialPowerState/advance/clear |
| Debuff | 饥饿生命倍率、推车移速代价 | PARTIAL | 有具体负效果，无通用中毒/感染/流血体系 |

数量结论：**数值实现 8 Passive + 6 Power；正常开局可选覆盖 3 + 3；单 Run 初始装备 1 + 1。** 扩槽、获取其余效果和一次升级是 Campaign/API/Debug 能力，目前不能算正常玩家成长玩法。Catalog 中的 4 个武器词条属于武器随机数值，不能加到 Passive Item 数量。

## 13. 资源与经济

| Resource Currency | 状态 | 来源 | 消耗 / 使用 | 保存 / 上限 |
|---|---|---|---|---|
| Food | DONE | 搜索掉落→自动拾取→Ledger→成功归航结算；开局 6 | 每日每名存活成员 1；训练 API 费用为 1/2/3/4，但当前 UI 不可达 | Campaign 存档；未发现正式库存上限 |
| Scrap | PARTIAL | 同上 | `Campaign.buy()` 按武器价格扣款；当前 Camp 无购买入口，因此正常游玩缺少可达消费口 | Campaign 存档；未发现正式库存上限 |
| Intel / 情报 | STUB | Camp ResourceBar 固定数字 3 | 无真实获取/消费 Ledger | 未发现正式存档字段 |
| Medical / Fuel / Parts | NOT IMPLEMENTED | 无 | profile 名称不能充当新货币 | 无 |
| 武器实例 | PARTIAL | 旧奖励点/商店/复制；不同 uid | 装备与阵亡遗失，非 Resource Currency | inventory/equipment 存档；入口受限 |

Food 压力真实存在：首日不足记录 hunger，下一次出勤最大生命乘 0.8；再次缺粮需选择供养成员，未供养者移除。不是单纯负数展示。日结算消费覆盖留营者，不只出勤者。无完整燃料/医疗/维修/生产经济。

## 14. Run / Roguelite / Meta

| 功能 | 状态 | 实际情况 |
|---|---|---|
| Run / Run Start / New Game | DONE | 专精确认、成员实例、武器、资源、day/status、保存；新建覆盖有确认 |
| Day Progression | DONE | result pending → commit_day → 下一天，end_day=5 |
| Run End / Win / Lose 判定 | DONE | 无营地成员 → lost；仍有人且第五日结算 → won |
| Game Over / 胜利结束 UI | BROKEN | main 的 ended 分支未创建页面；不能认定完整玩家结束→重开闭环 |
| Skill Selection | DONE | 开局专精三选一，不是每关随机三选一技能成长 |
| Difficulty Progression | PARTIAL | 局内昼夜威胁完整；跨日丰富敌种/目标曲线不完整 |
| Final Goal | PARTIAL | 活过五日日结算的数据终点；无最终救援、终局关或 Boss |
| Permanent Unlock / Character Unlock / Weapon Unlock / Meta Currency | NOT IMPLEMENTED | 无跨 Run 持久解锁经济；Catalog 全集不等于解锁进度 |
| Boss Progression | NOT IMPLEMENTED | 无 Boss 或对应阶段链 |
| Save / Load | DONE | Run、pending、备份/验证/失败回滚；行动退出可重试，不是中途逐帧世界快照 |
| 完整 Roguelite Run | PARTIAL | 五日状态机真实存在；营地成长入口和结束页面断点意味着目前不能判完整 Run DONE |

出勤全灭不总等于整局立即失败：如果有留营成员，Campaign 仍可能继续。所有营地成员战死/饿死才进入 lost。倒计时结束不失败，是否搜完所有建筑也不是胜利条件。

## 15. UI → Gameplay 接线

UI connection 是用户要求的连接属性；Status 仍使用六种统一状态。

| UI | Status | Connection | 真源 / 断点 |
|---|---|---|---|
| Camp HUD | PARTIAL | Partial | 出发/菜单接 Main；其余多数局部展示 |
| Camp Survivor Roster / Detail | STUB | Placeholder | DetailFixtures 与本地 selection；不是 Campaign roster |
| Camp Resource Bar | STUB | Placeholder | 固定 10/60/3，不随 Ledger/Campaign |
| Camp Action Bar | STUB | Placeholder | Q/E 只发本地信号，未连接正式技能/医疗 |
| Camp Loadout | STUB | Placeholder | M07 占位标签，旧换装界面未装配 |
| Mission Selection | PARTIAL | Partial | Action 与 party 真接入；显示差异未完整反映最终随机图 |
| Expedition HUD / Survivor Cards / Resource Bar | DONE | Connected | Mission 成员、HP、任务、Ledger |
| Search Card | DONE | Connected | 真实 task 搜索态/进度；取消发回 Mission |
| Discovered Panel | DONE | Connected | Exploration/POI 发现和目标状态 |
| Minimap | DONE | Connected | 地图、探索与场景位置 |
| Expedition Action Bar | DONE | Connected | Move/归航/已装 Power；不同于 Camp ActionRail |
| Time Bar | DONE | Connected | MissionClock |
| Loading | DONE | Connected | 场景装配/继续过渡，无玩法数值 |
| Result Screen | DONE | Connected | pending outcome、口粮供养、commit_day |
| Run End | BROKEN | Broken | 数据 ended 后无页面实例化 |
| Weapon Browser / 旧效果管理入口 | UNUSED | Orphaned | 脚本存在，新 HUD 无正常入口 |

## 16. 测试与 Runtime 健康

本轮检查测试源码与已有产物，未重跑游戏测试。下面的通过记录只说明对应测试曾覆盖该路径；直接构造 Mission/装备/目标的 fixture 不证明“从新菜单自然玩到该内容”。

| 测试 / 产物 | 层级与覆盖 | 当前证据 / 限制 |
|---|---|---|
| `tests/rules.gd`、`new_run.gd`、`day_loop.gd` | Resource/规则/数据单元 | 不验证当前 Camp 点击入口 |
| `tests/new_run_flow.gd`、`day_loop_flow.gd`、`mission_flow.gd` | 实际 Mission/跨日集成 | 部分硬编码旧地点，不能替代当前随机流程 |
| `tests/search_gameplay.gd` | 建筑/车辆、100%、取消、并行、奖励集成；有原生截图 | `test-output/search-gameplay/results.json`：72 checks、0 failures；本轮已读取 |
| `tests/survivor_command.gd`、`search_dispatch.gd`、`parallel_commands.gd` | Mission 命令过滤/并行/搜索锁 | `test-output/survivor-command/runtime.json`：45 checks、0 failures；原生截图在同目录，不是本轮重跑 |
| `tests/search_active_card.gd`、`poi_context_runtime.gd` | 搜索卡原生布局/命令/UI | `test-output/search-active-card/runtime.json`：46 checks、0 failures，注明原生合成输入/内存 Campaign；同目录有 normal/hover/不同分辨率产物，不能外推所有 seed |
| `tests/weapon_system.gd`、`weapon_runtime.gd`、`weapon_visuals.gd` | 数值、战斗实例、原生模型/表现 | `test-output/weapon-visuals/results.json`：1377 checks、0 failures；不证明 8 武器均能正常获取 |
| `tests/infected_basic.gd`、encounter 相关测试 | 敌人、感知、生成、阶段行为 | 有真实 Scene/Mission 测试；完整多波尸潮无对应玩法可测 |
| `tests/random_map_generation_test.gd` | 纯生成计划、种子/槽位规则 | Generator 层，不保证奖励 ID/前端入口正确 |
| `tests/random_mission_integration_test.gd`、`random_formal_runs.gd` | 正式 Mission 随机图接入 | 与纯 generator 测试分开；不能替代长期全部种子统计 |
| `tests/effect_system.gd`、`effect_runtime.gd` | 数值与 Mission 效果 | `test-output/effect-system.json`：324 checks，2 个 freeze 期间 action time 不推进的失败；需隔离复验，不能报告全绿 |
| `tests/camp_ui_runtime.gd` | Camp 原生流程 | 仍访问 `app.camp_ui.member_buttons`、drawer 等旧接口；与当前 HUD 不兼容 |
| `tests/today_action.gd`、`today_action_runtime.gd` | 任务选择/出发 | 历史记录存在旧 departure 属性断言，需更新后才能覆盖当前节点结构；本轮不修 |
| town / animation / locomotion 专项 | 专属场景/视觉测试 | 不等于正式 Mission 全玩法接入证据 |

已知健康问题与证据界限：

1. **完整 build 门禁有阻塞记录**：此前 `run.ps1 -Mode build` 被 Camp UI 旧断言/属性阻断；本轮确认 `tests/camp_ui_runtime.gd` 仍访问缺失的 `member_buttons`。现有可运行 EXE 不代表完整门禁已通过。
2. **潜在正式流程断点**：Camp 场景人物详情回调提前返回；旧效果回调调用当前 HUD 不存在的方法；结束状态没有页面。前者由代码可确定，点击触发的全部屏幕表现为 `UNKNOWN / NEEDS RUNTIME VERIFICATION`。
3. **旧 fixture**：mission_flow/effect_system 的 `corner`、Camp member_buttons/departure 和旧 ability bar 断言不能沿用为当前玩法结论。effect-system JSON 确有失败，本轮不假定所有失败都只是测试问题。
4. **ObjectDB Leak**：此前 Search Card 原生测试记录有 2 条泄漏警告；未在本轮复现或定位，不等同所有运行必泄漏。
5. **Missing Resource / Invalid UID / Invalid Node / Runtime Error**：无本轮全量引擎扫描。现有专项通过不证明全局为零；未找到足以断言全项目无错误的当前一致结果，标记 `UNKNOWN / NEEDS RUNTIME VERIFICATION`。
6. **历史 world_map**：有街道道具专项失败记录；本轮未复验，不把其自动归因于 Search V2。
7. 正常新 Run 的“获得非起始装备→Camp 换装→下一日战斗”、全部 14 效果正常获取、五日终点当前 HUD，以及随机建筑奖励倍率/地点 ID 配对，缺少能证明闭环的当前端到端通过证据。

## 表 A：Gameplay Feature Matrix

| Domain | Feature | Status | Runtime Connected | Main Files | Notes |
|---|---|---|---|---|---|
| Flow | 菜单/专精/Loading | DONE | Yes | core/main.gd; ui/new_game_screen.gd | 正常入口可达 |
| Camp | 实际角色/出发 | DONE | Yes | camp/camp_main.gd; camp/camp_departure_controller.gd | 与 Campaign 身份关联 |
| Camp | HUD 资料/资源/动作 | STUB | Presentation only | ui/camp_hud/ | fixture 混入正式 UI |
| Camp | 训练/商店/换装/效果管理 | UNUSED | API only | core/campaign.gd; ui/weapon_browser.gd | 当前 HUD 未接入口 |
| Camp | 建筑生产/升级/合成 | NOT IMPLEMENTED | No | camp/camp_interactable.gd | 只有实体/描述不算玩法 |
| Mission | 三选一/随机参数 | PARTIAL | Yes | data/today_action_data.gd; core/main.gd | 部分倍率被后续替换覆盖 |
| Mission | Rescue | STUB | Generator only | maps/random/random_map_generator.gd | 无实际救人 |
| Commands | Move 过滤/Task Lock/VFX | DONE | Yes | missions/mission.gd; missions/world_interaction_vfx.gd | Command V1 已接入 |
| Search | 建筑/车辆/取消/并行/100% | DONE | Yes | missions/search_task.gd | Search V2 主链已接入 |
| Loot | Food/Scrap/拾取/Toast | DONE | Yes | maps/generation/loot_spawner.gd; ui/mission_hud.gd | 真奖励入 Ledger |
| Loot | 武器奖励 | PARTIAL | Mixed | missions/mission.gd; data/day_loop.tres | 随机建筑 ID 与旧奖励表不符 |
| Combat | 自动战斗/近远程/弹匣 | DONE | Yes | weapons/weapon_combat_controller.gd | 真实数值链 |
| Combat | 枪口/受击/死亡视觉 | PARTIAL | Mixed | weapons/weapon_visual_controller.gd; enemies/enemy.gd | 部分模型/动作缺口 |
| Enemy | 单一感染者 AI/生成 | DONE | Yes | enemies/enemy.gd; encounter/encounter_director.gd | 一种正式敌人 |
| Horde | 蓝时/夜间群体压力 | PARTIAL | Yes | encounter/encounter_director.gd | 无完整波次玩法 |
| Enemy | 特殊感染者/精英/Boss | NOT IMPLEMENTED | No | data/catalog.gd | 无正式内容 |
| Time | 昼夜与威胁倍率 | DONE | Yes | time/mission_clock.gd | 非视觉占位 |
| Map | 正式随机建筑/道路 | DONE | Yes | maps/random/; missions/mission.gd | 模板内随机 |
| Map | 车辆/奖励/撤离字段整合 | PARTIAL | Mixed | missions/mission.gd | 固定与随机配置混合 |
| Map | town 环境生成 | UNUSED | Debug only | maps/town/; scenes/debug/ | 非正常 Expedition |
| Survivor | HP/行为/局内永久死亡 | DONE | Yes | survivors/survivor.gd; core/campaign.gd | 正常起始两人 |
| Survivor | 职业/招募/救援 | STUB | Data only | data/professions/; data/survivor_data.gd | 职业字段存在；招募/救援玩法未实现 |
| Effects | 起始 3 Passive/3 Power | DONE | Yes | data/specializations/; missions/special_power.gd | 每局各一项 |
| Effects | 其余 5 Passive/3 Power | UNUSED | Debug/saved slots | data/effects/; core/campaign.gd | 有消费者，无正常获取入口 |
| Economy | 日粮与饥饿 | DONE | Yes | core/campaign.gd | 真资源压力 |
| Economy | Scrap 消费入口 | UNUSED | API only | core/campaign.gd; core/main.gd | 商店未接新 HUD |
| Run | 五日判定/存档 | DONE | Yes | core/campaign.gd; core/save_store.gd | 不含结束画面 |
| Run | 结束界面 | BROKEN | Missing branch | core/main.gd | ended 未创建页面 |
| Meta | 跨局解锁/货币 | NOT IMPLEMENTED | No | core/campaign.gd | 新 Run 重建状态 |

## 表 B：Current Playable Loop

| 玩家阶段 | 当前实际能做什么 | 边界 |
|---|---|---|
| 1. 开局 | 选择 combat/scavenge/survey；创建夏知遥+苏晚星，P9+短刀，6 食物 | 三组基础 Passive/Power，不是随机技能掉落 |
| 2. 营地 | 看真实角色活动，操作局部展示 HUD，点击出发 | HUD 资料/资源不可靠代表存档；不能假设商店/训练/换装可用 |
| 3. 选任务 | 三张行动卡中选一，配置出勤小队 | 选项固定；地图生成不同，但目标机制都是搜刮撤离 |
| 4. 出勤 | 随机街区探索、选人/多人移动、自动战斗、使用开局技能 | 感染者只有一种；任务没有真实救人分支 |
| 5. 搜索 | 指派不同成员搜建筑/可搜索车辆，等待真实进度；取消或继续 | 开始搜索不被地面 Move 隐式覆盖；资源需实际拾取 |
| 6. 承担风险 | 白天探索，蓝时/夜间继续贪资源或决定归航 | 夜间压力真实增长；无倒计时强制判负 |
| 7. 返回 | 明确归航，全体存活出勤者到巴士，上车/关门后结算 | 出勤全灭丢失携带物资，不一定营地全灭 |
| 8. 日结算 | 查看损失和物资，消耗全营地口粮，缺粮时承担饥饿/减员 | 只结算一次；保存成功再推进 |
| 9. 下一日/结束 | 有人存活且未到第五日则继续以上循环；第五日数据判 won，无人则 lost | 当前结束 UI 分支缺失，不能写成已完整通关并展示结局 |

## 表 C：Major Missing Gameplay

以下按系统归类，不代表开发优先级。

| 系统 | 缺口 | 依据 |
|---|---|---|
| Camp Management | HUD 真数据、管理入口、设施功能、生产/升级/合成 | E03 与 Campaign/API 脱节 |
| Mission Diversity | 实际救援、任务目标/完成条件差异、每日任务池、奖励倍率最终一致性 | E04/E10 |
| Combat | 完整武器可获得/可换装链、所有模型/枪口反馈、受击/死亡呈现、伤害飘字 | E07/E11 |
| Enemy Pressure | 多敌种、跨日内容变化与压力验证 | E08/E09 |
| Horde | 正式波次/阶段/完成奖励及独特目标 | 现有仅非白天压力 spawn |
| Economy | Scrap 正常消费入口、医疗/燃料/零件、营地生产与维修 | E02/E03 |
| Search/Loot | 随机建筑与旧武器奖励 ID、稀有物品获取体系 | E06/mission.reward_for_site |
| Procedural Map | 随机车辆与布局协调、目标/出生/撤离字段真正消费、世界事件/危险区 | E10 |
| Survivor Growth | 普通招募/救援、可达训练入口、个人技能/XP、长期伤势 | E02/E11/E12 |
| Run / Meta | 结束页面闭环、跨局解锁/货币/成长获取 | E01/E02 |
| Boss / Final Goal | 终局任务、Boss 与最终目标机制 | 当前只有第五日日结算判胜 |
| Validation | 当前 HUD/随机图适配测试、最新完整 build 门禁、正常入口端到端验收 | 第 16 节 |

## 表 D：Implemented But Not Actually Used

| 功能 / 实现 | 状态 | 为什么不算正常使用 | 实际还在哪里使用 |
|---|---|---|---|
| Campaign.train / main.train_member | UNUSED | 当前 Camp HUD 无训练按钮回调 | 单元/集成测试与直接 API |
| Campaign.buy / main.buy_weapon | UNUSED | 当前 HUD 无商店装配入口 | 商店数据生成、测试 |
| equip/unequip + ui/weapon_browser.gd | UNUSED | 浏览器没有被新根 HUD 装配 | 旧界面逻辑/测试；起始装备仍有效 |
| Effect grant/equip/expand/upgrade | UNUSED | 新 HUD 无管理入口，普通掉落/商店无获取链 | Debug、测试、存档数据消费 |
| 5 非起始 Passive + 3 非起始 Power | UNUSED | 有 Modifier 消费，但不能经正常新游戏获得 | Debug 授予/测试装槽/已有存档 |
| data/professions/*.tres | UNUSED | 未找到职业资源独立数值消费 | 内容资料；角色 profession 字段是展示元数据 |
| route_intuition / resource_efficiency 参数效果 | STUB | detection_bonus/bonus_chance 没有接入 Mission 的发现/奖励结算 | TraitData.at_level/summary 能缩放和显示参数，角色确实绑定资源；效果本身未执行 |
| lin/qiao/yan 的新开局可选身份 | UNUSED | starter_pool 只有两位新角色且没有招募 | Catalog、旧存档/测试/Debug；不是资源本身被删除 |
| garage/depot 固定建筑武器奖励 | UNUSED | 正式随机建筑用 slot_id，reward_for_site 精确按旧 ID 查询 | 固定地图 fixture；car_west 车辆不能一并判未用 |
| Generator 的独立 extraction 点 | UNUSED | 保存到 generated_extraction，但 command_extract 用 bus_position | 生成结果/诊断；正常返车仍有效 |
| maps/town / town debug Scenes | UNUSED | Main 仅通过 --town-* 特殊参数进入 | 环境作者工具/专项测试 |
| 固定图部分 district/frontage/props 配置 | UNUSED | 正式随机适配清空或替换这些字段 | 基础图构造/固定地图测试；east_quay 全资源并非未用 |
| Camp facility_selected 的经营处理 | STUB | ShelterView 发信号，Main 未接功能处理器 | 可拾取描述实体和场景演出 |

## Questions the current codebase can now answer

下表每项给出代码、Scene/Resource 与 Runtime 消费证据；不能由证据确定的部分明确保留待验收。

| # | 问题与答案 | 代码 | Scene / Resource | Runtime 证据 |
|---|---|---|---|---|
| 1 | 有没有尸潮？**PARTIAL：有非白天群体压力，无完整波次尸潮模式。** | encounter/encounter_director.gd | data/expedition_encounter.tres | Mission.advance 调 Director；phase!=DAY 按批生成、horde 标记并 investigate 队伍/噪音/巴士附近 |
| 2 | 蓝时做什么？**真实改变感知、速度、伤害/HP、spawn；之后 Night 持续加压。** | time/mission_clock.gd; enemies/enemy.gd | data/maps/east_quay.tres; encounter config | Clock 被 Mission 推进，敌人 refresh_stats 和 Director 实际消费，非纯视觉 |
| 3 | 地图是否随机？**是，正常出勤默认启用模板内程序生成。** | core/main.gd::_mission_config; missions/mission.gd::_apply_generated_map | district_layout.gd 模板、world_asset_catalog 资源 | use_random_map=true，生成结果替换 map.buildings/roads；旧车辆等仍混合 |
| 4 | 几种真正不同 Mission？**3 参数类型、3 固定选项；1 套完整目标机制。** | random_map_generator.gd; core/main.gd | today_actions/residential、commercial、airdrop.tres | food_supply/rescue 改 POI，完成仍搜索/手动撤离；无救人目标 |
| 5 | 几种 Runtime 资源？**2 种持久货币 Food/Scrap。** | core/run_ledger.gd; core/campaign.gd | loot profiles; data/day_loop.tres | collect_resources→结果→Campaign；武器实例和弹匣不是另外两种货币，Intel 仅 UI |
| 6 | Food/Scrap 用途？**Food 日粮真消费；训练接口存在但无新 HUD 入口。Scrap 购买接口存在，但普通消费口断开。** | Campaign.commit_day/train/buy | day_loop.tres; new_run.tres; camp_hud_root.tscn | Result 确认调用 commit_day；当前 show_shelter 仅接 depart/menu |
| 7 | 几种正式感染者？**1 种。** | data/catalog.gd; encounter/encounter_director.gd | enm_001_infected_basic_a.tres | Director 固定 ENEMY_ID，Catalog enemies 仅一项 |
| 8 | 几把武器接战斗？**8 定义由统一控制器支持；正常开局确定可用 2 把，不能宣称 8 把完整可获得。** | weapon_registry.gd; weapon_combat_controller.gd | data/weapons/ 8 tres; new_run.tres | 起始 P9/短刀进 Survivor；其余有实例/测试支持但换装入口与随机奖励受限 |
| 9 | 多少 Passive/Skill 真生效？**8+6 有消费实现；普通开局可选覆盖 3+3，每局 1+1；个人技能 0。** | effect_modifiers.gd; special_power.gd; Campaign._copy_reward | data/effects/14 tres; specializations/3 tres | New Run 授予起始组合；Mission 装 Modifier，HUD 为已装备 Power 建按钮；其他依赖 Debug/旧存档，freeze 有失败待验 |
| 10 | 有幸存者死亡？**有。** | survivor.gd; mission.gd; Campaign.commit_day | survivor data; day_loop.tres | 受击 HP→dead→任务清理→lost_ids→日结算移除 |
| 11 | 有永久死亡？**有 Run 内永久死亡，无跨 Run 永久删除。** | Campaign.commit_day/new_run | new_run.tres 起始池 | members/equipment 移除并保存；新 Run 重建成员 |
| 12 | 有 Rescue Survivor？**没有。rescue 只是生成类型。** | random_map_generator.gd; Campaign 成员写入链 | today_actions/airdrop.tres; survivor resources | 未发现救援对象→交互→入队/带回的 Runtime 调用链 |
| 13 | 有完整每日资源消耗？**有基础口粮，不是完整多资源经营。** | Campaign.preview/commit_day | day_loop.tres food_per_member=1 | 日结算消费全部存活成员口粮；首缺粮减生命、连续缺粮可减员，无燃料/医疗每日消费 |
| 14 | 有完整 Roguelite Run？**PARTIAL：有五日 Run 状态/存档，无完整管理成长和结束 UI 闭环。** | Campaign.commit_day; main.show_shelter | day_loop.tres; camp_hud_root.tscn | 正常日返回 Camp；won/lost 后设 ended 却不创建页面。完整终局实机画面：UNKNOWN / NEEDS RUNTIME VERIFICATION |
| 15 | 实际失败条件？**出勤全灭使本次行动失败；营地剩余成员归零使 Run lost，含战死与持续缺粮。** | Mission._finish; Campaign.preview/commit_day | day_loop.tres; ui/settlement_screen.gd | wiped 丢携带物资；members.empty 优先判 lost；不是时钟超时失败 |
| 16 | 实际胜利目标？**第五日结算后仍有成员存活。不是搜完地图或打 Boss。** | Campaign.commit_day; main._refresh_screen | day_loop.tres end_day=5; settlement_screen.gd | day>=end_day 且 members 非空→won 保存；结束界面接线缺失 |

## 交付范围

本轮只交付这份审计，不修复上述问题，不改变开发优先级，不更新计划中的完成勾选。原因是用户要求先审阅实际状态；本报告中的代码事实与计划表述差异保留为审阅依据，不自动推进 Gameplay。
