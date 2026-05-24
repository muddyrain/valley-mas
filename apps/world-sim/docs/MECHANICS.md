# WorldSim v2 Mechanics

## World

The world is a tile grid split into chunks. The simulation map default remains 128 x 128 tiles for tests and tooling, while the interactive Phaser demo now creates a larger 256 x 256 world so terrain covers the whole browser viewport like a WorldBox-style sandbox at the default zoom. The demo generates a fresh world seed when the URL has no `seed` parameter, so reloading can produce different terrain, resource layouts, civilization starts, and autonomous building sites. Default initial life no longer spawns at the map center; it uses the world seed to pick a walkable, food-supported, non-edge start area, with a walkable fallback only for sparse edge cases. Terrain generation derives its wave phases from the full seed, not just seed length, so same-length demo seeds still produce visibly different maps. Supplying `?seed=some-name` keeps the same deterministic world for debugging, comparison, and balance review. Full projection remains available for tests and tooling, while the Phaser render path requests a padded camera viewport so visible tiles and entities can be culled through the chunk-indexed projection path. Camera navigation follows WorldBox-style PC controls: WASD or arrow keys move the camera, Q/+ zooms in, E/- zooms out, the mouse wheel zooms around the pointer, and Ctrl + wheel changes simulation speed. Mouse edge panning is intentionally disabled so pointer placement near UI or map borders does not move the camera unexpectedly. The camera is driven by world-center plus zoom rather than patched scroll offsets, so keyboard movement, resize, and zoom all share the same clamped view model. Pan speed is viewport-relative: keyboard movement crosses about one and a half visible screens per second, so perceived screen speed stays consistent across close zoom and wide overview. Keyboard acceleration is tuned for immediate response. Render-heavy map layers use a padded viewport and coarse viewport buckets, so zoomed-out panning keeps vector draw command counts bounded instead of rendering full-map graphics every frame. Zoom also controls render detail: overview zoom keeps terrain, territory, labels, and army context; regional zoom adds buildings; local zoom adds units, resource markers, and work-site details. The HUD also refreshes by state key with a short throttle, so camera-only panning does not rebuild overlay text and panel layout every frame. The default zoom uses a cover-style game view, while the minimum zoom uses a contain-style overview so the player can zoom out far enough to see the entire generated map but not beyond it. When the map is smaller than the viewport on one axis, the camera centers it and uses water-colored map background instead of exposed black camera background. Each tile has terrain, biome, and optional resource deposits. Early terrain types are grass, forest, hill, water, sand, snow, and lava. Early biomes are temperate, woodland, highland, coast, dryland, frozen, and volcanic.

## Units

Units are autonomous life forms. The first slice supports:

- age
- health
- hunger
- reproduction cooldown
- gender
- race
- position
- current intent

Units seek food when hungry, eat nearby food, wander when stable, age over time, die from old age or starvation, and reproduce when local conditions allow.

## God Commands

The first god commands are:

- `spawn_unit`
- `place_resource`
- `change_terrain`
- `lightning`
- `set_speed`
- `pause`
- `force_war`
- `force_peace`

Commands are not guaranteed to succeed. Rejections become events so UI and tests can observe why an action failed.

## Resources

Food is the first active resource. It exists as tile deposits and supports the life loop. PR-12C now exposes village and kingdom stores for food, wood, stone, and iron. Wood deposits sit on forest tiles and render as small map markers, and stone/iron deposits on hills also render as visible markers so material sources are readable. Builders gather nearby wood into village stores, active mines can gather nearby stone or iron deposits, and villages can open a small early stone quarry when no rare natural hill is close enough. Building construction now uses material costs instead of spending food. Residents can also draw food from their home village stores when nearby tile food runs out. Food is reserved for feeding people and for prosperity-style gates. Early camp villages also use a lighter food drain so the first 30-person settlement can bootstrap before the farm/build loop is online.

Resource gathering remains village-aggregate rather than visually per-person. Builder jobs prefer nearby wood deposits, but can now scout reachable wood out to a wider frontier radius when a new village has no local construction material. Forest/wood sources visibly deplete, and village inspection exposes growth blockers such as missing wood or no reachable wood source when construction stalls. It also exposes a single primary growth blocker so the player can understand the next missing condition without guessing from a list. Wood gathering work sites remain projection data for simulation-side territory pressure, but the Phaser map no longer renders a separate chopping pulse.

