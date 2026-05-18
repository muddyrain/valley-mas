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

Status: `Planned`

- Add camps, village inventory, housing capacity, food consumption, growth and decline.
- Acceptance: villages emerge from local population and resources.
- Entry criteria:
  - Close PR-1 through PR-5 acceptance gaps that affect village modeling.
  - Add a 1000-unit pure simulation check or consciously lower the first village scale target.

## PR-7: Buildings and Territory

Status: `Planned`

- Add hut, storage, farm, and settlement influence territory.
- Acceptance: buildings affect survival or expansion and are not decorative.

## PR-8: Kingdoms

Status: `Planned`

- Add kingdom, capital, multi-village membership, and summary statistics.
- Acceptance: kingdoms are derived from village and population state.

## PR-9: Diplomacy Pressure

Status: `Planned`

- Add relationship pressure, border friction, resource pressure, race modifiers, and declaration events.
- Acceptance: wars have observable causes.

## PR-10: Minimal War

Status: `Planned`

- Add army groups, rallying, marching, battle resolution, casualties, retreat, and village capture.
- Acceptance: wars can start, progress, and end without simulating every distant fighter as a full AI unit.

## PR-11: Scale Gate

Status: `Planned`

- Add worker simulation, hot-data layout, projection culling, and render pooling where metrics justify it.
- Acceptance: 10000 aggregate population and 500 visible units remain stable.

## PR-12+: WorldBox Flavor

Status: `Planned`

- Add race behavior depth, logs, kingdom panels, trends, cultures, religions, families, rebellions, world laws, monsters, and disaster chains only after the core loop is stable.

## Immediate Next Work

Before starting PR-6, tighten the foundation:

1. Done: add command validation and rejection events. Invalid commands now produce `command_rejected` and do not mutate world state.
2. Done: add source-level architecture scan proving `src/sim` has no Phaser imports or browser globals.
3. Done: add 1000-unit pure simulation foundation test.
4. Active constraint: keep full projection only through the 128 x 128 foundation map target; add culling before larger maps or document a measured PR-11 deferral.
5. Done: slow early reproduction pacing so spawn commands do not immediately create surprise births in basic command tests.
