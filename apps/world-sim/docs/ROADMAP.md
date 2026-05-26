# WorldSim v2 Roadmap

本文件只回答三个问题：

1. 当前做到了哪里。
2. 下一步先做什么。
3. 哪些能力明确延后。

历史实现细节不要继续堆在这里。计划文档写法、状态口径和归档规则见
[`PLANNING.md`](./PLANNING.md)。WorldBox 机制调研和未来路线分期见
[`WORLDBOX_ALIGNMENT_PLAN.md`](./WORLDBOX_ALIGNMENT_PLAN.md)。

## Current Position

WorldSim v2 仍处于 `Foundation prototype`。它已经具备 WorldBox 式上帝沙盒的
核心骨架，但还不是完整可玩 MVP。

当前执行位置：

- **主线阶段**：`PR-12+ WorldBox Flavor`
- **当前焦点**：`PR-13 God UI and Observation Tools`
- **已落地到代码的最新切片**：`PR-13.4c-2`
- **下一项建议**：`PR-13.5 Favorite list and object history`

一句话状态：村庄、建筑、资源、王国、外交、战争、成长阶段、拓荒准备、忠诚、
叛乱准备、分裂建国和内战可读性都已经有 foundation slice；神力工具栏、基础笔刷反馈、
关注、追踪、事件来源、神力后果时间线、基础目标类型限制、外交工具 UX、底部后果反馈和最近神力事件聚合也已接入。接下来要继续补关注列表和对象历史质量。

## Status Ledger

| Phase | Status | Current Meaning |
|---|---|---|
| PR-0: In-place reset | Done | 旧 M1 原型已替换为 v2 入口和文档。 |
| PR-1: Pure simulation core | Foundation slice | `SimWorld`、`SimLoop`、seed RNG、命令队列、事件日志、命令拒绝已接入；正式 replay/save 格式仍缺。 |
| PR-2: Map, chunks, resources | Foundation slice | tile、chunk、biome、resource deposit、seeded map 已接入；资源独立索引仍延后。 |
| PR-3: Life survival loop | Foundation slice | hunger、hp、age、eat、wander、death、birth 已接入；单位 AI 仍是最小 needs loop。 |
| PR-4: Phaser projection | Foundation slice | Phaser 只读 projection，输入只发 command，viewport culling、相机移动、缩放和分层渲染已接入。 |
| PR-5: God command foundation | Foundation slice | spawn、resource、terrain、lightning、pause、speed、force war/peace 已接入；PR-13 已补正式神力工具栏、基础目标/范围反馈、地形目标限制、外交工具入口、底部后果反馈和最近神力事件聚合，关注列表、对象历史和更多神力仍缺。 |
| PR-6: Villages | Done | 人口聚集会形成村庄，村庄有库存、住房、食物压力、衰退和 abandonment。 |
| PR-7: Buildings and territory | Done | town hall、house、storage、farm、mine、barrack、dock 等基础建筑链影响住房、仓储、生产、军队和领土。 |
| PR-8: Kingdoms | Done | 稳定村庄会建国，同族村庄可加入王国，王国聚合首都、成员、人口、建筑、领土和库存。 |
| PR-9: Diplomacy pressure | Done | 边境摩擦、资源压力和种族倾向会积累外交压力并触发宣战事件。 |
| PR-10: Minimal war | Done | 战争通过聚合军队推进、战斗、伤亡、撤退、攻占和村庄转属。 |
| PR-11: Scale gate | Done | 10000 聚合人口 / 500+ 可见单位的基础性能门槛已签收；更大规模再由指标驱动 worker/hot-data。 |
| PR-12A: Inspection and event story | Done | 点击选择、右侧检查、上下文事件、选中高亮、王国切换和地图标签已接入。 |
| PR-12B: Building chain expansion | Done | town hall anchor、house tier、mine、barrack、dock 等文明建筑链已接入。 |
| PR-12C: Jobs and material economy | Done | food/wood/stone/iron、farmer/builder/miner/soldier/laborer 和材料建造成本已接入。 |
| PR-12D: City growth feedback | Done | 村庄命名、等级、首都标记、成长事件、自动分村、废弃建筑和废墟 foundation 已接入。 |
| PR-12D.5: Growth readability foundation | Done | 工作点、成长阻塞、住房压力、木材可达性、领土自然扩张可读性已增强。 |
| PR-12E: Kingdom and war readability | Foundation slice | 王国态势、冲突态势、军队路线、多 tick 战斗、多村出兵、强制战争/和平已接入；战后和长期战役可读性仍浅。 |
| PR-12F: Civilization spine rework | Foundation slice | growth phase、primary intention、primary blocker、早期粮食节奏、拓荒准备和观察报告已接入；仍需手玩调参收口。 |
| PR-12G: Loyalty and rebellion | Foundation complete | 忠诚、低忠诚预警、叛乱准备、分裂建国、parent-vs-rebel war、内战事件故事、支持者强度评分、密集冲突标签优先级和 `observe:rebellion` foundation 已接入；rulers/clans/peace memory 等深政治层延后到 PR-16。 |

