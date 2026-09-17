# Medium Town V1 Blueprint Alignment

Date: 2026-09-17. Scope: `PROFILE_A_MAIN_STREET`, through `scenes/debug/medium_town_runtime_test.tscn`.

```text
Medium Town V1 Blueprint Alignment:
STRUCTURE ACCEPTED

STRUCTURE QA: PASS

Town Skeleton / Land Use / Route Structure:
FROZEN FOR ENVIRONMENT PASS

Environment Visual Completion:
PENDING
```

The user confirmed acceptance of the current structure and authorized this documentation-only closure. This closes the question of how the town grows for the current stage; it does not mean Medium Town V1 or its visual environment is complete. Acceptance applies to the independent Town test scene. The full Windows build remains blocked by an existing Expedition HUD test failure; no updated executable is claimed.

## Frozen Scope

The accepted Medium Town V1 structural baseline includes:

- Seed / Grammar and Road Graph.
- Land Use Assignment: COMMERCIAL_CORE, RESIDENTIAL_A, RESIDENTIAL_B, MIXED_TRANSITION, INDUSTRIAL_SERVICE and OPEN_SPACE.
- Arrival Candidates, Mission POI and Multi-route Exploration.
- Street Frontage, Parcel, Building Facing and Building Pool.

Subsequent Environment, Props, Vehicle and Vegetation passes must preserve these systems by default. Any required Road Graph, Land Use or Parcel structural change must be proposed separately and receive human confirmation before implementation. Environment filling does not authorize incidental skeleton restructuring, A.3/A.4 adjustments or OFFSET_GRID/LOOP expansion.

## Spatial Rules

The existing Seed, Road Graph, Parcel, Frontage, facing correction and Building Pool remain the generation foundation. `town_land_use.gd` assigns land use after the graph exists and before frontage population. Commercial frontage is concentrated in two central blocks, on opposite sides of a limited section of the main street. Residential A occupies the connected northern branches in canonical coordinates; Residential B uses the separate bent branch, wider house gaps and a shallower building depth limit. Mixed frontage connects the core to the industrial/service branch. A park behind the commercial core and a community green between housing and the service area have explicit polygons and crossing ground paths.

One short ParkLink connects the existing northern residential branches. It serves the park and provides a third actual route alongside the direct main street and the outer residential connection. Routes are enumerated on the existing road graph, split at arrival and POI frontage, with no repeated nodes. They may share road segments. They are not three entirely independent roads.

Every block has a primary `land_use_type`. Arrival and mission locations additionally use `ARRIVAL_ZONE` and `MISSION_POI_ZONE` in `zone_tags`, preserving the underlying residential or service use when the selected mission location changes. Four drivable edge candidates feed seeded arrival selection; the POI is the farthest eligible searchable building outside the commercial core by road distance. Rescue retains its residential target restriction.

Seed varies branch coordinates, frontage fit, building selection, arrival, POI and one of four orthogonal town orientations. Rotation applies to roads, block polygons, parcels, building transforms, entrance anchors, ground spaces and routes together. These are bounded grammar variations, not a fixed copy of the reference or arbitrary topology generation.

Ground outside the explicit blocks, within the developed envelope, is partitioned into owned backyards, rear access, parking, service/loading yards and green buffers. The coverage audit subtracts the actual road/sidewalk polygons, block polygons and assigned ground polygons. Parking uses ground markings only. Land-use structure is accepted; the remaining buffers still need visual meaning during the environment pass.

## Seed 4101

The following measurements are preserved evidence of this representative seed. The 16 blocks, 55 buildings, four arrival candidates and three routes are baseline observations, not future hard quantity locks; the existing grammar and acceptance rules remain in force.

