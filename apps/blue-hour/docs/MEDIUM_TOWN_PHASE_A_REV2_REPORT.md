# Medium Town V1 Phase A Rev.2

## Scope

This report records the implemented seed-driven Town Generator chain. Visual acceptance remains human review.

- Profiles: `PROFILE_A_MAIN_STREET`, `PROFILE_B_OFFSET_GRID`, `PROFILE_C_LOOP`
- Output: road graph, blocks, pooled building slots, bus arrival, mission POI and runtime metrics
- Building source: existing `WorldAssetCatalog` definitions only
- Explicitly deferred: enemies, loot, fog/FOV, weather, vehicle randomization and new UI

## Verification

The initial Rev.2 topology counters were placeholders and do not establish road connectivity, cycles or true route distance. MAIN_STREET now has a separate measured Phase A.1 validation and three replacement visual review captures: see [Urban Fabric Report](MEDIUM_TOWN_URBAN_FABRIC_REPORT.md). OFFSET_GRID and LOOP have not been revalidated or changed in Phase A.1.

Run from `apps/blue-hour`:

```powershell
godot --headless --path . --script tests/town_generation_test.gd
```

`Visual QA: PENDING HUMAN REVIEW`
