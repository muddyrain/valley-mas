# WorldSim v2 Mechanics

## World

The world is a tile grid split into chunks. The simulation map default remains 128 x 128 tiles for tests and tooling, while the interactive Phaser demo now creates a larger 256 x 256 world so terrain covers the whole browser viewport like a WorldBox-style sandbox at the default zoom. The demo generates a fresh world seed when the URL has no `seed` parameter, so reloading can produce different terrain, resource layouts, civilization starts, and autonomous building sites. Default initial life no longer spawns at the map center; it uses the world seed to pick walkable, food-supported, non-edge start areas, with a walkable fallback only for sparse edge cases. Larger initial populations are split into multiple distant start clusters so the default sandbox can naturally grow more than one village and kingdom instead of always concentrating around the first capital. Terrain generation derives its wave phases from the full seed, not just seed length, so same-length demo seeds still produce visibly different maps. Supplying `?seed=some-name` keeps the same deterministic world for debugging, comparison, and balance review. Full projection remains available for tests and tooling, while the Phaser render path requests a padded camera viewport so visible tiles and entities can be culled through the chunk-indexed projection path. Camera navigation follows WorldBox-style PC controls: WASD or arrow keys move the camera, Q/+ zooms in, E/- zooms out, the mouse wheel zooms around the pointer, and Ctrl + wheel changes simulation speed. Mouse edge panning is intentionally disabled so pointer placement near UI or map borders does not move the camera unexpectedly. The camera is driven by world-center plus zoom rather than patched scroll offsets, so keyboard movement, resize, and zoom all share the same clamped view model. Pan speed is viewport-relative: keyboard movement crosses about one and a half visible screens per second, so perceived screen speed stays consistent across close zoom and wide overview. Keyboard acceleration is tuned for immediate response. Render-heavy map layers use a padded viewport and coarse viewport buckets, so zoomed-out panning keeps vector draw command counts bounded instead of rendering full-map graphics every frame. Terrain now renders through 32 x 32 tile render-texture chunks that are generated lazily and reused until terrain revision changes, so panning a large world draws cached texture blocks instead of a retained Graphics list of tile rectangles. Territory fill now uses fixed 32 x 32 tile render-texture chunks with per-chunk draw keys, while the border Graphics layer only keeps territory borders; this avoids resized render-texture ghost rectangles and avoids large viewport Graphics command lists. The Scene also reuses the last projection while the sim tick and tile-bounded viewport stay unchanged, preventing idle frames from rebuilding the same projected territory, villages, labels, and armies. Dynamic local layers such as units, armies, work sites, and selection highlights redraw only when their data key changes, not on every browser frame. Zoom also controls render detail more aggressively: overview zoom keeps terrain, territory, up to 8 priority village labels, and capped army context; regional zoom keeps up to 12 priority village labels and only map-level building signals such as town halls, construction, abandoned buildings, and ruins; local zoom is reserved for units, resources, work-site details, farmland, and full local labels/routes. Overview and regional labels prioritize selected villages, capitals, rebellion, unrest, expansion, and high-level settlements instead of recreating every village label, which keeps multi-rebellion maps readable without turning the whole screen into text. The HUD also refreshes by state key with a short throttle, so camera-only panning does not rebuild overlay text and panel layout every frame. The default zoom uses a cover-style game view, while the minimum zoom uses a contain-style overview so the player can zoom out far enough to see the entire generated map but not beyond it. When the map is smaller than the viewport on one axis, the camera centers it and uses water-colored map background instead of exposed black camera background. Each tile has terrain, biome, and optional resource deposits. Early terrain types are grass, forest, hill, water, sand, snow, and lava. Early biomes are temperate, woodland, highland, coast, dryland, frozen, and volcanic.

Dense rebellion and war screens now apply an additional density LOD pass on top of zoom. If one camera view contains many villages, buildings, resource tiles, units, armies, or work-site pulses, the Phaser layer treats the view as regional even at local zoom: per-unit dots, resource icons, farmland, and work-site pulses are hidden, and village labels stay priority-capped. This follows the WorldBox-style expectation that busy screens should preserve kingdom, rebellion, war, and settlement readability before showing every local object.

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

