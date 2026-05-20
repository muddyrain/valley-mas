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
  - Default foundation demo map size is 128 x 128 tiles.
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
  - Villages spend food surplus on housing, storage, and farm buildings.
  - Huts increase housing capacity.
  - Storage increases village food capacity.
  - Farms produce village food after nearby deposits are exhausted.
  - Active building influence projects stable walkable territory tiles.
  - Buildings become abandoned remnants instead of disappearing when a village loses all population.
  - HUD renders building count, territory size, territory shading, and building markers.
- Acceptance gaps:
  - Buildings are auto-built from food surplus; no worker job, wood cost, construction time, or manual inspection panel yet.
  - Territory is projection influence only; it can feed diplomacy pressure but does not block movement or create hard borders yet.
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
  - Winning attackers can capture the target village and transfer it to the attacker's kingdom.
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

Status: `Planned`

- Replace part of the current abstract village economy with simple job-driven gathering and construction.
- Acceptance: village growth depends on visible resource availability and assigned work, while staying cheap enough for the PR-11 scale target.
- Planned:
  - Add lightweight jobs such as farmer, builder, miner, and soldier.
  - Buildings consume resources and optionally construction time.
  - Resource shortages slow construction, housing growth, and army formation.
- Implemented:
  - Villages and kingdoms now expose material stores for food, wood, stone, and iron in projection and inspection.
  - Active mines gather nearby stone or iron deposits into village stores without requiring individual miner jobs yet.
  - Mine-site selection now prefers actual stone or iron deposits before falling back to generic hill tiles.
- Acceptance gaps:
  - Farmer, builder, miner, and soldier job assignment is still pending.
  - Wood gathering and material-based building costs are still pending.
- Non-goals:
  - No per-citizen deep inventory.
  - No full logistics pathfinding between every worker and resource.

### PR-12D: City Growth Feedback

Status: `Planned`

- Make village growth readable on the map and in the HUD.
- Acceptance: a player can tell at a glance which settlements are camps, growing towns, capitals, declining towns, or ruins.
- Planned:
  - Village names and capital markers.
  - Village level derived from population, housing, town hall tier, and building count.
  - More visible borders and selected territory highlight.
  - Building upgrade events and settlement growth events.
  - Ruin/abandoned building readability for collapsed settlements.

### PR-12E: Kingdom Readability and God Interventions

Status: `Planned`

- Make kingdom-level conflict and diplomacy understandable and lightly steerable.
- Acceptance: wars and diplomatic pressure have visible causes, visible participants, and a small set of god commands that can push the world without direct unit control.
- Planned:
  - Kingdom list and relation summary.
  - War list with attacker, defender, target village, armies, and casualties.
  - God commands for forcing war, forcing peace, inspiring growth, and marking a village/kingdom for attention.
  - Basic rebellion or resistance hooks after capture, if metrics remain healthy.
- Non-goals:
  - No full culture/religion/family simulation in the first PR-12 pass.
  - No larger-map target increase unless `measure:scale` says the current bottleneck is understood.

### Later Flavor Backlog

Status: `Planned`

- Cultures, religions, families, rulers, traits, rebellions, world laws, monsters, disasters, boats, colonization, trade, and larger maps remain after PR-12A-E establish observability and core civilization growth.

## Immediate Next Work

After PR-8, move toward diplomacy pressure while keeping the foundation constraints visible:

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
19. Next: begin PR-12C villager jobs and material resource economy.
20. Planned: PR-12C villager jobs and resource economy with farmer, builder, miner, soldier, and village material stores.
21. Planned: PR-12D city growth feedback with names, levels, capital markers, borders, upgrades, and ruins.
22. Planned: PR-12E kingdom readability and god interventions for war, peace, growth, and attention marking.
