# WorldSim v2 Roadmap

## Status Language

- `Done`: acceptance fully satisfied.
- `Foundation slice`: code skeleton exists, but one or more acceptance items are still missing.
- `Planned`: not started.

Current overall stage: `Foundation prototype`. The project is not a playable MVP yet.

## PR-0: In-Place Reset

Status: `Done`

- Replace old `src` and `docs` with v2 entries.
- Preserve package config, Vite config, TypeScript config, `index.html`, and assets.
- Acceptance: no old M1 implementation remains as the active source.

## PR-1: Pure Simulation Core

Status: `Done`

- Add `SimWorld`, `SimLoop`, `SimCommand`, `SimEvent`, seed RNG, fixed tick.
- Acceptance: same seed and command sequence replay to the same result.
- Implemented:
  - `SimWorld`, `SimLoop`, seed RNG, command queue, event log.
  - Deterministic replay test for one command sequence.
  - Basic command validation and `command_rejected` events.
- Acceptance gaps:
  - Save/load replay format is not formalized.

## PR-2: Map, Chunk, Biome, Resource

Status: `Foundation slice`

- Add tile data, chunk indexing, seeded map generation, and resource lookup.
- Acceptance: map generation is deterministic and resource lookup avoids full-map unit behavior scans.
- Implemented:
  - Seeded tile map, biome tags, resource deposits, chunk index.
  - Default simulation map size remains 128 x 128 tiles for tests and tooling; the interactive Phaser demo now uses a 256 x 256 world for a fuller WorldBox-style screen experience.
  - Deterministic map test.
  - Projection culling can reuse chunk-indexed tile lookup for visible tile slices.
- Acceptance gaps:
  - Resource lookup is radius-bound, but resource deposits are not indexed separately yet.

## PR-3: Life Survival Loop

Status: `Foundation slice`

- Add autonomous units with hunger, health, age, death, food seeking, eating, wandering, and birth.
- Acceptance: food-rich worlds grow; food-poor worlds decline; 1000 units can run in pure simulation tests.
- Implemented:
  - Hunger, eating, wandering, old age, starvation, birth, death.
  - Food-rich growth and food-poor decline tests.
  - 1000-unit pure simulation foundation test.
  - Freshly spawned units start with reproduction cooldown to avoid same-tick surprise births.
- Acceptance gaps:
  - Unit behavior is a minimum needs loop, not a stable villager AI model.

## PR-4: Phaser Projection

Status: `Foundation slice`

- Render only `WorldProjection`.
- Scene input issues commands only.
- Acceptance: simulation tests pass without Phaser and scene state is not simulation truth.
- Implemented:
  - Phaser scene creates `SimWorld`, advances `SimLoop`, and renders `WorldProjection`.
  - Input creates commands for food, spawn, terrain, lightning, speed, and pause.
  - Source-level architecture scan rejects Phaser imports and browser globals inside `src/sim`.
  - UI now uses a Chinese fullscreen debug HUD with state, controls, and event panels.
  - HUD panels use a separate UI camera and responsive panel sizing, so map zoom and browser resize do not distort the status overlay.
  - Scene projection requests now pass the active camera viewport, so render-facing tiles, units, territory, buildings, and armies are culled before drawing.
  - Terrain redraws are keyed by terrain revision plus viewport instead of ticking every frame.
  - The main camera now supports WorldBox-style keyboard movement, pointer-anchored wheel zoom, keyboard zoom, and a dynamic cover zoom so terrain fills the viewport instead of leaving exposed camera background.
- Acceptance gaps:
  - Full projection remains the default compatibility path for tests, replay inspection, and tools that do not pass a viewport.
  - PR-11 has a repeatable scale measurement harness and a local 128 x 128 / 10000 population / 500+ visible unit stability sign-off; larger maps still require fresh metrics.

## PR-5: God Command Foundation

Status: `Foundation slice`

- Add spawn, food placement, terrain change, lightning, pause, and speed commands.
- Acceptance: all player effects are command/event based and replayable.
- Implemented:
  - Commands are queued and converted into events.
  - Basic command effects are visible in the Phaser demo.
- Acceptance gaps:
  - Command rejection and validation are minimal.
  - Command schema is still in TypeScript only; no runtime validation.
  - UI is a debug surface, not a final god-power toolbar.

## PR-6: Villages

Status: `Done`

- Add camps, village inventory, housing capacity, food consumption, growth and decline.
- Acceptance: villages emerge from local population and resources.
- Implemented:
  - Camps form when a same-race population cluster has enough nearby food.
  - Villages track home population, center, food inventory, housing capacity, and camp/stable/declining status.
  - Units now expose stable `homeVillageId` ownership; `villageId` is only current nearby village presence.
  - Village food is gathered from nearby deposits and consumed on a fixed interval.
  - Village-supported reproduction respects home village housing capacity.
  - Village founding, decline, and abandonment produce simulation events and projection data.
  - HUD renders village count, housing, village inventory, buildings, territory, and kingdom summaries.
- Acceptance gaps:
  - Migration, explicit citizenship changes, and family lines are not implemented yet.
  - Village centers remain internal anchors; no village inspection panel or named settlement UI yet.

## PR-7: Buildings and Territory

Status: `Done`

- Add housing, storage, farm, and settlement influence territory.
- Acceptance: buildings affect survival or expansion and are not decorative.
- Implemented:
  - Villages originally spent food surplus on housing, storage, and farm buildings; PR-12C has since shifted active construction toward material stores.
  - Huts increase housing capacity.
  - Storage increases village food, wood, stone, and iron capacity; PR-12F now also lets near-full stores or future upgrade capacity blockers drive warehouse expansion.
  - Farms produce village food after nearby deposits are exhausted; PR-12F now treats them as windmill-centered farmland that requires assigned farmer maintenance for stable field output.
  - Active building influence projects stable walkable territory tiles.
  - Buildings become abandoned remnants instead of disappearing when a village loses all population.
  - HUD renders building count, territory size, territory shading, and building markers.