## Villages and Kingdoms

Villages now form after individual survival pressure is visible. A cluster of at least eight same-race units near enough food can found a camp. Founding units receive a stable `homeVillageId`; later same-race homeless units near the settlement can be adopted into that home village. The village stores gathered food and early materials, tracks home population, exposes housing capacity, consumes food on a fixed interval, and enters a declining state when inventory cannot satisfy residents.

The village `center` is an internal settlement anchor, not a visible building or capital marker. Population ownership is stable and does not depend on whether villagers are currently inside this anchor radius. The anchor supports village formation spacing, food search, and construction placement; player-facing village presence now comes from named village labels, level tags, buildings, territory, kingdom summaries, and inspection panels.

Villages also carry a race-themed name and a growth level:

- village names are generated when the settlement is founded
- the map label shows `村名 · Lv.x`, capital villages show `首都 · 村名 · Lv.x`, and villages actively preparing a satellite show a `拓荒 ·` prefix so the pending split is visible before the new village appears
- village level is derived from population, housing capacity, town hall tier, and building count, then clamped to a small readable range
- village projection now includes a growth phase: `camp` before the first stable building loop, `hamlet` while the basic house/storage/farm chain forms, `village` after that chain stabilizes, `town` when specialization or population-driven prosperity growth is active, and `frontier` once a mature settlement is ready to seed a satellite
- village projection now includes `primaryIntention`, mirroring the single current autonomous action the settlement is attempting, such as building housing, adding storage, or preparing expansion
- village inspection shows the village name, level, and whether it is the capital
- village inspection also shows growth phase, primary intention, a short growth label, and both level-up and phase-transition events now enter the recent event stream
- kingdom inspection shows the capital village by name and level when available

- villages form from population clusters and local food pressure
- village population is counted by `homeVillageId`, while `villageId` only marks the current nearby village presence
- village food inventory is gathered from nearby food deposits and can be shared back to nearby residents through the village store
- active mines gather nearby stone or iron deposits into village material stores
- housing capacity caps village-supported reproduction and now grows through visible houses or house upgrades, not invisible food-only expansion
- mature kingdom villages can found satellite villages when they have at least 18 residents, about 70% housing use, enough food and wood reserves, a basic building chain, and a separate food-rich walkable site 16-28 tiles away; after entering `prepare_expansion`, the parent must hold a readable 60 tick preparation window before settlers depart. Founding transfers 8 residents, spends 90 food and 20 wood, creates a new town hall, and keeps the new village inside the parent kingdom
- expansion inspection and `village_expansion_status` events only activate after the village reaches the minimum settler pool for frontier judgement; younger member villages keep ordinary `等待人口增长` wording without an `扩张原因` line, while mature frontier candidates can show `等待扩张压力`
- food shortage causes village decline before later systems add migration, abandonment pressure, or war; camp villages have a gentler early drain so they can survive the bootstrap phase
- villages are abandoned only when their home population reaches zero, not when residents temporarily walk away
- buildings change capacity or production
- territory follows settlement core, building, work-site, and frontier-preparation influence
- kingdoms group villages and prepare diplomacy

Kingdoms form from village strength instead of player commands. A village with enough home population and active buildings can found a rising kingdom. Nearby same-race villages can join that kingdom, and mature pressured member villages can now seed new satellite villages when suitable land and food exist nearby. A kingdom tracks capital village, member villages, total home population, active buildings, active territory, food inventory, stable display color, and status. The founding capital is stable: it does not move just because another member village has more population. A replacement capital is chosen only when the current capital is no longer a valid member, such as after abandonment, removal, or capture. Replacement priority is highest active town hall tier, then active building count, then population, then deterministic village id order. If all member villages disappear, the kingdom becomes fallen and remains as history data for later UI. Territory projection now keeps both `villageId` and optional `kingdomId`, so diplomacy, war, and rendering can reason about ownership by kingdom without changing the simulation/rendering boundary.

## Civilization Progression Spine

The world should be balanced around one readable progression spine. Each stage must be autonomous, visible, and inspectable before the next stage becomes the focus.