| Measurement | Result |
| --- | --- |
| Town bounds | X -155..155 m; Z -130..130 m; 310 x 260 m after a quarter turn |
| Actual developed envelope | X -129.8201..93.2789 m; Z -124..124 m; 223.099 x 248 m |
| Blocks / parcels / buildings | 16 / 55 / 55 |
| Commercial core | 2 blocks, 17 buildings, consecutive main-street frontage on both sides |
| Residential A / B | 4 blocks / 4 blocks |
| Mixed / industrial-service / open space | 1 / 3 / 2 blocks |
| Arrival / mission zone roles | 1 / 1, layered onto primary land use |
| Commercial frontage occupancy | 68.717% |
| Residential frontage occupancy | 60.528% |
| Building coverage: core / housing A / housing B | 25.002% / 19.694% / 15.452% |
| Building coverage: mixed / industrial-service | 14.158% / 16.559% |
| Explicit open-space block area | 4,654.261 square meters |
| Supporting ground area | 23,319.739 square meters |
| Supporting ground uses | Backyard 5,401.713; community green 486.865; green buffer 13,662.503; loading yard 1,978.101; parking 926.961; rear access 863.596 square meters |
| Undefined core blocks | 0 |
| Undefined envelope ground | 0.000122 square meters, polygon-clipping numerical residual |
| Selected arrival | `Arrival_MainEnd`, (0, 0, 116), southern edge |
| Mission POI | `A13_P54`, `BLD_002_house_small_a`, (-109.5106, 0, -49.75108), opposite housing edge |
| POI road distance plus entrance approach | 331.453 m |
| Exploration route count | 3 |
| Route A / B / C road lengths | 325.412 / 443.490 / 565.353 m |
| Generate / scene build CPU time | 348.848 / 34.194 ms |

Commercial occupancy measures facade width plus the rendered 0.55 m entrance apron on each side, divided by usable assigned frontage. Residential occupancy measures facade width against its assigned frontage. These measures exclude unoccupied frontage. Building coverage is actual building footprint area divided by primary block polygon area; supporting ground is reported separately. The building total is a result of the current frontage rows and fitting assets, not an acceptance assertion or a target of 49/55 buildings.

Route A crosses the core and housing directly; Route B passes the park frontage; Route C follows the outer residential connection. For this seed the routes cross commercial core, Residential A and Residential B, with open-space frontage on B/C. The mission is across town from the selected bus, not necessarily in the industrial zone.

All arrival candidates are connected and bus-drivable:

| Candidate | World position |
| --- | --- |
| `Arrival_MainStart` | (0, 0, -116) |
| `Arrival_MainEnd` | (0, 0, 116), selected |
| `Arrival_ResidentialEdge` | (-118.8201, 0, -39.05937) |
| `Arrival_ServiceEdge` | (-127.2828, 0, 39.13991) |

## Five Native PNGs

All images are native Godot Compatibility renders at 1920 x 1080 from the same generated town. Only Planning enables overlays. Runtime cameras use the formal Expedition orthographic size 25 and offset (34, 42, 43). The mixed/service view focuses between actual buildings on opposite sides of the transition street.

1. [Clean High Overview](../test-output/medium-town-blueprint/PROFILE_A_MAIN_STREET_4101_overview.png)
2. [Planning Overview](../test-output/medium-town-blueprint/PROFILE_A_MAIN_STREET_4101_planning.png)
3. [Commercial Core Runtime](../test-output/medium-town-blueprint/PROFILE_A_MAIN_STREET_4101_commercial_core.png)
4. [Residential Runtime](../test-output/medium-town-blueprint/PROFILE_A_MAIN_STREET_4101_residential.png)
5. [Mixed / Industrial Runtime](../test-output/medium-town-blueprint/PROFILE_A_MAIN_STREET_4101_mixed_industrial.png)

Planning colors identify the six primary land uses; arrival candidates, selected arrival, POI and all three paths are separate layers. The `--town-inspect` argument retains the scene after capture and exposes four independent checkboxes for zones, routes, arrivals and POI. The capture harness verifies each checkbox signal changes its layer off and back on. Clean screenshots hide the layer and controls.

## Preserved Evidence

The five PNGs above and the following original QA files are the frozen comparison baseline for Environment & Street Life Pass:

- [validation.json](../test-output/medium-town-blueprint/validation.json)
- [generated-town.txt](../test-output/medium-town-blueprint/generated-town.txt)
- [capture-report.json](../test-output/medium-town-blueprint/capture-report.json)