- Acceptance gaps:
  - Historical PR-7 gaps around worker jobs, wood/material costs, construction time, and inspection panels have since been covered by PR-12C through PR-12F slices.
  - Territory is projection influence only; it can feed diplomacy pressure and readability, but still does not block movement or create hard borders yet.
  - Ruin decay, reclamation, and cleanup are represented by status fields but not yet simulated.

## PR-8: Kingdoms

Status: `Done`

- Add kingdom, capital, multi-village membership, and summary statistics.
- Acceptance: kingdoms are derived from village and population state.
- Implemented:
  - Eligible villages can automatically found rising kingdoms.
  - Nearby same-race villages can join an existing kingdom.
  - Kingdoms track capital village, member village ids, population, active building count, active territory, food inventory, and status.
  - Founding capitals stay stable while valid; replacement capitals are chosen only after capital loss, preferring town hall tier, active building count, population, then village id order.
  - Kingdom population is derived from member villages' home population, so walking away from the settlement no longer changes kingdom population by itself.
  - Territory projection stamps `kingdomId` for kingdom-owned village territory while preserving `villageId`.
  - Kingdom status can become fallen when all member villages disappear.
  - HUD renders active kingdom count, fallen kingdom count, and largest active kingdom population.
- Acceptance gaps:
  - Kingdom names, rulers, banners, culture, claims, rebellions, and deep war resolution remain PR-12+ flavor.

## PR-9: Diplomacy Pressure

Status: `Done`

- Add relationship pressure, border friction, resource pressure, race modifiers, and declaration events.
- Acceptance: wars have observable causes.
- Implemented:
  - Active kingdom pairs maintain accumulating diplomacy pressure.
  - Border friction increases pressure for nearby rival kingdoms.
  - Low food per resident adds resource pressure.
  - Race modifiers affect escalation speed; orcs escalate faster, elves slower, dwarves slightly faster, and same-race pressure is reduced.
  - Kingdom projection exposes each kingdom's current highest diplomacy pressure and target kingdom.
  - Diplomacy emits `border_friction`, `resource_pressure`, `diplomacy_pressure`, and `war_declared` events.
- Acceptance gaps:
  - Peace resolution, long wars, multiple fronts, and post-war diplomacy remain after PR-10.

## PR-10: Minimal War

Status: `Done`

- Add army groups, rallying, marching, battle resolution, casualties, retreat, and village capture.
- Acceptance: wars can start, progress, and end without simulating every distant fighter as a full AI unit.
- Implemented:
  - War declarations form aggregate `ArmyGroup` records instead of switching every unit into single-combat AI.
  - Army groups track kingdom, target kingdom, origin village, target village, position, soldier count, morale, formed tick, and status.
  - Armies march toward target villages and resolve grouped battles on contact.
  - Battle resolution applies aggregate casualties to both sides.
  - Winning attackers can capture the target village and transfer it to the attacker's kingdom; active buildings remain with the captured village, while 50% of stored food, wood, stone, and iron is lost to plunder.
  - Army state is exposed through projection and rendered in the Phaser HUD as owner-colored triangular markers.
  - Kingdom territory is rendered with stable kingdom colors, and captured village territory switches to the attacker's color through `kingdomId`.
- Acceptance gaps:
  - No multiple-front strategy, peace treaty, occupation timer, commander/king participation, prisoner handling, or detailed soldier job model yet.
  - Capture is direct village ownership transfer; culture, rebellion, resistance, and recapture depth remain PR-12+ flavor.

## PR-11: Scale Gate

Status: `Done`

- Add worker simulation, hot-data layout, projection culling, and render pooling where metrics justify it.
- Acceptance: 10000 aggregate population and 500 visible units remain stable.
- Implemented:
  - `SimWorld.project()` accepts an optional tile viewport while preserving the full-projection default.
  - Viewport projection returns only visible tiles, units, territory, buildings, and army groups while keeping HUD stats global.
  - Visible tile collection uses the map chunk index instead of scanning the entire tile array.
  - Phaser now projects from the active camera viewport and reuses the terrain graphics layer unless terrain revision or viewport changes.
  - Regression coverage proves a 64 x 64 full projection can be reduced to a 10 x 10 visible tile slice while global population stats stay intact.
  - `src/sim/scaleMeasurement.ts` defines repeatable 1000 / 3000 / 5000 / 10000 population scale scenarios and a `pnpm --filter @valley/world-sim measure:scale` report command.
  - PR-11A first local measurement on 2026-05-19: 10000 aggregate population with 503 viewport-visible units reported average simulation step 16.976 ms, full projection 1.261 ms, and viewport projection 0.682 ms.
  - PR-11B adds profiled `SimWorld.stepProfiled()` phase timing and prints the slowest simulation phase in the scale report.
  - PR-11B local measurement on 2026-05-19: 10000 aggregate population with 503 viewport-visible units reported average simulation step 19.620 ms; the slowest phase was `updateVillages` at 11.138 ms.
  - PR-11C adds a per-tick village resident index, uses the spatial index for nearby unit lookup, and fixes chunk-boundary lookup coverage in `SpatialIndex`.
  - PR-11C local measurement on 2026-05-19: 10000 aggregate population with 503 viewport-visible units reported average simulation step 12.784 ms; `updateVillages` dropped to 5.660 ms.
  - PR-11D adds `updateUnits` sub-phase profiling and avoids nearby food lookup for units below the hunger threshold.
  - PR-11D final local verification on 2026-05-19: 10000 aggregate population with 498 viewport-visible units reported average simulation step 20.222 ms; the remaining slowest phase was `updateUnits` at 7.040 ms.
  - PR-11E spreads non-urgent home-village unit behavior over a 4-tick cadence while keeping homeless or hungry units responsive every tick, and reports behavior update counts in the scale harness.
  - PR-11F removes the duplicate full resident-index rebuild inside `updateVillages`; the tick already rebuilds the index after village formation and updates it incrementally for births and newly assigned residents.
  - PR-11E/F local measurement on 2026-05-19: 10000 aggregate population with 461 viewport-visible units reported average simulation step 12.301 ms; the slowest phase was `updateVillages` at 5.230 ms, with 2955 / 10000 unit behavior updates on the profiled tick.
  - PR-11 stability sign-off on 2026-05-19 widened the scale viewport to 560 visible tiles and 656 visible units. Five consecutive 10000-population runs stayed below the 16.7 ms frame budget with average simulation steps of 11.821 ms, 12.684 ms, 12.924 ms, 13.646 ms, and 12.032 ms.
