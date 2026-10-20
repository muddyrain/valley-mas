# Survivor Periodic Team Effect Runtime V1

## Architecture

- `TraitData` carries optional `effect_type`, `effect_interval`, `effect_duration`, `effect_radius` and `effect_target_filter` fields. Periodic params additionally support a generic `condition` and `condition_value` without identity checks.
- `core/periodic_effect_runtime.gd` is an isolated scheduler. It advances only on explicit `advance(delta)`, supports multiple providers, pause/resume, inactive-provider filtering and serializable state.
- Target selectors support `SELF`, `ALLY`, `NEAREST_ALLY`, `LOWEST_HP_ALLY` and `ALL_TEAM`; the foundation test exercises `LOWEST_HP_ALLY` and `ALL_TEAM`.
- Apply/Expire/Refresh are represented by signals and event dictionaries. The runtime remains effect-agnostic; concrete handlers now consume those events (`HealEffectHandler` for SUR_004 and `BuffEffectHandler` for SUR_008).
- SUR_004 uses `hp_below_ratio = 0.5`, selects the lowest damaged living team member, and can select its provider when the provider is the lowest damaged member. No eligible target produces no apply event.

## Verification

- Periodic runtime: 13/13 PASS.
- SUR_004 Emergency Care: 20/20 PASS.
- SUR_008 Morale Boost: 24/24 PASS.
- Timer cadence: no early tick and no per-frame execution.
- Target selection: lowest living damaged member selected; dead, full-health and out-of-radius members excluded; provider self-heal is supported when it is the lowest damaged member.
- Lifecycle: apply, same-type refresh without stacking, duration expiry, provider unregister.
- Pause/resume: no ticks while paused.
- Save/Load: provider id, trait id, trait level, elapsed timer and active effect state serialize and restore.
- Godot Headless Import: PASS.
- Team Aura, Trait Foundation and existing XP/Level contracts were not modified by this foundation. SUR_008's later integration adds only the handler and combat read path.

## Scope boundary

The foundation itself does not own healing, critical chance, UI, recruitment, injury, fatigue or morale behavior. SUR_004 and SUR_008 now layer their isolated handlers on top of the unchanged scheduler.

`Survivor Periodic Team Effect Runtime V1: PASS`
