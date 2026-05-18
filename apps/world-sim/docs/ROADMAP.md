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

Status: `Foundation slice`

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
- Acceptance gaps:
  - Resource lookup is radius-bound, but resource deposits are not indexed separately yet.
  - Chunk index is present but not yet used by rendering culling.

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
- Acceptance gaps:
  - Projection currently returns all tiles and all units; no viewport culling yet.
  - Full projection is allowed only through the 128 x 128 foundation map target. Before moving beyond 128 x 128 or 1000 simulated units, add viewport/chunk projection culling or move that work into PR-11 with a measured reason.

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

- Add hut, storage, farm, and settlement influence territory.
- Acceptance: buildings affect survival or expansion and are not decorative.
- Implemented:
  - Villages spend food surplus on hut, storage, and farm buildings.
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
  - Kingdom population is derived from member villages' home population, so walking away from the settlement no longer changes kingdom population by itself.
  - Territory projection stamps `kingdomId` for kingdom-owned village territory while preserving `villageId`.
  - Kingdom status can become fallen when all member villages disappear.
  - HUD renders active kingdom count, fallen kingdom count, and largest active kingdom population.
- Acceptance gaps:
  - Kingdom names, rulers, banners, culture, claims, and inspection panels are not implemented yet.
  - Capital relocation is basic and based on surviving/larger member villages.
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

Status: `Planned`

- Add worker simulation, hot-data layout, projection culling, and render pooling where metrics justify it.
- Acceptance: 10000 aggregate population and 500 visible units remain stable.

## PR-12+: WorldBox Flavor

Status: `Planned`

- Add race behavior depth, logs, kingdom panels, trends, cultures, religions, families, rebellions, world laws, monsters, and disaster chains only after the core loop is stable.

## Immediate Next Work

After PR-8, move toward diplomacy pressure while keeping the foundation constraints visible:

1. Done: add command validation and rejection events. Invalid commands now produce `command_rejected` and do not mutate world state.
2. Done: add source-level architecture scan proving `src/sim` has no Phaser imports or browser globals.
3. Done: add 1000-unit pure simulation foundation test.
4. Active constraint: keep full projection only through the 128 x 128 foundation map target; add culling before larger maps or document a measured PR-11 deferral.
5. Done: slow early reproduction pacing so spawn commands do not immediately create surprise births in basic command tests.
6. Done: PR-7 turns village surplus into hut, storage, farm, and settlement influence systems.
7. Done: PR-8 groups villages into kingdoms with capital, membership, and summary statistics.
8. Done: PR-9 uses border friction, resource pressure, and race modifiers to produce diplomacy pressure and declaration events.
9. Done: PR-10 turns declarations into minimal army groups, grouped battles, casualties, retreat/disband, and village capture.
10. Next: start PR-11 by measuring the 128 x 128 full projection path and adding culling or a documented deferral before larger maps.
