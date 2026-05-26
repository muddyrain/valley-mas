# WorldBox Alignment Plan

本文件是重新规划 WorldSim 未来路线时的 WorldBox 机制地图。它不是复刻清单，
也不复制 WorldBox 的素材、图标、文本或专有表达；它只提炼可公开观察的玩法结构，
再映射到本项目的阶段计划。

调研时间：2026-05-26。

主要资料入口：

- [WorldBox Steam page](https://store.steampowered.com/app/1206560/WorldBox__God_Simulator/)
- [Super WorldBox official site](https://www.superworldbox.com/)
- [Super WorldBox changelog](https://www.superworldbox.com/changelog)
- [Official WorldBox Wiki: Powers](https://the-official-worldbox-wiki.fandom.com/wiki/Powers)
- [Official WorldBox Wiki: Cultures](https://the-official-worldbox-wiki.fandom.com/wiki/Cultures)
- [Official WorldBox Wiki: Religions](https://the-official-worldbox-wiki.fandom.com/wiki/Religions)
- [Official WorldBox Wiki: Languages](https://the-official-worldbox-wiki.fandom.com/wiki/Languages)
- [Official WorldBox Wiki: Clans](https://the-official-worldbox-wiki.fandom.com/wiki/Clans)
- [Official WorldBox Wiki: Families](https://the-official-worldbox-wiki.fandom.com/wiki/Families)
- [Official WorldBox Wiki: Subspecies](https://the-official-worldbox-wiki.fandom.com/wiki/Subspecies)
- [Official WorldBox Wiki: Books](https://the-official-worldbox-wiki.fandom.com/wiki/Books)
- [Official WorldBox Wiki: Economy](https://the-official-worldbox-wiki.fandom.com/wiki/Economy)
- [Official WorldBox Wiki: Biomes](https://the-official-worldbox-wiki.fandom.com/wiki/Biomes)
- [Official WorldBox Wiki: World Laws](https://the-official-worldbox-wiki.fandom.com/wiki/World_Laws)
- [Community Wiki: Diplomacy](https://worldbox-sandbox-god-simulator.fandom.com/wiki/Diplomacy)

版本提醒：Wiki 和社区资料可能落后或混入旧版本描述。进入具体实现前，必须重新核对
目标机制的当前页面、官方更新说明和本项目代码。

## Alignment Principles

1. **玩家是神，不是市长或 RTS 指挥官**  
   玩家改变条件、施加灾害、放置生命、观察结果；文明自己求生、扩张、结盟、叛乱和战争。

2. **先让世界自转，再加更多按钮**  
   如果一个功能只增加工具栏，而不增加世界自治因果，它先进入 backlog。

3. **优先做可读因果链，不追求数值全量仿真**  
   WorldBox 的体验核心是“我看懂为什么发生”。Web 版可以用聚合、降频、观察报告和投影层来保留宏观体验。

4. **身份层要服务历史感**  
   家族、文化、宗教、语言、氏族、书籍、统治者不是装饰名词；它们要让村庄、王国和冲突有记忆。

5. **每个新增系统都要能被神力干预**  
   食物、地形、疾病、灾害、祝福、战争、忠诚、信仰、文化都应该能被玩家间接影响。

## WorldBox Gameplay Map

### 1. God Powers and Tools

WorldBox 的 power 体系覆盖世界塑形、生命生成、资源/文明干预、自然灾害、破坏性力量、
怪物/生物、调试/观察工具。Steam 页面也把 god powers、破坏、文明观察、王国殖民、
航船、战争、叛乱作为核心卖点。

WorldSim 当前状态：

- 已有 spawn、place resource、change terrain、lightning、pause、speed、force war、force peace。
- 已有正式底部神力工具栏，按观察、创造、塑形、破坏分组，并支持按钮、快捷键、当前目标、基础笔刷范围、越界目标反馈、关注/追踪观察工具，以及带来源和分类的事件后果时间线。

缺口：

- 缺 blessing/curse、disease/fire/weather、creature spawn、world law toggles、favorite/follow/inspect 类观察工具。
- 缺冷却/范围状态、更完整的目标类型限制、关注列表、对象历史工具，以及“神力影响世界条件，而非直接 RTS 操控”的完整 UI 语言。

本项目取舍：

- 先补正式 god-power toolbar 和观察工具，再补更多灾害/怪物。
- 所有神力必须走 `SimCommand`，并产生 `SimEvent` 或可检查状态。

验收点：

- 玩家能选神力、看到目标是否合法、看到失败原因、看到事件后果。
- 神力改变条件后，村庄/王国/自然系统自己响应。

### 2. World, Biomes, Ages, and World Laws

WorldBox 有不同 biomes、自然环境、world laws、ages/时代氛围，以及灾害/自然变化。
这些系统让地图本身成为文明命运的变量，而不只是背景。

WorldSim 当前状态：

- 已有 tile、terrain、biome、chunk、resource deposit、seeded map、256x256 demo、viewport culling。
- terrain/biome 主要服务可视和资源，缺少气候、世界规则、长期自然状态。

缺口：

- 缺 world laws 面板。
- 缺 age/weather/temperature/fire/disease 等长期环境压力。
- 缺不同 biome 对种族、资源、建筑和战争的持续影响。

本项目取舍：

- 不先做复杂气候仿真；先做少量会影响文明的世界规则和 biome pressure。
- 环境系统必须能进入检查面板和事件故事，否则玩家看不懂。

验收点：

- 同一种族在森林、山地、荒地、寒冷区域有不同生存/扩张压力。
- world law 开关能改变仿真行为，并被事件/检查面板解释。

### 3. Life, Traits, Families, Subspecies, and Genealogy

WorldBox 近年扩展明显加强了身份层：个体可以有 traits，单位之间有家庭/谱系，
群体可以形成 subspecies，玩家可通过检查面板理解一个单位或族群的来历。

WorldSim 当前状态：

- 单位已有 age、health、hunger、gender、race、position、intent、home village。
- 没有 traits、family、genealogy、subspecies、长期个人历史。

缺口：

- 个体还缺“值得观察”的身份。
- 人口增长只是数量变化，缺少血缘、继承、变异和群体分化。

本项目取舍：

- 先做轻量 identity layer：名字、traits、parents、birth village、notable events。
- 再做 family/genealogy projection，最后才做 subspecies 或遗传调参。

验收点：

- 选择一个单位能看到它属于哪个村庄/家庭、为什么重要、经历过什么。
- 家庭/谱系不会拖垮 10000 聚合人口目标；远处人口可聚合，近处个体可抽样呈现。

### 4. Civilization Growth, Economy, Roads, Boats, and Trade

WorldBox 文明会形成村庄、扩张、建造、发展经济和运输，后期有道路、船只、殖民和战争。
其体验重点不是玩家手动规划城市，而是文明自己把资源、空间和安全压力转成建设行为。

WorldSim 当前状态：

- 已有 camp -> hamlet -> village -> town -> frontier 的 foundation spine。
- 已有 food/wood/stone/iron、house/storage/farm/mine/barrack/dock、jobs、material costs、satellite founding。
- 没有道路、市场、贸易、船、跨海殖民、资源专业化。

缺口：

- 村庄之间联系弱；同国聚落没有道路/贸易/连通感。
- dock 只是 hook，还没有船和跨水扩张。
- 经济仍是村庄内部库存，没有 region/kingdom 级供应网络。

本项目取舍：

- 先做“连接可读性”：同王国聚落的道路/软连接/贸易意图。
- 再做 market/route/boat foundation；避免一开始做复杂库存搬运。

验收点：

- 玩家能看到两个村庄为什么属于同一王国，以及它们如何交换资源或支援战争。
- dock 能从“未来 hook”变成可观察的航运/殖民入口。

### 5. Kingdoms, Clans, Rulers, Diplomacy, Alliances, and Rebellion

WorldBox 文明不只打仗，也有王国、统治者、氏族、外交、联盟、战争和叛乱。
WorldBox 式政治层的价值在于：大国会因为扩张、边境、内部稳定或外部关系变得不安定。

WorldSim 当前状态：

- 已有 kingdom、capital、member villages、diplomacy pressure、war declaration、army groups、capture。
- 已有 loyalty、low loyalty、rebellion preparation、split founding、parent-vs-rebel war。

缺口：

- 缺 alliances、treaties、peace memory、claims、ruler/clan identity。
- 叛乱后内战故事和战后政治记忆还浅。
- 支持者选择、parent/rebel 实力、长期稳定性需要观察 harness。

本项目取舍：

- 先完成 PR-12G.4/G.5，让现有叛乱和内战可读、可调。
- 再引入 rulers/clans 作为王国稳定和继承的原因，而不是只做名字装饰。
- 联盟和条约晚于内战收口，因为它们依赖更清楚的关系记忆。

验收点：

- 玩家能从检查面板和事件链读懂“这个村为什么叛乱”“谁支持它”“战争为什么继续或结束”。
- 统治者/氏族进入系统后，能影响忠诚、继承、结盟或内战，而不是只显示头像。

### 6. Culture, Languages, Religions, and Books

WorldBox 的 cultures、languages、religions、books 让文明有长期身份、知识传播和精神归属。
这些系统能解释为什么相邻王国不只是颜色不同，而是有不同传统、信仰和历史文本。

WorldSim 当前状态：

- 只有 race 和村庄/王国名字，没有文化、语言、宗教、书籍或知识传播。

缺口：

- 王国之间缺少软身份差异。
- 战争和叛乱主要由距离/资源/压力驱动，还没有文化/宗教/语言带来的长期关系。

本项目取舍：

- 先做 culture foundation：文化 id、发源村、传播范围、少量 unlock/偏好。
- language/religion/books 分阶段进入，不要一次铺满。
- 书籍先作为历史记录/知识载体，不做复杂文本生成。

验收点：

- 村庄检查能显示文化归属和传播来源。
- 文化或宗教差异能轻微影响忠诚、外交或扩张倾向。
- 重要事件能成为“书籍/史册”条目，让世界有记忆。

### 7. Disasters, Monsters, Plagues, and Chaos

WorldBox 有大量非文明压力：灾害、怪物、疾病、破坏性神力。它们让玩家制造条件，
也让文明的恢复、迁徙、灭亡和废墟变得有故事。

WorldSim 当前状态：

- 有 lightning、terrain change、lava/water 等基础破坏入口。
- 有 ruin foundation，但缺灾害生态和恢复循环。

缺口：

- 没有 fire、plague、earthquake、meteor、monster invasion 等压力。
- 废墟不能被重新利用或形成历史标签。

本项目取舍：

- 在文明可读性收口后，先做 2-3 个会影响现有系统的灾害：fire、plague、meteor/quake。
- 怪物晚于灾害，避免还没有生态/战斗表达时只变成随机伤害源。

验收点：

- 灾害造成迁徙、死亡、废墟、忠诚变化、经济断裂或战争机会。
- 文明恢复链路可读：修复、重建、迁村、废墟保留或被占用。

## Gap Matrix

| WorldBox Layer | WorldSim Now | Gap | Priority |
|---|---|---|---|
| God powers | 基础命令和强制战争/和平 | 正式工具栏、目标反馈、祝福/诅咒、世界法则 | P0/P1 |
| World laws / ages / biomes | terrain/biome/resource foundation | 长期环境规则、时代/气候压力、biome effects | P2 |
| Unit identity | needs + race + home village | traits、family、genealogy、notable history | P1 |
| Village economy | materials + jobs + buildings | roads、trade、markets、kingdom supply | P1/P2 |
| Boats / colonization | dock hook | ships、water routes、overseas expansion | P2 |
| Kingdom politics | diplomacy pressure + loyalty/rebellion | alliances、rulers、clans、peace memory | P0/P1 |
| Culture/language/religion/books | none | identity propagation and history memory | P2 |
| Disasters/monsters | lightning/terrain only | fire、plague、meteor/quake、monster ecology | P2/P3 |
| History UI | inspection + recent events | timeline, event search, books/chronicle | P1/P2 |
| Save/replay | deterministic seed/tests | formal save/load/replay file | P2 |

## Future Roadmap Arc

### PR-12G: Finish Existing Rebellion Spine

Status: `Foundation complete`.

Why now:

- Loyalty, rebellion preparation and split founding already exist. If we add new layers before this is readable,
  every later political feature will pile onto shaky context.

Exit criteria:

- `observe:rebellion` reports loyalty drop, warning, preparation, split, parent/rebel war start and first campaign.
- Inspection and event story explain rebel-vs-parent conflict from village, kingdom and army perspectives.

Progress:

- Done: `PR-12G.4a` gives rebellion success and civil-war declaration events enough parent/rebel/source-village context for event summaries, inspection panels and selected-event filtering.
- Done: `PR-12G.5` adds `observe:rebellion`, a deterministic report for low loyalty, rebellion preparation, split founding, civil-war declaration, first army formation, supporter count and parent/rebel village counts.
- Done: `PR-12G.4b` makes rebel supporters prefer strong low-loyalty nearby villages instead of nearest-only followers, and extends `observe:rebellion` with parent/rebel population and soldier power snapshots for post-split tuning.
- Done: `PR-12G.4c` keeps active war endpoints and recent rebellion villages/capitals visible inside capped dense overview labels, so civil-war context survives crowded maps.

### PR-13: God UI and Observation Tools

Why now:

- WorldBox's breadth works because powers are discoverable and consequences are inspectable. WorldSim still feels debug-heavy.

Scope:

- Done foundation: formal god-power toolbelt for inspect, food, life, lightning, forest, grass and water, grouped into observation, creation, world-shaping and destruction lanes, with clickable buttons, active tool state and hovered tile target.
- Done foundation: selected powers now expose player-readable brush/range preview, effect copy and out-of-world rejection feedback before issuing the selected-tool command.
- Done foundation: favorite/follow observation tools can fix an object as event context or keep the camera centered on it without commanding it.
- Done foundation: event timeline lines now show source and category, and recent god-power results are prioritized before ordinary selected/focused context.
- Done foundation: terrain-aware target limits now reject food/life on water or lava, forest on non-land or existing forest, and same-terrain grass/water no-ops before commands are issued.
- Done foundation: diplomacy tools expose force-war and force-peace through the toolbar; clicked kingdoms, villages, or armies resolve to the current pressure target before issuing commands or showing rejection reasons.
- Done foundation: successful god-power clicks now use consequence-oriented bottom feedback, and diplomacy command-accepted summaries distinguish war and peace.
- Done foundation: the latest god command's accepted event and result events are grouped into one consequence chain in the event timeline.
- Cooldown feedback, favorite list, object history and deeper event consequence feedback.
- Fuller favorite list and object history quality-of-life tools.
- Deeper event filters and object history.

Non-goals:

- No large new disaster pack yet.
- No direct unit movement or manual building.

### PR-14: Civilian Identity and History

Why now:

- Before culture/religion/clans, units and villages need stable identity hooks.

Scope:

- Unit names, simple traits, parents/children links, birth village, notable events.
- Village chronicle entries for founding, disasters, capture, rebellion and ruin.
- Projection-safe genealogy summaries, not full always-visible family trees.

Non-goals:

- No deep genetics or subspecies simulation in the first identity pass.

### PR-15: Roads, Realm Connection, and Trade Foundation

Why now:

- Same-kingdom villages currently share color more than they share infrastructure.

Scope:

- Same-kingdom settlement connection.
- Road/route projection between nearby member villages.
- Lightweight trade intent and kingdom supply summaries.
- Dock-to-boat foundation only after land routes are readable.

Non-goals:

- No exact per-citizen hauling economy.

### PR-16: Rulers, Clans, Alliances, and Peace Memory

Why now:

- Political systems need named actors and relationship memory after rebellion is readable.

Scope:

- Ruler identity, clan/faction tags, succession hooks.
- Alliances, truces, peace memory, claims and war reasons.
- Loyalty modifiers from ruler/clan/capture history.

Non-goals:

- No full diplomacy menu; diplomacy remains autonomous and pressure-based.

### PR-17: Culture, Language, Religion, and Books Foundation

Why now:

- Once kingdoms have political memory, soft identity can explain long-term differences.

Scope:

- Culture origin and spread.
- Language/religion foundation as optional identity layers.
- Books/chronicles as event memory and knowledge flavor.
- Small gameplay effects only where readable: loyalty, diplomacy, expansion or building preferences.

Non-goals:

- No procedural scripture/text generator beyond short stable labels.

### PR-18: World Laws, Ages, Biome Pressure, and Disasters

Why now:

- After civilization identity is readable, environment pressure can reshape worlds without feeling random.

Scope:

- World law toggles for hunger, aging, diplomacy, rebellion, disasters.
- Biome pressure effects by race and settlement.
- Fire/plague/meteor or quake as first disaster set.
- Recovery and ruin lifecycle integration.

Non-goals:

- No full weather/fluid/fire cellular simulation unless performance evidence supports it.

### PR-19: Monsters, Creature Ecology, and Advanced Chaos

Why now:

- Monsters need civilization, army and disaster readability to avoid becoming noise.

Scope:

- A small creature set with clear ecological or military consequences.
- Creature spawn powers and containment/response events.
- Kingdom/army reaction to major threats.

Non-goals:

- No massive bestiary before the first few creatures produce good stories.

### PR-20: Scale, Save/Replay, and Scenario Tools

Why now:

- Larger worlds and long histories need durable tooling after the system shape stabilizes.

Scope:

- Formal save/load/replay format.
- Scenario seed presets and observability reports.
- Worker simulation only if `measure:scale` says main-thread simulation blocks the next target.
- TypedArray hot paths only for measured hotspots.

Non-goals:

- No premature engine rewrite.

## Immediate Recommendation

Do not jump straight to culture, religion, monsters, boats or trade. The next three moves should be:

1. Finish `PR-12G.4/G.5` so rebellion and civil war become readable and measurable.
2. Build `PR-13` god UI and observation tools so future systems are playable instead of hidden in debug HUDs.
3. Add `PR-14` identity/history foundation so later culture, religion, clans, books and politics have something to attach to.
