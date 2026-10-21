# Expedition Integration E01 — Navigation & Survivor Movement

Expedition Integration E01: **TECHNICALLY COMPLETE**.  
Human Runtime QA: **PENDING**.

E00 Human Runtime QA was explicitly approved by the user. E02 Search, E03 Enemy,
E04 HUD-Minimap and E05 Blue Hour-Extraction are NOT STARTED.

## Current-runtime audit

| Item | Observed implementation |
| --- | --- |
| Survivor Runtime | `missions/mission.gd::setup` creates `survivors/survivor.gd` from campaign roster templates, traits and equipment. |
| Navigation Backend | `City.grid` is Godot `AStarGrid2D`. No Expedition NavigationAgent3D or NavigationRegion3D. Camp has a separate navigation mesh, outside E01. |
| Click Command Entry | `SquadInput.handle` world physics raycast -> `Mission.command_move` -> `_move_members`; held input repeats every 0.08 seconds. |
| Path Query | `Survivor.order_move` calls `City.path`; `_move` integrates acceleration, braking and waypoint following. |
| Avoidance | Static collision projection, no RVO and no physical character movement. Formation destinations are assigned separately. |
| Fixed-map Coupling | Legacy `navigation_builder.gd` projects BoxShape3D into a 1 m grid with 0.72 m margin. Legacy nearest-open clamps / searches up to 15 cells. The arrival cutscene moves the bus in world X and resets survivor positions. |
| E00 Proxy Status | The colored actors are real Survivor instances with empty `model_path`, invoking `Visuals.body`; they are not QA pawns. E01 tests additionally use Xia Zhiyao and Su Wanxing imported models plus Lin via the same campaign factory. |

The survivor root is Node3D, with no capsule/collision. The existing procedural
body radius is 0.35 m and its top is 1.95 m (`vfx/visuals.gd`). Movement speed is
4.2 m/s for Xia Zhiyao / Lin and 4.0 m/s for Su Wanxing, before existing modifiers.
The new navigation clearance uses 0.45 m radius (body + 0.10 m), 1.95 m height,
0.20 m step filtering and a 0.5 m grid. Max slope / edge connection margin are
not applicable to this planar AStar backend; path/target distance is zero because
the existing integrator consumes exact waypoints. Dynamic avoidance stays off.

## Implementation boundary

`maps/expedition/town_navigation.gd` reads enabled runtime StaticBody3D shapes.
It includes buildings, vehicles, fences, benches, bins, signs, poles and tree
trunks. Bushes follow their supplied collision. Elevated canopy shapes and low
ground surfaces are filtered by body height; wires have no colliders. Oriented
shape projections are inflated for the body and rasterized conservatively so
diagonal edges cannot cut corners. Smoothing validates whole segments.

The adapter schedules navigation after Town creation. It records
`town_runtime_ready -> navigation_build_started -> navigation_ready -> survivor_commands_enabled`
and emits readiness. Invalid/unreachable targets return false and a
`command_rejected` reason, without overwriting the current order or playing a
success marker. Formation destinations reserve separate reachable locations.
The squad reuses the existing formation offsets, assigns nearby slots first,
and rejects endpoints that lie on another member's approach route. Along-path
speed control preserves following gaps and gives way at crossing approaches;
it never pushes a member off the validated route. This is limited to the current
squad and does not introduce crowd physics, RVO, zombie or vehicle avoidance.

Residential interior landmarks are selected inside the generated residential
block, with a 4 m inset. A geometric center inside a building or sealed yard is
not forced open: the adapter resolves a nearby reachable interior ground point.

The formal camera and click VFX are reused. The fixed-map bus cutscene is skipped
on the Town path because it would overwrite E00 spawn positions; its Town bridge
remains E05. Town movement does not advance deferred gameplay systems. Legacy
map generation, navigation and arrival retain their original implementation.

## Automated validation

`tests/expedition_navigation.gd`: **240 checks, 0 failures**. Seeds 4101–4104
each cover real roster construction, ready signal and lifecycle, deterministic
grid/path results, navigable Arrival spawns, POI / commercial / park / residential
interior paths, building / vehicle / fence / prop collision inclusion, and
out-of-bounds / nonfinite / blocked-command rejection. An independent checker
samples paths against the runtime collision shapes using a 0.35 m body margin;
it does not reuse the navigation segment validator. A separate sealed-fence
fixture verifies that valid interior ground can still be unreachable.