| Stage | Player reads on map | Simulation gate | Main pressure | Failure state |
|---|---|---|---|---|
| Life seed | scattered people moving, eating, and reproducing | living units on walkable terrain with food nearby | hunger and partner availability | starvation or low birth rate |
| Camp | named camp, town hall, first territory patch | 8 same-race homeless units near enough food | food reserve and stable home ownership | declining camp |
| Hamlet | first house/storage/farm construction sites | wood access, builders, first housing pressure | missing wood, low food, no builders | visible growth blockers |
| Village | houses, farm loop, growing territory outline | stable food, housing below cap, basic buildings | housing pressure and material supply | stalled build plan |
| Town | upgrades, mine, barrack, dock hook, level changes | surplus food/wood, town hall gates, enough residents | prosperity construction and specialization | overbuilt but low population |
| Frontier | work-site claims, larger soft territory, satellite founding | mature kingdom village with surplus and nearby food-rich land | land availability and settler cost | waiting land or resources |
| Kingdom | colored territory, capital, member villages, pressure target | eligible village strength and same-race join radius | border friction and resource deficit | war, capture, or kingdom fall |

Near-term changes should start at the Hamlet/Village boundary. That is where the current prototype most needs stronger WorldBox alignment: residents already have survival needs, and kingdoms already exist, but the middle step still depends on aggregate jobs that can feel abstract. The improvement path is:

1. Make build intent more explicit: every village now projects `primaryIntention` for whether it is trying to get housing, storage, farm capacity, materials, military, dock access, or a satellite site. The projection also includes both the full blocker list and a single primary blocker.
2. Make territory expansion staged: core settlement territory comes from population and town hall level; work territory comes from temporary work sites; frontier territory comes from repeated activity, resource scouting, or satellite planning. Territory remains soft until a later border-rule pass.
3. Make stalls actionable: each blocked growth plan should map to one primary blocker and one visible remedy, such as missing wood, no reachable wood source, low food reserve, no builders, no buildable land, or waiting for population pressure.
4. Make satellite founding feel like settlement expansion: before a new village appears, the mature parent exposes `prepare_expansion` when it is ready, `waiting_land` when no suitable food-rich site exists, and `waiting_resources` or `waiting_population_pressure` when it already has enough settlers but lacks food, wood, or housing pressure. Once a parent has committed to `prepare_expansion`, later house upgrades do not cancel that expedition unless population, resources, or the site itself fall below the frontier gate.
5. Keep the player as a god: no manual building placement, job assignment, or move orders. God powers can nudge conditions, but the settlement decides how to use them.

The first PR-12F observation harness is available through `pnpm --filter @valley/world-sim observe:growth`. It creates deterministic food-and-wood-supported camps and prints sampled rows for tick, growth phase, primary intention, primary blocker, population, housing, stores, building count, and land territory. It also prints a multi-seed diagnosis with first camp/hamlet/village ticks, final plan/blocker, missing house/storage/farm chain pieces, and recent phase/building events. The same command now includes a satellite-expansion timing report with first expansion status tick and plan, first `prepare_expansion` tick, first frontier map-label tick, first inspection reason/hint ticks, `expansionLead`, `labelLead`, and `hintLead` ticks, satellite-founded tick, parent population/housing/resource snapshots, and child population/housing after founding. `pnpm --filter @valley/world-sim observe:building-sites` prints a separate multi-seed building placement report with each autonomous building's type, position, distance to village center, nearest food, nearest stone or iron, nearest water, and nearest same-type building. These reports are evidence for later camp/hamlet/village, frontier, and purpose-scored building-site tuning. The first farm-leg tuning keeps the first house on the older visible construction timing, then lets the house/storage/farm bootstrap chain attempt follow-up buildings faster until the basic chain is complete. A settlement now enters `village` once that chain stabilizes instead of skipping straight from `hamlet` to `town` because of level alone. Expansion preparation is also surfaced before a satellite appears: mature villages emit a recent `village_expansion_status` event when their active expansion plan changes, village inspection translates that active expansion plan into an expansion reason and a short frontier hint, and the map label adds `拓荒 ·` while the village is actively in `prepare_expansion`. The satellite report locks that these readability signals appear before founding and keep the intended 60 tick preparation window. Young villages that merely need more population do not show expansion reasons yet, and their build/primary-intention text reads `等待人口增长` rather than expansion failure.

## Diplomacy Pressure

Diplomacy is currently pressure-based rather than menu-driven. Active kingdoms compare nearby rivals each tick and maintain pairwise pressure. Each kingdom exposes its highest current `diplomacyPressure` and `diplomacyTargetKingdomId` in projection data.