Units seek food when hungry, eat nearby food or their home village stores, wander when stable, age over time, die from old age or starvation, and reproduce when local conditions allow. The hunger clock is intentionally slower than the first foundation slice: hunger now rises by `0.35` per simulation tick, units start seeking food above 35 hunger, and starvation damage still begins at 100 hunger. Village food stores are no longer charged a second population-wide meal cost every 30 ticks; that interval now checks whether the village has enough reserve to remain stable or should read as declining.

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

Food is the first active resource. It exists as tile deposits and supports the life loop. PR-12C now exposes village and kingdom stores for food, wood, stone, and iron. Wood deposits sit on forest tiles and render as small map markers, and stone/iron deposits on hills also render as visible markers so material sources are readable. Builders gather nearby wood into village stores, active mines can gather nearby stone or iron deposits, and villages can open a small early stone quarry when no rare natural hill is close enough. Building construction now uses material costs instead of spending food. Residents can also draw food from their home village stores when nearby tile food runs out. Food is reserved for feeding people and for prosperity-style gates. Early camp villages also use a lighter food drain so the first 30-person settlement can bootstrap before the farm/build loop is online. Active farm buildings now project a small surrounding farmland ring, making them read as windmill-centered agricultural sites rather than a single abstract green dot; farm work pulses can appear on the worked field tiles. Windmill fields require assigned farmer jobs for stable farm output: default farmers provide only a small early foraging trickle (`0.1` food per farmer per tick), while a maintained windmill contributes `0.2` base food per tick plus a light field contribution of `0.012` per projected field tile. This keeps one maintained windmill able to stabilize a 12-person village without immediately flooding storage. Village projection now includes food reserve target, reserve balance, active farm count, and maintained farm count, letting inspection explain whether food pressure is caused by low reserves, farmer shortage, or storage limits.

Resource gathering remains village-aggregate rather than visually per-person. Builder jobs prefer nearby wood deposits, but can now scout reachable wood out to a wider frontier radius when a new village has no local construction material. This follows the WorldBox-like model of villagers cutting trees directly rather than requiring a separate lumber camp building. Forest/wood sources visibly deplete, the map renders short-lived wood-gathering pulses, and those pulses no longer create temporary territory islands. Village inspection exposes growth blockers such as missing wood, missing stone, missing iron, low food reserve, or no reachable wood source when construction stalls. It also exposes a single primary growth blocker so the player can understand the next missing condition without guessing from a list.

## Villages and Kingdoms

Villages now form after individual survival pressure is visible. A cluster of at least eight same-race units near enough food can found a camp. Founding units receive a stable `homeVillageId`; later same-race homeless units near the settlement can be adopted into that home village. The village stores gathered food and early materials, tracks home population, exposes housing capacity, and enters a declining state when inventory cannot satisfy the projected reserve target.

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
- territory follows settlement core, stable building, and frontier-preparation influence
- selected village territory draws its own closed outline even when adjacent to a same-kingdom village; unselected same-kingdom borders still merge into a cleaner realm outline
- kingdoms group villages and prepare diplomacy

Kingdoms form from village strength instead of player commands. A village with enough home population and active buildings can found a rising kingdom. Nearby same-race villages can join that kingdom, and mature pressured member villages can now seed new satellite villages when suitable land and food exist nearby. A kingdom tracks capital village, member villages, total home population, active buildings, active territory, food inventory, stable display color, and status. The founding capital is stable: it does not move just because another member village has more population. A replacement capital is chosen only when the current capital is no longer a valid member, such as after abandonment, removal, or capture. Replacement priority is highest active town hall tier, then active building count, then population, then deterministic village id order. If all member villages disappear, the kingdom becomes fallen and remains as history data for later UI. Territory projection now keeps both `villageId` and optional `kingdomId`, so diplomacy, war, and rendering can reason about ownership by kingdom without changing the simulation/rendering boundary.

