# WorldSim v2 Architecture

## Ownership

`SimWorld` is the only simulation truth source. Phaser scenes, UI, HUDs, and future workers read snapshots or issue commands; they do not own units, tiles, resources, or civilizations.

## Layers

1. Simulation core
   - `SimWorld`, `SimLoop`, systems, seed RNG, command queue, event log.
   - Must not import Phaser or browser-only APIs.

2. Domain data
   - Tiles, chunks, resources, units, villages, buildings, kingdoms, future armies.
   - Stored as serializable plain data.

3. Command layer
   - All player and debug actions enter as `SimCommand`.
   - Commands can be accepted, rejected, delayed, or converted to events.

4. Projection layer
   - `WorldProjection` is a read-only view prepared for rendering and UI.
   - `SimWorld.project()` can accept a tile viewport for render-facing culling; no-argument projection remains the full snapshot path for tests, replay inspection, and tooling.
   - Viewport projection may cull tiles, units, territory, buildings, and army groups, but global HUD stats still describe the whole world.
   - Projection data is disposable and does not enter saves.

5. Phaser presentation
   - Renders projection, captures input, and displays HUD.
   - Does not mutate `SimWorld` directly.

## Tick Contract

The v2 fixed tick order is:

1. Drain queued commands.
2. Apply accepted command effects.
3. Refresh village formation candidates from homeless local population and local resources.
4. Update units and resource interactions.
5. Resolve births, deaths, village home ownership, village inventory, village pressure, building construction, farm production, territory influence, kingdom membership, kingdom summary, diplomacy pressure, army movement, grouped battle resolution, and emitted events.
6. Build projection on demand.

Future systems append only after documenting their position in this order.

## Determinism

- Simulation randomness uses seed-backed RNG.
- No simulation system may use `Math.random()`.
- Replays are based on seed, initial options, tick count, and command sequence.
- The Phaser demo may create a fresh seed at startup for player-facing variety, but that generated seed is passed into `SimWorld` before simulation begins; terrain phases, resources, unit starts, and later autonomous building sites all derive from the full seed. `?seed=...` keeps the same deterministic world across reloads.
- Events are part of the deterministic evidence trail.

## Performance Direction

The first implementation stays plain TypeScript for clarity. Scaling work must preserve the same boundaries:

- Spatial grid before all-neighbor scans.
- Chunk and projection culling before render-heavy features. PR-11 starts this by using chunk-indexed tile collection for camera viewport projection.
- Worker simulation before main-thread micro-optimizations.
- TypedArray hot paths only after the domain shape is stable.

## Red Lines

- No Phaser import inside `src/sim`.
- No scene-owned simulation truth.
- No direct unit movement commands from player UI.
- No full-map search in high-frequency unit behavior when an index can answer the query.
- No feature that bypasses command/event logging.
