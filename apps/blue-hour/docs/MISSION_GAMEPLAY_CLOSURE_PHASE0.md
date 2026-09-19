# Mission Gameplay Closure Phase 0A — Data / Rule Layer Only

2026-09-19。本轮不是正式 Expedition 玩法闭环。正式入口仍为 MEDIUM_TOWN_V1，未恢复旧 RandomMap，也未修改地图、导航、POI 接入、Camp、动作或 UI。

## A. 已完成的 Mission Rule/Data Layer

复用 `TodayActionData` 作为三种行动的 Profile，不另建平行任务系统。三份 `.tres` 集中定义类型、共同目标、威胁、初始人口倍率意图、生成间隔与批量倍率、收益倾向、Food/Scrap 倍率、武器概率与池、POI 类别偏好。

数据链：`TodayActionData → make_map() 私有 mission_profile → Mission → resolve_site_loot / reward_for_site`；`encounter_rules(base, capacity) → 私有 EncounterConfig → EncounterDirector.setup()`。Mission 保留 Profile，不依赖后续地图 ID 判断行动。

### 原断链与处理

1. 旧 Food/Scrap 倍率修改旧地图地点的表，后续替换地点会丢失。本轮基础表保持不变，在 Mission 最终 roll 后统一乘倍率、取整一次；无表的旧数量路径使用同一接口。角色既有拾取增益继续在后续 Ledger 层处理。
2. 初始威胁原先仅对上界插值；新规则对基础 min/max 与 daytime minimum 乘初始压力倍率，再用调用方提供的容量封顶，arrival 不超过初始下界。没有推断 Medium Town 容量、生成位置或启用刷怪。
3. 旧武器奖依赖 garage/depot/car_west；带 Profile 的 Mission 改按 `category / loot_tags / loot_profile` 判断，不以地点 ID 判定资格。
4. Action 类型原来在 Main 中临时映射。现在 Profile 显式记录且 Mission 优先读取；Main 和地图生成配置映射未改，后续统一 provider 消费属于 0B。

### 三种 Profile 的 fixture 对比

以下是实际调用 EncounterDirector.setup、Mission.resolve_site_loot 和 Mission.reward_for_site 的独立 fixture 结果，**不是已生成的敌人数或正式地图收益**。seed=4101，Encounter 容量上限40；同一基础 Loot 为 Food10/Scrap10；1000 个语义相同的 industrial 地点。

| 项目 | 住宅区 | 商业街 | 空投区域 |
| --- | ---: | ---: | ---: |
| 保留的 generation mission_type | supply_search | food_supply | rescue |
| objective | SEARCH_AND_RETURN | SEARCH_AND_RETURN | SEARCH_AND_RETURN |
| threat_profile | low | medium | high |
| initial pressure intent | 0.50 | 0.75 | 1.00 |
| 初始数量抽样均值（1000次） | 11.966 | 18.443 | 23.905 |
| Spawn interval modifier | 1.35 | 1.00 | 0.70 |
| Director 白昼间隔（秒） | 47.25 | 35.00 | 24.50 |
| Director 白昼 batch | 2 | 3 | 4 |
| Food modifier | 1.50 | 0.80 | 0.45 |
| Scrap modifier | 0.70 | 1.50 | 1.00 |
| 最终 fixture Food / Scrap | 15 / 7 | 8 / 15 | 5 / 10 |
| 合资格地点武器概率 | 5% | 15% | 35% |
| 1000地点实际命中 | 51 | 134 | 351 |
| reward_tendency | food | scrap | weapon |
| POI preference（数据，未执行布局偏置） | residential | commercial / industrial | industrial / special |

`rescue` 保留为现有生成类型兼容值，不表示救援目标；三者目标相同。没有把 threat 或 POI 偏好伪装成正式地图已生效。

### Weapon Reward