Seed 4101 also ticks the real Mission / Survivor integrator for all four routes
and walks back to Arrival between them. Every member reaches its assigned
endpoint without teleporting. Final destinations are at least 1.1 m apart.
Minimum moving-member separation over these runs was 0.963 m. Travel times:

| Route from Arrival | Seconds |
| --- | ---: |
| Residential interior | 54.97 |
| Commercial core | 42.25 |
| Park | 31.22 |
| Mission POI (after return from park) | 50.82 |

E00 bridge regression: **58 checks, 0 failures**. The legacy provider still
loads and returns paths through its unchanged navigation builder. The standard
build also passed Search Gameplay 72, HUD Phase2 258, Survivor Command 45,
Search Active Card 157 and Settings 14 before the Camp blocker below.

## Performance

Headless measurements from the final four-seed test; native fixed-frame-rate
recording is not used as performance evidence:

| Seed | Town generation + instantiation (ms) | Navigation grid build (ms) | Average query (ms) | Longest query (ms) |
| --- | ---: | ---: | ---: | ---: |
| 4101 | 1066.14 | 52.46 | 24.89 | 32.77 |
| 4102 | 1188.61 | 55.14 | 21.96 | 28.67 |
| 4103 | 1072.69 | 51.43 | 19.35 | 26.99 |
| 4104 | 1117.78 | 52.59 | 19.99 | 25.23 |

Each seed uses one AStar region, zero NavigationMeshes and 323,541 grid cells.
Seed 4101 projects 671 enabled static collision shapes. Per-grid memory is not
exposed by AStarGrid2D and is reported as NOT_AVAILABLE. Navigation grid build is
below one second; Town generation plus instantiation exceeds one second and must
be represented by the future loading flow. `runtime_data.navigation_ready_ms`
also measures grid construction plus landmark resolution up to readiness.

## Freeze and scope

633 files in the E01 protected baseline are unchanged. An independent comparison
against the historical M03 baseline also reports all 622 files unchanged.
Sources, wrappers, colliders, assets and previous M00–M03 evidence were not
modified. E00 Provider remains the formal entry; the updated E00 report records
the user's human PASS. Parallel Camp/UI, mission-selection/profile and character
asset work remains in the working tree and is not part of E01.

E01 files: `maps/expedition/town_navigation.gd`,
`maps/expedition/town_runtime_adapter.gd`, `missions/mission.gd`,
`tests/expedition_navigation.gd`, `tests/expedition_navigation_capture.gd`,
this report, the E00 status note and `docs/PLAN.md`. No Git commit was made.

## Windows build limitation

`run.ps1 -Mode build` was actually executed. The standard validation chain stops
at the existing Camp UI failures: `camp_ui_runtime.gd:114` reads the removed
`member_buttons` property, followed by `Camp exposes active abilities on its left
edge`. No Camp source or old test was changed to bypass that gate. Full Windows
build is FAILED; no refreshed standalone EXE is claimed for E01. Existing
Search Gameplay exit warnings about five ObjectDB instances remain separate
from the clean E01/E00 runtime logs.

## Evidence and human gate

Evidence lives in `test-output/expedition-integration-e01/`: `report.json`,
`navigation.log`, `e00-regression.log`, `native.log`, `capture-manifest.json`,
`frozen-verification.json` and `windows-build.log`. The QA overlay is created
only by the capture script, never by ordinary game startup.

The native capture uses the formal application and campaign roster with Xia
Zhiyao / Su Wanxing imported models and Lin's existing procedural appearance.
The latter is a real Survivor, not a QA proxy. Camera panning exposes the target
for a real InputEventMouseButton / world raycast, then the normal center-squad
command restores following. Actor transforms are never teleported. Eight named
screenshots and `arrival_to_mission_poi.mp4` document the entire journey.

Final native validation: **10 checks, 0 failures**. The final video is 1,544
frames at 30 fps, 1600×900, 51.467 seconds. `ffprobe` verified those dimensions
and duration. Final spawn, fence approach and POI formation images were visually
inspected; human quality approval remains pending. The footage is deterministic
native frame capture, not live user input or a performance benchmark.

Final `navigation.log`, `native.log` and `e00-regression.log` contain no script
or resource errors: Runtime Error = 0, Missing Resource = 0, Invalid UID = 0.
Those counts apply to E00/E01 validation only, not the failed full-build log.
Targeted encoding checks and `git diff --check` passed.

Stop for **Human Runtime QA: PENDING**. E02 Search, E03 Enemy, E04 HUD-Minimap and
E05 Blue Hour-Extraction remain **NOT STARTED**. No automatic next-stage work.
