# Medium Town V1 Phase A.2: MAIN_STREET Composition

Date: 2026-09-17. Scope: `PROFILE_A_MAIN_STREET`, assembled through `scenes/debug/medium_town_runtime_test.tscn`.

`Medium Town V1 Phase A.2: TECHNICALLY COMPLETE`

`Visual QA: PENDING HUMAN REVIEW`

## Composition

The A.1 row/column skeleton has been replaced by one main street, four offset secondary branch chains and a northern connection. Seed controls junction positions, branch bends and lengths, block boundaries, asset selection and arrival. The west residential branch bends inward, with an additional two-house frontage inside the branch. This reduces the southern core's unused space. No placements are changed between screenshot views.

`town_main_street.gd` generates road-relative land polygons. Exposed polygon edges determine frontage direction and capacity. Commercial and mixed corner blocks have perpendicular frontage rows and actual concave boundaries. Industrial yards have tapered boundaries or rear recesses; the terminal residential block extends around its branch end. Parcel containment is checked against the complete polygon, not just its bounding rectangle. Yard surfaces triangulate these polygons. The existing union road mesh, separated sidewalks, catalog, runtime building scenes, frontage packing, facing correction and road-distance calculation remain in use.

Both commercial strips contain six storefronts. Housing fronts three distinct secondary branches. Industrial and service blocks occupy the eastern and southern edges. The existing arrival bus is instantiated on the main street near the boundary; the POI is an existing commercial building selected by maximum connected road distance.

The generation entry and shared building definitions are unchanged. OFFSET_GRID, LOOP, formal Expedition, Today Action, models and Phase B are not modified. No new props, randomized vehicles, enemies, loot, fog or Blue Hour controller are added.

## Seed 4101

| Measurement | Result |
| --- | --- |
| Profile | PROFILE_A_MAIN_STREET |
| Main street | 248.000 m; width 12 m |
| Secondary branches | 4; width 8 m |
| North residential branch | 96.779 m |
| East residential branch | 119.970 m |
| West residential branch | 152.241 m |
| Service branch | 171.840 m |
| Junctions | 4 T; 0 cross; 1 offset pair, 25.992 m apart |
| Secondary dead ends | 2 |
| Complete graph degree-one nodes | 4, including both main-street boundary gateways |
| Blocks / parcels / buildings | 13 / 49 / 49 |
| Block shapes | RECTANGLE 3; LONG_STRIP 2; CORNER 1; L_SHAPE 1; IRREGULAR 3; DEAD_END_BLOCK 1; SERVICE_YARD 2 |
| Rectangle share | 23.1%; 38.5% if rectangular long strips are also included |
| Buildings by block use | Residential 22; commercial 18; mixed 4; industrial 4; service 1 |
| Town bounds | X -130..130 m; Z -155..155 m; 260 x 310 m |
| Actual street envelope bounds | X -124..124 m; Z -100.279..130.283 m; 248 x 230.562 m |
| Arrival | Arrival_West; (-116, 0, 0); connected, drivable |
| POI | A08_P39; BLD_015_convenience_store_a; (72.145, 0, 29.591) |
| POI graph distance plus entrance approach | 231.188 m |
| Building overlap / building-road collision | 0 / 0 |

Street envelope bounds describe the enclosing AABB, not a rectangular perimeter road. The exact road rectangles and block polygons are recorded in `test-output/medium-town-main-street/generated-town.txt`. Junction counts come from graph node degree. Offset pairs are distinct opposite-side T junctions on the main street, separated by 16-36 m. Branch length sums every segment in that chain and excludes the shared northern connection. Both graph-terminal counts are reported to avoid hiding the main street's endpoints.

## Four Native Captures

All four PNGs are 1920 x 1080 native Godot Compatibility renders of the same generated result, profile and seed. Debug overlays, including overview locator labels, are off. Arrival and POI world positions and overview pixel coordinates are in `capture-report.json`.

1. [High Overview](../test-output/medium-town-main-street/PROFILE_A_MAIN_STREET_4101_overview.png)
2. [Main Commercial Street Runtime](../test-output/medium-town-main-street/PROFILE_A_MAIN_STREET_4101_commercial_street.png)
3. [Residential Branch Runtime](../test-output/medium-town-main-street/PROFILE_A_MAIN_STREET_4101_residential_branch.png)
4. [Dead End / Service Runtime](../test-output/medium-town-main-street/PROFILE_A_MAIN_STREET_4101_dead_end_service.png)

Runtime cameras directly read `ExpeditionCamera.DEFAULT_SIZE = 25` and `OFFSET = (34, 42, 43)`. Projection is orthographic, so perspective FOV is not applicable. Focus is selected from actual generated frontage positions. The overview uses size 348 and position (0, 480, 130); all four town-bound corners are checked inside the viewport after rendering. Pixel sampling rejects blank captures. Static daytime lighting is reused without attaching phase or gameplay systems.

CPU Generate / Build timings are recorded in the final `capture-report.json`. These exclude process startup, resource preload, GPU rendering and PNG encoding; they are not a frame-rate benchmark.

## Verification

- Godot 4.7.2 import: PASS.
- Generation and geometry: 113,425 assertions, zero failures, 30 cases covering 29 distinct seeds (4101, 4102, 4103, 17, 91, 1209, and 0..23; 17 occurs twice).
- Checks include unique main street, branch counts and lengths, real T/cross degrees, actual offset junction points, bent branches, multiple residential branches, all seven polygon shapes, varied land area, polygon-to-polygon and polygon-to-road separation, parcel containment, actual instantiated mesh bounds and facing, frontage gaps, building count, zero building overlaps, connected road graph, arrival/POI reachability, distant POI, POI side variation and deterministic output.
- Native capture: four nonblank PNGs, no script/runtime errors. Screenshot inspection does not constitute visual acceptance.
- Project Smoke: PASS with isolated test save.
- Windows build: executed; BLOCKED at the unrelated `tests/expedition_hud_phase2.gd:132` assertion `Rally is the only roster action during a search` (260 checks, one failure). No updated EXE is claimed. Log: `test-output/medium-town-main-street/windows-build.log`.
- Machine evidence: `validation.json`, `capture-report.json`, `generated-town.txt` and `native-capture.log` under `test-output/medium-town-main-street/`.

```powershell
godot --headless --path apps/blue-hour --script tests/town_urban_fabric.gd
godot --path apps/blue-hour --resolution 1920x1080 --audio-driver Dummy scenes/debug/medium_town_runtime_test.tscn -- --town-profile=PROFILE_A_MAIN_STREET --town-seed=4101
./apps/blue-hour/run.ps1 -Mode import
./apps/blue-hour/run.ps1 -Mode smoke
./apps/blue-hour/run.ps1 -Mode build
```

Technical completion refers to the A.2 composition checks, not a passing full-project Windows build. Road reachability is graph reachability; character navigation and formal mission integration are outside this phase. Seed variation uses a bounded composition grammar, not arbitrary topology. Town character, density, remaining open ground and silhouette require human review. Stop here pending that review.