- Deferred until metrics justify:
  - Worker simulation is not implemented yet.
  - Hot-data layout is still plain object/map storage.
  - Render pooling beyond reused graphics layers is not implemented yet.
  - The remaining 10000-population hotspot is consistently `updateVillages`; deeper scale work should target less frequent village economy/presence passes, resource indexing, worker simulation, or hot-data layout only when the next target needs it.

## PR-12+: WorldBox Flavor

Status: `Foundation slice`

- Add WorldBox-style readability and civilization depth after the core loop is stable. The next phase should preserve the god-sim shape: the player creates conditions and intervenes, while villages and kingdoms build, expand, fight, and collapse mostly on their own.
- Order matters: first make the existing simulation understandable, then add deeper building and society systems.

### PR-12A: Inspection and Event Story

Status: `Done`

- Add selection/inspection for villages, kingdoms, buildings, armies, and recent events.
- Acceptance: a player can click or select a visible world entity and understand what it is, who owns it, why it matters, and what recently happened around it.
- Planned:
  - Village panel: name placeholder, race, population, food, housing, status, kingdom, buildings, territory size, recent local events.
  - Kingdom panel: capital, member villages, population, food, buildings, active territory, diplomacy pressure, war target, army count.
  - Army panel: owner kingdom, target kingdom, origin village, target village, soldiers, morale, status.
  - Event log filters by global, village, kingdom, war, diplomacy, and command events.
  - Selected entity highlight and map labels for village/kingdom names.
- Implemented:
  - Plain left click now selects visible armies, buildings, village centers/territory, units, or tiles.
  - `Ctrl + left click` places food, while `Shift + left click` still spawns units and `Alt + left click` still strikes lightning.
  - The right HUD panel shows selected village, building, army, unit, or tile inspection details.
  - Recent events are filtered to the selected story context, including village-owned buildings, kingdom war pressure, and selected armies.
  - The map draws a highlight around the selected entity or tile.
  - `K` cycles direct kingdom selection and the status panel lists the leading active kingdoms.
  - Village and kingdom labels render over the map near settlement centers and capitals.
- Deferred:
  - Full searchable or typed event log.
  - Clickable UI list rows for direct panel selection.
- Non-goals:
  - No new economy resource chain yet.
  - No deep citizen jobs yet.

### PR-12B: Building Chain Expansion

Status: `Foundation slice`

- Expand the current hut/storage/farm foundation into a clearer civilization building chain.
- Acceptance: villages visibly progress from camp to settlement to town through buildings with gameplay effects, not decorative markers.
- Planned:
  - Expose building type, tier, status, and owner in projection/inspection.
- Implemented:
  - Villages now create a visible `town_hall` at the settlement center when founded.
  - The former `hut` building path now creates `house` buildings with `tier: 1`.
  - `town_hall` now gates further upgrades, so higher house tiers only unlock after the anchor reaches the next tier.
  - House buildings can upgrade to tiers 2 and 3 while preserving the old housing-capacity gameplay effect.
  - Villages can now build one visible `mine` when a nearby hill, stone deposit, or iron deposit gives them a valid mine site.
  - Mine buildings are projected, inspectable, territory-claiming, and rendered in Phaser as the PR-12B hook for later stone/iron stores.
  - Villages can now build one visible `barrack` after the basic food and housing chain is in place.
  - Barracks increase the capital village's army mobilization ratio and soldier cap when a kingdom forms an army group.
  - Villages can now build one visible `dock` on a nearby walkable shore tile adjacent to water.
  - Dock buildings are projected, inspectable, territory-claiming, and rendered in Phaser as the PR-12B hook for later boats, trade, and colonization.
  - Building projection, replay serialization, inspection, and Phaser rendering now include the new building types and tier.
- Acceptance gaps:
  - `mine` does not gather stone or iron until PR-12C adds job-driven resource stores.
  - `dock` does not launch boats, trade, or colonization until later PRs.
- Non-goals:
  - No manual player building placement.
  - No boat simulation until the dock has a reason to exist in later PRs.

### PR-12C: Villager Jobs and Resource Economy

Status: `Foundation slice`

- Replace part of the current abstract village economy with simple job-driven gathering and construction.
- Acceptance: village growth depends on visible resource availability and assigned work, while staying cheap enough for the PR-11 scale target.
- Planned:
  - Buildings consume resources and optionally construction time.
  - Resource shortages slow construction, housing growth, and army formation.