## Completed Focus: PR-12G.4

目标：让叛乱后的 parent-vs-rebel war 从“系统状态变化”变成玩家能看懂的内战故事。

WorldBox 对齐：

- 玩家应该先看到不稳、叛乱准备和分裂，再看到新旧王国进入冲突。
- 内战不是菜单操作；它是过度扩张、首都距离、粮食压力、战争压力和强边疆村镇的后果。
- 玩家能通过神力改变条件，但不能直接命令村庄独立、调兵或操控单位。

验收点：

- 选择 rebel 村庄、parent 首都、rebel 王国或 parent 王国时，检查面板能解释这场内战从哪里来。
- `rebellion_succeeded`、`war_declared`、后续 army/capture 事件在事件故事里能串起来。
- 地图标签和路线在多村、多军队、多叛乱场景下仍优先显示关键上下文。
- 平衡上避免同一大王国一瞬间碎成不可读的一屏混战。

建议切片：

1. Done: `PR-12G.4a` Civil-war event story：`rebellion_succeeded` / rebellion `war_declared` 事件现在带 parent/rebel capital、起义村庄和原因；事件摘要、村庄/王国/军队 inspection、选中事件过滤都能解释 parent-vs-rebel 内战来源。
2. Done: `PR-12G.4b` Supporter and post-split tuning foundation：支持者选择从单纯最近距离改为低忠诚、人口/士兵实力和距离的确定性评分；`observe:rebellion` 追加 parent/rebel 人口与士兵 power 快照，作为后续战争节奏和压力记忆调参基线。
3. Done: `PR-12G.4c` Dense conflict readability：密集 overview 标签会固定保留活跃战争起点/目标，以及近期叛乱事件涉及的起义村和双方首都，避免关键内战上下文被普通不稳/叛乱标签挤掉。
4. Done: `PR-12G.5` `observe:rebellion`：确定性观察报告会输出忠诚下降、预警、准备、分裂、内战开局和首轮军队形成时序。

## Active Work: PR-13

目标：把现有 debug 神力命令整理成 WorldBox 式可发现工具栏，让玩家能选择神力、看懂目标是否合法，并在事件/检查面板里读到后果。

WorldBox 对齐：

- 玩家通过神力改变条件，而不是直接操控村庄建造、单位移动或军队行动。
- 每个神力都应该有清楚的目标、失败反馈和可观察后果。
- 观察工具和事件过滤要帮助玩家理解自治世界，而不是只显示内部字段。

建议切片：