Pressure comes from:

- border friction when rival village centers are close enough to represent a contested frontier
- resource pressure when either rival has low food per resident
- race modifiers, with orcs escalating faster, elves slower, dwarves slightly faster, and same-race rivalry reduced

When pressure crosses report tiers, the simulation emits `border_friction`, `resource_pressure`, and `diplomacy_pressure` events with cause data. When pressure crosses the declaration threshold, the simulation emits `war_declared`. PR-10 turns declarations into army movement, battles, casualties, retreat, and capture. PR-12E starts the kingdom readability UI by translating these events into player-facing summaries and adding a compact kingdom/conflict panel to the HUD.

God diplomacy commands can now override the pressure curve without directly controlling units. `force_war` declares war between two active kingdoms and immediately attempts to raise eligible attacking army groups. `force_peace` disbands active armies between the two kingdoms, clears their pairwise war pressure, and applies a short truce window so the same border pressure does not instantly re-declare war on the next tick.

## Buildings and Territory

Villages spend material stores on simple functional buildings. PR-12B starts turning the older
hut/storage/farm foundation into a clearer settlement chain, and PR-12C shifts construction away from food costs:

- town hall is created when a village is founded and marks the visible settlement anchor
- town hall now acts as the upgrade gate for the rest of the chain
- house is the visible housing building; the first slice stores `tier: 1`, then can upgrade to tiers 2 and 3 for extra housing capacity, and its construction is wood-driven rather than food-driven
- when population reaches roughly 75% housing use after the first house/storage chain, villages prioritize another house before optional farm, mine, barrack, or dock work
- PR-12E.1 adds continuous town growth pressure so rich stable towns keep expanding houses, farms, or storage when food/wood are abundant, even if housing is not yet nearly full
- storage increases village food capacity and costs wood
- farm produces village food when the village has assigned farmer jobs, even after nearby deposits are exhausted, and costs wood; farm sites must be arable empty land or food-bearing land, never wood, stone, or iron resource tiles
- the initial house/storage/farm chain uses a faster follow-up build cadence after the first house appears, so early settlements reach a readable farm loop before later mining or military branches dominate
- mine can be built once after the village has a house, storage, and at least one farm; it prefers a nearby hill, stone deposit, or iron deposit, but can open a shallow stone quarry if no natural mine site is close enough
- barrack can be built once after the basic chain and mining economy can supply stone; it costs wood plus stone and increases army mobilization from the capital village
- dock can be built once on a nearby walkable shore tile adjacent to water; it costs wood, claims territory, and marks future boat, trade, and colonization access, but does not launch ships yet
- ordinary building placement now uses deterministic weighted site selection instead of a fixed ring around the village center: houses avoid resource deposits and nearby mineable resources while clustering near the core, storage prefers central connector sites, farms prefer food-rich or water-adjacent arable land and cannot occupy mineable resource tiles, barracks prefer an outer village ring, mines prefer ore or hill sites while avoiding the residential cluster when alternatives exist, and docks still require shore tiles

The territory model is influence-based. Active buildings claim tiles around their fixed positions, which keeps territory stable while villagers move. PR-12D.5 also adds settlement pressure from the village center and short-lived work sites, so population, housing pressure, construction, and nearby resource use can make claimed land spread before more buildings are complete. Territory is projection data for rendering, diplomacy, and war feedback; it does not yet block movement or create hard borders. Territory projection now marks each tile as `surface: land` or `surface: water`, and as `source: settlement_core`, `building`, `work_site`, or `frontier`. Water inside a settlement influence radius renders as faint soft control so coastlines and lakes do not visually split one realm, while land territory remains the only surface counted in village, kingdom, and HUD territory totals. Lava is still excluded. Unaffiliated villages claim tiles with only `villageId`; villages inside a kingdom also stamp `kingdomId` on their territory tiles. Tile inspection translates the territory source so the player can tell whether a claim came from the settlement core, built structures, temporary construction/gathering activity, or expansion preparation. The Phaser layer renders kingdom-owned territory with that kingdom's stable color, draws only the outer boundary outline instead of every grid edge, uses lower opacity for water control and temporary/frontier sources, and brightens the selected village or kingdom's territory so ownership is easier to read. Captured villages visually switch to the attacker's color after ownership transfer.

