# Expedition MiniMap V4 — Exploration & Information Layer

## Scope

V4 adds map exploration memory and information layers on top of the V3 projection and static geometry. It does not change map generation, camera, SearchTask, mission rules, or enemy behavior.

## Implementation

- `maps/exploration_state.gd` stores explored cells by map identity under `user://exploration`. Identity includes provider, mission type, seed, Town source signature, and an optional test namespace. Current visibility is rebuilt when the mission starts; previously visible cells return as discovered memory.
- `maps/exploration.gd` shares this state with gameplay visibility. New cells are marked while survivors move, periodically saved, and flushed when the node exits. Previously visited Town cells seed the GPU exploration mask. The reserved identifier `namespace` was renamed to `profile_namespace` to restore Godot 4.7 parsing.
- `ui/expedition/minimap.gd` retains Canvas drawing and the shared floor-snapped projection. Unknown cells receive an opaque blue-gray cover; discovered cells receive a lighter cover; visible cells reveal the base map. Unknown POI/building/vehicle markers are omitted. Explored buildings use native category symbols for residential, commercial, medical, and industrial sites; vehicles retain their icon. Survivor markers cluster at close range and the cluster can expand to names. Only currently visible enemies/noise can draw danger areas. Newly discovered targets produce a short `发现 ...` notice without invented resource rewards.
- `tests/expedition_minimap.gd`, `tests/expedition_minimap_local.gd`, and `tests/exploration.gd` now isolate persistent fixtures and assert V4 reveal rules rather than V3's always-visible/discovered-only assumptions.
- `tests/expedition_minimap_v4_capture.gd` creates native 1600×900 start/movement captures with a frozen nearby enemy for danger-layer review.

## Verification

Godot 4.7.2 checks:

- `tests/exploration.gd`: 9 checks, 0 failures.
- `tests/expedition_minimap.gd`: 2347 checks, 0 failures across five generated Town seeds.
- `tests/expedition_minimap_local.gd`: 2286 checks, 0 failures across four seeds.
- Native `tests/expedition_minimap_v4_capture.gd`: 6 checks, 0 failures. The squad moved, discovered-site count increased from 1 to 2, and the exploration cell count did not decrease. Captures use the Compatibility renderer on an NVIDIA RTX 3060.
- Editor scan and `--check-only` load of `maps/exploration.gd`: pass after the reserved-word fix.

Captures:

- [Exploration start, 1600×900](../test-output/expedition-minimap-v4/exploration_start.png)
- [After movement, 1600×900](../test-output/expedition-minimap-v4/exploration_moved.png)
- [MiniMap crop](../test-output/expedition-minimap-v4/minimap_v4_1600x900_crop.png)
- [Capture results](../test-output/expedition-minimap-v4/capture-report.json)

## Boundaries and Follow-up

- Discovery text intentionally does not promise food/scrap rewards. The attachment's reward text is illustrative; V4 does not synthesize rewards on reveal.
- No standalone resource-point model exists in the current MiniMap data, so unknown resources remain absent and no fabricated resource marker is added.
- Noise danger uses the current visible-noise events and their intensity/radius. There is no mission-event danger provider in this slice.
- The MiniMap projection base layer remains the complete cached Town geometry under fog. Unknown geography is hidden by the opaque fog cells; the code does not generate per-region reveal geometry.
- Human visual review of all map seeds is still required for final art approval. Automated native captures demonstrate the representative start, movement, cluster, and danger states.
