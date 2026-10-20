# Expedition Map Phase 1 + Phase 2

## Delivered

MiniMap no longer draws the town name, version label, Seed, Block ID, or debug text. Survivor markers are vector-style Godot drawing primitives: a shared ring and center dot, with breathing motion while moving and a rotating arc while searching. Marker data has no avatar texture and no selection state.

Medium Town keeps the existing seeded skeleton, block, frontage, building, and POI pipeline. Arrival selection now prefers an outside-core gateway junction with nearby generated buildings and a deterministic street-side parking support surface. The support surface is consumed by the existing environment placement rules.

## Verification

- `tests/minimap_survivor_marker_acceptance.gd`: native `23 checks / 0 failures`.
- `tests/expedition_minimap.gd`: headless `2314 checks / 0 failures`.
- `tests/town_phase_1_2_acceptance.gd`: headless `897 checks / 0 failures` across Seeds `4101-4105`.
- `tests/town_urban_fabric.gd`: `144872 checks / 0 failures`.
- `tests/town_entrance_frontage.gd`: `42192 checks / 0 failures`.
- Native five Seed comparison captures: `test-output/map-phase-1-2-minimap/seed_4101_comparison.png` through `seed_4105_comparison.png`.
- Native survivor marker captures: `test-output/minimap-survivor-marker-acceptance/01-static.png`, `02-moving.png`, `03-searching.png`.

The full build gate remains separate because existing Camp UI assertions are outside this map scope.