Keep these files at their current paths without deletion, replacement or regeneration. Subsequent captures and QA runs must write to a separate output location. The original capture report and generated town retain their historical status fields; the acceptance decision is recorded here and in PLAN.md, without rewriting evidence.

## Verification

- Godot 4.7.2 Import: PASS.
- MAIN_STREET generation: 30 cases, 29 distinct seeds (4101, 4102, 4103, 17, 91, 1209 and 0..23; 17 repeats).
- Geometry and Blueprint assertions: 144,029 checks, zero failures. Checks cover explicit land use, all six primary zones, four legal arrival candidates, three distinct routes without backtracking or block shortcuts, multiple route land uses, road connectivity, POI reachability, frontage occupancy and core coverage above every other zone.
- Existing geometry checks remain active: actual block polygons are disjoint and clear of roads; parcels are contained; real instantiated meshes fit footprints; visible facades face their streets; building overlaps and building-road intersections are zero.
- Seed determinism: PASS. The sample covers all four orientations. POI road distance ranges from approximately 327 to 467 m. Commercial occupancy ranges from 68.7% to 75.4%; residential occupancy from 57.6% to 60.5%.
- Native scene: PASS; five nonblank images, overview town bounds inside the viewport, four overlay toggle checks passed, zero script/runtime errors in the capture log.
- Project Smoke: PASS, isolated test save.
- Windows build: executed and BLOCKED at existing `tests/expedition_hud_phase2.gd:132`, `Rally is the only roster action during a search` (260 checks, one failure). The failure also predates this phase in the A.2 report. No updated EXE was produced or independently launched.

Evidence is under `test-output/medium-town-blueprint/`: `validation.json`, `validation.log`, `generated-town.txt`, `capture-report.json`, `native-capture.log`, `import.log`, `smoke.log` and `windows-build.log`. CPU timings exclude preload, engine startup, rendering and PNG encoding, and are not a frame-rate benchmark.

The commands below record the original validation. They are not closure steps: the default generation/capture outputs would overwrite frozen evidence, so future runs must first use separate output locations.

```powershell
godot --headless --path apps/blue-hour --script tests/town_urban_fabric.gd
godot --path apps/blue-hour --resolution 1920x1080 --audio-driver Dummy scenes/debug/medium_town_runtime_test.tscn -- --town-seed=4101
godot --path apps/blue-hour --resolution 1920x1080 --audio-driver Dummy scenes/debug/medium_town_runtime_test.tscn -- --town-seed=4101 --town-inspect
./apps/blue-hour/run.ps1 -Mode import
./apps/blue-hour/run.ps1 -Mode smoke
./apps/blue-hour/run.ps1 -Mode build
```

## Known Issues

- The town remains an environment whitebox with low visual completion.
- Large Green Buffers have assigned land use, but the environment pass must give them visual meaning. Automated land ownership alone does not demonstrate that meaning.
- Props, Vehicles, Vegetation and Street Furniture have not received a formal distribution pass.
- Formal Expedition integration is pending.
- Character Navigation Playtest is pending; graph reachability is not a character playtest result.
- Windows build remains blocked by the existing Expedition HUD search-state test failure recorded above, unrelated to this Town Blueprint closure.

These issues are recorded, not repaired in this closure.

## Next Stage

`Medium Town V1 - Environment & Street Life Pass` is the next planned stage and has not started.

Its goals are to fill the town using existing environment assets, give Open Space / Green Buffer / Yard / Parking / Street actual visual meaning, and move toward the approved Expedition final-scene visual reference while preserving the frozen structure.

This closure changes only this report and PLAN.md. It does not start an environment pass or add models, tree/vehicle/prop distribution, enemies, loot, fog, Blue Hour, other road profiles or formal Expedition integration. No map-generation logic was changed. Evidence and Town source hashes are checked for preservation; this documentation-only closure does not rerun Godot tests, capture or Windows build.

```text
Medium Town V1 Blueprint Alignment:
CLOSED

Town Structure:
FROZEN

Next:
Environment & Street Life Pass
```