- Implemented:
  - Villages and kingdoms now expose material stores for food, wood, stone, and iron in projection and inspection.
  - Town halls provide the first small resource capacity, while storage buildings expand food, wood, stone, and iron caps; builder and miner gathering stop when the relevant store is full, resources above remaining capacity are lost when storage stops being active, and prosperous villages now treat near-full material stores or town-hall upgrade capacity blockers as reasons to expand storage. The storage cap now scales with settlement size instead of stopping at a fixed six warehouses, with a current safety hard limit of 10.
  - Villages now auto-assign aggregate farmer, builder, miner, soldier, and laborer jobs and expose those counts in village inspection.
  - Villages start with a small farmer workforce so early settlements can survive before the first farm is built.
  - Camp villages use a lighter early food drain so 30-person bootstrap cases can survive long enough to reach the farm/build loop.
  - Farmer jobs drive baseline food gathering and are now required for stable windmill-field output; active farms project visible farmland tiles around a windmill-like center. Windmill output has been tuned down to a slower early surplus: farmers provide `0.1` food each per tick, maintained windmills provide `0.2` base food per tick, and projected field tiles add `0.012` food each per tick.
  - Unit hunger now rises more slowly, and the village food interval is a reserve-health check instead of a second direct inventory deduction; residents still eat from village stores when hungry.
  - Village projection and inspection now expose food reserve target, reserve surplus or deficit, active farms, maintained farms, and a compact food status so food pressure explains itself before deeper crops are added.
  - Builder jobs gather nearby wood deposits into village stores.
  - Wood deposits are now rendered as visible map markers, and stone/iron deposits are also rendered so material sources are visible on the map.
  - House, storage, farm, mine, barrack, dock, and house-upgrade construction are now material-driven instead of food-driven.
  - Housing capacity now grows through visible houses and house upgrades instead of hidden food-surplus growth.
  - Housing pressure now makes villages choose another house before optional mine, barrack, or dock work after the basic survival chain is present.
  - Residents can now draw food from village stores as a fallback when nearby tile food runs out.
  - Food is reserved for feeding people and prosperity gates instead of being consumed by ordinary building construction.
  - Mine construction now enters the normal chain after the first farm, and villages can open a small early stone quarry when no natural hill or ore deposit is close enough.
  - Miner jobs gather nearby stone or iron deposits from active mines into village stores.
  - Mine-site selection now prefers actual stone or iron deposits before falling back to generic hill tiles.
  - Soldier jobs now also feed army mobilization and battle strength, so barracks and trained soldiers affect war output together.
- Acceptance gaps:
  - Building, food, and army balance numbers are still first-pass values and still need tuning.
  - Soldier jobs are assigned and inspectable, but detailed soldier mustering, promotion, and per-fighter combat remain later depth.
- Non-goals:
  - No per-citizen deep inventory.
  - No full logistics pathfinding between every worker and resource.

### PR-12D: City Growth Feedback

Status: `Done`

- Make village growth readable on the map and in the HUD.
- Acceptance: a player can tell at a glance which settlements are camps, growing towns, capitals, declining towns, or ruins.
- Implemented:
  - Villages now generate race-themed names when founded.
  - Map labels now show village name, level, and a capital marker for the founding capital.
  - Village inspection now shows name, level, growth state, and whether the village is the capital.
  - Village level-up events now enter the recent event stream with readable growth summaries.
  - Kingdom inspection now shows the capital village by name and level when it still exists.
  - Territory rendering now uses a clearer outer boundary outline and selected village/kingdom highlighting.
  - Mature pressured kingdom villages can now spend food and wood to found satellite villages on separate food-rich walkable land, transferring residents into the new village and keeping it in the parent kingdom.
  - Abandoned settlement buildings now keep a visible abandoned phase, then decay into ruins with a readable map marker and recent event entry.

- Planned:
  - More visible borders and selected territory highlight.
  - Building upgrade events and settlement growth events.
  - Further ruin readability for collapsed settlements, including richer ruin inspection and recovery hooks.

### PR-12D.5: WorldBox Growth Alignment

Status: `Foundation slice`

- Before PR-12E, make the small-people development loop feel closer to WorldBox: villagers should appear to gather, build, settle, and expand before the player is asked to reason about kingdom-level diplomacy tools.
- Acceptance: a player watching one settlement for several minutes can tell why it is or is not growing, see wood/home/territory pressure, and observe the village spreading without direct management.
- Implemented:
  - Builder wood gathering now remains available as readable work-site projection data, renders a short-lived work pulse, and nearby wood deposits deplete as stores fill without creating temporary territory islands.
  - Construction starts and builder progress now project short-lived construction work sites.
  - Villages now expose `growthBlockers` in projection and inspection for housing pressure, missing wood, exhausted nearby wood, insufficient builders, low food reserve, and no buildable land.
  - Housing pressure now triggers at roughly 75% housing use and can prioritize another house before optional farm, mine, barrack, or dock work once the first house/storage chain exists.
  - Territory projection now includes settlement pressure from village centers and active buildings, while work sites stay as activity pulses instead of formal claims.
  - Phaser renders construction, wood-gathering, and farm-tending work-site pulses, while resource depletion and inventory changes remain the durable evidence of work.
- Remaining scope:
  - Keep deep roads/paths, per-citizen worker trips, and richer stall events for later growth-depth passes.
  - Keep the player in a god role: no manual job assignment, no manual house placement, and no direct unit control.
- Non-goals:
  - No full per-citizen pathfinding or inventory in this pass.
  - No family/culture/rebellion in this pass; the first loyalty projection arrives later in PR-12G.
  - No PR-12E god diplomacy commands until this growth loop is readable.

### PR-12E: Kingdom Readability and God Interventions

Status: `Foundation slice`

- Make kingdom-level conflict and diplomacy understandable and lightly steerable.
- Acceptance: wars and diplomatic pressure have visible causes, visible participants, and a small set of god commands that can push the world without direct unit control.
- Implemented:
  - HUD now shows compact kingdom status lines with population, village count, diplomacy pressure, and pressure target.
  - HUD now shows conflict summaries for active armies, including attacker, defender, soldier count, target village, and army status.
  - Kingdom inspection now lists member villages and active campaigns.
  - Army routes now render from active armies to target villages so wars have a visible direction.
  - Diplomacy and war events now have readable summaries for border friction, resource pressure, rising diplomacy, declarations, army formation, battles, and captures.
  - Army groups now enter a multi-tick fighting/occupation state at the target village; occupation progress, periodic casualties, capture, and retreat are projected to inspection and HUD summaries.
  - Village capture now keeps active buildings with the captured village but applies a 50% resource plunder loss before the village joins the attacker.
  - Declared wars now remember attacker/target direction and can form a later army after the previous army disbands, with a 360-tick natural re-formation cooldown to avoid immediate wave spam.
  - Wars can now field up to three active army groups from eligible villages in the attacking kingdom, each targeting the nearest valid enemy village instead of only using the capital-to-capital route.
  - Fighting armies now project local attacker and defender battle dots, rendered only at local zoom, to make clashes readable without switching to per-soldier simulation.
  - God commands can now force war or force peace between active kingdoms; forced peace disbands pair armies and applies a 720-tick truce before natural pressure can re-escalate.
