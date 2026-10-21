# Expedition Runtime Performance P02

## Status

```text
TECHNICALLY COMPLETE
Human Runtime QA: PENDING
E03 Enemy: NOT STARTED
```

The production Medium Town Expedition was measured with native rendering at 1600x900, VSync off, 3 seconds warmup and 10 seconds capture. Seed 4101 was used for the full A/B/C/D and isolation matrix; seeds 4102 and 4103 were used for the additional three-survivor movement checks. Godot does not expose renderer frame time through the runtime API, so that field is explicitly recorded as unavailable rather than inferred.

## Root Cause

**PRIMARY:** a three-survivor move command synchronously calculated essentially the same route up to three times per member. Formation placement also ran a full AStar query for every candidate and rejected otherwise safe routes when they passed near an already reserved endpoint. A single command could therefore issue 53 path queries and spend about 1.6 seconds in path computation.

**SECONDARY:** command ribbons rebuilt dense 0.25 m ImmediateMesh segments and projected every vertex to the ground. Minimap dynamic marker layout and world marker scans also ran at uncapped render FPS, although their static Town layer was already cached correctly. Vision ran at about 12 Hz and custom survivor avoidance was not a bottleneck.

## Before / After

| Scenario | FPS before | FPS after | Avg ms before | Avg ms after | P95 ms before | P95 ms after | Max ms before | Max ms after |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| A Idle 3 | 285.63 | 337.89 | 3.501 | 2.960 | 4.329 | 3.942 | 10.639 | 12.077 |
| B Move 1 | 280.25 | 362.63 | 3.568 | 2.758 | 4.904 | 3.648 | 13.032 | 12.998 |
| C Move 3 | 288.78 | 345.88 | 3.463 | 2.891 | 4.321 | 3.820 | 10.592 | 11.782 |
| D Command Spam 3 | 76.29 | 270.67 | 13.108 | 3.695 | 9.101 | 9.018 | 791.735 | 45.883 |

For D, path queries fell from 271 to 105 and path compute time from 4753.671 ms to 402.748 ms. Frames over 33 ms fell from 26 to 8; frames over 100 ms fell from 13 to 0. Every captured command used exactly three path queries, one per survivor.

Additional seed results:

| Scenario | FPS avg | P95 ms | Max ms | Frames >33 ms |
| --- | ---: | ---: | ---: | ---: |
| Seed 4102, Move 3 | 309.46 | 5.611 | 14.621 | 0 |
| Seed 4103, Move 3 | 334.95 | 4.161 | 10.923 | 0 |

## Main Fixes

- Formation selection now returns the selected target and its prepared route. Mission passes that route to Survivor instead of performing preflight and order-time queries again.
- Formation keeps open-cell checks, 1.1 m endpoint separation and collision-checked paths, while removing the over-constrained route-near-endpoint rejection that caused candidate-query explosions.
- Runtime navigation uses a 0.75 m grid, reducing the seed-4101 cell count from 323,541 to 144,420. A 1.0 m experiment failed 280 entrance reachability checks and was rejected.
- Route simplification uses exponential probing plus bounded refinement, while every emitted segment still passes the exact inflated-polygon collision test.
- Path profiling uses constant-space counters and records AStar and simplification time separately.
- Command ribbons use 1 m segments, project two endpoints per segment, and refresh at 20 Hz.
- Medium Town Minimap dynamic markers and world markers refresh at 20 Hz. Static Minimap geometry remains seed-cached and had zero rebuilds during all 10-second captures. Vision remains enabled at about 12 Hz.

## Regression

```text
PASS
```

- Building entrance navigation: 2,230 checks, 0 failures.
- E01 navigation: 240 checks, 0 failures across four seeds; actual squad walks completed with minimum observed separation 0.625 m.
- E01.5 Minimap: 1,441 checks, 0 failures.
- E02 Search / Loot: 1,222 checks, 0 failures.
- Parallel commands: 36 checks, 0 failures.
- Runtime Loading Ready Gate: 121 checks, 0 failures.

The older `mission_flow.gd` still assumes the fixed 19-building/3-vehicle map and is not a valid Medium Town test. The five-visit `runtime_loading.gd` run did not complete within nine minutes and was stopped; the focused Ready Gate suite passed.

## Windows Build

The repository `run.ps1 -Mode build` gate passed the P02-related Search Gameplay, Phase 2, Survivor Command, Search Active Card, Settings and Camp Menu suites. It then stopped on the existing Camp UI test assumptions: `camp_ui_runtime.gd:114` still reads the removed `member_buttons` property and separately expects the retired left-edge active ability layout.

The same `Windows Desktop` export preset was then invoked directly. `build/BlueHourHomeward.exe` exported successfully at 1,726,968,104 bytes. The standalone EXE completed both a 120-frame Headless launch and a 120-frame native Windows launch with exit code 0.

## Evidence

- `test-output/expedition-runtime-performance-p02/profiler_before.png`
- `test-output/expedition-runtime-performance-p02/profiler_after.png`
- `test-output/expedition-runtime-performance-p02/before_3_survivor_moving.mp4`
- `test-output/expedition-runtime-performance-p02/after_3_survivor_moving.mp4`
- `test-output/expedition-runtime-performance-p02/after_command_spam.mp4`
- Raw scenario JSON and comparison tables are in the same directory.
- `build/BlueHourHomeward.exe`

The videos are visual runtime evidence and were recorded through Godot MovieWriter, which changes frame pacing. Performance conclusions come only from the uncapped native capture files. The before movement video documents the same formal Expedition visual path; the saved pre-change A/B/C/D capture is the performance baseline.

```text
Human Runtime QA: PENDING
E03 Enemy: NOT STARTED
```
