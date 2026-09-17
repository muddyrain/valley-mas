# Medium Town Phase A.1: MAIN_STREET Urban Fabric

Date: 2026-09-16. Scope: `PROFILE_A_MAIN_STREET` in `scenes/debug/medium_town_runtime_test.tscn`.

`Visual QA: PENDING HUMAN REVIEW`

## Implementation

The existing `TownGenerator.generate()` entry and `WorldAssetCatalog` remain the only generation entry and asset registry. The MAIN_STREET profile delegates its road-bounded composition to `town_urban_fabric.gd`. OFFSET_GRID and LOOP generation and screenshots are not changed by this stage. No formal Expedition or Today Action integration, Phase B logic, random props, extra vehicles, fog, enemies, loot or new models were added. The existing arrival bus is the only vehicle instantiated.

Seed determines branch positions, cross-street spacing, catalog selection and arrival choice within the existing 260 x 310 m bounds. Twelve blocks derive their boundaries from actual road edges. Street edges record the neighboring road, tangent, outward normal and available frontage. Placement filters the existing building pool by frontage and depth capacity before allocating a parcel, and uses footprint extents plus category-specific gaps. It limits ordinary assets to four uses, avoids consecutive equal models and retains single-use supermarket/pharmacy/gas rules.

Residential blocks have four houses each, commercial strips six storefronts, the commercial corner four main-street buildings plus two on its side street, mixed blocks two commercial and two residential buildings on opposite frontages, and industrial blocks two buildings with loading yards. Rear lanes, bounded yards, entrance paving and yard bay markings express internal space without prop distribution. Colored block-debug slabs are absent from the final views.

Road surfaces use exact coordinate partitioning of generated road rectangles. The resulting mesh contains each covered surface cell once, including T and cross junctions. Sidewalks subtract the road union. Pavement and ground occupy separate elevations, eliminating the earlier coplanar comb-like interference. Road topology splits centre lines at real intersections, verifies connectivity and uses graph paths for POI distance.

Four-sided native asset inspection identified +Z visible facades in the BLD_009 through BLD_022 wrappers, despite -Z FrontMarker anchors. MAIN_STREET QA instances rotate their ModelRoot by 180 degrees around the wrapper origin, preserving their existing authored correction transforms. Shared Runtime Scenes, definitions, anchors, collisions and GLB files remain unchanged, so the other profiles are unaffected. Geometric tests instantiate this exact renderer path and remeasure the transformed meshes. The audit contact sheets remain under `test-output/random-map/contact-9.jpg` and `contact-16.jpg`.

## Representative Result

| Measurement | Seed 4101 |
| --- | ---: |
| Profile | PROFILE_A_MAIN_STREET |
| Town bounds | X -130..130 m; Z -155..155 m |
| Blocks / Parcels / Buildings | 12 / 47 / 47 |
| Residential-block buildings | 16 |
| Commercial-block buildings | 18 |
| Mixed-block buildings | 8 |
| Industrial-block buildings | 4 |
| Service-block buildings | 1 |
| Average residential contour gap | 2.829 m |
| Average commercial frontage gap | 1.825 m |
| Major building overlap | 0 |
| Building-road intersection | 0 |
| POI road path including entrance approach | 188.519 m |
| Generate time | 5.575 ms |
| Build time | 14.550 ms |

Counts by block use are mutually exclusive; mixed blocks contain both housing and commerce. Gap measurements come from adjacent building bounds, not center distances. Timings are a single native run's CPU generation and assembly measurements, with catalog resources already preloaded. They exclude process startup, resource preload, GPU rendering and PNG encoding; they are not a frame-rate benchmark.

## Captures

All three are native Godot Compatibility renders at 1920 x 1080, using the same profile and seed, without changing generated placements between cameras.

- [High Overview](../test-output/medium-town-urban-fabric/PROFILE_A_MAIN_STREET_4101_overview.png)
- [Main Commercial Street](../test-output/medium-town-urban-fabric/PROFILE_A_MAIN_STREET_4101_commercial_street.png)
- [Residential Street](../test-output/medium-town-urban-fabric/PROFILE_A_MAIN_STREET_4101_residential_street.png)

Runtime shots directly use `ExpeditionCamera.DEFAULT_SIZE = 25` and `OFFSET = (34, 42, 43)` with orthographic projection. Perspective FOV does not apply. The static lighting matches current Expedition daytime settings without attaching its clock or phase controller. Overview uses orthographic size 348 and validates all four Town Bounds corners inside the viewport. Pixel sampling rejects blank captures. Arrival and POI labels are overview locators; block, parcel, footprint and road-edge debug overlays are off.

## Verification

- Godot 4.7.2 Import: PASS.
- MAIN_STREET generation: PASS for 30 cases covering 29 distinct seeds (4101, 4102, 4103, 17, 91, 1209 and 0..23; seed 17 is repeated).
- 92,909 assertions: PASS. Positive parcel dimensions, containment, parcel non-overlap, actual runtime mesh bounds, building overlap, building-road intersections, authored FrontMarker alignment, audited visible-facade correction, runtime RoadAnchor positions, measured gaps, building count, independent road connectivity, connected arrival and POI, same-seed determinism.
- Native debug scene capture: PASS, three nonblank PNGs; no script/runtime errors in the final capture run.
- Project Smoke: PASS with the repository's isolated test save.
- Windows build: attempted and BLOCKED by the unrelated `tests/expedition_hud_phase2.gd:132` assertion, `Rally is the only roster action during a search` (260 checks, one failure). No updated executable is claimed.
- Machine evidence: `test-output/medium-town-urban-fabric/validation.json` and `capture-report.json`.

Commands from repository root, with Godot available as `godot`:

```powershell
godot --headless --path apps/blue-hour --script tests/town_urban_fabric.gd
godot --path apps/blue-hour --resolution 1920x1080 --audio-driver Dummy scenes/debug/medium_town_runtime_test.tscn -- --town-profile=PROFILE_A_MAIN_STREET --town-seed=4101
./apps/blue-hour/run.ps1 -Mode import
./apps/blue-hour/run.ps1 -Mode smoke
./apps/blue-hour/run.ps1 -Mode build
```

## Files And Limits

- `maps/town/town_generator.gd`: existing entry dispatches MAIN_STREET composition.
- `maps/town/town_skeleton.gd`: only MAIN_STREET branches into road-derived blocks.
- `maps/town/town_urban_fabric.gd`: frontage, fitted parcels, pooled placement, yards, arrival and POI.
- `maps/town/town_road_graph.gd`: real topology and path distance for MAIN_STREET.
- `maps/town/town_urban_view.gd`: native runtime scene assembly and road union meshes.
- `maps/town/town_runtime_visual_test.gd`: MAIN_STREET cameras, captures and timing.
- `tests/town_urban_fabric.gd`: generation and actual asset geometry checks.
- `docs/PLAN.md`, this report and the Rev.2 report: current status and evidence.

The graph verifies road reachability, not a new character-navigation or mission integration. Main-street branch count and block arrangement rules remain bounded; seed variation changes dimensions, assets and arrival within those rules. Buildings and ground remain prototype art. The 260 x 310 m envelope includes unused peripheral ground; the streets occupy a smaller area within it. Human assessment of density, road widths, corner composition and overall town character is pending. No automatic transition to other profiles or Phase B is authorized by this report.