- Direction:
  - Move war toward the WorldBox shape: villages maintain visible armies, soldiers follow a grouped army/captain marker toward enemy villages, defenders resist locally, and capture happens through a readable occupation process instead of instant ownership transfer.
  - Keep the first implementation aggregate for performance, but expose enough state for the map to show marching, fighting, occupation progress, casualties, capture, and retreat.
- Planned:
  - Add stronger local defender/militia response and richer near-zoom soldier motion around grouped army markers.
  - God commands for inspiring growth and marking a village/kingdom for attention.
  - Basic rebellion or resistance hooks after capture, if metrics remain healthy.
- Non-goals:
  - No full culture/religion/family simulation in the first PR-12 pass.
  - No larger-than-256 demo target increase unless `measure:scale` says the current bottleneck is understood.

### PR-12E.1: Continuous Town Growth

Status: `Foundation slice`

- Fix the mid-game village stall where a stable rich town can reach around 30 residents, 48 housing, full food, high wood, and no growth blockers, then stop building because housing pressure is not high enough and the fixed building chain is exhausted.
- Acceptance: a player watching a rich stable town for several minutes should see continued construction pressure, or at least a clear build plan explaining what the town is waiting for.
- Implemented:
  - Add a projected village build plan such as expanding houses, farms, storage, preparing expansion, waiting for population pressure, waiting for land, or waiting for resources.
  - Add prosperity construction pressure so rich stable villages can keep turning surplus wood/food into more houses, farms, and storage even when housing is not yet nearly full.
  - Village inspection now shows the current build plan, so `growthBlockers: none` no longer hides why a town is or is not building.
  - Regression coverage now locks the observed stall shape: around 30 residents, 48 housing, full food, large wood stockpile, existing core buildings, and no dock path still produces an `expand_housing` plan and starts another building.
- Planned:
  - Keep growth autonomous and WorldBox-like: no manual building placement, no job micromanagement, and no RTS queue UI.
  - Keep deeper roads, markets, wells, decoration, and culture-specific buildings as later city-depth work unless the simple repeatable chain still feels too sparse.

### PR-12E.2: Fullscreen Map Camera

Status: `Foundation slice`

- Make the demo feel closer to WorldBox's fullscreen sandbox map before adding more god tools.
- Acceptance: the browser viewport is filled by world terrain, the HUD stays a light overlay, the player can navigate with WorldBox-style keyboard camera controls, and wheel zoom keeps the pointed world location stable instead of zooming only around the center.
- Implemented:
  - The Phaser demo now creates a 256 x 256 world while preserving the 128 x 128 simulation default for unit tests and tooling.
  - The main camera uses a dynamic cover zoom derived from viewport size and world pixel size, so max zoom-out still keeps terrain behind the full screen instead of exposing camera background.
  - The minimum zoom now switches to a contain-style overview, so the player can zoom far enough out to see the whole generated world at once without leaving the camera on a black background.
  - The default HUD now stays compact enough that the map remains the first-screen surface; inspection grows only after the player selects something.
  - Mouse-wheel zoom preserves the world coordinate under the pointer, while Q/E and +/- provide keyboard zoom from the screen center.
  - WASD and arrow keys move the camera through the same center-based camera model as zoom and resize, and pan speed is measured as a fixed percentage of the currently visible viewport with a fast keyboard rate for wide map sweeps.
  - Mouse edge panning is intentionally disabled because it interferes with pointer placement near UI and map borders.
  - Ctrl + wheel changes simulation speed, matching the WorldBox control convention closely enough for the current prototype.
  - Regression coverage locks cover zoom, contain zoom, center-based clamping, pointer-anchored zoom, viewport-relative pan speed, and live center-derived viewport projection so zoom-out does not drift the map toward a corner or expose black camera background.
  - Terrain projection now uses a wider camera buffer, and heavy Phaser layers redraw on coarse viewport buckets instead of every tiny camera movement.
  - Static Phaser layers such as terrain, resources, territory, buildings, army routes, and map labels stay viewport-capped, so zoomed-out panning does not keep a full-map Graphics command list on screen every frame.
  - HUD layout and text refresh now use a state key plus a short throttle, so camera-only panning no longer rebuilds overlay panels every frame.
  - Camera zoom now drives stricter render detail levels: overview zoom keeps terrain, territory, capped map labels, and army context readable; regional zoom adds only map-level building signals; local zoom adds units, resources, farmland, and work-site details.
  - The Scene now caches the last projection for unchanged sim tick and tile-bounded viewport, so idle frames do not rebuild the same visible world. Terrain renders through lazily generated 32 x 32 tile render-texture chunks, territory fill uses fixed 32 x 32 tile render-texture chunks with per-chunk draw keys while borders stay in a separate Graphics layer, selected territory fill stays faint and outline-led, and dynamic local layers redraw only when their data key changes. Map labels and army routes are also detail-tiered: overview keeps up to 8 selected/capital/rebellion/unrest priority village labels and the most important routes, regional keeps up to 12 priority village labels and more routes, and local zoom keeps the full visible detail.
  - Dense local views now fall back to regional detail when one screen contains many villages, buildings, resource tiles, units, armies, or work sites, so rebellion/war screens stop drawing every unit dot, resource icon, field, work pulse, and local label at once.
- Deferred:
  - 512+ world presets, resource indexing, and incremental resource statistics remain later scale work.

### PR-12F: Civilization Spine Rework

Status: `Foundation slice`