1. Done: `PR-13.1` God power toolbar foundation：正式工具栏模型和 Phaser 可点击底部工具盘已接入；工具按观察、创造、塑形、破坏分组，按钮有选中态、快捷键、当前目标和已有食物/生命/闪电/地形命令入口；外交强制开战/和平仍保留在选中王国快捷命令。
2. Done: `PR-13.2` Command legality feedback：神力预览 helper、底部状态文案和 Phaser 笔刷范围圈已接入；食物、生命、闪电、森林、草地、水域和检查会显示范围/效果，越界目标会显示“目标在世界外”，左键不会静默发出无效命令。
3. Done: `PR-13.3a` Favorite/follow foundation：观察分组新增关注和追踪工具；玩家可以固定一个可追踪对象作为事件上下文，或让镜头跟随单位、军队、村庄、建筑、王国等对象；地图会画出关注/追踪标记。
4. Done: `PR-13.3b` Event timeline filters：右侧事件面板现在显示事件来源，事件行带神力/建设/战争/叛乱/成长等分类；最近神力命令的接受和结果事件会优先显示，再回落到当前选择、追踪对象、关注对象或世界事件。
5. Done: `PR-13.4a` Terrain-aware target limits：食物和生命会拒绝水域/岩浆，森林需要陆地且拒绝重复刷森林，草地/水域重复刷同地形会给出可读拒绝原因；预览和点击发命令共用同一套规则。
6. Done: `PR-13.4b` Diplomacy tool UX：工具栏新增外交分组和开战/和平工具；点击王国、村庄或军队会解析源王国和当前压力目标，合法时发出 `force_war` / `force_peace`，否则显示可读拒绝原因；旧 `H/J` 快捷键保留。
7. Done: `PR-13.4c-1` Bottom consequence feedback：成功执行食物、生命、闪电、地形、开战和和平时，底部反馈改为解释后果；外交 command accepted 事件摘要会区分开战与和平。
8. Done: `PR-13.4c-2` Event consequence grouping：右侧事件面板会把最近一次神力的命令接受事件和结果事件按 `sourceCommandId` 合并成“神力后果”组，避免散成流水账。
9. Next: `PR-13.5` Favorite list and object history：把单一关注对象扩展为更清楚的关注列表和对象历史入口。

## Near-Term Queue

| Priority | Item | Why Now | Exit Criteria |
|---|---|---|---|
| P0 | PR-13 god UI and observation tools | WorldBox 的广度依赖可发现的神力和可检查的后果；当前输入仍偏 debug。 | 神力选择、合法目标预览、拒绝原因、事件反馈和观察工具进入正式 UI。 |
| P1 | PR-14 civilian identity and history | 后续 culture/religion/clans/books 都需要先有单位、家庭、村庄和事件记忆。 | 单位/村庄检查能展示名字、traits、家庭/来源和关键经历，且不破坏规模目标。 |
| P2 | PR-15 roads, realm connection, and trade foundation | 同国村庄现在主要靠颜色关联，缺少 WorldBox 式文明连通感。 | 同王国聚落能通过道路/路线/轻量贸易意图表达资源和政治连接。 |

## Deferred Backlog

这些功能先不要抢占 PR-12G/PR-12F 收口，除非用户明确改优先级：

- rulers, clans, alliances, treaties, claims, peace memory
- culture, language, religion, books, deep genealogy, subspecies
- markets, boats, colonization, cross-water warfare
- monsters, disasters, plague, fire/weather simulation, world ages
- hard borders, occupation memory, culture conversion, resistance, ruin reclamation
- save/load/replay file format
- Web Worker simulation, TypedArray hot paths, resource-specific spatial indexes
- larger-than-256 default demo maps

## Scale Rule

继续使用 plain TypeScript simulation + Phaser projection，直到指标证明需要升级。

性能升级顺序固定为：

1. chunk / spatial index / projection culling
2. 降频、聚合模拟、缓存和 redraw key
3. Web Worker simulation
4. TypedArray hot paths

不得因为“以后可能很大”提前引入复杂热路径。只有当 `measure:scale` 或具体场景证明
当前瓶颈挡住下一阶段目标时，才进入下一层优化。

## Planning Guardrails

新增或修改计划时必须遵守：

- `ROADMAP.md` 只保留当前状态、下一步、验收点和延后队列。
- 已完成细节最多写成一行状态，不再追加长段历史。
- 新功能必须有 `Why Now` 和 `Exit Criteria`，否则进入 backlog。
- 同时出现 3 个以上 `In progress` 说明计划失焦，必须拆分或收口。
- 已完成但仍有 follow-up 的阶段标 `Foundation slice`，不要强行写 `Done`。
- 机制说明写进 `MECHANICS.md`，产品原则写进 `VISION.md`，技术边界写进 `ARCHITECTURE.md`。
- 临时观察、调参过程和历史流水账不要写入路线图；只保留稳定结论。
