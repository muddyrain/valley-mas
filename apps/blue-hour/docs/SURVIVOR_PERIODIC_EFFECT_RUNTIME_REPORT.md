# Survivor Periodic Effect Runtime Foundation V1

## Architecture

- `TraitData` now carries optional `effect_type`, `effect_interval`, `effect_duration`, `effect_radius` and `effect_target_filter` fields. Existing traits keep their previous defaults.
- `core/periodic_effect_runtime.gd` is an isolated scheduler. It advances only on explicit `advance(delta)`, supports multiple providers, pause/resume, inactive-provider filtering and serializable state.
- Target selectors support `SELF`, `ALLY`, `NEAREST_ALLY`, `LOWEST_HP_ALLY` and `ALL_TEAM`; the foundation test exercises `LOWEST_HP_ALLY` and `ALL_TEAM`.
- Apply/Expire/Refresh are represented by signals and event dictionaries. The runtime remains effect-agnostic; concrete handlers now consume those events (`HealEffectHandler` for SUR_004 and `BuffEffectHandler` for SUR_008).

## Verification

- Periodic runtime: 13/13 PASS.
- Timer cadence: no early tick and no per-frame execution.
- Target selection: lowest living ally selected; dead ally excluded.
- Lifecycle: apply, same-type refresh without stacking, duration expiry, provider unregister.
- Pause/resume: no ticks while paused.
- Save/Load: provider id, trait id, trait level, elapsed timer and active effect state serialize and restore.
- Godot Headless Import: PASS.
- Team Aura, Trait Foundation and existing XP/Level contracts were not modified by this foundation. SUR_008's later integration adds only the handler and combat read path.

## Scope boundary

The foundation itself does not own healing, critical chance, UI, recruitment, injury, fatigue or morale behavior. SUR_004 and SUR_008 now layer their isolated handlers on top of the unchanged scheduler.

`Survivor Periodic Effect Runtime Foundation V1: PASS`