- Reframe the next implementation wave around the WorldBox-like civilization spine: life seed -> camp -> hamlet -> village -> town -> frontier -> kingdom. This should happen before adding more flashy god powers, because the player first needs to believe the small people are developing on their own.
- Acceptance: watching one seeded settlement for several minutes should show a complete early story: people survive, found a camp, gather visible resources, build homes, expose why growth stalls, expand soft territory, and eventually prepare a satellite village or kingdom membership without manual player management.
- Start here:
  - `PR-12F.1` Build-plan truth model. Refactor the existing village plan/blocker path so every village has one readable current intention and one primary missing condition. This is the safest first step because it mostly reorganizes existing data (`buildPlan`, `growthBlockers`, jobs, inventories, buildings, and sites) before adding new systems.
  - Acceptance for `PR-12F.1`: a new camp, a wood-starved pressured village, a rich stable town, and a mature expansion-ready kingdom village each project a non-ambiguous plan; inspection can explain the next condition without relying on guesswork.
- Implemented:
  - Villages no longer treat "no wood in the immediate center radius" as a hard stop. Builder jobs can scout a wider reachable wood radius, gather from that frontier source, project a wood-gathering work site, and avoid reporting `no_wood_source` while reachable wood exists.
  - Villages now project a single `primaryGrowthBlocker` alongside the full `growthBlockers` list, and village inspection shows that primary blocker so the next missing condition is readable.
  - Villages now project `growthPhase` (`camp`, `hamlet`, `village`, `town`, or `frontier`) and `primaryIntention`, and village inspection shows both so the early settlement story is readable as a stage plus a next action.
  - Growth phase transitions now emit recent events translated into readable settlement news, so `camp -> hamlet` is visible without opening raw simulation data.
  - `observe:growth` now runs deterministic early-settlement reports for phase, intention, primary blocker, population, housing, stores, buildings, land territory, first phase ticks, missing house/storage/farm chain pieces, and recent phase/building events; it is intentionally observational before future balance tuning.
  - `observe:growth` now includes food reserve, reserve balance, farm count, maintained farm count, final food balance, and farm coverage in the early-settlement report.
  - `observe:growth` also prints isolated windmill-support diagnostics; the current tuned result keeps a 12-person village stable for 240 ticks on one maintained windmill after ground food is removed, ending at `finalBalance=48`.
  - `observe:growth` also prints satellite-expansion diagnostics for first expansion status tick/plan, first `prepare_expansion` tick, first `拓荒 ·` label tick, first `扩张原因` / `边疆提示` inspection ticks, `expansionLead`, `labelLead`, `hintLead`, satellite-founded tick, parent population/housing/resource snapshots, and child population/housing after founding.
  - Farm-leg tuning keeps the first house construction visible at the old cadence, speeds up follow-up house/storage/farm bootstrap attempts, renders farms as windmill-centered farmland rings, and prevents the phase model from skipping directly from `hamlet` to `town` on level alone.
  - Regression coverage now locks camp-to-hamlet phase progression, the first housing-to-storage intention handoff, and rich-town continued building with a town phase.
  - Territory projection now includes faint `surface: water` soft control inside settlement influence, while village/kingdom/HUD territory totals still count only `surface: land`; this makes coast and lake realms visually continuous without making water walkable or buildable.
  - Territory projection now includes `source` (`settlement_core`, `building`, or `frontier`) and tile inspection translates it, so territory growth explains whether it came from stable settlement pressure, built structures, or expansion preparation; temporary work sites no longer create border islands.
  - Building site selection now scores candidate tiles by purpose instead of using a fixed ring: houses avoid resource deposits and nearby mineable resources, farms bias toward food-rich or water-adjacent arable land without occupying wood/stone/iron resource tiles, storage stays central, barracks bias outward, mines avoid the residential cluster when alternative ore/hill/quarry sites exist, and docks keep shore constraints.
  - Building placement now rejects occupied tiles for all non-town-hall buildings, including fallback placement, and prefers a small gap from nearby buildings so storage, farms, mines, barracks, docks, and houses cannot stack or crowd the same cluster.
  - `observe:building-sites` now prints deterministic multi-seed diagnostics for purpose-scored building placement, including building type, position, site resource type, center distance, nearest food, nearest stone or iron, nearest water, and nearest same-type building.
  - The interactive demo now generates a fresh world seed by default while preserving deterministic reproduction through `?seed=...`, and terrain phases now use the full seed so reloads no longer replay the same map/building layout unless the seed is explicitly fixed.
  - Default initial life now uses the seed to choose viable food-supported start areas anywhere on the map instead of always spawning around the map center; larger initial populations split into multiple distant clusters so the default sandbox can naturally produce multiple villages and kingdoms for rebellion testing.
  - Mature kingdom villages now expose expansion intent before the satellite village appears: `prepare_expansion` when a site and resources are ready, `waiting_land` when no suitable site exists, and `waiting_resources` / `waiting_population_pressure` when the parent has enough settlers but lacks reserves or housing pressure.
  - Satellite founding now requires a sustained 60 tick `prepare_expansion` window, and an already committed expedition is not canceled only because house upgrades temporarily lower the population-to-housing pressure ratio.
  - Expansion preparation now emits throttled `village_expansion_status` recent events when the parent village changes between ready, missing land, missing resources, or missing population pressure, and village inspection shows the same reason as `扩张原因` plus a short `边疆提示`; young member villages keep ordinary `等待人口增长` wording until they reach the frontier-parent threshold, while mature frontier candidates can show `等待扩张压力`.
  - Map labels now prefix active `prepare_expansion` villages with `拓荒 ·`, so the parent village visibly signals a pending satellite before settlers depart.