PR-12G starts the internal-stability layer and now includes the first WorldBox-aligned split founding pass. Each kingdom village projects `loyalty` and a primary `loyaltyReason`; loyalty is capped at 100 but can fall below 0 so rebellion pressure stays readable. Capitals remain at 100 with `capital`; non-capital villages lose loyalty from distance to capital, kingdom overextension, food pressure, current diplomacy/war pressure, or being a much stronger frontier town than the capital. Village inspection shows `忠诚` and `内政原因`, giving the player a read on why a large realm may become unstable. Villages from 0 to below 50 loyalty project `low_loyalty`, the map label adds `不稳 ·`, and inspection shows `不稳原因` plus `内政提示：忠诚偏低`. Only eligible villages below 0 loyalty project `prepare_rebellion`; their map label adds `叛乱 ·`, and inspection shows `叛乱原因`, `叛乱进度`, plus `内政提示：正在秘密组织独立`. Rebellion progress rises while negative loyalty persists and decays when loyalty recovers, preserving a readable intervention window. When progress reaches 100, the rebel village leaves the parent kingdom, founds a new kingdom, pulls in nearby low-loyalty non-capital supporters, emits `rebellion_succeeded`, and immediately starts a rebellion war through the existing `war_declared` and army-group path. To keep large rebellions readable and avoid one-frame spikes, a parent kingdom can complete only one split per tick, and supporter count is capped to the WorldBox-style upper half of the parent realm. `recently_captured` is reserved as a loyalty reason for the later rebellion/capture-memory slice.

## Civilization Progression Spine

The world should be balanced around one readable progression spine. Each stage must be autonomous, visible, and inspectable before the next stage becomes the focus.

| Stage | Player reads on map | Simulation gate | Main pressure | Failure state |
|---|---|---|---|---|
| Life seed | scattered people moving, eating, and reproducing | living units on walkable terrain with food nearby | hunger and partner availability | starvation or low birth rate |
| Camp | named camp, town hall, first territory patch | 8 same-race homeless units near enough food | food reserve and stable home ownership | declining camp |
| Hamlet | first house/storage/farm construction sites | wood access, builders, first housing pressure | missing wood, low food, no builders | visible growth blockers |
| Village | houses, farm loop, growing territory outline | stable food, housing below cap, basic buildings | housing pressure and material supply | stalled build plan |
| Town | upgrades, mine, barrack, dock hook, level changes | surplus food/wood, town hall gates, enough residents | prosperity construction and specialization | overbuilt but low population |
| Frontier | frontier claim, larger soft territory, satellite founding | mature kingdom village with surplus and nearby food-rich land | land availability and settler cost | waiting land or resources |
| Kingdom | colored territory, capital, member villages, loyalty, pressure target | eligible village strength and same-race join radius | border friction, resource deficit, and internal loyalty | war, capture, rebellion, or kingdom fall |

Near-term changes should start at the Hamlet/Village boundary. That is where the current prototype most needs stronger WorldBox alignment: residents already have survival needs, and kingdoms already exist, but the middle step still depends on aggregate jobs that can feel abstract. The improvement path is:

1. Make build intent more explicit: every village now projects `primaryIntention` for whether it is trying to get housing, storage, farm capacity, materials, military, dock access, or a satellite site. The projection also includes both the full blocker list and a single primary blocker.
2. Make territory expansion staged: core settlement territory comes from population and town hall level; stable territory comes from buildings; frontier territory comes from satellite planning. Temporary work sites remain readable pulses, not formal borders. Territory remains soft until a later border-rule pass.
3. Make stalls actionable: each blocked growth plan should map to one primary blocker and one visible remedy, such as missing wood, no reachable wood source, low food reserve, no builders, no buildable land, or waiting for population pressure.
4. Make satellite founding feel like settlement expansion: before a new village appears, the mature parent exposes `prepare_expansion` when it is ready, `waiting_land` when no suitable food-rich site exists, and `waiting_resources` or `waiting_population_pressure` when it already has enough settlers but lacks food, wood, or housing pressure. Once a parent has committed to `prepare_expansion`, later house upgrades do not cancel that expedition unless population, resources, or the site itself fall below the frontier gate.
5. Keep the player as a god: no manual building placement, job assignment, or move orders. God powers can nudge conditions, but the settlement decides how to use them.

