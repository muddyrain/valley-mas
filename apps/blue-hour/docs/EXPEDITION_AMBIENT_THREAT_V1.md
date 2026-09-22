# Expedition Ambient Threat V1

## Scope

Ambient infection pressure is added for the current Medium Town Expedition runtime. The implementation is an adapter around the existing `Enemy`, `NoiseSystem`, navigation and mission spawn APIs. It does not add a second combat, search, loot or mission system.

## Implemented

- Day 1 Medium Town seeds a random population of 8–12 basic infected.
- Spawn candidates are rejected when they are within 25 m of the mission arrival point or any living survivor.
- Spawn points must be clear, separated from other infected by at least 1.2 m, and reachable from the squad.
- Existing enemy states remain authoritative. `state_name()` exposes the requested runtime vocabulary:
  - `IDLE`
  - `WANDER`
  - `INVESTIGATE_NOISE` (existing `INVESTIGATE` enum state)
  - `CHASE`
- Search noise is emitted once per active search second:

| Target | Noise radius |
| --- | ---: |
| Residential / ordinary building | 5 m |
| Searchable vehicle | 8 m |
| Large / warehouse / industrial target | 12 m |

- Search completion emits one event at 1.5× the target radius with intensity 1.15.
- Existing `Enemy.hear_noise()` drives investigation; no alternate AI loop was introduced.
- Survivor cards reuse the existing danger background and status dot. A survivor within 12 m of an active infected is shown as `警戒`; no new HUD element was added.

## Files changed

- `encounter/ambient_threat_runtime.gd` — Medium Town adapter, safe population seeding, noise emission, enemy ticking and performance counters.
- `encounter/noise_event.gd` — Appended `SEARCH` and `SEARCH_COMPLETE` event types without changing existing enum values.
- `enemies/enemy.gd` — State label mapping and typed damage tag compatibility fix.
- `ui/mission_hud.gd` — Creates the adapter once when the Expedition HUD is initialized.
- `ui/expedition/squad_card.gd` — Reuses the existing card danger presentation for nearby infected.
- `tests/ambient_threat_runtime.gd` — Integration fixture, runtime assertions and optional captures.
- `data/world_asset_catalog.gd` — Restored a missing comma in the shared asset registry so the current worktree can parse its newly added asset entries.

`SearchTask`, `Mission`, `Loot` and `Command` gameplay logic were not changed. The adapter reads their existing task and signal interfaces.

## Verification

Ambient fixture result:

```text
AMBIENT THREAT V1: 56 checks, 0 failures, 0.231 ms/update
population: 11
search_noise_events: 4
search_complete_events: 1
```

The fixture verified:

- Day 1 population is in the 8–12 range.
- Every initial infected is at least 25 m from survivors and carries the ambient origin marker.
- Large-target search emits radius 12 noise once per second.
- An infected listener enters `INVESTIGATE_NOISE` and moves toward the source.
- Completion emits one radius 18 high-noise event for a radius 12 target.
- Nearby infected reuse the survivor card's `警戒` danger state.
- Average adapter update time stays below the 8 ms budget.

Regression fixtures also passed:

```text
ENCOUNTER AI: 609 checks, 0 failures
ENCOUNTER NOISE: 13 checks, 0 failures
ENCOUNTER POPULATION: 1859 checks, 0 failures
SEARCH GAMEPLAY: 67 checks, 0 failures
SEARCH INTERACTION POLISH ACCEPTANCE: 15 checks, 0 failures
SURVIVOR COMMAND: 43 checks, 0 failures
```

## Captures

- [Initial infected population](../test-output/ambient-threat-v1/01_expedition_infected_population.png)
- [Search noise investigation](../test-output/ambient-threat-v1/02_search_noise_investigation.png)
- [Search completion high noise and danger feedback](../test-output/ambient-threat-v1/03_search_complete_high_noise.png)
- [Runtime metrics](../test-output/ambient-threat-v1/runtime.json)

## Deliberately not included

- No attack, damage, weapon or combat progression work.
- No new HUD panel or notification system.
- No changes to map generation, navigation generation, vehicle placement, SearchTask lifecycle, Mission rules, Loot resolution or Command routing.
- No advanced hearing falloff, threat director, spawn respawn policy or formation tactics; these remain follow-up work.