- Planned implementation slices:
  - `PR-12F.1` Build-plan truth model: continue centralizing plan selection around the primary blocker and align plan selection with phase transitions for blocked or declining settlements. Storage pressure is now part of that truth model: near-full material stores and insufficient upgrade capacity can project `expand_storage` with a clear storage blocker, and larger settlements can exceed the old fixed six-storage ceiling.
  - `PR-12F.2` Camp-to-hamlet readability: growth-phase labels are now in projection and inspection; next tune early house/storage/farm pressure and map feedback so the first 5 minutes read as settlement formation rather than instant kingdom setup.
  - `PR-12F.2a` Food rhythm follow-up: explicit village inspection lines for food reserve target, reserve surplus/deficit, and farmer coverage are in place; `observe:growth` now includes an isolated windmill-support report, and the first tuning pass makes one maintained windmill stabilize a 12-person village without rapid storage flooding. Next broaden the report to larger populations before adding wheat/bread resources.
  - `PR-12F.3` Staged territory influence: source-tagged projection and inspection are in place; next add richer visual legends or per-village summaries only if manual play shows the source labels are not enough.
  - `PR-12F.4` Expansion preparation: initial event, inspection reason, frontier hint, and map-label slice is implemented; next expand reasons only if manual play still makes the frontier story unclear.
  - `PR-12F.5` Early-game observation harness: the first single-settlement, multi-seed, satellite-expansion, building-site, and satellite-readability lead reports are implemented; next use those reports for manual frontier readability review, purpose-scored placement review, and broader expansion balance tuning.
- Non-goals:
  - No manual building placement, manual job assignment, or direct movement commands.
  - No full roads, trade, boats, culture, rulers, families, or rebellion in this pass.
  - No hard border collision yet; territory remains readable projection for now.

### PR-12G: Kingdom Loyalty and Rebellion Foundation

Status: `Foundation slice`

- Reintroduce internal pressure after PR-12F made external growth readable. The WorldBox-aligned goal is that a unified or overextended realm does not become static forever: large kingdoms should first expose why villages are loyal or unstable, then later prepare rebellion, split, and possibly enter civil war without direct player orders.
- Acceptance: selecting a capital and a far frontier member village should show different loyalty values and a readable internal reason before any rebellion behavior exists.
- Implemented:
  - Village projection now includes `loyalty` from 0-100 and `loyaltyReason`.
  - Capitals project 100 loyalty with `capital`.
  - Non-capital villages lose loyalty from distance to capital, kingdom overextension, food pressure, current diplomacy/war pressure, or being a stronger frontier town than the capital.
  - Village inspection shows `忠诚` and `内政原因`, so internal stability is visible alongside growth, expansion, and war pressure.
  - Loyalty can now fall below 0. Villages from 0 to below 50 loyalty project `low_loyalty`, map labels prefix them with `不稳 ·`, and inspection shows `不稳原因` plus `内政提示：忠诚偏低`.
  - Only eligible negative-loyalty villages project `prepare_rebellion`, map labels prefix them with `叛乱 ·`, and village inspection shows `叛乱原因`, `叛乱进度`, plus `内政提示：正在秘密组织独立`.
  - Rebellion progress accumulates while negative loyalty persists and rolls back when loyalty recovers; this creates a WorldBox-style intervention window before any split.
  - Completed rebellion progress now creates a rebel kingdom from the rebel village, pulls in nearby low-loyalty non-capital supporters, clears their preparation progress, emits `rebellion_succeeded`, refreshes parent/rebel kingdom membership, and starts a rebellion war through the existing `war_declared` / army-group path. A parent kingdom can complete only one split per tick, and supporters are capped so a single rebellion cannot take more than the upper half of the parent realm in one burst.
  - Larger default starts now seed multiple distant population clusters, giving loyalty and rebellion systems a natural multi-kingdom test ecology instead of forcing every run into one capital-centered realm.
- Planned implementation slices:
  - `PR-12G.1` Loyalty projection: expose village loyalty and reasons only; no kingdom split yet.
  - `PR-12G.2` Rebellion preparation readability: low-loyalty villages first enter a visible `low_loyalty` / `不稳 ·` warning state; only eligible negative-loyalty villages enter `prepare_rebellion` with `叛乱 ·` map label, inspection hint, and sustained progress; still no kingdom split.
  - `PR-12G.3` Split founding: sustained rebellion creates a new kingdom from the rebel village and nearby low-loyalty supporters, then starts a rebellion war through the existing army/capture path.
  - `PR-12G.4` Civil war readability and tuning: improve rebel-vs-parent event story, campaign summaries, supporter selection, post-split balance, and deterministic rebellion performance reports.
  - `PR-12G.5` Observation harness: add `observe:rebellion` so loyalty drop, preparation, split, and civil-war timing can be tuned from deterministic reports.
- Non-goals:
  - No rulers, culture, clans, religion, or full diplomacy overhaul in the first loyalty slice.
  - No immediate rebellion from a single low tick; future split behavior must have a readable preparation window.

### Later Flavor Backlog

Status: `Planned`

- Cultures, religions, families, rulers, traits, deeper rebellion politics, world laws, monsters, disasters, boats, colonization, trade, and larger maps remain after PR-12A-F establish observability and core civilization growth.

## Immediate Next Work

Current tracked sequence:

1. Done: add command validation and rejection events. Invalid commands now produce `command_rejected` and do not mutate world state.
2. Done: add source-level architecture scan proving `src/sim` has no Phaser imports or browser globals.
3. Done: add 1000-unit pure simulation foundation test.
4. Done: camera-driven projection culling now limits render-facing tiles, units, territory, buildings, and armies while preserving full projection as the default compatibility path.
5. Done: slow early reproduction pacing so spawn commands do not immediately create surprise births in basic command tests.
6. Done: PR-7 turns village surplus into housing, storage, farm, and settlement influence systems.
7. Done: PR-8 groups villages into kingdoms with capital, membership, and summary statistics.
8. Done: PR-9 uses border friction, resource pressure, and race modifiers to produce diplomacy pressure and declaration events.
9. Done: PR-10 turns declarations into minimal army groups, grouped battles, casualties, retreat/disband, and village capture.
10. Done: PR-11A scale measurement harness now reports 1000 / 3000 / 5000 / 10000 population scenarios with full and viewport projection timings.
11. Done: PR-11B step phase profiling shows the current 10000 population bottleneck is `updateVillages`, not projection.
12. Done: PR-11C reduces `updateVillages` full-population scans with a resident index and spatial-indexed nearby unit lookup.
13. Done: PR-11D exposes `updateUnits` sub-phase timing and gates nearby food lookup behind the hunger threshold.
14. Done: PR-11E/F lowers non-urgent home-village behavior frequency, exposes behavior update counts in the scale report, and removes a duplicate village resident-index rebuild.
15. Done: PR-11 stability sign-off confirms 10000 population with 656 viewport-visible units stays below the 16.7 ms simulation-step budget across five consecutive local runs.
16. Done: PR-12A inspection and event story supports click selection, right-panel details, selected highlights, context-filtered recent events, kingdom cycling/listing, and village/kingdom map labels.
17. Done: PR-12B building chain now creates town halls, tier-1 houses, tier-2/3 upgrade gates, mine-site-gated mines, army-boosting barracks, and shore-gated docks while preserving existing housing effects.
18. Done: kingdom capitals now stay stable while valid; replacement capitals are chosen after capital loss by town hall tier, active building count, population, then id.
19. Done: PR-12C villager jobs and material resource economy.
20. Done: PR-12D city growth feedback with names, levels, capital markers, borders, automatic satellite villages, upgrades, and ruins.
21. Done: PR-12D.5 WorldBox growth alignment foundation with readable work sites, growth blockers, earlier house pressure, and stable settlement/building territory expansion.
22. In progress: PR-12E kingdom readability now has kingdom/conflict HUD summaries, campaign inspection, army route lines, readable diplomacy/war event summaries, multi-village armies, local battle dots, and forced war/peace; growth blessing and attention markers are deferred behind the civilization spine unless needed for testing.
23. In progress: PR-12F.1 build-plan truth model. Villages can now scout farther reachable wood instead of freezing when immediate local wood is missing; projection exposes `primaryGrowthBlocker`, `primaryIntention`, and `growthPhase`; inspection distinguishes waiting for population growth, wood, food, building materials, storage pressure, insufficient storage capacity, or frontier supplies; mature kingdom villages expose `prepare_expansion` / `waiting_land` before satellite founding.
24. In progress: PR-12F.2 camp-to-hamlet readability. Explicit phase labels and phase-change recent events now appear in projection/inspection; farms now project windmill-centered farmland rings; windmill field output requires farmer maintenance; unit hunger is slower and village food reserve checks no longer double-charge inventory; village inspection now shows reserve target, surplus/deficit, farmer coverage, and compact food status; `observe:growth` now includes food reserve/farm coverage plus an isolated windmill-support report; multi-seed observation now reaches `village` inside the early window after the basic farm leg completes, while `town` waits for specialization or population-driven prosperity instead of level-only promotion.
25. In progress: PR-12F.3 staged territory influence. Projection now identifies settlement core, building, and frontier territory sources; work sites remain visible activity pulses without border claims; next manually inspect whether frontier rendering is readable enough before adding more UI.
26. In progress: PR-12F.4 expansion preparation. `village_expansion_status` events and village `扩张原因` inspection now surface ready, missing-land, missing-resource, and missing-population-pressure states only for mature frontier-parent candidates; next do manual readability tuning.
27. In progress: PR-12F.5 observation harness. `observe:growth` now reports deterministic early camp-to-hamlet progression across multiple seeds, phase timing, missing chain buildings, food reserve balance, farm coverage, isolated windmill support, recent growth/build events, satellite-expansion timing, `expansionLead`, `拓荒 ·` label timing, `扩张原因` / `边疆提示` timing, and label/hint lead ticks; `observe:building-sites` reports multi-seed house/storage/farm/mine/barrack placement distances for purpose-scored site tuning; next use the reports for manual frontier and building-placement readability review so future balance changes are judged by story quality, not only unit tests.
28. In progress: PR-12G.1/G.2/G.3 kingdom loyalty, rebellion preparation, and split founding. Villages inside kingdoms now expose loyalty and a primary internal reason in projection/inspection; low-loyalty villages first project `low_loyalty` / `不稳 ·`, eligible negative-loyalty villages project `prepare_rebellion` / `叛乱 ·`, and inspection explains the internal reason plus progress. Completed rebellion progress now splits the rebel village into a new kingdom, pulls nearby low-loyalty non-capital supporters, emits `rebellion_succeeded`, and starts a rebellion war through the existing `war_declared` / army-group path. Larger default starts now spread into distant clusters that can grow into multiple kingdoms, making rebellion tuning observable in normal play. The render path now caches unchanged projections, uses terrain chunk textures, caches territory fill in fixed render-texture chunks, keys dynamic redraws, and caps overview labels/routes so simultaneous rebellions do not force every village label, route, tile fill, and local marker to redraw at once. Next: PR-12G.4 civil-war readability and balance tuning.

Current unfinished follow-ups from the WorldBox-alignment pass:

- Same-kingdom settlement connection is not implemented yet. Nearby villages can show stable building/core/frontier territory, but there is no same-kingdom infill rule that actively tries to make adjacent member borders touch.
- Rebellion can now split a kingdom and start a parent-vs-rebel war, with same-parent same-tick completion throttled, but civil-war readability, deeper supporter selection tuning, post-split diplomacy memory, and deterministic `observe:rebellion` reports still need follow-up.
- Ruins no longer use a debug-style X marker, but the broader ruin lifecycle still lacks reclamation, decay variety, and historical labels.
- Work sites are readable pulses only. There is still no per-citizen worker pathing, road network, market/trade loop, or deep profession simulation.
- Frontier, building spacing, and early growth pacing still need manual readability review through normal play plus `observe:growth` / `observe:building-sites` before deeper balance changes.