The first PR-12F observation harness is available through `pnpm --filter @valley/world-sim observe:growth`. It creates deterministic food-and-wood-supported camps and prints sampled rows for tick, growth phase, primary intention, primary blocker, population, housing, stores, food reserve, food reserve balance, farm count, maintained farm count, building count, and land territory. It also prints a multi-seed diagnosis with first camp/hamlet/village ticks, final plan/blocker, missing house/storage/farm chain pieces, final food balance, farm coverage, and recent phase/building events. The same command now includes an isolated windmill support report: after the first windmill is active, it clears ground food/wood, starts the village at its reserve target, and verifies that one maintained windmill keeps a 12-person village stable over 240 ticks without rapidly filling storage. The command also includes a satellite-expansion timing report with first expansion status tick and plan, first `prepare_expansion` tick, first frontier map-label tick, first inspection reason/hint ticks, `expansionLead`, `labelLead`, and `hintLead` ticks, satellite-founded tick, parent population/housing/resource snapshots, and child population/housing after founding. `pnpm --filter @valley/world-sim observe:building-sites` prints a separate multi-seed building placement report with each autonomous building's type, position, distance to village center, nearest food, nearest stone or iron, nearest water, and nearest same-type building. These reports are evidence for later camp/hamlet/village, frontier, and purpose-scored building-site tuning. The first farm-leg tuning keeps the first house on the older visible construction timing, then lets the house/storage/farm bootstrap chain attempt follow-up buildings faster until the basic chain is complete. A settlement now enters `village` once that chain stabilizes instead of skipping straight from `hamlet` to `town` because of level alone. Expansion preparation is also surfaced before a satellite appears: mature villages emit a recent `village_expansion_status` event when their active expansion plan changes, village inspection translates that active expansion plan into an expansion reason and a short frontier hint, and the map label adds `拓荒 ·` while the village is actively in `prepare_expansion`. The satellite report locks that these readability signals appear before founding and keep the intended 60 tick preparation window. Young villages that merely need more population do not show expansion reasons yet, and their build/primary-intention text reads `等待人口增长` rather than expansion failure.

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
- town hall now acts as the upgrade gate for the rest of the chain and provides the first small food, wood, stone, and iron storage capacity
- house is the visible housing building; the first slice stores `tier: 1`, then can upgrade to tiers 2 and 3 for extra housing capacity, and its construction is wood-driven rather than food-driven
- when population reaches roughly 75% housing use after the first house/storage chain, villages prioritize another house before optional farm, mine, barrack, or dock work
- PR-12E.1 adds continuous town growth pressure so rich stable towns keep expanding houses, farms, or storage when food/wood are abundant, even if housing is not yet nearly full
- storage increases village food, wood, stone, and iron capacity and costs wood; builder and miner gathering stop when the relevant store is full, and resources above remaining capacity are lost when storage stops being active
- farm represents a windmill-centered agricultural site: it produces village food only when assigned farmer jobs can maintain it, projects surrounding farmland tiles, and costs wood; active farms project short-lived farm-tending work sites on worked field tiles so maintenance is visible even before individual farmer pathing exists; farm sites must be arable empty land or food-bearing land, never wood, stone, or iron resource tiles
- the initial house/storage/farm chain uses a faster follow-up build cadence after the first house appears, so early settlements reach a readable farm loop before later mining or military branches dominate
- mine can be built once after the village has a house, storage, and at least one farm; it prefers a nearby hill, stone deposit, or iron deposit, but can open a shallow stone quarry if no natural mine site is close enough
- barrack can be built once after the basic chain and mining economy can supply stone; it costs wood plus stone and increases army mobilization from the capital village
- dock can be built once on a nearby walkable shore tile adjacent to water; it costs wood, claims territory, and marks future boat, trade, and colonization access, but does not launch ships yet
- ordinary building placement now uses deterministic weighted site selection instead of a fixed ring around the village center: houses avoid resource deposits and nearby mineable resources while clustering near the core, storage prefers central connector sites, farms prefer food-rich or water-adjacent arable land and cannot occupy mineable resource tiles, barracks prefer an outer village ring, mines prefer ore or hill sites while avoiding the residential cluster when alternatives exist, docks still require shore tiles, non-town-hall buildings are never allowed to occupy a tile already used by another building, and ordinary sites prefer at least a small gap from existing buildings so early settlements do not collapse into one crowded cluster

