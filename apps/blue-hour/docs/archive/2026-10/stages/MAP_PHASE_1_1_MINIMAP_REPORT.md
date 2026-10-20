# Map Phase 1.1 — Runtime Generated MiniMap

Status: `TECHNICALLY COMPLETE`

Visual QA: `PENDING HUMAN REVIEW`

The Expedition MiniMap now consumes the generated town snapshot exposed by `mission.runtime_data`. The cached structure contains `town_bounds`, `road_bounds`, `minimap_geometry.regions`, and `minimap_geometry.buildings`; dynamic points use `arrival_point`, `mission_poi`, discovered site entries, and live survivor positions. The renderer never scans world nodes or Mesh instances.

The static `TownWorldLayer` is rebuilt only when the map seed or generator signature changes. This report describes the original 1.1 bridge; the geometry contract was expanded in Map Phase 1.1.5 to use road polygons, explicit Arrival zones, parking areas, and typed building footprints. Existing HUD frame assets and marker textures remain in place.

Validation used seeds `4101`, `4102`, `4103`, `4104`, and `4105`. `tests/expedition_minimap.gd` checks generator-to-runtime road and building equality, region equality, arrival and POI coordinates, marker projection, marker separation, seed-specific geometry, static-cache reuse, movement updates, resize behavior, and legacy fallback.

Evidence:

- `test-output/expedition-integration-e01-5/report.json`
- `test-output/map-phase-1-1/minimap_visual.png` (native screenshot for human review)

No Town Structure, E00, E01, E01.5, E02, or P02 gameplay systems were changed in the original 1.1 bridge. See [Map Phase 1.1.5](MAP_PHASE_1_1_5_MINIMAP_GEOMETRY_REPORT.md) for the later geometry snapshot repair.