When a village loses all population, its buildings are not deleted immediately. They become abandoned remnants. Abandoned buildings stay visible but no longer provide housing, storage, farm production, mine access, army mobilization bonuses, dock access, or active territory. If they remain abandoned long enough, they decay into visible ruins and emit a ruin event so the map preserves a readable trace of the collapsed settlement. PR-12C can now build on this chain with job-driven resource stores.

## Village Jobs and Resources

Villages now assign a small aggregate workforce each simulation tick. This is not per-citizen inventory or full worker pathfinding; it is a cheap village-level job model that makes the resource economy readable while preserving the PR-11 scale target.

- farmers exist from the start as a small default workforce, keep early villages alive, and make farm food production stronger once farms appear
- builders reserve a small part of the workforce and gather nearby wood deposits into village stores
- miners are assigned when active mines exist and move nearby stone or iron deposits into village stores; early quarries provide a small stone deposit so normal settlements can visibly enter the mining chain
- soldiers are assigned when barracks exist, but army formation still uses the existing aggregate mobilization model

Food, wood, stone, and iron stores are projected to the UI and shown in village and kingdom inspection panels. Houses, storage, farms, mines, barracks, docks, and house upgrades now use material costs; construction time is driven by builder jobs. Village food stores now also act as a fallback supply for residents when local ground food is exhausted. Town hall upgrade gates still use food surplus as a prosperity signal until the later city-growth pass replaces or deepens that model.

WorldBox-aligned growth treats builders and homes as a core early loop, not only as background economy. Village inspection now reports growth blockers for housing pressure, missing wood, exhausted nearby wood, insufficient builders, low food reserve, and lack of buildable land. The map shows short-lived construction markers; wood gathering is readable through depleted forest/wood sources and inventory changes while still temporarily contributing to territory projection. PR-12E.1 fixes the rich-town stall: if a village has full food, abundant wood, around 30 residents, and spare housing, the simulation exposes a build plan and can turn surplus into more visible town density instead of silently idling.

## Combat and War

War starts at the group level. A `war_declared` event can form an `ArmyGroup` from the aggressor kingdom's capital village. Army groups are projected as aggregate military units with position, target kingdom, target village, soldier count, morale, status, and occupation progress.

Barracks are the first building hook into war. If the capital village has an active barrack when an army group forms, the simulation raises both the mobilization ratio and the maximum soldier cap for that army. PR-12C now exposes village-level soldier jobs, and those trained soldiers now feed army formation and battle strength as a first pass, while detailed soldier mustering and per-fighter combat remain later depth.

The first war model intentionally avoids complex individual brawls, but it should still read like a WorldBox-style invasion:

- up to three eligible villages in the attacking kingdom can send grouped army objects into the same war, so conflict is no longer only a capital-to-capital strike
- each army marches from its origin village toward the nearest valid enemy village
- when an army reaches the village, it enters a multi-tick fighting/occupation state instead of resolving instantly
- battle pressure compares aggregate attacker strength against village defender strength
- casualties periodically remove a small number of residents from the origin and target villages
- winning attackers capture the target village for their kingdom once occupation progress completes
- armies disband after capture, retreat, or losing their target
- an ongoing declared war can raise another aggregate army after the previous army is destroyed, repelled, or captures its target, but natural re-formation waits for a 360-tick cooldown so wars do not instantly spam waves
- forced peace disbands active armies between two kingdoms and suppresses immediate re-escalation with a 720-tick truce

This PR-10/PR-12E model is enough for wars to start, move, visibly fight, cause casualties, and change village ownership. Later stages can add richer fronts, commanders, peace deals, deeper occupation, culture, rebellion, and more expressive local fighters.

In the current UI, army groups render as triangular markers using their owning kingdom's color, with the outline preserving basic status feedback. PR-12E also draws route lines from active armies to their target villages, lists active campaigns in kingdom inspection, and shows current kingdom pressure/conflict summaries in the HUD. At local zoom, fighting armies now project small attacker and defender dots around the clash so battles read more like local combat while the simulation still stays aggregate for performance.

## Race Identity

Race differences must affect behavior and survival pressure:

- humans expand steadily
- orcs consume more and escalate conflict sooner
- elves prefer forests and avoid unnecessary tree clearing
- dwarves prefer hills and mining

Visual differences are secondary.