The territory model is influence-based. Active buildings claim tiles around their fixed positions, which keeps territory stable while villagers move. Settlement pressure from the village center keeps early camps readable, and `frontier` claims show a mature village preparing a satellite. Short-lived construction, wood-gathering, mining, and farm-tending work sites remain visible as activity pulses, but they no longer create formal territory. Territory is projection data for rendering, diplomacy, and war feedback; it does not yet block movement or create hard borders. Territory projection now marks each tile as `surface: land` or `surface: water`, and as `source: settlement_core`, `building`, or `frontier`. Water inside a settlement influence radius renders as faint soft control so coastlines and lakes do not visually split one realm, while land territory remains the only surface counted in village, kingdom, and HUD territory totals. Lava is still excluded. Unaffiliated villages claim tiles with only `villageId`; villages inside a kingdom also stamp `kingdomId` on their territory tiles. Tile inspection translates the territory source so the player can tell whether a claim came from the settlement core, built structures, or expansion preparation. The Phaser layer renders kingdom-owned territory with that kingdom's stable color, draws only the outer boundary outline instead of every grid edge, uses lower opacity for water control and frontier sources, and keeps selected village or kingdom fills faint while making the selected boundary more prominent so ownership reads through outline instead of blocky overlays. Captured villages visually switch to the attacker's color after ownership transfer.

When a village loses all population, its buildings are not deleted immediately. They become abandoned remnants. Abandoned buildings stay visible but no longer provide housing, storage, farm production, mine access, army mobilization bonuses, dock access, or active territory. If they remain abandoned long enough, they decay into visible ruins and emit a ruin event so the map preserves a readable trace of the collapsed settlement. PR-12C can now build on this chain with job-driven resource stores.

## Village Jobs and Resources

Villages now assign a small aggregate workforce each simulation tick. This is not per-citizen inventory or full worker pathfinding; it is a cheap village-level job model that makes the resource economy readable while preserving the PR-11 scale target.

- farmers exist from the start as a small default workforce, keep early villages alive, and make farm food production stronger once farms appear
- builders reserve a small part of the workforce and gather nearby wood deposits into village stores
- miners are assigned when active mines exist and move nearby stone or iron deposits into village stores; early quarries provide a small stone deposit so normal settlements can visibly enter the mining chain
- soldiers are assigned when barracks exist, but army formation still uses the existing aggregate mobilization model
- laborers account for every remaining resident so the inspection job summary always totals to the village population

Food, wood, stone, and iron stores plus their capacities are projected to the UI and shown in village and kingdom inspection panels. A newly founded town hall provides enough baseline capacity to bootstrap early house/storage/farm work, while storage buildings make larger stockpiles possible instead of acting as decorative chain pieces. Storage capacity is derived from currently active buildings; if a warehouse is abandoned, ruined, or later destroyed by another system, the village immediately loses any resources above the remaining town-hall-and-storage capacity. Material stores that are at least 90% full now create a readable storage pressure blocker and can make prosperous villages choose `expand_storage`; if the next town hall upgrade requires more food capacity than the village can currently hold, inspection reports insufficient storage. Storage expansion no longer uses a single fixed cap: small settlements can support about 2 warehouses, while larger population, higher level, more buildings, or wider territory can raise the cap up to the current safety hard limit of 10. Houses, storage, farms, mines, barracks, docks, and house upgrades now use material costs; construction time is driven by builder jobs. Village food stores now act as the fallback supply residents draw from when nearby ground food is exhausted. The village reserve check runs every 30 ticks, but it only updates stable/declining status against a two-cycle reserve target instead of directly subtracting another population meal. Village inspection now shows the current reserve versus target, the reserve surplus or deficit, maintained farms versus active farms, and a compact food status such as sufficient, low reserve, farmer shortage, or storage-limited. Town hall upgrade gates still use food surplus as a prosperity signal until the later city-growth pass replaces or deepens that model.