- 资格：industrial / vehicles 类别，或 tools 标签，或 materials_tools / vehicle_parts_tools 既有 Loot Profile；字段位于 Action，可独立调参。
- 优先读取已有 asset 定义的 category / loot_tags；fixture 或无 asset 地点读取自身字段。
- seed、day、action、site ID 派生独立 RNG；地点 ID 仅用于身份和稳定抽样，不决定资格。同日同任务重试结果一致，不受搜寻顺序影响。
- UID 为 day/action/site；已入 Inventory 的同 UID 不再次颁发。SearchTask 的完成锁继续负责同场任务不重复完成。
- 使用已有 P9、K9、Survival Knife，普通品质；“高价值”本轮仅体现装备获得机会更高，没有新增稀有度体系或伪造特殊物品。
- 无 Profile 的历史兼容路径仍读取旧 day_rewards / weapon_sites，避免修改 Campaign 存档及 Camp。新三种 Action 的 Profile 路径不读取旧固定地点奖励表。

### 文件

- `data/today_action_data.gd`
- `data/today_actions/residential.tres`、`commercial.tres`、`airdrop.tres`
- `data/map_data.gd`：可序列化的私有 mission_profile 字段。
- `missions/mission.gd`：保留 Profile、Loot 最终修饰、语义武器奖励；没有改 provider 分支或 `_apply_generated_map()`。
- `tests/mission_profiles.gd`（及 Godot UID）：独立数据/消费接口 fixture。
- `tests/search_gameplay.gd`：原断言期待提前修改表，改为检查基础表不变、最终倍率正确；其余搜索行为验收保持。
- 本报告、`docs/PLAN.md`。

### 验证

- Profile fixture：4117 checks，0 failures。含私有资源隔离、容量上限、原表不变、Loot 两条路径一致、实际装备合法、固定 ID 不赋予资格、重试稳定、已拥有 UID 不重复奖励。
- Encounter Clock：7 checks，0 failures。
- Encounter Director：30 checks，0 failures。
- 证据：`test-output/mission-profiles/report.json`；不属于正式地图闭环证据。
- Windows `run.ps1 -Mode build` 已实际执行。最终回归：Search Gameplay 72、HUD Phase2 258、Survivor Command 45、Search Active Card 157、Settings 14 均零失败。搜索专项最初有一项旧“提前改表”断言失败，已按最终结算契约更新并复跑通过。
- 全量构建随后被既有 `tests/camp_ui_runtime.gd:114` 的 `member_buttons` 缺失与旧左侧能力 HUD 断言阻塞；没有修改 Camp 测试或绕过门禁，正式 `build/BlueHourHomeward.exe` 未更新，独立新版 EXE 未验收。日志：`test-output/mission-profiles/build.log`。
- 定向编码检查及 diff 空白检查通过。专项没有新增 Runtime Error / Missing Resource / Invalid Node；不能将此扩大为整个并行开发工作区无错误。

## B. Phase 0B — Medium Town Gameplay Integration TODO

以下均未证明，不应标记完成：

- 正式地图提供可搜索建筑/车辆、导航与敌人生成区域后，三种 Profile 真正在同地图 seed 下搜索、出奖、拾取、撤离、结算。
- 将 Medium Town 实际容量交给 `encounter_rules`，在最终地图应用完成后消费规则，验证初始实际生成量与生成间隔，而非仅 fixture 数值。
- 统一 provider 的 mission_type / Profile 传递，消费 POI preference；本轮不改变建筑类别采样、布局或位置。
- 验证 Medium Town 的地点 ID 生命周期、语义字段完整性、武器领取防重复与正式存档恢复。
- 正式入口压力低/中/高体感与平均收益平衡、Blue Hour/Night 联动、Search/Command 全流程。
- 旧 RandomMap `_apply_generated_map()` 覆盖人口参数的行为尚未修复，明确不以其作为本轮正式验收。

Rescue Survivor、独立任务完成条件、Special Mission、新敌种、完整 Horde Gameplay 均未实现；保留原有 Blue Hour 状态机和 Horde 增压机制。本轮完成后停止，不进入 Mission Diversity V1。