WorldBox-aligned growth treats builders and homes as a core early loop, not only as background economy. Village inspection now reports growth blockers for housing pressure, missing wood, missing stone, missing iron, storage near full, insufficient storage capacity, exhausted nearby wood, insufficient builders, low food reserve, and lack of buildable land. Waiting text is refined into readable cases such as waiting for population, wood, food, building materials, or frontier supplies; resource-rich towns below the prosperity population gate wait for population rather than claiming they lack materials. The map shows short-lived construction, wood-gathering, and farm-tending markers; wood gathering is readable through work pulses, depleted forest/wood sources, and inventory changes without temporarily contributing to territory projection. Farm buildings now render as windmills with adjacent field tiles, so food production leaves a durable agricultural footprint instead of only a temporary pulse. PR-12E.1 fixes the rich-town stall: if a village has full food, abundant wood, around 30 residents, and spare housing, the simulation exposes a build plan and can turn surplus into more visible town density instead of silently idling.

## Combat and War

War starts at the group level. A `war_declared` event can form an `ArmyGroup` from the aggressor kingdom's capital village. Army groups are projected as aggregate military units with position, target kingdom, target village, soldier count, morale, status, and occupation progress.

Barracks are the first building hook into war. If the capital village has an active barrack when an army group forms, the simulation raises both the mobilization ratio and the maximum soldier cap for that army. PR-12C now exposes village-level soldier jobs, and those trained soldiers now feed army formation and battle strength as a first pass, while detailed soldier mustering and per-fighter combat remain later depth.

The first war model intentionally avoids complex individual brawls, but it should still read like a WorldBox-style invasion:

- up to three eligible villages in the attacking kingdom can send grouped army objects into the same war, so conflict is no longer only a capital-to-capital strike
- each army marches from its origin village toward the nearest valid enemy village
- when an army reaches the village, it enters a multi-tick fighting/occupation state instead of resolving instantly
- battle pressure compares aggregate attacker strength against village defender strength
- casualties periodically remove a small number of residents from the origin and target villages
- winning attackers capture the target village for their kingdom once occupation progress completes; active buildings, including storage, remain attached to the captured village, but only 50% of stored food, wood, stone, and iron survives the plunder
- armies disband after capture, retreat, or losing their target
- an ongoing declared war can raise another aggregate army after the previous army is destroyed, repelled, or captures its target, but natural re-formation waits for a 360-tick cooldown so wars do not instantly spam waves
- forced peace disbands active armies between two kingdoms and suppresses immediate re-escalation with a 720-tick truce

This PR-10/PR-12E model is enough for wars to start, move, visibly fight, cause casualties, plunder stores, and change village ownership. Later stages can add richer fronts, commanders, peace deals, deeper occupation, culture, rebellion, and more expressive local fighters.

In the current UI, army groups render as triangular markers using their owning kingdom's color, with the outline preserving basic status feedback. PR-12E also draws route lines from active armies to their target villages, lists active campaigns in kingdom inspection, and shows current kingdom pressure/conflict summaries in the HUD. Route rendering is detail-tiered: overview keeps only the most important active routes, regional keeps more, and local zoom can show all visible routes, with selected army or kingdom routes pinned ahead of the cap. At local zoom, fighting armies now project small attacker and defender dots around the clash so battles read more like local combat while the simulation still stays aggregate for performance.

## Race Identity

Race differences must affect behavior and survival pressure:

- humans expand steadily
- orcs consume more and escalate conflict sooner
- elves prefer forests and avoid unnecessary tree clearing
- dwarves prefer hills and mining

Visual differences are secondary.
